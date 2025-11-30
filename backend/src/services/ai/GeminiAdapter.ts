import { GoogleGenerativeAI } from '@google/generative-ai';
import { IAiProvider, AiChatRequest, AiResponse, AiStreamChunk, AiMessage } from './types';
import { logger } from '../../utils/logger';

export class GeminiAdapter implements IAiProvider {
  private client: GoogleGenerativeAI;
  private defaultModel: string;
  private pricingInput: number; // USD per 1M tokens
  private pricingOutput: number;

  constructor(apiKey: string, model: string = 'gemini-2.0-flash-exp', pricing?: { input: number; output: number }) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.defaultModel = model;
    this.pricingInput = pricing?.input || 0; // Free tier default
    this.pricingOutput = pricing?.output || 0;
  }

  async chat(request: AiChatRequest): Promise<AiResponse> {
    const startTime = Date.now();
    const model = this.client.getGenerativeModel({ model: request.model || this.defaultModel });

    try {
      // Convert messages to Gemini format
      const prompt = this.formatMessages(request.messages);

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: request.temperature ?? 1.0,
          maxOutputTokens: request.maxTokens ?? 8192,
        },
      });

      const response = await result.response;
      const text = response.text();

      // Estimate tokens (Gemini doesn't provide exact counts in response)
      const promptTokens = await this.countTokens(prompt);
      const completionTokens = await this.countTokens(text);

      const latencyMs = Date.now() - startTime;
      const cost = this.calculateCost(promptTokens, completionTokens);

      logger.info(`Gemini chat completed: ${promptTokens + completionTokens} tokens, ${latencyMs}ms, $${cost.toFixed(4)}`);

      return {
        text,
        finishReason: 'stop',
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
        model: request.model || this.defaultModel,
        provider: 'gemini',
        latencyMs,
        cost,
      };
    } catch (error: unknown) {
      logger.error('Gemini API error:', error);
      throw this.handleError(error);
    }
  }

  async *stream(request: AiChatRequest): AsyncIterable<AiStreamChunk> {
    const model = this.client.getGenerativeModel({ model: request.model || this.defaultModel });
    const prompt = this.formatMessages(request.messages);

    try {
      const result = await model.generateContentStream({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: request.temperature ?? 1.0,
          maxOutputTokens: request.maxTokens ?? 8192,
        },
      });

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        yield { delta: chunkText };
      }
    } catch (error: unknown) {
      logger.error('Gemini stream error:', error);
      throw this.handleError(error);
    }
  }

  async countTokens(text: string): Promise<number> {
    try {
      const model = this.client.getGenerativeModel({ model: this.defaultModel });
      const result = await model.countTokens(text);
      return result.totalTokens;
    } catch (error) {
      // Fallback: rough estimation (1 token ≈ 4 chars)
      return Math.ceil(text.length / 4);
    }
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
    } catch (error: unknown) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private formatMessages(messages: AiMessage[]): string {
    // Gemini doesn't have native multi-turn in generateContent
    // Concatenate messages into single prompt
    return messages
      .map(m => `${m.role === 'user' ? 'User' : m.role === 'system' ? 'System' : 'Assistant'}: ${m.content}`)
      .join('\n\n');
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1_000_000) * this.pricingInput;
    const outputCost = (outputTokens / 1_000_000) * this.pricingOutput;
    return inputCost + outputCost;
  }

  private handleError(error: any): Error {
    if (error.message?.includes('API key')) {
      return new Error('AUTHENTICATION_FAILED: Invalid Gemini API key');
    }
    if (error.message?.includes('quota')) {
      return new Error('QUOTA_EXCEEDED: Gemini API quota exceeded');
    }
    return new Error(`GEMINI_ERROR: ${error.message || 'Unknown error'}`);
  }
}
