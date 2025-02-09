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
  schema?: any;
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
  timePattern: {
    type: 'in_a_row' | 'in_week' | 'in_month' | 'before_date' | 'by_time' | 'every_x_days';
    value: number;
    target?: string;
  };
}

interface GeneratedRule extends Rule {
  pattern: RulePattern;
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

// Add new RuleBuilder component before the TaskForm component
interface RuleBuilderProps {
  rule: Rule;
  metric: string;
  onUpdate: (updatedRule: Rule) => void;
  onDelete: () => void;
}

const RuleBuilder: React.FC<RuleBuilderProps> = ({
  rule,
  metric,
  onUpdate,
  onDelete
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const performanceLevels = [
    { emoji: '😍', label: 'Shoutout', consequence: 'outstanding performance' },
    { emoji: '👋', label: 'Notification', consequence: 'something needs attention' },
    { emoji: '🤔', label: 'Questionable', consequence: '1on1 meeting with colleague' },
    { emoji: '⛔️', label: 'Harmful', consequence: 'team meeting and notification' }
  ];
  const conditions: Array<'more_than' | 'less_than' | 'exactly' | 'at_least' | 'at_most'> = 
    ['more_than', 'less_than', 'exactly', 'at_least', 'at_most'];
  const timeTypes: Array<'in_a_row' | 'in_week' | 'in_month' | 'before_date' | 'by_time' | 'every_x_days'> = 
    ['in_a_row', 'in_week', 'in_month', 'before_date', 'by_time', 'every_x_days'];

  // Helper function to get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Helper function to render time pattern inputs based on type
  const renderTimePatternInputs = () => {
    const type = rule.pattern.timePattern.type;

    if (type === 'before_date') {
      return (
        <input
          type="date"
          value={rule.pattern.timePattern.target || getTodayDate()}
          onChange={(e) => onUpdate({
            ...rule,
            pattern: {
              ...rule.pattern,
              timePattern: { ...rule.pattern.timePattern, target: e.target.value }
            }
          })}
          min={getTodayDate()}
          className="px-1 py-0.5 bg-gray-50 dark:bg-dark-hover border border-gray-300 dark:border-gray-600 rounded"
        />
      );
    }

    return (
      <div className="flex items-center gap-1">
        {type === 'in_week' && <span>in</span>}
        <div className="relative flex items-center">
          {metric.toLowerCase().includes('rate') && <span className="absolute left-1.5">%</span>}
          <input
            type="number"
            value={rule.pattern.timePattern.value}
            onChange={(e) => onUpdate({
              ...rule,
              pattern: {
                ...rule.pattern,
                timePattern: { ...rule.pattern.timePattern, value: Number(e.target.value) }
              }
            })}
            className={`w-12 px-1 py-0.5 bg-gray-50 dark:bg-dark-hover border border-gray-300 dark:border-gray-600 rounded ${
              metric.toLowerCase().includes('rate') ? 'pl-5' : ''
            }`}
          />
        </div>
        {type === 'in_week' && <span>weeks</span>}
        {type === 'in_month' && <span>months</span>}
        {type === 'in_a_row' && <span>times in a row</span>}
        {type === 'every_x_days' && <span>days</span>}
        {type === 'by_time' && <span>hours</span>}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-1 p-1 bg-gray-50 dark:bg-dark-hover/30 rounded text-xs">
      <div className="flex items-center gap-1">
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-8 h-6 px-1 bg-gray-50 dark:bg-dark-hover border border-gray-300 dark:border-gray-600 rounded cursor-pointer flex items-center justify-center"
            title="Select performance level"
          >
            <span>{rule.performanceLevel}</span>
          </button>
          {/* Custom dropdown content */}
          {isDropdownOpen && (
            <div 
              className="absolute left-0 top-full mt-1 bg-white dark:bg-dark-surface border border-gray-200 dark:border-gray-700 rounded shadow-lg z-20 min-w-[200px]"
            >
              {performanceLevels.map(level => (
                <div 
                  key={level.emoji}
                  className="px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-dark-hover cursor-pointer"
                  onClick={() => {
                    onUpdate({ ...rule, performanceLevel: level.emoji as '😍' | '👋' | '🤔' | '⛔️' });
                    setIsDropdownOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{level.emoji}</span>
                    <span className="font-medium">{level.label}</span>
                  </div>
                  <div className="mt-0.5 pl-6 text-[10px] text-gray-500 dark:text-gray-400">
                    {level.consequence}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div 
          className="flex-1 min-w-0"
          onClick={() => setIsEditingTitle(true)}
        >
          {isEditingTitle ? (
            <input
              type="text"
              value={rule.text}
              onChange={(e) => onUpdate({ ...rule, text: e.target.value })}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsEditingTitle(false);
                }
              }}
              placeholder="Rule name"
              className="w-full px-1 py-0.5 bg-white dark:bg-dark-bg border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          ) : (
            <div className="px-1 py-0.5 text-gray-900 dark:text-gray-100 cursor-text hover:bg-white/50 dark:hover:bg-dark-bg/50 rounded">
              {rule.text}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 pl-1">
        <button
          onClick={onDelete}
          className="px-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
        >
          ×
        </button>
        <select
          value={rule.pattern.condition}
          onChange={(e) => onUpdate({
            ...rule,
            pattern: { ...rule.pattern, condition: e.target.value as typeof rule.pattern.condition }
          })}
          className="px-1 py-0.5 bg-gray-50 dark:bg-dark-hover border border-gray-300 dark:border-gray-600 rounded"
        >
          {conditions.map(cond => (
            <option key={cond} value={cond}>{cond.replace('_', ' ')}</option>
          ))}
        </select>
        <div className="relative flex items-center">
          {metric.toLowerCase().includes('rate') && <span className="absolute left-1.5">%</span>}
          <input
            type="number"
            value={rule.pattern.threshold}
            onChange={(e) => onUpdate({
              ...rule,
              pattern: { ...rule.pattern, threshold: Number(e.target.value) }
            })}
            className={`w-12 px-1 py-0.5 bg-gray-50 dark:bg-dark-hover border border-gray-300 dark:border-gray-600 rounded ${
              metric.toLowerCase().includes('rate') ? 'pl-5' : ''
            }`}
          />
        </div>
        <span>{metric.split(' ').slice(-1)[0]}</span>
      </div>
      <div className="flex items-center gap-1 pl-1">
        <select
          value={rule.pattern.timePattern.type}
          onChange={(e) => onUpdate({
            ...rule,
            pattern: {
              ...rule.pattern,
              timePattern: { 
                ...rule.pattern.timePattern, 
                type: e.target.value as typeof rule.pattern.timePattern.type,
                target: e.target.value === 'before_date' ? getTodayDate() : undefined
              }
            }
          })}
          className="px-1 py-0.5 bg-gray-50 dark:bg-dark-hover border border-gray-300 dark:border-gray-600 rounded"
        >
          {timeTypes.map(type => (
            <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
          ))}
        </select>
        {renderTimePatternInputs()}
      </div>
    </div>
  );
};

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
      // Gather tool information with their schema
      const toolsInfo = newTaskTools.map(toolUrl => {
        const tool = tools.find(t => t.url === toolUrl);
        return tool ? {
          name: tool.name,
          url: tool.url,
          schema: tool.schema
        } : null;
      }).filter((tool): tool is { name: string; url: string; schema: any } => tool !== null);

      const prompt = `Given the following task and tools, generate requirements to track performance:

Task: "${newTaskName}"

Tools being used:
${toolsInfo.map(tool => `
${tool.name} (${tool.url})
Available metrics:
${Object.entries(tool.schema || {}).map(([key, value]: [string, any]) => `- ${key}: ${value.description}`).join('\n')}
`).join('\n')}

For each tool, generate a requirement that includes:
1. Title: Clear, concise name for the requirement
2. Measure: Specific metric to track (use actual metrics from the tool's schema)
3. Top 3 most relevant emojis for this requirement
4. 3 alternative ways to measure this requirement (based on available metrics)
5. Description: Brief explanation of what's being tracked

Format each requirement as a JSON object with these fields.
Focus on meaningful metrics that indicate actual performance and engagement.
`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let generatedReqs;
      try {
        generatedReqs = JSON.parse(response.text());
      } catch (e) {
        // Fallback to basic requirements if parsing fails
        generatedReqs = toolsInfo.map(tool => ({
          title: `${tool.name} Usage`,
          measure: `${tool.name} activity score`,
          emojis: ['⚡', '🔧', '🛠️'],
            alternativeMeasures: [
            `${tool.name} engagement rate`,
            `${tool.name} usage frequency`,
            `${tool.name} performance score`
          ],
          description: `Track usage and engagement with ${tool.name}`
        }));
      }

      const newRequirements = generatedReqs.map((req: any) => ({
            id: Math.random().toString(36).substr(2, 9),
        emoji: req.emojis[0],
        alternativeEmojis: req.emojis.slice(1),
        title: req.title,
        measure: req.measure,
        alternativeMeasures: req.alternativeMeasures,
            severity: 'high',
        description: req.description,
        rules: [],
        isAccepted: false
      }));

      setRequirements(newRequirements);
    } catch (error) {
      console.error('Error generating requirements:', error);
    } finally {
      setIsGeneratingRequirements(false);
    }
  };

  // Function to generate rules for an accepted requirement
  const generateRulesForRequirement = async (requirement: Requirement) => {
    const tool = tools.find(t => newTaskTools.includes(t.url));
    if (!tool) return;

    const metric = tool.schema[requirement.measure];
    
    const prompt = `Generate 3 performance rules for the following requirement:

Task: "${newTaskName}"
Tool: ${tool.name}
Requirement: ${requirement.title}
Metric: ${requirement.measure} (${metric?.description || 'No description'})

Generate 3 rules with different performance levels:
1. 😍 Exceptional performance (worth recognition)
2. 👋 Good performance (meeting expectations)
3. 🤔 Needs improvement (requires attention)

Each rule should have:
- A clear performance threshold
- A time period for measurement (in_week, in_month, in_a_row, etc.)
- A clear explanation of why this level matters

Use this exact format for the response:
{
  "rules": [
    {
      "id": "great_performance",
    "performanceLevel": "😍",
      "text": "brief description of exceptional performance",
      "logic": "explanation of why this deserves recognition",
    "pattern": {
      "condition": "more_than",
        "threshold": number,
        "metric": "${requirement.measure}",
      "timePattern": {
          "type": "in_week",
          "value": number
        }
      }
    }
  ]
}

Example metrics from the tool:
${Object.entries(tool.schema || {})
  .map(([key, value]: [string, any]) => `- ${key}: ${value.description}`)
  .join('\n')}`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const generatedRules = JSON.parse(response.text()) as { rules: Rule[] };

      setRequirements(reqs => reqs.map(r =>
        r.id === requirement.id
          ? { ...r, rules: generatedRules.rules }
          : r
      ));
    } catch (error) {
      console.error('Error generating rules:', error);
      // Fallback rules
      const fallbackRules: Rule[] = [
        {
          id: `${requirement.measure}_great`,
          performanceLevel: "😍",
          text: `Excellent ${requirement.measure} performance`,
          logic: "Consistently exceeding expectations",
          pattern: {
            condition: "more_than",
            threshold: 10,
            metric: requirement.measure,
            timePattern: {
              type: "in_week",
              value: 1
            }
          }
        },
        {
          id: `${requirement.measure}_ok`,
          performanceLevel: "👋",
          text: `Good ${requirement.measure} performance`,
          logic: "Meeting basic expectations",
          pattern: {
            condition: "more_than",
            threshold: 5,
            metric: requirement.measure,
            timePattern: {
              type: "in_week",
              value: 1
            }
          }
        },
        {
          id: `${requirement.measure}_low`,
          performanceLevel: "🤔",
          text: `Low ${requirement.measure} performance`,
          logic: "Needs improvement",
          pattern: {
            condition: "less_than",
            threshold: 3,
            metric: requirement.measure,
            timePattern: {
              type: "in_week",
              value: 1
            }
          }
        }
      ];

      setRequirements(reqs => reqs.map(r =>
        r.id === requirement.id
          ? { ...r, rules: fallbackRules }
          : r
      ));
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
                      className="px-2 py-1 text-xs bg-[#A8ACE0] text-white rounded hover:bg-[#8A8FC6] disabled:bg-[#D7DAFA] disabled:cursor-not-allowed"
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
                  className="flex items-start gap-2 p-2 bg-gray-50 dark:bg-dark-hover/30 rounded group relative"
                >
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={req.title}
                      onChange={(e) => {
                        setRequirements(reqs => reqs.map(r =>
                          r.id === req.id ? { ...r, title: e.target.value } : r
                        ));
                      }}
                      className="text-sm font-medium dark:text-gray-200 bg-transparent border-none p-0 w-full focus:ring-0"
                    />
                    <div className="relative">
                      <div 
                        onClick={() => setShowMeasureDropdown(showMeasureDropdown === req.id ? null : req.id)}
                        className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer flex items-center gap-1"
                      >
                      Measured by: {req.measure}
                        <svg 
                          className={`w-3 h-3 transition-transform ${showMeasureDropdown === req.id ? 'rotate-180' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      {/* Measures dropdown */}
                      {showMeasureDropdown === req.id && (
                        <div className="absolute left-0 top-full mt-1 z-10">
                          <div className="bg-white dark:bg-dark-surface border dark:border-gray-700 rounded shadow-lg p-1">
                            {[req.measure, ...req.alternativeMeasures].map(measure => (
                              <button
                                key={measure}
                                onClick={() => {
                                  setRequirements(reqs => reqs.map(r =>
                                    r.id === req.id
                                      ? { ...r, measure: measure, alternativeMeasures: [req.measure, ...req.alternativeMeasures].filter(m => m !== measure) }
                                      : r
                                  ));
                                  setShowMeasureDropdown(null);
                                }}
                                className="block w-full text-left px-2 py-1 text-xs hover:bg-gray-100 dark:hover:bg-dark-hover rounded"
                              >
                                {measure}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Show rules if requirement is accepted */}
                    {req.isAccepted && (
                      <div className="mt-2 space-y-1">
                        {req.rules?.map((rule, index) => (
                          <RuleBuilder
                            key={rule.id}
                            rule={rule}
                            metric={req.measure}
                            onUpdate={(updatedRule) => {
                              setRequirements(reqs => reqs.map(r =>
                                r.id === req.id
                                  ? { ...r, rules: r.rules?.map((r, i) => i === index ? updatedRule : r) }
                                  : r
                              ));
                            }}
                            onDelete={() => {
                              setRequirements(reqs => reqs.map(r =>
                                r.id === req.id
                                  ? { ...r, rules: r.rules?.filter((_, i) => i !== index) }
                                  : r
                              ));
                            }}
                          />
                        ))}
                        <button
                          onClick={() => {
                            const newRule: Rule = {
                              id: Math.random().toString(36).substr(2, 9),
                              performanceLevel: "👋",
                              text: `New ${req.measure} rule`,
                              logic: "Define the logic for this rule",
                              pattern: {
                                condition: "more_than",
                                threshold: 0,
                                metric: req.measure,
                                timePattern: {
                                  type: "in_week",
                                  value: 1
                                }
                              }
                            };
                            setRequirements(reqs => reqs.map(r =>
                              r.id === req.id
                                ? { ...r, rules: [...(r.rules || []), newRule] }
                                : r
                            ));
                          }}
                          className="w-full text-center px-2 py-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          + Add Rule
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!req.isAccepted && (
                      <button
                        onClick={async () => {
                          setRequirements(reqs => reqs.map(r =>
                            r.id === req.id ? { ...r, isAccepted: true } : r
                          ));
                          await generateRulesForRequirement(req);
                        }}
                        className="text-green-500 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300"
                        title="Accept requirement"
                      >
                        ✓
                      </button>
                    )}
                  <button
                    onClick={() => setRequirements(reqs => reqs.filter(r => r.id !== req.id))}
                      className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
                      title="Delete requirement"
                  >
                    ×
                  </button>
                  </div>
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
            className="px-3 py-1.5 text-sm bg-[#A8ACE0] text-white rounded hover:bg-[#8A8FC6] disabled:bg-[#D7DAFA] disabled:cursor-not-allowed"
          >
            Create Task
          </button>
        </div>
      </div>
    </div>
  );
}; 