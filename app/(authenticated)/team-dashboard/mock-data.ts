import { TeamMember, TeamTask, CalendarEvent, TeamDashboardStats } from '@/packages/types/team';

interface MockTeamData {
  members: TeamMember[];
  tasks: TeamTask[];
  events: CalendarEvent[];
  stats: TeamDashboardStats;
}

export function getMockTeamData(): MockTeamData {
  const now = new Date();
  const toDate = (offsetDays: number, hour = 9) => {
    const date = new Date(now);
    date.setDate(date.getDate() + offsetDays);
    date.setHours(hour, 0, 0, 0);
    return date;
  };

  const members: TeamMember[] = [
    {
      id: 'member-1',
      user_id: 'user-1',
      team_id: 'team-1',
      role: 'leader',
      full_name: '김지훈',
      email: 'leader@example.com',
      assigned_tasks: 5,
      completed_tasks: 4,
      status: 'online',
      last_active_at: new Date(now.getTime() - 5 * 60 * 1000),
      avatar_url: 'https://api.dicebear.com/6.x/initials/svg?seed=JH',
    },
    {
      id: 'member-2',
      user_id: 'user-2',
      team_id: 'team-1',
      role: 'member',
      full_name: '박수연',
      email: 'inspector1@example.com',
      assigned_tasks: 3,
      completed_tasks: 1,
      status: 'busy',
      last_active_at: new Date(now.getTime() - 15 * 60 * 1000),
      avatar_url: 'https://api.dicebear.com/6.x/initials/svg?seed=SY',
    },
    {
      id: 'member-3',
      user_id: 'user-3',
      team_id: 'team-1',
      role: 'member',
      full_name: '이도윤',
      email: 'inspector2@example.com',
      assigned_tasks: 2,
      completed_tasks: 0,
      status: 'offline',
      last_active_at: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      avatar_url: 'https://api.dicebear.com/6.x/initials/svg?seed=DY',
    },
    {
      id: 'member-4',
      user_id: 'user-4',
      team_id: 'team-1',
      role: 'viewer',
      full_name: '최민서',
      email: 'observer@example.com',
      assigned_tasks: 0,
      completed_tasks: 0,
      status: 'online',
      last_active_at: new Date(now.getTime() - 1 * 60 * 60 * 1000),
      avatar_url: 'https://api.dicebear.com/6.x/initials/svg?seed=MS',
    },
  ];

  const tasks: TeamTask[] = [
    {
      id: 'task-1',
      title: '강남구청 AED 점검',
      description: '로비와 체력단련실 AED 상태 확인',
      device_id: 'device-1',
      device_name: '강남구청 로비 AED',
      device_location: '서울 강남구 청사 1층',
      assigned_to: 'member-2',
      assigned_by: 'member-1',
      scheduled_for: toDate(0, 10),
      priority: 'urgent',
      status: 'in_progress',
      created_at: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      updated_at: new Date(now.getTime() - 30 * 60 * 1000),
      notes: '패드 만료일 확인 필요',
      tags: ['현장점검', '서울'],
    },
    {
      id: 'task-2',
      title: '역삼역 AED 점검',
      device_id: 'device-2',
      device_name: '역삼역 2번 출구 AED',
      device_location: '서울 강남구 테헤란로',
      assigned_to: 'member-3',
      assigned_by: 'member-1',
      scheduled_for: toDate(1, 14),
      priority: 'high',
      status: 'pending',
      created_at: new Date(now.getTime() - 4 * 60 * 60 * 1000),
      updated_at: new Date(now.getTime() - 4 * 60 * 60 * 1000),
      notes: '관할 보건소 동행 예정',
      tags: ['현장점검'],
    },
    {
      id: 'task-3',
      title: '삼성동 AED 유지보수',
      device_id: 'device-3',
      device_name: '삼성동 주민센터 AED',
      device_location: '서울 강남구 영동대로',
      assigned_to: 'member-2',
      assigned_by: 'member-1',
      scheduled_for: toDate(2, 9),
      priority: 'normal',
      status: 'pending',
      created_at: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      updated_at: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      tags: ['유지보수'],
    },
    {
      id: 'task-4',
      title: '논현동 AED 점검 보고 작성',
      device_id: 'device-4',
      device_name: '논현동 주민센터 AED',
      device_location: '서울 강남구 학동로',
      assigned_to: 'member-1',
      assigned_by: 'member-1',
      scheduled_for: toDate(-1, 16),
      priority: 'low',
      status: 'completed',
      created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      updated_at: new Date(now.getTime() - 18 * 60 * 60 * 1000),
      completed_at: new Date(now.getTime() - 18 * 60 * 60 * 1000),
      notes: '사진 3장 첨부완료',
      tags: ['보고'],
    },
  ];

  const events: CalendarEvent[] = tasks.map((task) => ({
    id: `event-${task.id}`,
    title: task.title,
    start: task.scheduled_for,
    end: new Date(task.scheduled_for.getTime() + 60 * 60 * 1000),
    type: 'inspection',
    priority: task.priority,
    assigned_to: [task.assigned_to],
    device_id: task.device_id,
    color:
      task.priority === 'urgent'
        ? '#ef4444'
        : task.priority === 'high'
        ? '#f97316'
        : task.priority === 'normal'
        ? '#22c55e'
        : '#38bdf8',
  }));

  const stats: TeamDashboardStats = {
    period: 'today',
    team_id: 'team-1',
    metrics: {
      total_inspections: 12,
      completed_inspections: 8,
      pending_inspections: 3,
      average_completion_time: 42,
      team_productivity: 78,
      devices_inspected: 9,
      issues_found: 4,
      issues_resolved: 3,
    },
    top_performers: [
      { user_id: 'member-1', name: '김지훈', completed_tasks: 5, efficiency_score: 92 },
      { user_id: 'member-2', name: '박수연', completed_tasks: 3, efficiency_score: 85 },
    ],
    priority_distribution: {
      urgent: 2,
      high: 4,
      normal: 5,
      low: 1,
    },
  };

  return {
    members,
    tasks,
    events,
    stats,
  };
}
