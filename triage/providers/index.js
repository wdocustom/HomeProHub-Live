/**
 * Provider Factory
 */

const OpenAIProvider = require('./openai');
const AnthropicProvider = require('./anthropic');
const { config } = require('../config');

function createProvider(providerType, purpose) {
  if (providerType === 'openai') {
    if (!config.openai.apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    const modelName =
      purpose === 'router' ? config.openai.routerModel : config.openai.answerModel;
    return new OpenAIProvider(modelName);
  }

  if (providerType === 'anthropic') {
    if (!config.anthropic.apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }
    const modelName =
      purpose === 'router' ? config.anthropic.routerModel : config.anthropic.answerModel;
    return new AnthropicProvider(modelName);
  }

  throw new Error(`Unknown provider type: ${providerType}`);
}

module.exports = { createProvider };
