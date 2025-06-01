
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
