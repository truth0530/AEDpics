'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  is_matched?: boolean;
}

interface ManagementNumberPanelProps {
  year: string;
  selectedInstitution: TargetInstitution | null;
  onAddToBasket: (item: ManagementNumberCandidate) => void;
  onAddMultipleToBasket: (items: ManagementNumberCandidate[]) => void;
  onAddEquipmentSerial: (item: ManagementNumberCandidate, serial: string) => void;
  onReplaceBasketItemSerials?: (item: ManagementNumberCandidate, serials: string[], isMatched?: boolean) => void;
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
  onReplaceBasketItemSerials,
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
  // 모달 내 추가 관리번호 검색
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [modalSearchResults, setModalSearchResults] = useState<ManagementNumberCandidate[]>([]);
  const [modalSearchLoading, setModalSearchLoading] = useState(false);
  // 모달 내 담긴 항목들 (여러 관리번호 지원)
  const [modalBasketItems, setModalBasketItems] = useState<Array<{
    item: ManagementNumberCandidate;
    selectedSerials: string[];
    removedSerials: string[];  // 비워진 장비연번
  }>>([]);
  // 좌측 기존 매칭에서 취소된 장비연번 (매칭취소 버튼용)
  const [cancelledFromExisting, setCancelledFromExisting] = useState<Set<string>>(new Set());

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

      // 의무설치기관이 선택된 경우 처리
      if (selectedInstitution) {
        // target_key가 row_ 패턴을 포함하면 그루핑모드에서 생성된 synthetic key
        // 이 경우 기관명과 주소 정보를 대신 전달
        if (selectedInstitution.target_key.includes('_row_')) {
          params.append('target_name', selectedInstitution.institution_name);
          params.append('target_sido', selectedInstitution.sido || '');
          params.append('target_gugun', selectedInstitution.gugun || '');
          if (selectedInstitution.address) {
            params.append('target_address', selectedInstitution.address);
          }
        } else {
          // 일반 모드: 기존처럼 target_key 사용
          params.append('target_key', selectedInstitution.target_key);
        }
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
      // 기존 basket에 담긴 시리얼 확인 (이미 3번섹션에 담긴 것들)
      const existingBasketItem = basketedItems.find(b => b.management_number === item.management_number);
      const existingSelectedSerials = existingBasketItem?.selected_serials || [];

      // 기존 선택된 것 + 나머지 모두 합치기 (일괄담기이므로 전체 선택)
      const allSerials = item.equipment_serials || [];
      const newSelectedSerials = [...new Set([...existingSelectedSerials, ...allSerials])];

      // 이중매칭 확인 모달 열기
      setDuplicateMatchDialog({ isOpen: true, item });
      setDuplicateReason('duplicate_institution');
      setOtherReason('');
      // 모달 내 상태 초기화
      setModalSearchTerm('');
      setModalSearchResults([]);
      // 기존 담긴 것 + 나머지 전부 선택된 상태로 시작
      setModalBasketItems([{
        item,
        selectedSerials: newSelectedSerials,
        removedSerials: []
      }]);
    } else {
      // 일반 매칭
      onAddToBasket(item);
    }
  };

  // 개별 장비연번 담기 핸들러 (이중매칭 체크)
  const handleAddEquipmentSerial = (item: ManagementNumberCandidate, serial: string) => {
    // 이미 매칭된 항목인지 체크
    if (item.is_matched) {
      // 기존 basket에 담긴 시리얼 확인 (이미 3번섹션에 담긴 것들)
      const existingBasketItem = basketedItems.find(b => b.management_number === item.management_number);
      const existingSelectedSerials = existingBasketItem?.selected_serials || [];

      // 기존 선택된 것 + 새로 클릭한 것 합치기
      const newSelectedSerials = existingSelectedSerials.includes(serial)
        ? existingSelectedSerials
        : [...existingSelectedSerials, serial];

      // 이중매칭 확인 모달 열기 - 기존 담긴 것 + 새로 클릭한 것 포함
      setDuplicateMatchDialog({ isOpen: true, item });
      setDuplicateReason('duplicate_institution');
      setOtherReason('');
      // 모달 내 상태 초기화
      setModalSearchTerm('');
      setModalSearchResults([]);
      // 기존 담긴 것 + 새로 클릭한 것이 선택된 상태로 시작
      setModalBasketItems([{
        item,
        selectedSerials: newSelectedSerials,
        removedSerials: (item.equipment_serials || []).filter(s => !newSelectedSerials.includes(s))
      }]);
    } else {
      // 일반 매칭
      onAddEquipmentSerial(item, serial);
    }
  };

  // 모달 내 장비연번을 비워진 목록으로 이동
  const handleModalRemoveSerial = (itemIndex: number, serial: string) => {
    setModalBasketItems(prev => {
      return prev.map((item, idx) => {
        if (idx !== itemIndex) return item;
        return {
          ...item,
          selectedSerials: item.selectedSerials.filter(s => s !== serial),
          removedSerials: [...item.removedSerials, serial]
        };
      });
    });
  };

  // 모달 내 비워진 장비연번을 다시 담기
  const handleModalAddSerial = (itemIndex: number, serial: string) => {
    setModalBasketItems(prev => {
      return prev.map((item, idx) => {
        if (idx !== itemIndex) return item;
        return {
          ...item,
          selectedSerials: [...item.selectedSerials, serial],
          removedSerials: item.removedSerials.filter(s => s !== serial)
        };
      });
    });
  };

  // 모달 내 모든 장비연번 비우기
  const handleModalRemoveAllSerials = (itemIndex: number) => {
    setModalBasketItems(prev => {
      return prev.map((item, idx) => {
        if (idx !== itemIndex) return item;
        const allSerials = [...item.selectedSerials, ...item.removedSerials];
        return {
          ...item,
          selectedSerials: [],
          removedSerials: allSerials
        };
      });
    });
  };

  // 모달 내 항목 제거
  const handleModalRemoveItem = (itemIndex: number) => {
    setModalBasketItems(prev => prev.filter((_, i) => i !== itemIndex));
  };

  // 모달 내 검색
  const handleModalSearch = async () => {
    if (!modalSearchTerm.trim()) {
      setModalSearchResults([]);
      return;
    }

    setModalSearchLoading(true);
    try {
      const params = new URLSearchParams({
        year,
        search: modalSearchTerm,
        include_all_region: 'true'
      });

      if (selectedInstitution) {
        params.append('target_key', selectedInstitution.target_key);
      }

      const response = await fetch(`/api/compliance/management-number-candidates?${params}`);
      if (!response.ok) throw new Error('Failed to search');

      const data = await response.json();
      // 이미 모달에 담긴 항목 제외
      const existingNumbers = modalBasketItems.map(b => b.item.management_number);
      const filtered = [...(data.auto_suggestions || []), ...(data.search_results || [])]
        .filter(item => !existingNumbers.includes(item.management_number));
      setModalSearchResults(filtered);
    } catch (error) {
      console.error('Modal search failed:', error);
    } finally {
      setModalSearchLoading(false);
    }
  };

  // 모달 내 추가 항목 담기
  const handleModalAddItem = (item: ManagementNumberCandidate) => {
    setModalBasketItems(prev => [...prev, {
      item,
      selectedSerials: item.equipment_serials || [],
      removedSerials: []
    }]);
    setModalSearchResults(prev => prev.filter(r => r.management_number !== item.management_number));
    setModalSearchTerm('');
  };

  // 이중매칭 확인 후 매칭 실행
  const handleConfirmDuplicateMatch = async () => {
    if (modalBasketItems.length === 0 || !selectedInstitution) return;

    // 이중매칭 사유
    const reason = duplicateReason === 'other' ? otherReason : duplicateReason;
    console.log('[handleConfirmDuplicateMatch] 이중매칭 사유:', reason);

    try {
      // 1. 좌측 "매칭취소된 장비" - 기존 매칭 해제 (unmatch API)
      // matched_to는 기존에 매칭된 기관의 target_key
      const existingTargetKey = duplicateMatchDialog.item?.matched_to;
      const existingInstitutionName = duplicateMatchDialog.item?.matched_institution_name;

      // 같은 기관인지 확인 (target_key로 비교)
      const isSameInstitution = existingTargetKey === selectedInstitution.target_key;

      if (cancelledFromExisting.size > 0 && existingTargetKey) {
        if (isSameInstitution) {
          // 같은 기관에서 같은 기관으로 매칭하는 경우
          // match API의 strategy: 'replace'가 자동으로 처리하므로 unmatch 스킵
          console.log('[handleConfirmDuplicateMatch] 같은 기관 매칭 - unmatch 스킵 (match API가 처리)');
        } else {
          // 다른 기관에서 현재 기관으로 이동하는 경우에만 unmatch 호출
          console.log('[handleConfirmDuplicateMatch] Unmatch API 호출:', {
            existing_institution: existingInstitutionName,
            existing_target_key: existingTargetKey,
            equipment_serials: Array.from(cancelledFromExisting),
            reason: '이중매칭 처리 - 기존 매칭 해제'
          });

          const unmatchResponse = await fetch('/api/compliance/unmatch', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              target_key: existingTargetKey,  // 기존 매칭 기관의 target_key
              year: parseInt(year),
              equipment_serials: Array.from(cancelledFromExisting),
              reason: '이중매칭 처리 - 기존 매칭 해제'
            })
          });

          if (!unmatchResponse.ok) {
            const errorData = await unmatchResponse.json();
            console.error('[handleConfirmDuplicateMatch] Unmatch 실패:', errorData);
            // unmatch 실패해도 계속 진행 (기존 매칭이 없을 수 있음)
          } else {
            const unmatchResult = await unmatchResponse.json();
            console.log('[handleConfirmDuplicateMatch] Unmatch 성공:', unmatchResult);
          }
        }
      }

      // 2. 우측 "담긴 장비" - 새로 매칭 (match-basket API)
      // 중요: cancelledFromExisting에 포함된 장비만 새 기관으로 이동
      // 나머지 장비는 기존 기관에 그대로 유지

      // 매칭취소한 장비가 있는 경우에만 해당 장비를 새 기관으로 매칭
      // 매칭취소하지 않은 장비는 기존 기관 유지
      const serialsToMatch = cancelledFromExisting.size > 0
        ? Array.from(cancelledFromExisting)
        : modalBasketItems.flatMap(item => item.selectedSerials);

      // 매칭할 장비가 속한 관리번호 찾기
      const managementNumbersToMatch = modalBasketItems
        .filter(item =>
          item.selectedSerials.some(serial =>
            cancelledFromExisting.size === 0 || cancelledFromExisting.has(serial)
          )
        )
        .map(item => item.item.management_number);

      // 매칭할 장비가 없으면 스킵
      if (serialsToMatch.length === 0 || managementNumbersToMatch.length === 0) {
        console.log('[handleConfirmDuplicateMatch] 매칭할 장비 없음 - 스킵');
        alert('매칭할 장비가 없습니다. 매칭취소된 장비가 있어야 새 기관으로 이동할 수 있습니다.');
        return;
      }

      console.log('[handleConfirmDuplicateMatch] Match API 호출:', {
        target_key: selectedInstitution.target_key,
        management_numbers: managementNumbersToMatch,
        equipment_serials: serialsToMatch,
        equipment_count: serialsToMatch.length,
        strategy: 'replace'  // 기존 매칭 교체
      });

      const matchResponse = await fetch('/api/compliance/match-basket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_key: selectedInstitution.target_key,
          year: parseInt(year),
          management_numbers: managementNumbersToMatch,
          equipment_serials: serialsToMatch,  // 특정 장비만 매칭
          strategy: 'replace'  // 기존 매칭이 있으면 교체
        })
      });

      if (!matchResponse.ok) {
        const errorData = await matchResponse.json();
        console.error('[handleConfirmDuplicateMatch] Match 실패:', errorData);
        alert(`매칭 실패: ${errorData.error || '알 수 없는 오류'}`);
        return;
      }

      const matchResult = await matchResponse.json();
      console.log('[handleConfirmDuplicateMatch] Match 성공:', matchResult);

      // 성공 메시지
      alert(`매칭 완료: ${matchResult.matched_count || managementNumbersToMatch.length}개 관리번호, ${matchResult.equipment_count || serialsToMatch.length}대 장비`);

      // 3. 모달 닫기 및 상태 초기화
      setDuplicateMatchDialog({ isOpen: false, item: null });
      setModalBasketItems([]);
      setCancelledFromExisting(new Set());

      // 4. 후보 목록 새로고침을 위해 검색 재실행
      if (selectedInstitution) {
        // 페이지 새로고침으로 데이터 갱신
        window.location.reload();
      }

    } catch (error) {
      console.error('[handleConfirmDuplicateMatch] 오류:', error);
      alert(`오류 발생: ${error}`);
    }
  };

  const renderCandidateList = (items: ManagementNumberCandidate[], showConfidence: boolean) => {
    // 완전 매칭된 항목만 필터링 (부분 매칭은 유지) - basket 상태에 따라 숨기기
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

    // 이미 다른 기관에 매칭된 항목 (basket에서 is_matched: false로 해제된 경우 제외)
    const matchedItems = items.filter(item => {
      // basket에서 is_matched가 명시적으로 false로 설정된 경우 매칭 목록에서 제외
      const basketItem = basketedItems.find(b => b.management_number === item.management_number);
      if (basketItem && basketItem.is_matched === false) return false;
      return item.is_matched;
    });

    // DEBUG: matchedItems 확인
    const renderDebug = {
      items_total: items.length,
      filtered_items_count: filteredItems.length,
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

    // 미매칭 항목만 분리 (basket에서 is_matched: false로 설정된 항목 포함)
    const unmatchedItems = filteredItems.filter(item => {
      const basketItem = basketedItems.find(b => b.management_number === item.management_number);
      // basket에서 is_matched가 명시적으로 false로 설정된 경우 미매칭으로 취급
      if (basketItem && basketItem.is_matched === false) return true;
      return !item.is_matched;
    });

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

              // basket에서 is_matched가 명시적으로 false로 설정된 경우 중복 매칭이 아닌 것으로 취급
              const effectiveIsMatched = basketItem?.is_matched === false ? false : item.is_matched;

              return (
                <Card
                  key={item.management_number}
                  className={cn(
                    "p-2 transition-all border",
                    !effectiveIsMatched && !isPartiallyMatched && !isFullyMatched && (!item.confidence || item.confidence >= 90) && "bg-green-900/[0.06] border-slate-300 dark:border-slate-600",
                    !effectiveIsMatched && !isPartiallyMatched && !isFullyMatched && item.confidence && item.confidence < 90 && "border-slate-200 dark:border-slate-700",
                    // 100% 매칭: 강조 스타일
                    effectiveIsMatched && item.confidence === 100 && !isFullyMatched && "bg-blue-50/50 dark:bg-blue-950/30 border-blue-400 dark:border-blue-500",
                    // 기타 매칭: 흐리게
                    effectiveIsMatched && item.confidence !== 100 && !isFullyMatched && "opacity-50 bg-muted border-slate-200 dark:border-slate-700",
                    isPartiallyMatched && "border-slate-300 dark:border-slate-600",
                    // basket에 담긴 항목: 더 흐리게
                    isFullyMatched && "opacity-30 border-green-400 bg-green-50/50 dark:bg-green-950/20"
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
                            {/* 일괄담기 버튼 - 이미 매칭된 항목은 중복매칭 안내 */}
                            {!isPartiallyMatched && !isFullyMatched && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddToBasket(item);
                                }}
                                className="flex-shrink-0 h-6 text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border-amber-400 dark:border-amber-600 font-semibold"
                              >
                                중복매칭을 위해 일괄담기
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
                                      handleAddEquipmentSerial(item, detail.serial);
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
                                      handleAddEquipmentSerial(item, detail.serial);
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

              // basket에서 is_matched가 명시적으로 false로 설정된 경우 중복 매칭이 아닌 것으로 취급
              const effectiveIsMatched = basketItem?.is_matched === false ? false : item.is_matched;

              return (
                <Card
                  key={item.management_number}
                  className={cn(
                    "p-2 transition-all border",
                    !effectiveIsMatched && !isPartiallyMatched && !isFullyMatched && (!item.confidence || item.confidence >= 90) && "bg-green-900/[0.06] border-slate-300 dark:border-slate-600",
                    !effectiveIsMatched && !isPartiallyMatched && !isFullyMatched && item.confidence && item.confidence < 90 && "border-slate-200 dark:border-slate-700",
                    // 100% 매칭: 강조 스타일
                    effectiveIsMatched && item.confidence === 100 && "bg-blue-50/50 dark:bg-blue-950/30 border-blue-400 dark:border-blue-500",
                    // 기타 매칭: 흐리게
                    effectiveIsMatched && item.confidence !== 100 && "opacity-50 bg-muted border-slate-200 dark:border-slate-700",
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
                                      handleAddEquipmentSerial(item, detail.serial);
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
                                      handleAddEquipmentSerial(item, detail.serial);
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
                                    handleAddEquipmentSerial(item, detail.serial);
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
                                      handleAddEquipmentSerial(item, detail.serial);
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
                                      handleAddEquipmentSerial(item, detail.serial);
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
                                      handleAddEquipmentSerial(item, detail.serial);
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

      {/* 이중매칭 확인 모달 - 좌우 비교 구조 */}
      <Dialog open={duplicateMatchDialog.isOpen} onOpenChange={(open) => {
        if (!open) {
          setDuplicateMatchDialog({ isOpen: false, item: null });
          setModalBasketItems([]);
          setCancelledFromExisting(new Set());
        }
      }}>
        <DialogContent className="max-w-[55vw] sm:max-w-[55vw] md:max-w-[55vw] lg:max-w-[55vw] xl:max-w-[55vw] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-3">
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              이중 매칭 확인
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              이미 다른 기관에 매칭된 장비입니다. 처리 방법을 선택하세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* 좌우 비교 섹션 */}
            {duplicateMatchDialog.item && (
              <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden">{/* 좌측: 기존에 매칭된 기관 */}
                <div className="border border-gray-700 rounded-lg overflow-hidden flex flex-col p-2">
                  <div className="flex-1 overflow-y-auto">
                    <div className="space-y-0">
                      {/* 헤더: 제목 + 기관명 */}
                      <div className="bg-amber-900/30 border border-amber-700/50 rounded-md px-3 py-2">
                        <div className="text-xs font-semibold text-amber-300/80 mb-1">기존에 매칭된 의무기관</div>
                        <div className="font-semibold text-sm text-amber-400">
                          {duplicateMatchDialog.item.matched_institution_name || '다른 기관'}
                        </div>
                      </div>
                      {/* ㄴ자 화살표 커넥터 (좌측용) */}
                      <div className="flex justify-center py-1">
                        <svg width="100" height="50" viewBox="0 0 100 50" className="text-amber-500/70">
                          {/* 수평 시작 - 점선 */}
                          <path
                            d="M 90 8 L 73 8"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="8"
                            strokeLinecap="butt"
                            strokeDasharray="3 4"
                          />
                          {/* ㄴ자 곡선 - 실선 */}
                          <path
                            d="M 73 8 L 45 8 Q 20 8, 20 25 L 20 36"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="8"
                            strokeLinecap="butt"
                          />
                          {/* 화살표 머리 */}
                          <path
                            d="M 10 30 L 20 44 L 30 30"
                            fill="currentColor"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinejoin="miter"
                          />
                        </svg>
                      </div>
                      {/* AED 데이터 본문 */}
                      <div className="bg-gray-900/20 border border-gray-700 rounded-md px-2 py-2">
                        {/* 주소 및 관리번호 */}
                        <div className="text-xs text-gray-400 mb-2 space-y-0.5">
                          <div className="truncate">주소: {duplicateMatchDialog.item.address}</div>
                          <div>관리번호: {duplicateMatchDialog.item.management_number}</div>
                        </div>

                        {/* 기존 매칭 장비 (취소되지 않은 장비) */}
                        {(() => {
                          const activeSerials = duplicateMatchDialog.item.equipment_serials?.filter(
                            (serial: string) => !cancelledFromExisting.has(serial)
                          ) || [];
                          const newSerials = modalBasketItems.length > 0 ? modalBasketItems[0].selectedSerials : [];

                          return activeSerials.length > 0 && (
                            <div className="mb-2">
                              <div className="flex items-center justify-between mb-1">
                                <div className="text-xs text-amber-400">
                                  기존 매칭 장비 ({activeSerials.length}대)
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950"
                                  onClick={() => {
                                    setCancelledFromExisting(new Set(duplicateMatchDialog.item?.equipment_serials || []));
                                  }}
                                >
                                  일괄매칭취소
                                </Button>
                              </div>
                              <div className="space-y-0.5">
                                {activeSerials.map((serial: string, idx: number) => {
                                  const equipmentDetail = duplicateMatchDialog.item?.equipment_details?.find(d => d.serial === serial);
                                  const isMatchingWithNew = newSerials.includes(serial);
                                  return (
                                    <div key={idx} className="flex items-center justify-between text-xs py-0.5 bg-amber-900/20 border border-amber-700/30 px-1 rounded">
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs leading-tight">
                                          <span className={`font-mono font-medium ${isMatchingWithNew ? 'text-blue-400' : 'text-white'}`}>
                                            {serial}
                                          </span>
                                          {equipmentDetail?.location_detail && (
                                            <>
                                              <span className="text-muted-foreground mx-1">|</span>
                                              <span className="text-muted-foreground">
                                                {equipmentDetail.location_detail}
                                              </span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950 ml-2 flex-shrink-0"
                                        onClick={() => {
                                          setCancelledFromExisting(prev => {
                                            const newSet = new Set(prev);
                                            newSet.add(serial);
                                            return newSet;
                                          });
                                        }}
                                      >
                                        매칭취소
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

                        {/* 매칭취소된 장비 */}
                        {cancelledFromExisting.size > 0 && (
                          <div>
                            <div className="text-xs text-gray-500 mb-1">
                              매칭취소된 장비 ({cancelledFromExisting.size}대)
                            </div>
                            <div className="space-y-0.5">
                              {Array.from(cancelledFromExisting).map((serial, idx) => {
                                const equipmentDetail = duplicateMatchDialog.item?.equipment_details?.find(d => d.serial === serial);
                                return (
                                  <div key={idx} className="flex items-center justify-between text-xs py-0.5 bg-gray-800/50 border border-gray-700/30 px-1 rounded">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs leading-tight">
                                        <span className="font-mono font-medium text-gray-500">
                                          {serial}
                                        </span>
                                        {equipmentDetail?.location_detail && (
                                          <>
                                            <span className="text-gray-600 mx-1">|</span>
                                            <span className="text-gray-600">
                                              {equipmentDetail.location_detail}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-xs text-green-400 hover:text-green-300 hover:bg-green-950 ml-2 flex-shrink-0"
                                      onClick={() => {
                                        setCancelledFromExisting(prev => {
                                          const newSet = new Set(prev);
                                          newSet.delete(serial);
                                          return newSet;
                                        });
                                      }}
                                    >
                                      복원
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 우측: 이번에 매칭하려는 기관 */}
                <div className="border border-gray-700 rounded-lg overflow-hidden flex flex-col p-2">
                  <div className="flex-1 overflow-y-auto">
                    <div className="space-y-0">
                      {/* 헤더: 제목 + 기관명 */}
                      <div className="bg-blue-900/30 border border-blue-700/50 rounded-md px-3 py-2">
                        <div className="text-xs font-semibold text-blue-300/80 mb-1">이번에 매칭하려는 의무기관</div>
                        <div className="font-semibold text-sm text-blue-400">{selectedInstitution?.institution_name}</div>
                      </div>
                      {/* ㄱ자 화살표 커넥터 (우측용) */}
                      <div className="flex justify-center py-1">
                        <svg width="100" height="50" viewBox="0 0 100 50" className="text-blue-500/70">
                          {/* 수평 시작 - 점선 */}
                          <path
                            d="M 10 8 L 27 8"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="8"
                            strokeLinecap="butt"
                            strokeDasharray="3 4"
                          />
                          {/* ㄱ자 곡선 - 실선 */}
                          <path
                            d="M 27 8 L 55 8 Q 80 8, 80 25 L 80 36"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="8"
                            strokeLinecap="butt"
                          />
                          {/* 화살표 머리 */}
                          <path
                            d="M 70 30 L 80 44 L 90 30"
                            fill="currentColor"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinejoin="miter"
                          />
                        </svg>
                      </div>
                      {/* AED 데이터 본문 */}
                      <div className="bg-gray-900/20 border border-gray-700 rounded-md px-2 py-2">
                        {/* 주소 및 관리번호 */}
                        <div className="text-xs text-gray-400 mb-2 space-y-0.5">
                          <div className="truncate">주소: {duplicateMatchDialog.item.address}</div>
                          <div>관리번호: {duplicateMatchDialog.item.management_number}</div>
                        </div>

                        {/* 담긴 장비 */}
                        {modalBasketItems.length > 0 && modalBasketItems[0]?.selectedSerials.length > 0 && (
                          <div className="mb-2">
                            <div className="flex items-center justify-between mb-1">
                              <div className="text-xs text-green-400">담긴 장비 ({modalBasketItems[0].selectedSerials.length}대)</div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950"
                                onClick={() => handleModalRemoveAllSerials(0)}
                              >
                                모두 비우기
                              </Button>
                            </div>
                            <div className="space-y-0.5">
                              {modalBasketItems[0].selectedSerials.map((serial, idx) => {
                                const equipmentDetail = modalBasketItems[0].item.equipment_details?.find(d => d.serial === serial);
                                // 좌측 기존 매칭에 있는 장비연번과 일치 여부 (취소되지 않은 것만)
                                const existingActiveSerials = duplicateMatchDialog.item?.equipment_serials?.filter(
                                  (s: string) => !cancelledFromExisting.has(s)
                                ) || [];
                                const isMatchingWithExisting = existingActiveSerials.includes(serial);
                                return (
                                  <div key={idx} className="flex items-center justify-between text-xs py-0.5 bg-green-900/20 border border-green-700/30 px-1 rounded">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs leading-tight">
                                        <span className={`font-mono font-medium ${isMatchingWithExisting ? 'text-blue-400' : 'text-white'}`}>
                                          {serial}
                                        </span>
                                        {equipmentDetail?.location_detail && (
                                          <>
                                            <span className="text-muted-foreground mx-1">|</span>
                                            <span className="text-muted-foreground">
                                              {equipmentDetail.location_detail}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950 ml-2 flex-shrink-0"
                                      onClick={() => handleModalRemoveSerial(0, serial)}
                                    >
                                      비우기
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 비워진 장비 */}
                        {modalBasketItems.length > 0 && modalBasketItems[0]?.removedSerials.length > 0 && (
                          <div>
                            <div className="text-xs text-gray-500 mb-1">비워진 장비 ({modalBasketItems[0].removedSerials.length}대)</div>
                            <div className="space-y-0.5">
                              {modalBasketItems[0].removedSerials.map((serial, idx) => {
                                const equipmentDetail = modalBasketItems[0].item.equipment_details?.find(d => d.serial === serial);
                                return (
                                  <div key={idx} className="flex items-center justify-between text-xs py-0.5 bg-gray-800/50 border border-gray-700/30 px-1 rounded">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs leading-tight">
                                        <span className="font-mono font-medium text-gray-500">
                                          {serial}
                                        </span>
                                        {equipmentDetail?.location_detail && (
                                          <>
                                            <span className="text-gray-600 mx-1">|</span>
                                            <span className="text-gray-600">
                                              {equipmentDetail.location_detail}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-xs text-green-400 hover:text-green-300 hover:bg-green-950 ml-2 flex-shrink-0"
                                      onClick={() => handleModalAddSerial(0, serial)}
                                    >
                                      담기
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 추가 매칭 질문 */}
            {modalBasketItems.length > 0 && (
              <div className="border border-gray-600 rounded-lg p-3 bg-gray-800/30">
                <div className="text-sm text-center mb-2">
                  {basketedManagementNumbers.length === 0
                    ? "추가로 매칭할 장비가 있습니까?"
                    : "매칭대기리스트에 추가하시겠습니까?"
                  }
                </div>
                <div className="flex justify-center gap-3">
                  {/* 3번 섹션이 비어있을 때만 "이대로매칭완료" 버튼 표시 */}
                  {basketedManagementNumbers.length === 0 && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        // "이대로매칭완료" 클릭: 직접 매칭 처리
                        handleConfirmDuplicateMatch();
                      }}
                      disabled={modalBasketItems.reduce((sum, item) => sum + item.selectedSerials.length, 0) === 0}
                      className="px-6 bg-yellow-500 hover:bg-yellow-600 text-black"
                    >
                      이대로매칭완료
                    </Button>
                  )}
                  {(() => {
                    // 중복 여부 확인: 좌측 남은 장비와 우측 선택된 장비 간 겹침
                    const activeSerials = duplicateMatchDialog.item?.equipment_serials?.filter(
                      (serial: string) => !cancelledFromExisting.has(serial)
                    ) || [];
                    const selectedSerials = modalBasketItems.length > 0 ? modalBasketItems[0].selectedSerials : [];
                    const hasOverlap = activeSerials.some((serial: string) => selectedSerials.includes(serial));

                    return (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                          // basket을 모달 상태로 교체하고 모달 닫기
                          if (modalBasketItems.length > 0 && onReplaceBasketItemSerials) {
                            modalBasketItems.forEach(basketItem => {
                              // 중복이 없으면 is_matched: false로 설정
                              onReplaceBasketItemSerials(basketItem.item, basketItem.selectedSerials, hasOverlap);
                            });
                          }
                          setDuplicateMatchDialog({ isOpen: false, item: null });
                          setModalBasketItems([]);
                          setCancelledFromExisting(new Set());
                        }}
                        disabled={modalBasketItems.reduce((sum, item) => sum + item.selectedSerials.length, 0) === 0}
                        className={hasOverlap ? "px-6 bg-green-600 hover:bg-green-700" : "px-6 bg-blue-600 hover:bg-blue-700"}
                      >
                        {hasOverlap ? '매칭대기리스트로 이동' : '중복 없이 매칭대기리스트에 담기'}
                      </Button>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-4 border-t">
            <div className="flex items-center justify-between w-full">
              <div className="text-xs text-muted-foreground">
                {modalBasketItems.length > 0 && (
                  <span>
                    총 {modalBasketItems.reduce((sum, item) => sum + item.selectedSerials.length, 0)}대 장비연번 선택됨
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDuplicateMatchDialog({ isOpen: false, item: null });
                    setModalBasketItems([]);
                  }}
                  className="text-sm"
                >
                  취소
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
