// Ensure the service worker is registered
self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
  self.skipWaiting(); // Ensure the service worker activates immediately
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating.');
  // Ensure the service worker takes control immediately
  event.waitUntil(clients.claim());
});

// State management
let activeTask = null;
let elapsedTime = 0;
let timerInterval = null;
let lastTickTime = null;

// Helper function to check if we're in a Chrome extension context
const isChromeExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;

// Function to format time for badge
function formatBadgeTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Function to get the current active tab
async function getCurrentTab() {
  if (!isChromeExtension) return null;
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });
    return tab;
  } catch (error) {
    console.error('Error getting current tab:', error);
    return null;
  }
}

// Function to update badge text
function updateBadgeText() {
  if (!isChromeExtension || !chrome.action) return;
  if (!activeTask) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  const badgeText = formatBadgeTime(elapsedTime);
  chrome.action.setBadgeText({ text: badgeText });
}

// Function to start timer
function startTimer() {
  if (!isChromeExtension) return;
  if (timerInterval) {
    clearInterval(timerInterval); // Clear existing interval if any
  }
  
  try {
    if (chrome.action) {
      chrome.action.setBadgeBackgroundColor({ color: '#2563eb' }); // blue-600
      updateBadgeText(); // Update badge immediately
    }
    
    lastTickTime = Date.now();
    timerInterval = setInterval(() => {
      const now = Date.now();
      const deltaSeconds = Math.floor((now - lastTickTime) / 1000);
      lastTickTime = now;

      if (deltaSeconds > 0) {
        elapsedTime += deltaSeconds;
        updateBadgeText();

        // Update task's tracked time
        if (activeTask) {
          activeTask.trackedTime = (activeTask.trackedTime || 0) + (deltaSeconds / 3600); // Convert seconds to hours
        }

        // Save state to storage
        if (chrome.storage?.local) {
          chrome.storage.local.set({ 
            activeTask,
            elapsedTime 
          }).catch(console.error);
        }
      }
    }, 1000);

    // Save initial state
    if (chrome.storage?.local) {
      chrome.storage.local.set({ 
        activeTask,
        elapsedTime 
      }).catch(console.error);
    }
  } catch (error) {
    console.error('Error starting timer:', error);
  }
}

// Function to stop timer
function stopTimer() {
  if (!isChromeExtension) return;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  lastTickTime = null;
  try {
    if (chrome.action) {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    console.error('Error stopping timer:', error);
  }
}

// Initialize state from storage
async function initializeState() {
  if (!isChromeExtension || !chrome.storage?.local) return;
  
  try {
    const result = await chrome.storage.local.get(['activeTask', 'elapsedTime']);
    if (result.activeTask) {
      activeTask = result.activeTask;
      elapsedTime = result.elapsedTime || 0;
      startTimer();
    }
  } catch (error) {
    console.error('Error initializing state:', error);
  }
}

// Initialize state when the service worker starts
initializeState();

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request.type);
  try {
    switch (request.type) {
      case 'GET_CURRENT_TAB':
        getCurrentTab().then(tab => {
          sendResponse({ url: tab?.url });
        });
        return true; // Required for async response

      case 'START_TIMER':
        console.log('Starting timer with task:', request.task);
        activeTask = request.task;
        // Keep existing elapsed time if it's the same task
        if (request.task.id !== activeTask?.id) {
          elapsedTime = request.elapsedTime || 0;
        }
        startTimer();
        sendResponse({ success: true });
        break;

      case 'STOP_TIMER':
        console.log('Stopping timer');
        // Save final tracked time before stopping
        if (activeTask && chrome.storage?.local) {
          chrome.storage.local.get(['tasks'], (result) => {
            const tasks = result.tasks || [];
            const updatedTasks = tasks.map(task => 
              task.id === activeTask.id 
                ? { ...task, trackedTime: (task.trackedTime || 0) + (elapsedTime / 3600) }
                : task
            );
            chrome.storage.local.set({ tasks: updatedTasks });
          });
        }
        stopTimer();
        // Don't reset elapsed time here
        const stoppedTask = activeTask;
        const stoppedTime = elapsedTime;
        activeTask = null;
        if (chrome.storage?.local) {
          chrome.storage.local.set({ 
            activeTask: null,
            elapsedTime: stoppedTime // Save the stopped time
          }).catch(console.error);
        }
        sendResponse({ success: true, stoppedTask, stoppedTime });
        break;

      case 'GET_TIMER_STATE':
        console.log('Sending timer state:', { activeTask, elapsedTime, isRunning: !!timerInterval });
        sendResponse({
          activeTask,
          elapsedTime,
          isRunning: !!timerInterval
        });
        break;
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ error: error.message });
  }
}); 