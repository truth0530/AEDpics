'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EquipmentDetail {
  serial: string;
  location_detail: string;
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
}

interface TargetInstitution {
  target_key: string;
  institution_name: string;
  address?: string;
}

interface BasketPanelProps {
  basket: BasketItem[];
  selectedInstitution: TargetInstitution | null;
  onRemove: (managementNumber: string) => void;
  onRemoveEquipmentSerial: (managementNumber: string, serial: string) => void;
  onClear: () => void;
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
        <span className="text-yellow-600 dark:text-yellow-400 font-semibold">{matched}</span>
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
      <span key={idx} className="text-yellow-600 dark:text-yellow-400 font-semibold">
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
      <span key={idx} className="text-yellow-600 dark:text-yellow-400 font-semibold">
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
  onClear
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 통계 정보 - 상단 고정 */}
      {basket.length > 0 && (
        <div className="flex-shrink-0 grid grid-cols-2 gap-2 mb-2">
          <Card className="p-1.5">
            <div className="text-xs text-muted-foreground">관리번호</div>
            <div className="text-lg font-bold">{basket.length}개</div>
          </Card>
          <Card className="p-1.5">
            <div className="text-xs text-muted-foreground">총 장비</div>
            <div className="text-lg font-bold">
              {hasPartialMatch ? `${totalEquipment}대중 ${selectedEquipment}대` : `${totalEquipment}대`}
            </div>
          </Card>
        </div>
      )}

      {/* 담긴 항목 리스트 */}
      <div className="flex-1 overflow-auto">
        {basket.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="text-muted-foreground text-sm">
              {selectedInstitution ? (
                <>
                  <span className="text-primary font-medium">{selectedInstitution.institution_name}</span>
                  에 아직 매칭된 항목이 없습니다
                </>
              ) : (
                '매칭된 항목이 없습니다'
              )}
            </div>
            <div className="text-muted-foreground text-xs mt-2">
              좌측에서 관리번호를 선택하여<br />매칭 리스트에 추가해주세요
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
                    "p-2 transition-all hover:shadow-md",
                    isPartiallyMatched
                      ? "border-2 border-amber-400 bg-amber-50/50 dark:bg-amber-950/20"
                      : "border-2 border-green-400 bg-green-50/50 dark:bg-green-950/20"
                  )}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm">
                          관리번호 {item.management_number}
                          {item.confidence && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {item.confidence.toFixed(0)}%
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {highlightMatchingInstitutionName(item.institution_name, selectedInstitution?.institution_name)}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRemove(item.management_number)}
                        className="text-xs px-2 py-1"
                      >
                        비우기
                      </Button>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{highlightMatchingAddress(item.address, selectedInstitution?.address)}</span>
                    </div>
                    {item.selected_serials ? (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-muted-foreground">
                            장비 {item.equipment_count}대중 {item.selected_serials.length}대:
                          </div>
                          {isPartiallyMatched && (
                            <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300">
                              부분 매칭
                            </Badge>
                          )}
                        </div>

                        {/* 장비가 2개 이상인 경우에만 펼치기/접기 버튼 표시 */}
                        {item.selected_serials.length > 1 && (
                          <div className="flex justify-center mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleCollapsed(item.management_number)}
                              className="text-xs"
                            >
                              {collapsedBasketItems.has(item.management_number) ? (
                                <>
                                  <ChevronDown className="h-3 w-3 mr-1" />
                                  장비연번 {item.selected_serials.length}대 펼치기
                                </>
                              ) : (
                                <>
                                  <ChevronUp className="h-3 w-3 mr-1" />
                                  장비연번 {item.selected_serials.length}대 접기
                                </>
                              )}
                            </Button>
                          </div>
                        )}

                        {/* 기본 펼쳐진 상태, 접기 버튼을 누른 경우만 숨김 */}
                        {(!collapsedBasketItems.has(item.management_number) || item.selected_serials.length === 1) && (
                          <div className="space-y-1 mt-2">
                            {item.selected_serials.map(serial => {
                              const equipmentDetail = item.equipment_details?.find(d => d.serial === serial);

                              return (
                                <div
                                  key={serial}
                                  className="flex items-start justify-between gap-2 p-2 bg-muted/30 rounded"
                                >
                                  <div className="flex-1">
                                    <div className="text-xs">
                                      <span className="font-mono font-medium">{serial}</span>
                                      {equipmentDetail?.location_detail && (
                                        <span className="ml-1.5 text-muted-foreground">
                                          {highlightVehicleText(equipmentDetail.location_detail)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRemoveEquipmentSerial(item.management_number, serial);
                                    }}
                                    className="text-xs px-2 py-1 flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
                                  >
                                    비우기
                                  </Button>
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
                          <div className="flex justify-center mt-2">
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
                          <div className="space-y-1 mt-2">
                            {item.equipment_serials.map(serial => {
                              const equipmentDetail = item.equipment_details?.find(d => d.serial === serial);

                              return (
                                <div
                                  key={serial}
                                  className="flex items-start justify-between gap-2 p-2 bg-muted/30 rounded"
                                >
                                  <div className="flex-1">
                                    <div className="text-xs">
                                      <span className="font-mono font-medium">{serial}</span>
                                      {equipmentDetail?.location_detail && (
                                        <span className="ml-1.5 text-muted-foreground">
                                          {highlightVehicleText(equipmentDetail.location_detail)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRemoveEquipmentSerial(item.management_number, serial);
                                    }}
                                    className="text-xs px-2 py-1 flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
                                  >
                                    비우기
                                  </Button>
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
