<script setup lang="ts">
import { ref, reactive } from "vue";

interface AudioFile {
  url: string;
  title: string;
  duration: string;
  bookTitle: string;
  fileName?: string;
  durationSeconds?: number;
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

const bookUrl = ref("https://m.knigavuhe.org/book/znaki-1/");
const isLoading = ref(false);
const errorMessage = ref("");
const audioFiles = reactive<AudioFile[]>([]);

function downloadAll() {
  if (!audioFiles.length) return;

  const totalFiles = audioFiles.length;
  let downloadedCount = 0;

  // Create a progress element
  const progressContainer = document.createElement("div");
  progressContainer.className = "download-progress-container";
  progressContainer.innerHTML = `
    <div class="download-progress-text">Downloading 0/${totalFiles} files...</div>
    <div class="download-progress-bar-bg">
      <div class="download-progress-bar" style="width: 0%"></div>
    </div>
  `;
  document.body.appendChild(progressContainer);

  // Create a delay between downloads to prevent browser throttling
  audioFiles.forEach((file, index) => {
    setTimeout(() => {
      const link = document.createElement("a");
      link.href = file.url;
      link.download = `${index + 1}. ${file.bookTitle} - ${file.title}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Update progress
      downloadedCount++;
      const progressBar = progressContainer.querySelector(".download-progress-bar");
      const progressText = progressContainer.querySelector(".download-progress-text");
      if (progressBar && progressText) {
        const percent = (downloadedCount / totalFiles) * 100;
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `Downloading ${downloadedCount}/${totalFiles} files...`;

        // Remove progress bar when done
        if (downloadedCount >= totalFiles) {
          setTimeout(() => {
            document.body.removeChild(progressContainer);
          }, 2000);
        }
      }
    }, index * 1000); // 1 second delay between downloads
  });
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

    // Fetch the HTML content
    const response = await fetch("/api/proxy", {
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

          audioFiles.push({
            url: cleanUrl,
            title: title,
            duration: formattedDuration,
            durationSeconds,
            bookTitle,
            fileName,
          });
        }
      });
    }

    if (audioFiles.length === 0) {
      // Try fallback method: search for all MP3 links in the document
      const allLinks = doc.querySelectorAll('a[href*=".mp3"]');
      if (allLinks.length > 0) {
        console.log("Using fallback method to find MP3 links");
        Array.from(allLinks).forEach((link: HTMLAnchorElement, index) => {
          const url = link.href;
          const fileName = url.split("/").pop() || "";
          const title = link.textContent?.trim() || fileName || `Track ${index + 1}`;

          audioFiles.push({
            url,
            title,
            duration: "",
            bookTitle,
            fileName,
          });
        });
      }

      if (audioFiles.length === 0) {
        throw new Error(
          "Failed to extract audio files information. The book page format may have changed or no files are available.",
        );
      }
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
  } catch (error) {
    console.error("Error fetching book data:", error);
    errorMessage.value =
      error instanceof Error ? error.message : "An unknown error occurred";
  } finally {
    isLoading.value = false;
  }
}

// Calculate total duration for all files
function calculateTotalDuration(): string {
  const totalSeconds = audioFiles.reduce((sum, file) => {
    const seconds = file.durationSeconds || durationToSeconds(file.duration);
    return sum + seconds;
  }, 0);

  return formatDuration(totalSeconds);
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

    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <div v-if="audioFiles.length > 0" class="results">
      <div class="book-info-header">
        <h2>{{ audioFiles[0].bookTitle }}</h2>
        <div class="book-stats">
          <span>{{ audioFiles.length }} tracks</span>
          <span class="bullet">•</span>
          <span>Total duration: {{ calculateTotalDuration() }}</span>
        </div>
      </div>

      <div class="download-all-container">
        <button @click="downloadAll" class="download-all-button">
          <span class="download-icon">⬇️</span> Download Book
        </button>
      </div>

      <table class="audio-files-table">
        <thead>
          <tr>
            <th width="5%">#</th>
            <th width="45%">Title</th>
            <th width="15%">Duration</th>
            <th width="35%">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(file, index) in audioFiles" :key="index">
            <td>{{ index + 1 }}</td>
            <td class="file-title">{{ file.title }}</td>
            <td>{{ file.duration }}</td>
            <td class="action-buttons">
              <div class="audio-player-container">
                <audio controls class="audio-player">
                  <source :src="file.url" type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
              </div>
              <div class="download-buttons">
                <a
                  :href="file.url"
                  download
                  :download="`${index + 1}. ${file.bookTitle} - ${file.title}.mp3`"
                  class="action-link"
                  ><span class="icon">💾</span> Download</a
                >
              </div>
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

.audio-player-container {
  width: 100%;
}

.audio-player {
  width: 100%;
  height: 36px;
  border-radius: 18px;
}

.download-all-container {
  margin-bottom: 15px;
  text-align: right;
}

.download-all-button {
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

.download-icon {
  margin-right: 8px;
}

.download-all-button:hover {
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

  .action-link {
    display: block;
    text-align: center;
    margin-right: 0;
    margin-bottom: 5px;
  }

  .audio-player {
    max-width: 100%;
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

  .download-all-container {
    text-align: center;
  }

  .download-all-button {
    width: 100%;
  }

  .book-info-header {
    text-align: center;
  }
}
</style>
