'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ChevronDown,
  ChevronRight,
  Link2,
  Users,
  Package,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { shortenAddressSido } from '@/lib/constants/regions';
import type { InstitutionGroup, TargetInstitution } from '@/lib/utils/institution-grouping';

interface InstitutionGroupCardProps {
  group: InstitutionGroup;
  isSelected: boolean;
  selectedMembers: Set<string>;
  onSelectGroup: (groupId: string, selected: boolean) => void;
  onSelectMember: (targetKey: string, selected: boolean) => void;
  onViewDetails: (institution: TargetInstitution) => void;
  isExpanded?: boolean;
}

export default function InstitutionGroupCard({
  group,
  isSelected,
  selectedMembers,
  onSelectGroup,
  onSelectMember,
  onViewDetails,
  isExpanded: initialExpanded = false
}: InstitutionGroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  // 그룹 선택 핸들러
  const handleGroupSelect = (checked: boolean) => {
    onSelectGroup(group.groupId, checked);
    // 그룹 선택 시 모든 멤버도 선택/해제
    group.members.forEach(member => {
      onSelectMember(member.target_key, checked);
    });
  };

  // 개별 멤버 선택 핸들러
  const handleMemberSelect = (targetKey: string, checked: boolean) => {
    onSelectMember(targetKey, checked);

    // 모든 멤버가 선택되었는지 확인
    const allSelected = group.members.every(m =>
      m.target_key === targetKey ? checked : selectedMembers.has(m.target_key)
    );

    // 그룹 선택 상태 업데이트
    if (allSelected !== isSelected) {
      onSelectGroup(group.groupId, allSelected);
    }
  };

  // 신뢰도에 따른 색상
  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'text-green-600 bg-green-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'low':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  // 신뢰도 아이콘
  const getConfidenceIcon = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return <CheckCircle className="w-4 h-4" />;
      case 'medium':
        return <AlertCircle className="w-4 h-4" />;
      case 'low':
        return <XCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  // 매칭 상태 계산
  const totalMatched = group.members.reduce((sum, m) => sum + m.matched_count, 0);
  const totalUnmatched = group.members.reduce((sum, m) => sum + m.unmatched_count, 0);
  const matchRate = group.totalEquipment > 0
    ? Math.round((totalMatched / group.totalEquipment) * 100)
    : 0;

  return (
    <Card className={cn(
      "transition-all duration-200",
      isSelected && "ring-2 ring-blue-500",
      "hover:shadow-md"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {/* 그룹 선택 체크박스 */}
          <Checkbox
            checked={isSelected}
            onCheckedChange={handleGroupSelect}
            className="mt-1"
            aria-label={`Select group ${group.masterInstitution.institution_name}`}
          />

          {/* 확장/축소 버튼 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0 h-auto hover:bg-transparent"
          >
            {isExpanded ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </Button>

          {/* 그룹 정보 */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Link2 className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold text-lg">
                {group.masterInstitution.institution_name}
              </h3>
              <Badge variant="secondary" className="ml-auto">
                <Users className="w-3 h-3 mr-1" />
                {group.members.length}개 기관
              </Badge>
            </div>

            {/* 그룹 통계 */}
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Package className="w-4 h-4" />
                총 {group.totalEquipment}개 장비
              </span>
              <span className="flex items-center gap-1">
                {shortenAddressSido(group.masterInstitution.sido)} {group.masterInstitution.gugun}
              </span>
              <span className="flex items-center gap-1">
                매칭률 {matchRate}%
              </span>
            </div>

            {/* 신뢰도 표시 */}
            <div className="flex items-center gap-2 mt-2">
              <Badge
                variant="outline"
                className={cn("gap-1", getConfidenceColor(group.confidence))}
              >
                {getConfidenceIcon(group.confidence)}
                신뢰도 {Math.round(group.similarity * 100)}%
              </Badge>
              {group.confidence === 'low' && (
                <span className="text-xs text-red-600">
                  수동 검증 권장
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      {/* 그룹 멤버 리스트 (확장 시) */}
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-2 mt-2 pl-8">
            {group.members.map((member, index) => (
              <div
                key={member.target_key}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg",
                  "hover:bg-gray-50 dark:hover:bg-gray-800",
                  selectedMembers.has(member.target_key) && "bg-blue-50 dark:bg-blue-900/20"
                )}
              >
                <Checkbox
                  checked={selectedMembers.has(member.target_key)}
                  onCheckedChange={(checked) =>
                    handleMemberSelect(member.target_key, checked as boolean)
                  }
                  aria-label={`Select ${member.institution_name}`}
                />

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {member.institution_name}
                    </span>
                    {member.target_key === group.masterInstitution.target_key && (
                      <Badge variant="default" className="text-xs">
                        대표
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-600 mt-1">
                    <span>{member.division} / {member.sub_division}</span>
                    <span>{member.equipment_count}개 장비</span>
                    {member.matched_count > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {member.matched_count}개 매칭됨
                      </Badge>
                    )}
                  </div>

                  {member.address && (
                    <div className="text-xs text-gray-500 mt-1">
                      {member.address}
                    </div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewDetails(member)}
                  className="text-xs"
                >
                  상세보기
                </Button>
              </div>
            ))}
          </div>

          {/* 그룹 액션 버튼 */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                // 그룹 매칭 검색 로직
                console.log('Search matching for group:', group.groupId);
              }}
            >
              그룹 매칭 검색
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                // 그룹 해제 로직
                console.log('Ungroup:', group.groupId);
              }}
            >
              그룹 해제
            </Button>
            {totalUnmatched > 0 && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {totalUnmatched}개 미매칭
              </Badge>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}