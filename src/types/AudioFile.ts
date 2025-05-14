export interface AudioFile {
  id: number;
  title: string;
  url: string;
  duration: number;
  durationFloat?: number;
  error?: number;
}

export interface BookInfo {
  title: string;
  author?: string;
  reader?: string;
  cover?: string;
  audioFiles: AudioFile[];
}