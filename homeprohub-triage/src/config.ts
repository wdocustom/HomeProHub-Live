import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    env: process.env.NODE_ENV || 'development',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    routerModel: process.env.OPENAI_ROUTER_MODEL || 'gpt-4o-mini',
    answerModel: process.env.OPENAI_ANSWER_MODEL || 'gpt-4o',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    routerModel: process.env.ANTHROPIC_ROUTER_MODEL || 'claude-3-haiku-20240307',
    answerModel: process.env.ANTHROPIC_ANSWER_MODEL || 'claude-3-5-sonnet-20241022',
  },
  cache: {
    redisUrl: process.env.REDIS_URL,
    ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '3600', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
} as const;

// Validation
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.openai.apiKey && !config.anthropic.apiKey) {
    errors.push('At least one API key (OPENAI_API_KEY or ANTHROPIC_API_KEY) must be set');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
