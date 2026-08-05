import React, { useState } from 'react';
import { FileNode } from '../types';
import { folderTreeData } from '../data/ragArchitectureData';
import { Folder, FolderOpen, FileText, ChevronRight, ChevronDown, CheckCircle2, Copy, Check } from 'lucide-react';

export const FolderTreeViewer: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<FileNode>(folderTreeData.children![4]); // Default select app/
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    new Set(['/', '/app', '/app/core', '/app/services', '/app/schemas', '/app/api', '/app/frontend'])
  );
  const [copied, setCopied] = useState(false);

  const toggleExpand = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const generateASCIIFolderTree = (node: FileNode, indent = ''): string => {
    let result = `${indent}${node.name}${node.type === 'folder' ? '/' : ''}\n`;
    if (node.children) {
      node.children.forEach((child, index) => {
        const isLast = index === node.children!.length - 1;
        const prefix = isLast ? '└── ' : '├── ';
        const childIndent = indent + (isLast ? '    ' : '│   ');
        if (child.type === 'folder') {
          result += `${indent}${prefix}${child.name}/\n`;
          if (child.children) {
            child.children.forEach((gchild, gidx) => {
              const gIsLast = gidx === child.children!.length - 1;
              const gPrefix = gIsLast ? '└── ' : '├── ';
              result += `${childIndent}${gPrefix}${gchild.name}${gchild.type === 'folder' ? '/' : ''}\n`;
              if (gchild.children) {
                gchild.children.forEach((ggchild, ggidx) => {
                  const ggIsLast = ggidx === gchild.children!.length - 1;
                  const ggPrefix = ggIsLast ? '└── ' : '├── ';
                  result += `${childIndent}${gIsLast ? '    ' : '│   '}${ggPrefix}${ggchild.name}\n`;
                });
              }
            });
          }
        } else {
          result += `${indent}${prefix}${child.name}\n`;
        }
      });
    }
    return result;
  };

  const handleCopyTree = () => {
    const text = generateASCIIFolderTree(folderTreeData);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderTree = (node: FileNode) => {
    const isExpanded = expandedPaths.has(node.path);
    const isSelected = selectedNode.path === node.path;
    const isFolder = node.type === 'folder';

    return (
      <div key={node.path} className="select-none">
        <div
          id={`node-${node.name.replace(/[^a-zA-Z0-9]/g, '-')}`}
          onClick={() => setSelectedNode(node)}
          className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${
            isSelected
              ? 'bg-indigo-600/20 text-indigo-300 font-medium border border-indigo-500/30'
              : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
          }`}
        >
          {isFolder ? (
            <button
              onClick={(e) => toggleExpand(node.path, e)}
              className="p-0.5 hover:bg-slate-700/50 rounded text-slate-400"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <span className="w-4 h-4" />
          )}

          {isFolder ? (
            isExpanded ? (
              <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-amber-400 shrink-0" />
            )
          ) : (
            <FileText className="w-4 h-4 text-sky-400 shrink-0" />
          )}

          <span className="truncate">{node.name}</span>
        </div>

        {isFolder && isExpanded && node.children && (
          <div className="ml-4 pl-2 border-l border-slate-800 space-y-0.5 mt-0.5">
            {node.children.map((child) => renderTree(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Project Directory & File Structure</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Modular, clean architecture separating API routes, frontend UI, core services, and configuration.
            </p>
          </div>
          <button
            id="copy-tree-btn"
            onClick={handleCopyTree}
            className="flex items-center space-x-2 px-3.5 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors self-start sm:self-auto"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            <span>{copied ? 'Copied ASCII Tree!' : 'Copy ASCII Tree'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          {/* File Tree Left Pane (Slate 900 Dark Explorer Sidebar) */}
          <div className="lg:col-span-5 bg-slate-900 text-slate-300 rounded-xl p-4 border border-slate-800 max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 shadow-inner">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 px-2 border-b border-slate-800 pb-2">
              Project Blueprint Explorer
            </div>
            {renderTree(folderTreeData)}
          </div>

          {/* Details Right Pane */}
          <div className="lg:col-span-7 bg-slate-50 border border-slate-200/80 rounded-xl p-6 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-4 mb-4">
                <div className="flex items-center space-x-3">
                  {selectedNode.type === 'folder' ? (
                    <div className="p-2 bg-amber-50 rounded-lg border border-amber-200">
                      <Folder className="w-5 h-5 text-amber-600" />
                    </div>
                  ) : (
                    <div className="p-2 bg-sky-50 rounded-lg border border-sky-200">
                      <FileText className="w-5 h-5 text-sky-600" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-base font-mono font-bold text-slate-900">{selectedNode.path}</h3>
                    <span className="inline-block px-2 py-0.5 text-[11px] font-semibold rounded bg-white text-slate-600 border border-slate-200 mt-1">
                      Type: {selectedNode.type.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Primary Responsibility
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
                    {selectedNode.description}
                  </p>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Key Architectural Duties & Functions
                  </h4>
                  <ul className="space-y-2">
                    {selectedNode.keyResponsibilities.map((resp, idx) => (
                      <li key={idx} className="flex items-start space-x-2.5 text-xs text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                        <span>{resp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between font-mono">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Clean Architecture Isolation</span>
              <span>Python 3.11+ Validated</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
