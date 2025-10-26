'use client';

import { useEffect } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  type?: 'warning' | 'danger' | 'info';
  confirmText?: string;
  cancelText?: string;
  details?: string[];
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'warning',
  confirmText = '확인',
  cancelText = '취소',
  details = []
}: ConfirmDialogProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const typeStyles = {
    warning: {
      icon: '⚠️',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/50',
      textColor: 'text-yellow-400',
      buttonBg: 'bg-yellow-600 hover:bg-yellow-700'
    },
    danger: {
      icon: '❌',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/50',
      textColor: 'text-red-400',
      buttonBg: 'bg-red-600 hover:bg-red-700'
    },
    info: {
      icon: 'ℹ️',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/50',
      textColor: 'text-blue-400',
      buttonBg: 'bg-blue-600 hover:bg-blue-700'
    }
  };

  const style = typeStyles[type];

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-4 border-b ${style.borderColor} ${style.bgColor}`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{style.icon}</span>
            <h2 className={`text-lg font-semibold ${style.textColor}`}>
              {title}
            </h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-gray-300 leading-relaxed">
            {message}
          </p>

          {details.length > 0 && (
            <ul className="space-y-2 mt-4">
              {details.map((detail, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-400">
                  <span className="mt-0.5">{detail.startsWith('✅') ? '✅' : '❌'}</span>
                  <span>{detail.replace(/^[✅❌]\s*/, '')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-700 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 rounded-lg ${style.buttonBg} text-white transition-colors font-medium`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
