'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { aedService } from '../services/AEDService';

// 인터페이스 정의
export interface AEDDevice {
  id: string;
  name: string;
  location: string;
  address?: string;
  manager?: string;
  batteryExpiry: string;
  padExpiry: string;
  deviceExpiry: string;
  priority: 'urgent' | 'warning' | 'normal';
  distance: string;
  lastCheck: string;
  lat: string;
  lng: string;
  installationOrg: string;
  installationLocation: string;
  modelName: string;
  manufacturer?: string;
  manufacturingDate: string;
  serialNumber: string;
  founder?: string;
  initialInstallDate?: string;
  installDate: string;
  registrationDate?: string;
  saolDeleted?: boolean;
  displayAllowed?: boolean;
  externalDisplay?: boolean;
  externalNoDisplayReason?: string;
  governmentSupported?: boolean;
  특성?: string[];
  관심사항?: string[];
  category1?: string;
  category2?: string;
  category3?: string;
  purchaseOrg?: string;
  replacementDate?: string;
  patchAvailable?: boolean;
  patchExpiry?: string;
}

export interface TeamMember {
  name: string;
  type: 'permanent' | 'temporary' | 'volunteer';
  department: string;
  quota: number;
  completed: number;
  email?: string;
}

export interface InspectionItemState {
  status: 'pending' | 'confirmed' | 'corrected';
  isEditing: boolean;
  originalValue: string;
  currentValue: string;
  hasIssue: boolean;
}

export type InspectionStates = {
  [key: string]: InspectionItemState;
};

export const useInspectionData = () => {
  // 기본 상태
  const [selectedDevice, setSelectedDevice] = useState<AEDDevice | null>(null);
  const [inspectionStates, setInspectionStates] = useState<InspectionStates>({});
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  
  // 장비 및 위치 데이터
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

  // 점검 상태 데이터
  const [operationStatus, setOperationStatus] = useState('정상');
  const [batteryStatus, setBatteryStatus] = useState('정상');
  const [installMethod, setInstallMethod] = useState('벽걸이형');
  // 보관함 상세 체크리스트 상태
  const [storageChecklist, setStorageChecklist] = useState({
    hasStorage: '',               // 보관함 유무 (추가)
    theftAlarm: '',               // 도난경보장치 작동 여부
    guidanceText: '',             // 보관함 각종 안내문구상태
    emergencyContact: '',         // 비상연락망 표시 여부
    cprManual: '',                // 심폐소생술 방법 안내책자 여부
    expiryDisplay: ''             // 패드및배터리 유효기간 표시 여부
  });
  const [equipmentConfirmed, setEquipmentConfirmed] = useState(false);

  // 확장 가능한 데이터 로딩 (수파베이스 연동 준비)
  const [devices, setDevices] = useState<AEDDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'local' | 'supabase'>('local');
  
  // 실제 제조사/모델 데이터
  const [realManufacturers, setRealManufacturers] = useState<string[]>([]);
  const [realModels, setRealModels] = useState<string[]>([]);
  const [dynamicDataLoading, setDynamicDataLoading] = useState(false);

  // 실제 데이터 로드 (aed_data 테이블에서)
  useEffect(() => {
    const loadDevices = async () => {
      setIsLoading(true);
      try {
        // 실제 수파베이스 연결 확인
        const isSupabaseConnected = aedService.getConnectionStatus();
        setDataSource(isSupabaseConnected ? 'supabase' : 'local');
        
        // 실제 장치 데이터 로드 (80,766개 중 첫 50개, 우선순위별)
        const loadedDevices = await aedService.getAEDDevices(50, 0);
        setDevices(loadedDevices);
        
        console.log(`Loaded ${loadedDevices.length} AED devices from real database`);
      } catch (error) {
        console.error('Failed to load real AED devices:', error);
        // 실패 시 빈 배열로 fallback
        setDevices([]);
        setDataSource('local');
      } finally {
        setIsLoading(false);
      }
    };

    loadDevices();
  }, []);

  // 팀 멤버 데이터 (향후 수파베이스에서 실제 직원 데이터 로드 예정)
  const teamMembers: TeamMember[] = useMemo(() => [
    { name: '김민수', type: 'permanent', department: '보건행정과', quota: 35, completed: 28, email: 'kim@seoul.go.kr' },
    { name: '이영희', type: 'permanent', department: '응급의료팀', quota: 40, completed: 32, email: 'lee@seoul.go.kr' },
    { name: '박철수', type: 'temporary', department: '의약무관리팀', quota: 30, completed: 25, email: 'park@seoul.go.kr' },
    { name: '최지원', type: 'permanent', department: '시설관리과', quota: 45, completed: 38, email: 'choi@seoul.go.kr' },
    { name: '정하나', type: 'volunteer', department: '예방접종팀', quota: 25, completed: 20, email: 'jung@seoul.go.kr' }
  ], []);

  // 우선순위 필터링
  const urgentWarningDevices = useMemo(() => {
    return devices.filter(device => device.priority === 'urgent' || device.priority === 'warning');
  }, [devices]);

  // 진행률 계산
  const calculateProgress = useCallback(() => {
    const totalInspectionItems = 20;
    return Math.round((completedItems.size / totalInspectionItems) * 100);
  }, [completedItems]);

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

  // 우선순위 배지 생성
  const getPriorityBadge = useCallback((priority: string) => {
    const badges = {
      'urgent': 'bg-red-500 text-white',
      'warning': 'bg-yellow-500 text-black',
      'normal': 'bg-green-500 text-white'
    };
    return badges[priority as keyof typeof badges] || 'bg-gray-500 text-white';
  }, []);

  return {
    // 상태
    selectedDevice,
    setSelectedDevice,
    inspectionStates,
    setInspectionStates,
    completedItems,
    setCompletedItems,
    validationErrors,
    setValidationErrors,
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
    
    // 데이터
    devices,
    teamMembers,
    urgentWarningDevices,
    
    // 데이터 로딩 상태 (수파베이스 연동 대비)
    isLoading,
    dataSource,
    
    // 실제 제조사/모델 데이터
    realManufacturers,
    realModels,
    dynamicDataLoading,
    
    // 함수
    calculateProgress,
    markItemComplete,
    validateInput,
    getPriorityBadge,
    
    // 확장 함수들 (실제 80,766개 데이터 대응)
    refreshDevices: () => {
      // 데이터 새로고침 함수 (실제 수파베이스 연동)
      const loadDevices = async () => {
        setIsLoading(true);
        try {
          const loadedDevices = await aedService.getAEDDevices(50, 0);
          setDevices(loadedDevices);
          console.log(`Refreshed ${loadedDevices.length} AED devices`);
        } catch (error) {
          console.error('Failed to refresh devices:', error);
        } finally {
          setIsLoading(false);
        }
      };
      loadDevices();
    },
    
    // 우선순위별 장비 조회
    loadDevicesByPriority: async (priority: 'urgent' | 'warning' | 'normal') => {
      setIsLoading(true);
      try {
        const priorityDevices = await aedService.getAEDsByPriority(priority, 50);
        setDevices(priorityDevices);
        console.log(`Loaded ${priorityDevices.length} ${priority} priority devices`);
      } catch (error) {
        console.error(`Failed to load ${priority} devices:`, error);
      } finally {
        setIsLoading(false);
      }
    },
    
    // 지역별 장비 조회
    loadDevicesByRegion: async (sido: string, gugun?: string) => {
      setIsLoading(true);
      try {
        const regionDevices = await aedService.getAEDsByRegion(sido, gugun, 50);
        setDevices(regionDevices);
        console.log(`Loaded ${regionDevices.length} devices from ${sido}${gugun ? ` ${gugun}` : ''}`);
      } catch (error) {
        console.error(`Failed to load devices from ${sido}:`, error);
      } finally {
        setIsLoading(false);
      }
    },
    
    // 통합 검색
    searchDevices: async (query: string, filters?: { sido?: string; manufacturer?: string; priority?: 'urgent' | 'warning' | 'normal' }) => {
      setIsLoading(true);
      try {
        const searchResults = await aedService.searchAEDs(query, filters || {}, 50);
        setDevices(searchResults);
        console.log(`Found ${searchResults.length} devices matching "${query}"`);
      } catch (error) {
        console.error('Failed to search devices:', error);
      } finally {
        setIsLoading(false);
      }
    },
    
    // 실제 제조사 목록 로드
    loadRealManufacturers: async () => {
      if (dataSource !== 'supabase') return;
      
      setDynamicDataLoading(true);
      try {
        const manufacturers = await aedService.getUniqueManufacturers();
        setRealManufacturers(manufacturers);
        console.log(`실제 제조사 ${manufacturers.length}개 로드됨:`, manufacturers.slice(0, 10));
      } catch (error) {
        console.error('제조사 목록 로딩 실패:', error);
      } finally {
        setDynamicDataLoading(false);
      }
    },
    
    // 실제 모델 목록 로드
    loadRealModels: async () => {
      if (dataSource !== 'supabase') return;
      
      setDynamicDataLoading(true);
      try {
        const models = await aedService.getUniqueModels();
        setRealModels(models);
        console.log(`실제 모델 ${models.length}개 로드됨:`, models.slice(0, 10));
      } catch (error) {
        console.error('모델 목록 로딩 실패:', error);
      } finally {
        setDynamicDataLoading(false);
      }
    },
    
    // 제조사별 장치 조회
    loadDevicesByManufacturer: async (manufacturer: string) => {
      if (dataSource !== 'supabase') return;
      
      setIsLoading(true);
      try {
        const manufacturerDevices = await aedService.getAEDsByManufacturer(manufacturer, 50);
        setDevices(manufacturerDevices);
        console.log(`${manufacturer} 제조사 장치 ${manufacturerDevices.length}개 로드됨`);
      } catch (error) {
        console.error(`${manufacturer} 장치 로딩 실패:`, error);
      } finally {
        setIsLoading(false);
      }
    }
    
  } as const;
};