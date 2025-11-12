'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  // 의무설치기관 목록 조회
  useEffect(() => {
    fetchInstitutions();
  }, [year, sido, gugun, showOnlyUnmatched, searchTerm, currentPage, refreshTrigger]);

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

      const response = await fetch(`/api/compliance/check-optimized?${params}`);
      if (!response.ok) throw new Error('Failed to fetch institutions');

      const data = await response.json();

      // matches 배열을 TargetInstitution 형식으로 변환
      const transformedInstitutions: TargetInstitution[] = (data.matches || []).map((item: any) => {
        const target = item.targetInstitution;
        const isMatched = item.status === 'confirmed' || !item.requiresMatching;

        return {
          target_key: target.target_key,
          institution_name: target.institution_name,
          sido: target.sido,
          gugun: target.gugun || '',
          division: target.division || '',
          sub_division: target.sub_division || '',
          equipment_count: isMatched ? 1 : 0,
          matched_count: isMatched ? 1 : 0,
          unmatched_count: isMatched ? 0 : 1
        };
      });

      // 미매칭 필터 적용
      const filteredInstitutions = showOnlyUnmatched
        ? transformedInstitutions.filter(inst => inst.unmatched_count > 0)
        : transformedInstitutions;

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
      <div className="flex-shrink-0 bg-white dark:bg-gray-900 pb-3 border-b">
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
              미매칭만 표시
            </label>
          </div>

          {/* 검색창 */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="기관명 검색..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
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
          <div className="space-y-3 px-0.5">
            {institutions.map((institution) => (
              <Card
                key={institution.target_key}
                className={cn(
                  "p-2.5 cursor-pointer transition-all",
                  selectedInstitution?.target_key === institution.target_key
                    ? "border-2 border-white bg-white/80 dark:bg-white/10"
                    : "hover:border-primary/50"
                )}
                onClick={() => onSelect(institution)}
              >
                <div className="space-y-1.5">
                  <div className="font-medium text-sm">
                    {institution.institution_name}
                  </div>
                  <div className="flex items-center gap-1">
                    {institution.sub_division && (
                      <Badge variant="outline" className="text-xs">
                        {institution.sub_division}
                      </Badge>
                    )}
                    {(() => {
                      // target_key 마지막 번호 추출 (예: "대구_남구_119 및 의료기관 구급차_10" → "10")
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
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span>{institution.sido} {institution.gugun}</span>
                  </div>
                  {institution.address && (
                    <div className="text-xs text-muted-foreground pl-5">
                      {institution.address}
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
