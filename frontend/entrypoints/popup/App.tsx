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
  PaperAirplaneIcon,
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline';
import './App.css';
import { db } from './db';
import { Task, SubTask, Role, Requirement } from './types';
import mockWalletData from './data/wallet.json';
import { createCoinbaseWalletSDK } from '@coinbase/wallet-sdk';
import { JsonRpcProvider } from '@ethersproject/providers';
import { GoogleGenerativeAI } from '@google/generative-ai';
// Import MessageInput component
import { MessageInput } from './components/MessageInput';

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

// Add interface for Tool
interface Tool {
  name: string;
  url: string;
  logomark: string;
  publicDocs: string;
}

const isChromeExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;

// Initialize the model
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

// Add new function after other interface definitions and before the App function
interface UserData {
  wallet_address: string;
  eth_balance: string;
  usd_balance: string;
  chain_id: number;
  connected_accounts: {
    discord?: string;
    telegram?: string;
    github?: string;
    email?: string;
  };
  organizations: Organization[];
  last_updated: string;
}

const shortenAddress = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 7)}...${address.slice(-5)}`;
};

// Add type for background response
interface BackgroundResponse {
  currentUrl?: string;
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [roles, setRoles] = useState<Role[]>([{
    id: 'everyone',
    name: 'Everyone',
    createdAt: new Date(),
    tools: [],
    timeTracking: {
      enabled: false,
      isAITracking: false
    }
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
  const [tools, setTools] = useState<Tool[]>([]);
  const [timeTrackingEnabled, setTimeTrackingEnabled] = useState(false);
  const [isAITimeTracking, setIsAITimeTracking] = useState(false);
  const [hourlyRate, setHourlyRate] = useState<number | undefined>();
  const [productivityBonus, setProductivityBonus] = useState<5 | 10 | 15 | undefined>();
  const [arbitrageEnabled, setArbitrageEnabled] = useState(false);
  const [revaluationDeadline, setRevaluationDeadline] = useState<Date | undefined>();
  const [overtimeEnabled, setOvertimeEnabled] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [qualityTrackingEnabled, setQualityTrackingEnabled] = useState(false);
  const [codeReviewEnabled, setCodeReviewEnabled] = useState(false);
  const [testCoverageEnabled, setTestCoverageEnabled] = useState(false);
  const [qualityStandard, setQualityStandard] = useState<'basic' | 'advanced' | 'expert'>('basic');

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
            tools: [],
            timeTracking: {
              enabled: false,
              isAITracking: false
            }
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

  // Add useEffect to load tools
  useEffect(() => {
    fetch(chrome.runtime.getURL('tools_docs.json'))
      .then(response => response.json())
      .then(data => setTools(data))
      .catch(error => console.error('Error loading tools:', error));
  }, []);

  // Update getFilteredTools function
  const getFilteredTools = () => {
    return tools.filter(
      tool => 
        !selectedTools.includes(tool.url) && 
        (tool.url.toLowerCase().includes(toolSearch.toLowerCase()) ||
         tool.name.toLowerCase().includes(toolSearch.toLowerCase()))
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

  const handleCreateTask = async (newTask: TaskFormInput) => {
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

    // Update local state first
    setTasks(prev => [...prev, taskData]);
    setShowTaskForm(false);

    // Try to sync with backend, but don't block the UI
    try {
      // Update tasks with frontend_tasks.json
      const response = await fetch(chrome.runtime.getURL('frontend_tasks.json'));
      const frontendTasks = await response.json();
      
      // Try to sync with backend
      await Promise.allSettled([
        // Send to backend API
        fetch('http://localhost:3001/updateTasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(frontendTasks),
        }).catch(error => {
          console.warn('Failed to sync tasks with backend:', error);
          // Task is still saved locally, so we can continue
        }),

        // Start tracking
        fetch('http://localhost:3001/tracking/toggle', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'start' }),
        }).catch(error => {
          console.warn('Failed to start tracking on backend:', error);
          // Tracking failed but task is still created
        })
      ]);
    } catch (error) {
      console.warn('Error syncing with backend:', error);
      // Don't block the UI or show error - task is still created locally
    }
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
      timeTracking: {
        enabled: false,
        isAITracking: false
      }
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
      r.id === editingRole.id ? { 
        ...r, 
        name: newRoleName, 
        tools: selectedTools,
        timeTracking: {
          ...r.timeTracking,
          enabled: timeTrackingEnabled,
          isAITracking: isAITimeTracking,
          hourlyRate: hourlyRate,
          productivityBonus: productivityBonus,
          arbitrage: {
            enabled: arbitrageEnabled,
            revaluationDeadline: revaluationDeadline
          },
          overtime: {
            enabled: overtimeEnabled
          }
        }
      } : r
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

    // If clicking the same task that's active, stop it
    if (activeTask?.id === task.id) {
      // Save tracked time before stopping
      const finalTrackedTime = (task.trackedTime || 0) + (elapsedTime / 3600); // Convert seconds to hours
      setTasks(prev => prev.map(t => 
        t.id === task.id ? { ...t, trackedTime: finalTrackedTime } : t
      ));
      
      // Stop tracking
      setActiveTask(null);
      setElapsedTime(0);
      
      // Update badge text if in extension context
      if (typeof chrome !== 'undefined' && chrome.action) {
        chrome.action.setBadgeText({ text: '' });
      }
      
      // Save state if in extension context
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ 
          activeTask: null,
          elapsedTime: 0
        }).catch(console.error);
      }
    } else {
      // If there's an active task, save its time before switching
      if (activeTask) {
        const finalTrackedTime = (activeTask.trackedTime || 0) + (elapsedTime / 3600);
        setTasks(prev => prev.map(t => 
          t.id === activeTask.id ? { ...t, trackedTime: finalTrackedTime } : t
        ));
      }
      
      // Start tracking new task
      setActiveTask(task);
      setElapsedTime(0);
      
      // Save state if in extension context
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ 
          activeTask: {
            ...task,
            createdAt: task.createdAt.toISOString()
          },
          elapsedTime: 0
        }).catch(console.error);
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
    if (!isChromeExtension) return;

    const getCurrentUrl = async () => {
      const response = await new Promise<BackgroundResponse>((resolve) => {
        chrome.runtime.sendMessage({ type: 'getCurrentUrl' }, resolve);
      });

      if (response?.currentUrl) {
        setCurrentUrl(response.currentUrl);
      }
    };

    // Initial URL fetch
    getCurrentUrl();
    
    // Poll for URL changes
    const intervalId = setInterval(getCurrentUrl, 1000);

    return () => clearInterval(intervalId);
  }, []);

  // Update timer effect to handle connection errors
  useEffect(() => {
    if (!activeTask) return;

    // Start the timer
    const timer = setInterval(() => {
      setElapsedTime(prev => {
        const newTime = prev + 1;
        // Update badge text if in extension context
        if (typeof chrome !== 'undefined' && chrome.action) {
          const minutes = Math.floor(newTime / 60);
          const hours = Math.floor(minutes / 60);
          const displayTime = hours > 0 
            ? `${hours}:${String(minutes % 60).padStart(2, '0')}`
            : `${minutes}:${String(newTime % 60).padStart(2, '0')}`;
          chrome.action.setBadgeText({ text: displayTime });
          chrome.action.setBadgeBackgroundColor({ color: '#A8ACE0' });
          
          // Save elapsed time if in extension context
          if (chrome.storage) {
            chrome.storage.local.set({ elapsedTime: newTime }).catch(console.error);
          }
        }
        return newTime; // Always return the new time, regardless of Chrome extension context
      });
    }, 1000);

    // Cleanup
        return () => {
      clearInterval(timer);
      if (typeof chrome !== 'undefined' && chrome.action) {
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

  // Add new function inside App function, before handleConnectWallet
  const fetchUserData = async (address: string) => {
    try {
      const response = await fetch(chrome.runtime.getURL('users.json'));
      const data = await response.json();
      const user = data.users.find((u: UserData) => 
        u.wallet_address.toLowerCase() === address.toLowerCase()
      );
      return user || null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  };

  // Replace the handleConnectWallet function
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
            params: [{ chainId: '0xaa36a7' }],
          });
          const updatedChainIdHex = await provider.request({ method: 'eth_chainId' }) as string;
          chainId = parseInt(updatedChainIdHex, 16);
        } catch (error) {
          console.error('Error switching to Sepolia:', error);
        }
      }

      // Fetch user data from users.json
      const user = await fetchUserData(address);
      setUserData(user);

      // If user data exists, use it to set wallet info
      if (user) {
        setWalletInfo({
          address,
          balance: `${user.eth_balance} ETH (${user.usd_balance} USD)`,
          organizations: user.organizations || [],
          socials: user.connected_accounts || {},
          smartWallet,
          chainId: user.chain_id
        });
        
        // Initialize social inputs with existing data
        setSocialInputs(user.connected_accounts || {});
      } else {
        // If no user data, use blockchain data
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
      
      setCurrentView('profile');
    } catch (error) {
      console.error('Error connecting smart wallet:', error);
      setSmartWalletError(error instanceof Error ? error.message : 'Failed to connect smart wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  // Update initializeSmartWallet useEffect
  useEffect(() => {
    const initializeSmartWallet = async () => {
      try {
        const smartWallet = createCoinbaseWalletSDK({
          appName: 'AIDAO Manager'
        });
        
        const provider = smartWallet.getProvider();
        
        try {
          const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
          if (accounts && accounts.length > 0) {
            const address = accounts[0];
            
            const chainIdHex = await provider.request({ method: 'eth_chainId' }) as string;
            let chainId = parseInt(chainIdHex, 16);
            
            // Fetch user data from users.json
            const user = await fetchUserData(address);
            setUserData(user);

            if (user) {
              setWalletInfo({
                address,
                balance: `${user.eth_balance} ETH (${user.usd_balance} USD)`,
                organizations: user.organizations || [],
                socials: user.connected_accounts || {},
                smartWallet,
                chainId: user.chain_id
              });
              
              // Initialize social inputs with existing data
              setSocialInputs(user.connected_accounts || {});
            } else {
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
      className="corners w-[400px] min-h-[600px] bg-gray-100 dark:bg-dark-bg text-gray-900 dark:text-gray-100 transition-colors shadow-lg flex flex-col rounded-lg"
    >
      {/* Dev Mode URL Display */}
      {devMode && (
        <div className="sticky top-0 z-50 bg-gray-50 dark:bg-dark-surface border-b dark:border-gray-700">
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

      {/* Timer Display - Only shown when a task is active */}
        {activeTask && (
        <div className="sticky top-0 z-40 bg-white dark:bg-dark-surface border-b dark:border-gray-700">
          <div className="px-3 py-2 flex items-center justify-between">
            <div className="text-sm font-mono text-gray-500 dark:text-gray-400">
              {formatTime(elapsedTime)}
            </div>
                  <button
              onClick={() => {
                // Save tracked time before stopping
                const finalTrackedTime = (activeTask.trackedTime || 0) + (elapsedTime / 3600);
                setTasks(prev => prev.map(t => 
                  t.id === activeTask.id ? { ...t, trackedTime: finalTrackedTime } : t
                ));
                setActiveTask(null);
              }}
                    className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  >
                    ■
                  </button>
            </div>
          </div>
        )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tasks View */}
        {currentView === 'tasks' && (
          <>
            {/* Role Selection */}
        <div 
              className="sticky top-0 z-30 px-3 py-2 border-b dark:border-gray-700 flex gap-2 overflow-hidden relative bg-white dark:bg-dark-surface"
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
                      ? 'bg-[#EA627A] text-white'
                      : 'bg-gray-200 dark:bg-dark-surface hover:bg-[#EE8398] hover:text-white dark:hover:bg-[#EE8398]'
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
                  className="px-3 py-1 text-sm rounded whitespace-nowrap text-gray-500 dark:text-gray-400 hover:text-[#EA627A] dark:hover:text-[#EA627A] flex items-center gap-1"
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
                  <div key={task.id} className="border-b border-gray-100 dark:border-gray-800/50">
                    {/* Task Header */}
                    <div 
                      className="group flex items-center px-3 py-2 hover:bg-gray-50/50 dark:hover:bg-dark-hover/50 cursor-pointer"
                      onClick={() => toggleTaskCollapse(task.id)}
                    >
                          {/* Play button */}
                      <button 
                            className="mr-2 text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 transition-colors"
                        onClick={(e) => handlePlayTask(task, e)}
                      >
                        {activeTask?.id === task.id ? '■' : '▶'}
                      </button>
                          
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <div className="text-sm dark:text-gray-200 text-left truncate">{task.title}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {activeTask?.id === task.id ? (
                                `${Math.floor(elapsedTime / 3600)}:${String(Math.floor((elapsedTime % 3600) / 60)).padStart(2, '0')}`
                              ) : (
                                `${Math.floor(task.trackedTime)}:${String(Math.floor((task.trackedTime % 1) * 60)).padStart(2, '0')}`
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Tool icons */}
                            <div className="flex -space-x-1 gap-1">
                              {task.tools.map(toolUrl => {
                                const tool = tools.find(t => t.url === toolUrl);
                                if (!tool) return null;
                                return (
                                  <a
                                    key={tool.url}
                                    href={`https://${tool.url}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={tool.name}
                                    className="w-5 h-5 rounded-full overflow-hidden"
                                  >
                                    <img 
                                      src={tool.logomark} 
                                      alt={tool.name}
                                      className="w-full h-full object-cover"
                                    />
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                    </div>

                        {/* Task Content */}
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
                      className="w-full px-3 py-1.5 bg-[#A8ACE0] text-white rounded hover:bg-[#8A8FC6] transition-colors flex items-center justify-center gap-2 disabled:bg-[#D7DAFA]"
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
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{shortenAddress(walletInfo.address)}</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(walletInfo.address);
                                // Optional: Add a toast notification here
                              }}
                              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                              title="Copy address"
                            >
                              <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
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
                            className="w-full mt-2 px-2 py-1 text-sm bg-[#A8ACE0] text-white rounded hover:bg-[#8A8FC6]"
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
                          className="px-2 py-1 text-sm bg-[#A8ACE0] text-white rounded hover:bg-[#8A8FC6]"
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
                            className="px-2 py-1 text-sm bg-[#A8ACE0] text-white rounded hover:bg-[#8A8FC6] disabled:bg-[#D7DAFA] disabled:cursor-not-allowed"
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
                      <span className={`${devMode ? 'translate-x-5 bg-[#A8ACE0]' : 'translate-x-1 bg-white'} inline-block h-3 w-3 transform rounded-full transition-transform`} />
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
                      className="px-2 py-1 text-sm bg-[#A8ACE0] text-white rounded hover:bg-[#8A8FC6] transition-colors flex items-center gap-1"
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

      {/* AI Chat Input - Replace with MessageInput */}
      <MessageInput
        onSubmit={async (message, destination) => {
          switch (destination) {
            case 'ai':
              await handleAiSubmit(message);
              break;
            case 'discord':
              // Handle Discord message
              if (walletInfo?.socials?.discord) {
                // TODO: Implement Discord message sending
                console.log('Sending to Discord:', message);
              }
              break;
            case 'telegram':
              // Handle Telegram message
              if (walletInfo?.socials?.telegram) {
                // TODO: Implement Telegram message sending
                console.log('Sending to Telegram:', message);
              }
              break;
          }
        }}
        isLoading={isAiLoading}
        connectedAccounts={walletInfo?.socials}
      />

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

            <div className="flex-1 overflow-y-auto p-3 space-y-4">
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
                  autoFocus
                />
              </div>

              {/* Performance Tracking Options */}
              <div className="space-y-3 pt-2 border-t dark:border-gray-700">
                <h3 className="text-sm font-medium dark:text-gray-200">Performance Tracking</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-2 rounded bg-gray-50 dark:bg-gray-800/50">
                    <input
                      type="checkbox"
                      id="enableTimeTracking"
                      checked={timeTrackingEnabled}
                      onChange={(e) => setTimeTrackingEnabled(e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-transparent"
                    />
                    <label htmlFor="enableTimeTracking" className="text-sm dark:text-gray-300">
                      Time Tracking
                    </label>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded bg-gray-50 dark:bg-gray-800/50">
                    <input
                      type="checkbox"
                      id="enableQualityTracking"
                      checked={qualityTrackingEnabled}
                      onChange={(e) => setQualityTrackingEnabled(e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-transparent"
                    />
                    <label htmlFor="enableQualityTracking" className="text-sm dark:text-gray-300">
                      Quality Tracking
                    </label>
                  </div>
                </div>
              </div>

              {/* Time Tracking Settings - Only shown if time tracking is enabled */}
              {timeTrackingEnabled && (
                <div className="space-y-3 pt-2 border-t dark:border-gray-700">
                  <h3 className="text-sm font-medium dark:text-gray-200">Time Settings</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 p-2 rounded bg-gray-50 dark:bg-gray-800/50">
                      <input
                        type="checkbox"
                        id="aiTimeTracking"
                        checked={isAITimeTracking}
                        onChange={(e) => setIsAITimeTracking(e.target.checked)}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-transparent"
                      />
                      <label htmlFor="aiTimeTracking" className="text-sm dark:text-gray-300">
                        AI Time Tracking
                      </label>
                    </div>

                    <div className="flex items-center gap-2 p-2 rounded bg-gray-50 dark:bg-gray-800/50">
                      <input
                        type="checkbox"
                        id="overtimeTracking"
                        checked={overtimeEnabled}
                        onChange={(e) => setOvertimeEnabled(e.target.checked)}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-transparent"
                      />
                      <label htmlFor="overtimeTracking" className="text-sm dark:text-gray-300">
                        Allow Overtime
                      </label>
                    </div>
                  </div>

                  <div className="space-y-3">
              <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Base Hourly Rate (USD)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={hourlyRate || ''}
                        onChange={(e) => setHourlyRate(e.target.value ? parseFloat(e.target.value) : undefined)}
                        className="w-full px-2 py-1.5 bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-gray-100 text-sm"
                        placeholder="Enter base rate..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Performance Bonus
                      </label>
                      <select
                        value={productivityBonus || ''}
                        onChange={(e) => setProductivityBonus(e.target.value ? parseInt(e.target.value) as 5 | 10 | 15 : undefined)}
                        className="w-full px-2 py-1.5 bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-gray-100 text-sm"
                      >
                        <option value="">No bonus</option>
                        <option value="5">5% for high performance</option>
                        <option value="10">10% for exceptional</option>
                        <option value="15">15% for outstanding</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Quality Tracking Settings - Only shown if quality tracking is enabled */}
              {qualityTrackingEnabled && (
                <div className="space-y-3 pt-2 border-t dark:border-gray-700">
                  <h3 className="text-sm font-medium dark:text-gray-200">Quality Metrics</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 p-2 rounded bg-gray-50 dark:bg-gray-800/50">
                      <input
                        type="checkbox"
                        id="codeReview"
                        checked={codeReviewEnabled}
                        onChange={(e) => setCodeReviewEnabled(e.target.checked)}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-transparent"
                      />
                      <label htmlFor="codeReview" className="text-sm dark:text-gray-300">
                        Code Review
                      </label>
                    </div>

                    <div className="flex items-center gap-2 p-2 rounded bg-gray-50 dark:bg-gray-800/50">
                      <input
                        type="checkbox"
                        id="testCoverage"
                        checked={testCoverageEnabled}
                        onChange={(e) => setTestCoverageEnabled(e.target.checked)}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-transparent"
                      />
                      <label htmlFor="testCoverage" className="text-sm dark:text-gray-300">
                        Test Coverage
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Quality Standards
                    </label>
                    <select
                      value={qualityStandard || ''}
                      onChange={(e) => setQualityStandard(e.target.value as 'basic' | 'advanced' | 'expert')}
                      className="w-full px-2 py-1.5 bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-gray-100 text-sm"
                    >
                      <option value="basic">Basic (80% pass rate)</option>
                      <option value="advanced">Advanced (90% pass rate)</option>
                      <option value="expert">Expert (95% pass rate)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Tool Selection */}
              <div className="space-y-2 pt-2 border-t dark:border-gray-700">
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
                  {selectedTools.map(toolUrl => {
                    const tool = tools.find(t => t.url === toolUrl);
                    if (!tool) return null;
                    return (
                    <div 
                        key={tool.url}
                      className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs"
                    >
                        <img 
                          src={tool.logomark} 
                          alt={`${tool.name} logo`} 
                          className="w-4 h-4 object-contain"
                        />
                        <span>{tool.name}</span>
                      <button
                          onClick={() => setSelectedTools(prev => prev.filter(t => t !== tool.url))}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                      >
                        ×
                      </button>
                    </div>
                    );
                  })}
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
                        className="w-full px-2 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-dark-hover border-b last:border-b-0 dark:border-gray-600 flex items-center gap-2"
                      >
                        <img 
                          src={tool.logomark} 
                          alt={`${tool.name} logo`} 
                          className="w-5 h-5 object-contain"
                        />
                        <div>
                          <div className="text-sm font-medium dark:text-gray-200">{tool.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{tool.url}</div>
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
                  setTimeTrackingEnabled(false);
                  setIsAITimeTracking(false);
                  setHourlyRate(undefined);
                  setProductivityBonus(undefined);
                  setArbitrageEnabled(false);
                  setRevaluationDeadline(undefined);
                  setOvertimeEnabled(false);
                  setQualityTrackingEnabled(false);
                  setCodeReviewEnabled(false);
                  setTestCoverageEnabled(false);
                  setQualityStandard('basic');
                }}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={editingRole ? handleUpdateRole : handleCreateRole}
                disabled={!newRoleName.trim()}
                className="px-3 py-1.5 text-sm bg-[#A8ACE0] text-white rounded hover:bg-[#8A8FC6] disabled:bg-[#D7DAFA] disabled:cursor-not-allowed"
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
                className="px-3 py-1.5 text-sm bg-[#A8ACE0] text-white rounded hover:bg-[#8A8FC6] disabled:bg-[#D7DAFA] disabled:cursor-not-allowed"
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
