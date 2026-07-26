/**
 * queryInterpreter.ts — frontend type definitions
 * Mirrors the server-side types from api/_lib/queryInterpreter.ts
 */

export interface InterpretedFilters {
  category?:         string;
  brand?:            string;
  color?:            string;
  size?:             string;
  gender?:           'men' | 'women' | 'kids' | 'unisex';
  style?:            string;
  minPrice?:         number;
  maxPrice?:         number;
  minDiscount?:      number;
  retailer?:         string;
  sort?:             'price-asc' | 'price-desc' | 'discount-desc' | 'relevance';
  comparisonIntent?: boolean;
}

export interface FilterChip {
  key:   keyof InterpretedFilters;
  label: string;
  value: string;
}

export interface ParsedQuery {
  searchKeywords: string;
  filters:        InterpretedFilters;
  confidence:     number;
  provider:       'rules' | 'groq' | 'openai' | 'gemini' | 'fallback';
  cached:         boolean;
}
