import { defineBackground } from 'wxt/sandbox';

export default defineBackground(() => {
  console.log('Background script loaded and initialized');

  let currentUrl: string = '';

  // Function to update current URL
  const updateCurrentUrl = async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('Active tabs:', tabs);
      const currentTab = tabs[0];
      if (currentTab?.url) {
        currentUrl = currentTab.url;
        // Store in local storage for persistence
        await chrome.storage.local.set({ currentUrl });
        console.log('Updated current URL in background:', currentUrl);
      } else {
        console.log('No URL found in current tab:', currentTab);
      }
    } catch (error) {
      console.error('Error updating current URL:', error);
    }
  };

  // Initialize state from storage
  chrome.storage.local.get(['activeTask', 'elapsedTime', 'currentUrl']).then(result => {
    console.log('Initializing background state from storage:', result);
    if (result.activeTask) {
      console.log('Restoring active task:', result.activeTask);
    }
    if (result.currentUrl) {
      currentUrl = result.currentUrl;
      console.log('Restored current URL from storage:', currentUrl);
    }
  });

  // Listen for tab changes
  chrome.tabs.onActivated.addListener((activeInfo) => {
    console.log('Tab activated:', activeInfo);
    updateCurrentUrl();
  });
  
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    console.log('Tab updated:', { tabId, changeInfo, tab });
    if (changeInfo.url) {
      updateCurrentUrl();
    }
  });

  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request);
    
    // Handle getCurrentUrl request
    if (request.type === 'getCurrentUrl') {
      console.log('Sending current URL to popup:', currentUrl);
      sendResponse({ currentUrl });
    } else {
      sendResponse({ received: true });
    }
    
    return true; // Required for async response
  });

  // Initial URL check
  console.log('Performing initial URL check');
  updateCurrentUrl();
}); 