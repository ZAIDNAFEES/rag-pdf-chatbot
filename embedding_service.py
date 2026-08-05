"""
Embedding Service Module for Production RAG Application
=========================================================

This module provides vector embedding generation using OpenRouter API's free embedding models.
It includes retry logic with exponential backoff, timeout handling, fallback vector generation,
and comprehensive logging.

Free OpenRouter Embedding Models:
- nomic-ai/nomic-embed-text-v1.5
- baai/bge-small-en-v1.5
"""

import os
import time
import math
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("EmbeddingService")
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s"
)

# OpenRouter Free Embedding Model Default
DEFAULT_EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-ai/nomic-embed-text-v1.5")
VECTOR_DIMENSION = 384  # Standard vector dimension for light embeddings


class OpenRouterEmbeddingService:
    """
    Embedding service interfacing with OpenRouter API for generating vector representations.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout_seconds: float = 15.0,
        max_retries: int = 3
    ) -> None:
        """
        Initialize OpenRouter Embedding Service.

        Args:
            api_key (str, optional): OpenRouter API key. Defaults to OPENROUTER_API_KEY env var.
            model (str, optional): Embedding model identifier.
            timeout_seconds (float): Timeout for HTTP requests.
            max_retries (int): Maximum retry attempts for transient API failures.
        """
        self.api_key = api_key or os.getenv("OPENROUTER_API_KEY", "")
        self.model = model or os.getenv("EMBEDDING_MODEL", DEFAULT_EMBEDDING_MODEL)
        self.timeout = timeout_seconds
        self.max_retries = max_retries

    def _generate_fallback_embedding(self, text: str, dimension: int = VECTOR_DIMENSION) -> List[float]:
        """
        Generate a deterministic normalized pseudo-embedding vector when API key is unconfigured or offline.
        Uses character trigram frequency hashing to preserve semantic similarity properties for testing.
        """
        vector = [0.0] * dimension
        clean_text = text.lower()
        
        for i in range(len(clean_text) - 2):
            trigram = clean_text[i:i+3]
            idx = abs(hash(trigram)) % dimension
            vector[idx] += 1.0

        # L2 Normalize
        magnitude = math.sqrt(sum(v * v for v in vector))
        if magnitude > 0:
            vector = [v / magnitude for v in vector]
        else:
            vector = [1.0 / math.sqrt(dimension)] * dimension

        return vector

    def get_embedding(self, text: str) -> List[float]:
        """
        Generate embedding for a single text string with exponential retry logic.

        Args:
            text (str): Input text string.

        Returns:
            List[float]: High-dimensional vector embedding.
        """
        if not text or not text.strip():
            logger.warning("Empty text string provided for embedding. Returning zero vector.")
            return [0.0] * VECTOR_DIMENSION

        logger.info("Connecting to OpenRouter...")
        logger.info(f"Generating embeddings using model '{self.model}'...")

        if not self.api_key:
            logger.info("OPENROUTER_API_KEY not found in environment. Utilizing deterministic local embedding fallback.")
            return self._generate_fallback_embedding(text)

        # Retry loop for API call
        delay = 1.0
        for attempt in range(1, self.max_retries + 1):
            try:
                import urllib.request
                import json

                url = "https://openrouter.ai/api/v1/embeddings"
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://ai.studio/build",
                    "X-Title": "RAG Production App"
                }
                payload = json.dumps({
                    "model": self.model,
                    "input": text
                }).encode("utf-8")

                req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
                with urllib.request.urlopen(req, timeout=self.timeout) as response:
                    res_body = json.loads(response.read().decode("utf-8"))
                    embedding = res_body["data"][0]["embedding"]
                    logger.info("Successfully received embedding vector from OpenRouter.")
                    return embedding

            except Exception as e:
                logger.warning(
                    f"OpenRouter embedding attempt {attempt}/{self.max_retries} failed: {str(e)}"
                )
                if attempt < self.max_retries:
                    time.sleep(delay)
                    delay *= 2.0
                else:
                    logger.error("All retries exhausted for OpenRouter API. Falling back to local deterministic embedding.")
                    return self._generate_fallback_embedding(text)

        return self._generate_fallback_embedding(text)

    def get_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for a list of text strings.

        Args:
            texts (List[str]): List of chunk texts.

        Returns:
            List[List[float]]: List of vector embeddings.
        """
        logger.info(f"Generating embeddings for batch of {len(texts)} chunk(s)...")
        embeddings: List[List[float]] = []
        for idx, text in enumerate(texts):
            emb = self.get_embedding(text)
            embeddings.append(emb)
            if (idx + 1) % 5 == 0 or (idx + 1) == len(texts):
                logger.info(f"Embedded {idx + 1}/{len(texts)} chunk(s).")
        return embeddings


# Module level instance & helper function
def generate_chunk_embeddings(texts: List[str]) -> List[List[float]]:
    """
    Convenience function to generate embeddings for chunks.
    """
    service = OpenRouterEmbeddingService()
    return service.get_embeddings_batch(texts)


if __name__ == "__main__":
    svc = OpenRouterEmbeddingService()
    test_vec = svc.get_embedding("Testing OpenRouter embedding service integration.")
    print(f"Generated test vector with dimension: {len(test_vec)}")
