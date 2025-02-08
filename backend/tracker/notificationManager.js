const fs = require('fs').promises;
const path = require('path');
const { sendDirectMessage, sendChannelMessage } = require('../utils/send_message');
const { client } = require('../tools/discord');

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

        // Check if we can send a channel message (excellence announcement)
        if (this.canSendMessage(lastMessage?.channelMessage, now)) {
            const channelId = await this.getGeneralChannel();
            if (channelId) {
                const message = this.formatExcellenceMessage(evaluation, task, requirement);
                await sendChannelMessage(channelId, message);
                
                this.updateMessageHistory(history, userId, task.id, requirement.id, 'channelMessage', now);
            }
        }

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

    canSendMessage(lastMessageTime, now) {
        if (!lastMessageTime) return true;
        
        const lastMessage = new Date(lastMessageTime);
        const minutesSinceLastMessage = (now - lastMessage) / (1000 * 60);
        return minutesSinceLastMessage >= 1;
    }

    formatExcellenceMessage(evaluation, task, requirement) {
        return `🌟 Outstanding Achievement! 🌟\n\n${evaluation.message}\n\nKeep up the amazing work! 💪`;
    }

    formatDirectMessage(evaluation, task, requirement) {
        const emoji = requirement.emoji || '📊';
        return `${emoji} ${task.title} - ${requirement.title}\n\n${evaluation.message}`;
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

module.exports = new NotificationManager(); 