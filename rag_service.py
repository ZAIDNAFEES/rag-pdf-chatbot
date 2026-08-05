"""
Complete Retrieval-Augmented Generation (RAG) Service Module
=============================================================

This module orchestrates the complete RAG pipeline:
1. Performs semantic vector retrieval from Qdrant (`pdf_documents` collection).
2. Validates retrieved context (returns non-hallucination fallback if context is empty/irrelevant without calling LLM).
3. Constructs formatted prompt with context ONLY.
4. Invokes OpenRouter LLM service under strict system rules.
5. Formats structured answer with citations.

Response Format:
{
    "answer": "<Generated Answer>",
    "citations": [
        {
            "document_name": "<name>",
            "page_number": <int>,
            "retrieved_text": "<text>"
        }
    ]
}

Logging Sequence:
- Generating prompt...
- Calling OpenRouter...
- Generating response...
- Response completed.
"""

import logging
from typing import List, Dict, Any, Optional

from retriever import SemanticRetriever, retrieve_relevant_chunks
from llm_service import OpenRouterLLMService, SYSTEM_PROMPT

logger = logging.getLogger("RAGService")
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s"
)

NO_INFO_FALLBACK = "The information is not available in the provided documents."


class RAGPipelineService:
    """
    Production RAG Pipeline Service linking semantic vector retrieval with LLM answer synthesis.
    Includes similarity score thresholding, duplicate removal, context length optimization, and detailed logging.
    """

    def __init__(
        self,
        retriever: Optional[SemanticRetriever] = None,
        llm_service: Optional[OpenRouterLLMService] = None,
        top_k: int = 5,
        similarity_threshold: float = 0.15,
        max_context_chars: int = 3500
    ) -> None:
        """
        Initialize RAG Pipeline Service.

        Args:
            retriever (SemanticRetriever, optional): Vector retriever instance.
            llm_service (OpenRouterLLMService, optional): OpenRouter LLM service instance.
            top_k (int): Number of top chunks to retrieve for prompt context (default: 5).
            similarity_threshold (float): Minimum cosine similarity score required (default: 0.15).
            max_context_chars (int): Maximum combined context length limit (default: 3500).
        """
        self.top_k = top_k
        self.similarity_threshold = similarity_threshold
        self.max_context_chars = max_context_chars
        self.retriever = retriever or SemanticRetriever(top_k=top_k)
        self.llm_service = llm_service or OpenRouterLLMService()

    @staticmethod
    def _normalize_text(text: str) -> str:
        """Normalize text for duplicate chunk detection."""
        return " ".join(text.lower().split())

    def run_pipeline(self, question: str) -> Dict[str, Any]:
        """
        Execute full RAG pipeline for a given user question.

        Args:
            question (str): User question text.

        Returns:
            Dict[str, Any]: Result containing answer string and citations list.
        """
        if not question or not question.strip():
            logger.warning("Empty question submitted to RAG pipeline.")
            return {
                "answer": NO_INFO_FALLBACK,
                "citations": []
            }

        cleaned_question = question.strip()

        # Step 1: Retrieve Top 5 relevant chunks from Qdrant
        retrieval_res = self.retriever.retrieve(cleaned_question, top_k=self.top_k)
        raw_chunks = retrieval_res.get("results", [])

        if not raw_chunks:
            logger.info("No relevant chunks found in Qdrant vector store. Skipping LLM call.")
            return {
                "answer": NO_INFO_FALLBACK,
                "citations": []
            }

        # Step 2: Log similarity scores & filter by Similarity Threshold
        logger.info(f"Retrieved {len(raw_chunks)} raw candidate chunks.")
        for idx, c in enumerate(raw_chunks, 1):
            logger.info(f"Chunk #{idx} similarity score: {c.get('similarity_score', 0.0):.4f} (Doc: {c.get('document_name')}, Page: {c.get('page_number')})")

        filtered_chunks = [
            c for c in raw_chunks
            if c.get("similarity_score", 0.0) >= self.similarity_threshold
        ]

        discarded_by_threshold = len(raw_chunks) - len(filtered_chunks)
        if discarded_by_threshold > 0:
            logger.info(f"Discarded {discarded_by_threshold} chunk(s) falling below similarity threshold ({self.similarity_threshold}).")

        if not filtered_chunks:
            logger.info(f"No chunks satisfied the similarity threshold ({self.similarity_threshold}). Returning fallback.")
            return {
                "answer": NO_INFO_FALLBACK,
                "citations": []
            }

        # Step 3: Remove duplicate or near-identical chunks
        seen_texts = set()
        deduped_chunks = []
        for c in filtered_chunks:
            norm = self._normalize_text(c.get("text", ""))
            if norm not in seen_texts:
                seen_texts.add(norm)
                deduped_chunks.append(c)
            else:
                logger.info(f"Discarded duplicate chunk text from Doc: {c.get('document_name')}, Page: {c.get('page_number')}.")

        logger.info(f"Selected {len(deduped_chunks)} unique chunk(s) for context construction.")

        # Step 4: Context Optimization (character budget capping)
        context_blocks = []
        citations = []
        current_chars = 0

        for idx, chunk in enumerate(deduped_chunks, 1):
            doc_name = chunk.get("document_name", "document.pdf")
            page_num = chunk.get("page_number", 1)
            chunk_text = chunk.get("text", "").strip()

            block = f"[Chunk {idx} | Document: {doc_name} | Page: {page_num}]\n{chunk_text}"
            if current_chars + len(block) > self.max_context_chars and idx > 1:
                logger.info(f"Reached max context character limit ({self.max_context_chars} chars). Capping context at {idx - 1} chunks.")
                break

            context_blocks.append(block)
            current_chars += len(block)

            citations.append({
                "document_name": doc_name,
                "page_number": page_num,
                "retrieved_text": chunk_text
            })

        combined_context = "\n\n".join(context_blocks)

        logger.info("Generating prompt...")
        user_prompt = (
            f"Context:\n{combined_context}\n\n"
            f"Question:\n{cleaned_question}\n\n"
            "Answer:"
        )

        logger.info(f"=== EXACT GENERATED RAG USER PROMPT ===\n{user_prompt}\n=======================================")
        logger.info(f"Sending LLM request with context length: {len(combined_context)} chars.")

        # Step 5: Call LLM
        generated_answer = self.llm_service.generate_completion(
            user_prompt=user_prompt,
            system_prompt=SYSTEM_PROMPT
        )

        logger.info("LLM response received.")

        if NO_INFO_FALLBACK in generated_answer or not generated_answer.strip():
            logger.info("LLM indicated information not available in context.")
            return {
                "answer": NO_INFO_FALLBACK,
                "citations": []
            }

        return {
            "answer": generated_answer,
            "citations": citations
        }


# Convenience module function
def answer_question_with_rag(question: str) -> Dict[str, Any]:
    """
    Convenience function to run complete RAG pipeline.

    Usage:
        res = answer_question_with_rag("What is vector retrieval?")
        print(res["answer"])
        print("Citations:", res["citations"])
    """
    pipeline = RAGPipelineService()
    return pipeline.run_pipeline(question)


if __name__ == "__main__":
    test_q = "Explain retrieval augmented generation."
    output = answer_question_with_rag(test_q)
    print("RAG Pipeline Output:")
    print("Answer:", output["answer"])
    print("Citations Count:", len(output["citations"]))
