import winston from 'winston';
import { config } from './config';
import { LogContext } from './types';

const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      ),
    }),
  ],
});

// Structured logging helpers
export function logRouter(context: LogContext, routerOutput: unknown) {
  logger.info('Router pass completed', {
    ...context,
    router_output: routerOutput,
  });
}

export function logRouterRetry(context: LogContext, attempt: number, error: unknown) {
  logger.warn('Router validation failed, retrying', {
    ...context,
    attempt,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function logRouterFallback(context: LogContext, reason: string) {
  logger.warn('Router fallback to safe default', {
    ...context,
    reason,
  });
}

export function logAnswer(context: LogContext) {
  logger.info('Answer pass completed', context);
}

export function logError(context: LogContext, error: Error) {
  logger.error('Operation failed', {
    ...context,
    error: error.message,
    stack: error.stack,
  });
}

export function logRequest(context: LogContext, request: unknown) {
  logger.info('Triage request received', {
    ...context,
    request,
  });
}

export function logResponse(context: LogContext) {
  logger.info('Triage response sent', context);
}

export default logger;
