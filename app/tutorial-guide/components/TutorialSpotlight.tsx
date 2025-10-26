'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SpotlightProps {
  step: number;
  targetSelector: string;
  message: string;
  title?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  onNext: () => void;
  showSkip?: boolean;
  showNext?: boolean;
  onSkip?: () => void;
}

export function TutorialSpotlight({
  step,
  targetSelector,
  message,
  title = '튜토리얼',
  position = 'bottom',
  onNext,
  showSkip = true,
  showNext = true,
  onSkip,
}: SpotlightProps) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateTargetPosition = () => {
      const element = document.querySelector(targetSelector);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
        setIsVisible(true);

        // Step 10(완료 모달)에서만 spotlight 클래스를 추가하지 않음
        // Step 1, 6 모바일에서도 클래스 추가 안 함 (네비게이션 바의 stacking context 때문)
        const isMobile = window.innerWidth < 768;
        const isBottomNav = isMobile && (step === 1 || step === 6);
        const hideSpotlight = step === 10 || isBottomNav;

        if (!hideSpotlight) {
          // 타겟 요소에 spotlight 클래스 추가
          element.classList.add('tutorial-spotlight-target');
        }
      } else {
        setIsVisible(false);
      }
    };

    // 초기 위치 설정
    updateTargetPosition();

    // 리사이즈 및 스크롤 이벤트 감지
    window.addEventListener('resize', updateTargetPosition);
    window.addEventListener('scroll', updateTargetPosition, true);

    return () => {
      window.removeEventListener('resize', updateTargetPosition);
      window.removeEventListener('scroll', updateTargetPosition, true);

      // 클래스 제거
      const element = document.querySelector(targetSelector);
      if (element) {
        element.classList.remove('tutorial-spotlight-target');
      }
    };
  }, [targetSelector, step]);

  if (!isVisible || !targetRect) {
    return null;
  }

  // 말풍선 위치 계산
  const getTooltipPosition = () => {
    const padding = 20;
    const isMobile = window.innerWidth < 768;
    const tooltipWidth = isMobile ? Math.min(window.innerWidth - 32, 320) : 320; // 모바일: 양쪽 16px 여백
    const tooltipHeight = 160; // 건너뛰기 버튼 제거로 높이 감소

    // 하단 네비게이션바인 경우 (화면 하단 64px 내에 위치)
    const isBottomNav = targetRect.bottom > window.innerHeight - 80;

    if (isBottomNav && isMobile) {
      // 모바일 하단 네비게이션바: 툴팁을 타겟 위에 표시
      return {
        top: targetRect.top - tooltipHeight - padding,
        left: Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, targetRect.left + targetRect.width / 2 - tooltipWidth / 2)),
      };
    }

    switch (position) {
      case 'top':
        return {
          top: targetRect.top - tooltipHeight - padding,
          left: isMobile
            ? Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, targetRect.left + targetRect.width / 2 - tooltipWidth / 2))
            : targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
        };
      case 'bottom':
        return {
          top: targetRect.bottom + padding,
          left: isMobile
            ? Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, targetRect.left + targetRect.width / 2 - tooltipWidth / 2))
            : targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
        };
      case 'left':
        return {
          top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
          left: isMobile
            ? Math.max(16, window.innerWidth / 2 - tooltipWidth / 2)
            : targetRect.left - tooltipWidth - padding,
        };
      case 'right':
        return {
          top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
          left: isMobile
            ? Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, window.innerWidth / 2 - tooltipWidth / 2))
            : targetRect.right + padding,
        };
      case 'center':
        // 모바일에서는 하단 네비게이션바(64px)를 고려하여 가용 영역의 중앙에 배치
        const availableHeight = isMobile ? window.innerHeight - 64 : window.innerHeight;
        return {
          top: availableHeight / 2 - tooltipHeight / 2,
          left: window.innerWidth / 2 - tooltipWidth / 2,
        };
      default:
        return {
          top: targetRect.bottom + padding,
          left: isMobile
            ? Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, targetRect.left + targetRect.width / 2 - tooltipWidth / 2))
            : targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
        };
    }
  };

  const tooltipPos = getTooltipPosition();
  const isMobile = window.innerWidth < 768;

  // Step 10(완료 모달)에서만 spotlight 박스 숨김
  const hideSpotlightBox = step === 10;

  return (
    <>
      {/* Dark Overlay - 30% 어두움 (70% 밝기) */}
      <div
        className={cn(
          "fixed inset-0 bg-black/30 pointer-events-none",
          step === 10 && isMobile ? "z-[9998]" : "z-[100]"
        )}
        style={{
          boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.3)`,
        }}
      />

      {/* Spotlight Cutout - Step 10에서만 숨김 */}
      {!hideSpotlightBox && (
        <div
          className="fixed z-[200] pointer-events-none animate-pulse"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            boxShadow: '0 0 0 4px rgba(16, 185, 129, 0.5), 0 0 0 9999px rgba(0, 0, 0, 0.3)',
            borderRadius: '8px',
          }}
        />
      )}

      {/* Tooltip Message */}
      <div
        className={cn(
          "fixed bg-gray-900 border border-gray-700 rounded-lg p-4 shadow-2xl animate-fade-in",
          isMobile ? "w-[calc(100vw-32px)] max-w-80" : "w-80",
          // Step 10 모바일에서는 절대 중앙 배치 및 최상위 레이어
          step === 10 && isMobile ? "z-[9999] inset-0 m-auto h-fit" : "z-[202]"
        )}
        style={
          step === 10 && isMobile
            ? { bottom: '80px' } // 하단 네비게이션바 위로
            : {
                top: `${tooltipPos.top}px`,
                left: `${tooltipPos.left}px`,
              }
        }
      >
        {/* Progress Indicator */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-emerald-400 font-bold text-base">{title}</h3>
          <span className="text-xs text-gray-400">Step {step === 7.5 ? '8' : step > 7.5 ? step : step}/10</span>
        </div>

        {/* Message */}
        <p className="text-white text-sm mb-3 leading-relaxed">{message}</p>

        {/* Buttons */}
        {showNext && (
          <Button onClick={onNext} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
            {step === 10 ? '메인으로 이동' : '다음'}
          </Button>
        )}
      </div>

      {/* Global styles for spotlight target */}
      <style jsx global>{`
        .tutorial-spotlight-target {
          position: relative !important;
          z-index: 201 !important;
          pointer-events: auto !important;
          border: 3px solid rgb(16, 185, 129) !important;
          border-radius: 8px !important;
          box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.3), 0 0 20px rgba(16, 185, 129, 0.5) !important;
          animation: tutorial-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite !important;
        }

        @keyframes tutorial-pulse {
          0%, 100% {
            box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.3), 0 0 20px rgba(16, 185, 129, 0.5);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(16, 185, 129, 0.2), 0 0 30px rgba(16, 185, 129, 0.7);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
