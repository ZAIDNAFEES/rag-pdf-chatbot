import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, HelpCircle, FileCheck, Search, Sparkles, X, Loader2, BookOpen, Layers, Cpu, Database, ChevronDown, ChevronRight, Filter } from 'lucide-react';
import { defaultPdfParser, ProcessedDocumentResult, ExtractedPage, ParsingLog } from '../services/pdfParser';
import { defaultTextChunker, ChunkingSummary, TextChunk } from '../services/textChunker';
import { defaultEmbeddingService } from '../services/embeddingService';
import { defaultVectorStore, VectorStoreSummary } from '../services/vectorStore';
import { defaultRetrieverService, RetrievalResult, RetrievedChunk } from '../services/retrieverService';
import { defaultRAGService, RAGPipelineResult, CitationItem } from '../services/ragService';
import { RAGEngine, Citation } from '../services/ragEngine';

interface ConsumerRAGAppProps {
  onOpenArchitectureModal?: () => void;
}

export const ConsumerRAGApp: React.FC<ConsumerRAGAppProps> = ({ onOpenArchitectureModal }) => {
  // State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingResults, setProcessingResults] = useState<ProcessedDocumentResult[]>([]);
  const [allExtractedPages, setAllExtractedPages] = useState<ExtractedPage[]>([]);
  const [allChunks, setAllChunks] = useState<TextChunk[]>([]);
  const [chunkingSummary, setChunkingSummary] = useState<ChunkingSummary | null>(null);
  const [vectorSummary, setVectorSummary] = useState<VectorStoreSummary | null>(null);
  const [embeddingsGenerated, setEmbeddingsGenerated] = useState<boolean>(false);
  const [processedSuccess, setProcessedSuccess] = useState<boolean>(false);

  const [question, setQuestion] = useState<string>('');
  const [isAsking, setIsAsking] = useState<boolean>(false);
  const [retrievalResult, setRetrievalResult] = useState<RetrievalResult | null>(null);
  const [ragPipelineResult, setRagPipelineResult] = useState<RAGPipelineResult | null>(null);
  const [isRetrievedContextOpen, setIsRetrievedContextOpen] = useState<boolean>(true);
  const [expandedCitations, setExpandedCitations] = useState<Record<number, boolean>>({});
  const [retrievalError, setRetrievalError] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<{ answer: string; citations: Citation[]; found: boolean } | null>(null);

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File Selection Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files) as File[];
      const newFiles = filesArray.filter(
        (file: File) => file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf'
      );
      setSelectedFiles((prev) => {
        const existingNames = new Set(prev.map((f) => f.name));
        const combined = [...prev];
        for (const f of newFiles) {
          if (!existingNames.has(f.name)) {
            combined.push(f);
          }
        }
        return combined;
      });
      // Reset processing state when new files are added
      setProcessedSuccess(false);
      setProcessingResults([]);
      setChunkingSummary(null);
      setAllChunks([]);
      setAnswerResult(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files) as File[];
      const newFiles = filesArray.filter(
        (file: File) => file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf'
      );
      setSelectedFiles((prev) => {
        const existingNames = new Set(prev.map((f) => f.name));
        const combined = [...prev];
        for (const f of newFiles) {
          if (!existingNames.has(f.name)) {
            combined.push(f);
          }
        }
        return combined;
      });
      setProcessedSuccess(false);
      setProcessingResults([]);
      setChunkingSummary(null);
      setAllChunks([]);
      setAnswerResult(null);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setProcessedSuccess(false);
    setProcessingResults([]);
    setChunkingSummary(null);
    setAllChunks([]);
    setAnswerResult(null);
  };

  // Process Documents Handler
  const handleProcessDocuments = async () => {
    if (selectedFiles.length === 0) return;
    setIsProcessing(true);
    setAnswerResult(null);

    try {
      // Step 1: Ingest PDFs
      const results = await defaultPdfParser.parseMultipleFiles(selectedFiles);
      setProcessingResults(results);

      const aggregatedPages: ExtractedPage[] = [];
      results.forEach((res) => {
        if (res.status === 'success' || res.status === 'warning') {
          aggregatedPages.push(...res.extracted_pages);
        }
      });

      setAllExtractedPages(aggregatedPages);

      // Step 2: Split text into semantic chunks (chunk_size: 800, overlap: 150)
      const summary = defaultTextChunker.processPages(aggregatedPages);
      setChunkingSummary(summary);
      setAllChunks(summary.chunks);

      // Step 3: Generate embeddings via OpenRouter API
      const chunkTexts = summary.chunks.map((c) => c.text);
      const embeddingResult = await defaultEmbeddingService.generateBatchEmbeddings(chunkTexts);
      setEmbeddingsGenerated(true);

      // Step 4: Connect to Qdrant & Store Vectors in 'pdf_documents' collection
      const vSummary = await defaultVectorStore.storeVectors(summary.chunks, embeddingResult.embeddings);
      setVectorSummary(vSummary);

      setProcessedSuccess(true);
    } catch (err) {
      console.error('Processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Ask Question Handler
  const handleAskQuestion = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!question.trim()) {
      setRetrievalError('Question cannot be empty. Please enter a valid prompt.');
      return;
    }

    setIsAsking(true);
    setRetrievalError(null);
    setAnswerResult(null);
    setRagPipelineResult(null);

    try {
      // Execute complete RAG Pipeline (Retrieval + LLM Answer Synthesis)
      const ragRes = await defaultRAGService.executePipeline(question);
      setRagPipelineResult(ragRes);
      setRetrievalResult(ragRes.retrieval_result);

      if (ragRes.status === 'error' && ragRes.error_message) {
        setRetrievalError(ragRes.error_message);
      } else {
        // Fallback RAGEngine result for legacy UI compatibility
        const legacyRes = RAGEngine.query(question, allChunks.length > 0 ? allChunks : allExtractedPages);
        setAnswerResult(legacyRes);
      }
    } catch (err: any) {
      setRetrievalError(`RAG Pipeline error: ${err?.message || err}`);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col items-center justify-between p-4 sm:p-6 lg:p-8 font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Header Bar */}
      <header className="w-full max-w-2xl flex items-center justify-between py-3 mb-2">
        <div className="flex items-center space-x-2.5 text-slate-900 font-bold text-base tracking-tight">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <BookOpen className="w-4 h-4" />
          </div>
          <span>ChatPDF AI</span>
        </div>
        {onOpenArchitectureModal && (
          <button
            onClick={onOpenArchitectureModal}
            className="text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-2xs"
          >
            Phase 1 Spec
          </button>
        )}
      </header>

      {/* Main Centered Container */}
      <main className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/40 p-6 sm:p-10 space-y-8 my-auto">
        {/* Title Section */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            PDF Question Answering
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-normal">
            Upload one or more PDF files and ask questions.
          </p>
        </div>

        {/* 1. PDF Upload Section */}
        <section className="space-y-4" aria-label="PDF Upload Section">
          <div
            tabIndex={0}
            role="button"
            aria-label="Upload PDF files"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]'
                : 'border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-2xs">
              <Upload className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-slate-800">
              Upload one or more PDF files
            </p>
            <p className="text-xs text-slate-400 mt-1">Click to browse or drag and drop PDFs</p>
          </div>

          {/* 2. Uploaded Files List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2.5">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                Uploaded Files
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {selectedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-700"
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="font-medium text-slate-800 truncate">{file.name}</span>
                      <span className="text-[11px] text-slate-400 font-mono">({(file.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(idx);
                      }}
                      disabled={isProcessing}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Process Documents Button */}
          {selectedFiles.length > 0 && (
            <button
              id="process-documents-btn"
              type="button"
              onClick={handleProcessDocuments}
              disabled={isProcessing}
              className="w-full py-3.5 px-6 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Processing PDFs...</span>
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4 text-indigo-400" />
                  <span>Process Documents</span>
                </>
              )}
            </button>
          )}

          {/* Success Notification after Processing */}
          {processedSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-xs text-emerald-800 font-medium shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Documents processed successfully. You can now ask questions below.</span>
            </div>
          )}
        </section>

        <div className="border-t border-slate-100 my-4" />

        {/* 4. Question & Ask Question Section */}
        <form onSubmit={handleAskQuestion} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="question-input" className="block text-sm font-semibold text-slate-900">
              Ask a Question
            </label>
            <textarea
              id="question-input"
              rows={3}
              placeholder={
                processedSuccess
                  ? 'Type your question here...'
                  : 'Please upload and process PDF documents first...'
              }
              disabled={!processedSuccess || isAsking}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none shadow-2xs disabled:bg-slate-100/60 disabled:text-slate-400 disabled:cursor-not-allowed"
            />
          </div>

          <button
            id="ask-question-btn"
            type="submit"
            disabled={!question.trim() || isAsking || !processedSuccess}
            className="w-full py-3.5 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center space-x-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isAsking ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Generating answer...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Ask Question</span>
              </>
            )}
          </button>
        </form>

        {/* Error Notification */}
        {retrievalError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-xs text-rose-800 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-semibold block text-rose-900">Failure Notification</strong>
              <span>{retrievalError}</span>
            </div>
          </div>
        )}

        {/* 5. Output: Answer & Sources Section */}
        {ragPipelineResult && (
          <div className="space-y-6 pt-4 border-t border-slate-100">
            {/* Answer */}
            <div className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <Sparkles className="w-4 h-4 text-indigo-600" /> Answer
              </h2>
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 text-sm text-slate-800 leading-relaxed font-normal shadow-2xs whitespace-pre-wrap">
                {ragPipelineResult.answer}
              </div>
            </div>

            {/* Sources */}
            {ragPipelineResult.citations.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2">
                  Sources
                </h2>
                <div className="space-y-3">
                  {ragPipelineResult.citations.map((cite, idx) => {
                    const isExpanded = !!expandedCitations[idx];
                    return (
                      <div
                        key={idx}
                        className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-3 text-xs"
                      >
                        <div className="flex items-center justify-between text-indigo-700 font-semibold border-b border-slate-100 pb-2">
                          <span className="truncate flex items-center gap-1.5 text-slate-900">
                            <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span className="font-semibold text-slate-800">{cite.document_name}</span>
                          </span>
                          <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 shrink-0 font-mono text-[11px] font-semibold">
                            Page {cite.page_number}
                          </span>
                        </div>

                        <div>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCitations((prev) => ({
                                ...prev,
                                [idx]: !prev[idx],
                              }))
                            }
                            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50/70 hover:bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronDown className="w-3.5 h-3.5" /> Hide Retrieved Text
                              </>
                            ) : (
                              <>
                                <ChevronRight className="w-3.5 h-3.5" /> Show Retrieved Text
                              </>
                            )}
                          </button>

                          {isExpanded && (
                            <div className="mt-2.5 space-y-1">
                              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                                Retrieved Text:
                              </span>
                              <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono text-[11px] whitespace-pre-wrap">
                                "{cite.retrieved_text}"
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Collapsible Retrieved Context Debug Panel */}
            {retrievalResult && (
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs mt-4">
                <button
                  type="button"
                  onClick={() => setIsRetrievedContextOpen(!isRetrievedContextOpen)}
                  className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/80 transition-colors text-left border-b border-slate-200/80"
                >
                  <div className="flex items-center space-x-2">
                    <Filter className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Retrieved Context
                    </span>
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold border border-indigo-100">
                      {retrievalResult.chunks.length} Chunks
                    </span>
                  </div>
                  <div className="flex items-center space-x-1 text-slate-400 text-xs">
                    <span className="text-[11px]">Debug View</span>
                    {isRetrievedContextOpen ? (
                      <ChevronDown className="w-4 h-4 text-slate-600" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    )}
                  </div>
                </button>

                {isRetrievedContextOpen && (
                  <div className="p-4 space-y-3 bg-slate-50/50">
                    {retrievalResult.chunks.map((chunk, idx) => (
                      <div
                        key={chunk.chunk_id || idx}
                        className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 text-xs shadow-2xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-[10px] bg-slate-900 text-white font-bold px-1.5 py-0.5 rounded">
                              #{idx + 1}
                            </span>
                            <span className="font-semibold text-slate-800 truncate max-w-[180px]">
                              {chunk.document_name}
                            </span>
                            <span className="text-slate-400">•</span>
                            <span className="font-mono text-[11px] text-slate-600">Page {chunk.page_number}</span>
                          </div>
                          <span className="font-mono text-[11px] bg-amber-50 text-amber-800 font-semibold px-2 py-0.5 rounded-full border border-amber-200">
                            Score: {chunk.similarity_score.toFixed(4)}
                          </span>
                        </div>
                        <p className="text-slate-700 leading-relaxed font-mono text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-100 whitespace-pre-wrap">
                          {chunk.text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-400 py-4 font-normal">
        PDF Question Answering • Production RAG Architecture
      </footer>
    </div>
  );
};
