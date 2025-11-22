'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  RefreshCw,
  AlertCircle,
  Info,
  ChevronDown,
  CheckSquare,
  Square,
  Package,
  Search
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
  const [searchTerm, setSearchTerm] = useState('');

  // 동적 마스터 기관 추적 (그룹ID -> 마스터 기관)
  const [dynamicMasters, setDynamicMasters] = useState<Map<string, TargetInstitution>>(new Map());

  // 스마트 마스터 기관 선정 함수
  const selectSmartMaster = useCallback((group: InstitutionGroup): TargetInstitution => {
    // 1. 동적으로 선택된 마스터가 있으면 우선 사용
    const dynamicMaster = dynamicMasters.get(group.groupId);
    if (dynamicMaster) {
      return dynamicMaster;
    }

    // 2. equipment_count가 가장 많은 기관
    const maxEquipmentCount = Math.max(...group.members.map(m => m.equipment_count || 0));
    if (maxEquipmentCount > 1) {
      const bestByEquipment = group.members.find(m => m.equipment_count === maxEquipmentCount);
      if (bestByEquipment) return bestByEquipment;
    }

    // 3. division이 본원/센터/본부인 기관
    const headquartersKeywords = ['본원', '센터', '본부', '대학병원', '대학교병원'];
    const bestByDivision = group.members.find(m => {
      const division = m.division || '';
      return headquartersKeywords.some(keyword => division.includes(keyword));
    });
    if (bestByDivision) return bestByDivision;

    // 4. sub_division이 없거나 짧은 기관 (본원일 가능성)
    const sortedBySubDivision = [...group.members].sort((a, b) => {
      const aSubDiv = a.sub_division || '';
      const bSubDiv = b.sub_division || '';
      if (!aSubDiv && bSubDiv) return -1;
      if (aSubDiv && !bSubDiv) return 1;
      return aSubDiv.length - bSubDiv.length;
    });
    if (sortedBySubDivision[0]) return sortedBySubDivision[0];

    // 5. 기관명에 특정 키워드가 포함된 기관
    const bestByName = group.members.find(m => {
      const name = m.institution_name || '';
      return headquartersKeywords.some(keyword => name.includes(keyword));
    });
    if (bestByName) return bestByName;

    // 6. 기본값: 그룹의 masterInstitution 또는 첫 번째 멤버
    return group.masterInstitution || group.members[0];
  }, [dynamicMasters]);

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
    // 선택된 멤버 업데이트
    setSelectedMembers(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(targetKey);
      } else {
        newSet.delete(targetKey);
      }
      return newSet;
    });

    // 선택된 멤버를 동적 마스터로 설정
    if (selected) {
      // 클릭한 멤버가 속한 그룹 찾기
      const group = groups.find(g =>
        g.members.some(m => m.target_key === targetKey)
      );

      if (group) {
        const clickedMember = group.members.find(m => m.target_key === targetKey);
        if (clickedMember) {
          // 해당 그룹의 동적 마스터로 설정
          setDynamicMasters(prev => {
            const newMap = new Map(prev);
            newMap.set(group.groupId, clickedMember);
            return newMap;
          });
        }
      }
    }

    // 선택된 기관들을 상위 컴포넌트로 전달
    if (onSelectionChange) {
      const selectedInstitutions: TargetInstitution[] = [];
      const processedGroups = new Set<string>();

      groups.forEach(group => {
        const groupMembers = group.members.filter(member => {
          if (selected && member.target_key === targetKey) return true;
          if (!selected && member.target_key === targetKey) return false;
          return selectedMembers.has(member.target_key);
        });

        if (groupMembers.length > 0) {
          // 이 그룹의 스마트 마스터 선정
          const master = selectSmartMaster(group);

          // 마스터가 선택된 멤버 중에 있는지 확인
          const masterIsSelected = groupMembers.some(m => m.target_key === master.target_key);

          if (masterIsSelected) {
            // 마스터를 첫 번째로 추가
            selectedInstitutions.push(master);
            processedGroups.add(master.target_key);

            // 나머지 멤버들 추가
            groupMembers.forEach(member => {
              if (member.target_key !== master.target_key) {
                selectedInstitutions.push(member);
              }
            });
          } else {
            // 마스터가 선택되지 않은 경우, 클릭한 멤버나 첫 번째 멤버를 우선
            const clickedMember = groupMembers.find(m => m.target_key === targetKey);
            if (clickedMember) {
              selectedInstitutions.push(clickedMember);
              groupMembers.forEach(member => {
                if (member.target_key !== clickedMember.target_key) {
                  selectedInstitutions.push(member);
                }
              });
            } else {
              groupMembers.forEach(member => selectedInstitutions.push(member));
            }
          }
        }
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
      setDynamicMasters(new Map()); // 동적 마스터 초기화
      // 선택 해제 시 상위 컴포넌트에 빈 배열 전달
      if (onSelectionChange) {
        onSelectionChange([]);
      }
    } else {
      // 전체 선택
      const newGroups = new Set<string>();
      const newMembers = new Set<string>();
      const selectedInstitutions: TargetInstitution[] = [];

      groups.forEach(group => {
        newGroups.add(group.groupId);

        // 각 그룹의 스마트 마스터 선정
        const master = selectSmartMaster(group);

        // 마스터를 먼저 추가 (중복 방지)
        if (!selectedInstitutions.find(inst => inst.target_key === master.target_key)) {
          selectedInstitutions.push(master);
        }

        // 나머지 멤버들 추가
        group.members.forEach(member => {
          newMembers.add(member.target_key);
          if (member.target_key !== master.target_key &&
              !selectedInstitutions.find(inst => inst.target_key === member.target_key)) {
            selectedInstitutions.push(member);
          }
        });
      });

      setSelectedGroups(newGroups);
      setSelectedMembers(newMembers);

      // 선택된 기관들을 상위 컴포넌트로 전달 (첫 번째가 추천에 사용됨)
      if (onSelectionChange) {
        onSelectionChange(selectedInstitutions);
      }
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

  // 검색어에 따라 필터링된 그룹 목록
  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) {
      return groups;
    }

    const lowerSearchTerm = searchTerm.toLowerCase();
    return groups.filter(group => {
      // 마스터 기관명 검색
      if (group.masterInstitution.institution_name.toLowerCase().includes(lowerSearchTerm)) {
        return true;
      }
      // 그룹 멤버의 기관명 검색
      return group.members.some(member =>
        member.institution_name.toLowerCase().includes(lowerSearchTerm)
      );
    });
  }, [groups, searchTerm]);

  // 선택된 지역 레이블 생성
  const locationLabel = useMemo(() => {
    if (gugun && gugun !== '전체') {
      return `${sido} ${gugun}`;
    } else if (sido && sido !== '전체') {
      return sido;
    }
    return '전체';
  }, [sido, gugun]);

  return (
    <Card className="w-full h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          {/* 기관명 검색 입력창 */}
          <div className="relative w-[150px] flex-shrink-0">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground h-3 w-3" />
            <Input
              placeholder="기관명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 h-8 text-xs"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={analyzeGroups}
            disabled={isLoading}
            className="text-xs h-7 px-2 flex-shrink-0"
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
          <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
              <div>
                {locationLabel} <span className="font-semibold text-gray-900 dark:text-white">{stats.totalInstitutions}개</span>의 의무설치기관 중 <span className="font-semibold text-blue-600 dark:text-blue-400">{stats.groupedInstitutions}개</span>를 <span className="font-semibold text-green-600 dark:text-green-400">{stats.groupCount}개 그룹</span>으로 분류했습니다. 구급차의 경우 별개 기관으로 구분하고 인트라넷과 각각 매칭해야 합니다. (단 소방은 일괄매칭 가능) 그루핑된 기관명을 확인 후, 같은 기관이 확실한 경우 그룹으로 묶어 우측의 인트라넷 장비와 일괄 매칭을 진행해주세요 나머지 <span className="font-semibold text-yellow-600 dark:text-yellow-400">{stats.potentialDuplicates}개</span> 기관은 일반 모드에서 수동으로 검토하며 매칭을 진행해야 합니다.
              </div>
            </div>
          </div>
        )}

        {/* 선택된 기관 수 및 추천 기준 표시 */}
        {selectedMembers.size > 0 && (
          <div className="space-y-2 mb-2">
            <div className="flex items-center gap-2 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded">
              <Package className="w-3 h-3 text-blue-600 dark:text-blue-300" />
              <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                {selectedMembers.size}개 기관 선택됨
              </span>
            </div>

            {/* 추천 기준 기관 표시 */}
            {(() => {
              // 현재 추천 기준이 되는 기관 찾기
              const firstSelectedGroup = groups.find(g =>
                g.members.some(m => selectedMembers.has(m.target_key))
              );

              if (firstSelectedGroup) {
                const master = selectSmartMaster(firstSelectedGroup);
                if (master && selectedMembers.has(master.target_key)) {
                  return (
                    <div className="flex items-center gap-2 px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded">
                      <Info className="w-3 h-3 text-green-600 dark:text-green-300" />
                      <span className="text-xs text-green-700 dark:text-green-300">
                        추천 기준: <span className="font-medium">{master.institution_name}</span>
                      </span>
                    </div>
                  );
                }
              }
              return null;
            })()}

            <div className="text-xs text-gray-500 dark:text-gray-400 px-2">
              💡 개별 기관을 클릭하면 해당 기관 기준으로 추천이 변경됩니다
            </div>
          </div>
        )}

        {/* 그룹 리스트 */}
        {filteredGroups.length > 0 && (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredGroups.map(group => (
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

        {/* 검색 결과 없음 */}
        {searchTerm && filteredGroups.length === 0 && groups.length > 0 && (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            '"{searchTerm}"'에 해당하는 기관이 없습니다.
          </div>
        )}

        {/* 그룹화되지 않은 기관 수 표시 */}
        {ungrouped.length > 0 && (
          <Alert className="mt-4 py-2 px-3">
            <Info className="h-3 w-3 flex-shrink-0" />
            <AlertDescription className="text-xs ml-2">
              유사 기관을 찾지 못한 {ungrouped.length}개 기관은 일반모드에서 개별적으로 매칭해야 합니다.
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