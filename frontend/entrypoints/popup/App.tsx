import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TaskTable } from './components/TaskTable';
import { AIAssistant, AIAssistantHandle } from './components/AIAssistant';
import { TaskForm } from './components/TaskForm';
import {
  Cog6ToothIcon,
  UserCircleIcon,
  ChatBubbleLeftIcon,
  ClipboardDocumentListIcon,
  SunIcon,
  MoonIcon,
  PaperAirplaneIcon
} from '@heroicons/react/24/outline';
import './App.css';
import { db } from './db';
import { Task, SubTask, Role, Requirement } from './types';
import mockWalletData from './data/wallet.json';
import { createCoinbaseWalletSDK } from '@coinbase/wallet-sdk';
import { JsonRpcProvider } from '@ethersproject/providers';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

interface EthereumProvider {
  request(args: { method: string; params?: any[] }): Promise<any>;
  on(eventName: string, handler: (...args: any[]) => void): void;
  removeListener(eventName: string, handler: (...args: any[]) => void): void;
}

interface WalletSDK {
  getProvider(): EthereumProvider;
}

interface WalletInfo {
  address: string;
  balance: string;
  organizations: Organization[];
  socials: SocialConnections;
  smartWallet?: WalletSDK;
  chainId: number;
}

const isChromeExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;

// Initialize the model
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

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
  const [isConnecting, setIsConnecting] = useState(false);
  const [smartWalletError, setSmartWalletError] = useState<string | null>(null);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [devMode, setDevMode] = useState<boolean>(true); // Dev mode enabled by default
  const aiAssistantRef = useRef<AIAssistantHandle>(null);

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
        // Set selectedRole to 'everyone' if it's not set or invalid
        setSelectedRole(storedState.selectedRole && storedRoles.some(r => r.id === storedState.selectedRole) 
          ? storedState.selectedRole 
          : 'everyone');
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
    const mockWallet = {
      ...mockWalletData.mockWallets[0],
      chainId: devMode ? 11155111 : 1 // Add chainId based on dev mode
    };
    setWalletInfo(mockWallet);
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

  const handleLogout = async () => {
    try {
      if (walletInfo?.smartWallet) {
        // Just clear the wallet info from state
        // The provider will automatically disconnect when the user closes the session
        setWalletInfo(null);
        setSmartWalletError(null);
        
        // Clear any stored provider state
        localStorage.removeItem('walletconnect');
        localStorage.removeItem('WALLET_CONNECT_V2_INITIALIZED');
      }
    } catch (error) {
      console.error('Error logging out:', error);
      setSmartWalletError(error instanceof Error ? error.message : 'Failed to logout');
    }
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

  // Add a helper function to fetch balance
  const fetchBalance = async (provider: EthereumProvider, address: string) => {
    try {
      const balanceHex = await provider.request({ 
        method: 'eth_getBalance',
        params: [address, 'latest']
      }) as string;
      const balanceInWei = parseInt(balanceHex, 16);
      const balanceInEth = balanceInWei / 1e18;
      return balanceInEth.toFixed(4);
    } catch (error) {
      console.error('Error fetching balance:', error);
      return '0.0000';
    }
  };

  // Update handleDevModeToggle to properly fetch balance
  const handleDevModeToggle = async () => {
    setDevMode(!devMode);
    
    // If we have a connected wallet, switch networks
    if (walletInfo?.smartWallet) {
      const provider = walletInfo.smartWallet.getProvider();
      try {
        if (!devMode) { // Switching to dev mode (Sepolia)
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xaa36a7' }], // 11155111 in hex
          });
        } else { // Switching to mainnet
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x1' }], // 1 in hex
          });
        }
        
        // Get updated chain ID and balance
        const chainIdHex = await provider.request({ method: 'eth_chainId' }) as string;
        const chainId = parseInt(chainIdHex, 16);
        
        const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
        if (accounts.length > 0) {
          const balance = await fetchBalance(provider, accounts[0]);
          
          setWalletInfo(prev => prev ? {
            ...prev,
            chainId,
            balance: `${balance} ETH`
          } : null);
        }
      } catch (error) {
        console.error('Error switching networks:', error);
      }
    }
  };

  // Update handleConnectWallet to use the new fetchBalance function
  const handleConnectWallet = async () => {
    setIsConnecting(true);
    setSmartWalletError(null);
    
    try {
      const smartWallet = createCoinbaseWalletSDK({
        appName: 'AIDAO Manager'
      });
      
      const provider = smartWallet.getProvider();
      
      // Request account access
      const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
      const address = accounts[0];
      
      // Get current chain ID
      const chainIdHex = await provider.request({ method: 'eth_chainId' }) as string;
      let chainId = parseInt(chainIdHex, 16);
      
      // If in dev mode and not on Sepolia, switch to Sepolia
      if (devMode && chainId !== 11155111) {
        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xaa36a7' }], // 11155111 in hex
          });
          // Get updated chain ID
          const updatedChainIdHex = await provider.request({ method: 'eth_chainId' }) as string;
          chainId = parseInt(updatedChainIdHex, 16);
        } catch (error) {
          console.error('Error switching to Sepolia:', error);
          // Continue with current chain if switch fails
        }
      }
      
      // Get balance using the new helper function
      const balance = await fetchBalance(provider, address);
      
      setWalletInfo({
        address,
        balance: `${balance} ETH`,
        organizations: [],
        socials: {},
        smartWallet,
        chainId
      });
      
      // Ensure we stay on or return to the profile view after successful connection
      setCurrentView('profile');
    } catch (error) {
      console.error('Error connecting smart wallet:', error);
      setSmartWalletError(error instanceof Error ? error.message : 'Failed to connect smart wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  // Update initializeSmartWallet to use the new fetchBalance function
  useEffect(() => {
    const initializeSmartWallet = async () => {
      try {
        const smartWallet = createCoinbaseWalletSDK({
          appName: 'AIDAO Manager'
        });
        
        // Get the provider
        const provider = smartWallet.getProvider();
        
        // Check if we have a connected account
        try {
          const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
          if (accounts && accounts.length > 0) {
            const address = accounts[0];
            
            // Get current chain ID
            const chainIdHex = await provider.request({ method: 'eth_chainId' }) as string;
            let chainId = parseInt(chainIdHex, 16);
            
            // Get balance using the new helper function
            const balance = await fetchBalance(provider, address);
            
            setWalletInfo({
              address,
              balance: `${balance} ETH`,
              organizations: [],
              socials: {},
              smartWallet,
              chainId
            });
          }
        } catch (error) {
          console.error('Error checking wallet connection:', error);
        }
      } catch (error) {
        console.error('Error initializing smart wallet:', error);
        setSmartWalletError(error instanceof Error ? error.message : 'Failed to initialize smart wallet');
      }
    };

    initializeSmartWallet();
  }, [devMode]);

  const handleAiSubmit = async (input: string) => {
    if (!input.trim()) return;

    // Create and add user message
    const userMessage = {
      id: crypto.randomUUID(),
      text: input,
      sender: 'user' as const,
      timestamp: new Date()
    };
    aiAssistantRef.current?.addMessage(userMessage);

    setIsAiLoading(true);
    setAiError(null);

    try {
      const result = await model.generateContent(input);
      const response = await result.response;
      const aiMessage = {
        id: crypto.randomUUID(),
        text: response.text(),
        sender: 'ai' as const,
        timestamp: new Date()
      };
      aiAssistantRef.current?.addMessage(aiMessage);
    } catch (err) {
      console.error('AI Assistant error:', err);
      setAiError(err instanceof Error ? err.message : 'An error occurred while connecting to the AI service');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Add this function to switch to AI tab
  const switchToAITab = useCallback(() => {
    setCurrentView('ai');
  }, []);

  return (
    <div 
      ref={appRef}
      className="w-[400px] min-h-[600px] bg-gray-100 dark:bg-dark-bg text-gray-900 dark:text-gray-100 transition-colors shadow-lg flex flex-col rounded-lg"
    >
      {/* Dev Mode URL Display */}
      {devMode && (
        <div className="sticky top-0 z-20 bg-gray-50 dark:bg-dark-surface border-b dark:border-gray-700">
          <div className="px-3 py-1">
            <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
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
      )}

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
              className="sticky top-0 z-10 px-3 py-2 border-b dark:border-gray-700 flex gap-2 overflow-hidden relative bg-white dark:bg-dark-surface"
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

        {/* Messages View */}
        {currentView === 'ai' && (
          <div className="flex-1 bg-white dark:bg-dark-surface overflow-hidden">
            <AIAssistant 
              ref={aiAssistantRef}
              isLoading={isAiLoading}
              error={aiError}
            />
      </div>
        )}

        {/* Profile View */}
        {currentView === 'profile' && (
          <div className="flex-1 bg-white dark:bg-dark-surface overflow-y-auto">
            {/* Dev Test Button */}
            <button
              onClick={handleDevTest}
              className="absolute top-1 left-1 px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Dev Test
            </button>

            <div className="p-2">
              <div className="max-w-lg mx-auto space-y-2">
                {/* Login Section */}
                {!walletInfo ? (
                  <div className="p-3 border dark:border-gray-700 rounded-lg">
                    <h2 className="text-base font-medium mb-2">Login</h2>
                    {smartWalletError && (
                      <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-sm">
                        {smartWalletError}
            </div>
                    )}
                    <button
                      onClick={handleConnectWallet}
                      disabled={isConnecting}
                      className="w-full px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isConnecting ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          <span>Connecting...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          Connect Smart Wallet
                        </>
                      )}
                    </button>
          </div>
                ) : (
                  <>
                    {/* Wallet Info Section */}
                    <div className="p-3 border dark:border-gray-700 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h2 className="text-base font-medium">Wallet</h2>
                        <button
                          onClick={handleLogout}
                          className="px-2 py-1 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Logout
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Address:</span>
                          <span className="font-mono">{walletInfo.address}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">
                            Balance:
                            {devMode && (
                              <span className="ml-1 text-xs text-gray-400">(Sepolia)</span>
                            )}
                          </span>
                          <span className="font-medium">{walletInfo.balance}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Network:</span>
                          <span className="font-medium">
                            {walletInfo.chainId === 1 ? 'Mainnet' : 'Sepolia'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Social Connections - Compact Version */}
                    <div className="p-3 border dark:border-gray-700 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h2 className="text-base font-medium">Connected Accounts</h2>
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
                        <div className="space-y-2">
                          {['email', 'discord', 'telegram', 'github'].map(platform => (
                            <div key={platform} className="flex gap-2">
                              <input
                                type={platform === 'email' ? 'email' : 'text'}
                                value={socialInputs[platform as keyof SocialConnections] || ''}
                                onChange={(e) => setSocialInputs(prev => ({ ...prev, [platform]: e.target.value }))}
                                placeholder={platform.charAt(0).toUpperCase() + platform.slice(1)}
                                className="flex-1 px-2 py-1 text-sm bg-gray-50 dark:bg-dark-hover border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          ))}
                          <button
                            onClick={handleSaveSocials}
                            className="w-full mt-2 px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {Object.entries(walletInfo.socials || {}).map(([platform, value]) => value && (
                            <div key={platform} className="flex items-center justify-between text-sm">
                              <span className="capitalize text-gray-500 dark:text-gray-400">{platform}:</span>
                              <span>{value}</span>
                            </div>
                          ))}
                          {(!walletInfo.socials || Object.keys(walletInfo.socials).length === 0) && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-1">
                              No accounts connected
                            </div>
            )}
          </div>
                      )}
        </div>

                    {/* Organizations Section - Compact Version */}
                    <div className="p-3 border dark:border-gray-700 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h2 className="text-base font-medium">Organizations</h2>
                        <button
                          onClick={() => setIsCreateOrgModalOpen(true)}
                          className="px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Create
                        </button>
                      </div>

                      {/* Organizations List */}
                      <div className="space-y-1">
                        {walletInfo.organizations.map(org => (
                          <div
                            key={org.id}
                            className="group flex items-center justify-between p-1.5 bg-gray-50 dark:bg-dark-hover rounded hover:bg-gray-100 dark:hover:bg-dark-hover/70"
                          >
                            <div>
                              <div className="text-sm font-medium">{org.name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{org.role}</div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {org.role === 'Admin' && (
                                <button className="px-1.5 py-0.5 text-xs text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200">
                                  Roles
                                </button>
                              )}
                              <button
                                onClick={() => handleLeaveOrg(org.id)}
                                className="px-1.5 py-0.5 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              >
                                Leave
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Join Organization */}
                      <div className="mt-2 pt-2 border-t dark:border-gray-700">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={inviteCode}
                            onChange={(e) => setInviteCode(e.target.value)}
                            placeholder="Enter invite code"
                            className="flex-1 px-2 py-1 text-sm bg-gray-50 dark:bg-dark-hover border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500"
                          />
                          <button
                            onClick={handleJoinOrg}
                            disabled={!inviteCode.trim()}
                            className="px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* Settings View - Compact Version */}
        {currentView === 'settings' && (
          <div className="flex-1 bg-white dark:bg-dark-surface overflow-y-auto">
            <div className="p-2">
              <div className="max-w-lg mx-auto">
                <h2 className="text-base font-medium mb-2 px-1">Settings</h2>
                
                {/* Settings List */}
                <div className="border dark:border-gray-700 rounded-lg divide-y dark:divide-gray-700">
                  {/* Appearance Settings */}
                  <div className="p-2.5 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Dark Mode</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Switch between light and dark theme
                      </p>
                    </div>
                    <button
                      onClick={toggleTheme}
                      className="relative inline-flex h-5 w-9 items-center rounded-full bg-gray-200 dark:bg-gray-700 transition-colors focus:outline-none"
                    >
                      <span className={`${isDark ? 'translate-x-5' : 'translate-x-1'} inline-block h-3 w-3 transform rounded-full bg-white transition-transform`} />
                    </button>
                  </div>

                  {/* Dev Mode Setting */}
                  <div className="p-2.5 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Developer Mode</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Enable Sepolia testnet and developer features
                      </p>
                    </div>
                    <button
                      onClick={handleDevModeToggle}
                      className="relative inline-flex h-5 w-9 items-center rounded-full bg-gray-200 dark:bg-gray-700 transition-colors focus:outline-none"
                    >
                      <span className={`${devMode ? 'translate-x-5 bg-blue-600' : 'translate-x-1 bg-white'} inline-block h-3 w-3 transform rounded-full transition-transform`} />
                    </button>
                  </div>

                  {/* Data Export Setting */}
                  <div className="p-2.5 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Export Data</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Download your tasks, roles, and tracking data
                      </p>
                    </div>
                    <button
                      onClick={handleExportData}
                      className="px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Export
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Chat Input - Sticky to bottom */}
      <div className="sticky bottom-12 z-10 border-t dark:border-gray-700 bg-white dark:bg-dark-surface overflow-hidden">
        <form className="flex" onSubmit={(e) => {
          e.preventDefault();
          if (!aiInput.trim()) return;
          handleAiSubmit(aiInput);
          setAiInput('');
        }}>
          <input
            type="text"
            placeholder="Ask AI..."
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            className="flex-1 px-3 py-1.5 bg-transparent text-sm focus:outline-none"
            disabled={isAiLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (aiInput.trim()) {
                  handleAiSubmit(aiInput);
                  setAiInput('');
                }
                switchToAITab();
              }
            }}
          />
          <button
            type="submit"
            disabled={!aiInput.trim() || isAiLoading}
            className="px-3 py-1.5 text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isAiLoading ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <PaperAirplaneIcon className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>

      {/* Bottom Navigation */}
      <div className="sticky bottom-0 z-10 h-12 border-t dark:border-gray-700 bg-white dark:bg-dark-surface flex items-center justify-around px-3 overflow-hidden">
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
          title="Messages"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-xl w-full max-w-2xl mx-4 h-[85vh] flex flex-col">
            <div className="px-3 py-2 border-b dark:border-gray-700">
              <h2 className="text-xs text-gray-500 dark:text-gray-400">
                {editingRole ? 'Edit Role' : 'Create New Role'}
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Role Name Input */}
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 text-left mb-1">
                  Role Name
                </label>
                <input
                  type="text"
                  placeholder="Enter role name..."
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full px-2 py-1.5 bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-gray-100 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      editingRole ? handleUpdateRole() : handleCreateRole();
                    }
                  }}
                  autoFocus
                />
              </div>

              {/* Tool Search */}
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 text-left mb-1">
                  Tools
                </label>
                <input
                  type="text"
                  placeholder="Search tools..."
                  value={toolSearch}
                  onChange={(e) => setToolSearch(e.target.value)}
                  className="w-full px-2 py-1.5 bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-gray-100 text-sm"
                />
                
                {/* Selected Tools */}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {selectedTools.map(tool => (
                    <div 
                      key={tool}
                      className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs"
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
                  <div className="mt-1.5 border rounded-md shadow-lg dark:border-gray-600 max-h-48 overflow-y-auto">
                    {getFilteredTools().map(tool => (
                      <button
                        key={tool.url}
                        onClick={() => {
                          setSelectedTools(prev => [...prev, tool.url]);
                          setToolSearch('');
                        }}
                        className="w-full px-2 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-dark-hover border-b last:border-b-0 dark:border-gray-600"
                      >
                        <div className="text-sm font-medium dark:text-gray-200">{tool.url}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {tool.description} • {tool.category}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 border-t dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsRoleModalOpen(false);
                  setSelectedTools([]);
                  setToolSearch('');
                }}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={editingRole ? handleUpdateRole : handleCreateRole}
                disabled={!newRoleName.trim()}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingRole ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Organization Modal */}
      {isCreateOrgModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-xl w-full max-w-2xl mx-4 h-[85vh] flex flex-col">
            <div className="px-3 py-2 border-b dark:border-gray-700">
              <h2 className="text-xs text-gray-500 dark:text-gray-400">Create New Organization</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 text-left mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  placeholder="Enter organization name..."
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="w-full px-2 py-1.5 bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-gray-100 text-sm"
                  autoFocus
                />
              </div>
            </div>

            <div className="p-3 border-t dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsCreateOrgModalOpen(false);
                  setNewOrgName('');
                }}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrg}
                disabled={!newOrgName.trim()}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
