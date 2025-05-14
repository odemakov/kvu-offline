import { ref, onMounted, onUnmounted } from 'vue';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed', platform: string }>;
}

export function useInstallPWA() {
  const isInstallable = ref(false);
  const isInstalled = ref(false);
  const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null);

  const installApp = async () => {
    if (!deferredPrompt.value) {
      return false;
    }

    // Show the install prompt
    deferredPrompt.value.prompt();

    // Wait for the user to respond to the prompt
    const choiceResult = await deferredPrompt.value.userChoice;
    
    // Reset the deferred prompt variable
    deferredPrompt.value = null;
    isInstallable.value = false;
    
    // Check if the user accepted the prompt
    return choiceResult.outcome === 'accepted';
  };

  // Event handlers
  const handleBeforeInstallPrompt = (e: Event) => {
    // Prevent the default behavior
    e.preventDefault();
    
    // Store the event
    deferredPrompt.value = e as BeforeInstallPromptEvent;
    
    // Update UI to indicate the app can be installed
    isInstallable.value = true;
  };

  const handleAppInstalled = () => {
    // App is installed
    isInstalled.value = true;
    isInstallable.value = false;
    
    // Clear the deferred prompt
    deferredPrompt.value = null;
  };

  onMounted(() => {
    // Check if the app is running in standalone mode (already installed)
    isInstalled.value = window.matchMedia('(display-mode: standalone)').matches || 
                         (navigator as any).standalone === true;

    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // Listen for the appinstalled event
    window.addEventListener('appinstalled', handleAppInstalled);
  });

  onUnmounted(() => {
    // Remove event listeners
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.removeEventListener('appinstalled', handleAppInstalled);
  });

  return {
    isInstallable,
    isInstalled,
    installApp
  };
}