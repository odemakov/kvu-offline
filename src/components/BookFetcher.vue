<script setup lang="ts">
import { ref, reactive } from 'vue';

interface AudioFile {
  url: string;
  backupUrl: string;
  title: string;
  duration: string;
  bookTitle: string;
}

const bookUrl = ref('');
const isLoading = ref(false);
const errorMessage = ref('');
const audioFiles = reactive<AudioFile[]>([]);

async function fetchBookData() {
  isLoading.value = true;
  audioFiles.length = 0;
  errorMessage.value = '';

  try {
    if (!bookUrl.value) {
      throw new Error('Please enter a URL');
    }

    if (!validateUrl(bookUrl.value)) {
      throw new Error('Please enter a valid book URL from knigavuhe.org (e.g., https://knigavuhe.org/book/example/)');
    }

    // Fetch the HTML content
    const response = await fetch('/api/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: bookUrl.value }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch book data: ${response.statusText}`);
    }

    const html = await response.text();

    // Create a DOM parser to parse the HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Find all playlist items
    const playlistItems = doc.querySelectorAll('.book_player_playlist_item');
    
    if (playlistItems.length === 0) {
      throw new Error('No audio files found on the page');
    }

    // Extract the book title
    const bookTitleElement = doc.querySelector('.book_title');
    const bookTitle = bookTitleElement ? bookTitleElement.textContent?.trim() : 'Unknown Book';

    // Extract audio information from each playlist item
    playlistItems.forEach((item) => {
      const titleElement = item.querySelector('.book_player_playlist_item_name');
      const durationElement = item.querySelector('.book_player_playlist_item_time');
      
      if (titleElement && durationElement) {
        const title = titleElement.textContent?.trim() || '';
        const duration = durationElement.textContent?.trim() || '';
        
        // Extract the id from the playlist item
        const itemIdMatch = item.id?.match(/book_player(?:_mobile)?_playlist_item(\d+)/);
        const itemId = itemIdMatch ? itemIdMatch[1] : '';
        
        // Construct the audio URL based on the book URL and item ID
        const bookUrlObj = new URL(bookUrl.value);
        const pathSegments = bookUrlObj.pathname.split('/').filter(Boolean);
        const bookId = pathSegments.length > 1 ? pathSegments[1] : '';
        // Try different server URLs - the site uses multiple CDN servers
        const audioUrl = `https://s2.knigavuhe.org/2/${bookId}/${itemId}.mp3`;
        const backupUrl = `https://s4.knigavuhe.org/4/${bookId}/${itemId}.mp3`;
        
        audioFiles.push({
          url: audioUrl,
          backupUrl,
          title: `${bookTitle} - ${title}`,
          duration,
          bookTitle
        });
      }
    });

    if (audioFiles.length === 0) {
      throw new Error('Failed to extract audio files information');
    }

  } catch (error) {
    console.error('Error fetching book data:', error);
    errorMessage.value = error instanceof Error ? error.message : 'An unknown error occurred';
  } finally {
    isLoading.value = false;
  }
}

function validateUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('knigavuhe.org') && urlObj.pathname.includes('/book/');
  } catch (e) {
    return false;
  }
}
</script>

<template>
  <div class="book-fetcher">
    <h1>KVU Offline</h1>
    <p class="description">Enter a book URL from knigavuhe.org to download for offline listening</p>
    
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
        {{ isLoading ? 'Loading...' : 'Download' }}
      </button>
    </div>
    
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>
    
    <div v-if="audioFiles.length > 0" class="results">
      <h2>Available Audio Files</h2>
      <table class="audio-files-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Duration</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
                  <tr v-for="(file, index) in audioFiles" :key="index">
                    <td>{{ file.title }}</td>
                    <td>{{ file.duration }}</td>
                    <td class="action-buttons">
                      <a :href="file.url" target="_blank" class="action-link">Listen</a>
                      <a :href="file.url" download :download="`${file.bookTitle} - ${file.title}.mp3`" class="action-link">Download</a>
                      <a :href="file.backupUrl" download :download="`${file.bookTitle} - ${file.title}.mp3`" class="action-link backup-link">Backup</a>
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
  max-width: 800px;
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
}

.url-input {
  flex: 1;
  padding: 12px 15px;
  border: 1px solid #ddd;
  border-radius: 4px 0 0 4px;
  font-size: 16px;
}

.download-button {
  padding: 12px 20px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 0 4px 4px 0;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
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
}

.results {
  margin-top: 30px;
}

.audio-files-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 15px;
}

.audio-files-table th,
.audio-files-table td {
  border: 1px solid #ddd;
  padding: 12px;
  text-align: left;
}

.audio-files-table th {
  background-color: #f5f5f5;
  font-weight: bold;
}

.audio-files-table tr:nth-child(even) {
  background-color: #f9f9f9;
}

.action-link {
  background-color: #3498db;
  color: white;
  padding: 5px 10px;
  border-radius: 4px;
  text-decoration: none;
  margin-right: 10px;
  display: inline-block;
}

.action-link:hover {
  background-color: #2980b9;
}

.backup-link {
  background-color: #95a5a6;
}

.backup-link:hover {
  background-color: #7f8c8d;
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
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
    margin-bottom: 5px;
    text-align: center;
  }
}
</style>