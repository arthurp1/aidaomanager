import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { sendDirectMessage, sendChannelMessage } from '../utils/send_message.js';
import { client } from '../tools/discord.js';

// ES Modules don't have __dirname, so we need to create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class NotificationManager {
    constructor() {
        this.messageHistoryPath = path.join(__dirname, '../data/message_history.json');
        this.testUserId = '1205593973591253083';
    }

    async getGeneralChannel() {
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
                    return channel.id;
                }
            }
            return null;
        } catch (error) {
            console.error('Error fetching general channel:', error);
            return null;
        }
    }

    async handleNotification(evaluationResult, task, requirement) {
        try {
            const history = await this.loadMessageHistory();
            
            if (evaluationResult.level === 'Excellent') {
                await this.handleExcellentPerformance(
                    evaluationResult,
                    task,
                    requirement,
                    history
                );
            } else if (evaluationResult.level === 'Poor') {
                await this.handlePoorPerformance(
                    evaluationResult,
                    task,
                    requirement,
                    history
                );
            }

            await this.saveMessageHistory(history);
        } catch (error) {
            console.error('Error handling notification:', error);
            throw error;
        }
    }

    async handleExcellentPerformance(evaluation, task, requirement, history) {
        const userId = this.testUserId;
        const lastMessage = history[userId]?.[task.id]?.[requirement.id];
        const now = new Date();

        // Channel messaging disabled as per configuration

        // Also send a direct message of congratulations
        if (this.canSendMessage(lastMessage?.directMessage, now)) {
            const message = this.formatDirectMessage(evaluation, task, requirement);
            await sendDirectMessage(userId, message);
            
            this.updateMessageHistory(history, userId, task.id, requirement.id, 'directMessage', now);
        }
    }

    async handlePoorPerformance(evaluation, task, requirement, history) {
        const userId = this.testUserId;
        const lastMessage = history[userId]?.[task.id]?.[requirement.id];
        const now = new Date();

        if (this.canSendMessage(lastMessage?.directMessage, now)) {
            const message = this.formatDirectMessage(evaluation, task, requirement);
            await sendDirectMessage(userId, message);
            
            this.updateMessageHistory(history, userId, task.id, requirement.id, 'directMessage', now);
        }
    }

    /**
     * Determines if a new message can be sent based on rate limiting rules.
     * Ensures messages are not sent more frequently than once per minute.
     * @param {string|Date|null} lastMessageTime - Timestamp of the last message
     * @param {Date} now - Current timestamp
     * @returns {boolean} - Whether a new message can be sent
     */
    canSendMessage(lastMessageTime, now) {
        if (!lastMessageTime) return true;
        
        try {
            const lastMessage = lastMessageTime instanceof Date ? lastMessageTime : new Date(lastMessageTime);
            if (isNaN(lastMessage.getTime())) return true; // Handle invalid date
            
            const minutesSinceLastMessage = (now - lastMessage) / (1000 * 60);
            return minutesSinceLastMessage >= 1;
        } catch (error) {
            console.error('Error in rate limiting calculation:', error);
            return true; // Fail open to ensure notifications aren't completely blocked
        }
    }

    formatExcellenceMessage(evaluation, task, requirement) {
        return evaluation.message;
    }

    formatDirectMessage(evaluation, task, requirement) {
        return evaluation.message;
    }

    updateMessageHistory(history, userId, taskId, requirementId, messageType, timestamp) {
        history[userId] = history[userId] || {};
        history[userId][taskId] = history[userId][taskId] || {};
        history[userId][taskId][requirementId] = history[userId][taskId][requirementId] || {};
        history[userId][taskId][requirementId][messageType] = timestamp;
    }

    async loadMessageHistory() {
        try {
            const data = await fs.readFile(this.messageHistoryPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return {};
            }
            throw error;
        }
    }

    async saveMessageHistory(history) {
        await fs.writeFile(
            this.messageHistoryPath,
            JSON.stringify(history, null, 2),
            'utf8'
        );
    }
}

// Create and export a singleton instance
const notificationManager = new NotificationManager();
export default notificationManager; 