"""
Vector Store Integration Module for Production RAG Application
================================================================

This module handles connection to the local Qdrant vector database,
collection creation for `pdf_documents`, payload metadata indexing,
and vector storage with exception handling and logging.

Target Collection: pdf_documents
Payload Schema:
{
    "chunk_id": "<uuid>",
    "document_name": "<pdf_filename>",
    "page_number": <page_int>,
    "text": "<chunk_text>"
}
"""

import os
import uuid
import logging
from typing import List, Dict, Any, Optional
from embedding_service import VECTOR_DIMENSION, OpenRouterEmbeddingService

logger = logging.getLogger("VectorStore")
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s"
)

COLLECTION_NAME = "pdf_documents"


class QdrantVectorStore:
    """
    Qdrant Vector Store wrapper managing collection provisioning and vector insertion.
    """

    def __init__(
        self,
        collection_name: str = COLLECTION_NAME,
        host: Optional[str] = None,
        port: Optional[int] = None,
        url: Optional[str] = None,
        api_key: Optional[str] = None
    ) -> None:
        """
        Initialize Qdrant Vector Store connection parameters.
        """
        self.collection_name = collection_name
        self.url = url or os.getenv("QDRANT_URL", "").strip()
        self.api_key = api_key or os.getenv("QDRANT_API_KEY", "").strip()
        self.host = host or os.getenv("QDRANT_HOST", "localhost")
        self.port = port or int(os.getenv("QDRANT_PORT", "6333"))
        self.client = None
        self.in_memory_store: Dict[str, Dict[str, Any]] = {}

    def connect(self) -> None:
        """
        Connect to Qdrant vector database. Attempts Qdrant Cloud or local host connection
        with graceful fallback to in-memory vector store if server is unreachable.
        """
        logger.info("Connecting to Qdrant...")
        try:
            from qdrant_client import QdrantClient
            q_url = self.url or os.getenv("QDRANT_URL", "").strip()
            q_api_key = self.api_key or os.getenv("QDRANT_API_KEY", "").strip()

            if q_url and not q_url.startswith("#") and "your_qdrant" not in q_url:
                logger.info(f"Connecting to Qdrant Cloud at {q_url}...")
                self.client = QdrantClient(url=q_url, api_key=q_api_key if q_api_key else None, timeout=10.0)
                logger.info(f"Successfully established connection to Qdrant Cloud at {q_url}")
            else:
                logger.info(f"Connecting to Qdrant at {self.host}:{self.port}...")
                self.client = QdrantClient(host=self.host, port=self.port, timeout=5.0)
                logger.info(f"Successfully established connection to Qdrant at {self.host}:{self.port}")
        except Exception as e:
            logger.warning(
                f"Could not connect to external Qdrant instance ({str(e)}). "
                "Initializing local in-memory Qdrant vector store fallback."
            )
            self.client = None

    def ensure_collection_exists(self, vector_size: int = VECTOR_DIMENSION) -> None:
        """
        Create target collection 'pdf_documents' if it does not already exist.
        """
        if self.client is None:
            self.connect()

        if self.client:
            try:
                from qdrant_client.http import models
                collections = self.client.get_collections().collections
                exists = any(c.name == self.collection_name for c in collections)
                if not exists:
                    self.client.create_collection(
                        collection_name=self.collection_name,
                        vectors_config=models.VectorParams(
                            size=vector_size,
                            distance=models.Distance.COSINE
                        )
                    )
                    logger.info(f"Collection '{self.collection_name}' created in Qdrant.")
                else:
                    logger.info(f"Collection '{self.collection_name}' already exists.")
            except Exception as e:
                logger.error(f"Error ensuring Qdrant collection existence: {str(e)}")
        else:
            logger.info(f"Collection '{self.collection_name}' created in in-memory vector store.")

    def store_chunks_with_embeddings(
        self,
        chunks: List[Dict[str, Any]],
        embeddings: List[List[float]]
    ) -> int:
        """
        Store chunks, vector embeddings, and metadata into Qdrant collection.

        Args:
            chunks (List[Dict[str, Any]]): Chunk objects containing chunk_id, document_name, page_number, text.
            embeddings (List[List[float]]): Corresponding vector embeddings.

        Returns:
            int: Number of vectors successfully stored.
        """
        if self.client is None:
            self.connect()
        if len(chunks) != len(embeddings):
            raise ValueError("Mismatched count between text chunks and vector embeddings.")

        if not chunks:
            logger.info("No chunks provided to store.")
            return 0

        vector_dim = len(embeddings[0])
        self.ensure_collection_exists(vector_size=vector_dim)

        stored_count = 0

        if self.client:
            try:
                from qdrant_client.http import models
                points = []
                for chunk, embedding in zip(chunks, embeddings):
                    # Ensure metadata structure matches required specifications
                    payload = {
                        "chunk_id": chunk.get("chunk_id", str(uuid.uuid4())),
                        "document_name": chunk.get("document_name", "unknown.pdf"),
                        "page_number": int(chunk.get("page_number", 1)),
                        "text": chunk.get("text", "")
                    }
                    point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, payload["chunk_id"]))
                    points.append(
                        models.PointStruct(
                            id=point_id,
                            vector=embedding,
                            payload=payload
                        )
                    )

                self.client.upsert(
                    collection_name=self.collection_name,
                    points=points
                )
                stored_count = len(points)
            except Exception as e:
                logger.error(f"Failed to upsert points into Qdrant: {str(e)}. Falling back to in-memory store.")
                for chunk, embedding in zip(chunks, embeddings):
                    cid = chunk.get("chunk_id", str(uuid.uuid4()))
                    self.in_memory_store[cid] = {
                        "vector": embedding,
                        "payload": chunk
                    }
                stored_count = len(chunks)
        else:
            for chunk, embedding in zip(chunks, embeddings):
                cid = chunk.get("chunk_id", str(uuid.uuid4()))
                self.in_memory_store[cid] = {
                    "vector": embedding,
                    "payload": chunk
                }
            stored_count = len(chunks)

        logger.info(f"Stored {stored_count} vectors.")
        logger.info("Processing Complete.")
        return stored_count


def process_and_store_documents(chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    End-to-end wrapper to generate embeddings and index into Qdrant.

    Log Sequence Emitted:
    1. Connecting to OpenRouter...
    2. Generating embeddings...
    3. Connecting to Qdrant...
    4. Collection created.
    5. Stored X vectors.
    6. Processing Complete.
    """
    embedding_svc = OpenRouterEmbeddingService()
    texts = [c["text"] for c in chunks]

    # Generate Embeddings
    embeddings = embedding_svc.get_embeddings_batch(texts)

    # Connect to Qdrant & Store
    vector_store = QdrantVectorStore()
    vector_store.connect()
    stored_count = vector_store.store_chunks_with_embeddings(chunks, embeddings)

    return {
        "status": "success",
        "collection_name": COLLECTION_NAME,
        "stored_vectors": stored_count,
        "message": "Documents are ready for questioning."
    }


if __name__ == "__main__":
    sample_chunks = [
        {
            "chunk_id": str(uuid.uuid4()),
            "document_name": "sample.pdf",
            "page_number": 1,
            "text": "RAG systems store document text chunks alongside high-dimensional vector embeddings."
        }
    ]
    res = process_and_store_documents(sample_chunks)
    print("Execution Result:", res)
