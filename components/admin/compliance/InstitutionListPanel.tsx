'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
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

interface InstitutionListPanelProps {
  year: string;
  sido?: string | null;
  gugun?: string | null;
  selectedInstitution: TargetInstitution | null;
  onSelect: (institution: TargetInstitution) => void;
  onStatsUpdate?: (stats: { total: number; matched: number; remaining: number }) => void;
  refreshTrigger?: number;
}

export default function InstitutionListPanel({
  year,
  sido,
  gugun,
  selectedInstitution,
  onSelect,
  onStatsUpdate,
  refreshTrigger
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

  // 의무설치기관 목록 조회
  useEffect(() => {
    fetchInstitutions();
  }, [year, sido, gugun, showOnlyUnmatched, subDivisionFilter, searchTerm, currentPage, refreshTrigger]);

  const fetchInstitutions = async () => {
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

      // 미매칭 필터 적용 (클라이언트 사이드)
      const filteredInstitutions = showOnlyUnmatched
        ? transformedInstitutions.filter(inst => inst.unmatched_count > 0)
        : transformedInstitutions;

      // sub_division은 이미 서버에서 필터링됨

      setInstitutions(filteredInstitutions);
      setTotalCount(data.totalCount === 'calculating' ? filteredInstitutions.length : (data.totalCount || filteredInstitutions.length));
      setTotalPages(data.totalPages || Math.ceil(filteredInstitutions.length / pageSize));

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
  };

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
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="전체">전체</SelectItem>
              <SelectItem value="119 및 의료기관 구급차">119 및 의료기관 구급차</SelectItem>
              <SelectItem value="경마장">경마장</SelectItem>
              <SelectItem value="경주장">경주장</SelectItem>
              <SelectItem value="공공의료기관">공공의료기관</SelectItem>
              <SelectItem value="공동주택(500세대 이상)">공동주택(500세대 이상)</SelectItem>
              <SelectItem value="공항">공항</SelectItem>
              <SelectItem value="관광단지">관광단지</SelectItem>
              <SelectItem value="관광지">관광지</SelectItem>
              <SelectItem value="교도소">교도소</SelectItem>
              <SelectItem value="상시근로자 300인이상">상시근로자 300인이상</SelectItem>
              <SelectItem value="선박(20톤이상)">선박(20톤이상)</SelectItem>
              <SelectItem value="시도 청사">시도 청사</SelectItem>
              <SelectItem value="어선">어선</SelectItem>
              <SelectItem value="여객자동차터미널">여객자동차터미널</SelectItem>
              <SelectItem value="여객항공기">여객항공기</SelectItem>
              <SelectItem value="운동장(5000석 이상)">운동장(5000석 이상)</SelectItem>
              <SelectItem value="중앙행정기관청사">중앙행정기관청사</SelectItem>
              <SelectItem value="지역보건의료기관">지역보건의료기관</SelectItem>
              <SelectItem value="철도역사 대합실">철도역사 대합실</SelectItem>
              <SelectItem value="철도차랑 객차">철도차랑 객차</SelectItem>
              <SelectItem value="카지노">카지노</SelectItem>
              <SelectItem value="항만대합실">항만대합실</SelectItem>
            </SelectContent>
          </Select>

          {/* 검색창 */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="기관명 검색..."
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
            {institutions.map((institution) => (
              <Card
                key={institution.target_key}
                className={cn(
                  "p-2 cursor-pointer transition-all",
                  selectedInstitution?.target_key === institution.target_key
                    ? "border-2 border-white bg-white/80 dark:bg-white/10"
                    : "hover:border-primary/50"
                )}
                onClick={() => onSelect(institution)}
              >
                <div className="space-y-1.5">
                  <div className={cn(
                    "font-medium text-sm",
                    selectedInstitution?.target_key === institution.target_key && "text-yellow-600 dark:text-yellow-400"
                  )}>
                    {institution.institution_name}
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {institution.sub_division && (
                      <Badge variant="outline" className="text-xs">
                        {institution.sub_division}
                      </Badge>
                    )}
                    {institution.unique_key && (
                      <Badge variant="secondary" className="text-xs">
                        고유키: {institution.unique_key}
                      </Badge>
                    )}
                    {!institution.unique_key && (() => {
                      // unique_key가 없는 경우 (2024년) target_key 마지막 번호 추출
                      const match = institution.target_key.match(/_(\d+)$/);
                      const number = match ? match[1] : null;
                      // 번호가 1이 아닌 경우에만 표시 (1은 기본값으로 간주)
                      return number && number !== '1' ? (
                        <Badge variant="secondary" className="text-xs">
                          #{number}
                        </Badge>
                      ) : null;
                    })()}
                  </div>
                  {institution.address ? (
                    // 2025년: address가 있으면 address만 표시 (sido/gugun은 데이터 오류가 있을 수 있음)
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      <span>{institution.address}</span>
                    </div>
                  ) : (
                    // 2024년: address가 없으면 sido/gugun 표시
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      <span>{institution.sido} {institution.gugun}</span>
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
            ))}
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
