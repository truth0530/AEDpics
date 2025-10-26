'use client';

import { useState } from 'react';

interface IssueNoteModalProps {
  step: string;
  field: string;
  fieldLabel: string;
  issueValue: string;
  defaultNote?: string;
  onSave: (note: string) => void;
  onClose: () => void;
}

export function IssueNoteModal({
  step,
  field,
  fieldLabel,
  issueValue,
  defaultNote = '',
  onSave,
  onClose,
}: IssueNoteModalProps) {
  const [note, setNote] = useState(defaultNote);

  const handleSave = () => {
    if (note.trim()) {
      onSave(note.trim());
      onClose();
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700/50 bg-yellow-900/20">
          <div className="flex items-center gap-2">
            <span className="text-yellow-400 text-lg">⚠️</span>
            <h3 className="text-sm font-semibold text-yellow-300">이상 사항 메모</h3>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* 항목 정보 */}
          <div className="rounded-lg bg-gray-800/50 border border-gray-700 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">항목</span>
              <span className="text-sm font-medium text-gray-200">{fieldLabel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">상태</span>
              <span className="text-sm font-medium text-yellow-400">{issueValue}</span>
            </div>
          </div>

          {/* 메모 입력 */}
          <div>
            <label htmlFor="issue-note" className="block text-xs font-medium text-gray-300 mb-2">
              조치사항 또는 메모 (선택사항)
            </label>
            <textarea
              id="issue-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              className="block w-full rounded-lg px-3 py-2 bg-gray-800 border border-gray-600 text-sm text-white placeholder-gray-500 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 resize-none"
              placeholder="예: 배터리 교체 필요, 현장 확인 결과..."
              autoFocus
            />
            <p className="mt-1 text-xs text-gray-500">
              이 메모는 나중에 보고서에 포함됩니다.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-700/50 bg-gray-800/30 flex gap-2">
          <button
            type="button"
            onClick={handleSkip}
            className="flex-1 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300 text-sm font-medium transition-colors"
          >
            건너뛰기
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!note.trim()}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              note.trim()
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
