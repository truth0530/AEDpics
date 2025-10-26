'use client';

import { useMemo } from 'react';
import type { CalendarEvent } from '@/packages/types/team';
import { CalendarDays } from 'lucide-react';

interface CalendarViewProps {
  events: CalendarEvent[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

function formatDateLabel(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function isSameDay(dateA: Date, dateB: Date) {
  return dateA.toDateString() === dateB.toDateString();
}

export function CalendarView({ events, selectedDate, onSelectDate }: CalendarViewProps) {
  const weekDays = useMemo(() => {
    const start = new Date(selectedDate);
    // 주의 시작을 월요일로 설정
    const day = start.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    start.setDate(start.getDate() + diff);

    return Array.from({ length: 7 }, (_, index) => {
      const current = new Date(start);
      current.setDate(start.getDate() + index);
      return current;
    });
  }, [selectedDate]);

  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5 shadow-lg backdrop-blur">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-200">주간 일정</h2>
          <p className="text-xs text-gray-500">드래그하여 작업을 다른 날짜로 이동할 수 있습니다.</p>
        </div>
        <CalendarDays className="h-5 w-5 text-gray-500" />
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {weekDays.map((date) => {
          const dayEvents = events.filter((event) => isSameDay(event.start, date));
          const isSelected = isSameDay(date, selectedDate);

          return (
            <button
              key={date.toISOString()}
              onClick={() => onSelectDate(date)}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                isSelected
                  ? 'border-blue-500/60 bg-blue-600/10'
                  : 'border-gray-800 bg-gray-950/40 hover:border-gray-700 hover:bg-gray-900/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    {date.toLocaleDateString('ko-KR', { weekday: 'short' })}
                  </p>
                  <p className="text-lg font-semibold text-gray-100">{formatDateLabel(date)}</p>
                </div>
                <span className="rounded-full bg-gray-800 px-2 py-1 text-xs text-gray-300">
                  {dayEvents.length}건
                </span>
              </div>

              <ul className="mt-3 space-y-2">
                {dayEvents.slice(0, 3).map((event) => (
                  <li key={event.id} className="rounded-md border border-gray-800 bg-gray-900/70 px-3 py-2">
                    <p className="text-sm text-gray-100">{event.title}</p>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
                      <span>
                        {new Date(event.start).toLocaleTimeString('ko-KR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="capitalize text-gray-400">{event.priority}</span>
                    </div>
                  </li>
                ))}
                {dayEvents.length > 3 && (
                  <li className="text-xs text-gray-500">외 {dayEvents.length - 3}건</li>
                )}
                {dayEvents.length === 0 && (
                  <li className="text-xs text-gray-500">등록된 일정 없음</li>
                )}
              </ul>
            </button>
          );
        })}
      </div>
    </section>
  );
}
