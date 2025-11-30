import OpenAI from 'openai';
import { IAiProvider, AiChatRequest, AiResponse, AiStreamChunk, AiMessage } from './types';
import { logger } from '../../utils/logger';

export class OpenAIAdapter implements IAiProvider {
  private client: OpenAI;
  private defaultModel: string;
  private pricingInput: number;
  private pricingOutput: number;

  constructor(apiKey: string, model: string = 'gpt-4-turbo-preview', pricing?: { input: number; output: number }) {
    this.client = new OpenAI({ apiKey });
    this.defaultModel = model;
    this.pricingInput = pricing?.input || 10.0;
    this.pricingOutput = pricing?.output || 30.0;
  }

  async chat(request: AiChatRequest): Promise<AiResponse> {
    const startTime = Date.now();

    try {
      const completion = await this.client.chat.completions.create({
        model: request.model || this.defaultModel,
        messages: this.formatMessages(request.messages),
        temperature: request.temperature ?? 1.0,
        max_tokens: request.maxTokens ?? 4096,
        stream: false,
      });

      const message = completion.choices[0]?.message;
      if (!message?.content) {
        throw new Error('No response from OpenAI');
      }

      const usage = completion.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      };

      const latencyMs = Date.now() - startTime;
      const cost = this.calculateCost(usage.prompt_tokens, usage.completion_tokens);

      logger.info(`OpenAI chat completed: ${usage.total_tokens} tokens, ${latencyMs}ms, $${cost.toFixed(4)}`);

      return {
        text: message.content,
        finishReason: this.mapFinishReason(completion.choices[0]?.finish_reason),
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        },
        model: completion.model,
        provider: 'openai',
        latencyMs,
        cost,
      };
    } catch (error: any) {
      logger.error('OpenAI API error:', error);
      throw this.handleError(error);
    }
  }

  async *stream(request: AiChatRequest): AsyncIterable<AiStreamChunk> {
    try {
      const stream = await this.client.chat.completions.create({
        model: request.model || this.defaultModel,
        messages: this.formatMessages(request.messages),
        temperature: request.temperature ?? 1.0,
        max_tokens: request.maxTokens ?? 4096,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        const finishReason = chunk.choices[0]?.finish_reason;

        yield {
          delta,
          finishReason: finishReason ? this.mapFinishReason(finishReason) : undefined,
        };
      }
    } catch (error: any) {
      logger.error('OpenAI stream error:', error);
      throw this.handleError(error);
    }
  }

  async countTokens(text: string): Promise<number> {
    return Math.ceil(text.length / 4);
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const startTime = Date.now();
    try {
      await this.chat({
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 10,
        userId: 'health-check',
        organizationId: 'health-check',
      });
      return { healthy: true, latencyMs: Date.now() - startTime };
    } catch (error: any) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private formatMessages(messages: AiMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1_000_000) * this.pricingInput;
    const outputCost = (outputTokens / 1_000_000) * this.pricingOutput;
    return inputCost + outputCost;
  }

  private mapFinishReason(reason: string | null | undefined): 'stop' | 'length' | 'content_filter' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      default:
        return 'stop';
    }
  }

  private handleError(error: any): Error {
    if (error.status === 401) {
      return new Error('AUTHENTICATION_FAILED: Invalid OpenAI API key');
    }
    if (error.status === 429) {
      return new Error('QUOTA_EXCEEDED: OpenAI API rate limit exceeded');
    }
    if (error.status === 500 || error.status === 503) {
      return new Error('SERVICE_UNAVAILABLE: OpenAI API temporarily unavailable');
    }
    return new Error(`OPENAI_ERROR: ${error.message || 'Unknown error'}`);
  }
}
