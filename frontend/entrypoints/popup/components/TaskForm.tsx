import React, { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Rule, Requirement } from '../types';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

interface Tool {
  url: string;
  description: string;
  category: string;
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

// Type for the form input that excludes the description field
type RequirementFormData = Omit<Requirement, 'description'>;

interface TaskFormProps {
  onCreateTask: (task: { 
    title: string; 
    estimatedTime: number; 
    tools: string[];
    requirements: RequirementFormData[];
  }) => void;
  onCancel: () => void;
  toolCategories: Record<string, Record<string, any>>;
}

export const TaskForm: React.FC<TaskFormProps> = ({ 
  onCreateTask, 
  onCancel,
  toolCategories 
}) => {
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskTime, setNewTaskTime] = useState<number>(0);
  const [newTaskTools, setNewTaskTools] = useState<string[]>([]);
  const [taskToolSearch, setTaskToolSearch] = useState('');
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [isGeneratingRequirements, setIsGeneratingRequirements] = useState(false);
  const [hoveredRequirement, setHoveredRequirement] = useState<string | null>(null);
  const [showMeasureDropdown, setShowMeasureDropdown] = useState<string | null>(null);

  // Function to get detailed tool information
  const getToolDetails = (toolUrl: string): ToolDetails | null => {
    for (const [category, tools] of Object.entries(toolCategories)) {
      if (toolUrl in tools) {
        const tool = tools[toolUrl];
        return {
          category,
          url: toolUrl,
          ...tool,
        };
      }
    }
    return null;
  };

  // Function to generate requirements using Gemini
  const generateRequirements = async () => {
    if (!newTaskName.trim()) return;
    
    setIsGeneratingRequirements(true);
    try {
      // Gather tool information
      const toolsInfo = newTaskTools.map(toolUrl => getToolDetails(toolUrl))
        .filter(tool => tool !== null);

      console.log('Tools info for prompt:', toolsInfo);

      // Generate tool-specific requirements
      const requirements = toolsInfo.map(tool => {
        const requirements = [];
        
        // Design tools requirements
        if (tool.category === 'design') {
          requirements.push({
            id: Math.random().toString(36).substr(2, 9),
            emoji: '🎨',
            alternativeEmojis: ['✨', '👁️'],
            title: 'Design Quality',
            measure: 'User feedback rating (min 4.5/5)',
            alternativeMeasures: [
              'Design review score (min 90%)',
              'User engagement metrics'
            ],
            severity: 'high'
          });
          
          if (tool.webtrack?.project_keywords?.includes('brand')) {
            requirements.push({
              id: Math.random().toString(36).substr(2, 9),
              emoji: '🎯',
              alternativeEmojis: ['🔍', '📐'],
              title: 'Brand Consistency',
              measure: 'Brand compliance score (min 95%)',
              alternativeMeasures: [
                'Style guide adherence rate',
                'Brand audit score'
              ],
              severity: 'high'
            });
          }
        }
        
        // Development tools requirements
        if (tool.category === 'development') {
          requirements.push({
            id: Math.random().toString(36).substr(2, 9),
            emoji: '⚡',
            alternativeEmojis: ['🔧', '🛠️'],
            title: 'Code Quality',
            measure: 'Code review rating (min 4/5)',
            alternativeMeasures: [
              'Static analysis score (min 85%)',
              'Test coverage (min 80%)'
            ],
            severity: 'high'
          });

          requirements.push({
            id: Math.random().toString(36).substr(2, 9),
            emoji: '🚀',
            alternativeEmojis: ['⚙️', '📊'],
            title: 'Code Efficiency',
            measure: 'Performance score (min 90/100)',
            alternativeMeasures: [
              'Load time improvement',
              'Resource utilization'
            ],
            severity: 'medium'
          });
        }

        // Communication tools requirements
        if (tool.category === 'communication') {
          requirements.push({
            id: Math.random().toString(36).substr(2, 9),
            emoji: '💬',
            alternativeEmojis: ['📢', '🗣️'],
            title: 'Active Participation',
            measure: 'Daily check-ins completed',
            alternativeMeasures: [
              'Response time (max 4 hours)',
              'Weekly message count (min 10)'
            ],
            severity: 'medium'
          });

          if (tool.webtrack?.multitask_chance === 'high') {
            requirements.push({
              id: Math.random().toString(36).substr(2, 9),
              emoji: '🤝',
              alternativeEmojis: ['💡', '🎯'],
              title: 'Engagement Quality',
              measure: 'Substantive messages per week (min 5)',
              alternativeMeasures: [
                'Thread participation rate',
                'Reaction engagement score'
              ],
              severity: 'medium'
            });
          }
        }

        // Productivity tools requirements
        if (tool.category === 'productivity') {
          requirements.push({
            id: Math.random().toString(36).substr(2, 9),
            emoji: '📋',
            alternativeEmojis: ['✅', '⏱️'],
            title: 'Task Management',
            measure: 'Daily status updates completed',
            alternativeMeasures: [
              'Task completion rate (min 85%)',
              'Milestone adherence rate'
            ],
            severity: 'high'
          });

          if (tool.webtrack?.search?.available) {
            requirements.push({
              id: Math.random().toString(36).substr(2, 9),
              emoji: '📚',
              alternativeEmojis: ['✍️', '🔍'],
              title: 'Documentation Quality',
              measure: 'Documentation updates per week (min 2)',
              alternativeMeasures: [
                'Documentation clarity score',
                'Search success rate'
              ],
              severity: 'medium'
            });
          }
        }

        // Research tools requirements
        if (tool.category === 'research') {
          requirements.push({
            id: Math.random().toString(36).substr(2, 9),
            emoji: '🔬',
            alternativeEmojis: ['📖', '🎓'],
            title: 'Research Depth',
            measure: 'Papers reviewed per week (min 5)',
            alternativeMeasures: [
              'Citation quality score',
              'Research coverage index'
            ],
            severity: 'high'
          });
        }

        return requirements;
      }).flat();

      // Filter out duplicate requirements
      const uniqueRequirements = requirements.filter((req, index, self) =>
        index === self.findIndex((r) => r.title === req.title)
      );

      setRequirements(uniqueRequirements);
    } catch (error) {
      console.error('Error generating requirements:', error);
      setRequirements([]);
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

  const getFilteredTools = () => {
    const allTools: Tool[] = [];
    Object.entries(toolCategories).forEach(([category, tools]) => {
      Object.entries(tools).forEach(([url, tool]) => {
        allTools.push({ url, description: tool.description, category });
      });
    });

    return allTools.filter(
      tool => 
        !newTaskTools.includes(tool.url) && 
        (tool.url.toLowerCase().includes(taskToolSearch.toLowerCase()) ||
         tool.description.toLowerCase().includes(taskToolSearch.toLowerCase()) ||
         tool.category.toLowerCase().includes(taskToolSearch.toLowerCase()))
    );
  };

  return (
    <div className="px-3 py-2 border-t dark:border-gray-700 bg-gray-50/80 dark:bg-dark-hover/80">
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

        {/* Requirements Section */}
        <div className="flex flex-col gap-1">

          {/* Requirements list */}
          <div className="flex flex-col gap-1">
            {requirements.map((req) => (
              <div key={req.id}>
                {/* Suggestion/Accepted row */}
                <div 
                  className="group flex items-start gap-2 py-2 px-2 hover:bg-gray-50 dark:hover:bg-dark-hover/50 rounded text-left"
                >
                  {/* Emoji section */}
                  <div className="relative mt-0.5">
                    <button
                      onClick={() => setHoveredRequirement(hoveredRequirement === req.id ? null : req.id)}
                      className="text-lg hover:bg-gray-100 dark:hover:bg-dark-hover p-0.5 rounded"
                    >
                      {req.emoji}
                    </button>
                    {hoveredRequirement === req.id && (
                      <div className="absolute top-full left-0 mt-1 bg-white dark:bg-dark-surface rounded shadow-lg p-1 flex gap-1 z-20">
                        {req.alternativeEmojis.map((emoji, i) => (
                          <button
                            key={i}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRequirements(reqs => reqs.map(r => 
                                r.id === req.id ? { ...r, emoji } : r
                              ));
                              setHoveredRequirement(null);
                            }}
                            className="hover:bg-gray-100 dark:hover:bg-dark-hover p-1 rounded"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Title and measure */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium dark:text-gray-200 text-left">{req.title}</div>
                    <div className="relative">
                      <button
                        onClick={() => setShowMeasureDropdown(showMeasureDropdown === req.id ? null : req.id)}
                        className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-left"
                      >
                        Measured by: {req.measure} ▾
                      </button>
                      {showMeasureDropdown === req.id && (
                        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-dark-surface rounded shadow-lg p-1 z-10 min-w-[150px]">
                          {req.alternativeMeasures.map((measure, i) => (
                            <button
                              key={i}
                              onClick={async () => {
                                // First update the measure
                                const updatedReq = {
                                  ...req,
                                  measure,
                                  isAccepted: false, // Reset acceptance state
                                  rules: [] // Clear existing rules
                                };
                                
                                // Update the requirement with new measure
                                setRequirements(reqs => reqs.map(r => 
                                  r.id === req.id ? updatedReq : r
                                ));
                                
                                // Close the dropdown
                                setShowMeasureDropdown(null);
                              }}
                              className="block w-full text-left px-2 py-1 text-xs hover:bg-gray-100 dark:hover:bg-dark-hover rounded"
                            >
                              {measure}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Accept/Delete buttons */}
                  <div className="flex items-center gap-1">
                    {!req.isAccepted ? (
                      <button
                        onClick={async () => {
                          const generatedRules = await generateRules(req);
                          setRequirements(reqs => reqs.map(r => 
                            r.id === req.id ? {
                              ...r,
                              isAccepted: true,
                              rules: generatedRules
                            } : r
                          ));
                        }}
                        className="text-green-500 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300 p-1 rounded"
                        title="Accept requirement"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    ) : (
                      <button
                        onClick={() => setRequirements(reqs => reqs.map(r => 
                          r.id === req.id ? { ...r, isAccepted: false, rules: [] } : r
                        ))}
                        className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded"
                        title="Unaccept requirement"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => setRequirements(reqs => reqs.filter(r => r.id !== req.id))}
                      className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 p-1 rounded"
                      title="Remove requirement"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Rules section (only when accepted) */}
                {req.isAccepted && (
                  <div className="flex flex-col gap-1 py-1 px-2 bg-gray-50 dark:bg-dark-hover/30 rounded mt-1">
                    {/* Rules list */}
                    <div className="flex-1 flex flex-col gap-1">
                      {(req.rules || []).map((rule, index) => (
                        <div key={rule.id} className="flex items-center gap-2">
                          {/* Performance Level Emoji with tooltip */}
                          <div className="relative">
                            <button
                              onClick={() => setHoveredRequirement(hoveredRequirement === `rule-${rule.id}` ? null : `rule-${rule.id}`)}
                              className="text-lg hover:bg-gray-100 dark:hover:bg-dark-hover p-0.5 rounded group"
                            >
                              <span>{rule.performanceLevel}</span>
                              {/* Tooltip */}
                              <div className="absolute left-0 top-full mt-1 hidden group-hover:block bg-black/75 backdrop-blur-sm text-white text-xs p-2 rounded shadow-lg whitespace-normal max-w-xs z-30">
                                {rule.logic}
                              </div>
                            </button>
                            {hoveredRequirement === `rule-${rule.id}` && (
                              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-dark-surface rounded shadow-lg p-1 z-20 min-w-[200px]">
                                {([
                                  { emoji: '😍', label: 'Exceptional - shoutout' },
                                  { emoji: '👋', label: 'Reminder' },
                                  { emoji: '🤔', label: 'Questionable - 1on1 meeting' }
                                ] as const).map(({ emoji, label }) => (
                                  <button
                                    key={emoji}
                                    onClick={() => {
                                      const newRules = [...(req.rules || [])];
                                      newRules[index] = { ...newRules[index], performanceLevel: emoji };
                                      setRequirements(reqs => reqs.map(r => 
                                        r.id === req.id ? { ...r, rules: newRules } : r
                                      ));
                                      setHoveredRequirement(null);
                                    }}
                                    className="flex items-center gap-2 w-full px-2 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-dark-hover rounded"
                                    title={label}
                                  >
                                    <span className="text-lg">{emoji}</span>
                                    <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Rule composer */}
                          <div className="flex-1 flex items-center gap-2">
                            <select
                              value={rule.pattern?.condition || 'exactly'}
                              onChange={(e) => {
                                const newRules = [...(req.rules || [])];
                                const defaultPattern = {
                                  condition: 'exactly' as const,
                                  threshold: 1,
                                  metric: req.measure,
                                  timePattern: { type: 'in_a_row' as const, value: 1 }
                                };
                                newRules[index] = {
                                  ...newRules[index],
                                  pattern: {
                                    ...(newRules[index].pattern || defaultPattern),
                                    condition: e.target.value as RulePattern['condition']
                                  }
                                };
                                setRequirements(reqs => reqs.map(r => 
                                  r.id === req.id ? { ...r, rules: newRules } : r
                                ));
                              }}
                              className="px-2 py-1 text-sm bg-transparent border border-gray-200 dark:border-gray-700 rounded focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none dark:text-gray-100"
                            >
                              <option value="more_than">more than</option>
                              <option value="less_than">less than</option>
                              <option value="exactly">exactly</option>
                              <option value="at_least">at least</option>
                              <option value="at_most">at most</option>
                            </select>

                            <input
                              type="number"
                              value={rule.pattern?.threshold || 1}
                              onChange={(e) => {
                                const newRules = [...(req.rules || [])];
                                const defaultPattern = {
                                  condition: 'exactly' as const,
                                  threshold: 1,
                                  metric: req.measure,
                                  timePattern: { type: 'in_a_row' as const, value: 1 }
                                };
                                newRules[index] = {
                                  ...newRules[index],
                                  pattern: {
                                    ...(newRules[index].pattern || defaultPattern),
                                    threshold: Number(e.target.value)
                                  }
                                };
                                setRequirements(reqs => reqs.map(r => 
                                  r.id === req.id ? { ...r, rules: newRules } : r
                                ));
                              }}
                              min="1"
                              className="w-16 px-2 py-1 text-sm bg-transparent border border-gray-200 dark:border-gray-700 rounded focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none dark:text-gray-100"
                            />

                            <span className="text-sm dark:text-gray-300">times</span>

                            <select
                              value={rule.pattern?.timePattern.type || 'in_a_row'}
                              onChange={(e) => {
                                const newRules = [...(req.rules || [])];
                                const type = e.target.value as TimePattern['type'];
                                const defaultPattern = {
                                  condition: 'exactly' as const,
                                  threshold: 1,
                                  metric: req.measure,
                                  timePattern: { type, value: 1 }
                                };
                                newRules[index] = {
                                  ...newRules[index],
                                  pattern: {
                                    ...(newRules[index].pattern || defaultPattern),
                                    timePattern: {
                                      type,
                                      value: 1
                                    }
                                  }
                                };
                                setRequirements(reqs => reqs.map(r => 
                                  r.id === req.id ? { ...r, rules: newRules } : r
                                ));
                              }}
                              className="px-2 py-1 text-sm bg-transparent border border-gray-200 dark:border-gray-700 rounded focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none dark:text-gray-100"
                            >
                              <option value="in_a_row">in a row</option>
                              <option value="in_week">in a week</option>
                              <option value="in_month">in a month</option>
                              <option value="before_date">before</option>
                              <option value="by_time">by</option>
                              <option value="every_x_days">every</option>
                            </select>

                            {rule.pattern?.timePattern.type === 'before_date' && (
                              <input
                                type="date"
                                value={rule.pattern.timePattern.target || ''}
                                onChange={(e) => {
                                  const newRules = [...(req.rules || [])];
                                  const defaultPattern = {
                                    condition: 'exactly' as const,
                                    threshold: 1,
                                    metric: req.measure,
                                    timePattern: { 
                                      type: 'before_date' as const,
                                      value: 1,
                                      target: e.target.value
                                    }
                                  };
                                  newRules[index] = {
                                    ...newRules[index],
                                    pattern: {
                                      ...(newRules[index].pattern || defaultPattern),
                                      timePattern: {
                                        ...newRules[index].pattern!.timePattern,
                                        target: e.target.value
                                      }
                                    }
                                  };
                                  setRequirements(reqs => reqs.map(r => 
                                    r.id === req.id ? { ...r, rules: newRules } : r
                                  ));
                                }}
                                className="px-2 py-1 text-sm bg-transparent border border-gray-200 dark:border-gray-700 rounded focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none dark:text-gray-100"
                              />
                            )}

                            {rule.pattern?.timePattern.type === 'by_time' && (
                              <input
                                type="time"
                                value={rule.pattern.timePattern.target || ''}
                                onChange={(e) => {
                                  const newRules = [...(req.rules || [])];
                                  const defaultPattern = {
                                    condition: 'exactly' as const,
                                    threshold: 1,
                                    metric: req.measure,
                                    timePattern: { 
                                      type: 'by_time' as const,
                                      value: 1,
                                      target: e.target.value
                                    }
                                  };
                                  newRules[index] = {
                                    ...newRules[index],
                                    pattern: {
                                      ...(newRules[index].pattern || defaultPattern),
                                      timePattern: {
                                        ...newRules[index].pattern!.timePattern,
                                        target: e.target.value
                                      }
                                    }
                                  };
                                  setRequirements(reqs => reqs.map(r => 
                                    r.id === req.id ? { ...r, rules: newRules } : r
                                  ));
                                }}
                                className="px-2 py-1 text-sm bg-transparent border border-gray-200 dark:border-gray-700 rounded focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none dark:text-gray-100"
                              />
                            )}

                            {rule.pattern?.timePattern.type === 'every_x_days' && (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  value={rule.pattern.timePattern.value || 1}
                                  onChange={(e) => {
                                    const newRules = [...(req.rules || [])];
                                    const defaultPattern = {
                                      condition: 'exactly' as const,
                                      threshold: 1,
                                      metric: req.measure,
                                      timePattern: { 
                                        type: 'every_x_days' as const,
                                        value: Number(e.target.value)
                                      }
                                    };
                                    newRules[index] = {
                                      ...newRules[index],
                                      pattern: {
                                        ...(newRules[index].pattern || defaultPattern),
                                        timePattern: {
                                          ...newRules[index].pattern!.timePattern,
                                          value: Number(e.target.value)
                                        }
                                      }
                                    };
                                    setRequirements(reqs => reqs.map(r => 
                                      r.id === req.id ? { ...r, rules: newRules } : r
                                    ));
                                  }}
                                  min="1"
                                  className="w-16 px-2 py-1 text-sm bg-transparent border border-gray-200 dark:border-gray-700 rounded focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none dark:text-gray-100"
                                />
                                <span className="text-sm dark:text-gray-300">days</span>
                              </div>
                            )}
                          </div>

                          {/* Delete button */}
                          <button
                            onClick={() => {
                              const newRules = [...(req.rules || [])];
                              newRules.splice(index, 1);
                              setRequirements(reqs => reqs.map(r => 
                                r.id === req.id ? { ...r, rules: newRules } : r
                              ));
                            }}
                            className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 p-1 rounded"
                            title="Remove rule"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      
                      {/* Add rule button */}
                      <button
                        onClick={() => {
                          const newRule: Rule = {
                            id: Math.random().toString(36).substr(2, 9),
                            text: '',
                            performanceLevel: '👋',
                            logic: 'Default reminder logic'
                          };
                          setRequirements(reqs => reqs.map(r => 
                            r.id === req.id ? {
                              ...r,
                              rules: [...(r.rules || []), newRule]
                            } : r
                          ));
                        }}
                        className="self-start flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mt-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Add rule</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add/Clear buttons */}
          <div className="flex items-center justify-between mt-2">
            <button
              onClick={generateRequirements}
              disabled={isGeneratingRequirements || !newTaskName.trim() || newTaskTools.length === 0}
              className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-hover/50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingRequirements ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              )}
              <span>Suggest Requirements</span>
            </button>

            {requirements.length > 0 && (
              <button
                onClick={() => setRequirements([])}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!newTaskName.trim() || newTaskTime <= 0}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Task
          </button>
        </div>
      </div>
    </div>
  );
}; 