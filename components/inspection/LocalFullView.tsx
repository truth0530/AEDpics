'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { UserProfile } from '@/packages/types';
import { AEDDataProvider, useAEDData } from '@/app/aed-data/components/AEDDataProvider';
import { DataTable } from '@/app/aed-data/components/DataTable';
import { InspectionFilterBar } from './InspectionFilterBar';
import { MapView } from './MapView';
import { useToast } from '@/components/ui/Toast';
import { getActiveInspectionSessions, getCompletedInspections, getInspectionHistory } from '@/lib/inspections/session-utils';

// Inspection context for filtering
interface InspectionContextType {
  inspectionStarted: Set<string>;
  inspectionCompleted: Set<string>;
  handleInspectionStart: (serial: string) => void;
  handleInspectionComplete: (serial: string) => void;
  viewMode: 'list' | 'map' | 'completed';
}

const InspectionContext = createContext<InspectionContextType | null>(null);

export const useInspection = () => {
  const context = useContext(InspectionContext);
  if (!context) {
    throw new Error('useInspection must be used within InspectionContext.Provider');
  }
  return context;
};

interface LocalFullViewProps {
  user: UserProfile;
  isMobile: boolean;
}

interface LocalViewContentProps {
  user: UserProfile;
}

function LocalViewContent({ user }: LocalViewContentProps) {
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'completed'>('list');
  // ✅ 현장점검에서는 접기/펼치기 불필요 - 항상 필터 표시
  const { data, isLoading } = useAEDData();
  const { inspectionStarted, inspectionCompleted, handleInspectionStart } = useInspection();
  const router = useRouter();
  const { showSuccess } = useToast();

  // ✅ 실제 DB에서 활성 세션 조회 (30초마다 자동 갱신)
  const { data: activeInspectionSessions = new Map() } = useQuery({
    queryKey: ['active-inspection-sessions'],
    queryFn: getActiveInspectionSessions,
    refetchInterval: 30000, // 30초마다 갱신
    staleTime: 25000,
  });

  // ✅ 24시간 이내 완료된 점검 조회 (30초마다 자동 갱신)
  const { data: dbCompletedInspections = new Set() } = useQuery({
    queryKey: ['completed-inspections'],
    queryFn: () => getCompletedInspections(24), // 24시간 이내 완료된 점검
    refetchInterval: 30000, // 30초마다 갱신
    staleTime: 25000,
  });

  // ✅ 점검이력 데이터 조회 (viewMode가 'completed'일 때만 활성화)
  const { data: inspectionHistoryData = [], isLoading: isLoadingHistory, isFetching, refetch } = useQuery({
    queryKey: ['inspection-history', viewMode],
    queryFn: async () => {
      console.log('[LocalFullView] getInspectionHistory API 호출 시작: jurisdiction 모드, 720시간');
      const result = await getInspectionHistory(undefined, 720, 'jurisdiction');
      console.log(`[LocalFullView] 점검이력 조회 완료: ${result.length}개`);
      return result;
    },
    enabled: viewMode === 'completed', // 점검이력 탭일 때만 호출
    staleTime: 0, // ⚠️ 캐시를 사용하지 않고 항상 새로 fetch
    refetchOnMount: 'always', // 마운트될 때마다 항상 refetch
    refetchInterval: 30000, // 30초마다 갱신
  });

  // 디버깅: viewMode 변경 감지
  useEffect(() => {
    console.log(`[LocalFullView] viewMode 변경됨: ${viewMode}, 점검이력 데이터 개수: ${inspectionHistoryData.length}`);
  }, [viewMode, inspectionHistoryData.length]);

  // 목록/지도 탭: 점검 대상만 (AdminFullView와 동일한 로직)
  const pendingData = data?.filter(item => {
    const equipmentSerial = item.equipment_serial || '';
    const hasActiveSession = activeInspectionSessions.has(equipmentSerial);
    const isCompletedInDB = dbCompletedInspections.has(equipmentSerial);
    const isCompletedLocally = inspectionCompleted.has(equipmentSerial);
    const inspectionStatus = (item as any).inspection_status;

    // ✅ inspection_status를 정확하게 체크
    // - pending 또는 NULL: 점검 대상 (표시)
    // - in_progress, completed, unavailable, cancelled: 제외
    const shouldExclude = inspectionStatus && inspectionStatus !== 'pending';

    // 디버깅: 29-0001352 추적
    if (equipmentSerial === '29-0001352') {
      console.log('[LocalFullView pendingData filter]', {
        serial: equipmentSerial,
        inspectionStatus,
        shouldExclude,
        hasActiveSession,
        isCompletedInDB,
        isCompletedLocally,
        willInclude: !hasActiveSession && !isCompletedInDB && !isCompletedLocally && !shouldExclude
      });
    }

    return !hasActiveSession && !isCompletedInDB && !isCompletedLocally && !shouldExclude;
  }) || [];

  // 점검완료 탭: localStorage 또는 DB에서 완료된 장비
  const completedData = data?.filter(item => {
    const equipmentSerial = item.equipment_serial || '';
    return inspectionCompleted.has(equipmentSerial) || dbCompletedInspections.has(equipmentSerial);
  }) || [];

  // viewMode에 따라 다른 데이터 카운트 사용
  const dataCount = viewMode === 'completed' ? inspectionHistoryData.length : pendingData.length;

  const locations = (viewMode === 'completed' ? completedData : pendingData).map(item => ({
    equipment_serial: item.equipment_serial || item.device_serial || '',
    installation_institution: item.installation_org || item.installation_institution,
    installation_address: item.address || item.installation_address,
    installation_position: item.installation_position,
    latitude: item.latitude || 0,
    longitude: item.longitude || 0,
    model_name: item.model_name,
    manufacturer: item.manufacturer,
    battery_expiry_date: item.battery_expiry_date,
    patch_expiry_date: item.patch_expiry_date || item.pad_expiry_date,
    last_inspection_date: item.last_inspection_date,
    external_display: item.external_display,
    external_non_display_reason: item.external_non_display_reason
  }));

  return (
    <div className="flex h-full flex-col bg-gray-950">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between -mb-px flex-wrap sm:flex-nowrap gap-2 sm:gap-0">
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              viewMode === 'list'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <span>점검대상</span>
            </div>
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              viewMode === 'map'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <span>지도</span>
            </div>
          </button>
          <button
            onClick={() => setViewMode('completed')}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              viewMode === 'completed'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>점검이력</span>
            </div>
          </button>
        </div>
        <div className="text-xs text-gray-500 px-4">
          {dataCount}개
        </div>
      </div>

      {/* Filter Bar - 목록/점검완료 뷰일 때는 일반 배치, 지도 뷰일 때는 오버레이 */}
      {/* ✅ 현장점검에서는 접기/펼치기 버튼 제거 - 항상 필터 표시 */}
      {(viewMode === 'list' || viewMode === 'completed') && <InspectionFilterBar />}

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {/* 지도 뷰일 때 필터바 오버레이 */}
        {/* ✅ 현장점검에서는 접기/펼치기 버튼 제거 - 지도에서도 항상 필터 표시 */}
        {viewMode === 'map' && (
          <div className="absolute top-0 left-0 right-0 z-10">
            <div className="bg-gray-900/70 backdrop-blur-md shadow-lg border-b border-gray-700/30">
              <InspectionFilterBar />
            </div>
          </div>
        )}

        {/* 빈 데이터 상태 메시지 */}
        {!isLoading && dataCount === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center px-4 py-8 max-w-md">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-300 mb-2">
                {viewMode === 'completed' ? '완료된 점검이 없습니다' : '더이상 점검할 데이터가 없습니다'}
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                {user.role === 'local_admin'
                  ? '일정관리 메뉴에서 점검할 장비를 추가해주세요'
                  : '관할 보건소 담당자에게 일정추가 요청을 해주세요'}
              </p>
              {user.role === 'local_admin' && (
                <button
                  onClick={() => router.push('/aed-data')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  점검일정 추가하기
                </button>
              )}
            </div>
          </div>
        )}

        {/* 데이터가 있을 때만 컨텐츠 표시 */}
        {dataCount > 0 && (
          <>
            {viewMode === 'list' ? (
              <DataTable
                onQuickInspect={(device) => {
                  const serial = device.equipment_serial;
                  handleInspectionStart(serial);
                  showSuccess('점검 페이지로 이동합니다', { message: `장비: ${device.installation_institution}` });
                  router.push(`/inspection/${serial}`);
                }}
              />
            ) : viewMode === 'completed' ? (
              <div className="flex-1 overflow-y-auto bg-gray-900 p-4">
                <div className="space-y-4">
                  {inspectionHistoryData.map((inspection: any) => (
                    <div key={inspection.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">장비번호:</span>
                          <span className="ml-2 text-white">{inspection.equipment_serial}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">점검일시:</span>
                          <span className="ml-2 text-white">
                            {new Date(inspection.completed_at || inspection.created_at).toLocaleString('ko-KR')}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">위치:</span>
                          <span className="ml-2 text-white">
                            {inspection.aed_data?.sido} {inspection.aed_data?.gugun}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">상태:</span>
                          <span className="ml-2 text-green-400">{inspection.status === 'completed' ? '완료' : inspection.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <MapView
                locations={locations}
                isLoading={isLoading}
                useMapBasedLoading={false}
                userProfile={undefined}
                viewMode="inspection"
                onQuickInspect={(location) => {
                  // 점검 시작 처리
                  const serial = location.equipment_serial;
                  handleInspectionStart(serial);
                  showSuccess('점검 페이지로 이동합니다', { message: `장비: ${location.installation_institution}` });
                  router.push(`/inspection/${serial}`);
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function InspectionProvider({ children }: { children: React.ReactNode }) {
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'completed'>('list');
  const [inspectionStarted, setInspectionStarted] = useState<Set<string>>(new Set());
  const [inspectionCompleted, setInspectionCompleted] = useState<Set<string>>(new Set());

  // localStorage에서 점검 시작/완료 상태 불러오기
  useEffect(() => {
    const started = localStorage.getItem('inspection_started');
    const completed = localStorage.getItem('inspection_completed');

    if (started) {
      try {
        const parsed = JSON.parse(started);
        setInspectionStarted(new Set(parsed));
      } catch (e) {
        console.error('Failed to parse inspection_started:', e);
      }
    }

    if (completed) {
      try {
        const parsed = JSON.parse(completed);
        setInspectionCompleted(new Set(parsed));
      } catch (e) {
        console.error('Failed to parse inspection_completed:', e);
      }
    }
  }, []);

  const handleInspectionStart = (serial: string) => {
    const newSet = new Set(inspectionStarted);
    newSet.add(serial);
    setInspectionStarted(newSet);
    localStorage.setItem('inspection_started', JSON.stringify([...newSet]));
  };

  const handleInspectionComplete = (serial: string) => {
    const newSet = new Set(inspectionCompleted);
    newSet.add(serial);
    setInspectionCompleted(newSet);
    localStorage.setItem('inspection_completed', JSON.stringify([...newSet]));
  };

  return (
    <InspectionContext.Provider value={{
      inspectionStarted,
      inspectionCompleted,
      handleInspectionStart,
      handleInspectionComplete,
      viewMode
    }}>
      {children}
    </InspectionContext.Provider>
  );
}

export function LocalMobileView({ user }: { user: UserProfile }) {
  return (
    <InspectionProvider>
      <AEDDataProvider viewMode="inspection" initialFilters={{}} userProfile={user}>
        <LocalViewContent user={user} />
      </AEDDataProvider>
    </InspectionProvider>
  );
}

export function LocalDesktopView({ user }: { user: UserProfile }) {
  return (
    <InspectionProvider>
      <AEDDataProvider viewMode="inspection" initialFilters={{}} userProfile={user}>
        <LocalViewContent user={user} />
      </AEDDataProvider>
    </InspectionProvider>
  );
}