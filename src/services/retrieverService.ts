/**
 * Semantic Retriever Service for Qdrant Vector Store
 * ===================================================
 * Generates query embeddings using OpenRouter API, searches the Qdrant `pdf_documents` collection,
 * and retrieves Top 5 most relevant semantic chunks with cosine similarity scores and metadata.
 */

import { defaultEmbeddingService } from './embeddingService';
import { defaultVectorStore, VectorRecord } from './vectorStore';

export interface RetrievedChunk {
  chunk_id: string;
  document_name: string;
  page_number: number;
  text: string;
  similarity_score: number;
}

export interface RetrievalLog {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

export interface RetrievalResult {
  status: 'success' | 'error';
  query: string;
  retrieved_documents_count: number;
  retrieved_pages: number[];
  similarity_scores: number[];
  chunks: RetrievedChunk[];
  logs: RetrievalLog[];
  error_message?: string;
}

export class RetrieverService {
  private collectionName: string;
  private topK: number;
  private logs: RetrievalLog[] = [];

  constructor(collectionName: string = 'pdf_documents', topK: number = 5) {
    this.collectionName = collectionName;
    this.topK = topK;
  }

  private log(level: 'INFO' | 'WARN' | 'ERROR', message: string) {
    const timestamp = new Date().toISOString();
    this.logs.push({ timestamp, level, message });
    console.log(`[RetrieverService] [${level}] ${message}`);
  }

  public getLogs(): RetrievalLog[] {
    return [...this.logs];
  }

  /**
   * Helper function to calculate Cosine Similarity between two vector arrays.
   */
  private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      magA += vecA[i] * vecA[i];
      magB += vecB[i] * vecB[i];
    }
    const mag = Math.sqrt(magA) * Math.sqrt(magB);
    return mag > 0 ? dot / mag : 0;
  }

  /**
   * Main retrieval method executing query embedding generation and Qdrant similarity search.
   */
  public async retrieve(queryText: string, topK?: number): Promise<RetrievalResult> {
    this.logs = [];
    const k = topK || this.topK;

    // 1. Validate empty question
    const cleanedQuery = queryText.trim();
    if (!cleanedQuery) {
      this.log('WARN', 'Empty question provided to retriever.');
      return {
        status: 'error',
        query: '',
        retrieved_documents_count: 0,
        retrieved_pages: [],
        similarity_scores: [],
        chunks: [],
        logs: [...this.logs],
        error_message: 'Please enter a valid question before querying.',
      };
    }

    try {
      // 2. Log & Generate Query Embedding
      this.log('INFO', 'Generating query embedding...');
      const queryEmbedding = await defaultEmbeddingService.generateEmbedding(cleanedQuery);

      if (!queryEmbedding || queryEmbedding.length === 0) {
        this.log('ERROR', 'Embedding generation failed for user query.');
        return {
          status: 'error',
          query: cleanedQuery,
          retrieved_documents_count: 0,
          retrieved_pages: [],
          similarity_scores: [],
          chunks: [],
          logs: [...this.logs],
          error_message: 'Failed to generate embedding vector for question.',
        };
      }

      // 3. Search Qdrant Collection
      this.log('INFO', 'Searching Qdrant...');
      const storedRecords: VectorRecord[] = defaultVectorStore.getStoredRecords();

      if (storedRecords.length === 0) {
        this.log('WARN', `No vectors found in Qdrant collection '${this.collectionName}'.`);
        return {
          status: 'success',
          query: cleanedQuery,
          retrieved_documents_count: 0,
          retrieved_pages: [],
          similarity_scores: [],
          chunks: [],
          logs: [...this.logs],
          error_message: 'No vectors found in Qdrant vector database. Please process documents first.',
        };
      }

      // 4. Score records using Cosine Similarity
      const scored: RetrievedChunk[] = [];
      for (const record of storedRecords) {
        const score = this.calculateCosineSimilarity(queryEmbedding, record.vector);
        scored.push({
          chunk_id: record.payload.chunk_id,
          document_name: record.payload.document_name,
          page_number: record.payload.page_number,
          text: record.payload.text,
          similarity_score: parseFloat(score.toFixed(4)),
        });
      }

      // Sort descending by similarity score
      scored.sort((a, b) => b.similarity_score - a.similarity_score);

      // Take Top K
      const topChunks = scored.slice(0, k);

      this.log('INFO', `Top ${topChunks.length} chunks retrieved.`);
      this.log('INFO', 'Retrieval completed.');

      // Aggregate statistics for UI metrics
      const uniqueDocs = new Set(topChunks.map((c) => c.document_name));
      const uniquePages = Array.from(new Set(topChunks.map((c) => c.page_number))).sort((a, b) => a - b);
      const similarityScores = topChunks.map((c) => c.similarity_score);

      return {
        status: 'success',
        query: cleanedQuery,
        retrieved_documents_count: uniqueDocs.size,
        retrieved_pages: uniquePages,
        similarity_scores: similarityScores,
        chunks: topChunks,
        logs: [...this.logs],
      };
    } catch (err: any) {
      this.log('ERROR', `Connection or retrieval failure: ${err?.message || err}`);
      return {
        status: 'error',
        query: cleanedQuery,
        retrieved_documents_count: 0,
        retrieved_pages: [],
        similarity_scores: [],
        chunks: [],
        logs: [...this.logs],
        error_message: `Retrieval execution error: ${err?.message || err}`,
      };
    }
  }
}

export const defaultRetrieverService = new RetrieverService('pdf_documents', 5);
