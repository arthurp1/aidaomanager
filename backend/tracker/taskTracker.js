import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { fetchAndStoreMessages } from '../tools/discord.js';
import { filterDiscordData } from '../utils/filter_discord_data.js';
import logManager from './logManager.js';
import aiEvaluator from './aiEvaluator.js';
import notificationManager from './notificationManager.js';

// ES Modules don't have __dirname, so we need to create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class TaskTracker {
    constructor() {
        this.isTracking = false;
        this.interval = null;
        this.tasksPath = path.join(__dirname, '../data/tasks.json');
        this.messageHistoryPath = path.join(__dirname, '../data/message_history.json');
        this.logManager = logManager;
        this.aiEvaluator = aiEvaluator;
        this.notificationManager = notificationManager;
        this.lastRun = null;
        this.activeTaskCount = 0;
    }

    formatDateTime(date) {
        const d = date || new Date();
        return d.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    }

    async start() {
        if (this.isTracking) return;
        
        this.isTracking = true;
        await this.track(); // Initial run
        this.interval = setInterval(() => this.track(), 60000); // Run every minute
    }

    async stop() {
        if (!this.isTracking) return;
        
        this.isTracking = false;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    async track() {
        try {
            // Read tasks configuration
            const tasks = JSON.parse(await fs.readFile(this.tasksPath, 'utf8'));
            
            // Flatten the nested tasks structure
            const allTasks = tasks.reduce((acc, group) => {
                if (group.tasks && Array.isArray(group.tasks)) {
                    acc.push(...group.tasks);
                }
                return acc;
            }, []);

            const discordTasks = allTasks.filter(task => 
                task.tools.includes('discord.com') && 
                task.requirements_active && 
                task.requirements_active.length > 0
            );

            this.activeTaskCount = discordTasks.length;
            this.lastRun = new Date().toISOString();

            console.log(`[${this.formatDateTime(new Date())}] Processing ${this.activeTaskCount} tasks`);

            if (discordTasks.length === 0) return;

            // Fetch and filter Discord data using direct function calls
            const discordData = await fetchAndStoreMessages();
            const filteredData = await filterDiscordData();

            // Process each task
            for (const task of discordTasks) {
                await this.processTask(task, filteredData);
            }
        } catch (error) {
            console.error('Error in task tracking:', error);
            await this.logManager.logError('task_tracker', error.message);
        }
    }

    async processTask(task, filteredData) {
        for (const reqId of task.requirements_active) {
            const requirement = task.requirements.find(r => r.id === reqId);
            if (!requirement) continue;

            const evaluationResult = await this.aiEvaluator.evaluate(
                filteredData,
                requirement,
                task.id
            );

            await this.logManager.logEvaluation({
                taskId: task.id,
                requirementId: reqId,
                evaluation: evaluationResult
            });

            if (evaluationResult.shouldNotify) {
                console.log(`[${this.formatDateTime(new Date())}] Message send`);
                await this.notificationManager.handleNotification(
                    evaluationResult,
                    task,
                    requirement
                );
            }
        }
    }

    getStatus() {
        return {
            isTracking: this.isTracking,
            lastRun: this.lastRun,
            activeTaskCount: this.activeTaskCount
        };
    }
}

// Create and export a singleton instance
const taskTracker = new TaskTracker();
export default taskTracker; 