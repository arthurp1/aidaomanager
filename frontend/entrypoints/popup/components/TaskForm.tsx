import React, { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Rule, Requirement } from '../types';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

interface Tool {
  name: string;
  url: string;
  logomark: string;
  publicDocs: string;
}

interface Endpoint {
  url: string;
  input_params: Record<string, string>;
  output_format: string;
}

interface WebTrack {
  url: string;
  multitask_chance?: string;
  search?: {
    available: boolean;
    project_keywords?: string[];
  };
  project_keywords?: string[];
}

interface ToolDetails {
  category: string;
  url: string;
  description?: string;
  webtrack?: WebTrack;
  api?: {
    endpoints?: Endpoint[];
  };
}

interface TimePattern {
  type: 'in_a_row' | 'in_week' | 'in_month' | 'before_date' | 'by_time' | 'every_x_days';
  value: number;
  unit?: string;
  target?: string;
}

interface RulePattern {
  condition: 'more_than' | 'less_than' | 'exactly' | 'at_least' | 'at_most';
  threshold: number;
  metric: string;
  timePattern: TimePattern;
}

interface GeneratedRule {
  performanceLevel: '😍' | '👋' | '🤔';
  text: string;
  logic: string;
}

interface TaskFormProps {
  onCreateTask: (task: { 
    title: string; 
    estimatedTime: number;
    tools: string[];
    requirements: Requirement[];
  }) => void;
  onCancel: () => void;
}

export const TaskForm: React.FC<TaskFormProps> = ({ 
  onCreateTask, 
  onCancel
}) => {
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskTime, setNewTaskTime] = useState<number>(0);
  const [newTaskTools, setNewTaskTools] = useState<string[]>([]);
  const [taskToolSearch, setTaskToolSearch] = useState('');
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [isGeneratingRequirements, setIsGeneratingRequirements] = useState(false);
  const [hoveredRequirement, setHoveredRequirement] = useState<string | null>(null);
  const [showMeasureDropdown, setShowMeasureDropdown] = useState<string | null>(null);
  const [showManualRequirement, setShowManualRequirement] = useState(false);
  const [newRequirement, setNewRequirement] = useState({
    title: '',
    measure: '',
    emoji: '📋',
  });
  const [tools, setTools] = useState<Tool[]>([]);

  // Add useEffect to load tools
  useEffect(() => {
    console.log('Fetching tools...');
    fetch(chrome.runtime.getURL('tools_docs.json'))
      .then(response => {
        console.log('Tools response:', response);
        return response.json();
      })
      .then(data => {
        console.log('Loaded tools:', data);
        setTools(data);
      })
      .catch(error => console.error('Error loading tools:', error));
  }, []);

  // Update getFilteredTools function
  const getFilteredTools = () => {
    console.log('Current tools:', tools);
    console.log('Current search:', taskToolSearch);
    console.log('Current selected tools:', newTaskTools);
    
    const filtered = tools.filter(
      tool => 
        !newTaskTools.includes(tool.url) && 
        (tool.url.toLowerCase().includes(taskToolSearch.toLowerCase()) ||
         tool.name.toLowerCase().includes(taskToolSearch.toLowerCase()))
    );
    
    console.log('Filtered tools:', filtered);
    return filtered;
  };

  // Function to generate requirements using Gemini
  const generateRequirements = async () => {
    if (!newTaskName.trim()) return;
    
    setIsGeneratingRequirements(true);
    
    try {
      // Gather tool information
      const toolsInfo = newTaskTools.map(toolUrl => {
        const tool = tools.find(t => t.url === toolUrl);
        return tool ? {
          name: tool.name,
          url: tool.url
        } : null;
      }).filter((tool): tool is { name: string; url: string } => tool !== null);
      
      const newRequirements = toolsInfo.map(tool => ({
        id: Math.random().toString(36).substr(2, 9),
        emoji: '⚡',
        alternativeEmojis: ['🔧', '🛠️'],
        title: 'Tool Usage',
        measure: `${tool.name} activity score (min 4/5)`,
        alternativeMeasures: [
          `${tool.name} engagement rate`,
          `${tool.name} usage frequency`
        ],
        severity: 'high',
        description: `Track usage and engagement with ${tool.name}`,
        rules: [] as Rule[]
      }));

      setRequirements(newRequirements);
    } catch (error) {
      console.error('Error generating requirements:', error);
    } finally {
      setIsGeneratingRequirements(false);
    }
  };

  // Function to generate rules for a requirement
  const generateRules = async (requirement: Requirement): Promise<Rule[]> => {
    const prompt = `Given the following context:
Task: "${newTaskName}"
Tool: ${newTaskTools.join(', ')}
Requirement: ${requirement.title}
Measure: ${requirement.measure}

Generate 3 specific rules with different performance levels that would trigger different actions.
Use a variety of time patterns and conditions to create meaningful rules.

Available Time Patterns:
- "X times in a row" (consecutive achievements)
- "X times in a week" (weekly frequency)
- "X times in a month" (monthly quota)
- "before [day]" (deadline-based)
- "by [time]" (time-of-day based)
- "every X days" (regular intervals)

Available Conditions:
- "more than X"
- "less than X"
- "exactly X"
- "at least X"
- "at most X"

For each rule, generate:
1. 😍 Exceptional (worth a team shoutout):
   - Should be challenging but achievable
   - Use longer time spans or higher thresholds
   - Example: "more than 5 times in a month" or "7 days in a row"

2. 👋 Reminder (helpful to get a DM):
   - Should be an early warning
   - Use shorter time spans or lower thresholds
   - Example: "less than 2 times this week" or "not done by 10am"

3. 🤔 Questionable (needs discussion in 1on1):
   - Should indicate a concerning pattern
   - Use multiple missed targets or consistent underperformance
   - Example: "less than 50% completion in two weeks" or "late 3 times in a month"

Return as JSON array with format:
[
  {
    "performanceLevel": "😍",
    "text": "short rule text",
    "logic": "detailed explanation of the logic and why it deserves recognition",
    "pattern": {
      "condition": "more_than",
      "threshold": 5,
      "metric": "completion",
      "timePattern": {
        "type": "in_month",
        "value": 1
      }
    }
  }
]`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      console.log('Raw rule generation response:', response.text());
      const generatedRules = JSON.parse(response.text()) as (GeneratedRule & { pattern?: RulePattern })[];

      return generatedRules.map(rule => ({
        ...rule,
        id: Math.random().toString(36).substr(2, 9),
        pattern: rule.pattern || {
          condition: 'exactly',
          threshold: 1,
          metric: requirement.measure,
          timePattern: {
            type: 'in_a_row',
            value: 1
          }
        }
      }));
    } catch (error) {
      console.error('Error generating rules:', error);
      // Fallback rules with patterns
      return [
        {
          id: Math.random().toString(36).substr(2, 9),
          performanceLevel: '😍',
          text: `${requirement.measure} achieved 5 times in a row`,
          logic: 'Consistently meeting the requirement shows exceptional commitment',
          pattern: {
            condition: 'more_than',
            threshold: 5,
            metric: requirement.measure,
            timePattern: {
              type: 'in_a_row',
              value: 1
            }
          }
        },
        {
          id: Math.random().toString(36).substr(2, 9),
          performanceLevel: '👋',
          text: `${requirement.measure} missed once this week`,
          logic: 'A single miss is a good time for a gentle reminder',
          pattern: {
            condition: 'less_than',
            threshold: 1,
            metric: requirement.measure,
            timePattern: {
              type: 'in_week',
              value: 1
            }
          }
        },
        {
          id: Math.random().toString(36).substr(2, 9),
          performanceLevel: '🤔',
          text: `${requirement.measure} missed 3 times this month`,
          logic: 'A pattern of misses indicates a need for discussion',
          pattern: {
            condition: 'less_than',
            threshold: 3,
            metric: requirement.measure,
            timePattern: {
              type: 'in_month',
              value: 1
            }
          }
        }
      ];
    }
  };

  const handleSubmit = () => {
    if (!newTaskName.trim() || newTaskTime <= 0) return;

    onCreateTask({
      title: newTaskName,
      estimatedTime: newTaskTime,
      tools: newTaskTools,
      requirements
    });

    // Reset form
    setNewTaskName('');
    setNewTaskTime(0);
    setNewTaskTools([]);
    setTaskToolSearch('');
    setRequirements([]);
  };

  const handleAddManualRequirement = () => {
    if (!newRequirement.title.trim() || !newRequirement.measure.trim()) return;

    const requirement: Requirement = {
      id: Math.random().toString(36).substr(2, 9),
      title: newRequirement.title,
      measure: newRequirement.measure,
      emoji: newRequirement.emoji,
      alternativeEmojis: ['✅', '📊', '🎯', '⭐'],
      alternativeMeasures: [],
      severity: 'medium',
      description: `Requirement to track ${newRequirement.measure}`,
      rules: []
    };

    setRequirements(prev => [...prev, requirement]);
    setNewRequirement({
      title: '',
      measure: '',
      emoji: '📋',
    });
    setShowManualRequirement(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-surface rounded-lg shadow-xl w-full max-w-2xl mx-4 h-[85vh] flex flex-col">
        <div className="px-3 py-2 border-b dark:border-gray-700">
          <h2 className="text-xs text-gray-500 dark:text-gray-400">Create New Task</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Task Name and Time */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400 text-left mb-1">
                Task Name
              </label>
              <input
                type="text"
                placeholder="Enter task name..."
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                className="w-full px-2 py-1.5 bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-gray-100 text-sm"
                autoFocus
              />
            </div>
            <div className="w-16">
              <label className="block text-xs text-gray-500 dark:text-gray-400 text-left mb-1">
                Hours
              </label>
              <input
                type="number"
                value={newTaskTime || ''}
                onChange={(e) => setNewTaskTime(Number(e.target.value))}
                className="w-full px-1.5 py-1.5 bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-gray-100 text-sm"
                step="0.5"
                min="0"
              />
            </div>
          </div>

          {/* Tool Selection */}
          <div className="relative">
            <label className="block text-xs text-gray-500 dark:text-gray-400 text-left mb-1">
              Tools
            </label>
            <input
              type="text"
              placeholder="Search tools..."
              value={taskToolSearch}
              onChange={(e) => setTaskToolSearch(e.target.value)}
              className="w-full px-2 py-1.5 bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-gray-100 text-sm"
            />
            {/* Selected Tools */}
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {newTaskTools.map(toolUrl => {
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
                      onClick={() => setNewTaskTools(prev => prev.filter(t => t !== tool.url))}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
            {/* Tool Suggestions - Positioned absolutely */}
            {taskToolSearch && (
              <div className="absolute left-0 right-0 top-[60px] bg-white dark:bg-dark-surface border rounded-md shadow-lg dark:border-gray-600 max-h-48 overflow-y-auto z-10">
                {getFilteredTools().map(tool => (
                  <button
                    key={tool.url}
                    onClick={() => {
                      setNewTaskTools(prev => [...prev, tool.url]);
                      setTaskToolSearch('');
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

          {/* Requirements Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs text-gray-500 dark:text-gray-400">
                Requirements
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowManualRequirement(true)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  Add Manually
                </button>
                <button
                  onClick={generateRequirements}
                  disabled={isGeneratingRequirements || !newTaskName.trim() || newTaskTools.length === 0}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Generate
                </button>
              </div>
            </div>

            {/* Manual Requirement Form */}
            {showManualRequirement && (
              <div className="mb-3 p-3 bg-gray-50 dark:bg-dark-hover rounded-lg">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="w-12">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Emoji
                      </label>
                      <input
                        type="text"
                        value={newRequirement.emoji}
                        onChange={(e) => setNewRequirement(prev => ({ ...prev, emoji: e.target.value }))}
                        className="w-full px-2 py-1 bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-gray-100 text-sm"
                        maxLength={2}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Title
                      </label>
                      <input
                        type="text"
                        value={newRequirement.title}
                        onChange={(e) => setNewRequirement(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="e.g., Code Quality"
                        className="w-full px-2 py-1 bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-gray-100 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Measure
                    </label>
                    <input
                      type="text"
                      value={newRequirement.measure}
                      onChange={(e) => setNewRequirement(prev => ({ ...prev, measure: e.target.value }))}
                      placeholder="e.g., Code review rating (min 4/5)"
                      className="w-full px-2 py-1 bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-gray-100 text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowManualRequirement(false)}
                      className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddManualRequirement}
                      disabled={!newRequirement.title.trim() || !newRequirement.measure.trim()}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Requirements List */}
            <div className="space-y-1.5">
              {requirements.map((req) => (
                <div 
                  key={req.id}
                  className="flex items-start gap-2 p-2 bg-gray-50 dark:bg-dark-hover/30 rounded group"
                >
                  <span className="text-lg">{req.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium dark:text-gray-200">{req.title}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Measured by: {req.measure}
                    </div>
                  </div>
                  <button
                    onClick={() => setRequirements(reqs => reqs.filter(r => r.id !== req.id))}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!newTaskName.trim() || newTaskTime <= 0}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Task
          </button>
        </div>
      </div>
    </div>
  );
}; 