'use client';

import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SectionErrorFallbackProps {
  error: Error;
  resetError: () => void;
  sectionName: string;
}

/**
 * 섹션별 에러 Fallback UI
 */
function SectionErrorFallback({ error, resetError, sectionName }: SectionErrorFallbackProps) {
  return (
    <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-6">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <AlertCircle className="w-6 h-6 text-yellow-500" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-white mb-1">
            {sectionName} 로딩 실패
          </h3>
          <p className="text-sm text-gray-400 mb-3">
            이 섹션을 불러오는 중 문제가 발생했습니다.
          </p>

          {process.env.NODE_ENV === 'development' && (
            <p className="text-xs text-red-400 font-mono bg-gray-800 p-2 rounded mb-3 break-all">
              {error.toString()}
            </p>
          )}

          <Button
            onClick={resetError}
            size="sm"
            variant="outline"
            className="border-gray-700 hover:bg-gray-800"
          >
            다시 시도
          </Button>
        </div>
      </div>
    </div>
  );
}

interface SectionErrorBoundaryProps {
  children: React.ReactNode;
  sectionName: string;
}

/**
 * SectionErrorBoundary
 *
 * 페이지의 특정 섹션에만 적용되는 Error Boundary
 * 전체 페이지가 아닌 해당 섹션만 오류 UI를 표시
 *
 * @example
 * <SectionErrorBoundary sectionName="대시보드 통계">
 *   <DashboardStats />
 * </SectionErrorBoundary>
 */
export function SectionErrorBoundary({ children, sectionName }: SectionErrorBoundaryProps) {
  const [resetKey, setResetKey] = React.useState(0);

  const handleReset = () => {
    setResetKey(prev => prev + 1);
  };

  return (
    <ErrorBoundary
      key={resetKey}
      fallback={
        <SectionErrorFallback
          error={new Error('Section error')}
          resetError={handleReset}
          sectionName={sectionName}
        />
      }
      onError={(error, errorInfo) => {
        console.error(`[SectionErrorBoundary: ${sectionName}]`, error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
