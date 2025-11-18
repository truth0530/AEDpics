'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { UserProfile } from '@/packages/types';
import { AEDDataProvider, useAEDData } from '@/app/aed-data/components/AEDDataProvider';
import { DataTable } from '@/app/aed-data/components/DataTable';
import { InspectionFilterBar } from './InspectionFilterBar';
import { MapView } from './MapView';
import { useToast } from '@/components/ui/Toast';
import { Search } from 'lucide-react';
import { Pagination } from '@/components/Pagination';
import {
  REGION_CODE_TO_DB_LABELS,
  REGION_LONG_LABELS,
  REGION_LABEL_TO_CODE
} from '@/lib/constants/regions';
import { hasNationalAccess } from '@/lib/utils/user-roles';
import { shortenSidoGugun } from '@/lib/utils/address-formatter';
import {
  getActiveInspectionSessions,
  getCompletedInspections,
  getUnavailableAssignments,
  cancelInspectionSession,
  getInspectionHistory,
  updateInspectionRecord,
  deleteInspectionRecord,
  type InspectionSession,
  type InspectionHistory
} from '@/lib/inspections/session-utils';
import { getInspectionActionButtons } from '@/lib/inspections/permissions';
import { InspectionInProgressModal } from './InspectionInProgressModal';
import { InspectionHistoryModal } from './InspectionHistoryModal';
import { InspectionEditModal } from './InspectionEditModal';
import { DeleteInspectionModal } from './DeleteInspectionModal';
import * as XLSX from 'xlsx';

interface AdminFullViewProps {
  user: UserProfile;
  isMobile: boolean;
  pageType?: 'inspection' | 'schedule'; // 페이지 타입 구분
}

// 상태 배지 스타일 및 텍스트 헬퍼 함수
function getStatusBadge(status: string) {
  switch (status) {
    case 'in_progress':
      return {
        text: '점검중',
        className: 'bg-yellow-900 text-yellow-200'
      };
    case 'completed':
      return {
        text: '점검완료',
        className: 'bg-blue-900 text-blue-200'
      };
    case 'unavailable':
      return {
        text: '점검불가',
        className: 'bg-red-900 text-red-200'
      };
    default:
      return {
        text: '알 수 없음',
        className: 'bg-gray-700 text-gray-300'
      };
  }
}

function AdminFullViewContent({ user, pageType = 'schedule' }: { user: UserProfile; pageType?: 'inspection' | 'schedule' }) {
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'completed'>('list');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'completed' | 'unavailable'>('completed');
  const [filterCollapsed, setFilterCollapsed] = useState(false);
  const [filterMode, setFilterModeState] = useState<'address' | 'jurisdiction'>('address');
  // 점검자 필터 (디폴트: 전체, 점검 이력 로드 후 본인으로 설정)
  const [selectedInspector, setSelectedInspector] = useState<string>('');
  const isInspectorInitialized = useRef(false);
  // 통합검색 상태
  const [searchTerm, setSearchTerm] = useState('');
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [inspectionToEdit, setInspectionToEdit] = useState<InspectionHistory | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [inspectionToDelete, setInspectionToDelete] = useState<InspectionHistory | null>(null);

  // 점검 이력 목록 (엑셀 다운로드용)
  const [inspectionHistoryList, setInspectionHistoryList] = useState<InspectionHistory[]>([]);

  // 점검이력 탭 페이지네이션 상태
  const [historyCurrentPage, setHistoryCurrentPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(20);

  // 점검자 필터용 고유 점검자 목록 추출
  const uniqueInspectors = useMemo(() => {
    const inspectorMap = new Map<string, { id: string; name: string }>();
    inspectionHistoryList.forEach((inspection) => {
      if (inspection.inspector_id && inspection.inspector_name) {
        inspectorMap.set(inspection.inspector_id, {
          id: inspection.inspector_id,
          name: inspection.inspector_name,
        });
      }
    });

    const inspectors = Array.from(inspectorMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    // "전체" 옵션 추가
    return [{ id: '', name: '전체' }, ...inspectors];
  }, [inspectionHistoryList]);

  // 점검 이력 로드 후 현재 사용자의 inspector_id 설정 (최초 1회만)
  useEffect(() => {
    if (inspectionHistoryList.length === 0) return;
    if (isInspectorInitialized.current) return; // 이미 초기화되었으면 스킵

    // 점검 이력에서 현재 사용자(user.id)를 inspector_id로 가진 레코드 찾기
    const userInspection = inspectionHistoryList.find(
      (inspection) => inspection.inspector_id === user?.id
    );

    if (userInspection && userInspection.inspector_id) {
      // 현재 사용자가 점검한 이력이 있으면 본인 ID로 설정
      setSelectedInspector(userInspection.inspector_id);
    } else {
      // 없으면 전체로 설정
      setSelectedInspector('');
    }

    isInspectorInitialized.current = true; // 초기화 완료 표시
  }, [inspectionHistoryList, user?.id]);

  // 지역 변경 시 점검자 필터 리셋
  useEffect(() => {
    setSelectedInspector(''); // 전체로 리셋
    isInspectorInitialized.current = false; // 다음 로드 시 재초기화 허용
  }, [filters.regionCodes]);

  // 통합검색 적용 함수
  const handleSearchApply = () => {
    setFilters({
      ...filters,
      search: searchTerm.trim() || undefined,
    } as any);
  };

  // Enter 키로 검색
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearchApply();
    }
  };

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

  // 점검이력 탭에서 RegionFilter 이벤트 수신 및 필터 적용
  useEffect(() => {
    const handleRegionSelected = (e: CustomEvent) => {
      const { sido, gugun, regionCode } = e.detail;
      console.log('[AdminFullView] Region selected from header:', { sido, gugun, viewMode });

      // 점검이력 탭에서만 처리 (다른 탭에서는 InspectionFilterBar가 처리)
      if (viewMode === 'completed') {
        // 지역 필터 변환: 라벨 → 코드
        let regionCodes: string[] | undefined;
        let cityCodes: string[] | undefined;

        if (sido && sido !== '시도') {
          // REGION_LABEL_TO_CODE 매핑 사용
          const regionCodeValue = REGION_LABEL_TO_CODE[sido];
          if (regionCodeValue) {
            regionCodes = [regionCodeValue];
          }
        }

        if (gugun && gugun !== '구군' && gugun !== '전체') {
          cityCodes = [gugun];
        }

        console.log('[AdminFullView] Auto-applying filters on region change (점검이력):', {
          regionCodes,
          cityCodes
        });

        setFilters({
          search: searchTerm.trim() || undefined,
          regionCodes,
          cityCodes,
        } as any);
      }
    };

    window.addEventListener('regionSelected', handleRegionSelected as EventListener);

    return () => {
      window.removeEventListener('regionSelected', handleRegionSelected as EventListener);
    };
  }, [viewMode, setFilters, searchTerm]);

  // viewMode 변경 시 statusFilter 초기화
  useEffect(() => {
    if (viewMode === 'completed' && statusFilter !== 'completed') {
      setStatusFilter('completed');
    }
  }, [viewMode]); // statusFilter 제거: 필터 변경 시 재설정 방지

  // 점검진행목록 탭으로 전환 시 점검 이력 조회 (필터 상태 포함)
  useEffect(() => {
    async function loadInspectionHistory() {
      if (viewMode === 'completed') {
        console.log('[AdminFullView Debug] === 점검이력 로드 시작 ===');
        console.log('[AdminFullView Debug] user.role:', user?.role);
        console.log('[AdminFullView Debug] filterMode:', filterMode);
        console.log('[AdminFullView Debug] statusFilter:', statusFilter);
        console.log('[AdminFullView Debug] filters.regionCodes:', filters.regionCodes);
        console.log('[AdminFullView Debug] filters.cityCodes:', filters.cityCodes);

        // local_admin이면 filterMode 적용, 아니면 기본값 'address' 사용
        const mode = user?.role === 'local_admin' ? filterMode : 'address';

        // API 호출 시 status 파라미터 추가
        const params = new URLSearchParams();
        params.append('mode', mode);
        params.append('hours', '720');
        params.append('status', statusFilter);

        const response = await fetch(`/api/inspections/history?${params.toString()}`);
        if (!response.ok) {
          throw new Error('점검이력 조회 실패');
        }
        const data = await response.json();
        let history = data.inspections || [];

        console.log('[AdminFullView Debug] API 응답 레코드 수:', history.length);
        console.log('[AdminFullView Debug] 첫 3개 레코드:', history.slice(0, 3).map(h => ({
          equipment_serial: h.equipment_serial,
          sido: (h as any).aed_data?.sido,
          gugun: (h as any).aed_data?.gugun
        })));

        // 필터 상태에 따라 클라이언트 사이드 필터링 적용
        // ⚠️ CRITICAL: API가 이미 권한 기반 필터링했으므로 전국 권한 사용자만 클라이언트 필터링 적용
        // 전국 권한: accessLevel === 'national' (동적 판단)
        // 시도 권한: accessLevel === 'regional' (API 필터링만 사용)
        // 시군구 권한: accessLevel === 'local' (API 필터링만 사용)
        const hasNationalAccessFlag = user?.role ? hasNationalAccess(user.role) : false;
        console.log('[AdminFullView Debug] hasNationalAccess 체크:', hasNationalAccessFlag);

        if (hasNationalAccessFlag && filters.regionCodes && filters.regionCodes.length > 0) {
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

        // ⚠️ CRITICAL: cityCodes 필터는 전국 권한 사용자만 클라이언트 필터링 적용
        // 시도/시군구 권한은 API가 이미 권한 기반으로 필터링했으므로 클라이언트 필터링 하지 않음
        // "전체"가 선택된 경우 필터링 스킵
        if (hasNationalAccessFlag && filters.cityCodes && filters.cityCodes.length > 0 && !filters.cityCodes.includes('전체')) {
          history = history.filter(item => {
            const itemGugun = (item as any).aed_data?.gugun;
            if (!itemGugun) return true;
            return filters.cityCodes!.includes(itemGugun);
          });
        }

        // 점검자 필터 적용 (빈 문자열이면 전체 조회)
        if (selectedInspector && selectedInspector !== '') {
          history = history.filter(item => item.inspector_id === selectedInspector);
          console.log('[AdminFullView Debug] 점검자 필터 적용 후 레코드 수:', history.length);
        }

        console.log('[AdminFullView Debug] 필터링 후 최종 레코드 수:', history.length);
        console.log('[AdminFullView Debug] === 점검이력 로드 완료 ===');

        setInspectionHistoryList(history);
      }
    }

    loadInspectionHistory();
  }, [viewMode, statusFilter, filterMode, user?.role, user?.id, filters.regionCodes, filters.cityCodes, selectedInspector]);

  // ✅ mapRegionChanged 이벤트 제거 - 드롭다운 선택만 필터 업데이트

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
      // 우선순위:
      // 1. inspection_sessions 상태 (가장 신뢰성 높음)
      // 2. inspection_assignments 상태
      // 3. completedInspections set

      // 우선순위 1: inspection_sessions에서 활성 세션 확인
      if (hasActiveSession) {
        if (equipmentSerial === '29-0001225') console.log('[AdminFullView] 29-0001225 excluded: hasActiveSession');
        return false; // active/paused 세션 있음 → 제외
      }

      // 우선순위 2: inspection_assignments 상태 확인
      if (inspectionStatus === 'completed' || inspectionStatus === 'in_progress') {
        if (equipmentSerial === '29-0001225') console.log('[AdminFullView] 29-0001225 excluded: inspectionStatus', inspectionStatus);
        return false; // completed/in_progress → 제외
      }

      // 우선순위 3: completedInspections set 확인
      if (isCompleted) {
        if (equipmentSerial === '29-0001225') console.log('[AdminFullView] 29-0001225 excluded: isCompleted');
        return false; // completed inspection → 제외
      }

      if (equipmentSerial === '29-0001225') console.log('[AdminFullView] 29-0001225 INCLUDED in list');
      return true; // 모든 조건을 통과 → 점검대상으로 표시
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

  // 점검이력 탭 페이지네이션 계산
  const totalPages = Math.ceil(inspectionHistoryList.length / historyPageSize);
  const paginatedInspectionHistory = useMemo(() => {
    const startIndex = (historyCurrentPage - 1) * historyPageSize;
    const endIndex = startIndex + historyPageSize;
    return inspectionHistoryList.slice(startIndex, endIndex);
  }, [inspectionHistoryList, historyCurrentPage, historyPageSize]);

  // 페이지 변경 시 최상단으로 스크롤 리셋
  useEffect(() => {
    if (viewMode === 'completed') {
      setHistoryCurrentPage(1);
    }
  }, [viewMode, filters.regionCodes, filters.cityCodes, selectedInspector, statusFilter]);

  // 페이지 크기 변경 핸들러
  const handleHistoryPageSizeChange = (newSize: number) => {
    setHistoryPageSize(newSize);
    setHistoryCurrentPage(1); // 페이지 크기 변경 시 1페이지로 리셋
  };

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
        const params = new URLSearchParams();
        params.append('mode', mode);
        params.append('hours', '720');
        params.append('status', statusFilter);

        const response = await fetch(`/api/inspections/history?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setInspectionHistoryList(data.inspections || []);
        }
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

      {/* 점검이력 상태 필터 버튼 - 점검이력 탭일 때만 표시 */}
      {viewMode === 'completed' && (
        <div className="flex items-center gap-3 px-4 py-2 bg-gray-900/50 border-b border-gray-800 flex-wrap">
          {/* 상태 필터 버튼 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">상태:</span>
            <div className="flex gap-1">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                }`}
              >
                전체
              </button>
              <button
                onClick={() => setStatusFilter('in_progress')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  statusFilter === 'in_progress'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                }`}
              >
                점검중
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  statusFilter === 'completed'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                }`}
              >
                점검완료
              </button>
              <button
                onClick={() => setStatusFilter('unavailable')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  statusFilter === 'unavailable'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                }`}
              >
                점검불가
              </button>
            </div>
          </div>

          {/* 점검자 필터 드롭다운 */}
          {uniqueInspectors.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-medium">점검자:</span>
              <select
                value={selectedInspector}
                onChange={(e) => setSelectedInspector(e.target.value)}
                disabled={user?.role === 'temporary_inspector'}
                className={`px-3 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded text-gray-300 focus:outline-none focus:ring-1 focus:ring-green-600 focus:border-transparent min-w-[150px] ${
                  user?.role === 'temporary_inspector' ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {uniqueInspectors.map((inspector) => (
                  <option key={inspector.id} value={inspector.id}>
                    {inspector.name}
                  </option>
                ))}
              </select>
              {user?.role === 'temporary_inspector' && (
                <span className="text-xs text-gray-500">(본인 이력만 조회 가능)</span>
              )}
            </div>
          )}

          {/* 통합검색 창 */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="통합검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="pl-8 pr-3 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded text-gray-300 focus:outline-none focus:ring-1 focus:ring-green-600 focus:border-transparent w-full"
              />
            </div>
            <button
              onClick={handleSearchApply}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors whitespace-nowrap"
            >
              조회
            </button>
          </div>
        </div>
      )}

      {/* Filter Bar - 목록 뷰일 때만 표시 (점검완료 뷰는 자체 필터 사용) */}
      {viewMode === 'list' && (
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
              const inspectionStatus = (device as any).inspection_status;

              // CRITICAL FIX: inspection_status를 정확하게 체크
              // - pending 또는 NULL: 점검 대상 (표시)
              // - in_progress, completed, unavailable, cancelled: 제외
              const shouldExclude = inspectionStatus && inspectionStatus !== 'pending';

              // 디버그: 29-0001352 (세인트존스베리아카데미) 추적
              if (equipmentSerial === '29-0001352') {
                console.log('[AdminFullView DataTable filterData]', {
                  serial: equipmentSerial,
                  inspectionStatus,
                  shouldExclude,
                  hasActiveSession,
                  isCompleted,
                  isUnavailable,
                  willInclude: !hasActiveSession && !isCompleted && !isUnavailable && !shouldExclude
                });
              }

              return !hasActiveSession && !isCompleted && !isUnavailable && !shouldExclude;
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
          <div className="flex flex-col h-[calc(100vh-280px)]">
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
                  {paginatedInspectionHistory.map((inspection) => (
                    <div
                      key={inspection.id}
                      className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden hover:bg-gray-750 transition-colors"
                    >
                      {/* 헤더: 장비번호 + 상태 */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/50">
                        <div className="font-medium text-sm text-gray-200 truncate flex-1">
                          {inspection.equipment_serial}
                        </div>
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium whitespace-nowrap ml-2 flex-shrink-0 ${getStatusBadge(inspection.status).className}`}>
                          {getStatusBadge(inspection.status).text}
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

                      {/* 푸터: 작업 버튼 */}
                      <div className="px-4 py-3 border-t border-gray-700 flex gap-2">
                        {(() => {
                          // 점검 기록의 지역 코드 추출
                          const inspectionSido = inspection.aed_data?.sido;
                          const inspectionRegionCode = inspectionSido ?
                            (REGION_LONG_LABELS[inspectionSido] || REGION_LABEL_TO_CODE[inspectionSido]) :
                            undefined;

                          // 권한 확인
                          const permission = getInspectionActionButtons(
                            user.role,
                            user.id,
                            inspection.inspector_id,
                            user.region_code,
                            inspectionRegionCode
                          );

                          if (permission.showEdit) {
                            return (
                              <button
                                onClick={() => handleViewInspectionHistory(inspection.id)}
                                className="flex-1 p-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800 text-sm font-medium"
                                title="점검 기록 수정"
                                aria-label="점검 기록 수정"
                              >
                                수정
                              </button>
                            );
                          } else {
                            return (
                              <button
                                onClick={() => handleViewInspectionHistory(inspection.id)}
                                className="flex-1 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 text-sm font-medium"
                                title="상세 정보 보기"
                                aria-label="상세 정보 보기"
                              >
                                보기
                              </button>
                            );
                          }
                        })()}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 데스크톱/태블릿 레이아웃 (>= 640px) */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full border-collapse table-fixed">
                    <thead className="sticky top-0 bg-gray-800 border-b border-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 hidden md:table-cell min-w-[110px] max-w-[150px]">시도/구군</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 hidden xl:table-cell min-w-[150px] max-w-[200px]">설치기관</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 hidden lg:table-cell min-w-[120px] max-w-[140px] break-words">관리번호</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 min-w-[120px] max-w-[140px] break-words">장비연번</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 hidden sm:table-cell min-w-[130px] max-w-[150px]">점검일시</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 hidden lg:table-cell min-w-[80px] max-w-[100px]">점검자</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 min-w-[90px] max-w-[110px]">상태</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 min-w-[110px] max-w-[140px]">작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedInspectionHistory.map((inspection) => (
                        <tr
                          key={inspection.id}
                          className="border-b border-gray-700 hover:bg-gray-800/50 transition-colors"
                        >
                          <td className="px-4 py-3 text-sm text-gray-400 hidden md:table-cell truncate">
                            {inspection.aed_data
                              ? shortenSidoGugun(`${inspection.aed_data.sido || '-'} ${inspection.aed_data.gugun || '-'}`)
                              : '-'
                            }
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-400 hidden xl:table-cell truncate">
                            {inspection.aed_data?.installation_institution || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-400 hidden lg:table-cell truncate whitespace-nowrap">
                            {inspection.aed_data?.management_number || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-200 font-medium truncate whitespace-nowrap">{inspection.equipment_serial}</td>
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
                          <td className="px-4 py-3 text-sm">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${getStatusBadge(inspection.status).className}`}>
                              {getStatusBadge(inspection.status).text}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm space-x-1 flex flex-wrap gap-1">
                            {(() => {
                              // 점검 기록의 지역 코드 추출
                              const inspectionSido = inspection.aed_data?.sido;
                              const inspectionRegionCode = inspectionSido ?
                                (REGION_LONG_LABELS[inspectionSido] || REGION_LABEL_TO_CODE[inspectionSido]) :
                                undefined;

                              // 권한 확인
                              const permission = getInspectionActionButtons(
                                user.role,
                                user.id,
                                inspection.inspector_id,
                                user.region_code,
                                inspectionRegionCode
                              );

                              if (permission.showEdit) {
                                return (
                                  <button
                                    onClick={() => handleViewInspectionHistory(inspection.id)}
                                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded transition-colors flex-shrink-0 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800 text-xs font-medium"
                                    title="점검 기록 수정"
                                    aria-label="점검 기록 수정"
                                  >
                                    수정
                                  </button>
                                );
                              } else {
                                return (
                                  <button
                                    onClick={() => handleViewInspectionHistory(inspection.id)}
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex-shrink-0 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 text-xs font-medium"
                                    title="상세 정보 보기"
                                    aria-label="상세 정보 보기"
                                  >
                                    보기
                                  </button>
                                );
                              }
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            </div>

            {/* 페이지네이션 - 하단 고정 */}
            {inspectionHistoryList.length > 0 && (
              <Pagination
                currentPage={historyCurrentPage}
                hasMore={historyCurrentPage < totalPages}
                onPageChange={setHistoryCurrentPage}
                pageSize={historyPageSize}
                pageItemCount={paginatedInspectionHistory.length}
                totalCount={inspectionHistoryList.length}
                onPageSizeChange={handleHistoryPageSizeChange}
              />
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
              filters={filters}
              inspectionSessions={inspectionSessions}
              inspectionCompleted={completedInspections}
              scheduledEquipment={new Set()}
              onQuickInspect={(location) => {
                // 즉시 점검 페이지로 이동
                const serial = location.equipment_serial;
                router.push(`/inspection/${serial}`);
              }}
              onInspectionInProgress={(equipmentSerial) => {
                handleInspectionInProgress(equipmentSerial);
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
            onEdit={(inspection) => {
              setInspectionToEdit(inspection);
              setShowHistoryModal(false);
              setShowEditModal(true);
            }}
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

      {/* 점검 이력 수정 모달 */}
      <InspectionEditModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setInspectionToEdit(null);
        }}
        inspection={inspectionToEdit}
        onSave={handleUpdateInspection}
      />

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