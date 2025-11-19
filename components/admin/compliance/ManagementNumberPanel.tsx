'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, MapPin, TrendingUp, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { shortenAddressSido } from '@/lib/constants/regions';
import { getMatchTier } from '@/lib/utils/match-tier';
import { getAddressMatchLevel } from '@/lib/utils/string-similarity';

interface EquipmentDetail {
  serial: string;
  location_detail: string;
}

interface ManagementNumberCandidate {
  management_number: string;
  institution_name: string;
  address: string;
  sido: string;
  gugun: string;
  equipment_count: number;
  equipment_serials: string[];
  equipment_details: EquipmentDetail[];
  confidence: number | null;
  is_matched: boolean;
  matched_to: string | null;
  matched_institution_name: string | null;
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
  isCollapsed?: boolean;
  onCandidatesLoaded?: (candidates: ManagementNumberCandidate[]) => void;
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
function highlightMatchingInstitutionName(institutionName: string, selectedName: string | undefined, confidence?: number): React.ReactNode {
  if (!institutionName || !selectedName) {
    // confidence < 90이면 전체를 회색으로
    if (confidence && confidence < 90) {
      return <span className="text-slate-400 dark:text-slate-500">{institutionName}</span>;
    }
    return institutionName;
  }

  // 먼저 전체 문자열 매칭 시도
  const fullIndex = institutionName.indexOf(selectedName);
  if (fullIndex !== -1) {
    const before = institutionName.substring(0, fullIndex);
    const matched = institutionName.substring(fullIndex, fullIndex + selectedName.length);
    const after = institutionName.substring(fullIndex + selectedName.length);
    return (
      <>
        {before && <span className="text-gray-400 dark:text-gray-500">{before}</span>}
        <span className="text-blue-600 dark:text-blue-400 font-semibold">{matched}</span>
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
      <span key={`highlight-${idx}`} className="text-blue-600 dark:text-blue-400 font-semibold">
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
// addressMatchLevel: 주소 일치 수준 (2: 시도+구군, 3: 시도+구군+읍면동)
function highlightMatchingAddress(
  address: string,
  selectedAddress: string | undefined,
  addressMatchLevel: number = 3
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

    // 강조 텍스트 (주소 일치 수준에 따라 색상 차별화)
    parts.push(
      <span key={idx} className={cn(
        "font-semibold",
        addressMatchLevel === 3
          ? "text-blue-600 dark:text-blue-400"  // Level 3 (읍면동까지 일치): 밝은 노랑
          : "text-blue-400 dark:text-blue-100"  // Level 2 (시도+구군만 일치): 흰색에 가까운 연한 노랑
      )}>
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
  basketedItems = [],
  isCollapsed = false,
  onCandidatesLoaded
}: ManagementNumberPanelProps) {
  const [autoSuggestions, setAutoSuggestions] = useState<ManagementNumberCandidate[]>([]);
  const [searchResults, setSearchResults] = useState<ManagementNumberCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [includeAllRegion, setIncludeAllRegion] = useState(false);
  const [showAlreadyMatched, setShowAlreadyMatched] = useState(true); // 기본: 이미 매칭된 항목 펼침
  // 펼쳐진 관리번호 Set (관리번호별 펼침/접힘 상태 관리)
  // 접힌 상태를 추적 (기본값은 펼쳐진 상태)
  const [collapsedManagementNumbers, setCollapsedManagementNumbers] = useState<Set<string>>(new Set());
  // 60% 이하 후보 펼침 상태 (기본값: false = 접힌 상태)
  const [showLowConfidenceCandidates, setShowLowConfidenceCandidates] = useState(false);

  // 이중매칭 확인 모달 상태
  const [duplicateMatchDialog, setDuplicateMatchDialog] = useState<{
    isOpen: boolean;
    item: ManagementNumberCandidate | null;
  }>({ isOpen: false, item: null });
  const [duplicateReason, setDuplicateReason] = useState<'duplicate_institution' | 'no_match' | 'other'>('duplicate_institution');
  const [otherReason, setOtherReason] = useState('');

  // 선택된 기관이 변경될 때 초기 설정
  useEffect(() => {
    if (selectedInstitution) {
      setSearchTerm('');
      // 기본값: 이미 매칭된 관리번호 숨김 (showAlreadyMatched = false)
      setShowAlreadyMatched(false);
    }
  }, [selectedInstitution]);

  // 선택된 기관이 변경되거나 필터 옵션이 변경되면 데이터 조회
  // 2025-11-19: showAlreadyMatched 의존성 제거 (UI 상태만 변경, API 재호출 불필요)
  useEffect(() => {
    fetchCandidates();
  }, [selectedInstitution, includeAllRegion]);

  // 검색어 변경 시 검색 실행 (디바운싱)
  useEffect(() => {
    if (searchTerm) {
      const timer = setTimeout(() => {
        fetchCandidates();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchTerm]);

  // 부분 매칭된 카드 및 고유키 매칭 카드 자동 펼치기 (접힌 상태에서 제거하여 펼침)
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
      setCollapsedManagementNumbers(prev => {
        const newSet = new Set(prev);
        // 접힌 상태에서 제거하여 펼침
        allNumbersToExpand.forEach(num => newSet.delete(num));
        return newSet;
      });
    }
  }, [basketedItems, autoSuggestions, searchResults, selectedInstitution]);

  const fetchCandidates = async () => {

    setLoading(true);
    try {
      const params = new URLSearchParams({
        year,
        include_all_region: includeAllRegion.toString()
        // 2025-11-19: include_matched 제거
        // API는 항상 모든 데이터를 반환하고, UI에서 showAlreadyMatched 상태로 접기/펼치기 제어
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
      const autoSugs = data.auto_suggestions || [];
      const searchRes = data.search_results || [];

      // DEBUG: 매칭된 항목 확인
      const debugData = {
        auto_suggestions_total: autoSugs.length,
        auto_suggestions_matched: autoSugs.filter((item: any) => item.is_matched).length,
        search_results_total: searchRes.length,
        search_results_matched: searchRes.filter((item: any) => item.is_matched).length,
        sample_auto: autoSugs.slice(0, 3).map((item: any) => ({
          management_number: item.management_number,
          institution_name: item.institution_name,
          is_matched: item.is_matched,
          matched_to: item.matched_to
        }))
      };
      console.log('[ManagementNumberPanel] API Response:', JSON.stringify(debugData, null, 2));

      setAutoSuggestions(autoSugs);
      setSearchResults(searchRes);

      // 부모 컴포넌트에 후보 데이터 전달 (섹션1에서 unique_key 매칭 확인용)
      if (onCandidatesLoaded) {
        const allCandidates = [...autoSugs, ...searchRes];
        onCandidatesLoaded(allCandidates);
      }
    } catch (error) {
      console.error('Failed to fetch candidates:', error);
    } finally {
      setLoading(false);
    }
  };

  // 관리번호별 펼치기/접기 토글
  const toggleExpanded = (managementNumber: string) => {
    setCollapsedManagementNumbers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(managementNumber)) {
        newSet.delete(managementNumber);
      } else {
        newSet.add(managementNumber);
      }
      return newSet;
    });
  };

  // 담기 버튼 클릭 핸들러 (이중매칭 체크)
  const handleAddToBasket = (item: ManagementNumberCandidate) => {
    // 이미 매칭된 항목인지 체크
    if (item.is_matched) {
      // 이중매칭 확인 모달 열기
      setDuplicateMatchDialog({ isOpen: true, item });
      setDuplicateReason('duplicate_institution');
      setOtherReason('');
    } else {
      // 일반 매칭
      onAddToBasket(item);
    }
  };

  // 이중매칭 확인
  const handleConfirmDuplicateMatch = () => {
    if (!duplicateMatchDialog.item) return;

    // TODO: 이중매칭 로그 저장 (사유와 함께)
    const reason = duplicateReason === 'other' ? otherReason : duplicateReason;
    console.log('이중매칭 사유:', reason);

    // 담기 실행
    onAddToBasket(duplicateMatchDialog.item);

    // 모달 닫기
    setDuplicateMatchDialog({ isOpen: false, item: null });
  };

  const renderCandidateList = (items: ManagementNumberCandidate[], showConfidence: boolean) => {
    // 이미 다른 기관에 매칭된 항목 (원본에서 가져오기 - basket 상태와 무관)
    const matchedItems = items.filter(item => item.is_matched);

    // DEBUG: matchedItems 확인
    const renderDebug = {
      items_total: items.length,
      matched_items_count: matchedItems.length,
      searchTerm_active: !!searchTerm,  // 검색어 활성 여부
      using_searchResults: searchTerm ? true : false,  // searchResults 사용 여부
      matched_items_sample: matchedItems.slice(0, 3).map(item => ({
        management_number: item.management_number,
        institution_name: item.institution_name,
        is_matched: item.is_matched,
        matched_to: item.matched_to
      }))
    };
    console.log('[renderCandidateList] matchedItems check:', JSON.stringify(renderDebug, null, 2));

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

    // 미매칭 항목만 분리
    const unmatchedItems = filteredItems.filter(item => !item.is_matched);

    // 미매칭 항목을 60% 초과와 60% 이하로 분리
    const highConfidenceItems = unmatchedItems.filter(item => !item.confidence || item.confidence > 60);
    const lowConfidenceItems = unmatchedItems.filter(item => item.confidence && item.confidence <= 60);

    // DEBUG: filteredItems 길이 확인
    console.log('[renderCandidateList] filteredItems check:', JSON.stringify({
      original_items: items.length,
      filtered_items: filteredItems.length,
      matched_in_filtered: filteredItems.filter(item => item.is_matched).length,
      unmatched_items: unmatchedItems.length,
      early_return: filteredItems.length === 0
    }, null, 2));

    // Early return removed to allow "Already Matched" button to render


    return (
      <div className="space-y-2">
        {/* 이미 매칭된 항목 펼치기 버튼 - 최상단 위치 */}
        {matchedItems.length > 0 && (
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAlreadyMatched(!showAlreadyMatched)}
              className="w-full text-xs bg-yellow-100 dark:bg-yellow-900"
            >
              {showAlreadyMatched ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  이미 매칭된 항목 {matchedItems.length}개 접기
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  이미 매칭된 항목 {matchedItems.length}개 펼치기
                </>
              )}
            </Button>
          </div>
        )}

        {/* 이미 매칭된 항목 리스트 (펼쳐진 경우만 표시) */}
        {showAlreadyMatched && matchedItems.length > 0 && (
          <div className="space-y-0.5">
            {matchedItems.map((item) => {
              // 접힌 상태가 아니면 펼쳐진 상태
              const isExpanded = !collapsedManagementNumbers.has(item.management_number);
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

              // 주소 일치 수준 계산 (2: 시도+구군, 3: 시도+구군+읍면동)
              const addressMatchLevel = selectedInstitution ? getAddressMatchLevel(
                item.address,
                selectedInstitution.address,
                item.sido,
                selectedInstitution.sido,
                item.gugun,
                selectedInstitution.gugun
              ) : 0;

              // isPartiallyMatched일 때 주소 일치 수준에 따라 색상 차별화
              const isPartiallyMatchedLevel2 = isPartiallyMatched && addressMatchLevel === 2; // 시도+구군만 일치
              const isPartiallyMatchedLevel3 = isPartiallyMatched && addressMatchLevel === 3; // 시도+구군+읍면동 일치

              return (
                <Card
                  key={item.management_number}
                  className={cn(
                    "p-2 transition-all border",
                    !item.is_matched && !isPartiallyMatched && !isFullyMatched && (!item.confidence || item.confidence >= 90) && "bg-green-900/[0.06] border-slate-300 dark:border-slate-600",
                    !item.is_matched && !isPartiallyMatched && !isFullyMatched && item.confidence && item.confidence < 90 && "border-slate-200 dark:border-slate-700",
                    // 100% 매칭: 강조 스타일
                    item.is_matched && item.confidence === 100 && "bg-blue-50/50 dark:bg-blue-950/30 border-blue-400 dark:border-blue-500",
                    // 기타 매칭: 흐리게
                    item.is_matched && item.confidence !== 100 && "opacity-50 bg-muted border-slate-200 dark:border-slate-700",
                    isPartiallyMatched && "border-slate-300 dark:border-slate-600",
                    isFullyMatched && "border-green-400 bg-green-50/50 dark:bg-green-950/20"
                  )}
                >
                  <div className="space-y-1.5">
                    {/* 카드 클릭 가능 영역 (장비 목록 제외) */}
                    <div className="space-y-1.5">
                      {/* 카드 상단 헤더 */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-medium text-sm">
                            {highlightMatchingInstitutionName(item.institution_name, selectedInstitution?.institution_name, item.confidence)}
                          </div>
                          {isFullyMatched && (
                            <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">
                              전체 담김
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* 이미 매칭된 경우 뱃지 표시 (장비 개수 무관) */}
                          {item.is_matched && (
                            <div className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 text-amber-600" />
                              <Badge variant="secondary" className="text-xs flex-shrink-0 bg-amber-50 text-amber-800 border-amber-300">
                                {(() => {
                                  if (!item.matched_institution_name) return '이미 매칭됨';

                                  // 현재 선택한 기관명과 비교 (공백 제거)
                                  const selectedName = selectedInstitution?.institution_name?.replace(/\s/g, '') || '';
                                  const matchedName = item.matched_institution_name.replace(/\s/g, '');

                                  // 동일 기관: "~에 매칭됨"
                                  if (selectedName && matchedName === selectedName) {
                                    return `${item.matched_institution_name}에 매칭됨`;
                                  }

                                  // 다른 기관: "~에 매칭된 상태"
                                  return `${item.matched_institution_name}에 매칭된 상태`;
                                })()}
                              </Badge>
                            </div>
                          )}
                          {/* 장비가 1대인 경우에만 담기 버튼 표시 */}
                          {!isPartiallyMatched && !isFullyMatched && item.equipment_count === 1 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToBasket(item);
                              }}
                              className={cn(
                                "flex-shrink-0 h-6 text-xs",
                                "bg-transparent text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600"
                              )}
                            >
                              담기
                            </Button>
                          )}
                          {showConfidence && item.confidence && (
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-xs font-normal flex-shrink-0 px-1 py-0.5 tracking-tighter",
                                "bg-transparent border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                              )}
                            >
                              {item.confidence.toFixed(0)}%
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <div className="text-xs text-muted-foreground flex-shrink-0">
                          관리번호 {item.management_number}
                        </div>
                        {item.category_1 && (
                          <span className="text-xs text-muted-foreground">
                            {item.category_1 === '구비의무기관' ? '의무' : item.category_1}
                          </span>
                        )}
                        {item.category_2 && (
                          <span className="text-xs text-muted-foreground">
                            {item.category_2 === '구비의무기관' ? '의무' : item.category_2}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span>{highlightMatchingAddress(shortenAddressSido(item.address), selectedInstitution?.address, addressMatchLevel)}</span>
                      </div>

                      {hasMultipleEquipment && remainingEquipmentCount > 0 && (
                        <div className={cn(
                          "mt-2 p-2 rounded-md border transition-all",
                          isPartiallyMatchedLevel2 && "border-amber-600 bg-amber-100/30 dark:bg-amber-950/30",
                          isPartiallyMatchedLevel3 && "border-amber-400 bg-amber-50/50 dark:bg-amber-950/20",
                          !isPartiallyMatched && "border-transparent"
                        )}>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              {isPartiallyMatched && (
                                <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300">
                                  부분 매칭
                                </Badge>
                              )}
                              <div
                                className="text-xs text-blue-400 dark:text-blue-300 flex items-center gap-1 cursor-pointer hover:text-blue-500 dark:hover:text-blue-200 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpanded(item.management_number);
                                }}
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="h-3 w-3" />
                                    {isPartiallyMatched
                                      ? `장비연번 ${remainingEquipmentCount}대 접기(${basketedSerials.length}대 부분매칭)`
                                      : `장비연번 접기(${item.equipment_count}/${item.equipment_count}개)`
                                    }
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-3 w-3" />
                                    {isPartiallyMatched
                                      ? `장비연번 ${remainingEquipmentCount}대 펼치기(${basketedSerials.length}대 부분매칭)`
                                      : `장비연번 펼치기(${item.equipment_count}대)`
                                    }
                                  </>
                                )}
                              </div>
                            </div>
                            {/* 일괄담기 버튼 */}
                            {!isPartiallyMatched && !isFullyMatched && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddToBasket(item);
                                }}
                                className="flex-shrink-0 h-6 text-xs bg-transparent text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600"
                              >
                                일괄담기
                              </Button>
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

                      // 접힌 상태일 때는 완전히 숨김, 펼쳐진 상태일 때는 전체 표시
                      const displayCount = isExpanded
                        ? remainingEquipmentDetails.length
                        : 0;

                      const displayedEquipmentDetails = remainingEquipmentDetails.slice(0, displayCount);

                      return displayedEquipmentDetails.length > 0 ? (
                        <div className="mt-1.5 pt-1.5 border-t border-border/50">
                          <div className="space-y-0.5">
                            {displayedEquipmentDetails.map((detail) => {
                              // 고유키 매칭 여부 확인
                              const isUniqueKeyMatched = uniqueKey && hasUniqueKeyMatch(detail.location_detail, uniqueKey);

                              return (
                                <div
                                  key={detail.serial}
                                  className={cn(
                                    "flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors",
                                    !item.is_matched && "cursor-pointer hover:bg-muted/50",
                                    isUniqueKeyMatched
                                      ? "bg-purple-50 dark:bg-purple-900/20 border border-purple-300 dark:border-purple-700"
                                      : "bg-muted/30 dark:bg-muted/20"
                                  )}
                                  onClick={() => {
                                    if (!item.is_matched) {
                                      onAddEquipmentSerial(item, detail.serial);
                                    }
                                  }}
                                >
                                  {detail.location_detail && (
                                    <span className={cn(
                                      "leading-tight flex-1 min-w-0 truncate",
                                      isUniqueKeyMatched
                                        ? "text-purple-700 dark:text-purple-300 font-medium"
                                        : "text-foreground/80 dark:text-foreground/90"
                                    )}>
                                      {highlightVehicleText(detail.location_detail)}
                                    </span>
                                  )}
                                  <span className={cn(
                                    "font-mono font-medium leading-tight flex-shrink-0",
                                    isUniqueKeyMatched
                                      ? "text-purple-800 dark:text-purple-200"
                                      : "text-foreground dark:text-foreground"
                                  )}>
                                    {detail.serial}
                                  </span>
                                  {isUniqueKeyMatched && (
                                    <Badge variant="outline" className="text-[10px] py-0 px-1 h-4 bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-600 flex-shrink-0">
                                      고유키
                                    </Badge>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-4 text-[10px] px-1.5 py-0 flex-shrink-0 border-foreground/20 dark:border-foreground/30 hover:bg-foreground/10 dark:hover:bg-foreground/20"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onAddEquipmentSerial(item, detail.serial);
                                    }}
                                  >
                                    담기
                                  </Button>
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
        )}

        {/* 검색 결과 없음 또는 매칭 가능한 항목 없음 메시지 */}
        {filteredItems.length === 0 ? (
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
        ) : (
          /* 60% 초과 후보 리스트 */
          <div className="space-y-0.5">

            {highConfidenceItems.map((item) => {
              // 접힌 상태가 아니면 펼쳐진 상태
              const isExpanded = !collapsedManagementNumbers.has(item.management_number);
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

              // 주소 일치 수준 계산 (2: 시도+구군, 3: 시도+구군+읍면동)
              const addressMatchLevel = selectedInstitution ? getAddressMatchLevel(
                item.address,
                selectedInstitution.address,
                item.sido,
                selectedInstitution.sido,
                item.gugun,
                selectedInstitution.gugun
              ) : 0;

              // isPartiallyMatched일 때 주소 일치 수준에 따라 색상 차별화
              const isPartiallyMatchedLevel2 = isPartiallyMatched && addressMatchLevel === 2; // 시도+구군만 일치
              const isPartiallyMatchedLevel3 = isPartiallyMatched && addressMatchLevel === 3; // 시도+구군+읍면동 일치

              return (
                <Card
                  key={item.management_number}
                  className={cn(
                    "p-2 transition-all border",
                    !item.is_matched && !isPartiallyMatched && !isFullyMatched && (!item.confidence || item.confidence >= 90) && "bg-green-900/[0.06] border-slate-300 dark:border-slate-600",
                    !item.is_matched && !isPartiallyMatched && !isFullyMatched && item.confidence && item.confidence < 90 && "border-slate-200 dark:border-slate-700",
                    // 100% 매칭: 강조 스타일
                    item.is_matched && item.confidence === 100 && "bg-blue-50/50 dark:bg-blue-950/30 border-blue-400 dark:border-blue-500",
                    // 기타 매칭: 흐리게
                    item.is_matched && item.confidence !== 100 && "opacity-50 bg-muted border-slate-200 dark:border-slate-700",
                    isPartiallyMatched && "border-slate-300 dark:border-slate-600",
                    isFullyMatched && "border-green-400 bg-green-50/50 dark:bg-green-950/20"
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
                            {highlightMatchingInstitutionName(item.institution_name, selectedInstitution?.institution_name, item.confidence)}
                          </div>
                          {isFullyMatched && (
                            <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">
                              전체 담김
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* 장비가 1대인 경우에만 담기 버튼 표시 */}
                          {!isPartiallyMatched && !isFullyMatched && item.equipment_count === 1 ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation(); // 카드 클릭 이벤트 전파 방지
                                  handleAddToBasket(item);
                                }}
                                className={cn(
                                  "flex-shrink-0 h-6 text-xs",
                                  item.confidence === 100
                                    ? "bg-green-900/[0.06] text-blue-600 dark:text-blue-400 border-2 border-blue-600 dark:border-blue-500 hover:bg-green-900/[0.12]"
                                    : item.confidence && item.confidence < 90
                                      ? "bg-transparent text-slate-400 dark:text-slate-500 border-slate-300 dark:border-slate-600"
                                      : "bg-green-900/[0.06]"
                                )}
                              >
                                담기
                              </Button>
                              {item.is_matched && (
                                <div className="flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3 text-amber-600" />
                                  <Badge variant="secondary" className="text-xs flex-shrink-0 bg-amber-50 text-amber-800 border-amber-300">
                                    {(() => {
                                      if (!item.matched_institution_name) return '이미 매칭됨';

                                      const selectedName = selectedInstitution?.institution_name?.replace(/\s/g, '') || '';
                                      const matchedName = item.matched_institution_name.replace(/\s/g, '');

                                      if (selectedName && matchedName === selectedName) {
                                        return `이미 ${item.matched_institution_name}에 매칭됨`;
                                      }

                                      return `${item.matched_institution_name}에 매칭된 사례 있음`;
                                    })()}
                                  </Badge>
                                </div>
                              )}
                            </>
                          ) : null}
                          {showConfidence && item.confidence && (
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-xs font-normal flex-shrink-0 px-1 py-0.5 tracking-tighter",
                                item.confidence === 100
                                  ? "bg-amber-100 text-red-800 border-amber-300 dark:bg-amber-900/30 dark:text-red-400"
                                  : item.confidence >= 90
                                    ? "bg-slate-700 dark:bg-slate-600 text-white"
                                    : "bg-transparent border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                              )}
                            >
                              {item.confidence.toFixed(0)}%
                            </Badge>
                          )}
                        </div>
                      </div>
                      {/* 카드 상단 헤더 끝 */}

                      <div className="flex items-center gap-1.5">
                        <div className={cn(
                          "text-xs text-muted-foreground flex-shrink-0",
                          item.confidence && item.confidence < 90 && "text-slate-400 dark:text-slate-500"
                        )}>
                          관리번호 {item.management_number}
                        </div>
                        {item.category_1 && (
                          <span className={cn(
                            "text-xs text-muted-foreground",
                            item.confidence && item.confidence < 90 && "text-slate-400 dark:text-slate-500"
                          )}>
                            {item.category_1 === '구비의무기관' ? '의무' : item.category_1}
                          </span>
                        )}
                        {item.category_2 && (
                          <span className={cn(
                            "text-xs text-muted-foreground",
                            item.confidence && item.confidence < 90 && "text-slate-400 dark:text-slate-500"
                          )}>
                            {item.category_2 === '구비의무기관' ? '의무' : item.category_2}
                          </span>
                        )}
                      </div>
                      <div className={cn(
                        "flex items-center gap-1.5 text-xs text-muted-foreground",
                        item.confidence && item.confidence < 90 && "text-slate-400 dark:text-slate-500"
                      )}>
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span>{highlightMatchingAddress(shortenAddressSido(item.address), selectedInstitution?.address, addressMatchLevel)}</span>
                      </div>

                      {/* 장비가 2대 이상인 경우 시각적 힌트 표시 */}
                      {hasMultipleEquipment && remainingEquipmentCount > 0 && (
                        <div className={cn(
                          "mt-2 p-2 rounded-md border transition-all",
                          isPartiallyMatchedLevel2 && "border-amber-600 bg-amber-100/30 dark:bg-amber-950/30",
                          isPartiallyMatchedLevel3 && "border-amber-400 bg-amber-50/50 dark:bg-amber-950/20",
                          !isPartiallyMatched && "border-transparent"
                        )}>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              {isPartiallyMatched && (
                                <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300">
                                  부분 매칭
                                </Badge>
                              )}
                              <div
                                className="text-xs text-blue-400 dark:text-blue-300 flex items-center gap-1 cursor-pointer hover:text-blue-500 dark:hover:text-blue-200 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpanded(item.management_number);
                                }}
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="h-3 w-3" />
                                    {isPartiallyMatched
                                      ? `장비연번 ${remainingEquipmentCount}대 접기(${basketedSerials.length}대 부분매칭)`
                                      : `장비연번 접기(${item.equipment_count}/${item.equipment_count}개)`
                                    }
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-3 w-3" />
                                    {isPartiallyMatched
                                      ? `장비연번 ${remainingEquipmentCount}대 펼치기(${basketedSerials.length}대 부분매칭)`
                                      : `장비연번 펼치기(${item.equipment_count}대)`
                                    }
                                  </>
                                )}
                              </div>
                            </div>
                            {/* 일괄담기 버튼 */}
                            {!isPartiallyMatched && !isFullyMatched && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddToBasket(item);
                                }}
                                className={cn(
                                  "flex-shrink-0 h-6 text-xs",
                                  item.confidence === 100
                                    ? "bg-green-900/[0.06] text-blue-600 dark:text-blue-400 border-2 border-blue-600 dark:border-blue-500 hover:bg-green-900/[0.12]"
                                    : item.confidence && item.confidence < 90
                                      ? "bg-transparent text-slate-400 dark:text-slate-500 border-slate-300 dark:border-slate-600"
                                      : "bg-green-900/[0.06]"
                                )}
                              >
                                일괄담기
                              </Button>
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

                      // 접힌 상태일 때는 완전히 숨김, 펼쳐진 상태일 때는 전체 표시
                      const displayCount = isExpanded
                        ? remainingEquipmentDetails.length
                        : 0;

                      const displayedEquipmentDetails = remainingEquipmentDetails.slice(0, displayCount);

                      return displayedEquipmentDetails.length > 0 ? (
                        <div className="mt-1.5 pt-1.5 border-t border-border/50">
                          <div className="space-y-0.5">
                            {displayedEquipmentDetails.map((detail) => {
                              // 고유키 매칭 여부 확인
                              const isUniqueKeyMatched = uniqueKey && hasUniqueKeyMatch(detail.location_detail, uniqueKey);

                              return (
                                <div
                                  key={detail.serial}
                                  className={cn(
                                    "flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors",
                                    !item.is_matched && "cursor-pointer hover:bg-muted/50",
                                    isUniqueKeyMatched
                                      ? "bg-purple-50 dark:bg-purple-900/20 border border-purple-300 dark:border-purple-700"
                                      : "bg-muted/30 dark:bg-muted/20"
                                  )}
                                  onClick={() => {
                                    if (!item.is_matched) {
                                      onAddEquipmentSerial(item, detail.serial);
                                    }
                                  }}
                                >
                                  {detail.location_detail && (
                                    <span className={cn(
                                      "leading-tight flex-1 min-w-0 truncate",
                                      isUniqueKeyMatched
                                        ? "text-purple-700 dark:text-purple-300 font-medium"
                                        : "text-foreground/80 dark:text-foreground/90"
                                    )}>
                                      {highlightVehicleText(detail.location_detail)}
                                    </span>
                                  )}
                                  <span className={cn(
                                    "font-mono font-medium leading-tight flex-shrink-0",
                                    isUniqueKeyMatched
                                      ? "text-purple-800 dark:text-purple-200"
                                      : "text-foreground dark:text-foreground"
                                  )}>
                                    {detail.serial}
                                  </span>
                                  {isUniqueKeyMatched && (
                                    <Badge variant="outline" className="text-[10px] py-0 px-1 h-4 bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-600 flex-shrink-0">
                                      고유키
                                    </Badge>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-4 text-[10px] px-1.5 py-0 flex-shrink-0 border-foreground/20 dark:border-foreground/30 hover:bg-foreground/10 dark:hover:bg-foreground/20"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onAddEquipmentSerial(item, detail.serial);
                                    }}
                                  >
                                    담기
                                  </Button>
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
        )}

        {/* 이미 매칭된 항목 펼치기 버튼 */}
        {matchedItems.length > 0 && (
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAlreadyMatched(!showAlreadyMatched)}
              className="w-full text-xs bg-yellow-100 dark:bg-yellow-900"
            >
              {showAlreadyMatched ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  이미 매칭된 항목 {matchedItems.length}개 접기
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  이미 매칭된 항목 {matchedItems.length}개 펼치기
                </>
              )}
            </Button>
          </div>
        )}

        {/* 이미 매칭된 항목 리스트 (펼쳐진 경우만 표시) */}
        {showAlreadyMatched && matchedItems.length > 0 && (
          <div className="space-y-0.5">
            {matchedItems.map((item) => {
              // 접힌 상태가 아니면 펼쳐진 상태
              const isExpanded = !collapsedManagementNumbers.has(item.management_number);
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

              // 주소 일치 수준 계산 (2: 시도+구군, 3: 시도+구군+읍면동)
              const addressMatchLevel = selectedInstitution ? getAddressMatchLevel(
                item.address,
                selectedInstitution.address,
                item.sido,
                selectedInstitution.sido,
                item.gugun,
                selectedInstitution.gugun
              ) : 0;

              // isPartiallyMatched일 때 주소 일치 수준에 따라 색상 차별화
              const isPartiallyMatchedLevel2 = isPartiallyMatched && addressMatchLevel === 2; // 시도+구군만 일치
              const isPartiallyMatchedLevel3 = isPartiallyMatched && addressMatchLevel === 3; // 시도+구군+읍면동 일치

              return (
                <Card
                  key={item.management_number}
                  className={cn(
                    "p-2 transition-all border",
                    "bg-gray-100 dark:bg-gray-800 border-amber-300 dark:border-amber-700",
                    isPartiallyMatched && "border-amber-500 dark:border-amber-600",
                    isFullyMatched && "border-green-400 bg-green-50/50 dark:bg-green-950/20"
                  )}
                >
                  <div className="space-y-1.5">
                    {/* 동일한 카드 내용 렌더링 */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-medium text-sm">
                            {highlightMatchingInstitutionName(item.institution_name, selectedInstitution?.institution_name, item.confidence)}
                          </div>
                          {isFullyMatched && (
                            <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">
                              전체 담김
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!isPartiallyMatched && !isFullyMatched && item.equipment_count === 1 ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddToBasket(item);
                                }}
                                className={cn(
                                  "flex-shrink-0 h-6 text-xs",
                                  "bg-transparent text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600"
                                )}
                              >
                                담기
                              </Button>
                              <div className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 text-amber-600" />
                                <Badge variant="secondary" className="text-xs flex-shrink-0 bg-amber-50 text-amber-800 border-amber-300">
                                  {item.matched_institution_name
                                    ? `이미 ${item.matched_institution_name}에 매칭됨`
                                    : '이미 매칭됨'}
                                </Badge>
                              </div>
                            </>
                          ) : null}
                          {showConfidence && item.confidence && (
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-xs font-normal flex-shrink-0 px-1 py-0.5 tracking-tighter",
                                "bg-transparent border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                              )}
                            >
                              {item.confidence.toFixed(0)}%
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <div className="text-xs text-muted-foreground flex-shrink-0">
                          관리번호 {item.management_number}
                        </div>
                        {item.category_1 && (
                          <span className="text-xs text-muted-foreground">
                            {item.category_1 === '구비의무기관' ? '의무' : item.category_1}
                          </span>
                        )}
                        {item.category_2 && (
                          <span className="text-xs text-muted-foreground">
                            {item.category_2 === '구비의무기관' ? '의무' : item.category_2}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span>{highlightMatchingAddress(shortenAddressSido(item.address), selectedInstitution?.address, addressMatchLevel)}</span>
                      </div>

                      {hasMultipleEquipment && remainingEquipmentCount > 0 && (
                        <div className={cn(
                          "mt-2 p-2 rounded-md border transition-all",
                          isPartiallyMatchedLevel2 && "border-amber-600 bg-amber-100/30 dark:bg-amber-950/30",
                          isPartiallyMatchedLevel3 && "border-amber-400 bg-amber-50/50 dark:bg-amber-950/20",
                          !isPartiallyMatched && "border-transparent"
                        )}>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              {isPartiallyMatched && (
                                <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300">
                                  부분 매칭
                                </Badge>
                              )}
                              <div
                                className="text-xs text-blue-400 dark:text-blue-300 flex items-center gap-1 cursor-pointer hover:text-blue-500 dark:hover:text-blue-200 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpanded(item.management_number);
                                }}
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="h-3 w-3" />
                                    {isPartiallyMatched
                                      ? `장비연번 ${remainingEquipmentCount}대 접기(${basketedSerials.length}대 부분매칭)`
                                      : `장비연번 접기(${item.equipment_count}/${item.equipment_count}개)`
                                    }
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-3 w-3" />
                                    {isPartiallyMatched
                                      ? `장비연번 ${remainingEquipmentCount}대 펼치기(${basketedSerials.length}대 부분매칭)`
                                      : `장비연번 펼치기(${item.equipment_count}대)`
                                    }
                                  </>
                                )}
                              </div>
                            </div>
                            {!isPartiallyMatched && !isFullyMatched && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddToBasket(item);
                                }}
                                className={cn(
                                  "flex-shrink-0 h-6 text-xs",
                                  "bg-transparent text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600"
                                )}
                              >
                                일괄담기
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {hasMultipleEquipment && item.equipment_details && (() => {
                      const remainingEquipmentDetails = item.equipment_details.filter(
                        detail => !basketedSerials.includes(detail.serial)
                      );

                      const displayCount = isExpanded
                        ? remainingEquipmentDetails.length
                        : 0;

                      const displayedEquipmentDetails = remainingEquipmentDetails.slice(0, displayCount);

                      return displayedEquipmentDetails.length > 0 ? (
                        <div className="mt-2 pt-2 border-t border-border">
                          <div className="space-y-0">
                            {displayedEquipmentDetails.map((detail) => {
                              const isUniqueKeyMatched = uniqueKey && hasUniqueKeyMatch(detail.location_detail, uniqueKey);

                              return (
                                <div
                                  key={detail.serial}
                                  className={cn(
                                    "flex items-center gap-1.5 p-1 rounded transition-colors cursor-pointer hover:opacity-80",
                                    isUniqueKeyMatched
                                      ? "bg-purple-100 dark:bg-purple-900/30 border border-purple-400 dark:border-purple-500"
                                      : "bg-green-900/[0.06]"
                                  )}
                                  onClick={() => {
                                    onAddEquipmentSerial(item, detail.serial);
                                  }}
                                >
                                  {detail.location_detail && (
                                    <span className={cn(
                                      "text-xs leading-tight flex-1 min-w-0 truncate",
                                      isUniqueKeyMatched ? "text-purple-600 dark:text-purple-400" : "text-muted-foreground"
                                    )}>
                                      {highlightVehicleText(detail.location_detail)}
                                    </span>
                                  )}
                                  <span className="text-muted-foreground text-xs flex-shrink-0">|</span>
                                  <span className={cn(
                                    "font-mono font-medium text-xs leading-tight flex-shrink-0",
                                    isUniqueKeyMatched ? "text-purple-700 dark:text-purple-300" : ""
                                  )}>
                                    {detail.serial}
                                  </span>
                                  {isUniqueKeyMatched && (
                                    <>
                                      <span className="text-muted-foreground text-xs flex-shrink-0">|</span>
                                      <Badge variant="outline" className="text-xs bg-purple-100 text-purple-800 border-purple-300 flex-shrink-0">
                                        고유키일치
                                      </Badge>
                                    </>
                                  )}
                                  <span className="text-muted-foreground text-xs flex-shrink-0">|</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-auto text-xs px-1 py-0 flex-shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onAddEquipmentSerial(item, detail.serial);
                                    }}
                                  >
                                    담기
                                  </Button>
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
        )}

        {/* 60% 이하 후보 펼치기 버튼 */}
        {lowConfidenceItems.length > 0 && (
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLowConfidenceCandidates(!showLowConfidenceCandidates)}
              className="w-full text-xs"
            >
              {showLowConfidenceCandidates ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  60% 이하 후보 {lowConfidenceItems.length}개 접기
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  60% 이하 후보 {lowConfidenceItems.length}개 펼치기
                </>
              )}
            </Button>
          </div>
        )}

        {/* 60% 이하 후보 리스트 (펼쳐진 경우만 표시) */}
        {showLowConfidenceCandidates && lowConfidenceItems.length > 0 && (
          <div className="space-y-0.5">
            {lowConfidenceItems.map((item) => {
              // 접힌 상태가 아니면 펼쳐진 상태
              const isExpanded = !collapsedManagementNumbers.has(item.management_number);
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

              // 주소 일치 수준 계산 (2: 시도+구군, 3: 시도+구군+읍면동)
              const addressMatchLevel = selectedInstitution ? getAddressMatchLevel(
                item.address,
                selectedInstitution.address,
                item.sido,
                selectedInstitution.sido,
                item.gugun,
                selectedInstitution.gugun
              ) : 0;

              // isPartiallyMatched일 때 주소 일치 수준에 따라 색상 차별화
              const isPartiallyMatchedLevel2 = isPartiallyMatched && addressMatchLevel === 2; // 시도+구군만 일치
              const isPartiallyMatchedLevel3 = isPartiallyMatched && addressMatchLevel === 3; // 시도+구군+읍면동 일치

              return (
                <Card
                  key={item.management_number}
                  className={cn(
                    "p-2 transition-all border",
                    !item.is_matched && !isPartiallyMatched && !isFullyMatched && (!item.confidence || item.confidence >= 90) && "bg-green-900/[0.06] border-slate-300 dark:border-slate-600",
                    !item.is_matched && !isPartiallyMatched && !isFullyMatched && item.confidence && item.confidence < 90 && "border-slate-200 dark:border-slate-700",
                    item.is_matched && "bg-gray-100 dark:bg-gray-800 border-amber-300 dark:border-amber-700",
                    isPartiallyMatched && "border-slate-300 dark:border-slate-600",
                    isFullyMatched && "border-green-400 bg-green-50/50 dark:bg-green-950/20"
                  )}
                >
                  <div className="space-y-1.5">
                    {/* 동일한 카드 내용 렌더링 (60% 초과와 동일) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-medium text-sm">
                            {highlightMatchingInstitutionName(item.institution_name, selectedInstitution?.institution_name, item.confidence)}
                          </div>
                          {isFullyMatched && (
                            <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">
                              전체 담김
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!isPartiallyMatched && !isFullyMatched && item.equipment_count === 1 ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddToBasket(item);
                                }}
                                className={cn(
                                  "flex-shrink-0 h-6 text-xs",
                                  item.confidence === 100
                                    ? "bg-green-900/[0.06] text-blue-600 dark:text-blue-400 border-2 border-blue-600 dark:border-blue-500 hover:bg-green-900/[0.12]"
                                    : item.confidence && item.confidence < 90
                                      ? "bg-transparent text-slate-400 dark:text-slate-500 border-slate-300 dark:border-slate-600"
                                      : "bg-green-900/[0.06]"
                                )}
                              >
                                담기
                              </Button>
                              {item.is_matched && (
                                <div className="flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3 text-amber-600" />
                                  <Badge variant="secondary" className="text-xs flex-shrink-0 bg-amber-50 text-amber-800 border-amber-300">
                                    {(() => {
                                      if (!item.matched_institution_name) return '이미 매칭됨';

                                      const selectedName = selectedInstitution?.institution_name?.replace(/\s/g, '') || '';
                                      const matchedName = item.matched_institution_name.replace(/\s/g, '');

                                      if (selectedName && matchedName === selectedName) {
                                        return `이미 ${item.matched_institution_name}에 매칭됨`;
                                      }

                                      return `${item.matched_institution_name}에 매칭된 사례 있음`;
                                    })()}
                                  </Badge>
                                </div>
                              )}
                            </>
                          ) : null}
                          {showConfidence && item.confidence && (
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-xs font-normal flex-shrink-0 px-1 py-0.5 tracking-tighter",
                                item.confidence === 100
                                  ? "bg-amber-100 text-red-800 border-amber-300 dark:bg-amber-900/30 dark:text-red-400"
                                  : item.confidence >= 90
                                    ? "bg-slate-700 dark:bg-slate-600 text-white"
                                    : "bg-transparent border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                              )}
                            >
                              {item.confidence.toFixed(0)}%
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <div className={cn(
                          "text-xs text-muted-foreground flex-shrink-0",
                          item.confidence && item.confidence < 90 && "text-slate-400 dark:text-slate-500"
                        )}>
                          관리번호 {item.management_number}
                        </div>
                        {item.category_1 && (
                          <span className={cn(
                            "text-xs text-muted-foreground",
                            item.confidence && item.confidence < 90 && "text-slate-400 dark:text-slate-500"
                          )}>
                            {item.category_1 === '구비의무기관' ? '의무' : item.category_1}
                          </span>
                        )}
                        {item.category_2 && (
                          <span className={cn(
                            "text-xs text-muted-foreground",
                            item.confidence && item.confidence < 90 && "text-slate-400 dark:text-slate-500"
                          )}>
                            {item.category_2 === '구비의무기관' ? '의무' : item.category_2}
                          </span>
                        )}
                      </div>
                      <div className={cn(
                        "flex items-center gap-1.5 text-xs text-muted-foreground",
                        item.confidence && item.confidence < 90 && "text-slate-400 dark:text-slate-500"
                      )}>
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span>{highlightMatchingAddress(shortenAddressSido(item.address), selectedInstitution?.address, addressMatchLevel)}</span>
                      </div>

                      {hasMultipleEquipment && remainingEquipmentCount > 0 && (
                        <div className={cn(
                          "mt-2 p-2 rounded-md border transition-all",
                          isPartiallyMatchedLevel2 && "border-amber-600 bg-amber-100/30 dark:bg-amber-950/30",
                          isPartiallyMatchedLevel3 && "border-amber-400 bg-amber-50/50 dark:bg-amber-950/20",
                          !isPartiallyMatched && "border-transparent"
                        )}>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              {isPartiallyMatched && (
                                <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300">
                                  부분 매칭
                                </Badge>
                              )}
                              <div
                                className="text-xs text-blue-400 dark:text-blue-300 flex items-center gap-1 cursor-pointer hover:text-blue-500 dark:hover:text-blue-200 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpanded(item.management_number);
                                }}
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="h-3 w-3" />
                                    {isPartiallyMatched
                                      ? `장비연번 ${remainingEquipmentCount}대 접기(${basketedSerials.length}대 부분매칭)`
                                      : `장비연번 접기(${item.equipment_count}/${item.equipment_count}개)`
                                    }
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-3 w-3" />
                                    {isPartiallyMatched
                                      ? `장비연번 ${remainingEquipmentCount}대 펼치기(${basketedSerials.length}대 부분매칭)`
                                      : `장비연번 펼치기(${item.equipment_count}대)`
                                    }
                                  </>
                                )}
                              </div>
                            </div>
                            {!isPartiallyMatched && !isFullyMatched && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddToBasket(item);
                                }}
                                className={cn(
                                  "flex-shrink-0 h-6 text-xs",
                                  item.confidence === 100
                                    ? "bg-green-900/[0.06] text-blue-600 dark:text-blue-400 border-2 border-blue-600 dark:border-blue-500 hover:bg-green-900/[0.12]"
                                    : item.confidence && item.confidence < 90
                                      ? "bg-transparent text-slate-400 dark:text-slate-500 border-slate-300 dark:border-slate-600"
                                      : "bg-green-900/[0.06]"
                                )}
                              >
                                일괄담기
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {hasMultipleEquipment && item.equipment_details && (() => {
                      const remainingEquipmentDetails = item.equipment_details.filter(
                        detail => !basketedSerials.includes(detail.serial)
                      );

                      const displayCount = isExpanded
                        ? remainingEquipmentDetails.length
                        : 0;

                      const displayedEquipmentDetails = remainingEquipmentDetails.slice(0, displayCount);

                      return displayedEquipmentDetails.length > 0 ? (
                        <div className="mt-2 pt-2 border-t border-border">
                          <div className="space-y-0">
                            {displayedEquipmentDetails.map((detail) => {
                              const isUniqueKeyMatched = uniqueKey && hasUniqueKeyMatch(detail.location_detail, uniqueKey);

                              return (
                                <div
                                  key={detail.serial}
                                  className={cn(
                                    "flex items-center gap-1.5 p-1 rounded transition-colors",
                                    !item.is_matched && "cursor-pointer hover:opacity-80",
                                    isUniqueKeyMatched
                                      ? "bg-purple-100 dark:bg-purple-900/30 border border-purple-400 dark:border-purple-500"
                                      : "bg-green-900/[0.06]"
                                  )}
                                  onClick={() => {
                                    if (!item.is_matched) {
                                      onAddEquipmentSerial(item, detail.serial);
                                    }
                                  }}
                                >
                                  {detail.location_detail && (
                                    <span className={cn(
                                      "text-xs leading-tight flex-1 min-w-0 truncate",
                                      isUniqueKeyMatched ? "text-purple-600 dark:text-purple-400" : "text-muted-foreground"
                                    )}>
                                      {highlightVehicleText(detail.location_detail)}
                                    </span>
                                  )}
                                  <span className="text-muted-foreground text-xs flex-shrink-0">|</span>
                                  <span className={cn(
                                    "font-mono font-medium text-xs leading-tight flex-shrink-0",
                                    isUniqueKeyMatched ? "text-purple-700 dark:text-purple-300" : ""
                                  )}>
                                    {detail.serial}
                                  </span>
                                  {isUniqueKeyMatched && (
                                    <>
                                      <span className="text-muted-foreground text-xs flex-shrink-0">|</span>
                                      <Badge variant="outline" className="text-xs bg-purple-100 text-purple-800 border-purple-300 flex-shrink-0">
                                        고유키일치
                                      </Badge>
                                    </>
                                  )}
                                  <span className="text-muted-foreground text-xs flex-shrink-0">|</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-auto text-xs px-1 py-0 flex-shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onAddEquipmentSerial(item, detail.serial);
                                    }}
                                  >
                                    담기
                                  </Button>
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
        )}
      </div>
    );
  };

  // 표시할 데이터 결정
  const displayItems = searchTerm ? searchResults : autoSuggestions;
  const showConfidence = !searchTerm && !!selectedInstitution; // 자동 추천일 때만 신뢰도 표시
  const displayCount = displayItems.filter((item) => {
    return !basketedManagementNumbers.includes(item.management_number);
  }).length;

  // 이미 매칭된 항목 개수 계산
  const alreadyMatchedItems = displayItems.filter(item => item.is_matched);
  const alreadyMatchedCount = alreadyMatchedItems.length;

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
          </div>

          {/* 검색창 */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="기관명, 장비연번, 관리번호, 주소로 검색..."
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
              의무설치기관을 선택하면<br />
              추천 관리번호가 표시됩니다
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

      {/* 이중매칭 확인 모달 */}
      <Dialog open={duplicateMatchDialog.isOpen} onOpenChange={(open) => {
        if (!open) setDuplicateMatchDialog({ isOpen: false, item: null });
      }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg">이중 매칭 확인</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* 매칭 정보 */}
            {duplicateMatchDialog.item && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-foreground leading-relaxed">
                  <span className="font-semibold text-amber-900 dark:text-amber-100">
                    {duplicateMatchDialog.item.management_number}
                  </span>
                  <span className="text-muted-foreground mx-1">→</span>
                  <span className="font-semibold text-amber-700 dark:text-amber-300">
                    {duplicateMatchDialog.item.matched_institution_name || '다른 기관'}
                  </span>
                  <span className="block mt-1 text-xs text-amber-700 dark:text-amber-400">
                    이미 매칭된 관리번호입니다. 이중 매칭 사유를 선택하세요.
                  </span>
                </p>
              </div>
            )}

            {/* 사유 선택 */}
            <RadioGroup value={duplicateReason} onValueChange={(value: any) => setDuplicateReason(value)} className="space-y-1.5">
              <div className="flex items-start space-x-2 p-2 rounded-md hover:bg-muted/50 dark:hover:bg-muted/30 transition-colors">
                <RadioGroupItem value="duplicate_institution" id="duplicate_institution" className="mt-0.5" />
                <Label htmlFor="duplicate_institution" className="cursor-pointer font-normal leading-tight flex-1">
                  <span className="block text-sm text-foreground dark:text-foreground">같은 의무시설이 중복 등록됨</span>
                  <span className="block text-xs text-muted-foreground dark:text-muted-foreground/80 mt-0.5">동일 기관이 다른 이름으로 등록된 경우</span>
                </Label>
              </div>
              <div className="flex items-start space-x-2 p-2 rounded-md hover:bg-muted/50 dark:hover:bg-muted/30 transition-colors">
                <RadioGroupItem value="no_match" id="no_match" className="mt-0.5" />
                <Label htmlFor="no_match" className="cursor-pointer font-normal leading-tight flex-1">
                  <span className="block text-sm text-foreground dark:text-foreground">매칭할 대상이 없음</span>
                  <span className="block text-xs text-muted-foreground dark:text-muted-foreground/80 mt-0.5">올바른 매칭 대상을 찾을 수 없는 경우</span>
                </Label>
              </div>
              <div className="flex items-start space-x-2 p-2 rounded-md hover:bg-muted/50 dark:hover:bg-muted/30 transition-colors">
                <RadioGroupItem value="other" id="other" className="mt-0.5" />
                <Label htmlFor="other" className="cursor-pointer font-normal leading-tight flex-1">
                  <span className="block text-sm text-foreground dark:text-foreground">기타 사유</span>
                </Label>
              </div>
            </RadioGroup>

            {/* 기타 사유 입력 */}
            {duplicateReason === 'other' && (
              <Textarea
                id="other_reason"
                placeholder="이중 매칭 사유를 입력하세요..."
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                className="text-sm resize-none"
                rows={2}
              />
            )}

            {/* 매칭불가 처리 안내 */}
            {duplicateReason === 'no_match' && (
              <Alert className="bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800/50">
                <AlertTriangle className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                  섹션 1에서 해당 기관을 선택 후 <strong className="dark:text-blue-200">'매칭불가'</strong> 버튼을 사용하세요.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="pt-3">
            <Button
              variant="outline"
              onClick={() => setDuplicateMatchDialog({ isOpen: false, item: null })}
              className="text-sm"
            >
              취소
            </Button>
            <Button
              onClick={handleConfirmDuplicateMatch}
              disabled={duplicateReason === 'other' && !otherReason.trim()}
              className="bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-800 text-white text-sm"
            >
              이중 매칭 진행
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
