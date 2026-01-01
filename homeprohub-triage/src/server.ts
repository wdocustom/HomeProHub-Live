import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import { config, validateConfig } from './config';
import { TriageRequest, TriageResponse } from './types';
import { createProvider, ProviderType } from './providers';
import { runRouter } from './router/router';
import { runAnswer } from './answer/answer';
import { logRequest, logResponse, logError } from './logger';
import logger from './logger';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
  next();
});

// ===== Health Check =====
app.get('/health', (req: Request, res: Response) => {
  const configValidation = validateConfig();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    config: configValidation,
  });
});

// ===== POST /api/triage =====
app.post('/api/triage', async (req: Request, res: Response) => {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  const startTime = Date.now();

  try {
    // Parse request
    const triageReq: TriageRequest = req.body;

    // Validate request
    if (!triageReq.message || triageReq.message.trim().length === 0) {
      return res.status(400).json({
        error: 'message is required and cannot be empty',
        request_id: requestId,
      });
    }

    const provider: ProviderType = triageReq.provider || 'openai';
    const mode = triageReq.mode || 'homeowner';

    logRequest({ request_id: requestId, provider, mode }, triageReq);

    // Create providers
    const routerProvider = createProvider(provider, 'router');
    const answerProvider = createProvider(provider, 'answer');

    // PASS 1: Router
    const routerStart = Date.now();
    const { output: routerOutput, retries: routerRetries } = await runRouter(
      routerProvider,
      triageReq.message,
      { request_id: requestId, provider },
      triageReq.context
    );
    const routerLatency = Date.now() - routerStart;

    // PASS 2: Answer
    const answerStart = Date.now();
    const answerMarkdown = await runAnswer(
      answerProvider,
      triageReq.message,
      routerOutput,
      { request_id: requestId, provider },
      triageReq.context,
      mode
    );
    const answerLatency = Date.now() - answerStart;

    const totalLatency = Date.now() - startTime;

    // Build response
    const response: TriageResponse = {
      request_id: requestId,
      router: routerOutput,
      answer_markdown: answerMarkdown,
      metadata: {
        router_latency_ms: routerLatency,
        answer_latency_ms: answerLatency,
        total_latency_ms: totalLatency,
        router_retries: routerRetries,
      },
    };

    logResponse({
      request_id: requestId,
      provider,
      latency_ms: totalLatency,
      router_retries: routerRetries,
    });

    res.json(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logError({ request_id: requestId }, err);

    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
      request_id: requestId,
    });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: Function) => {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  logError({ request_id: requestId }, err);

  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    request_id: requestId,
  });
});

// Start server
function startServer() {
  const configValidation = validateConfig();
  if (!configValidation.valid) {
    logger.error('Configuration validation failed', {
      errors: configValidation.errors,
    });
    process.exit(1);
  }

  app.listen(config.server.port, () => {
    logger.info(`HomeProHub Triage Server started`, {
      port: config.server.port,
      env: config.server.env,
    });
  });
}

// Only start if this file is executed directly
if (require.main === module) {
  startServer();
}

export { app, startServer };
