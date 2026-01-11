import { LLMProvider, UserContext, LogContext } from '../types';
import { RouterOutput } from '../router/schema';
import { getAnswerSystemPrompt, getAnswerUserPrompt } from '../prompts/answer';
import { validateResponseContract, formatValidationWarning } from './contract';
import { logAnswer, logError } from '../logger';

export async function runAnswer(
  provider: LLMProvider,
  message: string,
  routerOutput: RouterOutput,
  context: LogContext,
  userContext?: UserContext,
  mode: 'homeowner' | 'contractor' = 'homeowner'
): Promise<string> {
  try {
    const systemPrompt = getAnswerSystemPrompt(mode);
    const userPrompt = getAnswerUserPrompt(message, routerOutput, userContext);

    const response = await provider.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        temperature: 0.7,
        max_tokens: 3000,
      }
    );

    const markdown = response.text;

    // Validate response contract
    const validation = validateResponseContract(markdown);
    if (!validation.valid) {
      const warning = formatValidationWarning(validation);
      logError(
        { ...context, validation },
        new Error('Response missing required sections')
      );
      return markdown + warning;
    }

    logAnswer({ ...context, tokens: response.usage });
    return markdown;
  } catch (error) {
    logError(context, error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}
