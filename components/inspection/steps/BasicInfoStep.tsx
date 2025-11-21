'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useInspectionSessionStore } from '@/lib/state/inspection-session-store';
import type { AccessibilityData } from '@/lib/state/inspection-session-store';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { waitForKakaoMaps } from '@/lib/constants/kakao';
import { ValidationWarning } from '../ValidationWarning';
import { ImprovedWeeklyScheduleInput } from '../ImprovedWeeklyScheduleInput';
import { EditableSectionButtons } from '../EditableSectionButtons';
import type { ImprovedWeeklySchedule } from '../ImprovedWeeklyScheduleInput';
import type { Category } from '@/lib/constants/aed-categories';
import {
  CATEGORY_HIERARCHY,
  CATEGORY_1_OPTIONS,
  getAllCategory2Options,
  getAllCategory3Options
} from '@/lib/constants/category-hierarchy';

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

  // ✅ SSR-safe: Roadview 기본 상태는 false로 시작, 클라이언트에서 화면 크기에 따라 설정
  const [showRoadview, setShowRoadview] = useState(false);

  // ✅ 카테고리 상태 (API에서 동적 로드)
  const [category1Options, setCategory1Options] = useState<Category[]>([]);
  const [category2Options, setCategory2Options] = useState<Category[]>([]);
  const [category3Options, setCategory3Options] = useState<Category[]>([]);
  const [categoryHierarchy, setCategoryHierarchy] = useState<Record<string, Record<string, string[]>>>({});
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  // 지도 관련 state
  const mapRef = useRef<HTMLDivElement>(null);
  const roadviewRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mapError, setMapError] = useState<string>('');
  const [roadviewError, setRoadviewError] = useState<string>('');

  // GPS 좌표
  const initialLat = deviceInfo.latitude || deviceInfo.gps_latitude || null;
  const initialLng = deviceInfo.longitude || deviceInfo.gps_longitude || null;
  const [currentLat, setCurrentLat] = useState<number | null>(initialLat);
  const [currentLng, setCurrentLng] = useState<number | null>(initialLng);
  const [hasMovedMarker, setHasMovedMarker] = useState(false);

  // ✅ SSR-safe: 클라이언트에서 화면 크기에 따라 Roadview 기본 상태 설정
  // PC (>= 1024px): expanded, Mobile (< 1024px): collapsed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDesktop = window.innerWidth >= 1024;
      setShowRoadview(isDesktop);
    }
  }, []);

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

      // 외부표출 필드 추가
      DEVICE_INFO_FIELDS.forEach((field) => {
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

        // 좌표가 없으면 서울 시청을 중심으로 설정
        const centerLat = currentLat || 37.5665;
        const centerLng = currentLng || 126.9780;

        const options = {
          center: new window.kakao.maps.LatLng(centerLat, centerLng),
          level: 1, // 최대 확대 (현장 점검용)
        };

        const mapInstance = new window.kakao.maps.Map(mapRef.current, options);
        setMap(mapInstance);

        // 마커 생성 및 이벤트 연결 함수
        const createMarker = (lat: number, lng: number) => {
          const markerPosition = new window.kakao.maps.LatLng(lat, lng);
          // @ts-ignore - Marker API
          const newMarker = new window.kakao.maps.Marker({
            position: markerPosition,
            map: mapInstance,
            draggable: true,
          });

          // 마커 드래그 이벤트
          window.kakao.maps.event.addListener(newMarker, 'dragstart', () => {
            setIsDragging(true);
          });

          window.kakao.maps.event.addListener(newMarker, 'dragend', () => {
            setIsDragging(false);
            const position = newMarker.getPosition();
            const lat = position.getLat();
            const lng = position.getLng();

            setCurrentLat(lat);
            setCurrentLng(lng);
            setHasMovedMarker(true);

            const currentBasicInfo = (useInspectionSessionStore.getState().stepData.basicInfo || {}) as Record<string, unknown>;
            updateStepData('basicInfo', {
              ...currentBasicInfo,
              gps_latitude: lat,
              gps_longitude: lng,
              gps_verified: false,
            });
          });

          return newMarker;
        };

        // 좌표가 있을 때만 마커 생성
        let currentMarker: any = null;
        if (currentLat && currentLng) {
          currentMarker = createMarker(currentLat, currentLng);
          setMarker(currentMarker);
        }

        // 지도 클릭 이벤트 (마커 이동/생성)
        window.kakao.maps.event.addListener(mapInstance, 'click', function (mouseEvent: any) {
          const latlng = mouseEvent.latLng;
          const lat = latlng.getLat();
          const lng = latlng.getLng();

          if (currentMarker) {
            currentMarker.setPosition(latlng);
          } else {
            currentMarker = createMarker(lat, lng);
            setMarker(currentMarker);
          }

          setCurrentLat(lat);
          setCurrentLng(lng);
          setHasMovedMarker(true);

          const currentBasicInfo = (useInspectionSessionStore.getState().stepData.basicInfo || {}) as Record<string, unknown>;
          updateStepData('basicInfo', {
            ...currentBasicInfo,
            gps_latitude: lat,
            gps_longitude: lng,
            gps_verified: false,
          });
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

  // 로드뷰 초기화
  useEffect(() => {
    if (!showRoadview || !roadviewRef.current) return;

    // 좌표가 없으면 로드뷰를 초기화하지 않음
    if (!currentLat || !currentLng) {
      setRoadviewError('좌표가 없으니 실제 위치로 마커를 움직여 좌표를 지정해주세요');
      return;
    }

    // 로드뷰 초기화
    const initializeRoadview = async () => {
      await waitForKakaoMaps();

      if (!roadviewRef.current) return;

      try {
        // @ts-ignore - Roadview API
        const roadviewInstance = new window.kakao.maps.Roadview(roadviewRef.current);
        const position = new window.kakao.maps.LatLng(currentLat, currentLng);

        // @ts-ignore - RoadviewClient API
        const rvClient = new window.kakao.maps.RoadviewClient();

        // 검색 반경을 단계적으로 증가시키며 재시도
        const searchRadii = [50, 100, 200];
        let foundPanoId = false;

        const tryWithRadius = (radiusIndex: number) => {
          if (radiusIndex >= searchRadii.length) {
            // 모든 반경에서 실패
            const errorMessage = '해당 위치에서 로드뷰를 사용할 수 없습니다';
            console.warn(errorMessage);
            setRoadviewError(errorMessage);
            return;
          }

          const radius = searchRadii[radiusIndex];
          console.log(`로드뷰 검색 시도: 반경 ${radius}m`);

          rvClient.getNearestPanoId(position, radius, (panoId: string | null) => {
            console.log(`로드뷰 파노라마 ID (${radius}m):`, panoId);

            if (!panoId) {
              // 다음 반경으로 재시도
              tryWithRadius(radiusIndex + 1);
              return;
            }

            // 성공
            foundPanoId = true;
            setRoadviewError('');
            roadviewInstance.setPanoId(panoId, position);
          });
        };

        tryWithRadius(0);

        // 로드뷰가 로드된 후 커스텀 오버레이 추가
        window.kakao.maps.event.addListener(roadviewInstance, 'init', () => {
          console.log('로드뷰 init 이벤트 발생');
          try {
            // 컨테이너 생성
            const overlayContent = document.createElement('div');
            overlayContent.style.cssText = 'display: flex; flex-direction: column; align-items: center;';

            // 원형 배경 생성
            const circle = document.createElement('div');
            circle.style.cssText = `
              width: 48px;
              height: 48px;
              background-color: #22c55e;
              border-radius: 50%;
              box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
              border: 2px solid white;
              display: flex;
              align-items: center;
              justify-content: center;
              position: relative;
              flex-shrink: 0;
            `;

            // SVG 네임스페이스 사용
            const svgNS = 'http://www.w3.org/2000/svg';

            // 단일 SVG 요소 생성 (하트 + 번개)
            const svg = document.createElementNS(svgNS, 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('width', '32');
            svg.setAttribute('height', '32');
            svg.style.cssText = 'position: absolute;';

            // 흰색 하트 path
            const heartPath = document.createElementNS(svgNS, 'path');
            heartPath.setAttribute('d', 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z');
            heartPath.setAttribute('fill', 'white');
            svg.appendChild(heartPath);

            // 녹색 번개 polygon
            const boltPolygon = document.createElementNS(svgNS, 'polygon');
            boltPolygon.setAttribute('points', '12,2 5,12 10,12 8,22 16,10 12,10 14,2');
            boltPolygon.setAttribute('fill', '#22c55e');
            svg.appendChild(boltPolygon);

            circle.appendChild(svg);

            // 라벨 생성
            const label = document.createElement('div');
            label.style.cssText = `
              margin-top: 4px;
              font-size: 12px;
              font-weight: 600;
              color: white;
              background-color: rgba(17, 24, 39, 0.9);
              padding: 4px 8px;
              border-radius: 4px;
              white-space: nowrap;
            `;
            label.textContent = '자동심장충격기';

            overlayContent.appendChild(circle);
            overlayContent.appendChild(label);

            // @ts-ignore - CustomOverlay API
            const customOverlay = new window.kakao.maps.CustomOverlay({
              position: position,
              content: overlayContent,
              xAnchor: 0.5,
              yAnchor: 1.0,
            });

            customOverlay.setMap(roadviewInstance);
            console.log('오버레이 설정 완료');
          } catch (error) {
            console.error('오버레이 설정 오류:', error);
          }
        });
      } catch (error) {
        console.error('로드뷰 초기화 오류:', error);
      }
    };

    initializeRoadview();
  }, [showRoadview, currentLat, currentLng]);

  // ✅ 카테고리 데이터 로드 (고정된 분류체계 상수 사용)
  useEffect(() => {
    // 고정된 분류체계 상수에서 데이터 설정
    const cat1Options = CATEGORY_1_OPTIONS.map((v: string) => ({ label: v, value: v }));
    setCategory1Options(cat1Options);
    setCategory2Options(getAllCategory2Options().map((v: string) => ({ label: v, value: v })));
    setCategory3Options(getAllCategory3Options().map((v: string) => ({ label: v, value: v })));
    setCategoryHierarchy(CATEGORY_HIERARCHY);
    setCategoriesLoading(false);
    console.log('[BasicInfoStep] Fixed category hierarchy loaded');
  }, []);

  // 현재 위치로 이동
  const moveToCurrentLocation = () => {
    if (navigator.geolocation && map) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const newPosition = new window.kakao.maps.LatLng(lat, lng);

          map.setCenter(newPosition);

          // 마커가 없으면 생성, 있으면 이동
          if (marker) {
            marker.setPosition(newPosition);
          } else {
            // @ts-ignore - Marker API
            const newMarker = new window.kakao.maps.Marker({
              position: newPosition,
              map: map,
              draggable: true,
            });

            // 마커 드래그 이벤트 리스너 추가
            window.kakao.maps.event.addListener(newMarker, 'dragstart', () => {
              setIsDragging(true);
            });

            window.kakao.maps.event.addListener(newMarker, 'dragend', () => {
              setIsDragging(false);
              const pos = newMarker.getPosition();
              const lat = pos.getLat();
              const lng = pos.getLng();
              setCurrentLat(lat);
              setCurrentLng(lng);
              setHasMovedMarker(true);

              const currentBasicInfo = (useInspectionSessionStore.getState().stepData.basicInfo || {}) as Record<string, unknown>;
              updateStepData('basicInfo', {
                ...currentBasicInfo,
                gps_latitude: lat,
                gps_longitude: lng,
                gps_verified: false,
              });
            });

            setMarker(newMarker);
          }

          setCurrentLat(lat);
          setCurrentLng(lng);
          setHasMovedMarker(true);

          const currentBasicInfo = (useInspectionSessionStore.getState().stepData.basicInfo || {}) as Record<string, unknown>;
          updateStepData('basicInfo', {
            ...currentBasicInfo,
            gps_latitude: lat,
            gps_longitude: lng,
            gps_verified: false,
          });
        },
        (error) => {
          console.error('위치 정보를 가져올 수 없습니다:', error);
          alert('위치 정보를 가져올 수 없습니다. 브라우저 설정을 확인해주세요.');
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

  // 기본정보 필드들(주소/설치위치 제외, 외부표출 포함)
  const BASIC_INFO_FIELDS = [
    ...FIELDS.filter((f) => f.key !== 'address' && f.key !== 'installation_position'),
    ...DEVICE_INFO_FIELDS
  ];

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
      // ✅ 원본과 동일해도 확인했다면 상태 업데이트
      if (isBasicInfoMatching) {
        updateStepData('basicInfo', { ...basicInfo, all_matched: true });
        setIsEditMode(false);
        return;
      }

      // ✅ 카테고리 계층 검증 (대분류 변경 시 중분류/소분류 유효성 확인)
      const cat1 = basicInfo.category_1 || '';
      const cat2 = basicInfo.category_2 || '';
      const cat3 = basicInfo.category_3 || '';

      if (cat1 && Object.keys(categoryHierarchy).length > 0) {
        // 대분류가 존재하고 계층 데이터가 있는 경우 검증
        const validCat2Options = categoryHierarchy[cat1] ? Object.keys(categoryHierarchy[cat1]) : [];

        // 중분류가 선택되어 있는데 현재 대분류에 속하지 않음
        if (cat2 && !validCat2Options.includes(cat2)) {
          alert(`⚠️ 카테고리 불일치\n\n대분류 "${cat1}"에 중분류 "${cat2}"가 존재하지 않습니다.\n\n중분류와 소분류를 다시 선택해주세요.`);
          return;
        }

        // 소분류가 선택되어 있는데 현재 대분류/중분류에 속하지 않음
        if (cat2 && cat3) {
          const validCat3Options = categoryHierarchy[cat1]?.[cat2] || [];
          if (!validCat3Options.includes(cat3)) {
            alert(`⚠️ 카테고리 불일치\n\n중분류 "${cat2}"에 소분류 "${cat3}"가 존재하지 않습니다.\n\n소분류를 다시 선택해주세요.`);
            return;
          }
        }

        // 대분류만 선택하고 중분류/소분류가 비어있으면 경고
        if (!cat2 || !cat3) {
          alert(`⚠️ 필수 항목 미입력\n\n대분류를 변경하셨습니다.\n중분류와 소분류를 선택해주세요.`);
          return;
        }
      }

      // field_changes 업데이트
      BASIC_INFO_FIELDS.forEach((field) => {
        const originalValue = deviceInfo[field.dbKey] || '';
        const currentValue = basicInfo[field.key] || '';

        if (currentValue !== originalValue && currentValue.trim() !== '') {
          updateFieldChange(field.key, {
            original: originalValue,
            corrected: currentValue,
            reason: '',
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

  // 수정 취소 - 원본 값으로 복원
  const handleCancelEdit = () => {
    // 편집 전 상태를 추적하기 위한 변수
    const previousAllMatched = basicInfo.all_matched;

    // 원본 데이터로 복원
    const restoredInfo = { ...basicInfo };
    FIELDS.forEach((field) => {
      const originalValue = deviceInfo[field.dbKey] || '';
      restoredInfo[field.key] = originalValue;
    });

    // 외부표출 필드도 복원
    DEVICE_INFO_FIELDS.forEach((field) => {
      const originalValue = deviceInfo[field.dbKey] || '';
      restoredInfo[field.key] = originalValue;
    });

    // 복원한 값이 원본과 모두 일치하는지 확인
    const isAllMatching = BASIC_INFO_FIELDS.every((field) => {
      const originalValue = deviceInfo[field.dbKey] || '';
      const currentValue = restoredInfo[field.key] || '';
      if (!originalValue.trim() || !currentValue.trim()) {
        return false;
      }
      return originalValue === currentValue;
    });

    // all_matched 상태 복원:
    // - 복원 후 원본과 일치하면 이전 상태 유지 (true 또는 'edited')
    // - 일치하지 않으면 false로 설정
    if (isAllMatching && previousAllMatched) {
      restoredInfo.all_matched = previousAllMatched;
    } else {
      restoredInfo.all_matched = false;
    }

    updateStepData('basicInfo', restoredInfo);
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
    // ✅ 원본과 같아도 확인했다면 상태 업데이트
    if (isLocationMatching) {
      updateStepData('basicInfo', { ...basicInfo, location_matched: true });
      setIsLocationEditMode(false);
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

  // 설치 주소/위치 수정 취소 - 원본 값으로 복원
  const handleLocationCancelEdit = () => {
    // 편집 전 상태를 추적하기 위한 변수
    const previousLocationMatched = basicInfo.location_matched;

    // 원본 데이터로 복원
    const restoredInfo = { ...basicInfo };

    // 주소와 설치위치 원본으로 복원
    restoredInfo.address = deviceInfo.installation_address || '';
    restoredInfo.installation_position = deviceInfo.installation_position || '';

    // GPS 좌표도 원본으로 복원
    restoredInfo.gps_latitude = initialLat;
    restoredInfo.gps_longitude = initialLng;
    setCurrentLat(initialLat);
    setCurrentLng(initialLng);
    setHasMovedMarker(false);

    // 복원한 값이 원본과 일치하는지 확인
    const originalAddress = deviceInfo.installation_address || '';
    const originalPosition = deviceInfo.installation_position || '';
    const isLocationMatching =
      originalAddress.trim() && restoredInfo.address.trim() &&
      originalPosition.trim() && restoredInfo.installation_position.trim() &&
      restoredInfo.address === originalAddress &&
      restoredInfo.installation_position === originalPosition;

    // location_matched 상태 복원:
    // - 복원 후 원본과 일치하면 이전 상태 유지 (true 또는 'edited')
    // - 일치하지 않으면 false로 설정
    if (isLocationMatching && previousLocationMatched) {
      restoredInfo.location_matched = previousLocationMatched;
    } else {
      restoredInfo.location_matched = false;
    }

    updateStepData('basicInfo', restoredInfo);
    setIsLocationEditMode(false);

    // 지도 마커도 원본 위치로 이동
    if (map && marker) {
      const moveLatLng = new window.kakao.maps.LatLng(initialLat, initialLng);
      marker.setPosition(moveLatLng);
      map.setCenter(moveLatLng);
    }
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

    // 수정된 필드인지 확인 (원본과 다른 경우)
    const isModified = basicInfo.all_matched === 'edited' && currentValue && originalValue !== currentValue;

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
          <div className={`text-xs font-medium truncate ${
            isModified
              ? 'text-yellow-300'
              : field.readonly ? 'text-gray-300' : 'text-gray-100'
          }`}>
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

  // 기본정보 섹션이 확인된 상태인지 (전체 일치 또는 수정됨)
  const isBasicInfoConfirmed = basicInfo.all_matched === true || basicInfo.all_matched === 'edited';

  return (
    <div className="space-y-2">
      {/* 통합된 기본 정보 */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
        {isBasicInfoConfirmed && !isEditMode ? (
          // 접힌 상태: 1줄 요약
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400">기본정보:</span>
            <span className={basicInfo.all_matched === true ? 'text-green-300' : 'text-yellow-300'}>
              {basicInfo.all_matched === true ? '일치' : '수정됨'}
            </span>
            <span className="text-gray-600">|</span>
            <span className="text-gray-400">
              분류: <span className="text-gray-300">
                {(basicInfo.all_matched === 'edited' && basicInfo.category_1)
                  ? basicInfo.category_1
                  : (deviceInfo.category_1 || '-')}
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                updateStepData('basicInfo', {
                  ...basicInfo,
                  all_matched: false,
                });
              }}
              className="ml-auto px-2 py-0.5 rounded text-xs font-medium bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300"
            >
              수정
            </button>
          </div>
        ) : (
          // 펼친 상태: 전체 정보
          <>
            {/* 기본 정보 */}
            <div className="space-y-2">
              {/* 첫 번째 행: 관리책임자, 담당자 연락처, 외부표출 */}
              <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 3.1fr 2.9fr' }}>
                {renderField(FIELDS[0])} {/* 관리책임자 */}
                {renderField(FIELDS[1])} {/* 담당자 연락처 */}
                {/* 외부표출 */}
                <div className="space-y-1">
                  <div className="text-[10px] font-medium text-gray-400 whitespace-nowrap">외부표출</div>
                  {!isEditMode ? (
                    <div className={`text-xs font-medium whitespace-nowrap ${
                      basicInfo.all_matched === 'edited' && basicInfo.external_display && basicInfo.external_display !== deviceInfo.external_display
                        ? 'text-yellow-300'
                        : ((basicInfo.all_matched === 'edited' ? basicInfo.external_display : deviceInfo.external_display) === 'N')
                          ? 'text-red-400 font-semibold'
                          : 'text-gray-100'
                    }`}>
                      {(basicInfo.all_matched === 'edited' && basicInfo.external_display)
                        ? basicInfo.external_display
                        : (deviceInfo.external_display || '데이터없음')}
                    </div>
                  ) : (
                    <select
                      value={basicInfo.external_display || deviceInfo.external_display || 'N'}
                      onChange={(e) => {
                        updateStepData('basicInfo', {
                          ...basicInfo,
                          external_display: e.target.value,
                          all_matched: false,
                        });
                      }}
                      className="w-full rounded-lg px-2 py-1.5 bg-gray-800 border border-gray-600 text-xs text-white placeholder-gray-500 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 appearance-none"
                    >
                      <option value="Y">Y</option>
                      <option value="N">N</option>
                    </select>
                  )}
                </div>
              </div>

              {/* 두 번째 행: 분류체계 (대분류, 중분류, 소분류) */}
              <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 3fr 3fr' }}>
                {renderField(FIELDS[4])} {/* 대분류 */}
                {renderField(FIELDS[5])} {/* 중분류 */}
                {renderField(FIELDS[6])} {/* 소분류 */}
              </div>
            </div>

            {/* 수정/전체 일치 버튼 */}
            <div className="mt-3">
              <EditableSectionButtons
                isEditMode={isEditMode}
                isMatching={isBasicInfoMatching}
                matchedState={basicInfo.all_matched}
                onLeftClick={() => {
                  if (isEditMode) {
                    handleCancelEdit();
                  } else {
                    handleEditAll();
                  }
                }}
                onRightClick={() => {
                  if (isEditMode) {
                    handleEditAll();
                  } else {
                    handleMatchAll();
                  }
                }}
                matchText="전체 일치"
                matchedText="전체 일치 확인됨"
              />
            </div>
          </>
        )}
      </div>

      {/* 지도 섹션 - gps_verified로 접기 제어 */}
      {(() => {
        // GPS 위치가 확인된 상태인지
        const isMapConfirmed = basicInfo.gps_verified === true;

        if (isMapConfirmed) {
          // 접힌 상태: 1줄 요약
          return (
            <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-400">GPS 위치:</span>
                <span className="text-green-300">확인됨</span>
                <span className="text-gray-600">|</span>
                <span className="text-gray-300 truncate flex-1">
                  위도 {currentLat?.toFixed(5) || '-'}, 경도 {currentLng?.toFixed(5) || '-'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    updateStepData('basicInfo', {
                      ...basicInfo,
                      gps_verified: false,
                    });
                  }}
                  className="ml-auto flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300"
                >
                  수정
                </button>
              </div>
            </div>
          );
        }

        // 펼친 상태: 전체 지도
        return (
      <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-white text-sm">위치 정보</h4>
        </div>

        {/* GPS 좌표 정보 */}
        <div className="flex items-center gap-1 mb-2">
          <div className="text-[10px] sm:text-xs font-medium text-gray-400">GPS 위도</div>
          <div className={`text-[10px] sm:text-sm font-medium font-mono ${
            currentLat && initialLat && Math.abs(currentLat - initialLat) > 0.0000001
              ? 'text-yellow-300'
              : 'text-gray-300'
          }`}>
            {currentLat ? currentLat.toFixed(7) : '좌표없음'}
          </div>
          <div className="text-[10px] sm:text-xs font-medium text-gray-400 ml-3 sm:ml-4">GPS 경도</div>
          <div className={`text-[10px] sm:text-sm font-medium font-mono ${
            currentLng && initialLng && Math.abs(currentLng - initialLng) > 0.0000001
              ? 'text-yellow-300'
              : 'text-gray-300'
          }`}>
            {currentLng ? currentLng.toFixed(7) : '좌표없음'}
          </div>
        </div>

        {/* GPS 확인 버튼 - 지도 상단 */}
        <div className="mb-2 flex gap-2">
          {/* 원본 복원 버튼 */}
          {currentLat && currentLng && initialLat && initialLng &&
           (Math.abs(currentLat - initialLat) > 0.0000001 || Math.abs(currentLng - initialLng) > 0.0000001) && (
            <button
              type="button"
              onClick={() => {
                // GPS 좌표를 원본으로 복원
                setCurrentLat(initialLat);
                setCurrentLng(initialLng);
                setHasMovedMarker(false);

                // 마커 위치도 복원
                if (marker && map) {
                  const originalPosition = new window.kakao.maps.LatLng(initialLat, initialLng);
                  marker.setPosition(originalPosition);
                  map.setCenter(originalPosition);
                }

                // stepData 업데이트
                updateStepData('basicInfo', {
                  ...basicInfo,
                  gps_latitude: initialLat,
                  gps_longitude: initialLng,
                  gps_verified: false,
                });
              }}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600 transition-colors"
            >
              원본 복원
            </button>
          )}
          {/* GPS 확인/저장 버튼 */}
          <button
            type="button"
            onClick={() => {
              updateStepData('basicInfo', { ...basicInfo, gps_verified: true });
              const btn = document.activeElement as HTMLButtonElement;
              if (btn) {
                btn.classList.add('ring-2', 'ring-green-400');
                setTimeout(() => btn.classList.remove('ring-2', 'ring-green-400'), 1000);
              }
            }}
            disabled={basicInfo.gps_verified === true || !isMapLoaded}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${basicInfo.gps_verified === true
              ? 'bg-green-600/30 border-2 border-green-500 text-green-200 cursor-default shadow-lg shadow-green-500/20'
              : hasMovedMarker
                ? 'bg-yellow-500 hover:bg-yellow-600 text-white border-2 border-yellow-400'
                : 'bg-green-600 hover:bg-green-700 text-white border border-green-500'
              }`}
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
            <span>
              {basicInfo.gps_verified === true
                ? '위치 확인됨'
                : hasMovedMarker
                  ? '변경된 위치로 저장'
                  : '설치위치와 동일'
              }
            </span>
          </button>
        </div>

        {/* 지도와 로드뷰 - 반응형 레이아웃 (모바일: 상하, 데스크톱: 좌우) */}
        <div className="grid grid-cols-1 gap-0 border border-gray-700 rounded-lg overflow-hidden">
          {/* 지도 섹션 */}
          <div className="relative">
            <div
              ref={mapRef}
              className="w-full h-64 bg-gray-900"
            />

            {/* 로딩 오버레이 */}
            {!isMapLoaded && !mapError && (
              <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin mb-2"></div>
                  <p className="text-gray-300 text-sm">지도 로딩 중...</p>
                </div>
              </div>
            )}

            {/* 에러 메시지 */}
            {mapError && (
              <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center">
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

            {/* 현재 위치로 이동 버튼 */}
            <button
              onClick={moveToCurrentLocation}
              className="absolute bottom-3 left-3 z-10 flex items-center justify-center bg-white/40 hover:bg-white/60 text-gray-700 hover:text-gray-900 p-1.5 rounded-lg transition-all touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
              disabled={!isMapLoaded}
              title="현재 위치로 지도 이동"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
              </svg>
            </button>

            {/* 로드뷰 버튼 */}
            <button
              onClick={() => setShowRoadview(!showRoadview)}
              className="absolute bottom-3 right-3 z-10 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs transition-all font-semibold touch-manipulation whitespace-nowrap bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!isMapLoaded}
              title={showRoadview ? "로드뷰 접기" : "로드뷰 펼치기"}
            >
              <svg className="w-4 h-4 flex-shrink-0 transition-transform duration-300" fill="currentColor" viewBox="0 0 24 24" style={{ transform: showRoadview ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <path d="M7 10l5 5 5-5z" />
              </svg>
              <span>{showRoadview ? "로드뷰 접기" : "로드뷰 펼치기"}</span>
            </button>
          </div>

          {/* 로드뷰 섹션 */}
          {showRoadview ? (
            <div className="relative bg-gray-900 border-t border-gray-700">
              {roadviewError ? (
                <div className="w-full h-64 bg-gray-900 flex flex-col items-center justify-center p-4">
                  <div className="text-center">
                    <svg className="w-12 h-12 mx-auto mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-gray-400 text-sm">{roadviewError}</p>
                    <p className="text-gray-500 text-xs mt-2">이 위치는 로드뷰 서비스 지역이 아닙니다</p>
                  </div>
                </div>
              ) : (
                <div
                  ref={roadviewRef}
                  className="w-full h-64 bg-gray-900"
                />
              )}
              <button
                onClick={() => {
                  setShowRoadview(false);
                  setRoadviewError('');
                }}
                className="absolute top-2 right-2 z-10 text-gray-400 hover:text-gray-200 p-0.5 transition-colors bg-gray-900/80 rounded-lg backdrop-blur-sm"
                title="로드뷰 닫기"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="bg-gray-900 border-t border-gray-700"></div>
          )}
        </div>

        {/* 설명 문구 */}
        <div className="mt-2">
          <p className="text-xs text-gray-400">
            실제 위치와 다른 경우 마커를 드래그하여 이동해주세요
          </p>
        </div>
      </div>
        );
      })()}

      {/* 주소/설치위치 섹션 - location_matched로 접기 제어 */}
      {(() => {
        // 주소 정보가 확인된 상태인지 (일치 또는 수정됨)
        const isAddressSectionConfirmed = basicInfo.location_matched === true || basicInfo.location_matched === 'edited';

        if (isAddressSectionConfirmed && !isLocationEditMode) {
          // 접힌 상태: 1줄 요약
          return (
            <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-400">주소/설치위치:</span>
                <span className={basicInfo.location_matched === true ? 'text-green-300' : 'text-yellow-300'}>
                  {basicInfo.location_matched === true ? '일치' : '수정됨'}
                </span>
                <span className="text-gray-600">|</span>
                <span className="text-gray-300 truncate flex-1">
                  {basicInfo.location_matched === 'edited' && basicInfo.address
                    ? basicInfo.address
                    : (deviceInfo.installation_address || '-')}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    updateStepData('basicInfo', {
                      ...basicInfo,
                      location_matched: false,
                    });
                  }}
                  className="ml-auto flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300"
                >
                  수정
                </button>
              </div>
            </div>
          );
        }

        // 펼친 상태: 전체 정보
        return (
      <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
        {/* 주소와 설치위치 바로 표시 (수정 모드가 아닐 때) */}
        {!isLocationEditMode && (
          <div className="grid grid-cols-1 gap-3 mb-3">
            <div className="space-y-1">
              <div className="text-[10px] font-medium text-gray-400">주소</div>
              <div className={`text-xs font-medium ${
                basicInfo.location_matched === 'edited' && basicInfo.address !== deviceInfo.installation_address
                  ? 'text-yellow-300'
                  : 'text-gray-100'
              }`}>
                {basicInfo.location_matched === 'edited'
                  ? (basicInfo.address || '-')
                  : (deviceInfo.installation_address || '-')}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] font-medium text-gray-400">설치위치</div>
              <div className={`text-xs font-medium ${
                basicInfo.location_matched === 'edited' && basicInfo.installation_position !== deviceInfo.installation_position
                  ? 'text-yellow-300'
                  : 'text-gray-100'
              }`}>
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
            <div className="grid grid-cols-1 gap-4 mb-2">
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

        {/* 수정/일치 버튼 */}
        <EditableSectionButtons
          isEditMode={isLocationEditMode}
          isMatching={isLocationMatching}
          matchedState={basicInfo.location_matched}
          onLeftClick={() => {
            if (isLocationEditMode) {
              handleLocationCancelEdit();
            } else {
              handleLocationEdit();
            }
          }}
          onRightClick={() => {
            if (isLocationEditMode) {
              handleLocationSaveEdit();
            } else {
              handleLocationMatch();
            }
          }}
          matchText="일치"
          matchedText="일치 확인됨"
        />
      </div>
        );
      })()}

      {/* 접근 허용 범위 섹션 - accessibility_confirmed로 접기 제어 */}
      {(() => {
        // 접근성 정보가 확인된 상태인지
        const isAccessibilityConfirmed = basicInfo.accessibility_confirmed === true;
        const accessibilityLevel = basicInfo.accessibility?.accessibility_level;
        const accessibilityReason = basicInfo.accessibility?.accessibility_reason;

        // 접근성 레벨 표시 텍스트
        const getAccessibilityLabel = () => {
          switch (accessibilityLevel) {
            case 'public': return '누구나';
            case 'restricted': return '일부';
            case 'private': return '불가';
            default: return '-';
          }
        };

        if (isAccessibilityConfirmed && accessibilityLevel) {
          // 접힌 상태: 1줄 요약
          return (
            <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-400">접근 허용:</span>
                <span className={
                  accessibilityLevel === 'public' ? 'text-green-300' :
                  accessibilityLevel === 'restricted' ? 'text-yellow-300' :
                  'text-red-300'
                }>
                  {getAccessibilityLabel()}
                </span>
                {accessibilityReason && (
                  <>
                    <span className="text-gray-600">|</span>
                    <span className="text-gray-300 truncate">{accessibilityReason}</span>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    updateStepData('basicInfo', {
                      ...basicInfo,
                      accessibility_confirmed: false,
                    });
                  }}
                  className="ml-auto flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300"
                >
                  수정
                </button>
              </div>
            </div>
          );
        }

        // 펼친 상태: 접근 허용 범위만
        return (
          <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
            <div className="mb-3">
              <h4 className="font-semibold text-white text-sm">접근 허용 범위</h4>
            </div>

            <div>
              <Label className="text-xs font-medium text-white mb-2 block">
                설치 위치 접근 허용 범위 <span className="text-red-500">*</span>
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const newAccessibility = {
                      ...(basicInfo.accessibility || {}),
                      accessibility_level: 'public',
                      improved_schedule: basicInfo.accessibility?.improved_schedule || { is24hours: false }
                    };
                    delete newAccessibility.accessibility_reason;
                    updateStepData('basicInfo', {
                      accessibility: newAccessibility,
                      accessibility_confirmed: true  // 누구나는 즉시 확인
                    });
                  }}
                  className={`px-2 py-1.5 text-xs font-medium rounded-lg transition-all ${basicInfo.accessibility?.accessibility_level === 'public'
                    ? 'bg-green-600 text-white border-2 border-green-500 shadow-lg shadow-green-500/20'
                    : 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
                    }`}
                >
                  누구나
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const newAccessibility = {
                      ...(basicInfo.accessibility || {}),
                      accessibility_level: 'restricted',
                      improved_schedule: basicInfo.accessibility?.improved_schedule || { is24hours: false }
                    };
                    updateStepData('basicInfo', {
                      accessibility: newAccessibility,
                      accessibility_confirmed: false  // 사유 입력 필요
                    });
                  }}
                  className={`px-2 py-1.5 text-xs font-medium rounded-lg transition-all ${basicInfo.accessibility?.accessibility_level === 'restricted'
                    ? 'bg-yellow-600 text-white border-2 border-yellow-500 shadow-lg shadow-yellow-500/20'
                    : 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
                    }`}
                >
                  일부
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const newAccessibility = {
                      ...(basicInfo.accessibility || {}),
                      accessibility_level: 'private',
                      improved_schedule: basicInfo.accessibility?.improved_schedule || { is24hours: false }
                    };
                    updateStepData('basicInfo', {
                      accessibility: newAccessibility,
                      accessibility_confirmed: false  // 사유 입력 필요
                    });
                  }}
                  className={`px-2 py-1.5 text-xs font-medium rounded-lg transition-all ${basicInfo.accessibility?.accessibility_level === 'private'
                    ? 'bg-red-600 text-white border-2 border-red-500 shadow-lg shadow-red-500/20'
                    : 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
                    }`}
                >
                  불가
                </button>
              </div>

              {/* 접근 제한 사유 입력 및 확인 버튼 */}
              {(basicInfo.accessibility?.accessibility_level === 'restricted' ||
                basicInfo.accessibility?.accessibility_level === 'private') && (
                  <div className="mt-2 space-y-2">
                    <input
                      type="text"
                      placeholder="접근 제한 사유를 입력하세요"
                      value={basicInfo.accessibility?.accessibility_reason || ''}
                      onChange={(e) => {
                        const newAccessibility = {
                          ...(basicInfo.accessibility || {}),
                          accessibility_reason: e.target.value,
                        };
                        updateStepData('basicInfo', { accessibility: newAccessibility });
                      }}
                      className="w-full px-3 py-2 text-xs bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-green-500 focus:ring-1 focus:ring-green-500/20"
                    />
                    {/* 확인 버튼 */}
                    <button
                      type="button"
                      onClick={() => {
                        updateStepData('basicInfo', {
                          ...basicInfo,
                          accessibility_confirmed: true,
                        });
                      }}
                      disabled={!basicInfo.accessibility?.accessibility_reason}
                      className={`w-full px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                        basicInfo.accessibility?.accessibility_reason
                          ? 'bg-green-600 hover:bg-green-700 text-white border border-green-500'
                          : 'bg-gray-800/50 border border-gray-700/50 text-gray-600 cursor-not-allowed'
                      }`}
                    >
                      확인
                    </button>
                  </div>
                )}
            </div>
          </div>
        );
      })()}

      {/* 사용 가능 시간 섹션 - schedule_confirmed로 접기 제어 */}
      {(() => {
        // 사용 시간이 확인된 상태인지
        const isScheduleConfirmed = basicInfo.schedule_confirmed === true;
        const schedule = basicInfo.accessibility?.improved_schedule as ImprovedWeeklySchedule | undefined;

        // 시간이 설정되었는지 확인
        const isScheduleSet = () => {
          if (!schedule) return false;
          if (schedule.is24hours) return true;

          // 요일별 시간이 하나라도 있는지 확인
          const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'holiday'];
          return days.some((day) => {
            const daySchedule = schedule[day as keyof ImprovedWeeklySchedule];
            return daySchedule && typeof daySchedule === 'object' && 'timeRange' in daySchedule && daySchedule.timeRange;
          });
        };

        // 시간 요약 텍스트 생성
        const getScheduleSummary = () => {
          if (!schedule) return '미설정';
          if (schedule.is24hours) return '24시간';

          // 요일별 시간이 있는지 확인
          const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'holiday'];
          const dayLabels = ['월', '화', '수', '목', '금', '토', '일', '공휴일'];
          const activeDays: string[] = [];

          days.forEach((day, idx) => {
            const daySchedule = schedule[day as keyof ImprovedWeeklySchedule];
            if (daySchedule && typeof daySchedule === 'object' && 'timeRange' in daySchedule && daySchedule.timeRange) {
              activeDays.push(dayLabels[idx]);
            }
          });

          if (activeDays.length === 0) return '미설정';
          if (activeDays.length === 7) return '매일 운영';
          return `${activeDays.join(', ')} 운영`;
        };

        const scheduleValid = isScheduleSet();

        if (isScheduleConfirmed) {
          // 접힌 상태: 1줄 요약
          return (
            <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-400">사용 시간:</span>
                <span className="text-green-300">
                  {getScheduleSummary()}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    updateStepData('basicInfo', {
                      ...basicInfo,
                      schedule_confirmed: false,
                    });
                  }}
                  className="ml-auto flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300"
                >
                  수정
                </button>
              </div>
            </div>
          );
        }

        // 펼친 상태: 사용 가능 시간
        return (
          <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
            <div className="mb-3">
              <h4 className="font-semibold text-white text-sm">사용 가능 시간</h4>
            </div>

            <div>
              <Label className="text-xs font-medium text-white mb-2 block">
                사용 가능 시간 확인 <span className="text-red-500">*</span>
              </Label>

              <ImprovedWeeklyScheduleInput
                value={(basicInfo.accessibility?.improved_schedule as ImprovedWeeklySchedule) || { is24hours: false }}
                onChange={(schedule: ImprovedWeeklySchedule) => {
                  const newAccessibility = {
                    ...(basicInfo.accessibility || {}),
                    improved_schedule: schedule,
                  };
                  updateStepData('basicInfo', { accessibility: newAccessibility });
                }}
              />

              {/* 확인 버튼 - 시간이 설정되어야만 활성화 */}
              <button
                type="button"
                onClick={() => {
                  updateStepData('basicInfo', {
                    ...basicInfo,
                    schedule_confirmed: true,
                  });
                }}
                disabled={!scheduleValid}
                className={`w-full mt-3 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  scheduleValid
                    ? 'bg-green-600 hover:bg-green-700 text-white border border-green-500'
                    : 'bg-gray-800/50 border border-gray-700/50 text-gray-600 cursor-not-allowed'
                }`}
              >
                확인
              </button>
            </div>
          </div>
        );
      })()}

      {/* 실시간 필수항목 검증 경고 */}
      <ValidationWarning missingFields={missingFields} />
    </div>
  );
}
