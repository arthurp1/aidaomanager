const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const DATA_DIR = path.join(__dirname, '..', 'data');
const MESSAGES_DATA_FILE = path.join(DATA_DIR, 'discord_messages.json');
const MESSAGES_DOCS_FILE = path.join(DATA_DIR, 'discord_messages_docs.md');

// Initialize Discord client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

async function loadExistingMessages() {
    try {
        const data = await fs.readFile(MESSAGES_DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

async function saveMessages(messages) {
    await fs.writeFile(MESSAGES_DATA_FILE, JSON.stringify(messages, null, 2));
}

async function generateDocs(sampleMessage) {
    const docs = `# Discord Messages Data Structure

This document describes the structure of the discord_messages.json file.

## Fields

| Field | Type | Description |
|-------|------|-------------|
| id | String | Unique message ID |
| content | String | Message content |
| authorId | String | ID of the message author |
| authorUsername | String | Username of the message author |
| channelId | String | ID of the channel |
| channelName | String | Name of the channel |
| timestamp | String | ISO timestamp of when the message was sent |
| editedTimestamp | String | ISO timestamp of last edit (null if not edited) |
| attachments | Array | List of attachment URLs |
| embeds | Array | List of message embeds |

## Example Data

\`\`\`json
${JSON.stringify(sampleMessage, null, 2)}
\`\`\``;

    await fs.writeFile(MESSAGES_DOCS_FILE, docs);
}

async function fetchAndStoreMessages() {
    try {
        // Get existing messages
        const existingMessages = await loadExistingMessages();
        const existingIds = new Set(existingMessages.map(m => m.id));
        
        // Find the general channel
        const guilds = Array.from(client.guilds.cache.values());
        let generalChannel;
        
        for (const guild of guilds) {
            const channel = guild.channels.cache.find(ch => 
                ch.name === 'general' && ch.type === 0
            );
            if (channel) {
                generalChannel = channel;
                break;
            }
        }

        if (!generalChannel) {
            console.error('No general channel found');
            return;
        }

        // Fetch messages
        const messages = [];
        let lastId;

        while (true) {
            const options = { limit: 100 };
            if (lastId) {
                options.before = lastId;
            }

            const fetchedMessages = await generalChannel.messages.fetch(options);
            if (fetchedMessages.size === 0) break;

            for (const message of fetchedMessages.values()) {
                if (!existingIds.has(message.id)) {
                    messages.push({
                        id: message.id,
                        content: message.content,
                        authorId: message.author.id,
                        authorUsername: message.author.username,
                        channelId: message.channel.id,
                        channelName: message.channel.name,
                        timestamp: message.createdAt.toISOString(),
                        editedTimestamp: message.editedAt?.toISOString() || null,
                        attachments: Array.from(message.attachments.values()).map(a => a.url),
                        embeds: message.embeds.map(e => e.data)
                    });
                    existingIds.add(message.id);
                }
            }

            lastId = fetchedMessages.last().id;
        }

        // Combine and save messages
        const allMessages = [...existingMessages, ...messages];
        await saveMessages(allMessages);

        // Generate docs if we have messages
        if (allMessages.length > 0) {
            await generateDocs(allMessages[0]);
        }

        return allMessages;
    } catch (error) {
        console.error('Error fetching messages:', error);
        throw error;
    }
}

// Export the fetch function for CLI use
module.exports = {
    fetchAndStoreMessages,
    client
};

// Connect to Discord
client.login(process.env.DISCORD_TOKEN);

client.once('ready', () => {
    console.log('Discord bot is ready!');
});