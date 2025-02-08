import React, { useState, useEffect, useRef, forwardRef, ForwardedRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../db';
import { ChatBubble } from './ChatBubble';

type MessageSource = 'ai' | 'discord' | 'telegram';

interface Message {
  id: string;
  text: string;
  sender: 'user' | MessageSource;
  timestamp: Date;
  authorUsername?: string;
}

interface DiscordMessage {
  id: string;
  content: string;
  authorId: string;
  authorUsername: string;
  channelId: string;
  channelName: string;
  timestamp: string;
}

// Import Discord messages
const discordMessages: DiscordMessage[] = [
  {
    id: "1337790150926925928",
    content: "<@915927775909642240>, what up, how are you?",
    authorId: "1205593973591253083",
    authorUsername: "mauricepoot_69195",
    channelId: "1335589609991831605",
    channelName: "general",
    timestamp: "2025-02-08T14:20:26.920Z"
  },
  {
    id: "1337785552564518964",
    content: "https://meet.google.com/aux-ebwe-mdt",
    authorId: "1205593973591253083",
    authorUsername: "mauricepoot_69195",
    channelId: "1335589609991831605",
    channelName: "general",
    timestamp: "2025-02-08T14:02:10.585Z"
  },
  {
    id: "1336674720577224716",
    content: "PS. ik heb hiervoor een apart mapje aangemaakt binnen de github, genaamd frontend.\n\nJij kan een mapje maken genaamd \"backend\"\n\nDan behouden we dezelfde repository.. een monorepo wordt dat genoemd",
    authorId: "1334886393226465291",
    authorUsername: "artypwarty",
    channelId: "1335589609991831605",
    channelName: "general",
    timestamp: "2025-02-05T12:28:07.601Z"
  },
  {
    id: "1336671965888647218",
    content: "I looked at Meeting Transcript apps but their AI's are limited. Alternative solution to still have a cool MVP:\n\n- Build a https://n8n.io/ (open-source Zapier) integration, so we can get data from any application. \n- Focus on a webextension that can read from any page, including google meet.\n\nWhat are your thoughts?",
    authorId: "1334886393226465291",
    authorUsername: "artypwarty",
    channelId: "1335589609991831605",
    channelName: "general",
    timestamp: "2025-02-05T12:17:10.832Z"
  }
];

// Initialize the model
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

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
    const [connectedDiscordUser, setConnectedDiscordUser] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [activeFilter, setActiveFilter] = useState<'all' | MessageSource>('all');
    const [isInitialized, setIsInitialized] = useState(false);
    const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({});
    const [isRestoringScroll, setIsRestoringScroll] = useState(false);

    // Subscribe to global state changes
    useEffect(() => {
      const initAndSubscribe = async () => {
        try {
          // Initialize database first
          await db.init();
          
          // Subscribe to state changes
          const unsubscribe = db.subscribe((state) => {
            console.log('State updated:', state);
            // Update connected Discord user from wallet info
            const discordUser = state.walletInfo?.socials?.discord;
            console.log('Setting Discord user from subscription:', discordUser);
            setConnectedDiscordUser(discordUser || null);
            
            // Update scroll positions
            if (state.messageScrollPositions) {
              setScrollPositions(state.messageScrollPositions);
            }
            
            // Update messages
            if (state.messages) {
              const parsedMessages = state.messages
                .filter(msg => msg.sender === 'user' || msg.sender === 'ai')
                .map((msg: any) => ({
                  ...msg,
                  timestamp: new Date(msg.timestamp)
                }));
              setMessages(prev => {
                const combined = [...prev, ...parsedMessages];
                return combined
                  .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
                  .filter((msg, index, self) => 
                    index === self.findIndex(m => m.id === msg.id)
                  );
              });
            }
            
            setIsInitialized(true);
          });

          // Load Discord messages initially
          loadDiscordMessages();

          return unsubscribe;
        } catch (error) {
          console.error('Error initializing and subscribing:', error);
        }
      };

      initAndSubscribe();
    }, []);

    // Load Discord messages function
    const loadDiscordMessages = () => {
      console.log('Loading Discord messages with connected user:', connectedDiscordUser);
      const transformedMessages: Message[] = (discordMessages as DiscordMessage[])
        .filter(msg => msg.content.trim() !== '')
        .map(msg => {
          const isCurrentUser = connectedDiscordUser && (
            msg.authorUsername.toLowerCase() === connectedDiscordUser.toLowerCase() ||
            msg.authorUsername.toLowerCase() === connectedDiscordUser.split('#')[0].toLowerCase()
          );
          
          console.log('Message from:', msg.authorUsername, 'isCurrentUser:', isCurrentUser);
          
          return {
            id: msg.id,
            text: msg.content,
            sender: isCurrentUser ? 'user' : 'discord' as const,
            timestamp: new Date(msg.timestamp),
            authorUsername: msg.authorUsername
          };
        });

      setMessages(prev => {
        const combined = [...prev, ...transformedMessages];
        return combined
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
          .filter((msg, index, self) => 
            index === self.findIndex(m => m.id === msg.id)
          );
      });
    };

    // Reload Discord messages when connected user changes
    useEffect(() => {
      loadDiscordMessages();
    }, [connectedDiscordUser]);

    // Save state changes
    const saveState = async () => {
      if (!isInitialized) return;
      
      try {
        const currentState = db.getCurrentState();
        if (!currentState) return;

        await db.saveState({
          ...currentState,
          messages,
          messageScrollPositions: scrollPositions,
          messageScrollPosition: messagesContainerRef.current?.scrollTop || 0
        });
      } catch (error) {
        console.error('Error saving state:', error);
      }
    };

    // Save scroll position when changing filter
    const handleFilterChange = (newFilter: 'all' | MessageSource) => {
      if (messagesContainerRef.current) {
        setScrollPositions(prev => {
          const newPositions = {
            ...prev,
            [activeFilter]: messagesContainerRef.current?.scrollTop || 0
          };
          // Save state after updating scroll positions
          saveState();
          return newPositions;
        });
      }
      setActiveFilter(newFilter);
      setIsRestoringScroll(true);
    };

    // Restore scroll position when filter changes
    useEffect(() => {
      if (!isRestoringScroll || !messagesContainerRef.current) return;

      const scrollTop = scrollPositions[activeFilter] || 0;
      messagesContainerRef.current.scrollTop = scrollTop;
      setIsRestoringScroll(false);
    }, [activeFilter, isRestoringScroll, scrollPositions]);

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
              onClick={() => handleFilterChange(filter.id as 'all' | MessageSource)}
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
            {filteredMessages.map((message, index) => {
              const previousMessage = index > 0 ? filteredMessages[index - 1] : null;
              const nextMessage = index < filteredMessages.length - 1 ? filteredMessages[index + 1] : null;
              
              // Check if this message should show the name
              const showName = !previousMessage || 
                previousMessage.sender !== message.sender || 
                previousMessage.authorUsername !== message.authorUsername;

              // Check if this is the last message in a group
              const isLastInGroup = !nextMessage || 
                nextMessage.sender !== message.sender || 
                nextMessage.authorUsername !== message.authorUsername;

              // Check if we should show the time
              const timeDiff = nextMessage 
                ? nextMessage.timestamp.getTime() - message.timestamp.getTime() 
                : 0;
              const showTime = isLastInGroup || timeDiff > 10 * 60 * 1000; // 10 minutes in milliseconds

              return (
                <ChatBubble
                  key={message.id}
                  message={message}
                  formatTime={formatTime}
                  showName={showName}
                  showTime={showTime}
                  isLastInGroup={isLastInGroup}
                />
              );
            })}
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