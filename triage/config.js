/**
 * Triage System Configuration
 * Uses existing environment variables from main .env file
 */

const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    routerModel: process.env.OPENAI_ROUTER_MODEL || 'gpt-4o-mini',
    answerModel: process.env.OPENAI_ANSWER_MODEL || 'gpt-4o',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    routerModel: process.env.ANTHROPIC_ROUTER_MODEL || 'claude-3-5-haiku-20241022',
    answerModel: process.env.ANTHROPIC_ANSWER_MODEL || 'claude-3-5-sonnet-20240620',
  },
};

function validateConfig() {
  const errors = [];

  if (!config.openai.apiKey && !config.anthropic.apiKey) {
    errors.push('At least one API key (OPENAI_API_KEY or ANTHROPIC_API_KEY) must be set');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = { config, validateConfig };
