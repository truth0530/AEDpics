'use client';

interface TutorialMobileNavProps {
  user: any;
}

export function TutorialMobileNav({ user }: TutorialMobileNavProps) {
  const handleNavigate = (page: 'aed-data' | 'inspection') => {
    if (typeof window !== 'undefined' && (window as any).tutorialNavigate) {
      (window as any).tutorialNavigate(page);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-xl border-t border-gray-700 z-50 md:hidden">
      <div className="flex items-center py-2">
        <button
          onClick={() => handleNavigate('aed-data')}
          className="flex flex-col items-center py-1 px-2 rounded-lg transition-colors min-w-0 flex-1 hover:bg-gray-800/30"
        >
          <div className="mb-1">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <span className="text-xs font-medium truncate text-gray-400">일정관리</span>
        </button>
        <button
          onClick={() => handleNavigate('inspection')}
          className="flex flex-col items-center py-1 px-2 rounded-lg transition-colors min-w-0 flex-1 hover:bg-gray-800/30"
        >
          <div className="mb-1">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <span className="text-xs font-medium truncate text-gray-400">현장점검</span>
        </button>
        <button
          disabled
          className="flex flex-col items-center py-1 px-2 rounded-lg transition-colors min-w-0 flex-1 cursor-default"
        >
          <div className="mb-1">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <span className="text-xs font-medium truncate text-gray-400">대시보드</span>
        </button>
        <button
          disabled
          className="flex flex-col items-center py-1 px-2 rounded-lg transition-colors min-w-0 flex-1 cursor-default"
        >
          <div className="mb-1">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <span className="text-xs font-medium truncate text-gray-400">프로필</span>
        </button>
      </div>
    </div>
  );
}
