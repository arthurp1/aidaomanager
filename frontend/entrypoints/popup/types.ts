export interface SubTask {
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
  isCompleted?: boolean;
}

export interface Task {
  id: string;
  title: string;
  roleId: string;
  createdAt: Date;
  isCollapsed: boolean;
  estimatedTime: number;
  tools: string[];
  trackedTime: number;
  requirements: string[];
}

export interface Role {
  id: string;
  name: string;
  createdAt: Date;
  tools: string[];
}

export interface Rule {
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

export interface Requirement {
  id: string;
  rules: Rule[];
  emoji: string;
  alternativeEmojis: string[];
  title: string;
  description: string;
  measure: string;
} 