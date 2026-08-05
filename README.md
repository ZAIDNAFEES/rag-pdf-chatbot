# PDF Question Answering System (Production RAG)

A clean, production-ready Retrieval-Augmented Generation (RAG) application that enables users to upload PDF documents, extract text with page lineage retention, store vector embeddings, and ask natural language questions with zero-hallucination safeguards and expandable source citations.

---

## Overview

### What is Retrieval-Augmented Generation (RAG)?
Retrieval-Augmented Generation (RAG) is an AI architectural pattern that enhances Large Language Models (LLMs) by retrieving relevant factual information from external knowledge bases (such as vector databases) before synthesizing an answer. Instead of relying solely on parametric memory, RAG grounds answers directly in authoritative source documents, significantly improving answer accuracy and eliminating hallucinations.

### What Does This Application Do?
This application processes uploaded multi-page PDF files, extracts text page-by-page while preserving document name and page numbers, chunks text into overlapping segments, generates high-dimensional vector embeddings, and stores them in a Qdrant vector collection. When a user asks a question, the system retrieves the top semantically relevant chunks, enforces similarity thresholds and duplicate removal, and prompts an LLM to generate an answer backed by verifiable, expandable source citations.

---

## Features

- **Document Ingestion & Lineage Tracking**: Extract text from single or multi-page PDFs using PyMuPDF while strictly preserving `document_name` and `page_number` lineage.
- **Semantic Vector Storage**: High-performance embedding generation and vector similarity search powered by Qdrant vector database.
- **Similarity Threshold Filtering**: Automatic filtering of low-relevance vector matches to prevent off-topic or hallucinated answers.
- **Hallucination Prevention**: Returns a fallback response (`"The information is not available in the provided documents."`) if retrieved context is insufficient or fails the similarity threshold without calling the LLM.
- **Duplicate Removal & Context Capping**: Deduplicates near-identical chunks and caps overall character budgets to optimize token usage.
- **Verifiable Citations**: Each generated answer includes expandable citation cards detailing document name, page number, and exact retrieved text excerpts.
- **ChatGPT / ChatPDF Style UI**: Centered single-container user interface built with clean whitespace, soft shadows, rounded corners, responsive layout, loading indicators, and accessibility standards.

---

## Technology Stack

- **Python**: 3.11+
- **Backend API**: FastAPI / Uvicorn
- **Frontend App**: React 18 / TypeScript / Vite / Tailwind CSS (Optional Streamlit support)
- **Vector Database**: Qdrant Vector Engine
- **LLM & Embeddings Provider**: OpenRouter API
- **PDF Extraction**: PyMuPDF (`fitz`)
- **Framework & Orchestration**: LangChain / Custom Modular Pipelines

---

## Project Structure

```
.
├── src/                        # React Frontend Source Files
│   ├── components/             # UI Components (ConsumerRAGApp, Header, etc.)
│   ├── services/               # Frontend Services (ragService, vectorService, pdfParser)
│   ├── App.tsx                 # Main Application Layout Entry Point
│   └── main.tsx                # React DOM Mount Entry Point
├── pdf_parser.py               # PyMuPDF Page-by-Page PDF Parser Service
├── vector_service.py           # Qdrant Collection & OpenRouter Embedding Service
├── rag_service.py              # Core RAG Pipeline (Retrieval, Deduplication, Thresholds, Prompt Synthesis)
├── app.py                      # FastAPI Backend Server Entry Point
├── streamlit_app.py            # Streamlit Frontend Client App
├── requirements.txt            # Pinned Python Dependencies
├── package.json                # Frontend Node Dependencies
├── .env.example                # Template for Environment Configuration
├── .gitignore                  # Git Exclusion Patterns
└── README.md                   # Project Documentation
```

---

## Installation & Setup

### Prerequisites
- Python 3.11+ installed
- Node.js 18+ and npm installed
- Qdrant Instance (Local container or Qdrant Cloud cluster)
- OpenRouter API Key

### Step-by-Step Instructions

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-username/pdf-rag-assistant.git
   cd pdf-rag-assistant
   ```

2. **Create and Activate a Python Virtual Environment**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. **Install Python Dependencies**
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. **Install Node.js Frontend Dependencies**
   ```bash
   npm install
   ```

5. **Configure Environment Variables**
   Copy the `.env.example` file to `.env` and fill in your API keys and endpoint URLs:
   ```bash
   cp .env.example .env
   ```

6. **Run the Backend Server**
   ```bash
   uvicorn app:app --host 0.0.0.0 --port 8000 --reload
   ```

7. **Run the Application Frontend**
   ```bash
   npm run dev
   ```

---

## Environment Variables

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `OPENROUTER_API_KEY` | API key for OpenRouter embeddings and LLM inference. | `sk-or-v1-...` |
| `QDRANT_URL` | Base URL of your Qdrant vector database instance. | `http://localhost:6333` |
| `QDRANT_API_KEY` | Optional API key for authenticating with Qdrant Cloud. | `your_qdrant_api_key` |
| `QDRANT_HOST` | Hostname for Qdrant client connection. | `localhost` |
| `QDRANT_PORT` | Port number for Qdrant client connection. | `6333` |
| `EMBEDDING_MODEL` | Embedding model identifier used for vectorization. | `text-embedding-3-small` |
| `CHAT_MODEL` | LLM model identifier used for prompt synthesis. | `meta-llama/llama-3.1-8b-instruct:free` |
| `APP_URL` | Application URL for CORS and client redirection. | `http://localhost:3000` |

---

## Usage Guide

1. **Upload PDF Documents**: Click the upload box or drag-and-drop one or more multi-page PDF files.
2. **Process Documents**: Click the **Process Documents** button to extract text, chunk content, generate embeddings, and populate Qdrant.
3. **Ask a Question**: Enter a specific query into the text area (e.g., *"What is the main objective discussed in the document?"*).
4. **View Answer**: Read the generated answer, synthesized exclusively from retrieved document context.
5. **Inspect Citations**: Click **Show Retrieved Text** on expandable source cards to inspect exact page numbers and document passages.

---

## Screenshots

*(Placeholders - replace with actual screenshot image URLs or assets)*

| PDF Upload & Ingestion | Question Answering & Citations |
| :---: | :---: |
| `![PDF Upload Screenshot](https://placehold.co/600x350/f8fafc/0f172a?text=PDF+Upload+%26+Ingestion)` | `![Q&A Screenshot](https://placehold.co/600x350/f8fafc/0f172a?text=Answer+%26+Expandable+Citations)` |

---

## Future Improvements

- **Multi-User Collaboration & Authentication**: User login and private document collections.
- **OCR Integration**: Tesseract / AWS Textract integration for scanned non-searchable PDF images.
- **Persistent Conversation Memory**: Stateful chat threads with multi-turn dialogue follow-ups.
- **Hybrid Keyword & Vector Search**: Combining BM25 sparse keyword matching with dense vector search for higher precision.
- **Reranking Engine**: Integrating Cohere or BGE rerankers for improved top-k chunk ordering.

---

## License

This project is licensed under the **MIT License**.
