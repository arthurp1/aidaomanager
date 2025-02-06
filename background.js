// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_CURRENT_TAB') {
    getCurrentTab().then(tab => {
      sendResponse({ url: tab.url });
    });
    return true; // Required for async response
  }
});

// Function to get the current active tab
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });
  return tab;
} 