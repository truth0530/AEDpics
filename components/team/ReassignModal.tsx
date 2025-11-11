'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { TeamMemberSelector } from './TeamMemberSelector';
import { useToast } from '@/components/ui/Toast';

interface ReassignModalProps {
  assignmentIds: string[];
  onClose: () => void;
  onSuccess?: () => void;
}

export function ReassignModal({ assignmentIds, onClose, onSuccess }: ReassignModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  // TeamMemberSelector는 이제 배열을 반환하므로 처리 필요
  const handleUserSelection = (userIds: string[] | null) => {
    // 재배정은 단일 사용자만 선택 (배열의 첫 번째 요소 사용)
    if (userIds && userIds.length > 0) {
      setSelectedUserId(userIds[0]);
    } else {
      setSelectedUserId(null);
    }
  };

  const handleReassign = async () => {
    if (!selectedUserId) {
      showError('담당자를 선택해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/inspections/assignments/reassign', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assignmentIds,
          newAssignedTo: selectedUserId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '재배정에 실패했습니다.');
      }

      // 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: ['aed-data']
      });
      queryClient.invalidateQueries({
        queryKey: ['scheduled-equipment']
      });

      showSuccess(result.message || '일정이 재배정되었습니다.');
      onSuccess?.();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      showError('재배정 실패', { message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-2xl rounded-xl border border-gray-700 bg-gray-900 shadow-xl">
        <div className="px-6 py-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white mb-2">일정 재배정</h2>
            <p className="text-sm text-gray-400">
              선택한 {assignmentIds.length}개 일정의 담당자를 변경합니다
            </p>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            <TeamMemberSelector
              onSelect={handleUserSelection}
              defaultValue={null}
              showSelfOption={false}
            />
          </div>

          <div className="flex gap-3 mt-6 pt-6 border-t border-gray-700">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 text-gray-300 border-gray-600 hover:bg-gray-800"
              disabled={isSubmitting}
            >
              취소
            </Button>
            <Button
              onClick={handleReassign}
              disabled={isSubmitting || !selectedUserId}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? '재배정 중...' : '재배정'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
