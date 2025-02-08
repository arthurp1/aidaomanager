import { defineBackground } from 'wxt/sandbox';

export default defineBackground(() => {
  console.log('Background script loaded');

  // Initialize state from storage
  chrome.storage.local.get(['activeTask', 'elapsedTime']).then(result => {
    if (result.activeTask) {
      console.log('Restoring active task:', result.activeTask);
    }
  });

  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message:', request);
    sendResponse({ received: true });
  });
}); 