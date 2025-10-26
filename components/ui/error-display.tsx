'use client';

import { useState, useEffect } from 'react';
import { getErrorMessage, getErrorIcon, isRetryableError, type ErrorType } from '@/lib/utils/error-handler';

interface ErrorDisplayProps {
  error: unknown;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorDisplay({ error, onRetry, onDismiss, className = '' }: ErrorDisplayProps) {
  const [errorInfo, setErrorInfo] = useState(getErrorMessage(error));
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    setErrorInfo(getErrorMessage(error));
  }, [error]);

  const handleRetry = async () => {
    if (!onRetry) return;
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  const getErrorColorClass = (type: ErrorType) => {
    const colors: Record<ErrorType, string> = {
      'AUTH_ERROR': 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
      'VALIDATION_ERROR': 'bg-orange-500/10 border-orange-500/20 text-orange-400',
      'NETWORK_ERROR': 'bg-gray-500/10 border-gray-500/20 text-gray-400',
      'PERMISSION_ERROR': 'bg-red-500/10 border-red-500/20 text-red-400',
      'NOT_FOUND': 'bg-purple-500/10 border-purple-500/20 text-purple-400',
      'SERVER_ERROR': 'bg-red-500/10 border-red-500/20 text-red-400',
      'UNKNOWN_ERROR': 'bg-gray-500/10 border-gray-500/20 text-gray-400'
    };
    return colors[type] || colors.UNKNOWN_ERROR;
  };

  return (
    <div className={`rounded-lg border p-4 ${getErrorColorClass(errorInfo.type)} ${className}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0 mt-0.5">
          {getErrorIcon(errorInfo.type)}
        </span>
        <div className="flex-1">
          <h3 className="font-semibold text-white mb-1">{errorInfo.title}</h3>
          <p className="text-sm mb-2">{errorInfo.message}</p>
          {errorInfo.action && (
            <p className="text-xs opacity-80">{errorInfo.action}</p>
          )}

          <div className="flex gap-2 mt-4">
            {onRetry && isRetryableError(error) && (
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded text-xs font-medium transition-colors disabled:opacity-50"
              >
                {isRetrying ? '재시도 중...' : '다시 시도'}
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded text-xs font-medium transition-colors"
              >
                닫기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Toast 형태의 에러 표시
interface ErrorToastProps {
  error: unknown;
  duration?: number;
  onClose?: () => void;
}

export function ErrorToast({ error, duration = 5000, onClose }: ErrorToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 max-w-md z-50 animate-slide-up">
      <ErrorDisplay
        error={error}
        onDismiss={() => {
          setIsVisible(false);
          onClose?.();
        }}
      />
    </div>
  );
}