import React, { useState, useEffect, useRef } from 'react';
import { TaskTable } from './components/TaskTable';
import {
  Cog6ToothIcon,
  UserCircleIcon,
  ChatBubbleLeftIcon,
  ClipboardDocumentListIcon,
  SunIcon,
  MoonIcon
} from '@heroicons/react/24/outline';
import './App.css';

interface SubTask {
  id: string;
  title: string;
  estimatedTime: number;
  domain: string;
  status: 'active' | 'inactive' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  totalTimeSpent?: number;
  roleId: string;
  taskId: string;
}

interface Task {
  id: string;
  title: string;
  roleId: string;
  createdAt: Date;
  isCollapsed: boolean;
  estimatedTime: number;
  tools: string[];
  trackedTime: number;
}

interface Role {
  id: string;
  name: string;
  createdAt: Date;
  tools: string[];
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [roles, setRoles] = useState<Role[]>([{
    id: 'everyone',
    name: 'Everyone',
    createdAt: new Date(),
    tools: []
  }]);
  const [selectedRole, setSelectedRole] = useState<string>('everyone');
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [toolSearch, setToolSearch] = useState('');
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskTime, setNewTaskTime] = useState<number>(0);
  const [newTaskTools, setNewTaskTools] = useState<string[]>([]);
  const [taskToolSearch, setTaskToolSearch] = useState('');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [isHoveringTaskList, setIsHoveringTaskList] = useState(false);
  const [isHoveringRoles, setIsHoveringRoles] = useState(false);
  const appRef = useRef<HTMLDivElement>(null);
  const [currentView, setCurrentView] = useState<'tasks' | 'chat' | 'profile' | 'settings'>('tasks');
  const [isDark, setIsDark] = useState(false);

  // Tool suggestions data
  const toolCategories = {
    design: {
      "canva.com": "Online graphic design platform",
      "figma.com": "Collaborative interface design tool",
      "miro.com": "Online collaborative whiteboard"
    },
    social: {
      "web.whatsapp.com": "Web-based WhatsApp messenger",
      "discord.com/app": "Chat and community platform",
      "slack.com": "Business communication platform",
      "teams.microsoft.com": "Microsoft Teams collaboration tool",
      "telegram.org/webapp": "Web-based Telegram messenger",
      "messenger.com": "Facebook Messenger web interface",
      "linkedin.com": "Professional networking platform"
    },
    productivity: {
      "notion.so": "All-in-one workspace",
      "trello.com": "Project management tool",
      "asana.com": "Team project management",
      "monday.com": "Work management platform",
      "clickup.com": "Project management software",
      "todoist.com": "Task management tool",
      "evernote.com": "Note-taking app"
    },
    development: {
      "github.com": "Code hosting platform",
      "gitlab.com": "DevOps platform",
      "bitbucket.org": "Git code management",
      "codepen.io": "Front-end development playground",
      "codesandbox.io": "Online code editor",
      "replit.com": "Collaborative coding platform",
      "stackoverflow.com": "Developer Q&A community"
    },
    video_conferencing: {
      "zoom.us": "Video conferencing platform",
      "meet.google.com": "Google Meet video calls"
    },
    documentation: {
      "docs.google.com": "Google Docs online editor",
      "confluence.atlassian.com": "Team documentation"
    }
  };

  const getFilteredTools = () => {
    const allTools: { url: string; description: string; category: string }[] = [];
    Object.entries(toolCategories).forEach(([category, tools]) => {
      Object.entries(tools).forEach(([url, description]) => {
        allTools.push({ url, description, category });
      });
    });

    return allTools.filter(
      tool => 
        !selectedTools.includes(tool.url) && 
        (tool.url.toLowerCase().includes(toolSearch.toLowerCase()) ||
         tool.description.toLowerCase().includes(toolSearch.toLowerCase()) ||
         tool.category.toLowerCase().includes(toolSearch.toLowerCase()))
    );
  };

  useEffect(() => {
    // Check initial theme
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDark(e.matches);
      updateTheme(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const updateTheme = (dark: boolean) => {
    if (dark) {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
    }
  };

  const toggleTheme = () => {
    setIsDark(!isDark);
    updateTheme(!isDark);
  };

  const handleCreateSubtask = (newSubtask: { title: string; estimatedTime: number; domain: string; roleId: string; taskId: string }) => {
    const newSubtaskData: SubTask = {
      id: crypto.randomUUID(),
      ...newSubtask,
      status: 'inactive',
      createdAt: new Date(),
      updatedAt: new Date(),
      totalTimeSpent: 0,
    };

    setSubtasks(prev => [...prev, newSubtaskData]);
  };

  const handleCreateTask = () => {
    if (!newTaskName.trim() || !selectedRole) return;

    const newTask: Task = {
      id: crypto.randomUUID(),
      title: newTaskName,
      roleId: selectedRole,
      createdAt: new Date(),
      isCollapsed: true,
      estimatedTime: newTaskTime,
      tools: newTaskTools,
      trackedTime: 0,
    };

    setTasks(prev => [...prev, newTask]);
    setNewTaskName('');
    setNewTaskTime(0);
    setNewTaskTools([]);
    setTaskToolSearch('');
  };

  const toggleTaskCollapse = (taskId: string) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === taskId ? { ...task, isCollapsed: !task.isCollapsed } : task
      )
    );
  };

  const handleCreateRole = () => {
    if (!newRoleName.trim()) return;

    const newRole: Role = {
      id: crypto.randomUUID(),
      name: newRoleName,
      createdAt: new Date(),
      tools: selectedTools,
    };

    setRoles(prev => [...prev, newRole]);
    setNewRoleName('');
    setSelectedTools([]);
    setToolSearch('');
    setIsRoleModalOpen(false);
    setSelectedRole(newRole.id);
  };

  const handleUpdateRole = () => {
    if (!editingRole || !newRoleName.trim()) return;

    setRoles(prev => prev.map(r => 
      r.id === editingRole.id ? { ...r, name: newRoleName, tools: selectedTools } : r
    ));
    setNewRoleName('');
    setSelectedTools([]);
    setToolSearch('');
    setEditingRole(null);
    setIsRoleModalOpen(false);
  };

  const handleEditRole = (role: Role) => {
    if (role.id === 'everyone') return; // Prevent editing Everyone role
    setEditingRole(role);
    setNewRoleName(role.name);
    setSelectedTools(role.tools);
    setIsRoleModalOpen(true);
  };

  const getFilteredTasks = (roleId: string) => {
    if (roleId === 'everyone') {
      return tasks;
    }
    return tasks.filter(task => task.roleId === roleId);
  };

  return (
    <div 
      ref={appRef}
      className="w-[400px] min-h-[600px] bg-gray-100 dark:bg-dark-bg text-gray-900 dark:text-gray-100 transition-colors shadow-lg flex flex-col"
    >
      <div className="flex-1 flex flex-col">
        {/* Role Selection with Everyone role */}
        <div 
          className="px-3 py-2 border-b dark:border-gray-700 flex gap-2 overflow-x-auto relative"
          onMouseEnter={() => setIsHoveringRoles(true)}
          onMouseLeave={() => setIsHoveringRoles(false)}
        >
          {roles.map(role => (
            <button
              key={role.id}
              onClick={() => setSelectedRole(role.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                handleEditRole(role);
              }}
              className={`px-3 py-1 text-sm rounded whitespace-nowrap ${
                selectedRole === role.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-dark-surface hover:bg-gray-300 dark:hover:bg-dark-hover'
              }`}
            >
              {role.name}
            </button>
          ))}
          {isHoveringRoles && (
            <button
              onClick={() => {
                setEditingRole(null);
                setNewRoleName('');
                setIsRoleModalOpen(true);
              }}
              className="px-3 py-1 text-sm rounded whitespace-nowrap text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-500 flex items-center gap-1"
            >
              <span className="text-lg leading-none">+</span>
              <span>Suggest a Role</span>
            </button>
          )}
        </div>
        
        {/* Task Management Section */}
        <div className="flex-1 bg-white dark:bg-dark-surface">
          {selectedRole ? (
            <div className="flex flex-col">
              {/* Tasks and Subtasks List */}
              <div 
                className="flex-1"
                onMouseEnter={() => setIsHoveringTaskList(true)}
                onMouseLeave={() => setIsHoveringTaskList(false)}
              >
                {getFilteredTasks(selectedRole).map(task => (
                  <div key={task.id}>
                    {/* Task Header */}
                    <div 
                      className="group flex items-center px-3 py-2 hover:bg-gray-50/50 dark:hover:bg-dark-hover/50 cursor-pointer"
                      onClick={() => toggleTaskCollapse(task.id)}
                    >
                      <button 
                        className="opacity-0 group-hover:opacity-100 mr-2 text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle play button click
                        }}
                      >
                        ▶
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{task.title}</span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {task.trackedTime}/{task.estimatedTime}h
                          </span>
                        </div>
                        <div className="flex gap-2 text-xs text-gray-400 dark:text-gray-500">
                          {task.tools.map(tool => (
                            <a
                              key={tool}
                              href={`https://${tool}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-gray-600 dark:hover:text-gray-300"
                            >
                              {tool}
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Subtasks */}
                    {!task.isCollapsed && (
                      <TaskTable
                        tasks={subtasks.filter(subtask => subtask.taskId === task.id)}
                        onCreateTask={(newSubtask) => handleCreateSubtask({ 
                          ...newSubtask, 
                          roleId: selectedRole,
                          taskId: task.id 
                        })}
                      />
                    )}
                  </div>
                ))}

                {/* Propose New Task Button */}
                {(isHoveringTaskList || getFilteredTasks(selectedRole).length === 0) && !showTaskForm && (
                  <button
                    onClick={() => setShowTaskForm(true)}
                    className="w-full px-3 py-2 text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-50/50 dark:hover:bg-dark-hover/50 flex items-center justify-center gap-2 group transition-colors"
                  >
                    <span className="text-lg leading-none group-hover:text-blue-500">+</span>
                    <span className="group-hover:text-blue-500">Propose New Task</span>
                  </button>
                )}

                {/* Task Creation Form (when button clicked) */}
                {showTaskForm && (
                  <div className="px-3 py-2 border-t dark:border-gray-700">
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Add a new task..."
                          value={newTaskName}
                          onChange={(e) => setNewTaskName(e.target.value)}
                          className="flex-1 px-2 py-1 bg-transparent border-b border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none dark:text-gray-100 text-sm"
                          autoFocus
                        />
                        <input
                          type="number"
                          placeholder="Time (h)"
                          value={newTaskTime || ''}
                          onChange={(e) => setNewTaskTime(Number(e.target.value))}
                          className="w-20 px-2 py-1 bg-transparent border-b border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none dark:text-gray-100 text-sm text-right"
                          step="0.5"
                          min="0"
                        />
                      </div>

                      {/* Tool Selection */}
                      <div className="flex flex-col gap-1">
                        <input
                          type="text"
                          placeholder="Search tools..."
                          value={taskToolSearch}
                          onChange={(e) => setTaskToolSearch(e.target.value)}
                          className="w-full px-2 py-1 bg-transparent border-b border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none dark:text-gray-100 text-sm"
                        />
                        {/* Selected Tools */}
                        <div className="flex flex-wrap gap-1">
                          {newTaskTools.map(tool => (
                            <div 
                              key={tool}
                              className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs"
                            >
                              <span>{tool}</span>
                              <button
                                onClick={() => setNewTaskTools(prev => prev.filter(t => t !== tool))}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                        {/* Tool Suggestions */}
                        {taskToolSearch && (
                          <div className="absolute mt-16 w-[calc(100%-1.5rem)] bg-white/90 dark:bg-dark-surface/90 backdrop-blur-sm border rounded shadow-lg dark:border-gray-600 max-h-40 overflow-y-auto z-10">
                            {getFilteredTools().map(tool => (
                              <button
                                key={tool.url}
                                onClick={() => {
                                  setNewTaskTools(prev => [...prev, tool.url]);
                                  setTaskToolSearch('');
                                }}
                                className="w-full px-2 py-1.5 text-left hover:bg-gray-100/70 dark:hover:bg-dark-hover/70 border-b last:border-b-0 dark:border-gray-600/50 transition-colors"
                              >
                                <div className="text-sm text-gray-700 dark:text-gray-200">{tool.url}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {tool.description}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setShowTaskForm(false)}
                          className="px-3 py-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            handleCreateTask();
                            setShowTaskForm(false);
                          }}
                          disabled={!newTaskName.trim() || newTaskTime <= 0}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Add Task
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              Select or create a role to manage tasks
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="h-12 border-t dark:border-gray-700 bg-white dark:bg-dark-surface flex items-center justify-around px-3">
        <button
          onClick={() => setCurrentView('tasks')}
          className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors ${
            currentView === 'tasks' ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'
          }`}
          title="Tasks"
        >
          <ClipboardDocumentListIcon className="w-5 h-5" />
        </button>
        <button
          onClick={() => setCurrentView('chat')}
          className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors ${
            currentView === 'chat' ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'
          }`}
          title="Chat"
        >
          <ChatBubbleLeftIcon className="w-5 h-5" />
        </button>
        <button
          onClick={() => setCurrentView('profile')}
          className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors ${
            currentView === 'profile' ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'
          }`}
          title="Profile"
        >
          <UserCircleIcon className="w-5 h-5" />
        </button>
        <button
          onClick={() => setCurrentView('settings')}
          className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors ${
            currentView === 'settings' ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'
          }`}
          title="Settings"
        >
          <Cog6ToothIcon className="w-5 h-5" />
        </button>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors text-gray-400 dark:text-gray-500"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? (
            <SunIcon className="w-5 h-5" />
          ) : (
            <MoonIcon className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Role Modal */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white dark:bg-dark-surface p-4 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-medium mb-4">
              {editingRole ? 'Edit Role' : 'New Role'}
            </h3>
            <input
              type="text"
              placeholder="Role name"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              className="w-full p-2 border rounded dark:bg-dark-bg dark:border-gray-600 mb-4"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  editingRole ? handleUpdateRole() : handleCreateRole();
                }
              }}
              autoFocus
            />

            {/* Tool Search */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tools
              </label>
              <input
                type="text"
                placeholder="Search tools..."
                value={toolSearch}
                onChange={(e) => setToolSearch(e.target.value)}
                className="w-full p-2 border rounded dark:bg-dark-bg dark:border-gray-600 mb-2"
              />
              
              {/* Selected Tools */}
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedTools.map(tool => (
                  <div 
                    key={tool}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-sm"
                  >
                    <span>{tool}</span>
                    <button
                      onClick={() => setSelectedTools(prev => prev.filter(t => t !== tool))}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Tool Suggestions */}
              {toolSearch && (
                <div className="max-h-40 overflow-y-auto border rounded dark:border-gray-600">
                  {getFilteredTools().map(tool => (
                    <button
                      key={tool.url}
                      onClick={() => {
                        setSelectedTools(prev => [...prev, tool.url]);
                        setToolSearch('');
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-dark-hover border-b last:border-b-0 dark:border-gray-600"
                    >
                      <div className="text-sm font-medium">{tool.url}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {tool.description} • {tool.category}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsRoleModalOpen(false);
                  setSelectedTools([]);
                  setToolSearch('');
                }}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={editingRole ? handleUpdateRole : handleCreateRole}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                {editingRole ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
