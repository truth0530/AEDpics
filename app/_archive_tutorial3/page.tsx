'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import SmartCard from '@/components/ui/SmartCard';
import ActionButton, { ChevronRightIcon, RefreshIcon, PlusIcon } from '@/components/ui/ActionButton';
import ProgressIndicator from '@/components/ui/ProgressIndicator';
import SmartSearch from '@/components/ui/SmartSearch';
import type { ProgressStep } from '@/components/ui/ProgressIndicator';
import type { QuickFilter } from '@/components/ui/SmartSearch';
import { CheckCircleIcon, CameraIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { DataValidationWarnings } from '../tutorial2/components/DataValidationWarnings';
import type { RealAEDData } from '../tutorial2/types/RealAEDTypes';
import { CategorySection } from '../tutorial2/components/CategorySection';
import StorageChecklistSection from '../tutorial2/components/StorageChecklistSection';
import GuidelineViewerModal from '@/components/ui/GuidelineViewerModal';

// Import design system
import '@/styles/design-system.css';

type StorageChecklistData = {
  hasStorage: string;
  theftAlarm: string;
  guidanceText: string;
  emergencyContact: string;
  cprManual: string;
  expiryDisplay: string;
};

type FollowUpAction = '이상없음' | '현장권고완료' | '추후권고대상';

const DEFAULT_STORAGE_CHECKLIST: StorageChecklistData = {
  hasStorage: '보관함',
  theftAlarm: '이상없음',
  guidanceText: '이상없음',
  emergencyContact: '이상없음',
  cprManual: '이상없음',
  expiryDisplay: '이상없음'
};

interface AEDDevice {
  id: string;
  managementNumber: string;
  institution: string;
  location: string;
  address: string;
  batteryExpiry: string;
  padExpiry: string;
  lastInspection: string;
  priority: 'urgent' | 'warning' | 'normal';
  status: 'pending' | 'in_progress' | 'completed';
  manufacturer?: string;
  modelName?: string;
  serialNumber?: string;
  installDate?: string;
  manufacturingDate?: string;
  deviceExpiry?: string;
  phoneNumber?: string;
  operatingHours?: string;
  operatingNotes?: string;
  equipmentNumber?: string;
  managerName?: string;
  locationDetail?: string;
  lat?: string;
  lng?: string;
  category1?: string;
  category2?: string;
  category3?: string;
  operationStatus?: '정상' | '고장' | '점검중' | '폐기예정' | '분실';
  batteryStatus?: '정상' | '교체필요' | '없음';
  storageChecklist?: StorageChecklistData;
  gpsIssue?: {
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
  };
}

interface InspectionState {
  status: 'pending' | 'confirmed' | 'corrected';
  isEditing: boolean;
  originalValue: string;
  currentValue: string;
}

const mapTutorial3DeviceToRealData = (device: AEDDevice | null): RealAEDData | null => {
  if (!device) {
    return null;
  }

  const addressParts = device.address ? device.address.split(/\s+/) : [];
  const sido = addressParts[0] || '';
  const gugun = addressParts[1] || '';
  const nowIso = new Date().toISOString();
  const numericId = Number.parseInt(device.id, 10);

  const operationStatusMap: Record<AEDDevice['status'], string> = {
    pending: '점검필요',
    in_progress: '점검중',
    completed: '운영'
  };

  return {
    id: Number.isFinite(numericId) ? numericId : 0,
    management_number: device.managementNumber,
    equipment_serial: device.serialNumber || device.managementNumber,
    sido,
    gugun,
    operation_status: operationStatusMap[device.status],
    display_allowed: '표출허용',
    external_display: 'Y',
    external_non_display_reason: null,
    government_support: '민간부담',
    report_date: device.lastInspection || '',
    registration_date: device.lastInspection || '',
    first_installation_date: device.installDate || '',
    installation_date: device.installDate || '',
    last_inspection_date: device.lastInspection || '',
    last_use_date: null,
    battery_expiry_date: device.batteryExpiry || '',
    patch_expiry_date: device.padExpiry || '',
    manufacturing_date: device.installDate || '',
    replacement_date: device.deviceExpiry || '',
    installation_institution: device.institution,
    installation_address: device.address || '',
    jurisdiction_health_center: '',
    purchase_institution: '',
    category_1: '',
    category_2: '',
    category_3: '',
    installation_method: '벽걸이형',
    installation_location_address: device.location,
    installation_position: device.location,
    longitude: 0,
    latitude: 0,
    institution_contact: device.phoneNumber || '',
    establisher: '',
    manager: '',
    model_name: device.modelName || '',
    manufacturer: device.manufacturer || '',
    manufacturing_country: '한국',
    serial_number: device.serialNumber || device.managementNumber,
    patch_available: 'Y',
    remarks: device.gpsIssue ? `${device.gpsIssue.type}` : null,
    saeum_deletion_status: 'N',
    created_at: nowIso,
    updated_at: nowIso
  };
};

const Tutorial3Dashboard = () => {
  const router = useRouter();
  const [selectedView, setSelectedView] = useState<'dashboard' | 'list' | 'inspection'>('dashboard');
  const [selectedDevice, setSelectedDevice] = useState<AEDDevice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [inspectionStates, setInspectionStates] = useState<{ [key: string]: InspectionState }>({});
  const [externalCondition, setExternalCondition] = useState('양호');
  const [installMethod, setInstallMethod] = useState('벽걸이형');
  const [signageStatus, setSignageStatus] = useState('양호');
  const [operationStatus, setOperationStatus] = useState<AEDDevice['operationStatus']>('정상');
  const [batteryStatus, setBatteryStatus] = useState<AEDDevice['batteryStatus']>('정상');
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [followUpAction, setFollowUpAction] = useState<FollowUpAction>('이상없음');
  const [actionNotes, setActionNotes] = useState('');
  const [storageChecklist, setStorageChecklist] = useState<StorageChecklistData>(DEFAULT_STORAGE_CHECKLIST);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoType, setPhotoType] = useState<'front' | 'inside' | 'serial'>('front');
  const [capturedPhotos, setCapturedPhotos] = useState<{
    front?: string;
    inside?: string;
    serial?: string;
  }>({});
  const [showValidationWarnings, setShowValidationWarnings] = useState(false);
  const [isGuidelineOpen, setIsGuidelineOpen] = useState(false);

  // Scroll position preservation function from tutorial2
  const preserveScrollPosition = useCallback((callback: () => void) => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    callback();
    requestAnimationFrame(() => {
      window.scrollTo(scrollLeft, scrollTop);
    });
  }, []);

  // Sample data with complete inspection fields
  const sampleDevices: AEDDevice[] = [
    {
      id: '1',
      managementNumber: 'AED-2025-0001',
      institution: '서울시청 본관',
      location: '1층 로비',
      locationDetail: '1층 로비 안내데스크 옆',
      address: '서울특별시 중구 태평로1가',
      batteryExpiry: '2025-01-20',
      padExpiry: '2025-01-25',
      lastInspection: '2024-06-15',
      priority: 'urgent',
      status: 'pending',
      manufacturer: '씨유메디칼',
      modelName: 'CU-SP1',
      serialNumber: 'CU2024-001234',
      installDate: '2020-03-15',
      manufacturingDate: '2019-12',
      deviceExpiry: '2025-03-15',
      phoneNumber: '02-120',
      operatingHours: '24시간',
      operatingNotes: '24시간 상시 개방, 방재실 모니터링',
      equipmentNumber: '2025-서울-001',
      managerName: '김응급',
      lat: '37.5665',
      lng: '126.9780',
      category1: '구비의무기관',
      category2: '공공기관',
      category3: '시청',
      operationStatus: '정상',
      batteryStatus: '정상',
      storageChecklist: { ...DEFAULT_STORAGE_CHECKLIST },
      gpsIssue: { type: 'default_coord', severity: 'critical' }
    },
    {
      id: '2',
      managementNumber: 'AED-2025-0002',
      institution: '강남구청',
      location: '민원실',
      locationDetail: '본관 1층 민원실 좌측',
      address: '서울특별시 강남구 삼성동',
      batteryExpiry: '2025-01-28',
      padExpiry: '2025-02-10',
      lastInspection: '2024-07-20',
      priority: 'warning',
      status: 'pending',
      manufacturer: '필립스',
      modelName: 'HeartStart FRx',
      serialNumber: 'PH2024-005678',
      installDate: '2019-08-20',
      manufacturingDate: '2018-05',
      deviceExpiry: '2024-08-20',
      phoneNumber: '02-3423-5500',
      operatingHours: '09:00-18:00',
      operatingNotes: '민원실 운영시간 내 접근 가능',
      equipmentNumber: '2025-서울-045',
      managerName: '이보건',
      lat: '37.5172',
      lng: '127.0473',
      category1: '구비의무기관',
      category2: '공공기관',
      category3: '구청',
      operationStatus: '점검중',
      batteryStatus: '교체필요',
      storageChecklist: {
        ...DEFAULT_STORAGE_CHECKLIST,
        theftAlarm: '이상있음'
      }
    },
    {
      id: '3',
      managementNumber: 'AED-2025-0003',
      institution: '서울역',
      location: '대합실',
      locationDetail: '대합실 중앙 안내데스크 뒤',
      address: '서울특별시 용산구 한강대로',
      batteryExpiry: '2025-02-05',
      padExpiry: '2025-01-30',
      lastInspection: '2024-08-10',
      priority: 'warning',
      status: 'in_progress',
      manufacturer: '라디안',
      modelName: 'HR-501',
      serialNumber: 'RD2024-009012',
      installDate: '2021-01-10',
      manufacturingDate: '2020-11',
      deviceExpiry: '2026-01-10',
      phoneNumber: '1544-7788',
      operatingHours: '05:00-01:00',
      operatingNotes: '역 영업시간 내 상시 접근 가능',
      equipmentNumber: '2025-서울-102',
      managerName: '박철도',
      lat: '37.5563',
      lng: '126.9723',
      category1: '구비의무기관',
      category2: '교통시설',
      category3: '기차역',
      operationStatus: '정상',
      batteryStatus: '정상',
      storageChecklist: {
        ...DEFAULT_STORAGE_CHECKLIST,
        guidanceText: '이상있음'
      },
      gpsIssue: { type: 'address_mismatch', severity: 'high' }
    },
    {
      id: '4',
      managementNumber: 'AED-2025-0004',
      institution: '강남세브란스병원',
      location: '응급실 입구',
      locationDetail: '응급실 입구 오른편',
      address: '서울특별시 강남구 언주로',
      batteryExpiry: '2025-06-15',
      padExpiry: '2025-07-20',
      lastInspection: '2024-12-01',
      priority: 'normal',
      status: 'completed',
      manufacturer: '메디아나',
      modelName: 'HeartOn A15',
      serialNumber: 'MD2024-003456',
      installDate: '2022-05-20',
      manufacturingDate: '2022-02',
      deviceExpiry: '2027-05-20',
      phoneNumber: '02-2019-3114',
      operatingHours: '24시간',
      operatingNotes: '응급실 전용 구역, 의료진 상주',
      equipmentNumber: '2025-서울-210',
      managerName: '최응급',
      lat: '37.4991',
      lng: '127.0469',
      category1: '구비의무기관',
      category2: '의료기관',
      category3: '병원',
      operationStatus: '정상',
      batteryStatus: '정상',
      storageChecklist: { ...DEFAULT_STORAGE_CHECKLIST }
    }
  ];

  const [devices] = useState<AEDDevice[]>(sampleDevices);
  const [filteredDevices, setFilteredDevices] = useState<AEDDevice[]>(sampleDevices);

  // Calculate statistics
  const stats = {
    urgent: devices.filter(d => d.priority === 'urgent').length,
    warning: devices.filter(d => d.priority === 'warning').length,
    normal: devices.filter(d => d.priority === 'normal').length,
    completed: devices.filter(d => d.status === 'completed').length,
    total: devices.length
  };

  // Quick filters
  const quickFilters: QuickFilter[] = [
    { label: '긴급', value: 'urgent', count: stats.urgent, color: 'red' },
    { label: '경고', value: 'warning', count: stats.warning, color: 'yellow' },
    { label: '정상', value: 'normal', count: stats.normal, color: 'green' },
    { label: '완료', value: 'completed', count: stats.completed, color: 'blue' }
  ];

  // Progress steps with detailed inspection categories
  const progressSteps: ProgressStep[] = [
    { id: '1', title: '기본 정보', status: currentStepIndex > 0 ? 'completed' : currentStepIndex === 0 ? 'current' : 'pending' },
    { id: '2', title: '장치 정보', status: currentStepIndex > 1 ? 'completed' : currentStepIndex === 1 ? 'current' : 'pending' },
    { id: '3', title: '외관 점검', status: currentStepIndex > 2 ? 'completed' : currentStepIndex === 2 ? 'current' : 'pending' },
    { id: '4', title: '기능 점검', status: currentStepIndex > 3 ? 'completed' : currentStepIndex === 3 ? 'current' : 'pending' },
    { id: '5', title: '사진 촬영', status: currentStepIndex > 4 ? 'completed' : currentStepIndex === 4 ? 'current' : 'pending' },
    { id: '6', title: '최종 확인', status: currentStepIndex > 5 ? 'completed' : currentStepIndex === 5 ? 'current' : 'pending' }
  ];

  // Calculate days remaining
  const calculateDaysRemaining = (dateStr: string) => {
    const today = new Date();
    const targetDate = new Date(dateStr);
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Handle search
  const handleSearch = (query: string) => {
    if (!query) {
      setFilteredDevices(devices);
      return;
    }

    const filtered = devices.filter(device =>
      device.institution.toLowerCase().includes(query.toLowerCase()) ||
      device.managementNumber.toLowerCase().includes(query.toLowerCase()) ||
      device.address.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredDevices(filtered);
  };

  // Handle filter selection
  const handleFilterSelect = (filter: QuickFilter) => {
    if (filter.value === 'completed') {
      setFilteredDevices(devices.filter(d => d.status === 'completed'));
    } else {
      setFilteredDevices(devices.filter(d => d.priority === filter.value));
    }
  };

  // Handle device selection
  const handleDeviceSelect = (device: AEDDevice) => {
    setSelectedDevice(device);
    setSelectedView('inspection');
    setCurrentStepIndex(0);
    setInspectionStates({});
    setCapturedPhotos({});
    setExternalCondition('양호');
    setInstallMethod('벽걸이형');
    setSignageStatus('양호');
    setOperationStatus(device.operationStatus || '정상');
    setBatteryStatus(device.batteryStatus || '정상');
    setFollowUpAction('이상없음');
    setActionNotes('');
    setInspectionNotes('');
    setStorageChecklist(device.storageChecklist ? { ...device.storageChecklist } : { ...DEFAULT_STORAGE_CHECKLIST });
    setShowValidationWarnings(true);
  };

  // Handle item confirmation
  const handleItemConfirm = (e: React.MouseEvent, itemKey: string, originalValue: string) => {
    e.preventDefault();
    e.stopPropagation();
    preserveScrollPosition(() => {
      setInspectionStates(prev => {
        const currentStatus = prev[itemKey]?.status;
        if (currentStatus === 'confirmed') {
          return {
            ...prev,
            [itemKey]: {
              status: 'pending',
              isEditing: false,
              originalValue,
              currentValue: originalValue
            }
          };
        }
        return {
          ...prev,
          [itemKey]: {
            status: 'confirmed',
            isEditing: false,
            originalValue,
            currentValue: originalValue
          }
        };
      });
    });
  };

  // Handle item correction
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
          currentValue: originalValue
        }
      }));
    });
  };

  // Get item button style
  const getItemButtonStyle = (itemKey: string, buttonType: 'confirm' | 'correct') => {
    const itemState = inspectionStates[itemKey];
    if (buttonType === 'confirm') {
      return itemState?.status === 'confirmed'
        ? 'flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded-lg text-sm transition-all'
        : 'flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-3 rounded-lg text-sm transition-all';
    }
    return itemState?.status === 'corrected'
      ? 'flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-3 rounded-lg text-sm transition-all'
      : 'flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-3 rounded-lg text-sm transition-all';
  };

  // Handle next step
  const handleNextStep = () => {
    if (currentStepIndex < progressSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      // 점검 완료 시
      alert('점검이 완료되었습니다!');
      setSelectedView('list');
      setCurrentStepIndex(0);
      setInspectionStates({});
      setCapturedPhotos({});
      setSelectedDevice(null);
      setShowValidationWarnings(false);
    }
  };

  // Handle previous step
  const handlePreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  // Refresh data
  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  // Photo capture simulation
  const handlePhotoCapture = (type: 'front' | 'inside' | 'serial') => {
    setPhotoType(type);
    setShowPhotoModal(true);
    // Simulate photo capture
    setTimeout(() => {
      setCapturedPhotos(prev => ({
        ...prev,
        [type]: '/api/placeholder/400/300'
      }));
      setShowPhotoModal(false);
    }, 1500);
  };

  // Render inspection item with confirm/correct buttons
  const renderInspectionItem = (label: string, value: string, itemKey: string, editable: boolean = true) => {
    const itemState = inspectionStates[itemKey];
    const isEditing = itemState?.isEditing;
    const currentValue = itemState?.currentValue || value;

    return (
      <div className="bg-gray-700/50 rounded-lg p-3">
        <div className="flex justify-between items-start mb-1">
          <span className="text-xs text-gray-400">{label}</span>
          {itemState?.status === 'confirmed' && (
            <CheckCircleIcon className="w-5 h-5 text-green-400" />
          )}
          {itemState?.status === 'corrected' && (
            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400" />
          )}
        </div>
        {isEditing ? (
          <div className="space-y-2">
            <input
              type="text"
              value={currentValue}
              onChange={(e) => {
                preserveScrollPosition(() => {
                  setInspectionStates(prev => ({
                    ...prev,
                    [itemKey]: { ...prev[itemKey], currentValue: e.target.value }
                  }));
                });
              }}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-green-500 focus:outline-none"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  preserveScrollPosition(() => {
                    setInspectionStates(prev => ({
                      ...prev,
                      [itemKey]: { ...prev[itemKey], isEditing: false }
                    }));
                  });
                }}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm"
              >
                수정완료
              </button>
              <button
                type="button"
                onClick={() => {
                  preserveScrollPosition(() => {
                    setInspectionStates(prev => ({
                      ...prev,
                      [itemKey]: {
                        ...prev[itemKey],
                        isEditing: false,
                        currentValue: prev[itemKey]?.originalValue || value
                      }
                    }));
                  });
                }}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg text-sm"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-white text-sm font-medium mb-1">{currentValue}</div>
            {editable && (
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={(e) => handleItemConfirm(e, itemKey, value)}
                  className={`${getItemButtonStyle(itemKey, 'confirm')} text-xs px-2 py-1.5`}
                  disabled={itemState?.status === 'corrected'}
                >
                  일치
                </button>
                <button
                  type="button"
                  onClick={(e) => handleItemCorrect(e, itemKey, value)}
                  className={`${getItemButtonStyle(itemKey, 'correct')} text-xs px-2 py-1.5`}
                  disabled={itemState?.status === 'confirmed'}
                >
                  {itemState?.status === 'corrected' ? '수정됨' : '수정'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  if (selectedView === 'inspection' && selectedDevice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          {/* Header */}
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <button
                onClick={() => {
                  setSelectedView('list');
                  setSelectedDevice(null);
                  setShowValidationWarnings(false);
                }}
                className="mb-2 flex items-center gap-2 text-gray-400 transition-colors hover:text-white"
              >
                <ChevronLeftIcon />
                <span className="text-sm">목록으로</span>
              </button>
              <h1 className="text-lg md:text-2xl font-bold">AED 점검 진행</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ActionButton
                variant="secondary"
                size="sm"
                onClick={() => setIsGuidelineOpen(true)}
                className="min-w-[120px]"
              >
                지침보기
              </ActionButton>
            </div>
          </div>

          {showValidationWarnings && (
            <div className="mb-6">
              <DataValidationWarnings
                device={mapTutorial3DeviceToRealData(selectedDevice)}
                onClose={() => setShowValidationWarnings(false)}
              />
            </div>
          )}

          {/* Device Info Card */}
          <SmartCard
            priority={selectedDevice.priority}
            title={selectedDevice.institution}
            subtitle={selectedDevice.managementNumber}
            status={selectedDevice.location}
            metadata={[
              { label: '주소', value: selectedDevice.address },
              {
                label: '배터리 만료',
                value: `${selectedDevice.batteryExpiry} (${calculateDaysRemaining(selectedDevice.batteryExpiry)}일)`,
                color: calculateDaysRemaining(selectedDevice.batteryExpiry) < 30 ? 'red' : 'green'
              },
              {
                label: '패드 만료',
                value: `${selectedDevice.padExpiry} (${calculateDaysRemaining(selectedDevice.padExpiry)}일)`,
                color: calculateDaysRemaining(selectedDevice.padExpiry) < 30 ? 'red' : 'green'
              }
            ]}
            className="mb-6"
          />

          {/* Progress Indicator */}
          <ProgressIndicator
            steps={progressSteps}
            variant="steps"
            className="mb-4"
          />

          {/* 단계별 점검 내용 */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-4 md:p-6 mb-4">
            {/* Step 1: 기본 정보 확인 */}
            {currentStepIndex === 0 && (
              <div>
                <h3 className="text-base md:text-xl font-bold mb-3 text-green-400">기본 정보 확인</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                  {renderInspectionItem('관리번호', selectedDevice.managementNumber, 'managementNumber')}
                  {renderInspectionItem('설치기관', selectedDevice.institution, 'institution')}
                  {renderInspectionItem('설치위치', selectedDevice.location, 'location')}
                  {renderInspectionItem('상세 위치', selectedDevice.locationDetail || '현장 확인 필요', 'locationDetail')}
                  {renderInspectionItem('주소', selectedDevice.address, 'address')}
                  {renderInspectionItem('연락처', selectedDevice.phoneNumber || '02-120', 'phoneNumber')}
                  {renderInspectionItem('운영시간', selectedDevice.operatingHours || '24시간', 'operatingHours')}
                  {renderInspectionItem('운영 안내', selectedDevice.operatingNotes || '추가 운영 정보 없음', 'operatingNotes')}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 mt-3">
                  {renderInspectionItem('장비연번', selectedDevice.equipmentNumber || '미등록', 'equipmentNumber')}
                  {renderInspectionItem('관리책임자', selectedDevice.managerName || '홍길동', 'managerName')}
                  {renderInspectionItem('최근 점검일', selectedDevice.lastInspection, 'lastInspection')}
                  {renderInspectionItem('위도/경도',
                    selectedDevice.lat && selectedDevice.lng ? `${selectedDevice.lat}, ${selectedDevice.lng}` : '좌표 미등록',
                    'coordinates'
                  )}
                </div>

                <div className="mt-6">
                  <CategorySection
                    currentCategory1={selectedDevice.category1 || ''}
                    currentCategory2={selectedDevice.category2 || ''}
                    currentCategory3={selectedDevice.category3 || ''}
                    institutionName={selectedDevice.institution}
                    additionalInfo={{
                      // 서울시청은 광역시청이므로 무조건 의무 대상
                      // 다른 시설의 경우 실제 데이터를 입력받아야 함
                    }}
                    onCategoryChange={(cat1, cat2, cat3) => {
                      setInspectionStates(prev => ({
                        ...prev,
                        category: {
                          status: 'confirmed',
                          isEditing: false,
                          originalValue: `${cat1} > ${cat2} > ${cat3}`,
                          currentValue: `${cat1} > ${cat2} > ${cat3}`
                        }
                      }));
                    }}
                  />
                </div>
              </div>
            )}

            {/* Step 2: 장치 정보 확인 */}
            {currentStepIndex === 1 && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-base md:text-xl font-bold text-green-400">장치 정보 확인</h3>
                  <button
                    onClick={() => router.push('/aed-battery-lifespan')}
                    className="text-xs px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                  >
                    제조사별 배터리 유효기간
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                  {renderInspectionItem('제조사', selectedDevice.manufacturer || '씨유메디칼', 'manufacturer')}
                  {renderInspectionItem('모델명', selectedDevice.modelName || 'CU-SP1', 'modelName')}
                  {renderInspectionItem('제조번호', selectedDevice.serialNumber || 'CU2024-001234', 'serialNumber')}
                  {renderInspectionItem('설치일자', selectedDevice.installDate || '2020-03-15', 'installDate')}
                  {renderInspectionItem('제조일자', selectedDevice.manufacturingDate || '2020-01', 'manufacturingDate')}
                  {renderInspectionItem('배터리 유효기간', selectedDevice.batteryExpiry, 'batteryExpiry')}
                  {renderInspectionItem('패드 유효기간', selectedDevice.padExpiry, 'padExpiry')}
                  {renderInspectionItem('장비 유효기간', selectedDevice.deviceExpiry || '2025-03-15', 'deviceExpiry')}
                  {renderInspectionItem(
                    'GPS 이슈',
                    selectedDevice.gpsIssue ? `${selectedDevice.gpsIssue.type} (${selectedDevice.gpsIssue.severity})` : '없음',
                    'gpsIssue',
                    false
                  )}
                </div>
              </div>
            )}

            {/* Step 3: 외관 점검 */}
            {currentStepIndex === 2 && (
              <div>
                <h3 className="text-base md:text-xl font-bold mb-3 text-green-400">외관 및 설치 환경 점검</h3>
                <div className="space-y-4">
                  <div className="bg-gray-700/50 rounded-xl p-4">
                    <label className="block text-sm text-gray-400 mb-3">외관 상태</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['양호', '보통', '불량'].map((condition) => (
                        <button
                          key={condition}
                          onClick={() => setExternalCondition(condition)}
                          className={`py-2 px-3 text-sm rounded-lg font-medium transition-all ${
                            externalCondition === condition
                              ? condition === '양호' ? 'bg-green-600 text-white'
                                : condition === '보통' ? 'bg-yellow-600 text-white'
                                : 'bg-red-600 text-white'
                              : 'bg-gray-600 text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          {condition}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-gray-700/50 rounded-xl p-4">
                    <label className="block text-sm text-gray-400 mb-3">설치 방법</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['벽걸이형', '스탠드형', '보관함'].map((method) => (
                        <button
                          key={method}
                          onClick={() => setInstallMethod(method)}
                          className={`py-2 px-3 text-sm rounded-lg font-medium transition-all ${
                            installMethod === method
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-600 text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-gray-700/50 rounded-xl p-4">
                    <label className="block text-sm text-gray-400 mb-3">표지판 상태</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['양호', '훼손', '없음'].map((status) => (
                        <button
                          key={status}
                          onClick={() => setSignageStatus(status)}
                          className={`py-2 px-3 text-sm rounded-lg font-medium transition-all ${
                            signageStatus === status
                              ? status === '양호' ? 'bg-green-600 text-white'
                                : status === '훼손' ? 'bg-yellow-600 text-white'
                                : 'bg-red-600 text-white'
                              : 'bg-gray-600 text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-700/50 rounded-xl p-4">
                      <label className="block text-sm text-gray-400 mb-3">운영상태</label>
                      <div className="grid grid-cols-2 gap-1">
                        {['정상', '고장', '점검중', '폐기예정', '분실'].map(status => (
                          <button
                            key={status}
                            onClick={() => setOperationStatus(status as AEDDevice['operationStatus'])}
                            className={`py-2 px-2 text-xs rounded-lg font-medium transition-all ${
                              operationStatus === status
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-600 text-gray-300 hover:bg-gray-700'
                            }`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-gray-700/50 rounded-xl p-4">
                      <label className="block text-sm text-gray-400 mb-3">배터리 상태</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['정상', '교체필요', '없음'].map(status => (
                          <button
                            key={status}
                            onClick={() => setBatteryStatus(status as AEDDevice['batteryStatus'])}
                            className={`py-2 px-3 text-sm rounded-lg font-medium transition-all ${
                              batteryStatus === status
                                ? status === '정상' ? 'bg-green-600 text-white'
                                  : status === '교체필요' ? 'bg-yellow-600 text-white'
                                  : 'bg-red-600 text-white'
                                : 'bg-gray-600 text-gray-300 hover:bg-gray-700'
                            }`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-700/50 rounded-xl p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                      <div>
                        <h4 className="text-lg font-semibold text-white">설치 위치 요약</h4>
                        <p className="text-sm text-gray-400">현장 접근성과 좌표를 확인하세요.</p>
                      </div>
                      <div className="text-sm text-gray-300">
                        좌표: {selectedDevice.lat || '-'}, {selectedDevice.lng || '-'}
                      </div>
                    </div>
                    <div className="bg-gray-800/60 rounded-xl border border-gray-700 p-4">
                      <div className="flex flex-col gap-2 text-sm text-gray-300">
                        <div><span className="text-gray-400">상세 위치:</span> {selectedDevice.locationDetail || '현장 확인 필요'}</div>
                        <div><span className="text-gray-400">운영상태:</span> {operationStatus}</div>
                        <div><span className="text-gray-400">배터리 상태:</span> {batteryStatus}</div>
                        <div><span className="text-gray-400">운영 안내:</span> {selectedDevice.operatingNotes || '추가 운영 정보 없음'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-700/50 rounded-xl p-4">
                    <h4 className="text-lg font-semibold text-white mb-2">GPS 및 좌표 상태</h4>
                    <p className="text-sm text-gray-300">
                      {selectedDevice.gpsIssue
                        ? `${selectedDevice.gpsIssue.type} (중요도: ${selectedDevice.gpsIssue.severity})`
                        : 'GPS 좌표 이상 없음'}
                    </p>
                  </div>

                  <div className="bg-gray-700/30 rounded-xl border border-gray-600 p-2">
                    <StorageChecklistSection
                      storageChecklist={storageChecklist}
                      setStorageChecklist={setStorageChecklist}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: 기능 점검 */}
            {currentStepIndex === 3 && (
              <div>
                <h3 className="text-base md:text-xl font-bold mb-3 text-green-400">기능 점검</h3>
                <div className="space-y-3">
                  {[
                    { id: 'power', label: '전원 ON/OFF 정상 작동' },
                    { id: 'indicator', label: '상태 표시등 정상 작동' },
                    { id: 'battery', label: '배터리 잔량 표시 정상' },
                    { id: 'voice', label: '음성 안내 정상 작동' },
                    { id: 'shock', label: '충격 버튼 정상 작동' },
                    { id: 'pads', label: '패드 연결 상태 양호' },
                    { id: 'selftest', label: '자가진단 기능 정상' },
                    { id: 'alarm', label: '알람 기능 정상' }
                  ].map((item) => (
                    <label key={item.id} className="flex items-center gap-3 bg-gray-700/50 rounded-xl p-4 cursor-pointer hover:bg-gray-700/70 transition-all">
                      <input
                        type="checkbox"
                        className="w-5 h-5 rounded border-gray-600 text-green-600 focus:ring-green-500 focus:ring-2"
                      />
                      <span className="text-white">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Step 5: 사진 촬영 */}
            {currentStepIndex === 4 && (
              <div>
                <h3 className="text-base md:text-xl font-bold mb-3 text-green-400">사진 촬영</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { type: 'front', label: '전면 사진', icon: '📷' },
                    { type: 'inside', label: '내부 사진', icon: '📸' },
                    { type: 'serial', label: '일련번호 사진', icon: '🔢' }
                  ].map((photo) => (
                    <div key={photo.type} className="bg-gray-700/50 rounded-xl p-4">
                      <div className="text-sm text-gray-400 mb-3">{photo.label}</div>
                      {capturedPhotos[photo.type as keyof typeof capturedPhotos] ? (
                        <div className="relative">
                          <div className="bg-gray-600 rounded-lg h-32 flex items-center justify-center">
                            <span className="text-4xl">{photo.icon}</span>
                          </div>
                          <button
                            onClick={() => handlePhotoCapture(photo.type as 'front' | 'inside' | 'serial')}
                            className="absolute bottom-2 right-2 bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg"
                          >
                            재촬영
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handlePhotoCapture(photo.type as 'front' | 'inside' | 'serial')}
                          className="w-full h-32 bg-gray-600 hover:bg-gray-700 rounded-lg flex flex-col items-center justify-center gap-2 transition-all"
                        >
                          <CameraIcon className="w-8 h-8 text-gray-400" />
                          <span className="text-sm text-gray-400">클릭하여 촬영</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 6: 최종 확인 */}
            {currentStepIndex === 5 && (
              <div>
                <h3 className="text-base md:text-xl font-bold mb-3 text-green-400">최종 확인</h3>
                <div className="space-y-4">
                  <div className="bg-gray-700/50 rounded-xl p-4">
                    <label className="block text-sm text-gray-400 mb-3">후속조치 필요 여부</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {(['이상없음', '현장권고완료', '추후권고대상'] as FollowUpAction[]).map(action => (
                        <button
                          key={action}
                          onClick={() => setFollowUpAction(action)}
                          className={`py-2 px-3 text-sm rounded-lg font-medium transition-all ${
                            followUpAction === action
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-600 text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  </div>

                  {followUpAction !== '이상없음' && (
                    <div className="bg-gray-700/50 rounded-xl p-4">
                      <label className="block text-sm text-gray-400 mb-2">조치사항</label>
                      <textarea
                        value={actionNotes}
                        onChange={(e) => setActionNotes(e.target.value)}
                        className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 border border-gray-600 focus:border-green-500 focus:outline-none"
                        rows={3}
                        placeholder="실시한 조치나 권고 내용을 입력하세요..."
                      />
                    </div>
                  )}

                  <div className="bg-gray-700/50 rounded-xl p-4">
                    <label className="block text-sm text-gray-400 mb-2">종합 평가</label>
                    <select className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 border border-gray-600 focus:border-green-500 focus:outline-none">
                      <option value="good">양호 - 정상 작동</option>
                      <option value="caution">주의 - 경미한 문제 발견</option>
                      <option value="danger">위험 - 즉시 조치 필요</option>
                      <option value="unusable">사용불가 - 교체 필요</option>
                    </select>
                  </div>
                  <div className="bg-gray-700/50 rounded-xl p-4">
                    <label className="block text-sm text-gray-400 mb-2">점검 메모</label>
                    <textarea
                      value={inspectionNotes}
                      onChange={(e) => setInspectionNotes(e.target.value)}
                      className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 border border-gray-600 focus:border-green-500 focus:outline-none"
                      rows={4}
                      placeholder="특이사항이나 추가 메모를 입력하세요..."
                    />
                  </div>
                  <div className="bg-green-900/20 border border-green-600/30 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircleIcon className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                      <div>
                        <div className="font-semibold text-green-400 mb-1">점검 완료 준비</div>
                        <div className="text-sm text-gray-300">
                          모든 점검 항목을 확인했습니다. &apos;점검 완료&apos; 버튼을 클릭하면 점검이 완료되고 보고서가 자동으로 생성됩니다.
                          <span className="block mt-2 text-gray-400">선택된 후속조치: {followUpAction}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {currentStepIndex > 0 && (
              <ActionButton
                variant="secondary"
                size="lg"
                fullWidth
                onClick={handlePreviousStep}
              >
                이전 단계
              </ActionButton>
            )}
            <ActionButton
              variant="primary"
              size="lg"
              icon={<ChevronRightIcon />}
              iconPosition="right"
              fullWidth
              onClick={handleNextStep}
              className={currentStepIndex === 0 ? 'sm:col-span-2' : ''}
            >
              {currentStepIndex === progressSteps.length - 1 ? '점검 완료' : '다음 단계'}
            </ActionButton>
            <ActionButton
              variant="danger"
              size="lg"
              fullWidth
              onClick={() => {
                if (confirm('점검을 중단하시겠습니까? 입력한 내용이 저장되지 않습니다.')) {
                  setSelectedView('list');
                  setCurrentStepIndex(0);
                  setInspectionStates({});
                  setSelectedDevice(null);
                  setShowValidationWarnings(false);
                }
              }}
            >
              점검 중단
            </ActionButton>
          </div>
        </div>

        {/* Photo Modal */}
        {showPhotoModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold text-white mb-4">사진 촬영 중...</h3>
              <div className="bg-gray-700 rounded-xl h-64 flex items-center justify-center animate-pulse">
                <CameraIcon className="w-16 h-16 text-gray-500" />
              </div>
              <div className="mt-4 text-center text-gray-400">
                {photoType === 'front' && '전면 사진을 촬영하고 있습니다...'}
                {photoType === 'inside' && '내부 사진을 촬영하고 있습니다...'}
                {photoType === 'serial' && '일련번호 사진을 촬영하고 있습니다...'}
              </div>
            </div>
          </div>
        )}
        <GuidelineViewerModal
          open={isGuidelineOpen}
          onClose={() => setIsGuidelineOpen(false)}
        />
      </div>
    );
  }

  if (selectedView === 'list') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="container mx-auto max-w-6xl px-4 py-6">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <button
                onClick={() => setSelectedView('dashboard')}
                className="mb-2 flex items-center gap-2 text-gray-400 transition-colors hover:text-white"
              >
                <ChevronLeftIcon />
                <span>대시보드로</span>
              </button>
              <h1 className="text-2xl font-bold">AED 점검 목록</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ActionButton
                variant="secondary"
                size="sm"
                onClick={() => setIsGuidelineOpen(true)}
              >
                지침보기
              </ActionButton>
              <ActionButton
                variant="primary"
                size="md"
                icon={<RefreshIcon />}
                onClick={handleRefresh}
                loading={isLoading}
              >
                새로고침
              </ActionButton>
            </div>
          </div>

          {/* Search and Filters */}
          <SmartSearch
            placeholder="기관명, 관리번호, 주소 검색..."
            onSearch={handleSearch}
            onFilterSelect={handleFilterSelect}
            quickFilters={quickFilters}
            className="mb-6"
          />

          {/* Device List */}
          <div className="space-y-4">
            {filteredDevices.map(device => (
              <SmartCard
                key={device.id}
                priority={device.priority}
                title={device.institution}
                subtitle={device.managementNumber}
                status={device.status === 'completed' ? '점검완료' : '점검필요'}
                metadata={[
                  { label: '위치', value: device.location },
                  {
                    label: '배터리',
                    value: `${calculateDaysRemaining(device.batteryExpiry)}일 남음`,
                    color: calculateDaysRemaining(device.batteryExpiry) < 30 ? 'red' : 'green'
                  },
                  {
                    label: '패드',
                    value: `${calculateDaysRemaining(device.padExpiry)}일 남음`,
                    color: calculateDaysRemaining(device.padExpiry) < 30 ? 'red' : 'green'
                  },
                  {
                    label: '최근 점검',
                    value: device.lastInspection
                  }
                ]}
                interactive
                onClick={() => handleDeviceSelect(device)}
                actions={
                  <ActionButton
                    variant="primary"
                    size="sm"
                    icon={<ChevronRightIcon />}
                    iconPosition="right"
                    fullWidth
                    onClick={() => handleDeviceSelect(device)}
                  >
                    점검 시작
                  </ActionButton>
                }
              />
            ))}
          </div>
        </div>
        <GuidelineViewerModal
          open={isGuidelineOpen}
          onClose={() => setIsGuidelineOpen(false)}
        />
      </div>
    );
  }

  // Dashboard View
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">AED Smart Inspector Pro</h1>
          <p className="text-gray-400">통합 점검 관리 시스템</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-red-900/20 border border-red-500/50 rounded-2xl p-4 backdrop-blur-sm">
            <div className="text-3xl font-bold text-red-400">{stats.urgent}</div>
            <div className="text-sm text-red-300 mt-1">긴급 점검</div>
          </div>
          <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-2xl p-4 backdrop-blur-sm">
            <div className="text-3xl font-bold text-yellow-400">{stats.warning}</div>
            <div className="text-sm text-yellow-300 mt-1">주의 필요</div>
          </div>
          <div className="bg-green-900/20 border border-green-500/50 rounded-2xl p-4 backdrop-blur-sm">
            <div className="text-3xl font-bold text-green-400">{stats.normal}</div>
            <div className="text-sm text-green-300 mt-1">정상 상태</div>
          </div>
          <div className="bg-blue-900/20 border border-blue-500/50 rounded-2xl p-4 backdrop-blur-sm">
            <div className="text-3xl font-bold text-blue-400">{stats.completed}/{stats.total}</div>
            <div className="text-sm text-blue-300 mt-1">점검 완료</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">빠른 작업</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ActionButton
              variant="primary"
              size="lg"
              icon={<PlusIcon />}
              fullWidth
              onClick={() => {
                setSelectedView('list');
                setSelectedDevice(null);
                setShowValidationWarnings(false);
              }}
            >
              점검 시작하기
            </ActionButton>
            <ActionButton
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() => router.push('/reports')}
            >
              보고서 확인
            </ActionButton>
            <ActionButton
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() => router.push('/map')}
            >
              지도 보기
            </ActionButton>
          </div>
        </div>

        {/* Recent Devices */}
        <div>
          <h2 className="text-xl font-semibold mb-4">우선 점검 대상</h2>
          <div className="space-y-4">
            {devices
              .filter(d => d.priority === 'urgent' || d.priority === 'warning')
              .slice(0, 3)
              .map(device => (
                <SmartCard
                  key={device.id}
                  priority={device.priority}
                  title={device.institution}
                  subtitle={device.managementNumber}
                  metadata={[
                    { label: '위치', value: device.location },
                    {
                      label: '긴급도',
                      value: device.priority === 'urgent' ? '매우 높음' : '높음',
                      color: device.priority === 'urgent' ? 'red' : 'yellow'
                    },
                    {
                      label: '배터리 만료',
                      value: `D-${calculateDaysRemaining(device.batteryExpiry)}`,
                      color: calculateDaysRemaining(device.batteryExpiry) < 30 ? 'red' : 'yellow'
                    }
                  ]}
                  interactive
                  onClick={() => handleDeviceSelect(device)}
                />
              ))}
          </div>
        </div>

        {/* Bottom Navigation Hint */}
        <div className="mt-8 text-center text-sm text-gray-500">
          더 많은 기능은 상단 메뉴를 이용하세요
        </div>
      </div>
      <GuidelineViewerModal
        open={isGuidelineOpen}
        onClose={() => setIsGuidelineOpen(false)}
      />
    </div>
  );
};

// Helper component for ChevronLeft icon
const ChevronLeftIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

export default Tutorial3Dashboard;
