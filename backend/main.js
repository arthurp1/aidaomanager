const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');

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
const REQUIREMENTS_FILE = path.join(DATA_DIR, 'requirements.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const TOOL_DATA_FILE = path.join(DATA_DIR, 'tool_data.json');
const MOCK_DATA_FILE = path.join(__dirname, '..', 'frontend_mock_data.json');

// In-memory storage (replace with your database in production)
let requirements = [];
let tasks = [];
let messages = [];
let toolData = [];
let mockData = null;

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
        requirements = JSON.parse(await fs.readFile(REQUIREMENTS_FILE, 'utf8'));
    } catch {
        requirements = [];
    }
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

async function saveRequirements() {
    await fs.writeFile(REQUIREMENTS_FILE, JSON.stringify(requirements, null, 2));
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

// Bulk update functions
async function bulkUpdateTasks(newTasks) {
    tasks = newTasks.map(task => ({
        id: task.id || uuidv4(),
        ...task
    }));
    await saveTasks();
    return tasks;
}

async function bulkUpdateRequirements(newRequirements) {
    requirements = newRequirements.map(req => ({
        id: req.id || uuidv4(),
        ...req
    }));
    await saveRequirements();
    return requirements;
}

// Load mock data on startup
loadMockData().catch(console.error);

// Initialize data on startup
loadData().catch(console.error);

// Available endpoints for CLI
const endpoints = {
    'update-requirements': { method: 'POST', path: '/updateRequirements', needsId: false },
    'update-tasks': { method: 'POST', path: '/updateTasks', needsId: false },
};

// Task handling function
async function handleTask(data) {
    try {
        // Ensure we have arrays to work with
        const tasksToProcess = Array.isArray(data) ? data : [data];
        
        // Extract requirements from tasks and maintain existing requirements
        const allRequirements = new Map(); // Use Map to track by ID
        
        // First, add existing requirements to the map
        requirements.forEach(req => {
            allRequirements.set(req.id, req);
        });

        // Then process new requirements from tasks
        tasksToProcess.forEach(task => {
            if (task.requirementsData) {
                task.requirementsData.forEach(req => {
                    if (req.id) {
                        // Update or add requirement
                        allRequirements.set(req.id, {
                            ...allRequirements.get(req.id) || {},
                            ...req
                        });
                    } else {
                        // New requirement without ID
                        const newId = uuidv4();
                        allRequirements.set(newId, { ...req, id: newId });
                    }
                });
            }
        });

        // Update requirements array
        requirements = Array.from(allRequirements.values());

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
                requirements: existingRequirements,
                requirementsData,
                ...otherFields
            } = task;

            // Get requirement IDs, either from requirementsData or existing requirements
            const requirementIds = requirementsData 
                ? requirementsData.map(req => req.id || allRequirements.get(req.id)?.id).filter(Boolean)
                : existingRequirements || [];

            // Construct the clean task object
            return {
                id,
                title,
                roleId,
                createdAt,
                estimatedTime,
                tools,
                trackedTime,
                requirements: requirementIds,
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

        // Save both files
        await Promise.all([
            saveRequirements(),
            saveTasks()
        ]);

        return {
            tasks,
            requirements
        };
    } catch (error) {
        console.error('Error in handleTask:', error);
        throw error;
    }
}

// Modify the CLI command handler
async function handleCommand(command) {
    const endpoint = endpoints[command];
    if (!endpoint) {
        console.log('Available commands:');
        Object.entries(endpoints).forEach(([cmd, info]) => {
            console.log(`${cmd.padEnd(20)} [${info.method}] ${info.path}`);
        });
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
            if (command === 'update-tasks' && mockData.tasks?.length > 0) {
                data = mockData.tasks;
                console.log(`Using mock data with ${data.length} items`);
                const result = await handleTask(data);
                console.log('Updated tasks and requirements:');
                console.log('Tasks:', result.tasks.length, 'items');
                console.log('Requirements:', result.requirements.length, 'items');
                return;
            } else if (command === 'update-requirements' && mockData.requirements?.length > 0) {
                data = mockData.requirements;
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
    switch (command) {
        case 'update-requirements':
            requirements = data.map(req => ({
                id: req.id || uuidv4(),
                ...req
            }));
            await saveRequirements();
            console.log('Updated requirements:', requirements);
            break;

        case 'update-tasks':
            const result = await handleTask(data);
            console.log('Updated tasks and requirements:');
            console.log('Tasks:', result.tasks.length, 'items');
            console.log('Requirements:', result.requirements.length, 'items');
            break;
    }
}

// Start CLI interface
function startCLI() {
    console.log('\nAvailable commands:');
    Object.entries(endpoints).forEach(([cmd, info]) => {
        console.log(`${cmd.padEnd(20)} [${info.method}] ${info.path}`);
    });
    console.log('\nEnter a command (or "exit" to quit):');

    rl.on('line', async (input) => {
        if (input.toLowerCase() === 'exit') {
            rl.close();
            process.exit(0);
        }
        await handleCommand(input.trim());
        console.log('\nEnter a command (or "exit" to quit):');
    });
}

// Modify the Express endpoint for tasks
app.post('/updateTasks', async (req, res) => {
    try {
        const result = await handleTask(req.body);
        res.json(result);
    } catch (error) {
        console.error('Error handling tasks:', error);
        res.status(500).json({ error: 'Failed to update tasks and requirements' });
    }
});

// Requirements endpoints
app.get('/updateRequirements', (req, res) => {
    res.json(requirements);
});

app.get('/updateRequirements/:id', (req, res) => {
    const requirement = requirements.find(r => r.id === req.params.id);
    if (!requirement) {
        return res.status(404).json({ error: 'Requirement not found' });
    }
    res.json(requirement);
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
        const newMessage = { id: uuidv4(), timestamp: new Date(), ...req.body };
        messages.push(newMessage);
        await saveMessages();
        res.status(201).json(newMessage);
    } catch (error) {
        res.status(500).json({ error: 'Failed to save message' });
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

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start the server and CLI
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    startCLI();
});
