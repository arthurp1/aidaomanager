import {
    AgentKit,
    CdpWalletProvider,
    wethActionProvider,
    walletActionProvider,
    erc20ActionProvider,
    cdpApiActionProvider,
    cdpWalletActionProvider,
    pythActionProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as readline from "readline";
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

// Required environment variables for DAO operations
const requiredVars = [
    "OPENAI_API_KEY",
    "CDP_API_KEY_NAME",
    "CDP_API_KEY_PRIVATE_KEY",
    "DAO_CONTRACT_ADDRESS",
    "DAO_TREASURY_ADDRESS"
];

/**
 * Validates that required environment variables are set
 *
 * @throws {Error} - If required environment variables are missing
 */
function validateEnvironment() {
    const missingVars = [];

    requiredVars.forEach(varName => {
        if (!process.env[varName]) {
            missingVars.push(varName);
        }
    });

    if (missingVars.length > 0) {
        console.error("Error: Required environment variables are not set");
        missingVars.forEach(varName => {
            console.error(`${varName}=your_${varName.toLowerCase()}_here`);
        });
        process.exit(1);
    }

    if (!process.env.NETWORK_ID) {
        console.warn("Warning: NETWORK_ID not set, defaulting to base-sepolia testnet");
    }
}

validateEnvironment();

// Configure files for persisting DAO and wallet data
const WALLET_DATA_FILE = "wallet_data.txt";
const DAO_DATA_FILE = "dao_data.json";
const TASKS_FILE = "tasks.json";

// DAO Management Functions
async function getDAOBalance() {
    try {
        const balance = await agentkit.getBalance(process.env.DAO_TREASURY_ADDRESS);
        return balance;
    } catch (error) {
        console.error('Error getting DAO balance:', error);
        throw error;
    }
}

async function calculateNextPayout() {
    try {
        const currentTime = Date.now();
        const lastPayout = await getLastPayoutTimestamp();
        const payoutInterval = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
        return new Date(lastPayout + payoutInterval);
    } catch (error) {
        console.error('Error calculating next payout:', error);
        throw error;
    }
}

async function getLastPayoutTimestamp() {
    try {
        const daoData = JSON.parse(await fs.readFile(DAO_DATA_FILE, 'utf8'));
        return daoData.lastPayout || Date.now();
    } catch {
        return Date.now();
    }
}

async function processMassPayout(recipients) {
    try {
        const balance = await getDAOBalance();
        if (balance <= 0) {
            throw new Error('Insufficient DAO treasury balance');
        }

        const payouts = [];
        for (const recipient of recipients) {
            const payout = await agentkit.transfer({
                to: recipient.address,
                amount: recipient.amount,
                token: process.env.PAYMENT_TOKEN_ADDRESS
            });
            payouts.push(payout);
        }

        // Update DAO data
        const daoData = {
            lastPayout: Date.now(),
            payoutHistory: payouts
        };
        await fs.writeFile(DAO_DATA_FILE, JSON.stringify(daoData, null, 2));

        return payouts;
    } catch (error) {
        console.error('Error processing mass payout:', error);
        throw error;
    }
}

/**
 * Create a new task with the specified details
 * 
 * @param {Object} taskDetails - The details of the task to create
 * @returns {Promise<Object>} The created task
 */
async function createTask(taskDetails) {
    try {
        // Read existing tasks
        let tasks = [];
        try {
            const tasksData = await fs.readFile(TASKS_FILE, 'utf8');
            tasks = JSON.parse(tasksData);
        } catch (error) {
            // If file doesn't exist or is invalid, start with empty array
            console.log('No existing tasks found, starting fresh');
        }

        // Create new task with default values
        const newTask = {
            id: uuidv4(),
            createdAt: new Date().toISOString(),
            status: 'open',
            estimatedTime: 0,
            trackedTime: 0,
            ...taskDetails
        };

        // Add required fields if not provided
        if (!newTask.title) {
            throw new Error('Task title is required');
        }

        if (!newTask.requirements) {
            newTask.requirements = [];
        }

        if (!newTask.tools) {
            newTask.tools = [];
        }

        // Add task to array
        tasks.push(newTask);

        // Save updated tasks
        await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2));

        return newTask;
    } catch (error) {
        console.error('Error creating task:', error);
        throw error;
    }
}

/**
 * Initialize the agent with CDP Agentkit and DAO management capabilities
 *
 * @returns Agent executor and config
 */
async function initializeAgent() {
    try {
        const llm = new ChatOpenAI({
            model: "gpt-4-turbo-preview",
        });

        let walletDataStr = null;

        if (fs.existsSync(WALLET_DATA_FILE)) {
            try {
                walletDataStr = fs.readFileSync(WALLET_DATA_FILE, "utf8");
            } catch (error) {
                console.error("Error reading wallet data:", error);
            }
        }

        const config = {
            apiKeyName: process.env.CDP_API_KEY_NAME,
            apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
            cdpWalletData: walletDataStr || undefined,
            networkId: process.env.NETWORK_ID || "base-sepolia",
            daoContractAddress: process.env.DAO_CONTRACT_ADDRESS,
            daoTreasuryAddress: process.env.DAO_TREASURY_ADDRESS
        };

        const walletProvider = await CdpWalletProvider.configureWithWallet(config);

        const agentkit = await AgentKit.from({
            walletProvider,
            actionProviders: [
                wethActionProvider(),
                pythActionProvider(),
                walletActionProvider(),
                erc20ActionProvider(),
                cdpApiActionProvider({
                    apiKeyName: process.env.CDP_API_KEY_NAME,
                    apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
                }),
                cdpWalletActionProvider({
                    apiKeyName: process.env.CDP_API_KEY_NAME,
                    apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
                }),
            ],
        });

        const tools = await getLangChainTools(agentkit);

        // Add DAO management tools
        tools.push({
            name: 'getDAOBalance',
            description: 'Get the current balance of the DAO treasury',
            func: getDAOBalance
        });

        tools.push({
            name: 'calculateNextPayout',
            description: 'Calculate the next expected payout date',
            func: calculateNextPayout
        });

        tools.push({
            name: 'processMassPayout',
            description: 'Process mass payout to multiple recipients',
            func: processMassPayout
        });

        // Add task management tools
        tools.push({
            name: 'createTask',
            description: 'Create a new task with specified details. Required fields: title. Optional fields: description, requirements (array), tools (array), estimatedTime (in hours), priority (high/medium/low)',
            func: createTask
        });

        const memory = new MemorySaver();
        const agentConfig = { configurable: { thread_id: "AI DAO Manager Agent" } };

        const agent = createReactAgent({
            llm,
            tools,
            checkpointSaver: memory,
            messageModifier: `
                You are an AI DAO Manager agent that helps manage decentralized autonomous organizations.
                Your capabilities include:
                - Managing DAO treasury funds and checking balances
                - Processing mass payouts to contributors
                - Calculating and scheduling upcoming payouts
                - Monitoring and reporting on DAO financial health
                - Creating and managing tasks for the DAO
                - Assisting with task management and contributor rewards
                
                For task management:
                - Always create tasks with clear titles and descriptions
                - Include any specific requirements or tools needed
                - Estimate time requirements when possible
                - Set appropriate priority levels
                - Track task status and progress
                
                You can interact with the blockchain using the Coinbase Developer Platform AgentKit.
                If you need test funds, you can request them from the faucet on the base-sepolia network.
                
                Before executing financial transactions:
                1. Always check the DAO treasury balance
                2. Verify recipient addresses
                3. Confirm transaction amounts are within budget
                4. Keep track of payout schedules
                
                If you encounter a 5XX error, ask the user to try again later.
                If asked to perform an action beyond your current tools, explain that it's not
                currently supported and suggest implementing it using the CDP SDK + Agentkit.
                Direct users to docs.cdp.coinbase.com for more information.
                
                Be concise, professional, and security-conscious in your responses.
            `,
        });

        const exportedWallet = await walletProvider.exportWallet();
        fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(exportedWallet));

        return { agent, config: agentConfig };
    } catch (error) {
        console.error("Failed to initialize agent:", error);
        throw error;
    }
}

/**
 * Run the agent autonomously with specified intervals
 *
 * @param agent - The agent executor
 * @param config - Agent configuration
 * @param interval - Time interval between actions in seconds
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runAutonomousMode(agent, config, interval = 10) {
    console.log("Starting autonomous mode...");

    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            const thought =
                "Be creative and do something interesting on the blockchain. " +
                "Choose an action or set of actions and execute it that highlights your abilities.";

            const stream = await agent.stream({ messages: [new HumanMessage(thought)] }, config);

            for await (const chunk of stream) {
                if ("agent" in chunk) {
                    console.log(chunk.agent.messages[0].content);
                } else if ("tools" in chunk) {
                    console.log(chunk.tools.messages[0].content);
                }
                console.log("-------------------");
            }

            await new Promise(resolve => setTimeout(resolve, interval * 1000));
        } catch (error) {
            if (error instanceof Error) {
                console.error("Error:", error.message);
            }
            process.exit(1);
        }
    }
}

/**
 * Run the agent interactively based on user input
 *
 * @param agent - The agent executor
 * @param config - Agent configuration
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runChatMode(agent, config) {
    console.log("Starting chat mode... Type 'exit' to end.");

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const question = (prompt) =>
        new Promise(resolve => rl.question(prompt, resolve));

    try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const userInput = await question("\nPrompt: ");

            if (userInput.toLowerCase() === "exit") {
                break;
            }

            const stream = await agent.stream({ messages: [new HumanMessage(userInput)] }, config);

            for await (const chunk of stream) {
                if ("agent" in chunk) {
                    console.log(chunk.agent.messages[0].content);
                } else if ("tools" in chunk) {
                    console.log(chunk.tools.messages[0].content);
                }
                console.log("-------------------");
            }
        }
    } catch (error) {
        if (error instanceof Error) {
            console.error("Error:", error.message);
        }
        process.exit(1);
    } finally {
        rl.close();
    }
}

/**
 * Choose whether to run in autonomous or chat mode based on user input
 *
 * @returns {Promise<string>} Selected mode
 */
async function chooseMode() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const question = (prompt) =>
        new Promise(resolve => rl.question(prompt, resolve));

    // eslint-disable-next-line no-constant-condition
    while (true) {
        console.log("\nAvailable modes:");
        console.log("1. chat    - Interactive chat mode");
        console.log("2. auto    - Autonomous action mode");

        const choice = (await question("\nChoose a mode (enter number or name): "))
            .toLowerCase()
            .trim();

        if (choice === "1" || choice === "chat") {
            rl.close();
            return "chat";
        } else if (choice === "2" || choice === "auto") {
            rl.close();
            return "auto";
        }
        console.log("Invalid choice. Please try again.");
    }
}

/**
 * Start the chatbot agent
 */
async function main() {
    try {
        const { agent, config } = await initializeAgent();
        const mode = await chooseMode();

        if (mode === "chat") {
            await runChatMode(agent, config);
        } else {
            await runAutonomousMode(agent, config);
        }
    } catch (error) {
        if (error instanceof Error) {
            console.error("Error:", error.message);
        }
        process.exit(1);
    }
}

if (require.main === module) {
    console.log("Starting Agent...");
    main().catch(error => {
        console.error("Fatal error:", error);
        process.exit(1);
    });
}