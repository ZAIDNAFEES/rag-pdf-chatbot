/**
 * Complete Retrieval-Augmented Generation (RAG) Service
 * ====================================================
 * Connects Qdrant vector retrieval with OpenRouter LLM answer synthesis.
 * Implements strict context grounding, citations mapping, and fallback handling.
 */

import { defaultRetrieverService, RetrievedChunk, RetrievalResult } from './retrieverService';
import { defaultLLMService, LLMService } from './llmService';

export interface CitationItem {
  document_name: string;
  page_number: number;
  retrieved_text: string;
}

export interface RAGPipelineResult {
  status: 'success' | 'error';
  answer: string;
  citations: CitationItem[];
  retrieval_result: RetrievalResult;
  logs: string[];
  error_message?: string;
}

export const NO_INFO_FALLBACK = "The information is not available in the provided documents.";

export class RAGService {
  private topK: number;
  private similarityThreshold: number;
  private maxContextChars: number;
  private llmService: LLMService;

  constructor(
    topK: number = 5,
    similarityThreshold: number = 0.05,
    maxContextChars: number = 3500,
    llmService: LLMService = defaultLLMService
  ) {
    this.topK = topK;
    this.similarityThreshold = similarityThreshold;
    this.maxContextChars = maxContextChars;
    this.llmService = llmService;
  }

  private normalizeText(text: string): string {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /**
   * Executes the complete RAG Pipeline.
   */
  public async executePipeline(question: string): Promise<RAGPipelineResult> {
    const logs: string[] = [];

    const addLog = (msg: string) => {
      logs.push(`[${new Date().toISOString()}] ${msg}`);
      console.log(`[RAGService] ${msg}`);
    };

    const cleanedQuestion = question.trim();

    // 1. Validate empty question
    if (!cleanedQuestion) {
      addLog('Empty question provided.');
      return {
        status: 'error',
        answer: NO_INFO_FALLBACK,
        citations: [],
        retrieval_result: {
          status: 'error',
          query: '',
          retrieved_documents_count: 0,
          retrieved_pages: [],
          similarity_scores: [],
          chunks: [],
          logs: [],
          error_message: 'Question cannot be empty.',
        },
        logs,
        error_message: 'Please enter a question.',
      };
    }

    // 2. Perform Semantic Vector Retrieval from Qdrant 'pdf_documents' collection
    addLog('Executing vector retrieval from Qdrant...');
    const retrievalResult = await defaultRetrieverService.retrieve(cleanedQuestion, this.topK);

    // Append retriever internal logs
    for (const rlog of retrievalResult.logs) {
      addLog(rlog.message);
    }

    // Check raw chunks retrieved
    const rawChunks: RetrievedChunk[] = retrievalResult.chunks || [];
    if (rawChunks.length === 0) {
      addLog('No relevant chunks found in Qdrant vector store. Skipping LLM call.');
      return {
        status: 'success',
        answer: NO_INFO_FALLBACK,
        citations: [],
        retrieval_result: retrievalResult,
        logs,
      };
    }

    // 3. Log similarity scores & filter by Similarity Threshold
    addLog(`Retrieved ${rawChunks.length} raw candidate chunks.`);
    rawChunks.forEach((c, idx) => {
      addLog(`Chunk #${idx + 1} score: ${c.similarity_score.toFixed(4)} (Doc: ${c.document_name}, Page: ${c.page_number})`);
    });

    const filteredChunks = rawChunks.filter(
      (c) => c.similarity_score >= this.similarityThreshold
    );

    const discardedByScore = rawChunks.length - filteredChunks.length;
    if (discardedByScore > 0) {
      addLog(`Discarded ${discardedByScore} chunk(s) falling below similarity threshold (${this.similarityThreshold}).`);
    }

    if (filteredChunks.length === 0) {
      addLog(`No chunks satisfied the similarity threshold (${this.similarityThreshold}). Returning fallback.`);
      return {
        status: 'success',
        answer: NO_INFO_FALLBACK,
        citations: [],
        retrieval_result: retrievalResult,
        logs,
      };
    }

    // 4. Remove duplicate or near-identical text chunks
    const seenTexts = new Set<string>();
    const dedupedChunks: RetrievedChunk[] = [];

    for (const c of filteredChunks) {
      const norm = this.normalizeText(c.text);
      if (!seenTexts.has(norm)) {
        seenTexts.add(norm);
        dedupedChunks.push(c);
      } else {
        addLog(`Discarded duplicate chunk text from Doc: ${c.document_name}, Page: ${c.page_number}.`);
      }
    }

    addLog(`Selected ${dedupedChunks.length} unique chunk(s) for context construction.`);

    // 5. Context Optimization (character budget capping)
    const contextBlocks: string[] = [];
    const citationsMap = new Map<string, CitationItem>();
    let currentChars = 0;

    for (let i = 0; i < dedupedChunks.length; i++) {
      const chunk = dedupedChunks[i];
      const docName = chunk.document_name || 'document.pdf';
      const pageNum = chunk.page_number || 1;
      const text = chunk.text.trim();

      const block = `[Chunk ${i + 1} | Document: ${docName} | Page: ${pageNum}]\n${text}`;
      if (currentChars + block.length > this.maxContextChars && i > 0) {
        addLog(`Reached max context character limit (${this.maxContextChars} chars). Capping context at ${i} chunks.`);
        break;
      }

      contextBlocks.push(block);
      currentChars += block.length;

      const citationKey = `${docName}-p${pageNum}-${text.slice(0, 40)}`;
      if (!citationsMap.has(citationKey)) {
        citationsMap.set(citationKey, {
          document_name: docName,
          page_number: pageNum,
          retrieved_text: text,
        });
      }
    }

    const combinedContext = contextBlocks.join('\n\n');
    const userPrompt = `Context:\n${combinedContext}\n\nQuestion:\n${cleanedQuestion}\n\nAnswer:`;

    addLog('Generating prompt...');
    console.log('=== EXACT GENERATED RAG USER PROMPT ===');
    console.log(userPrompt);
    console.log('======================================');
    addLog(`Sending LLM request with context length: ${combinedContext.length} chars.`);
    addLog(`Exact Prompt:\n${userPrompt}`);

    // 6. Call OpenRouter LLM Service
    addLog('Calling OpenRouter...');
    addLog('Generating response...');

    try {
      const generatedAnswer = await this.llmService.generateCompletion(userPrompt);
      addLog('Response completed.');

      if (!generatedAnswer || generatedAnswer.includes(NO_INFO_FALLBACK)) {
        addLog('LLM indicated information not available in context.');
        return {
          status: 'success',
          answer: NO_INFO_FALLBACK,
          citations: [],
          retrieval_result: retrievalResult,
          logs,
        };
      }

      const finalCitations = Array.from(citationsMap.values());

      return {
        status: 'success',
        answer: generatedAnswer,
        citations: finalCitations,
        retrieval_result: retrievalResult,
        logs,
      };
    } catch (err: any) {
      addLog(`LLM invocation error: ${err?.message || err}`);
      return {
        status: 'error',
        answer: NO_INFO_FALLBACK,
        citations: [],
        retrieval_result: retrievalResult,
        logs,
        error_message: `LLM service error: ${err?.message || err}`,
      };
    }
  }
}

export const defaultRAGService = new RAGService(5, 0.05, 3500);
