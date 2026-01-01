import { LLMProvider, LLMMessage, LLMOptions, LLMResponse } from '../types';

export abstract class BaseLLMProvider implements LLMProvider {
  protected modelName: string;

  constructor(modelName: string) {
    this.modelName = modelName;
  }

  abstract chat(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;

  protected validateMessages(messages: LLMMessage[]): void {
    if (messages.length === 0) {
      throw new Error('Messages array cannot be empty');
    }

    for (const msg of messages) {
      if (!['system', 'user', 'assistant'].includes(msg.role)) {
        throw new Error(`Invalid message role: ${msg.role}`);
      }
      if (typeof msg.content !== 'string' || msg.content.trim().length === 0) {
        throw new Error('Message content must be a non-empty string');
      }
    }
  }
}
