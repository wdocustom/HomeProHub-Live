import Anthropic from '@anthropic-ai/sdk';
import { BaseLLMProvider } from './base';
import { LLMMessage, LLMOptions, LLMResponse } from '../types';
import { config } from '../config';
import logger from '../logger';

export class AnthropicProvider extends BaseLLMProvider {
  private client: Anthropic;

  constructor(modelName: string) {
    super(modelName);
    this.client = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });
  }

  async chat(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
    this.validateMessages(messages);

    // Anthropic requires system messages to be separate
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const systemPrompt = systemMessages.map(m => m.content).join('\n\n');

    const requestPayload: Anthropic.MessageCreateParams = {
      model: this.modelName,
      max_tokens: options.max_tokens || 4096,
      temperature: options.temperature ?? 0.7,
      system: systemPrompt || undefined,
      messages: conversationMessages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    };

    try {
      const startTime = Date.now();
      const message = await this.client.messages.create(requestPayload);
      const latency = Date.now() - startTime;

      // Extract text from content blocks
      const text = message.content
        .filter(block => block.type === 'text')
        .map(block => ('text' in block ? block.text : ''))
        .join('\n');

      const usage = {
        prompt_tokens: message.usage.input_tokens,
        completion_tokens: message.usage.output_tokens,
        total_tokens: message.usage.input_tokens + message.usage.output_tokens,
      };

      logger.debug('Anthropic completion', {
        model: this.modelName,
        latency_ms: latency,
        tokens: usage,
      });

      return { text, usage };
    } catch (error) {
      logger.error('Anthropic API error', {
        model: this.modelName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
