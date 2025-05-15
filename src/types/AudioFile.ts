export interface AudioFile {
  id: string;
  bookId: string; // Foreign key to Book
  url: string;
  title: string;
  downloaded: boolean;
  duration: number;
  blob?: Blob;
}

export interface Book {
  id: string;
  url: string;
  title: string;
  authors: string;
  cover: string;
  readers: string;
  duration: number;
  downloadedCount: number;
  totalFiles: number;
  lastAccessTime?: number; // Timestamp when the book was last accessed
  lastPlayedFile?: string; // ID of the last played file
  lastPlayedTime?: number; // Time in seconds where playback was stopped
}
