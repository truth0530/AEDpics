'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';

// 개선된 튜토리얼 버전 2 - 모듈화 적용
import { useInspectionData, type AEDDevice } from './hooks/useInspectionData';
import { useOfflineSync } from './hooks/useOfflineSync';
import { useTooltipSystem } from './hooks/useTooltipSystem';
import StorageChecklistSection from './components/StorageChecklistSection';
// 컴포넌트 활성화 - UX 개선 계획에 따라 주석 해제
// import { OfflineStatusBanner } from './components/OfflineStatusBanner';
// import { SyncProgressBar } from './components/SyncProgressBar';
// import { PriorityBadge } from './components/PriorityBadge'; // 현재 사용하지 않음
import { ProgressTracker } from './components/ProgressTracker';
import { NotificationPanel } from './components/NotificationPanel';
import { DataValidationWarnings } from './components/DataValidationWarnings';
import { CategorySection } from './components/CategorySection';
import type { RealAEDData } from './types/RealAEDTypes';
import GuidelineViewerModal from '../../components/ui/GuidelineViewerModal';
import KakaoMapSection from './components/KakaoMapSection';

// 유효기간 계산 헬퍼 함수
const calculateExpiryInfo = (dateStr: string) => {
  // 빈 값이거나 유효하지 않은 날짜 처리
  if (!dateStr || dateStr === '' || dateStr === 'undefined' || dateStr === 'null') {
    return {
      daysText: '날짜없음',
      daysColor: 'text-gray-400',
      diffDays: '−'
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDate = new Date(dateStr);

  // 유효하지 않은 날짜 확인
  if (isNaN(expiryDate.getTime())) {
    return {
      daysText: '날짜없음',
      daysColor: 'text-gray-400',
      diffDays: '−'
    };
  }

  const diffTime = expiryDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const daysText = diffDays > 0 ? `${diffDays}일 남음` : diffDays === 0 ? '오늘 만료' : `${Math.abs(diffDays)}일 지남`;
  const daysColor = diffDays > 30 ? 'text-green-400' : diffDays > 0 ? 'text-yellow-400' : 'text-red-400';

  return { daysText, daysColor, diffDays };
};

const mapAEDDeviceToRealData = (device: AEDDevice | null): RealAEDData | null => {
  if (!device) {
    return null;
  }

  const [sido = '', gugun = ''] = device.특성 ?? ['',''];
  const nowIso = new Date().toISOString();
  const numericId = Number.parseInt(device.id, 10);

  return {
    id: Number.isFinite(numericId) ? numericId : 0,
    management_number: device.id || '',
    equipment_serial: device.serialNumber || device.id || '',
    sido,
    gugun,
    operation_status: '운영',
    display_allowed: device.displayAllowed ? '표출허용' : '미표출',
    external_display: device.externalDisplay ? 'Y' : 'N',
    external_non_display_reason: device.externalNoDisplayReason || null,
    government_support: device.governmentSupported ? '국고지원' : '민간부담',
    report_date: device.registrationDate || '',
    registration_date: device.registrationDate || '',
    first_installation_date: device.initialInstallDate || device.installDate || '',
    installation_date: device.installDate || '',
    last_inspection_date: device.lastCheck || '',
    last_use_date: null,
    battery_expiry_date: device.batteryExpiry || '',
    patch_expiry_date: device.padExpiry || device.patchExpiry || '',
    manufacturing_date: device.manufacturingDate || '',
    replacement_date: device.replacementDate || '',
    installation_institution: device.installationOrg || device.name,
    installation_address: device.address || device.location || '',
    jurisdiction_health_center: '',
    purchase_institution: device.purchaseOrg || '',
    category_1: device.category1 || '',
    category_2: device.category2 || '',
    category_3: device.category3 || '',
    installation_method: null,
    installation_location_address: device.installationLocation || '',
    installation_position: device.installationLocation || device.location || '',
    longitude: Number.parseFloat(device.lng) || 0,
    latitude: Number.parseFloat(device.lat) || 0,
    institution_contact: device.manager || '',
    establisher: device.founder || '',
    manager: device.manager || '',
    model_name: device.modelName || '',
    manufacturer: device.manufacturer || '',
    manufacturing_country: '한국',
    serial_number: device.serialNumber || device.id || '',
    patch_available: device.patchAvailable ? 'Y' : 'N',
    remarks: device.관심사항?.join(', ') || null,
    saeum_deletion_status: device.saolDeleted ? 'Y' : 'N',
    created_at: nowIso,
    updated_at: nowIso
  };
};

const Tutorial2Page = React.memo(() => {
  // 커스텀 훅 사용
  const {
    devices,
    teamMembers,
    urgentWarningDevices,
    selectedDevice,
    setSelectedDevice,
    inspectionStates,
    setInspectionStates,
    completedItems,
    // setCompletedItems,
    validationErrors,
    // setValidationErrors,
    equipmentData,
    setEquipmentData,
    locationData,
    setLocationData,
    operationStatus,
    setOperationStatus,
    batteryStatus,
    setBatteryStatus,
    installMethod,
    setInstallMethod,
    storageChecklist,
    setStorageChecklist,
    equipmentConfirmed,
    setEquipmentConfirmed,
    // calculateProgress,
    markItemComplete,
    validateInput,
    getPriorityBadge,
    
    // 데이터 로딩 상태 (실제 수파베이스 연동)
    isLoading,
    dataSource,
    
    // 실제 제조사/모델 데이터
    realManufacturers,
    realModels,
    dynamicDataLoading,
    
    // 새로운 기능들
    refreshDevices,
    loadDevicesByPriority,
    // loadDevicesByRegion, // 서울/부산 필터 제거로 사용 안함
    searchDevices,
    loadRealManufacturers,
    loadRealModels,
    loadDevicesByManufacturer
  } = useInspectionData();
  
  const {
    isOnline,
    setIsOnline,
    syncStatus,
    // setSyncStatus,
    offlineDataCount,
    // setOfflineDataCount,
    showSyncProgress,
    // setShowSyncProgress,
    syncProgress,
    // setSyncProgress,
    simulateSync,
    saveOfflineData
  } = useOfflineSync();
  
  const {
    activeTooltip,
    setActiveTooltip,
    // hoveredItem,
    setHoveredItem,
    getTooltipContent,
    showTooltip,
    handleItemHover,
    // handleItemLeave,
    clearHoverTimer
  } = useTooltipSystem();
  
  // 남은 상태들
  const [currentPage, setCurrentPage] = useState('inspection2');
  const scrollPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const [deviceType, setDeviceType] = useState<'mobile' | 'desktop'>('mobile');
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [isGuidelineOpen, setIsGuidelineOpen] = useState(false);
  const [searchMode, setSearchMode] = useState('priority');
  const [userRole, setUserRole] = useState('local');
  const [tutorialStep, setTutorialStep] = useState(1);

  // 데이터 검증 관련 상태
  const [showValidationWarnings, setShowValidationWarnings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [editingManager, setEditingManager] = useState(false);
  const [managerName, setManagerName] = useState('홍길동');
  const [externalDisplay, setExternalDisplay] = useState('Y');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingChange, setPendingChange] = useState<{itemKey: string, oldValue: string, newValue: string} | null>(null);
  const [editingEquipment, setEditingEquipment] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [isDraggingPin, setIsDraggingPin] = useState(false);
  const [pinPosition, setPinPosition] = useState({ x: 50, y: 50 }); // percentage position
  const mapRef = useRef<HTMLDivElement>(null);
  const [totalInspectionItems] = useState(20); // 총 점검 항목 수
  
  // 추가 상태 변수들 (커스텀 훅에 없는 것들만)
  const [desktopPinPosition, setDesktopPinPosition] = useState({ x: 397, y: 85 });
  const [isDraggingDesktopPin, setIsDraggingDesktopPin] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const [editingOperatingHours, setEditingOperatingHours] = useState(false);
  const [is24Hours, setIs24Hours] = useState(false);
  const [sundayWeeks, setSundayWeeks] = useState({
    all: false,
    week1: false,
    week2: false,
    week3: false,
    week4: false,
    week5: false
  });
  const [operatingHours, setOperatingHours] = useState([
    { day: '월', start: '09:00', end: '18:00' },
    { day: '화', start: '09:00', end: '18:00' },
    { day: '수', start: '09:00', end: '18:00' },
    { day: '목', start: '09:00', end: '18:00' },
    { day: '금', start: '09:00', end: '18:00' },
    { day: '토', start: '10:00', end: '14:00' },
    { day: '일', start: '00:00', end: '00:00' },
    { day: '공', start: '00:00', end: '00:00' }
  ]);

  // 후속조치 필요여부 상태
  const [followUpAction, setFollowUpAction] = useState('');
  
  // 24시간 사용가능 버튼 핸들러
  const handle24Hours = () => {
    setIs24Hours(!is24Hours);
    if (!is24Hours) {
      // 24시간으로 설정
      setOperatingHours(operatingHours.map(schedule => ({
        ...schedule,
        start: '00:00',
        end: '23:59'
      })));
    } else {
      // 기본 시간으로 복원
      setOperatingHours([
        { day: '월', start: '09:00', end: '18:00' },
        { day: '화', start: '09:00', end: '18:00' },
        { day: '수', start: '09:00', end: '18:00' },
        { day: '목', start: '09:00', end: '18:00' },
        { day: '금', start: '09:00', end: '18:00' },
        { day: '토', start: '10:00', end: '14:00' },
        { day: '일', start: '00:00', end: '00:00' },
        { day: '공', start: '00:00', end: '00:00' }
      ]);
    }
  };

  // 일요일 운영시간 확인
  const isSundayOperating = useMemo(() => {
    const sundaySchedule = operatingHours.find(schedule => schedule.day === '일');
    return sundaySchedule && !(sundaySchedule.start === '00:00' && sundaySchedule.end === '00:00');
  }, [operatingHours]);

  // 우선순위 관리 탭 상태 변수들
  const [dateFilterType, setDateFilterType] = useState('battery'); // battery, pad, device, inspection
  const [dateFilterRange, setDateFilterRange] = useState('all'); // all, 30, 60, 90, 180, expired
  const [sortBy, setSortBy] = useState('priority'); // priority, battery, pad, device, inspection, name, location
  const [mandatoryOnly, setMandatoryOnly] = useState(false);
  const [excludeMobileEquipment, setExcludeMobileEquipment] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [filteredDevices, setFilteredDevices] = useState<AEDDevice[]>([]);

  // 필터링 및 정렬 로직
  useEffect(() => {
    let filtered = [...devices];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 날짜 필터링
    if (dateFilterRange !== 'all') {
      filtered = filtered.filter(device => {
        let targetDate: Date;

        // 필터 타입에 따른 날짜 선택
        switch(dateFilterType) {
          case 'battery':
            targetDate = new Date(device.batteryExpiry);
            break;
          case 'pad':
            targetDate = new Date(device.padExpiry);
            break;
          case 'device':
            targetDate = new Date(device.deviceExpiry);
            break;
          case 'inspection':
            targetDate = new Date(device.lastCheck);
            break;
          default:
            targetDate = new Date(device.batteryExpiry);
        }

        const diffTime = targetDate.getTime() - today.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        // 점검일자는 반대로 계산 (오래된 것을 찾기)
        if (dateFilterType === 'inspection') {
          const daysSinceCheck = -diffDays; // 양수로 변환
          switch(dateFilterRange) {
            case 'expired': return daysSinceCheck > 180; // 180일 이상 경과
            case '180': return daysSinceCheck >= 180;
            case '90': return daysSinceCheck >= 90;
            case '60': return daysSinceCheck >= 60;
            case '30': return daysSinceCheck >= 30;
            default: return true;
          }
        } else {
          // 유효기간 필터 (배터리, 패드, 장치)
          switch(dateFilterRange) {
            case 'expired': return diffDays < 0; // 이미 만료
            case '30': return diffDays <= 30 && diffDays >= 0;
            case '60': return diffDays <= 60 && diffDays >= 0;
            case '90': return diffDays <= 90 && diffDays >= 0;
            case '180': return diffDays <= 180 && diffDays >= 0;
            default: return true;
          }
        }
      });
    }

    // 구비의무기관 필터링
    if (mandatoryOnly) {
      filtered = filtered.filter(device =>
        device.category1 === '구비의무기관'
      );
    }

    // 이동식장비 제외 필터링
    if (excludeMobileEquipment) {
      filtered = filtered.filter(device => {
        // external_non_display_reason이 이동식 장비 관련 사유가 아닌 경우만 포함
        const mobileReasons = ['구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박'];
        return !mobileReasons.some(reason =>
          device.externalNoDisplayReason?.includes(reason)
        );
      });
    }

    // 정렬
    filtered.sort((a, b) => {
      switch(sortBy) {
        case 'priority': {
          // 우선순위 점수 계산 (낮은 점수가 높은 우선순위)
          const calcPriority = (device: AEDDevice) => {
            const batteryDate = new Date(device.batteryExpiry);
            const padDate = new Date(device.padExpiry);
            const minDate = batteryDate < padDate ? batteryDate : padDate;
            const daysUntilExpiry = Math.floor((minDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return daysUntilExpiry;
          };
          return calcPriority(a) - calcPriority(b);
        }
        case 'battery':
          return new Date(a.batteryExpiry).getTime() - new Date(b.batteryExpiry).getTime();
        case 'pad':
          return new Date(a.padExpiry).getTime() - new Date(b.padExpiry).getTime();
        case 'device':
          return new Date(a.deviceExpiry).getTime() - new Date(b.deviceExpiry).getTime();
        case 'inspection':
          return new Date(a.lastCheck).getTime() - new Date(b.lastCheck).getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        case 'location':
          return a.location.localeCompare(b.location);
        default:
          return 0;
      }
    });

    setFilteredDevices(filtered);
  }, [devices, dateFilterType, dateFilterRange, sortBy, mandatoryOnly, excludeMobileEquipment]);

  // 일요일 운영시간 변경 시 일요일 주차 선택 초기화
  useEffect(() => {
    if (!isSundayOperating) {
      setSundayWeeks({
        all: false,
        week1: false,
        week2: false,
        week3: false,
        week4: false,
        week5: false
      });
    }
  }, [isSundayOperating]);

  // 일요일 사용 가능주 핸들러
  const handleSundayWeeks = (week: string) => {
    // 일요일이 운영하지 않으면 체크박스 변경 불가
    if (!isSundayOperating) {
      showAlert('일요일 운영시간을 먼저 설정해주세요');
      return;
    }

    if (week === 'all') {
      const newAllState = !sundayWeeks.all;
      setSundayWeeks({
        all: newAllState,
        week1: newAllState,
        week2: newAllState,
        week3: newAllState,
        week4: newAllState,
        week5: newAllState
      });
    } else {
      setSundayWeeks(prev => {
        const newState = { ...prev, [week]: !prev[week as keyof typeof prev] };
        // 모든 주가 선택되면 '매주'도 체크
        const allWeeksSelected = newState.week1 && newState.week2 && newState.week3 && newState.week4 && newState.week5;
        newState.all = allWeeksSelected;
        return newState;
      });
    }
  };

  // 스크롤 위치 저장을 위한 ref (현재는 사용하지 않음 - 스크롤 점프 문제 해결)
  // const scrollPositionRef = useRef<number>(0);
  const router = useRouter();

  // 데이터는 커스텀 훅에서 가져옴 (devices 이미 선언됨)


  // 전국 시도별 점검 현황 데이터
  const nationalRegions = useMemo(() => [
    { region: '서울특별시', total: 8847, completed: 7231, urgent: 89, rate: 81.7 },
    { region: '부산광역시', total: 3204, completed: 2681, urgent: 45, rate: 83.7 },
    { region: '대구광역시', total: 2387, completed: 1945, urgent: 32, rate: 81.5 },
    { region: '인천광역시', total: 2934, completed: 2456, urgent: 41, rate: 83.7 },
    { region: '광주광역시', total: 1542, completed: 1287, urgent: 18, rate: 83.5 },
    { region: '대전광역시', total: 1698, completed: 1421, urgent: 21, rate: 83.7 },
    { region: '울산광역시', total: 1245, completed: 1034, urgent: 15, rate: 83.0 },
    { region: '세종특별자치시', total: 428, completed: 362, urgent: 5, rate: 84.6 },
    { region: '경기도', total: 12456, completed: 10234, urgent: 134, rate: 82.2 },
    { region: '강원특별자치도', total: 2103, completed: 1745, urgent: 28, rate: 83.0 },
    { region: '충청북도', total: 2087, completed: 1734, urgent: 25, rate: 83.1 },
    { region: '충청남도', total: 2942, completed: 2456, urgent: 34, rate: 83.5 },
    { region: '전북특별자치도', total: 2456, completed: 2034, urgent: 31, rate: 82.8 },
    { region: '전라남도', total: 2734, completed: 2287, urgent: 38, rate: 83.7 },
    { region: '경상북도', total: 3845, completed: 3187, urgent: 52, rate: 82.9 },
    { region: '경상남도', total: 4234, completed: 3521, urgent: 58, rate: 83.2 },
    { region: '제주특별자치도', total: 892, completed: 745, urgent: 12, rate: 83.5 }
  ], []);

  // 서울시 시군구별 점검 현황 데이터 (예시)
  const seoulDistricts = useMemo(() => [
    { region: '종로구', total: 345, completed: 289, urgent: 4, rate: 83.8 },
    { region: '중구', total: 298, completed: 251, urgent: 3, rate: 84.2 },
    { region: '용산구', total: 267, completed: 223, urgent: 3, rate: 83.5 },
    { region: '성동구', total: 412, completed: 342, urgent: 5, rate: 83.0 },
    { region: '광진구', total: 389, completed: 325, urgent: 4, rate: 83.5 },
    { region: '동대문구', total: 445, completed: 371, urgent: 6, rate: 83.4 },
    { region: '중랑구', total: 523, completed: 436, urgent: 7, rate: 83.4 },
    { region: '성북구', total: 578, completed: 482, urgent: 8, rate: 83.4 },
    { region: '강북구', total: 398, completed: 332, urgent: 5, rate: 83.4 },
    { region: '도봉구', total: 421, completed: 351, urgent: 6, rate: 83.4 },
    { region: '노원구', total: 687, completed: 573, urgent: 9, rate: 83.4 },
    { region: '은평구', total: 534, completed: 445, urgent: 7, rate: 83.3 },
    { region: '서대문구', total: 378, completed: 315, urgent: 4, rate: 83.3 },
    { region: '마포구', total: 456, completed: 380, urgent: 5, rate: 83.3 },
    { region: '양천구', total: 521, completed: 434, urgent: 7, rate: 83.3 },
    { region: '강서구', total: 678, completed: 565, urgent: 9, rate: 83.3 },
    { region: '구로구', total: 445, completed: 371, urgent: 6, rate: 83.4 },
    { region: '금천구', total: 287, completed: 239, urgent: 3, rate: 83.3 },
    { region: '영등포구', total: 423, completed: 352, urgent: 5, rate: 83.2 },
    { region: '동작구', total: 456, completed: 380, urgent: 5, rate: 83.3 },
    { region: '관악구', total: 598, completed: 498, urgent: 8, rate: 83.3 },
    { region: '서초구', total: 498, completed: 415, urgent: 6, rate: 83.3 },
    { region: '강남구', total: 567, completed: 473, urgent: 7, rate: 83.4 },
    { region: '송파구', total: 645, completed: 538, urgent: 8, rate: 83.4 },
    { region: '강동구', total: 598, completed: 498, urgent: 8, rate: 83.3 }
  ], []);

  // teamMembers는 커스텀 훅에서 가져옴

  useEffect(() => {
    const checkDevice = () => {
      setDeviceType(window.innerWidth < 768 ? 'mobile' : 'desktop');
    };
    
    checkDevice();
    window.addEventListener('resize', checkDevice);
    
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  const showAlert = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    // 간단한 토스트 알림
    const toast = document.createElement('div');
    const bgColor = type === 'error' ? 'bg-red-600' : type === 'warning' ? 'bg-yellow-600' : 'bg-green-600';
    toast.className = `fixed bottom-4 right-4 ${bgColor} text-white px-4 py-2 rounded-lg z-50 shadow-lg`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // 진동 피드백 (navigator.vibrate 지원 시)
    if ('vibrate' in navigator && type === 'error') {
      navigator.vibrate(200);
    }
    
    setTimeout(() => toast.remove(), 3000);
  };

  const startNavigation = (placeName: string, lat: string, lng: string) => {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-gray-800 p-6 rounded-lg">
        <h3 class="text-white text-lg mb-4">길안내 선택</h3>
        <p class="text-gray-300 mb-4">목적지: ${placeName}</p>
        <div class="space-y-2">
          <button class="w-full bg-blue-600 text-white py-2 px-4 rounded" onclick="window.open('tmap://route?goalname=${encodeURIComponent(placeName)}&goalx=${lng}&goaly=${lat}')">티맵으로 안내</button>
          <button class="w-full bg-yellow-600 text-white py-2 px-4 rounded" onclick="alert('실제 구현시 카카오내비 연동 예정')">길찾기 안내</button>
          <button class="w-full bg-green-600 text-white py-2 px-4 rounded" onclick="window.open('nmap://route/car?dlat=${lat}&dlng=${lng}&dname=${encodeURIComponent(placeName)}')">네이버지도로 안내</button>
          <button class="w-full bg-gray-600 text-white py-2 px-4 rounded mt-4" onclick="this.parentElement.parentElement.parentElement.remove()">취소</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  const startInspection = (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);

    // GPS 이상 확인 (예시 데이터)
    const gpsIssues = [
      { id: '1', type: 'default_coord', severity: 'critical' },
      { id: '3', type: 'address_mismatch', severity: 'high' },
      { id: '5', type: 'outlier', severity: 'medium' },
      { id: '7', type: 'cluster', severity: 'low' }
    ];

    const deviceGpsIssue = gpsIssues.find(issue => issue.id === deviceId);

    if (deviceGpsIssue) {
      const issueMessages = {
        default_coord: '디폴트 좌표가 설정되어 있습니다. 실제 위치를 확인해주세요.',
        address_mismatch: '주소와 좌표가 일치하지 않습니다. 위치 정보를 검증해주세요.',
        outlier: '좌표가 예상 범위를 벗어났습니다. 위치를 확인해주세요.',
        cluster: '여러 AED가 같은 위치에 표시됩니다. 각 장비의 정확한 위치를 확인해주세요.'
      };

      // GPS 경고 메시지 표시
      showAlert(
        `GPS 좌표 이상 경고: ${issueMessages[deviceGpsIssue.type as keyof typeof issueMessages]}`,
        'warning'
      );
    }

    setSelectedDevice(device || null);

    setShowValidationWarnings(!!device);

    setShowInspectionModal(true);
  };

  const saveInspection = () => {
    // 유효성 검사
    const hasErrors = Object.values(validationErrors).some(error => error !== '');
    if (hasErrors) {
      showAlert('입력 오류를 수정해주세요.', 'error');
      return;
    }
    
    showAlert('점검이 완료되었습니다', 'success');
    setShowInspectionModal(false);
    setSelectedDevice(null);
    setShowValidationWarnings(false);
    setInspectionStates({});
    
    // 진동 피드백
    if ('vibrate' in navigator) {
      navigator.vibrate(100);
    }
  };

  // 스크롤 점프 문제 해결: 스크롤 위치 저장 및 복원
  const preserveScrollPosition = useCallback((callback: () => void) => {
    // 현재 스크롤 위치 저장
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    // 상태 업데이트 실행
    callback();

    // 다음 프레임에서 스크롤 위치 복원
    requestAnimationFrame(() => {
      window.scrollTo(scrollLeft, scrollTop);
    });
  }, []);

  const handlePageChange = useCallback((pageId: string) => {
    if (pageId === currentPage) {
      return;
    }

    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    scrollPositionsRef.current[currentPage] = { x: scrollLeft, y: scrollTop };

    setCurrentPage(pageId);

    requestAnimationFrame(() => {
      const target = scrollPositionsRef.current[pageId] || { x: 0, y: 0 };
      window.scrollTo(target.x, target.y);
    });
  }, [currentPage]);

  // urgentWarningDevices는 커스텀 훅에서 가져옴

  // 점검 항목 버튼 핸들러
  const handleItemConfirm = (e: React.MouseEvent, itemKey: string, originalValue: string) => {
    e.preventDefault();
    e.stopPropagation();
    preserveScrollPosition(() => {
      setInspectionStates(prev => {
        const currentStatus = prev[itemKey]?.status;
        // 이미 confirmed 상태면 pending으로 되돌리기 (토글)
        if (currentStatus === 'confirmed') {
          return {
            ...prev,
            [itemKey]: {
              status: 'pending',
              isEditing: false,
              originalValue,
              currentValue: originalValue,
              hasIssue: false
            }
          };
        }
        // pending이나 다른 상태면 confirmed로 변경
        return {
          ...prev,
          [itemKey]: {
            status: 'confirmed',
            isEditing: false,
            originalValue,
            currentValue: originalValue,
            hasIssue: false
          }
        };
      });
    });
    const currentStatus = inspectionStates[itemKey]?.status;
    if (currentStatus === 'confirmed') {
      showAlert(`${itemKey} 항목 선택이 취소되었습니다`);
    } else {
      showAlert(`${itemKey} 항목이 일치로 처리되었습니다`);
    }
  };

  const handleItemCorrect = (e: React.MouseEvent, itemKey: string, originalValue: string) => {
    e.preventDefault();
    e.stopPropagation();
    preserveScrollPosition(() => {
      setInspectionStates(prev => ({
        ...prev,
        [itemKey]: {
          status: 'corrected',
          isEditing: true,
          originalValue,
          currentValue: originalValue,
          hasIssue: true
        }
      }));
    });
    showAlert(`${itemKey} 항목이 수정 모드로 전환되었습니다`);
  };


  const getItemStatus = (itemKey: string) => {
    return inspectionStates[itemKey]?.status || 'pending';
  };

  const getItemButtonStyle = (itemKey: string, buttonType: 'confirm' | 'correct') => {
    const status = getItemStatus(itemKey);
    const isEditing = inspectionStates[itemKey]?.isEditing;
    
    if (buttonType === 'confirm') {
      if (status === 'confirmed') {
        return 'flex-1 bg-green-700 text-white py-2 rounded-xl text-sm border-2 border-green-400 shadow-lg font-bold';
      } else if (status === 'corrected') {
        return 'flex-1 bg-gray-400 text-gray-600 py-2 rounded-xl text-sm cursor-not-allowed opacity-50';
      } else {
        return 'flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl text-sm transition-all duration-200 hover:shadow-lg';
      }
    } else {
      if (status === 'corrected') {
        return isEditing 
          ? 'flex-1 bg-orange-600 text-white py-2 rounded-xl text-sm border-2 border-orange-400 shadow-lg font-bold' 
          : 'flex-1 bg-red-600 text-white py-2 rounded-xl text-sm border-2 border-red-400 shadow-lg font-bold';
      } else if (status === 'confirmed') {
        return 'flex-1 bg-gray-400 text-gray-600 py-2 rounded-xl text-sm cursor-not-allowed opacity-50';
      } else {
        return 'flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-xl text-sm transition-all duration-200 hover:shadow-lg';
      }
    }
  };

  const handleEditComplete = (e: React.MouseEvent, itemKey: string, newValue: string) => {
    e.preventDefault();
    e.stopPropagation();
    const originalValue = inspectionStates[itemKey]?.originalValue;
    setPendingChange({itemKey, oldValue: originalValue, newValue});
    setShowConfirmDialog(true);
  };

  const confirmChange = () => {
    if (pendingChange) {
      preserveScrollPosition(() => {
        setInspectionStates(prev => ({
          ...prev,
          [pendingChange.itemKey]: {
            ...prev[pendingChange.itemKey],
            currentValue: pendingChange.newValue,
            isEditing: false,
            hasIssue: true
          }
        }));
        // Update the actual external display state if this is the external display field
        if (pendingChange.itemKey === 'externalDisplay') {
          setExternalDisplay(pendingChange.newValue);
        }
      });
      showAlert(`${pendingChange.itemKey} 항목이 수정 완료되었습니다`);
    }
    setShowConfirmDialog(false);
    setPendingChange(null);
  };

  const cancelChange = () => {
    setShowConfirmDialog(false);
    setPendingChange(null);
  };

  // getPriorityBadge는 커스텀 훅에서 가져옴

  const getPriorityText = useCallback((priority: string) => {
    switch (priority) {
      case 'urgent': return '긴급';
      case 'warning': return '주의';
      default: return '정상';
    }
  }, []);

  // 데스크톱 레이아웃
  const DesktopLayout = () => (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* 카카오맵 스크립트 - 튜토리얼용 모의 구현 */}
      
      {/* 헤더 */}
      <header className="bg-gray-800 border-b border-gray-700 h-16 flex items-center justify-between px-6 fixed top-0 left-0 right-0 z-40">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setDesktopSidebarCollapsed(!desktopSidebarCollapsed)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="text-xl font-bold text-green-400">AED 점검 관리 시스템</div>
        </div>
        <div className="flex items-center gap-4">
          <select 
            value={userRole} 
            onChange={(e) => setUserRole(e.target.value)}
            className="bg-gray-700 text-white px-3 py-1 rounded border border-gray-600"
          >
            <option value="local">보건소 담당자</option>
            <option value="regional">시도 담당자</option>
            <option value="central">복지부 담당자</option>
            <option value="emergency">중앙응급의료센터</option>
          </select>
          <button 
            onClick={() => showAlert('로그아웃')}
            className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 사이드바 */}
      <aside className={`fixed left-0 top-16 bottom-0 ${desktopSidebarCollapsed ? 'w-16' : 'w-64'} bg-gray-800 border-r border-gray-700 z-30 transform transition-all duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <nav className="p-4 space-y-2">
          {/* 권한별 메뉴 표시 */}
          {(() => {
            const baseMenus = [
              { id: 'inspection2', label: '점검하기2', roles: ['local', 'regional', 'central', 'emergency'] },
              { id: 'inspection3', label: '점검하기3', roles: ['local', 'regional', 'central', 'emergency'] },
              { id: 'inspection4', label: '점검하기4', roles: ['local', 'regional', 'central', 'emergency'] },
              { id: 'dashboard', label: '대시보드', roles: ['local', 'regional', 'central', 'emergency'] },
              { id: 'priority', label: '우선순위 관리', roles: ['local', 'regional', 'central'] },
              { id: 'team', label: '팀 협업', roles: ['local', 'regional'] },
              { id: 'reports', label: '보고서', roles: ['local', 'regional', 'central', 'emergency'] },
              { id: 'settings', label: '설정', roles: ['local', 'regional', 'central', 'emergency'] }
            ];
            
            // 추가 권한별 메뉴
            if (userRole === 'central' || userRole === 'emergency') {
              baseMenus.push({ id: 'admin', label: '관리자', roles: ['central', 'emergency'] });
            }
            
            return baseMenus.filter(menu => menu.roles.includes(userRole));
          })().map(item => (
            <button
              key={item.id}
              onClick={() => handlePageChange(item.id)}
              className={`w-full text-left ${desktopSidebarCollapsed ? 'px-2 justify-center' : 'px-4'} py-3 rounded flex items-center ${desktopSidebarCollapsed ? 'gap-0' : 'gap-3'} transition-all duration-300 ${
                currentPage === item.id 
                  ? 'bg-green-600 text-white' 
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
              title={desktopSidebarCollapsed ? item.label : undefined}
            >
              <span className={`transition-all duration-300 ${desktopSidebarCollapsed ? 'text-xs' : 'text-base'} font-medium`}>
                {desktopSidebarCollapsed ? item.label.charAt(0) : item.label}
              </span>
            </button>
          ))}
        </nav>
      </aside>

      {/* 메인 컨텐츠 */}
      <main className={`pt-16 ${deviceType === 'desktop' ? (desktopSidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64') : ''} min-h-screen transition-all duration-300`}>
        <div className="p-6">
          {currentPage === 'inspection2' && <InspectionPage />}
          {currentPage === 'inspection3' && <div className="text-white"><iframe src="/tutorial3" className="w-full h-screen border-0" /></div>}
          {currentPage === 'inspection4' && <div className="text-white"><iframe src="/tutorial4" className="w-full h-screen border-0" /></div>}
          {currentPage === 'dashboard' && <DashboardPage />}
          {currentPage === 'priority' && <PriorityPage />}
          {currentPage === 'team' && <TeamPage />}
          {currentPage === 'reports' && <ReportsPage />}
        </div>
      </main>

      {/* 모바일 메뉴 버튼 */}
      {deviceType === 'mobile' && (
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden fixed top-20 left-4 z-50 bg-green-600 text-white p-2 rounded"
        >
          ☰
        </button>
      )}

      {/* 플로팅 액션 버튼 */}
      <button
        onClick={() => setShowTutorial(true)}
        className="fixed bottom-6 right-6 bg-green-600 text-white w-12 h-12 rounded-full flex items-center justify-center text-xl hover:bg-green-700 transition-colors z-40"
      >
        ?
      </button>

      {/* 모달들 */}
      {showInspectionModal && <InspectionModal />}
      {showNotifications && <NotificationCenter />}
      {showTutorial && <TutorialOverlay />}
      <ConfirmDialog />
    </div>
  );

  // 모바일 레이아웃
  const MobileLayout = () => (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* 헤더 */}
      <div className="bg-gray-900/80 backdrop-blur-xl border-b border-gray-700/50 p-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 text-sm"
          >
            ← 홈으로
          </button>

          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-green-400">AED Smart Check</h1>
            {/* 동기화 상태 표시 */}
            <div className="flex items-center gap-1">
              {syncStatus === 'synced' && isOnline && (
                <div className="w-2 h-2 bg-green-400 rounded-full" title="동기화 완료" />
              )}
              {syncStatus === 'syncing' && (
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" title="동기화 중" />
              )}
              {!isOnline && (
                <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" title="오프라인" />
              )}
              {offlineDataCount > 0 && (
                <span className="text-xs bg-orange-500 text-white px-1 rounded">{offlineDataCount}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select 
              value={userRole} 
              onChange={(e) => setUserRole(e.target.value)}
              className="bg-gray-700 text-white px-2 py-1 rounded text-xs border border-gray-600"
            >
              <option value="local">보건소</option>
              <option value="regional">시도</option>
              <option value="central">복지부</option>
              <option value="emergency">응급센터</option>
            </select>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative text-gray-400 hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 오프라인 상태 배너 */}
      {!isOnline && <OfflineStatusBanner />}

      {/* 동기화 진행률 표시 */}
      {syncStatus === 'syncing' && (
        <SyncProgressBar />
      )}

      {/* 알림 패널 */}
      <NotificationPanel
        showNotifications={showNotifications}
        setShowNotifications={setShowNotifications}
        urgentDevices={urgentWarningDevices}
        syncStatus={syncStatus}
        offlineDataCount={offlineDataCount}
      />

      {/* 메인 콘텐츠 */}
      <div className="p-4 pb-20">
        {currentPage === 'inspection' && <MobileInspectionPage />}
        {currentPage === 'dashboard' && <MobileDashboardPage />}
        {currentPage === 'priority' && <MobilePriorityPage />}
        {currentPage === 'team' && <MobileTeamPage />}
        {currentPage === 'reports' && <MobileReportsPage />}
      </div>

      {/* 하단 네비게이션 */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900/90 backdrop-blur-xl border-t border-gray-700 z-40">
        <div className="flex justify-around py-2">
          {[
            { id: 'inspection2', label: '점검' },
            { id: 'dashboard', label: '대시보드' },
            { id: 'team', label: '팀협업' },
            { id: 'reports', label: '보고서' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => handlePageChange(item.id)}
              className={`flex flex-col items-center py-1 px-3 ${
                currentPage === item.id ? 'text-green-400' : 'text-gray-400'
              }`}
            >
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 플로팅 액션 버튼 */}
      <button
        onClick={() => setShowTutorial(true)}
        className="fixed bottom-20 right-4 bg-green-600 text-white w-12 h-12 rounded-full flex items-center justify-center text-xl hover:bg-green-700 transition-colors z-40 shadow-lg"
      >
        ?
      </button>

      {/* 모달들 */}
      {showInspectionModal && <MobileInspectionModal />}
      {showNotifications && <MobileNotificationCenter />}
      {showTutorial && <TutorialOverlay />}
      <ConfirmDialog />
    </div>
  );

  // 점검 페이지 컴포넌트
  const InspectionPage = () => {
    const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
    const [savedSearches, setSavedSearches] = useState<Array<{
      id: number;
      name: string;
      filters: Partial<typeof filters>;
    }>>([
      { id: 1, name: '긴급 점검 대상', filters: { urgency: 'high', batteryExpiry: '30' } },
      { id: 2, name: '서울 지역 미점검', filters: { region: 'seoul', status: 'pending' } }
    ]);
    const [filters, setFilters] = useState({
      searchText: '',
      status: 'all',
      urgency: 'all',
      region: 'all',
      deviceType: 'all',
      batteryExpiry: '',
      padExpiry: '',
      lastCheckDays: ''
    });

    return (
      <div>
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold">점검 관리</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsGuidelineOpen(true)}
              className="flex items-center gap-2 rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
              type="button"
            >
              지침보기
            </button>
            <button
              onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
              className="flex items-center gap-2 rounded bg-gray-700 px-4 py-2 text-white transition hover:bg-gray-600"
              type="button"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              고급 검색
            </button>
            {savedSearches.length > 0 && (
              <select 
                className="rounded bg-gray-700 px-3 py-2 text-white"
                onChange={(e) => {
                  if (e.target.value) {
                    const saved = savedSearches.find(s => s.id === Number(e.target.value));
                    if (saved) setFilters({...filters, ...saved.filters});
                  }
                }}
              >
                <option value="">저장된 검색</option>
                {savedSearches.map(search => (
                  <option key={search.id} value={search.id}>{search.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* 통합 검색 및 정렬 - PC 버전 추가 */}
        <div className="mb-4 space-y-3">
          <div className="relative">
            <input
              type="text"
              placeholder="통합 검색..."
              value={filters.searchText}
              onChange={(e) => setFilters({...filters, searchText: e.target.value})}
              className="w-full bg-gray-800 text-white px-4 py-2 pl-10 rounded border border-gray-700 focus:border-green-500 focus:outline-none"
            />
            <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex gap-2">
            <select
              value={searchMode}
              onChange={(e) => setSearchMode(e.target.value)}
              className="flex-1 bg-gray-800 text-white px-4 py-2 rounded border border-gray-700 focus:border-green-500 focus:outline-none"
            >
              <option value="priority">우선순위 순</option>
              <option value="nearby">가까운 순</option>
              <option value="old_inspection">점검 오래된 순</option>
              <option value="expiry_soon">유효기간 임박 순</option>
            </select>
          </div>
        </div>

        {/* 실제 데이터 빠른 필터 */}
        {dataSource === 'supabase' && (
          <div className="mb-6 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-300">빠른 필터 (실제 DB)</h3>
              <span className="text-xs text-green-400">
                총 {devices.length}개 장치 로드됨
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => loadDevicesByPriority('urgent')}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                disabled={isLoading}
              >
                긴급 ({urgentWarningDevices.filter(d => d.priority === 'urgent').length})
              </button>
              <button
                onClick={() => loadDevicesByPriority('warning')}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                disabled={isLoading}
              >
                경고 ({urgentWarningDevices.filter(d => d.priority === 'warning').length})
              </button>
              <button
                onClick={() => loadDevicesByPriority('normal')}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                disabled={isLoading}
              >
                정상
              </button>
              <button
                onClick={() => refreshDevices()}
                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                disabled={isLoading}
              >
                전체 새로고침
              </button>
              <button
                onClick={() => loadRealManufacturers()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                disabled={isLoading || dynamicDataLoading}
              >
                {dynamicDataLoading ? '로딩 중...' : `제조사 로드 (${realManufacturers.length})`}
              </button>
              <button
                onClick={() => loadRealModels()}
                className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                disabled={isLoading || dynamicDataLoading}
              >
                {dynamicDataLoading ? '로딩 중...' : `모델 로드 (${realModels.length})`}
              </button>
            </div>
          </div>
        )}

        {/* 실제 제조사/모델 리스트 */}
        {dataSource === 'supabase' && (realManufacturers.length > 0 || realModels.length > 0) && (
          <div className="mb-6 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
            {realManufacturers.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-300 mb-2">
                  실제 제조사 목록 ({realManufacturers.length}개)
                </h4>
                <div className="flex gap-2 flex-wrap max-h-32 overflow-y-auto">
                  {realManufacturers.slice(0, 20).map((manufacturer, index) => (
                    <button
                      key={index}
                      onClick={() => loadDevicesByManufacturer(manufacturer)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs transition-colors"
                      disabled={isLoading}
                    >
                      {manufacturer}
                    </button>
                  ))}
                  {realManufacturers.length > 20 && (
                    <span className="text-xs text-gray-400 py-1">
                      ... 외 {realManufacturers.length - 20}개
                    </span>
                  )}
                </div>
              </div>
            )}
            
            {realModels.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-2">
                  실제 모델 목록 ({realModels.length}개)
                </h4>
                <div className="flex gap-2 flex-wrap max-h-32 overflow-y-auto">
                  {realModels.slice(0, 15).map((model, index) => (
                    <span
                      key={index}
                      className="bg-gray-600 text-white px-2 py-1 rounded text-xs"
                    >
                      {model}
                    </span>
                  ))}
                  {realModels.length > 15 && (
                    <span className="text-xs text-gray-400 py-1">
                      ... 외 {realModels.length - 15}개
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 검색 및 필터 섹션 */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 통합 검색 */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">통합 검색</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="기관명, 장비번호, 모델번호, 연락처, 주소 검색..."
                  value={filters.searchText}
                  onChange={(e) => setFilters({...filters, searchText: e.target.value})}
                  className="w-full bg-gray-700 text-white px-4 py-2 pl-10 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
                />
                <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* 정렬 기준 */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">정렬 기준</label>
              <select 
                value={searchMode}
                onChange={(e) => setSearchMode(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
            >
              <option value="priority">우선순위 순</option>
              <option value="nearby">가까운 순</option>
              <option value="old_inspection">점검 오래된 순</option>
              <option value="expiry_soon">유효기간 임박 순</option>
            </select>
          </div>
        </div>
        
        {/* 고급 검색 필터 */}
        {showAdvancedSearch && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">점검 상태</label>
                <select 
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
                >
                  <option value="all">전체</option>
                  <option value="pending">미점검</option>
                  <option value="completed">점검완료</option>
                  <option value="in_progress">점검중</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">긴급도</label>
                <select 
                  value={filters.urgency}
                  onChange={(e) => setFilters({...filters, urgency: e.target.value})}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
                >
                  <option value="all">전체</option>
                  <option value="high">긴급</option>
                  <option value="medium">경고</option>
                  <option value="low">정상</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">지역</label>
                <select 
                  value={filters.region}
                  onChange={(e) => setFilters({...filters, region: e.target.value})}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
                >
                  <option value="all">전체</option>
                  <option value="seoul">서울</option>
                  <option value="gangnam">강남구</option>
                  <option value="jongno">종로구</option>
                  <option value="jung">중구</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">기관 유형</label>
                <select 
                  value={filters.deviceType}
                  onChange={(e) => setFilters({...filters, deviceType: e.target.value})}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
                >
                  <option value="all">전체</option>
                  <option value="medical">의료기관</option>
                  <option value="public">공공기관</option>
                  <option value="education">교육기관</option>
                  <option value="transport">교통시설</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">배터리 만료일</label>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="일 이내"
                  value={filters.batteryExpiry}
                  onChange={(e) => setFilters({...filters, batteryExpiry: e.target.value})}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">패드 만료일</label>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="일 이내"
                  value={filters.padExpiry}
                  onChange={(e) => setFilters({...filters, padExpiry: e.target.value})}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">최근 점검일</label>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="일 이상 경과"
                  value={filters.lastCheckDays}
                  onChange={(e) => setFilters({...filters, lastCheckDays: e.target.value})}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
                />
              </div>
              
              <div className="flex items-end gap-2">
                <button 
                  onClick={async () => {
                    if (dataSource === 'supabase') {
                      // 실제 데이터베이스 검색
                      const searchFilters: { priority?: 'urgent' | 'warning' | 'normal'; sido?: string; manufacturer?: string } = {};
                      
                      if (filters.urgency !== 'all') {
                        const priorityMap = { high: 'urgent' as const, medium: 'warning' as const, low: 'normal' as const };
                        searchFilters.priority = priorityMap[filters.urgency as keyof typeof priorityMap];
                      }
                      
                      if (filters.region !== 'all') {
                        const regionMap = { seoul: '서울특별시', gangnam: '강남구', jongno: '종로구', jung: '중구' };
                        searchFilters.sido = regionMap[filters.region as keyof typeof regionMap];
                      }

                      try {
                        await searchDevices(filters.searchText || '전국', searchFilters);
                        console.log('실제 데이터베이스 검색 실행:', { query: filters.searchText, filters: searchFilters });
                      } catch (error) {
                        console.error('검색 실패:', error);
                      }
                    } else {
                      // 로컬 모드에서는 기존 방식
                      console.log('로컬 모드 - 필터 적용:', filters);
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      검색 중...
                    </>
                  ) : (
                    <>
                      검색
                      {dataSource === 'supabase' && <span className="text-xs opacity-75">(실제DB)</span>}
                    </>
                  )}
                </button>
                <button 
                  onClick={() => {
                    const searchName = prompt('검색 조건 이름:');
                    if (searchName) {
                      setSavedSearches([...savedSearches, {
                        id: savedSearches.length + 1,
                        name: searchName,
                        filters: {...filters}
                      }]);
                    }
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm"
                >
                  저장
                </button>
                <button 
                  onClick={() => setFilters({
                    searchText: '',
                    status: 'all',
                    urgency: 'all',
                    region: 'all',
                    deviceType: 'all',
                    batteryExpiry: '',
                    padExpiry: '',
                    lastCheckDays: ''
                  })}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm"
                >
                  초기화
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 오늘의 스케줄 */}
      <div className="bg-gradient-to-r from-green-900 to-green-800 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            <svg className="h-8 w-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-green-400">오늘의 점검 (12건)</h3>
            <p className="text-sm text-gray-300">긴급 3건, 정기 9건</p>
          </div>
        </div>
      </div>

      {/* 점검 테이블 리스트 */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">기관명</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">장비번호</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">주소</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">세부위치</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">관리책임자</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">우선순위</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">배터리</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">패드</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">최근점검</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">작업</th>
            </tr>
          </thead>
          <tbody>
            {devices.map(device => (
              <tr key={device.id} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="px-4 py-3">
                  <div>
                    <div className="font-semibold text-white flex items-center gap-2">
                      {device.name}
                      {/* GPS 이상 배지 (예시 데이터) */}
                      {['1', '3', '5', '7'].includes(device.id) && (
                        <span className={`px-1.5 py-0.5 text-xs rounded flex items-center gap-1 inline-flex ${
                          device.id === '1' ? 'bg-red-600/20 text-red-400' :
                          device.id === '3' ? 'bg-orange-600/20 text-orange-400' :
                          device.id === '5' ? 'bg-yellow-600/20 text-yellow-400' :
                          'bg-blue-600/20 text-blue-400'
                        }`} title={`GPS 좌표 이상: ${
                          device.id === '1' ? '디폴트 좌표' :
                          device.id === '3' ? '주소 불일치' :
                          device.id === '5' ? '이상치' :
                          '밀집'
                        }`}>
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                          </svg>
                          GPS
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-white">{device.id}</td>
                <td className="px-4 py-3">
                  <div className="text-sm text-gray-300">
                    {device.address || '서울시 중구 태평로1가'}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-gray-300">
                    {device.location}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select
                    className="bg-gray-700 text-white text-sm rounded px-2 py-1 cursor-pointer hover:bg-gray-600 transition-colors"
                    defaultValue={device.manager || 'kim'}
                    onChange={(e) => console.log(`관리책임자 변경: ${device.id} -> ${e.target.value}`)}
                  >
                    <option value="kim">김철수</option>
                    <option value="lee">이영희</option>
                    <option value="park">박민수</option>
                    <option value="choi">최지원</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className={getPriorityBadge(device.priority)}>
                    {getPriorityText(device.priority)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-white">{device.batteryExpiry}</td>
                <td className="px-4 py-3 text-sm text-white">{device.padExpiry}</td>
                <td className="px-4 py-3 text-sm text-white">{device.lastCheck}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => startInspection(device.id)}
                      className="bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded text-sm transition-colors relative"
                    >
                      점검시작
                      {/* GPS 이상 표시 (예시 데이터) */}
                      {['1', '3', '5', '7'].includes(device.id) && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                      )}
                    </button>
                    <button
                      onClick={() => startNavigation(device.name, device.lat, device.lng)}
                      className="bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded text-sm transition-colors"
                    >
                      길안내
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
  };

  // 사용자 역할별 대시보드 데이터
  const getDashboardData = useCallback(() => {
    if (userRole === 'central' || userRole === 'emergency') {
      // 복지부/중앙응급의료센터: 전국 시도별 현황
      return {
        title: '전국 시도별 AED 점검 현황',
        data: nationalRegions,
        totalAED: 81331,
        totalCompleted: 67362,
        totalUrgent: 890,
        completionRate: 82.8
      };
    } else if (userRole === 'regional') {
      // 시도 담당자: 시군구별 현황 (서울시 예시)
      return {
        title: '서울시 시군구별 AED 점검 현황',
        data: seoulDistricts,
        totalAED: 8847,
        totalCompleted: 7231,
        totalUrgent: 89,
        completionRate: 81.7
      };
    } else {
      // 보건소: 관할지역 현황
      return {
        title: '관할지역 AED 점검 현황',
        data: seoulDistricts.slice(0, 5), // 일부만 표시
        totalAED: 2134,
        totalCompleted: 1787,
        totalUrgent: 23,
        completionRate: 83.7
      };
    }
  }, [userRole, nationalRegions, seoulDistricts]);

  // 대시보드 페이지
  const DashboardPage = () => {
    const dashboardData = getDashboardData();
    const [timeRange, setTimeRange] = useState('today');
    
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">대시보드</h1>
          <div className="flex items-center gap-4">
            <select 
              value={timeRange} 
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-gray-700 text-white px-3 py-1 rounded text-sm"
            >
              <option value="today">오늘</option>
              <option value="week">이번 주</option>
              <option value="month">이번 달</option>
              <option value="year">올해</option>
            </select>
            <div className="text-sm text-gray-400">
              최종 업데이트: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
        
        {/* 전체 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-2xl font-bold text-white mb-1">{dashboardData.totalAED.toLocaleString()}</div>
                <div className="text-gray-400 text-sm">전체 AED</div>
              </div>
              <svg className="h-8 w-8 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-green-500">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-2xl font-bold text-green-400 mb-1">{dashboardData.totalCompleted.toLocaleString()}</div>
                <div className="text-gray-400 text-sm">점검 완료</div>
                <div className="text-xs text-green-400 mt-1">+12% ↑</div>
              </div>
              <svg className="h-8 w-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
              </svg>
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-red-500">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-2xl font-bold text-red-400 mb-1">{dashboardData.totalUrgent.toLocaleString()}</div>
                <div className="text-gray-400 text-sm">긴급 점검</div>
                <div className="text-xs text-red-400 mt-1">즉시 조치 필요</div>
              </div>
              <svg className="h-8 w-8 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
              </svg>
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border-l-4 border-blue-500">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-2xl font-bold text-blue-400 mb-1">{dashboardData.completionRate}%</div>
                <div className="text-gray-400 text-sm">완료율</div>
                <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{width: `${dashboardData.completionRate}%`}}></div>
                </div>
              </div>
              <svg className="h-8 w-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
              </svg>
            </div>
          </div>
        </div>
        
        {/* 점검 현황 차트 영역 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 일일 목표 대비 실적 */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">일일 목표 대비 실적</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">오늘 목표</span>
                  <span className="text-white">15 / 20대</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div className="bg-gradient-to-r from-green-500 to-green-400 h-3 rounded-full" style={{width: '75%'}}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">주간 목표</span>
                  <span className="text-white">68 / 100대</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-400 h-3 rounded-full" style={{width: '68%'}}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">월간 목표</span>
                  <span className="text-white">245 / 400대</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div className="bg-gradient-to-r from-purple-500 to-purple-400 h-3 rounded-full" style={{width: '61%'}}></div>
                </div>
              </div>
            </div>
          </div>
          
          {/* 시간대별 점검 현황 */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">시간대별 점검 현황</h3>
            <div className="flex items-end justify-between h-32 px-2">
              {[
                {hour: '09', count: 3},
                {hour: '10', count: 5},
                {hour: '11', count: 8},
                {hour: '12', count: 2},
                {hour: '13', count: 4},
                {hour: '14', count: 7},
                {hour: '15', count: 6},
                {hour: '16', count: 4},
                {hour: '17', count: 2}
              ].map((item) => (
                <div key={item.hour} className="flex flex-col items-center flex-1">
                  <div 
                    className="w-full bg-green-500 rounded-t" 
                    style={{height: `${(item.count / 8) * 100}%`}}
                  ></div>
                  <span className="text-xs text-gray-400 mt-2">{item.hour}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 지역별 점검 현황 테이블 */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">{dashboardData.title}</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">지역</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">총 AED</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">점검 완료</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">긴급 점검</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">완료율</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">진행 상황</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.data.map((region, index) => (
                  <tr key={index} className="border-b border-gray-700 hover:bg-gray-750">
                    <td className="py-3 px-4 text-white font-medium">{region.region}</td>
                    <td className="py-3 px-4 text-white">{region.total.toLocaleString()}</td>
                    <td className="py-3 px-4 text-green-400">{region.completed.toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className="text-red-400 font-semibold">{region.urgent}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-semibold ${region.rate >= 85 ? 'text-green-400' : region.rate >= 80 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {region.rate}%
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${region.rate >= 85 ? 'bg-green-500' : region.rate >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${region.rate}%` }}
                        ></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // 우선순위 관리 페이지
  const PriorityPage = () => {
    const [activeTab, setActiveTab] = useState('expiry');
    const [mapView, setMapView] = useState('list'); // 'list' | 'map'
    // const [selectedDates, setSelectedDates] = useState<string[]>([]);
    const [excludedDates, setExcludedDates] = useState<string[]>(['2025-01-01', '2025-01-25', '2025-01-26']);
    const [distributionMode, setDistributionMode] = useState('auto');
    const [dailyTarget, setDailyTarget] = useState(15);
    const [showPriorityCalculation, setShowPriorityCalculation] = useState(false);
    const [prioritySearchQuery, setPrioritySearchQuery] = useState('');
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showExcludeModal, setShowExcludeModal] = useState(false);
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleInspector, setScheduleInspector] = useState('');
    const [excludeReason, setExcludeReason] = useState('');
    const [excludePeriod, setExcludePeriod] = useState('7');

    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">점검 우선순위 관리</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPriorityCalculation(!showPriorityCalculation)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              우선순위 계산식
            </button>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
              우선순위 재배치
            </button>
            <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
              스케줄 확정
            </button>
          </div>
        </div>

        {/* 보기 전환 탭 */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMapView('list')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              mapView === 'list'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            리스트 보기
          </button>
          <button
            onClick={() => setMapView('map')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              mapView === 'map'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            지도 상황판
          </button>
        </div>

        {/* 통합검색 */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="설치기관명, 관리번호, 주소로 검색..."
              value={prioritySearchQuery}
              onChange={(e) => setPrioritySearchQuery(e.target.value)}
              className="w-full bg-gray-700 text-white rounded px-4 py-2 pl-10"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
        
        {/* 우선순위 계산 로직 시각화 */}
        {showPriorityCalculation && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-semibold mb-4 text-purple-400">우선순위 계산 알고리즘</h3>
            <div className="grid grid-cols-5 gap-4">
              {[
                { 
                  factor: '배터리 만료일', 
                  weight: 30, 
                  color: 'red',
                  icon: (
                    <svg className="w-8 h-8 mx-auto text-red-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17 4v2H7V4H5v5h14V4h-2zM7 11h10v9H7v-9z"/>
                      <path d="M9 13h6v2H9z"/>
                    </svg>
                  ),
                  description: 'D-30일 이내: 100점\nD-60일 이내: 70점\nD-90일 이내: 40점' 
                },
                { 
                  factor: '패드 만료일', 
                  weight: 30, 
                  color: 'orange',
                  icon: (
                    <svg className="w-8 h-8 mx-auto text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                    </svg>
                  ),
                  description: 'D-30일 이내: 100점\nD-60일 이내: 70점\nD-90일 이내: 40점' 
                },
                { 
                  factor: '최근 점검일', 
                  weight: 20, 
                  color: 'yellow',
                  icon: (
                    <svg className="w-8 h-8 mx-auto text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
                    </svg>
                  ),
                  description: '180일 이상: 100점\n120일 이상: 70점\n60일 이상: 40점' 
                },
                { 
                  factor: '기관 중요도', 
                  weight: 10, 
                  color: 'green',
                  icon: (
                    <svg className="w-8 h-8 mx-auto text-green-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  ),
                  description: '의료기관: 100점\n교육기관: 80점\n공공기관: 60점' 
                },
                { 
                  factor: '접근성', 
                  weight: 10, 
                  color: 'blue',
                  icon: (
                    <svg className="w-8 h-8 mx-auto text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                  ),
                  description: '24시간: 100점\n제한시간: 60점\n예약필요: 30점' 
                }
              ].map((item) => (
                <div key={item.factor} className="text-center">
                  <div className={`bg-${item.color}-600/20 border border-${item.color}-500 rounded-lg p-4`}>
                    <div className="mb-2">{item.icon}</div>
                    <h4 className={`text-${item.color}-400 font-semibold mb-1`}>{item.factor}</h4>
                    <div className="text-2xl font-bold text-white mb-2">{item.weight}%</div>
                    <div className="text-xs text-gray-400 whitespace-pre-line">{item.description}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 bg-gray-700 rounded p-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">최종 우선순위 점수 = Σ(각 요소 점수 × 가중치)</span>
                <span className="text-green-400 font-semibold">0 ~ 100점</span>
              </div>
            </div>
          </div>
        )}

        {/* 탭 메뉴 */}
        <div className="flex gap-2 mb-6 border-b border-gray-700">
          {[
            { id: 'inspection', label: '점검 우선순위' },
            { id: 'schedule', label: '스케줄 배치' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-green-400 border-b-2 border-green-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 점검 우선순위 탭 (통합된 버전) */}
        {activeTab === 'inspection' && (
          <div className="space-y-4">
            {/* 필터 섹션 */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-sm text-gray-400 mb-1">날짜 필터 종류</label>
                  <select
                    value={dateFilterType}
                    onChange={(e) => setDateFilterType(e.target.value)}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded"
                  >
                    <option value="battery">배터리 유효기간</option>
                    <option value="pad">패드 유효기간</option>
                    <option value="device">장치 교체예정일</option>
                    <option value="inspection">최근 점검일</option>
                    <option value="gps_issue">좌표값 이상</option>
                  </select>
                </div>

                <div className="flex-1 min-w-[150px]">
                  <label className="block text-sm text-gray-400 mb-1">기간 범위</label>
                  <select
                    value={dateFilterRange}
                    onChange={(e) => setDateFilterRange(e.target.value)}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded"
                  >
                    <option value="all">전체</option>
                    {dateFilterType === 'gps_issue' ? (
                      <>
                        <option value="critical">심각</option>
                        <option value="high">높음</option>
                        <option value="medium">중간</option>
                        <option value="low">낮음</option>
                      </>
                    ) : dateFilterType === 'inspection' ? (
                      <>
                        <option value="30">30일 이상 미점검</option>
                        <option value="60">60일 이상 미점검</option>
                        <option value="90">90일 이상 미점검</option>
                        <option value="180">180일 이상 미점검</option>
                        <option value="expired">180일 초과 미점검</option>
                      </>
                    ) : (
                      <>
                        <option value="expired">이미 만료</option>
                        <option value="30">30일 이내 만료</option>
                        <option value="60">60일 이내 만료</option>
                        <option value="90">90일 이내 만료</option>
                        <option value="180">180일 이내 만료</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="flex-1 min-w-[150px]">
                  <label className="block text-sm text-gray-400 mb-1">정렬 기준</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded"
                  >
                    <option value="priority">종합 우선순위</option>
                    <option value="battery">배터리 만료 임박순</option>
                    <option value="pad">패드 만료 임박순</option>
                    <option value="device">장치 교체 임박순</option>
                    <option value="inspection">오래된 점검순</option>
                    <option value="name">장비명순</option>
                    <option value="location">위치순</option>
                  </select>
                </div>

                <div className="flex items-end gap-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={mandatoryOnly}
                      onChange={(e) => setMandatoryOnly(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-white">구비의무기관만</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={excludeMobileEquipment}
                      onChange={(e) => setExcludeMobileEquipment(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-white">이동식장비제외</span>
                  </label>

                  <button
                    onClick={() => {
                      setDateFilterType('battery');
                      setDateFilterRange('all');
                      setSortBy('priority');
                      setMandatoryOnly(false);
                      setExcludeMobileEquipment(false);
                    }}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
                  >
                    필터 초기화
                  </button>
                </div>
              </div>
            </div>

            {/* 선택된 항목 표시 바 */}
            {selectedItems.length > 0 && (
              <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-3 flex justify-between items-center">
                <span className="text-white">
                  <strong>{selectedItems.length}개</strong> 항목이 선택됨
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    점검 일정 지정
                  </button>
                  <button
                    onClick={() => setShowExcludeModal(true)}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    점검 제외
                  </button>
                  <button
                    onClick={() => setSelectedItems([])}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
                  >
                    선택 취소
                  </button>
                </div>
              </div>
            )}

            {/* 리스트 보기 */}
            {mapView === 'list' ? (
              <div className="bg-gray-800 rounded-lg p-6 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 px-2">
                      <input
                        type="checkbox"
                        checked={selectedItems.length === filteredDevices.length && filteredDevices.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const sampleData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(id => String(id));
                            setSelectedItems(sampleData);
                          } else {
                            setSelectedItems([]);
                          }
                        }}
                      />
                    </th>
                    <th className="text-left py-2">설치기관명</th>
                    <th className="text-left py-2">관리번호</th>
                    <th className="text-left py-2">주소</th>
                    <th className="text-left py-2">최근 점검</th>
                    <th className="text-left py-2">우선순위</th>
                    <th className="text-left py-2">배터리 유효기간</th>
                    <th className="text-left py-2">패드 유효기간</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // 샘플 데이터 (장치 교체예정일 및 GPS 이슈 추가)
                    const sampleData = [
                      { id: 1, name: 'AED-001', location: '서울시청 본관 1층', battery: '2025-01-20', pad: '2025-01-25', device: '2025-12-01', lastCheck: '2024-06-15', priority: 95, mandatory: true, days: 5, gpsIssue: { type: 'default_coord', severity: 'critical' } },
                      { id: 2, name: 'AED-002', location: '강남구청 민원실', battery: '2025-01-28', pad: '2025-02-10', device: '2026-01-15', lastCheck: '2024-07-20', priority: 88, mandatory: true, days: 13, gpsIssue: null },
                      { id: 3, name: 'AED-003', location: '서울역 대합실', battery: '2025-02-05', pad: '2025-01-30', device: '2025-11-20', lastCheck: '2024-08-10', priority: 82, mandatory: true, days: 15, gpsIssue: { type: 'address_mismatch', severity: 'high' } },
                      { id: 4, name: 'AED-004', location: '강남세브란스병원', battery: '2025-02-15', pad: '2025-02-20', device: '2026-02-01', lastCheck: '2024-09-05', priority: 75, mandatory: true, days: 31, gpsIssue: null },
                      { id: 5, name: 'AED-005', location: '삼성서울병원', battery: '2025-02-25', pad: '2025-03-01', device: '2025-10-30', lastCheck: '2024-09-25', priority: 70, mandatory: true, days: 41, gpsIssue: { type: 'outlier', severity: 'medium' } },
                      { id: 6, name: 'AED-006', location: '한국무역센터', battery: '2025-03-10', pad: '2025-02-28', device: '2026-03-15', lastCheck: '2024-10-15', priority: 65, mandatory: false, days: 43, gpsIssue: null },
                      { id: 7, name: 'AED-007', location: '국회의사당', battery: '2025-05-20', pad: '2025-06-15', device: '2026-05-01', lastCheck: '2024-11-01', priority: 45, mandatory: true, days: 125, gpsIssue: { type: 'cluster', severity: 'low' } },
                      { id: 8, name: 'AED-008', location: '서울대학교', battery: '2025-07-10', pad: '2025-08-20', device: '2026-07-15', lastCheck: '2024-11-20', priority: 35, mandatory: true, days: 176, gpsIssue: null },
                      { id: 9, name: 'AED-009', location: '올림픽공원', battery: '2025-09-01', pad: '2025-10-30', device: '2026-09-10', lastCheck: '2024-12-01', priority: 25, mandatory: false, days: 228, gpsIssue: null },
                      {
                        id: 10,
                        managementNumber: 'AED-2025-0010',
                        institution: '롯데월드타워',
                        location: '1층 로비',
                        address: '서울특별시 송파구 올림픽로 300',
                        battery: '2025-10-15',
                        pad: '2025-11-20',
                        replacement: '2026-10-20',
                        lastCheck: '2024-12-15',
                        priority: 20,
                        operationStatus: '정상',
                        days: 273,
                        gpsIssue: null
                      }
                    ];

                    // 필터링
                    let filtered = [...sampleData];
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    // 날짜 필터링
                    if (dateFilterRange !== 'all') {
                      filtered = filtered.filter(item => {
                        let targetDate: Date;

                        switch(dateFilterType) {
                          case 'battery':
                            targetDate = new Date(item.battery);
                            break;
                          case 'pad':
                            targetDate = new Date(item.pad);
                            break;
                          case 'device':
                          case 'replacement':
                            targetDate = new Date(item.replacement || item.battery);
                            break;
                          case 'inspection':
                            targetDate = new Date(item.lastCheck);
                            break;
                          default:
                            targetDate = new Date(item.battery);
                        }

                        const diffTime = targetDate.getTime() - today.getTime();
                        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                        if (dateFilterType === 'inspection') {
                          const daysSinceCheck = -diffDays;
                          switch(dateFilterRange) {
                            case 'expired': return daysSinceCheck > 180;
                            case '180': return daysSinceCheck >= 180;
                            case '90': return daysSinceCheck >= 90;
                            case '60': return daysSinceCheck >= 60;
                            case '30': return daysSinceCheck >= 30;
                            default: return true;
                          }
                        } else {
                          switch(dateFilterRange) {
                            case 'expired': return diffDays < 0;
                            case '30': return diffDays <= 30 && diffDays >= 0;
                            case '60': return diffDays <= 60 && diffDays >= 0;
                            case '90': return diffDays <= 90 && diffDays >= 0;
                            case '180': return diffDays <= 180 && diffDays >= 0;
                            default: return true;
                          }
                        }
                      });
                    }

                    if (mandatoryOnly) {
                      filtered = filtered.filter(item => item.mandatory);
                    }

                    // 정렬
                    filtered.sort((a, b) => {
                      switch(sortBy) {
                        case 'priority':
                          return b.priority - a.priority;
                        case 'battery':
                          return new Date(a.battery).getTime() - new Date(b.battery).getTime();
                        case 'pad':
                          return new Date(a.pad).getTime() - new Date(b.pad).getTime();
                        case 'device':
                        case 'replacement':
                          return new Date(a.replacement || a.battery).getTime() - new Date(b.replacement || b.battery).getTime();
                        case 'inspection':
                          return new Date(a.lastCheck).getTime() - new Date(b.lastCheck).getTime();
                        case 'name':
                        case 'management_number':
                          return (a.managementNumber || '').localeCompare(b.managementNumber || '');
                        case 'institution':
                          return (a.institution || '').localeCompare(b.institution || '');
                        case 'location':
                          return a.location.localeCompare(b.location);
                        default:
                          return 0;
                      }
                    });

                    return filtered.map((item) => (
                      <tr key={item.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                        <td className="py-2 px-2">
                          <input
                            type="checkbox"
                            checked={selectedItems.includes(String(item.id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedItems([...selectedItems, String(item.id)]);
                              } else {
                                setSelectedItems(selectedItems.filter(id => id !== String(item.id)));
                              }
                            }}
                          />
                        </td>
                        <td className="py-2 text-white">{item.institution}</td>
                        <td className="py-2 text-white font-mono text-sm">{item.managementNumber}</td>
                        <td className="py-2 text-gray-300 text-sm">
                          <div>{item.address}</div>
                          <div className="text-xs text-gray-500">{item.location}</div>
                        </td>
                        <td className="py-2 text-sm">{item.lastCheck}</td>
                        <td className="py-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            item.priority >= 80 ? 'bg-red-600' :
                            item.priority >= 60 ? 'bg-yellow-600' :
                            'bg-green-600'
                          }`}>
                            {item.priority}점
                          </span>
                        </td>
                        <td className="py-2">
                          <span className={`text-sm ${
                            item.days <= 30 ? 'text-red-400' :
                            item.days <= 60 ? 'text-yellow-400' :
                            'text-green-400'
                          }`}>
                            {item.battery}
                            <span className="text-xs ml-1">({item.days <= 0 ? '만료' : `D-${item.days}`})</span>
                          </span>
                        </td>
                        <td className="py-2">
                          <span className="text-sm text-gray-300">{item.pad}</span>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
            ) : (
              /* 지도 상황판 보기 */
              <div className="space-y-4">
                {/* 지도 상황판 헤더 */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-white">AED 지도 상황판</h3>
                    <div className="flex gap-2">
                      <span className="flex items-center gap-1 px-2 py-1 bg-red-600/20 text-red-400 rounded text-xs">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        긴급 3개
                      </span>
                      <span className="flex items-center gap-1 px-2 py-1 bg-yellow-600/20 text-yellow-400 rounded text-xs">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        경고 4개
                      </span>
                      <span className="flex items-center gap-1 px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        정상 3개
                      </span>
                    </div>
                  </div>

                  {/* 지도 영역 - iframe으로 KakaoMap 표시 */}
                  <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ height: '500px' }}>
                    <iframe
                      src="/map"
                      className="w-full h-full border-0"
                      title="AED 지도 상황판"
                    />

                    {/* 지도 위 필터 컨트롤 */}
                    <div className="absolute top-4 left-4 bg-gray-800/90 backdrop-blur-sm rounded-lg p-3">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" defaultChecked className="accent-red-500" />
                          <span className="text-red-400">긴급</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" defaultChecked className="accent-yellow-500" />
                          <span className="text-yellow-400">경고</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" defaultChecked className="accent-green-500" />
                          <span className="text-green-400">정상</span>
                        </label>
                      </div>
                    </div>

                    {/* 지도 위 통계 정보 */}
                    <div className="absolute bottom-4 left-4 right-4 bg-gray-800/90 backdrop-blur-sm rounded-lg p-3">
                      <div className="grid grid-cols-4 gap-4 text-xs">
                        <div>
                          <div className="text-gray-400 mb-1">오늘 점검</div>
                          <div className="text-white font-semibold">12/20대</div>
                        </div>
                        <div>
                          <div className="text-gray-400 mb-1">주간 진행률</div>
                          <div className="text-white font-semibold">68%</div>
                        </div>
                        <div>
                          <div className="text-gray-400 mb-1">평균 소요시간</div>
                          <div className="text-white font-semibold">15분</div>
                        </div>
                        <div>
                          <div className="text-gray-400 mb-1">평균 이동거리</div>
                          <div className="text-white font-semibold">2.3km</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 선택된 마커 상세 정보 */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-400 mb-3">선택된 AED 상세정보</h4>
                  <p className="text-sm text-gray-500">지도에서 마커를 클릭하면 상세 정보가 표시됩니다.</p>
                </div>
              </div>
            )}

            {/* 페이지네이션 (옵션) */}
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-400">
                총 {filteredDevices.length}개 항목
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded">이전</button>
                <button className="px-3 py-1 bg-green-600 text-white rounded">1</button>
                <button className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded">2</button>
                <button className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded">3</button>
                <button className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded">다음</button>
              </div>
            </div>
          </div>
        )}


        {/* 스케줄 배치 탭 */}
        {activeTab === 'schedule' && (
          <div className="space-y-6">
            {/* 배치 설정 */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">점검 스케줄 설정</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">점검 기간</label>
                  <div className="flex gap-2">
                    <input type="date" className="bg-gray-700 text-white px-3 py-2 rounded" defaultValue="2025-01-13" />
                    <span className="text-gray-400 py-2">~</span>
                    <input type="date" className="bg-gray-700 text-white px-3 py-2 rounded" defaultValue="2025-02-28" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">총 대상 AED</label>
                  <div className="bg-gray-700 px-3 py-2 rounded text-white">250대</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">일일 목표 대수</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={dailyTarget}
                    onChange={(e) => setDailyTarget(Number(e.target.value))}
                    className="bg-gray-700 text-white px-3 py-2 rounded w-full"
                  />
                </div>
              </div>
              
              {/* 회피 날짜 설정 */}
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">점검 회피 날짜 (공휴일, 행사일 등)</label>
                <div className="flex flex-wrap gap-2">
                  {excludedDates.map(date => (
                    <span key={date} className="bg-red-600 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
                      {date}
                      <button onClick={() => setExcludedDates(excludedDates.filter(d => d !== date))} className="hover:text-gray-300">×</button>
                    </span>
                  ))}
                  <button className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded-full text-sm">
                    + 날짜 추가
                  </button>
                </div>
              </div>
              
              {/* 배치 방식 */}
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input 
                    type="radio" 
                    name="distribution" 
                    value="auto" 
                    checked={distributionMode === 'auto'}
                    onChange={(e) => setDistributionMode(e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-white">자동 균등 분배</span>
                </label>
                <label className="flex items-center">
                  <input 
                    type="radio" 
                    name="distribution" 
                    value="priority" 
                    checked={distributionMode === 'priority'}
                    onChange={(e) => setDistributionMode(e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-white">우선순위 기반 분배</span>
                </label>
                <label className="flex items-center">
                  <input 
                    type="radio" 
                    name="distribution" 
                    value="manual" 
                    checked={distributionMode === 'manual'}
                    onChange={(e) => setDistributionMode(e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-white">수동 배치</span>
                </label>
              </div>
            </div>
            
            {/* 캘린더 뷰 */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">2025년 1월 스케줄</h3>
              <div className="grid grid-cols-7 gap-2">
                {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                  <div key={day} className="text-center text-gray-400 text-sm py-2">{day}</div>
                ))}
                {Array.from({length: 31}, (_, i) => i + 1).map(date => {
                  const dateStr = `2025-01-${date.toString().padStart(2, '0')}`;
                  const isExcluded = excludedDates.includes(dateStr);
                  const deviceCount = isExcluded ? 0 : Math.floor(Math.random() * 5) + 12;
                  
                  return (
                    <div 
                      key={date} 
                      className={`p-2 border rounded cursor-pointer transition-colors ${
                        isExcluded ? 'bg-red-900/30 border-red-600' :
                        deviceCount > 15 ? 'bg-yellow-900/30 border-yellow-600 hover:bg-yellow-900/50' :
                        'bg-gray-700 border-gray-600 hover:bg-gray-600'
                      }`}
                    >
                      <div className="text-white text-sm">{date}</div>
                      {!isExcluded && (
                        <div className="text-xs text-gray-400 mt-1">{deviceCount}대</div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-4 flex justify-between items-center">
                <div className="flex gap-4 text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-700 rounded"></div>
                    <span className="text-gray-400">정상</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-600 rounded"></div>
                    <span className="text-gray-400">초과</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-600 rounded"></div>
                    <span className="text-gray-400">회피</span>
                  </span>
                </div>
                <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
                  스케줄 확정
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 점검 일정 지정 모달 */}
        {showScheduleModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-96 max-w-full">
              <h3 className="text-xl font-semibold text-white mb-4">점검 일정 지정</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">점검 예정일</label>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">점검 담당자</label>
                  <select
                    value={scheduleInspector}
                    onChange={(e) => setScheduleInspector(e.target.value)}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded"
                  >
                    <option value="">선택하세요</option>
                    <option value="김철수">김철수 (정규 점검원)</option>
                    <option value="이영희">이영희 (정규 점검원)</option>
                    <option value="박민수">박민수 (임시 점검원)</option>
                    <option value="정수진">정수진 (자원봉사자)</option>
                  </select>
                </div>

                <div className="bg-gray-700 rounded p-3">
                  <p className="text-sm text-gray-300 mb-2">선택된 항목: <strong className="text-white">{selectedItems.length}개</strong></p>
                  <p className="text-xs text-gray-400">선택한 모든 AED 장비에 동일한 점검 일정이 지정됩니다.</p>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => {
                    if (!scheduleDate || !scheduleInspector) {
                      showAlert('점검 예정일과 담당자를 모두 선택해주세요');
                      return;
                    }
                    showAlert(`${selectedItems.length}개 장비의 점검 일정이 ${scheduleDate}로 지정되었습니다`);
                    setShowScheduleModal(false);
                    setSelectedItems([]);
                    setScheduleDate('');
                    setScheduleInspector('');
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded"
                >
                  확인
                </button>
                <button
                  onClick={() => {
                    setShowScheduleModal(false);
                    setScheduleDate('');
                    setScheduleInspector('');
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 점검 제외 모달 */}
        {showExcludeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-96 max-w-full">
              <h3 className="text-xl font-semibold text-white mb-4">점검 제외 설정</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">제외 기간</label>
                  <select
                    value={excludePeriod}
                    onChange={(e) => setExcludePeriod(e.target.value)}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded"
                  >
                    <option value="7">7일</option>
                    <option value="14">14일</option>
                    <option value="30">30일</option>
                    <option value="60">60일</option>
                    <option value="90">90일</option>
                    <option value="indefinite">무기한</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">제외 사유</label>
                  <textarea
                    value={excludeReason}
                    onChange={(e) => setExcludeReason(e.target.value)}
                    placeholder="제외 사유를 입력하세요 (예: 건물 공사 중, 접근 불가 등)"
                    rows={3}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded"
                  />
                </div>

                <div className="bg-yellow-900/30 border border-yellow-600 rounded p-3">
                  <p className="text-sm text-yellow-400 mb-2">⚠️ 주의사항</p>
                  <p className="text-xs text-gray-300">점검 제외 설정 시 해당 기간 동안 점검 대상에서 제외됩니다.</p>
                  <p className="text-xs text-gray-300">제외된 항목은 별도 목록에서 관리됩니다.</p>
                </div>

                <div className="bg-gray-700 rounded p-3">
                  <p className="text-sm text-gray-300">선택된 항목: <strong className="text-white">{selectedItems.length}개</strong></p>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => {
                    if (!excludeReason.trim()) {
                      showAlert('제외 사유를 입력해주세요');
                      return;
                    }
                    const periodText = excludePeriod === 'indefinite' ? '무기한' : `${excludePeriod}일간`;
                    showAlert(`${selectedItems.length}개 장비가 ${periodText} 점검 대상에서 제외되었습니다`);
                    setShowExcludeModal(false);
                    setSelectedItems([]);
                    setExcludeReason('');
                    setExcludePeriod('7');
                  }}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded"
                >
                  제외 설정
                </button>
                <button
                  onClick={() => {
                    setShowExcludeModal(false);
                    setExcludeReason('');
                    setExcludePeriod('7');
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 팀 협업 페이지 (개선된 버전)
  const TeamPage = () => {
    const [activeTab, setActiveTab] = useState('overview');
    const [selectedDate, setSelectedDate] = useState('2025-01-15');
    const [availableStaff, setAvailableStaff] = useState(5);
    
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">팀 관리 시스템</h1>
          <div className="flex gap-2">
            <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
              팀원 추가
            </button>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
              업무 할당
            </button>
          </div>
        </div>

        {/* 탭 메뉴 */}
        <div className="flex gap-2 mb-6 border-b border-gray-700">
          {[
            { id: 'overview', label: '현황' },
            { id: 'management', label: '관리' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-green-400 border-b-2 border-green-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <>

      {/* 팀 구성 요약 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-3xl font-bold text-white">12</div>
          <div className="text-gray-400 text-sm mt-1">전체 팀원</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-3xl font-bold text-green-400">8</div>
          <div className="text-gray-400 text-sm mt-1">정규직원</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-3xl font-bold text-yellow-400">3</div>
          <div className="text-gray-400 text-sm mt-1">임시점검원</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-3xl font-bold text-blue-400">1</div>
          <div className="text-gray-400 text-sm mt-1">자원봉사자</div>
        </div>
      </div>
            
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">팀원 현황</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2">이름</th>
                <th className="text-left py-2">구분</th>
                <th className="text-left py-2">소속</th>
                <th className="text-left py-2">할당량</th>
                <th className="text-left py-2">완료</th>
                <th className="text-left py-2">진행률</th>
                <th className="text-left py-2">작업</th>
              </tr>
            </thead>
            <tbody>
              {teamMembers.map((member, index) => (
                <tr key={index} className="border-b border-gray-700">
                  <td className="py-2">{member.name}</td>
                  <td className="py-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      member.type === 'permanent' ? 'bg-green-600' :
                      member.type === 'temporary' ? 'bg-yellow-600' :
                      'bg-blue-600'
                    }`}>
                      {member.type === 'permanent' ? '정규' :
                       member.type === 'temporary' ? '임시' : '자원'}
                    </span>
                  </td>
                  <td className="py-2">{member.department}</td>
                  <td className="py-2">{member.quota}</td>
                  <td className="py-2">{member.completed}</td>
                  <td className="py-2">
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{width: `${(member.completed / member.quota) * 100}%`}}
                      ></div>
                    </div>
                  </td>
                  <td className="py-2">
                    <button className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm">
                      상세보기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
              </table>
            </div>
          </div>
          </>
        )}

        {activeTab === 'management' && (
          <div className="space-y-6">
            {/* 날짜 선택 및 장비 할당 현황 */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">일일 인력 배치</h3>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">날짜 선택</label>
                  <input 
                    type="date" 
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-gray-700 text-white px-3 py-2 rounded w-full" 
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">할당된 AED</label>
                  <div className="bg-gray-700 px-3 py-2 rounded text-white">20대</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">가용 인력</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={availableStaff}
                    onChange={(e) => setAvailableStaff(Number(e.target.value))}
                    className="bg-gray-700 text-white px-3 py-2 rounded w-full"
                  />
                </div>
              </div>
              
              {/* 자동 배치 결과 */}
              <div className="bg-gray-700 rounded p-4 mb-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium text-white">자동 배치 결과</h4>
                  <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">
                    재배치
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">1인당 평균 할당량:</span>
                    <span className="text-white">4대</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">최대 할당량:</span>
                    <span className="text-white">5대</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">최소 할당량:</span>
                    <span className="text-white">3대</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">예상 소요 시간:</span>
                    <span className="text-white">6-8시간</span>
                  </div>
                </div>
              </div>
              
              {/* 개별 할당 */}
              <div>
                <h4 className="font-medium text-white mb-3">개별 할당 상세</h4>
                <div className="space-y-2">
                  {[
                    { name: '김정호', type: '정규', assigned: 4, locations: ['서울시청', '강남구청', '서울역', '코엑스'] },
                    { name: '이민수', type: '정규', assigned: 4, locations: ['삼성병원', '강남세브란스', '무역센터', '롯데타워'] },
                    { name: '박영희', type: '정규', assigned: 4, locations: ['서울대병원', '연세대', '이대병원', '국회의사당'] },
                    { name: '최지훈', type: '임시', assigned: 4, locations: ['강남역', '선릉역', '역삼역', '압구정역'] },
                    { name: '정수진', type: '임시', assigned: 4, locations: ['올림픽공원', '잠실종합운동장', '한강공원', '남산타워'] }
                  ].map((staff, idx) => (
                    <div key={idx} className="bg-gray-600 p-3 rounded">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-medium text-white">{staff.name}</span>
                          <span className={`ml-2 px-2 py-1 rounded text-xs ${
                            staff.type === '정규' ? 'bg-green-600' : 'bg-yellow-600'
                          }`}>
                            {staff.type}
                          </span>
                        </div>
                        <span className="text-white bg-blue-600 px-2 py-1 rounded text-sm">
                          {staff.assigned}대
                        </span>
                      </div>
                      <div className="text-xs text-gray-300">
                        할당 위치: {staff.locations.join(', ')}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button className="bg-gray-700 hover:bg-gray-800 text-white px-2 py-1 rounded text-xs">
                          수정
                        </button>
                        <button className="bg-gray-700 hover:bg-gray-800 text-white px-2 py-1 rounded text-xs">
                          경로 보기
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* 효율성 분석 */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">효율성 분석</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-700 rounded p-4">
                  <h4 className="text-sm text-gray-400 mb-2">총 이동 거리</h4>
                  <div className="text-2xl font-bold text-white">125.4km</div>
                  <div className="text-xs text-green-400 mt-1">▼ 15% 최적화</div>
                </div>
                <div className="bg-gray-700 rounded p-4">
                  <h4 className="text-sm text-gray-400 mb-2">예상 완료 시간</h4>
                  <div className="text-2xl font-bold text-white">16:30</div>
                  <div className="text-xs text-gray-400 mt-1">평균 점검 시간: 20분</div>
                </div>
                <div className="bg-gray-700 rounded p-4">
                  <h4 className="text-sm text-gray-400 mb-2">예상 효율성</h4>
                  <div className="text-2xl font-bold text-green-400">92%</div>
                  <div className="text-xs text-gray-400 mt-1">목표 대비 +12%</div>
                </div>
              </div>
              
              <div className="mt-4">
                <h4 className="font-medium text-white mb-2">추천 개선 사항</h4>
                <ul className="space-y-1 text-sm text-gray-300">
                  <li>• 김정호, 이민수 경로를 교환하면 15km 단축 가능</li>
                  <li>• 오전 시간대에 병원 위주 배치 권장 (접근성 용이)</li>
                  <li>• 임시직원 2명을 팀으로 구성하면 효율성 20% 증가</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 모바일 우선순위 관리 페이지
  const MobilePriorityPage = () => (
    <div>
      <h1 className="text-2xl font-bold text-white mb-4">우선순위 관리</h1>
      <div className="bg-gray-800/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50">
        <h2 className="text-lg font-semibold text-white mb-4">유효기간 임박</h2>
        <div className="space-y-3">
          {[
            { name: '서울시청 본관', battery: '2025-01-20', status: 'critical' },
            { name: '강남구청', battery: '2025-01-28', status: 'critical' },
            { name: '삼성병원', battery: '2025-02-15', status: 'warning' }
          ].map((item, idx) => (
            <div key={idx} className="bg-gray-700/50 p-3 rounded-xl">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-white">{item.name}</div>
                  <div className="text-xs text-gray-400">배터리: {item.battery}</div>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${
                  item.status === 'critical' ? 'bg-red-600' : 'bg-yellow-600'
                }`}>
                  {item.status === 'critical' ? '긴급' : '경고'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // 보고서 페이지
  const ReportsPage = () => {
    // 권한별 통계 데이터 (하드코딩)
    const getStatisticsByRole = () => {
      // userRole이 정의되어 있다고 가정 (central, regional, local, emergency)

      if (userRole === 'central' || userRole === 'emergency') {
        // 보건복지부/중앙응급의료센터 - 전국 시도 통계
        return {
          title: '전국 AED 현황 통계',
          totalAED: 81331,
          statistics: [
            { region: '서울특별시', total: 12500, battery_expired: 975, pad_expired: 813, inspection_overdue: 1138, rate: '12.0%' },
            { region: '경기도', total: 18500, battery_expired: 1563, pad_expired: 1323, inspection_overdue: 1803, rate: '13.0%' },
            { region: '부산광역시', total: 5200, battery_expired: 574, pad_expired: 473, inspection_overdue: 676, rate: '17.0%' },
            { region: '경상남도', total: 5100, battery_expired: 497, pad_expired: 431, inspection_overdue: 663, rate: '15.0%' },
            { region: '경상북도', total: 4500, battery_expired: 526, pad_expired: 468, inspection_overdue: 644, rate: '18.0%' },
            { region: '인천광역시', total: 4100, battery_expired: 373, pad_expired: 320, inspection_overdue: 453, rate: '14.0%' },
            { region: '대구광역시', total: 3800, battery_expired: 420, pad_expired: 371, inspection_overdue: 494, rate: '17.0%' },
            { region: '충청남도', total: 3500, battery_expired: 364, pad_expired: 318, inspection_overdue: 455, rate: '16.0%' },
            { region: '전라남도', total: 3400, battery_expired: 309, pad_expired: 265, inspection_overdue: 486, rate: '14.0%' },
            { region: '전북특별자치도', total: 3200, battery_expired: 353, pad_expired: 312, inspection_overdue: 458, rate: '17.0%' },
            { region: '강원특별자치도', total: 3100, battery_expired: 383, pad_expired: 343, inspection_overdue: 504, rate: '19.0%' },
            { region: '충청북도', total: 2800, battery_expired: 346, pad_expired: 310, inspection_overdue: 455, rate: '19.0%' },
            { region: '대전광역시', total: 2400, battery_expired: 250, pad_expired: 218, inspection_overdue: 343, rate: '16.0%' },
            { region: '광주광역시', total: 2300, battery_expired: 239, pad_expired: 209, inspection_overdue: 329, rate: '16.0%' },
            { region: '울산광역시', total: 1800, battery_expired: 199, pad_expired: 176, inspection_overdue: 281, rate: '17.0%' },
            { region: '제주특별자치도', total: 1331, battery_expired: 147, pad_expired: 130, inspection_overdue: 216, rate: '17.0%' },
            { region: '세종특별자치시', total: 800, battery_expired: 104, pad_expired: 94, inspection_overdue: 146, rate: '20.0%' }
          ],
          summary: {
            mandatory: 52915,
            nonMandatory: 28416,
            batteryTotal: 8059,
            padTotal: 6954,
            inspectionTotal: 10544,
            urgentIn30Days: 3065,
            urgentIn90Days: 7801
          }
        };
      } else if (userRole === 'regional') {
        // 시도 계정 - 서울특별시 예시
        return {
          title: '서울특별시 AED 현황 통계',
          totalAED: 12500,
          statistics: [
            { region: '종로구', total: 580, battery_expired: 45, pad_expired: 38, inspection_overdue: 52, rate: '12.3%' },
            { region: '중구', total: 620, battery_expired: 48, pad_expired: 41, inspection_overdue: 56, rate: '12.4%' },
            { region: '용산구', total: 480, battery_expired: 42, pad_expired: 35, inspection_overdue: 48, rate: '13.5%' },
            { region: '성동구', total: 510, battery_expired: 44, pad_expired: 37, inspection_overdue: 51, rate: '13.3%' },
            { region: '광진구', total: 470, battery_expired: 38, pad_expired: 32, inspection_overdue: 45, rate: '11.9%' },
            { region: '동대문구', total: 490, battery_expired: 40, pad_expired: 34, inspection_overdue: 47, rate: '12.0%' },
            { region: '중랑구', total: 460, battery_expired: 39, pad_expired: 33, inspection_overdue: 44, rate: '12.6%' },
            { region: '성북구', total: 530, battery_expired: 43, pad_expired: 36, inspection_overdue: 50, rate: '11.7%' },
            { region: '강북구', total: 440, battery_expired: 37, pad_expired: 31, inspection_overdue: 42, rate: '12.5%' },
            { region: '도봉구', total: 430, battery_expired: 36, pad_expired: 30, inspection_overdue: 41, rate: '12.3%' },
            { region: '노원구', total: 580, battery_expired: 47, pad_expired: 39, inspection_overdue: 55, rate: '11.9%' },
            { region: '은평구', total: 500, battery_expired: 41, pad_expired: 34, inspection_overdue: 48, rate: '12.0%' },
            { region: '서대문구', total: 480, battery_expired: 39, pad_expired: 33, inspection_overdue: 46, rate: '12.1%' },
            { region: '마포구', total: 550, battery_expired: 45, pad_expired: 38, inspection_overdue: 52, rate: '11.8%' },
            { region: '양천구', total: 490, battery_expired: 40, pad_expired: 34, inspection_overdue: 47, rate: '12.0%' },
            { region: '강서구', total: 620, battery_expired: 51, pad_expired: 43, inspection_overdue: 59, rate: '12.1%' },
            { region: '구로구', total: 480, battery_expired: 39, pad_expired: 33, inspection_overdue: 46, rate: '12.1%' },
            { region: '금천구', total: 380, battery_expired: 32, pad_expired: 27, inspection_overdue: 37, rate: '12.6%' },
            { region: '영등포구', total: 520, battery_expired: 43, pad_expired: 36, inspection_overdue: 50, rate: '12.1%' },
            { region: '동작구', total: 470, battery_expired: 38, pad_expired: 32, inspection_overdue: 45, rate: '11.9%' },
            { region: '관악구', total: 510, battery_expired: 42, pad_expired: 35, inspection_overdue: 49, rate: '12.2%' },
            { region: '서초구', total: 680, battery_expired: 54, pad_expired: 45, inspection_overdue: 64, rate: '11.6%' },
            { region: '강남구', total: 780, battery_expired: 62, pad_expired: 52, inspection_overdue: 73, rate: '11.5%' },
            { region: '송파구', total: 690, battery_expired: 55, pad_expired: 46, inspection_overdue: 65, rate: '11.6%' },
            { region: '강동구', total: 480, battery_expired: 39, pad_expired: 33, inspection_overdue: 46, rate: '12.1%' }
          ],
          summary: {
            mandatory: 8125,
            nonMandatory: 4375,
            batteryTotal: 975,
            padTotal: 813,
            inspectionTotal: 1138,
            urgentIn30Days: 366,
            urgentIn90Days: 894
          }
        };
      } else {
        // 보건소 계정 - 종로구 예시
        return {
          title: '종로구 AED 현황 통계',
          totalAED: 580,
          statistics: [
            { region: '청운효자동', total: 42, battery_expired: 3, pad_expired: 3, inspection_overdue: 4, rate: '11.9%' },
            { region: '사직동', total: 38, battery_expired: 3, pad_expired: 2, inspection_overdue: 3, rate: '10.5%' },
            { region: '삼청동', total: 35, battery_expired: 3, pad_expired: 2, inspection_overdue: 3, rate: '11.4%' },
            { region: '부암동', total: 28, battery_expired: 2, pad_expired: 2, inspection_overdue: 3, rate: '12.5%' },
            { region: '평창동', total: 45, battery_expired: 4, pad_expired: 3, inspection_overdue: 4, rate: '11.1%' },
            { region: '무악동', total: 32, battery_expired: 3, pad_expired: 2, inspection_overdue: 3, rate: '12.5%' },
            { region: '교남동', total: 30, battery_expired: 2, pad_expired: 2, inspection_overdue: 3, rate: '11.7%' },
            { region: '가회동', total: 38, battery_expired: 3, pad_expired: 3, inspection_overdue: 4, rate: '13.2%' },
            { region: '종로1·2·3·4가동', total: 95, battery_expired: 8, pad_expired: 7, inspection_overdue: 9, rate: '12.6%' },
            { region: '종로5·6가동', total: 72, battery_expired: 6, pad_expired: 5, inspection_overdue: 7, rate: '12.5%' },
            { region: '이화동', total: 35, battery_expired: 3, pad_expired: 2, inspection_overdue: 3, rate: '11.4%' },
            { region: '혜화동', total: 48, battery_expired: 4, pad_expired: 3, inspection_overdue: 4, rate: '10.4%' },
            { region: '창신동', total: 42, battery_expired: 3, pad_expired: 3, inspection_overdue: 4, rate: '11.9%' }
          ],
          summary: {
            mandatory: 377,
            nonMandatory: 203,
            batteryTotal: 45,
            padTotal: 38,
            inspectionTotal: 52,
            urgentIn30Days: 17,
            urgentIn90Days: 41
          }
        };
      }
    };

    const stats = getStatisticsByRole();

    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">{stats.title}</h1>

        {/* 요약 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-3xl font-bold text-white">{stats.totalAED.toLocaleString()}</div>
            <div className="text-gray-400 text-sm">총 AED 대수</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-3xl font-bold text-red-400">{stats.summary.batteryTotal.toLocaleString()}</div>
            <div className="text-gray-400 text-sm">배터리 만료</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-3xl font-bold text-yellow-400">{stats.summary.padTotal.toLocaleString()}</div>
            <div className="text-gray-400 text-sm">패드 만료</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-3xl font-bold text-orange-400">{stats.summary.inspectionTotal.toLocaleString()}</div>
            <div className="text-gray-400 text-sm">점검 미흡</div>
          </div>
        </div>

        {/* 긴급 조치 필요 */}
        <div className="bg-red-900/20 border border-red-600 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-red-400 mb-2">긴급 조치 필요</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-white font-bold">{stats.summary.urgentIn30Days.toLocaleString()}대</span>
              <span className="text-gray-400 ml-2">30일 이내 만료</span>
            </div>
            <div>
              <span className="text-white font-bold">{stats.summary.urgentIn90Days.toLocaleString()}대</span>
              <span className="text-gray-400 ml-2">90일 이내 만료</span>
            </div>
          </div>
        </div>

        {/* 상세 통계 테이블 */}
        <div className="bg-gray-800 rounded-lg p-6 overflow-x-auto">
          <h3 className="text-xl font-semibold mb-4">상세 현황</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-3">지역</th>
                <th className="text-right py-2 px-3">총 장비</th>
                <th className="text-right py-2 px-3">배터리 만료</th>
                <th className="text-right py-2 px-3">패드 만료</th>
                <th className="text-right py-2 px-3">점검 미흡</th>
                <th className="text-right py-2 px-3">만료율</th>
              </tr>
            </thead>
            <tbody>
              {stats.statistics.map((row, idx) => (
                <tr key={idx} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-2 px-3 text-white">{row.region}</td>
                  <td className="py-2 px-3 text-right">{row.total.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-red-400">{row.battery_expired}</td>
                  <td className="py-2 px-3 text-right text-yellow-400">{row.pad_expired}</td>
                  <td className="py-2 px-3 text-right text-orange-400">{row.inspection_overdue}</td>
                  <td className="py-2 px-3 text-right">
                    <span className={`px-2 py-1 rounded text-xs ${
                      parseFloat(row.rate) > 18 ? 'bg-red-600' :
                      parseFloat(row.rate) > 15 ? 'bg-yellow-600' :
                      'bg-green-600'
                    }`}>
                      {row.rate}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-600 font-bold">
                <td className="py-2 px-3 text-white">합계</td>
                <td className="py-2 px-3 text-right text-white">{stats.totalAED.toLocaleString()}</td>
                <td className="py-2 px-3 text-right text-red-400">{stats.summary.batteryTotal.toLocaleString()}</td>
                <td className="py-2 px-3 text-right text-yellow-400">{stats.summary.padTotal.toLocaleString()}</td>
                <td className="py-2 px-3 text-right text-orange-400">{stats.summary.inspectionTotal.toLocaleString()}</td>
                <td className="py-2 px-3 text-right">-</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 구비의무기관 vs 비의무기관 */}
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="font-semibold mb-2">구비의무기관</h4>
            <div className="text-2xl font-bold text-green-400">{stats.summary.mandatory.toLocaleString()}대</div>
            <div className="text-gray-400 text-sm">전체의 {(stats.summary.mandatory / stats.totalAED * 100).toFixed(1)}%</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="font-semibold mb-2">구비의무기관 외</h4>
            <div className="text-2xl font-bold text-blue-400">{stats.summary.nonMandatory.toLocaleString()}대</div>
            <div className="text-gray-400 text-sm">전체의 {(stats.summary.nonMandatory / stats.totalAED * 100).toFixed(1)}%</div>
          </div>
        </div>

        {/* 데이터 기준일 */}
        <div className="mt-6 text-center text-gray-500 text-sm">
          데이터 기준일: 2025-09-15 | 다음 업데이트: 2025-09-16 00:00
        </div>
      </div>
    );
  };

  // 모바일 점검 페이지
  const MobileInspectionPage = () => (
    <div>
      <div className="mb-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-white">점검 관리</h1>
          <button
            type="button"
            onClick={() => setIsGuidelineOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
          >
            지침보기
          </button>
        </div>
        
        {/* 검색 및 정렬 섹션 */}
        <div className="space-y-3">
          {/* 통합 검색 */}
          <div className="relative">
            <input
              type="text"
              placeholder="통합 검색..."
              className="w-full bg-gray-800/80 backdrop-blur-xl text-white px-4 py-2 pl-10 rounded-xl border border-gray-700/50 focus:border-green-500 focus:outline-none"
              onChange={(e) => console.log('검색:', e.target.value)}
            />
            <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          {/* 정렬 기준 */}
          <select 
            value={searchMode}
            onChange={(e) => setSearchMode(e.target.value)}
            className="w-full bg-gray-800/80 backdrop-blur-xl text-white px-4 py-2 rounded-xl border border-gray-700/50 focus:border-green-500 focus:outline-none"
          >
            <option value="priority">우선순위 순</option>
            <option value="nearby">가까운 순</option>
            <option value="old_inspection">점검 오래된 순</option>
            <option value="expiry_soon">유효기간 임박 순</option>
          </select>
        </div>
      </div>

      {/* 오늘의 스케줄 */}
      <div className="bg-gradient-to-r from-green-900/50 to-green-800/50 backdrop-blur-xl rounded-2xl p-6 mb-6 border border-green-700/30">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            <svg className="h-8 w-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-green-400">오늘의 점검 (12건)</h3>
            <p className="text-sm text-gray-300">긴급 3건, 정기 9건</p>
          </div>
        </div>
      </div>

      {/* 점검 카드 리스트 */}
      <div className="space-y-4">
        {devices.map(device => (
          <div key={device.id} className={`bg-gray-800/50 backdrop-blur-xl rounded-2xl p-4 border border-gray-700/50 ${
            device.priority === 'urgent' ? 'border-l-4 border-l-red-500' :
            device.priority === 'warning' ? 'border-l-4 border-l-yellow-500' : 'border-l-4 border-l-green-500'
          }`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-white">{device.name}</h3>
                <p className="text-sm text-gray-400">장비: {device.id}</p>
              </div>
              <span className={getPriorityBadge(device.priority)}>
                {getPriorityText(device.priority)}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div>
                <span className="text-gray-400">배터리:</span>
                <span className="ml-1 text-white">{device.batteryExpiry}</span>
              </div>
              <div>
                <span className="text-gray-400">패드:</span>
                <span className="ml-1 text-white">{device.padExpiry}</span>
              </div>
              <div>
                <span className="text-gray-400">최근점검:</span>
                <span className="ml-1 text-white">{device.lastCheck}</span>
              </div>
              <div>
                <span className="text-gray-400">거리:</span>
                <span className="ml-1 text-white">{device.distance}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => startInspection(device.id)}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-xl transition-colors font-medium"
              >
                점검시작
              </button>
              <button
                onClick={() => startNavigation(device.name, device.lat, device.lng)}
                className="bg-gray-700/50 hover:bg-gray-600/50 text-white py-3 px-4 rounded-xl transition-colors"
              >
                길안내
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 튜토리얼 안내 및 데이터 소스 상태 */}
      <div className="mt-8 space-y-4">
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8 8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
            </svg>
            <div>
              <p className="text-blue-400 text-sm font-semibold mb-1">튜토리얼 모드</p>
              <p className="text-gray-300 text-xs leading-relaxed">
                실제 데이터에는 영향을 주지 않습니다. 
                정식 사용을 원하시면 로그인 후 이용해주세요.
              </p>
            </div>
          </div>
        </div>

        {/* 데이터 소스 상태 */}
        <div className={`p-4 rounded-2xl backdrop-blur-xl border ${
          dataSource === 'supabase' 
            ? 'bg-green-500/10 border-green-500/30' 
            : 'bg-yellow-500/10 border-yellow-500/30'
        }`}>
          <div className="flex items-start gap-3">
            <svg className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
              dataSource === 'supabase' ? 'text-green-400' : 'text-yellow-400'
            }`} fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <div>
              <p className={`text-sm font-semibold mb-1 ${
                dataSource === 'supabase' ? 'text-green-400' : 'text-yellow-400'
              }`}>
                {dataSource === 'supabase' ? '실제 데이터베이스 연결됨' : '로컬 모드'}
              </p>
              <p className="text-gray-300 text-xs leading-relaxed">
                {dataSource === 'supabase' 
                  ? `Supabase aed_data 테이블에서 ${devices.length}개 장치 로드됨 (전체 80,766개 중)`
                  : '실제 데이터베이스에 연결되지 않음. 로컬 데이터 사용 중'
                }
              </p>
              {isLoading && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-blue-400 text-xs">데이터 로딩 중...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // 모바일 대시보드 페이지
  const MobileDashboardPage = () => (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">대시보드</h1>
      
      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-4 border border-gray-700/50">
          <div className="text-2xl font-bold text-white mb-1">327</div>
          <div className="text-gray-400 text-sm">전체 AED</div>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-4 border border-gray-700/50 border-l-4 border-l-red-500">
          <div className="text-2xl font-bold text-red-400 mb-1">42</div>
          <div className="text-gray-400 text-sm">긴급점검</div>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-4 border border-gray-700/50 border-l-4 border-l-yellow-500">
          <div className="text-2xl font-bold text-yellow-400 mb-1">18</div>
          <div className="text-gray-400 text-sm">30일내 만료</div>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-4 border border-gray-700/50 border-l-4 border-l-green-500">
          <div className="text-2xl font-bold text-green-400 mb-1">12</div>
          <div className="text-gray-400 text-sm">오늘 완료</div>
        </div>
      </div>

      {/* 긴급 점검 목록 */}
      <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-4 border border-gray-700/50">
        <h2 className="text-xl font-semibold text-white mb-4">긴급 점검 필요</h2>
        <div className="space-y-3">
          {urgentWarningDevices.map(device => (
            <div key={device.id} className="bg-gray-700/50 rounded-xl p-3">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="text-white font-medium">{device.name}</div>
                  <div className="text-gray-400 text-sm">{device.id}</div>
                </div>
                <span className={getPriorityBadge(device.priority)}>
                  {getPriorityText(device.priority)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
                <div>배터리: {device.batteryExpiry}</div>
                <div>패드: {device.padExpiry}</div>
              </div>
              <button
                onClick={() => startInspection(device.id)}
                className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm transition-colors"
              >
                점검 시작
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // 모바일 팀 협업 페이지
  const MobileTeamPage = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">팀 관리 시스템</h1>
        <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm">
          팀원 추가
        </button>
      </div>

      {/* 팀 구성 요약 */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-xl p-3 border border-gray-700/50">
          <div className="text-2xl font-bold text-white">12</div>
          <div className="text-gray-400 text-xs">전체 팀원</div>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-xl p-3 border border-gray-700/50">
          <div className="text-2xl font-bold text-green-400">8</div>
          <div className="text-gray-400 text-xs">정규직원</div>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-xl p-3 border border-gray-700/50">
          <div className="text-2xl font-bold text-yellow-400">3</div>
          <div className="text-gray-400 text-xs">임시점검원</div>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-xl p-3 border border-gray-700/50">
          <div className="text-2xl font-bold text-blue-400">1</div>
          <div className="text-gray-400 text-xs">자원봉사자</div>
        </div>
      </div>
      
      <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-4 border border-gray-700/50">
        <h2 className="text-xl font-semibold text-white mb-4">팀원 현황</h2>
        <div className="space-y-3">
          {teamMembers.map((member, index) => (
            <div key={index} className="bg-gray-700/50 rounded-xl p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-medium">{member.name}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      member.type === 'permanent' ? 'bg-green-600' :
                      member.type === 'temporary' ? 'bg-yellow-600' :
                      'bg-blue-600'
                    }`}>
                      {member.type === 'permanent' ? '정규' :
                       member.type === 'temporary' ? '임시' : '자원'}
                    </span>
                  </div>
                  <div className="text-gray-400 text-sm">{member.department}</div>
                </div>
                <div className="text-right text-sm">
                  <div className="text-white">{member.completed}/{member.quota}</div>
                  <div className="text-gray-400">완료</div>
                </div>
              </div>
              <div className="w-full bg-gray-600 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{width: `${(member.completed / member.quota) * 100}%`}}
                ></div>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {Math.round((member.completed / member.quota) * 100)}% 완료
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // 모바일 보고서 페이지
  const MobileReportsPage = () => {
    // PC 버전과 동일한 통계 데이터 사용
    const getStatisticsByRole = () => {
      if (userRole === 'central' || userRole === 'emergency') {
        return {
          title: '전국 AED 현황',
          totalAED: 81331,
          statistics: [
            { region: '서울', total: 12500, expired: 1788, rate: '14.3%' },
            { region: '경기', total: 18500, expired: 2886, rate: '15.6%' },
            { region: '부산', total: 5200, expired: 1047, rate: '20.1%' },
            { region: '경남', total: 5100, expired: 928, rate: '18.2%' },
            { region: '경북', total: 4500, expired: 994, rate: '22.1%' },
          ],
          summary: {
            mandatory: 52915,
            nonMandatory: 28416,
            batteryTotal: 8059,
            padTotal: 6954,
            urgentIn30Days: 3065
          }
        };
      } else if (userRole === 'regional') {
        return {
          title: '서울시 AED 현황',
          totalAED: 12500,
          statistics: [
            { region: '종로구', total: 580, expired: 83, rate: '14.3%' },
            { region: '중구', total: 620, expired: 89, rate: '14.4%' },
            { region: '강남구', total: 780, expired: 114, rate: '14.6%' },
            { region: '서초구', total: 680, expired: 99, rate: '14.6%' },
            { region: '송파구', total: 690, expired: 101, rate: '14.6%' }
          ],
          summary: {
            mandatory: 8125,
            nonMandatory: 4375,
            batteryTotal: 975,
            padTotal: 813,
            urgentIn30Days: 366
          }
        };
      } else {
        return {
          title: '종로구 AED 현황',
          totalAED: 580,
          statistics: [
            { region: '청운동', total: 42, expired: 6, rate: '14.3%' },
            { region: '사직동', total: 38, expired: 5, rate: '13.2%' },
            { region: '삼청동', total: 35, expired: 5, rate: '14.3%' },
            { region: '가회동', total: 38, expired: 6, rate: '15.8%' },
            { region: '종로1가', total: 95, expired: 15, rate: '15.8%' }
          ],
          summary: {
            mandatory: 377,
            nonMandatory: 203,
            batteryTotal: 45,
            padTotal: 38,
            urgentIn30Days: 17
          }
        };
      }
    };

    const stats = getStatisticsByRole();

    return (
      <div>
        <h1 className="text-2xl font-bold text-white mb-4">{stats.title}</h1>

        {/* 요약 카드 - 모바일 2x2 그리드 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-800/50 backdrop-blur-xl rounded-xl p-3 border border-gray-700/50">
            <div className="text-2xl font-bold text-white">{stats.totalAED.toLocaleString()}</div>
            <div className="text-gray-400 text-xs">총 AED</div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-xl rounded-xl p-3 border border-gray-700/50">
            <div className="text-2xl font-bold text-red-400">{stats.summary.batteryTotal.toLocaleString()}</div>
            <div className="text-gray-400 text-xs">배터리 만료</div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-xl rounded-xl p-3 border border-gray-700/50">
            <div className="text-2xl font-bold text-yellow-400">{stats.summary.padTotal.toLocaleString()}</div>
            <div className="text-gray-400 text-xs">패드 만료</div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-xl rounded-xl p-3 border border-gray-700/50">
            <div className="text-2xl font-bold text-orange-400">{stats.summary.urgentIn30Days.toLocaleString()}</div>
            <div className="text-gray-400 text-xs">30일내 만료</div>
          </div>
        </div>

        {/* 긴급 알림 */}
        <div className="bg-red-900/20 border border-red-600/50 rounded-xl p-3 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-red-400 font-semibold text-sm">긴급 조치 필요</div>
              <div className="text-white text-lg font-bold">{stats.summary.urgentIn30Days}대</div>
            </div>
            <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
            </svg>
          </div>
        </div>

        {/* 지역별 현황 - 간소화된 리스트 */}
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-4 border border-gray-700/50">
          <h3 className="font-semibold text-white mb-3">지역별 현황</h3>
          <div className="space-y-2">
            {stats.statistics.map((row, idx) => (
              <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-700/30">
                <div>
                  <div className="text-white font-medium">{row.region}</div>
                  <div className="text-gray-400 text-xs">{row.total.toLocaleString()}대</div>
                </div>
                <div className="text-right">
                  <div className="text-red-400 text-sm">{row.expired}대 만료</div>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    parseFloat(row.rate) > 18 ? 'bg-red-600' :
                    parseFloat(row.rate) > 15 ? 'bg-yellow-600' :
                    'bg-green-600'
                  }`}>
                    {row.rate}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 구비의무기관 현황 */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-gray-800/50 backdrop-blur-xl rounded-xl p-3 border border-gray-700/50">
            <div className="text-gray-400 text-xs mb-1">구비의무기관</div>
            <div className="text-xl font-bold text-green-400">{stats.summary.mandatory.toLocaleString()}</div>
            <div className="text-gray-500 text-xs">{(stats.summary.mandatory / stats.totalAED * 100).toFixed(1)}%</div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-xl rounded-xl p-3 border border-gray-700/50">
            <div className="text-gray-400 text-xs mb-1">구비의무 외</div>
            <div className="text-xl font-bold text-blue-400">{stats.summary.nonMandatory.toLocaleString()}</div>
            <div className="text-gray-500 text-xs">{(stats.summary.nonMandatory / stats.totalAED * 100).toFixed(1)}%</div>
          </div>
        </div>

        {/* 데이터 기준일 */}
        <div className="mt-4 text-center text-gray-500 text-xs">
          데이터 기준: 2025-09-15 | 매일 00:00 업데이트
        </div>
      </div>
    );
  };

  // 모바일 점검 모달
  const MobileInspectionModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
      <div className="bg-gray-900 rounded-t-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-900 p-4 border-b border-gray-700">
          <div className="flex justify-between items-start gap-3 mb-3">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-bold text-green-400">{selectedDevice?.name || 'AED 점검'}</h2>
              <button
                type="button"
                onClick={() => setIsGuidelineOpen(true)}
                className="inline-flex w-fit items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500"
              >
                지침보기
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowInspectionModal(false);
                  setShowValidationWarnings(false);
                }}
                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-xl text-sm"
              >
                취소
              </button>
              <button
                onClick={saveInspection}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-xl text-sm"
              >
                완료
              </button>
            </div>
          </div>
          
          {/* 진행률 표시 - ProgressTracker 컴포넌트 사용 */}
          <ProgressTracker
            completed={completedItems.size}
            total={totalInspectionItems}
            className="mb-4"
          />
        </div>

        <div className="p-4">
          {selectedDevice && (
            <div className="space-y-4">
              {/* 데이터 검증 경고 표시 */}
              {showValidationWarnings && (
                <div className="mb-4">
                  <DataValidationWarnings
                    device={mapAEDDeviceToRealData(selectedDevice)}
                    onClose={() => setShowValidationWarnings(false)}
                  />
                </div>
              )}

              {/* 점검 요약 정보 - 모바일용 컴팩트 버전 */}
              <div className="bg-gradient-to-r from-red-900/20 to-orange-900/20 border border-red-600/30 rounded-2xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    점검 전 확인사항
                  </h3>
                  <button 
                    className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded-lg text-gray-300"
                    onClick={() => {
                      const summaryDetails = document.getElementById('summary-details-mobile');
                      if (summaryDetails) {
                        summaryDetails.classList.toggle('hidden');
                      }
                    }}
                  >
                    상세보기
                  </button>
                </div>
                
                {/* 간략 요약 - 항상 표시 */}
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const alerts = [];
                    const batteryDate = new Date(selectedDevice.batteryExpiry);
                    const padDate = new Date(selectedDevice.padExpiry);
                    const today = new Date();
                    const batteryDays = Math.ceil((batteryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    const padDays = Math.ceil((padDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    
                    if (batteryDays <= 30) {
                      alerts.push(
                        <span key="battery" className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-900/50 text-red-300 border border-red-600/30">
                          배터리 {batteryDays <= 0 ? '만료' : `${batteryDays}일`}
                        </span>
                      );
                    }
                    if (padDays <= 30) {
                      alerts.push(
                        <span key="pad" className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-900/50 text-orange-300 border border-orange-600/30">
                          패드 {padDays <= 0 ? '만료' : `${padDays}일`}
                        </span>
                      );
                    }
                    
                    const lastCheckDate = new Date(selectedDevice.lastCheck);
                    const daysSinceCheck = Math.ceil((today.getTime() - lastCheckDate.getTime()) / (1000 * 60 * 60 * 24));
                    if (daysSinceCheck > 90) {
                      alerts.push(
                        <span key="check" className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-900/50 text-yellow-300 border border-yellow-600/30">
                          {daysSinceCheck}일 미점검
                        </span>
                      );
                    }
                    
                    if (alerts.length === 0) {
                      alerts.push(
                        <span key="ok" className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-900/50 text-green-300 border border-green-600/30">
                          정상 상태
                        </span>
                      );
                    }
                    
                    return alerts;
                  })()}
                </div>
                
                {/* 상세 정보 - 토글 가능 */}
                <div id="summary-details-mobile" className="hidden mt-3 pt-3 border-t border-gray-700 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">교체 예정일:</span>
                    <span className="text-white">
                      {(() => {
                        const mfgDate = new Date((selectedDevice.manufacturingDate || '2024-01') + '-01');
                        mfgDate.setFullYear(mfgDate.getFullYear() + 10);
                        const year = mfgDate.getFullYear();
                        const month = String(mfgDate.getMonth() + 1).padStart(2, '0');
                        const day = String(mfgDate.getDate()).padStart(2, '0');
                        const today = new Date();
                        const monthDiff = (mfgDate.getFullYear() - today.getFullYear()) * 12 + (mfgDate.getMonth() - today.getMonth());
                        const yearLeft = Math.floor(monthDiff / 12);
                        const monthLeft = monthDiff % 12;
                        return `${year}-${month}-${day} (${yearLeft}년 ${monthLeft}개월 남음)`;
                      })()}
                    </span>
                  </div>
                </div>
              </div>

              {/* 카테고리 분류 확인 */}
              <CategorySection
                currentCategory1={selectedDevice.category1}
                currentCategory2={selectedDevice.category2}
                currentCategory3={selectedDevice.category3}
                institutionName={selectedDevice.installationOrg}
                onCategoryChange={(cat1, cat2, cat3) => {
                  console.log('카테고리 변경:', cat1, cat2, cat3);
                  // 여기에 실제 저장 로직 추가
                }}
                markItemComplete={markItemComplete}
              />

              {/* 기본 정보 */}
              <div className="bg-gray-800/50 rounded-2xl p-4">
                <h3 className="font-semibold text-white mb-3">기본 정보</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">관리번호:</span>
                    <span className="text-white">20240915-{String(selectedDevice.id).padStart(2, '0')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">장비연번:</span>
                    <span className="text-white">{selectedDevice.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">기관 연락처:</span>
                    <span className="text-white">02-1234-5678</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">최근점검일:</span>
                    <span className="text-white">{selectedDevice.lastCheck}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">관리책임자:</span>
                    {editingManager ? (
                      <input
                        type="text"
                        value={managerName}
                        onChange={(e) => setManagerName(e.target.value)}
                        onBlur={() => setEditingManager(false)}
                        className="bg-gray-700 text-white px-2 py-1 rounded text-sm max-w-[120px]"
                        autoFocus
                      />
                    ) : (
                      <span 
                        className="text-white cursor-pointer hover:text-green-400"
                        onClick={() => setEditingManager(true)}
                      >
                        {managerName}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 장비 정보 확인 */}
              <div className="bg-gray-800/50 rounded-2xl p-4">
                <h3 className="font-semibold text-white mb-3">장비 정보 확인</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-gray-400 text-xs">모델명</span>
                    {editingEquipment ? (
                      <input
                        type="text"
                        defaultValue={selectedDevice.modelName || 'CU-SP1'}
                        onChange={(e) => setEquipmentData({...equipmentData, modelName: e.target.value})}
                        className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm mt-1"
                      />
                    ) : (
                      <div className="text-white mt-1">{selectedDevice.modelName || 'CU-SP1'}</div>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs">제조사</span>
                    {editingEquipment ? (
                      <input
                        type="text"
                        defaultValue={selectedDevice.manufacturer || 'CU메디칼'}
                        onChange={(e) => setEquipmentData({...equipmentData, manufacturer: e.target.value})}
                        className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm mt-1"
                      />
                    ) : (
                      <div className="text-white mt-1">{selectedDevice.manufacturer || 'CU메디칼'}</div>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs">제조번호</span>
                    {editingEquipment ? (
                      <input
                        type="text"
                        defaultValue={selectedDevice.serialNumber || 'SN-2024-0001'}
                        onChange={(e) => setEquipmentData({...equipmentData, serialNumber: e.target.value})}
                        className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm mt-1"
                      />
                    ) : (
                      <div className="text-white mt-1">{selectedDevice.serialNumber || 'SN-2024-0001'}</div>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs">제조일</span>
                    {editingEquipment ? (
                      <input
                        type="month"
                        defaultValue={selectedDevice.manufacturingDate || '2024-01'}
                        onChange={(e) => setEquipmentData({...equipmentData, manufacturingDate: e.target.value})}
                        className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm mt-1"
                      />
                    ) : (
                      <div>
                        <div className="text-white mt-1">{selectedDevice.manufacturingDate || '2024-01'}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          {(() => {
                            const mfgDate = new Date((selectedDevice.manufacturingDate || '2024-01') + '-01');
                            const replaceDate = new Date(mfgDate);
                            replaceDate.setFullYear(replaceDate.getFullYear() + 10);
                            const year = replaceDate.getFullYear();
                            const month = String(replaceDate.getMonth() + 1).padStart(2, '0');
                            return `${year}년 ${month}월 교체필요`;
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  {editingEquipment ? (
                    <>
                      <button
                        onClick={() => {
                          setEditingEquipment(false);
                          showAlert('장비 정보가 수정되었습니다');
                        }}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-sm"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setEditingEquipment(false)}
                        className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-xl text-sm"
                      >
                        취소
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={() => {
                          setEquipmentConfirmed(true);
                          showAlert('장비 정보가 확인되었습니다');
                        }}
                        className={`flex-1 ${equipmentConfirmed ? 'bg-green-600' : 'bg-gray-600'} hover:bg-green-700 text-white py-2 rounded-xl text-sm transition-colors`}
                      >
                        <span className="flex items-center justify-center">
                          {equipmentConfirmed ? (
                            <>
                              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              확인됨
                            </>
                          ) : '모두 일치'}
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          setEditingEquipment(true);
                          setEquipmentConfirmed(false);
                        }}
                        className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-xl text-sm"
                      >
                        수정 필요
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* 설치 위치 확인 - 실제 카카오맵 사용 */}
              <KakaoMapSection
                latitude={selectedDevice?.lat ? parseFloat(selectedDevice.lat) : 37.5665}
                longitude={selectedDevice?.lng ? parseFloat(selectedDevice.lng) : 126.9780}
                address={selectedDevice?.address || selectedDevice?.location || '서울시청'}
                institution={selectedDevice?.name || 'AED 설치 위치'}
                onLocationUpdate={(lat, lng) => {
                  console.log('위치 업데이트:', lat, lng);
                  showAlert(`위치가 업데이트되었습니다\n${lat.toFixed(6)}, ${lng.toFixed(6)}`);
                  // 여기서 실제 데이터 업데이트 로직을 추가할 수 있습니다
                }}
              />

              {/* 기존 가상 지도 숨김 - 주석 처리 */}
              <div className="hidden bg-gray-800/50 rounded-2xl p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-white">설치 위치 확인 (가상)</h3>
                  <div className="text-xs text-gray-300">
                    {pinPosition.x.toFixed(1)}, {pinPosition.y.toFixed(1)}
                  </div>
                </div>
                <div
                  ref={mapRef}
                  className="w-full h-48 bg-gray-700 rounded-xl border relative overflow-hidden"
                  style={{
                    backgroundImage: 'linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px)',
                    backgroundSize: '20px 20px'
                  }}
                >
                  {/* 드래그 가능한 핀 */}
                  <div
                    className={`absolute cursor-move ${isDraggingPin ? 'z-20' : 'z-10'}`}
                    style={{
                      left: `${pinPosition.x}%`,
                      top: `${pinPosition.y}%`,
                      transform: 'translate(-50%, -100%)'
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setIsDraggingPin(true);
                      const rect = mapRef.current?.getBoundingClientRect();
                      if (!rect) return;

                      const handleMouseMove = (e: MouseEvent) => {
                        const x = ((e.clientX - rect.left) / rect.width) * 100;
                        const y = ((e.clientY - rect.top) / rect.height) * 100;
                        setPinPosition({
                          x: Math.max(0, Math.min(100, x)),
                          y: Math.max(0, Math.min(100, y))
                        });
                      };

                      const handleMouseUp = () => {
                        setIsDraggingPin(false);
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
                        showAlert('위치가 업데이트되었습니다');
                      };

                      document.addEventListener('mousemove', handleMouseMove);
                      document.addEventListener('mouseup', handleMouseUp);
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      setIsDraggingPin(true);
                      const rect = mapRef.current?.getBoundingClientRect();
                      if (!rect) return;

                      const handleTouchMove = (e: TouchEvent) => {
                        const touch = e.touches[0];
                        const x = ((touch.clientX - rect.left) / rect.width) * 100;
                        const y = ((touch.clientY - rect.top) / rect.height) * 100;
                        setPinPosition({
                          x: Math.max(0, Math.min(100, x)),
                          y: Math.max(0, Math.min(100, y))
                        });
                      };

                      const handleTouchEnd = () => {
                        setIsDraggingPin(false);
                        document.removeEventListener('touchmove', handleTouchMove);
                        document.removeEventListener('touchend', handleTouchEnd);
                        showAlert('위치가 업데이트되었습니다');
                      };

                      document.addEventListener('touchmove', handleTouchMove);
                      document.addEventListener('touchend', handleTouchEnd);
                    }}
                  >
                    <svg className={`h-8 w-8 ${isDraggingPin ? 'text-red-500' : 'text-green-500'} drop-shadow-lg transition-colors`} fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                  </div>
                  {/* 안내 텍스트 */}
                  <div className="absolute bottom-2 left-2 text-xs text-gray-300 bg-gray-800/80 px-2 py-1 rounded">
                    핀을 드래그하여 위치 수정
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    onClick={() => {
                      console.log('현재위치로 재설정 버튼 클릭됨');
                      setPinPosition({ x: 50, y: 50 });
                      showAlert('현재 위치로 재설정되었습니다');
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-sm"
                  >
                    현재위치로 재설정
                  </button>
                  <button
                    onClick={() => {
                      showAlert('위치가 저장되었습니다');
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl text-sm"
                  >
                    위치 저장
                  </button>
                </div>
              </div>

              {/* 기호 설명 */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 2C5 1.44772 5.44772 1 6 1H14C14.5523 1 15 1.44772 15 2C15 2.55228 14.5523 3 14 3H6C5.44772 3 5 2.55228 5 2Z" fill="#9CA3AF"/>
                    <path d="M6 3H14L13 7H7L6 3Z" fill="#D1D5DB"/>
                    <path d="M7 7H13L14 17H6L7 7Z" fill="#9CA3AF"/>
                    <path d="M5 18C5 17.4477 5.44772 17 6 17H14C14.5523 17 15 17.4477 15 18C15 18.5523 14.5523 19 14 19H6C5.44772 19 5 18.5523 5 18Z" fill="#9CA3AF"/>
                    <path d="M8 9L10 11L12 9" stroke="#374151" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span>모래시계: 제품 유효기간 표시 (Expiration Date)</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 10H7V18H3V10Z" fill="#9CA3AF"/>
                    <path d="M7 8H11V18H7V8Z" fill="#D1D5DB"/>
                    <path d="M11 10H17V18H11V10Z" fill="#9CA3AF"/>
                    <path d="M5 8V7L7 5L9 7V8" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M13 10V9L14.5 7.5L16 9V10" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="9" cy="6" r="1" fill="#9CA3AF"/>
                    <circle cx="14.5" cy="8" r="1" fill="#9CA3AF"/>
                  </svg>
                  <span>공장: 제품 제조일자 표시 (Manufacture Date)</span>
                </div>
              </div>

              {/* 배터리/패드 유효기간 */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => router.push('/aed-battery-lifespan')}
                  className="absolute -top-2 right-0 text-xs px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors z-10"
                >
                  제조사별 유효기간
                </button>
              </div>
              {[
                { label: '배터리 유효기간', value: selectedDevice.batteryExpiry, key: 'batteryExpiry' },
                { label: '패드 유효기간', value: selectedDevice.padExpiry, key: 'padExpiry' }
              ].map((item, index) => {
                const itemState = inspectionStates[item.key];
                const isEditing = itemState?.isEditing;
                const currentValue = itemState?.currentValue || item.value;
                
                // 남은 날짜 계산 - 헬퍼 함수 사용
                const { daysText, daysColor } = calculateExpiryInfo(currentValue);
                
                return (
                  <div 
                    key={index} 
                    className="bg-gray-800/50 rounded-2xl p-4"
                    onMouseEnter={() => handleItemHover(item.key)}
                    onMouseLeave={() => { setHoveredItem(null); clearHoverTimer(); }}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-white font-medium flex items-center gap-2">
                        {item.label}
                        <button
                          onClick={() => showTooltip(item.key, getTooltipContent(item.key))}
                          className="text-gray-400 hover:text-white"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      </span>
                      {isEditing ? (
                        <input
                          type="date"
                          value={currentValue}
                          onChange={(e) => {
                            setInspectionStates(prev => ({
                              ...prev,
                              [item.key]: {...prev[item.key], currentValue: e.target.value}
                            }));
                            validateInput(item.key, e.target.value, 'date');
                          }}
                          className="bg-gray-700 text-white px-2 py-1 rounded text-sm border border-gray-600 focus:border-orange-400"
                        />
                      ) : (
                        <div className="text-right">
                          <span className={`${itemState?.status === 'corrected' ? 'text-orange-400' : 'text-white'} text-lg font-medium block`}>
                            {currentValue}
                          </span>
                          <span className={`text-sm ${daysColor}`}>{daysText}</span>
                        </div>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => handleEditComplete(e, item.key, currentValue)}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-sm font-medium"
                        >
                          수정완료
                        </button>
                        <button
                          onClick={() => preserveScrollPosition(() => {
                            setInspectionStates(prev => ({
                              ...prev,
                              [item.key]: {...prev[item.key], isEditing: false, currentValue: prev[item.key]?.originalValue || item.value}
                            }));
                          })}
                          className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-xl text-sm"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            handleItemConfirm(e, item.key, item.value);
                            markItemComplete(item.key);
                          }}
                          className={getItemButtonStyle(item.key, 'confirm')}
                          disabled={itemState?.status === 'corrected'}
                        >
                          일치
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleItemCorrect(e, item.key, item.value)}
                          className={getItemButtonStyle(item.key, 'correct')}
                          disabled={itemState?.status === 'confirmed'}
                        >
                          {itemState?.status === 'corrected' ? '수정됨' : '수정'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}



              {/* 외부표출 설정 확인 */}
              {[
                { label: '외부표출', value: externalDisplay, key: 'externalDisplay', type: 'select', options: [{value: 'Y', label: '허용'}, {value: 'N', label: '미허용'}] }
              ].map((item, index) => {
                const itemState = inspectionStates[item.key];
                const isEditing = itemState?.isEditing;
                const currentValue = itemState?.currentValue || item.value;
                
                return (
                  <div key={index} className="bg-gray-800/50 rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-white font-medium">{item.label}</span>
                      {isEditing ? (
                        item.type === 'select' ? (
                          <select
                            value={currentValue}
                            onChange={(e) => setInspectionStates(prev => ({
                              ...prev,
                              [item.key]: {...prev[item.key], currentValue: e.target.value}
                            }))}
                            className="bg-gray-700 text-white px-2 py-1 rounded text-sm border border-gray-600 focus:border-orange-400"
                          >
                            {item.options?.map((opt: {value: string, label: string}) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={item.type}
                            value={currentValue}
                            onChange={(e) => setInspectionStates(prev => ({
                              ...prev,
                              [item.key]: {...prev[item.key], currentValue: e.target.value}
                            }))}
                            className="bg-gray-700 text-white px-2 py-1 rounded text-sm border border-gray-600 focus:border-orange-400 w-40"
                          />
                        )
                      ) : (
                        <span className={`${itemState?.status === 'corrected' ? 'text-orange-400' : 'text-green-400'}`}>
                          {item.type === 'select' ? 
                            item.options?.find((opt: {value: string, label: string}) => opt.value === currentValue)?.label || currentValue :
                            currentValue
                          }
                        </span>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => handleEditComplete(e, item.key, currentValue)}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-sm font-medium"
                        >
                          수정완료
                        </button>
                        <button
                          onClick={() => preserveScrollPosition(() => {
                            setInspectionStates(prev => ({
                              ...prev,
                              [item.key]: {...prev[item.key], isEditing: false, currentValue: prev[item.key]?.originalValue || item.value}
                            }));
                          })}
                          className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-xl text-sm"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            handleItemConfirm(e, item.key, item.value);
                            markItemComplete(item.key);
                          }}
                          className={getItemButtonStyle(item.key, 'confirm')}
                          disabled={itemState?.status === 'corrected'}
                        >
                          일치
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleItemCorrect(e, item.key, item.value)}
                          className={getItemButtonStyle(item.key, 'correct')}
                          disabled={itemState?.status === 'confirmed'}
                        >
                          {itemState?.status === 'corrected' ? '수정됨' : '수정'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 위치 정보 확인 */}
              <div className="bg-gray-800/50 rounded-2xl p-4">
                <h3 className="font-semibold text-white mb-3">위치 정보 확인</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-gray-300 text-sm mb-2 block">설치장소 주소 (도로명)</label>
                    {editingLocation ? (
                      <input
                        type="text"
                        defaultValue="서울특별시 중구 세종대로 110"
                        onChange={(e) => setLocationData({...locationData, address: e.target.value})}
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-xl text-sm border border-gray-600 focus:border-green-400"
                      />
                    ) : (
                      <div className="text-white bg-gray-700/50 px-3 py-2 rounded-xl text-sm">
                        서울특별시 중구 세종대로 110
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-300 text-sm mb-2 block">설치위치 (구체적 위치)</label>
                    {editingLocation ? (
                      <input
                        type="text"
                        defaultValue="1층 로비 엘리베이터 옆"
                        onChange={(e) => setLocationData({...locationData, specificLocation: e.target.value})}
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-xl text-sm border border-gray-600 focus:border-green-400"
                      />
                    ) : (
                      <div className="text-white bg-gray-700/50 px-3 py-2 rounded-xl text-sm">
                        1층 로비 엘리베이터 옆
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  {editingLocation ? (
                    <>
                      <button
                        onClick={() => {
                          setEditingLocation(false);
                          showAlert('위치 정보가 수정되었습니다');
                        }}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-sm"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setEditingLocation(false)}
                        className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-xl text-sm"
                      >
                        취소
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setEditingLocation(true)}
                      className="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-xl text-sm"
                    >
                      수정
                    </button>
                  )}
                </div>
              </div>

              {/* 작동 상태 확인 */}
              <div className="bg-gray-800/50 rounded-2xl p-4">
                <h3 className="font-semibold text-white mb-3">작동 상태 확인</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-gray-300 text-sm mb-2 block">운영상태</label>
                    <div className="flex gap-2">
                      {['정상', '고장', '점검중', '폐기예정', '분실'].map((status) => (
                        <button
                          key={status}
                          onClick={() => setOperationStatus(status)}
                          className={`flex-1 ${operationStatus === status ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'} text-white py-2 rounded-xl text-sm transition-colors`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-300 text-sm mb-2 block">배터리 상태</label>
                    <div className="flex gap-2">
                      {['정상', '교체필요', '없음'].map((status) => (
                        <button
                          key={status}
                          onClick={() => setBatteryStatus(status)}
                          className={`flex-1 ${batteryStatus === status ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'} text-white py-2 rounded-xl text-sm transition-colors`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 접근성 확인 */}
              <div className="bg-gray-800/50 rounded-2xl p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-white">접근성 확인</h3>
                  {!editingOperatingHours ? (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        preserveScrollPosition(() => {
                          setEditingOperatingHours(true);
                        });
                      }}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded-xl text-sm"
                    >
                      수정
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          preserveScrollPosition(() => {
                            setEditingOperatingHours(false);
                            showAlert('운영시간이 저장되었습니다');
                          });
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-xl text-sm"
                      >
                        저장
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          preserveScrollPosition(() => {
                            setEditingOperatingHours(false);
                            setOperatingHours([
                              { day: '월', start: '09:00', end: '18:00' },
                              { day: '화', start: '09:00', end: '18:00' },
                              { day: '수', start: '09:00', end: '18:00' },
                              { day: '목', start: '09:00', end: '18:00' },
                              { day: '금', start: '09:00', end: '18:00' },
                              { day: '토', start: '10:00', end: '14:00' },
                              { day: '일', start: '00:00', end: '00:00' },
                              { day: '공', start: '00:00', end: '00:00' }
                            ]);
                          });
                        }}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded-xl text-sm"
                      >
                        취소
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="col-span-2">
                    <label className="text-gray-300 text-sm mb-2 block">운영 시간</label>

                    {/* 24시간 사용가능 버튼 */}
                    <div className="mb-3">
                      <button
                        onClick={handle24Hours}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          is24Hours
                            ? 'bg-green-600 text-white border-2 border-green-500'
                            : 'bg-gray-600 text-gray-300 border-2 border-gray-500 hover:bg-gray-500'
                        }`}
                      >
                        {is24Hours ? '✓ 24시간 사용 가능' : '24시간 사용 가능'}
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-x-2 gap-y-2 text-xs mb-4">
                      {operatingHours.map((schedule, index) => (
                        <div key={schedule.day} className="text-left">
                          <div className="text-gray-300 font-medium mb-1">{schedule.day}</div>
                          {editingOperatingHours && !is24Hours ? (
                            <input
                              type="text"
                              value={schedule.start === '00:00' && schedule.end === '00:00' ? '휴무' : `${schedule.start}~${schedule.end}`}
                              onChange={(e) => {
                                const newHours = [...operatingHours];
                                const value = e.target.value;
                                if (value === '휴무') {
                                  newHours[index] = { ...schedule, start: '00:00', end: '00:00' };
                                } else {
                                  const times = value.split('~');
                                  if (times.length === 2) {
                                    newHours[index] = { ...schedule, start: times[0], end: times[1] };
                                  }
                                }
                                setOperatingHours(newHours);
                              }}
                              className="bg-gray-600 text-white px-1 py-0.5 rounded text-xs w-full text-left"
                              placeholder="09:00~18:00"
                            />
                          ) : (
                            <div className="text-gray-400 text-xs text-left">
                              {schedule.start === '00:00' && schedule.end === '00:00' ? '휴무' : `${schedule.start}~${schedule.end}`}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* 일요일 사용 가능주 선택 */}
                    <div className={`${isSundayOperating ? 'bg-blue-800/20 border-blue-500/30' : 'bg-gray-800/20 border-gray-600/30'} border rounded-lg p-3`}>
                      <label className={`${isSundayOperating ? 'text-blue-300' : 'text-gray-500'} text-sm mb-2 block font-medium flex items-center gap-2`}>
                        일요일 사용 가능 주
                        {!isSundayOperating && (
                          <span className="text-xs bg-red-600/20 text-red-300 px-2 py-0.5 rounded">
                            일요일 운영시간 설정 필요
                          </span>
                        )}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <label className={`flex items-center gap-1 ${!isSundayOperating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={sundayWeeks.all}
                            onChange={() => handleSundayWeeks('all')}
                            disabled={!isSundayOperating}
                            className={`rounded border-gray-400 ${!isSundayOperating ? 'cursor-not-allowed' : ''}`}
                          />
                          <span className={`text-xs ${isSundayOperating ? 'text-blue-200' : 'text-gray-500'}`}>매주</span>
                        </label>
                        {['week1', 'week2', 'week3', 'week4', 'week5'].map((week, index) => (
                          <label key={week} className={`flex items-center gap-1 ${!isSundayOperating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                            <input
                              type="checkbox"
                              checked={sundayWeeks[week as keyof typeof sundayWeeks]}
                              onChange={() => handleSundayWeeks(week)}
                              disabled={!isSundayOperating}
                              className={`rounded border-gray-400 ${!isSundayOperating ? 'cursor-not-allowed' : ''}`}
                            />
                            <span className={`text-xs ${isSundayOperating ? 'text-blue-200' : 'text-gray-500'}`}>{index + 1}주</span>
                          </label>
                        ))}
                      </div>
                      <p className={`text-xs ${isSundayOperating ? 'text-blue-300/70' : 'text-gray-500/70'} mt-2`}>
                        {isSundayOperating
                          ? '※ 매월 일요일 중 사용 가능한 주를 선택해주세요'
                          : '※ 일요일 운영시간을 먼저 설정하면 주차 선택이 가능합니다'
                        }
                      </p>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="text-gray-300 text-sm mb-2 block">안내표지 설치 (다중선택 가능)</label>
                    <div className="flex gap-1 overflow-x-auto">
                      {['출입구', '내부', '엘리베이터', '안내지도', '책자'].map((place) => (
                        <button
                          key={place}
                          onClick={(e) => {
                            e.currentTarget.classList.toggle('bg-green-600');
                            e.currentTarget.classList.toggle('bg-gray-600');
                          }}
                          className={`px-2 py-2 ${place === '출입구' ? 'bg-green-600' : 'bg-gray-600'} hover:opacity-80 text-white rounded-xl text-xs transition-colors flex-shrink-0`}
                        >
                          {place}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-300 text-sm mb-2 block">설치방법</label>
                    <div className="flex gap-2">
                      {['벽걸이형', '스탠드형', '보관함'].map((method) => (
                        <button
                          key={method}
                          onClick={() => setInstallMethod(method)}
                          className={`flex-1 ${installMethod === method ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'} text-white py-2 rounded-xl text-sm transition-colors`}
                        >
                          {method.replace('형', '')}
                        </button>
                      ))}
                    </div>
                  </div>
                  <StorageChecklistSection
                    storageChecklist={storageChecklist}
                    setStorageChecklist={setStorageChecklist}
                  />
                </div>
              </div>


              {/* 점검 결과 기록 */}
              <div className="border-t border-gray-700 pt-4">
                <h3 className="text-lg font-bold text-yellow-400 mb-3">점검 결과 기록</h3>
              </div>

              {/* 후속조치 필요여부 */}
              <div className="bg-gray-800/50 rounded-2xl p-4">
                <h3 className="font-semibold text-white mb-3">후속조치 필요여부</h3>
                <div className="flex gap-2">
                  {['이상없음', '현장권고완료', '추후권고대상'].map((action) => (
                    <button
                      key={action}
                      onClick={() => setFollowUpAction(action)}
                      className={`flex-1 py-2 rounded-xl text-sm transition-colors ${
                        followUpAction === action
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-gray-600 hover:bg-gray-700 text-white'
                      }`}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>

              {/* 조치사항 - "이상없음" 선택 시 숨김 */}
              {followUpAction !== '이상없음' && (
                <div className="bg-gray-800/50 rounded-2xl p-4">
                  <h3 className="font-semibold text-white mb-3">조치사항</h3>
                  <textarea
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-xl text-sm border border-gray-600 focus:border-green-400 h-24"
                    placeholder="상세 조치사항을 입력하세요 (500자 이내)"
                    maxLength={500}
                  />
                </div>
              )}

              {/* 사진 촬영 */}
              <div className="bg-gray-800/50 rounded-2xl p-4">
                <h3 className="font-semibold text-white mb-3">사진 기록</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button className="bg-blue-600 hover:bg-blue-700 text-white py-8 rounded-xl flex flex-col items-center justify-center">
                    <svg className="h-8 w-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-xs">기기 전면 (필수)</span>
                  </button>
                  <button className="bg-blue-600 hover:bg-blue-700 text-white py-8 rounded-xl flex flex-col items-center justify-center">
                    <svg className="h-8 w-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-xs">제조번호(시리얼번호)</span>
                  </button>
                  <button className="bg-gray-600 hover:bg-gray-700 text-white py-8 rounded-xl flex flex-col items-center justify-center">
                    <svg className="h-8 w-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-xs">안내표지판</span>
                  </button>
                  <button className="bg-gray-600 hover:bg-gray-700 text-white py-8 rounded-xl flex flex-col items-center justify-center">
                    <svg className="h-8 w-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-xs">문제 부위 (선택)</span>
                  </button>
                </div>
              </div>
              
              {/* 툴팁 표시 */}
              {activeTooltip && (
                <div className="fixed top-20 right-4 bg-gray-800 text-white p-3 rounded-lg shadow-lg z-50 max-w-xs">
                  <div className="text-sm">{activeTooltip.split(':')[1]}</div>
                  <button
                    onClick={() => setActiveTooltip(null)}
                    className="absolute top-1 right-1 text-gray-400 hover:text-white"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* 하단 고정 버튼 - fixed로 변경하여 화면 하단에 고정 */}
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900 p-4 border-t border-gray-700 z-50">
          <div className="max-w-md mx-auto">
            <button
              onClick={saveInspection}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl text-sm font-bold transition-colors shadow-lg"
            >
              점검 결과 저장
            </button>
          </div>
        </div>
        {/* 하단 패딩 추가 - 고정 버튼 공간 확보 */}
        <div className="pb-20"></div>
      </div>
    </div>
  );

  // 확인 다이얼로그
  const ConfirmDialog = () => {
    if (!showConfirmDialog || !pendingChange) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
        <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full border border-gray-600">
          <h3 className="text-lg font-bold text-white mb-4">수정 확인</h3>
          <p className="text-gray-300 mb-6">
            점검완료를 누르면 기존의 정보를 <span className="text-orange-400 font-bold">&ldquo;{pendingChange.newValue}&rdquo;</span>로 변경합니다.
          </p>
          <div className="text-sm text-gray-400 mb-6">
            <div>기존 값: <span className="text-gray-300">{pendingChange.oldValue}</span></div>
            <div>수정 값: <span className="text-orange-400">{pendingChange.newValue}</span></div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={cancelChange}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-xl font-medium transition-colors"
            >
              취소
            </button>
            <button
              onClick={confirmChange}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 모바일 알림 센터
  const MobileNotificationCenter = () => (
    <div className="fixed top-20 left-4 right-4 bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-700 z-50">
      <div className="flex justify-between items-center p-4 border-b border-gray-700">
        <span className="font-semibold text-white">알림</span>
        <button 
          onClick={() => setShowNotifications(false)}
          className="text-gray-400 hover:text-white"
        >
          ×
        </button>
      </div>
      <div className="p-2">
        {[
          { type: 'urgent', title: '긴급 점검 필요', message: '서울시청 1층 AED 패드 만료', time: '5분 전' },
          { type: 'success', title: '점검 완료', message: '김점검님이 3건의 점검을 완료했습니다', time: '15분 전' },
          { type: 'info', title: '시스템 알림', message: '월간 보고서가 생성되었습니다', time: '1시간 전' }
        ].map((notification, index) => (
          <div key={index} className="p-3 hover:bg-gray-700/50 rounded-xl cursor-pointer">
            <div className={`font-semibold text-sm ${
              notification.type === 'urgent' ? 'text-red-400' :
              notification.type === 'success' ? 'text-green-400' : 'text-blue-400'
            }`}>
              {notification.title}
            </div>
            <div className="text-gray-300 text-sm mt-1">{notification.message}</div>
            <div className="text-gray-500 text-xs mt-1">{notification.time}</div>
          </div>
        ))}
        
        {/* 개발자 테스트 섹션 */}
        <div className="border-t border-gray-700 p-3">
          <div className="text-xs text-gray-400 mb-2">개발자 테스트 기능</div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setIsOnline(!isOnline)}
              className={`text-xs px-2 py-1 rounded ${
                isOnline ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
              }`}
            >
              {isOnline ? '온라인' : '오프라인'}
            </button>
            <button
              onClick={saveOfflineData}
              className="text-xs px-2 py-1 rounded bg-orange-600 text-white"
            >
              오프라인 저장
            </button>
            {isOnline && offlineDataCount > 0 && (
              <button
                onClick={simulateSync}
                className="text-xs px-2 py-1 rounded bg-blue-600 text-white"
              >
                수동 동기화
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // 점검 모달
  const InspectionModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-800 p-6 border-b border-gray-700 z-10">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-green-400">AED 점검 화면</h2>
              <button
                type="button"
                onClick={() => setIsGuidelineOpen(true)}
                className="inline-flex items-center gap-2 rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-500"
              >
                지침보기
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowInspectionModal(false);
                  setShowValidationWarnings(false);
                }}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
              >
                목록
              </button>
              <button
                onClick={saveInspection}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
              >
                저장
              </button>
            </div>
          </div>
          
          {/* 진행률 표시 - ProgressTracker 컴포넌트 사용 */}
          <ProgressTracker
            completed={completedItems.size}
            total={totalInspectionItems}
            className="mb-4"
          />
        </div>
        
        <div className="p-6">
        {selectedDevice && (
          <div className="space-y-6">
            {showValidationWarnings && (
              <DataValidationWarnings
                device={mapAEDDeviceToRealData(selectedDevice)}
                onClose={() => setShowValidationWarnings(false)}
              />
            )}

            {/* 점검 요약 정보 - PC용 상세 버전 */}
            <div className="bg-gradient-to-r from-red-900/20 to-orange-900/20 border border-red-600/30 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  점검 전 확인사항
                </h3>
                <button
                  className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-gray-300"
                  onClick={() => {
                    const summaryDetails = document.getElementById('summary-details-pc');
                    if (summaryDetails) {
                      summaryDetails.classList.toggle('hidden');
                    }
                  }}
                >
                  상세보기
                </button>
              </div>
              
              {/* 간략 요약 */}
              <div className="flex flex-wrap gap-2 mb-4">
                {(() => {
                  const alerts = [];
                  const batteryDate = new Date(selectedDevice.batteryExpiry);
                  const padDate = new Date(selectedDevice.padExpiry);
                  const today = new Date();
                  const batteryDays = Math.ceil((batteryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  const padDays = Math.ceil((padDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  
                  if (batteryDays <= 30) {
                    alerts.push(
                      <span key="battery" className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-900/50 text-red-300 border border-red-600/30">
                        배터리 {batteryDays <= 0 ? '만료' : `${batteryDays}일`}
                      </span>
                    );
                  }
                  if (padDays <= 30) {
                    alerts.push(
                      <span key="pad" className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-900/50 text-orange-300 border border-orange-600/30">
                        패드 {padDays <= 0 ? '만료' : `${padDays}일`}
                      </span>
                    );
                  }
                  
                  const lastCheckDate = new Date(selectedDevice.lastCheck);
                  const daysSinceCheck = Math.ceil((today.getTime() - lastCheckDate.getTime()) / (1000 * 60 * 60 * 24));
                  if (daysSinceCheck > 90) {
                    alerts.push(
                      <span key="check" className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-900/50 text-yellow-300 border border-yellow-600/30">
                        {daysSinceCheck}일 미점검
                      </span>
                    );
                  }
                  
                  if (alerts.length === 0) {
                    alerts.push(
                      <span key="ok" className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-900/50 text-green-300 border border-green-600/30">
                        정상 상태
                      </span>
                    );
                  }
                  
                  return alerts;
                })()}
              </div>
              
              {/* 상세 정보 */}
              <div id="summary-details-pc" className="grid grid-cols-2 gap-6 pt-4 border-t border-gray-700">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-300">교체 예정일</h4>
                  <div className="text-white">
                    {(() => {
                      const mfgDate = new Date((selectedDevice.manufacturingDate || '2024-01') + '-01');
                      mfgDate.setFullYear(mfgDate.getFullYear() + 10);
                      const year = mfgDate.getFullYear();
                      const month = String(mfgDate.getMonth() + 1).padStart(2, '0');
                      const day = String(mfgDate.getDate()).padStart(2, '0');
                      const today = new Date();
                      const monthDiff = (mfgDate.getFullYear() - today.getFullYear()) * 12 + (mfgDate.getMonth() - today.getMonth());
                      const yearLeft = Math.floor(monthDiff / 12);
                      const monthLeft = monthDiff % 12;
                      return (
                        <>
                          <div className="text-lg font-semibold">{year}-{month}-{day}</div>
                          <div className="text-sm text-gray-400">{yearLeft}년 {monthLeft}개월 남음</div>
                        </>
                      );
                    })()}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-300">점검 우선순위</h4>
                  <div className={`text-lg font-semibold ${
                    selectedDevice.priority === 'urgent' ? 'text-red-400' :
                    selectedDevice.priority === 'warning' ? 'text-yellow-400' :
                    'text-green-400'
                  }`}>
                    {selectedDevice.priority === 'urgent' ? '긴급 점검 필요' :
                     selectedDevice.priority === 'warning' ? '주의 필요' : '정상 상태'}
                  </div>
                </div>
              </div>
            </div>

            {/* 기본 정보 */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-3 text-gray-300">기본 정보</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-400">관리번호:</span> 20240915-{String(selectedDevice.id).padStart(2, '0')}</div>
                <div><span className="text-gray-400">장비연번:</span> {selectedDevice.id}</div>
                <div><span className="text-gray-400">설치기관명:</span> {selectedDevice.name}</div>
                <div><span className="text-gray-400">기관 연락처:</span> 02-1234-5678</div>
                <div className="col-span-2">
                  <span className="text-gray-400">관리책임자:</span>
                  {editingManager ? (
                    <input
                      type="text"
                      value={managerName}
                      onChange={(e) => setManagerName(e.target.value)}
                      className="ml-2 bg-gray-600 text-white px-2 py-0.5 rounded text-sm"
                      onBlur={() => setEditingManager(false)}
                      autoFocus
                    />
                  ) : (
                    <span
                      className="ml-2 text-white cursor-pointer hover:text-green-400"
                      onClick={() => setEditingManager(true)}
                    >
                      {managerName}
                    </span>
                  )}
                </div>
                <div><span className="text-gray-400">최근점검일:</span> {selectedDevice.lastCheck}</div>
                <div><span className="text-gray-400">외부표출:</span> 
                  <span className="ml-2 text-white">
                    {externalDisplay === 'Y' ? '허용' : '미허용'}
                  </span>
                </div>
              </div>
            </div>

            {/* 유효기간 확인 */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: '배터리 유효기간', value: selectedDevice.batteryExpiry, key: 'batteryExpiry' },
                { label: '패드 유효기간', value: selectedDevice.padExpiry, key: 'padExpiry' }
              ].map((item, index) => {
                const itemState = inspectionStates[item.key];
                const isEditing = itemState?.isEditing;
                const currentValue = itemState?.currentValue || item.value;
                
                // 남은 날짜 계산 - 헬퍼 함수 사용
                const { daysText, daysColor } = calculateExpiryInfo(currentValue);
                
                return (
                  <div key={index} className="bg-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">{item.label}</span>
                      {isEditing ? (
                        <input
                          type="date"
                          value={currentValue}
                          onChange={(e) => setInspectionStates(prev => ({
                            ...prev,
                            [item.key]: {...prev[item.key], currentValue: e.target.value}
                          }))}
                          className="bg-gray-600 text-white px-2 py-1 rounded text-sm border border-gray-500 focus:border-orange-400"
                        />
                      ) : (
                        <div className="text-right">
                          <span className={`${itemState?.status === 'corrected' ? 'text-orange-400' : 'text-white'} text-lg font-medium block`}>
                            {currentValue}
                          </span>
                          <span className={`text-sm ${daysColor}`}>{daysText}</span>
                        </div>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => handleEditComplete(e, item.key, currentValue)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium"
                        >
                          수정완료
                        </button>
                        <button
                          onClick={() => preserveScrollPosition(() => {
                            setInspectionStates(prev => ({
                              ...prev,
                              [item.key]: {...prev[item.key], isEditing: false, currentValue: prev[item.key]?.originalValue || item.value}
                            }));
                          })}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={(e) => handleItemConfirm(e, item.key, item.value)}
                          className={getItemButtonStyle(item.key, 'confirm').replace('flex-1', '') + ' px-4 py-2'}
                          disabled={itemState?.status === 'corrected'}
                        >
                          일치
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleItemCorrect(e, item.key, item.value)}
                          className={getItemButtonStyle(item.key, 'correct').replace('flex-1', '') + ' px-4 py-2'}
                          disabled={itemState?.status === 'confirmed'}
                        >
                          {itemState?.status === 'corrected' ? '수정됨' : '수정'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 외부표출 설정 확인 - PC 버전 */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-3">외부표출 설정</h3>
              {(() => {
                const itemKey = 'externalDisplay';
                const itemState = inspectionStates[itemKey];
                const isEditing = itemState?.isEditing;
                const currentValue = itemState?.currentValue || externalDisplay;
                
                return (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">현재 설정</span>
                      {isEditing ? (
                        <select
                          value={currentValue}
                          onChange={(e) => setInspectionStates(prev => ({
                            ...prev,
                            [itemKey]: {...prev[itemKey], currentValue: e.target.value}
                          }))}
                          className="bg-gray-600 text-white px-2 py-1 rounded text-sm border border-gray-500 focus:border-orange-400"
                        >
                          <option value="Y">허용</option>
                          <option value="N">미허용</option>
                        </select>
                      ) : (
                        <span className={`${itemState?.status === 'corrected' ? 'text-orange-400' : 'text-white'} text-lg font-medium`}>
                          {currentValue === 'Y' ? '허용' : '미허용'}
                        </span>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => handleEditComplete(e, itemKey, currentValue)}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium"
                        >
                          수정완료
                        </button>
                        <button
                          onClick={() => preserveScrollPosition(() => {
                            setInspectionStates(prev => ({
                              ...prev,
                              [itemKey]: {...prev[itemKey], isEditing: false, currentValue: prev[itemKey]?.originalValue || externalDisplay}
                            }));
                          })}
                          className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={(e) => handleItemConfirm(e, itemKey, externalDisplay)}
                          className={getItemButtonStyle(itemKey, 'confirm').replace('flex-1', '') + ' flex-1 py-2'}
                          disabled={itemState?.status === 'corrected'}
                        >
                          일치
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleItemCorrect(e, itemKey, externalDisplay)}
                          className={getItemButtonStyle(itemKey, 'correct').replace('flex-1', '') + ' flex-1 py-2'}
                          disabled={itemState?.status === 'confirmed'}
                        >
                          {itemState?.status === 'corrected' ? '수정됨' : '수정'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* 장비 정보 확인 */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-3">장비 정보 확인</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-400 text-sm">모델명</span>
                  <div className="text-white mt-1 font-medium">{selectedDevice.modelName || 'CU-SP1'}</div>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">제조사</span>
                  <div className="text-white mt-1 font-medium">{selectedDevice.manufacturer || 'CU메디칼'}</div>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">제조번호</span>
                  <div className="text-white mt-1 font-medium">{selectedDevice.serialNumber || 'SN-2024-0001'}</div>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">제조일</span>
                  <div className="text-white mt-1 font-medium">{selectedDevice.manufacturingDate || '2024-01'}</div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded">
                  모두 일치
                </button>
                <button className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded">
                  수정 필요
                </button>
              </div>
            </div>

            {/* 설치 위치 확인 - 실제 카카오맵 사용 */}
            <KakaoMapSection
              latitude={selectedDevice?.lat ? parseFloat(selectedDevice.lat) : 37.5665}
              longitude={selectedDevice?.lng ? parseFloat(selectedDevice.lng) : 126.9780}
              address={selectedDevice?.address || selectedDevice?.location || '서울시청'}
              institution={selectedDevice?.name || 'AED 설치 위치'}
              onLocationUpdate={(lat, lng) => {
                console.log('위치 업데이트:', lat, lng);
                showAlert(`위치가 업데이트되었습니다\n${lat.toFixed(6)}, ${lng.toFixed(6)}`);
              }}
            />

            {/* 사진 첨부 */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-3">사진 기록</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="border-2 border-dashed border-gray-500 rounded-lg p-4 text-center hover:border-green-400 cursor-pointer">
                  <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-xs text-gray-400">기기 전면 (필수)</span>
                </div>
                <div className="border-2 border-dashed border-gray-500 rounded-lg p-4 text-center hover:border-green-400 cursor-pointer">
                  <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-xs text-gray-400">제조번호</span>
                </div>
                <div className="border-2 border-dashed border-gray-500 rounded-lg p-4 text-center hover:border-gray-600 cursor-pointer">
                  <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-xs text-gray-400">추가 사진</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">클릭하여 사진 업로드 또는 드래그 앤 드롭</p>
            </div>

            {/* 위치 정보 확인 - 기존 코드 유지 */}
            <div className="space-y-4" style={{display: 'none'}}>
              {[
                { label: '더미', value: '', key: 'dummy', type: 'text' }
              ].map((item, index) => {
                const itemState = inspectionStates[item.key];
                const isEditing = itemState?.isEditing;
                const currentValue = itemState?.currentValue || item.value;
                
                return (
                  <div key={index} className="bg-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">{item.label}</span>
                      {isEditing ? (
                        <input
                          type={item.type}
                          value={currentValue}
                          onChange={(e) => setInspectionStates(prev => ({
                            ...prev,
                            [item.key]: {...prev[item.key], currentValue: e.target.value}
                          }))}
                          className="bg-gray-600 text-white px-2 py-1 rounded text-sm border border-gray-500 focus:border-orange-400 w-48"
                        />
                      ) : (
                        <span className={`${itemState?.status === 'corrected' ? 'text-orange-400' : 'text-green-400'}`}>
                          {currentValue}
                        </span>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => handleEditComplete(e, item.key, currentValue)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium"
                        >
                          수정완료
                        </button>
                        <button
                          onClick={() => preserveScrollPosition(() => {
                            setInspectionStates(prev => ({
                              ...prev,
                              [item.key]: {...prev[item.key], isEditing: false, currentValue: prev[item.key]?.originalValue || item.value}
                            }));
                          })}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={(e) => handleItemConfirm(e, item.key, item.value)}
                          className={getItemButtonStyle(item.key, 'confirm').replace('flex-1', '') + ' px-4 py-2'}
                          disabled={itemState?.status === 'corrected'}
                        >
                          일치
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleItemCorrect(e, item.key, item.value)}
                          className={getItemButtonStyle(item.key, 'correct').replace('flex-1', '') + ' px-4 py-2'}
                          disabled={itemState?.status === 'confirmed'}
                        >
                          {itemState?.status === 'corrected' ? '수정됨' : '수정'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 위치 정보 확인 */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-3">위치 정보 확인</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-300 text-sm mb-2 block">설치장소 주소 (도로명)</label>
                  <input 
                    type="text" 
                    defaultValue="서울특별시 중구 세종대로 110"
                    className="w-full bg-gray-600 text-white px-3 py-2 rounded border border-gray-500"
                  />
                </div>
                <div>
                  <label className="text-gray-300 text-sm mb-2 block">설치위치 (구체적 위치)</label>
                  <input 
                    type="text" 
                    defaultValue="1층 로비 엘리베이터 옆"
                    className="w-full bg-gray-600 text-white px-3 py-2 rounded border border-gray-500"
                  />
                </div>
              </div>
            </div>

            {/* 작동 상태 확인 */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-3">작동 상태 확인</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-gray-300 text-sm mb-2 block">운영상태</label>
                  <div className="flex gap-2">
                    {['정상', '고장', '점검중', '폐기예정', '분실'].map((status) => (
                      <button
                        key={status}
                        onClick={() => setOperationStatus(status)}
                        className={`flex-1 ${operationStatus === status ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'} text-white py-2 rounded transition-colors`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="text-gray-300 text-sm mb-2 block">배터리 상태</label>
                  <div className="flex gap-2">
                    {['정상', '교체필요', '없음'].map((status) => (
                      <button
                        key={status}
                        onClick={() => setBatteryStatus(status)}
                        className={`flex-1 ${batteryStatus === status ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'} text-white py-2 rounded transition-colors`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 접근성 확인 */}
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold">접근성 확인</h3>
                {!editingOperatingHours ? (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      preserveScrollPosition(() => {
                        setEditingOperatingHours(true);
                      });
                    }}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm"
                  >
                    수정 필요
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        preserveScrollPosition(() => {
                          setEditingOperatingHours(false);
                          showAlert('운영시간이 저장되었습니다');
                        });
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                    >
                      저장
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        preserveScrollPosition(() => {
                          setEditingOperatingHours(false);
                          // 원래 값으로 복원
                          setOperatingHours([
                            { day: '월', start: '09:00', end: '18:00' },
                            { day: '화', start: '09:00', end: '18:00' },
                            { day: '수', start: '09:00', end: '18:00' },
                            { day: '목', start: '09:00', end: '18:00' },
                            { day: '금', start: '09:00', end: '18:00' },
                            { day: '토', start: '10:00', end: '14:00' },
                            { day: '일', start: '00:00', end: '00:00' },
                            { day: '공', start: '00:00', end: '00:00' }
                          ]);
                        });
                      }}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm"
                    >
                      취소
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-gray-300 text-sm mb-2 block">운영 시간</label>

                  {/* 24시간 사용가능 버튼 */}
                  <div className="mb-3">
                    <button
                      onClick={handle24Hours}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        is24Hours
                          ? 'bg-green-600 text-white border-2 border-green-500'
                          : 'bg-gray-600 text-gray-300 border-2 border-gray-500 hover:bg-gray-500'
                      }`}
                    >
                      {is24Hours ? '✓ 24시간 사용 가능' : '24시간 사용 가능'}
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-x-3 gap-y-3 text-sm mb-4">
                    {operatingHours.map((schedule, index) => (
                      <div key={schedule.day} className="text-left">
                        <div className="text-gray-300 font-medium mb-1">{schedule.day}</div>
                        <input
                          type="text"
                          value={schedule.start === '00:00' && schedule.end === '00:00' ? '휴무' : `${schedule.start}~${schedule.end}`}
                          onChange={(e) => {
                            if (editingOperatingHours && !is24Hours) {
                              const newHours = [...operatingHours];
                              const value = e.target.value;
                              if (value === '휴무') {
                                newHours[index] = { ...schedule, start: '00:00', end: '00:00' };
                              } else {
                                const times = value.split('~');
                                if (times.length === 2) {
                                  newHours[index] = { ...schedule, start: times[0], end: times[1] };
                                }
                              }
                              setOperatingHours(newHours);
                            }
                          }}
                          disabled={!editingOperatingHours || is24Hours}
                          className={`${
                            editingOperatingHours && !is24Hours
                              ? 'bg-gray-600 border border-green-400'
                              : 'bg-gray-700'
                          } text-white px-2 py-1 rounded text-xs w-full text-left ${
                            is24Hours ? 'opacity-50' : ''
                          }`}
                          placeholder="09:00~18:00"
                        />
                      </div>
                    ))}
                  </div>

                  {/* 일요일 사용 가능주 선택 */}
                  <div className={`${isSundayOperating ? 'bg-blue-800/20 border-blue-500/30' : 'bg-gray-800/20 border-gray-600/30'} border rounded-lg p-3`}>
                    <label className={`${isSundayOperating ? 'text-blue-300' : 'text-gray-500'} text-sm mb-2 block font-medium flex items-center gap-2`}>
                      일요일 사용 가능 주
                      {!isSundayOperating && (
                        <span className="text-xs bg-red-600/20 text-red-300 px-2 py-0.5 rounded">
                          일요일 운영시간 설정 필요
                        </span>
                      )}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <label className={`flex items-center gap-1 ${!isSundayOperating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={sundayWeeks.all}
                          onChange={() => handleSundayWeeks('all')}
                          disabled={!isSundayOperating}
                          className={`rounded border-gray-400 ${!isSundayOperating ? 'cursor-not-allowed' : ''}`}
                        />
                        <span className={`text-xs ${isSundayOperating ? 'text-blue-200' : 'text-gray-500'}`}>매주</span>
                      </label>
                      {['week1', 'week2', 'week3', 'week4', 'week5'].map((week, index) => (
                        <label key={week} className={`flex items-center gap-1 ${!isSundayOperating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={sundayWeeks[week as keyof typeof sundayWeeks]}
                            onChange={() => handleSundayWeeks(week)}
                            disabled={!isSundayOperating}
                            className={`rounded border-gray-400 ${!isSundayOperating ? 'cursor-not-allowed' : ''}`}
                          />
                          <span className={`text-xs ${isSundayOperating ? 'text-blue-200' : 'text-gray-500'}`}>{index + 1}주</span>
                        </label>
                      ))}
                    </div>
                    <p className={`text-xs ${isSundayOperating ? 'text-blue-300/70' : 'text-gray-500/70'} mt-2`}>
                      {isSundayOperating
                        ? '※ 매월 일요일 중 사용 가능한 주를 선택해주세요'
                        : '※ 일요일 운영시간을 먼저 설정하면 주차 선택이 가능합니다'
                      }
                    </p>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-gray-300 text-sm mb-2 block">안내표지 설치 (다중선택 가능)</label>
                  <div className="flex flex-wrap gap-2">
                    {['출입구', '내부', '엘리베이터', '안내지도', '책자/팸플릿'].map((place) => (
                      <button
                        key={place}
                        onClick={(e) => {
                          e.currentTarget.classList.toggle('bg-green-600');
                          e.currentTarget.classList.toggle('bg-gray-600');
                        }}
                        className={`px-4 py-2 ${place === '출입구' ? 'bg-green-600' : 'bg-gray-600'} hover:opacity-80 text-white rounded transition-colors`}
                      >
                        {place}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 설치방법 */}
              <div>
                <label className="text-gray-300 text-sm mb-2 block">설치방법</label>
                <div className="flex gap-2">
                  {['벽걸이형', '스탠드형', '보관함'].map((method) => (
                    <button
                      key={method}
                      onClick={() => setInstallMethod(method)}
                      className={`flex-1 ${installMethod === method ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'} text-white py-2 rounded transition-colors`}
                    >
                      {method.replace('형', '')}
                    </button>
                  ))}
                </div>
              </div>

              {/* 보관함 상태 점검 */}
              <div>
                <StorageChecklistSection
                  storageChecklist={storageChecklist}
                  setStorageChecklist={setStorageChecklist}
                />
              </div>
            </div>

            {/* 점검 결과 기록 */}
            <div className="border-t border-gray-600 pt-4">
              <h3 className="text-lg font-bold text-yellow-400 mb-3">점검 결과 기록</h3>
            </div>

            {/* 후속조치 필요여부 */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-3">후속조치 필요여부</h3>
              <div className="flex gap-2">
                {['이상없음', '현장권고완료', '추후권고대상'].map((action) => (
                  <button
                    key={action}
                    onClick={() => setFollowUpAction(action)}
                    className={`flex-1 py-2 rounded transition-colors ${
                      followUpAction === action
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-gray-600 hover:bg-gray-700 text-white'
                    }`}
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>

            {/* 조치사항 - "이상없음" 선택 시 숨김 */}
            {followUpAction !== '이상없음' && (
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="font-semibold mb-3">조치사항</h3>
                <textarea
                  className="w-full bg-gray-600 text-white px-3 py-2 rounded text-sm border border-gray-500 focus:border-green-400 h-24"
                  placeholder="상세 조치사항을 입력하세요 (500자 이내)"
                  maxLength={500}
                />
              </div>
            )}
            
            {/* 점검 완료 버튼 - 최하단 이동 */}
            <div className="mt-6">
              <button
                onClick={saveInspection}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium text-lg"
              >
                점검 완료
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );

  // 알림 센터
  interface Notification {
    id: number;
    type: string;
    title: string;
    message: string;
    time: string;
    location?: string;
    priority: string;
  }
  
  const NotificationCenter = () => {
    const [filter, setFilter] = useState('all');
    const notifications: Notification[] = [
      { id: 1, type: 'urgent', title: '긴급 점검 필요', message: '서울시청 1층 AED 패드 만료 임박 (D-3)', time: '5분 전', location: '서울시청', priority: 'high' },
      { id: 2, type: 'urgent', title: '배터리 교체 필요', message: '강남구청 2층 AED 배터리 유효기간 만료 임박 (D-7)', time: '10분 전', location: '강남구청', priority: 'high' },
      { id: 3, type: 'schedule', title: '오늘 점검 일정', message: '오늘 15건의 점검이 예정되어 있습니다', time: '30분 전', priority: 'medium' },
      { id: 4, type: 'success', title: '점검 완료', message: '김점검님이 3건의 점검을 완료했습니다', time: '1시간 전', priority: 'low' },
      { id: 5, type: 'team', title: '팀 메시지', message: '박점검님: 서울역 구역 점검 지원 요청', time: '2시간 전', priority: 'medium' },
      { id: 6, type: 'info', title: '시스템 알림', message: '월간 보고서가 생성되었습니다', time: '3시간 전', priority: 'low' },
      { id: 7, type: 'reminder', title: '일정 리마인더', message: '내일 오전 9시 정기 회의가 있습니다', time: '어제', priority: 'low' }
    ];

    const filteredNotifications = filter === 'all' ? notifications : notifications.filter((n) => n.type === filter);

    return (
      <div className="fixed top-16 right-4 w-96 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-50 max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <span className="font-semibold">알림</span>
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
              {notifications.filter((n) => n.priority === 'high').length}
            </span>
          </div>
          <button 
            onClick={() => setShowNotifications(false)}
            className="text-gray-400 hover:text-white text-xl"
          >
            ×
          </button>
        </div>
        
        {/* 필터 탭 */}
        <div className="flex gap-1 p-2 border-b border-gray-700">
          {[
            { value: 'all', label: '전체', count: notifications.length },
            { value: 'urgent', label: '긴급', count: notifications.filter((n) => n.type === 'urgent').length },
            { value: 'schedule', label: '일정', count: notifications.filter((n) => n.type === 'schedule').length },
            { value: 'team', label: '팀', count: notifications.filter((n) => n.type === 'team').length }
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`flex-1 px-2 py-1 rounded text-sm ${
                filter === tab.value ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {filteredNotifications.map((notification) => (
            <div key={notification.id} className="p-3 hover:bg-gray-700 rounded cursor-pointer mb-1 transition-colors">
              <div className="flex items-start gap-3">
                <div className={`mt-1 ${
                  notification.type === 'urgent' ? 'text-red-400' :
                  notification.type === 'schedule' ? 'text-purple-400' :
                  notification.type === 'team' ? 'text-yellow-400' :
                  notification.type === 'success' ? 'text-green-400' : 
                  notification.type === 'reminder' ? 'text-orange-400' : 'text-blue-400'
                }`}>
                  {notification.type === 'urgent' && (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                    </svg>
                  )}
                  {notification.type === 'schedule' && (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
                    </svg>
                  )}
                  {notification.type === 'team' && (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  )}
                  {notification.type === 'success' && (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <div className={`font-semibold text-sm ${
                    notification.type === 'urgent' ? 'text-red-400' :
                    notification.type === 'schedule' ? 'text-purple-400' :
                    notification.type === 'team' ? 'text-yellow-400' :
                    notification.type === 'success' ? 'text-green-400' : 
                    notification.type === 'reminder' ? 'text-orange-400' : 'text-blue-400'
                  }`}>
                    {notification.title}
                  </div>
                  <div className="text-gray-300 text-sm mt-1">{notification.message}</div>
                  {notification.location && (
                    <div className="text-gray-400 text-xs mt-1 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                      </svg>
                      {notification.location}
                    </div>
                  )}
                  <div className="text-gray-500 text-xs mt-1">{notification.time}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="p-2 border-t border-gray-700">
          <button className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-sm">
            모든 알림 읽음 처리
          </button>
        </div>

        {/* 개발자 테스트 섹션 */}
        <div className="border-t border-gray-700 p-3">
          <div className="text-xs text-gray-400 mb-2">개발자 테스트 기능</div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setIsOnline(!isOnline)}
              className={`text-xs px-2 py-1 rounded ${
                isOnline ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
              }`}
            >
              {isOnline ? '온라인' : '오프라인'}
            </button>
            <button
              onClick={saveOfflineData}
              className="text-xs px-2 py-1 rounded bg-orange-600 text-white"
            >
              오프라인 저장
            </button>
            {isOnline && offlineDataCount > 0 && (
              <button
                onClick={simulateSync}
                className="text-xs px-2 py-1 rounded bg-blue-600 text-white"
              >
                수동 동기화
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // 튜토리얼 오버레이
  const TutorialOverlay = () => (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">튜토리얼</h2>
        <div className="mb-4">
          <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-300" 
              style={{width: `${(tutorialStep / 5) * 100}%`}}
            ></div>
          </div>
          <p className="text-sm text-gray-400">단계 {tutorialStep}/5</p>
        </div>
        <div className="mb-6">
          {tutorialStep === 1 && (
            <div>
              <h3 className="font-semibold mb-2">환영합니다!</h3>
              <p className="text-gray-300">AED 점검 관리 시스템 튜토리얼을 시작합니다.</p>
            </div>
          )}
          {tutorialStep === 2 && (
            <div>
              <h3 className="font-semibold mb-2">점검 목록</h3>
              <p className="text-gray-300">좌측 사이드바에서 점검 관리 메뉴를 확인할 수 있습니다.</p>
            </div>
          )}
          {tutorialStep === 3 && (
            <div>
              <h3 className="font-semibold mb-2">점검 시작</h3>
              <p className="text-gray-300">점검시작 버튼을 클릭하여 AED 점검을 수행할 수 있습니다.</p>
            </div>
          )}
          {tutorialStep === 4 && (
            <div>
              <h3 className="font-semibold mb-2">길안내</h3>
              <p className="text-gray-300">길안내 버튼으로 목적지까지 내비게이션을 실행할 수 있습니다.</p>
            </div>
          )}
          {tutorialStep === 5 && (
            <div>
              <h3 className="font-semibold mb-2">완료!</h3>
              <p className="text-gray-300">튜토리얼이 완료되었습니다. 이제 시스템을 사용해보세요!</p>
            </div>
          )}
        </div>
        <div className="flex justify-between">
          <button
            onClick={() => setShowTutorial(false)}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
          >
            건너뛰기
          </button>
          {tutorialStep < 5 ? (
            <button
              onClick={() => setTutorialStep(tutorialStep + 1)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
            >
              다음
            </button>
          ) : (
            <button
              onClick={() => setShowTutorial(false)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
            >
              완료
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // 오프라인 상태 배너 컴포넌트
  const OfflineStatusBanner = () => {
    if (isOnline && syncStatus === 'synced') return null;

    return (
      <div className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-sm font-medium text-center transition-colors ${
        !isOnline 
          ? 'bg-red-500 text-white' 
          : syncStatus === 'syncing' 
            ? 'bg-yellow-500 text-black' 
            : 'bg-blue-500 text-white'
      }`}>
        {!isOnline && (
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            오프라인 모드 - {offlineDataCount}개 데이터 저장됨
          </div>
        )}
        {isOnline && syncStatus === 'syncing' && (
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-black rounded-full animate-spin" />
            동기화 중... ({syncProgress}%)
          </div>
        )}
      </div>
    );
  };

  // 동기화 진행률 표시 컴포넌트
  const SyncProgressBar = () => {
    if (!showSyncProgress) return null;

    return (
      <div className="fixed top-10 left-4 right-4 z-40 bg-white rounded-lg shadow-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">데이터 동기화</span>
          <span className="text-sm text-gray-600">{syncProgress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-green-500 h-2 rounded-full transition-all duration-200"
            style={{ width: `${syncProgress}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="relative">
      <OfflineStatusBanner />
      <SyncProgressBar />
      <div className={!isOnline || syncStatus !== 'synced' ? 'mt-10' : ''}>
        {deviceType === 'desktop' ? <DesktopLayout /> : <MobileLayout />}
      </div>
      <GuidelineViewerModal
        open={isGuidelineOpen}
        onClose={() => setIsGuidelineOpen(false)}
      />
    </div>
  );
});

Tutorial2Page.displayName = 'Tutorial2Page';

export default Tutorial2Page;
