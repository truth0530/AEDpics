'use client';

import { useMemo, useState, useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import type {
  TeamMember,
  TeamTask,
  CalendarEvent,
  TeamDashboardStats,
} from '@/packages/types/team';
import type { UserProfile } from '@/packages/types';
import { TeamMemberList } from './components/TeamMemberList';
import { TeamStatsWidget } from './components/TeamStatsWidget';
import { CalendarView } from './components/CalendarView';
import { TaskBoard } from './components/TaskBoard';
import { TeamActivityFeed } from './components/TeamActivityFeed';
import { isFeatureEnabled } from '@/lib/config/feature-flags';
import { usePresence } from '@/lib/realtime/hooks/usePresence';
import { useRealtimeSync } from '@/lib/realtime/hooks/useRealtimeSync';

interface SerializedTeamMember extends Omit<TeamMember, 'last_active_at'> {
  last_active_at?: string | Date;
}

interface SerializedTeamTask extends Omit<TeamTask, 'scheduled_for' | 'created_at' | 'updated_at' | 'completed_at'> {
  scheduled_for: string | Date;
  created_at: string | Date;
  updated_at: string | Date;
  completed_at?: string | Date;
}

interface SerializedCalendarEvent extends Omit<CalendarEvent, 'start' | 'end'> {
  start: string | Date;
  end: string | Date;
}

interface SerializedTeamDashboardStats extends Omit<TeamDashboardStats, 'metrics'> {
  metrics: TeamDashboardStats['metrics'];
}

interface TeamDashboardClientProps {
  userProfile: UserProfile;
  initialMembers: SerializedTeamMember[];
  initialTasks: SerializedTeamTask[];
  initialEvents: SerializedCalendarEvent[];
  initialStats: SerializedTeamDashboardStats;
}

function parseDateValue<T extends string | Date | undefined>(value: T): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  return new Date(value);
}

function TeamDashboardContent({
  userProfile,
  initialMembers,
  initialTasks,
  initialEvents,
  initialStats,
}: TeamDashboardClientProps) {
  const { showSuccess, showInfo } = useToast();

  const [members] = useState<TeamMember[]>(() =>
    initialMembers.map((member) => ({
      ...member,
      last_active_at: parseDateValue(member.last_active_at),
    }))
  );

  const [tasks, setTasks] = useState<TeamTask[]>(() =>
    initialTasks.map((task) => ({
      ...task,
      scheduled_for: parseDateValue(task.scheduled_for) ?? new Date(),
      created_at: parseDateValue(task.created_at) ?? new Date(),
      updated_at: parseDateValue(task.updated_at) ?? new Date(),
      completed_at: parseDateValue(task.completed_at),
    }))
  );

  const [events] = useState<CalendarEvent[]>(() =>
    initialEvents.map((event) => ({
      ...event,
      start: parseDateValue(event.start) ?? new Date(),
      end: parseDateValue(event.end) ?? new Date(),
    }))
  );

  const [stats, setStats] = useState<TeamDashboardStats>(initialStats);

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Realtime features
  const isRealtimeEnabled = isFeatureEnabled('realtimeSync');

  // Use presence tracking if realtime is enabled
  const presence = usePresence({ enabled: isRealtimeEnabled });

  const realtimeSync = useRealtimeSync<TeamTask>({
    table: 'inspection_schedule_entries',
    initialData: tasks,
    enabled: isRealtimeEnabled,
    onDataChange: (newTasks) => {
      setTasks(newTasks);

      if (isRealtimeEnabled) {
        showInfo('작업이 실시간으로 동기화되었습니다', { message: '다른 팀원의 변경사항이 반영되었습니다' });
      }

      setStats(prev => ({
        ...prev,
        metrics: {
          ...prev.metrics,
          total_inspections: newTasks.length,
          completed_inspections: newTasks.filter(t => t.status === 'completed').length,
          pending_inspections: newTasks.filter(t => t.status === 'pending').length,
        }
      }));
    }
  });

  // Update members with online status
  const membersWithPresence = useMemo(() => {
    if (!isRealtimeEnabled) {
      return members;
    }

    return members.map(member => ({
      ...member,
      status: (presence.isUserOnline(member.user_id) ? 'online' : 'offline') as 'online' | 'offline' | 'busy',
    }));
  }, [members, presence, isRealtimeEnabled]);

  const activeTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesMember = selectedMemberId ? task.assigned_to === selectedMemberId : true;
      const matchesDate = task.scheduled_for
        ? task.scheduled_for.toDateString() === selectedDate.toDateString()
        : true;
      return matchesMember && matchesDate;
    });
  }, [tasks, selectedMemberId, selectedDate]);

  const handleStatusChange = useCallback(
    (taskId: string, newStatus: TeamTask['status']) => {
      const updatedTask = {
        status: newStatus,
        updated_at: new Date(),
        completed_at: newStatus === 'completed' ? new Date() : undefined,
      };

      if (isRealtimeEnabled) {
        // Use realtime sync if enabled
        realtimeSync.updateItem(taskId, updatedTask);
        showSuccess('작업 상태가 변경되었습니다.', { message: '실시간으로 동기화됩니다.' });
      } else {
        // Local update only
        setTasks((prev) =>
          prev.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  ...updatedTask,
                  completed_at: updatedTask.completed_at || task.completed_at,
                }
              : task
          )
        );
        showSuccess('작업 상태가 변경되었습니다.', { message: '실제 저장은 Sprint 2에서 연결됩니다.' });
      }
    },
    [showSuccess, realtimeSync, isRealtimeEnabled]
  );

  const handleReassign = useCallback(
    (taskId: string, memberId: string) => {
      const updatedTask = {
        assigned_to: memberId,
        updated_at: new Date(),
      };

      if (isRealtimeEnabled) {
        realtimeSync.updateItem(taskId, updatedTask);
        showSuccess('작업 담당자가 변경되었습니다.', { message: '실시간으로 동기화됩니다.' });
      } else {
        setTasks((prev) =>
          prev.map((task) =>
            task.id === taskId
              ? { ...task, ...updatedTask }
              : task
          )
        );
        showSuccess('작업 담당자가 변경되었습니다.', { message: '실제 반영은 Sprint 2에서 구현됩니다.' });
      }
    },
    [showSuccess, realtimeSync, isRealtimeEnabled]
  );

  const handleReschedule = useCallback(
    (taskId: string, date: Date) => {
      const updatedTask = {
        scheduled_for: date,
        updated_at: new Date(),
      };

      if (isRealtimeEnabled) {
        realtimeSync.updateItem(taskId, updatedTask);
        showSuccess('작업 일정이 변경되었습니다.', { message: '실시간으로 동기화됩니다.' });
      } else {
        setTasks((prev) =>
          prev.map((task) =>
            task.id === taskId
              ? { ...task, ...updatedTask }
              : task
          )
        );
        showSuccess('작업 일정이 변경되었습니다.', { message: '실제 저장은 Sprint 2에서 연결됩니다.' });
      }
      setSelectedDate(date);
    },
    [showSuccess, realtimeSync, isRealtimeEnabled]
  );

  return (
    <div className="h-full min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold text-white">팀 대시보드</h1>
            <p className="text-sm text-gray-400">
              {userProfile?.organization?.name || '소속 조직'} · {members.length}명 팀원
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className={isRealtimeEnabled ? 'text-emerald-400' : ''}>
              실시간 동기화 {isRealtimeEnabled ? '활성화됨' : '예정'}
            </span>
            {isRealtimeEnabled && (
              <>
                <span>·</span>
                <span className="text-emerald-400">
                  {presence.onlineCount}명 온라인
                </span>
              </>
            )}
            {isRealtimeEnabled && (
              <>
                <span>·</span>
                <span className={realtimeSync.isConnected ? 'text-green-400' : 'text-yellow-400'}>
                  {realtimeSync.isConnected ? '연결됨' : '연결 중...'}
                </span>
              </>
            )}
            <span className="hidden md:inline">·</span>
            <span className="hidden md:inline">Stage 2 Sprint 2 - Day 6</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-6 lg:py-8">
        <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
          <TeamMemberList
            members={membersWithPresence}
            selectedMemberId={selectedMemberId}
            onSelectMember={setSelectedMemberId}
          />

          <main className="flex flex-col gap-6">
            <TeamStatsWidget stats={stats} />

            <section className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
              <CalendarView
                events={events}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />

              <TaskBoard
                tasks={activeTasks}
                allMembers={membersWithPresence}
                selectedDate={selectedDate}
                onStatusChange={handleStatusChange}
                onReassign={handleReassign}
                onReschedule={handleReschedule}
              />
            </section>

            {isRealtimeEnabled && (
              <section>
                <TeamActivityFeed
                  maxItems={30}
                  autoScroll={true}
                  showNotifications={true}
                  className="h-96"
                />
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export function TeamDashboardClient(props: TeamDashboardClientProps) {
  // TODO: SupabaseProvider 임시 제거 - Realtime 기능 재구현 필요
  return (
    <TeamDashboardContent {...props} />
  );
}
