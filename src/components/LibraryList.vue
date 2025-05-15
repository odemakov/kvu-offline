<template>
  <div class="library-container">
    <div class="books-list" v-if="showLibrary">
      <div class="books-list-header">
        <h3>Your Library</h3>
        <button @click="$emit('close')" class="close-button" aria-label="Close library">
          <span class="icon">✕</span>
        </button>
      </div>
      <div class="books-list-content">
        <div
          v-for="book in books"
          :key="book.id"
          class="book-item"
          :class="{ active: currentBookId === book.id }"
          @click="$emit('select-book', book.id)"
        >
          <div class="book-item-title">{{ book.title }}</div>
          <div class="book-item-info">
            {{ book.totalFiles }} files · {{ formatDuration(book.duration) }}
          </div>
        </div>
        <div v-if="books.length === 0" class="no-books">
          No books in your library yet.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Book } from "../types/AudioFile";

defineProps<{
  books: Book[];
  currentBookId: string | null;
  showLibrary: boolean;
}>();

defineEmits<{
  (e: "select-book", bookId: string): void;
  (e: "close"): void;
}>();

function formatDuration(seconds: number): string {
  if (!seconds) return "0:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes} min`;
  }
}
</script>

<style scoped>
.library-container {
  position: relative;
}

.books-list {
  position: absolute;
  top: 0;
  right: 0;
  width: 280px;
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  max-height: 500px;
  overflow-y: auto;
  z-index: 100;
  display: flex;
  flex-direction: column;
}

.books-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #eaeaea;
  background-color: #f9f9f9;
  border-radius: 8px 8px 0 0;
}

.books-list-header h3 {
  margin: 0;
  font-size: 1.1em;
}

.close-button {
  background: none;
  border: none;
  cursor: pointer;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover {
  color: #333;
}

.books-list-content {
  padding: 8px 0;
  overflow-y: auto;
}

.book-item {
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.book-item:hover {
  background-color: #f5f5f5;
}

.book-item.active {
  background-color: #e6f7ff;
}

.book-item-title {
  font-weight: 500;
  margin-bottom: 4px;
  font-size: 0.95em;
}

.book-item-info {
  font-size: 0.8em;
  color: #666;
}

.no-books {
  padding: 20px;
  text-align: center;
  color: #888;
  font-size: 0.9em;
}

@media (max-width: 768px) {
  .books-list {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    width: 100%;
    height: 100%;
    max-height: 100%;
    border-radius: 0;
  }

  .books-list-header {
    border-radius: 0;
  }
}
</style>
