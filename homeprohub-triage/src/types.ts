import { z } from 'zod';
import { RouterOutputSchema } from './router/schema';

// ===== Request/Response Types =====

export interface TriageRequest {
  message: string;
  context?: UserContext;
  provider?: 'openai' | 'anthropic';
  mode?: 'homeowner' | 'contractor';
}

export interface UserContext {
  location?: string;
  yearBuilt?: number;
  propertyType?: 'single_family' | 'condo' | 'townhouse' | 'multi_family' | 'commercial';
  diyLevel?: 'none' | 'low' | 'medium' | 'high' | 'expert';
  budgetBand?: 'low' | 'medium' | 'high' | 'unknown';
}

export interface TriageResponse {
  request_id: string;
  router: RouterOutput;
  answer_markdown: string;
  metadata?: {
    router_latency_ms: number;
    answer_latency_ms: number;
    total_latency_ms: number;
    router_tokens?: TokenUsage;
    answer_tokens?: TokenUsage;
    router_retries: number;
  };
}

// ===== Router Types =====

export type RouterOutput = z.infer<typeof RouterOutputSchema>;

// ===== Provider Types =====

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
}

export interface LLMResponse {
  text: string;
  usage?: TokenUsage;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface LLMProvider {
  chat(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;
}

// ===== Logging Types =====

export interface LogContext {
  request_id: string;
  provider?: string;
  model?: string;
  latency_ms?: number;
  tokens?: TokenUsage;
  error?: Error;
  [key: string]: unknown;
}

// ===== Cache Types =====

export interface CacheAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
}
