'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { MapPin, ChevronDown, ChevronUp, GitCompare, CornerRightDown, CornerLeftUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { shortenAddressSido } from '@/lib/constants/regions';
import { isAmbulanceFromAED, validateBasket, getAmbulanceType } from '@/lib/utils/ambulance-detector';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface EquipmentDetail {
  serial: string;
  location_detail: string;
  category_1?: string | null;
  category_2?: string | null;
}

interface BasketItem {
  management_number: string;
  institution_name: string;
  address: string;
  equipment_count: number;
  equipment_serials: string[];
  equipment_details: EquipmentDetail[];
  confidence: number | null;
  target_key: string;
  selected_serials?: string[]; // 선택된 장비연번 (undefined면 전체, 배열이면 일부만)
  category_1?: string;
  category_2?: string;
  is_matched?: boolean; // 이미 다른 기관에 매칭된 항목 여부 (중복매칭)
}

interface TargetInstitution {
  target_key: string;
  institution_name: string;
  address?: string;
  unique_key?: string; // 2025년 고유키
}

interface BasketPanelProps {
  basket: BasketItem[];
  selectedInstitution: TargetInstitution | null;
  onRemove: (managementNumber: string) => void;
  onRemoveEquipmentSerial: (managementNumber: string, serial: string) => void;
  onClear: () => void;
  onMatch?: () => void;
}

// 설치장소 텍스트에서 구급차/차량번호 강조
function highlightVehicleText(text: string): React.ReactNode {
  if (!text) return text;

  const vehicleNumberPattern = /\d{2,3}[가-힣]\d{4}/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  const ambulancePattern = /(특수구급차|구급차)/g;
  const allMatches: Array<{ index: number; text: string; type: 'ambulance' | 'vehicle' }> = [];

  let match;
  while ((match = ambulancePattern.exec(text)) !== null) {
    allMatches.push({ index: match.index, text: match[0], type: 'ambulance' });
  }

  while ((match = vehicleNumberPattern.exec(text)) !== null) {
    allMatches.push({ index: match.index, text: match[0], type: 'vehicle' });
  }

  allMatches.sort((a, b) => a.index - b.index);

  const uniqueMatches: typeof allMatches = [];
  let lastEnd = -1;
  for (const m of allMatches) {
    if (m.index >= lastEnd) {
      uniqueMatches.push(m);
      lastEnd = m.index + m.text.length;
    }
  }

  uniqueMatches.forEach((m, idx) => {
    if (m.index > lastIndex) {
      parts.push(text.substring(lastIndex, m.index));
    }
    parts.push(
      <span key={idx} className="font-bold text-white dark:text-white">
        {m.text}
      </span>
    );
    lastIndex = m.index + m.text.length;
  });

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : text;
}

// 기관명에서 선택된 기관명과 매칭되는 부분 강조
function highlightMatchingInstitutionName(institutionName: string, selectedName: string | undefined): React.ReactNode {
  if (!institutionName || !selectedName) return institutionName;

  const fullIndex = institutionName.indexOf(selectedName);
  if (fullIndex !== -1) {
    const before = institutionName.substring(0, fullIndex);
    const matched = institutionName.substring(fullIndex, fullIndex + selectedName.length);
    const after = institutionName.substring(fullIndex + selectedName.length);
    return (
      <>
        {before}
        <span className="text-blue-600 dark:text-blue-400 font-semibold">{matched}</span>
        {after}
      </>
    );
  }

  const nameKeywords = selectedName.split(/[\s,]+/).filter(k => k.length > 1);
  if (nameKeywords.length === 0) return institutionName;

  const matches: Array<{ index: number; length: number; text: string }> = [];
  for (const keyword of nameKeywords) {
    let searchIndex = 0;
    while (true) {
      const index = institutionName.indexOf(keyword, searchIndex);
      if (index === -1) break;
      matches.push({ index, length: keyword.length, text: keyword });
      searchIndex = index + keyword.length;
    }
  }

  if (matches.length === 0) return institutionName;

  matches.sort((a, b) => a.index - b.index);
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

  uniqueMatches.sort((a, b) => a.index - b.index);

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  uniqueMatches.forEach((match, idx) => {
    if (match.index > lastIndex) {
      parts.push(institutionName.substring(lastIndex, match.index));
    }
    parts.push(
      <span key={idx} className="text-blue-600 dark:text-blue-400 font-semibold">
        {match.text}
      </span>
    );
    lastIndex = match.index + match.length;
  });

  if (lastIndex < institutionName.length) {
    parts.push(institutionName.substring(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : institutionName;
}

// 주소에서 선택된 주소와 매칭되는 부분 강조
function highlightMatchingAddress(address: string, selectedAddress: string | undefined): React.ReactNode {
  if (!address || !selectedAddress) return address;

  const addressKeywords = selectedAddress.split(/[\s,]+/).filter(k => k.length > 1);
  if (addressKeywords.length === 0) return address;

  const matches: Array<{ index: number; length: number; text: string }> = [];
  for (const keyword of addressKeywords) {
    let searchIndex = 0;
    while (true) {
      const index = address.indexOf(keyword, searchIndex);
      if (index === -1) break;
      matches.push({ index, length: keyword.length, text: keyword });
      searchIndex = index + keyword.length;
    }
  }

  const parenMatch = selectedAddress.match(/\([^)]+\)/g);
  if (parenMatch) {
    for (const paren of parenMatch) {
      const index = address.indexOf(paren);
      if (index !== -1) {
        matches.push({ index, length: paren.length, text: paren });
      }
    }
  }

  if (matches.length === 0) return address;

  matches.sort((a, b) => a.index - b.index);
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

  uniqueMatches.sort((a, b) => a.index - b.index);

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  uniqueMatches.forEach((match, idx) => {
    if (match.index > lastIndex) {
      parts.push(address.substring(lastIndex, match.index));
    }
    parts.push(
      <span key={idx} className="text-blue-600 dark:text-blue-400 font-semibold">
        {match.text}
      </span>
    );
    lastIndex = match.index + match.length;
  });

  if (lastIndex < address.length) {
    parts.push(address.substring(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : address;
}

export default function BasketPanel({
  basket,
  selectedInstitution,
  onRemove,
  onRemoveEquipmentSerial,
  onClear,
  onMatch
}: BasketPanelProps) {
  // 기본값이 펼쳐진 상태이므로 접힌 항목만 추적
  const [collapsedBasketItems, setCollapsedBasketItems] = useState<Set<string>>(new Set());

  const toggleCollapsed = (managementNumber: string) => {
    setCollapsedBasketItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(managementNumber)) {
        newSet.delete(managementNumber);
      } else {
        newSet.add(managementNumber);
      }
      return newSet;
    });
  };

  const totalEquipment = basket.reduce((sum, item) => sum + item.equipment_count, 0);

  // 선택된 장비 개수 계산 (부분 매칭된 항목들의 선택된 장비만 카운트)
  const selectedEquipment = basket.reduce((sum, item) => {
    if (item.selected_serials) {
      return sum + item.selected_serials.length;
    }
    return sum;
  }, 0);

  // 부분 매칭 여부 (선택된 장비가 전체 장비보다 적음)
  const hasPartialMatch = selectedEquipment > 0 && selectedEquipment < totalEquipment;

  // Basket 유효성 검사 (Soft Rule) - Deep Validation
  const flattenedItems = basket.flatMap(item => {
    // 선택된 시리얼이 있는 경우, 해당 장비의 카테고리 정보를 사용
    if (item.selected_serials && item.selected_serials.length > 0 && item.equipment_details) {
      return item.equipment_details
        .filter(detail => item.selected_serials!.includes(detail.serial))
        .map(detail => ({
          category_1: detail.category_1,
          category_2: detail.category_2
        }));
    }
    // 선택된 시리얼이 없거나 정보가 없는 경우, 관리번호 레벨의 카테고리 사용
    return [{
      category_1: item.category_1,
      category_2: item.category_2
    }];
  });

  const basketValidation = validateBasket(flattenedItems);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 매칭 대상 의무기관 헤더 - basket에 항목이 있을 때만 표시 */}
      {selectedInstitution && basket.length > 0 && (
        <div className="flex-shrink-0 mb-2 p-2 bg-blue-50/50 dark:bg-blue-950/20 rounded border-2 border-blue-400">
          <div className="font-medium text-sm text-blue-600 dark:text-blue-400 truncate">
            {selectedInstitution.institution_name}
          </div>
        </div>
      )}

      {/* Basket Validation Warning */}
      {basketValidation.warning && (
        <div className="flex-shrink-0 mb-2 px-2">
          <Alert variant="destructive" className="py-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-xs font-bold ml-2">주의: 장비 유형 혼합</AlertTitle>
            <AlertDescription className="text-xs ml-2">
              {basketValidation.warning}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* 매칭 순환 아이콘 */}
      {selectedInstitution && basket.length > 0 && (
        <div className="flex my-1">
          {/* 좌측 1/3 지점 */}
          <div className="flex-1 flex justify-center items-center">
            <div className="rounded-full p-1 bg-blue-50 dark:bg-blue-900/20">
              <CornerLeftUp className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
            </div>
          </div>

          {/* 중앙 매칭하기 버튼 */}
          <div className="flex-1 flex justify-center items-center">
            {onMatch && (
              <Button
                size="sm"
                onClick={onMatch}
                disabled={!selectedInstitution}
                className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                매칭하기
              </Button>
            )}
          </div>

          {/* 우측 2/3 지점 */}
          <div className="flex-1 flex justify-center items-center">
            <div className="rounded-full p-1 bg-blue-50 dark:bg-blue-900/20">
              <CornerRightDown className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
            </div>
          </div>
        </div>
      )}

      {/* 담긴 항목 리스트 */}
      <div className="flex-1 overflow-auto">
        {basket.length === 0 ? (
          <div className="flex flex-col items-center justify-start h-full text-center pt-[20vh]">
            {/* ㄱ자 화살표 */}
            <div className="mb-6 flex justify-center">
              <svg width="100" height="80" viewBox="0 0 100 80" className="text-blue-500 dark:text-blue-400">
                {/* 화살표 시작 부분 - 점선 (3칸) */}
                <path
                  d="M 10 10 L 27 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="12"
                  strokeLinecap="butt"
                  strokeDasharray="3 4"
                />
                {/* 화살표 나머지 부분 - 실선 */}
                <path
                  d="M 27 10 L 55 10 Q 80 10, 80 35 L 80 54"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="12"
                  strokeLinecap="butt"
                />
                {/* 화살표 머리 - 각진 삼각형 (윗부분 수평선) */}
                <path
                  d="M 68 46 L 68 46 L 92 46 L 80 64 Z"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="miter"
                />
              </svg>
            </div>
            <div className="text-muted-foreground text-sm">
              {selectedInstitution ? (
                <>
                  <span className="text-primary font-medium">{selectedInstitution.institution_name}</span>
                  에 매칭할 대상을 담아주세요
                </>
              ) : (
                '매칭할 대상을 담아주세요'
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {basket.map((item) => {
              // 개별 장비가 모두 담긴 경우 완전 매칭으로 취급
              const isFullyMatchedByIndividual = item.selected_serials &&
                item.selected_serials.length === item.equipment_count;

              const isPartiallyMatched = item.selected_serials &&
                item.selected_serials.length > 0 &&
                item.selected_serials.length < item.equipment_count;

              return (
                <Card
                  key={item.management_number}
                  className={cn(
                    "p-1.5 transition-all hover:shadow-md",
                    isPartiallyMatched
                      ? "border border-amber-400 bg-amber-50/50 dark:bg-amber-950/20"
                      : "border border-green-400 bg-green-50/50 dark:bg-green-950/20",
                    item.is_matched && "opacity-50"
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-0.5">
                        {/* 기관명칭 */}
                        <div className="font-medium text-sm">
                          {highlightMatchingInstitutionName(item.institution_name, selectedInstitution?.institution_name)}
                        </div>
                        {/* 관리번호 + 분류1,2 */}
                        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                          <span className="font-mono">
                            {item.management_number}
                          </span>
                          {item.category_1 && (
                            <span>
                              {item.category_1 === '구비의무기관' ? '의무' : item.category_1}
                            </span>
                          )}
                          {item.category_2 && (
                            <span className={cn(
                              "border rounded px-1.5 py-0.5 text-xs",
                              isAmbulanceFromAED(item)
                                ? "border-red-500/50 text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-300"
                                : "border-gray-700/30"
                            )}>
                              {(() => {
                                if (isAmbulanceFromAED(item)) {
                                  const type = getAmbulanceType(item);
                                  if (type === '119구급대') return '119구급차';
                                  if (type === '의료기관') return '병원구급차';
                                  return '구급차';
                                }
                                return item.category_2;
                              })()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onRemove(item.management_number)}
                          className="h-auto text-xs px-1 py-0"
                        >
                          {item.equipment_count > 1 ? '모두비우기' : '비우기'}
                        </Button>
                        {item.confidence && (
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
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{highlightMatchingAddress(shortenAddressSido(item.address), selectedInstitution?.address)}</span>
                    </div>
                    {item.selected_serials ? (
                      <>
                        {/* 장비가 2개 이상인 경우에만 펼치기/접기 버튼 표시 */}
                        {item.selected_serials.length > 1 && (
                          <div className="flex items-center justify-center gap-2 mt-1">
                            {isPartiallyMatched && (
                              <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300">
                                부분 매칭
                              </Badge>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleCollapsed(item.management_number)}
                              className="text-xs"
                            >
                              {collapsedBasketItems.has(item.management_number) ? (
                                <>
                                  <ChevronDown className="h-3 w-3 mr-1" />
                                  장비연번 {item.selected_serials.length}대 펼치기(잔여 {item.equipment_count - item.selected_serials.length}대)
                                </>
                              ) : (
                                <>
                                  <ChevronUp className="h-3 w-3 mr-1" />
                                  장비연번 {item.selected_serials.length}대 접기(잔여 {item.equipment_count - item.selected_serials.length}대)
                                </>
                              )}
                            </Button>
                          </div>
                        )}

                        {/* 기본 펼쳐진 상태, 접기 버튼을 누른 경우만 숨김 */}
                        {(!collapsedBasketItems.has(item.management_number) || item.selected_serials.length === 1) && (
                          <div className="space-y-0 mt-1">
                            {item.selected_serials.map(serial => {
                              const equipmentDetail = item.equipment_details?.find(d => d.serial === serial);

                              // 고유키 일치 여부 확인
                              const isUniqueKeyMatched = selectedInstitution?.unique_key &&
                                equipmentDetail?.location_detail &&
                                equipmentDetail.location_detail.includes(selectedInstitution.unique_key);

                              return (
                                <div
                                  key={serial}
                                  className={cn(
                                    "flex items-center justify-between gap-1.5 p-1 rounded",
                                    isUniqueKeyMatched
                                      ? "bg-purple-100 dark:bg-purple-900/30 border border-purple-400 dark:border-purple-500"
                                      : "bg-muted/30"
                                  )}
                                >
                                  <div className="flex-1">
                                    <div className="text-xs leading-tight">
                                      {equipmentDetail?.location_detail && (
                                        <>
                                          <span className={cn(
                                            isUniqueKeyMatched
                                              ? "text-purple-600 dark:text-purple-400"
                                              : !isUniqueKeyMatched && selectedInstitution?.unique_key
                                                ? "text-red-600 dark:text-red-400"
                                                : "text-muted-foreground"
                                          )}>
                                            {highlightVehicleText(equipmentDetail.location_detail)}
                                          </span>
                                          <span className="text-muted-foreground mx-1">|</span>
                                        </>
                                      )}
                                      <span className={cn(
                                        "font-mono font-medium",
                                        isUniqueKeyMatched
                                          ? "text-purple-700 dark:text-purple-300"
                                          : !isUniqueKeyMatched && selectedInstitution?.unique_key
                                            ? "text-red-600 dark:text-red-400"
                                            : ""
                                      )}>{serial}</span>
                                    </div>
                                  </div>
                                  {item.selected_serials.length > 1 && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveEquipmentSerial(item.management_number, serial);
                                      }}
                                      className={cn(
                                        "h-auto text-xs px-1 py-0 flex-shrink-0",
                                        !isUniqueKeyMatched && selectedInstitution?.unique_key
                                          ? "bg-red-100 text-red-700 border-red-300 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-600"
                                          : "hover:bg-destructive/10 hover:text-destructive"
                                      )}
                                    >
                                      비우기
                                    </Button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              item.equipment_count > 1 && "cursor-pointer hover:bg-muted transition-colors"
                            )}
                            onClick={item.equipment_count > 1 ? () => toggleCollapsed(item.management_number) : undefined}
                          >
                            장비 {item.equipment_count}대{item.equipment_count > 1 && ' (클릭시 부분제외 가능)'}
                          </Badge>
                        </div>

                        {/* 전체 매칭된 상태에서 장비가 2개 이상인 경우 펼치기/접기 버튼 표시 */}
                        {item.equipment_count > 1 && (
                          <div className="flex justify-center mt-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleCollapsed(item.management_number)}
                              className="text-xs"
                            >
                              {collapsedBasketItems.has(item.management_number) ? (
                                <>
                                  <ChevronDown className="h-3 w-3 mr-1" />
                                  장비연번 {item.equipment_count}대 펼치기
                                </>
                              ) : (
                                <>
                                  <ChevronUp className="h-3 w-3 mr-1" />
                                  장비연번 {item.equipment_count}대 접기
                                </>
                              )}
                            </Button>
                          </div>
                        )}

                        {/* 전체 매칭된 상태의 장비 리스트 (펼쳐진 경우만 표시) */}
                        {(!collapsedBasketItems.has(item.management_number) || item.equipment_count === 1) && (
                          <div className="space-y-0.5 mt-1">
                            {item.equipment_serials.map(serial => {
                              const equipmentDetail = item.equipment_details?.find(d => d.serial === serial);

                              // 고유키 일치 여부 확인
                              const isUniqueKeyMatched = selectedInstitution?.unique_key &&
                                equipmentDetail?.location_detail &&
                                equipmentDetail.location_detail.includes(selectedInstitution.unique_key);

                              return (
                                <div
                                  key={serial}
                                  className={cn(
                                    "flex items-center justify-between gap-1.5 p-1.5 rounded",
                                    isUniqueKeyMatched
                                      ? "bg-purple-100 dark:bg-purple-900/30 border border-purple-400 dark:border-purple-500"
                                      : "bg-muted/30"
                                  )}
                                >
                                  <div className="flex-1">
                                    <div className="text-xs leading-tight">
                                      <span className={cn(
                                        "font-mono font-medium",
                                        isUniqueKeyMatched
                                          ? "text-purple-700 dark:text-purple-300"
                                          : !isUniqueKeyMatched && selectedInstitution?.unique_key
                                            ? "text-red-600 dark:text-red-400"
                                            : ""
                                      )}>{serial}</span>
                                      {equipmentDetail?.location_detail && (
                                        <span className={cn(
                                          "ml-1",
                                          isUniqueKeyMatched
                                            ? "text-purple-600 dark:text-purple-400"
                                            : !isUniqueKeyMatched && selectedInstitution?.unique_key
                                              ? "text-red-600 dark:text-red-400"
                                              : "text-muted-foreground"
                                        )}>
                                          {highlightVehicleText(equipmentDetail.location_detail)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {item.equipment_count > 1 && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveEquipmentSerial(item.management_number, serial);
                                      }}
                                      className={cn(
                                        "h-auto text-xs px-1.5 py-0.5 flex-shrink-0",
                                        !isUniqueKeyMatched && selectedInstitution?.unique_key
                                          ? "bg-red-100 text-red-700 border-red-300 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-600"
                                          : "hover:bg-destructive/10 hover:text-destructive"
                                      )}
                                    >
                                      비우기
                                    </Button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 액션 버튼 - 하단 고정 */}
      {basket.length > 0 && (
        <div className="flex-shrink-0 mt-4 pt-4 border-t">
          <Button
            className="w-full"
            size="sm"
            variant="outline"
            onClick={onClear}
          >
            매칭 리스트 비우기
          </Button>
        </div>
      )}
    </div>
  );
}
