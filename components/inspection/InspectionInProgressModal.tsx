'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock } from 'lucide-react';
import { useMemo } from 'react';

interface InspectionInProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  inspectorName: string;
  equipmentSerial: string;
  isOwnSession: boolean;
  startedAt?: string;
  onResume?: () => void;
  onCancel?: () => void;
  onStartNew?: () => void;  // ✅ 새 세션 시작 콜백
  // 🔴 Phase B: inspection_status 추가 (정확한 상태 표시)
  inspectionStatus?: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'unavailable';
}

export function InspectionInProgressModal({
  isOpen,
  onClose,
  inspectorName,
  equipmentSerial,
  isOwnSession,
  startedAt,
  onResume,
  onCancel,
  onStartNew,  // ✅ 새 세션 시작
  inspectionStatus, // 🔴 Phase B
}: InspectionInProgressModalProps) {
  // 시작 시간과 경과 시간 계산
  const elapsedTime = useMemo(() => {
    if (!startedAt) return null;
    const startTime = new Date(startedAt);
    const now = new Date();
    const diffMs = now.getTime() - startTime.getTime();
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);

    const startTimeStr = startTime.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    return { startTimeStr, minutes, seconds };
  }, [startedAt]);
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-gray-900 text-gray-100 border-gray-700">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <DialogTitle className="text-lg font-semibold text-gray-100">
              {isOwnSession ? '점검 진행 중' : '다른 점검자가 점검 중'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-gray-400 mt-2">
            장비 연번: <span className="font-mono text-gray-300">{equipmentSerial}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* 🔴 Phase B: inspection_status에 따른 메시지 분기 */}
          {inspectionStatus === 'completed' ? (
            // 점검 완료 상태 - 수정 옵션 표시
            <div className="space-y-4">
              <p className="text-sm text-gray-300">
                이 장비의 점검이 <span className="font-semibold text-green-400">완료</span>되었습니다.
              </p>
              <div className="flex items-center gap-2 p-3 bg-green-900/20 rounded-md border border-green-700/50">
                <div className="text-sm text-green-300">
                  완료된 점검 기록을 수정하시려면 <span className="font-semibold">"수정"</span> 버튼을 클릭해주세요.
                </div>
              </div>
            </div>
          ) : isOwnSession ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-300">
                이전에 점검을 시작했으나 완료하지 않은 기록이 있습니다.
              </p>
              {elapsedTime && (
                <div className="flex items-center gap-2 p-3 bg-gray-800 rounded-md border border-gray-700">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <div className="text-sm">
                    <div className="text-gray-300">시작시간: <span className="font-mono text-gray-100">{elapsedTime.startTimeStr}</span></div>
                    <div className="text-gray-400">진행시간: <span className="font-mono text-gray-100">{elapsedTime.minutes}분 {elapsedTime.seconds}초</span></div>
                  </div>
                </div>
              )}
              <p className="text-sm text-gray-400">
                점검을 이어서 진행하시겠습니까?
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-300">
                이미 <span className="font-semibold text-yellow-400">{inspectorName}</span>님이 점검을 진행 중입니다.
              </p>
              {elapsedTime && (
                <div className="flex items-center gap-2 p-3 bg-gray-800 rounded-md border border-gray-700">
                  <Clock className="w-4 h-4 text-yellow-500" />
                  <div className="text-sm">
                    <div className="text-gray-300">담당자: <span className="font-semibold text-yellow-400">{inspectorName}</span></div>
                    <div className="text-gray-300">시작시간: <span className="font-mono text-gray-100">{elapsedTime.startTimeStr}</span></div>
                    <div className="text-gray-400">진행시간: <span className="font-mono text-gray-100">{elapsedTime.minutes}분 {elapsedTime.seconds}초</span></div>
                  </div>
                </div>
              )}
              <div className="p-3 bg-blue-900/20 rounded-md border border-blue-700/50">
                <p className="text-sm text-blue-300">
                  💡 기존 세션을 보류하고 새로운 점검을 시작할 수 있습니다.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          {/* 🔴 Phase B: inspection_status === 'completed' 시 확인 버튼만 표시 */}
          {inspectionStatus === 'completed' ? (
            <Button
              onClick={onClose}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              확인
            </Button>
          ) : isOwnSession ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  onCancel?.();
                  onClose();
                }}
                className="bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-gray-100 border-gray-600"
              >
                아니오, 점검 취소 처리
              </Button>
              <Button
                onClick={() => {
                  onResume?.();
                  onClose();
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                네, 이어서 진행
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  onStartNew?.();
                  onClose();
                }}
                className="bg-blue-800 text-blue-200 hover:bg-blue-700 hover:text-blue-100 border-blue-600"
              >
                새 점검 시작
              </Button>
              <Button
                onClick={onClose}
                className="bg-gray-700 hover:bg-gray-600 text-gray-100"
              >
                닫기
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
