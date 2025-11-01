'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { TeamMembersResponse, TeamMemberWithStats } from '@/lib/types/team';

interface TeamMemberSelectorProps {
  onSelect: (userProfileId: string | null) => void;
  defaultValue?: string | null;
  showSelfOption?: boolean;
}

export function TeamMemberSelector({
  onSelect,
  defaultValue,
  showSelfOption = true
}: TeamMemberSelectorProps) {
  const [selectedId, setSelectedId] = useState<string>(defaultValue || 'self');

  // 팀원 목록 조회
  const { data, isLoading, error } = useQuery<TeamMembersResponse>({
    queryKey: ['team-members'],
    queryFn: async () => {
      const res = await fetch('/api/team/members');
      if (!res.ok) throw new Error('Failed to fetch team members');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5분
  });

  const members: TeamMemberWithStats[] = data?.data?.members || [];
  const groupedByDept = data?.data?.groupedByDept || {};
  const currentUser = data?.data?.currentUser;

  useEffect(() => {
    if (selectedId === 'self') {
      onSelect(null); // null = 본인
    } else {
      const member = members.find(m => m.id === selectedId);
      onSelect(member?.user_profile_id || null);
    }
  }, [selectedId, members, onSelect]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-gray-400">팀원 목록 로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
        <p className="text-sm text-red-400">팀원 목록을 불러올 수 없습니다.</p>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
        <p className="text-sm text-yellow-400">
          등록된 팀원이 없습니다. 팀원을 먼저 추가해주세요.
        </p>
      </div>
    );
  }

  const getMemberTypeLabel = (type: string) => {
    switch (type) {
      case 'permanent':
        return '정규직';
      case 'temporary':
        return '비정규직';
      case 'volunteer':
        return '자원봉사';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-4">
      <RadioGroup value={selectedId} onValueChange={setSelectedId}>
        {/* 본인에게 할당 (기본) */}
        {showSelfOption && (
          <div className="flex items-center space-x-2 p-3 rounded-lg border border-gray-700 bg-gray-800/50 hover:bg-gray-700/50 transition-colors">
            <RadioGroupItem value="self" id="self" />
            <Label htmlFor="self" className="flex-1 cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">
                    본인에게 할당
                  </div>
                  <div className="text-xs text-gray-400">
                    {currentUser?.name} (직접 점검)
                  </div>
                </div>
                <div className="px-2 py-1 bg-green-900/30 border border-green-500/30 rounded text-xs text-green-400">
                  추천
                </div>
              </div>
            </Label>
          </div>
        )}

        {/* 부서별 팀원 목록 */}
        {Object.entries(groupedByDept).map(([dept, deptMembers]) => (
          <div key={dept} className="space-y-2">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-4 px-1">
              {dept}
            </div>
            {deptMembers.map((member: TeamMemberWithStats) => (
              <div
                key={member.id}
                className="flex items-center space-x-2 p-3 rounded-lg border border-gray-700 bg-gray-800/50 hover:bg-gray-700/50 transition-colors"
              >
                <RadioGroupItem value={member.id} id={member.id} />
                <Label htmlFor={member.id} className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{member.name}</span>
                        <span className="text-xs px-2 py-0.5 bg-gray-700 rounded text-gray-300">
                          {getMemberTypeLabel(member.member_type)}
                        </span>
                      </div>
                      {member.email && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {member.email}
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <div className="flex items-center gap-3 text-sm">
                        <div className="text-center">
                          <div className="text-gray-400 text-xs">할당</div>
                          <div className="text-white font-medium">
                            {member.current_assigned}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-400 text-xs">완료</div>
                          <div className="text-green-400 font-medium">
                            {member.completed_this_month}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Label>
              </div>
            ))}
          </div>
        ))}
      </RadioGroup>

      {/* 도움말 */}
      <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
        <p className="text-xs text-blue-300">
          할당된 일정은 해당 팀원의 대시보드에 표시되며, 이메일 알림이 발송됩니다.
        </p>
      </div>
    </div>
  );
}
