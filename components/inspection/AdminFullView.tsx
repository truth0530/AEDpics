'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserProfile } from '@/packages/types';
import { AEDDataProvider, useAEDData } from '@/app/aed-data/components/AEDDataProvider';
import { DataTable } from '@/app/aed-data/components/DataTable';
import { InspectionFilterBar } from './InspectionFilterBar';
import { MapView } from './MapView';
import { useToast } from '@/components/ui/Toast';
import {
  getActiveInspectionSessions,
  getCompletedInspections,
  cancelInspectionSession,
  getInspectionHistory,
  updateInspectionRecord,
  deleteInspectionRecord,
  type InspectionSession,
  type InspectionHistory
} from '@/lib/inspections/session-utils';
import { InspectionInProgressModal } from './InspectionInProgressModal';
import { InspectionHistoryModal } from './InspectionHistoryModal';
import { DeleteInspectionModal } from './DeleteInspectionModal';

interface AdminFullViewProps {
  user: UserProfile;
  isMobile: boolean;
  pageType?: 'inspection' | 'schedule'; // 페이지 타입 구분
}

function AdminFullViewContent({ user, pageType = 'schedule' }: { user: UserProfile; pageType?: 'inspection' | 'schedule' }) {
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'completed'>('list');
  const [filterCollapsed, setFilterCollapsed] = useState(false);
  const { data, isLoading, setFilters } = useAEDData();
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  // ✅ 프로필 prop을 통해 직접 전달받음
  useEffect(() => {
    if (user) {
      console.log('[AdminFullViewContent] User from prop:', {
        userId: user.id,
        userEmail: user.email,
        userName: user.fullName || user.email,
      });
    }
  }, [user]);

  // 점검 세션 상태 관리
  const [inspectionSessions, setInspectionSessions] = useState<Map<string, InspectionSession>>(new Map());
  const [completedInspections, setCompletedInspections] = useState<Set<string>>(new Set());
  const [selectedSession, setSelectedSession] = useState<InspectionSession | null>(null);
  const [showInProgressModal, setShowInProgressModal] = useState(false);

  // 점검 이력 모달 상태 관리
  const [selectedInspection, setSelectedInspection] = useState<InspectionHistory | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [inspectionToDelete, setInspectionToDelete] = useState<InspectionHistory | null>(null);

  // 🔴 Phase B: 현재 모달이 표시 중인 장비의 inspection_status
  const [currentSessionInspectionStatus, setCurrentSessionInspectionStatus] = useState<
    'pending' | 'in_progress' | 'completed' | 'cancelled' | 'unavailable' | undefined
  >(undefined);

  // 점검 세션 및 완료 목록 로드
  useEffect(() => {
    async function loadInspectionData() {
      const [sessions, completed] = await Promise.all([
        getActiveInspectionSessions(),
        getCompletedInspections(24), // 최근 24시간
      ]);
      setInspectionSessions(sessions);
      setCompletedInspections(completed);
    }

    loadInspectionData();

    // 30초마다 갱신
    const interval = setInterval(loadInspectionData, 30000);
    return () => clearInterval(interval);
  }, []);

  // AdminFullView 레벨에서 mapRegionChanged 이벤트 리스닝
  useEffect(() => {
    const handleMapRegionChanged = (event: CustomEvent) => {
      const { sido, gugun } = event.detail;
      console.log('[AdminFullView] 🗺️ mapRegionChanged received:', { sido, gugun });

      // 필터 업데이트 (AEDFilterBar의 이벤트와 동일한 동작)
      setFilters({
        regionCodes: [sido],
        cityCodes: [gugun],
        queryCriteria: 'address',
      });
    };

    window.addEventListener('mapRegionChanged', handleMapRegionChanged as EventListener);

    return () => {
      window.removeEventListener('mapRegionChanged', handleMapRegionChanged as EventListener);
    };
  }, [setFilters]);

  // 데이터 필터링: viewMode에 따라
  // 🔴 Phase A: 상태 우선순위 로직 - inspection_status 기반 필터링
  const filteredData = data?.filter((item) => {
    const equipmentSerial = item.equipment_serial || '';
    const hasActiveSession = inspectionSessions.has(equipmentSerial);
    const isCompleted = completedInspections.has(equipmentSerial);
    const inspectionStatus = item.inspection_status; // 우선순위 1순위

    if (viewMode === 'list') {
      // 목록 탭: 점검을 시작하기 전의 장비만 (예정중인 것만)
      // 점검중 및 점검완료된 것 제외
      // 우선순위: inspection_status 확인 → 액티브 세션 확인
      if (inspectionStatus === 'completed') {
        return false; // inspection_status가 completed면 절대 목록에 표시 금지
      }
      return !hasActiveSession && !isCompleted;
    } else if (viewMode === 'completed') {
      // 점검완료 탭: 점검완료 + 점검중인 장비 모두 표시
      // inspection_status가 completed인 항목 우선 포함
      if (inspectionStatus === 'completed') {
        return true;
      }
      return isCompleted || hasActiveSession;
    }

    return true; // 지도 뷰는 모두 표시
  }) || [];

  const dataCount = filteredData?.length || 0;

  // 점검 세션 핸들러
  // 🔴 Phase B: inspection_status도 함께 저장
  const handleInspectionInProgress = (equipmentSerial: string) => {
    const session = inspectionSessions.get(equipmentSerial);
    if (session) {
      // ✅ 디버깅: 사용자 ID 비교 확인 - 상세 정보
      console.log('[AdminFullView] Session comparison - DETAILED:', {
        sessionInspectorId: session.inspector_id,
        sessionInspectorIdType: typeof session.inspector_id,
        sessionInspectorIdLength: session.inspector_id?.length,
        userId: user?.id,
        userIdType: typeof user?.id,
        userIdLength: user?.id?.length,
        areEqual: session.inspector_id === user?.id,
        areEqualTrimmed: session.inspector_id?.trim() === user?.id?.trim(),
        sessionInspectorName: session.inspector_name,
        userEmail: user?.email,
        userFull: user,
      });
      setSelectedSession(session);
      // 현재 장비의 inspection_status 찾기
      const device = data?.find(d => d.equipment_serial === equipmentSerial);
      setCurrentSessionInspectionStatus(device?.inspection_status);
      setShowInProgressModal(true);
    }
  };

  const handleResumeInspection = () => {
    if (selectedSession) {
      router.push(`/inspection/${selectedSession.equipment_serial}`);
    }
  };

  const handleCancelSession = async () => {
    if (!selectedSession) return;

    const result = await cancelInspectionSession(selectedSession.id, '사용자가 점검 취소 처리');
    if (result.success) {
      showSuccess('점검 세션이 취소되었습니다');
      // 세션 목록 재로드
      const sessions = await getActiveInspectionSessions();
      setInspectionSessions(sessions);
      // 🔴 Phase C: 즉시 데이터 새로고침 (30초 대기 제거)
      const completed = await getCompletedInspections(24);
      setCompletedInspections(completed);
      setShowInProgressModal(false);
      setSelectedSession(null);
      setCurrentSessionInspectionStatus(undefined);
    } else {
      showError(result.error || '점검 취소 실패');
    }
  };

  // ✅ 새 세션 시작 - 기존 세션을 보류하고 새 세션 시작
  const handleStartNewInspection = () => {
    if (selectedSession) {
      // 기존 세션을 보류(pause)하고 새 세션 시작
      const equipmentSerial = selectedSession.equipment_serial;
      router.push(`/inspection/${equipmentSerial}`);
      // 모달은 닫혀있음 (onClose에서 닫히므로)
    }
  };

  // 점검 이력 보기 핸들러
  const handleViewInspectionHistory = async (equipmentSerial: string) => {
    try {
      const history = await getInspectionHistory(equipmentSerial, 24);
      if (history && history.length > 0) {
        // 가장 최근 점검 이력 선택
        setSelectedInspection(history[0]);
        setShowHistoryModal(true);
      } else {
        showError('점검 이력을 찾을 수 없습니다');
      }
    } catch (error) {
      console.error('[handleViewInspectionHistory] Error:', error);
      showError('점검 이력 조회 실패');
    }
  };

  // 점검 이력 수정 핸들러
  const handleUpdateInspection = async (inspectionId: string, updates: Partial<InspectionHistory>) => {
    try {
      const result = await updateInspectionRecord(inspectionId, updates);
      if (result.success) {
        showSuccess('점검 이력이 수정되었습니다');
        // 선택된 이력 업데이트
        if (selectedInspection && selectedInspection.id === inspectionId) {
          setSelectedInspection({
            ...selectedInspection,
            ...updates,
          });
        }
      } else {
        showError(result.error || '점검 이력 수정 실패');
      }
    } catch (error) {
      console.error('[handleUpdateInspection] Error:', error);
      showError('점검 이력 수정 실패');
    }
  };

  // 점검 이력 삭제 핸들러 (모달 열기)
  const handleDeleteInspection = (inspectionId: string) => {
    if (selectedInspection && selectedInspection.id === inspectionId) {
      setInspectionToDelete(selectedInspection);
      setShowDeleteModal(true);
    }
  };

  // 점검 이력 삭제 확정
  const handleConfirmDelete = async (reason: string) => {
    if (!inspectionToDelete) return;

    try {
      const result = await deleteInspectionRecord(inspectionToDelete.id, reason, true);
      if (result.success) {
        showSuccess('점검 이력이 삭제되었습니다');
        // 모달 닫기
        setShowDeleteModal(false);
        setShowHistoryModal(false);
        setInspectionToDelete(null);
        setSelectedInspection(null);
        // 완료 목록 재로드
        const completed = await getCompletedInspections(24);
        setCompletedInspections(completed);
      } else {
        showError(result.error || '점검 이력 삭제 실패');
      }
    } catch (error) {
      console.error('[handleConfirmDelete] Error:', error);
      showError('점검 이력 삭제 실패');
    }
  };

  // GPS 좌표가 있는 장비만 필터링
  const locationsWithGPS = filteredData?.filter(item => {
    const hasLat = item.latitude !== null && item.latitude !== undefined && item.latitude !== 0;
    const hasLng = item.longitude !== null && item.longitude !== undefined && item.longitude !== 0;
    return hasLat && hasLng;
  }) || [];

  const locations = locationsWithGPS.map(item => ({
    equipment_serial: item.equipment_serial || item.device_serial || '',
    installation_institution: item.installation_org || item.installation_institution,
    installation_address: item.address || item.installation_address,
    installation_position: item.installation_position,
    latitude: item.latitude,
    longitude: item.longitude,
    model_name: item.model_name,
    manufacturer: item.manufacturer,
    battery_expiry_date: item.battery_expiry_date,
    patch_expiry_date: item.patch_expiry_date || item.pad_expiry_date,
    last_inspection_date: item.last_inspection_date,
    external_display: item.external_display,
    external_non_display_reason: item.external_non_display_reason
  }));

  return (
    <div className="flex h-full flex-col overflow-x-auto bg-gray-950">
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
              <span>점검대상목록</span>
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
              <span>점검진행목록</span>
            </div>
          </button>
        </div>
        <div className="text-xs text-gray-500 px-4">
          {dataCount}개
        </div>
      </div>

      {/* Filter Bar - 목록/점검완료 뷰일 때는 일반 배치, 지도 뷰일 때는 오버레이 */}
      {(viewMode === 'list' || viewMode === 'completed') && (
        <>
          {/* 현장점검 페이지에서는 필터바 항상 표시, 일정관리에서는 토글 가능 */}
          {(pageType === 'inspection' || !filterCollapsed) && <InspectionFilterBar />}

          {/* 필터 접기/펼치기 토글 버튼 - 현장점검 페이지에서는 숨김 */}
          {pageType !== 'inspection' && (
            <button
              onClick={() => setFilterCollapsed(!filterCollapsed)}
              className="w-full bg-gray-800/50 backdrop-blur-md hover:bg-gray-700/60 transition-all flex items-center justify-center py-0.5 lg:hidden shadow-sm border-b border-gray-700/20"
              aria-label={filterCollapsed ? '검색 조건 펼치기' : '검색 조건 접기'}
            >
              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {filterCollapsed ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                )}
              </svg>
            </button>
          )}
        </>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* 지도 뷰일 때 필터바 - 목록 탭과 동일하게 flex 레이아웃 사용 (반응형) */}
        {viewMode === 'map' && (
          <div className="flex-shrink-0">
            {/* 현장점검 페이지에서는 필터바 항상 표시, 일정관리에서는 토글 가능 */}
            {(pageType === 'inspection' || !filterCollapsed) && <InspectionFilterBar />}
            
            {/* 필터 접기/펼치기 토글 버튼 - 현장점검 페이지에서는 숨김, 가운데 상단에 탭 형태로 배치 */}
            {pageType !== 'inspection' && (
              <div className="relative h-0">
                <button
                  onClick={() => setFilterCollapsed(!filterCollapsed)}
                  className="absolute left-1/2 -translate-x-1/2 top-0 z-20 bg-gray-800 hover:bg-gray-700 transition-colors px-3 py-1.5 rounded-b-lg shadow-lg"
                  aria-label={filterCollapsed ? '검색 조건 펼치기' : '검색 조건 접기'}
                  title={filterCollapsed ? '검색 조건 펼치기' : '검색 조건 접기'}
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {filterCollapsed ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    )}
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}

        {viewMode === 'list' ? (
          <DataTable
            filterData={(device) => {
              const equipmentSerial = device.equipment_serial || '';
              const hasActiveSession = inspectionSessions.has(equipmentSerial);
              const isCompleted = completedInspections.has(equipmentSerial);
              // 목록 탭: 점검 시작 전인 장비만
              return !hasActiveSession && !isCompleted;
            }}
            showInspectionStatus={false}
            inspectionSessions={inspectionSessions}
            onInspectionInProgress={handleInspectionInProgress}
            onViewInspectionHistory={handleViewInspectionHistory}
            totalDataCount={data?.length || 0}
            currentViewMode={viewMode}
            pageType="inspection"
            onQuickInspect={(device) => {
              // ✅ 점검시작 전 기존 세션 확인 (데이터 손실 방지)
              const serial = device.equipment_serial || '';
              const existingSession = inspectionSessions.get(serial);

              if (existingSession) {
                // ✅ 진행중인 세션이 있으면 (본인 or 타인) 모달 표시
                handleInspectionInProgress(serial);
              } else {
                // ✅ 진행중인 세션 없으면 새 세션 시작
                router.push(`/inspection/${encodeURIComponent(serial)}`);
              }
            }}
          />
        ) : viewMode === 'completed' ? (
          <DataTable
            filterData={(device) => {
              const equipmentSerial = device.equipment_serial || '';
              const hasActiveSession = inspectionSessions.has(equipmentSerial);
              const isCompleted = completedInspections.has(equipmentSerial);
              // 점검완료 탭: 점검중 + 완료된 장비만
              return isCompleted || hasActiveSession;
            }}
            showInspectionStatus={true}
            inspectionCompleted={completedInspections}
            inspectionSessions={inspectionSessions}
            onInspectionInProgress={handleInspectionInProgress}
            onViewInspectionHistory={handleViewInspectionHistory}
            totalDataCount={data?.length || 0}
            currentViewMode={viewMode}
            pageType="inspection"
          />
        ) : (
          <div className="flex-1 overflow-hidden">
            <MapView
              locations={locations}
              isLoading={isLoading}
              useMapBasedLoading={false}
              userProfile={undefined}
              viewMode="inspection"
              onQuickInspect={(location) => {
                // 즉시 점검 페이지로 이동
                const serial = location.equipment_serial;
                router.push(`/inspection/${serial}`);
              }}
            />
          </div>
        )}
      </div>

      {/* 점검중 모달 */}
      {selectedSession && (
        <InspectionInProgressModal
          isOpen={showInProgressModal}
          onClose={async () => {
            // 🔴 Phase C: 모달 닫을 때 즉시 데이터 새로고침
            setShowInProgressModal(false);
            setSelectedSession(null);
            setCurrentSessionInspectionStatus(undefined);
            // 30초 대기하지 않고 즉시 갱신
            const [sessions, completed] = await Promise.all([
              getActiveInspectionSessions(),
              getCompletedInspections(24),
            ]);
            setInspectionSessions(sessions);
            setCompletedInspections(completed);
          }}
          inspectorName={selectedSession.inspector_name || '알 수 없음'}
          equipmentSerial={selectedSession.equipment_serial}
          isOwnSession={selectedSession.inspector_id === user?.id && user?.id !== undefined}
          startedAt={selectedSession.created_at}
          onResume={() => {
            // 🔴 Phase C: 점검 재개 후 즉시 새로고침
            handleResumeInspection();
            setShowInProgressModal(false);
            setSelectedSession(null);
            setCurrentSessionInspectionStatus(undefined);
          }}
          onCancel={handleCancelSession}
          onStartNew={handleStartNewInspection}  // ✅ 새 세션 시작 핸들러
          inspectionStatus={currentSessionInspectionStatus} // 🔴 Phase B: inspection_status 전달
        />
      )}

      {/* 점검 이력 상세 모달 */}
      {selectedInspection && (() => {
        const canEditInspection = selectedInspection.inspector_id === user.id || user.role === 'master';
        console.log('[InspectionHistoryModal] canEdit 계산:', {
          selectedInspectionInspectorId: selectedInspection.inspector_id,
          userId: user.id,
          userRole: user.role,
          isSameInspector: selectedInspection.inspector_id === user.id,
          isMaster: user.role === 'master',
          finalCanEdit: canEditInspection,
        });
        return (
          <InspectionHistoryModal
            isOpen={showHistoryModal}
            onClose={() => {
              setShowHistoryModal(false);
              setSelectedInspection(null);
            }}
            inspection={selectedInspection}
            onUpdate={handleUpdateInspection}
            onDelete={handleDeleteInspection}
            canEdit={canEditInspection}
          />
        );
      })()}

      {/* 점검 이력 삭제 확인 모달 */}
      {inspectionToDelete && (
        <DeleteInspectionModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setInspectionToDelete(null);
          }}
          equipmentSerial={inspectionToDelete.equipment_serial}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}

export function AdminFullView({ user, isMobile, pageType = 'schedule' }: AdminFullViewProps) {
  // 사용자의 관할 지역을 initialFilters에 포함
  const initialFilters: Record<string, string> = {};
  if (user.organization?.region_code) {
    initialFilters.region = user.organization.region_code;
  }

  return (
    <AEDDataProvider viewMode="inspection" initialFilters={initialFilters} userProfile={user}>
      <AdminFullViewContent user={user} pageType={pageType} />
    </AEDDataProvider>
  );
}