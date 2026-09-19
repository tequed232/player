/** Shared domain types. */

export interface QaEntry {
  id: string;
  question: string;
  answer: string;
  /** where the answer came from: api | local match | no match */
  source: 'api' | 'local' | 'none';
  createdAt: number;
}

/** One mind-map branch: a topic with all the answers that belong to it. */
export interface QaBranch {
  id: string;
  topic: string;
  entries: QaEntry[];
}

export interface NoteRecord {
  id: string;
  title: string;
  /** short supporting text shown on cards */
  note: string;
  /** data URLs, newest first */
  images: string[];
  /** live speech-to-text raw transcript */
  transcript: string;
  /** summary produced by the image-to-text API */
  imageSummary: string;
  /** key points distilled from transcript + image summary */
  keyPoints: string[];
  branches: QaBranch[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  darkMode: boolean;
  /** 0..100 - speech recognition confidence threshold */
  speechIntensity: number;
  /** 0..100 - capture resolution / JPEG quality */
  cameraSharpness: number;
  sttApiUrl: string;
  sttApiKey: string;
  visionApiUrl: string;
  visionApiKey: string;
  qaApiUrl: string;
  qaApiKey: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  darkMode: false,
  speechIntensity: 1,
  cameraSharpness: 1,
  sttApiUrl: '',
  sttApiKey: '',
  visionApiUrl: '',
  visionApiKey: '',
  qaApiUrl: '',
  qaApiKey: '',
};

/** The live capture/draft session shown on the Home screen. */
export interface Draft {
  transcript: string;
  interim: string;
  imageSummary: string;
  keyPoints: string[];
  branches: QaBranch[];
  images: string[];
  tags: string[];
  updatedAt: number;
}

export const EMPTY_DRAFT: Draft = {
  transcript: '',
  interim: '',
  imageSummary: '',
  keyPoints: [],
  branches: [],
  images: [],
  tags: [],
  updatedAt: 0,
};
