import React, { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the model
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

interface AIAssistantProps {
  onClose?: () => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      setResponse(response.text());
    } catch (err) {
      console.error('AI Assistant error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while connecting to the AI service');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-dark-surface rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-medium">AI Assistant</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {response && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-dark-hover rounded">
              <pre className="whitespace-pre-wrap font-sans text-sm">
                {response}
              </pre>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-4 border-t dark:border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask anything..."
              className="flex-1 px-3 py-2 bg-gray-50 dark:bg-dark-hover border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500 dark:focus:border-blue-400"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !prompt.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Thinking...</span>
                </>
              ) : (
                'Send'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 