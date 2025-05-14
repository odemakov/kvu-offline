<script setup lang="ts">
import { ref } from 'vue';
import BookFetcher from './components/BookFetcher.vue'
import { useInstallPWA } from './composables/useInstallPWA';

const { isInstallable, isInstalled, installApp } = useInstallPWA();
const installBannerVisible = ref(true);

function hideInstallBanner() {
  installBannerVisible.value = false;
}
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1>KVU Offline</h1>
      <p>Your offline audiobook companion</p>
    </header>
    
    <div v-if="isInstallable && installBannerVisible" class="install-banner">
      <div class="install-banner-content">
        <p>Install this app on your device for offline use</p>
        <div class="install-actions">
          <button @click="installApp" class="install-button">Install</button>
          <button @click="hideInstallBanner" class="dismiss-button">Not now</button>
        </div>
      </div>
    </div>
    
    <main class="app-main">
      <BookFetcher />
    </main>
    <footer class="app-footer">
      <p>&copy; 2023 KVU Offline - An open-source PWA for offline audiobook listening</p>
    </footer>
  </div>
</template>

<style>
:root {
  --primary-color: #4CAF50;
  --primary-hover: #45a049;
  --text-color: #2c3e50;
  --bg-color: #f5f5f5;
  --card-bg: #ffffff;
  --border-color: #ddd;
  --secondary-color: #3498db;
  --secondary-hover: #2980b9;
  --danger-color: #e74c3c;
  --danger-hover: #c0392b;
}

body {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  margin: 0;
  padding: 0;
  background-color: var(--bg-color);
  color: var(--text-color);
  line-height: 1.6;
}

.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  background-color: var(--primary-color);
  color: white;
  text-align: center;
  padding: 1.5rem 1rem;
}

.app-header h1 {
  margin: 0;
  font-size: 2rem;
}

.app-header p {
  margin-top: 0.5rem;
  font-size: 1rem;
  opacity: 0.9;
}

.app-main {
  flex: 1;
  padding: 2rem 1rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.app-footer {
  background-color: var(--text-color);
  color: white;
  text-align: center;
  padding: 1rem;
  font-size: 0.9rem;
}

.install-banner {
  position: relative;
  background-color: var(--card-bg);
  border-bottom: 1px solid var(--border-color);
  padding: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.install-banner-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1200px;
  margin: 0 auto;
}

.install-actions {
  display: flex;
  gap: 10px;
}

.install-button {
  padding: 8px 16px;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.install-button:hover {
  background-color: var(--primary-hover);
}

.dismiss-button {
  padding: 8px 16px;
  background-color: transparent;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
}

.dismiss-button:hover {
  background-color: #f5f5f5;
}

@media (max-width: 768px) {
  .app-main {
    padding: 1rem 0.5rem;
  }
  
  .install-banner-content {
    flex-direction: column;
    gap: 10px;
  }
  
  .install-banner-content p {
    margin: 0;
  }
}
</style>
