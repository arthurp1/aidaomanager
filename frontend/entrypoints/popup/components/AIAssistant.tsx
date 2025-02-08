import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the model
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface AIAssistantProps {
  onClose?: () => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = () => {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages from localStorage on component mount
  useEffect(() => {
    const savedMessages = localStorage.getItem('aiAssistantMessages');
    if (savedMessages) {
      const parsedMessages = JSON.parse(savedMessages).map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
      setMessages(parsedMessages);
    }
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('aiAssistantMessages', JSON.stringify(messages));
  }, [messages]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      text: prompt,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => {
      const newMessages = [...prev, userMessage];
      // Keep only last 20 messages
      return newMessages.slice(-20);
    });
    setPrompt('');
    setIsLoading(true);
    setError(null);

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const aiMessage: Message = {
        id: crypto.randomUUID(),
        text: response.text(),
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => {
        const newMessages = [...prev, aiMessage];
        // Keep only last 20 messages
        return newMessages.slice(-20);
      });
    } catch (err) {
      console.error('AI Assistant error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while connecting to the AI service');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b dark:border-gray-700">
        <h2 className="text-lg font-medium">AI Assistant</h2>
      </div>

      {/* Messages Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            No messages yet. Start a conversation!
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.sender === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-dark-hover text-gray-900 dark:text-gray-100'
              }`}
            >
              <div className="text-sm whitespace-pre-wrap">{message.text}</div>
              <div className={`text-xs mt-1 ${
                message.sender === 'user'
                  ? 'text-blue-100'
                  : 'text-gray-500 dark:text-gray-400'
              }`}>
                {formatTime(message.timestamp)}
              </div>
            </div>
          </div>
        ))}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-sm">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t dark:border-gray-700 bg-white dark:bg-dark-surface">
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
  );
}; 