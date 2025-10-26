'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import type { TeamMember } from '@/packages/types/team';

interface TeamMemberListProps {
  members: TeamMember[];
  selectedMemberId: string | null;
  onSelectMember: (memberId: string | null) => void;
}

const STATUS_COLORS: Record<TeamMember['status'], string> = {
  online: 'bg-emerald-400',
  offline: 'bg-gray-500',
  busy: 'bg-amber-400',
};

export function TeamMemberList({ members, selectedMemberId, onSelectMember }: TeamMemberListProps) {
  const [query, setQuery] = useState('');
  const filteredMembers = useMemo(() => {
    if (!query) return members;
    const lower = query.toLowerCase();
    return members.filter((member) =>
      member.full_name.toLowerCase().includes(lower) || member.email.toLowerCase().includes(lower)
    );
  }, [members, query]);

  return (
    <aside className="rounded-2xl border border-gray-800 bg-gray-900/60 shadow-lg backdrop-blur">
      <div className="border-b border-gray-800 px-5 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-200">팀원</h2>
          <button
            onClick={() => onSelectMember(null)}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            전체 보기
          </button>
        </div>
        <div className="mt-3">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="팀원 검색"
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <ul className="space-y-1 px-2 py-4">
        {filteredMembers.map((member) => {
          const isActive = member.id === selectedMemberId;
          return (
            <li key={member.id}>
              <button
                onClick={() => onSelectMember(isActive ? null : member.id)}
                className={`w-full rounded-lg px-3 py-3 text-left transition ${
                  isActive
                    ? 'bg-blue-600/20 ring-1 ring-blue-500/40'
                    : 'hover:bg-gray-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Image
                      src={member.avatar_url || `https://api.dicebear.com/6.x/initials/svg?seed=${encodeURIComponent(member.full_name)}`}
                      alt={member.full_name}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full border border-gray-700 object-cover"
                      unoptimized
                    />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border border-gray-900 ${STATUS_COLORS[member.status]}`}
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-100">{member.full_name}</p>
                    <p className="text-xs text-gray-400">{member.email}</p>
                    <div className="mt-2 flex gap-2 text-[11px] text-gray-400">
                      <span>배정 {member.assigned_tasks}건</span>
                      <span>완료 {member.completed_tasks}건</span>
                    </div>
                  </div>
                </div>
              </button>
            </li>
          );
        })}

        {filteredMembers.length === 0 && (
          <li className="px-3 py-8 text-center text-sm text-gray-500">검색 결과가 없습니다.</li>
        )}
      </ul>
    </aside>
  );
}
