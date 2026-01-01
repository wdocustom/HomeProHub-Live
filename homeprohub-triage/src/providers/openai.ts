import OpenAI from 'openai';
import { BaseLLMProvider } from './base';
import { LLMMessage, LLMOptions, LLMResponse } from '../types';
import { config } from '../config';
import logger from '../logger';

export class OpenAIProvider extends BaseLLMProvider {
  private client: OpenAI;

  constructor(modelName: string) {
    super(modelName);
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  async chat(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
    this.validateMessages(messages);

    const requestPayload: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model: this.modelName,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens,
    };

    // Add response_format for JSON mode if requested
    if (options.response_format?.type === 'json_object') {
      requestPayload.response_format = { type: 'json_object' };
    }

    try {
      const startTime = Date.now();
      const completion = await this.client.chat.completions.create(requestPayload);
      const latency = Date.now() - startTime;

      const text = completion.choices[0]?.message?.content || '';
      const usage = completion.usage
        ? {
            prompt_tokens: completion.usage.prompt_tokens,
            completion_tokens: completion.usage.completion_tokens,
            total_tokens: completion.usage.total_tokens,
          }
        : undefined;

      logger.debug('OpenAI completion', {
        model: this.modelName,
        latency_ms: latency,
        tokens: usage,
      });

      return { text, usage };
    } catch (error) {
      logger.error('OpenAI API error', {
        model: this.modelName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
