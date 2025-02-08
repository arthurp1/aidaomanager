const fs = require('fs').promises;
const path = require('path');
const { fetchAndStoreMessages } = require('../tools/discord');
const { filterDiscordData } = require('../utils/filter_discord_data');

class TaskTracker {
    constructor() {
        this.isTracking = false;
        this.interval = null;
        this.tasksPath = path.join(__dirname, '../data/tasks.json');
        this.messageHistoryPath = path.join(__dirname, '../data/message_history.json');
        this.logManager = require('./logManager');
        this.aiEvaluator = require('./aiEvaluator');
        this.notificationManager = require('./notificationManager');
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
            const discordTasks = tasks.filter(task => 
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
                console.log(`[${this.formatDateTime(new Date())}] Notification: ${task.name}`);
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

module.exports = new TaskTracker(); 