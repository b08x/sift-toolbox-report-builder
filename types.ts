
export enum ReportType {
  FULL_CHECK = 'Full Check',
  CONTEXT_REPORT = 'Context Report',
  COMMUNITY_NOTE = 'Community Note',
}

export interface GroundingChunkWeb {
  uri: string;
  title: string;
}

export interface GroundingChunk {
  web?: GroundingChunkWeb;
  // Other types of grounding chunks can be added here if needed
}

export interface GeminiServiceResponse {
  reportText: string;
  groundingChunks?: GroundingChunk[];
}

export type UserOrAi = 'user' | 'ai';

export interface ChatMessage {
  id: string;
  sender: UserOrAi;
  text: string;
  timestamp: Date;
  isLoading?: boolean;
  isError?: boolean;
  groundingSources?: GroundingChunk[];
  imagePreviewUrl?: string; 
  originalQuery?: { 
    text?: string;
    imageMimeType?: string | null;
    imageBase64?: string | null;
    reportType?: ReportType; // Added to store report type of original query
  };
  modelId?: string; 
  isInitialSIFTReport?: boolean; // Flag for initial SIFT report that might be sectioned
  originalQueryReportType?: ReportType; // Report type associated with this specific AI message if it's an initial report
}

// For the new left query panel
export interface CurrentSiftQueryDetails {
    userInputText: string;
    userImagePreviewUrl?: string;
    reportType: ReportType;
}

export interface OriginalQueryInfo {
  text?: string;
  imageMimeType?: string | null;
  imageBase64?: string | null;
  reportType: ReportType;
}

// New types for model selection and parameters
export enum AIProvider {
  GOOGLE_GEMINI = 'GOOGLE_GEMINI',
  // HUGGING_FACE = 'HUGGING_FACE', 
  // OPENROUTER = 'OPENROUTER',   
  // MISTRAL = 'MISTRAL',         
}

export type ModelParameterType = 'slider' | 'number' | 'text' | 'select';

export interface ModelParameterOption {
  value: string | number;
  label: string;
}
export interface ModelParameter {
  key: string; 
  label: string;
  type: ModelParameterType;
  min?: number;
  max?: number;
  step?: number;
  defaultValue: number | string;
  options?: ModelParameterOption[]; 
  description?: string;
  unit?: string;
}

export interface AIModelConfig {
  id: string; 
  name: string; 
  provider: AIProvider;
  parameters: ModelParameter[];
  supportsGoogleSearch?: boolean; 
  defaultSystemPrompt?: string; 
}

export type ConfigurableParams = {
  [key: string]: number | string | boolean;
};

// For sectioned display
export interface ParsedReportSection {
  title: string;
  rawTitle: string; // The original header line, e.g., "## 1. Verified Facts"
  content: string;
  level: number; // 0 for preamble, 2 for H2, 3 for H3
}
