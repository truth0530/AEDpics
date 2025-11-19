'use client';

import React from 'react';
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
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export type MatchingStrategy = 'add' | 'replace' | 'cancel';

interface MatchingConflict {
  equipment_serial: string;
  management_number: string;
  device_info: {
    institution_name: string;
    address: string;
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
  onConfirm: (strategy: MatchingStrategy) => void;
}

export function MatchingStrategyDialog({
  open,
  onOpenChange,
  conflictData,
  targetInstitutionName,
  onConfirm,
}: MatchingStrategyDialogProps) {
  if (!conflictData) return null;

  const { total_devices, matched_to_other, unmatched, already_matched_to_target, conflicts } = conflictData;

  // 부분 매칭 여부 판단 (전체 대비 일부만 매칭 시도)
  const isPartialMatching = matched_to_other > 0 && matched_to_other < total_devices;

  const handleStrategySelect = (strategy: MatchingStrategy) => {
    onConfirm(strategy);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            매칭 전략 선택
          </DialogTitle>
          <DialogDescription>
            선택한 장비 중 일부가 이미 다른 기관에 매칭되어 있습니다. 매칭 방식을 선택해주세요.
          </DialogDescription>
        </DialogHeader>

        {/* 통계 요약 */}
        <div className="grid grid-cols-4 gap-4 py-4">
          <div className="bg-slate-50 p-3 rounded-lg">
            <div className="text-sm text-slate-600">전체 장비</div>
            <div className="text-2xl font-bold">{total_devices}</div>
          </div>
          <div className="bg-green-50 p-3 rounded-lg">
            <div className="text-sm text-green-600">매칭 가능</div>
            <div className="text-2xl font-bold text-green-700">{unmatched}</div>
          </div>
          <div className="bg-amber-50 p-3 rounded-lg">
            <div className="text-sm text-amber-600">다른 기관 매칭</div>
            <div className="text-2xl font-bold text-amber-700">{matched_to_other}</div>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="text-sm text-blue-600">이미 매칭됨</div>
            <div className="text-2xl font-bold text-blue-700">{already_matched_to_target}</div>
          </div>
        </div>

        {/* 부분 매칭 경고 */}
        {isPartialMatching && (
          <Alert className="border-amber-200 bg-amber-50">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>주의:</strong> 전체 {total_devices}개 중 일부({matched_to_other}개)만 다른 기관에 매칭되어 있습니다.
              이는 대부분 실수로 발생한 일괄 매칭일 수 있습니다.
              <strong className="block mt-1">
                "기존 매칭 해제 후 이동" 옵션을 선택하면 이전 매칭을 정리하고 새로운 기관에 정확히 매칭할 수 있습니다.
              </strong>
            </AlertDescription>
          </Alert>
        )}

        {/* 충돌 상세 정보 */}
        {conflicts.length > 0 && (
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold mb-3">중복 매칭 상세 ({conflicts.length}개)</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {conflicts.map((conflict, idx) => (
                <div key={idx} className="bg-slate-50 p-3 rounded text-sm">
                  <div className="font-medium">{conflict.device_info.institution_name}</div>
                  <div className="text-slate-600 text-xs">{conflict.device_info.address}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    관리번호: {conflict.management_number}
                  </div>
                  <div className="mt-2 pl-3 border-l-2 border-amber-300">
                    <div className="text-xs font-semibold text-amber-700">기존 매칭 기관:</div>
                    {conflict.existing_matches
                      .filter((m) => !m.is_target_match)
                      .map((match, mIdx) => (
                        <div key={mIdx} className="text-xs text-slate-600">
                          • {match.institution_name} (관리번호: {match.management_number})
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 전략 선택 버튼 */}
        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button
            variant="default"
            onClick={() => handleStrategySelect('add')}
            className="w-full justify-start"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            <div className="text-left flex-1">
              <div className="font-semibold">중복 매칭 허용 (추가)</div>
              <div className="text-xs font-normal opacity-80">
                기존 매칭을 유지하고 "{targetInstitutionName}"에도 추가로 매칭합니다.
                (하나의 AED가 여러 기관에 매칭됩니다)
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            onClick={() => handleStrategySelect('replace')}
            className="w-full justify-start border-amber-300 hover:bg-amber-50"
          >
            <AlertTriangle className="mr-2 h-4 w-4 text-amber-600" />
            <div className="text-left flex-1">
              <div className="font-semibold">기존 매칭 해제 후 이동</div>
              <div className="text-xs font-normal opacity-80">
                다른 기관의 기존 매칭을 해제하고 "{targetInstitutionName}"에만 매칭합니다.
                {isPartialMatching && ' (부분 매칭 정리에 권장)'}
              </div>
            </div>
          </Button>

          <Button
            variant="ghost"
            onClick={() => handleStrategySelect('cancel')}
            className="w-full"
          >
            취소
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
