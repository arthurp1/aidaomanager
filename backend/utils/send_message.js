const { client } = require('../tools/discord');

/**
 * Sends a direct message to a specific Discord user
 * @param {string} userId - The Discord user ID to send the message to
 * @param {string} message - The message content to send
 * @returns {Promise<Object>} - Returns the sent message object or error details
 */
async function sendDirectMessage(userId, message) {
    try {
        // Ensure the client is ready
        if (!client.isReady()) {
            throw new Error('Discord client is not ready');
        }

        // Try to fetch the user
        const user = await client.users.fetch(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Send the direct message
        const sentMessage = await user.send(message);

        return {
            success: true,
            messageId: sentMessage.id,
            timestamp: sentMessage.createdAt,
            content: sentMessage.content
        };
    } catch (error) {
        console.error('Error sending direct message:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Sends a message to a specific channel
 * @param {string} channelId - The Discord channel ID to send the message to
 * @param {string} message - The message content to send
 * @returns {Promise<Object>} - Returns the sent message object or error details
 */
async function sendChannelMessage(channelId, message) {
    try {
        // Ensure the client is ready
        if (!client.isReady()) {
            throw new Error('Discord client is not ready');
        }

        // Try to fetch the channel
        const channel = await client.channels.fetch(channelId);
        if (!channel) {
            throw new Error('Channel not found');
        }

        // Send the message to the channel
        const sentMessage = await channel.send(message);

        return {
            success: true,
            messageId: sentMessage.id,
            timestamp: sentMessage.createdAt,
            content: sentMessage.content
        };
    } catch (error) {
        console.error('Error sending channel message:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    sendDirectMessage,
    sendChannelMessage
};