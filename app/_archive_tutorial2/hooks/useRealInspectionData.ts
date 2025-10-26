'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { inspectionService, type AEDInspectionStatus, type AEDInspectionRecord } from '../services/InspectionService';
import { aedService } from '../services/AEDService';
import { type AEDDevice } from '../types/AEDTypes';

// 점검 진행률 인터페이스
export interface InspectionProgress {
  totalItems: number;
  completedItems: number;
  percentage: number;
  currentStep: number;
  totalSteps: number;
}

// 점검 아이템 인터페이스
export interface InspectionItem {
  id: string;
  name: string;
  status: 'pending' | 'completed' | 'failed' | 'warning';
  value?: string;
  notes?: string;
  required: boolean;
  category: 'battery' | 'pad' | 'device' | 'environment' | 'documentation';
}

// 점검 데이터 훅
export function useRealInspectionData() {
  // 상태 관리
  const [devices, setDevices] = useState<AEDInspectionStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'local' | 'supabase'>('local');

  // 필터 상태
  const [filters, setFilters] = useState({
    sido: '',
    healthCenter: '',
    priority: '',
    status: ''
  });

  // 점검 기록 상태
  const [currentInspection, setCurrentInspection] = useState<AEDInspectionRecord | null>(null);
  const [inspectionItems, setInspectionItems] = useState<InspectionItem[]>([]);

  // 실제 데이터 로드
  useEffect(() => {
    const loadRealData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 실제 수파베이스 연결 확인
        const isSupabaseConnected = await inspectionService.getConnectionStatus();
        setDataSource(isSupabaseConnected ? 'supabase' : 'local');

        if (isSupabaseConnected) {
          // 점검 필요 AED 로드 (80,766개 중 첫 50개, 우선순위별)
          const loadedDevices = await inspectionService.getAEDsForInspection(50, 0, {
            priority: filters.priority || undefined,
            sido: filters.sido || undefined,
            jurisdiction_health_center: filters.healthCenter || undefined
          });
          setDevices(loadedDevices);

          console.log(`Loaded ${loadedDevices.length} AED devices for inspection from real database`);
        } else {
          // 로컬 모드 - 기존 데이터 사용
          const loadedDevices = await aedService.getAEDDevices(50, 0);
          const mappedDevices = loadedDevices.map((device: AEDDevice) => ({
            ...device,
            last_inspection_date: '1900-01-01',
            inspection_status: 'never_inspected',
            current_priority: 'normal',
            inspection_priority: 'never_inspected' as const,
            expiry_status: 'valid' as const,
            priority_score: 100
          }));
          setDevices(mappedDevices as unknown as AEDInspectionStatus[]);
        }
      } catch (error) {
        console.error('Failed to load inspection data:', error);
        setError('데이터 로드 실패');
        setDevices([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadRealData();
  }, [filters]);

  // 제조사 목록 가져오기
  const manufacturers = useMemo(() => {
    const uniqueManufacturers = new Set(
      devices
        .map(device => device.manufacturer)
        .filter(Boolean)
    );
    return Array.from(uniqueManufacturers).sort();
  }, [devices]);

  // 모델 목록 가져오기
  const models = useMemo(() => {
    const uniqueModels = new Set(
      devices
        .map(device => device.model_name)
        .filter(Boolean)
    );
    return Array.from(uniqueModels).sort();
  }, [devices]);

  // 지역 목록 가져오기
  const regions = useMemo(() => {
    const uniqueRegions = new Set(
      devices
        .map(device => device.sido)
        .filter(Boolean)
    );
    return Array.from(uniqueRegions).sort();
  }, [devices]);

  // 보건소 목록 가져오기
  const healthCenters = useMemo(() => {
    const uniqueHealthCenters = new Set(
      devices
        .map(device => device.jurisdiction_health_center)
        .filter(Boolean)
    );
    return Array.from(uniqueHealthCenters).sort();
  }, [devices]);

  // 점검 아이템 초기화
  const initializeInspectionItems = useCallback((): InspectionItem[] => {
    return [
      // 배터리 점검
      {
        id: 'battery_visual',
        name: '배터리 외관 상태',
        status: 'pending',
        required: true,
        category: 'battery'
      },
      {
        id: 'battery_expiry',
        name: '배터리 유효기간',
        status: 'pending',
        required: true,
        category: 'battery'
      },
      {
        id: 'battery_level',
        name: '배터리 잔량',
        status: 'pending',
        required: true,
        category: 'battery'
      },

      // 패드 점검
      {
        id: 'pad_package',
        name: '패드 포장 상태',
        status: 'pending',
        required: true,
        category: 'pad'
      },
      {
        id: 'pad_expiry',
        name: '패드 유효기간',
        status: 'pending',
        required: true,
        category: 'pad'
      },

      // 장치 점검
      {
        id: 'device_indicator',
        name: '상태 표시등',
        status: 'pending',
        required: true,
        category: 'device'
      },
      {
        id: 'device_self_test',
        name: '자체 진단 테스트',
        status: 'pending',
        required: true,
        category: 'device'
      },

      // 환경 점검
      {
        id: 'location_accessibility',
        name: '접근성',
        status: 'pending',
        required: true,
        category: 'environment'
      },
      {
        id: 'signage_visibility',
        name: '표지판 가시성',
        status: 'pending',
        required: true,
        category: 'environment'
      },
      {
        id: 'temperature_condition',
        name: '보관 환경',
        status: 'pending',
        required: false,
        category: 'environment'
      }
    ];
  }, []);

  // 점검 시작
  const startInspection = useCallback(async (device: AEDInspectionStatus) => {
    try {
      const inspectionData: Omit<AEDInspectionRecord, 'id' | 'created_at' | 'updated_at'> = {
        equipment_serial: device.equipment_serial,
        inspector_name: '튜토리얼 사용자',
        inspection_date: new Date().toISOString().split('T')[0],
        inspection_type: 'routine',
        battery_status: 'not_checked',
        pad_status: 'not_checked',
        device_status: 'not_checked',
        overall_status: 'pending',
        confirmed_manufacturer: device.manufacturer,
        confirmed_model_name: device.model_name,
        confirmed_location: device.installation_position || device.installation_address
      };

      if (dataSource === 'supabase') {
        const created = await inspectionService.createInspectionRecord(inspectionData);
        setCurrentInspection(created);
      } else {
        // 로컬 모드에서는 임시 ID 생성
        setCurrentInspection({
          ...inspectionData,
          id: `temp_${Date.now()}`
        });
      }

      setInspectionItems(initializeInspectionItems());
    } catch (error) {
      console.error('점검 시작 실패:', error);
      setError('점검 시작에 실패했습니다.');
    }
  }, [dataSource, initializeInspectionItems]);

  // 점검 아이템 업데이트
  const updateInspectionItem = useCallback((
    itemId: string,
    status: InspectionItem['status'],
    value?: string,
    notes?: string
  ) => {
    setInspectionItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? { ...item, status, value, notes }
          : item
      )
    );
  }, []);

  // 점검 완료
  const completeInspection = useCallback(async () => {
    if (!currentInspection) return false;

    try {
      // 점검 결과 계산
      const completedItems = inspectionItems.filter(item => item.status === 'completed');
      const failedItems = inspectionItems.filter(item => item.status === 'failed');
      const requiredItems = inspectionItems.filter(item => item.required);
      const completedRequiredItems = requiredItems.filter(item => item.status === 'completed');

      let overallStatus: AEDInspectionRecord['overall_status'] = 'pending';
      let priorityLevel: AEDInspectionRecord['priority_level'] = 'normal';

      if (failedItems.length > 0) {
        overallStatus = 'fail';
        priorityLevel = 'urgent';
      } else if (completedRequiredItems.length === requiredItems.length) {
        overallStatus = 'pass';
        priorityLevel = 'low';
      } else {
        overallStatus = 'partial';
        priorityLevel = 'medium';
      }

      // 점검 기록 업데이트
      const updateData: Partial<AEDInspectionRecord> = {
        overall_status: overallStatus,
        priority_level: priorityLevel,
        battery_status: inspectionItems.find(i => i.category === 'battery')?.status === 'completed' ? 'normal' : 'not_checked',
        pad_status: inspectionItems.find(i => i.category === 'pad')?.status === 'completed' ? 'normal' : 'not_checked',
        device_status: inspectionItems.find(i => i.category === 'device')?.status === 'completed' ? 'normal' : 'not_checked',
        issues_found: failedItems.map(item => `${item.name}: ${item.notes || '점검 실패'}`).join('; '),
        notes: `튜토리얼 점검 완료. 완료율: ${Math.round((completedItems.length / inspectionItems.length) * 100)}%`
      };

      if (dataSource === 'supabase' && currentInspection.id) {
        await inspectionService.updateInspectionRecord(currentInspection.id, updateData);
      }

      // 점검 상태 초기화
      setCurrentInspection(null);
      setInspectionItems([]);

      // 데이터 새로고침 - 직접 호출로 순환 종속성 방지
      setIsLoading(true);
      try {
        if (dataSource === 'supabase') {
          const loadedDevices = await inspectionService.getAEDsForInspection(50, 0, {
            priority: filters.priority || undefined,
            sido: filters.sido || undefined,
            jurisdiction_health_center: filters.healthCenter || undefined
          });
          setDevices(loadedDevices);
        }
      } catch (refreshError) {
        console.error('데이터 새로고침 실패:', refreshError);
        setError('데이터 새로고침에 실패했습니다.');
      } finally {
        setIsLoading(false);
      }

      return true;
    } catch (error) {
      console.error('점검 완료 실패:', error);
      setError('점검 완료에 실패했습니다.');
      return false;
    }
  }, [currentInspection, inspectionItems, dataSource, filters]);

  // 점검 진행률 계산
  const progress = useMemo((): InspectionProgress => {
    const totalItems = inspectionItems.length;
    const completedItems = inspectionItems.filter(item =>
      item.status === 'completed' || item.status === 'failed'
    ).length;

    return {
      totalItems,
      completedItems,
      percentage: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
      currentStep: completedItems + 1,
      totalSteps: totalItems
    };
  }, [inspectionItems]);

  // 우선순위 배지 생성
  const getPriorityBadge = useCallback((device: AEDInspectionStatus) => {
    const priority = device.inspection_priority;

    switch (priority) {
      case 'never_inspected':
        return { label: '미점검', color: 'bg-red-500 text-white', urgency: 5 };
      case 'overdue':
        return { label: '점검필요', color: 'bg-orange-500 text-white', urgency: 4 };
      case 'due_soon':
        return { label: '점검예정', color: 'bg-yellow-500 text-black', urgency: 3 };
      case 'failed_last':
        return { label: '점검실패', color: 'bg-red-600 text-white', urgency: 5 };
      case 'requires_attention':
        return { label: '주의필요', color: 'bg-purple-500 text-white', urgency: 4 };
      case 'current':
        return { label: '정상', color: 'bg-green-500 text-white', urgency: 1 };
      default:
        return { label: '알 수 없음', color: 'bg-gray-500 text-white', urgency: 2 };
    }
  }, []);

  // 데이터 새로고침
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (dataSource === 'supabase') {
        const loadedDevices = await inspectionService.getAEDsForInspection(50, 0, {
          priority: filters.priority || undefined,
          sido: filters.sido || undefined,
          jurisdiction_health_center: filters.healthCenter || undefined
        });
        setDevices(loadedDevices);
      }
    } catch (error) {
      console.error('데이터 새로고침 실패:', error);
      setError('데이터 새로고침에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [dataSource, filters]);

  // 필터 업데이트
  const updateFilters = useCallback((newFilters: Partial<typeof filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  return {
    // 데이터
    devices,
    manufacturers,
    models,
    regions,
    healthCenters,

    // 상태
    isLoading,
    error,
    dataSource,
    filters,

    // 점검 관련
    currentInspection,
    inspectionItems,
    progress,

    // 액션
    startInspection,
    updateInspectionItem,
    completeInspection,
    refreshData,
    updateFilters,
    getPriorityBadge,

    // 유틸리티
    setError
  };
}