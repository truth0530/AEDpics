'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle } from 'lucide-react';

interface DeleteInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipmentSerial: string;
  onConfirm: (reason: string) => Promise<void>;
}

export function DeleteInspectionModal({
  isOpen,
  onClose,
  equipmentSerial,
  onConfirm,
}: DeleteInspectionModalProps) {
  const [reason, setReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    if (!reason.trim()) {
      alert('삭제 사유를 입력해주세요.');
      return;
    }

    setIsDeleting(true);
    try {
      await onConfirm(reason);
      setReason('');
      onClose();
    } catch (error) {
      console.error('Failed to delete inspection:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-gray-900 text-gray-100 border-gray-700">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <DialogTitle className="text-lg font-semibold text-red-400">
              점검 이력 삭제 경고
            </DialogTitle>
          </div>
          <DialogDescription className="text-gray-400 mt-2">
            장비 연번: <span className="font-mono text-gray-300">{equipmentSerial}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm text-gray-300">
                <p className="font-semibold text-red-400">⚠️ 중요한 경고</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>점검 이력이 <strong>영구적으로 삭제</strong>됩니다.</li>
                  <li>삭제된 데이터는 <strong>복구할 수 없습니다</strong>.</li>
                  <li>감사 추적을 위해 <strong>삭제 사유가 기록</strong>됩니다.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">
              삭제 사유 <span className="text-red-400">*</span>
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[100px] bg-gray-800 border-gray-700 text-gray-100"
              placeholder="점검 이력을 삭제하는 사유를 상세히 입력해주세요..."
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
            className="bg-gray-800 hover:bg-gray-700"
          >
            취소
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isDeleting || !reason.trim()}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isDeleting ? '삭제 중...' : '확인 및 삭제'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
