import React, { useState } from 'react';
import { pipelineStepsData } from '../data/ragArchitectureData';
import { FileText, ArrowRight, CheckCircle, Database, ShieldAlert, Cpu, Bot, Bookmark, Play } from 'lucide-react';

export const WorkflowViewer: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(1);

  const currentStepData = pipelineStepsData.find((s) => s.stepNumber === activeStep) || pipelineStepsData[0];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <div className="pb-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" /> End-to-End Execution Workflow
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Comprehensive lifecycle from PDF upload, page lineage extraction, embedding, vector database indexing, anti-hallucination check, to OpenRouter free model response generation.
          </p>
        </div>

        {/* Step Progress Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mt-6">
          {pipelineStepsData.map((step) => {
            const isActive = step.stepNumber === activeStep;
            return (
              <button
                key={step.stepNumber}
                id={`step-btn-${step.stepNumber}`}
                onClick={() => setActiveStep(step.stepNumber)}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  isActive
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-xs font-mono font-bold w-5 h-5 rounded-full flex items-center justify-center ${
                      isActive ? 'bg-white text-indigo-700' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {step.stepNumber}
                  </span>
                  {isActive && <Play className="w-3 h-3 text-white fill-white" />}
                </div>
                <div className="text-xs font-semibold truncate">{step.title}</div>
              </button>
            );
          })}
        </div>

        {/* Selected Step Detail Panel */}
        <div className="mt-6 bg-slate-50/80 border border-slate-200 rounded-xl p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Step {currentStepData.stepNumber} of 8
                </span>
                <span className="text-xs font-mono text-slate-500 font-medium">{currentStepData.component}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-2">{currentStepData.title}</h3>
            </div>

            <div className="flex items-center space-x-2">
              <button
                disabled={activeStep === 1}
                onClick={() => setActiveStep((prev) => Math.max(1, prev - 1))}
                className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              >
                Previous Step
              </button>
              <button
                disabled={activeStep === 8}
                onClick={() => setActiveStep((prev) => Math.min(8, prev + 1))}
                className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              >
                Next Step
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-700 leading-relaxed mt-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            {currentStepData.description}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div className="bg-white p-4 rounded-xl border border-emerald-200/80 shadow-2xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2 flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5" /> Inputs
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-600">
                {currentStepData.inputs.map((inp, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-emerald-500">•</span> {inp}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white p-4 rounded-xl border border-sky-200/80 shadow-2xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-sky-700 mb-2 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" /> Outputs
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-600">
                {currentStepData.outputs.map((out, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-sky-500">•</span> {out}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white p-4 rounded-xl border border-amber-200/80 shadow-2xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" /> Engineering Edge Cases
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-600">
                {currentStepData.keyConsiderations.map((kc, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-amber-500">•</span> {kc}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
