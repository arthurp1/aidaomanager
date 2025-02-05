import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
  flexRender,
} from '@tanstack/react-table';
import { format } from 'date-fns';

interface Task {
  id: string;
  title: string;
  estimatedTime: number;
  domain: string;
  status: 'active' | 'inactive' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  totalTimeSpent?: number;
  category?: string;
  priority?: 'low' | 'medium' | 'high';
}

interface TaskTableProps {
  onTaskActivation: (tasks: Task[]) => void;
}

interface EditingCell {
  id: string;
  field: keyof Task;
}

const columnHelper = createColumnHelper<Task>();

export const TaskTable: React.FC<TaskTableProps> = ({ onTaskActivation }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [newTask, setNewTask] = useState<{
    title: string;
    estimatedTime: number;
    domain: string;
    category: string;
    priority: 'low' | 'medium' | 'high';
  }>({
    title: '',
    estimatedTime: 0,
    domain: '',
    category: '',
    priority: 'medium',
  });

  const handleDragStart = (taskId: string) => {
    setDraggedTask(taskId);
  };

  const handleDragOver = (e: React.DragEvent, taskId: string) => {
    e.preventDefault();
    if (!draggedTask || draggedTask === taskId) return;

    const draggedIndex = tasks.findIndex(t => t.id === draggedTask);
    const hoverIndex = tasks.findIndex(t => t.id === taskId);

    if (draggedIndex === hoverIndex) return;

    setTasks(prev => {
      const newTasks = [...prev];
      const [draggedTask] = newTasks.splice(draggedIndex, 1);
      newTasks.splice(hoverIndex, 0, draggedTask);
      return newTasks;
    });
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
  };

  const columns = [
    columnHelper.accessor('priority', {
      header: '●',
      cell: (info) => (
        <div className="w-2 h-2 rounded-full"
          style={{
            backgroundColor: info.getValue() === 'high' ? '#ef4444' : 
              info.getValue() === 'medium' ? '#f59e0b' : '#3b82f6'
          }}
        />
      ),
    }),
    columnHelper.accessor('title', {
      header: 'Task',
      cell: (info) => (
        <EditableCell
          value={info.getValue()}
          row={info.row.original}
          field="title"
          onEdit={handleEdit}
          isEditing={editingCell?.id === info.row.original.id && editingCell?.field === 'title'}
          className="font-medium"
        />
      ),
    }),
    columnHelper.accessor('estimatedTime', {
      header: 'Est.',
      cell: (info) => (
        <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-400">
          <EditableCell
            value={info.getValue().toString()}
            row={info.row.original}
            field="estimatedTime"
            onEdit={handleEdit}
            type="number"
            isEditing={editingCell?.id === info.row.original.id && editingCell?.field === 'estimatedTime'}
            className="w-12"
          />
          <span className="text-xs">h</span>
        </div>
      ),
    }),
    columnHelper.accessor('domain', {
      header: 'Domain',
      cell: (info) => (
        <div className="max-w-[120px] truncate text-gray-500 dark:text-gray-400 text-sm">
          <EditableCell
            value={info.getValue()}
            row={info.row.original}
            field="domain"
            onEdit={handleEdit}
            isEditing={editingCell?.id === info.row.original.id && editingCell?.field === 'domain'}
          />
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: tasks,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleEdit = (taskId: string, field: keyof Task, value: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              [field]: field === 'estimatedTime' ? Number(value) : value,
              updatedAt: new Date(),
            }
          : task
      )
    );
    setEditingCell(null);
    setEditValue('');
  };

  const EditableCell: React.FC<{
    value: string;
    row: Task;
    field: keyof Task;
    onEdit: (taskId: string, field: keyof Task, value: string) => void;
    type?: string;
    isEditing: boolean;
    className?: string;
  }> = ({ value, row, field, onEdit, type = 'text', isEditing, className = '' }) => {
    if (isEditing) {
      return (
        <input
          type={type}
          className={`w-full py-0.5 bg-transparent border-b border-blue-500 focus:outline-none dark:text-gray-100 ${className}`}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => {
            if (editValue.trim() !== '') {
              onEdit(row.id, field, editValue);
            }
            setEditingCell(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && editValue.trim() !== '') {
              onEdit(row.id, field, editValue);
            } else if (e.key === 'Escape') {
              setEditingCell(null);
              setEditValue('');
            }
          }}
          autoFocus
          step={type === 'number' ? '0.5' : undefined}
          min={type === 'number' ? '0' : undefined}
        />
      );
    }

    return (
      <div
        className={`cursor-text py-0.5 ${className}`}
        onClick={() => {
          setEditingCell({ id: row.id, field });
          setEditValue(value);
        }}
      >
        {value}
      </div>
    );
  };

  const handleTaskSelection = (taskId: string) => {
    setSelectedTasks((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  const getTotalEstimatedTime = () => {
    return tasks
      .filter((task) => selectedTasks.includes(task.id))
      .reduce((sum, task) => sum + task.estimatedTime, 0);
  };

  const handleActivateTasks = () => {
    const tasksToActivate = tasks
      .filter((task) => selectedTasks.includes(task.id))
      .map((task) => ({
        ...task,
        status: 'active' as const,
      }));
    
    onTaskActivation(tasksToActivate);
    setTasks((prev) =>
      prev.map((task) => ({
        ...task,
        status: selectedTasks.includes(task.id) ? 'active' : task.status,
      }))
    );
    setSelectedTasks([]);
    setIsConfirmationOpen(false);
  };

  const handleCreateTask = () => {
    const newTaskData: Task = {
      id: crypto.randomUUID(),
      ...newTask,
      status: 'inactive',
      createdAt: new Date(),
      updatedAt: new Date(),
      totalTimeSpent: 0,
    };

    setTasks((prev) => [...prev, newTaskData]);
    setNewTask({
      title: '',
      estimatedTime: 0,
      domain: '',
      category: '',
      priority: 'medium',
    });
  };

  return (
    <div className="py-2">
      {/* Task Creation Form */}
      <div className="px-2 mb-2">
        <div className="flex gap-2">
          <select
            className="w-2 h-2 rounded-full bg-blue-500 border-0 appearance-none cursor-pointer focus:outline-none"
            value={newTask.priority}
            onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as 'low' | 'medium' | 'high' })}
            style={{
              backgroundColor: newTask.priority === 'high' ? '#ef4444' : 
                newTask.priority === 'medium' ? '#f59e0b' : '#3b82f6'
            }}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <input
            type="text"
            placeholder="Add a task..."
            className="flex-1 p-1.5 bg-transparent border-b border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none dark:text-gray-100 text-sm"
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTask.title.trim() !== '') {
                handleCreateTask();
              }
            }}
          />
          <input
            type="number"
            placeholder="hrs"
            className="w-12 p-1.5 bg-transparent border-b border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none dark:text-gray-100 text-sm"
            value={newTask.estimatedTime || ''}
            onChange={(e) => setNewTask({ ...newTask, estimatedTime: Number(e.target.value) })}
            step="0.5"
            min="0"
          />
        </div>
      </div>

      {/* Task Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr 
                key={row.id} 
                className="group hover:bg-gray-50 dark:hover:bg-dark-hover"
                draggable
                onDragStart={() => handleDragStart(row.original.id)}
                onDragOver={(e) => handleDragOver(e, row.original.id)}
                onDragEnd={handleDragEnd}
              >
                <td className="w-8 p-2 cursor-move opacity-30 group-hover:opacity-100 transition-opacity">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 4a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm8 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM8 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm8 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm-8 8a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm8 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                  </svg>
                </td>
                <td className="w-8 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <input
                    type="checkbox"
                    checked={selectedTasks.includes(row.original.id)}
                    onChange={() => handleTaskSelection(row.original.id)}
                    className="dark:bg-dark-bg dark:border-gray-600"
                  />
                </td>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="p-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Activation Controls */}
      {selectedTasks.length > 0 && (
        <div className="p-2 border-t dark:border-gray-700">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {getTotalEstimatedTime()} hrs
            </div>
            <button
              onClick={() => setIsConfirmationOpen(true)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
            >
              Start
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {isConfirmationOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white dark:bg-dark-surface p-4 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-medium mb-2">Start Tracking</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {getTotalEstimatedTime()} hours total
            </p>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => setIsConfirmationOpen(false)}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleActivateTasks}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
              >
                Start
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 