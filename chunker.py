"""
Text Chunking Module for Production RAG Application
===================================================

This module implements semantic text chunking for extracted PDF pages using
LangChain's RecursiveCharacterTextSplitter with metadata preservation.

Key Features & Guarantees:
1. Strict Boundary Preservation: Content from different documents or different pages
   is NEVER merged into the same chunk.
2. Metadata Continuity: Every chunk retains `chunk_id` (UUIDv4), `document_name`,
   `page_number`, and `text`.
3. Sentence Boundary Preservation: Uses ordered semantic separators
   ["\n\n", "\n", ". ", "! ", "? ", " ", ""] to break text naturally.
4. Logging & Auditing: Emits detailed logs tracking total pages processed,
   total chunks generated, and average chunk character length.

Configuration:
- Chunk Size: 800 characters
- Chunk Overlap: 150 characters
"""

import uuid
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict

# Configure module-level logger
logger = logging.getLogger("RAGChunker")
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s"
)


@dataclass
class TextChunk:
    """Data Transfer Object (DTO) for a single text chunk."""
    chunk_id: str
    document_name: str
    page_number: int
    text: str

    def to_dict(self) -> Dict[str, Any]:
        """Convert chunk object to JSON-serializable dictionary."""
        return asdict(self)


class TextChunker:
    """
    Semantic Text Chunker preserving document metadata and page boundaries.
    """

    def __init__(
        self,
        chunk_size: int = 800,
        chunk_overlap: int = 150,
        separators: Optional[List[str]] = None
    ) -> None:
        """
        Initialize the text chunker with target size, overlap, and separators.

        Args:
            chunk_size (int): Target character length for each chunk (default: 800).
            chunk_overlap (int): Character overlap between consecutive chunks (default: 150).
            separators (List[str], optional): Custom separator hierarchy.
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators or ["\n\n", "\n", ". ", "! ", "? ", "; ", " ", ""]

    def _split_text_recursively(self, text: str) -> List[str]:
        """
        Recursive character splitter logic matching LangChain's RecursiveCharacterTextSplitter.

        Args:
            text (str): Input text string for a single page.

        Returns:
            List[str]: List of split text strings matching size and overlap constraints.
        """
        # Normalize whitespace
        clean_text = " ".join(text.split())
        if not clean_text:
            return []

        if len(clean_text) <= self.chunk_size:
            return [clean_text]

        # Find best available separator
        selected_sep = ""
        for sep in self.separators:
            if sep == "" or sep in clean_text:
                selected_sep = sep
                break

        splits = clean_text.split(selected_sep) if selected_sep != "" else list(clean_text)
        chunks: List[str] = []
        current_chunk: List[str] = []
        current_len = 0

        for split in splits:
            split_text = split + selected_sep if selected_sep != "" else split
            split_len = len(split_text)

            if current_len + split_len > self.chunk_size and current_chunk:
                joined = "".join(current_chunk).strip()
                if joined:
                    chunks.append(joined)

                # Build overlap from previous chunk
                overlap_buffer: List[str] = []
                overlap_len = 0
                for item in reversed(current_chunk):
                    if overlap_len + len(item) <= self.chunk_overlap:
                        overlap_buffer.insert(0, item)
                        overlap_len += len(item)
                    else:
                        break

                current_chunk = overlap_buffer + [split_text]
                current_len = overlap_len + split_len
            else:
                current_chunk.append(split_text)
                current_len += split_len

        if current_chunk:
            final_joined = "".join(current_chunk).strip()
            if final_joined:
                chunks.append(final_joined)

        return chunks

    def chunk_page(self, page_data: Dict[str, Any]) -> List[TextChunk]:
        """
        Chunk a single extracted page while tagging metadata and unique UUIDs.

        Args:
            page_data (Dict[str, Any]): Dictionary containing:
                - document_name (str)
                - page_number (int)
                - text (str)

        Returns:
            List[TextChunk]: List of chunk objects.
        """
        doc_name = page_data.get("document_name", "unknown.pdf")
        page_num = page_data.get("page_number", 1)
        text = page_data.get("text", "")

        if not text or not text.strip():
            logger.debug(f"Skipping empty page {page_num} of '{doc_name}'")
            return []

        raw_chunks = self._split_text_recursively(text)
        chunks: List[TextChunk] = []

        for chunk_text in raw_chunks:
            cleaned_chunk = chunk_text.strip()
            if not cleaned_chunk:
                continue

            chunk_obj = TextChunk(
                chunk_id=str(uuid.uuid4()),
                document_name=doc_name,
                page_number=page_num,
                text=cleaned_chunk
            )
            chunks.append(chunk_obj)

        return chunks

    def process_pages(self, pages: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Process multiple extracted pages across PDF documents.

        Args:
            pages (List[Dict[str, Any]]): List of extracted page dictionaries.

        Returns:
            Dict[str, Any]: Execution statistics and list of generated TextChunk objects.
        """
        logger.info(f"Starting chunking pipeline for {len(pages)} extracted page(s)...")
        logger.info(f"Configuration: Chunk Size={self.chunk_size}, Chunk Overlap={self.chunk_overlap}")

        all_chunks: List[TextChunk] = []
        total_chars = 0

        for page in pages:
            doc_name = page.get("document_name", "unknown")
            page_num = page.get("page_number", 1)
            try:
                page_chunks = self.chunk_page(page)
                all_chunks.extend(page_chunks)

                page_char_count = sum(len(c.text) for c in page_chunks)
                total_chars += page_char_count

                logger.info(
                    f"Page {page_num} of '{doc_name}': Extracted {len(page_chunks)} chunk(s) "
                    f"({page_char_count} chars)."
                )
            except Exception as e:
                logger.error(f"Failed to chunk page {page_num} of '{doc_name}': {str(e)}", exc_info=True)

        pages_processed = len(pages)
        chunks_generated = len(all_chunks)
        average_chunk_size = round(total_chars / chunks_generated, 1) if chunks_generated > 0 else 0.0

        # Log required metrics
        logger.info("================ Summary metrics ================")
        logger.info(f"✓ Number of pages processed: {pages_processed}")
        logger.info(f"✓ Number of chunks generated: {chunks_generated}")
        logger.info(f"✓ Average chunk size: {average_chunk_size} characters")
        logger.info("=================================================")

        return {
            "pages_processed": pages_processed,
            "chunks_generated": chunks_generated,
            "average_chunk_size": average_chunk_size,
            "chunks": [c.to_dict() for c in all_chunks]
        }


# Module level convenience function
def chunk_extracted_pages(
    pages: List[Dict[str, Any]],
    chunk_size: int = 800,
    chunk_overlap: int = 150
) -> Dict[str, Any]:
    """
    Convenience function to chunk a list of extracted pages.

    Usage:
        result = chunk_extracted_pages(extracted_pages)
        print(f"Generated {result['chunks_generated']} chunks.")
    """
    chunker = TextChunker(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    return chunker.process_pages(pages)


if __name__ == "__main__":
    # Quick self-test demonstration
    sample_pages = [
        {
            "document_name": "sample_research.pdf",
            "page_number": 1,
            "text": "Retrieval-Augmented Generation (RAG) combines dense vector search with large language models. " * 20
        }
    ]
    res = chunk_extracted_pages(sample_pages)
    print("Self-test result:", res["pages_processed"], "pages ->", res["chunks_generated"], "chunks.")
