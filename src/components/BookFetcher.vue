<template>
  <div class="book-fetcher">
    <h1>Audiobook Player</h1>
    <div class="description">
      Enter a book URL from knigavuhe.org to start listening.
    </div>

    <div class="input-form">
      <input
        v-model="bookUrl"
        class="url-input"
        placeholder="Enter book URL (e.g., https://knigavuhe.org/book/...)"
        :disabled="isLoading"
      />
      <button
        @click="downloadBook"
        class="download-button"
        :disabled="!validateUrl(bookUrl) || isLoading"
      >
        <template v-if="isLoading">
          <div class="loading-spinner"></div>
          Loading...
        </template>
        <template v-else> <span class="icon">↓</span> Download </template>
      </button>
    </div>

    <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

    <div class="book-switcher">
      <button @click="toggleLibrary" class="library-button">
        <span class="icon">📚</span> Library
      </button>
    </div>

    <LibraryList
      :books="books"
      :currentBookId="currentBook?.id || null"
      :showLibrary="showBooksList"
      @select-book="switchBook"
      @close="showBooksList = false"
    />

    <CurrentBook
      :book="currentBook"
      :files="audioFiles"
      :currentFileId="currentFile?.id || null"
      @play-file="playFileById"
      @download-file="downloadFileById"
    />

    <!-- Audio Player -->
    <div class="audio-player-wrapper" v-if="audioFiles.length > 0 && currentFile">
      <div class="player-info">
        <div class="now-playing">
          <strong>Now Playing:</strong> {{ currentFile.title }}
        </div>
      </div>

      <div class="player-controls">
        <button @click="playPrevious" class="control-button" :disabled="!hasPrevious">
          <span class="icon">⏮</span>
        </button>
        <button v-if="!isPlaying" @click="playAudio" class="control-button play-button">
          <span class="icon">▶</span>
        </button>
        <button v-else @click="pauseAudio" class="control-button pause-button">
          <span class="icon">⏸</span>
        </button>
        <button @click="playNext" class="control-button" :disabled="!hasNext">
          <span class="icon">⏭</span>
        </button>

        <div class="progress-container" @click="seek">
          <div class="progress-bar" :style="{ width: progress + '%' }"></div>
        </div>

        <div class="time-display">
          {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
        </div>

        <div class="volume-control">
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            v-model="volume"
            @input="setVolume"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { type AudioFile, type Book } from "../types/AudioFile";
import LibraryList from "./LibraryList.vue";
import CurrentBook from "./CurrentBook.vue";
import { createHash, validateUrl } from "../utils/htmlUtils";
import { fetchProxiedHTML, downloadProxiedFile } from "../utils/proxyUtils";

// Database configuration
const DB_NAME = "kvu-offline-db";
const DB_VERSION = 1;
const BOOKS_STORE = "books";
const FILES_STORE = "files";

let db: IDBDatabase | null = null;

const bookUrl = ref("");
const isLoading = ref(false);
const errorMessage = ref("");
const audioFiles = ref<AudioFile[]>([]);
const books = ref<Book[]>([]);
const currentBook = ref<Book | null>(null);
const showBooksList = ref(false);

// Audio player state
const audioPlayer = ref<HTMLAudioElement | null>(null);
const isPlaying = ref(false);
const currentFileIndex = ref(0);
const currentTime = ref(0);
const duration = ref(0);
const volume = ref(0.75);

// Computed properties
const progress = computed(() => {
  return duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0;
});

const currentFile = computed(() => {
  return audioFiles.value.length > 0 ? audioFiles.value[currentFileIndex.value] : null;
});

const hasNext = computed(() => {
  return currentFileIndex.value < audioFiles.value.length - 1;
});

const hasPrevious = computed(() => {
  return currentFileIndex.value > 0;
});

// Initialize the database
function initDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB error:", event);
      reject("Could not open IndexedDB");
    };

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result;
      console.log("IndexedDB connected successfully");
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create books store
      if (!db.objectStoreNames.contains(BOOKS_STORE)) {
        db.createObjectStore(BOOKS_STORE, { keyPath: "id" });
      }

      // Create files store with index for bookId
      if (!db.objectStoreNames.contains(FILES_STORE)) {
        const filesStore = db.createObjectStore(FILES_STORE, { keyPath: "id" });
        filesStore.createIndex("bookId", "bookId", { unique: false });
      }
    };
  });
}

// Load all books from the database
async function loadBooks(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("Database not initialized"));

    const transaction = db.transaction(BOOKS_STORE, "readonly");
    const store = transaction.objectStore(BOOKS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      books.value.length = 0;

      // Sort books by last access time (newest first)
      const sortedBooks = request.result.sort((a: Book, b: Book) => {
        const timeA = a.lastAccessTime || 0;
        const timeB = b.lastAccessTime || 0;
        return timeB - timeA;
      });

      books.value.push(...sortedBooks);

      // If we have books, load the most recent one
      if (books.value.length > 0) {
        const lastBookId = localStorage.getItem("lastBookId");
        if (lastBookId) {
          const lastBook = books.value.find((book) => book.id === lastBookId);
          if (lastBook) {
            currentBook.value = lastBook;
            bookUrl.value = lastBook.url;

            // Update last access time
            lastBook.lastAccessTime = Date.now();
            saveBook(lastBook);

            loadBookFiles(lastBook.id);
          } else {
            currentBook.value = books.value[0];
            bookUrl.value = books.value[0].url;

            // Update last access time
            books.value[0].lastAccessTime = Date.now();
            saveBook(books.value[0]);

            loadBookFiles(books.value[0].id);
          }
        } else {
          currentBook.value = books.value[0];
          bookUrl.value = books.value[0].url;

          // Update last access time
          books.value[0].lastAccessTime = Date.now();
          saveBook(books.value[0]);

          loadBookFiles(books.value[0].id);
        }
      }

      resolve();
    };

    request.onerror = (event) => {
      console.error("Error loading books:", event);
      reject("Failed to load books");
    };
  });
}

// Load files for a specific book
async function loadBookFiles(bookId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("Database not initialized"));

    const transaction = db.transaction(FILES_STORE, "readonly");
    const store = transaction.objectStore(FILES_STORE);
    const index = store.index("bookId");
    const request = index.getAll(bookId);

    request.onsuccess = () => {
      audioFiles.value.length = 0;

      // Sort files by their index
      const files = request.result.sort((a: AudioFile, b: AudioFile) => {
        const numA = parseInt(a.title.match(/\d+/)?.[0] || "0");
        const numB = parseInt(b.title.match(/\d+/)?.[0] || "0");
        if (numA && numB) {
          return numA - numB;
        }
        return a.title.localeCompare(b.title);
      });

      audioFiles.value.push(...files);

      if (currentBook.value && currentBook.value.lastPlayedFile) {
        // Find the index of the last played file
        const lastPlayedIndex = audioFiles.value.findIndex(
          (file) => file.id === currentBook.value?.lastPlayedFile,
        );
        if (lastPlayedIndex !== -1) {
          currentFileIndex.value = lastPlayedIndex;

          currentTime.value = currentBook.value.lastPlayedTime || 0;
          duration.value = audioFiles.value[lastPlayedIndex].durationSeconds || 0;
        }
      }

      resolve();
    };

    request.onerror = (event) => {
      console.error("Error loading files:", event);
      reject("Failed to load files");
    };
  });
}

// Switch to another book in the library
async function switchBook(bookId: string) {
  showBooksList.value = false;
  if (audioPlayer.value) {
    audioPlayer.value.pause();
    isPlaying.value = false;
  }

  // Save current playback position before switching
  if (currentBook.value && currentFile.value) {
    savePlaybackPosition();
  }

  const book = books.value.find((b) => b.id === bookId);
  if (book) {
    currentBook.value = book;
    bookUrl.value = book.url;

    // Update last access time
    book.lastAccessTime = Date.now();
    saveBook(book);

    // Load the files for this book
    await loadBookFiles(book.id);

    // Auto-play from last position if there's a last played file
    if (book.lastPlayedFile) {
      const fileIndex = audioFiles.value.findIndex(
        (file) => file.id === book.lastPlayedFile,
      );
      if (fileIndex !== -1) {
        currentFileIndex.value = fileIndex;
        currentTime.value = book.lastPlayedTime || 0;
        setTimeout(() => {
          playAudio();
        }, 500);
      }
    }
  }
}

// Save book to database
async function saveBook(book: Book): Promise<void> {
  console.log("Attempting to save book:", JSON.stringify(book, null, 2));
  console.log("Book object keys:", Object.keys(book));
  console.log("Book object:", book);
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("Database not initialized"));

    const transaction = db.transaction(BOOKS_STORE, "readwrite");
    const bookStore = transaction.objectStore(BOOKS_STORE);

    // Create a clean copy with only serializable data
    // to avoid "Failed to execute 'put' on 'IDBObjectStore': #<Object> could not be cloned." error
    const bookToSave = {
      id: book.id,
      url: book.url,
      title: book.title,
      authors: book.authors,
      cover: book.cover,
      readers: book.readers,
      duration: book.duration,
      downloadedCount: book.downloadedCount,
      totalFiles: book.totalFiles,
      lastAccessTime: book.lastAccessTime,
      lastPlayedFile: book.lastPlayedFile,
      lastPlayedTime: book.lastPlayedTime,
    };

    // Save the book
    bookStore.put(bookToSave);

    transaction.oncomplete = () => {
      // Update the local books array
      const index = books.value.findIndex((b) => b.id === book.id);
      if (index !== -1) {
        books.value[index] = book;
      } else {
        books.value.push(book);
      }

      // Save as last book
      localStorage.setItem("lastBookId", book.id);

      resolve();
    };

    transaction.onerror = (event) => {
      console.error("Error saving book:", event);
      reject("Failed to save book");
    };
  });
}

// Save file to database
async function saveFile(file: AudioFile): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("Database not initialized"));

    const transaction = db.transaction(FILES_STORE, "readwrite");
    const store = transaction.objectStore(FILES_STORE);

    const fileToSave = {
      id: file.id,
      bookId: file.bookId,
      url: file.url,
      title: file.title,
      downloaded: file.downloaded,
      duration: file.duration,
    };
    const request = store.put(fileToSave);

    request.onsuccess = () => {
      console.log("File saved successfully");
      resolve();
    };

    request.onerror = (event) => {
      console.error("Error saving file:", event);
      reject("Failed to save file");
    };
  });
}

// Download the book data from the URL
async function downloadBook() {
  if (!validateUrl(bookUrl.value) || isLoading.value) return;

  errorMessage.value = "";
  isLoading.value = true;

  try {
    // Check if the book already exists
    const existingBookIndex = books.value.findIndex(
      (book) => book.url === bookUrl.value,
    );

    // If book exists, switch to it
    if (existingBookIndex !== -1) {
      const existingBook = books.value[existingBookIndex];
      currentBook.value = existingBook;

      // Update last access time
      existingBook.lastAccessTime = Date.now();
      await saveBook(existingBook);

      // Load its files
      await loadBookFiles(existingBook.id);
      isLoading.value = false;
      return;
    }

    // Otherwise fetch the new book
    await fetchBookData();
  } catch (error) {
    console.error("Download failed:", error);
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Failed to download book data. Please try again.";
  } finally {
    isLoading.value = false;
  }
}

// Fetch book data from knigavuhe.org
async function fetchBookData() {
  // Fetch the HTML content
  const html = await fetchProxiedHTML(bookUrl.value);

  // Parse the HTML to extract book info and files
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Find the BookPlayer initialization data
  const scripts = doc.querySelectorAll("script");
  let bookPlayerData = null;
  for (const script of scripts) {
    const content = script.textContent || "";

    // Try to find BookPlayer initialization
    if (content.includes("BookPlayer")) {
      const playerMatch = content.match(
        /var\s+player\s*=\s*new\s+BookPlayer\s*\(\s*\d+\s*,\s*(\[[\s\S]*?\])\s*[\s\S]*?\)/,
      );
      console.log(playerMatch);
      if (playerMatch && playerMatch[1]) {
        try {
          // Clean the JSON string - replace single quotes with double quotes and remove trailing commas
          const jsonStr = playerMatch[1]
            .replace(/'/g, '"')
            .replace(/,\s*}/g, "}")
            .replace(/,\s*]/g, "]");

          const playlistData = JSON.parse(jsonStr);
          bookPlayerData = { playlist: playlistData };
          console.log("Successfully parsed BookPlayer data with first pattern");
          console.log(bookPlayerData);

          break;
        } catch (e) {
          console.error("Failed to parse BookPlayer data with first pattern:", e);
        }
      }
    }
  }

  if (bookPlayerData == null) {
    throw new Error("Could not parse BookPlayer data");
  }

  if (bookPlayerData.playlist.length === 0) {
    throw new Error("No chapters found");
  }

  let book: Book | undefined;
  let totalDuration = 0;
  const files: AudioFile[] = [];
  let count = 0;

  bookPlayerData.playlist.forEach((chapter: any) => {
    if (!book) {
      // Create a new book object
      book = {
        id: createHash(bookUrl.value),
        url: bookUrl.value,
        title: chapter.player_data.title,
        authors: chapter.player_data.authors,
        readers: chapter.player_data.readers,
        cover: chapter.player_data.cover,
        duration: 0,
        downloadedCount: 0,
        totalFiles: bookPlayerData.playlist.length,
        lastAccessTime: Date.now(),
      };
    }

    // No need to check if book exists here since we just created it above
    totalDuration += chapter.duration;
    files.push({
      id: book.id + "-" + count++,
      bookId: book.id,
      url: chapter.url,
      title: chapter.title,
      duration: chapter.duration,
      downloaded: false,
    });
  });
  console.log(files);

  // Check if book was created before updating duration
  if (book) {
    book.duration = totalDuration;
  } else {
    // Handle the case where playlist was empty
    throw new Error("Unable to create book from empty playlist");
  }

  // Save the book to the database
  await saveBook(book);

  // Save all files to the database
  await Promise.all(files.map((file) => saveFile(file)));

  // Set current book and load files
  currentBook.value = book;
  await loadBookFiles(book.id);
}

// Play a file by its ID
function playFileById(fileId: string) {
  const fileIndex = audioFiles.value.findIndex((file) => file.id === fileId);
  if (fileIndex !== -1) {
    currentFileIndex.value = fileIndex;
    playAudio();
  }
}

// Download a file by its ID
async function downloadFileById(fileId: string) {
  const fileIndex = audioFiles.value.findIndex((file) => file.id === fileId);
  if (fileIndex === -1) return;

  const file = audioFiles.value[fileIndex];

  try {
    const blob = await downloadProxiedFile(file.url);

    // Update file with blob and downloaded status
    file.blob = blob;
    file.downloaded = true;

    // Save updated file
    await saveFile(file);

    // Update book stats
    if (currentBook.value) {
      currentBook.value.downloadedCount++;
      await saveBook(currentBook.value);
    }

    console.log(`File ${file.title} downloaded successfully`);
  } catch (error) {
    console.error("Error downloading file:", error);
    errorMessage.value = "Failed to download file. Please try again.";
  }
}

// Play the current audio file
async function playAudio() {
  if (!currentFile.value) return;

  // If there's no audio player element yet, create one
  if (!audioPlayer.value) {
    audioPlayer.value = new Audio();
    audioPlayer.value.volume = volume.value;

    // Set up event listeners
    audioPlayer.value.addEventListener("timeupdate", updateProgress);
    audioPlayer.value.addEventListener("ended", playNext);
    audioPlayer.value.addEventListener("loadedmetadata", () => {
      duration.value = audioPlayer.value?.duration || 0;
    });
  }

  // Reset the player
  audioPlayer.value.pause();

  try {
    // Set up the audio source
    if (currentFile.value.downloaded && currentFile.value.blob) {
      // Use the downloaded blob
      audioPlayer.value.src = URL.createObjectURL(currentFile.value.blob);
    } else {
      // Stream from URL
      audioPlayer.value.src = currentFile.value.url;
    }

    // Set the current time if we have a saved position
    if (
      currentBook.value &&
      currentBook.value.lastPlayedFile === currentFile.value.id &&
      currentBook.value.lastPlayedTime
    ) {
      currentTime.value = currentBook.value.lastPlayedTime;
      audioPlayer.value.currentTime = currentTime.value;
    } else {
      currentTime.value = 0;
    }

    // Play the audio
    await audioPlayer.value.play();
    isPlaying.value = true;

    // Update book's last played info
    if (currentBook.value) {
      currentBook.value.lastPlayedFile = currentFile.value.id;
      saveBook(currentBook.value);
    }
  } catch (error) {
    console.error("Error playing audio:", error);
    errorMessage.value = "Failed to play audio. Please try again.";
    isPlaying.value = false;
  }
}

// Pause the current audio
function pauseAudio() {
  if (!audioPlayer.value) return;

  audioPlayer.value.pause();
  isPlaying.value = false;

  // Save current position
  savePlaybackPosition();
}

// Play the previous file
function playPrevious() {
  if (currentFileIndex.value > 0) {
    // Save current position before switching
    savePlaybackPosition();

    currentFileIndex.value--;
    playAudio();
  }
}

// Play the next file
function playNext() {
  if (currentFileIndex.value < audioFiles.value.length - 1) {
    // Save current position before switching
    savePlaybackPosition();

    currentFileIndex.value++;
    playAudio();
  } else {
    // End of playlist
    isPlaying.value = false;
  }
}

// Update progress based on audio player's current time
function updateProgress() {
  if (!audioPlayer.value) return;

  currentTime.value = audioPlayer.value.currentTime;
}

// Seek to position in the audio
function seek(event: MouseEvent) {
  if (!audioPlayer.value || !duration.value) return;

  const progressContainer = event.currentTarget as HTMLElement;
  const { left, width } = progressContainer.getBoundingClientRect();
  const clickPosition = (event.clientX - left) / width;

  const newTime = clickPosition * duration.value;
  audioPlayer.value.currentTime = newTime;
  currentTime.value = newTime;
}

// Set the volume
function setVolume() {
  if (!audioPlayer.value) return;

  audioPlayer.value.volume = volume.value;
  localStorage.setItem("audioVolume", volume.value.toString());
}

// Save the current playback position
function savePlaybackPosition() {
  if (!currentBook.value || !currentFile.value || !audioPlayer.value) return;

  currentBook.value.lastPlayedFile = currentFile.value.id;
  currentBook.value.lastPlayedTime = audioPlayer.value.currentTime;

  saveBook(currentBook.value);
}

// Toggle library visibility
function toggleLibrary() {
  showBooksList.value = !showBooksList.value;
}

// Format time in seconds to MM:SS or HH:MM:SS
function formatTime(seconds: number): string {
  if (!seconds) return "0:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const formattedMinutes = minutes < 10 && hours > 0 ? `0${minutes}` : minutes;
  const formattedSeconds = secs < 10 ? `0${secs}` : secs;

  return hours > 0
    ? `${hours}:${formattedMinutes}:${formattedSeconds}`
    : `${formattedMinutes}:${formattedSeconds}`;
}

// Lifecycle hooks
onMounted(async () => {
  try {
    await initDB();
    await loadBooks();

    // Load saved volume
    const savedVolume = localStorage.getItem("audioVolume");
    if (savedVolume) {
      volume.value = parseFloat(savedVolume);
    }
  } catch (error) {
    console.error("Error initializing app:", error);
    errorMessage.value = "Failed to initialize app. Please refresh the page.";
  }
});

onBeforeUnmount(() => {
  // Clean up
  if (audioPlayer.value) {
    audioPlayer.value.pause();
    audioPlayer.value.removeEventListener("timeupdate", updateProgress);
    audioPlayer.value.removeEventListener("ended", playNext);
  }

  // Save current position
  savePlaybackPosition();
});

// Watch for changes to save data
watch(volume, () => {
  localStorage.setItem("audioVolume", volume.value.toString());
});
</script>

<style scoped>
.book-fetcher {
  max-width: 960px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}

h1 {
  color: #333;
  margin-bottom: 10px;
  font-size: 1.8em;
}

.description {
  color: #666;
  margin-bottom: 20px;
  font-size: 0.9em;
}

.input-form {
  display: flex;
  margin-bottom: 20px;
}

.url-input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px 0 0 4px;
}

.url-input:focus {
  outline: none;
  border-color: #3498db;
}

.download-button {
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 0 4px 4px 0;
  padding: 0 15px;
  cursor: pointer;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #ffffff;
  border-top: 2px solid transparent;
  border-radius: 50%;
  margin-right: 8px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.download-button:hover {
  background-color: #2980b9;
}

.download-button:disabled {
  background-color: #95a5a6;
  cursor: not-allowed;
}

.error-message {
  color: #e74c3c;
  padding: 10px;
  background-color: #fadbd8;
  border-radius: 4px;
  margin-bottom: 20px;
  font-size: 0.9em;
}

.results {
  margin-top: 20px;
  background-color: #f9f9f9;
  padding: 15px;
  border-radius: 8px;
}

.book-info-header {
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eaeaea;
}

.book-info-header h2 {
  margin: 0 0 5px 0;
  font-size: 1.5em;
  color: #333;
}

.book-stats {
  color: #666;
  font-size: 0.9em;
}

.bullet {
  margin: 0 8px;
  color: #ccc;
}

.audio-files-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 15px;
}

.audio-files-table th,
.audio-files-table td {
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid #eaeaea;
  font-size: 0.9em;
}

.audio-files-table th {
  font-weight: 500;
  color: #666;
  background-color: #f5f5f5;
}

.audio-files-table tr:hover {
  background-color: #f9f9f9;
}

.file-title {
  font-weight: 500;
}

.action-link {
  color: #3498db;
  text-decoration: none;
  margin-right: 10px;
  font-size: 0.85em;
  display: inline-flex;
  align-items: center;
}

.icon {
  margin-right: 4px;
}

.action-link:hover {
  color: #2980b9;
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
}

.download-buttons {
  display: flex;
  justify-content: center;
  margin-top: 10px;
}

.audio-player-wrapper {
  margin-top: 25px;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 8px;
}

.player-info {
  margin-bottom: 10px;
}

.now-playing {
  font-size: 0.9em;
  color: #333;
}

.player-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.control-button {
  background: none;
  border: none;
  width: 36px;
  height: 36px;
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.control-button:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.control-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.play-button,
.pause-button {
  width: 42px;
  height: 42px;
}

.progress-container {
  flex: 1;
  height: 6px;
  background-color: #ddd;
  border-radius: 3px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background-color: #3498db;
  width: 0;
  transition: width 0.1s linear;
}

.time-display {
  font-size: 0.75em;
  color: #666;
  white-space: nowrap;
  margin-left: 5px;
  min-width: 80px;
  text-align: center;
}

.volume-control {
  display: flex;
  align-items: center;
  margin-left: 10px;
}

.volume-control input[type="range"] {
  width: 80px;
}

@media (max-width: 768px) {
  .input-form {
    flex-direction: column;
  }

  .url-input,
  .download-button {
    width: 100%;
    border-radius: 4px;
    margin-bottom: 10px;
  }

  .audio-files-table th,
  .audio-files-table td {
    padding: 8px 5px;
    font-size: 0.8em;
  }

  .progress-container {
    flex: 1;
    min-width: 100px;
  }

  .player-controls {
    justify-content: center;
  }

  .time-display {
    font-size: 0.7em;
  }
}
</style>
