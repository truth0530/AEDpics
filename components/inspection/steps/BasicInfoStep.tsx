'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useInspectionSessionStore } from '@/lib/state/inspection-session-store';
import { Button } from '@/components/ui/button';
import { waitForKakaoMaps } from '@/lib/constants/kakao';
import { ValidationWarning } from '../ValidationWarning';
import type { Category } from '@/lib/constants/aed-categories';

interface FieldChange {
  original: any;
  corrected: any;
  reason?: string;
}

const FIELDS = [
  { key: 'manager', label: '관리책임자', dbKey: 'manager' },
  { key: 'contact_info', label: '담당자 연락처', dbKey: 'institution_contact' },
  { key: 'address', label: '주소', dbKey: 'installation_address' },
  { key: 'installation_position', label: '설치위치', dbKey: 'installation_position' },
  { key: 'category_1', label: '대분류', dbKey: 'category_1' },
  { key: 'category_2', label: '중분류', dbKey: 'category_2' },
  { key: 'category_3', label: '소분류', dbKey: 'category_3' },
];

const DEVICE_INFO_FIELDS = [
  { key: 'external_display', label: '외부표출', dbKey: 'external_display' },
];

export function BasicInfoStep() {
  const session = useInspectionSessionStore((state) => state.session);
  const stepData = useInspectionSessionStore((state) => state.stepData);
  const updateStepData = useInspectionSessionStore((state) => state.updateStepData);
  const updateFieldChange = useInspectionSessionStore((state) => state.updateFieldChange);

  const basicInfo = (stepData.basicInfo || {}) as Record<string, any>;
  // 🆕 Week 3: current_snapshot 우선 사용
  const deviceInfo = (session?.current_snapshot || session?.device_info || {}) as Record<string, any>;

  // 전체 수정 모드 상태 관리
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLocationEditMode, setIsLocationEditMode] = useState(false);

  // ✅ 카테고리 상태 (API에서 동적 로드)
  const [category1Options, setCategory1Options] = useState<Category[]>([]);
  const [category2Options, setCategory2Options] = useState<Category[]>([]);
  const [category3Options, setCategory3Options] = useState<Category[]>([]);
  const [categoryHierarchy, setCategoryHierarchy] = useState<Record<string, Record<string, string[]>>>({});
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  // 지도 관련 state
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mapError, setMapError] = useState<string>('');

  // GPS 좌표
  const initialLat = deviceInfo.latitude || deviceInfo.gps_latitude || 37.5665;
  const initialLng = deviceInfo.longitude || deviceInfo.gps_longitude || 126.9780;
  const [currentLat, setCurrentLat] = useState(initialLat);
  const [currentLng, setCurrentLng] = useState(initialLng);
  const [hasMovedMarker, setHasMovedMarker] = useState(false);

  // 초기 데이터 설정
  useEffect(() => {
    if (!basicInfo.initialized && deviceInfo && Object.keys(deviceInfo).length > 0) {
      const initialData: Record<string, any> = {
        initialized: true,
        gps_latitude: initialLat,
        gps_longitude: initialLng,
      };

      FIELDS.forEach((field) => {
        initialData[field.key] = deviceInfo[field.dbKey] || '';
      });

      updateStepData('basicInfo', initialData);
      setCurrentLat(initialLat);
      setCurrentLng(initialLng);
    }
  }, [deviceInfo, basicInfo.initialized, updateStepData]);

  // 카카오맵 초기화
  useEffect(() => {
    let cancelled = false;

    waitForKakaoMaps()
      .then(() => {
        if (cancelled || !mapRef.current) return;

        const options = {
          center: new window.kakao.maps.LatLng(currentLat, currentLng),
          level: 3,
        };

        const mapInstance = new window.kakao.maps.Map(mapRef.current, options);
        setMap(mapInstance);

        // AED 마커 추가 (카카오 기본 마커)
        const markerPosition = new window.kakao.maps.LatLng(currentLat, currentLng);
        const markerInstance = new window.kakao.maps.Marker({
          position: markerPosition,
          map: mapInstance,
          draggable: true,
        });

        setMarker(markerInstance);

        // 마커 드래그 이벤트
        window.kakao.maps.event.addListener(markerInstance, 'dragstart', () => {
          setIsDragging(true);
        });

        window.kakao.maps.event.addListener(markerInstance, 'dragend', () => {
          const position = markerInstance.getPosition();
          const newLat = position.getLat();
          const newLng = position.getLng();

          setCurrentLat(newLat);
          setCurrentLng(newLng);
          setHasMovedMarker(true);
          updateStepData('basicInfo', {
            ...basicInfo,
            gps_latitude: newLat,
            gps_longitude: newLng,
          });
          setIsDragging(false);
        });

        // 줌 컨트롤 추가
        const zoomControl = new window.kakao.maps.ZoomControl();
        mapInstance.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);

        setIsMapLoaded(true);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to load Kakao Maps:', error);
        setMapError('지도를 불러올 수 없습니다');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ✅ 카테고리 데이터 로드 (API에서 동적으로)
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/aed-data/categories');
        if (response.ok) {
          const data = await response.json();
          // category_1: 문자열 배열을 Category 객체로 변환
          const cat1Options = (data.category_1 || []).map((v: string) => ({ label: v, value: v }));
          setCategory1Options(cat1Options);
          setCategory2Options((data.category_2 || []).map((v: string) => ({ label: v, value: v })));
          setCategory3Options((data.category_3 || []).map((v: string) => ({ label: v, value: v })));

          // 계층적 데이터도 저장
          if (data.hierarchical) {
            console.log('[BasicInfoStep] Hierarchical data loaded:', data.hierarchical);
            setCategoryHierarchy(data.hierarchical);
          } else {
            console.warn('[BasicInfoStep] No hierarchical data in response');
          }
        }
      } catch (error) {
        console.error('[BasicInfoStep] Error loading categories:', error);
      } finally {
        setCategoriesLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // 현재 위치로 이동
  const moveToCurrentLocation = () => {
    if (navigator.geolocation && map && marker) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const newPosition = new window.kakao.maps.LatLng(lat, lng);

          map.setCenter(newPosition);
          marker.setPosition(newPosition);

          setCurrentLat(lat);
          setCurrentLng(lng);
          setHasMovedMarker(true);
          updateStepData('basicInfo', {
            ...basicInfo,
            gps_latitude: lat,
            gps_longitude: lng,
          });
        },
        (error) => {
          console.error('위치 정보를 가져올 수 없습니다:', error);
        }
      );
    }
  };

  // 📌 수정 모드 진입 시 원본 값을 기반으로 상위 카테고리를 설정
  // (category_2/3이 선택되지 않으면 상위 카테고리를 채워넣음)
  useEffect(() => {
    if (isEditMode && !basicInfo.category_1 && (deviceInfo.category_1 || deviceInfo.category_2 || deviceInfo.category_3)) {
      // 수정 모드 진입 시 category_1이 없으면 원본 값으로 설정
      const originalCat1 = deviceInfo.category_1 || '';
      if (originalCat1 && Object.keys(categoryHierarchy).length > 0 && categoryHierarchy[originalCat1]) {
        const updatedInfo: Record<string, any> = {
          ...basicInfo,
          category_1: originalCat1,
        };

        // category_2도 함께 설정 (있으면)
        const cat1Data = categoryHierarchy[originalCat1] as Record<string, any>;
        if (deviceInfo.category_2 && cat1Data && cat1Data[deviceInfo.category_2]) {
          updatedInfo.category_2 = deviceInfo.category_2;
        }

        updateStepData('basicInfo', updatedInfo);
      }
    }
  }, [isEditMode, categoryHierarchy, deviceInfo.category_1, deviceInfo.category_2, basicInfo.category_1, basicInfo.category_2]);

  // 기본정보 필드들(주소/설치위치 제외)
  const BASIC_INFO_FIELDS = FIELDS.filter((f) => f.key !== 'address' && f.key !== 'installation_position');

  // 기본정보가 원본과 일치하는지 확인
  const isBasicInfoMatching = useMemo(() => {
    return BASIC_INFO_FIELDS.every((field) => {
      const originalValue = deviceInfo[field.dbKey] || '';
      const currentValue = basicInfo[field.key] || '';
      // 빈 값은 일치로 간주하지 않음
      if (!originalValue.trim() || !currentValue.trim()) {
        return false;
      }
      return originalValue === currentValue;
    });
  }, [basicInfo, deviceInfo, BASIC_INFO_FIELDS]);

  // "전체 일치" 버튼 - 모든 등록 데이터를 점검 데이터로 복사
  const handleMatchAll = () => {
    // 실제로 일치하지 않으면 아무것도 하지 않음
    if (!isBasicInfoMatching) {
      return;
    }

    // 필수 필드가 비어있는지 확인
    const hasEmptyRequired = BASIC_INFO_FIELDS.some((field) => {
      const value = deviceInfo[field.dbKey] || '';
      return !value.trim();
    });

    // 필수 필드가 비어있으면 경고하고 실행하지 않음
    if (hasEmptyRequired) {
      alert('등록된 정보에 비어있는 필수 항목이 있습니다. "수정" 버튼을 눌러 정보를 입력해주세요.');
      return;
    }

    const updatedInfo = { ...basicInfo, all_matched: true };

    BASIC_INFO_FIELDS.forEach((field) => {
      const originalValue = deviceInfo[field.dbKey] || '';
      updatedInfo[field.key] = originalValue;

      // field_changes에서 제거 (일치하므로)
      updateFieldChange(field.key, {
        original: originalValue,
        corrected: originalValue,
        reason: '',
      });
    });

    updateStepData('basicInfo', updatedInfo);
  };

  // "전체 수정" 버튼 - 수정 모드 활성화 또는 수정 완료
  const handleEditAll = () => {
    if (isEditMode) {
      // 수정 모드에서 "확인" 버튼 클릭
      // 원본과 동일하면 저장하지 않음
      if (isBasicInfoMatching) {
        return;
      }

      // field_changes 업데이트
      BASIC_INFO_FIELDS.forEach((field) => {
        const originalValue = deviceInfo[field.dbKey] || '';
        const currentValue = basicInfo[field.key] || '';

        if (currentValue !== originalValue && currentValue.trim() !== '') {
          updateFieldChange(field.key, {
            original: originalValue,
            corrected: currentValue,
            reason: basicInfo.edit_reason || '',
          });
        }
      });

      updateStepData('basicInfo', { ...basicInfo, all_matched: 'edited' });
      setIsEditMode(false);
    } else if (basicInfo.all_matched === 'edited' && !isBasicInfoMatching) {
      // 수정됨 상태에서 다시 수정 모드로
      setIsEditMode(true);
    } else if (basicInfo.all_matched === true || !basicInfo.all_matched) {
      // 일치 확인됨 상태 또는 초기 상태에서 수정 모드로
      setIsEditMode(true);
    }
  };

  // 수정 취소
  const handleCancelEdit = () => {
    setIsEditMode(false);
  };

  // 설치 주소/위치 원본 값과 비교
  const isLocationMatching = useMemo(() => {
    const currentAddress = basicInfo.address || '';
    const currentPosition = basicInfo.installation_position || '';
    const originalAddress = deviceInfo.installation_address || '';
    const originalPosition = deviceInfo.installation_position || '';
    // 빈 값은 일치로 간주하지 않음
    if (!originalAddress.trim() || !currentAddress.trim() || !originalPosition.trim() || !currentPosition.trim()) {
      return false;
    }
    return currentAddress === originalAddress && currentPosition === originalPosition;
  }, [basicInfo.address, basicInfo.installation_position, deviceInfo.installation_address, deviceInfo.installation_position]);

  // 설치 주소/위치 일치 처리
  const handleLocationMatch = () => {
    if (isLocationMatching) {
      updateStepData('basicInfo', { ...basicInfo, location_matched: true });
    }
  };

  // 설치 주소/위치 수정 모드 활성화
  const handleLocationEdit = () => {
    setIsLocationEditMode(true);
  };

  // 설치 주소/위치 수정 완료
  const handleLocationSaveEdit = () => {
    // 원본과 같으면 아무 것도 하지 않음
    if (isLocationMatching) {
      return;
    }

    // field_changes 업데이트
    const addressField = FIELDS[2]; // 주소 (인덱스 수정)
    const positionField = FIELDS[3]; // 설치위치 (인덱스 수정)

    const originalAddress = deviceInfo[addressField.dbKey] || '';
    const currentAddress = basicInfo[addressField.key] || '';
    const originalPosition = deviceInfo[positionField.dbKey] || '';
    const currentPosition = basicInfo[positionField.key] || '';

    if (currentAddress !== originalAddress && currentAddress.trim() !== '') {
      updateFieldChange(addressField.key, {
        original: originalAddress,
        corrected: currentAddress,
        reason: '',
      });
    }

    if (currentPosition !== originalPosition && currentPosition.trim() !== '') {
      updateFieldChange(positionField.key, {
        original: originalPosition,
        corrected: currentPosition,
        reason: '',
      });
    }

    updateStepData('basicInfo', { ...basicInfo, location_matched: 'edited' });
    setIsLocationEditMode(false);
  };

  // 설치 주소/위치 수정 취소
  const handleLocationCancelEdit = () => {
    setIsLocationEditMode(false);
  };

  // 입력값 변경
  const handleChange = (field: { key: string; dbKey: string }, value: string) => {
    const updatedInfo = {
      ...basicInfo,
      [field.key]: value,
      all_matched: false,
    };
    updateStepData('basicInfo', updatedInfo);
  };

  // Category 필드용 드롭다운 옵션 계산 (API 데이터 사용)
  const getCategoryOptions = (fieldKey: string, isEditingMode: boolean = false): Category[] => {
    if (fieldKey === 'category_1') {
      return category1Options;
    } else if (fieldKey === 'category_2') {
      // ✅ 수정 모드일 때 항상 계층적 데이터 사용 (더 정확한 필터링)
      if (isEditingMode && basicInfo.category_1) {
        // categoryHierarchy가 있으면 사용
        if (Object.keys(categoryHierarchy).length > 0 && categoryHierarchy[basicInfo.category_1]) {
          const cat2Keys = Object.keys(categoryHierarchy[basicInfo.category_1]);
          return cat2Keys.map((v) => ({ label: v, value: v }));
        }
        // categoryHierarchy가 없으면 전체 옵션 중에서 같은 category_1을 가진 것만 필터링
        // (이 경우는 API 데이터 구조에 따라 다를 수 있음)
      }
      // 비편집 모드: 전체 category2 옵션 반환
      return category2Options;
    } else if (fieldKey === 'category_3') {
      // ✅ 수정 모드일 때 항상 계층적 데이터 사용
      if (isEditingMode && basicInfo.category_1 && basicInfo.category_2) {
        // categoryHierarchy가 있으면 사용
        if (Object.keys(categoryHierarchy).length > 0 && categoryHierarchy[basicInfo.category_1]?.[basicInfo.category_2]) {
          const cat3Array = categoryHierarchy[basicInfo.category_1][basicInfo.category_2];
          return cat3Array.map((v) => ({ label: v, value: v }));
        }
        // categoryHierarchy가 없으면 전체 옵션 반환
      }
      // 비편집 모드: 전체 category3 옵션 반환
      return category3Options;
    }
    return [];
  };

  const renderField = (field: { key: string; label: string; dbKey: string; readonly?: boolean }, editMode?: boolean) => {
    const originalValue = deviceInfo[field.dbKey] || '';
    const currentValue = basicInfo[field.key] || '';
    const isEditing = editMode !== undefined ? editMode : isEditMode;
    const isCategory = field.key.startsWith('category_');

    // ✅ 수정됨 상태일 때는 currentValue를 표시
    const displayValue = (basicInfo.all_matched === 'edited' && currentValue) ? currentValue : originalValue;

    // Category 필드에 대한 옵션 가져오기 (수정 모드일 때 isEditing 전달)
    const categoryOptions = isCategory ? getCategoryOptions(field.key, isEditing) : [];

    return (
      <div key={field.key} className="space-y-1">
        {/* 필드명 */}
        <div className="text-[10px] font-medium text-gray-400">
          {field.label}
        </div>

        {/* 데이터 */}
        {!isEditing || field.readonly ? (
          <div className={`text-xs font-medium truncate ${field.readonly ? 'text-gray-300' : 'text-gray-100'}`}>
            {displayValue || '-'}
          </div>
        ) : isCategory ? (
          // ✅ Category 필드: Select 드롭다운
          <select
            value={currentValue || originalValue || ''}
            onChange={(e) => {
              const newValue = e.target.value;

              // 📌 선택한 값이 현재 옵션에 없으면 경고하고 무시
              if (newValue && !categoryOptions.find(opt => opt.value === newValue)) {
                console.warn(`[CategorySelect] Selected value "${newValue}" not found in current options for ${field.key}`, {
                  field: field.key,
                  selectedValue: newValue,
                  availableOptions: categoryOptions,
                  hierarchy: categoryHierarchy,
                  category_1: basicInfo.category_1,
                  category_2: basicInfo.category_2,
                });
                // 옵션에 없으면 변경하지 않음
                return;
              }

              const updatedInfo = {
                ...basicInfo,
                [field.key]: newValue,
                all_matched: false,
              };

              // 상위 카테고리 변경 시 하위 카테고리 초기화
              if (field.key === 'category_1') {
                updatedInfo.category_2 = '';
                updatedInfo.category_3 = '';
              } else if (field.key === 'category_2') {
                updatedInfo.category_3 = '';
              }

              updateStepData('basicInfo', updatedInfo);
            }}
            className="w-full rounded-lg px-2 py-1.5 bg-gray-800 border border-gray-600 text-xs text-white placeholder-gray-500 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 appearance-none"
          >
            {(currentValue || originalValue) ? null : <option value="">선택해주세요</option>}
            {/* 현재 값이 옵션에 없으면 회색으로 표시 (사용자에게 혼란 방지) */}
            {(currentValue || originalValue) && !categoryOptions.find(opt => opt.value === (currentValue || originalValue)) && (
              <option value={currentValue || originalValue} style={{ color: '#999' }}>
                {currentValue || originalValue} (원본 데이터)
              </option>
            )}
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          // ✅ 일반 필드: Text Input
          <input
            type="text"
            value={currentValue}
            onChange={(e) => handleChange(field, e.target.value)}
            onFocus={(e) => {
              // 커서를 텍스트 끝으로 이동
              const len = e.target.value.length;
              e.target.setSelectionRange(len, len);
            }}
            className="w-full rounded-lg px-2 py-1.5 bg-gray-800 border border-gray-600 text-xs text-white placeholder-gray-500 focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
            placeholder="현장 정보 입력"
          />
        )}
      </div>
    );
  };

  // 수정된 필드가 있는지 확인 (기본정보 필드만)
  const hasChanges = BASIC_INFO_FIELDS.some((field) => {
    const originalValue = deviceInfo[field.dbKey] || '';
    const currentValue = basicInfo[field.key] || '';
    return originalValue !== currentValue && currentValue.trim() !== '';
  });

  // 실시간 필수 항목 검증
  const missingFields = useMemo(() => {
    const missing: string[] = [];

    // 모든 필수 항목이 헤더에 표시되므로 별도 검증 불필요

    return missing;
  }, []);

  return (
    <div className="space-y-2">
      {/* 통합된 기본 정보 */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
        {/* 기본 정보 */}
        <div className="space-y-2">
          {/* 첫 번째 행: 관리책임자, 담당자 연락처, 외부표출 */}
          <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 3.1fr 2.9fr' }}>
            {renderField(FIELDS[0])} {/* 관리책임자 */}
            {renderField(FIELDS[1])} {/* 담당자 연락처 */}
            {/* 외부표출 */}
            <div className="space-y-1">
              <div className="text-[10px] font-medium text-gray-400 whitespace-nowrap">외부표출</div>
              <div className="text-xs font-medium text-gray-100 whitespace-nowrap">
                {deviceInfo.external_display || '데이터없음'}
              </div>
            </div>
          </div>

          {/* 두 번째 행: 분류체계 (대분류, 중분류, 소분류) */}
          <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 3fr 3fr' }}>
            {renderField(FIELDS[4])} {/* 대분류 */}
            {renderField(FIELDS[5])} {/* 중분류 */}
            {renderField(FIELDS[6])} {/* 소분류 */}
          </div>
        </div>

        {/* 수정 모드: 수정 사유 입력 */}
        {isEditMode && hasChanges && (
          <div className="mt-3 pt-3 border-t border-gray-700/50">
            <label htmlFor="edit_reason" className="block text-xs font-medium text-gray-400 mb-1.5">
              수정 사유
            </label>
            <input
              id="edit_reason"
              type="text"
              value={basicInfo.edit_reason || ''}
              onChange={(e) => updateStepData('basicInfo', { ...basicInfo, edit_reason: e.target.value })}
              className="block w-full rounded-lg px-3 py-1.5 bg-gray-800 border border-gray-600 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              placeholder="수정 사유를 입력하세요"
            />
          </div>
        )}

        {/* 전체 일치/수정 버튼 */}
        <div className="mt-3">
          <div className="flex gap-2 max-w-[60%] mx-auto">
            <button
              type="button"
              onClick={() => {
                if (isEditMode) {
                  handleCancelEdit();
                } else {
                  handleMatchAll();
                }
              }}
              disabled={basicInfo.all_matched === true || (!isEditMode && !isBasicInfoMatching)}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                basicInfo.all_matched === true
                  ? 'bg-green-600/30 border-2 border-green-500 text-green-200 cursor-default shadow-lg shadow-green-500/20'
                  : isBasicInfoMatching && !isEditMode
                  ? 'bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-green-500/50 active:bg-gray-500'
                  : isEditMode
                  ? 'bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300'
                  : 'bg-gray-800/50 border border-gray-700/50 text-gray-600 cursor-not-allowed'
              }`}
            >
              {isEditMode ? (
                '취소'
              ) : basicInfo.all_matched === true ? (
                <span className="flex items-center justify-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  전체 일치 확인됨
                </span>
              ) : basicInfo.all_matched === 'edited' && isBasicInfoMatching ? (
                '일치로 변경'
              ) : (
                '전체 일치'
              )}
            </button>
            <button
              type="button"
              onClick={handleEditAll}
              disabled={(isEditMode && isBasicInfoMatching) || (basicInfo.all_matched === 'edited' && isBasicInfoMatching)}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                isEditMode
                  ? isBasicInfoMatching
                    ? 'bg-gray-800/50 border border-gray-700/50 text-gray-500 cursor-not-allowed'
                    : 'bg-yellow-600 hover:bg-yellow-700 border-2 border-yellow-500 text-white shadow-lg shadow-yellow-500/20'
                  : basicInfo.all_matched === 'edited'
                  ? isBasicInfoMatching
                    ? 'bg-gray-800/50 border border-gray-700/50 text-gray-600 cursor-not-allowed'
                    : 'bg-yellow-600/30 border-2 border-yellow-500 text-yellow-200 cursor-default shadow-lg shadow-yellow-500/20'
                  : 'bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-yellow-500/50 active:bg-gray-500'
              }`}
            >
              {isEditMode ? (
                isBasicInfoMatching ? (
                  '원본과 동일'
                ) : (
                  <span className="flex items-center justify-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    확인
                  </span>
                )
              ) : basicInfo.all_matched === 'edited' ? (
                isBasicInfoMatching ? (
                  '원본과 동일'
                ) : (
                  <span className="flex items-center justify-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                    수정됨
                  </span>
                )
              ) : (
                '수정'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 지도 섹션 */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-white text-sm">위치 정보</h4>
          {isDragging && (
            <div className="text-xs text-yellow-400 animate-pulse">
              위치 수정 중...
            </div>
          )}
        </div>

        {/* GPS 좌표 정보 */}
        <div className="flex items-center gap-1 mb-2">
          <div className="text-[10px] sm:text-xs font-medium text-gray-400">GPS 위도</div>
          <div className="text-[10px] sm:text-sm font-medium text-gray-300 font-mono">
            {currentLat.toFixed(7)}
          </div>
          <div className="text-[10px] sm:text-xs font-medium text-gray-400 ml-3 sm:ml-4">GPS 경도</div>
          <div className="text-[10px] sm:text-sm font-medium text-gray-300 font-mono">
            {currentLng.toFixed(7)}
          </div>
        </div>

        {/* 카카오 지도 */}
        <div className="relative">
          <div
            ref={mapRef}
            className="w-full h-48 rounded-lg overflow-hidden border border-gray-700"
          />

          {/* 로딩 오버레이 */}
          {!isMapLoaded && !mapError && (
            <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center rounded-lg">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin mb-2"></div>
                <p className="text-gray-300 text-sm">지도 로딩 중...</p>
              </div>
            </div>
          )}

          {/* 에러 메시지 */}
          {mapError && (
            <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center rounded-lg">
              <div className="text-center">
                <p className="text-red-400 text-sm mb-2">{mapError}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="text-xs text-gray-400 underline"
                >
                  페이지 새로고침
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 지도 컨트롤 버튼 */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button
            onClick={moveToCurrentLocation}
            className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-2 rounded-lg text-xs transition-colors touch-manipulation whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!isMapLoaded}
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
            </svg>
            <span>현재 위치로 이동</span>
          </button>
          <button
            onClick={() => {
              updateStepData('basicInfo', { ...basicInfo, gps_verified: true });
              // ✅ 시각적 피드백 추가
              const btn = document.activeElement as HTMLButtonElement;
              if (btn) {
                btn.classList.add('ring-2', 'ring-green-400');
                setTimeout(() => btn.classList.remove('ring-2', 'ring-green-400'), 1000);
              }
            }}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs transition-all font-semibold touch-manipulation whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
              basicInfo.gps_verified
                ? 'bg-green-600/30 border-2 border-green-500 text-green-200'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
            disabled={!isMapLoaded}
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            <span>
              {basicInfo.gps_verified 
                ? '위치 확인됨' 
                : hasMovedMarker 
                ? '변경된 위치로 저장' 
                : '설치위치와 동일'
              }
            </span>
          </button>
        </div>

        <div className="mt-2">
          <p className="text-xs text-gray-400">
            실제 위치와 다른 경우 마커를 드래그하여 이동해주세요
          </p>
        </div>
      </div>

      {/* 위치정보 */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
        {/* 주소와 설치위치 바로 표시 (수정 모드가 아닐 때) */}
        {!isLocationEditMode && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div className="space-y-1">
              <div className="text-[10px] font-medium text-gray-400">주소</div>
              <div className="text-xs font-medium text-gray-100">
                {basicInfo.location_matched === 'edited'
                  ? (basicInfo.address || '-')
                  : (deviceInfo.installation_address || '-')}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] font-medium text-gray-400">설치위치</div>
              <div className="text-xs font-medium text-gray-100">
                {basicInfo.location_matched === 'edited'
                  ? (basicInfo.installation_position || '-')
                  : (deviceInfo.installation_position || '-')}
              </div>
            </div>
          </div>
        )}

        {/* 수정 모드일 때만 입력 필드 표시 */}
        {isLocationEditMode && (
          <div className="mb-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
              <div>
                {renderField(FIELDS[2], true)} {/* 주소 (인덱스 수정) */}
              </div>
              <div>
                {renderField(FIELDS[3], true)} {/* 설치위치 (인덱스 수정) */}
              </div>
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              등록 정보: {deviceInfo.installation_address || '없음'} / {deviceInfo.installation_position || '없음'}
            </div>
          </div>
        )}

        {/* 상태 표시 */}
        {basicInfo.location_matched === true && !isLocationEditMode && (
          <div className="mb-3 rounded-lg px-2.5 py-1.5 bg-green-600/10 border border-green-600/50 text-sm text-green-300 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>일치 확인됨</span>
          </div>
        )}

        {basicInfo.location_matched === 'edited' && !isLocationEditMode && (
          <div className="mb-3 rounded-lg px-2.5 py-1.5 bg-yellow-600/10 border border-yellow-600/50 text-sm text-yellow-300 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
            <span>수정됨</span>
          </div>
        )}

        {/* 일치/수정 버튼 */}
        <div>
          <div className="flex gap-2 max-w-[60%] mx-auto">
            <button
              type="button"
              onClick={() => {
                if (isLocationEditMode) {
                  handleLocationCancelEdit();
                } else {
                  handleLocationMatch();
                }
              }}
              disabled={basicInfo.location_matched === true || (!isLocationEditMode && !isLocationMatching)}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                basicInfo.location_matched === true
                  ? 'bg-green-600/30 border-2 border-green-500 text-green-200 cursor-default shadow-lg shadow-green-500/20'
                  : isLocationMatching && !isLocationEditMode
                  ? 'bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-green-500/50 active:bg-gray-500'
                  : isLocationEditMode
                  ? 'bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300'
                  : 'bg-gray-800/50 border border-gray-700/50 text-gray-600 cursor-not-allowed'
              }`}
            >
              {isLocationEditMode ? (
                '취소'
              ) : basicInfo.location_matched === true ? (
                <span className="flex items-center justify-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  일치 확인됨
                </span>
              ) : basicInfo.location_matched === 'edited' && isLocationMatching ? (
                '일치로 변경'
              ) : (
                '일치'
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                if (isLocationEditMode) {
                  handleLocationSaveEdit();
                } else {
                  handleLocationEdit();
                }
              }}
              disabled={(isLocationEditMode && isLocationMatching) || (basicInfo.location_matched === 'edited' && isLocationMatching)}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                isLocationEditMode
                  ? isLocationMatching
                    ? 'bg-gray-800/50 border border-gray-700/50 text-gray-500 cursor-not-allowed'
                    : 'bg-yellow-600 hover:bg-yellow-700 border-2 border-yellow-500 text-white shadow-lg shadow-yellow-500/20'
                  : basicInfo.location_matched === 'edited'
                  ? isLocationMatching
                    ? 'bg-gray-800/50 border border-gray-700/50 text-gray-600 cursor-not-allowed'
                    : 'bg-yellow-600/30 border-2 border-yellow-500 text-yellow-200 cursor-default shadow-lg shadow-yellow-500/20'
                  : 'bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-yellow-500/50 active:bg-gray-500'
              }`}
            >
              {isLocationEditMode ? (
                isLocationMatching ? (
                  '원본과 동일'
                ) : (
                  <span className="flex items-center justify-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    확인
                  </span>
                )
              ) : basicInfo.location_matched === 'edited' ? (
                isLocationMatching ? (
                  '원본과 동일'
                ) : (
                  <span className="flex items-center justify-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                    수정됨
                  </span>
                )
              ) : (
                '수정'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 실시간 필수항목 검증 경고 */}
      <ValidationWarning missingFields={missingFields} />
    </div>
  );
}
