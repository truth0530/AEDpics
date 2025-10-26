'use client';

import { useMemo } from 'react';
import type { TeamMember, TeamTask } from '@/packages/types/team';

interface TaskBoardProps {
  tasks: TeamTask[];
  allMembers: TeamMember[];
  selectedDate: Date;
  onStatusChange: (taskId: string, status: TeamTask['status']) => void;
  onReassign: (taskId: string, memberId: string) => void;
  onReschedule: (taskId: string, date: Date) => void;
}

const STATUS_CONFIG: Array<{
  status: TeamTask['status'];
  label: string;
  description: string;
}> = [
  { status: 'pending', label: '대기', description: '배정 완료 / 착수 전' },
  { status: 'in_progress', label: '진행중', description: '현장 점검 또는 보고 작성 중' },
  { status: 'completed', label: '완료', description: '검수 및 보고 완료' },
];

export function TaskBoard({
  tasks,
  allMembers,
  selectedDate,
  onStatusChange,
  onReassign,
  onReschedule,
}: TaskBoardProps) {
  const tasksByStatus = useMemo(() => {
    return STATUS_CONFIG.reduce<Record<TeamTask['status'], TeamTask[]>>((acc, column) => {
      acc[column.status] = tasks.filter((task) => task.status === column.status);
      return acc;
    }, {
      pending: [],
      in_progress: [],
      completed: [],
      cancelled: [],
    } as Record<TeamTask['status'], TeamTask[]>);
  }, [tasks]);

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, taskId: string) => {
    event.dataTransfer.setData('text/plain', taskId);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>, status: TeamTask['status']) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData('text/plain');
    if (taskId) {
      onStatusChange(taskId, status);
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-gray-800 bg-gray-900/60 p-5 shadow-lg backdrop-blur">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-200">
            {selectedDate.toLocaleDateString('ko-KR')} 작업 현황
          </h2>
          <p className="text-xs text-gray-500">드래그하여 상태를 변경하고, 담당자/일정을 수정할 수 있습니다.</p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {STATUS_CONFIG.map((column) => (
          <div
            key={column.status}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDrop(event, column.status)}
            className="flex min-h-[260px] flex-col rounded-xl border border-dashed border-gray-700 bg-gray-950/40 p-3"
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-100">{column.label}</p>
                <p className="text-[11px] text-gray-500">{column.description}</p>
              </div>
              <span className="text-xs text-gray-500">{tasksByStatus[column.status]?.length || 0}건</span>
            </div>

            <div className="flex flex-1 flex-col gap-2">
              {(tasksByStatus[column.status] || []).map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(event) => handleDragStart(event, task.id)}
                  className="cursor-move rounded-lg border border-gray-800 bg-gray-900/80 p-3 shadow-sm transition hover:border-blue-500/40"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-100">{task.title}</h3>
                    <span className="text-xs text-gray-500">
                      {new Date(task.scheduled_for).toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-gray-500">{task.device_location}</p>

                  <div className="mt-3 flex items-center gap-2">
                    <label className="flex-1 text-[11px] text-gray-500">
                      담당자
                      <select
                        value={task.assigned_to}
                        onChange={(event) => onReassign(task.id, event.target.value)}
                        className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-gray-100 focus:border-blue-500 focus:outline-none"
                      >
                        {allMembers.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.full_name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex-1 text-[11px] text-gray-500">
                      일정
                      <input
                        type="date"
                        value={new Date(task.scheduled_for).toISOString().slice(0, 10)}
                        onChange={(event) => onReschedule(task.id, new Date(event.target.value))}
                        className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-gray-100 focus:border-blue-500 focus:outline-none"
                      />
                    </label>
                  </div>

                  {task.tags && task.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {task.tags.map((tag) => (
                        <span key={tag} className="rounded bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {(tasksByStatus[column.status] || []).length === 0 && (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-gray-800 bg-gray-950/20 text-xs text-gray-500">
                  작업 없음
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
