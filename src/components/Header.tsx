import React from 'react';
import { Layers, ShieldCheck, Database, Cpu, FileText, Server } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'structure', label: '1. Directory & File Specs', icon: Layers },
    { id: 'dependencies', label: '2. Python Stack & Libraries', icon: Cpu },
    { id: 'workflow', label: '3. End-to-End RAG Pipeline', icon: FileText },
    { id: 'architecture', label: '4. Clean Architecture & Interview Guide', icon: ShieldCheck },
  ];

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                  RAG-System <span className="text-slate-400 font-normal">|</span> <span className="text-slate-600 font-medium">Phase 1 Architecture</span>
                </h1>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                FastAPI • Streamlit • Qdrant Vector DB • PyMuPDF • OpenRouter Free LLMs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-100">
              Senior AI Architect Blueprint
            </span>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-100 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-emerald-600" /> Python 3.11+ Validated
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 mt-5 overflow-x-auto pb-0.5 scrollbar-none border-t border-slate-100 pt-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
