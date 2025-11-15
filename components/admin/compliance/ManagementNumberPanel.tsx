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
  unique_key?: string; // 2025년 고유키
  address?: string; // 2025년 세부주소
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

// 고유키 매칭 유틸리티 함수
function extractValuesFromParentheses(text: string): string[] {
  const matches = text.match(/\(([^)]+)\)/g);
  if (!matches) return [];
  return matches.map(match => match.replace(/[()]/g, ''));
}

function hasUniqueKeyMatch(locationDetail: string, uniqueKey: string | undefined): boolean {
  if (!uniqueKey || !locationDetail) return false;

  // 1. 설치위치 텍스트에 직접 포함 여부
  if (locationDetail.includes(uniqueKey)) return true;

  // 2. 괄호 안의 값과 비교
  const valuesInParentheses = extractValuesFromParentheses(locationDetail);
  return valuesInParentheses.some(value => value === uniqueKey);
}

// 설치장소 텍스트에서 구급차/차량번호 강조
function highlightVehicleText(text: string): React.ReactNode {
  if (!text) return text;

  // 차량번호 패턴: 숫자+한글+숫자 (예: 12가3456, 123가4567)
  const vehicleNumberPattern = /\d{2,3}[가-힣]\d{4}/g;

  // 구급차, 특수구급차, 차량번호를 찾아서 강조
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // 먼저 구급차 관련 키워드 찾기
  const ambulancePattern = /(특수구급차|구급차)/g;
  const allMatches: Array<{ index: number; text: string; type: 'ambulance' | 'vehicle' }> = [];

  let match;
  while ((match = ambulancePattern.exec(text)) !== null) {
    allMatches.push({ index: match.index, text: match[0], type: 'ambulance' });
  }

  // 차량번호 패턴 찾기
  while ((match = vehicleNumberPattern.exec(text)) !== null) {
    allMatches.push({ index: match.index, text: match[0], type: 'vehicle' });
  }

  // 인덱스 순으로 정렬
  allMatches.sort((a, b) => a.index - b.index);

  // 중복 제거 (겹치는 영역이 있는 경우)
  const uniqueMatches: typeof allMatches = [];
  let lastEnd = -1;
  for (const m of allMatches) {
    if (m.index >= lastEnd) {
      uniqueMatches.push(m);
      lastEnd = m.index + m.text.length;
    }
  }

  // 텍스트 분할 및 강조
  uniqueMatches.forEach((m, idx) => {
    // 이전 매치와 현재 매치 사이의 일반 텍스트
    if (m.index > lastIndex) {
      parts.push(text.substring(lastIndex, m.index));
    }

    // 강조 텍스트
    parts.push(
      <span key={idx} className="font-bold text-white dark:text-white">
        {m.text}
      </span>
    );

    lastIndex = m.index + m.text.length;
  });

  // 남은 텍스트
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : text;
}

// 기관명에서 선택된 기관명과 매칭되는 부분 강조 (여러 키워드 모두 강조)
function highlightMatchingInstitutionName(institutionName: string, selectedName: string | undefined): React.ReactNode {
  if (!institutionName || !selectedName) return institutionName;

  // 먼저 전체 문자열 매칭 시도
  const fullIndex = institutionName.indexOf(selectedName);
  if (fullIndex !== -1) {
    const before = institutionName.substring(0, fullIndex);
    const matched = institutionName.substring(fullIndex, fullIndex + selectedName.length);
    const after = institutionName.substring(fullIndex + selectedName.length);
    return (
      <>
        {before}
        <span className="text-yellow-600 dark:text-yellow-400 font-semibold">{matched}</span>
        {after}
      </>
    );
  }

  // 전체 매칭이 안되면 키워드 단위로 분리하여 매칭
  const nameKeywords = selectedName
    .split(/[\s,]+/) // 공백과 쉼표로 분리
    .filter(k => k.length > 1); // 1글자 제외

  if (nameKeywords.length === 0) return institutionName;

  // 모든 매칭 위치 찾기
  const matches: Array<{ index: number; length: number; text: string }> = [];

  for (const keyword of nameKeywords) {
    let searchIndex = 0;
    while (true) {
      const index = institutionName.indexOf(keyword, searchIndex);
      if (index === -1) break;

      matches.push({
        index,
        length: keyword.length,
        text: keyword
      });

      searchIndex = index + keyword.length;
    }
  }

  if (matches.length === 0) return institutionName;

  // 인덱스 순으로 정렬
  matches.sort((a, b) => a.index - b.index);

  // 겹치는 매치 제거 (더 긴 매치 우선)
  const uniqueMatches: typeof matches = [];
  for (const match of matches) {
    const hasOverlap = uniqueMatches.some(
      existing =>
        (match.index >= existing.index && match.index < existing.index + existing.length) ||
        (match.index + match.length > existing.index && match.index + match.length <= existing.index + existing.length) ||
        (match.index <= existing.index && match.index + match.length >= existing.index + existing.length)
    );

    if (!hasOverlap) {
      uniqueMatches.push(match);
    } else {
      // 겹치는 경우 더 긴 것으로 교체
      const overlappingIndex = uniqueMatches.findIndex(
        existing =>
          (match.index >= existing.index && match.index < existing.index + existing.length) ||
          (match.index + match.length > existing.index && match.index + match.length <= existing.index + existing.length) ||
          (match.index <= existing.index && match.index + match.length >= existing.index + existing.length)
      );

      if (overlappingIndex !== -1 && match.length > uniqueMatches[overlappingIndex].length) {
        uniqueMatches[overlappingIndex] = match;
      }
    }
  }

  // 다시 정렬
  uniqueMatches.sort((a, b) => a.index - b.index);

  // 텍스트 분할 및 강조
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  uniqueMatches.forEach((match, idx) => {
    // 이전 매치와 현재 매치 사이의 일반 텍스트
    if (match.index > lastIndex) {
      parts.push(institutionName.substring(lastIndex, match.index));
    }

    // 강조 텍스트
    parts.push(
      <span key={idx} className="text-yellow-600 dark:text-yellow-400 font-semibold">
        {match.text}
      </span>
    );

    lastIndex = match.index + match.length;
  });

  // 남은 텍스트
  if (lastIndex < institutionName.length) {
    parts.push(institutionName.substring(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : institutionName;
}

// 주소에서 선택된 주소와 매칭되는 부분 강조 (여러 키워드 모두 강조)
function highlightMatchingAddress(address: string, selectedAddress: string | undefined): React.ReactNode {
  if (!address || !selectedAddress) return address;

  // 주소를 공백, 쉼표, 괄호 등으로 분리하여 개별 키워드 찾기
  const addressKeywords = selectedAddress
    .split(/[\s,]+/) // 공백과 쉼표로 분리
    .filter(k => k.length > 1); // 1글자 제외

  if (addressKeywords.length === 0) return address;

  // 모든 매칭 위치 찾기
  const matches: Array<{ index: number; length: number; text: string }> = [];

  for (const keyword of addressKeywords) {
    let searchIndex = 0;
    while (true) {
      const index = address.indexOf(keyword, searchIndex);
      if (index === -1) break;

      matches.push({
        index,
        length: keyword.length,
        text: keyword
      });

      searchIndex = index + keyword.length;
    }
  }

  // 괄호 안의 내용도 매칭 (예: (신천동))
  const parenMatch = selectedAddress.match(/\([^)]+\)/g);
  if (parenMatch) {
    for (const paren of parenMatch) {
      const index = address.indexOf(paren);
      if (index !== -1) {
        matches.push({
          index,
          length: paren.length,
          text: paren
        });
      }
    }
  }

  if (matches.length === 0) return address;

  // 인덱스 순으로 정렬
  matches.sort((a, b) => a.index - b.index);

  // 겹치는 매치 제거 (더 긴 매치 우선)
  const uniqueMatches: typeof matches = [];
  for (const match of matches) {
    const hasOverlap = uniqueMatches.some(
      existing =>
        (match.index >= existing.index && match.index < existing.index + existing.length) ||
        (match.index + match.length > existing.index && match.index + match.length <= existing.index + existing.length) ||
        (match.index <= existing.index && match.index + match.length >= existing.index + existing.length)
    );

    if (!hasOverlap) {
      uniqueMatches.push(match);
    } else {
      // 겹치는 경우 더 긴 것으로 교체
      const overlappingIndex = uniqueMatches.findIndex(
        existing =>
          (match.index >= existing.index && match.index < existing.index + existing.length) ||
          (match.index + match.length > existing.index && match.index + match.length <= existing.index + existing.length) ||
          (match.index <= existing.index && match.index + match.length >= existing.index + existing.length)
      );

      if (overlappingIndex !== -1 && match.length > uniqueMatches[overlappingIndex].length) {
        uniqueMatches[overlappingIndex] = match;
      }
    }
  }

  // 다시 정렬
  uniqueMatches.sort((a, b) => a.index - b.index);

  // 텍스트 분할 및 강조
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  uniqueMatches.forEach((match, idx) => {
    // 이전 매치와 현재 매치 사이의 일반 텍스트
    if (match.index > lastIndex) {
      parts.push(address.substring(lastIndex, match.index));
    }

    // 강조 텍스트
    parts.push(
      <span key={idx} className="text-yellow-600 dark:text-yellow-400 font-semibold">
        {match.text}
      </span>
    );

    lastIndex = match.index + match.length;
  });

  // 남은 텍스트
  if (lastIndex < address.length) {
    parts.push(address.substring(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : address;
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

  // 부분 매칭된 카드 및 고유키 매칭 카드 자동 펼치기
  useEffect(() => {
    const partiallyMatchedNumbers = basketedItems
      .filter(item => item.selected_serials && item.selected_serials.length > 0)
      .map(item => item.management_number);

    // 고유키 매칭된 관리번호 찾기
    const uniqueKey = selectedInstitution?.unique_key;
    const uniqueKeyMatchedNumbers = uniqueKey
      ? [...autoSuggestions, ...searchResults]
          .filter(item =>
            item.equipment_details?.some(detail =>
              hasUniqueKeyMatch(detail.location_detail, uniqueKey)
            )
          )
          .map(item => item.management_number)
      : [];

    const allNumbersToExpand = [...partiallyMatchedNumbers, ...uniqueKeyMatchedNumbers];

    if (allNumbersToExpand.length > 0) {
      setExpandedManagementNumbers(prev => {
        const newSet = new Set(prev);
        allNumbersToExpand.forEach(num => newSet.add(num));
        return newSet;
      });
    }
  }, [basketedItems, autoSuggestions, searchResults, selectedInstitution]);

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
      <div className="space-y-0.5">
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

          // 고유키 매칭 여부 확인
          const uniqueKey = selectedInstitution?.unique_key;
          const hasUniqueKeyInEquipment = uniqueKey && item.equipment_details?.some(detail =>
            hasUniqueKeyMatch(detail.location_detail, uniqueKey)
          );

          return (
            <Card
              key={item.management_number}
              className={cn(
                "p-2 transition-all",
                !item.is_matched && !isPartiallyMatched && !isFullyMatched && !hasUniqueKeyInEquipment && "bg-green-900/[0.06]",
                item.is_matched && "opacity-50 bg-muted",
                isPartiallyMatched && "border-2 border-amber-400 bg-amber-50/50 dark:bg-amber-950/20",
                isFullyMatched && "border-2 border-green-400 bg-green-50/50 dark:bg-green-950/20",
                hasUniqueKeyInEquipment && !isPartiallyMatched && !isFullyMatched && "border-2 border-purple-400 bg-purple-50/50 dark:bg-purple-950/20"
              )}
            >
              <div className="space-y-1.5">
                {/* 카드 클릭 가능 영역 (장비 목록 제외) */}
                <div
                  className="space-y-1.5"
                >
                  {/* 카드 상단 헤더 */}
                  <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium text-sm">
                      {highlightMatchingInstitutionName(item.institution_name, selectedInstitution?.institution_name)}
                    </div>
                    {hasUniqueKeyInEquipment && !isPartiallyMatched && !isFullyMatched && (
                      <Badge variant="outline" className="text-xs bg-purple-100 text-purple-800 border-purple-300">
                        고유키 일치
                      </Badge>
                    )}
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
                      className={cn(
                        "flex-shrink-0 bg-green-900/[0.06]",
                        item.equipment_count === 1 && item.confidence === 100 && "text-yellow-600 dark:text-yellow-400"
                      )}
                    >
                      {item.equipment_count === 1 ? '관리번호 담기' : '모든장비담기'}
                    </Button>
                  ) : item.is_matched ? (
                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                      이미 매칭됨
                    </Badge>
                  ) : null}
                </div>
                {/* 카드 상단 헤더 끝 */}

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
                  <span>{highlightMatchingAddress(item.address, selectedInstitution?.address)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    관리번호 {item.management_number}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {showConfidence && item.confidence && (
                      <Badge variant="secondary" className="text-xs bg-green-900/[0.06]">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        {item.confidence.toFixed(0)}%
                      </Badge>
                    )}
                    {isPartiallyMatched && (
                      <Badge variant="outline" className="text-xs">
                        관리번호 1개, 장비 {item.equipment_count}대중 {basketedSerials.length}대
                      </Badge>
                    )}
                  </div>
                </div>

                {/* 장비가 2대 이상인 경우 시각적 힌트 표시 */}
                {hasMultipleEquipment && remainingEquipmentCount > 0 && (
                  <div className="flex justify-center mt-2">
                    <div
                      className={cn(
                        "text-xs text-muted-foreground flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors",
                        item.confidence === 100 && "text-yellow-600 dark:text-yellow-400"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(item.management_number);
                      }}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3 w-3" />
                          일부만 보기
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3" />
                          모두 펼치기 ({isPartiallyMatched ? remainingEquipmentCount : item.equipment_count}대)
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* 클릭 가능 영역 끝 */}

              {/* 장비연번 목록 표시 (담기지 않은 장비만) - 펼침 상태에 따라 전체 또는 절반만 표시 */}
                {hasMultipleEquipment && item.equipment_details && (() => {
                  // 담기지 않은 장비연번만 필터링
                  const remainingEquipmentDetails = item.equipment_details.filter(
                    detail => !basketedSerials.includes(detail.serial)
                  );

                  // 접힌 상태일 때는 절반만, 펼쳐진 상태일 때는 전체 표시
                  const displayCount = isExpanded
                    ? remainingEquipmentDetails.length
                    : Math.ceil(remainingEquipmentDetails.length / 2);

                  const displayedEquipmentDetails = remainingEquipmentDetails.slice(0, displayCount);

                  return displayedEquipmentDetails.length > 0 ? (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        장비연번 목록 ({displayCount}/{remainingEquipmentDetails.length}개)
                      </div>
                      <div className="space-y-1.5">
                        {displayedEquipmentDetails.map((detail) => {
                          // 고유키 매칭 여부 확인
                          const isUniqueKeyMatched = uniqueKey && hasUniqueKeyMatch(detail.location_detail, uniqueKey);

                          return (
                            <div
                              key={detail.serial}
                              className={cn(
                                "flex items-start justify-between gap-2 p-2 rounded transition-colors",
                                !item.is_matched && "cursor-pointer hover:opacity-80",
                                isUniqueKeyMatched
                                  ? "bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700"
                                  : "bg-green-900/[0.06]"
                              )}
                              onClick={() => {
                                if (!item.is_matched) {
                                  onAddEquipmentSerial(item, detail.serial);
                                }
                              }}
                            >
                              <div className="flex-1 space-y-0.5">
                                <div className="text-xs font-mono font-medium">{detail.serial}</div>
                                {detail.location_detail && (
                                  <div className={cn(
                                    "text-xs",
                                    isUniqueKeyMatched ? "text-purple-700 dark:text-purple-300 font-medium" : "text-muted-foreground"
                                  )}>
                                    {highlightVehicleText(detail.location_detail)}
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
                          );
                        })}
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
    <div className="flex flex-col h-full overflow-hidden bg-green-900/[0.06]">
      {/* 필터 옵션 및 통합 검색창 - 상단 고정 */}
      <div className="flex-shrink-0 pb-2 border-b">
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
              className="pl-9 h-9"
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
