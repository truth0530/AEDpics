'use client';

import React, { useState, useMemo } from 'react';
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
  const [showAmbulanceWarning, setShowAmbulanceWarning] = useState(false);
  const [pendingGroupMatch, setPendingGroupMatch] = useState(false);

  // 구급차 여부 판단 함수
  const isAmbulance = (institution: TargetInstitution): boolean => {
    // sub_division에서 "119"와 "구급차"를 모두 포함하는지 확인
    const subDivision = institution.sub_division || '';
    const result = subDivision.includes('119') && subDivision.includes('구급차');
    if (result) {
      console.log('ambulance detected:', {
        institution_name: institution.institution_name,
        sub_division: subDivision,
        isAmbulance: result
      });
    }
    return result;
  };

  // 그룹 내 구급차 관련 정보 분석
  const ambulanceInfo = useMemo(() => {
    const ambulanceMembers = group.members.filter(m => isAmbulance(m));
    const nonAmbulanceMembers = group.members.filter(m => !isAmbulance(m));
    const hasAmbulance = ambulanceMembers.length > 0;
    const hasNonAmbulance = nonAmbulanceMembers.length > 0;

    // 구급차가 포함된 경우 항상 경고 필요 (혼합이든 구급차끼리든)
    const needsWarning = hasAmbulance;

    return {
      hasAmbulance,
      hasNonAmbulance,
      hasConflict: hasAmbulance && hasNonAmbulance,
      needsWarning,
      ambulanceMembers,
      nonAmbulanceMembers
    };
  }, [group.members]);

  // 그룹 선택 핸들러
  const handleGroupSelect = (checked: boolean) => {
    // 구급차가 포함된 경우 항상 경고 (구급차 혼합, 구급차끼리 그룹핑, 모든 경우)
    if (checked && ambulanceInfo.needsWarning) {
      setPendingGroupMatch(true);
      setShowAmbulanceWarning(true);
      return;
    }

    onSelectGroup(group.groupId, checked);
    // 그룹 선택 시 모든 멤버도 선택/해제
    group.members.forEach(member => {
      onSelectMember(member.target_key, checked);
    });
  };

  // 경고 후 그룹핑 강행
  const handleForceGrouping = () => {
    setShowAmbulanceWarning(false);
    onSelectGroup(group.groupId, true);
    group.members.forEach(member => {
      onSelectMember(member.target_key, true);
    });
    setPendingGroupMatch(false);
  };

  // 경고 취소
  const handleCancelGrouping = () => {
    setShowAmbulanceWarning(false);
    setPendingGroupMatch(false);
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
        return 'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30';
      case 'medium':
        return 'text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/30';
      case 'low':
        return 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30';
      default:
        return 'text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/50';
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
    <>
      {/* 경고 다이얼로그 */}
      {showAmbulanceWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white text-base mb-2">
                  구급차 매칭 주의
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  구급차의 경우 인트라넷에 존재하는 해당 구급차 장비연번과 각각 개별 매칭 해야 합니다 다시 확인하시고 진행해 주세요. (단, 소방은 일괄매칭 가능)
                </p>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={handleCancelGrouping}
                className="text-sm"
              >
                취소
              </Button>
              <Button
                onClick={handleForceGrouping}
                className="text-sm bg-red-600 hover:bg-red-700 text-white"
              >
                그루핑강행
              </Button>
            </div>
          </div>
        </div>
      )}

      <Card className={cn(
        "transition-all duration-200",
        isSelected && "ring-2 ring-blue-500",
        "hover:shadow-md"
      )}>
      <CardHeader className="pb-2 pt-2 px-2">
        <div className="flex items-start gap-1.5">
          {/* 확장/축소 버튼 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0 h-auto w-auto hover:bg-transparent -ml-2"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </Button>

          {/* 그룹 정보 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-1 flex-wrap">
              <Link2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              <h3 className="font-medium text-sm truncate">
                {group.masterInstitution.institution_name}
              </h3>
              <Badge variant="secondary" className="text-xs py-0 px-1 h-5 flex-shrink-0 ml-auto">
                <Users className="w-3 h-3 mr-0.5" />
                {group.members.length}
              </Badge>
            </div>

            {/* 그룹 통계 - 매칭된 기관이 있을 때만 표시 */}
            {matchRate > 0 && (
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 flex-wrap">
                <span className="flex items-center gap-0.5 flex-shrink-0">
                  <Package className="w-3 h-3" />
                  {group.totalEquipment}개
                </span>
                <span className="flex-shrink-0">
                  {shortenAddressSido(group.masterInstitution.sido)} {group.masterInstitution.gugun}
                </span>
                <span className="flex-shrink-0">
                  {matchRate}%
                </span>
              </div>
            )}

            {/* 신뢰도 표시 */}
            <div className="flex items-center gap-1 mt-1">
              <Badge
                variant="outline"
                className={cn("gap-0.5 text-xs py-0 px-1 h-5", getConfidenceColor(group.confidence))}
              >
                {getConfidenceIcon(group.confidence)}
                {Math.round(group.similarity * 100)}%
              </Badge>
              {group.confidence === 'low' && (
                <span className="text-xs text-red-600 dark:text-red-400">검증권장</span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      {/* 그룹 멤버 리스트 (확장 시) */}
      {isExpanded && (
        <CardContent className="pt-0 pb-2">
          {/* 전체 선택/해제 헤더 */}
          <div className="flex items-center gap-2 mb-2 px-1">
            <Checkbox
              checked={group.members.every(m => selectedMembers.has(m.target_key))}
              onCheckedChange={(checked) => {
                group.members.forEach(member => {
                  handleMemberSelect(member.target_key, checked as boolean);
                });
              }}
              className="mt-0"
              aria-label="Select all members in this group"
            />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              전체 선택
            </span>
          </div>

          <div className="space-y-1 mt-1">
            {[...group.members]
              .sort((a, b) => {
                const addressA = a.address || '';
                const addressB = b.address || '';
                return addressA.localeCompare(addressB, 'ko-KR');
              })
              .map((member) => {
                return (
              <div
                key={member.target_key}
                className={cn(
                  "flex items-start gap-2 p-1.5 px-1 rounded",
                  "hover:bg-gray-100 dark:hover:bg-gray-700/50",
                  selectedMembers.has(member.target_key) && "bg-blue-100 dark:bg-blue-900/20"
                )}
              >
                <Checkbox
                  checked={selectedMembers.has(member.target_key)}
                  onCheckedChange={(checked) =>
                    handleMemberSelect(member.target_key, checked as boolean)
                  }
                  className="mt-0.5"
                  aria-label={`Select ${member.institution_name}`}
                />

                <div className="flex-1 min-w-0 space-y-0.5">
                  {/* 기관명 */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="font-medium text-sm truncate">
                      {member.institution_name}
                    </span>
                  </div>

                  {/* sub_division / unique_key */}
                  <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground flex-wrap">
                    {isAmbulance(member) ? (
                      <>
                        <Badge className="border border-red-500 bg-transparent text-red-600 dark:text-red-400 text-xs py-0 px-1.5 h-5 flex-shrink-0">
                          119및 의료기관 구급차
                        </Badge>
                        {member.unique_key && (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded">
                            <span className="font-mono text-sm">
                              {member.unique_key}
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="truncate">{member.division}</span>
                        {member.unique_key && (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded">
                            <span className="font-mono text-sm">
                              {member.unique_key}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* 주소 */}
                  {member.address && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="truncate">{member.address}</span>
                    </div>
                  )}
                </div>
              </div>
            );
              })}
          </div>

          {/* 그룹 액션 버튼 */}
          <div className="flex items-center gap-1 mt-2 pt-2 border-t text-xs">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => {
                console.log('Search matching for group:', group.groupId);
              }}
            >
              그룹매칭
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => {
                console.log('Ungroup:', group.groupId);
              }}
            >
              해제
            </Button>
            {totalUnmatched > 0 && (
              <Badge variant="secondary" className="ml-auto text-xs py-0 px-1 h-5">
                {totalUnmatched}개
              </Badge>
            )}
          </div>
        </CardContent>
      )}
    </Card>
    </>
  );
}