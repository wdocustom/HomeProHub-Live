import { LLMProvider, UserContext, LogContext } from '../types';
import { RouterOutput, RouterOutputSchema, getSafeDefaultRouterOutput } from './schema';
import { getRouterSystemPrompt, getRouterUserPrompt } from '../prompts/router';
import { getRepairSystemPrompt, getRepairUserPrompt } from '../prompts/repair';
import { logRouter, logRouterRetry, logRouterFallback } from '../logger';
import { ZodError } from 'zod';

export async function runRouter(
  provider: LLMProvider,
  message: string,
  context: LogContext,
  userContext?: UserContext
): Promise<{ output: RouterOutput; retries: number }> {
  let retries = 0;

  // First attempt
  try {
    const output = await attemptRouterPass(provider, message, userContext);
    logRouter(context, output);
    return { output, retries };
  } catch (error) {
    if (error instanceof ZodError) {
      logRouterRetry(context, 1, error);
      retries = 1;

      // Retry with repair prompt
      try {
        const repairedOutput = await attemptRouterRepair(provider, error, context);
        logRouter(context, repairedOutput);
        return { output: repairedOutput, retries };
      } catch (repairError) {
        logRouterFallback(
          context,
          `Repair attempt failed: ${repairError instanceof Error ? repairError.message : String(repairError)}`
        );
        retries = 2;
      }
    } else {
      logRouterFallback(
        context,
        `Router error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Fallback to safe default
  const defaultOutput = getSafeDefaultRouterOutput();
  logRouter(context, { ...defaultOutput, _fallback: true });
  return { output: defaultOutput, retries };
}

async function attemptRouterPass(
  provider: LLMProvider,
  message: string,
  userContext?: UserContext
): Promise<RouterOutput> {
  const systemPrompt = getRouterSystemPrompt();
  const userPrompt = getRouterUserPrompt(message, userContext);

  const response = await provider.chat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    {
      temperature: 0.3,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
    }
  );

  // Parse and validate JSON
  const parsed = JSON.parse(response.text);
  return RouterOutputSchema.parse(parsed);
}

async function attemptRouterRepair(
  provider: LLMProvider,
  validationError: ZodError,
  context: LogContext
): Promise<RouterOutput> {
  // Get the invalid JSON from context if available
  // For now, we'll try to repair based on the error alone
  const systemPrompt = getRepairSystemPrompt();
  const userPrompt = getRepairUserPrompt(
    'See validation error below',
    JSON.stringify(validationError.errors, null, 2)
  );

  const response = await provider.chat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    {
      temperature: 0.1,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
    }
  );

  const parsed = JSON.parse(response.text);
  return RouterOutputSchema.parse(parsed);
}
