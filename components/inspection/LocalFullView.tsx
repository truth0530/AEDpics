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
import {
  getActiveInspectionSessions,
  getCompletedInspections,
  getInspectionHistory,
  getDraftSessions,
  deleteDraftSession,
  type InspectionHistory
} from '@/lib/inspections/session-utils';
import { Eye, Trash2 } from 'lucide-react';
import { InspectionHistoryModal } from './InspectionHistoryModal';
import { DeleteInspectionModal } from './DeleteInspectionModal';

// Inspection context for filtering
interface InspectionContextType {
  inspectionStarted: Set<string>;
  inspectionCompleted: Set<string>;
  handleInspectionStart: (serial: string) => void;
  handleInspectionComplete: (serial: string) => void;
  viewMode: 'list' | 'map' | 'completed' | 'drafts';
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
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'completed' | 'drafts'>('list');
  // ✅ 현장점검에서는 접기/펼치기 불필요 - 항상 필터 표시
  const { data, isLoading } = useAEDData();
  const { inspectionStarted, inspectionCompleted, handleInspectionStart } = useInspection();
  const router = useRouter();
  const { showSuccess } = useToast();

  // 임시저장된 세션 목록
  const [draftSessions, setDraftSessions] = useState<any[]>([]);

  // 점검 이력 관리 상태
  const [selectedInspection, setSelectedInspection] = useState<InspectionHistory | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [inspectionToDelete, setInspectionToDelete] = useState<InspectionHistory | null>(null);
  const [inspectionHistoryList, setInspectionHistoryList] = useState<InspectionHistory[]>([]);

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

  // 임시저장 탭으로 전환 시 임시저장 세션 조회
  useEffect(() => {
    async function loadDraftSessions() {
      if (viewMode === 'drafts') {
        const drafts = await getDraftSessions();
        setDraftSessions(drafts);
      }
    }
    loadDraftSessions();
  }, [viewMode]);

  // 점검이력 데이터 동기화
  useEffect(() => {
    if (inspectionHistoryData && inspectionHistoryData.length > 0) {
      setInspectionHistoryList(inspectionHistoryData as InspectionHistory[]);
    }
  }, [inspectionHistoryData]);

  // 디버깅: viewMode 변경 감지
  useEffect(() => {
    console.log(`[LocalFullView] viewMode 변경됨: ${viewMode}, 점검이력 데이터 개수: ${inspectionHistoryData.length}`);
  }, [viewMode, inspectionHistoryData.length]);

  // 점검 이력 상세보기 핸들러
  const handleViewInspectionHistory = async (inspectionId: string) => {
    try {
      const selected = inspectionHistoryList.find(item => item.id === inspectionId);
      if (selected) {
        setSelectedInspection(selected);
        setShowHistoryModal(true);
      }
    } catch (error) {
      console.error('[handleViewInspectionHistory] Error:', error);
      showSuccess('점검 이력 조회 실패');
    }
  };

  // 점검 이력 삭제 핸들러
  const handleDeleteInspection = (inspectionId: string) => {
    if (selectedInspection && selectedInspection.id === inspectionId) {
      setInspectionToDelete(selectedInspection);
      setShowDeleteModal(true);
    }
  };

  // 삭제 확인 핸들러
  const handleConfirmDelete = async () => {
    if (!inspectionToDelete) return;

    try {
      const res = await fetch(`/api/inspections/${inspectionToDelete.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        showSuccess('점검 이력이 삭제되었습니다');
        setShowDeleteModal(false);
        setInspectionToDelete(null);
        setSelectedInspection(null);
        // 목록 새로고침
        refetch();
      } else {
        throw new Error('삭제 실패');
      }
    } catch (error) {
      console.error('[handleConfirmDelete] Error:', error);
      showSuccess('삭제 중 오류가 발생했습니다');
    }
  };

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
          <button
            onClick={() => setViewMode('drafts')}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              viewMode === 'drafts'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2" />
              </svg>
              <span>임시저장</span>
              {draftSessions.length > 0 && (
                <span className="bg-yellow-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {draftSessions.length}
                </span>
              )}
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
              // 완료 탭: inspectionHistoryList 직접 사용 (권한 필터링 이미 적용됨)
              <div className="flex-1 overflow-y-auto bg-gray-900">
                {inspectionHistoryList.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <div className="text-center">
                      <p className="text-sm">점검이력이 없습니다</p>
                      <p className="text-xs text-gray-500 mt-1">선택된 지역에서 완료된 점검이 없습니다</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* 모바일 레이아웃 (< 640px) */}
                    <div className="sm:hidden px-2 py-3 space-y-3">
                      {inspectionHistoryList.map((inspection) => (
                        <div
                          key={inspection.id}
                          className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden hover:bg-gray-750 transition-colors"
                        >
                          {/* 헤더: 장비번호 + 상태 */}
                          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/50">
                            <div className="font-medium text-sm text-gray-200 truncate flex-1">
                              {inspection.equipment_serial}
                            </div>
                            <span className="inline-block px-2 py-1 rounded text-xs font-medium whitespace-nowrap ml-2 flex-shrink-0 bg-blue-900 text-blue-200">
                              점검완료
                            </span>
                          </div>

                          {/* 본문: 점검 정보 */}
                          <div className="px-4 py-3 space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-gray-400">설치기관</span>
                              <span className="text-gray-200 font-medium truncate ml-2">
                                {inspection.aed_data?.installation_institution || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">점검일시</span>
                              <span className="text-gray-200 font-medium">
                                {new Date(inspection.created_at).toLocaleString('ko-KR', {
                                  year: '2-digit',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">점검자</span>
                              <span className="text-gray-200 font-medium">{inspection.inspector_name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">시도</span>
                              <span className="text-gray-200 font-medium">
                                {inspection.aed_data?.sido || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">구군</span>
                              <span className="text-gray-200 font-medium">
                                {inspection.aed_data?.gugun || '-'}
                              </span>
                            </div>
                          </div>

                          {/* 액션 버튼 */}
                          <div className="px-4 py-3 border-t border-gray-700 bg-gray-800/30 flex gap-2">
                            <button
                              onClick={() => handleViewInspectionHistory(inspection.id)}
                              className="flex-1 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                              title="상세 정보 보기"
                              aria-label="상세 정보 보기"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {user?.role === 'master' ? (
                              <button
                                onClick={() => {
                                  setSelectedInspection(inspection);
                                  setInspectionToDelete(inspection);
                                  setShowDeleteModal(true);
                                }}
                                className="flex-1 p-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                                title="삭제 (마스터만)"
                                aria-label="삭제 (마스터만)"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                disabled
                                className="flex-1 p-2 bg-gray-700 text-gray-500 rounded cursor-not-allowed flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                                title="삭제 불가 (마스터만 가능)"
                                aria-label="삭제 불가 (마스터만 가능)"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 데스크톱/태블릿 레이아웃 (>= 640px) */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full border-collapse table-fixed">
                        <thead className="sticky top-0 bg-gray-800 border-b border-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 min-w-[120px] max-w-[140px] break-words">장비연번</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 hidden xl:table-cell min-w-[150px] max-w-[200px]">설치기관</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 hidden sm:table-cell min-w-[130px] max-w-[150px]">점검일시</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 hidden lg:table-cell min-w-[80px] max-w-[100px]">점검자</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 hidden md:table-cell min-w-[110px] max-w-[150px]">시도/구군</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 min-w-[90px] max-w-[110px]">상태</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 min-w-[110px] max-w-[140px]">작업</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inspectionHistoryList.map((inspection) => (
                            <tr
                              key={inspection.id}
                              className="border-b border-gray-700 hover:bg-gray-800/50 transition-colors"
                            >
                              <td className="px-4 py-3 text-sm text-gray-200 font-medium truncate whitespace-nowrap">{inspection.equipment_serial}</td>
                              <td className="px-4 py-3 text-sm text-gray-400 hidden xl:table-cell truncate">
                                {inspection.aed_data?.installation_institution || '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-400 hidden sm:table-cell whitespace-nowrap">
                                {new Date(inspection.created_at).toLocaleString('ko-KR', {
                                  year: '2-digit',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-400 hidden lg:table-cell truncate">{inspection.inspector_name}</td>
                              <td className="px-4 py-3 text-sm text-gray-400 hidden md:table-cell truncate">
                                {inspection.aed_data
                                  ? `${inspection.aed_data.sido || '-'} ${inspection.aed_data.gugun || '-'}`
                                  : '-'
                                }
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span className="inline-block px-2 py-1 rounded text-xs font-medium whitespace-nowrap bg-blue-900 text-blue-200">
                                  점검완료
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm space-x-1 flex flex-wrap gap-1">
                                <button
                                  onClick={() => handleViewInspectionHistory(inspection.id)}
                                  className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex-shrink-0 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                                  title="상세 정보 보기"
                                  aria-label="상세 정보 보기"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                {user?.role === 'master' ? (
                                  <button
                                    onClick={() => {
                                      setSelectedInspection(inspection);
                                      setInspectionToDelete(inspection);
                                      setShowDeleteModal(true);
                                    }}
                                    className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded transition-colors flex-shrink-0 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                                    title="삭제 (마스터만)"
                                    aria-label="삭제 (마스터만)"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <button
                                    disabled
                                    className="p-1.5 bg-gray-700 text-gray-500 rounded cursor-not-allowed flex-shrink-0 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                                    title="삭제 불가 (마스터만 가능)"
                                    aria-label="삭제 불가 (마스터만 가능)"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            ) : viewMode === 'drafts' ? (
              <div className="flex-1 overflow-y-auto bg-gray-900 p-4">
                {draftSessions.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-sm">임시저장된 점검이 없습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {draftSessions.map((draft) => (
                      <div key={draft.id} className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-200">
                              {draft.equipment_serial}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(draft.created_at).toLocaleString('ko-KR')}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {draft.current_step}단계 진행중
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              // TODO: 점검 재개 기능 구현
                              console.log('Resume draft:', draft.id);
                            }}
                            className="px-3 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                          >
                            이어하기
                          </button>
                          <button
                            onClick={async () => {
                              const result = await deleteDraftSession(draft.id);
                              if (result.success) {
                                const drafts = await getDraftSessions();
                                setDraftSessions(drafts);
                              }
                            }}
                            className="px-3 py-1 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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

      {/* 점검 이력 상세보기 모달 */}
      {selectedInspection && (
        <InspectionHistoryModal
          isOpen={showHistoryModal}
          onClose={() => {
            setShowHistoryModal(false);
            setSelectedInspection(null);
          }}
          inspection={selectedInspection}
          onDelete={handleDeleteInspection}
          canEdit={false}
          canDelete={user?.role === 'master'}
        />
      )}

      {/* 삭제 확인 모달 */}
      {inspectionToDelete && (
        <DeleteInspectionModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setInspectionToDelete(null);
          }}
          onConfirm={handleConfirmDelete}
          inspectionId={inspectionToDelete.equipment_serial}
        />
      )}
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