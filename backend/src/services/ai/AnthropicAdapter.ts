import Anthropic from '@anthropic-ai/sdk';
import { IAiProvider, AiChatRequest, AiResponse, AiStreamChunk, AiMessage } from './types';
import { logger } from '../../utils/logger';

export class AnthropicAdapter implements IAiProvider {
  private client: Anthropic;
  private defaultModel: string;
  private pricingInput: number;
  private pricingOutput: number;

  constructor(apiKey: string, model: string = 'claude-3-5-sonnet-20241022', pricing?: { input: number; output: number }) {
    this.client = new Anthropic({ apiKey });
    this.defaultModel = model;
    this.pricingInput = pricing?.input || 3.0;
    this.pricingOutput = pricing?.output || 15.0;
  }

  async chat(request: AiChatRequest): Promise<AiResponse> {
    const startTime = Date.now();

    try {
      const { systemMessage, messages } = this.formatMessages(request.messages);

      const response = await this.client.messages.create({
        model: request.model || this.defaultModel,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 1.0,
        system: systemMessage,
        messages,
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('');

      const latencyMs = Date.now() - startTime;
      const cost = this.calculateCost(response.usage.input_tokens, response.usage.output_tokens);

      logger.info(`Anthropic chat completed: ${response.usage.input_tokens + response.usage.output_tokens} tokens, ${latencyMs}ms, $${cost.toFixed(4)}`);

      return {
        text,
        finishReason: this.mapStopReason(response.stop_reason),
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        model: response.model,
        provider: 'anthropic',
        latencyMs,
        cost,
      };
    } catch (error: any) {
      logger.error('Anthropic API error:', error);
      throw this.handleError(error);
    }
  }

  async *stream(request: AiChatRequest): AsyncIterable<AiStreamChunk> {
    try {
      const { systemMessage, messages } = this.formatMessages(request.messages);

      const stream = await this.client.messages.create({
        model: request.model || this.defaultModel,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 1.0,
        system: systemMessage,
        messages,
        stream: true,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield { delta: event.delta.text };
        }

        if (event.type === 'message_delta' && event.delta.stop_reason) {
          yield {
            delta: '',
            finishReason: this.mapStopReason(event.delta.stop_reason),
          };
        }
      }
    } catch (error: any) {
      logger.error('Anthropic stream error:', error);
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

  private formatMessages(messages: AiMessage[]): {
    systemMessage?: string;
    messages: Anthropic.MessageParam[];
  } {
    const systemMessages = messages.filter(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    return {
      systemMessage: systemMessages.map(m => m.content).join('\n\n') || undefined,
      messages: chatMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      })),
    };
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1_000_000) * this.pricingInput;
    const outputCost = (outputTokens / 1_000_000) * this.pricingOutput;
    return inputCost + outputCost;
  }

  private mapStopReason(reason: string | null): 'stop' | 'length' | 'content_filter' {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'stop_sequence':
        return 'stop';
      default:
        return 'stop';
    }
  }

  private handleError(error: any): Error {
    if (error.status === 401) {
      return new Error('AUTHENTICATION_FAILED: Invalid Anthropic API key');
    }
    if (error.status === 429) {
      return new Error('QUOTA_EXCEEDED: Anthropic API rate limit exceeded');
    }
    if (error.status === 529) {
      return new Error('SERVICE_UNAVAILABLE: Anthropic API overloaded');
    }
    return new Error(`ANTHROPIC_ERROR: ${error.message || 'Unknown error'}`);
  }
}
