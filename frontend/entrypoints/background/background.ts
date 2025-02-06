// State management
let activeTask: any = null;
let elapsedTime: number = 0;
let timerInterval: NodeJS.Timer | null = null;
let lastTickTime: number | null = null;

// Function to format time for badge
function formatBadgeTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Function to get the current active tab
async function getCurrentTab() {
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
  if (!activeTask) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  const badgeText = formatBadgeTime(elapsedTime);
  chrome.action.setBadgeText({ text: badgeText });
}

// Function to start timer
function startTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
  updateBadgeText();
  
  lastTickTime = Date.now();
  timerInterval = setInterval(() => {
    const now = Date.now();
    const deltaSeconds = Math.floor((now - (lastTickTime || now)) / 1000);
    lastTickTime = now;

    if (deltaSeconds > 0) {
      elapsedTime += deltaSeconds;
      updateBadgeText();

      // Update task's tracked time
      if (activeTask) {
        activeTask.trackedTime = (activeTask.trackedTime || 0) + (deltaSeconds / 3600);
      }

      // Save state to storage
      chrome.storage.local.set({ 
        activeTask,
        elapsedTime 
      }).catch(console.error);
    }
  }, 1000);

  // Save initial state
  chrome.storage.local.set({ 
    activeTask,
    elapsedTime 
  }).catch(console.error);
}

// Function to stop timer
function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  lastTickTime = null;
  chrome.action.setBadgeText({ text: '' });
}

// Initialize state from storage
async function initializeState() {
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

// Initialize when the service worker starts
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed/updated');
  initializeState();
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request.type);
  try {
    switch (request.type) {
      case 'GET_CURRENT_TAB':
        getCurrentTab().then(tab => {
          sendResponse({ url: tab?.url });
        });
        return true;

      case 'START_TIMER':
        console.log('Starting timer with task:', request.task);
        activeTask = request.task;
        if (request.task.id !== activeTask?.id) {
          elapsedTime = request.elapsedTime || 0;
        }
        startTimer();
        sendResponse({ success: true });
        break;

      case 'STOP_TIMER':
        console.log('Stopping timer');
        if (activeTask) {
          chrome.storage.local.get(['tasks'], (result) => {
            const tasks = result.tasks || [];
            const updatedTasks = tasks.map((task: any) => 
              task.id === activeTask.id 
                ? { ...task, trackedTime: (task.trackedTime || 0) + (elapsedTime / 3600) }
                : task
            );
            chrome.storage.local.set({ tasks: updatedTasks });
          });
        }
        stopTimer();
        const stoppedTask = activeTask;
        const stoppedTime = elapsedTime;
        activeTask = null;
        chrome.storage.local.set({ 
          activeTask: null,
          elapsedTime: stoppedTime
        }).catch(console.error);
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