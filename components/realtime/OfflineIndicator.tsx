/**
 * 오프라인 상태 표시 컴포넌트
 */

'use client'

import { useEffect, useState } from 'react'
import { WifiOff, Wifi, CloudOff, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface OfflineIndicatorProps {
  className?: string
  showDetails?: boolean
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'inline'
}

export function OfflineIndicator({
  className,
  showDetails = true,
  position = 'bottom-right'
}: OfflineIndicatorProps) {
  const [isOnline, setIsOnline] = useState(true)
  const [lastOfflineAt, setLastOfflineAt] = useState<Date | null>(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)

  useEffect(() => {
    // 초기 상태 설정
    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      setReconnectAttempts(0)
      console.log('온라인 상태로 전환되었습니다')
    }

    const handleOffline = () => {
      setIsOnline(false)
      setLastOfflineAt(new Date())
      console.log('오프라인 상태로 전환되었습니다')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // 주기적으로 연결 상태 확인 (fallback)
    const interval = setInterval(() => {
      const currentlyOnline = navigator.onLine

      if (!currentlyOnline && isOnline) {
        handleOffline()
      } else if (currentlyOnline && !isOnline) {
        handleOnline()
      }

      if (!currentlyOnline) {
        setReconnectAttempts(prev => prev + 1)
      }
    }, 5000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [isOnline])

  // 오프라인 지속 시간 계산
  const getOfflineDuration = () => {
    if (!lastOfflineAt) return ''

    const duration = Date.now() - lastOfflineAt.getTime()
    const seconds = Math.floor(duration / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}시간 ${minutes % 60}분`
    }
    if (minutes > 0) {
      return `${minutes}분 ${seconds % 60}초`
    }
    return `${seconds}초`
  }

  // 위치별 스타일
  const positionClasses = {
    'top-left': 'fixed top-4 left-4 z-50',
    'top-right': 'fixed top-4 right-4 z-50',
    'bottom-left': 'fixed bottom-4 left-4 z-50',
    'bottom-right': 'fixed bottom-4 right-4 z-50',
    'inline': 'relative'
  }

  // 온라인 상태면 표시하지 않음 (inline 제외)
  if (isOnline && position !== 'inline') {
    return null
  }

  // 인라인 모드에서의 간단한 표시
  if (position === 'inline') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {isOnline ? (
          <>
            <Wifi className="h-4 w-4 text-green-500" />
            <span className="text-sm text-green-700">온라인</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-700">오프라인</span>
          </>
        )}
      </div>
    )
  }

  // 플로팅 알림
  return (
    <div
      className={cn(
        'animate-in slide-in-from-bottom-2 fade-in duration-300',
        positionClasses[position],
        className
      )}
    >
      <div className="bg-red-50 border border-red-200 rounded-lg shadow-lg p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <WifiOff className="h-6 w-6 text-red-500" />
          </div>

          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-800">
              오프라인 모드
            </h3>

            {showDetails && (
              <>
                <p className="mt-1 text-xs text-red-600">
                  인터넷 연결이 끊어졌습니다.
                  작업은 로컬에 저장되며 연결 복구 시 자동으로 동기화됩니다.
                </p>

                <div className="mt-3 space-y-1 text-xs text-red-600">
                  {lastOfflineAt && (
                    <div className="flex items-center gap-1">
                      <CloudOff className="h-3 w-3" />
                      <span>오프라인 시간: {getOfflineDuration()}</span>
                    </div>
                  )}

                  {reconnectAttempts > 0 && (
                    <div className="flex items-center gap-1">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      <span>재연결 시도: {reconnectAttempts}회</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => window.location.reload()}
                    className="text-xs text-red-700 hover:text-red-900 underline"
                  >
                    페이지 새로고침
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}