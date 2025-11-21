'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  GitMerge,
  RefreshCw,
  AlertCircle,
  Info,
  ChevronDown,
  CheckSquare,
  Square,
  Package
} from 'lucide-react';
import InstitutionGroupCard from './InstitutionGroupCard';
import type { InstitutionGroup, TargetInstitution } from '@/lib/utils/institution-grouping';

interface InstitutionGroupingPanelProps {
  year: string;
  sido?: string | null;
  gugun?: string | null;
  onGroupsReady?: (groups: InstitutionGroup[]) => void;
  onSelectionChange?: (selectedInstitutions: TargetInstitution[]) => void;
}

export default function InstitutionGroupingPanel({
  year,
  sido,
  gugun,
  onGroupsReady,
  onSelectionChange
}: InstitutionGroupingPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [groups, setGroups] = useState<InstitutionGroup[]>([]);
  const [ungrouped, setUngrouped] = useState<TargetInstitution[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // 그룹핑 분석 실행
  const analyzeGroups = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setProgress(0);

    try {
      // 진행률 시뮬레이션
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/compliance/analyze-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          sido,
          gugun,
          threshold: 0.85
        })
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        console.error('API Response Error:', response.status, response.statusText);
        const errorData = await response.text();
        console.error('Error details:', errorData);
        throw new Error(`Failed to analyze groups: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      setGroups(data.groups || []);
      setUngrouped(data.ungrouped || []);
      setStats(data.stats);

      if (onGroupsReady) {
        onGroupsReady(data.groups || []);
      }

      // 완료 후 진행바 숨기기
      setTimeout(() => setProgress(0), 1000);

    } catch (err) {
      console.error('Error analyzing groups:', err);
      setError(err instanceof Error ? err.message : '그룹 분석 중 오류가 발생했습니다.');
      setProgress(0);
    } finally {
      setIsLoading(false);
    }
  }, [year, sido, gugun, onGroupsReady]);

  // 컴포넌트 마운트 시 자동으로 분석 실행
  useEffect(() => {
    analyzeGroups();
  }, [analyzeGroups]);

  // 그룹 선택 핸들러
  const handleGroupSelect = (groupId: string, selected: boolean) => {
    setSelectedGroups(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(groupId);
      } else {
        newSet.delete(groupId);
      }
      return newSet;
    });
  };

  // 멤버 선택 핸들러
  const handleMemberSelect = (targetKey: string, selected: boolean) => {
    setSelectedMembers(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(targetKey);
      } else {
        newSet.delete(targetKey);
      }
      return newSet;
    });

    // 선택된 기관들을 상위 컴포넌트로 전달
    if (onSelectionChange) {
      const selectedInstitutions: TargetInstitution[] = [];
      groups.forEach(group => {
        group.members.forEach(member => {
          if ((selected && member.target_key === targetKey) ||
              (!selected && member.target_key !== targetKey && selectedMembers.has(member.target_key))) {
            selectedInstitutions.push(member);
          }
        });
      });
      onSelectionChange(selectedInstitutions);
    }
  };

  // 전체 선택/해제
  const handleSelectAll = () => {
    const allSelected = groups.every(g => selectedGroups.has(g.groupId));

    if (allSelected) {
      // 전체 해제
      setSelectedGroups(new Set());
      setSelectedMembers(new Set());
    } else {
      // 전체 선택
      const newGroups = new Set<string>();
      const newMembers = new Set<string>();

      groups.forEach(group => {
        newGroups.add(group.groupId);
        group.members.forEach(member => {
          newMembers.add(member.target_key);
        });
      });

      setSelectedGroups(newGroups);
      setSelectedMembers(newMembers);
    }
  };

  // 높은 신뢰도 그룹만 선택
  const handleSelectHighConfidence = () => {
    const newGroups = new Set<string>();
    const newMembers = new Set<string>();

    groups
      .filter(g => g.confidence === 'high')
      .forEach(group => {
        newGroups.add(group.groupId);
        group.members.forEach(member => {
          newMembers.add(member.target_key);
        });
      });

    setSelectedGroups(newGroups);
    setSelectedMembers(newMembers);
  };

  return (
    <Card className="w-full h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitMerge className="w-5 h-5 text-blue-500" />
            <CardTitle className="text-base">중복 기관 그룹핑</CardTitle>
            {stats && (
              <Badge variant="secondary" className="text-xs">
                {stats.groupCount}개 그룹
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={analyzeGroups}
            disabled={isLoading}
            className="text-xs"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            재분석
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden flex flex-col">
        {/* 진행 상태 표시 */}
        {isLoading && progress > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
              <span>기관 분석 중...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 통계 정보 */}
        {stats && (
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-600">전체 기관</div>
              <div className="text-lg font-semibold">{stats.totalInstitutions}</div>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="text-xs text-blue-600">그룹화됨</div>
              <div className="text-lg font-semibold text-blue-700">
                {stats.groupedInstitutions}
              </div>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="text-xs text-green-600">그룹 수</div>
              <div className="text-lg font-semibold text-green-700">
                {stats.groupCount}
              </div>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <div className="text-xs text-yellow-600">잠재 중복</div>
              <div className="text-lg font-semibold text-yellow-700">
                {stats.potentialDuplicates}
              </div>
            </div>
          </div>
        )}

        {/* 액션 버튼 */}
        {groups.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="text-xs"
            >
              {groups.every(g => selectedGroups.has(g.groupId)) ? (
                <>
                  <Square className="w-3 h-3 mr-1" />
                  전체 해제
                </>
              ) : (
                <>
                  <CheckSquare className="w-3 h-3 mr-1" />
                  전체 선택
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectHighConfidence}
              className="text-xs"
            >
              높은 신뢰도만 선택
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={analyzeGroups}
              disabled={isLoading}
              className="text-xs"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              재분석
            </Button>

            <Badge variant="secondary" className="ml-auto text-xs">
              <Package className="w-3 h-3 mr-1" />
              {selectedMembers.size}개 기관 선택됨
            </Badge>
          </div>
        )}

        {/* 그룹 리스트 */}
        {groups.length > 0 && (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {groups.map(group => (
              <InstitutionGroupCard
                key={group.groupId}
                group={group}
                isSelected={selectedGroups.has(group.groupId)}
                selectedMembers={selectedMembers}
                onSelectGroup={handleGroupSelect}
                onSelectMember={handleMemberSelect}
                onViewDetails={(institution) => {
                  console.log('View details:', institution);
                }}
              />
            ))}
          </div>
        )}

        {/* 그룹화되지 않은 기관 수 표시 */}
        {ungrouped.length > 0 && (
          <Alert className="mt-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              {ungrouped.length}개의 기관은 유사 기관을 찾지 못했습니다.
              이들은 개별적으로 매칭해야 합니다.
            </AlertDescription>
          </Alert>
        )}

        {/* 일괄 매칭 버튼 */}
        {selectedMembers.size > 0 && (
          <div className="mt-4 pt-4 border-t">
            <Button
              className="w-full"
              onClick={() => {
                console.log('Batch match selected:', {
                  groups: Array.from(selectedGroups),
                  members: Array.from(selectedMembers)
                });
              }}
            >
              선택한 {selectedMembers.size}개 기관 일괄 매칭 시작
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}