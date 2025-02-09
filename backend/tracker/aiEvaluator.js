import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES Modules don't have __dirname, so we need to create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure dotenv to look for .env in the correct location
dotenv.config({ path: path.join(__dirname, '../.env') });

class AIEvaluator {
    constructor() {
        const apiKey = process.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('Google AI API key not found in environment variables');
        }
        const genAI = new GoogleGenerativeAI(apiKey);
        this.model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    }

    async evaluate(filteredData, requirement, taskId) {
        try {
            const prompt = this.buildPrompt(filteredData, requirement);
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const evaluation = this.parseEvaluation(response.text());
            
            return {
                taskId,
                requirementId: requirement.id,
                level: evaluation.level,
                message: evaluation.message,
                proof: evaluation.proof,
                timestamp: new Date().toISOString(),
                shouldNotify: this.shouldSendNotification(evaluation.level)
            };
        } catch (error) {
            console.error('AI evaluation error:', error);
            return {
                taskId,
                requirementId: requirement.id,
                level: 'Error',
                message: 'Unable to evaluate performance at this time.',
                proof: 'AI service error',
                timestamp: new Date().toISOString(),
                shouldNotify: false
            };
        }
    }

    buildPrompt(filteredData, requirement) {
        return `
        Evaluate Discord activity based on the following requirement:
        ${JSON.stringify(requirement)}
        
        Using this filtered activity data:
        ${JSON.stringify(filteredData)}
        
        Please analyze the engagement and provide feedback in this JSON format:
        {
            "level": "Excellent/Ok/Poor",
            "message": "A friendly one-line message with exactly one emoji that focuses on engagement without mentioning specific metrics",
            "proof": "Brief observation of patterns without raw data"
        }
        
        Guidelines:
        - Focus on patterns and trends, not raw numbers
        - Be encouraging and constructive
        - Give encouragement for "Poor" ratings
        - Celebrate for "Excellent" ratings
        - Avoid mentioning specific requirements or metrics in the message
        - Write as if you're a supportive team member sending a quick chat message
        - Keep the message concise and actionable as a private one-line message from a manager/other member of the team to a team member
        - Include exactly one emoji, preferably at the end, to add a friendly tone
        - Ensure the message sounds natural, like a kind manager giving a nudge
        `;
    }

    parseEvaluation(response) {
        try {
            const evaluation = JSON.parse(response);
            return {
                level: evaluation.level,
                message: evaluation.message,
                proof: evaluation.proof
            };
        } catch (error) {
            console.error('Error parsing AI response:', error);
            return {
                level: 'Error',
                message: 'Unable to evaluate performance at this time.',
                proof: 'Evaluation parsing error'
            };
        }
    }

    shouldSendNotification(level) {
        return level === 'Excellent' || level === 'Poor';
    }
}

// Create and export a singleton instance
const aiEvaluator = new AIEvaluator();
export default aiEvaluator; 