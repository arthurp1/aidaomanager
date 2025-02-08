const fs = require('fs').promises;
const path = require('path');

class LogManager {
    constructor() {
        this.logsPath = path.join(__dirname, '../data/task_tracker_logs.json');
    }

    async logEvaluation(data) {
        try {
            const logs = await this.loadLogs();
            
            const logEntry = {
                timestamp: new Date().toISOString(),
                taskId: data.taskId,
                requirementId: data.requirementId,
                evaluation: {
                    level: data.evaluation.level,
                    message: data.evaluation.message,
                    proof: data.evaluation.proof
                },
                messageSent: data.evaluation.shouldNotify
            };

            logs.evaluations = logs.evaluations || [];
            logs.evaluations.unshift(logEntry);

            // Keep only last 1000 evaluations
            if (logs.evaluations.length > 1000) {
                logs.evaluations = logs.evaluations.slice(0, 1000);
            }

            await this.saveLogs(logs);
            return logEntry;
        } catch (error) {
            console.error('Error logging evaluation:', error);
            throw error;
        }
    }

    async logError(source, message) {
        try {
            const logs = await this.loadLogs();
            
            const errorEntry = {
                timestamp: new Date().toISOString(),
                source,
                message
            };

            logs.errors = logs.errors || [];
            logs.errors.unshift(errorEntry);

            // Keep only last 100 errors
            if (logs.errors.length > 100) {
                logs.errors = logs.errors.slice(0, 100);
            }

            await this.saveLogs(logs);
            return errorEntry;
        } catch (error) {
            console.error('Error logging error:', error);
            throw error;
        }
    }

    async getRecentEvaluations(taskId = null, limit = 50) {
        try {
            const logs = await this.loadLogs();
            let evaluations = logs.evaluations || [];
            
            if (taskId) {
                evaluations = evaluations.filter(e => e.taskId === taskId);
            }

            return evaluations.slice(0, limit);
        } catch (error) {
            console.error('Error getting recent evaluations:', error);
            throw error;
        }
    }

    async getRecentErrors(limit = 20) {
        try {
            const logs = await this.loadLogs();
            const errors = logs.errors || [];
            return errors.slice(0, limit);
        } catch (error) {
            console.error('Error getting recent errors:', error);
            throw error;
        }
    }

    async loadLogs() {
        try {
            const data = await fs.readFile(this.logsPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return { evaluations: [], errors: [] };
            }
            throw error;
        }
    }

    async saveLogs(logs) {
        await fs.writeFile(
            this.logsPath,
            JSON.stringify(logs, null, 2),
            'utf8'
        );
    }
}

module.exports = new LogManager(); 