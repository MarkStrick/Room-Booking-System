export interface AssistantSearch {
  date: string;
  start: string;
  end: string;
  endDate: string;
  capacity: number;
  amenities: string[];
  building: string;
  roomQuery: string;
}
export interface AssistantRequest {
  question: string;
  context?: AssistantSearch;
  filters?: AssistantSearch;
}
export interface AssistantRoom {
  id: number;
  name: string;
  building: string;
  capacity: number;
  amenities: string[];
}
export interface AssistantResponse {
  text: string;
  mode: 'gemini' | 'fallback' | 'demo';
  source: 'catalog' | 'faq' | 'guide';
  checkedAt: string;
  search?: AssistantSearch;
  rooms: AssistantRoom[];
  total: number;
  needsDetails: boolean;
  faqQuestions?: string[];
}
export interface AssistantIntent {
  kind: 'search' | 'faq' | 'booking-help' | 'status-help' | 'contact' | 'out-of-scope';
  date: string | null;
  start: string | null;
  end: string | null;
  endDate: string | null;
  capacity: number | null;
  amenities: string[];
  building: string | null;
  roomQuery: string | null;
  faqIndex: number | null;
  needsClarification: boolean;
}
