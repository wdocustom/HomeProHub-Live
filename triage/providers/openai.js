/**
 * OpenAI Provider Implementation
 */

const OpenAI = require('openai');
const { config } = require('../config');

class OpenAIProvider {
  constructor(modelName) {
    this.modelName = modelName;
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  async chat(messages, options = {}) {
    const requestPayload = {
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

    const completion = await this.client.chat.completions.create(requestPayload);

    const text = completion.choices[0]?.message?.content || '';
    const usage = completion.usage
      ? {
          prompt_tokens: completion.usage.prompt_tokens,
          completion_tokens: completion.usage.completion_tokens,
          total_tokens: completion.usage.total_tokens,
        }
      : undefined;

    return { text, usage };
  }
}

module.exports = OpenAIProvider;
