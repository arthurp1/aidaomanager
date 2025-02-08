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
import mockWalletData from './data/wallet.json';

// Add new interfaces after existing ones
interface Organization {
  name: string;
  role: string;
  id: string;
}

interface SocialConnections {
  email?: string;
  discord?: string;
  telegram?: string;
  github?: string;
}

interface WalletInfo {
  address: string;
  balance: string;
  organizations: Organization[];
  socials: SocialConnections;
}

const isChromeExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;

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
  const [currentView, setCurrentView] = useState<'tasks' | 'profile' | 'settings' | 'ai'>('tasks');
  const [isDark, setIsDark] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [isDbInitialized, setIsDbInitialized] = useState(false);
  const [taskTabs, setTaskTabs] = useState<Record<string, 'subtasks' | 'requirements'>>({});
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [editingSocials, setEditingSocials] = useState(false);
  const [socialInputs, setSocialInputs] = useState<SocialConnections>({});

  // Initialize database and load data
  useEffect(() => {
    const initializeDB = async () => {
      try {
        await db.init();
        setIsDbInitialized(true);
        
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
    if (!isDbInitialized) return;
    db.saveTasks(tasks).catch(error => {
      console.error('Error saving tasks:', error);
    });
  }, [tasks, isDbInitialized]);

  // Save subtasks whenever they change
  useEffect(() => {
    if (!isDbInitialized) return;
    db.saveSubtasks(subtasks).catch(error => {
      console.error('Error saving subtasks:', error);
    });
  }, [subtasks, isDbInitialized]);

  // Save roles whenever they change
  useEffect(() => {
    if (!isDbInitialized) return;
    db.saveRoles(roles).catch(error => {
      console.error('Error saving roles:', error);
    });
  }, [roles, isDbInitialized]);

  // Save requirements whenever they change
  useEffect(() => {
    if (!isDbInitialized) return;
    db.saveRequirements(requirements).catch(error => {
      console.error('Error saving requirements:', error);
    });
  }, [requirements, isDbInitialized]);

  // Save app state whenever relevant parts change
  useEffect(() => {
    if (!isDbInitialized) return;
    db.saveState({
      activeTask,
      selectedRole,
      elapsedTime
    }).catch(error => {
      console.error('Error saving app state:', error);
    });
  }, [activeTask, selectedRole, elapsedTime, isDbInitialized]);

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

  // Type for the form input that excludes the description field
  type RequirementFormData = Omit<Requirement, 'description'>;
  
  interface TaskFormInput {
    title: string;
    estimatedTime: number;
    tools: string[];
    requirements: RequirementFormData[];
  }

  const handleCreateTask = (newTask: TaskFormInput) => {
    if (!selectedRole) return;

    // First save any new requirements
    const newRequirements = newTask.requirements.filter(req => !requirements.some(r => r.id === req.id));
    if (newRequirements.length > 0) {
      // Convert to full requirements with description
      const completeRequirements: Requirement[] = newRequirements.map(req => ({
        ...req,
        description: `Requirement to track ${req.measure}`,
      }));
      setRequirements(prev => [...prev, ...completeRequirements]);
    }

    const taskData: Task = {
      id: crypto.randomUUID(),
      title: newTask.title,
      roleId: selectedRole,
      createdAt: new Date(),
      isCollapsed: true,
      estimatedTime: newTask.estimatedTime,
      tools: newTask.tools,
      trackedTime: 0,
      requirements: newTask.requirements.map(req => req.id),
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
    if (!isChromeExtension) return; // Don't run in development

    const handleError = (error: any) => {
      console.error('Timer operation failed:', error);
      // Fallback to local timer if background script is not available
      if (activeTask?.id === task.id) {
        // Save tracked time before stopping
        const finalTrackedTime = (task.trackedTime || 0) + (elapsedTime / 3600); // Convert seconds to hours
        setTasks(prev => prev.map(t => 
          t.id === task.id ? { ...t, trackedTime: finalTrackedTime } : t
        ));
        setActiveTask(null);
        // Don't reset elapsed time here
      } else {
        setActiveTask(task);
        // Keep elapsed time if it's the same task
        if (task.id !== activeTask?.id) {
          setElapsedTime(0);
        }
      }
    };

    if (activeTask?.id === task.id) {
      // Stop tracking
      try {
        chrome.runtime.sendMessage({ type: 'STOP_TIMER' }, (response) => {
          if (chrome.runtime.lastError) {
            handleError(chrome.runtime.lastError);
            return;
          }
          if (response?.success) {
            // Save tracked time before stopping
            const finalTrackedTime = (task.trackedTime || 0) + (elapsedTime / 3600); // Convert seconds to hours
            setTasks(prev => prev.map(t => 
              t.id === task.id ? { ...t, trackedTime: finalTrackedTime } : t
            ));
            setActiveTask(null);
            // Keep elapsed time in state
            if (response.stoppedTime !== undefined) {
              setElapsedTime(response.stoppedTime);
            }
          } else {
            console.error('Failed to stop timer:', response?.error);
          }
        });
      } catch (error) {
        handleError(error);
      }
    } else {
      // Start tracking new task
      const taskForStorage = {
        ...task,
        createdAt: task.createdAt.toISOString()
      };
      try {
        chrome.runtime.sendMessage({ 
          type: 'START_TIMER',
          task: taskForStorage,
          elapsedTime: task.id === activeTask?.id ? elapsedTime : 0
        }, (response) => {
          if (chrome.runtime.lastError) {
            handleError(chrome.runtime.lastError);
            return;
          }
          if (response?.success) {
            setActiveTask(task);
            // Keep elapsed time if it's the same task
            if (task.id !== activeTask?.id) {
              setElapsedTime(0);
            }
            console.log('Timer started successfully');
          } else {
            console.error('Failed to start timer:', response?.error);
          }
        });
      } catch (error) {
        handleError(error);
      }
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

  // Update URL effect
  useEffect(() => {
    if (!isChromeExtension || !chrome?.runtime) {
      console.log('Chrome extension environment not available:', { isChromeExtension, hasRuntime: !!chrome?.runtime });
      return;
    }

    const getCurrentUrl = async () => {
      try {
        console.log('Requesting URL from background script...');
        // Get URL from background script
        chrome.runtime.sendMessage({ type: 'getCurrentUrl' }, async (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error getting URL from background:', chrome.runtime.lastError);
            return;
          }

          console.log('Received response from background:', response);

          if (response?.currentUrl) {
            console.log('Setting current URL in popup:', response.currentUrl);
            setCurrentUrl(response.currentUrl);

            // Load stored state
            const storedData = await chrome.storage.local.get([
              'activeTask',
              'elapsedTime'
            ]);

            console.log('Loaded stored state:', storedData);

            // Check if the current URL matches any task's tools
            const matchingTask = tasks.find(task => 
              task.tools.some(tool => {
                try {
                  const currentHostname = new URL(response.currentUrl).hostname;
                  const toolHostname = tool.toLowerCase();
                  const matches = currentHostname.includes(toolHostname);
                  console.log('URL matching:', { currentHostname, toolHostname, matches });
                  return matches;
                } catch (error) {
                  console.error('Error matching URL:', error);
                  return false;
                }
              })
            );

            if (matchingTask) {
              console.log('Found matching task:', matchingTask);
            }

            // If we have a stored active task, restore it
            if (storedData.activeTask) {
              const storedTask = {
                ...storedData.activeTask,
                createdAt: new Date(storedData.activeTask.createdAt)
              };
              setActiveTask(storedTask);
              setElapsedTime(storedData.elapsedTime || 0);
              console.log('Restored active task:', storedTask);
            }
            // Otherwise, if we found a matching task and no task is currently active
            else if (matchingTask && (!activeTask || activeTask.id !== matchingTask.id)) {
              console.log('Auto-activating task:', matchingTask.title);
              setActiveTask(matchingTask);
              setElapsedTime(0);
            }
          } else {
            console.log('No URL received from background');
          }
        });
      } catch (error) {
        console.error('Error in getCurrentUrl:', error);
      }
    };

    console.log('Setting up URL polling');
    getCurrentUrl();
    // Check URL periodically for changes
    const intervalId = setInterval(getCurrentUrl, 1000);

    return () => {
      console.log('Cleaning up URL polling');
      clearInterval(intervalId);
    };
  }, [tasks, activeTask, elapsedTime]);

  // Update timer effect to handle connection errors
  useEffect(() => {
    if (!isChromeExtension) return;

    let localTimer: NodeJS.Timeout | null = null;
    const startLocalTimer = () => {
      if (localTimer) clearInterval(localTimer);
      localTimer = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    };

    const stopLocalTimer = () => {
      if (localTimer) {
        clearInterval(localTimer);
        localTimer = null;
      }
    };

    // Try to get state from background script
    try {
      chrome.runtime.sendMessage({ type: 'GET_TIMER_STATE' }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('Background script not available, using local timer');
          if (activeTask) startLocalTimer();
          return;
        }

        if (response?.activeTask) {
          setActiveTask({
            ...response.activeTask,
            createdAt: new Date(response.activeTask.createdAt)
          });
          setElapsedTime(response.elapsedTime);
        }
      });

      // Listen for timer updates from background script
      const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
        if (changes.elapsedTime) {
          setElapsedTime(changes.elapsedTime.newValue);
        }
        if (changes.activeTask) {
          const newActiveTask = changes.activeTask.newValue;
          if (newActiveTask) {
            setActiveTask({
              ...newActiveTask,
              createdAt: new Date(newActiveTask.createdAt)
            });
          } else {
            setActiveTask(null);
          }
        }
      };

      if (chrome.storage?.onChanged) {
        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => {
          chrome.storage.onChanged.removeListener(handleStorageChange);
          stopLocalTimer();
        };
      }
    } catch (error) {
      console.warn('Error setting up timer:', error);
      if (activeTask) startLocalTimer();
    }

    return () => stopLocalTimer();
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

  // Add formatTrackedTime function
  const formatTrackedTime = (time: number): string => {
    if (time === 0) return "0";
    if (time > 0 && time < 0.1) return "0.1";
    return time.toFixed(1);
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

  // Add function to handle tab selection
  const handleTabChange = (taskId: string, tab: 'subtasks' | 'requirements') => {
    setTaskTabs(prev => ({ ...prev, [taskId]: tab }));
  };

  const handleDevTest = () => {
    setWalletInfo(mockWalletData.mockWallets[0]);
  };

  const handleCreateOrg = () => {
    if (!walletInfo || !newOrgName.trim()) return;
    
    const newOrg: Organization = {
      name: newOrgName.trim(),
      role: 'Admin',
      id: `${newOrgName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
    };

    setWalletInfo(prev => prev ? {
      ...prev,
      organizations: [...prev.organizations, newOrg]
    } : null);
    
    setNewOrgName('');
    setIsCreateOrgModalOpen(false);
  };

  const handleJoinOrg = () => {
    if (!walletInfo || !inviteCode.trim()) return;
    // In a real app, this would validate the invite code
    setInviteCode('');
  };

  const handleLogout = () => {
    setWalletInfo(null);
  };

  const handleLeaveOrg = (orgId: string) => {
    if (!walletInfo) return;
    setWalletInfo(prev => prev ? {
      ...prev,
      organizations: prev.organizations.filter(org => org.id !== orgId)
    } : null);
  };

  const handleSaveSocials = () => {
    if (!walletInfo) return;
    setWalletInfo(prev => prev ? {
      ...prev,
      socials: { ...prev.socials, ...socialInputs }
    } : null);
    setEditingSocials(false);
  };

  return (
    <div 
      ref={appRef}
      className="w-[400px] min-h-[600px] bg-gray-100 dark:bg-dark-bg text-gray-900 dark:text-gray-100 transition-colors shadow-lg flex flex-col"
    >
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tasks View */}
        {currentView === 'tasks' && (
          <>
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
                      {formatTrackedTime(activeTask.trackedTime)}/{activeTask.estimatedTime}h
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

            {/* Role Selection */}
            <div 
              className="px-3 py-2 border-b dark:border-gray-700 flex gap-2 overflow-x-auto relative bg-white dark:bg-dark-surface"
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
            <div className="flex-1 bg-white dark:bg-dark-surface overflow-y-auto">
              {selectedRole ? (
                <div className="flex flex-col">
                  {/* Tasks and Subtasks List */}
                  <div 
                    className="flex-1"
                    onMouseEnter={() => setIsHoveringTaskList(true)}
                    onMouseLeave={() => setIsHoveringTaskList(false)}
                  >
                    {getFilteredTasks(selectedRole).map(task => (
                      <div key={task.id} className="border-b border-gray-100 dark:border-gray-800/50 last:border-b-0">
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
                                {formatTrackedTime(task.trackedTime)}/{task.estimatedTime}h
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

                        {/* Tabs and Content */}
                        {!task.isCollapsed && (
                          <div>
                            {/* Tabs - removed border-t and adjusted text size */}
                            <div className="flex">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTabChange(task.id, 'subtasks');
                                }}
                                className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px ${
                                  (!taskTabs[task.id] || taskTabs[task.id] === 'subtasks')
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                }`}
                              >
                                Subtasks
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTabChange(task.id, 'requirements');
                                }}
                                className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px ${
                                  taskTabs[task.id] === 'requirements'
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                }`}
                              >
                                Requirements
                              </button>
                            </div>

                            {/* Tab Content */}
                            <div onClick={(e) => e.stopPropagation()}>
                              {(!taskTabs[task.id] || taskTabs[task.id] === 'subtasks') ? (
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
                              ) : (
                                <div className="p-3">
                                  {task.requirements.length > 0 ? (
                                    <div className="space-y-2">
                                      {requirements
                                        .filter(req => task.requirements.includes(req.id))
                                        .map(req => (
                                          <div key={req.id} className="flex items-start gap-2 p-2 bg-gray-50 dark:bg-dark-hover/30 rounded">
                                            <span className="text-lg">{req.emoji}</span>
                                            <div>
                                              <div className="text-sm font-medium dark:text-gray-200">{req.title}</div>
                                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                                Measured by: {req.measure}
                                              </div>
                                            </div>
                                          </div>
                                        ))
                                      }
                                    </div>
                                  ) : (
                                    <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                                      No requirements set for this task
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
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
          </>
        )}

        {/* AI Assistant View */}
        {currentView === 'ai' && (
          <div className="flex-1 bg-white dark:bg-dark-surface overflow-hidden">
            <AIAssistant />
          </div>
        )}

        {/* Profile View */}
        {currentView === 'profile' && (
          <div className="flex-1 bg-white dark:bg-dark-surface overflow-y-auto">
            {/* Dev Test Button */}
            <button
              onClick={handleDevTest}
              className="absolute top-2 left-2 px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Dev Test
            </button>

            <div className="p-4">
              <div className="max-w-lg mx-auto space-y-4">
                {/* Login Section */}
                {!walletInfo ? (
                  <div className="p-4 border dark:border-gray-700 rounded-lg">
                    <h2 className="text-lg font-medium mb-4">Login</h2>
                    <button
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Connect Wallet
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Wallet Info Section */}
                    <div className="p-4 border dark:border-gray-700 rounded-lg">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-medium">Wallet</h2>
                        <button
                          onClick={handleLogout}
                          className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Logout
                        </button>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Address:</span>
                          <span className="text-sm font-mono">{walletInfo.address}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Balance:</span>
                          <span className="text-sm font-medium">{walletInfo.balance}</span>
                        </div>
                      </div>
                    </div>

                    {/* Social Connections */}
                    <div className="p-4 border dark:border-gray-700 rounded-lg">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-medium">Connected Accounts</h2>
                        <button
                          onClick={() => {
                            setEditingSocials(!editingSocials);
                            setSocialInputs(walletInfo.socials || {});
                          }}
                          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          {editingSocials ? 'Cancel' : 'Edit'}
                        </button>
                      </div>
                      
                      {editingSocials ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Email</label>
                            <input
                              type="email"
                              value={socialInputs.email || ''}
                              onChange={(e) => setSocialInputs(prev => ({ ...prev, email: e.target.value }))}
                              placeholder="your@email.com"
                              className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-dark-hover border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Discord</label>
                            <input
                              type="text"
                              value={socialInputs.discord || ''}
                              onChange={(e) => setSocialInputs(prev => ({ ...prev, discord: e.target.value }))}
                              placeholder="username#0000"
                              className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-dark-hover border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Telegram</label>
                            <input
                              type="text"
                              value={socialInputs.telegram || ''}
                              onChange={(e) => setSocialInputs(prev => ({ ...prev, telegram: e.target.value }))}
                              placeholder="@username"
                              className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-dark-hover border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">GitHub</label>
                            <input
                              type="text"
                              value={socialInputs.github || ''}
                              onChange={(e) => setSocialInputs(prev => ({ ...prev, github: e.target.value }))}
                              placeholder="username"
                              className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-dark-hover border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <button
                            onClick={handleSaveSocials}
                            className="w-full mt-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {Object.entries(walletInfo.socials || {}).map(([platform, value]) => value && (
                            <div key={platform} className="flex items-center justify-between">
                              <span className="text-sm capitalize text-gray-500 dark:text-gray-400">{platform}:</span>
                              <span className="text-sm">{value}</span>
                            </div>
                          ))}
                          {(!walletInfo.socials || Object.keys(walletInfo.socials).length === 0) && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
                              No accounts connected
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Organizations Section */}
                    <div className="p-4 border dark:border-gray-700 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-medium">Organizations</h2>
                        <button
                          onClick={() => setIsCreateOrgModalOpen(true)}
                          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Create
                        </button>
                      </div>

                      {/* Organizations List */}
                      <div className="space-y-2">
                        {walletInfo.organizations.map(org => (
                          <div
                            key={org.id}
                            className="group flex items-center justify-between p-2 bg-gray-50 dark:bg-dark-hover rounded hover:bg-gray-100 dark:hover:bg-dark-hover/70"
                          >
                            <div className="flex items-center gap-3">
                              <div>
                                <div className="font-medium">{org.name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{org.role}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {org.role === 'Admin' && (
                                <button
                                  className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                                >
                                  Roles
                                </button>
                              )}
                              <button
                                onClick={() => handleLeaveOrg(org.id)}
                                className="px-2 py-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              >
                                Leave
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Join Organization */}
                      <div className="mt-3 pt-3 border-t dark:border-gray-700">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={inviteCode}
                            onChange={(e) => setInviteCode(e.target.value)}
                            placeholder="Enter invite code"
                            className="flex-1 px-3 py-1.5 text-sm bg-gray-50 dark:bg-dark-hover border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500"
                          />
                          <button
                            onClick={handleJoinOrg}
                            disabled={!inviteCode.trim()}
                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Join
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Settings View */}
        {currentView === 'settings' && (
          <div className="flex-1 bg-white dark:bg-dark-surface overflow-y-auto">
            <div className="p-4">
              <div className="max-w-lg mx-auto space-y-6">
                <h2 className="text-lg font-medium mb-4">Settings</h2>
                
                {/* Theme Settings */}
                <div className="p-4 border dark:border-gray-700 rounded-lg">
                  <h3 className="text-sm font-medium mb-4">Appearance</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-300">Dark Mode</span>
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
                </div>

                {/* Data Management */}
                <div className="p-4 border dark:border-gray-700 rounded-lg">
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
          </div>
        )}

        {/* URL Bar */}
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
          onClick={() => setCurrentView('ai')}
          className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors ${
            currentView === 'ai' ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'
          }`}
          title="AI Assistant"
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

      {/* Create Organization Modal */}
      {isCreateOrgModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white dark:bg-dark-surface p-4 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-medium mb-4">Create Organization</h3>
            <input
              type="text"
              placeholder="Organization name"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              className="w-full p-2 border rounded dark:bg-dark-bg dark:border-gray-600 mb-4"
              autoFocus
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsCreateOrgModalOpen(false);
                  setNewOrgName('');
                }}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrg}
                disabled={!newOrgName.trim()}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
