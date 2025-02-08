const fs = require('fs').promises;
const path = require('path');

function formatDateTime(date) {
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

// This function filters and aggregates Discord data from the JSON file
// and computes metrics per user including activity, responsiveness, and engagement.
async function filterDiscordData() {
  const messagesPath = path.join(__dirname, '..', 'data', 'discord.json');
  let data;
  try {
    data = await fs.readFile(messagesPath, 'utf8');
  } catch (err) {
    console.error('Error reading discord messages file:', err);
    return [];
  }

  const messages = JSON.parse(data);
  // Sort messages chronologically
  messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Object to hold aggregated metrics per user
  const userMetrics = {};

  // Helper to initialize or retrieve a user's metrics
  const getUserMetrics = (userId, username) => {
    if (!userMetrics[userId]) {
      userMetrics[userId] = {
        authorId: userId,
        authorUsername: username,
        totalMessages: 0,
        firstMessage: null,
        lastMessage: null,
        editedMessages: 0,
        attachmentsCount: 0,
        embedsCount: 0,
        mentionsSent: 0,
        totalReactionsReceived: 0,
        totalMessageLength: 0,
        responseTimes: [] // in seconds
      };
    }
    return userMetrics[userId];
  };

  // First pass: Process each message to aggregate basic metrics
  messages.forEach((msg) => {
    const metrics = getUserMetrics(msg.authorId, msg.authorUsername);
    metrics.totalMessages++;
    metrics.totalMessageLength += msg.content.length;
    // Update first and last message timestamps
    if (!metrics.firstMessage || new Date(msg.timestamp) < new Date(metrics.firstMessage)) {
      metrics.firstMessage = msg.timestamp;
    }
    if (!metrics.lastMessage || new Date(msg.timestamp) > new Date(metrics.lastMessage)) {
      metrics.lastMessage = msg.timestamp;
    }
    if (msg.editedTimestamp) {
      metrics.editedMessages++;
    }
    if (msg.attachments && msg.attachments.length > 0) {
      metrics.attachmentsCount++;
    }
    if (msg.embeds && msg.embeds.length > 0) {
      metrics.embedsCount++;
    }
    // Count mentions sent (using regex to match Discord mention format)
    const mentionRegex = /<@(?:(?:!))?(\d+)>/g;
    const mentions = msg.content.match(mentionRegex);
    if (mentions) {
      metrics.mentionsSent += mentions.length;
    }
    // Sum reaction counts
    if (msg.reactions && msg.reactions.length > 0) {
      const reactionSum = msg.reactions.reduce((acc, reaction) => acc + (reaction.count || 0), 0);
      metrics.totalReactionsReceived += reactionSum;
    }
  });

  // Second pass: Compute response times for mentions
  // For each message, for every mention, find the next message from that mentioned user.
  messages.forEach((msg, index) => {
    const mentionRegex = /<@(?:(?:!))?(\d+)>/g;
    let match;
    while ((match = mentionRegex.exec(msg.content)) !== null) {
      const mentionedUserId = match[1];
      // Skip if the author mentions themselves
      if (mentionedUserId === msg.authorId) continue;
      // Look for the first message from the mentioned user after the current message
      for (let i = index + 1; i < messages.length; i++) {
        const nextMsg = messages[i];
        if (nextMsg.authorId === mentionedUserId) {
          const responseTimeSeconds = (new Date(nextMsg.timestamp) - new Date(msg.timestamp)) / 1000;
          // Ensure the user entry exists even if they haven't posted before
          const responderMetrics = getUserMetrics(mentionedUserId, nextMsg.authorUsername);
          responderMetrics.responseTimes.push(responseTimeSeconds);
          break;
        }
      }
    }
  });

  // Compute derived metrics for each user
  const aggregatedData = [];
  Object.keys(userMetrics).forEach((userId) => {
    const m = userMetrics[userId];
    m.editedRatio = m.totalMessages > 0 ? m.editedMessages / m.totalMessages : 0;
    m.averageReactions = m.totalMessages > 0 ? m.totalReactionsReceived / m.totalMessages : 0;
    m.averageMessageLength = m.totalMessages > 0 ? m.totalMessageLength / m.totalMessages : 0;
    m.averageResponseTime = m.responseTimes.length > 0 ? (m.responseTimes.reduce((a, b) => a + b, 0) / m.responseTimes.length) : null;
    aggregatedData.push(m);
  });

  // Store the filtered data to backend/data/discord_filtered.json
  const outputPath = path.join(__dirname, '..', 'data', 'discord_filtered.json');
  try {
    await fs.writeFile(outputPath, JSON.stringify(aggregatedData, null, 2), 'utf8');
    console.log(`[${formatDateTime(new Date())}] Filtered discord data`);
  } catch (err) {
    console.error('Error writing filtered discord data:', err);
  }

  return aggregatedData;
}

module.exports = { filterDiscordData };
