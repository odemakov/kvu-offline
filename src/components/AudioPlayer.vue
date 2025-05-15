<template>
  <div class="audio-player-wrapper" v-if="currentFile">
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
        {{ formatDuration(currentTime || 0) }} /
        {{ formatDuration(currentFile.duration) }}
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
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { type AudioFile, type Book } from "../types/AudioFile";
import { formatDuration } from "../utils/htmlUtils";

const props = defineProps<{
  currentFile: AudioFile | null;
  files: AudioFile[];
  currentFileIndex: number;
  currentBook: Book | null;
  isPlaying?: boolean;
}>();

const emit = defineEmits<{
  (e: "previous"): void;
  (e: "next"): void;
  (e: "update:currentTime", time: number): void;
  (e: "update:currentFileIndex", index: number): void;
  (e: "savePlaybackPosition"): void;
}>();

// Player state
const audioPlayer = ref<HTMLAudioElement | null>(null);
const isPlaying = ref(props.isPlaying || false);
const currentTime = ref(props.currentBook?.lastPlayedTime);
const volume = ref(0.75);
let lastUpdateProgressTime = 0;

// Computed properties
const progress = computed(() => {
  if (props.currentFile && currentTime && currentTime.value) {
    return props.currentFile.duration > 0
      ? (currentTime.value / props.currentFile.duration) * 100
      : 0;
  }
});

const hasNext = computed(() => {
  return props.currentFileIndex < props.files.length - 1;
});

const hasPrevious = computed(() => {
  return props.currentFileIndex > 0;
});

// Play the current audio file
async function playAudio() {
  if (!props.currentFile) return;

  // If there's no audio player element yet, create one
  if (!audioPlayer.value) {
    audioPlayer.value = new Audio();
    audioPlayer.value.volume = volume.value;

    // Set up event listeners
    audioPlayer.value.addEventListener("timeupdate", updateProgress);
    audioPlayer.value.addEventListener("ended", playNext);
    audioPlayer.value.addEventListener("error", (e) => {
      console.error("Audio playback error:", e);
      isPlaying.value = false;
    });
  }

  // Reset the player
  audioPlayer.value.pause();

  try {
    // Set up the audio source
    if (props.currentFile.downloaded && props.currentFile.blob) {
      // Use the downloaded blob
      audioPlayer.value.src = URL.createObjectURL(props.currentFile.blob);
    } else {
      // Stream from URL
      audioPlayer.value.src = props.currentFile.url;
    }

    // Set the current time if we have a saved position
    if (
      props.currentBook &&
      props.currentBook.lastPlayedFile === props.currentFile.id &&
      props.currentBook.lastPlayedTime !== undefined
    ) {
      currentTime.value = props.currentBook.lastPlayedTime;
      audioPlayer.value.currentTime = currentTime.value;
    } else {
      currentTime.value = 0;
    }

    // Play the audio
    await audioPlayer.value.play();
    isPlaying.value = true;

    // Update emit position
    emit("update:currentTime", currentTime.value);
    emit("savePlaybackPosition");
  } catch (error) {
    console.error("Error playing audio:", error);
    isPlaying.value = false;
  }
}

// Pause the current audio
function pauseAudio() {
  if (!audioPlayer.value) return;

  audioPlayer.value.pause();
  isPlaying.value = false;
}

// Play the previous file
function playPrevious() {
  if (props.currentFileIndex > 0) {
    emit("previous");

    // Reset player for the new file
    if (audioPlayer.value) {
      audioPlayer.value.pause();
      if (audioPlayer.value.src.startsWith("blob:")) {
        URL.revokeObjectURL(audioPlayer.value.src);
      }
      audioPlayer.value.src = "";
    }
  }
}

// Play the next file
function playNext() {
  if (props.currentFileIndex < props.files.length - 1) {
    emit("next");

    // Reset player for the new file
    if (audioPlayer.value) {
      audioPlayer.value.pause();
      if (audioPlayer.value.src.startsWith("blob:")) {
        URL.revokeObjectURL(audioPlayer.value.src);
      }
      audioPlayer.value.src = "";
    }
  } else {
    // End of playlist
    isPlaying.value = false;
  }
}

// Update progress based on audio player's current time
function updateProgress() {
  if (!audioPlayer.value) return;

  currentTime.value = audioPlayer.value.currentTime;
  emit("update:currentTime", currentTime.value);

  // Save position periodically (every 1 seconds)
  const now = Date.now();
  if (now - lastUpdateProgressTime >= 1000) {
    emit("savePlaybackPosition");
    lastUpdateProgressTime = now;
  }
}

// Seek to position in the audio
function seek(event: MouseEvent) {
  if (!audioPlayer.value || !props.currentFile) return;

  const progressContainer = event.currentTarget as HTMLElement;
  const { left, width } = progressContainer.getBoundingClientRect();
  const clickPosition = (event.clientX - left) / width;

  const newTime = clickPosition * props.currentFile.duration;
  audioPlayer.value.currentTime = newTime;
  currentTime.value = newTime;
  emit("update:currentTime", currentTime.value);
}

// Set the volume
function setVolume() {
  if (!audioPlayer.value) return;

  audioPlayer.value.volume = volume.value;
  localStorage.setItem("audioVolume", volume.value.toString());
}

// Use the imported formatDuration function

// Lifecycle hooks
onMounted(() => {
  // Load saved volume
  const savedVolume = localStorage.getItem("audioVolume");
  if (savedVolume) {
    volume.value = parseFloat(savedVolume);
  }

  // Initialize audio player
  if (props.currentFile) {
    //playAudio();
  }
});

onBeforeUnmount(() => {
  // Clean up
  if (audioPlayer.value) {
    audioPlayer.value.pause();
    audioPlayer.value.removeEventListener("timeupdate", updateProgress);
    audioPlayer.value.removeEventListener("ended", playNext);

    if (audioPlayer.value.src.startsWith("blob:")) {
      URL.revokeObjectURL(audioPlayer.value.src);
    }
  }

  // Save current position
  emit("savePlaybackPosition");
});

// Watch for changes to save data
watch(volume, () => {
  localStorage.setItem("audioVolume", volume.value.toString());
});

// Watch for external playing state changes
watch(
  () => props.isPlaying,
  (newValue) => {
    if (newValue !== undefined && newValue !== isPlaying.value) {
      if (newValue) {
        playAudio();
      } else {
        pauseAudio();
      }
    }
  },
);

watch(
  () => props.currentFile,
  () => {
    // Check if we should autoplay the new file
    if (isPlaying.value) {
      setTimeout(playAudio, 50);
    }
  },
);
</script>

<style scoped>
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

.icon {
  margin-right: 4px;
}

@media (max-width: 768px) {
  .player-controls {
    justify-content: center;
  }

  .progress-container {
    flex: 1;
    min-width: 100px;
  }

  .time-display {
    font-size: 0.7em;
  }

  .volume-control {
    width: 100%;
    margin-top: 10px;
    justify-content: center;
  }

  .volume-control input[type="range"] {
    width: 80%;
  }
}
</style>
