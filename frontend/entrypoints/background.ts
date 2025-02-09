import { defineBackground } from 'wxt/sandbox';

export default defineBackground(() => {
  console.log('Background script loaded and initialized');

  let currentUrl: string = '';

  // Single function to update current URL
  const updateCurrentUrl = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      currentUrl = tab.url;
      chrome.storage.local.set({ currentUrl });
    }
  };

  // Initialize state from storage and set up timer if needed
  chrome.storage.local.get(['activeTask', 'elapsedTime', 'currentUrl']).then(result => {
    console.log('Initializing background state from storage:', result);
    if (result.activeTask) {
      console.log('Restoring active task:', result.activeTask);
      // Set badge text for active task
      const elapsedTime = result.elapsedTime || 0;
      const minutes = Math.floor(elapsedTime / 60);
      const hours = Math.floor(minutes / 60);
      const displayTime = hours > 0 
        ? `${hours}:${String(minutes % 60).padStart(2, '0')}`
        : `${minutes}:${String(elapsedTime % 60).padStart(2, '0')}`;
      chrome.action.setBadgeText({ text: displayTime });
      chrome.action.setBadgeBackgroundColor({ color: '#A8ACE0' });
    }
    if (result.currentUrl) {
      currentUrl = result.currentUrl;
      console.log('Restored current URL from storage:', currentUrl);
    }
  });

  // Listen for tab changes
  chrome.tabs.onActivated.addListener(updateCurrentUrl);
  chrome.tabs.onUpdated.addListener((_, changeInfo) => {
    if (changeInfo.url) {
      updateCurrentUrl();
    }
  });

  // Listen for extension install/update
  chrome.runtime.onInstalled.addListener(() => {
    // Clear any existing timer state
    chrome.storage.local.remove(['activeTask', 'elapsedTime']);
    chrome.action.setBadgeText({ text: '' });
  });

  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener((request, _, sendResponse) => {
    console.log('Background received message:', request);
    
    if (request.type === 'getCurrentUrl') {
      console.log('Sending current URL to popup:', currentUrl);
      sendResponse({ currentUrl });
    }
    return true;
  });

  // Initial URL check
  console.log('Performing initial URL check');
  updateCurrentUrl();
}); 