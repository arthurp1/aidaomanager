import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { readFromNillion, writeToNillion } from '../data/nillion/nillion.js';

// ES Modules don't have __dirname, so we need to create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// File paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const NILLION_DIR = path.join(DATA_DIR, 'nillion');
const RECORD_IDS_FILE = path.join(NILLION_DIR, 'nillion_record_ids.json');
const FILTERED_RECORD_IDS_FILE = path.join(NILLION_DIR, 'nillion_filtered_record_ids.json');

async function loadRecordIds() {
    try {
        const data = await fs.readFile(RECORD_IDS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading record IDs:', error);
        return [];
    }
}

async function saveFilteredRecordIds(recordIds) {
    await fs.writeFile(FILTERED_RECORD_IDS_FILE, JSON.stringify(recordIds, null, 2));
}

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

// This function filters and aggregates Discord data from Nillion
// and computes metrics per user including activity, responsiveness, and engagement.
async function filterDiscordData() {
  let messages;
  try {
    const recordIds = await loadRecordIds();
    if (!recordIds.length) {
      throw new Error('No record IDs found');
    }
    
    const result = await readFromNillion(recordIds);
    if (!result.success) {
      throw new Error(`Failed to read from Nillion: ${result.error}`);
    }
    messages = result.data;
  } catch (err) {
    console.error('Error reading discord messages from Nillion:', err);
    return [];
  }

  // Sort messages chronologically
  messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Object to hold aggregated metrics per user
  const userMetrics = {};

  // Helper to initialize or retrieve a user's metrics
  const getUserMetrics = (userId, username) => {
    if (!userMetrics[userId]) {
      userMetrics[userId] = {
        authorId: { $allot: userId },
        authorUsername: { $allot: username },
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
    const metrics = getUserMetrics(msg.authorId.$allot || msg.authorId, msg.authorUsername.$allot || msg.authorUsername);
    metrics.totalMessages++;
    metrics.totalMessageLength += (msg.content.$allot || msg.content).length;
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
    if (msg.attachments && (msg.attachments.$allot || msg.attachments).length > 0) {
      metrics.attachmentsCount++;
    }
    if (msg.embeds && (msg.embeds.$allot || msg.embeds).length > 0) {
      metrics.embedsCount++;
    }
    // Count mentions sent (using regex to match Discord mention format)
    const mentionRegex = /<@(?:(?:!))?(\d+)>/g;
    const content = msg.content.$allot || msg.content;
    const mentions = content.match(mentionRegex);
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
  messages.forEach((msg, index) => {
    const mentionRegex = /<@(?:(?:!))?(\d+)>/g;
    const content = msg.content.$allot || msg.content;
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      const mentionedUserId = match[1];
      // Skip if the author mentions themselves
      if (mentionedUserId === (msg.authorId.$allot || msg.authorId)) continue;
      // Look for the first message from the mentioned user after the current message
      for (let i = index + 1; i < messages.length; i++) {
        const nextMsg = messages[i];
        if ((nextMsg.authorId.$allot || nextMsg.authorId) === mentionedUserId) {
          const responseTimeSeconds = (new Date(nextMsg.timestamp) - new Date(msg.timestamp)) / 1000;
          // Ensure the user entry exists even if they haven't posted before
          const responderMetrics = getUserMetrics(mentionedUserId, nextMsg.authorUsername.$allot || nextMsg.authorUsername);
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

  // Store the filtered data to Nillion
  try {
    const saveResult = await writeToNillion(aggregatedData);
    if (!saveResult.success) {
      throw new Error(`Failed to save filtered data to Nillion: ${saveResult.error}`);
    }
    
    // Store the new record IDs for the filtered data
    if (saveResult.recordIds) {
      await saveFilteredRecordIds(saveResult.recordIds);
    }
    
    console.log(`[${formatDateTime(new Date())}] Filtered discord data stored in Nillion`);
    console.log(`Filtered record IDs saved to ${FILTERED_RECORD_IDS_FILE}`);
  } catch (err) {
    console.error('Error writing filtered discord data to Nillion:', err);
  }

  return aggregatedData;
}

export { filterDiscordData };
