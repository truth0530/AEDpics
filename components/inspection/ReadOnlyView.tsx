'use client';

import { UserProfile, UserRole } from '@/packages/types';
import { AEDDataProvider } from '@/app/aed-data/components/AEDDataProvider';
import { AEDFilterBar } from '@/app/aed-data/components/AEDFilterBar';
import { DataTable } from '@/app/aed-data/components/DataTable';

interface ReadOnlyViewProps {
  user: UserProfile;
  role: UserRole;
}

export function ReadOnlyView({ user, role }: ReadOnlyViewProps) {
  const isMinistry = role === 'ministry_admin';
  const isRegional = role === 'regional_admin';

  return (
    <AEDDataProvider viewMode="inspection" initialFilters={{}} userProfile={user}>
      <div className="space-y-4">
        {/* 헤더 */}
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AED 현황 조회</h1>
              <p className="text-sm text-gray-600 mt-1">
                {isMinistry && '전국 AED 장비 현황 (읽기 전용)'}
                {isRegional && `${user.organization?.name || '시도'} AED 장비 현황 (읽기 전용)`}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                통계 보기
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                보고서 출력
              </button>
            </div>
          </div>
        </div>

        {/* 읽기 전용 알림 */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-amber-800">
              조회 전용 권한입니다. 데이터 수정 및 점검 시작은 불가능합니다.
            </p>
          </div>
        </div>

        {/* 필터 바 */}
        <AEDFilterBar />

        {/* 데이터 테이블 - 읽기 전용 */}
        <DataTable />
      </div>
    </AEDDataProvider>
  );
}