import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  createColumnHelper,
  flexRender,
} from '@tanstack/react-table';

interface SubTask {
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

interface TaskTableProps {
  tasks: SubTask[];
  onCreateTask: (task: { title: string; estimatedTime: number; domain: string }) => void;
  onDeleteTask?: (taskId: string) => void;
  onToggleComplete?: (taskId: string, isCompleted: boolean) => void;
}

const columnHelper = createColumnHelper<SubTask>();

export const TaskTable: React.FC<TaskTableProps> = ({ 
  tasks, 
  onCreateTask, 
  onDeleteTask,
  onToggleComplete 
}) => {
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [newTask, setNewTask] = useState<{
    title: string;
    estimatedTime: number;
  }>({
    title: '',
    estimatedTime: 0,
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

    // Note: We'll need to implement order persistence if needed
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
  };

  const columns = [
    columnHelper.accessor('isCompleted', {
      header: '',
      cell: (info) => (
        <div className="flex items-center justify-center w-6">
          <input
            type="checkbox"
            checked={info.getValue() || false}
            onChange={(e) => onToggleComplete?.(info.row.original.id, e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
        </div>
      ),
    }),
    columnHelper.accessor('title', {
      header: 'Task',
      cell: (info) => {
        const isCompleted = info.row.original.isCompleted;
        return (
          <div className={`font-medium text-left ${
            isCompleted ? 'text-gray-400 dark:text-gray-600' : ''
          }`}>
            <div className="relative">
              {info.getValue() || <span className="text-gray-400 dark:text-gray-600">Untitled</span>}
              {isCompleted && (
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-400 dark:border-gray-600"></div>
                </div>
              )}
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor('estimatedTime', {
      header: 'Est.',
      cell: (info) => {
        const isCompleted = info.row.original.isCompleted;
        return (
          <div className={`flex items-center justify-end space-x-1 ${
            isCompleted ? 'text-gray-400 dark:text-gray-600' : 'text-gray-600 dark:text-gray-400'
          }`}>
            <div className="relative">
              <span>{info.getValue()}</span>
              {isCompleted && (
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-400 dark:border-gray-600"></div>
                </div>
              )}
            </div>
            <span className="text-xs">h</span>
          </div>
        );
      },
    }),
    columnHelper.accessor('id', {
      header: '',
      cell: (info) => (
        <div className="w-6 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onDeleteTask?.(info.getValue())}
            className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
          >
            ×
          </button>
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: tasks,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleCreateTask = () => {
    if (!newTask.title.trim()) {
      // Focus the title input if empty
      const titleInput = document.getElementById('new-task-title');
      if (titleInput) {
        titleInput.focus();
      }
      return;
    }
    
    onCreateTask({
      ...newTask,
      domain: '',
    });

    setNewTask({
      title: '',
      estimatedTime: 0,
    });

    // Focus back on title input after creating
    const titleInput = document.getElementById('new-task-title');
    if (titleInput) {
      titleInput.focus();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Task Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="min-w-full table-fixed">
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr 
                key={row.id} 
                className="group hover:bg-gray-50 dark:hover:bg-dark-hover cursor-move"
                draggable
                onDragStart={() => handleDragStart(row.original.id)}
                onDragOver={(e) => handleDragOver(e, row.original.id)}
                onDragEnd={handleDragEnd}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={`px-3 py-1 ${
                    cell.column.id === 'title' ? 'text-left w-[60%]' : 
                    cell.column.id === 'estimatedTime' ? 'text-right w-[20%]' :
                    cell.column.id === 'isCompleted' ? 'w-[10%]' : 'w-[10%]'
                  }`}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Task Creation Form */}
      <div className="border-t dark:border-gray-700">
        <div className="px-3 py-2">
          <div className="flex gap-3 items-center h-[22px]">
            <div className="w-6"></div> {/* Checkbox spacer */}
            <input
              id="new-task-title"
              type="text"
              placeholder="Add a subtask..."
              className="flex-1 h-full py-0.5 px-0 bg-transparent  focus:outline-none dark:text-gray-100 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-600"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTask.title.trim()) {
                  handleCreateTask();
                }
              }}
            />
            <input
              type="number"
              placeholder="0"
              className="w-12 h-full py-0.5 px-0 bg-transparent focus:outline-none dark:text-gray-100 text-sm text-right placeholder:text-gray-400 dark:placeholder:text-gray-600"
              value={newTask.estimatedTime || ''}
              onChange={(e) => setNewTask({ ...newTask, estimatedTime: Number(e.target.value) })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (!newTask.title.trim()) {
                    const titleInput = document.getElementById('new-task-title');
                    if (titleInput) {
                      titleInput.focus();
                    }
                    return;
                  }
                  handleCreateTask();
                }
              }}
              step="0.5"
              min="0"
            />
            <span className="text-xs text-gray-400 dark:text-gray-600 w-4">h</span>
            <div className="w-6"></div> {/* Delete button spacer */}
          </div>
        </div>
      </div>
    </div>
  );
}; 