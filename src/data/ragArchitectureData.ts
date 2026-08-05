import { FileNode, Dependency, PipelineStep } from '../types';

export const folderTreeData: FileNode = {
  name: 'production_rag_app',
  path: '/',
  type: 'folder',
  description: 'Root project directory containing backend API, frontend Streamlit UI, core processing modules, and configuration.',
  keyResponsibilities: ['Root repository container', 'Houses environment configuration and dependency manifests', 'Maintains isolation between frontend, backend API, and core logic services'],
  children: [
    {
      name: '.env.example',
      path: '/.env.example',
      type: 'file',
      description: 'Template environment file defining required configuration variables without committing secrets.',
      keyResponsibilities: [
        'Documents required API keys (OPENROUTER_API_KEY) and Qdrant credentials (QDRANT_HOST, QDRANT_PORT, QDRANT_API_KEY)',
        'Specifies default configuration parameters like EMBEDDING_MODEL_NAME, CHUNK_SIZE, CHUNK_OVERLAP',
        'Prevents accidental leak of API keys by serving as a non-sensitive template'
      ]
    },
    {
      name: '.gitignore',
      path: '/.gitignore',
      type: 'file',
      description: 'Git ignore rules for Python artifacts, virtual environments, local databases, logs, and sensitive .env files.',
      keyResponsibilities: [
        'Excludes __pycache__, .venv, .env, and local storage caches',
        'Prevents checked-in data files or log dumps from polluting git history'
      ]
    },
    {
      name: 'README.md',
      path: '/README.md',
      type: 'file',
      description: 'Comprehensive documentation explaining architecture, setup instructions, execution commands, and design trade-offs.',
      keyResponsibilities: [
        'Serves as the main documentation entry point for interviewers and reviewers',
        'Explains step-by-step local setup, Docker launch commands, and environment variable requirements',
        'Includes architecture diagram and API endpoints documentation'
      ]
    },
    {
      name: 'requirements.txt',
      path: '/requirements.txt',
      type: 'file',
      description: 'Pinned Python package dependencies for reproducible builds across environments.',
      keyResponsibilities: [
        'Lists exact versions of FastAPI, uvicorn, streamlit, qdrant-client, PyMuPDF (fitz), sentence-transformers, and httpx',
        'Ensures predictable environment setup across local dev, CI/CD, and containers'
      ]
    },
    {
      name: 'app',
      path: '/app',
      type: 'folder',
      description: 'Main application source code containing core business logic, API server, frontend UI, and infrastructure layers.',
      keyResponsibilities: ['Encapsulates all Python source code', 'Enforces strict separation of concerns'],
      children: [
        {
          name: '__init__.py',
          path: '/app/__init__.py',
          type: 'file',
          description: 'Marks the app folder as a Python package.',
          keyResponsibilities: ['Package initialization and metadata exposure']
        },
        {
          name: 'core',
          path: '/app/core',
          type: 'folder',
          description: 'Global application configuration, custom exceptions, logging setup, and cross-cutting utilities.',
          keyResponsibilities: [
            'Centralized app settings using Pydantic BaseSettings',
            'Structured logging configuration',
            'Custom exception hierarchy'
          ],
          children: [
            {
              name: '__init__.py',
              path: '/app/core/__init__.py',
              type: 'file',
              description: 'Exposes core package symbols.',
              keyResponsibilities: ['Exports settings, logger, and custom exceptions']
            },
            {
              name: 'config.py',
              path: '/app/core/config.py',
              type: 'file',
              description: 'Type-safe configuration loader using Pydantic Settings.',
              keyResponsibilities: [
                'Reads and validates environment variables from .env file',
                'Exposes typed config object (OpenRouter endpoint, free model IDs, chunk size, overlap ratio, Qdrant host/port)',
                'Raises validation errors on missing required keys at application boot'
              ]
            },
            {
              name: 'logging.py',
              path: '/app/core/logging.py',
              type: 'file',
              description: 'Centralized logger configuration establishing structured logging across FastAPI and service components.',
              keyResponsibilities: [
                'Configures console and file log formatters with ISO timestamps and log levels',
                'Exposes standardized get_logger() instance for uniform auditability across modules'
              ]
            },
            {
              name: 'exceptions.py',
              path: '/app/core/exceptions.py',
              type: 'file',
              description: 'Custom domain exceptions for granular error handling.',
              keyResponsibilities: [
                'Defines custom exception types (PDFParsingError, EmbeddingGenerationError, VectorStoreError, OpenRouterAPIError, AnswerNotAvailableError)',
                'Enables clean mapping from service exceptions to standardized HTTP status codes'
              ]
            }
          ]
        },
        {
          name: 'services',
          path: '/app/services',
          type: 'folder',
          description: 'Core domain services implementing isolated business capabilities (PDF extraction, text chunking, embedding generation, vector DB storage, and LLM inference).',
          keyResponsibilities: ['Pure business logic implementations', 'Independent of HTTP framework or Streamlit UI'],
          children: [
            {
              name: '__init__.py',
              path: '/app/services/__init__.py',
              type: 'file',
              description: 'Service module exports.',
              keyResponsibilities: ['Exposes high-level domain services']
            },
            {
              name: 'pdf_parser.py',
              path: '/app/services/pdf_parser.py',
              type: 'file',
              description: 'PyMuPDF-powered PDF text extraction engine preserving precise page lineage.',
              keyResponsibilities: [
                'Parses uploaded PDF bytes or files without corrupting document structure',
                'Extracts clean text block-by-block while tagging each snippet with document_name and 1-indexed page_number',
                'Handles multi-document batch parsing safely with memory-efficient streaming'
              ]
            },
            {
              name: 'text_chunker.py',
              path: '/app/services/text_chunker.py',
              type: 'file',
              description: 'Context-aware text splitter generating overlapping chunks with explicit metadata tracking.',
              keyResponsibilities: [
                'Splits extracted page text using recursive token-aware/character splitting',
                'Maintains overlap (e.g., 500 chars chunk / 50 chars overlap) to avoid boundary information loss',
                'Attaches metadata to every chunk: chunk_id, doc_id, filename, page_number, start_char, end_char'
              ]
            },
            {
              name: 'embedding_service.py',
              path: '/app/services/embedding_service.py',
              type: 'file',
              description: 'Embedding generation wrapper using SentenceTransformers (e.g. all-MiniLM-L6-v2) or HuggingFace models.',
              keyResponsibilities: [
                'Generates dense vector embeddings for text chunks during ingestion',
                'Generates query vector for incoming user queries using the exact same model space',
                'Normalizes vectors for accurate cosine similarity matching'
              ]
            },
            {
              name: 'vector_db.py',
              path: '/app/services/vector_db.py',
              type: 'file',
              description: 'Qdrant database wrapper managing vector indexing, collection lifecycle, and semantic similarity retrieval.',
              keyResponsibilities: [
                'Initializes Qdrant collections with specified vector dimension and cosine metric',
                'Stores vector points alongside payload metadata (filename, page_number, text content)',
                'Executes top-k similarity search queries with payload filtering'
              ]
            },
            {
              name: 'llm_service.py',
              path: '/app/services/llm_service.py',
              type: 'file',
              description: 'OpenRouter API client dedicated to executing prompt pipelines using free open-access models.',
              keyResponsibilities: [
                'Sends context-augmented prompts to OpenRouter using free models (e.g., google/gemini-2.0-flash-lite-001:free, meta-llama/llama-3.3-70b-instruct:free, deepseek/deepseek-r1:free)',
                'Enforces strict anti-hallucination system prompt directives',
                'Handles rate limits, retries, and fallback formatting'
              ]
            },
            {
              name: 'rag_orchestrator.py',
              path: '/app/services/rag_orchestrator.py',
              type: 'file',
              description: 'High-level workflow coordinator connecting ingestion pipelines and generation pipelines.',
              keyResponsibilities: [
                'Coordinates PDF parsing -> Chunking -> Embedding -> Qdrant upload during ingestion',
                'Coordinates Query embedding -> Qdrant similarity search -> Prompt assembly -> OpenRouter call -> Citation formatting during retrieval',
                'Enforces the non-hallucination fallback policy when context search similarity score falls below threshold'
              ]
            }
          ]
        },
        {
          name: 'schemas',
          path: '/app/schemas',
          type: 'folder',
          description: 'Pydantic data transfer objects (DTOs) defining request/response schemas for APIs and internal contracts.',
          keyResponsibilities: ['Enforces data validation at system boundaries', 'Provides automated OpenAPI documentation schema'],
          children: [
            {
              name: '__init__.py',
              path: '/app/schemas/__init__.py',
              type: 'file',
              description: 'Schema module package initializer.',
              keyResponsibilities: ['Exports Pydantic request and response models']
            },
            {
              name: 'document.py',
              path: '/app/schemas/document.py',
              type: 'file',
              description: 'Models for document metadata, ingestion response, and text chunk payloads.',
              keyResponsibilities: [
                'Defines DocumentMetadata, TextChunk, and UploadResponse models',
                'Validates page numbers and chunk boundary parameters'
              ]
            },
            {
              name: 'rag.py',
              path: '/app/schemas/rag.py',
              type: 'file',
              description: 'Models for query request, context retrieval, citation item, and final RAG response.',
              keyResponsibilities: [
                'Defines QueryRequest, Citation (doc_name, page_number, retrieved_text), and QueryResponse schemas'
              ]
            }
          ]
        },
        {
          name: 'api',
          path: '/app/api',
          type: 'folder',
          description: 'FastAPI HTTP presentation layer exposing endpoints for document ingestion and QA querying.',
          keyResponsibilities: ['Handles HTTP routing, request parsing, header validation, and error responses'],
          children: [
            {
              name: '__init__.py',
              path: '/app/api/__init__.py',
              type: 'file',
              description: 'API module export.',
              keyResponsibilities: ['Exports main FastAPI APIRouter instance']
            },
            {
              name: 'routes.py',
              path: '/app/api/routes.py',
              type: 'file',
              description: 'Endpoint definition for POST /upload (PDF ingestion) and POST /query (RAG QA retrieval).',
              keyResponsibilities: [
                'POST /api/v1/documents/upload: Accepts multipart/form-data PDF files and triggers ingestion orchestrator',
                'POST /api/v1/rag/query: Accepts QueryRequest and returns generated answer with structured citations',
                'GET /api/v1/health: Provides operational health status check for vector DB and LLM connection'
              ]
            }
          ]
        },
        {
          name: 'frontend',
          path: '/app/frontend',
          type: 'folder',
          description: 'Streamlit user interface application providing intuitive document upload, chat query, and citation rendering.',
          keyResponsibilities: ['Renders interactive UI for end users', 'Communicates with FastAPI backend over HTTP'],
          children: [
            {
              name: 'streamlit_app.py',
              path: '/app/frontend/streamlit_app.py',
              type: 'file',
              description: 'Main Streamlit frontend interface entry point.',
              keyResponsibilities: [
                'Multi-file PDF upload sidebar widget with instant upload status feedback',
                'Interactive chat interface for asking technical questions',
                'Expandable citation visualizer displaying source document name, page number, and exact context snippet',
                'Displays explicit "Information not available" badge when documents lack requested answer'
              ]
            }
          ]
        },
        {
          name: 'main.py',
          path: '/app/main.py',
          type: 'file',
          description: 'FastAPI application factory and server launch file.',
          keyResponsibilities: [
            'Instantiates FastAPI app with metadata, CORS middleware, and custom exception handlers',
            'Registers API router modules under /api/v1 prefix',
            'Includes Uvicorn runner boilerplate for seamless CLI start (uvicorn app.main:app --reload)'
          ]
        }
      ]
    }
  ]
};

export const dependenciesData: Dependency[] = [
  {
    name: 'fastapi',
    category: 'API & Server',
    purpose: 'High-performance asynchronous REST API framework.',
    whyUsed: 'Provides fast, asynchronous request handling, automatic OpenAPI/Swagger documentation, and Pydantic integration for strict request/response validation.'
  },
  {
    name: 'uvicorn',
    category: 'API & Server',
    purpose: 'ASGI web server for running FastAPI.',
    whyUsed: 'Lightning-fast ASGI server implementation based on uvloop and httptools, essential for running production FastAPI servers.'
  },
  {
    name: 'streamlit',
    category: 'Frontend',
    purpose: 'Rapid web UI framework for Python data apps.',
    whyUsed: 'Allows building a clean, interactive frontend (file uploaders, chat interfaces, citation expanders) purely in Python without complex JS frameworks.'
  },
  {
    name: 'PyMuPDF (fitz)',
    category: 'Data Processing & PDF',
    purpose: 'High-speed, accurate PDF text and metadata extraction library.',
    whyUsed: 'Significantly faster and more reliable than PyPDF2 or pdfplumber. Preserves exact page-by-page mapping and structural layout required for precise page citation.'
  },
  {
    name: 'qdrant-client',
    category: 'Vector DB & Embeddings',
    purpose: 'Official Python SDK for Qdrant Vector Database.',
    whyUsed: 'Connects to local/cloud Qdrant instance. Supports payload filtering, fast HNSW vector index search, and rich metadata payload storage alongside vectors.'
  },
  {
    name: 'sentence-transformers',
    category: 'Vector DB & Embeddings',
    purpose: 'Open-source state-of-the-art text embedding models.',
    whyUsed: 'Generates high-quality dense vector representations locally (e.g. all-MiniLM-L6-v2) with zero API cost, high speed, and deterministic dimension outputs (384-d).'
  },
  {
    name: 'httpx',
    category: 'API & Server',
    purpose: 'Fully featured HTTP client for Python with async support.',
    whyUsed: 'Used for making reliable asynchronous HTTP requests to OpenRouter API endpoints with connection pooling and custom timeout configurations.'
  },
  {
    name: 'pydantic & pydantic-settings',
    category: 'Environment & Utilities',
    purpose: 'Data validation and environment configuration management.',
    whyUsed: 'Enforces type hints at runtime, loads and validates .env file variables, and guarantees clean error messages on missing secrets or invalid parameters.'
  },
  {
    name: 'python-dotenv',
    category: 'Environment & Utilities',
    purpose: 'Loads environment variables from .env files.',
    whyUsed: 'Decouples sensitive configurations (API keys, ports) from codebase, adhering to 12-Factor App methodology.'
  }
];

export const pipelineStepsData: PipelineStep[] = [
  {
    stepNumber: 1,
    title: 'PDF Upload & Validation',
    component: 'Streamlit UI -> FastAPI (POST /api/v1/documents/upload)',
    description: 'User uploads one or more PDF documents through the Streamlit interface. The files are validated for MIME type and streamed to FastAPI backend.',
    inputs: ['Raw PDF file bytes', 'Filename metadata'],
    outputs: ['Validated file streams', 'Upload batch identifier'],
    keyConsiderations: ['File size validation', 'Memory-efficient chunked file reading', 'Handling corrupt PDF files gracefully']
  },
  {
    stepNumber: 2,
    title: 'Page-Aware Text Extraction',
    component: 'PDF Parser Service (PyMuPDF / fitz)',
    description: 'PyMuPDF iterates page-by-page through each uploaded PDF, extracting text while preserving 1-indexed page numbers and document title attributes.',
    inputs: ['PDF file stream'],
    outputs: ['List of raw page objects containing {document_name, page_number, raw_text}'],
    keyConsiderations: ['Preserving page boundaries', 'Cleaning extraction noise (headers/footers)', 'Handling multi-column text layouts']
  },
  {
    stepNumber: 3,
    title: 'Context-Aware Text Chunking',
    component: 'Text Chunker Service',
    description: 'Extracted text is split into overlapping chunks (e.g., 500 characters with 50 character overlap). Each chunk retains its page number lineage and document ID.',
    inputs: ['Page objects with metadata'],
    outputs: ['List of TextChunk DTOs: {chunk_id, doc_name, page_number, text_content}'],
    keyConsiderations: ['Preventing split context across sentences', 'Maintaining metadata continuity across chunk boundaries']
  },
  {
    stepNumber: 4,
    title: 'Embedding Generation & Indexing',
    component: 'Embedding Service -> Qdrant Vector DB',
    description: 'SentenceTransformers converts text chunks into 384-dimensional dense vectors. Chunks and vectors are upside upserted into Qdrant collection payload.',
    inputs: ['TextChunk objects'],
    outputs: ['Qdrant point records with IDs, dense vectors, and payload JSON'],
    keyConsiderations: ['Batch vector upserts for speed', 'Cosine metric collection creation', 'Payload indexing on filename and page_number']
  },
  {
    stepNumber: 5,
    title: 'Query Processing & Vector Retrieval',
    component: 'FastAPI (POST /api/v1/rag/query) -> Qdrant Vector DB',
    description: 'User query is embedded into vector space using the exact same sentence transformer model. Qdrant performs top-K cosine similarity search.',
    inputs: ['User query string', 'Top-K parameter (e.g. k=4)', 'Similarity threshold (e.g., 0.45)'],
    outputs: ['Top-K matched context chunks with similarity scores & metadata'],
    keyConsiderations: ['Vector space consistency', 'Relevance threshold evaluation to catch out-of-domain questions']
  },
  {
    stepNumber: 6,
    title: 'Strict Anti-Hallucination Guard',
    component: 'RAG Orchestrator',
    description: 'If top retrieved chunks have similarity scores below the similarity threshold or no chunks return, orchestrator immediately short-circuits execution.',
    inputs: ['Retrieved chunk list & similarity metrics'],
    outputs: ['Decision: Proceed to LLM OR Return fallback answer immediately'],
    keyConsiderations: ['Zero LLM API call if no relevant context exists', 'Prevents hallucination at the architectural boundary']
  },
  {
    stepNumber: 7,
    title: 'Context-Augmented Prompting & OpenRouter Inference',
    component: 'LLM Service -> OpenRouter API (Free Models)',
    description: 'Retrieved context chunks are formatted into a strict system prompt instructing OpenRouter (e.g. Gemini 2.0 Flash Lite free / Llama 3.3 70B free) to answer ONLY using provided context.',
    inputs: ['System prompt with retrieved contexts', 'User question'],
    outputs: ['Generated LLM response string'],
    keyConsiderations: ['Strict system prompt formatting', 'Using verified FREE model aliases', 'Handling API timeout and rate-limit fallbacks']
  },
  {
    stepNumber: 8,
    title: 'Citation Formatting & Streamlit Display',
    component: 'RAG Orchestrator -> Streamlit UI',
    description: 'The response is packaged into a QueryResponse object containing the answer text and structured citations (doc_name, page_number, retrieved_text snippet).',
    inputs: ['Generated answer', 'Context metadata'],
    outputs: ['Rendered UI message with expandable source citation cards'],
    keyConsiderations: ['Transparent citation display', 'Standardized fallback message: "The information is not available in the provided documents."']
  }
];

export const interviewHighlights = [
  {
    title: 'Strict Separation of Concerns',
    detail: 'FastAPI serves as the API gateway layer, Streamlit acts strictly as an HTTP client, and services/ handles pure business domain logic without framework dependencies.'
  },
  {
    title: 'Zero-Hallucination Architectural Guardrails',
    detail: 'Combines dual guardrails: a similarity threshold check before LLM invocation AND a strict context-only prompt system rule with explicit fallback instructions.'
  },
  {
    title: 'Metadata Lineage Preservation',
    detail: 'Page numbers and document names are attached at the parsing stage and propagated unchanged through chunking, vector payload storage, and final citation UI output.'
  },
  {
    title: 'Cost-Effective Production Engineering',
    detail: 'Leverages local open-source embeddings (SentenceTransformers) and free OpenRouter LLM endpoints, keeping infrastructure operational cost to $0 while maintaining enterprise design standards.'
  }
];
