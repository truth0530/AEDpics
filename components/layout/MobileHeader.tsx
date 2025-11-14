'use client';

import { memo } from 'react';
import { usePathname } from 'next/navigation';
import { RegionFilter } from '@/components/layout/RegionFilter';
import type { UserProfile } from '@/packages/types';

interface MobileHeaderProps {
  user: UserProfile;
}

// 성능 최적화: 메모이제이션으로 불필요한 리렌더링 방지
function MobileHeaderComponent({ user }: MobileHeaderProps) {
  const pathname = usePathname();

  const getPageTitle = () => {
    switch (pathname) {
      case '/dashboard':
      case '/':
        return 'AED픽스';
      case '/aed-data':
        return '일정관리';
      case '/inspection':
        return '현장점검';
      case '/admin/target-matching':
        return '의무기관매칭';
      case '/reports':
        return '보고서';
      default:
        if (pathname.startsWith('/inspection/')) {
          return 'AED 점검';
        }
        return 'AED픽스';
    }
  };

  const handleRegionChange = (sidoCode: string, gugun: string, sidoLabel: string) => {
    // 시도/구군이 변경되면 전역 상태로 저장 (이벤트 없이)
    // 실제 조회는 각 페이지의 '조회' 버튼을 통해서만 수행됨
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('selectedSido', sidoLabel);
      if (sidoCode && sidoCode !== '시도') {
        window.sessionStorage.setItem('selectedSidoCode', sidoCode);
      } else {
        window.sessionStorage.removeItem('selectedSidoCode');
      }
      window.sessionStorage.setItem('selectedGugun', gugun);
    }
  };

  return (
    <header className="bg-gray-900 border-b border-gray-700 md:hidden">
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-shrink">
          <div className="w-7 h-7 bg-green-500 rounded-lg flex items-center justify-center relative flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <svg className="absolute w-2 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24" style={{left: '50%', top: '50%', transform: 'translate(-50%, -50%)'}}>
              <path d="M13 0L7 12h4l-2 12 8-12h-4l2-12z"/>
            </svg>
          </div>
          <h1 className="text-white font-semibold text-sm truncate">{getPageTitle()}</h1>
        </div>
        <div className="flex-shrink-0">
          <RegionFilter user={user} onChange={handleRegionChange} />
        </div>
      </div>
    </header>
  );
}

// 메모이제이션된 컴포넌트 export
export const MobileHeader = memo(MobileHeaderComponent);
