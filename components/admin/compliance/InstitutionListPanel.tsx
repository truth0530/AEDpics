'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, MapPin, ChevronLeft, ChevronRight, GitCompare, CornerRightDown, CornerLeftUp, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { shortenAddressSido } from '@/lib/constants/regions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  institution_name: string;
  equipment_count: number;
  equipment_serials: string[];
  equipment_details?: { serial: string; location_detail: string }[];
  selected_serials?: string[];
}

interface InstitutionListPanelProps {
  year: string;
  sido?: string | null;
  gugun?: string | null;
  selectedInstitution: TargetInstitution | null;
  onSelect: (institution: TargetInstitution) => void;
  onStatsUpdate?: (stats: { total: number; matched: number; remaining: number }) => void;
  refreshTrigger?: number;
  hasPartialMatch?: boolean;
  hasFullMatch?: boolean;
  partialMatchCount?: number;
  fullMatchCount?: number;
  basket?: BasketItem[];
  hasUniqueKeyInBasket?: boolean;
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
        {before && <span className="text-gray-400 dark:text-gray-500">{before}</span>}
        <span className="text-blue-600 dark:text-blue-400">{matched}</span>
        {after && <span className="text-gray-400 dark:text-gray-500">{after}</span>}
      </>
    );
  }

  // 전체 매칭이 안되면 키워드 단위로 분리하여 매칭
  // 공백이나 쉼표가 있으면 그것으로 분리, 없으면 3글자 이상의 공통 부분 문자열 찾기
  let nameKeywords = selectedName.split(/[\s,]+/).filter(k => k.length > 1);

  // 공백이 없어서 키워드가 하나뿐이고 너무 길면, 3글자 이상의 부분 문자열로 분리
  if (nameKeywords.length === 1 && nameKeywords[0].length > 10) {
    const longKeyword = nameKeywords[0];
    const subKeywords: string[] = [];

    // 3글자부터 시작해서 점점 길게 부분 문자열 생성
    for (let len = 3; len <= Math.min(longKeyword.length, 15); len++) {
      for (let i = 0; i <= longKeyword.length - len; i++) {
        const sub = longKeyword.substring(i, i + len);
        if (institutionName.includes(sub) && !subKeywords.includes(sub)) {
          subKeywords.push(sub);
        }
      }
    }

    // 가장 긴 매칭 키워드들만 사용 (겹치지 않도록)
    if (subKeywords.length > 0) {
      nameKeywords = subKeywords.sort((a, b) => b.length - a.length).slice(0, 5);
    }
  }

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
      const normalText = institutionName.substring(lastIndex, match.index);
      parts.push(
        <span key={`normal-${idx}`} className="text-gray-400 dark:text-gray-500">
          {normalText}
        </span>
      );
    }

    // 강조 텍스트
    parts.push(
      <span key={`highlight-${idx}`} className="text-blue-600 dark:text-blue-400">
        {match.text}
      </span>
    );

    lastIndex = match.index + match.length;
  });

  // 남은 텍스트
  if (lastIndex < institutionName.length) {
    const remainingText = institutionName.substring(lastIndex);
    parts.push(
      <span key="remaining" className="text-gray-400 dark:text-gray-500">
        {remainingText}
      </span>
    );
  }

  return parts.length > 0 ? <>{parts}</> : institutionName;
}

// 주소에서 선택된 주소와 매칭되는 부분 강조 (여러 키워드 모두 강조)
function highlightMatchingAddress(
  address: string,
  selectedAddress: string | undefined
): React.ReactNode {
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

    // 강조 텍스트 (파랑색)
    parts.push(
      <span key={idx} className="font-semibold text-blue-600 dark:text-blue-400">
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

export default function InstitutionListPanel({
  year,
  sido,
  gugun,
  selectedInstitution,
  onSelect,
  onStatsUpdate,
  refreshTrigger,
  hasPartialMatch = false,
  hasFullMatch = false,
  partialMatchCount = 0,
  fullMatchCount = 0,
  basket = [],
  hasUniqueKeyInBasket = false
}: InstitutionListPanelProps) {
  const [institutions, setInstitutions] = useState<TargetInstitution[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyUnmatched, setShowOnlyUnmatched] = useState(true);
  const [subDivisionFilter, setSubDivisionFilter] = useState<string>('전체');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  const fetchInstitutions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year,
        page: currentPage.toString(),
        limit: pageSize.toString()
      });

      if (sido) params.append('sido', sido);
      if (gugun) params.append('gugun', gugun);
      if (searchTerm) params.append('search', searchTerm);
      if (subDivisionFilter !== '전체') {
        params.append('sub_division', subDivisionFilter);
        console.log('[InstitutionListPanel] Filtering by sub_division:', subDivisionFilter);
      }

      // 미매칭 필터를 API에 전달 (서버사이드 필터링)
      params.append('showOnlyUnmatched', showOnlyUnmatched.toString());

      console.log('[InstitutionListPanel] API params:', params.toString());
      const response = await fetch(`/api/compliance/check-optimized?${params}`);
      if (!response.ok) throw new Error('Failed to fetch institutions');

      const data = await response.json();

      // matches 배열을 TargetInstitution 형식으로 변환
      const transformedInstitutions: TargetInstitution[] = (data.matches || []).map((item: any) => {
        const target = item.targetInstitution;
        const isMatched = item.status === 'confirmed';
        const requiresMatching = item.requiresMatching !== false; // 매칭이 필요한 경우

        return {
          target_key: target.target_key,
          institution_name: target.institution_name,
          sido: target.sido,
          gugun: target.gugun || '',
          division: target.division || '',
          sub_division: target.sub_division || '',
          unique_key: target.unique_key || undefined,
          address: target.address || undefined,
          equipment_count: requiresMatching ? 1 : 0,
          matched_count: isMatched ? 1 : 0,
          unmatched_count: requiresMatching && !isMatched ? 1 : 0
        };
      });

      // 필터링은 서버에서 처리됨 (showOnlyUnmatched 파라미터)
      setInstitutions(transformedInstitutions);
      setTotalCount(data.totalCount === 'calculating' ? transformedInstitutions.length : (data.totalCount || transformedInstitutions.length));
      setTotalPages(data.totalPages || Math.ceil(transformedInstitutions.length / pageSize));

      // Stats 업데이트
      if (onStatsUpdate) {
        const matched = transformedInstitutions.reduce((sum, inst) => sum + inst.matched_count, 0);
        const total = transformedInstitutions.reduce((sum, inst) => sum + inst.equipment_count, 0);
        onStatsUpdate({
          total,
          matched,
          remaining: total - matched
        });
      }
    } catch (error) {
      console.error('Failed to fetch institutions:', error);
    } finally {
      setLoading(false);
    }
  }, [year, currentPage, sido, gugun, searchTerm, subDivisionFilter, showOnlyUnmatched, onStatsUpdate]);

  // 의무설치기관 목록 조회
  useEffect(() => {
    fetchInstitutions();
  }, [fetchInstitutions, refreshTrigger]);

  // 매칭 완료/취소 이벤트 수신하여 목록 새로고침
  useEffect(() => {
    const handleMatchCompleted = () => {
      console.log('[InstitutionListPanel] Match completed/cancelled, refreshing list...');
      fetchInstitutions();
    };

    window.addEventListener('matchCompleted', handleMatchCompleted);
    return () => {
      window.removeEventListener('matchCompleted', handleMatchCompleted);
    };
  }, [fetchInstitutions]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page on search
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 검색 및 필터 - 상단 고정 */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-900 pb-2 border-b">
        <div className="flex items-center gap-3">
          {/* 필터 옵션 */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-unmatched"
              checked={showOnlyUnmatched}
              onCheckedChange={(checked) => {
                setShowOnlyUnmatched(checked === true);
                setCurrentPage(1);
              }}
            />
            <label
              htmlFor="show-unmatched"
              className="text-sm font-medium leading-none whitespace-nowrap"
            >
              미매칭만
            </label>
          </div>

          {/* 의무기관 종류 선택 */}
          <Select value={subDivisionFilter} onValueChange={(value) => {
            setSubDivisionFilter(value);
            setCurrentPage(1);
          }}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="전체">전체</SelectItem>
              <SelectItem value="119및 의료기관 구급차">119및 의료기관 구급차</SelectItem>
              <SelectItem value="20톤이상 선박">20톤이상 선박</SelectItem>
              <SelectItem value="300명이상 사업장">300명이상 사업장</SelectItem>
              <SelectItem value="500세대 이상 공동주택">500세대 이상 공동주택</SelectItem>
              <SelectItem value="경마장">경마장</SelectItem>
              <SelectItem value="경주장">경주장</SelectItem>
              <SelectItem value="공공의료기관">공공의료기관</SelectItem>
              <SelectItem value="공항">공항</SelectItem>
              <SelectItem value="관광단지">관광단지</SelectItem>
              <SelectItem value="관광지">관광지</SelectItem>
              <SelectItem value="교도소등">교도소등</SelectItem>
              <SelectItem value="시도청사">시도청사</SelectItem>
              <SelectItem value="어선">어선</SelectItem>
              <SelectItem value="여객자동차터미널">여객자동차터미널</SelectItem>
              <SelectItem value="여객항공기">여객항공기</SelectItem>
              <SelectItem value="운동장">운동장</SelectItem>
              <SelectItem value="중앙행정기관청사">중앙행정기관청사</SelectItem>
              <SelectItem value="지역보건의료기관">지역보건의료기관</SelectItem>
              <SelectItem value="철도역사대합실">철도역사대합실</SelectItem>
              <SelectItem value="철도차량객차">철도차량객차</SelectItem>
              <SelectItem value="카지노">카지노</SelectItem>
              <SelectItem value="항만대합실">항만대합실</SelectItem>
            </SelectContent>
          </Select>

          {/* 검색창 */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="통합검색..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>
      </div>

      {/* 기관 리스트 */}
      <div className="flex-1 overflow-auto py-3">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            로딩 중...
          </div>
        ) : institutions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            의무설치기관이 없습니다
          </div>
        ) : (
          <div className="space-y-0.5 px-0.5">
            {institutions.map((institution) => {
              // 현재 선택된 기관인지 확인
              const isSelected = selectedInstitution?.target_key === institution.target_key;
              // basket에 항목이 있는지 확인
              const hasBasketItems = isSelected && basket.length > 0;
              return (
                <div key={institution.target_key} className="space-y-2">
                  <Card
                    className={cn(
                      "p-2 cursor-pointer transition-all",
                      isSelected
                        ? hasBasketItems
                          ? "border-2 border-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                          : "border-2 border-white bg-white/80 dark:bg-white/10"
                        : "hover:border-primary/50"
                    )}
                    onClick={() => onSelect(institution)}
                  >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-medium text-sm">
                            {isSelected && selectedInstitution
                              ? highlightMatchingInstitutionName(institution.institution_name, selectedInstitution.institution_name)
                              : institution.institution_name
                            }
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground flex-wrap">
                          {institution.sub_division && (
                            <span>
                              {institution.sub_division}
                            </span>
                          )}
                          {institution.unique_key && (() => {
                            // unique_key 매칭 확인: 선택된 기관의 basket에 unique_key가 포함된 경우에만 보라색
                            const isCurrentInstitution = selectedInstitution?.target_key === institution.target_key;
                            const hasUniqueKeyMatch = isCurrentInstitution && hasUniqueKeyInBasket;

                            return (
                              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${hasUniqueKeyMatch ? 'border border-purple-400 dark:border-purple-500' : ''}`}>
                                <Hash className="w-3 h-3 text-muted-foreground" />
                                <span className="font-mono text-sm">
                                  {institution.unique_key}
                                </span>
                              </div>
                            );
                          })()}
                          {!institution.unique_key && (() => {
                            // unique_key가 없는 경우 (2024년) target_key 마지막 번호 추출
                            const match = institution.target_key.match(/_(\d+)$/);
                            const number = match ? match[1] : null;
                            // 번호가 1이 아닌 경우에만 표시 (1은 기본값으로 간주)
                            return number && number !== '1' ? (
                              <span>
                                #{number}
                              </span>
                            ) : null;
                          })()}
                        </div>
                        {institution.address ? (
                          // 2025년: address가 있으면 address만 표시 (sido/gugun은 데이터 오류가 있을 수 있음)
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span>
                              {isSelected && selectedInstitution
                                ? highlightMatchingAddress(shortenAddressSido(institution.address), selectedInstitution.address)
                                : shortenAddressSido(institution.address)
                              }
                            </span>
                          </div>
                        ) : (
                          // 2024년: address가 없으면 sido/gugun 표시
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span>{shortenAddressSido(`${institution.sido} ${institution.gugun}`)}</span>
                          </div>
                        )}
                        {!showOnlyUnmatched && (
                          <div className="flex items-center justify-end gap-2">
                            {institution.matched_count > 0 && (
                              <Badge variant="secondary" className="text-xs flex-shrink-0">
                                매칭완료
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </Card>

                    {/* 매칭 순환 아이콘 */}
                    {hasBasketItems && (
                      <div className="flex my-1">
                        {/* 좌측 1/3 지점 */}
                        <div className="flex-1 flex justify-center items-center">
                          <div className={cn(
                            "rounded-full p-1",
                            hasPartialMatch ? "bg-amber-50 dark:bg-amber-900/20" : "bg-green-50 dark:bg-green-900/20"
                          )}>
                            <CornerLeftUp className={cn(
                              "h-3.5 w-3.5",
                              hasPartialMatch ? "text-amber-500 dark:text-amber-400" : "text-green-500 dark:text-green-400"
                            )} />
                          </div>
                        </div>

                        {/* 중앙 빈 공간 */}
                        <div className="flex-1" />

                        {/* 우측 2/3 지점 */}
                        <div className="flex-1 flex justify-center items-center">
                          <div className={cn(
                            "rounded-full p-1",
                            hasPartialMatch ? "bg-amber-50 dark:bg-amber-900/20" : "bg-green-50 dark:bg-green-900/20"
                          )}>
                            <CornerRightDown className={cn(
                              "h-3.5 w-3.5",
                              hasPartialMatch ? "text-amber-500 dark:text-amber-400" : "text-green-500 dark:text-green-400"
                            )} />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 선택된 기관이고 basket에 항목이 있을 때 매칭 요약 정보 표시 - 별도 테두리 */}
                    {hasBasketItems && (() => {
                      // 총 장비 대수 계산
                      const totalEquipment = basket.reduce((sum, item) => {
                        const count = item.selected_serials?.length || item.equipment_count;
                        return sum + count;
                      }, 0);

                      return (
                        <div className={cn(
                          "rounded-lg p-2.5 border",
                          hasPartialMatch
                            ? "bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-amber-400 dark:border-amber-400"
                            : "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-300 dark:border-green-700"
                        )}>
                          {/* 헤더 */}
                          <div className="text-xs font-medium mb-1.5 text-muted-foreground">
                            매칭대기중 {basket.length}개 관리번호 {totalEquipment}대
                          </div>
                          {/* 항목 리스트 */}
                          <div className="space-y-1.5">
                            {basket.map((item) => {
                              const equipmentCount = item.selected_serials?.length || item.equipment_count;
                              const hasSerials = item.selected_serials && item.selected_serials.length > 0;

                              return (
                                <div key={item.management_number} className="flex items-center gap-2 flex-wrap">
                                  {/* 관리번호와 기관명 */}
                                  <div className="text-xs leading-tight font-medium">
                                    {highlightMatchingInstitutionName(item.institution_name, institution.institution_name)} {equipmentCount}대
                                  </div>

                                  {/* 선택된 장비연번 표시 (부분매칭 시) - 우측에 나란히 */}
                                  {hasSerials && (
                                    <>
                                      {item.selected_serials!.map((serial) => {
                                        // 고유키 매칭 확인: equipment_details에서 해당 serial의 location_detail 찾기
                                        const uniqueKey = selectedInstitution?.unique_key;
                                        const equipmentDetail = item.equipment_details?.find(d => d.serial === serial);
                                        const isUniqueKeyMatched = uniqueKey && equipmentDetail?.location_detail
                                          ? equipmentDetail.location_detail.includes(uniqueKey)
                                          : false;

                                        return (
                                          <div
                                            key={serial}
                                            className={cn(
                                              "flex items-center gap-1 px-1.5 py-0.5 rounded text-xs",
                                              isUniqueKeyMatched
                                                ? "bg-purple-100 dark:bg-purple-900/30 border border-purple-400 dark:border-purple-500 text-purple-700 dark:text-purple-300 font-medium"
                                                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                                            )}
                                          >
                                            <span className="font-mono">
                                              {isUniqueKeyMatched ? `${uniqueKey} | ${serial}` : serial}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
      </div>

      {/* 페이지네이션 - 하단 고정 */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 bg-white dark:bg-gray-900 pt-3 mt-3 border-t">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1 || loading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              이전
            </Button>
            <span className="text-sm text-muted-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || loading}
            >
              다음
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
