'use client';

import { useState, useEffect } from 'react';

interface TutorialHeaderProps {
  user: any;
  pageTitle?: string;
}

export function TutorialHeader({ user, pageTitle: initialPageTitle = '튜토리얼 가이드' }: TutorialHeaderProps) {
  const [pageTitle, setPageTitle] = useState(initialPageTitle);

  useEffect(() => {
    // 전역 window 객체에서 pageTitle 읽기
    const updateTitle = () => {
      if (typeof window !== 'undefined' && (window as any).tutorialPageTitle) {
        setPageTitle((window as any).tutorialPageTitle);
      }
    };

    // 초기 타이틀 설정
    updateTitle();

    // 타이틀 변경 감지를 위한 인터벌
    const interval = setInterval(updateTitle, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Mobile Header */}
      <header className="bg-gray-900 border-b border-gray-700 md:hidden">
        <div className="px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-shrink">
            <div className="w-7 h-7 bg-green-500 rounded-lg flex items-center justify-center relative flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <svg
                className="absolute w-2 h-2.5 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
                style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
              >
                <path d="M13 0L7 12h4l-2 12 8-12h-4l2-12z" />
              </svg>
            </div>
            <h1 className="text-white font-semibold text-sm truncate">{pageTitle}</h1>
          </div>
        </div>
      </header>

      {/* Desktop Header */}
      <header className="hidden md:block h-20 bg-gray-900 border-b border-gray-800">
        <div className="h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center relative flex-shrink-0 shadow-lg">
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <svg
                className="absolute w-3.5 h-4 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
                style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
              >
                <path d="M13 0L7 12h4l-2 12 8-12h-4l2-12z" />
              </svg>
            </div>
            <div className="flex items-baseline gap-3">
              <h1 className="text-3xl font-bold text-white">AED 픽스</h1>
              <p className="text-base text-gray-400">{pageTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-blue-900/30 border border-blue-700 rounded-lg">
              <span className="text-sm text-blue-300 font-medium">튜토리얼 모드</span>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
