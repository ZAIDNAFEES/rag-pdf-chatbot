export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  description: string;
  keyResponsibilities: string[];
  children?: FileNode[];
}

export interface Dependency {
  name: string;
  category: 'API & Server' | 'Data Processing & PDF' | 'Vector DB & Embeddings' | 'Frontend' | 'Environment & Utilities';
  purpose: string;
  whyUsed: string;
}

export interface PipelineStep {
  stepNumber: number;
  title: string;
  component: string;
  description: string;
  inputs: string[];
  outputs: string[];
  keyConsiderations: string[];
}
