'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { TeamMembersResponse, TeamMemberWithStats } from '@/lib/types/team';
import { AEDDevice } from '@/packages/types/aed';

interface TeamMemberSelectorProps {
  onSelect: (userProfileIds: string[] | null) => void;
  defaultValue?: string[] | null;
  showSelfOption?: boolean;
  devices?: AEDDevice[]; // 할당할 AED 장비 정보
}

export function TeamMemberSelector({
  onSelect,
  defaultValue,
  showSelfOption = true,
  devices = []
}: TeamMemberSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(defaultValue || []));
  const [includeSelf, setIncludeSelf] = useState<boolean>(false);

  // 장비 시리얼 번호 추출
  const equipmentSerials = devices.map(d => d.equipment_serial).filter(Boolean).join(',');

  // 팀원 목록 조회 (장비 정보 기반 필터링)
  const { data, isLoading, error } = useQuery<TeamMembersResponse>({
    queryKey: ['team-members', equipmentSerials],
    queryFn: async () => {
      const url = equipmentSerials
        ? `/api/team/members?equipmentSerials=${encodeURIComponent(equipmentSerials)}`
        : '/api/team/members';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch team members');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5분
  });

  const members: TeamMemberWithStats[] = data?.data?.members || [];
  const groupedByDept = data?.data?.groupedByDept || {};
  const currentUser = data?.data?.currentUser;

  // 선택 상태 변경 시 부모에게 알림
  useEffect(() => {
    if (includeSelf) {
      // 본인 포함 시 null 반환 (본인에게 할당)
      onSelect(null);
    } else if (selectedIds.size > 0) {
      // 팀원 선택 시 배열 반환
      onSelect(Array.from(selectedIds));
    } else {
      // 아무것도 선택 안됨
      onSelect(null);
    }
  }, [selectedIds, includeSelf, onSelect]);

  const handleMemberToggle = (memberId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
      return newSet;
    });
    // 팀원 선택 시 본인 선택 해제
    setIncludeSelf(false);
  };

  const handleSelfToggle = () => {
    setIncludeSelf(prev => !prev);
    // 본인 선택 시 팀원 선택 모두 해제
    if (!includeSelf) {
      setSelectedIds(new Set());
    }
  };

  const handleSelectAll = () => {
    const allMemberIds = members.map(m => m.id);
    setSelectedIds(new Set(allMemberIds));
    setIncludeSelf(false);
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
    setIncludeSelf(false);
  };

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

  if (members.length === 0 && !showSelfOption) {
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

  const allSelected = selectedIds.size === members.length && members.length > 0;
  const someSelected = selectedIds.size > 0 && selectedIds.size < members.length;

  return (
    <div className="space-y-4">
      {/* 전체 선택/해제 버튼 */}
      {members.length > 0 && (
        <div className="flex gap-2 pb-3 border-b border-gray-700">
          <Button
            type="button"
            onClick={handleSelectAll}
            variant="outline"
            size="sm"
            className="text-xs"
            disabled={allSelected}
          >
            전체 선택
          </Button>
          <Button
            type="button"
            onClick={handleDeselectAll}
            variant="outline"
            size="sm"
            className="text-xs"
            disabled={selectedIds.size === 0 && !includeSelf}
          >
            전체 해제
          </Button>
          <div className="flex-1 text-right text-xs text-gray-400 flex items-center justify-end">
            {includeSelf ? (
              <span className="text-green-400">본인에게 할당</span>
            ) : selectedIds.size > 0 ? (
              <span>{selectedIds.size}명 선택됨</span>
            ) : (
              <span>선택된 담당자 없음</span>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {/* 본인에게 할당 (기본) */}
        {showSelfOption && (
          <div className="flex items-center space-x-2 p-3 rounded-lg border border-gray-700 bg-gray-800/50 hover:bg-gray-700/50 transition-colors">
            <Checkbox
              id="self"
              checked={includeSelf}
              onCheckedChange={handleSelfToggle}
            />
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
                <Checkbox
                  id={member.id}
                  checked={selectedIds.has(member.id)}
                  onCheckedChange={() => handleMemberToggle(member.id)}
                />
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
      </div>

      {/* 도움말 */}
      <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
        <p className="text-xs text-blue-300">
          {includeSelf
            ? '본인에게 할당하면 즉시 점검할 수 있습니다.'
            : selectedIds.size > 0
            ? `선택한 ${selectedIds.size}명의 팀원에게 일정이 할당되며, 이메일 알림이 발송됩니다.`
            : '담당자를 선택하지 않으면 본인에게 할당됩니다.'}
        </p>
      </div>
    </div>
  );
}
