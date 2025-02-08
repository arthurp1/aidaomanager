import { Task, SubTask, Role, Requirement } from './types';

const DB_NAME = 'aidaoDB';
const DB_VERSION = 1;

type MessageSource = 'ai' | 'discord' | 'telegram';

interface Message {
  id: string;
  text: string;
  sender: 'user' | MessageSource;
  timestamp: Date;
}

interface DBSchema {
  tasks: Task[];
  subtasks: SubTask[];
  roles: Role[];
  requirements: Requirement[];
  activeTask: Task | null;
  selectedRole: string;
  elapsedTime: number;
}

interface AppState {
  activeTask: Task | null;
  selectedRole: string;
  elapsedTime: number;
  messages?: Message[];
  messageScrollPosition?: number;
}

class DatabaseService {
  private db: IDBDatabase | null = null;
  private isInitializing: boolean = false;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    // If already initialized, return immediately
    if (this.db) return;
    
    // If initialization is in progress, return the existing promise
    if (this.initPromise) return this.initPromise;

    this.isInitializing = true;
    this.initPromise = new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
          this.isInitializing = false;
          this.initPromise = null;
          reject(request.error);
        };

        request.onsuccess = () => {
          this.db = request.result;
          this.isInitializing = false;
          resolve();
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          
          // Create object stores if they don't exist
          if (!db.objectStoreNames.contains('tasks')) {
            db.createObjectStore('tasks', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('subtasks')) {
            db.createObjectStore('subtasks', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('roles')) {
            db.createObjectStore('roles', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('requirements')) {
            db.createObjectStore('requirements', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('state')) {
            db.createObjectStore('state', { keyPath: 'id' });
          }
        };
      } catch (error) {
        this.isInitializing = false;
        this.initPromise = null;
        reject(error);
      }
    });

    return this.initPromise;
  }

  private getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // Tasks
  async getAllTasks(): Promise<Task[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('tasks');
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        // Convert date strings back to Date objects
        const tasks = request.result.map(task => ({
          ...task,
          createdAt: new Date(task.createdAt)
        }));
        resolve(tasks);
      };
    });
  }

  async saveTasks(tasks: Task[]): Promise<void> {
    const store = this.getStore('tasks', 'readwrite');
    // Clear existing tasks
    store.clear();
    // Add new tasks
    tasks.forEach(task => {
      store.add({
        ...task,
        createdAt: task.createdAt.toISOString()
      });
    });
  }

  // Subtasks
  async getAllSubtasks(): Promise<SubTask[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('subtasks');
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const subtasks = request.result.map(subtask => ({
          ...subtask,
          createdAt: new Date(subtask.createdAt),
          updatedAt: new Date(subtask.updatedAt)
        }));
        resolve(subtasks);
      };
    });
  }

  async saveSubtasks(subtasks: SubTask[]): Promise<void> {
    const store = this.getStore('subtasks', 'readwrite');
    store.clear();
    subtasks.forEach(subtask => {
      store.add({
        ...subtask,
        createdAt: subtask.createdAt.toISOString(),
        updatedAt: subtask.updatedAt.toISOString()
      });
    });
  }

  // Roles
  async getAllRoles(): Promise<Role[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('roles');
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const roles = request.result.map(role => ({
          ...role,
          createdAt: new Date(role.createdAt)
        }));
        resolve(roles);
      };
    });
  }

  async saveRoles(roles: Role[]): Promise<void> {
    const store = this.getStore('roles', 'readwrite');
    store.clear();
    roles.forEach(role => {
      store.add({
        ...role,
        createdAt: role.createdAt.toISOString()
      });
    });
  }

  // Requirements
  async getAllRequirements(): Promise<Requirement[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('requirements');
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async saveRequirements(requirements: Requirement[]): Promise<void> {
    const store = this.getStore('requirements', 'readwrite');
    store.clear();
    requirements.forEach(requirement => store.add(requirement));
  }

  // App State
  async getState(): Promise<AppState> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('state');
      const request = store.get('appState');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const state = request.result || { activeTask: null, selectedRole: 'everyone', elapsedTime: 0 };
        if (state.activeTask) {
          state.activeTask.createdAt = new Date(state.activeTask.createdAt);
        }
        resolve(state);
      };
    });
  }

  async saveState(state: AppState): Promise<void> {
    const store = this.getStore('state', 'readwrite');
    const stateToSave = {
      id: 'appState',
      ...state,
      activeTask: state.activeTask ? {
        ...state.activeTask,
        createdAt: state.activeTask.createdAt.toISOString()
      } : null
    };
    store.put(stateToSave);
  }
}

export const db = new DatabaseService(); 