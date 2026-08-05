import React, { useState } from 'react';
import { interviewHighlights } from '../data/ragArchitectureData';
import { ShieldCheck, HelpCircle, CheckCircle, Code, Server, Layers, Lightbulb, Lock } from 'lucide-react';

export const ArchitectureInterviewGuide: React.FC = () => {
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  const interviewQuestions = [
    {
      question: 'How do you structure this project for enterprise clean architecture?',
      answer: `We use a 5-tier layered architecture:
1. Presentation Layer (FastAPI routes & Streamlit UI)
2. Orchestration Layer (rag_orchestrator.py)
3. Domain Services Layer (pdf_parser, text_chunker, embedding_service, llm_service)
4. Infrastructure Layer (vector_db.py Qdrant wrapper)
5. Configuration & Core Layer (config.py, logging.py, exceptions.py)

Services are framework-agnostic Python functions that can be tested in isolation without booting web servers or mounting Streamlit.`
    },
    {
      question: 'How do you strictly prevent LLM hallucinations?',
      answer: `We enforce anti-hallucination at TWO independent layers:
1. Architectural Layer (Retrieval Guard): If Qdrant returns vector similarity scores below threshold (e.g. cosine score < 0.45), we short-circuit the execution flow immediately without making an LLM API call, returning "The information is not available in the provided documents."
2. Prompt Engineering Layer (Constraint Guard): The system prompt strictly bounds the LLM: "Answer the question ONLY using the provided text contexts. If the context does not contain the answer, respond EXACTLY with 'The information is not available in the provided documents.' Do NOT use external prior knowledge."`
    },
    {
      question: 'How do you preserve exact page number lineage for citations?',
      answer: `PyMuPDF (fitz) extracts text page-by-page. Before chunking, each page's text is tagged with document_name and 1-indexed page_number. During text chunking, each TextChunk DTO preserves document_name and page_number. These metadata fields are stored in Qdrant payloads alongside dense vectors. When retrieved, citations map directly back to the original page number.`
    },
    {
      question: 'Why use OpenRouter with Free Models instead of direct OpenAI/Anthropic APIs?',
      answer: `OpenRouter provides a unified OpenAI-compatible REST interface to access free open-weights models (such as google/gemini-2.0-flash-lite-001:free, meta-llama/llama-3.3-70b-instruct:free, or deepseek/deepseek-r1:free). This eliminates API billing barriers while demonstrating production-grade multi-model API integration.`
    }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <div className="pb-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" /> Modular Clean Architecture & Interview Strategy
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            How to articulate design decisions, trade-offs, and zero-hallucination guarantees during technical interviews.
          </p>
        </div>

        {/* 4 Architectural Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {interviewHighlights.map((item, idx) => (
            <div key={idx} className="bg-slate-50 border border-slate-200/90 rounded-xl p-5 hover:border-slate-300 transition-all">
              <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                {item.detail}
              </p>
            </div>
          ))}
        </div>

        {/* System Layer Diagram & Responsibility Matrix */}
        <div className="mt-8 bg-slate-50 border border-slate-200 rounded-xl p-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-600" /> Component Responsibility & Layer Matrix
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-200">
                  <th className="pb-2.5 px-3">Layer</th>
                  <th className="pb-2.5 px-3">Primary Objective</th>
                  <th className="pb-2.5 px-3">Error & Resilience Strategy</th>
                  <th className="pb-2.5 px-3">Scaling & Isolation</th>
                </tr>
              </thead>
              <tbody className="text-xs text-slate-700">
                <tr className="border-b border-slate-200/60 bg-white">
                  <td className="py-3 px-3 font-semibold text-slate-900 font-mono">1. Presentation (Streamlit UI)</td>
                  <td className="py-3 px-3">Multi-PDF upload, chat QA, citations render</td>
                  <td className="py-3 px-3 italic text-slate-500">Toast notification on REST error</td>
                  <td className="py-3 px-3 font-semibold text-indigo-700">Client-side UI</td>
                </tr>
                <tr className="border-b border-slate-200/60 bg-slate-50/50">
                  <td className="py-3 px-3 font-semibold text-slate-900 font-mono">2. API Gateway (FastAPI)</td>
                  <td className="py-3 px-3">Request validation, Pydantic DTO mapping</td>
                  <td className="py-3 px-3 italic text-slate-500">Global HTTPException handler</td>
                  <td className="py-3 px-3 font-semibold text-indigo-700">Stateless (High)</td>
                </tr>
                <tr className="border-b border-slate-200/60 bg-white">
                  <td className="py-3 px-3 font-semibold text-slate-900 font-mono">3. RAG Orchestrator</td>
                  <td className="py-3 px-3">Pipeline state & Similarity threshold gate</td>
                  <td className="py-3 px-3 italic text-slate-500">Zero LLM call on low similarity</td>
                  <td className="py-3 px-3 font-semibold text-indigo-700">Pure Async Controller</td>
                </tr>
                <tr className="border-b border-slate-200/60 bg-slate-50/50">
                  <td className="py-3 px-3 font-semibold text-slate-900 font-mono">4. PDF & Chunking Services</td>
                  <td className="py-3 px-3">PyMuPDF page-preserving parsing & split</td>
                  <td className="py-3 px-3 italic text-slate-500">PDFParsingError catch & log</td>
                  <td className="py-3 px-3 font-semibold text-indigo-700">CPU-bound worker</td>
                </tr>
                <tr className="bg-white">
                  <td className="py-3 px-3 font-semibold text-slate-900 font-mono">5. Vector DB & LLM Services</td>
                  <td className="py-3 px-3">Qdrant payload search & OpenRouter inference</td>
                  <td className="py-3 px-3 italic text-slate-500">Rate-limit exponential retry</td>
                  <td className="py-3 px-3 font-semibold text-indigo-700">I/O-bound external API</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Interview FAQ Accordion */}
        <div className="mt-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-indigo-600" /> Key Technical Questions & Answers for Interviewers
          </h3>
          <div className="space-y-3">
            {interviewQuestions.map((item, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-100 transition-colors"
                  >
                    <span className="text-xs font-bold text-slate-900">{item.question}</span>
                    <span className="text-indigo-600 font-bold text-sm">{isOpen ? '−' : '+'}</span>
                  </button>
                  {isOpen && (
                    <div className="p-4 pt-2 text-xs text-slate-700 whitespace-pre-line leading-relaxed border-t border-slate-200 bg-white">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
