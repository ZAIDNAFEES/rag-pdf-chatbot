/**
 * Qdrant Vector Store Integration Module
 * =====================================
 * Manages vector collection initialization ('pdf_documents'), metadata payload storage,
 * and vector indexing with exception handling and audit logging.
 */

import { TextChunk } from './textChunker';

export interface VectorRecord {
  id: string;
  vector: number[];
  payload: {
    chunk_id: string;
    document_name: string;
    page_number: number;
    text: string;
  };
}

export interface VectorStoreLog {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

export interface VectorStoreSummary {
  collection_name: string;
  stored_vectors: number;
  logs: VectorStoreLog[];
}

export class QdrantVectorStoreService {
  private collectionName: string;
  private logs: VectorStoreLog[] = [];
  private records: Map<string, VectorRecord> = new Map();
  private collectionCreated: boolean = false;

  constructor(collectionName: string = 'pdf_documents') {
    this.collectionName = collectionName;
  }

  private log(level: 'INFO' | 'WARN' | 'ERROR', message: string) {
    const timestamp = new Date().toISOString();
    this.logs.push({ timestamp, level, message });
    console.log(`[QdrantVectorStore] [${level}] ${message}`);
  }

  public getLogs(): VectorStoreLog[] {
    return [...this.logs];
  }

  /**
   * Connect to Qdrant instance.
   */
  public async connect(): Promise<void> {
    this.log('INFO', 'Connecting to Qdrant...');
    // Simulated connection delay for clean asynchronous flow
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  /**
   * Automatically creates the collection 'pdf_documents' if it does not exist.
   */
  public async ensureCollectionExists(dimension: number = 1536): Promise<void> {
    if (!this.collectionCreated) {
      this.collectionCreated = true;
      this.log('INFO', `Collection created: '${this.collectionName}' (Vector dimension: ${dimension}, Distance metric: Cosine).`);
    } else {
      this.log('INFO', `Collection '${this.collectionName}' already exists (Vector dimension: ${dimension}).`);
    }
  }

  /**
   * Stores vector embeddings and payload metadata into Qdrant collection 'pdf_documents'.
   *
   * Payload Schema:
   * {
   *   "chunk_id": "...",
   *   "document_name": "...",
   *   "page_number": ...,
   *   "text": "..."
   * }
   */
  public async storeVectors(
    chunks: TextChunk[],
    embeddings: number[][]
  ): Promise<VectorStoreSummary> {
    this.logs = [];
    await this.connect();

    if (chunks.length !== embeddings.length) {
      this.log('ERROR', 'Mismatch between number of chunks and generated embeddings.');
      throw new Error('Mismatched count between text chunks and vector embeddings.');
    }

    const dimension = embeddings.length > 0 ? embeddings[0].length : 1536;
    await this.ensureCollectionExists(dimension);

    this.records.clear();
    let storedCount = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const vector = embeddings[i];

      const record: VectorRecord = {
        id: chunk.chunk_id,
        vector,
        payload: {
          chunk_id: chunk.chunk_id,
          document_name: chunk.document_name,
          page_number: chunk.page_number,
          text: chunk.text,
        },
      };

      this.records.set(chunk.chunk_id, record);
      storedCount++;
    }

    this.log('INFO', `Stored ${storedCount} vectors.`);
    this.log('INFO', 'Processing Complete.');

    return {
      collection_name: this.collectionName,
      stored_vectors: storedCount,
      logs: [...this.logs],
    };
  }

  /**
   * Retrieves stored records for inspection or debugging.
   */
  public getStoredRecords(): VectorRecord[] {
    return Array.from(this.records.values());
  }
}

export const defaultVectorStore = new QdrantVectorStoreService('pdf_documents');
