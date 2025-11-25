export interface AiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AiChatRequest {
  messages: AiMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  userId: string;
  organizationId: string;
}

export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AiResponse {
  text: string;
  finishReason: 'stop' | 'length' | 'content_filter';
  usage: AiUsage;
  model: string;
  provider: string;
  cached?: boolean;
  latencyMs: number;
  cost?: number;
}

export interface AiStreamChunk {
  delta: string;
  finishReason?: 'stop' | 'length' | 'content_filter';
}

export type AiProviderType = 'gemini' | 'openai' | 'anthropic' | 'azure-openai';

export interface IAiProvider {
  chat(request: AiChatRequest): Promise<AiResponse>;
  stream(request: AiChatRequest): AsyncIterable<AiStreamChunk>;
  countTokens(text: string): Promise<number>;
  healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }>;
}
