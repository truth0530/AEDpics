'use client';

import { UserProfile, UserRole } from '@/packages/types';
import { AEDDataProvider } from '@/app/aed-data/components/AEDDataProvider';
import { AEDFilterBar } from '@/app/aed-data/components/AEDFilterBar';
import { DataTable } from '@/app/aed-data/components/DataTable';
import { useToast } from '@/components/ui/Toast';

interface ReadOnlyViewProps {
  user: UserProfile;
  role: UserRole;
}

export function ReadOnlyView({ user, role }: ReadOnlyViewProps) {
  const isMinistry = role === 'ministry_admin';
  const isRegional = role === 'regional_admin';
  const { showSuccess, showError } = useToast();

  // 엑셀 다운로드 (서버 사이드 필터링 적용)
  const handleExcelDownload = async () => {
    try {
      // 필터 파라미터 구성 (user 권한 기반)
      const filterParams = {
        regionCodes: user?.organization?.region_code ? [user.organization.region_code] : [],
        cityCodes: user?.organization?.city_code ? [user.organization.city_code] : [],
        limit: 10000, // 최대 10,000건
        mode: 'address' // read-only는 항상 address 모드
      };

      console.log('[ReadOnlyView][handleExcelDownload] Filter params:', filterParams);

      // POST /api/inspections/export 호출
      const response = await fetch('/api/inspections/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(filterParams)
      });

      if (!response.ok) {
        const errorData = await response.json();
        showError(errorData.error || '엑셀 다운로드 실패');
        console.error('[ReadOnlyView][handleExcelDownload] API error:', errorData);
        return;
      }

      // 응답 헤더에서 파일 정보 추출
      const contentDisposition = response.headers.get('Content-Disposition') || '';
      let filename = 'AED_점검기록.xlsx';

      // Content-Disposition에서 filename 추출 (있는 경우)
      const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/);
      if (filenameMatch) {
        filename = decodeURIComponent(filenameMatch[1]);
      }

      // 응답을 Blob으로 변환
      const blob = await response.blob();

      // 다운로드 링크 생성 및 실행
      const downloadUrl = window.URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      window.URL.revokeObjectURL(downloadUrl);

      // 감사 로깅
      const recordCount = response.headers.get('X-Record-Count');
      console.log('[ReadOnlyView][handleExcelDownload] Success', {
        filename,
        recordCount,
        filters: filterParams
      });

      showSuccess('엑셀 파일이 다운로드되었습니다');
    } catch (error) {
      console.error('[ReadOnlyView][handleExcelDownload] Error:', error);
      showError('엑셀 다운로드 실패');
    }
  };

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
              <button
                onClick={handleExcelDownload}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                엑셀다운로드
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
