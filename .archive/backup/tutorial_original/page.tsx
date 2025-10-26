'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';


// 인터페이스 정의
interface AEDDevice {
  id: string;
  name: string;
  location: string;
  batteryExpiry: string;
  padExpiry: string;
  deviceExpiry: string;
  priority: 'urgent' | 'warning' | 'normal';
  distance: string;
  lastCheck: string;
  lat: string;
  lng: string;
  // 기존 추가 필드
  installationOrg: string;    // 설치기관명
  installationLocation: string; // 설치장소 위치
  modelName: string;          // 모델명
  manufacturer?: string;      // 제조사
  manufacturingDate: string;  // 제조년월
  serialNumber: string;       // 제조번호
  // 새로 추가되는 필드 (인트라넷 스키마 43개 중 누락)
  founder?: string;           // 개설자
  initialInstallDate?: string; // 최초설치일
  installDate: string;        // 설치일자
  registrationDate?: string;  // 등록일자
  saolDeleted?: boolean;      // 새올 삭제여부
  displayAllowed?: boolean;   // 표출허용여부
  externalDisplay?: boolean;  // 외부표출여부
  externalNoDisplayReason?: string; // 외부미표출사유
  governmentSupported?: boolean; // 국고지원여부
  category1?: string;         // 분류 1 (대분류)
  category2?: string;         // 분류 2 (중분류)
  category3?: string;         // 분류 3 (소분류)
  purchaseOrg?: string;       // 구매기관
  replacementDate?: string;   // 교체 예정일 (자동 계산)
  patchAvailable?: boolean;   // 패치 유/무
  patchExpiry?: string;       // 패치 유효기간
}

interface TeamMember {
  name: string;
  type: 'permanent' | 'temporary' | 'volunteer';
  department: string;
  quota: number;
  completed: number;
  email?: string;
}

// 점검 항목 상태 인터페이스
interface InspectionItemState {
  status: 'pending' | 'confirmed' | 'corrected';
  isEditing: boolean;
  originalValue: string;
  currentValue: string;
  hasIssue: boolean;
}

type InspectionStates = {
  [key: string]: InspectionItemState;
};

export default function TutorialPage() {
  const [currentPage, setCurrentPage] = useState('inspection');
  const [deviceType, setDeviceType] = useState<'mobile' | 'desktop'>('mobile');
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [searchMode, setSearchMode] = useState('priority');
  const [userRole, setUserRole] = useState('local');
  const [selectedDevice, setSelectedDevice] = useState<AEDDevice | null>(null);
  const [tutorialStep, setTutorialStep] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [editingManager, setEditingManager] = useState(false);
  const [managerName, setManagerName] = useState('홍길동');
  const [externalDisplay, setExternalDisplay] = useState('Y');
  const [inspectionStates, setInspectionStates] = useState<InspectionStates>({});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingChange, setPendingChange] = useState<{itemKey: string, oldValue: string, newValue: string} | null>(null);
  const [editingEquipment, setEditingEquipment] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [equipmentData, setEquipmentData] = useState({
    modelName: '',
    manufacturer: '',
    serialNumber: '',
    installDate: '',
    manufacturingDate: ''
  });
  const [locationData, setLocationData] = useState({
    address: '',
    specificLocation: ''
  });
  const [isDraggingPin, setIsDraggingPin] = useState(false);
  const [pinPosition, setPinPosition] = useState({ x: 50, y: 50 }); // percentage position
  const mapRef = useRef<HTMLDivElement>(null);
  
  // 진행률 관리 상태
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [totalInspectionItems] = useState(20); // 총 점검 항목 수
  
  // 도움말 툴팁 상태
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [hoverTimer, setHoverTimer] = useState<NodeJS.Timeout | null>(null);
  
  // 입력 검증 상태
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  
  // 툴팁 타이머 클리어 함수
  const clearHoverTimer = useCallback(() => {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      setHoverTimer(null);
    }
  }, [hoverTimer]);
  
  // 툴팁 컨텐츠 가져오기
  const getTooltipContent = (itemKey: string): string => {
    const tooltips: {[key: string]: string} = {
      'batteryExpiry': '배터리 제조일자만 표기된 경우 제조사 권고 확인필요, 보통 제조일로 부터 2~5년',
      'padExpiry': '패드의 Exp. date를 확인하세요.',
      'externalDisplay': '외부 지도 서비스에 AED 위치를 표시할지 설정합니다.',
      'operationStatus': 'AED의 현재 작동 상태를 확인합니다.',
      'batteryStatus': '전원을 켜 정상작동 하는지? 배터리가 부족하다는 멘트가 나오는지? LED 표시등을 확인하세요.',
      'installMethod': 'AED가 설치된 방식을 확인합니다.',
      'storageStatus': '보관함의 상태를 확인합니다. 파손이나 잘김이 없는지 확인하세요.',
      'operatingHours': 'AED에 접근 가능한 시간을 관리책임자를 통해 확인해주세요.',
      'signageLocation': '안내 표지가 설치된 위치를 확인합니다.'
    };
    return tooltips[itemKey] || '이 항목을 정확히 확인해주세요.';
  };
  
  // 툴팁 표시 함수
  const showTooltip = useCallback((itemKey: string, message: string) => {
    clearHoverTimer();
    setActiveTooltip(`${itemKey}:${message}`);
    const timer = setTimeout(() => {
      setActiveTooltip(null);
    }, 5000);
    setHoverTimer(timer);
  }, [clearHoverTimer]);
  
  // 아이템 hover 핸들러
  const handleItemHover = useCallback((itemKey: string) => {
    if (hoveredItem !== itemKey) {
      setHoveredItem(itemKey);
      clearHoverTimer();
      const timer = setTimeout(() => {
        showTooltip(itemKey, getTooltipContent(itemKey));
      }, 3000);
      setHoverTimer(timer);
    }
  }, [hoveredItem, clearHoverTimer, showTooltip]);
  
  // 진행률 계산
  const calculateProgress = useCallback(() => {
    return Math.round((completedItems.size / totalInspectionItems) * 100);
  }, [completedItems, totalInspectionItems]);
  
  // 항목 완료 처리
  const markItemComplete = useCallback((itemKey: string) => {
    setCompletedItems(prev => {
      const newSet = new Set(prev);
      newSet.add(itemKey);
      return newSet;
    });
  }, []);
  
  // 실시간 입력 검증
  const validateInput = useCallback((itemKey: string, value: string, type: string) => {
    let error = '';
    
    if (type === 'date') {
      const date = new Date(value);
      const today = new Date();
      if (date < today) {
        error = '유효기간이 이미 지났습니다.';
      }
    } else if (type === 'tel') {
      const phoneRegex = /^[0-9]{2,3}-[0-9]{3,4}-[0-9]{4}$/;
      if (!phoneRegex.test(value)) {
        error = '올바른 전화번호 형식이 아닙니다. (예: 02-1234-5678)';
      }
    }
    
    setValidationErrors(prev => ({
      ...prev,
      [itemKey]: error
    }));
    
    return error === '';
  }, []);
  
  // 추가 상태 변수들
  const [equipmentConfirmed, setEquipmentConfirmed] = useState(false);
  const [operationStatus, setOperationStatus] = useState('정상');
  const [batteryStatus, setBatteryStatus] = useState('정상');
  const [installMethod, setInstallMethod] = useState('벽걸이형');
  const [storageStatus, setStorageStatus] = useState('양호');
  const [desktopPinPosition, setDesktopPinPosition] = useState({ x: 397, y: 85 });
  const [isDraggingDesktopPin, setIsDraggingDesktopPin] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const [editingOperatingHours, setEditingOperatingHours] = useState(false);
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
  
  // 스크롤 위치 저장을 위한 ref
  const scrollPositionRef = useRef<number>(0);
  const router = useRouter();

  // 샘플 데이터
  const devices: AEDDevice[] = useMemo(() => [
    {
      id: '13-0000042',
      name: '서울시청 본관',
      location: '1층 로비',
      batteryExpiry: '2025-01-15',
      padExpiry: '2025-03-20',
      deviceExpiry: '2027-12-31',
      priority: 'urgent',
      distance: '1.2km',
      lastCheck: '2024-12-01',
      lat: '37.5662952',
      lng: '126.9779451',
      installationOrg: '서울특별시',
      installationLocation: '서울시청 본관 1층 로비 입구',
      modelName: 'HeartSine samaritan PAD 350P',
      manufacturingDate: '2022-03',
      serialNumber: 'HS22030042',
      installDate: '2022-05-10'
    },
    {
      id: '13-0000156',
      name: '강남구청',
      location: '2층 민원실',
      batteryExpiry: '2025-06-10',
      padExpiry: '2025-04-15',
      deviceExpiry: '2028-05-20',
      priority: 'warning',
      distance: '3.5km',
      lastCheck: '2024-12-15',
      lat: '37.5172363',
      lng: '127.0473248',
      installationOrg: '서울특별시 강남구',
      installationLocation: '강남구청 2층 민원실 대기공간',
      modelName: 'Philips HeartStart FRx',
      manufacturingDate: '2021-11',
      serialNumber: 'PH21110156',
      installDate: '2021-12-20'
    },
    {
      id: '13-0000234',
      name: '서초구 보건소',
      location: '1층 대기실',
      batteryExpiry: '2025-09-30',
      padExpiry: '2025-07-10',
      deviceExpiry: '2028-12-31',
      priority: 'normal',
      distance: '5.2km',
      lastCheck: '2024-12-20',
      lat: '37.4837121',
      lng: '127.0324112',
      installationOrg: '서울특별시 서초구 보건소',
      installationLocation: '서초구 보건소 1층 대기실 벽면',
      modelName: 'ZOLL AED Plus',
      manufacturingDate: '2023-01',
      serialNumber: 'ZL23010234',
      installDate: '2023-03-15'
    }
  ], []);


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

  // 팀원 데이터
  const teamMembers: TeamMember[] = useMemo(() => [
    { name: '김철수', type: 'permanent', department: '보건행정과', quota: 45, completed: 38, email: 'kim@korea.kr' },
    { name: '이영희', type: 'permanent', department: '응급의료팀', quota: 52, completed: 41, email: 'lee@korea.kr' },
    { name: '박민수', type: 'permanent', department: '보건행정과', quota: 38, completed: 32, email: 'park@korea.kr' },
    { name: '최지원', type: 'temporary', department: '응급의료팀', quota: 30, completed: 25, email: 'choi@gmail.com' },
    { name: '정하나', type: 'permanent', department: '의약무관리팀', quota: 41, completed: 35, email: 'jung@korea.kr' },
    { name: '강민지', type: 'temporary', department: '보건행정과', quota: 28, completed: 20, email: 'kang@naver.com' },
    { name: '윤서준', type: 'permanent', department: '응급의료팀', quota: 47, completed: 42, email: 'yoon@korea.kr' },
    { name: '임도현', type: 'volunteer', department: '보건행정과', quota: 15, completed: 12, email: 'lim@hanmail.net' },
    { name: '한소희', type: 'permanent', department: '의약무관리팀', quota: 43, completed: 38, email: 'han@korea.kr' },
    { name: '조민호', type: 'temporary', department: '응급의료팀', quota: 25, completed: 18, email: 'cho@daum.net' },
    { name: '신지훈', type: 'permanent', department: '보건행정과', quota: 39, completed: 34, email: 'shin@korea.kr' },
    { name: '김나연', type: 'permanent', department: '응급의료팀', quota: 44, completed: 40, email: 'kimn@korea.kr' }
  ], []);

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
    setSelectedDevice(device || null);
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
    setInspectionStates({});
    
    // 진동 피드백
    if ('vibrate' in navigator) {
      navigator.vibrate(100);
    }
  };

  // 스크롤 위치 보존 헬퍼 함수 (개선된 버전)
  const preserveScrollPosition = useCallback((callback: () => void) => {
    // 스크롤 가능한 컨테이너 찾기 (더 정확한 선택자 사용)
    const scrollContainers = [
      document.querySelector('[data-scroll-container="true"]'), // 명시적 마킹
      document.querySelector('.overflow-y-auto'), // 일반적인 스크롤 컨테이너
      document.querySelector('[style*="overflow-y: auto"]'), // 인라인 스타일
      document.querySelector('[style*="overflow: auto"]'),
      document.querySelector('.max-h-\\[80vh\\]'), // 모바일
      document.querySelector('.max-h-\\[70vh\\]'), // 데스크톱
    ].filter(Boolean);
    
    const scrollableContainer = scrollContainers[0] as HTMLElement;
    
    if (scrollableContainer) {
      // 현재 스크롤 위치 저장
      scrollPositionRef.current = scrollableContainer.scrollTop;
      
      callback();
      
      // 상태 업데이트 후 스크롤 위치 복원
      const restoreScroll = () => {
        if (scrollableContainer) {
          scrollableContainer.scrollTop = scrollPositionRef.current;
        }
      };
      
      // 여러 단계로 스크롤 위치 복원 시도
      requestAnimationFrame(restoreScroll);
      setTimeout(restoreScroll, 0);
      setTimeout(restoreScroll, 10);
      setTimeout(restoreScroll, 50);
    } else {
      // 스크롤 컨테이너를 찾을 수 없으면 그냥 콜백 실행
      callback();
    }
  }, []);

  // 성능 최적화: 긴급/경고 장치 필터링 메모화
  const urgentWarningDevices = useMemo(() => {
    return devices.filter(d => d.priority === 'urgent' || d.priority === 'warning');
  }, [devices]);

  // 점검 항목 버튼 핸들러
  const handleItemConfirm = (itemKey: string, originalValue: string) => {
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

  const handleItemCorrect = (itemKey: string, originalValue: string) => {
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

  const handleEditComplete = (itemKey: string, newValue: string) => {
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

  const getPriorityBadge = useCallback((priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500 text-white px-2 py-1 rounded text-xs';
      case 'warning':
        return 'bg-yellow-500 text-white px-2 py-1 rounded text-xs';
      default:
        return 'bg-green-500 text-white px-2 py-1 rounded text-xs';
    }
  }, []);

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
          <div className="text-xl font-bold text-green-400">AED 스마트 점검 시스템</div>
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
              { id: 'inspection', label: '점검 관리', roles: ['local', 'regional', 'central', 'emergency'] },
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
              onClick={() => setCurrentPage(item.id)}
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
          {currentPage === 'inspection' && <InspectionPage />}
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
            className="text-gray-400 hover:text-white"
          >
            ← 홈으로
          </button>
          <h1 className="text-lg font-bold text-green-400">AED Smart Check</h1>
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
            { id: 'inspection', label: '점검' },
            { id: 'dashboard', label: '대시보드' },
            { id: 'devices', label: '장비' },
            { id: 'team', label: '팀협업' },
            { id: 'reports', label: '보고서' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">점검 관리</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              고급 검색
            </button>
            {savedSearches.length > 0 && (
              <select 
                className="bg-gray-700 text-white px-3 py-2 rounded"
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
                  placeholder="일 이상 경과"
                  value={filters.lastCheckDays}
                  onChange={(e) => setFilters({...filters, lastCheckDays: e.target.value})}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
                />
              </div>
              
              <div className="flex items-end gap-2">
                <button 
                  onClick={() => {
                    // 검색 실행
                    console.log('필터 적용:', filters);
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm"
                >
                  검색
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
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">우선순위</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">배터리</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">패드</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">최근점검</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">거리</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">작업</th>
            </tr>
          </thead>
          <tbody>
            {devices.map(device => (
              <tr key={device.id} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="px-4 py-3">
                  <div>
                    <div className="font-semibold text-white">{device.name}</div>
                    <div className="text-sm text-gray-400">{device.location}</div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-white">{device.id}</td>
                <td className="px-4 py-3">
                  <span className={getPriorityBadge(device.priority)}>
                    {getPriorityText(device.priority)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-white">{device.batteryExpiry}</td>
                <td className="px-4 py-3 text-sm text-white">{device.padExpiry}</td>
                <td className="px-4 py-3 text-sm text-white">{device.lastCheck}</td>
                <td className="px-4 py-3 text-sm text-white">{device.distance}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => startInspection(device.id)}
                      className="bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded text-sm transition-colors"
                    >
                      점검시작
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
              실시간 업데이트: {new Date().toLocaleTimeString()}
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
        
        {/* 실시간 차트 영역 */}
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
    // const [selectedDates, setSelectedDates] = useState<string[]>([]);
    const [excludedDates, setExcludedDates] = useState<string[]>(['2025-01-01', '2025-01-25', '2025-01-26']);
    const [distributionMode, setDistributionMode] = useState('auto');
    const [dailyTarget, setDailyTarget] = useState(15);
    const [showPriorityCalculation, setShowPriorityCalculation] = useState(false);
    
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">우선순위 관리</h1>
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
            { id: 'expiry', label: '유효기간별' },
            { id: 'inspection', label: '점검순서' },
            { id: 'mandatory', label: '구비의무기관' },
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

        {/* 유효기간별 탭 */}
        {activeTab === 'expiry' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-red-400 font-semibold mb-3">긴급 (유효기간 30일 이내)</h3>
              <div className="space-y-2">
                {[
                  { name: '서울시청 본관 1층', battery: '2025-01-20', pad: '2025-01-25', distance: '1.2km' },
                  { name: '강남구청 민원실', battery: '2025-01-28', pad: '2025-02-10', distance: '2.5km' },
                  { name: '서울역 대합실', battery: '2025-02-05', pad: '2025-01-30', distance: '3.1km' }
                ].map((item, idx) => (
                  <div key={idx} className="bg-gray-700 p-3 rounded">
                    <div className="font-medium text-white mb-1">{item.name}</div>
                    <div className="text-xs text-gray-400">
                      <div>배터리: {item.battery}</div>
                      <div>패드: {item.pad}</div>
                      <div>거리: {item.distance}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-yellow-400 font-semibold mb-3">경고 (31-60일)</h3>
              <div className="space-y-2">
                {[
                  { name: '강남세브란스병원', battery: '2025-02-15', pad: '2025-02-20', distance: '4.2km' },
                  { name: '삼성서울병원', battery: '2025-02-25', pad: '2025-03-01', distance: '5.8km' },
                  { name: '한국무역센터', battery: '2025-03-10', pad: '2025-02-28', distance: '6.3km' }
                ].map((item, idx) => (
                  <div key={idx} className="bg-gray-700 p-3 rounded">
                    <div className="font-medium text-white mb-1">{item.name}</div>
                    <div className="text-xs text-gray-400">
                      <div>배터리: {item.battery}</div>
                      <div>패드: {item.pad}</div>
                      <div>거리: {item.distance}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-green-400 font-semibold mb-3">정상 (61일 이상)</h3>
              <div className="space-y-2">
                {[
                  { name: '국회의사당', battery: '2025-05-20', pad: '2025-06-15', distance: '7.1km' },
                  { name: '서울대학교', battery: '2025-07-10', pad: '2025-08-20', distance: '8.5km' },
                  { name: '올림픽공원', battery: '2025-09-01', pad: '2025-10-30', distance: '9.2km' }
                ].map((item, idx) => (
                  <div key={idx} className="bg-gray-700 p-3 rounded">
                    <div className="font-medium text-white mb-1">{item.name}</div>
                    <div className="text-xs text-gray-400">
                      <div>배터리: {item.battery}</div>
                      <div>패드: {item.pad}</div>
                      <div>거리: {item.distance}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 점검순서 탭 */}
        {activeTab === 'inspection' && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">최근 점검 오래된 순</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2">순위</th>
                    <th className="text-left py-2">기관명</th>
                    <th className="text-left py-2">위치</th>
                    <th className="text-left py-2">마지막 점검일</th>
                    <th className="text-left py-2">경과일</th>
                    <th className="text-left py-2">상태</th>
                    <th className="text-left py-2">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { rank: 1, name: '서울특별시청', location: '시청역 8번출구', lastCheck: '2024-06-15', days: 210, status: 'critical' },
                    { rank: 2, name: '강남구청', location: '강남구청역 2번출구', lastCheck: '2024-07-20', days: 175, status: 'warning' },
                    { rank: 3, name: '서울대학교병원', location: '혼다역 3번출구', lastCheck: '2024-08-10', days: 154, status: 'warning' },
                    { rank: 4, name: '코엑스', location: '삼성역 5번출구', lastCheck: '2024-09-05', days: 128, status: 'normal' },
                    { rank: 5, name: '롯데월드타워', location: '잠실역 4번출구', lastCheck: '2024-09-25', days: 108, status: 'normal' }
                  ].map((item) => (
                    <tr key={item.rank} className="border-b border-gray-700">
                      <td className="py-2">{item.rank}</td>
                      <td className="py-2">{item.name}</td>
                      <td className="py-2 text-sm text-gray-400">{item.location}</td>
                      <td className="py-2">{item.lastCheck}</td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          item.status === 'critical' ? 'bg-red-600' :
                          item.status === 'warning' ? 'bg-yellow-600' :
                          'bg-green-600'
                        }`}>
                          {item.days}일
                        </span>
                      </td>
                      <td className="py-2">
                        <span className={`text-sm ${
                          item.status === 'critical' ? 'text-red-400' :
                          item.status === 'warning' ? 'text-yellow-400' :
                          'text-green-400'
                        }`}>
                          {item.status === 'critical' ? '긴급' :
                           item.status === 'warning' ? '경고' : '정상'}
                        </span>
                      </td>
                      <td className="py-2">
                        <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">
                          점검 예약
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 구비의무기관 탭 */}
        {activeTab === 'mandatory' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">기관 유형별 분포</h3>
              <div className="space-y-3">
                {[
                  { type: '의료기관', count: 45, checked: 32, percentage: 71 },
                  { type: '교육기관', count: 38, checked: 28, percentage: 74 },
                  { type: '공공기관', count: 52, checked: 45, percentage: 87 },
                  { type: '교통시설', count: 23, checked: 18, percentage: 78 },
                  { type: '체육시설', count: 15, checked: 12, percentage: 80 },
                  { type: '기타', count: 27, checked: 15, percentage: 56 }
                ].map((item) => (
                  <div key={item.type} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-white">{item.type}</span>
                        <span className="text-gray-400 text-sm">{item.checked}/{item.count}대</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full" 
                          style={{width: `${item.percentage}%`}}
                        ></div>
                      </div>
                    </div>
                    <span className="ml-3 text-sm text-gray-400">{item.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">의무 기관 상세</h3>
              <div className="space-y-2">
                {[
                  { name: '서울대학교병원', type: '의료기관', devices: 12, status: '점검완료' },
                  { name: '강남세브란스병원', type: '의료기관', devices: 8, status: '점검중' },
                  { name: '서울시청', type: '공공기관', devices: 15, status: '대기중' },
                  { name: '서울대학교', type: '교육기관', devices: 10, status: '점검완료' },
                  { name: '서울역', type: '교통시설', devices: 25, status: '대기중' }
                ].map((item, idx) => (
                  <div key={idx} className="bg-gray-700 p-3 rounded flex justify-between items-center">
                    <div>
                      <div className="font-medium text-white">{item.name}</div>
                      <div className="text-xs text-gray-400">{item.type} - {item.devices}대</div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      item.status === '점검완료' ? 'bg-green-600' :
                      item.status === '점검중' ? 'bg-yellow-600' :
                      'bg-gray-600'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                ))}
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
  const ReportsPage = () => (
    <div>
      <h1 className="text-2xl font-bold mb-6">보고서</h1>
      <div className="bg-gray-800 rounded-lg p-6">
        <p className="text-gray-400">보고서 기능이 여기에 표시됩니다.</p>
      </div>
    </div>
  );

  // 모바일 점검 페이지
  const MobileInspectionPage = () => (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-4">점검 관리</h1>
        
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

      {/* 튜토리얼 안내 */}
      <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl backdrop-blur-xl">
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
  const MobileReportsPage = () => (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">보고서</h1>
      <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/50">
        <p className="text-gray-400">보고서 기능이 여기에 표시됩니다.</p>
      </div>
    </div>
  );

  // 모바일 점검 모달
  const MobileInspectionModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
      <div className="bg-gray-900 rounded-t-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-900 p-4 border-b border-gray-700">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-bold text-green-400">{selectedDevice?.name || 'AED 점검'}</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowInspectionModal(false)}
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
          
          {/* 진행률 표시 */}
          <div className="bg-gray-800 rounded-full p-1">
            <div className="relative">
              <div className="bg-gray-700 h-2 rounded-full">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{width: `${calculateProgress()}%`}}
                />
              </div>
              <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-400">
                {completedItems.size} / {totalInspectionItems} 항목 완료 ({calculateProgress()}%)
              </span>
            </div>
          </div>
        </div>

        <div className="p-4">
          {selectedDevice && (
            <div className="space-y-4">
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
                
                {/* 기호 설명 */}
                <div className="space-y-2 mb-3">
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

              {/* 기본 정보 */}
              <div className="bg-gray-800/50 rounded-2xl p-4">
                <h3 className="font-semibold text-white mb-3">기본 정보</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">관리번호:</span>
                    <span className="text-white">AED-2024-{selectedDevice.id}</span>
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
                  <div className="flex justify-between">
                    <span className="text-gray-400">거리:</span>
                    <span className="text-white">{selectedDevice.distance}m</span>
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

              {/* 배터리/패드 유효기간 */}
              {[
                { label: '배터리 유효기간', value: selectedDevice.batteryExpiry, key: 'batteryExpiry' },
                { label: '패드 유효기간', value: selectedDevice.padExpiry, key: 'padExpiry' }
              ].map((item, index) => {
                const itemState = inspectionStates[item.key];
                const isEditing = itemState?.isEditing;
                const currentValue = itemState?.currentValue || item.value;
                
                // 남은 날짜 계산
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const expiryDate = new Date(currentValue);
                const diffTime = expiryDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const daysText = diffDays > 0 ? `${diffDays}일 남음` : diffDays === 0 ? '오늘 만료' : `${Math.abs(diffDays)}일 지남`;
                const daysColor = diffDays > 30 ? 'text-green-400' : diffDays > 0 ? 'text-yellow-400' : 'text-red-400';
                
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
                          onClick={() => handleEditComplete(item.key, currentValue)}
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
                          onClick={() => {
                            handleItemConfirm(item.key, item.value);
                            markItemComplete(item.key);
                          }}
                          className={getItemButtonStyle(item.key, 'confirm')}
                          disabled={itemState?.status === 'corrected'}
                        >
                          일치
                        </button>
                        <button 
                          onClick={() => handleItemCorrect(item.key, item.value)}
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
                          onClick={() => handleEditComplete(item.key, currentValue)}
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
                          onClick={() => {
                            handleItemConfirm(item.key, item.value);
                            markItemComplete(item.key);
                          }}
                          className={getItemButtonStyle(item.key, 'confirm')}
                          disabled={itemState?.status === 'corrected'}
                        >
                          일치
                        </button>
                        <button 
                          onClick={() => handleItemCorrect(item.key, item.value)}
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
                <div className="grid grid-cols-2 gap-3">
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
                    <div className="grid grid-cols-4 gap-2">
                      {operatingHours.map((schedule, index) => (
                        <div key={schedule.day} className="flex items-center gap-1">
                          <span className="text-gray-400 text-xs w-6">{schedule.day}</span>
                          {editingOperatingHours ? (
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
                              className="bg-gray-600 border border-green-400 text-white px-2 py-1 rounded text-xs w-full"
                            />
                          ) : (
                            <span className="text-white text-xs">
                              {schedule.start === '00:00' && schedule.end === '00:00' ? '휴무' : `${schedule.start}~${schedule.end}`}
                            </span>
                          )}
                        </div>
                      ))}
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
                  <div>
                    <label className="text-gray-300 text-sm mb-2 block">보관함 상태</label>
                    <div className="flex gap-2">
                      {['정상', '파손', '잠금', '없음'].map((status) => (
                        <button
                          key={status}
                          onClick={() => setStorageStatus(status)}
                          className={`flex-1 ${storageStatus === status ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'} text-white py-2 rounded-xl text-sm transition-colors`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>


              {/* 점검 결과 기록 */}
              <div className="border-t border-gray-700 pt-4">
                <h3 className="text-lg font-bold text-yellow-400 mb-3">점검 결과 기록</h3>
              </div>


              {/* 조치사항 */}
              <div className="bg-gray-800/50 rounded-2xl p-4">
                <h3 className="font-semibold text-white mb-3">조치사항</h3>
                <textarea 
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-xl text-sm border border-gray-600 focus:border-green-400 h-24"
                  placeholder="상세 조치사항을 입력하세요 (500자 이내)"
                  maxLength={500}
                />
              </div>

              {/* 후속조치 필요여부 */}
              <div className="bg-gray-800/50 rounded-2xl p-4">
                <h3 className="font-semibold text-white mb-3">후속조치 필요여부</h3>
                <div className="flex gap-2">
                  <button className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl text-sm transition-colors">이상없음</button>
                  <button className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-xl text-sm transition-colors">현장권고완료</button>
                  <button className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-xl text-sm transition-colors">추후권고대상</button>
                </div>
              </div>

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

              {/* GPS 위치 확인 */}
              <div className="bg-gray-800/50 rounded-2xl p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-white">GPS 위치 확인</h3>
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
                      console.log('모의 지도 로드 버튼 클릭됨');
                      
                      if (!selectedDevice) {
                        showAlert('선택된 AED 장치가 없습니다.');
                        return;
                      }
                      
                      const container = document.getElementById('mobile-inspection-map');
                      if (!container) {
                        showAlert('지도 컨테이너를 찾을 수 없습니다.');
                        return;
                      }
                      
                      const loadingDiv = container.querySelector('.absolute') as HTMLElement;
                      if (loadingDiv) {
                        loadingDiv.innerHTML = `
                          <div class="text-center">
                            <svg class="h-16 w-16 mx-auto mb-2 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                            </svg>
                            <div class="text-white mb-2">모의 지도</div>
                            <div class="text-sm text-gray-300 mb-3">
                              ${selectedDevice.name}<br/>
                              ${selectedDevice.location}
                            </div>
                            <div class="text-xs text-green-400">
                              위치: ${selectedDevice.lat}, ${selectedDevice.lng}
                            </div>
                          </div>
                        `;
                      }
                      
                      showAlert('모의 지도가 로드되었습니다. 실제 구현시에는 카카오맵 API를 사용할 예정입니다.');
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-sm"
                  >
                    지도 로드
                  </button>
                  <button className="bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl text-sm">
                    위치 저장
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
        
        {/* 하단 고정 버튼 */}
        <div className="sticky bottom-0 bg-gray-900 p-4 border-t border-gray-700">
          <button
            onClick={saveInspection}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl text-sm font-bold transition-colors"
          >
            점검 결과 저장
          </button>
        </div>
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
      </div>
    </div>
  );

  // 점검 모달
  const InspectionModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-800 p-6 border-b border-gray-700 z-10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-green-400">AED 점검 화면</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowInspectionModal(false)}
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
          
          {/* 진행률 표시 */}
          <div className="bg-gray-700 rounded-full p-1">
            <div className="relative">
              <div className="bg-gray-600 h-3 rounded-full">
                <div 
                  className="bg-green-500 h-3 rounded-full transition-all duration-300"
                  style={{width: `${calculateProgress()}%`}}
                />
              </div>
              <span className="absolute -top-7 left-1/2 transform -translate-x-1/2 text-sm text-gray-300">
                {completedItems.size} / {totalInspectionItems} 항목 완료 ({calculateProgress()}%)
              </span>
            </div>
          </div>
        </div>
        
        <div className="p-6">
        {selectedDevice && (
          <div className="space-y-6">
            {/* 점검 요약 정보 - PC용 상세 버전 */}
            <div className="bg-gradient-to-r from-red-900/20 to-orange-900/20 border border-red-600/30 rounded-lg p-4">
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                점검 전 확인사항
              </h3>
              
              {/* 기호 설명 */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 2C5 1.44772 5.44772 1 6 1H14C14.5523 1 15 1.44772 15 2C15 2.55228 14.5523 3 14 3H6C5.44772 3 5 2.55228 5 2Z" fill="#9CA3AF"/>
                    <path d="M6 3H14L13 7H7L6 3Z" fill="#D1D5DB"/>
                    <path d="M7 7H13L14 17H6L7 7Z" fill="#9CA3AF"/>
                    <path d="M5 18C5 17.4477 5.44772 17 6 17H14C14.5523 17 15 17.4477 15 18C15 18.5523 14.5523 19 14 19H6C5.44772 19 5 18.5523 5 18Z" fill="#9CA3AF"/>
                    <path d="M8 9L10 11L12 9" stroke="#374151" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span>모래시계: 제품 유효기간 표시 (Expiration Date)</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
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
              <div className="grid grid-cols-2 gap-6 pt-4 border-t border-gray-700">
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
                  <div className="text-sm text-gray-400">매월 1회 정기 점검</div>
                </div>
              </div>
            </div>

            {/* 기본 정보 */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-3 text-gray-300">기본 정보</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-400">관리번호:</span> AED-2024-{selectedDevice.id}</div>
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
                <div><span className="text-gray-400">거리:</span> {selectedDevice.distance}m</div>
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
                
                // 남은 날짜 계산
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const expiryDate = new Date(currentValue);
                const diffTime = expiryDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const daysText = diffDays > 0 ? `${diffDays}일 남음` : diffDays === 0 ? '오늘 만료' : `${Math.abs(diffDays)}일 지남`;
                const daysColor = diffDays > 30 ? 'text-green-400' : diffDays > 0 ? 'text-yellow-400' : 'text-red-400';
                
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
                          onClick={() => handleEditComplete(item.key, currentValue)}
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
                          onClick={() => handleItemConfirm(item.key, item.value)}
                          className={getItemButtonStyle(item.key, 'confirm').replace('flex-1', '') + ' px-4 py-2'}
                          disabled={itemState?.status === 'corrected'}
                        >
                          일치
                        </button>
                        <button 
                          onClick={() => handleItemCorrect(item.key, item.value)}
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
                          onClick={() => handleEditComplete(itemKey, currentValue)}
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
                          onClick={() => handleItemConfirm(itemKey, externalDisplay)}
                          className={getItemButtonStyle(itemKey, 'confirm').replace('flex-1', '') + ' flex-1 py-2'}
                          disabled={itemState?.status === 'corrected'}
                        >
                          일치
                        </button>
                        <button 
                          onClick={() => handleItemCorrect(itemKey, externalDisplay)}
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
                          onClick={() => handleEditComplete(item.key, currentValue)}
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
                          onClick={() => handleItemConfirm(item.key, item.value)}
                          className={getItemButtonStyle(item.key, 'confirm').replace('flex-1', '') + ' px-4 py-2'}
                          disabled={itemState?.status === 'corrected'}
                        >
                          일치
                        </button>
                        <button 
                          onClick={() => handleItemCorrect(item.key, item.value)}
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
                  <div className="grid grid-cols-4 gap-2">
                    {operatingHours.map((schedule, index) => (
                      <div key={schedule.day} className="flex items-center gap-1">
                        <span className="text-gray-400 text-xs w-6">{schedule.day}</span>
                        <input 
                          type="text" 
                          value={schedule.start === '00:00' && schedule.end === '00:00' ? '휴무' : `${schedule.start}~${schedule.end}`}
                          onChange={(e) => {
                            if (editingOperatingHours) {
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
                          disabled={!editingOperatingHours}
                          className={`${editingOperatingHours ? 'bg-gray-600 border border-green-400' : 'bg-gray-700'} text-white px-2 py-1 rounded text-xs w-full`}
                        />
                      </div>
                    ))}
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
                <div>
                  <label className="text-gray-300 text-sm mb-2 block">보관함 상태</label>
                  <div className="flex gap-2">
                    {['정상', '파손', '잠김', '없음'].map((status) => (
                      <button
                        key={status}
                        onClick={() => setStorageStatus(status)}
                        className={`flex-1 ${storageStatus === status ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'} text-white py-2 rounded transition-colors`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 위치 정보 수정 */}
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">설치 위치 확인</h3>
                <div className="text-sm text-gray-300">
                  현재: {selectedDevice.lat}, {selectedDevice.lng}
                </div>
              </div>
              {/* 가상 지도 */}
              <div className="w-full h-64 bg-gray-700/30 rounded-lg border border-gray-600 relative overflow-hidden">
                <svg ref={svgRef} viewBox="0 0 600 300" className="w-full h-full">
                  {/* 배경 격자 */}
                  <defs>
                    <pattern id="grid-desktop" width="30" height="30" patternUnits="userSpaceOnUse">
                      <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#374151" strokeWidth="0.5"/>
                    </pattern>
                  </defs>
                  <rect width="600" height="300" fill="#111827"/>
                  <rect width="600" height="300" fill="url(#grid-desktop)"/>
                  
                  {/* 도로 */}
                  <rect x="0" y="140" width="600" height="30" fill="#4B5563"/>
                  <rect x="285" y="0" width="30" height="300" fill="#4B5563"/>
                  
                  {/* 건물들 */}
                  <rect x="45" y="45" width="120" height="75" fill="#1F2937" stroke="#374151" strokeWidth="2" rx="3"/>
                  <text x="105" y="90" textAnchor="middle" fill="#9CA3AF" fontSize="14">빌딩 A</text>
                  
                  <rect x="195" y="40" width="75" height="80" fill="#1F2937" stroke="#374151" strokeWidth="2" rx="3"/>
                  <text x="232" y="85" textAnchor="middle" fill="#9CA3AF" fontSize="14">빌딩 B</text>
                  
                  <rect x="330" y="50" width="135" height="70" fill="#1F2937" stroke="#374151" strokeWidth="2" rx="3"/>
                  <text x="397" y="90" textAnchor="middle" fill="#9CA3AF" fontSize="14">시청</text>
                  
                  <rect x="495" y="30" width="90" height="90" fill="#1F2937" stroke="#374151" strokeWidth="2" rx="3"/>
                  <text x="540" y="80" textAnchor="middle" fill="#9CA3AF" fontSize="14">병원</text>
                  
                  <rect x="75" y="180" width="105" height="75" fill="#1F2937" stroke="#374151" strokeWidth="2" rx="3"/>
                  <text x="127" y="225" textAnchor="middle" fill="#9CA3AF" fontSize="14">공원</text>
                  
                  <rect x="375" y="185" width="120" height="70" fill="#1F2937" stroke="#374151" strokeWidth="2" rx="3"/>
                  <text x="435" y="225" textAnchor="middle" fill="#9CA3AF" fontSize="14">학교</text>
                  
                  {/* AED 위치 핀 (시청 건물) */}
                  <g 
                    transform={`translate(${desktopPinPosition.x}, ${desktopPinPosition.y})`}
                    style={{ cursor: isDraggingDesktopPin ? 'grabbing' : 'grab' }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDraggingDesktopPin(true);
                      const svg = svgRef.current;
                      if (!svg) return;
                      
                      const handleMouseMove = (e: MouseEvent) => {
                        const rect = svg.getBoundingClientRect();
                        const x = ((e.clientX - rect.left) / rect.width) * 600;
                        const y = ((e.clientY - rect.top) / rect.height) * 300;
                        setDesktopPinPosition({
                          x: Math.max(0, Math.min(600, x)),
                          y: Math.max(0, Math.min(300, y))
                        });
                      };
                      
                      const handleMouseUp = () => {
                        setIsDraggingDesktopPin(false);
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
                        showAlert('AED 위치가 업데이트되었습니다');
                      };
                      
                      document.addEventListener('mousemove', handleMouseMove);
                      document.addEventListener('mouseup', handleMouseUp);
                    }}
                  >
                    {/* 핀 그림자 */}
                    <ellipse cx="0" cy="30" rx="12" ry="4" fill="#000000" opacity="0.3"/>
                    {/* 핀 본체 */}
                    <path d="M 0 0 C -12 0 -21 -9 -21 -21 C -21 -33 -12 -42 0 -42 C 12 -42 21 -33 21 -21 C 21 -9 12 0 0 0 L 0 30" 
                          fill={isDraggingDesktopPin ? "#FF6B6B" : "#EF4444"} stroke="#991B1B" strokeWidth="1.5"/>
                    {/* AED 아이콘 */}
                    <circle cx="0" cy="-21" r="15" fill="#FFFFFF"/>
                    <text x="0" y="-15" textAnchor="middle" fill={isDraggingDesktopPin ? "#FF6B6B" : "#EF4444"} fontSize="18" fontWeight="bold">AED</text>
                  </g>
                  
                  {/* 현재 위치 표시 */}
                  <g transform="translate(300, 155)">
                    <circle cx="0" cy="0" r="8" fill="#3B82F6"/>
                    <circle cx="0" cy="0" r="12" fill="none" stroke="#3B82F6" strokeWidth="3" opacity="0.5">
                      <animate attributeName="r" from="12" to="22" dur="2s" repeatCount="indefinite"/>
                      <animate attributeName="opacity" from="0.5" to="0" dur="2s" repeatCount="indefinite"/>
                    </circle>
                    <text x="0" y="-15" textAnchor="middle" fill="#93C5FD" fontSize="12">현재위치</text>
                  </g>
                </svg>
                {/* 안내 텍스트 */}
                <div className="absolute bottom-2 left-2 text-xs text-gray-300 bg-gray-800/80 px-2 py-1 rounded">
                  핀을 드래그하여 위치 수정
                </div>
              </div>
              <div className="mt-3 text-center text-gray-400 text-sm">
                GPS: {selectedDevice.lat}, {selectedDevice.lng} | 거리: 약 65m
              </div>
              <div className="flex gap-2 mt-3">
                <button 
                  onClick={() => {
                    if (!selectedDevice) {
                      showAlert('선택된 AED 장치가 없습니다.');
                      return;
                    }
                    
                    // 모의 지도 로딩 시뮬레이션 (데스크톱 버전)
                    const container = document.getElementById('inspection-map');
                    if (!container) {
                      showAlert('지도 컨테이너를 찾을 수 없습니다.');
                      return;
                    }
                    
                    // 로딩 메시지 숨기고 모의 지도 표시
                    const loadingDiv = container.querySelector('.absolute') as HTMLElement;
                    if (loadingDiv) {
                      loadingDiv.innerHTML = `
                        <div class="text-center">
                          <div class="mb-4">
                            <svg class="w-12 h-12 mx-auto" fill="#3B82F6" viewBox="0 0 24 24">
                              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                            </svg>
                          </div>
                          <div class="text-white mb-2">모의 지도 (데스크톱)</div>
                          <div class="text-sm text-gray-300 mb-3">
                            ${selectedDevice.name}<br/>
                            ${selectedDevice.location}
                          </div>
                          <div class="text-xs text-green-400">
                            위치: ${selectedDevice.lat}, ${selectedDevice.lng}
                          </div>
                        </div>
                      `;
                    }
                    
                    showAlert('모의 지도가 로드되었습니다. 실제 구현시에는 카카오맵 API를 사용할 예정입니다.');
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                >
                  지도 로드
                </button>
                <button className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">
                  위치 저장
                </button>
                <button className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm">
                  현재 위치로 재설정
                </button>
              </div>
            </div>
            
            {/* 조치사항 */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-3">조치사항</h3>
              <textarea 
                className="w-full bg-gray-600 text-white px-3 py-2 rounded text-sm border border-gray-500 focus:border-green-400 h-24"
                placeholder="상세 조치사항을 입력하세요 (500자 이내)"
                maxLength={500}
              />
            </div>

            {/* 후속조치 필요여부 */}
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-3">후속조치 필요여부</h3>
              <div className="flex gap-2">
                <button className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded transition-colors">이상없음</button>
                <button className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded transition-colors">현장권고완료</button>
                <button className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded transition-colors">추후권고대상</button>
              </div>
            </div>
            
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
      { id: 2, type: 'urgent', title: '배터리 교체 필요', message: '강남구청 2층 AED 배터리 잔량 부족', time: '10분 전', location: '강남구청', priority: 'high' },
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
              <p className="text-gray-300">AED 스마트 점검 시스템 튜토리얼을 시작합니다.</p>
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

  return deviceType === 'desktop' ? <DesktopLayout /> : <MobileLayout />;
}