import React, { useState, useEffect, useRef, forwardRef, ForwardedRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../db';

// Initialize the model
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

type MessageSource = 'ai' | 'discord' | 'telegram';

interface Message {
  id: string;
  text: string;
  sender: 'user' | MessageSource;
  timestamp: Date;
}

interface AIAssistantProps {
  onClose?: () => void;
  isLoading: boolean;
  error: string | null;
}

export interface AIAssistantHandle {
  addMessage: (message: Message) => void;
}

export const AIAssistant = forwardRef<AIAssistantHandle, AIAssistantProps>(
  ({ isLoading, error }, ref) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [activeFilter, setActiveFilter] = useState<'all' | MessageSource>('all');
    const [isInitialized, setIsInitialized] = useState(false);

    // Load messages and scroll position from database on component mount
    useEffect(() => {
      const loadState = async () => {
        try {
          const savedState = await db.getState();
          if (savedState.messages) {
            const parsedMessages = savedState.messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }));
            setMessages(parsedMessages);
          }
          
          // Restore scroll position after messages are loaded
          if (savedState.messageScrollPosition && messagesContainerRef.current) {
            setTimeout(() => {
              if (messagesContainerRef.current) {
                messagesContainerRef.current.scrollTop = savedState.messageScrollPosition;
              }
            }, 0);
          }
          
          setIsInitialized(true);
        } catch (error) {
          console.error('Error loading messages state:', error);
        }
      };

      loadState();
    }, []);

    // Save messages to database whenever they change
    useEffect(() => {
      if (!isInitialized) return;

      const saveState = async () => {
        try {
          await db.saveState({
            messages,
            messageScrollPosition: messagesContainerRef.current?.scrollTop || 0
          });
        } catch (error) {
          console.error('Error saving messages state:', error);
        }
      };

      saveState();
    }, [messages, isInitialized]);

    // Save scroll position when scrolling stops
    useEffect(() => {
      if (!isInitialized) return;

      const saveScrollPosition = async () => {
        try {
          await db.saveState({
            messages,
            messageScrollPosition: messagesContainerRef.current?.scrollTop || 0
          });
        } catch (error) {
          console.error('Error saving scroll position:', error);
        }
      };

      const debouncedSave = debounce(saveScrollPosition, 200);

      const handleScroll = () => {
        debouncedSave();
      };

      messagesContainerRef.current?.addEventListener('scroll', handleScroll);
      return () => {
        messagesContainerRef.current?.removeEventListener('scroll', handleScroll);
      };
    }, [messages, isInitialized]);

    // Scroll to bottom for new messages only if already at bottom
    useEffect(() => {
      if (!messagesContainerRef.current || !messagesEndRef.current) return;

      const container = messagesContainerRef.current;
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;

      if (isAtBottom) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, [messages]);

    const formatTime = (date: Date) => {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Debounce helper function
    const debounce = (func: Function, wait: number) => {
      let timeout: NodeJS.Timeout;
      return function executedFunction(...args: any[]) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    };

    // Export the addMessage function to be used by the parent component
    React.useImperativeHandle(
      ref,
      () => ({
        addMessage: (message: Message) => {
          setMessages(prev => {
            const newMessages = [...prev, message];
            // Keep only last 50 messages
            return newMessages.slice(-50);
          });
        }
      }),
      []
    );

    const filteredMessages = messages.filter(message => 
      message.sender === 'user' || activeFilter === 'all' || message.sender === activeFilter
    );

    return (
      <div className="flex flex-col h-full">
        {/* Fixed Filter Badges */}
        <div className="sticky top-0 z-10 bg-white dark:bg-dark-surface px-3 py-2 border-b dark:border-gray-700 flex gap-2 overflow-hidden">
          {[
            { id: 'all', label: 'All' },
            { id: 'ai', label: 'Private AI' },
            { id: 'discord', label: 'Discord' },
            { id: 'telegram', label: 'Telegram' }
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id as 'all' | MessageSource)}
              className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeFilter === filter.id
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-100 dark:bg-dark-hover text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-hover/70'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Scrollable Messages Container */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {filteredMessages.length === 0 && (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                {activeFilter === 'all' 
                  ? 'No messages yet. Start a conversation!'
                  : `No ${activeFilter} messages yet.`}
              </div>
            )}
            {filteredMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.sender === 'user'
                      ? 'bg-blue-600 text-white'
                      : message.sender === 'discord'
                      ? 'bg-indigo-100 dark:bg-indigo-900/30 text-gray-900 dark:text-gray-100'
                      : message.sender === 'telegram'
                      ? 'bg-sky-100 dark:bg-sky-900/30 text-gray-900 dark:text-gray-100'
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
            {isLoading && (
              <div className="flex justify-center">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>
    );
  }
); 