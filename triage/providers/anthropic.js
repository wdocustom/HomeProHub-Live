/**
 * Anthropic Provider Implementation
 */

const Anthropic = require('@anthropic-ai/sdk');
const { config } = require('../config');

class AnthropicProvider {
  constructor(modelName) {
    this.modelName = modelName;
    this.client = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });
  }

  async chat(messages, options = {}) {
    // Anthropic requires system messages to be separate
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const systemPrompt = systemMessages.map(m => m.content).join('\n\n');

    const requestPayload = {
      model: this.modelName,
      max_tokens: options.max_tokens || 4096,
      temperature: options.temperature ?? 0.7,
      system: systemPrompt || undefined,
      messages: conversationMessages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    };

    const message = await this.client.messages.create(requestPayload);

    // Extract text from content blocks
    const text = message.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    const usage = {
      prompt_tokens: message.usage.input_tokens,
      completion_tokens: message.usage.output_tokens,
      total_tokens: message.usage.input_tokens + message.usage.output_tokens,
    };

    return { text, usage };
  }
}

module.exports = AnthropicProvider;
