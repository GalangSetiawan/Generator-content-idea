export interface ImagePrompt {
  timestamp: string;
  prompt: string;
  generated: boolean;
  videoPrompt?: string;
  videoPromptLoading?: boolean;
  imageUrl?: string;
  imageLoading?: boolean;
  imageError?: boolean;
}

export interface ContentIdea {
  id: string;
  narration?: string;
  imagePrompts?: ImagePrompt[];
  narrationLoading: boolean;
  narrationPrompt: string;
  notes?: string;
  [key: string]: any; // For dynamic columns
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  topic: string;
  customColumns: string[];
  ideas: ContentIdea[];
}