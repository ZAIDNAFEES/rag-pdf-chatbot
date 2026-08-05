import { ExtractedPage } from './pdfParser';
import { TextChunk } from './textChunker';

export interface Citation {
  document_name: string;
  page_number: number;
  retrieved_text: string;
  score?: number;
  chunk_id?: string;
}

export interface QAResponse {
  answer: string;
  citations: Citation[];
  found: boolean;
}

export class RAGEngine {
  /**
   * Retrieves context chunks from extracted text chunks (or pages) and generates an answer with explicit citations.
   */
  public static query(queryText: string, items: (TextChunk | ExtractedPage)[]): QAResponse {
    const trimmedQuery = queryText.trim().toLowerCase();
    if (!trimmedQuery || items.length === 0) {
      return {
        answer: "The information is not available in the provided documents.",
        citations: [],
        found: false,
      };
    }

    // Extract query terms (stop word filtering)
    const stopWords = new Set([
      'what', 'is', 'the', 'a', 'an', 'in', 'on', 'of', 'and', 'or', 'for', 'to',
      'how', 'why', 'who', 'where', 'which', 'are', 'was', 'were', 'can', 'does',
      'do', 'explain', 'show', 'tell', 'me', 'about'
    ]);
    const queryTerms = trimmedQuery
      .replace(/[^\w\s]/gi, '')
      .split(/\s+/)
      .filter((t) => t.length > 1 && !stopWords.has(t));

    if (queryTerms.length === 0) {
      queryTerms.push(trimmedQuery);
    }

    // Score chunks based on term matches & phrase matches
    const scoredItems: { item: TextChunk | ExtractedPage; score: number; snippet: string }[] = [];

    for (const item of items) {
      const lowerText = item.text.toLowerCase();
      let score = 0;

      // Phrase match bonus
      if (lowerText.includes(trimmedQuery)) {
        score += 15;
      }

      // Individual term match
      for (const term of queryTerms) {
        const matches = (lowerText.match(new RegExp(`\\b${term}`, 'g')) || []).length;
        score += matches * 3;
      }

      if (score > 0) {
        // Snippet extraction
        const firstMatchIndex = Math.max(
          0,
          queryTerms.map((t) => lowerText.indexOf(t)).find((idx) => idx !== -1) ?? 0
        );

        const startIdx = Math.max(0, firstMatchIndex - 60);
        const endIdx = Math.min(item.text.length, firstMatchIndex + 260);
        let snippet = item.text.substring(startIdx, endIdx).trim();
        if (startIdx > 0) snippet = '...' + snippet;
        if (endIdx < item.text.length) snippet = snippet + '...';

        scoredItems.push({
          item,
          score,
          snippet,
        });
      }
    }

    // Sort by relevance score descending
    scoredItems.sort((a, b) => b.score - a.score);

    // If score is too low or no matches found: Return mandatory non-hallucination fallback response
    if (scoredItems.length === 0 || scoredItems[0].score < 1) {
      return {
        answer: "The information is not available in the provided documents.",
        citations: [],
        found: false,
      };
    }

    // Top k citations (max 3)
    const topResults = scoredItems.slice(0, 3);
    const citations: Citation[] = topResults.map((res) => ({
      document_name: res.item.document_name,
      page_number: res.item.page_number,
      retrieved_text: res.snippet,
      score: res.score,
      chunk_id: (res.item as TextChunk).chunk_id || undefined,
    }));

    // Synthesize structured answer directly based on retrieved snippets
    const primarySnippet = topResults[0].snippet.replace(/^(\.\.\.)?/, '').replace(/(\.\.\.)?$/, '');
    const docName = topResults[0].item.document_name;
    const pageNum = topResults[0].item.page_number;

    const answer = `Based on page ${pageNum} of "${docName}", ${primarySnippet}`;

    return {
      answer,
      citations,
      found: true,
    };
  }
}
