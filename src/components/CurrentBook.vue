<template>
  <div class="current-book" v-if="book">
    <!-- Book Header -->
    <div class="book-info-header">
      <h2>{{ book.title }}</h2>
      <div class="book-stats">
        <span>{{ formatDuration(book.duration) }}</span>
        <span class="bullet">•</span>
        <span>{{ book.downloadedCount }}/{{ book.totalFiles }} files downloaded</span>
      </div>
    </div>

    <!-- Audio Files Table -->
    <table class="audio-files-table">
      <thead>
        <tr>
          <th>Chapter</th>
          <th>Duration</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(file, _) in files"
          :key="file.id"
          :class="{ playing: currentFileId === file.id }"
        >
          <td class="file-title">{{ file.title }}</td>
          <td>{{ formatDuration(file.duration) }}</td>
          <td>
            <span
              class="status"
              :class="file.downloaded ? 'status-downloaded' : 'status-pending'"
            >
              {{ file.downloaded ? "Downloaded" : "Not Downloaded" }}
            </span>
          </td>
          <td>
            <div class="action-buttons">
              <a
                href="#"
                class="action-link"
                @click.prevent="$emit('play-file', file.id)"
              >
                <span class="icon">▶</span> Play
              </a>
              <a
                href="#"
                class="action-link"
                @click.prevent="$emit('download-file', file.id)"
                v-if="!file.downloaded"
              >
                <span class="icon">↓</span> Download
              </a>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { type Book, type AudioFile } from "../types/AudioFile";
import { formatDuration } from "../utils/htmlUtils";

defineProps<{
  book: Book | null;
  files: AudioFile[];
  currentFileId: string | null;
}>();

defineEmits<{
  (e: "play-file", fileId: string): void;
  (e: "download-file", fileId: string): void;
}>();
</script>

<style scoped>
.current-book {
  margin-top: 20px;
  min-width: 700px;
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

.playing {
  background-color: #e6f7ff;
}

.status {
  font-size: 0.85em;
  padding: 2px 6px;
  border-radius: 4px;
}

.status-downloaded {
  background-color: #e6f7e6;
  color: #2e7d32;
}

.status-pending {
  color: #f57c00;
}

@media (max-width: 768px) {
  .audio-files-table th,
  .audio-files-table td {
    padding: 8px 5px;
    font-size: 0.8em;
  }

  .audio-files-table {
    font-size: 0.9em;
  }

  .book-info-header {
    margin-bottom: 10px;
  }

  .book-info-header h2 {
    font-size: 1.3em;
  }
}
</style>
