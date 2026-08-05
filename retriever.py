"""
Semantic Retrieval Module for Production RAG Application
==========================================================

This module implements vector similarity search using Qdrant vector database and
OpenRouter embeddings to retrieve top-k relevant document chunks for a query.

Requirements:
1. Generate query embedding using OpenRouter embedding service.
2. Query the Qdrant collection `pdf_documents`.
3. Retrieve top-k (default: 5) most relevant chunks.
4. Return metadata + similarity score for each result:
   - similarity_score (float)
   - document_name (str)
   - page_number (int)
   - text (str)

Logging Sequence:
- Generating query embedding...
- Searching Qdrant...
- Top 5 chunks retrieved.
- Retrieval completed.

Error Handling:
- Empty question validation
- No vectors / empty collection handling
- Connection failure handling
- Embedding generation failure handling
"""

import math
import logging
from typing import List, Dict, Any, Optional

from embedding_service import OpenRouterEmbeddingService
from vector_store import QdrantVectorStore, COLLECTION_NAME

logger = logging.getLogger("SemanticRetriever")
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s"
)


class SemanticRetriever:
    """
    Reusable Semantic Retriever interfacing with OpenRouter embeddings and Qdrant Vector Store.
    """

    def __init__(
        self,
        collection_name: str = COLLECTION_NAME,
        top_k: int = 5,
        vector_store: Optional[QdrantVectorStore] = None,
        embedding_service: Optional[OpenRouterEmbeddingService] = None
    ) -> None:
        """
        Initialize the retriever module.

        Args:
            collection_name (str): Target Qdrant collection name (default: pdf_documents).
            top_k (int): Number of top relevant chunks to retrieve (default: 5).
            vector_store (QdrantVectorStore, optional): Vector store instance.
            embedding_service (OpenRouterEmbeddingService, optional): Embedding service instance.
        """
        self.collection_name = collection_name
        self.top_k = top_k
        self.vector_store = vector_store or QdrantVectorStore(collection_name=collection_name)
        if not self.vector_store.client:
            self.vector_store.connect()
        self.embedding_service = embedding_service or OpenRouterEmbeddingService()

    @staticmethod
    def _cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
        """Calculate cosine similarity between two vector embeddings."""
        if not vec_a or not vec_b or len(vec_a) != len(vec_b):
            return 0.0
        dot = sum(a * b for a, b in zip(vec_a, vec_b))
        mag_a = math.sqrt(sum(a * a for a in vec_a))
        mag_b = math.sqrt(sum(b * b for b in vec_b))
        if mag_a == 0.0 or mag_b == 0.0:
            return 0.0
        return dot / (mag_a * mag_b)

    def retrieve(self, query: str, top_k: Optional[int] = None) -> Dict[str, Any]:
        """
        Retrieve top-k relevant chunks for a given user query.

        Args:
            query (str): Natural language user question.
            top_k (int, optional): Override top-k limit.

        Returns:
            Dict[str, Any]: Retrieval results containing:
                - status (str): "success" or "error"
                - query (str): User question
                - total_retrieved (int): Number of retrieved chunks
                - results (List[Dict]): Chunks with similarity score & metadata
        """
        k = top_k or self.top_k

        # 1. Input Validation
        if not query or not query.strip():
            logger.warning("Empty question provided to retriever.")
            return {
                "status": "error",
                "error_type": "EMPTY_QUESTION",
                "message": "Question cannot be empty.",
                "total_retrieved": 0,
                "results": []
            }

        cleaned_query = query.strip()
        logger.info("Initializing semantic retrieval pipeline...")

        # 2. Generate Query Embedding
        try:
            logger.info("Generating query embedding...")
            query_embedding = self.embedding_service.get_embedding(cleaned_query)
            if not query_embedding:
                raise ValueError("Embedding generation returned empty vector.")
        except Exception as e:
            logger.error(f"Embedding failure during retrieval: {str(e)}")
            return {
                "status": "error",
                "error_type": "EMBEDDING_FAILURE",
                "message": f"Failed to generate embedding for query: {str(e)}",
                "total_retrieved": 0,
                "results": []
            }

        # 3. Search Qdrant Collection
        try:
            logger.info("Searching Qdrant...")
            retrieved_chunks: List[Dict[str, Any]] = []

            if not self.vector_store.client:
                self.vector_store.connect()

            # Try Qdrant client connection if available
            if self.vector_store.client:
                try:
                    q_res = self.vector_store.client.search(
                        collection_name=self.collection_name,
                        query_vector=query_embedding,
                        limit=k
                    )
                    for point in q_res:
                        payload = point.payload or {}
                        retrieved_chunks.append({
                            "similarity_score": round(float(point.score), 4),
                            "document_name": payload.get("document_name", "unknown.pdf"),
                            "page_number": int(payload.get("page_number", 1)),
                            "text": payload.get("text", ""),
                            "chunk_id": payload.get("chunk_id", str(point.id))
                        })
                except Exception as search_err:
                    logger.warning(f"Qdrant client search error: {str(search_err)}. Falling back to in-memory store search.")
                    retrieved_chunks = []

            # Fallback in-memory similarity search over stored chunks
            if not retrieved_chunks:
                in_mem = self.vector_store.in_memory_store
                if not in_mem:
                    logger.warning("No vectors found in Qdrant store.")
                    return {
                        "status": "success",
                        "message": "No vectors found in database collection.",
                        "total_retrieved": 0,
                        "results": []
                    }

                scored = []
                for cid, data in in_mem.items():
                    vec = data["vector"]
                    payload = data["payload"]
                    sim = self._cosine_similarity(query_embedding, vec)
                    scored.append({
                        "similarity_score": round(sim, 4),
                        "document_name": payload.get("document_name", "unknown.pdf"),
                        "page_number": int(payload.get("page_number", 1)),
                        "text": payload.get("text", ""),
                        "chunk_id": payload.get("chunk_id", cid)
                    })

                scored.sort(key=lambda x: x["similarity_score"], reverse=True)
                retrieved_chunks = scored[:k]

            logger.info(f"Top {len(retrieved_chunks)} chunks retrieved.")
            logger.info("Retrieval completed.")

            return {
                "status": "success",
                "query": cleaned_query,
                "total_retrieved": len(retrieved_chunks),
                "results": retrieved_chunks
            }

        except Exception as conn_err:
            logger.error(f"Connection or search failure with Qdrant: {str(conn_err)}")
            return {
                "status": "error",
                "error_type": "CONNECTION_FAILURE",
                "message": f"Failed to search Qdrant vector store: {str(conn_err)}",
                "total_retrieved": 0,
                "results": []
            }


def retrieve_relevant_chunks(query: str, top_k: int = 5) -> Dict[str, Any]:
    """
    Convenience function to perform semantic retrieval on user question.

    Logging Output:
    - Generating query embedding...
    - Searching Qdrant...
    - Top 5 chunks retrieved.
    - Retrieval completed.
    """
    retriever = SemanticRetriever(top_k=top_k)
    return retriever.retrieve(query)


if __name__ == "__main__":
    test_result = retrieve_relevant_chunks("What is retrieval augmented generation?")
    print("Retriever Test Result:", test_result)
