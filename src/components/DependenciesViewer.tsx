import React, { useState } from 'react';
import { dependenciesData } from '../data/ragArchitectureData';
import { Cpu, Search, Tag, ExternalLink } from 'lucide-react';

export const DependenciesViewer: React.FC = () => {
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const categories = ['All', 'API & Server', 'Data Processing & PDF', 'Vector DB & Embeddings', 'Frontend', 'Environment & Utilities'];

  const filteredDependencies = dependenciesData.filter((dep) => {
    const matchesCategory = filterCategory === 'All' || dep.category === filterCategory;
    const matchesSearch = dep.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          dep.purpose.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          dep.whyUsed.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-600" /> Required Technical Stack & Library Justifications
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Curated dependencies for high performance, vector similarity indexing, PDF page lineage, and free LLM execution.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search package..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg focus:outline-none focus:border-indigo-500 focus:bg-white w-full sm:w-48 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-2 mt-4">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                filterCategory === cat
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Dependency Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {filteredDependencies.map((dep) => (
            <div
              key={dep.name}
              className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm font-bold text-slate-900">{dep.name}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                    <Tag className="w-3 h-3 text-indigo-600" /> {dep.category}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mb-3">{dep.purpose}</p>

                <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200/80 text-xs text-slate-700 leading-relaxed">
                  <span className="text-indigo-700 font-bold block mb-1">Why this library?</span>
                  {dep.whyUsed}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>Production Requirement</span>
                <span className="flex items-center gap-1 text-slate-600 font-semibold">
                  requirements.txt <ExternalLink className="w-3 h-3 text-slate-400" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
