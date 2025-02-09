import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import readline from 'readline';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { fetchAndStoreMessages, client } from './tools/discord.js';
import { filterDiscordData } from './utils/filter_discord_data.js';
import { sendDirectMessage, sendChannelMessage } from './utils/send_message.js';
import taskTracker from './tracker/taskTracker.js';

// ES Modules don't have __dirname, so we need to create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Middleware
app.use(cors());
app.use(bodyParser.json());

// File paths
const DATA_DIR = path.join(__dirname, 'data');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const TOOL_DATA_FILE = path.join(DATA_DIR, 'tool_data.json');
const MOCK_DATA_FILE = path.join(__dirname, '..', 'frontend_tasks.json');

// In-memory storage (replace with your database in production)
let tasks = [];
let messages = [];
let toolData = [];
let mockData = null;

// Use the taskTracker instance directly since it's already instantiated in the module
const tracker = taskTracker;

// File operations
async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

async function loadMockData() {
    try {
        const data = await fs.readFile(MOCK_DATA_FILE, 'utf8');
        mockData = JSON.parse(data);
    } catch (error) {
        console.error('Error loading mock data:', error.message);
        mockData = null;
    }
}

async function loadData() {
    await ensureDataDir();
    try {
        tasks = JSON.parse(await fs.readFile(TASKS_FILE, 'utf8'));
    } catch {
        tasks = [];
    }
    try {
        messages = JSON.parse(await fs.readFile(MESSAGES_FILE, 'utf8'));
    } catch {
        messages = [];
    }
    try {
        toolData = JSON.parse(await fs.readFile(TOOL_DATA_FILE, 'utf8'));
    } catch {
        toolData = [];
    }
}

async function saveTasks() {
    await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

async function saveMessages() {
    await fs.writeFile(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

async function saveToolData() {
    await fs.writeFile(TOOL_DATA_FILE, JSON.stringify(toolData, null, 2));
}

// Task handling function
async function handleTask(data) {
    try {
        // Ensure we have arrays to work with
        const tasksToProcess = Array.isArray(data) ? data : [data];
        
        // Process tasks
        const processedTasks = tasksToProcess.map(task => {
            // Extract only the necessary fields for tasks
            const {
                id = uuidv4(),
                title,
                roleId,
                createdAt,
                estimatedTime,
                tools,
                trackedTime,
                ...otherFields
            } = task;

            // Construct the clean task object
            return {
                id,
                title,
                roleId,
                createdAt,
                estimatedTime,
                tools,
                trackedTime,
                ...otherFields
            };
        });

        // Update tasks array while preserving existing tasks not in the update
        const taskMap = new Map();
        
        // Add existing tasks to map
        tasks.forEach(task => {
            taskMap.set(task.id, task);
        });

        // Update or add new tasks
        processedTasks.forEach(task => {
            taskMap.set(task.id, task);
        });

        // Convert map back to array
        tasks = Array.from(taskMap.values());

        // Save tasks file
        await saveTasks();

        return {
            tasks
        };
    } catch (error) {
        console.error('Error in handleTask:', error);
        throw error;
    }
}

// Load mock data on startup
loadMockData().catch(console.error);

// Initialize data on startup
loadData().catch(console.error);

// Available endpoints for CLI
const endpoints = {
    '1': { name: 'fetch-discord', method: 'GET', path: '/fetchDiscord', needsId: false, description: 'Fetch messages from Discord' },
    '2': { name: 'filter-discord', method: 'GET', path: '/filterDiscord', needsId: false, description: 'Filter Discord data and generate metrics' },
    '3': { name: 'update-tasks', method: 'POST', path: '/updateTasks', needsId: false, description: 'Update tasks' },
    '4': { name: 'send-test-message', method: 'POST', path: '/sendMessage', needsId: false, description: 'Send test message to Discord' },
    '5': { name: 'tracking-status', method: 'GET', path: '/tracking/status', needsId: false, description: 'Get task tracking status' },
    '6': { name: 'tracking-toggle', method: 'POST', path: '/tracking/toggle', needsId: false, description: 'Toggle task tracking on/off' }
};

// Add function to get available users
async function getAvailableUsers() {
    try {
        if (!client.isReady()) {
            throw new Error('Discord client is not ready');
        }

        const users = new Map();
        const guilds = Array.from(client.guilds.cache.values());

        // First try to get users from cache
        for (const guild of guilds) {
            guild.members.cache.forEach(member => {
                if (!member.user.bot) {
                    users.set(member.user.id, {
                        id: member.user.id,
                        username: member.user.username,
                        displayName: member.displayName
                    });
                }
            });
        }

        // If cache is empty, fetch a limited number of members
        if (users.size === 0) {
            console.log('Cache empty, fetching members (this might take a moment)...');
            for (const guild of guilds) {
                try {
                    // Fetch only first 100 members to keep it fast
                    const members = await guild.members.list({ limit: 100 });
                    members.forEach(member => {
                        if (!member.user.bot) {
                            users.set(member.user.id, {
                                id: member.user.id,
                                username: member.user.username,
                                displayName: member.displayName
                            });
                        }
                    });
                } catch (error) {
                    console.warn(`Warning: Could not fetch members from guild ${guild.name}:`, error.message);
                    // Continue with other guilds even if one fails
                    continue;
                }
            }
        }

        const userArray = Array.from(users.values());
        console.log(`Found ${userArray.length} users`);
        return userArray;
    } catch (error) {
        console.error('Error fetching users:', error);
        return [];
    }
}

// Add function to get general channel
async function getGeneralChannel() {
    try {
        if (!client.isReady()) {
            throw new Error('Discord client is not ready');
        }

        const guilds = Array.from(client.guilds.cache.values());
        for (const guild of guilds) {
            const channel = guild.channels.cache.find(ch => 
                ch.name === 'general' && ch.type === 0
            );
            if (channel) {
                return {
                    id: channel.id,
                    name: channel.name
                };
            }
        }
        return null;
    } catch (error) {
        console.error('Error fetching general channel:', error);
        return null;
    }
}

// Add function to handle test message sending
async function handleTestMessageSending() {
    try {
        console.log('\nFetching available users...');
        const users = await getAvailableUsers();
        const generalChannel = await getGeneralChannel();

        if (users.length === 0) {
            console.log('No users found.');
            return;
        }

        console.log('\nAvailable recipients:');
        console.log('0. general (channel)');
        users.forEach((user, index) => {
            console.log(`${index + 1}. ${user.username} (${user.displayName})`);
        });

        const recipientIndex = await new Promise(resolve => {
            rl.question('\nSelect recipient number: ', answer => {
                resolve(parseInt(answer));
            });
        });

        if (isNaN(recipientIndex) || recipientIndex < 0 || recipientIndex > users.length) {
            console.log('Invalid selection');
            return;
        }

        const message = await new Promise(resolve => {
            rl.question('\nEnter your message: ', resolve);
        });

        if (!message.trim()) {
            console.log('Message cannot be empty');
            return;
        }

        let result;
        if (recipientIndex === 0) {
            if (!generalChannel) {
                console.log('General channel not found');
                return;
            }
            result = await sendChannelMessage(generalChannel.id, message);
            console.log(`Sending message to #${generalChannel.name}`);
        } else {
            const selectedUser = users[recipientIndex - 1];
            result = await sendDirectMessage(selectedUser.id, message);
            console.log(`Sending message to ${selectedUser.username}`);
        }

        if (result.success) {
            console.log('Message sent successfully!');
            console.log('Message ID:', result.messageId);
            console.log('Timestamp:', result.timestamp);
        } else {
            console.log('Failed to send message:', result.error);
        }
    } catch (error) {
        console.error('Error in test message sending:', error);
    }
}

// Modify the CLI command handler
async function handleCommand(command = '1') {
    const endpoint = endpoints[command];
    
    // If numeric shortcut is used, get the actual command name
    const commandName = endpoint?.name || command;
    
    if (!endpoint && !Object.values(endpoints).find(e => e.name === command)) {
        console.log('Available commands (use number or name):');
        Object.entries(endpoints).forEach(([num, info]) => {
            console.log(`${num}. ${info.name.padEnd(20)} - ${info.description}`);
        });
        return;
    }

    // Add new command handlers for tracking
    if (commandName === 'tracking-status') {
        const status = tracker.getStatus();
        const tasks = JSON.parse(await fs.readFile(path.join(__dirname, 'data', 'tasks.json'), 'utf8'));
        
        console.log('\n=== System Status ===');
        console.log(`🔄 Tracking Service: ${status.isTracking ? '✅ Active' : '❌ Inactive'}`);
        console.log(`⏰ Last Run: ${status.lastRun ? new Date(status.lastRun).toLocaleString() : 'Never'}`);
        console.log(`📊 Active Tasks: ${status.activeTaskCount}`);
        
        console.log('\n=== Active Tasks & Requirements ===');
        
        for (const task of tasks) {
            if (task.requirements_active && task.requirements_active.length > 0) {
                console.log(`\n📌 Task: ${task.title}`);
                for (const reqId of task.requirements_active) {
                    const req = task.requirements.find(r => r.id === reqId);
                    if (req) {
                        console.log(`   ${req.emoji} ${req.title}`);
                        console.log(`      Measure: ${req.measure}`);
                        console.log(`      Severity: ${req.severity}`);
                    }
                }
            }
        }
        
        return;
    }

    if (commandName === 'tracking-toggle') {
        const currentStatus = tracker.getStatus();
        const newState = !currentStatus.isTracking;
        
        if (newState) {
            await tracker.start();
            console.log('Task tracking started');
        } else {
            await tracker.stop();
            console.log('Task tracking stopped');
        }
        return;
    }

    if (commandName === 'fetch-discord') {
        console.log('Fetching Discord messages...');
        try {
            const messages = await fetchAndStoreMessages();
            console.log(`Successfully fetched ${messages.length} messages from Discord`);
            return;
        } catch (error) {
            console.error('Error fetching Discord messages:', error);
            return;
        }
    }

    if (commandName === 'filter-discord') {
        console.log('Filtering Discord data and generating metrics...');
        try {
            const filteredData = await filterDiscordData();
            console.log(`Successfully generated metrics for ${filteredData.length} users`);
            return;
        } catch (error) {
            console.error('Error filtering Discord data:', error);
            return;
        }
    }

    if (commandName === 'send-test-message') {
        await handleTestMessageSending();
        return;
    }

    let data = null;

    if (mockData) {
        const useMockData = await new Promise(resolve => {
            rl.question('Use mock data? (Y/n): ', answer => {
                resolve(answer.toLowerCase() !== 'n');
            });
        });

        if (useMockData) {
            if (commandName === 'update-tasks' && mockData.tasks?.length > 0) {
                data = mockData.tasks;
                console.log(`Using mock data with ${data.length} items`);
                const result = await handleTask(data);
                console.log('Updated tasks:');
                console.log('Tasks:', result.tasks.length, 'items');
                return;
            }
            if (data) {
                console.log(`Using mock data with ${data.length} items`);
            } else {
                console.log('No relevant mock data found for this endpoint');
                return;
            }
        }
    }

    if (!data) {
        const dataStr = await new Promise(resolve => {
            rl.question('Enter data (as JSON array): ', resolve);
        });
        try {
            data = JSON.parse(dataStr);
            if (!Array.isArray(data)) {
                data = [data]; // Convert single item to array
            }
        } catch (e) {
            console.error('Invalid JSON data');
            return;
        }
    }

    // Simulate the API call locally
    switch (commandName) {
        case 'update-tasks':
            const result = await handleTask(data);
            console.log('Updated tasks:');
            console.log('Tasks:', result.tasks.length, 'items');
            break;
    }
}

// Modify the CLI interface
function startCLI() {
    console.log('\nAvailable commands (use number or name):');
    Object.entries(endpoints).forEach(([num, info]) => {
        console.log(`${num}. ${info.name.padEnd(20)} - ${info.description}`);
    });
    console.log('\nEnter a command number or name (or "exit" to quit):');

    rl.on('line', async (input) => {
        if (input.toLowerCase() === 'exit') {
            rl.close();
            process.exit(0);
        }
        await handleCommand(input.trim() || '1');  // Use '1' (fetch-discord) when input is empty
        console.log('\nEnter a command number or name (or "exit" to quit):');
    });
}

// Modify the Express endpoint for tasks
app.post('/updateTasks', async (req, res) => {
    try {
        const result = await handleTask(req.body);
        res.json(result);
    } catch (error) {
        console.error('Error handling tasks:', error);
        res.status(500).json({ error: 'Failed to update tasks' });
    }
});

// Tasks endpoints
app.get('/updateTasks', (req, res) => {
    res.json(tasks);
});

app.get('/updateTasks/:id', (req, res) => {
    const task = tasks.find(t => t.id === req.params.id);
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
});

// Messages exendpoints
app.get('/sendMessage', (req, res) => {
    res.json(messages);
});

app.get('/sendMessage/:id', (req, res) => {
    const message = messages.find(m => m.id === req.params.id);
    if (!message) {
        return res.status(404).json({ error: 'Message not found' });
    }
    res.json(message);
});

app.post('/sendMessage', async (req, res) => {
    try {
        const { userId, channelId, message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message content is required' });
        }

        let result;
        
        // If userId is provided, send a direct message
        if (userId) {
            result = await sendDirectMessage(userId, message);
        }
        // If channelId is provided, send a channel message
        else if (channelId) {
            result = await sendChannelMessage(channelId, message);
        }
        else {
            return res.status(400).json({ error: 'Either userId or channelId is required' });
        }

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        // Store the message in our local storage
        const newMessage = {
            id: result.messageId,
            content: result.content,
            timestamp: result.timestamp,
            userId,
            channelId
        };
        messages.push(newMessage);
        await saveMessages();

        res.status(201).json(result);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Tool Data endpoints
app.get('/fetchToolData', (req, res) => {
    res.json(toolData);
});

app.get('/fetchToolData/:id', (req, res) => {
    const tool = toolData.find(t => t.id === req.params.id);
    if (!tool) {
        return res.status(404).json({ error: 'Tool data not found' });
    }
    res.json(tool);
});

app.post('/fetchToolData', async (req, res) => {
    try {
        const newToolData = { id: uuidv4(), ...req.body };
        toolData.push(newToolData);
        await saveToolData();
        res.status(201).json(newToolData);
    } catch (error) {
        res.status(500).json({ error: 'Failed to save tool data' });
    }
});

app.put('/fetchToolData/:id', async (req, res) => {
    try {
        const index = toolData.findIndex(t => t.id === req.params.id);
        if (index === -1) {
            return res.status(404).json({ error: 'Tool data not found' });
        }
        toolData[index] = { ...toolData[index], ...req.body };
        await saveToolData();
        res.json(toolData[index]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update tool data' });
    }
});

// Add Discord endpoint
app.get('/fetchDiscord', async (req, res) => {
    try {
        const messages = await fetchAndStoreMessages();
        res.json({ success: true, count: messages.length });
    } catch (error) {
        console.error('Error fetching Discord messages:', error);
        res.status(500).json({ error: 'Failed to fetch Discord messages' });
    }
});

// Add new endpoint for filtering Discord data
app.get('/filterDiscord', async (req, res) => {
    try {
        const filteredData = await filterDiscordData();
        res.json({ success: true, count: filteredData.length, data: filteredData });
    } catch (error) {
        console.error('Error filtering Discord data:', error);
        res.status(500).json({ error: 'Failed to filter Discord data' });
    }
});

// Task Tracking Endpoints
app.get('/api/task-tracking/status', async (req, res) => {
    try {
        const status = tracker.getStatus();
        res.json(status);
    } catch (error) {
        console.error('Error getting task tracking status:', error);
        res.status(500).json({ error: 'Failed to get task tracking status' });
    }
});

app.post('/tracking-toggle', async (req, res) => {
    const { action } = req.body;
    
    if (action === 'start') {
        await tracker.start();
        res.json({ status: 'success', message: 'Tracking started', isTracking: true });
    } else if (action === 'stop') {
        await tracker.stop();
        res.json({ status: 'success', message: 'Tracking stopped', isTracking: false });
    } else {
        res.status(400).json({ status: 'error', message: 'Invalid action. Use "start" or "stop".' });
    }
});

app.get('/tracking-status', (req, res) => {
    res.json(tracker.getStatus());
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start the server and CLI
app.listen(port, async () => {
    console.log(`Server is running on port ${port}`);
    await ensureDataDir();
    await loadData();
    startCLI();
});
