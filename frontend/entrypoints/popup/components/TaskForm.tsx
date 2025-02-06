import React, { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

interface Requirement {
  id: string;
  emoji: string;
  alternativeEmojis: string[];
  title: string;
  measure: string;
  alternativeMeasures: string[];
}

interface TaskFormProps {
  onCreateTask: (task: { 
    title: string; 
    estimatedTime: number; 
    tools: string[];
    requirements: Requirement[];
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

      const toolsContext = toolsInfo.map(tool => {
        const metrics = [];
        
        // Extract potential metrics from tool documentation
        if (tool.webtrack?.multitask_chance) {
          metrics.push(`multitasking efficiency (${tool.webtrack.multitask_chance} chance)`);
        }
        if (tool.webtrack?.search?.available) {
          metrics.push('search effectiveness');
        }
        if (tool.api?.endpoints) {
          tool.api.endpoints.forEach(endpoint => {
            if (endpoint.input_params) {
              Object.entries(endpoint.input_params).forEach(([param, type]) => {
                if (type === 'number') {
                  metrics.push(`${param} metric`);
                }
              });
            }
          });
        }

        return `
Tool: ${tool.url}
Category: ${tool.category}
Description: ${tool.description || 'No description available'}
Available Metrics: ${metrics.join(', ') || 'No specific metrics available'}
${tool.webtrack?.project_keywords ? `Relevant Keywords: ${tool.webtrack.project_keywords.join(', ')}` : ''}`;
      }).join('\n\n');

      const prompt = `Task: "${newTaskName}"

Available Tools and Their Metrics:
${toolsContext || 'No specific tools selected'}

Based on the task and the available tools' metrics, generate exactly 3 requirements that will help measure the success of this task.

For each requirement:
1. Generate 3 relevant emojis that represent the requirement
2. Create a clear, measurable title
3. Suggest 2 quantitative measures based on the available tool metrics and capabilities

The measures should be specific and quantifiable using the tools' available metrics and features.

Return the response in this exact JSON format:
[
  {
    "emoji": "🎯",
    "alternativeEmojis": ["🎪", "🎭"],
    "title": "example requirement title",
    "measure": "example measure (number)",
    "alternativeMeasures": ["alternative measure 1", "alternative measure 2"]
  }
]

Ensure the response is a valid JSON array with exactly 3 items, and the measures are actually trackable using the provided tools.`;

      console.log('Sending prompt to Gemini:', prompt);

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const responseText = response.text();
      
      console.log('Raw Gemini response:', responseText);

      try {
        const generatedRequirements = JSON.parse(responseText);
        console.log('Parsed requirements:', generatedRequirements);

        if (!Array.isArray(generatedRequirements) || generatedRequirements.length !== 3) {
          throw new Error('Invalid response format: expected array of 3 requirements');
        }

        // Validate each requirement has the required fields
        const validatedRequirements = generatedRequirements.map(req => {
          if (!req.emoji || !Array.isArray(req.alternativeEmojis) || !req.title || !req.measure || !Array.isArray(req.alternativeMeasures)) {
            throw new Error('Invalid requirement format: missing required fields');
          }
          return {
            ...req,
            id: Math.random().toString(36).substr(2, 9)
          };
        });

        setRequirements(validatedRequirements);
      } catch (parseError) {
        console.error('Error parsing Gemini response:', parseError);
        // Fallback requirements if parsing fails
        setRequirements([
          {
            id: '1',
            emoji: '📋',
            alternativeEmojis: ['✅', '📝'],
            title: 'Basic Requirement',
            measure: 'Completion status',
            alternativeMeasures: ['Progress percentage', 'Time spent']
          },
          {
            id: '2',
            emoji: '🎯',
            alternativeEmojis: ['🔍', '⭐'],
            title: 'Quality Check',
            measure: 'Review score',
            alternativeMeasures: ['Error count', 'Feedback rating']
          },
          {
            id: '3',
            emoji: '⏱️',
            alternativeEmojis: ['📊', '💪'],
            title: 'Performance Metric',
            measure: 'Time to complete',
            alternativeMeasures: ['Resource usage', 'Efficiency score']
          }
        ]);
      }
    } catch (error) {
      console.error('Error generating requirements:', error);
      // Set default requirements on error
      setRequirements([
        {
          id: '1',
          emoji: '📋',
          alternativeEmojis: ['✅', '📝'],
          title: 'Basic Requirement',
          measure: 'Completion status',
          alternativeMeasures: ['Progress percentage', 'Time spent']
        },
        {
          id: '2',
          emoji: '🎯',
          alternativeEmojis: ['🔍', '⭐'],
          title: 'Quality Check',
          measure: 'Review score',
          alternativeMeasures: ['Error count', 'Feedback rating']
        },
        {
          id: '3',
          emoji: '⏱️',
          alternativeEmojis: ['📊', '💪'],
          title: 'Performance Metric',
          measure: 'Time to complete',
          alternativeMeasures: ['Resource usage', 'Efficiency score']
        }
      ]);
    } finally {
      setIsGeneratingRequirements(false);
    }
  };

  // Effect to generate requirements when task name or tools change
  useEffect(() => {
    if (newTaskName.trim() && newTaskTools.length > 0) {
      generateRequirements();
    }
  }, [newTaskName, newTaskTools]);

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
              <div 
                key={req.id}
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
                            onClick={() => {
                              setRequirements(reqs => reqs.map(r => 
                                r.id === req.id ? { ...r, measure } : r
                              ));
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
                  <button
                    onClick={() => setRequirements(reqs => reqs.filter(r => r.id !== req.id))}
                    className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 p-1 rounded"
                    title="Remove suggestion"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add/Clear buttons */}
          <div className="flex items-center justify-between mt-2">
            <button
              onClick={generateRequirements}
              disabled={isGeneratingRequirements || !newTaskName.trim()}
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