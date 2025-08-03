export interface WikiSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WikiPageContent {
  url: string;
  title: string;
  content: string;
  sections: Record<string, string>;
}

export interface AgentResponse {
  query: string;
  found: boolean;
  sources: string[];
  answer: string;
  format: 'markdown' | 'json';
  timestamp: string;
}

export interface SearchToolResponse {
  results: WikiSearchResult[];
  totalResults: number;
}

export interface WikiAgentConfig {
  apiKey: string;
  baseUrl: string;
  searchEndpoint: string;
  maxResults: number;
  timeout: number;
}

export type QueryComplexity = 'simple' | 'comparison' | 'report' | 'complex_analysis';

export interface ProcessedQuery {
  originalQuery: string;
  intent: string;
  entities: string[];
  complexity: QueryComplexity;
  requiresMultiplePages: boolean;
}