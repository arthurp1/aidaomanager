import React, { useState } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';

type MessageDestination = 'ai' | 'discord' | 'telegram';

interface MessageInputProps {
  onSubmit: (message: string, destination: MessageDestination) => void;
  isLoading?: boolean;
  connectedAccounts?: {
    discord?: string;
    telegram?: string;
  };
}

export const MessageInput: React.FC<MessageInputProps> = ({ 
  onSubmit, 
  isLoading = false,
  connectedAccounts = {}
}) => {
  const [input, setInput] = useState('');
  const [destination, setDestination] = useState<MessageDestination>('ai');
  const [showConnectionAlert, setShowConnectionAlert] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    // Check if social account is connected before submitting
    if (destination === 'discord' && !connectedAccounts.discord) {
      setShowConnectionAlert(true);
      setTimeout(() => setShowConnectionAlert(false), 3000);
      return;
    }
    
    if (destination === 'telegram' && !connectedAccounts.telegram) {
      setShowConnectionAlert(true);
      setTimeout(() => setShowConnectionAlert(false), 3000);
      return;
    }
    
    onSubmit(input, destination);
    setInput('');
    setShowConnectionAlert(false);
  };

  const getDestinationIcon = () => {
    switch (destination) {
      case 'ai':
        return <span className="text-blue-500 font-medium">AI</span>;
      case 'discord':
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
        );
      case 'telegram':
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
          </svg>
        );
    }
  };

  const getPlaceholderText = () => {
    switch (destination) {
      case 'ai':
        return 'Ask AI...';
      case 'discord':
        return 'Send to Discord...';
      case 'telegram':
        return 'Send to Telegram...';
    }
  };

  const cycleDestination = () => {
    const destinations: MessageDestination[] = ['ai', 'discord', 'telegram'];
    const currentIndex = destinations.indexOf(destination);
    const nextIndex = (currentIndex + 1) % destinations.length;
    setDestination(destinations[nextIndex]);
    setShowConnectionAlert(false);
  };

  return (
    <div className="sticky bottom-12 z-10 border-t dark:border-gray-700 bg-white dark:bg-dark-surface overflow-hidden">
      {/* Connection Alert */}
      {showConnectionAlert && (
        <div className="px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 text-sm">
          Please connect your {destination} account in Profile settings to send messages
        </div>
      )}
      
      <form className="flex" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder={getPlaceholderText()}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 px-3 py-1.5 bg-transparent text-sm focus:outline-none"
          disabled={isLoading}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (input.trim()) {
                handleSubmit(e);
              }
            }
          }}
        />
        <div className="flex items-center gap-2 px-2">
          <button
            type="button"
            onClick={cycleDestination}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors"
            title={`Send to ${destination.charAt(0).toUpperCase() + destination.slice(1)}`}
          >
            <div className="w-5 h-5 flex items-center justify-center text-gray-500 dark:text-gray-400">
              {getDestinationIcon()}
            </div>
          </button>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-1.5 text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <PaperAirplaneIcon className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}; 