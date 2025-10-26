'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary
 *
 * React 컴포넌트 트리에서 발생하는 JavaScript 에러를 catch하여
 * 전체 앱이 충돌하는 것을 방지합니다.
 *
 * @example
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);

    // 사용자 정의 에러 핸들러 호출
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // 프로덕션 환경에서는 에러 모니터링 서비스로 전송
    // 예: Sentry, Datadog 등
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to error monitoring service
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      // 사용자 정의 fallback이 있으면 사용
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 기본 에러 UI
      return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4" role="alert" aria-live="assertive">
          <div className="max-w-md w-full">
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 text-center">
              <div className="flex justify-center mb-4" aria-hidden="true">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
              </div>

              <h2 className="text-xl font-semibold text-white mb-2" id="error-title">
                문제가 발생했습니다
              </h2>

              <p className="text-gray-400 mb-6" id="error-description">
                일시적인 오류가 발생했습니다. 페이지를 새로고침하거나 잠시 후 다시 시도해주세요.
              </p>

              {/* 개발 환경에서만 에러 메시지 표시 */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="bg-gray-800 rounded p-4 mb-6 text-left">
                  <p className="text-xs text-red-400 font-mono break-all">
                    {this.state.error.toString()}
                  </p>
                </div>
              )}

              <div className="flex gap-3 justify-center">
                <Button
                  onClick={this.handleReset}
                  variant="outline"
                  className="border-gray-700 hover:bg-gray-800"
                >
                  다시 시도
                </Button>

                <Button
                  onClick={this.handleReload}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  페이지 새로고침
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
