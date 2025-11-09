'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserProfile } from '@/packages/types';
import { AEDDataProvider, useAEDData } from '@/app/aed-data/components/AEDDataProvider';
import { DataTable } from '@/app/aed-data/components/DataTable';
import { InspectionFilterBar } from './InspectionFilterBar';
import { MapView } from './MapView';
import { useToast } from '@/components/ui/Toast';
import { REGION_CODE_TO_DB_LABELS } from '@/lib/constants/regions';
import {
  getActiveInspectionSessions,
  getCompletedInspections,
  getUnavailableAssignments,
  cancelInspectionSession,
  getInspectionHistory,
  updateInspectionRecord,
  deleteInspectionRecord,
  getDraftSessions,
  deleteDraftSession,
  type InspectionSession,
  type InspectionHistory
} from '@/lib/inspections/session-utils';
import { getInspectionActionButtons } from '@/lib/inspections/permissions';
import { InspectionInProgressModal } from './InspectionInProgressModal';
import { InspectionHistoryModal } from './InspectionHistoryModal';
import { DeleteInspectionModal } from './DeleteInspectionModal';
import * as XLSX from 'xlsx';

interface AdminFullViewProps {
  user: UserProfile;
  isMobile: boolean;
  pageType?: 'inspection' | 'schedule'; // 페이지 타입 구분
}

function AdminFullViewContent({ user, pageType = 'schedule' }: { user: UserProfile; pageType?: 'inspection' | 'schedule' }) {
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'completed' | 'drafts'>('list');
  const [filterCollapsed, setFilterCollapsed] = useState(false);
  const [filterMode, setFilterModeState] = useState<'address' | 'jurisdiction'>('address');
  const { data, isLoading, setFilters, filters } = useAEDData();
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  // filterMode를 localStorage에서 복원하고 변경 시 저장
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 저장된 mode 복원 (local_admin일 때만 유효)
      if (user?.role === 'local_admin') {
        const savedMode = localStorage.getItem('inspectionFilterMode') as 'address' | 'jurisdiction' | null;
        if (savedMode === 'address' || savedMode === 'jurisdiction') {
          setFilterModeState(savedMode);
        }
      }
    }
  }, [user?.role]);

  // filterMode 변경 시 localStorage에 저장
  const setFilterMode = (mode: 'address' | 'jurisdiction') => {
    setFilterModeState(mode);
    if (typeof window !== 'undefined' && user?.role === 'local_admin') {
      localStorage.setItem('inspectionFilterMode', mode);
      console.log('[AdminFullView] filterMode changed:', mode);
    }
  };

  // ✅ 프로필 prop을 통해 직접 전달받음
  useEffect(() => {
    if (user) {
      console.log('[AdminFullViewContent] User from prop:', {
        userId: user.id,
        userEmail: user.email,
        userName: user.fullName || user.email,
        userRole: user.role,
        filterMode: user.role === 'local_admin' ? filterMode : 'N/A (not local_admin)',
      });
    }
  }, [user, filterMode]);

  // 점검 세션 상태 관리
  const [inspectionSessions, setInspectionSessions] = useState<Map<string, InspectionSession>>(new Map());
  const [completedInspections, setCompletedInspections] = useState<Set<string>>(new Set());
  const [unavailableAssignments, setUnavailableAssignments] = useState<Set<string>>(new Set());
  const [selectedSession, setSelectedSession] = useState<InspectionSession | null>(null);
  const [showInProgressModal, setShowInProgressModal] = useState(false);

  // 점검 이력 모달 상태 관리
  const [selectedInspection, setSelectedInspection] = useState<InspectionHistory | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [inspectionToDelete, setInspectionToDelete] = useState<InspectionHistory | null>(null);

  // 점검 이력 목록 (엑셀 다운로드용)
  const [inspectionHistoryList, setInspectionHistoryList] = useState<InspectionHistory[]>([]);

  // 임시저장된 세션 목록
  const [draftSessions, setDraftSessions] = useState<any[]>([]);

  // 점검시작/점검불가 선택 모달
  const [showInspectionChoiceModal, setShowInspectionChoiceModal] = useState(false);
  const [selectedDeviceForInspection, setSelectedDeviceForInspection] = useState<any>(null);
  const [showUnavailableModal, setShowUnavailableModal] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState('');
  const [unavailableNote, setUnavailableNote] = useState('');

  // 🔴 Phase B: 현재 모달이 표시 중인 장비의 inspection_status
  const [currentSessionInspectionStatus, setCurrentSessionInspectionStatus] = useState<
    'pending' | 'in_progress' | 'completed' | 'cancelled' | 'unavailable' | undefined
  >(undefined);

  // 점검 세션 및 완료 목록 로드
  useEffect(() => {
    async function loadInspectionData() {
      const [sessions, completed, unavailable] = await Promise.all([
        getActiveInspectionSessions(),
        getCompletedInspections(24), // 최근 24시간
        getUnavailableAssignments(720), // 최근 30일
      ]);
      setInspectionSessions(sessions);
      setCompletedInspections(completed);
      setUnavailableAssignments(unavailable);
    }

    loadInspectionData();

    // 30초마다 갱신
    const interval = setInterval(loadInspectionData, 30000);
    return () => clearInterval(interval);
  }, []);

  // 점검진행목록 탭으로 전환 시 점검 이력 조회 (필터 상태 포함)
  useEffect(() => {
    async function loadInspectionHistory() {
      if (viewMode === 'completed') {
        // local_admin이면 filterMode 적용, 아니면 기본값 'address' 사용
        const mode = user?.role === 'local_admin' ? filterMode : 'address';
        let history = await getInspectionHistory(undefined, 720, mode); // 최근 30일

        // 필터 상태에 따라 클라이언트 사이드 필터링 적용
        // ⚠️ CRITICAL: regionCodes를 REGION_CODE_TO_DB_LABELS로 변환 후 매칭
        // (filters.regionCodes에는 코드가 들어있지만 aed_data.sido에는 한글 라벨이 저장됨)
        if (filters.regionCodes && filters.regionCodes.length > 0) {
          // 코드를 한글 라벨로 변환 (예: 'SEO' → '서울특별시')
          const regionLabels = filters.regionCodes
            .flatMap(code => REGION_CODE_TO_DB_LABELS[code] || [])
            .filter(Boolean);

          // sido 필터 적용 (변환된 라벨과 정확히 매칭)
          history = history.filter(item => {
            const itemSido = (item as any).aed_data?.sido;
            if (!itemSido) return true; // sido가 없으면 포함
            return regionLabels.includes(itemSido);
          });
        }

        // ⚠️ CRITICAL: cityCodes 필터를 독립적으로 처리
        // (regionCodes가 없어도 cityCodes 필터가 적용되어야 함)
        if (filters.cityCodes && filters.cityCodes.length > 0) {
          history = history.filter(item => {
            const itemGugun = (item as any).aed_data?.gugun;
            if (!itemGugun) return true;
            return filters.cityCodes!.includes(itemGugun);
          });
        }

        setInspectionHistoryList(history);
      } else if (viewMode === 'drafts') {
        const drafts = await getDraftSessions();
        setDraftSessions(drafts);
      }
    }

    loadInspectionHistory();
  }, [viewMode, filterMode, user?.role, filters.regionCodes, filters.cityCodes]);

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

  const dataCount = viewMode === 'completed' ? inspectionHistoryList.length : (filteredData?.length || 0);

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

  // 점검 이력 보기 핸들러 (inspection.id 기반)
  const handleViewInspectionHistory = async (inspectionId: string) => {
    try {
      // inspectionHistoryList에서 직접 해당 레코드 찾기 (특정 행 선택 보장)
      const selected = inspectionHistoryList.find(item => item.id === inspectionId);
      if (selected) {
        setSelectedInspection(selected);
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
        // 점검 이력 목록도 재로드
        const mode = user?.role === 'local_admin' ? filterMode : 'address';
        const history = await getInspectionHistory(undefined, 720, mode);
        setInspectionHistoryList(history);
      } else {
        showError(result.error || '점검 이력 삭제 실패');
      }
    } catch (error) {
      console.error('[handleConfirmDelete] Error:', error);
      showError('점검 이력 삭제 실패');
    }
  };

  // 엑셀 다운로드 (서버 사이드 필터링 적용)
  const handleExcelDownload = async () => {
    try {
      // 필터 파라미터 구성 (user 권한 기반)
      const filterParams = {
        regionCodes: user?.organization?.region_code ? [user.organization.region_code] : [],
        cityCodes: user?.organization?.city_code ? [user.organization.city_code] : [],
        limit: 10000, // 최대 10,000건
        mode: user?.role === 'local_admin' ? filterMode : 'address' // local_admin만 필터모드 적용
      };

      console.log('[handleExcelDownload] Filter params:', filterParams);

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
        console.error('[handleExcelDownload] API error:', errorData);
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
      console.log('[handleExcelDownload] Success', {
        filename,
        recordCount,
        filters: filterParams
      });

      showSuccess('엑셀 파일이 다운로드되었습니다');
    } catch (error) {
      console.error('[handleExcelDownload] Error:', error);
      showError('엑셀 다운로드 실패');
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
        <div className="flex items-center gap-3 px-4">
          {/* 점검이력 탭일 때 local_admin을 위한 모드 선택 버튼 */}
          {viewMode === 'completed' && user?.role === 'local_admin' && (
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-gray-800 rounded border border-gray-700">
              <span className="text-gray-300">조회 기준:</span>
              <button
                onClick={() => setFilterMode('address')}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  filterMode === 'address'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                주소
              </button>
              <button
                onClick={() => setFilterMode('jurisdiction')}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  filterMode === 'jurisdiction'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                관할보건소
              </button>
            </div>
          )}
          {viewMode === 'completed' && (
            <button
              onClick={handleExcelDownload}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              엑셀다운로드
            </button>
          )}
          <div className="text-xs text-gray-500">
            {dataCount}개
          </div>
        </div>
      </div>

      {/* Filter Bar - 목록/점검완료/임시저장 뷰일 때는 일반 배치, 지도 뷰일 때는 오버레이 */}
      {(viewMode === 'list' || viewMode === 'completed' || viewMode === 'drafts') && (
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
              const isUnavailable = unavailableAssignments.has(equipmentSerial);
              // 목록 탭: 점검 시작 전인 장비만 (점검불가 제외)
              return !hasActiveSession && !isCompleted && !isUnavailable;
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
                // ✅ 점검시작/점검불가 선택 모달 표시
                setSelectedDeviceForInspection(device);
                setShowInspectionChoiceModal(true);
              }
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
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium whitespace-nowrap ml-2 flex-shrink-0 ${
                          inspection.overall_status === 'pass' ? 'bg-green-900 text-green-200' :
                          inspection.overall_status === 'fail' ? 'bg-red-900 text-red-200' :
                          inspection.overall_status === 'normal' ? 'bg-blue-900 text-blue-200' :
                          inspection.overall_status === 'needs_improvement' ? 'bg-yellow-900 text-yellow-200' :
                          inspection.overall_status === 'malfunction' ? 'bg-red-800 text-red-100' :
                          'bg-gray-700 text-gray-200'
                        }`}>
                          {inspection.overall_status === 'pass' ? '합격' :
                           inspection.overall_status === 'fail' ? '불합격' :
                           inspection.overall_status === 'normal' ? '정상' :
                           inspection.overall_status === 'needs_improvement' ? '개선필요' :
                           inspection.overall_status === 'malfunction' ? '고장' :
                           inspection.overall_status}
                        </span>
                      </div>

                      {/* 본문: 점검 정보 */}
                      <div className="px-4 py-3 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">점검일시</span>
                          <span className="text-gray-200 font-medium">
                            {new Date(inspection.inspection_date).toLocaleString('ko-KR', {
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

                      {/* 푸터: 작업 버튼 */}
                      <div className="px-4 py-3 border-t border-gray-700 flex gap-2">
                        <button
                          onClick={() => handleViewInspectionHistory(inspection.id)}
                          className="flex-1 px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors font-medium"
                          title="상세 정보 보기"
                        >
                          상세
                        </button>
                        {user?.role === 'master' ? (
                          <button
                            onClick={() => {
                              setSelectedInspection(inspection);
                              setInspectionToDelete(inspection);
                              setShowDeleteModal(true);
                            }}
                            className="flex-1 px-3 py-2 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors font-medium"
                            title="삭제 (마스터만)"
                          >
                            삭제
                          </button>
                        ) : (
                          <button
                            disabled
                            className="flex-1 px-3 py-2 text-xs bg-gray-700 text-gray-500 rounded cursor-not-allowed font-medium"
                            title="삭제 불가 (마스터만 가능)"
                          >
                            삭제
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
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 min-w-[120px] max-w-[140px] break-words">장비번호</th>
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
                          <td className="px-4 py-3 text-sm text-gray-400 hidden sm:table-cell whitespace-nowrap">
                            {new Date(inspection.inspection_date).toLocaleString('ko-KR', {
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
                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                              inspection.overall_status === 'pass' ? 'bg-green-900 text-green-200' :
                              inspection.overall_status === 'fail' ? 'bg-red-900 text-red-200' :
                              inspection.overall_status === 'normal' ? 'bg-blue-900 text-blue-200' :
                              inspection.overall_status === 'needs_improvement' ? 'bg-yellow-900 text-yellow-200' :
                              inspection.overall_status === 'malfunction' ? 'bg-red-800 text-red-100' :
                              'bg-gray-700 text-gray-200'
                            }`}>
                              {inspection.overall_status === 'pass' ? '합격' :
                               inspection.overall_status === 'fail' ? '불합격' :
                               inspection.overall_status === 'normal' ? '정상' :
                               inspection.overall_status === 'needs_improvement' ? '개선필요' :
                               inspection.overall_status === 'malfunction' ? '고장' :
                               inspection.overall_status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm space-x-1 flex flex-wrap gap-1">
                            <button
                              onClick={() => handleViewInspectionHistory(inspection.id)}
                              className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors whitespace-nowrap flex-shrink-0"
                              title="상세 정보 보기"
                            >
                              상세
                            </button>
                            {user?.role === 'master' ? (
                              <button
                                onClick={() => {
                                  setSelectedInspection(inspection);
                                  setInspectionToDelete(inspection);
                                  setShowDeleteModal(true);
                                }}
                                className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors whitespace-nowrap flex-shrink-0"
                                title="삭제 (마스터만)"
                              >
                                삭제
                              </button>
                            ) : (
                              <span className="px-2 py-1 text-xs text-gray-500 flex-shrink-0">-</span>
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
          // 임시저장 탭: 임시저장된 점검 세션 표시
          <div className="p-4">
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
                            // 목록 새로고침
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
            const [sessions, completed, unavailable] = await Promise.all([
              getActiveInspectionSessions(),
              getCompletedInspections(24),
              getUnavailableAssignments(720),
            ]);
            setInspectionSessions(sessions);
            setCompletedInspections(completed);
            setUnavailableAssignments(unavailable);
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
        // 권한 체크 - getInspectionActionButtons 사용
        const actionButtons = getInspectionActionButtons(
          user.role,
          user.id,
          selectedInspection.inspector_id,
          user.region_code,
          undefined // TODO: 점검 기록의 region_code 추가 필요
        );

        console.log('[InspectionHistoryModal] 권한 계산:', {
          userRole: user.role,
          userId: user.id,
          inspectorId: selectedInspection.inspector_id,
          actionButtons,
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
            canEdit={actionButtons.showEdit}
            canDelete={actionButtons.showDelete}
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

      {/* 점검 시작 선택 모달 */}
      {showInspectionChoiceModal && selectedDeviceForInspection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-white mb-2">점검 작업 선택</h2>
            <p className="text-sm text-gray-400 mb-6">
              {selectedDeviceForInspection.equipment_serial}
            </p>

            <div className="space-y-3">
              <button
                onClick={() => {
                  const serial = selectedDeviceForInspection.equipment_serial || '';
                  router.push(`/inspection/${encodeURIComponent(serial)}`);
                  setShowInspectionChoiceModal(false);
                  setSelectedDeviceForInspection(null);
                }}
                className="w-full p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">점검 시작</span>
                </div>
                <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <button
                onClick={() => {
                  setShowInspectionChoiceModal(false);
                  setShowUnavailableModal(true);
                }}
                className="w-full p-4 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-12.728 12.728m0-12.728l12.728 12.728" />
                  </svg>
                  <span className="font-medium">점검불가로 처리</span>
                </div>
                <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <button
              onClick={() => {
                setShowInspectionChoiceModal(false);
                setSelectedDeviceForInspection(null);
              }}
              className="w-full mt-4 p-3 text-gray-400 hover:text-gray-300 transition-colors text-sm"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 점검불가 사유 입력 모달 */}
      {showUnavailableModal && selectedDeviceForInspection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-white mb-2">점검불가 사유 선택</h2>
            <p className="text-sm text-gray-400 mb-6">
              {selectedDeviceForInspection.equipment_serial}
            </p>

            <div className="space-y-3">
              <label className="block">
                <input
                  type="radio"
                  name="unavailable-reason"
                  value="disposed"
                  onChange={(e) => setUnavailableReason(e.target.value)}
                  className="mr-2"
                />
                <span className="text-gray-200">폐기됨</span>
              </label>
              <label className="block">
                <input
                  type="radio"
                  name="unavailable-reason"
                  value="broken"
                  onChange={(e) => setUnavailableReason(e.target.value)}
                  className="mr-2"
                />
                <span className="text-gray-200">고장</span>
              </label>
              <label className="block">
                <input
                  type="radio"
                  name="unavailable-reason"
                  value="lost"
                  onChange={(e) => setUnavailableReason(e.target.value)}
                  className="mr-2"
                />
                <span className="text-gray-200">분실</span>
              </label>
              <label className="block">
                <input
                  type="radio"
                  name="unavailable-reason"
                  value="other"
                  onChange={(e) => setUnavailableReason(e.target.value)}
                  className="mr-2"
                />
                <span className="text-gray-200">기타</span>
              </label>

              {unavailableReason === 'other' && (
                <textarea
                  className="w-full p-3 bg-gray-800 text-gray-200 rounded-lg border border-gray-700 focus:border-blue-500 outline-none"
                  placeholder="상세 사유를 입력하세요"
                  value={unavailableNote}
                  onChange={(e) => setUnavailableNote(e.target.value)}
                  rows={3}
                />
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={async () => {
                  if (!unavailableReason) {
                    showError('점검불가 사유를 선택해주세요.');
                    return;
                  }
                  if (unavailableReason === 'other' && !unavailableNote.trim()) {
                    showError('기타 사유를 입력해주세요.');
                    return;
                  }

                  try {
                    const response = await fetch('/api/inspections/mark-unavailable', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        equipment_serial: selectedDeviceForInspection.equipment_serial,
                        reason: unavailableReason,
                        note: unavailableNote
                      })
                    });

                    if (!response.ok) {
                      throw new Error('점검불가 처리에 실패했습니다.');
                    }

                    showSuccess('점검불가로 처리되었습니다.');
                    setShowUnavailableModal(false);
                    setSelectedDeviceForInspection(null);
                    setUnavailableReason('');
                    setUnavailableNote('');
                    // 데이터 새로고침
                    const [sessions, completed, unavailable] = await Promise.all([
                      getActiveInspectionSessions(),
                      getCompletedInspections(24),
                      getUnavailableAssignments(720),
                    ]);
                    setInspectionSessions(sessions);
                    setCompletedInspections(completed);
                    setUnavailableAssignments(unavailable);
                  } catch (error) {
                    showError('점검불가 처리 중 오류가 발생했습니다.');
                  }
                }}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                확인
              </button>
              <button
                onClick={() => {
                  setShowUnavailableModal(false);
                  setUnavailableReason('');
                  setUnavailableNote('');
                  setSelectedDeviceForInspection(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
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