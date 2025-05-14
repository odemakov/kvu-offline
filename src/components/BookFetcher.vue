<script setup lang="ts">
import { ref, reactive, onMounted, computed } from "vue";

interface AudioFile {
  id: string; // Unique identifier
  url: string;
  title: string;
  duration: string;
  downloaded: boolean;
  durationSeconds?: number;
  blob?: Blob;
}

interface Book {
  id: string; // URL hash or some unique identifier
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

// Add proper decoding of HTML entities
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

// Convert duration string (MM:SS) to seconds
function durationToSeconds(duration: string): number {
  if (!duration) return 0;

  const parts = duration.split(":");
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  } else if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
  }
  return 0;
}

// Format seconds to HH:MM:SS
function formatDuration(seconds: number): string {
  if (!seconds) return "0:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

// Create a hash from a string for use as ID
function createHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

// IndexedDB setup
const DB_NAME = "kvu-offline-db";
const DB_VERSION = 1;
const BOOKS_STORE = "books";
const FILES_STORE = "files";

let db: IDBDatabase | null = null;

const bookUrl = ref("");
const isLoading = ref(false);
const errorMessage = ref("");
const audioFiles = reactive<AudioFile[]>([]);
const books = reactive<Book[]>([]);
const currentBook = ref<Book | null>(null);
const showBooksList = ref(false);

// Audio player state
const audioPlayer = ref<HTMLAudioElement | null>(null);
const isPlaying = ref(false);
const currentFileIndex = ref(0);
const currentTime = ref(0);
const duration = ref(0);
const progress = ref(0);
const volume = ref(1);

// Computed properties
const currentFile = computed(() => {
  if (
    !currentBook.value ||
    currentFileIndex.value < 0 ||
    !currentBook.value.files.length
  )
    return null;
  return currentBook.value.files[currentFileIndex.value];
});

// Initialize IndexedDB
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

      // Create files store
      if (!db.objectStoreNames.contains(FILES_STORE)) {
        const filesStore = db.createObjectStore(FILES_STORE, { keyPath: "id" });
        filesStore.createIndex("bookId", "bookId", { unique: false });
      }
    };
  });
}

// Load books from IndexedDB
async function loadBooks(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("Database not initialized"));

    const transaction = db.transaction(BOOKS_STORE, "readonly");
    const store = transaction.objectStore(BOOKS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      books.length = 0;

      // Sort books by last access time (newest first)
      const sortedBooks = request.result.sort((a: Book, b: Book) => {
        const timeA = a.lastAccessTime || 0;
        const timeB = b.lastAccessTime || 0;
        return timeB - timeA;
      });

      books.push(...sortedBooks);

      // If we have books, load the most recent one
      if (books.length > 0) {
        const lastBookId = localStorage.getItem("lastBookId");
        if (lastBookId) {
          const lastBook = books.find((book) => book.id === lastBookId);
          if (lastBook) {
            currentBook.value = lastBook;
            bookUrl.value = lastBook.url;

            // Update last access time
            lastBook.lastAccessTime = Date.now();
            saveBook(lastBook);

            loadBookFiles(lastBook.id);
          } else {
            currentBook.value = books[0];
            bookUrl.value = books[0].url;

            // Update last access time
            books[0].lastAccessTime = Date.now();
            saveBook(books[0]);

            loadBookFiles(books[0].id);
          }
        } else {
          currentBook.value = books[0];
          bookUrl.value = books[0].url;

          // Update last access time
          books[0].lastAccessTime = Date.now();
          saveBook(books[0]);

          loadBookFiles(books[0].id);
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
      audioFiles.length = 0;

      // Sort files by their index
      const files = request.result.sort((a: AudioFile, b: AudioFile) => {
        const numA = parseInt(a.title.match(/\d+/)?.[0] || "0");
        const numB = parseInt(b.title.match(/\d+/)?.[0] || "0");
        if (numA && numB) {
          return numA - numB;
        }
        return a.title.localeCompare(b.title);
      });

      audioFiles.push(...files);

      if (currentBook.value && currentBook.value.lastPlayedFile) {
        // Find the index of the last played file
        const lastPlayedIndex = audioFiles.findIndex(
          (file) => file.id === currentBook.value?.lastPlayedFile,
        );
        if (lastPlayedIndex !== -1) {
          currentFileIndex.value = lastPlayedIndex;
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

// Switch to a different book
async function switchBook(bookId: string): Promise<void> {
  // Pause current playback
  if (isPlaying.value) {
    pauseAudio();
  }

  // Clean up any existing object URL
  if (audioPlayer.value?.src.startsWith("blob:")) {
    URL.revokeObjectURL(audioPlayer.value.src);
  }

  // Find the book
  const book = books.find((b) => b.id === bookId);
  if (!book) {
    errorMessage.value = "Book not found";
    return;
  }

  // Update current book
  currentBook.value = book;
  bookUrl.value = book.url;

  // Update last access time
  book.lastAccessTime = Date.now();
  await saveBook(book);

  // Load the book's files
  await loadBookFiles(bookId);

  // Reset player position
  currentFileIndex.value = 0;
  if (book.lastPlayedFile) {
    const lastPlayedIndex = audioFiles.findIndex(
      (file) => file.id === book.lastPlayedFile,
    );
    if (lastPlayedIndex !== -1) {
      currentFileIndex.value = lastPlayedIndex;
    }
  }

  // Save as last book
  localStorage.setItem("lastBookId", bookId);
}

// Save a book to IndexedDB
async function saveBook(book: Book): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("Database not initialized"));

    const transaction = db.transaction([BOOKS_STORE, FILES_STORE], "readwrite");
    const bookStore = transaction.objectStore(BOOKS_STORE);
    const fileStore = transaction.objectStore(FILES_STORE);

    // Extract blobs and save them separately
    const blobs: { id: string; blob: Blob }[] = [];
    const cleanBook = {
      ...book,
      files: book.files.map((file) => {
        if (file.blob) {
          blobs.push({ id: file.id, blob: file.blob });
        }
        const { blob, ...cleanFile } = file;
        return cleanFile;
      }),
    };

    // Save the book
    bookStore.put(cleanBook);

    // save the blobs
    blobs.forEach(({ id, blob }) => {
      fileStore.put({ id, blob });
    });

    transaction.oncomplete = () => {
      console.log("Book saved successfully");

      // Update the local books array
      const index = books.findIndex((b) => b.id === book.id);
      if (index !== -1) {
        books[index] = book;
      } else {
        books.push(book);
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

// Save a file to IndexedDB
async function saveFile(file: AudioFile, bookId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("Database not initialized"));

    const transaction = db.transaction(FILES_STORE, "readwrite");
    const store = transaction.objectStore(FILES_STORE);

    // Add bookId to the file object
    const fileWithBookId = { ...file, bookId };
    const request = store.put(fileWithBookId);

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

// Download all files for the current book
async function downloadBook() {
  if (!currentBook.value || !audioFiles.length) return;

  const book = currentBook.value;
  //const totalFiles = audioFiles.length;
  let downloadedCount = book.downloadedCount || 0;

  // Create a progress element
  // const progressContainer = document.createElement("div");
  // progressContainer.className = "download-progress-container";
  // progressContainer.innerHTML = `
  //   <div class="download-progress-text">Downloading ${downloadedCount}/${totalFiles} files...</div>
  //   <div class="download-progress-bar-bg">
  //     <div class="download-progress-bar" style="width: ${(downloadedCount / totalFiles) * 100}%"></div>
  //   </div>
  // `;
  // document.body.appendChild(progressContainer);

  // let downloadFailed = false;

  // Download each file and store in IndexedDB
  for (let i = 0; i < audioFiles.length; i++) {
    const file = audioFiles[i];
    if (file.downloaded) {
      continue;
    }

    try {
      let blob;
      try {
        const response = await fetch("/api/proxy-data", {
          cache: "no-store",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Range: "bytes=0-",
            // Accept: "audio/mpeg, audio/*",
          },
          body: JSON.stringify({ url: file.url }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Get the MP3 as a blob
        blob = await response.blob();
      } catch (e) {
        console.error(`Failed to download file ${file.title} from primary URL:`, e);
      }
      console.log(blob);

      // Verify we got an audio file (check MIME type)
      if (blob && (!blob.type || !blob.type.includes("audio/"))) {
        console.warn(`Downloaded file doesn't appear to be audio: ${blob.type}`);
      }

      file.downloaded = true;
      file.blob = blob;
      await saveFile(file, book.id);

      // Update book download stats
      downloadedCount++;
      book.downloadedCount = downloadedCount;
      await saveBook(book);

      // Update UI for this file
      const fileInList = audioFiles.find((f) => f.id === file.id);
      if (fileInList) {
        fileInList.downloaded = true;
        fileInList.blob = file.blob;
      }

      // Update progress
      // const progressBar = progressContainer.querySelector(".download-progress-bar");
      // const progressText = progressContainer.querySelector(".download-progress-text");
      // if (progressBar && progressText) {
      //   const percent = (downloadedCount / totalFiles) * 100;
      //   progressBar.style.width = `${percent}%`;
      //   progressText.textContent = `Downloading ${downloadedCount}/${totalFiles} files...`;
      // }
    } catch (error) {
      //downloadFailed = false;
      console.error(`Error downloading file ${file.title}:`, error);
    }
  }

  // Final update to progress
  // const progressBar = progressContainer.querySelector(".download-progress-bar");
  // const progressText = progressContainer.querySelector(".download-progress-text");
  // if (progressBar && progressText) {
  //   progressBar.style.width = "100%";
  //   if (downloadFailed) {
  //     progressText.textContent = `Downloaded ${downloadedCount}/${totalFiles} files (some failed)`;
  //   } else {
  //     progressText.textContent = `Downloaded ${downloadedCount}/${totalFiles} files`;
  //   }

  //   // Remove progress bar after a delay
  //   setTimeout(() => {
  //     document.body.removeChild(progressContainer);
  //   }, 2000);
  // }
}

async function fetchBookData() {
  isLoading.value = true;
  audioFiles.length = 0;
  errorMessage.value = "";

  try {
    if (!bookUrl.value) {
      throw new Error("Please enter a URL");
    }

    if (!validateUrl(bookUrl.value)) {
      throw new Error(
        "Please enter a valid book URL from knigavuhe.org (e.g., https://knigavuhe.org/book/example/)",
      );
    }

    // Normalize URL to prevent duplicates
    const normalizedUrl = normalizeUrl(bookUrl.value);
    bookUrl.value = normalizedUrl;

    // Check if we already have this book in the database
    const bookId = createHash(normalizedUrl);
    const existingBook = books.find((book) => book.id === bookId);

    if (existingBook) {
      currentBook.value = existingBook;
      await loadBookFiles(bookId);
      isLoading.value = false;
      return;
    }

    // Fetch the HTML content
    const response = await fetch("/api/proxy-html", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: bookUrl.value }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch book data: ${response.statusText}`);
    }

    const html = await response.text();

    // Create a DOM parser to parse the HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Extract the book title
    const bookTitleElement = doc.querySelector(".book_title");
    let bookTitle = bookTitleElement
      ? bookTitleElement.textContent?.trim()
      : "Unknown Book";

    // Decode HTML entities in the title
    bookTitle = decodeHtmlEntities(bookTitle || "Unknown Book");

    // Find the BookPlayer initialization data
    const scripts = doc.querySelectorAll("script");
    let bookPlayerData = null;

    for (const script of scripts) {
      const content = script.textContent || "";

      // Try to find BookPlayer initialization
      if (content.includes("BookPlayer")) {
        console.log("Found script with BookPlayer");

        // First pattern: new BookPlayer(bookId, [...playlist items...], options)
        const playerMatch = content.match(
          /var\s+player\s*=\s*new\s+BookPlayer\s*\(\s*\d+\s*,\s*(\[[\s\S]*?\])\s*[\s\S]*?\)/,
        );

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
            break;
          } catch (e) {
            console.error("Failed to parse BookPlayer data with first pattern:", e);
          }
        }
      }
    }

    if (bookPlayerData && bookPlayerData.playlist) {
      // Use the extracted BookPlayer data
      bookPlayerData.playlist.forEach((track: any) => {
        if (track.url) {
          // Clean up the URL by removing escaped backslashes
          const cleanUrl = track.url.replace(/\\/g, "");

          const urlParts = cleanUrl.split("/");
          const fileName = urlParts[urlParts.length - 1];

          // Extract track title from URL if not provided
          const title =
            track.title ||
            (() => {
              // Try to extract title from filename
              const fileNameMatch = fileName.match(/([^\/]+)\.mp3$/);
              return fileNameMatch
                ? fileNameMatch[1].replace(/-/g, " ")
                : `Track ${audioFiles.length + 1}`;
            })();

          // Convert duration from seconds to MM:SS format if available as a number
          let formattedDuration = "";
          let durationSeconds = 0;

          if (track.duration) {
            if (typeof track.duration === "number") {
              durationSeconds = track.duration;
              formattedDuration = formatDuration(durationSeconds);
            } else {
              formattedDuration = track.duration.toString();
              durationSeconds = durationToSeconds(formattedDuration);
            }
          }

          /*
          interface AudioFile {
            id: string; // Unique identifier
            url: string;
            title: string;
            duration: string;
            durationSeconds?: number;
            downloaded: boolean;
            blob?: Blob;
          }
          */
          audioFiles.push({
            id: cleanUrl,
            url: cleanUrl,
            title: title,
            duration: formattedDuration,
            durationSeconds: durationSeconds,
            downloaded: false,
          });
        }
      });
    }

    console.log("Extracted audio files:", audioFiles);

    // Sort the audio files by track number if possible
    audioFiles.sort((a, b) => {
      const numA = parseInt(a.title.match(/\d+/)?.[0] || "0");
      const numB = parseInt(b.title.match(/\d+/)?.[0] || "0");
      if (numA && numB) {
        return numA - numB;
      }
      return a.title.localeCompare(b.title);
    });

    // Calculate total duration
    let totalDuration = 0;
    audioFiles.forEach((file) => {
      if (file.durationSeconds) {
        totalDuration += file.durationSeconds;
      }
    });

    // Create new book object
    const newBook: Book = {
      id: createHash(bookUrl.value),
      url: bookUrl.value,
      title: bookTitle,
      files: [],
      totalDuration,
      downloadedCount: 0,
      totalFiles: audioFiles.length,
      lastAccessTime: Date.now(),
    };

    // Prepare files for storage with added IDs and downloaded status
    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];
      file.id = `${newBook.id}-${i}`;
      file.downloaded = false;

      // Store in book's files array
      newBook.files.push(file);

      // Save each file to IndexedDB
      await saveFile(file, newBook.id);
    }

    // Save the book to IndexedDB
    await saveBook(newBook);

    // Set as current book
    currentBook.value = newBook;
  } catch (error) {
    console.error("Error fetching book data:", error);
    errorMessage.value =
      error instanceof Error ? error.message : "An unknown error occurred";
  } finally {
    isLoading.value = false;
  }
}

// Normalize URL to prevent duplicates
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Keep only hostname and pathname
    const normalized = `https://${urlObj.hostname}${urlObj.pathname}`;
    // Ensure pathname ends with trailing slash
    return normalized.endsWith("/") ? normalized : `${normalized}/`;
  } catch (e) {
    return url;
  }
}

function validateUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return (
      urlObj.hostname.includes("knigavuhe.org") && urlObj.pathname.includes("/book/")
    );
  } catch (e) {
    return false;
  }
}

// Audio player controls
async function playAudio() {
  if (!audioPlayer.value || !currentFile.value) return;

  // If the file is downloaded, use the blob from IndexedDB
  if (currentFile.value.downloaded) {
    if (!currentFile.value.blob) {
      try {
        // Load the blob from IndexedDB if not already loaded
        const transaction = db?.transaction(FILES_STORE, "readonly");
        const store = transaction?.objectStore(FILES_STORE);
        const request = store?.get(currentFile.value.id);
        console.log(store);
        console.log(request);

        if (request) {
          await new Promise<void>((resolve, reject) => {
            if (!request) {
              reject("Failed to get file from IndexedDB");
              return;
            }

            request.onsuccess = () => {
              if (request.result && request.result.blob) {
                currentFile.value!.blob = request.result.blob;
                resolve();
              } else {
                reject("No blob found in file data");
              }
            };

            request.onerror = () => {
              reject("Error getting file from IndexedDB");
            };
          });
        }
      } catch (error) {
        console.error("Error loading blob from IndexedDB:", error);
      }
    }

    // Create object URL from blob
    if (currentFile.value.blob) {
      // Revoke any previous object URL to avoid memory leaks
      if (audioPlayer.value.src.startsWith("blob:")) {
        URL.revokeObjectURL(audioPlayer.value.src);
      }
      const objectUrl = URL.createObjectURL(currentFile.value.blob);
      audioPlayer.value.src = objectUrl;
    } else {
      // Fallback to URL
      audioPlayer.value.src = currentFile.value.url;
    }
  } else {
    // Use URL for streaming
    audioPlayer.value.src = currentFile.value.url;
  }

  // If there's a lastPlayedTime and we're at the beginning of the file
  if (
    currentBook.value?.lastPlayedTime &&
    currentBook.value?.lastPlayedFile === currentFile.value.id &&
    audioPlayer.value.currentTime < 1
  ) {
    // Seek to the saved position minus 10 seconds (for context)
    const seekTime = Math.max(0, currentBook.value.lastPlayedTime - 10);
    audioPlayer.value.currentTime = seekTime;
  }

  try {
    await audioPlayer.value.play();
    isPlaying.value = true;
  } catch (error) {
    console.error("Error playing audio:", error);
    errorMessage.value = "Failed to play audio. Please try again.";
  }
}

function pauseAudio() {
  if (!audioPlayer.value) return;
  audioPlayer.value.pause();
  isPlaying.value = false;

  // Save the current position
  savePlaybackPosition();
}

function playPrevious() {
  if (!currentBook.value || !audioPlayer.value) return;

  // Clean up any existing object URL
  if (audioPlayer.value.src.startsWith("blob:")) {
    URL.revokeObjectURL(audioPlayer.value.src);
  }

  if (currentFileIndex.value > 0) {
    currentFileIndex.value--;
    playAudio();
  }
}

function playNext() {
  if (!currentBook.value || !audioPlayer.value) return;

  // Clean up any existing object URL
  if (audioPlayer.value.src.startsWith("blob:")) {
    URL.revokeObjectURL(audioPlayer.value.src);
  }

  if (currentFileIndex.value < currentBook.value.files.length - 1) {
    currentFileIndex.value++;
    playAudio();
  }
}

function updateProgress() {
  if (!audioPlayer.value) return;

  currentTime.value = audioPlayer.value.currentTime;
  duration.value = audioPlayer.value.duration;
  progress.value = (currentTime.value / duration.value) * 100 || 0;
}

function seek(event: MouseEvent) {
  if (!audioPlayer.value) return;

  const progressBar = event.currentTarget as HTMLElement;
  const rect = progressBar.getBoundingClientRect();
  const percent = (event.clientX - rect.left) / rect.width;

  audioPlayer.value.currentTime = percent * audioPlayer.value.duration;
  updateProgress();
}

function setVolume(value: number) {
  if (!audioPlayer.value) return;

  volume.value = value;
  audioPlayer.value.volume = value;
  localStorage.setItem("playerVolume", value.toString());
}

function savePlaybackPosition() {
  if (!currentBook.value || !audioPlayer.value || !currentFile.value) return;

  // Only save if we've played at least 5 seconds
  if (audioPlayer.value.currentTime > 5) {
    currentBook.value.lastPlayedFile = currentFile.value.id;
    currentBook.value.lastPlayedTime = audioPlayer.value.currentTime;

    // Save to IndexedDB
    saveBook(currentBook.value);
  }
}

// Initialize audio player when component mounts
onMounted(async () => {
  try {
    // Initialize IndexedDB
    await initDB();
    await loadBooks();

    // Set up audio player
    audioPlayer.value = new Audio();

    // Restore volume setting
    const savedVolume = localStorage.getItem("playerVolume");
    if (savedVolume) {
      volume.value = parseFloat(savedVolume);
      audioPlayer.value.volume = volume.value;
    }

    // Add event listeners
    audioPlayer.value.addEventListener("timeupdate", updateProgress);
    audioPlayer.value.addEventListener("ended", playNext);
    audioPlayer.value.addEventListener("error", (e) => {
      console.error("Audio player error:", e);
      // Try to recover by playing the next track
      if (currentFileIndex.value < audioFiles.length - 1) {
        setTimeout(playNext, 1000);
      }
    });

    // Save position periodically (every 3 seconds)
    setInterval(savePlaybackPosition, 3000);

    // Clean up object URLs before unloading the page
    window.addEventListener("beforeunload", () => {
      if (audioPlayer.value?.src.startsWith("blob:")) {
        URL.revokeObjectURL(audioPlayer.value.src);
      }
    });
  } catch (error) {
    console.error("Failed to initialize:", error);
    errorMessage.value =
      "Failed to initialize the application. Please refresh the page.";
  }
});
</script>

<template>
  <div class="book-fetcher">
    <h1>KVU Offline</h1>
    <p class="description">
      Enter a book URL from knigavuhe.org to download for offline listening
    </p>

    <div class="input-form">
      <input
        type="text"
        v-model="bookUrl"
        placeholder="https://knigavuhe.org/book/example-book/"
        class="url-input"
        :disabled="isLoading"
      />
      <button
        @click="fetchBookData"
        class="download-button"
        :disabled="isLoading || !bookUrl"
      >
        <span v-if="isLoading" class="loading-spinner"></span>
        {{ isLoading ? "Loading..." : "Search" }}
      </button>
    </div>

    <div v-if="books.length > 0" class="book-switcher">
      <button @click="showBooksList = !showBooksList" class="library-button">
        <span class="icon">📚</span> Your Library ({{ books.length }})
      </button>

      <div v-if="showBooksList" class="books-list">
        <div class="books-list-header">
          <h3>Your Books</h3>
          <button @click="showBooksList = false" class="close-button">×</button>
        </div>
        <div class="books-list-content">
          <div
            v-for="book in books"
            :key="book.id"
            @click="
              switchBook(book.id);
              showBooksList = false;
            "
            class="book-item"
            :class="{ active: currentBook && currentBook.id === book.id }"
          >
            <div class="book-item-title">{{ book.title }}</div>
            <div class="book-item-info">
              <span>{{ book.totalFiles }} tracks</span>
              <span class="bullet">•</span>
              <span>{{ formatDuration(book.totalDuration) }}</span>
              <span class="bullet">•</span>
              <span>{{ book.downloadedCount }}/{{ book.totalFiles }} downloaded</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <div v-if="currentBook && audioFiles.length > 0" class="results">
      <div class="book-info-header">
        <h2>{{ currentBook.title }}</h2>
        <div class="book-stats">
          <span>{{ audioFiles.length }} tracks</span>
          <span class="bullet">•</span>
          <span>Total duration: {{ formatDuration(currentBook.totalDuration) }}</span>
          <span class="bullet">•</span>
          <span
            >Downloaded: {{ currentBook.downloadedCount }}/{{
              currentBook.totalFiles
            }}</span
          >
        </div>
      </div>

      <!-- Unified Audio Player -->
      <div class="audio-player-wrapper">
        <div class="player-info">
          <div v-if="currentFile" class="now-playing">
            Now Playing: {{ currentFileIndex + 1 }}. {{ currentFile.title }}
          </div>
          <div v-else class="now-playing">Select a file to play</div>
        </div>

        <div class="player-controls">
          <button
            @click="playPrevious"
            class="control-button"
            :disabled="!currentFile || currentFileIndex === 0"
          >
            ⏮️
          </button>
          <button
            v-if="!isPlaying"
            @click="playAudio"
            class="control-button play-button"
            :disabled="!currentFile"
          >
            ▶️
          </button>
          <button v-else @click="pauseAudio" class="control-button pause-button">
            ⏸️
          </button>
          <button
            @click="playNext"
            class="control-button"
            :disabled="!currentFile || currentFileIndex >= audioFiles.length - 1"
          >
            ⏭️
          </button>
        </div>

        <div class="progress-container" @click="seek">
          <div class="progress-bar" :style="{ width: `${progress}%` }"></div>
        </div>

        <div class="time-display">
          <span>{{ formatDuration(currentTime) }}</span>
          <span> / </span>
          <span>{{ formatDuration(duration) }}</span>
        </div>

        <div class="volume-control">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            v-model="volume"
            @input="setVolume(parseFloat($event.target.value))"
          />
        </div>
      </div>

      <div class="download-container">
        <button
          @click="downloadBook"
          class="download-button"
          :disabled="currentBook.downloadedCount === currentBook.totalFiles"
        >
          <span class="download-icon">⬇️</span>
          {{
            currentBook.downloadedCount === currentBook.totalFiles
              ? "Downloaded"
              : "Download Book"
          }}
        </button>
      </div>

      <table class="audio-files-table">
        <thead>
          <tr>
            <th width="5%">#</th>
            <th width="60%">Title</th>
            <th width="15%">Duration</th>
            <th width="20%">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(file, index) in audioFiles"
            :key="file.id"
            @click="
              currentFileIndex = index;
              playAudio();
            "
            :class="{
              playing: currentFileIndex === index,
              downloaded: file.downloaded,
            }"
          >
            <td>{{ index + 1 }}</td>
            <td class="file-title">{{ file.title }}</td>
            <td>{{ file.duration }}</td>
            <td class="status">
              <span v-if="file.downloaded" class="status-downloaded">
                <span class="icon">✅</span> Downloaded
              </span>
              <span v-else class="status-pending">
                <span class="icon">⏳</span> Pending
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.book-fetcher {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  text-align: center;
  color: #2c3e50;
  margin-bottom: 10px;
}

.description {
  text-align: center;
  color: #666;
  margin-bottom: 30px;
}

.input-form {
  display: flex;
  margin-bottom: 20px;
  position: relative;
}

.url-input {
  flex: 1;
  padding: 12px 15px;
  border: 1px solid #ddd;
  border-radius: 4px 0 0 4px;
  font-size: 16px;
  transition: border-color 0.3s;
}

.url-input:focus {
  outline: none;
  border-color: #4caf50;
}

.download-button {
  padding: 12px 20px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 0 4px 4px 0;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  transition: background-color 0.3s;
  position: relative;
}

.loading-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 1s ease-in-out infinite;
  margin-right: 8px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.download-button:hover {
  background-color: #45a049;
}

.download-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.error-message {
  color: #d9534f;
  background-color: #f9f2f2;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.results {
  margin-top: 30px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 20px;
}

.book-info-header {
  border-bottom: 1px solid #eee;
  padding-bottom: 15px;
  margin-bottom: 20px;
}

.book-info-header h2 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #2c3e50;
}

.book-stats {
  color: #666;
  margin-bottom: 15px;
}

.bullet {
  margin: 0 8px;
}

.audio-files-table {
  width: 100%;
  border-collapse: collapse;
}

.audio-files-table th,
.audio-files-table td {
  border-bottom: 1px solid #eee;
  padding: 12px 8px;
  text-align: left;
}

.audio-files-table th {
  background-color: #f5f5f5;
  font-weight: bold;
  color: #555;
}

.audio-files-table tr:hover {
  background-color: #f9f9f9;
}

.file-title {
  font-weight: 500;
}

.action-link {
  background-color: #3498db;
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  text-decoration: none;
  margin-right: 6px;
  display: inline-flex;
  align-items: center;
  transition: background-color 0.2s;
}

.icon {
  margin-right: 5px;
}

.action-link:hover {
  background-color: #2980b9;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.download-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.audio-player-wrapper {
  background-color: #f8f8f8;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.player-info {
  margin-bottom: 15px;
}

.now-playing {
  font-weight: bold;
  color: #2c3e50;
}

.player-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 15px;
  gap: 20px;
}

.control-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  opacity: 0.8;
  transition: all 0.2s;
}

.control-button:hover {
  opacity: 1;
  transform: scale(1.1);
}

.control-button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.play-button,
.pause-button {
  font-size: 32px;
}

.progress-container {
  height: 8px;
  background-color: #e1e1e1;
  border-radius: 4px;
  margin-bottom: 10px;
  cursor: pointer;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background-color: #4caf50;
  border-radius: 4px;
  transition: width 0.1s linear;
}

.time-display {
  display: flex;
  justify-content: space-between;
  color: #666;
  font-size: 14px;
  margin-bottom: 15px;
}

.volume-control {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.volume-control input[type="range"] {
  width: 120px;
}

.download-container {
  margin-bottom: 15px;
  text-align: right;
}

.download-button {
  padding: 10px 15px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  display: inline-flex;
  align-items: center;
  transition: background-color 0.2s;
}

.download-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.download-icon {
  margin-right: 8px;
}

.download-button:not(:disabled):hover {
  background-color: #45a049;
}

.download-progress-container {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background-color: white;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  padding: 15px;
  border-radius: 8px;
  width: 300px;
  z-index: 1000;
}

.download-progress-text {
  margin-bottom: 8px;
  font-weight: bold;
}

.download-progress-bar-bg {
  height: 10px;
  background-color: #eee;
  border-radius: 5px;
  overflow: hidden;
}

.download-progress-bar {
  height: 100%;
  background-color: #4caf50;
  transition: width 0.3s;
}

@media (max-width: 768px) {
  .input-form {
    flex-direction: column;
  }

  .url-input,
  .download-button {
    width: 100%;
    border-radius: 4px;
  }

  .url-input {
    margin-bottom: 10px;
  }

  .now-playing {
    font-size: 14px;
  }

  .control-button {
    font-size: 20px;
  }

  .play-button,
  .pause-button {
    font-size: 28px;
  }

  .audio-files-table th,
  .audio-files-table td {
    padding: 8px;
    font-size: 14px;
  }

  .audio-files-table {
    display: block;
    overflow-x: auto;
  }

  .download-container {
    text-align: center;
  }

  .download-button {
    width: 100%;
  }

  .volume-control {
    justify-content: center;
    margin-top: 10px;
  }

  .volume-control input[type="range"] {
    width: 80%;
  }

  .book-info-header {
    text-align: center;
  }
}
/* Table styles */
.playing {
  background-color: rgba(76, 175, 80, 0.1) !important;
}

.downloaded {
  position: relative;
}

/* We're using status indicators instead of this decoration */

.status {
  text-align: center;
}

.status-downloaded {
  color: #4caf50;
  font-weight: bold;
}

.status-pending {
  color: #999;
}

/* Book switcher styles */
.book-switcher {
  margin: 15px 0;
  position: relative;
}

.library-button {
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 10px 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  font-weight: bold;
}

.library-button:hover {
  background-color: #2980b9;
}

.library-button .icon {
  margin-right: 8px;
}

.books-list {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  background-color: white;
  border-radius: 4px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  margin-top: 5px;
}

.books-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border-bottom: 1px solid #eee;
}

.books-list-header h3 {
  margin: 0;
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
}

.close-button:hover {
  color: #333;
}

.books-list-content {
  max-height: 300px;
  overflow-y: auto;
}

.book-item {
  padding: 15px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: background-color 0.2s;
}

.book-item:hover {
  background-color: #f9f9f9;
}

.book-item.active {
  background-color: rgba(76, 175, 80, 0.1);
}

.book-item-title {
  font-weight: bold;
  margin-bottom: 5px;
  color: #2c3e50;
}

.book-item-info {
  font-size: 12px;
  color: #666;
}
</style>
