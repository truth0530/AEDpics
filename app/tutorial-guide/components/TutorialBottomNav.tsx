'use client';

interface TutorialBottomNavProps {
  currentPage: 'aed-data' | 'inspection';
  onNavigate: (page: 'aed-data' | 'inspection') => void;
}

export function TutorialBottomNav({ currentPage, onNavigate }: TutorialBottomNavProps) {
  const navigationItems = [
    {
      id: 'aed-data',
      label: '일정관리',
      page: 'aed-data' as const,
      dataAttr: 'bottom-nav-aed-data',
      icon: (active: boolean) => (
        <svg className={`w-6 h-6 ${active ? 'text-blue-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: 'inspection',
      label: '현장점검',
      page: 'inspection' as const,
      dataAttr: 'bottom-nav-inspection',
      icon: (active: boolean) => (
        <svg className={`w-6 h-6 ${active ? 'text-blue-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: 'dashboard',
      label: '대시보드',
      page: 'aed-data' as const, // 튜토리얼에서는 기능 없음
      icon: (active: boolean) => (
        <svg className={`w-6 h-6 ${active ? 'text-blue-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      id: 'profile',
      label: '프로필',
      page: 'aed-data' as const, // 튜토리얼에서는 기능 없음
      icon: (active: boolean) => (
        <svg className={`w-6 h-6 ${active ? 'text-blue-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-xl border-t border-gray-700 z-50">
      <div className="flex items-center py-2">
        {navigationItems.map((item) => {
          const isActive = currentPage === item.page && (item.id === 'aed-data' || item.id === 'inspection');
          const isDisabled = item.id === 'dashboard' || item.id === 'profile';

          return (
            <button
              key={item.id}
              data-tutorial={item.dataAttr}
              onClick={() => {
                if (!isDisabled) {
                  onNavigate(item.page);
                }
              }}
              disabled={isDisabled}
              className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors min-w-0 flex-1 ${
                isActive ? 'bg-gray-800/50' : isDisabled ? 'cursor-default' : 'hover:bg-gray-800/30'
              }`}
            >
              <div className="mb-1">
                {item.icon(isActive)}
              </div>
              <span className={`text-xs font-medium truncate ${
                isActive ? 'text-blue-400' : 'text-gray-400'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
