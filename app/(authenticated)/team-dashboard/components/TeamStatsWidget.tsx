'use client';

import type { TeamDashboardStats } from '@/packages/types/team';
import { Activity, CheckCircle2, Clock, Target } from 'lucide-react';

interface TeamStatsWidgetProps {
  stats: TeamDashboardStats;
}

const metricCards = (
  stats: TeamDashboardStats['metrics']
): Array<{
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}> => [
  {
    title: '총 점검',
    value: stats.total_inspections,
    subtitle: '최근 기간 기준',
    icon: Activity,
    accent: 'bg-blue-500/20 text-blue-300',
  },
  {
    title: '완료율',
    value: `${Math.round((stats.completed_inspections / Math.max(stats.total_inspections, 1)) * 100)}%`,
    subtitle: `${stats.completed_inspections}건 완료`,
    icon: CheckCircle2,
    accent: 'bg-emerald-500/20 text-emerald-300',
  },
  {
    title: '평균 소요시간',
    value: `${stats.average_completion_time}분`,
    subtitle: '작업당 평균',
    icon: Clock,
    accent: 'bg-amber-500/20 text-amber-300',
  },
  {
    title: '팀 생산성',
    value: `${stats.team_productivity}%`,
    subtitle: '완료/배정 기준',
    icon: Target,
    accent: 'bg-purple-500/20 text-purple-300',
  },
];

export function TeamStatsWidget({ stats }: TeamStatsWidgetProps) {
  const cards = metricCards(stats.metrics);

  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6 shadow-lg backdrop-blur">
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="grid flex-1 gap-4 sm:grid-cols-2">
          {cards.map((card) => (
            <div
              key={card.title}
              className="rounded-xl border border-gray-800 bg-gray-950/60 px-5 py-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">{card.title}</p>
                  <p className="mt-2 text-2xl font-semibold text-gray-100">{card.value}</p>
                  <p className="mt-1 text-xs text-gray-500">{card.subtitle}</p>
                </div>
                <span className={`rounded-full p-2 ${card.accent}`}>
                  <card.icon className="h-5 w-5" />
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="w-full max-w-xs rounded-xl border border-gray-800 bg-gray-950/60 px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-200">우선순위 분포</h3>
          <div className="mt-4 space-y-3 text-sm text-gray-300">
            <PriorityBar label="긴급" value={stats.priority_distribution.urgent} color="bg-red-500/60" />
            <PriorityBar label="높음" value={stats.priority_distribution.high} color="bg-orange-500/60" />
            <PriorityBar label="보통" value={stats.priority_distribution.normal} color="bg-emerald-500/60" />
            <PriorityBar label="낮음" value={stats.priority_distribution.low} color="bg-sky-500/60" />
          </div>
          <div className="mt-4 border-t border-gray-800 pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Top Performer</h4>
            <ul className="mt-3 space-y-2 text-sm text-gray-300">
              {stats.top_performers.map((performer) => (
                <li key={performer.user_id} className="flex items-center justify-between">
                  <span>{performer.name}</span>
                  <span className="text-xs text-gray-500">
                    {performer.completed_tasks}건 · {performer.efficiency_score}점
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function PriorityBar({ label, value, color }: { label: string; value: number; color: string }) {
  const width = Math.min(100, value * 15);
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span>{value}건</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-gray-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
