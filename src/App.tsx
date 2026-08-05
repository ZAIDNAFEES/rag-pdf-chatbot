import React, { useState } from 'react';
import { Header } from './components/Header';
import { FolderTreeViewer } from './components/FolderTreeViewer';
import { DependenciesViewer } from './components/DependenciesViewer';
import { WorkflowViewer } from './components/WorkflowViewer';
import { ArchitectureInterviewGuide } from './components/ArchitectureInterviewGuide';
import { ConsumerRAGApp } from './components/ConsumerRAGApp';
import { Sparkles, ArrowRight, ArrowLeft } from 'lucide-react';

export default function App() {
  const [viewMode, setViewMode] = useState<'consumer' | 'blueprint'>('consumer');
  const [activeTab, setActiveTab] = useState<string>('structure');

  if (viewMode === 'consumer') {
    return <ConsumerRAGApp onOpenArchitectureModal={() => setViewMode('blueprint')} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-600 selection:text-white flex flex-col justify-between">
      <div>
        <div className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between text-xs">
          <span className="font-mono text-slate-300">Phase 1 Architecture & Technical Blueprint View</span>
          <button
            onClick={() => setViewMode('consumer')}
            className="flex items-center space-x-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Consumer Interface</span>
          </button>
        </div>

        <Header activeTab={activeTab} setActiveTab={setActiveTab} />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Banner */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50/50 rounded-full blur-3xl -z-10 pointer-events-none"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                    Phase 1 Architecture Planning
                  </span>
                </div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Production-Ready RAG Application Blueprint & Architecture
                </h2>
                <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
                  This specification defines the complete modular folder structure, dependency matrix, page-aware PDF parsing workflow, Qdrant vector retrieval, and zero-hallucination guardrails for Python 3.11+.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => setActiveTab('architecture')}
                  className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-xs transition-all"
                >
                  <span>Senior AI Architect Guide</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Dynamic Tab Views */}
          {activeTab === 'structure' && <FolderTreeViewer />}
          {activeTab === 'dependencies' && <DependenciesViewer />}
          {activeTab === 'workflow' && <WorkflowViewer />}
          {activeTab === 'architecture' && <ArchitectureInterviewGuide />}
        </main>
      </div>

      <footer className="border-t border-slate-200 bg-white py-4 mt-8 text-center text-xs text-slate-500 font-medium">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>PROPRIETARY ARCHITECTURE SPECIFICATION v1.02</span>
          <span className="flex items-center gap-4 text-slate-600">
            <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-indigo-600 mr-1.5"></span> Clean Architecture</span>
            <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span> Zero-Hallucination Logic</span>
          </span>
        </div>
      </footer>
    </div>
  );
}

