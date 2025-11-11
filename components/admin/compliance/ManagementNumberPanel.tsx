'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, MapPin, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ManagementNumberCandidate {
  management_number: string;
  institution_name: string;
  address: string;
  equipment_count: number;
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
}

interface ManagementNumberPanelProps {
  year: string;
  selectedInstitution: TargetInstitution | null;
  onAddToBasket: (item: ManagementNumberCandidate) => void;
  onAddMultipleToBasket: (items: ManagementNumberCandidate[]) => void;
  basketedManagementNumbers?: string[];
}

export default function ManagementNumberPanel({
  year,
  selectedInstitution,
  onAddToBasket,
  onAddMultipleToBasket,
  basketedManagementNumbers = []
}: ManagementNumberPanelProps) {
  const [autoSuggestions, setAutoSuggestions] = useState<ManagementNumberCandidate[]>([]);
  const [searchResults, setSearchResults] = useState<ManagementNumberCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [includeAllRegion, setIncludeAllRegion] = useState(false);
  const [includeMatched, setIncludeMatched] = useState(false);

  // 선택된 기관이 변경되거나 필터 옵션이 변경되면 데이터 조회
  useEffect(() => {
    fetchCandidates();
    if (selectedInstitution) {
      setSearchTerm('');
    }
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

  const renderCandidateList = (items: ManagementNumberCandidate[], showConfidence: boolean) => {
    // 이미 담긴 항목 필터링
    const filteredItems = items.filter(
      item => !basketedManagementNumbers.includes(item.management_number)
    );

    if (filteredItems.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground text-sm">
          {searchTerm ? '검색 결과가 없습니다' : '후보가 없습니다'}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {filteredItems.map((item) => (
          <Card
            key={item.management_number}
            className={cn(
              "p-2.5 transition-all",
              item.is_matched && "opacity-50 bg-muted"
            )}
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-sm">
                  {item.institution_name}
                </div>
                {!item.is_matched ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onAddToBasket(item);
                    }}
                    className="flex-shrink-0"
                  >
                    담기
                  </Button>
                ) : (
                  <Badge variant="secondary" className="text-xs flex-shrink-0">
                    이미 매칭됨
                  </Badge>
                )}
              </div>
              {(item.category_1 || item.category_2) && (
                <div className="flex items-center gap-1">
                  {item.category_1 && (
                    <Badge variant="outline" className="text-xs">
                      {item.category_1}
                    </Badge>
                  )}
                  {item.category_2 && (
                    <Badge variant="outline" className="text-xs">
                      {item.category_2}
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
                    장비 {item.equipment_count}대
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        ))}
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
