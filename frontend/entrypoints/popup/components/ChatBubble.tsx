import React from 'react';

type MessageSource = 'ai' | 'discord' | 'telegram';

interface Message {
  id: string;
  text: string;
  sender: 'user' | MessageSource;
  timestamp: Date;
  authorUsername?: string; // Optional author name for Discord messages
}

interface ChatBubbleProps {
  message: Message;
  formatTime: (date: Date) => string;
  showName?: boolean; // Whether to show the name (for consecutive messages)
  showTime?: boolean;
  isLastInGroup?: boolean;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ 
  message, 
  formatTime, 
  showName = true,
  showTime = true,
  isLastInGroup = true
}) => {
  const displayName = message.sender === 'user' ? 'You' : message.authorUsername;
  console.log('ChatBubble rendering message:', { sender: message.sender, authorUsername: message.authorUsername, displayName });

  return (
    <div className={`${message.sender === 'user' ? 'items-end' : 'items-start'} flex flex-col ${isLastInGroup ? 'mb-2' : 'mb-0.5'}`}>
      {showName && displayName && message.sender !== 'ai' && (
        <div className={`text-[11px] font-medium mb-0.5 px-0.5 ${
          message.sender === 'user'
            ? 'text-gray-500 dark:text-gray-400'
            : message.sender === 'discord'
            ? 'text-indigo-600 dark:text-indigo-400'
            : 'text-sky-600 dark:text-sky-400'
        }`}>
          {displayName}
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-lg px-3 py-1.5 ${
          message.sender === 'user'
            ? 'bg-blue-600 text-white ml-auto'
            : message.sender === 'discord'
            ? 'bg-indigo-100 dark:bg-indigo-900/30 text-gray-900 dark:text-gray-100'
            : message.sender === 'telegram'
            ? 'bg-sky-100 dark:bg-sky-900/30 text-gray-900 dark:text-gray-100'
            : 'bg-gray-100 dark:bg-dark-hover text-gray-900 dark:text-gray-100'
        }`}
      >
        <div className="text-[13px] leading-[1.4] whitespace-pre-wrap text-left">{message.text}</div>
      </div>
      {showTime && (
        <div className={`text-[10px] mt-0.5 px-0.5 text-gray-500 dark:text-gray-400 ${
          message.sender === 'user' ? 'ml-auto' : ''
        }`}>
          {formatTime(message.timestamp)}
        </div>
      )}
    </div>
  );
}; 