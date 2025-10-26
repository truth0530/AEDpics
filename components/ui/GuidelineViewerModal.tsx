'use client';

import React, { useEffect } from 'react';
import { XMarkIcon, ArrowTopRightOnSquareIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

const PDF_URL = '/api/guidelines/pdf';

type GuidelineViewerModalProps = {
  open: boolean;
  onClose: () => void;
};

const GuidelineViewerModal: React.FC<GuidelineViewerModalProps> = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex flex-col gap-3 border-b border-slate-800 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white sm:text-lg">
              자동심장충격기 설치 및 관리 지침 (제7판)
            </h2>
            <p className="mt-1 text-xs text-slate-400 sm:text-sm">
              점검 중 참고용으로 지침을 열람한 뒤 닫으면 현재 화면이 그대로 유지됩니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={PDF_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-white transition hover:border-slate-500 hover:bg-slate-700 sm:text-sm"
            >
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              새 창에서 보기
            </a>
            <a
              href={PDF_URL}
              download
              className="inline-flex items-center gap-1 rounded-md border border-emerald-600 bg-emerald-600/20 px-3 py-2 text-xs font-medium text-emerald-200 transition hover:border-emerald-500 hover:bg-emerald-500/20 hover:text-emerald-100 sm:text-sm"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              다운로드
            </a>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-800 p-2 text-slate-200 transition hover:border-slate-500 hover:bg-slate-700"
              aria-label="지침 닫기"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 bg-black">
          <object
            data={`${PDF_URL}#view=FitH`}
            type="application/pdf"
            aria-label="자동심장충격기 설치 및 관리 지침 (제7판)"
            className="h-full w-full"
          >
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center text-sm text-slate-200">
              <p>브라우저에서 PDF 미리보기를 지원하지 않습니다.</p>
              <a
                href={PDF_URL}
                download
                className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-4 py-2 font-medium text-white transition hover:border-slate-500 hover:bg-slate-700"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
                PDF 다운로드
              </a>
            </div>
          </object>
        </div>
      </div>
    </div>
  );
};

export default GuidelineViewerModal;
