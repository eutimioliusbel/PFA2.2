import { AzureOpenAI } from 'openai';
import { IAiProvider, AiChatRequest, AiResponse, AiStreamChunk, AiMessage } from './types';
import { logger } from '../../utils/logger';

export class AzureOpenAIAdapter implements IAiProvider {
  private client: AzureOpenAI;
  private defaultModel: string;
  private pricingInput: number;
  private pricingOutput: number;

  constructor(
    apiKey: string,
    endpoint: string,
    deploymentName: string,
    _model: string = 'gpt-4',
    pricing?: { input: number; output: number }
  ) {
    this.client = new AzureOpenAI({
      apiKey,
      endpoint,
      apiVersion: '2024-02-15-preview',
    });
    this.defaultModel = deploymentName;
    this.pricingInput = pricing?.input || 10.0;
    this.pricingOutput = pricing?.output || 30.0;
  }

  async chat(request: AiChatRequest): Promise<AiResponse> {
    const startTime = Date.now();

    try {
      const completion = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: this.formatMessages(request.messages),
        temperature: request.temperature ?? 1.0,
        max_tokens: request.maxTokens ?? 4096,
        stream: false,
      });

      const message = completion.choices[0]?.message;
      if (!message?.content) {
        throw new Error('No response from Azure OpenAI');
      }

      const usage = completion.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      };

      const latencyMs = Date.now() - startTime;
      const cost = this.calculateCost(usage.prompt_tokens, usage.completion_tokens);

      logger.info(`Azure OpenAI chat completed: ${usage.total_tokens} tokens, ${latencyMs}ms, $${cost.toFixed(4)}`);

      return {
        text: message.content,
        finishReason: this.mapFinishReason(completion.choices[0]?.finish_reason),
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        },
        model: completion.model,
        provider: 'azure-openai',
        latencyMs,
        cost,
      };
    } catch (error: any) {
      logger.error('Azure OpenAI API error:', error);
      throw this.handleError(error);
    }
  }

  async *stream(request: AiChatRequest): AsyncIterable<AiStreamChunk> {
    try {
      const stream = await this.client.chat.completions.create({
        model: this.defaultModel,
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
      logger.error('Azure OpenAI stream error:', error);
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

  private formatMessages(messages: AiMessage[]): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    return messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
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
      return new Error('AUTHENTICATION_FAILED: Invalid Azure OpenAI API key');
    }
    if (error.status === 429) {
      return new Error('QUOTA_EXCEEDED: Azure OpenAI API rate limit exceeded');
    }
    if (error.status === 500 || error.status === 503) {
      return new Error('SERVICE_UNAVAILABLE: Azure OpenAI API temporarily unavailable');
    }
    return new Error(`AZURE_OPENAI_ERROR: ${error.message || 'Unknown error'}`);
  }
}
