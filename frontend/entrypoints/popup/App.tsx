import React, { useState, useEffect, useRef } from 'react';
import { TaskTable } from './components/TaskTable';
import { AIAssistant } from './components/AIAssistant';
import { TaskForm } from './components/TaskForm';
import {
  Cog6ToothIcon,
  UserCircleIcon,
  ChatBubbleLeftIcon,
  ClipboardDocumentListIcon,
  SunIcon,
  MoonIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import './App.css';
import { db } from './db';
import { Task, SubTask, Role, Requirement } from './types';

interface Rule {
  id: string;
  logic: string;
  pattern: {
    condition: 'exactly' | 'at_least';
    threshold: number;
    metric: string;
    timePattern: {
      type: 'in_a_row' | 'in_week' | 'in_month' | 'before_date' | 'by_time' | 'every_x_days';
      value: number;
      target?: string;
    };
  };
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
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('everyone');
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [toolSearch, setToolSearch] = useState('');
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [isHoveringTaskList, setIsHoveringTaskList] = useState(false);
  const [isHoveringRoles, setIsHoveringRoles] = useState(false);
  const appRef = useRef<HTMLDivElement>(null);
  const [currentView, setCurrentView] = useState<'tasks' | 'chat' | 'profile' | 'settings'>('tasks');
  const [isDark, setIsDark] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentUrl, setCurrentUrl] = useState<string>('');

  // Initialize database and load data
  useEffect(() => {
    const initializeDB = async () => {
      try {
        await db.init();
        const [
          storedTasks,
          storedSubtasks,
          storedRoles,
          storedRequirements,
          storedState
        ] = await Promise.all([
          db.getAllTasks(),
          db.getAllSubtasks(),
          db.getAllRoles(),
          db.getAllRequirements(),
          db.getState()
        ]);

        setTasks(storedTasks);
        setSubtasks(storedSubtasks);
        
        // Ensure 'everyone' role exists
        const hasEveryoneRole = storedRoles.some(role => role.id === 'everyone');
        if (!hasEveryoneRole) {
          storedRoles.push({
            id: 'everyone',
            name: 'Everyone',
            createdAt: new Date(),
            tools: []
          });
        }
        setRoles(storedRoles);
        
        setRequirements(storedRequirements);
        setSelectedRole(storedState.selectedRole);
        setActiveTask(storedState.activeTask);
        setElapsedTime(storedState.elapsedTime);
      } catch (error) {
        console.error('Error initializing database:', error);
      }
    };

    initializeDB();
  }, []);

  // Save tasks whenever they change
  useEffect(() => {
    db.saveTasks(tasks).catch(error => {
      console.error('Error saving tasks:', error);
    });
  }, [tasks]);

  // Save subtasks whenever they change
  useEffect(() => {
    db.saveSubtasks(subtasks).catch(error => {
      console.error('Error saving subtasks:', error);
    });
  }, [subtasks]);

  // Save roles whenever they change
  useEffect(() => {
    db.saveRoles(roles).catch(error => {
      console.error('Error saving roles:', error);
    });
  }, [roles]);

  // Save requirements whenever they change
  useEffect(() => {
    db.saveRequirements(requirements).catch(error => {
      console.error('Error saving requirements:', error);
    });
  }, [requirements]);

  // Save app state whenever relevant parts change
  useEffect(() => {
    db.saveState({
      activeTask,
      selectedRole,
      elapsedTime
    }).catch(error => {
      console.error('Error saving app state:', error);
    });
  }, [activeTask, selectedRole, elapsedTime]);

  // Tool suggestions data
  const toolCategories = {
    design: {
      "canva.com": {
        description: "Online graphic design platform",
        type: ["webtrack", "api"],
        api: {
          credentials: [
            { type: "api_key", name: "CANVA_API_KEY" },
            { type: "oauth2", name: "CANVA_OAUTH_TOKEN" }
          ],
          endpoints: [
            {
              url: "api.canva.com/v1/designs",
              input_params: { brand_kit_id: "string", template_id: "string" },
              output_format: "{ design_id: string, preview_url: string }"
            },
            {
              url: "api.canva.com/v1/exports",
              input_params: { design_id: "string", format: "png|pdf" },
              output_format: "{ download_url: string, expires_at: timestamp }"
            }
          ]
        },
        webtrack: {
          url: "https://canva.com/design/*",
          multitask_chance: "low",
          search: {
            available: true,
            project_keywords: ["DAO branding", "AI agent logo", "web3 design"]
          },
          screenshot: { enabled: true, subpages: ["editor", "dashboard"] }
        }
      },
      "figma.com": {
        description: "Collaborative interface design tool",
        type: ["webtrack", "api"],
        api: {
          credentials: [
            { type: "api_key", name: "FIGMA_ACCESS_TOKEN" },
            { type: "oauth2", name: "FIGMA_OAUTH_TOKEN" }
          ],
          endpoints: [
            {
              url: "api.figma.com/v1/files/:file_key",
              input_params: { file_key: "string", version: "string?" },
              output_format: "{ document: object, components: object[], styles: object[] }"
            },
            {
              url: "api.figma.com/v1/images/:file_key",
              input_params: { file_key: "string", ids: "string[]", format: "jpg|png|svg" },
              output_format: "{ images: { [key: string]: string } }"
            }
          ]
        },
        webtrack: {
          url: "https://figma.com/file/*",
          multitask_chance: "low",
          search: {
            available: true,
            project_keywords: ["DAO dashboard", "AI interface", "agent controls"]
          },
          screenshot: { enabled: true, subpages: ["editor", "prototype"] }
        }
      }
    },
    development: {
      "github.com": {
        description: "Code hosting platform",
        type: ["webtrack", "api"],
        api: {
          credentials: [
            { type: "api_key", name: "GITHUB_TOKEN" },
            { type: "oauth2", name: "GITHUB_OAUTH_TOKEN" }
          ],
          endpoints: [
            {
              url: "api.github.com/repos/:owner/:repo/issues",
              input_params: { title: "string", body: "string", labels: "string[]" },
              output_format: "{ issue_number: number, html_url: string }"
            },
            {
              url: "api.github.com/repos/:owner/:repo/pulls",
              input_params: { title: "string", head: "string", base: "string" },
              output_format: "{ pr_number: number, html_url: string }"
            }
          ]
        },
        webtrack: {
          url: "https://github.com/*",
          multitask_chance: "high",
          search: {
            available: true,
            project_keywords: ["DAO implementation", "AI agent framework", "web3 integration"]
          },
          screenshot: { enabled: false }
        }
      },
      "codesandbox.io": {
        description: "Online code editor",
        type: ["webtrack", "api"],
        api: {
          credentials: [
            { type: "api_key", name: "CODESANDBOX_TOKEN" }
          ],
          endpoints: [
            {
              url: "api.codesandbox.io/v1/sandboxes",
              input_params: { template: "string", files: "object" },
              output_format: "{ sandbox_id: string, url: string }"
            }
          ]
        },
        webtrack: {
          url: "https://codesandbox.io/s/*",
          multitask_chance: "mid",
          search: {
            available: true,
            project_keywords: ["DAO prototype", "AI agent demo", "web3 sandbox"]
          },
          screenshot: { enabled: true, subpages: ["editor", "preview"] }
        }
      }
    },
    productivity: {
      "notion.so": {
        description: "All-in-one workspace",
        type: ["webtrack", "api"],
        api: {
          credentials: [
            { type: "api_key", name: "NOTION_API_KEY" },
            { type: "oauth2", name: "NOTION_OAUTH_TOKEN" }
          ],
          endpoints: [
            {
              url: "api.notion.com/v1/pages",
              input_params: { parent_id: "string", properties: "object" },
              output_format: "{ page_id: string, url: string }"
            },
            {
              url: "api.notion.com/v1/databases/:database_id/query",
              input_params: { filter: "object", sorts: "object[]" },
              output_format: "{ results: object[], next_cursor: string }"
            }
          ]
        },
        webtrack: {
          url: "https://notion.so/*",
          multitask_chance: "high",
          search: {
            available: true,
            project_keywords: ["DAO documentation", "AI agent specs", "project roadmap"]
          },
          screenshot: { enabled: true, subpages: ["page", "database"] }
        }
      },
      "linear.app": {
        description: "Software project management",
        type: ["webtrack", "api"],
        api: {
          credentials: [
            { type: "api_key", name: "LINEAR_API_KEY" }
          ],
          endpoints: [
            {
              url: "api.linear.app/graphql",
              input_params: { query: "string", variables: "object" },
              output_format: "{ data: object, errors?: object[] }"
            }
          ]
        },
        webtrack: {
          url: "https://linear.app/*",
          multitask_chance: "mid",
          search: {
            available: true,
            project_keywords: ["DAO development", "AI agent features", "sprint planning"]
          },
          screenshot: { enabled: true, subpages: ["issues", "cycles", "roadmap"] }
        }
      }
    },
    research: {
      "scholar.google.com": {
        description: "Academic research platform",
        type: ["webtrack"],
        webtrack: {
          url: "https://scholar.google.com/*",
          multitask_chance: "high",
          search: {
            available: true,
            project_keywords: ["DAO governance", "AI agent architecture", "autonomous systems"]
          },
          screenshot: { enabled: false }
        }
      },
      "arxiv.org": {
        description: "Research paper repository",
        type: ["webtrack", "api"],
        api: {
          credentials: [],
          endpoints: [
            {
              url: "export.arxiv.org/api/query",
              input_params: { search_query: "string", start: "number", max_results: "number" },
              output_format: "{ entries: { title: string, summary: string, pdf_url: string }[] }"
            }
          ]
        },
        webtrack: {
          url: "https://arxiv.org/*",
          multitask_chance: "high",
          search: {
            available: true,
            project_keywords: ["DAO research", "AI agent papers", "autonomous systems"]
          },
          screenshot: { enabled: true, subpages: ["abstract"] }
        }
      }
    },
    communication: {
      "discord.com": {
        description: "Chat and community platform",
        type: ["webtrack", "api"],
        api: {
          credentials: [
            { type: "bot_token", name: "DISCORD_BOT_TOKEN" },
            { type: "oauth2", name: "DISCORD_OAUTH_TOKEN" }
          ],
          endpoints: [
            {
              url: "discord.com/api/v10/channels/:channel_id/messages",
              input_params: { content: "string", embeds: "object[]" },
              output_format: "{ id: string, content: string, timestamp: string }"
            }
          ]
        },
        webtrack: {
          url: "https://discord.com/channels/*",
          multitask_chance: "high",
          search: {
            available: true,
            project_keywords: ["DAO community", "AI agent updates", "project announcements"]
          },
          screenshot: { enabled: false }
        }
      }
    }
  };

  const getFilteredTools = () => {
    const allTools: { url: string; description: string; category: string }[] = [];
    Object.entries(toolCategories).forEach(([category, tools]) => {
      Object.entries(tools).forEach(([url, tool]) => {
        allTools.push({ url, description: tool.description, category });
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

  const handleCreateTask = (newTask: { title: string; estimatedTime: number; tools: string[] }) => {
    if (!selectedRole) return;

    const taskData: Task = {
      id: crypto.randomUUID(),
      title: newTask.title,
      roleId: selectedRole,
      createdAt: new Date(),
      isCollapsed: true,
      estimatedTime: newTask.estimatedTime,
      tools: newTask.tools,
      trackedTime: 0,
      requirements: [],
    };

    setTasks(prev => [...prev, taskData]);
    setShowTaskForm(false);
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

  const handlePlayTask = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeTask?.id === task.id) {
      // If clicking the same task, stop tracking
      setActiveTask(null);
      setElapsedTime(0);
    } else {
      // Start tracking new task
      setActiveTask(task);
      setElapsedTime(0);
    }
    // Collapse the task in the backlog when it's played
    setTasks(prev => prev.map(t => 
      t.id === task.id ? { ...t, isCollapsed: true } : t
    ));
  };

  const handleToggleSubtaskComplete = (subtaskId: string, isCompleted: boolean) => {
    setSubtasks(prev => prev.map(subtask => 
      subtask.id === subtaskId ? { ...subtask, isCompleted } : subtask
    ));
  };

  const handleDeleteSubtask = (subtaskId: string) => {
    setSubtasks(prev => prev.filter(subtask => subtask.id !== subtaskId));
  };

  // Add effect to get current URL and auto-activate matching tasks
  useEffect(() => {
    const getCurrentUrl = async () => {
      try {
        // Check if we're in a Chrome extension context
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
          console.warn('Chrome storage API not available');
          return;
        }

        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];
        if (currentTab?.url) {
          console.log('Current URL:', currentTab.url);
          setCurrentUrl(currentTab.url);

          // Load stored state first
          const storedData = await chrome.storage.local.get([
            'activeTask',
            'elapsedTime'
          ]);

          // Check if the current URL matches any task's tools
          const matchingTask = tasks.find(task => 
            task.tools.some(tool => {
              try {
                if (!currentTab.url) return false;
                const currentHostname = new URL(currentTab.url).hostname;
                const toolHostname = tool.toLowerCase();
                return currentHostname.includes(toolHostname);
              } catch {
                return false;
              }
            })
          );

          // If we have a stored active task, restore it
          if (storedData.activeTask) {
            const storedTask = {
              ...storedData.activeTask,
              createdAt: new Date(storedData.activeTask.createdAt)
            };
            setActiveTask(storedTask);
            setElapsedTime(storedData.elapsedTime || 0);
          }
          // Otherwise, if we found a matching task and no task is currently active
          else if (matchingTask && (!activeTask || activeTask.id !== matchingTask.id)) {
            console.log('Auto-activating task:', matchingTask.title);
            setActiveTask(matchingTask);
            setElapsedTime(0);
          }
        }
      } catch (error) {
        console.error('Error getting current URL:', error);
      }
    };

    getCurrentUrl();
    // Check URL periodically for changes
    const intervalId = setInterval(getCurrentUrl, 1000);

    return () => {
      clearInterval(intervalId);
      // Save state before unmounting
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const activeTaskForStorage = activeTask ? {
          ...activeTask,
          createdAt: activeTask.createdAt.toISOString()
        } : null;
        chrome.storage.local.set({ 
          activeTask: activeTaskForStorage,
          elapsedTime 
        });
      }
    };
  }, [tasks, activeTask, elapsedTime]);

  // Update timer effect to save state on each tick
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (activeTask) {
      // Set initial badge
      if (chrome.action?.setBadgeText) {
        chrome.action.setBadgeText({ text: '0:00' });
        chrome.action.setBadgeBackgroundColor({ color: '#2563eb' }); // blue-600
      }

      intervalId = setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          // Update badge text with formatted time
          if (chrome.action?.setBadgeText) {
            const minutes = Math.floor(newTime / 60);
            const seconds = newTime % 60;
            const badgeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            chrome.action.setBadgeText({ text: badgeText });
          }

          // Save state on each tick
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            const activeTaskForStorage = activeTask ? {
              ...activeTask,
              createdAt: activeTask.createdAt.toISOString()
            } : null;
            chrome.storage.local.set({ 
              activeTask: activeTaskForStorage,
              elapsedTime: newTime 
            });
          }

          return newTime;
        });
      }, 1000);
    } else {
      // Clear badge when no active task
      if (chrome.action?.setBadgeText) {
        chrome.action.setBadgeText({ text: '' });
      }
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      // Clear badge on cleanup
      if (chrome.action?.setBadgeText) {
        chrome.action.setBadgeText({ text: '' });
      }
    };
  }, [activeTask]);

  // Add function to format time
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    const pad = (num: number): string => num.toString().padStart(2, '0');
    
    if (hours > 0) {
      return `${hours}:${pad(minutes)}:${pad(remainingSeconds)}`;
    }
    return `${pad(minutes)}:${pad(remainingSeconds)}`;
  };

  // Add export function
  const handleExportData = () => {
    // Prepare data for export
    const exportData = {
      tasks: tasks.map(task => {
        // Create a new object without isCollapsed
        const { isCollapsed, ...taskWithoutCollapsed } = task;
        return {
          ...taskWithoutCollapsed,
          createdAt: task.createdAt.toISOString(),
          // Include linked requirements data
          requirementsData: requirements
            .filter(req => task.requirements.includes(req.id))
            .map(req => ({
              ...req,
              rules: req.rules?.map(rule => ({
                ...rule,
                pattern: {
                  ...rule.pattern,
                  timePattern: {
                    ...rule.pattern.timePattern,
                    target: rule.pattern.timePattern.target ? new Date(rule.pattern.timePattern.target).toISOString() : undefined
                  }
                }
              }))
            }))
        };
      }),
      subtasks: subtasks.map(subtask => ({
        ...subtask,
        createdAt: subtask.createdAt.toISOString(),
        updatedAt: subtask.updatedAt.toISOString()
      })),
      roles: roles.map(role => ({
        ...role,
        createdAt: role.createdAt.toISOString()
      })),
      requirements: requirements.map(requirement => ({
        ...requirement,
        rules: requirement.rules?.map(rule => ({
          ...rule,
          pattern: {
            ...rule.pattern,
            timePattern: {
              ...rule.pattern.timePattern,
              target: rule.pattern.timePattern.target ? new Date(rule.pattern.timePattern.target).toISOString() : undefined
            }
          }
        }))
      })),
      selectedRole,
      activeTask: activeTask ? (() => {
        const { isCollapsed, ...activeWithoutCollapsed } = activeTask;
        return {
          ...activeWithoutCollapsed,
          createdAt: activeTask.createdAt.toISOString(),
          // Include linked requirements data for active task
          requirementsData: requirements
            .filter(req => activeTask.requirements.includes(req.id))
            .map(req => ({
              ...req,
              rules: req.rules?.map(rule => ({
                ...rule,
                pattern: {
                  ...rule.pattern,
                  timePattern: {
                    ...rule.pattern.timePattern,
                    target: rule.pattern.timePattern.target ? new Date(rule.pattern.timePattern.target).toISOString() : undefined
                  }
                }
              }))
            }))
        };
      })() : null,
      elapsedTime
    };

    // Create and download file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aidao_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div 
      ref={appRef}
      className="w-[400px] min-h-[600px] bg-gray-100 dark:bg-dark-bg text-gray-900 dark:text-gray-100 transition-colors shadow-lg flex flex-col"
    >
      <div className="flex-1 flex flex-col">
        {/* Active Task Section */}
        {activeTask && (
          <div className="bg-white dark:bg-dark-surface border-b dark:border-gray-700">
            <div className="px-3 py-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTask(null)}
                    className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  >
                    ■
                  </button>
                  <div className="flex items-center gap-2">
                    <h2 className="font-medium">{activeTask.title}</h2>
                    <div className="flex items-center gap-1">
                      <span className="px-1.5 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                        Manual tracking
                      </span>
                      <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                        {formatTime(elapsedTime)}
                      </span>
                    </div>
                  </div>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {activeTask.trackedTime}/{activeTask.estimatedTime}h
                </span>
              </div>
              <div className="flex gap-2 text-xs text-gray-400 dark:text-gray-500 mb-2">
                {activeTask.tools.map(tool => (
                  <a
                    key={tool}
                    href={`https://${tool}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {tool}
                  </a>
                ))}
              </div>
              {/* Subtasks for active task */}
              <TaskTable
                tasks={subtasks.filter(subtask => subtask.taskId === activeTask.id)}
                onCreateTask={(newSubtask) => handleCreateSubtask({ 
                  ...newSubtask, 
                  roleId: activeTask.roleId,
                  taskId: activeTask.id 
                })}
                onToggleComplete={handleToggleSubtaskComplete}
                onDeleteTask={handleDeleteSubtask}
              />
            </div>
          </div>
        )}

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
              <span>Role</span>
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
                        onClick={(e) => handlePlayTask(task, e)}
                      >
                        {activeTask?.id === task.id ? '■' : '▶'}
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
                        onToggleComplete={handleToggleSubtaskComplete}
                        onDeleteTask={handleDeleteSubtask}
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
                    <span className="group-hover:text-blue-500">Add New Task</span>
                  </button>
                )}

                {/* Task Creation Form */}
                {showTaskForm && (
                  <TaskForm
                    onCreateTask={handleCreateTask}
                    onCancel={() => setShowTaskForm(false)}
                    toolCategories={toolCategories}
                  />
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

      {/* Active Task Tools URLs and Current URL */}
      <div className="border-t dark:border-gray-700 bg-white dark:bg-dark-surface">
        {activeTask && activeTask.tools.length > 0 && (
          <div className="px-3 py-1 border-b dark:border-gray-700">
            <div className="flex gap-2 text-xs text-gray-400 dark:text-gray-500 overflow-x-auto">
              {activeTask.tools.map(tool => (
                <a
                  key={tool}
                  href={`https://${tool}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gray-600 dark:hover:text-gray-300 whitespace-nowrap"
                >
                  {tool}
                </a>
              ))}
            </div>
          </div>
        )}
        <div className="px-3 py-1">
          <div className="text-xs text-gray-400 dark:text-gray-500 truncate" style={{ minHeight: '1.25rem' }}>
            {currentUrl ? (
              <a 
                href={currentUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-gray-600 dark:hover:text-gray-300"
              >
                {currentUrl}
              </a>
            ) : (
              <span>No active tab</span>
            )}
          </div>
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
          onClick={() => setShowAIAssistant(true)}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400"
          title="AI Assistant"
        >
          <SparklesIcon className="w-5 h-5" />
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

      {/* AI Assistant Modal */}
      {showAIAssistant && (
        <AIAssistant onClose={() => setShowAIAssistant(false)} />
      )}

      {currentView === 'profile' && (
        <div className="flex-1 bg-white dark:bg-dark-surface p-4">
          <div className="max-w-lg mx-auto">
            <h2 className="text-lg font-medium mb-4">User Profile</h2>
            
            {/* Export Data Section */}
            <div className="mb-6 p-4 border dark:border-gray-700 rounded-lg">
              <h3 className="text-sm font-medium mb-2">Data Management</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Export your tasks, roles, and tracking data as a JSON file
              </p>
              <button
                onClick={handleExportData}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
