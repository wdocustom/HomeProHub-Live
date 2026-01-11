import { LLMProvider } from '../types';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { config } from '../config';

export type ProviderType = 'openai' | 'anthropic';
export type ModelPurpose = 'router' | 'answer';

export function createProvider(
  providerType: ProviderType,
  purpose: ModelPurpose
): LLMProvider {
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

export { OpenAIProvider, AnthropicProvider };
