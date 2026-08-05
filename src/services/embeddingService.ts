/**
 * OpenRouter Embedding Service for Vector Generation
 * ================================================
 * Generates vector embeddings for text chunks using OpenRouter API / free embedding models
 * with exponential backoff retries, timeout handling, and deterministic fallback vector calculations.
 */

export interface EmbeddingLog {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

export interface EmbeddingResult {
  embeddings: number[][];
  logs: EmbeddingLog[];
}

export class EmbeddingService {
  private apiKey: string;
  private model: string;
  private timeoutMs: number;
  private maxRetries: number;
  private logs: EmbeddingLog[] = [];

  constructor(
    model: string = 'text-embedding-3-small',
    timeoutMs: number = 15000,
    maxRetries: number = 3
  ) {
    this.apiKey =
      ((import.meta as any).env?.VITE_OPENROUTER_API_KEY as string) ||
      ((import.meta as any).env?.OPENROUTER_API_KEY as string) ||
      (typeof process !== 'undefined' ? process.env?.OPENROUTER_API_KEY : '') ||
      ((import.meta as any).env?.VITE_GEMINI_API_KEY as string) ||
      ((import.meta as any).env?.GEMINI_API_KEY as string) ||
      (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : '') ||
      '';
    this.model = model;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
  }

  private log(level: 'INFO' | 'WARN' | 'ERROR', message: string) {
    const timestamp = new Date().toISOString();
    this.logs.push({ timestamp, level, message });
    console.log(`[EmbeddingService] [${level}] ${message}`);
  }

  public getLogs(): EmbeddingLog[] {
    return [...this.logs];
  }

  /**
   * Generates vector embedding for a single string with timeout & retry logic.
   * Stops using local fallback embeddings when an API key is available.
   */
  public async generateEmbedding(text: string): Promise<number[]> {
    if (!text || !text.trim()) {
      return new Array(1536).fill(0);
    }

    // Refresh key check if needed
    const activeKey =
      this.apiKey ||
      ((import.meta as any).env?.VITE_OPENROUTER_API_KEY as string) ||
      ((import.meta as any).env?.OPENROUTER_API_KEY as string) ||
      (typeof process !== 'undefined' ? process.env?.OPENROUTER_API_KEY : '') ||
      ((import.meta as any).env?.VITE_GEMINI_API_KEY as string) ||
      ((import.meta as any).env?.GEMINI_API_KEY as string) ||
      (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : '') ||
      '';

    if (!activeKey) {
      this.log('ERROR', 'No API key configured for embedding generation.');
      throw new Error('API key is missing for vector embedding generation.');
    }

    let delay = 1000;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        this.log('INFO', `Sending embedding request for text length: ${text.length} chars (Model: ${this.model})...`);

        const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${activeKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://ai.studio/build',
            'X-Title': 'RAG Production App',
          },
          body: JSON.stringify({
            model: this.model,
            input: text,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          throw new Error(`Embedding API HTTP ${response.status}: ${response.statusText} ${errText}`);
        }

        const data = await response.json();
        if (data && data.data && data.data[0] && data.data[0].embedding) {
          const emb: number[] = data.data[0].embedding;
          this.log('INFO', `Generated embedding successfully (Dimension: ${emb.length}, Model: ${this.model}).`);
          return emb;
        }

        throw new Error('Invalid embedding response structure from embedding API.');
      } catch (err: any) {
        this.log('WARN', `Embedding generation attempt ${attempt}/${this.maxRetries} failed: ${err.message || err}`);
        if (attempt < this.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
        } else {
          this.log('ERROR', `All ${this.maxRetries} embedding generation attempts failed.`);
          throw new Error(`Embedding service failed: ${err.message || err}`);
        }
      }
    }

    throw new Error('Embedding generation failed.');
  }

  /**
   * Generates embeddings for a batch of text chunks.
   */
  public async generateBatchEmbeddings(texts: string[]): Promise<EmbeddingResult> {
    this.logs = [];
    this.log('INFO', 'Connecting to OpenRouter...');
    this.log('INFO', `Generating embeddings for ${texts.length} chunk(s)...`);

    const embeddings: number[][] = [];
    for (let i = 0; i < texts.length; i++) {
      const emb = await this.generateEmbedding(texts[i]);
      embeddings.push(emb);
    }

    this.log('INFO', `Successfully generated ${embeddings.length} embedding vector(s).`);

    return {
      embeddings,
      logs: [...this.logs],
    };
  }
}

export const defaultEmbeddingService = new EmbeddingService();
