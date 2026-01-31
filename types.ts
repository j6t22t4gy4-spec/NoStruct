
export enum AppMode {
  CHAT = 'CHAT',
  LIVE = 'LIVE',
  SEARCH = 'SEARCH',
  THINKING = 'THINKING',
  VISION = 'VISION',
  FAST = 'FAST'
}

export interface User {
  name: string;
  email: string;
  avatar?: string;
}

export interface ReportPage {
  title: string;
  subtitle: string;
  sections: { title: string, body: string, image?: string }[];
}

export interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  type?: 'text' | 'image' | 'video' | 'audio';
  mediaData?: string; // base64 data for rendering in history
  mediaType?: string; // mimeType
  groundingUrls?: string[];
  thinking?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  folderId?: string | null;
  reports?: ReportPage[];
  activeReportIndex?: number;
}

export interface Folder {
  id: string;
  name: string;
  updatedAt: number;
}

export interface GroundingSource {
  title: string;
  uri: string;
}
