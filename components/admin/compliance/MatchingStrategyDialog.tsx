'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export type MatchingStrategy = 'add' | 'replace' | 'cancel';

interface MatchingConflict {
  equipment_serial: string;
  management_number: string;
  device_info: {
    institution_name: string;
    address: string;
    installation_position?: string;
  };
  existing_matches: Array<{
    target_key: string;
    institution_name: string;
    management_number: string;
    matched_at: string;
    is_target_match: boolean;
  }>;
}

interface ConflictCheckResult {
  has_conflicts: boolean;
  total_devices: number;
  already_matched_to_target: number;
  matched_to_other: number;
  unmatched: number;
  conflicts: MatchingConflict[];
  summary: {
    message: string;
  };
}

interface MatchingStrategyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflictData: ConflictCheckResult | null;
  targetInstitutionName: string;
  onConfirm: (strategy: MatchingStrategy, removedSerials?: string[]) => void;
  onAddMore?: (removedSerials?: string[]) => void; // 추가 매칭 선택 시 호출
}

export function MatchingStrategyDialog({
  open,
  onOpenChange,
  conflictData,
  targetInstitutionName,
  onConfirm,
  onAddMore,
}: MatchingStrategyDialogProps) {
  // 제거된 장비연번 추적
  const [removedFromExisting, setRemovedFromExisting] = useState<Set<string>>(new Set());
  const [removedFromNew, setRemovedFromNew] = useState<Set<string>>(new Set());

  // 확인 다이얼로그 상태
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'replace' | 'cancel' | 'separate' | null;
    message: string;
    existingInstitutionName?: string;
  }>({
    open: false,
    type: null,
    message: '',
  });

  const { total_devices, matched_to_other, unmatched, already_matched_to_target, conflicts } = conflictData || {
    total_devices: 0,
    matched_to_other: 0,
    unmatched: 0,
    already_matched_to_target: 0,
    conflicts: [],
  };

  const handleStrategySelect = (strategy: MatchingStrategy) => {
    // removedFromExisting을 배열로 변환하여 전달
    const removedSerials = Array.from(removedFromExisting);
    onConfirm(strategy, removedSerials.length > 0 ? removedSerials : undefined);
    onOpenChange(false);
    // 다이얼로그 닫을 때 상태 초기화
    setRemovedFromExisting(new Set());
    setRemovedFromNew(new Set());
  };

  // 기존 매칭 정보 수집
  const existingMatches = conflicts.flatMap((conflict) =>
    conflict.existing_matches
      .filter((m) => !m.is_target_match)
      .map((match) => ({
        institution_name: match.institution_name,
        management_number: conflict.management_number,
        equipment_serial: conflict.equipment_serial,
        address: conflict.device_info.address,
        installation_position: conflict.device_info.installation_position,
      }))
  );

  // 기존 매칭 기관별 그룹화 (주소 정보 포함)
  const existingMatchesByInstitution = existingMatches.reduce((acc, item) => {
    if (!acc[item.institution_name]) {
      acc[item.institution_name] = {
        address: item.address,
        management_number: item.management_number,
        devices: []
      };
    }
    acc[item.institution_name].devices.push(item);
    return acc;
  }, {} as Record<string, { address: string; management_number: string; devices: typeof existingMatches }>);

  // 새로 매칭할 장비 목록
  const newMatchingDevices = conflicts.map((conflict) => ({
    equipment_serial: conflict.equipment_serial,
    management_number: conflict.management_number,
    address: conflict.device_info.address,
    installation_position: conflict.device_info.installation_position,
  }));

  // 좌우 섹션에서 공통으로 나타나는 장비연번 Set 생성
  const existingSerials = new Set(existingMatches.map(m => m.equipment_serial));
  const newSerials = new Set(newMatchingDevices.map(d => d.equipment_serial));
  const commonSerials = new Set(
    [...existingSerials].filter(serial => newSerials.has(serial))
  );

  // 활성 장비 계산 (제거되지 않은 장비만)
  const activeExistingDevices = useMemo(() =>
    existingMatches.filter(m => !removedFromExisting.has(m.equipment_serial)),
    [existingMatches, removedFromExisting]
  );

  const activeNewDevices = useMemo(() =>
    newMatchingDevices.filter(d => !removedFromNew.has(d.equipment_serial)),
    [newMatchingDevices, removedFromNew]
  );

  // 활성 장비 간 겹침 확인
  const activeExistingSerials = new Set(activeExistingDevices.map(m => m.equipment_serial));
  const activeNewSerials = new Set(activeNewDevices.map(d => d.equipment_serial));
  const hasOverlap = [...activeExistingSerials].some(serial => activeNewSerials.has(serial));

  // 제거 핸들러
  const handleRemoveFromExisting = (serial: string) => {
    setRemovedFromExisting(prev => new Set([...prev, serial]));
  };

  const handleRemoveAllFromExisting = (institutionName: string) => {
    const devicesToRemove = existingMatches
      .filter(m => m.institution_name === institutionName)
      .map(m => m.equipment_serial);
    setRemovedFromExisting(prev => new Set([...prev, ...devicesToRemove]));
  };

  const handleRemoveFromNew = (serial: string) => {
    setRemovedFromNew(prev => new Set([...prev, serial]));
  };

  const handleRemoveAllFromNew = () => {
    const allNewSerials = newMatchingDevices.map(d => d.equipment_serial);
    setRemovedFromNew(new Set(allNewSerials));
  };

  // 비워진 장비를 다시 담기
  const handleAddBackToNew = (serial: string) => {
    setRemovedFromNew(prev => {
      const newSet = new Set(prev);
      newSet.delete(serial);
      return newSet;
    });
  };

  // 기존에서 매칭취소된 장비를 새 매칭으로 담기
  const handleAddToNewFromExisting = (serial: string) => {
    // 이 장비가 이미 새 매칭 목록에 있으면 removedFromNew에서 제거
    if (newSerials.has(serial)) {
      setRemovedFromNew(prev => {
        const newSet = new Set(prev);
        newSet.delete(serial);
        return newSet;
      });
    }
    // 기존 매칭에서는 제거 상태 유지
  };

  // 추가 매칭 선택 핸들러
  const handleAddMoreClick = () => {
    if (onAddMore) {
      // removedFromExisting을 배열로 변환하여 전달
      const removedSerials = Array.from(removedFromExisting);
      onAddMore(removedSerials.length > 0 ? removedSerials : undefined);
    }
    onOpenChange(false);
    // 상태 초기화
    setRemovedFromExisting(new Set());
    setRemovedFromNew(new Set());
  };

  // 시나리오 감지 및 처리
  const handlePrimaryAction = () => {
    // Scenario 3: 우측이 완전히 비워진 경우
    if (activeNewDevices.length === 0) {
      setConfirmDialog({
        open: true,
        type: 'cancel',
        message: '중복 매칭 대상이 없습니다. 작업을 취소하겠습니다.',
      });
      return;
    }

    // Scenario 1: 좌측이 완전히 비워진 경우
    if (activeExistingDevices.length === 0) {
      const existingInstitutionName = Object.keys(existingMatchesByInstitution)[0];
      setConfirmDialog({
        open: true,
        type: 'replace',
        message: `기존에 매칭한 ${existingInstitutionName} 기관의 매칭기록을 삭제하고 이번에 매칭하려는 ${targetInstitutionName} 기관으로 대체합니다.`,
        existingInstitutionName,
      });
      return;
    }

    // Scenario 2: 겹치지 않는 경우 (각각 분리하여 매칭)
    if (!hasOverlap) {
      handleStrategySelect('add'); // 각각 분리하여 매칭 실행
      return;
    }

    // 기본: 중복 매칭 허용
    handleStrategySelect('add');
  };

  // 확인 다이얼로그 액션 처리
  const handleConfirmDialogAction = () => {
    if (confirmDialog.type === 'replace') {
      handleStrategySelect('replace');
    } else if (confirmDialog.type === 'cancel') {
      handleStrategySelect('cancel');
    }
    setConfirmDialog({ open: false, type: null, message: '' });
  };

  console.log('[MatchingStrategyDialog] Debug:', {
    targetInstitutionName,
    conflictsCount: conflicts.length,
    newMatchingDevicesCount: newMatchingDevices.length,
    firstConflict: conflicts[0],
    newMatchingDevices: newMatchingDevices,
    existingMatchesByInstitution: existingMatchesByInstitution,
    commonSerials: [...commonSerials],
    activeExistingCount: activeExistingDevices.length,
    activeNewCount: activeNewDevices.length,
    hasOverlap,
  });

  if (!conflictData) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[55vw] sm:max-w-[55vw] md:max-w-[55vw] lg:max-w-[55vw] xl:max-w-[55vw] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            중복 매칭 확인
          </DialogTitle>
          <DialogDescription className="text-sm">
            일부 장비가 다른 기관에 이미 매칭되어 있습니다. 처리 방법을 선택하세요.
          </DialogDescription>
        </DialogHeader>

        {/* 기존 매칭 vs 새 매칭 비교 섹션 */}
        <div className="grid grid-cols-2 gap-4 pt-4 flex-1 overflow-hidden">
          {/* 좌측: 기존에 매칭한 의무기관 리스트 */}
          <div className="border border-gray-700 rounded-lg overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-2">
              {Object.entries(existingMatchesByInstitution).map(([institutionName, data]) => (
                <div key={institutionName} className="border border-gray-700 rounded-md overflow-hidden">
                  {/* 헤더: 제목 + 기관명 */}
                  <div className="bg-amber-900/30 border-b border-amber-700/50 px-3 py-2">
                    <div className="text-xs font-semibold text-amber-300/80 mb-1">기존에 매칭한 의무기관 리스트</div>
                    <div className="font-semibold text-sm text-amber-400">{institutionName}</div>
                  </div>
                  {/* AED 데이터 본문 */}
                  <div className="bg-gray-900/20 px-2 py-2">
                    {/* 주소 및 관리번호 */}
                    <div className="text-xs text-gray-400 mb-2 space-y-0.5">
                      <div className="truncate">주소: {(data as any).address}</div>
                      <div>관리번호: {(data as any).management_number}</div>
                    </div>
                    {/* 모두 매칭취소 버튼 */}
                    <div className="mb-2 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950"
                        onClick={() => handleRemoveAllFromExisting(institutionName)}
                      >
                        모두 매칭취소
                      </Button>
                    </div>
                    {/* 장비연번 목록 */}
                    <div className="space-y-0.5">
                      {(data as any).devices.map((device: any, idx: number) => {
                        const isCommon = hasOverlap && commonSerials.has(device.equipment_serial);
                        const isRemoved = removedFromExisting.has(device.equipment_serial);
                        if (isRemoved) return null;
                        return (
                          <div key={idx} className="flex items-center justify-between text-xs py-0.5 hover:bg-gray-800 px-1 rounded">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs leading-tight">
                                <span className={`font-mono font-medium ${isCommon ? 'text-blue-400' : ''}`}>
                                  {device.equipment_serial}
                                </span>
                                {device.installation_position && (
                                  <>
                                    <span className="text-muted-foreground mx-1">|</span>
                                    <span className={isCommon ? 'text-blue-400/80' : 'text-muted-foreground'}>
                                      {device.installation_position}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950 ml-2 flex-shrink-0"
                              onClick={() => handleRemoveFromExisting(device.equipment_serial)}
                            >
                              매칭취소
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                    {/* 매칭취소된 장비 (담기 가능) */}
                    {(data as any).devices.some((device: any) => removedFromExisting.has(device.equipment_serial)) && (
                      <div className="mt-2 pt-2 border-t border-gray-700">
                        <div className="text-xs text-gray-500 mb-1">매칭취소된 장비 ({(data as any).devices.filter((d: any) => removedFromExisting.has(d.equipment_serial)).length}대)</div>
                        <div className="space-y-0.5">
                          {(data as any).devices.map((device: any, idx: number) => {
                            if (!removedFromExisting.has(device.equipment_serial)) return null;
                            return (
                              <div key={idx} className="flex items-center justify-between text-xs py-0.5 bg-gray-800/50 border border-gray-700/30 px-1 rounded">
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs leading-tight">
                                    <span className="font-mono font-medium text-gray-500">
                                      {device.equipment_serial}
                                    </span>
                                    {device.installation_position && (
                                      <>
                                        <span className="text-gray-600 mx-1">|</span>
                                        <span className="text-gray-600">
                                          {device.installation_position}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs text-green-400 hover:text-green-300 hover:bg-green-950 ml-2 flex-shrink-0"
                                  onClick={() => handleAddToNewFromExisting(device.equipment_serial)}
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
              ))}
            </div>
          </div>

          {/* 우측: 이번에 매칭하려는 의무기관 리스트 */}
          <div className="border border-gray-700 rounded-lg overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <div className="border border-gray-700 rounded-md overflow-hidden">
                {/* 헤더: 제목 + 기관명 */}
                <div className="bg-blue-900/30 border-b border-blue-700/50 px-3 py-2">
                  <div className="text-xs font-semibold text-blue-300/80 mb-1">이번에 매칭하려는 의무기관 리스트</div>
                  <div className="font-semibold text-sm text-blue-400">{targetInstitutionName}</div>
                </div>
                {/* AED 데이터 본문 */}
                <div className="bg-gray-900/20 px-2 py-2">
                  {/* 주소 및 관리번호 */}
                  {newMatchingDevices.length > 0 && (
                    <div className="text-xs text-gray-400 mb-2 space-y-0.5">
                      {newMatchingDevices[0].address && (
                        <div className="truncate">주소: {newMatchingDevices[0].address}</div>
                      )}
                      {newMatchingDevices[0].management_number && (
                        <div>관리번호: {[...new Set(newMatchingDevices.map(d => d.management_number))].join(', ')}</div>
                      )}
                    </div>
                  )}
                  {/* 모두 비우기 버튼 */}
                  <div className="mb-2 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950"
                      onClick={handleRemoveAllFromNew}
                    >
                      모두 비우기
                    </Button>
                  </div>
                  {/* 담긴 장비 */}
                  {activeNewDevices.length > 0 && (
                    <div className="mb-2">
                      <div className="text-xs text-green-400 mb-1">담긴 장비 ({activeNewDevices.length}대)</div>
                      <div className="space-y-0.5">
                        {newMatchingDevices.map((device, idx) => {
                          const isCommon = hasOverlap && commonSerials.has(device.equipment_serial);
                          const isRemoved = removedFromNew.has(device.equipment_serial);
                          if (isRemoved) return null;
                          return (
                            <div key={idx} className="flex items-center justify-between text-xs py-0.5 bg-green-900/20 border border-green-700/30 px-1 rounded">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs leading-tight">
                                  <span className={`font-mono font-medium ${isCommon ? 'text-blue-400' : ''}`}>
                                    {device.equipment_serial}
                                  </span>
                                  {device.installation_position && (
                                    <>
                                      <span className="text-muted-foreground mx-1">|</span>
                                      <span className={isCommon ? 'text-blue-400/80' : 'text-muted-foreground'}>
                                        {device.installation_position}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950 ml-2 flex-shrink-0"
                                onClick={() => handleRemoveFromNew(device.equipment_serial)}
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
                  {removedFromNew.size > 0 && (
                    <div>
                      <div className="text-xs text-gray-500 mb-1">비워진 장비 ({removedFromNew.size}대)</div>
                      <div className="space-y-0.5">
                        {newMatchingDevices.map((device, idx) => {
                          if (!removedFromNew.has(device.equipment_serial)) return null;
                          return (
                            <div key={idx} className="flex items-center justify-between text-xs py-0.5 bg-gray-800/50 border border-gray-700/30 px-1 rounded">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs leading-tight">
                                  <span className="font-mono font-medium text-gray-500">
                                    {device.equipment_serial}
                                  </span>
                                  {device.installation_position && (
                                    <>
                                      <span className="text-gray-600 mx-1">|</span>
                                      <span className="text-gray-600">
                                        {device.installation_position}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-green-400 hover:text-green-300 hover:bg-green-950 ml-2 flex-shrink-0"
                                onClick={() => handleAddBackToNew(device.equipment_serial)}
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

        {/* 추가 매칭 질문 */}
        {onAddMore && (
          <div className="border border-gray-600 rounded-lg p-3 mt-3 bg-gray-800/30">
            <div className="text-sm text-center mb-2">추가로 매칭할 장비가 있습니까?</div>
            <div className="flex justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddMoreClick}
                disabled={activeNewDevices.length === 0}
                className="px-6"
              >
                예
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handlePrimaryAction}
                disabled={activeExistingDevices.length === 0 && activeNewDevices.length === 0}
                className="px-6 bg-blue-600 hover:bg-blue-700"
              >
                아니오
              </Button>
            </div>
          </div>
        )}

        {/* 하단 버튼 */}
        <div className="flex gap-2 justify-end pt-3">
          <Button
            variant="outline"
            onClick={() => handleStrategySelect('cancel')}
            className="px-4 py-2 h-auto text-sm"
          >
            취소
          </Button>

          {!onAddMore && (
            <Button
              variant="default"
              onClick={handlePrimaryAction}
              disabled={activeExistingDevices.length === 0 && activeNewDevices.length === 0}
              className="px-4 py-2 h-auto text-sm bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!hasOverlap && activeExistingDevices.length > 0 && activeNewDevices.length > 0
                ? '각각 분리하여 매칭'
                : '중복 매칭 허용'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* 확인 다이얼로그 */}
    <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>확인</AlertDialogTitle>
          <AlertDialogDescription>
            {confirmDialog.message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirmDialog({ open: false, type: null, message: '' })}>
            취소
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmDialogAction}>
            확인
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
