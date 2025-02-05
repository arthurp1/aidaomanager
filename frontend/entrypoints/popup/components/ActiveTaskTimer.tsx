import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface ActiveTaskTimerProps {
  task: {
    id: string;
    title: string;
    estimatedTime: number;
    domain: string;
  };
  onStop: () => void;
}

export const ActiveTaskTimer: React.FC<ActiveTaskTimerProps> = ({ task, onStop }) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isAutoTracking, setIsAutoTracking] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning) {
      interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRunning]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleStartStop = () => {
    if (!isRunning) {
      setStartTime(new Date());
    }
    setIsRunning(!isRunning);
  };

  const handleAutoTrackingToggle = () => {
    setIsAutoTracking(!isAutoTracking);
    if (!isAutoTracking) {
      setIsRunning(true);
      setStartTime(new Date());
    }
  };

  const handleStop = () => {
    setIsRunning(false);
    setIsAutoTracking(false);
    onStop();
  };

  return (
    <div className="p-4 bg-white dark:bg-dark-surface rounded-lg shadow">
      <div className="mb-4">
        <h3 className="text-lg font-medium">{task.title}</h3>
        <p className="text-gray-600 dark:text-gray-400">Domain: {task.domain}</p>
        <p className="text-gray-600 dark:text-gray-400">
          Estimated Time: {task.estimatedTime} hours
        </p>
      </div>

      <div className="text-center mb-4">
        <div className="text-4xl font-mono mb-2">{formatTime(elapsedTime)}</div>
        {startTime && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Started at: {format(startTime, 'HH:mm:ss')}
          </div>
        )}
      </div>

      <div className="flex justify-center space-x-4">
        <button
          onClick={handleStartStop}
          className={`px-4 py-2 rounded text-white ${
            isRunning
              ? 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800'
              : 'bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800'
          }`}
          disabled={isAutoTracking}
        >
          {isRunning ? 'Pause' : 'Start'}
        </button>
        <button
          onClick={handleAutoTrackingToggle}
          className={`px-4 py-2 rounded text-white ${
            isAutoTracking
              ? 'bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-700 dark:hover:bg-yellow-800'
              : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800'
          }`}
        >
          {isAutoTracking ? 'Disable Auto-tracking' : 'Enable Auto-tracking'}
        </button>
        <button
          onClick={handleStop}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-800 text-white rounded"
        >
          Stop Task
        </button>
      </div>

      {isAutoTracking && (
        <div className="mt-4 p-2 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded">
          Auto-tracking is enabled. Timer will run while you're on {task.domain}
        </div>
      )}
    </div>
  );
}; 