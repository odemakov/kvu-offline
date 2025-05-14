export interface AudioFile {
  id: string;
  url: string;
  title: string;
  duration: string;
  downloaded: boolean;
  durationSeconds?: number;
  blob?: Blob;
}

export interface Book {
  id: string;
  url: string;
  title: string;
  files: AudioFile[];
  totalDuration: number;
  downloadedCount: number;
  totalFiles: number;
  lastAccessTime?: number; // Timestamp when the book was last accessed
  lastPlayedFile?: string; // ID of the last played file
  lastPlayedTime?: number; // Time in seconds where playback was stopped
}
