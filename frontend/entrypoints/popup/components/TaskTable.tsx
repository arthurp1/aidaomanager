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
}

interface TaskTableProps {
  tasks: SubTask[];
  onCreateTask: (task: { title: string; estimatedTime: number; domain: string }) => void;
}

const columnHelper = createColumnHelper<SubTask>();

export const TaskTable: React.FC<TaskTableProps> = ({ tasks, onCreateTask }) => {
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
    columnHelper.accessor('title', {
      header: 'Task',
      cell: (info) => (
        <div className="font-medium text-left">
          {info.getValue() || <span className="text-gray-400 dark:text-gray-600">Untitled</span>}
        </div>
      ),
    }),
    columnHelper.accessor('estimatedTime', {
      header: 'Est.',
      cell: (info) => (
        <div className="flex items-center justify-end space-x-1 text-gray-600 dark:text-gray-400">
          <span>{info.getValue()}</span>
          <span className="text-xs">h</span>
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
                <td className="w-8 pl-3 pr-1 py-1"></td>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={`px-3 py-1 ${
                    cell.column.id === 'title' ? 'text-left w-[70%]' : 'text-right w-[30%]'
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
            <input
              id="new-task-title"
              type="text"
              placeholder="Add a subtask..."
              className="flex-1 h-full py-0.5 px-0 bg-transparent border-b border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none dark:text-gray-100 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-600"
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
              className="w-12 h-full py-0.5 px-0 bg-transparent border-b border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none dark:text-gray-100 text-sm text-right placeholder:text-gray-400 dark:placeholder:text-gray-600"
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
          </div>
        </div>
      </div>
    </div>
  );
}; 