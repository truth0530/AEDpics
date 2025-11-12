'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, MapPin, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EquipmentDetail {
  serial: string;
  location_detail: string;
}

interface ManagementNumberCandidate {
  management_number: string;
  institution_name: string;
  address: string;
  equipment_count: number;
  equipment_serials: string[];
  equipment_details: EquipmentDetail[];
  confidence: number | null;
  is_matched: boolean;
  matched_to: string | null;
  category_1?: string | null;
  category_2?: string | null;
}

interface TargetInstitution {
  target_key: string;
  institution_name: string;
  sido: string;
  gugun: string;
  division: string;
  sub_division: string;
  address?: string; // 2025년 세부주소 추가 예정
  equipment_count: number;
  matched_count: number;
  unmatched_count: number;
}

interface BasketItem {
  management_number: string;
  selected_serials?: string[];
}

interface ManagementNumberPanelProps {
  year: string;
  selectedInstitution: TargetInstitution | null;
  onAddToBasket: (item: ManagementNumberCandidate) => void;
  onAddMultipleToBasket: (items: ManagementNumberCandidate[]) => void;
  onAddEquipmentSerial: (item: ManagementNumberCandidate, serial: string) => void;
  basketedManagementNumbers?: string[];
  basketedItems?: BasketItem[];
}

export default function ManagementNumberPanel({
  year,
  selectedInstitution,
  onAddToBasket,
  onAddMultipleToBasket,
  onAddEquipmentSerial,
  basketedManagementNumbers = [],
  basketedItems = []
}: ManagementNumberPanelProps) {
  const [autoSuggestions, setAutoSuggestions] = useState<ManagementNumberCandidate[]>([]);
  const [searchResults, setSearchResults] = useState<ManagementNumberCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [includeAllRegion, setIncludeAllRegion] = useState(false);
  const [includeMatched, setIncludeMatched] = useState(false);
  // 펼쳐진 관리번호 Set (관리번호별 펼침/접힘 상태 관리)
  const [expandedManagementNumbers, setExpandedManagementNumbers] = useState<Set<string>>(new Set());

  // 선택된 기관이 변경될 때 초기 설정
  useEffect(() => {
    if (selectedInstitution) {
      setSearchTerm('');
      // 매칭된 기관인 경우 "매칭된 항목 표시" 자동 체크, 미매칭 기관은 체크 해제
      if (selectedInstitution.matched_count > 0) {
        setIncludeMatched(true);
      } else {
        setIncludeMatched(false);
      }
    }
  }, [selectedInstitution]);

  // 선택된 기관이 변경되거나 필터 옵션이 변경되면 데이터 조회
  useEffect(() => {
    fetchCandidates();
  }, [selectedInstitution, includeAllRegion, includeMatched]);

  // 검색어 변경 시 검색 실행 (디바운싱)
  useEffect(() => {
    if (searchTerm) {
      const timer = setTimeout(() => {
        fetchCandidates();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchTerm]);

  // 부분 매칭된 카드 자동 펼치기
  useEffect(() => {
    const partiallyMatchedNumbers = basketedItems
      .filter(item => item.selected_serials && item.selected_serials.length > 0)
      .map(item => item.management_number);

    if (partiallyMatchedNumbers.length > 0) {
      setExpandedManagementNumbers(prev => {
        const newSet = new Set(prev);
        partiallyMatchedNumbers.forEach(num => newSet.add(num));
        return newSet;
      });
    }
  }, [basketedItems]);

  const fetchCandidates = async () => {

    setLoading(true);
    try {
      const params = new URLSearchParams({
        year,
        include_all_region: includeAllRegion.toString(),
        include_matched: includeMatched.toString()
      });

      // 의무설치기관이 선택된 경우에만 target_key 추가
      if (selectedInstitution) {
        params.append('target_key', selectedInstitution.target_key);
      }

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await fetch(`/api/compliance/management-number-candidates?${params}`);
      if (!response.ok) throw new Error('Failed to fetch candidates');

      const data = await response.json();
      setAutoSuggestions(data.auto_suggestions || []);
      setSearchResults(data.search_results || []);
    } catch (error) {
      console.error('Failed to fetch candidates:', error);
    } finally {
      setLoading(false);
    }
  };

  // 관리번호별 펼치기/접기 토글
  const toggleExpanded = (managementNumber: string) => {
    setExpandedManagementNumbers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(managementNumber)) {
        newSet.delete(managementNumber);
      } else {
        newSet.add(managementNumber);
      }
      return newSet;
    });
  };

  const renderCandidateList = (items: ManagementNumberCandidate[], showConfidence: boolean) => {
    // 완전 매칭된 항목만 필터링 (부분 매칭은 유지)
    const filteredItems = items.filter(item => {
      const basketItem = basketedItems.find(b => b.management_number === item.management_number);

      // 개별 장비가 모두 담긴 경우도 완전 매칭으로 취급
      const isFullyMatchedByIndividual = basketItem &&
        basketItem.selected_serials &&
        basketItem.selected_serials.length === item.equipment_count;

      const isPartiallyMatched = basketItem &&
        basketItem.selected_serials &&
        basketItem.selected_serials.length > 0 &&
        basketItem.selected_serials.length < item.equipment_count;

      const isFullyMatched = (basketedManagementNumbers.includes(item.management_number) && !basketItem?.selected_serials) || isFullyMatchedByIndividual;

      // 완전 매칭된 항목만 제외, 부분 매칭은 표시
      return !isFullyMatched;
    });

    if (filteredItems.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground text-sm space-y-2">
          {searchTerm ? (
            <>
              <div className="font-medium">검색 결과가 없습니다</div>
              <div className="text-xs">다른 검색어를 입력하거나 필터 옵션을 변경해보세요</div>
            </>
          ) : (
            <>
              <div className="font-medium">매칭 가능한 관리번호가 없습니다</div>
              <div className="text-xs space-y-1">
                <div>• 선택한 지역에 등록된 AED 장비가 없거나</div>
                <div>• 모든 장비가 이미 다른 기관과 매칭되었습니다</div>
                <div className="pt-2 text-muted-foreground/80">
                  "전지역 조회"를 체크하거나 검색창을 이용해보세요
                </div>
              </div>
            </>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {filteredItems.map((item) => {
          const isExpanded = expandedManagementNumbers.has(item.management_number);
          const hasMultipleEquipment = item.equipment_count > 1;

          // 부분 매칭 여부 확인
          const basketItem = basketedItems.find(b => b.management_number === item.management_number);

          // 개별 장비가 모두 담긴 경우도 완전 매칭으로 취급
          const isFullyMatchedByIndividual = basketItem &&
            basketItem.selected_serials &&
            basketItem.selected_serials.length === item.equipment_count;

          const isPartiallyMatched = basketItem &&
            basketItem.selected_serials &&
            basketItem.selected_serials.length > 0 &&
            basketItem.selected_serials.length < item.equipment_count;

          const isFullyMatched = (basketedManagementNumbers.includes(item.management_number) && !basketItem?.selected_serials) || isFullyMatchedByIndividual;

          // 이미 담긴 장비연번 목록
          const basketedSerials = basketItem?.selected_serials || [];

          // 남은 장비 개수 (담기지 않은 장비)
          const remainingEquipmentCount = item.equipment_count - basketedSerials.length;

          return (
            <Card
              key={item.management_number}
              className={cn(
                "p-2.5 transition-all",
                hasMultipleEquipment && remainingEquipmentCount > 0 && "cursor-pointer hover:shadow-md",
                item.is_matched && "opacity-50 bg-muted",
                isPartiallyMatched && "border-2 border-amber-400 bg-amber-50/50 dark:bg-amber-950/20",
                isFullyMatched && "border-2 border-green-400 bg-green-50/50 dark:bg-green-950/20"
              )}
              onClick={() => hasMultipleEquipment && remainingEquipmentCount > 0 && toggleExpanded(item.management_number)}
            >
              <div className="space-y-1.5">
                {/* 카드 상단 영역 */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-sm">
                      {item.institution_name}
                    </div>
                    {isPartiallyMatched && (
                      <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300">
                        부분 매칭
                      </Badge>
                    )}
                    {isFullyMatched && (
                      <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">
                        전체 담김
                      </Badge>
                    )}
                  </div>
                  {!item.is_matched && !isPartiallyMatched && !isFullyMatched ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation(); // 카드 클릭 이벤트 전파 방지
                        onAddToBasket(item);
                      }}
                      className="flex-shrink-0"
                    >
                      모든장비매칭
                    </Button>
                  ) : item.is_matched ? (
                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                      이미 매칭됨
                    </Badge>
                  ) : null}
                </div>
                {/* 카드 상단 영역 끝 */}
                {(item.category_1 || item.category_2) && (
                  <div className="flex items-center gap-1">
                    {item.category_1 && (
                      <Badge
                        variant={item.category_1 === '구비의무기관외' ? 'destructive' : 'outline'}
                        className="text-xs"
                      >
                        {item.category_1 === '구비의무기관' ? '의무' : item.category_1}
                      </Badge>
                    )}
                    {item.category_2 && (
                      <Badge
                        variant={item.category_2 === '구비의무기관외' ? 'destructive' : 'outline'}
                        className="text-xs"
                      >
                        {item.category_2 === '구비의무기관' ? '의무' : item.category_2}
                      </Badge>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  <span>{item.address}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    {item.management_number}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {showConfidence && item.confidence && (
                      <Badge variant="secondary" className="text-xs">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        {item.confidence.toFixed(0)}%
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      장비 {isPartiallyMatched ? remainingEquipmentCount : item.equipment_count}대
                    </Badge>
                  </div>
                </div>

                {/* 장비가 2대 이상인 경우 시각적 힌트 표시 */}
                {hasMultipleEquipment && remainingEquipmentCount > 0 && (
                  <div className="flex justify-center mt-2">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3 w-3" />
                          장비 {isPartiallyMatched ? remainingEquipmentCount : item.equipment_count}대 접기
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3" />
                          장비 {isPartiallyMatched ? remainingEquipmentCount : item.equipment_count}대 펼치기
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* 펼쳐진 경우 장비연번 목록 표시 (담기지 않은 장비만) */}
                {isExpanded && hasMultipleEquipment && item.equipment_details && (() => {
                  // 담기지 않은 장비연번만 필터링
                  const remainingEquipmentDetails = item.equipment_details.filter(
                    detail => !basketedSerials.includes(detail.serial)
                  );

                  return remainingEquipmentDetails.length > 0 ? (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        장비연번 목록 ({remainingEquipmentDetails.length}개)
                      </div>
                      <div className="space-y-1.5">
                        {remainingEquipmentDetails.map((detail) => (
                          <div
                            key={detail.serial}
                            className="flex items-start justify-between gap-2 p-2 bg-muted/50 rounded"
                          >
                            <div className="flex-1 space-y-0.5">
                              <div className="text-xs font-mono font-medium">{detail.serial}</div>
                              {detail.location_detail && (
                                <div className="text-xs text-muted-foreground">
                                  {detail.location_detail}
                                </div>
                              )}
                            </div>
                            {!item.is_matched && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-auto text-xs px-2 py-1 flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation(); // 카드 클릭 이벤트 전파 방지
                                  onAddEquipmentSerial(item, detail.serial);
                                }}
                              >
                                단독매칭
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  // 표시할 데이터 결정
  const displayItems = searchTerm ? searchResults : autoSuggestions;
  const showConfidence = !searchTerm && !!selectedInstitution; // 자동 추천일 때만 신뢰도 표시
  const displayCount = displayItems.filter(
    item => !basketedManagementNumbers.includes(item.management_number)
  ).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 필터 옵션 및 통합 검색창 - 상단 고정 */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-900 pb-3 border-b mb-3">
        <div className="flex items-center gap-3">
          {/* 필터 옵션 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-all-region"
                checked={includeAllRegion}
                onCheckedChange={(checked) => setIncludeAllRegion(checked === true)}
              />
              <label
                htmlFor="include-all-region"
                className="text-sm font-medium leading-none whitespace-nowrap"
              >
                전지역 조회
              </label>
            </div>
            {/* 매칭된 기관을 선택한 경우에만 표시 */}
            {selectedInstitution && selectedInstitution.matched_count > 0 && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-matched"
                  checked={includeMatched}
                  onCheckedChange={(checked) => setIncludeMatched(checked === true)}
                />
                <label
                  htmlFor="include-matched"
                  className="text-sm font-medium leading-none whitespace-nowrap"
                >
                  매칭된 항목 표시
                </label>
              </div>
            )}
          </div>

          {/* 검색창 */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="기관명, 주소, 관리번호로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* 관리번호 리스트 */}
      <div className="flex-1 overflow-auto">
        {!selectedInstitution ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground text-sm">
              좌측의 의무설치기관을 선택하면<br />
              추천 관리번호 리스트가 표시됩니다
            </div>
          </div>
        ) : loading ? (
          <div className="text-center py-8 text-muted-foreground">
            로딩 중...
          </div>
        ) : (
          renderCandidateList(displayItems, showConfidence)
        )}
      </div>
    </div>
  );
}
