export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  GENERATING_IMAGES = 'GENERATING_IMAGES',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export interface ImageToGenerate {
  id: string;
  description: string;
  aspectRatio: "1:1" | "3:4" | "4:3" | "16:9" | "9:16";
  status: 'pending' | 'generating' | 'done' | 'failed';
  url?: string;
}

export interface GeneratedSiteData {
  html: string;
  images: ImageToGenerate[];
}

export interface UserPreferences {
  theme: string;
  colorPalette: string;
}

export interface Project {
  id: string;
  name: string;
  thumbnail?: string; // The uploaded reference image
  html: string;
  createdAt: number;
  lastModified: number;
}