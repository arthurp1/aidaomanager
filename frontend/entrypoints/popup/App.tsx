import React, { useState, useEffect } from 'react';
import { TaskTable } from './components/TaskTable';
import { ActiveTaskTimer } from './components/ActiveTaskTimer';
import { ThemeToggle } from './components/ThemeToggle';
import './App.css';

interface Task {
  id: string;
  title: string;
  estimatedTime: number;
  domain: string;
  status: 'active' | 'inactive' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  totalTimeSpent?: number;
  category?: string;
  priority?: 'low' | 'medium' | 'high';
}

function App() {
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);

  useEffect(() => {
    // Check for saved theme preference or system preference
    if (localStorage.theme === 'dark' || 
        (!('theme' in localStorage) && 
         window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const handleTaskActivation = (tasks: Task[]) => {
    setActiveTasks(tasks);
  };

  const handleTaskStop = (taskId: string) => {
    setActiveTasks((prev) => prev.filter((task) => task.id !== taskId));
  };

  return (
    <div className="w-[400px] bg-gray-100 dark:bg-dark-bg text-gray-900 dark:text-gray-100 transition-colors">
      <div>
        <div className="flex justify-between items-center p-2 border-b dark:border-gray-700">
          <h1 className="text-xl font-bold">Time Tracker</h1>
          <ThemeToggle />
        </div>
        
        {/* Active Tasks Section */}
        {activeTasks.length > 0 && (
          <div className="border-b dark:border-gray-700">
            <div className="p-2">
              <h2 className="text-lg font-semibold mb-2">Active Tasks</h2>
              <div className="space-y-2">
                {activeTasks.map((task) => (
                  <ActiveTaskTimer
                    key={task.id}
                    task={task}
                    onStop={() => handleTaskStop(task.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Task Management Section */}
        <div className="bg-white dark:bg-dark-surface">
          <TaskTable onTaskActivation={handleTaskActivation} />
        </div>
      </div>
    </div>
  );
}

export default App;
