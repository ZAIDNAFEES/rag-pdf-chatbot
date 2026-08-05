import { ExtractedPage } from './pdfParser';

export interface TextChunk {
  chunk_id: string;
  document_name: string;
  page_number: number;
  text: string;
}

export interface ChunkingLog {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

export interface ChunkingSummary {
  pages_processed: number;
  chunks_generated: number;
  average_chunk_size: number;
  chunks: TextChunk[];
  logs: ChunkingLog[];
}

/**
 * Utility to generate RFC4122 v4 compliant UUID strings.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class TextChunkerService {
  private chunkSize: number;
  private chunkOverlap: number;
  private logs: ChunkingLog[] = [];

  constructor(chunkSize: number = 800, chunkOverlap: number = 150) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  private log(level: 'INFO' | 'WARN' | 'ERROR', message: string) {
    const timestamp = new Date().toISOString();
    this.logs.push({ timestamp, level, message });
    console.log(`[TextChunker] [${level}] ${message}`);
  }

  public getLogs(): ChunkingLog[] {
    return [...this.logs];
  }

  /**
   * Recursive character splitter inspired by LangChain RecursiveCharacterTextSplitter.
   * Splits a single page's text into semantic overlapping chunks.
   * Enforces rules:
   *  - Never mixes content from different pages/documents.
   *  - Preserves sentence boundaries where possible.
   *  - Removes extra whitespace.
   *  - Skips empty chunks.
   */
  public splitPageText(text: string, documentName: string, pageNumber: number): TextChunk[] {
    // 1. Clean whitespace
    const cleanedText = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();

    if (!cleanedText) {
      return [];
    }

    if (cleanedText.length <= this.chunkSize) {
      return [
        {
          chunk_id: generateUUID(),
          document_name: documentName,
          page_number: pageNumber,
          text: cleanedText,
        },
      ];
    }

    // 2. Recursive separators ordered by semantic strength
    const separators = ['\n\n', '\n', '. ', '! ', '? ', '; ', ' ', ''];

    const rawChunks = this.recursiveSplit(cleanedText, separators, this.chunkSize, this.chunkOverlap);

    // 3. Map into TextChunk objects with metadata & unique UUIDs
    const textChunks: TextChunk[] = [];
    for (const rawChunk of rawChunks) {
      const trimmed = rawChunk.trim();
      if (trimmed.length > 0) {
        textChunks.push({
          chunk_id: generateUUID(),
          document_name: documentName,
          page_number: pageNumber,
          text: trimmed,
        });
      }
    }

    return textChunks;
  }

  /**
   * Internal recursive splitting algorithm
   */
  private recursiveSplit(
    text: string,
    separators: string[],
    chunkSize: number,
    chunkOverlap: number
  ): string[] {
    if (text.length <= chunkSize) {
      return [text];
    }

    // Find the best separator that exists in the text
    let separator = separators[separators.length - 1]; // default character split
    let nextSeparators: string[] = [];

    for (let i = 0; i < separators.length; i++) {
      const s = separators[i];
      if (s === '' || text.includes(s)) {
        separator = s;
        nextSeparators = separators.slice(i + 1);
        break;
      }
    }

    // Split text by selected separator
    const splits = separator === '' ? text.split('') : text.split(separator);
    const resultChunks: string[] = [];
    let currentChunk: string[] = [];
    let currentLen = 0;

    for (const split of splits) {
      const splitText = split + (separator !== '' ? separator : '');
      const splitLen = splitText.length;

      if (currentLen + splitLen > chunkSize && currentChunk.length > 0) {
        // Form current chunk
        const joined = currentChunk.join('').trim();
        if (joined.length > chunkSize && nextSeparators.length > 0) {
          // If a single combined split exceeds chunk size, recursively split it
          const subSplits = this.recursiveSplit(joined, nextSeparators, chunkSize, chunkOverlap);
          resultChunks.push(...subSplits);
        } else if (joined.length > 0) {
          resultChunks.push(joined);
        }

        // Calculate overlap for next chunk
        const overlapBuffer: string[] = [];
        let overlapLen = 0;
        for (let i = currentChunk.length - 1; i >= 0; i--) {
          const item = currentChunk[i];
          if (overlapLen + item.length <= chunkOverlap) {
            overlapBuffer.unshift(item);
            overlapLen += item.length;
          } else {
            break;
          }
        }

        currentChunk = [...overlapBuffer, splitText];
        currentLen = overlapLen + splitLen;
      } else {
        currentChunk.push(splitText);
        currentLen += splitLen;
      }
    }

    if (currentChunk.length > 0) {
      const remaining = currentChunk.join('').trim();
      if (remaining.length > chunkSize && nextSeparators.length > 0) {
        const subSplits = this.recursiveSplit(remaining, nextSeparators, chunkSize, chunkOverlap);
        resultChunks.push(...subSplits);
      } else if (remaining.length > 0) {
        resultChunks.push(remaining);
      }
    }

    return resultChunks;
  }

  /**
   * Processes all extracted pages from multiple PDF files.
   * Guarantees that page and document boundaries are strictly preserved.
   */
  public processPages(pages: ExtractedPage[]): ChunkingSummary {
    this.logs = [];
    this.log('INFO', `Starting text chunking module on ${pages.length} extracted page(s)...`);
    this.log('INFO', `Configured Chunk Size: ${this.chunkSize} chars | Chunk Overlap: ${this.chunkOverlap} chars.`);

    const allChunks: TextChunk[] = [];
    let totalChars = 0;

    for (const page of pages) {
      try {
        const pageChunks = this.splitPageText(page.text, page.document_name, page.page_number);
        allChunks.push(...pageChunks);

        const pageChars = pageChunks.reduce((acc, c) => acc + c.text.length, 0);
        totalChars += pageChars;

        this.log(
          'INFO',
          `Processed page ${page.page_number} of "${page.document_name}": Generated ${pageChunks.length} chunk(s).`
        );
      } catch (err: any) {
        this.log(
          'ERROR',
          `Error chunking page ${page.page_number} of "${page.document_name}": ${err?.message || err}`
        );
      }
    }

    const pagesProcessed = pages.length;
    const chunksGenerated = allChunks.length;
    const averageChunkSize =
      chunksGenerated > 0 ? parseFloat((totalChars / chunksGenerated).toFixed(1)) : 0;

    this.log('INFO', `=== Chunking Summary ===`);
    this.log('INFO', `- Number of pages processed: ${pagesProcessed}`);
    this.log('INFO', `- Number of chunks generated: ${chunksGenerated}`);
    this.log('INFO', `- Average chunk size: ${averageChunkSize} characters`);

    return {
      pages_processed: pagesProcessed,
      chunks_generated: chunksGenerated,
      average_chunk_size: averageChunkSize,
      chunks: allChunks,
      logs: [...this.logs],
    };
  }
}

export const defaultTextChunker = new TextChunkerService(800, 150);
