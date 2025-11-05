'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { waitForKakaoMaps } from '@/lib/constants/kakao';
import { REGIONS, normalizeRegionName } from '@/lib/constants/regions';
import { useAEDData } from '@/app/aed-data/components/AEDDataProvider';

interface AEDMapLocation {
  equipment_serial: string;
  installation_institution?: string;
  installation_org?: string;
  installation_address?: string;
  address?: string;
  installation_position?: string;
  latitude: number;
  longitude: number;
  model_name?: string;
  manufacturer?: string;
  battery_expiry_date?: string;
  patch_expiry_date?: string;
  last_inspection_date?: string;
  external_display?: string;
  external_non_display_reason?: string;
}

interface InspectionSession {
  id: string;
  equipment_serial: string;
  inspector_id: string;
  inspector_name?: string;
  status: 'active' | 'completed' | 'cancelled' | 'paused';
  current_step: number;
}

interface MapViewProps {
  locations?: AEDMapLocation[];
  isLoading?: boolean;
  onMarkerClick?: (location: AEDMapLocation) => void;
  userProfile?: any; // 사용자 프로필 (관할 지역 파악용)
  useMapBasedLoading?: boolean; // true면 지도 중심 기준으로 데이터 로딩
  viewMode?: 'admin' | 'inspection'; // 'admin'=일정추가, 'inspection'=즉시점검
  onQuickInspect?: (location: AEDMapLocation) => void; // 즉시 점검 핸들러
  onSchedule?: (locations: AEDMapLocation[]) => void; // 일정 추가 핸들러
  onCancelSchedule?: (equipmentSerial: string) => void; // 일정 취소 핸들러
  scheduledEquipment?: Set<string>; // 일정추가된 장비 시리얼 목록
  inspectionSessions?: Map<string, InspectionSession>; // 활성 점검 세션
  inspectionCompleted?: Set<string>; // 완료된 점검 장비 시리얼 목록
  onInspectionInProgress?: (equipmentSerial: string) => void; // 점검 진행중 핸들러
  filters?: any; // AEDFilterBar의 필터 상태
}

export function MapView({
  locations = [],
  isLoading = false,
  onMarkerClick,
  userProfile,
  useMapBasedLoading = false,
  viewMode = 'admin',
  onQuickInspect,
  onSchedule,
  onCancelSchedule,
  scheduledEquipment = new Set(),
  inspectionSessions = new Map(),
  inspectionCompleted = new Set(),
  onInspectionInProgress,
  filters
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [selectedAED, setSelectedAED] = useState<AEDMapLocation | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number; arrowLeft: boolean } | null>(null);
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [mapError, setMapError] = useState<string>('');
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const markersRef = useRef<any[]>([]);
  const isMapInitializedRef = useRef(false);

  // 컨텍스트에서 상태 업데이트 함수 가져오기
  const { setMapCenterRegion } = useAEDData();

  // 지도 기반 로딩용 상태
  const [mapLocations, setMapLocations] = useState<AEDMapLocation[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [searchRadius, setSearchRadius] = useState<number>(3); // 기본 3km
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);

  // 목록 필터 상태 (일정관리: 'all' | 'toAdd' | 'added', 현장점검: 'all' | 'target' | 'inProgress')
  const [listFilter, setListFilter] = useState<'all' | 'toAdd' | 'added' | 'target' | 'inProgress'>('all');

  // 이전 지역 정보 추적 (무한 루프 방지)
  const lastRegionRef = useRef<{ sido: string; gugun: string } | null>(null);
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 변경 주체 추적 (무한 루프 방지)
  const changeSourceRef = useRef<'filter' | 'map' | 'initial' | null>(null);
  const pendingFilterChangeRef = useRef(false);

  // 장비 목록 크기 조절 상태 (모바일 전용)
  const [listHeight, setListHeight] = useState(25); // 기본 25% (지도를 더 크게)
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  // 모바일 여부 체크
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 초기 범위 조정 완료 여부 추적
  const initialBoundsSetRef = useRef(false);

  // Geolocation 완료 여부 추적
  const geolocationCompleteRef = useRef(false);

  // 사이드 패널 상태
  const [showSidePanel, setShowSidePanel] = useState(true);

  // 반경 원 객체 참조
  const radiusCircleRef = useRef<any>(null);

  // 두 좌표 간 거리 계산 (Haversine formula, 결과: kilometers)
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // 지구 반지름 (km)
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // 거리 (km)
  }, []);

  // 실제 사용할 locations (props 또는 지도 기반 로딩)
  const displayLocations = useMapBasedLoading ? mapLocations : locations;

  // 반경 내 장비만 필터링 + 목록 필터 적용 (지도 탭 전용)
  const filteredDisplayLocations = useMemo(() => {
    // 지도가 없거나 지도 중심이 없으면 필터링 불가
    if (!mapCenter) {
      return displayLocations;
    }

    // Step 1: 반경 내 장비 필터링
    let filtered = displayLocations.filter(location => {
      // GPS 좌표가 없는 장비는 제외
      if (location.latitude === null || location.longitude === null) {
        return false;
      }

      const distance = calculateDistance(
        mapCenter.lat,
        mapCenter.lng,
        location.latitude,
        location.longitude
      );

      return distance <= searchRadius;
    });

    // Step 2: 목록 필터 적용
    if (listFilter !== 'all') {
      filtered = filtered.filter(location => {
        const serial = location.equipment_serial;

        if (listFilter === 'toAdd') {
          // 추가할 목록: 스케줄에 없고, 점검 세션이 없고, 점검 완료되지 않은 장비
          return !scheduledEquipment.has(serial) && !inspectionSessions.has(serial) && !inspectionCompleted.has(serial);
        } else if (listFilter === 'added') {
          // 추가된 목록: 스케줄에 있는 장비
          return scheduledEquipment.has(serial);
        } else if (listFilter === 'target') {
          // 점검대상목록: 스케줄에 있지만 아직 점검 진행 중이 아닌 장비
          return scheduledEquipment.has(serial) && !inspectionSessions.has(serial);
        } else if (listFilter === 'inProgress') {
          // 점검진행목록: 현재 점검 진행 중인 장비
          return inspectionSessions.has(serial);
        }

        return true;
      });
    }

    return filtered;
  }, [displayLocations, mapCenter, searchRadius, calculateDistance, listFilter, scheduledEquipment, inspectionSessions, inspectionCompleted]);

  // 디버깅: displayLocations 데이터 추적
  useEffect(() => {
    console.log('[MapView] 🗺️ Display locations updated:', {
      useMapBasedLoading,
      propsLocationsCount: locations.length,
      mapLocationsCount: mapLocations.length,
      displayLocationsCount: displayLocations.length,
      sampleData: displayLocations.slice(0, 2).map(loc => ({
        serial: loc.equipment_serial,
        lat: loc.latitude,
        lng: loc.longitude,
        address: loc.installation_address || loc.address
      }))
    });
  }, [displayLocations, useMapBasedLoading, locations.length, mapLocations.length]);

  // 지도 중심 기준으로 AED 데이터 로드
  const fetchAEDByMapCenter = useCallback(async () => {
    if (!map || !useMapBasedLoading) return;

    try {
      setDataLoading(true);
      const center = map.getCenter();
      const lat = center.getLat();
      const lng = center.getLng();

      console.log(`[MapView] Fetching data for center: ${lat}, ${lng}, radius: ${searchRadius}km`);

      const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lng.toString(),
        radius: (searchRadius * 1000).toString(), // km -> m
        limit: '500'
      });

      const response = await fetch(`/api/aed-data/by-location?${params}`);
      const data = await response.json();

      console.log(`[MapView] API Response:`, { success: data.success, count: data.count, dataLength: data.data?.length });

      if (data.success && data.data) {
        const mappedLocations = data.data
          .filter((item: any) => item.latitude && item.longitude)
          .map((item: any) => ({
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

        console.log(`[MapView] Loaded ${mappedLocations.length} locations`);
        setMapLocations(mappedLocations);
      }
    } catch (error) {
      console.error('[MapView] Failed to fetch AED data:', error);
    } finally {
      setDataLoading(false);
    }
  }, [map, useMapBasedLoading, searchRadius]);

  // 카카오맵 초기화
  const initializeMap = useCallback(() => {
    // 이미 초기화되었으면 중복 실행 방지
    if (isMapInitializedRef.current) {
      return;
    }

    if (!window.kakao || !window.kakao.maps) {
      setMapError('카카오맵을 불러올 수 없습니다.');
      return;
    }

    const container = mapRef.current;
    if (!container) return;

    try {
      const options = {
        center: new window.kakao.maps.LatLng(37.5665, 126.9780),
        level: 7,
      };

      const mapInstance = new window.kakao.maps.Map(container, options);
      setMap(mapInstance);
      isMapInitializedRef.current = true;

      // 지도 컨트롤 추가 - 우측 하단
      const zoomControl = new window.kakao.maps.ZoomControl();
      mapInstance.addControl(zoomControl, window.kakao.maps.ControlPosition.BOTTOMRIGHT);

      // Geocoder 초기화
      const geocoder = new window.kakao.maps.services.Geocoder();

      // 지도 이동/줌 완료 이벤트 - 데이터 로드 및 필터 동기화
      window.kakao.maps.event.addListener(mapInstance, 'idle', function() {
        // 디바운싱
        if (idleTimeoutRef.current) {
          clearTimeout(idleTimeoutRef.current);
        }

        idleTimeoutRef.current = setTimeout(() => {
          // Geolocation 완료 전까지 idle 이벤트 무시
          if (useMapBasedLoading && !geolocationCompleteRef.current) {
            console.log('[MapView] ⏸️ Waiting for geolocation to complete');
            return;
          }

          const center = mapInstance.getCenter();
          const lat = center.getLat();
          const lng = center.getLng();

          // 지도 중심 상태 업데이트 (장비 목록 필터링용)
          setMapCenter({ lat, lng });

          // 좌표로 행정구역 정보 가져오기
          geocoder.coord2RegionCode(lng, lat, function(result: any, status: any) {
            if (status === window.kakao.maps.services.Status.OK) {
              const region = result.find((r: any) => r.region_type === 'H');
              if (region) {
                const sidoFull = region.region_1depth_name;
                const gugun = region.region_2depth_name;
                const sidoShort = normalizeRegionName(sidoFull);

                console.log('[MapView] 📍 Geocoder result:', { sidoShort, gugun, lastRegion: lastRegionRef.current, changeSource: changeSourceRef.current });

                // 이전 지역과 같으면 중복 처리 방지
                if (lastRegionRef.current?.sido === sidoShort && lastRegionRef.current?.gugun === gugun) {
                  // 이미 'map' 이벤트를 처리 중이면 무시 (중복 idle 이벤트)
                  if (changeSourceRef.current === 'map') {
                    console.log('[MapView] ⏭️ Skip duplicate idle event (map event in progress)');
                    return;
                  }

                  console.log('[MapView] ✅ Same region, reloading data only');
                  if (useMapBasedLoading && geolocationCompleteRef.current) {
                    fetchAEDByMapCenter();
                  }
                  return;
                }

                // 필터 변경에 의한 지도 이동인 경우: 필터 업데이트 스킵
                if (changeSourceRef.current === 'filter') {
                  console.log('[MapView] 🔄 Filter-triggered move completed, reloading data');
                  lastRegionRef.current = { sido: sidoShort, gugun };
                  changeSourceRef.current = null;
                  if (useMapBasedLoading && geolocationCompleteRef.current) {
                    fetchAEDByMapCenter();
                  }
                  return;
                }

                // 사용자가 직접 지도를 이동한 경우: 필터 업데이트
                console.log('[MapView] 🗺️ User moved map, updating filter:', { sido: sidoShort, gugun });
                lastRegionRef.current = { sido: sidoShort, gugun };
                changeSourceRef.current = 'map';

                // sessionStorage 업데이트
                if (typeof window !== 'undefined') {
                  window.sessionStorage.setItem('selectedSido', sidoShort);
                  window.sessionStorage.setItem('selectedGugun', gugun);

                  // 필터바에 알림
                  console.log('[MapView] 📢 Dispatching mapRegionChanged event:', { sido: sidoShort, gugun });
                  window.dispatchEvent(new CustomEvent('mapRegionChanged', {
                    detail: { sido: sidoShort, gugun }
                  }));
                }

                // 데이터 재로드 (geolocation 완료 후에만)
                if (useMapBasedLoading && geolocationCompleteRef.current) {
                  fetchAEDByMapCenter();
                }

                // 플래그 리셋
                setTimeout(() => {
                  if (changeSourceRef.current === 'map') {
                    changeSourceRef.current = null;
                  }
                }, 100);
              }
            }
          });
        }, 1000);
      });

      // 현재 위치 가져오기 및 자동 필터 설정
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const locPosition = new window.kakao.maps.LatLng(lat, lng);

            setCurrentPosition({ lat, lng });
            mapInstance.setCenter(locPosition);
            mapInstance.setLevel(5);

            // 현재 위치 마커 표시
            const currentLocationSvg = `
              <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
                <circle cx="15" cy="15" r="10" fill="#4285F4" stroke="white" stroke-width="3"/>
                <circle cx="15" cy="15" r="3" fill="white"/>
              </svg>
            `;
            const markerImage = new window.kakao.maps.MarkerImage(
              'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(currentLocationSvg))),
              new window.kakao.maps.Size(30, 30),
              { offset: new window.kakao.maps.Point(15, 15) }
            );

            new window.kakao.maps.Marker({
              position: locPosition,
              map: mapInstance,
              image: markerImage,
              title: '내 위치',
              zIndex: 999
            });

            // 현재 위치의 행정구역으로 필터 자동 설정
            changeSourceRef.current = 'initial'; // 초기 설정으로 표시
            geocoder.coord2RegionCode(lng, lat, function(result: any, status: any) {
              if (status === window.kakao.maps.services.Status.OK) {
                const region = result.find((r: any) => r.region_type === 'H');
                if (region) {
                  const sidoFull = region.region_1depth_name;
                  const gugun = region.region_2depth_name;
                  const sidoShort = normalizeRegionName(sidoFull);

                  console.log('[MapView] 🎯 Initial location detected, setting filter:', { sido: sidoShort, gugun });

                  lastRegionRef.current = { sido: sidoShort, gugun };

                  // sessionStorage 업데이트
                  if (typeof window !== 'undefined') {
                    window.sessionStorage.setItem('selectedSido', sidoShort);
                    window.sessionStorage.setItem('selectedGugun', gugun);

                    // 필터바에 알림
                    window.dispatchEvent(new CustomEvent('mapRegionChanged', {
                      detail: { sido: sidoShort, gugun }
                    }));
                  }

                  // Geolocation 완료 플래그 설정
                  geolocationCompleteRef.current = true;

                  // 초기 위치 설정 후 데이터 로드 (useMapBasedLoading=true일 때만)
                  if (useMapBasedLoading) {
                    setTimeout(() => {
                      console.log('[MapView] 🚀 Initial data load after geolocation');
                      fetchAEDByMapCenter();
                    }, 500);
                  }

                  // 플래그 리셋
                  setTimeout(() => {
                    changeSourceRef.current = null;
                  }, 100);
                }
              }
            });
          },
          (error) => {
            console.error('Error getting location:', error);
            // Geolocation 실패 시에도 플래그 설정 (기본 위치에서 진행)
            geolocationCompleteRef.current = true;
          }
        );
      } else {
        // Geolocation API 미지원 시에도 플래그 설정
        geolocationCompleteRef.current = true;
      }

      setIsMapLoaded(true);

      // 지도 컨테이너 크기 재계산 및 타일 재로드 (부분 로딩 방지)
      setTimeout(() => {
        if (mapInstance && mapInstance.relayout) {
          console.log('[MapView] 🔄 Relayout map to fix partial loading');
          mapInstance.relayout();
        }
      }, 300);
    } catch (error) {
      console.error('Error initializing map:', error);
      setMapError('지도 초기화 중 오류가 발생했습니다.');
    }
  }, [useMapBasedLoading, fetchAEDByMapCenter]);

  // 마커 추가
  const addMarkers = useCallback(() => {
    console.log('[MapView] 📍 addMarkers called:', {
      hasMap: !!map,
      hasKakao: !!window.kakao,
      displayLocationsCount: displayLocations.length,
      searchRadius,
      timestamp: new Date().toISOString()
    });

    if (!map || !window.kakao) {
      console.warn('[MapView] ⚠️ addMarkers aborted: map or kakao not ready');
      return;
    }

    if (displayLocations.length === 0) {
      console.warn('[MapView] ⚠️ addMarkers aborted: no displayLocations');
      return;
    }

    // 기존 마커 제거
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    const markers: any[] = [];
    const bounds = new window.kakao.maps.LatLngBounds();

    // 지도 중심점 가져오기
    const mapCenter = map.getCenter();
    const centerLat = mapCenter.getLat();
    const centerLng = mapCenter.getLng();
    const radiusInKm = searchRadius; // km 단위

    console.log('[MapView] 📍 Map center:', { centerLat, centerLng, radiusInKm });

    let filteredCount = 0;
    let totalCount = 0;

    displayLocations.forEach((location, index) => {
      totalCount++;

      // 반경 필터링 항상 적용 (클라이언트 사이드 필터링)
      // 지도 중심으로부터 설정된 반경 내의 마커만 표시
      // 이는 AEDDataProvider의 지역 필터와 독립적으로 작동함
      const distance = calculateDistance(centerLat, centerLng, location.latitude, location.longitude);
      const shouldDisplay = distance <= radiusInKm;

      if (shouldDisplay) {
        filteredCount++;

        const position = new window.kakao.maps.LatLng(location.latitude, location.longitude);

        // 차단 장비 판별
        const isBlockedDevice = location.external_display === 'N' &&
          location.external_non_display_reason &&
          location.external_non_display_reason.trim() !== '' &&
          location.external_non_display_reason !== '구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박';

        // 일정추가 여부 확인
        const isScheduled = scheduledEquipment.has(location.equipment_serial);

        // 선택 여부 확인
        const isSelected = selectedAED?.equipment_serial === location.equipment_serial;

        // 마커 이미지 생성
        let markerImage = null;
        if (isSelected) {
          // 선택된 장비는 노란색으로 하이라이트
          const selectedMarkerSvg = `
            <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 0C11.716 0 5 6.716 5 15c0 11.25 15 30 15 30s15-18.75 15-30c0-8.284-6.716-15-15-15z" fill="#FCD34D" stroke="#F59E0B" stroke-width="3"/>
              <circle cx="20" cy="15" r="6" fill="white"/>
            </svg>
          `;
          markerImage = new window.kakao.maps.MarkerImage(
            'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(selectedMarkerSvg))),
            new window.kakao.maps.Size(40, 50),
            { offset: new window.kakao.maps.Point(20, 50) }
          );
        } else if (isScheduled) {
          // 일정추가된 장비는 회색
          const grayMarkerSvg = `
            <svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 0C9.37 0 4 5.37 4 12c0 9 12 24 12 24s12-15 12-24c0-6.63-5.37-12-12-12z" fill="#9CA3AF" stroke="white" stroke-width="2"/>
              <circle cx="16" cy="12" r="5" fill="white"/>
            </svg>
          `;
          markerImage = new window.kakao.maps.MarkerImage(
            'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(grayMarkerSvg))),
            new window.kakao.maps.Size(32, 40),
            { offset: new window.kakao.maps.Point(16, 40) }
          );
        } else if (isBlockedDevice) {
          // 차단 장비는 빨간색
          const redMarkerSvg = `
            <svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 0C9.37 0 4 5.37 4 12c0 9 12 24 12 24s12-15 12-24c0-6.63-5.37-12-12-12z" fill="#DC2626" stroke="white" stroke-width="2"/>
              <circle cx="16" cy="12" r="5" fill="white"/>
            </svg>
          `;
          markerImage = new window.kakao.maps.MarkerImage(
            'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(redMarkerSvg))),
            new window.kakao.maps.Size(32, 40),
            { offset: new window.kakao.maps.Point(16, 40) }
          );
        }
        // 일반 장비는 null (기본 파란색)

        const marker = new window.kakao.maps.Marker({
          position: position,
          image: markerImage, // 일정추가된 장비=회색, 차단 장비=빨간색, 일반 장비=파란색(기본)
          title: location.installation_institution || location.installation_org
        });

        // 마커 클릭 이벤트
        window.kakao.maps.event.addListener(marker, 'click', function() {
          setSelectedAED(location);
          map.panTo(position);

          // 팝업 위치 계산 (panTo 애니메이션 후)
          setTimeout(() => {
            const pos = calculatePopupPosition(location.latitude, location.longitude);
            if (pos) setPopupPosition(pos);
          }, 300);

          if (onMarkerClick) {
            onMarkerClick(location);
          }
        });

        markers.push(marker);
        bounds.extend(position);
      }
    });

    console.log(`[MapView] 🎯 Filtered markers: ${filteredCount} / ${totalCount} (within ${searchRadius}km)`);

    // 마커 표시
    markers.forEach(marker => marker.setMap(map));
    markersRef.current = markers;

    console.log('[MapView] ✅ Markers added to map:', {
      totalMarkers: markers.length,
      visibleOnMap: markersRef.current.length,
      timestamp: new Date().toISOString()
    });

    // 초기 로드 시에만 모든 마커가 보이도록 지도 범위 조정
    // ⚠️ 비활성화: 잘못된 좌표 데이터로 인한 자동 줌아웃 문제 방지
    // 대신 필터 선택 시 해당 지역 중심으로 이동하는 방식 사용
    // if (displayLocations.length > 0 && !initialBoundsSetRef.current && !useMapBasedLoading) {
    //   console.log('[MapView] 📐 Setting bounds to fit all markers');
    //   isProgrammaticMoveRef.current = true; // 프로그래밍 방식 이동 표시
    //   map.setBounds(bounds);
    //   initialBoundsSetRef.current = true;
    // }
  }, [map, displayLocations, onMarkerClick, useMapBasedLoading, searchRadius, calculateDistance, scheduledEquipment, selectedAED]);

  useEffect(() => {
    let cancelled = false;

    waitForKakaoMaps()
      .then(() => {
        if (cancelled) return;
        initializeMap();
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to load Kakao Maps SDK:', error);
        setMapError('카카오맵을 불러올 수 없습니다.');
      });

    return () => {
      cancelled = true;
    };
  }, [initializeMap]);

  useEffect(() => {
    if (map && isMapLoaded && displayLocations.length > 0) {
      addMarkers();
    }
  }, [map, isMapLoaded, displayLocations, addMarkers]);

  // 반경 원 그리기 함수 (useMapBasedLoading일 때만)
  const drawRadiusCircle = useCallback(() => {
    if (!map) return;

    // 기존 원 제거
    if (radiusCircleRef.current) {
      radiusCircleRef.current.setMap(null);
      radiusCircleRef.current = null;
    }

    // 지도 중심점 가져오기
    const center = map.getCenter();

    // 반경 원 생성 (항상 표시)
    const circle = new window.kakao.maps.Circle({
      center: center,
      radius: searchRadius * 1000, // km를 m로 변환
      strokeWeight: 2,
      strokeColor: '#10b981', // emerald-600
      strokeOpacity: 0.8,
      strokeStyle: 'solid',
      fillColor: '#10b981',
      fillOpacity: 0.1
    });

    circle.setMap(map);
    radiusCircleRef.current = circle;

    console.log(`[MapView] ⭕ Drew radius circle: ${searchRadius}km at center (${center.getLat()}, ${center.getLng()})`);

    // 반경에 맞춰 자동 줌 조정 (항상 적용)
    // 사용자가 반경 버튼을 클릭했을 때 적절한 줌 레벨로 조정
    let zoomLevel: number;
    if (searchRadius === 1) {
      zoomLevel = 5; // 1km - 많이 확대
    } else if (searchRadius === 3) {
      zoomLevel = 7; // 3km - 중간 확대
    } else if (searchRadius === 5) {
      zoomLevel = 8; // 5km - 축소하여 전체 보기
    } else {
      zoomLevel = 7; // 기본값
    }
    map.setLevel(zoomLevel);
    console.log('[MapView] 🔍 Auto-zoom to level', zoomLevel, 'for radius', searchRadius, 'km');
  }, [map, searchRadius, useMapBasedLoading]);

  // 지도 로드 완료 시 초기 원 그리기
  useEffect(() => {
    if (map && isMapLoaded) {
      drawRadiusCircle();
    }
  }, [map, isMapLoaded, drawRadiusCircle]);

  // 반경 변경 시 원 업데이트 및 데이터 다시 로드
  useEffect(() => {
    if (map) {
      console.log('[MapView] 🔄 Radius changed to:', searchRadius, 'km - updating circle and zoom');
      drawRadiusCircle();

      // useMapBasedLoading이 true일 때만 데이터 다시 로드
      if (useMapBasedLoading) {
        fetchAEDByMapCenter();
      }
    }
  }, [searchRadius, map, useMapBasedLoading, fetchAEDByMapCenter, drawRadiusCircle]);

  // 지도 이동 시 원 위치 업데이트 및 마커 재필터링
  useEffect(() => {
    if (!map) return;

    const updateCircleAndMarkers = () => {
      // 원 위치 업데이트
      if (radiusCircleRef.current) {
        const center = map.getCenter();
        radiusCircleRef.current.setPosition(center);
      }

      // 마커 재필터링 (지도 이동 시)
      if (!useMapBasedLoading && displayLocations.length > 0) {
        addMarkers();
      }
    };

    // 지도 드래그/줌 시 원 위치 및 마커 업데이트
    window.kakao.maps.event.addListener(map, 'center_changed', updateCircleAndMarkers);

    return () => {
      window.kakao.maps.event.removeListener(map, 'center_changed', updateCircleAndMarkers);
    };
  }, [map, useMapBasedLoading, displayLocations, addMarkers]);

  // 필터바에서 시도 선택 시 지도 중심 이동 (FilterBar -> MapView)
  useEffect(() => {
    if (!map) return;

    const handleRegionSelect = async (event: CustomEvent) => {
      const { sido, gugun } = event.detail;

      if (sido && sido !== '전체') {
        console.log('[MapView] 🎯 Filter selected, moving map to:', { sido, gugun });

        // 필터 변경으로 표시
        changeSourceRef.current = 'filter';

        // 선택된 지역 저장 (idle 이벤트에서 중복 업데이트 방지)
        if (gugun) {
          lastRegionRef.current = { sido, gugun };
        }

        let targetLat: number;
        let targetLng: number;
        let zoomLevel = 8;

        // 구군이 지정된 경우: 보건소 좌표로 이동
        if (gugun && gugun !== '전체' && gugun !== '구군') {
          try {
            console.log('[MapView] 📍 Fetching health center coords for:', { sido, gugun });
            const response = await fetch(`/api/health-center-coords?sido=${encodeURIComponent(sido)}&gugun=${encodeURIComponent(gugun)}`);

            if (response.ok) {
              const data = await response.json();
              targetLat = data.latitude;
              targetLng = data.longitude;
              zoomLevel = 6; // 구군 단위이므로 더 확대
              console.log('[MapView] ✅ Health center coords:', { healthCenter: data.healthCenter, lat: targetLat, lng: targetLng });
            } else {
              // API 실패 시 시도 중심으로 폴백
              console.warn('[MapView] ⚠️ Health center API failed, using region center');
              const region = REGIONS.find(r => r.label === sido);
              if (!region || !region.latitude || !region.longitude) return;
              targetLat = region.latitude;
              targetLng = region.longitude;
            }
          } catch (error) {
            console.error('[MapView] ❌ Error fetching health center coords:', error);
            // 에러 시 시도 중심으로 폴백
            const region = REGIONS.find(r => r.label === sido);
            if (!region || !region.latitude || !region.longitude) return;
            targetLat = region.latitude;
            targetLng = region.longitude;
          }
        } else {
          // 구군이 없으면 시도 중심으로 이동
          const region = REGIONS.find(r => r.label === sido);
          if (!region || !region.latitude || !region.longitude) return;
          targetLat = region.latitude;
          targetLng = region.longitude;
        }

        const moveLatLng = new window.kakao.maps.LatLng(targetLat, targetLng);
        map.setCenter(moveLatLng);
        map.setLevel(zoomLevel);
        initialBoundsSetRef.current = false;
      }
    };

    window.addEventListener('regionSelected', handleRegionSelect as EventListener);

    return () => {
      window.removeEventListener('regionSelected', handleRegionSelect as EventListener);
    };
  }, [map]);

  // 현재 위치로 이동
  const moveToCurrentLocation = () => {
    if (map && currentPosition) {
      const moveLatLng = new window.kakao.maps.LatLng(currentPosition.lat, currentPosition.lng);
      map.setCenter(moveLatLng);
      map.setLevel(5);
    }
  };

  // 장비 선택 시 지도에서 해당 위치로 이동
  // 마커의 화면 좌표 계산 (화면 경계 체크 포함)
  const calculatePopupPosition = (lat: number, lng: number) => {
    if (!map || !mapRef.current) return null;

    const projection = map.getProjection();
    const position = new window.kakao.maps.LatLng(lat, lng);
    const point = projection.pointFromCoords(position);

    const mapRect = mapRef.current.getBoundingClientRect();
    const isMobile = window.innerWidth < 768;

    // 모바일과 데스크톱 팝업 크기 다르게 설정
    const popupWidth = isMobile ? Math.min(window.innerWidth * 0.9, 360) : 320;
    const popupHeight = isMobile ? 280 : 300;
    const offset = isMobile ? 20 : 30;
    const margin = isMobile ? 10 : 20;

    let x = point.x + offset;
    let y = point.y;
    let arrowLeft = true;

    // 좌측 경계 체크
    if (x < margin) {
      x = margin;
    }

    // 우측 경계 체크 - 팝업이 지도 밖으로 나가면 마커 왼쪽에 배치
    if (x + popupWidth > mapRect.width - margin) {
      x = point.x - popupWidth - offset;
      arrowLeft = false;

      // 왼쪽에 배치해도 여전히 화면 밖이면 강제로 좌측 여백에 맞춤
      if (x < margin) {
        x = margin;
        arrowLeft = true;
      }
    }

    // 하단 경계 체크
    if (y + popupHeight / 2 > mapRect.height - margin) {
      y = mapRect.height - popupHeight / 2 - margin;
    }

    // 상단 경계 체크
    if (y - popupHeight / 2 < margin) {
      y = popupHeight / 2 + margin;
    }

    return { x, y, arrowLeft };
  };

  const handleLocationSelect = (location: AEDMapLocation) => {
    if (map) {
      const moveLatLng = new window.kakao.maps.LatLng(location.latitude, location.longitude);
      map.setCenter(moveLatLng);
      map.setLevel(4); // 줌인
      setSelectedAED(location);

      // 팝업 위치 계산 (지도 중심 이동 후 약간의 지연을 두고 계산)
      setTimeout(() => {
        const pos = calculatePopupPosition(location.latitude, location.longitude);
        setPopupPosition(pos);
      }, 300);

      if (onMarkerClick) {
        onMarkerClick(location);
      }
    }
  };

  // 날짜 포맷팅
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ko-KR');
  };

  // 유효기간 경고
  const getExpiryWarning = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: '만료됨', className: 'text-red-600 font-semibold' };
    } else if (diffDays <= 30) {
      return { text: `${diffDays}일 남음`, className: 'text-orange-600 font-semibold' };
    } else if (diffDays <= 90) {
      return { text: `${diffDays}일 남음`, className: 'text-yellow-600' };
    }
    return null;
  };

  // 드래그 시작 핸들러
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartY.current = clientY;
    dragStartHeight.current = listHeight;
  }, [listHeight]);

  // 드래그 중 핸들러
  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;

    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const containerHeight = window.innerHeight - 200; // h-[calc(100vh-200px)]
    const deltaY = dragStartY.current - clientY; // 위로 드래그하면 양수
    const deltaPercent = (deltaY / containerHeight) * 100;
    const newHeight = Math.max(15, Math.min(50, dragStartHeight.current + deltaPercent)); // 15%~50% 제한

    setListHeight(newHeight);
  }, [isDragging]);

  // 드래그 종료 핸들러
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 드래그 이벤트 리스너 등록
  useEffect(() => {
    if (isDragging) {
      const moveHandler = (e: MouseEvent | TouchEvent) => handleDragMove(e);
      const endHandler = () => handleDragEnd();

      document.addEventListener('mousemove', moveHandler);
      document.addEventListener('mouseup', endHandler);
      document.addEventListener('touchmove', moveHandler);
      document.addEventListener('touchend', endHandler);

      return () => {
        document.removeEventListener('mousemove', moveHandler);
        document.removeEventListener('mouseup', endHandler);
        document.removeEventListener('touchmove', moveHandler);
        document.removeEventListener('touchend', endHandler);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  return (
    <div className="relative h-[calc(100vh-200px)] flex flex-col md:flex-row overflow-hidden">
      {/* PC Side Panel */}
      <div
        className={`hidden md:block transition-all duration-300 bg-gray-900 overflow-y-auto
          ${showSidePanel ? 'md:w-80 md:border-r' : 'md:w-0'}
          border-gray-700 flex-shrink-0`}
      >
        {showSidePanel && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-200">장비 목록</h3>
              <button
                onClick={() => setShowSidePanel(false)}
                className="text-gray-400 hover:text-gray-200 transition-colors"
                aria-label="목록 접기"
                title="목록 접기"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>

            <div className="text-xs text-gray-400 mb-3">
              {dataLoading ? '로딩 중...' : `${filteredDisplayLocations.length}개`}
            </div>

            <div className="space-y-1.5">
              {filteredDisplayLocations.map((location, index) => {
                const isCriticalDevice = location.external_display === 'N' &&
                  location.external_non_display_reason &&
                  location.external_non_display_reason.trim() !== '' &&
                  location.external_non_display_reason !== '구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박';

                return (
                  <div
                    key={index}
                    onClick={() => handleLocationSelect(location)}
                    className={`p-1 rounded cursor-pointer transition-colors border ${
                      selectedAED?.equipment_serial === location.equipment_serial
                        ? 'bg-green-900/30 border-green-600'
                        : 'bg-gray-900 border-gray-800 hover:bg-gray-800/50'
                    }`}
                  >
                    {/* 첫 줄: 설치기관명 + 장비연번 + 차단 라벨 + 버튼 */}
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLocationSelect(location);
                        }}
                        className="font-medium text-lg sm:text-xs text-gray-100 hover:text-green-400 hover:underline text-left min-w-0 flex items-baseline gap-1 flex-1"
                      >
                        <span className="truncate">{location.installation_institution}</span>
                        <span className="text-[9px] text-gray-500 flex-shrink-0">
                          {location.equipment_serial || '-'}
                        </span>
                        {isCriticalDevice && (
                          <span className="text-[8px] px-1 py-[1px] bg-red-500 text-white rounded flex-shrink-0 font-semibold leading-tight">
                            차단
                          </span>
                        )}
                      </button>
                      {viewMode === 'inspection' ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onQuickInspect) onQuickInspect(location);
                          }}
                          className="text-[10px] px-1.5 py-0.5 h-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded flex-shrink-0"
                        >
                          점검
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSchedule) onSchedule([location]);
                          }}
                          className="text-[10px] px-1.5 py-0.5 h-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded flex-shrink-0"
                        >
                          추가
                        </button>
                      )}
                    </div>

                    {/* 둘째 줄: 주소 + 최종점검일 */}
                    <div className="flex items-center justify-between gap-1.5 text-[10px]">
                      <span className="text-gray-400 truncate flex-1">
                        {location.installation_address || '주소 미등록'}
                      </span>
                      {location.last_inspection_date && (
                        <span className="text-gray-500 flex-shrink-0 text-[9px]">
                          {new Date(location.last_inspection_date).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 지도 컨테이너 - 모바일/PC 공통 */}
      <div
        className="relative bg-gray-950 transition-all duration-300 flex-shrink-0 md:flex-1"
        style={isMobile ? { height: `${100 - listHeight}%` } : {}}
      >
        {/* Toggle Side Panel Button - PC only */}
        {!showSidePanel && (
          <button
            onClick={() => setShowSidePanel(true)}
            className="hidden md:block absolute top-1/2 -translate-y-1/2 left-0 z-20 bg-gray-800 rounded-r-lg p-2 shadow-lg hover:bg-gray-700 transition-colors"
            title="장비 목록 펼치기"
            aria-label="장비 목록 펼치기"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        <div
          ref={mapRef}
          className="w-full h-full"
        />

          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center z-30">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4 mx-auto"></div>
                <p className="text-white">데이터를 불러오는 중...</p>
              </div>
            </div>
          )}

          {/* Map Loading Overlay */}
          {!isMapLoaded && !mapError && (
            <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center z-20">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4 mx-auto"></div>
                <p className="text-white">지도를 불러오는 중...</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {mapError && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg z-30">
              {mapError}
            </div>
          )}

          {/* Control Buttons */}
          <div className="absolute bottom-8 left-4 z-10 space-y-2">
            <button
              onClick={moveToCurrentLocation}
              className="bg-white rounded-full p-3 shadow-lg hover:bg-gray-100 transition-colors group"
              title="내 위치로 이동"
              disabled={!currentPosition}
            >
              <svg className="w-6 h-6 text-gray-700 group-hover:text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
              </svg>
            </button>
          </div>

          {/* Radius Selector - 좌측 상단 */}
          <div className="absolute top-4 left-2 z-10">
            <div className="bg-white rounded p-1 shadow-lg">
              <div className="flex gap-0.5 items-center">
                <span className="text-[9px] text-gray-600 px-0.5">반경:</span>
                {[1, 3, 5].map(radius => (
                  <button
                    key={radius}
                    onClick={() => {
                      console.log(`[MapView] 🎯 Radius filter changed to ${radius}km`);
                      setSearchRadius(radius);
                    }}
                    className={`px-1 py-0.5 text-[9px] font-medium rounded transition-colors ${
                      searchRadius === radius
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {radius}km
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* List Filter Buttons - 우측 상단, viewMode에 따라 표시 */}
          {viewMode === 'admin' ? (
            <div className="absolute top-4 right-2 z-10">
              <div className="bg-white rounded p-1 shadow-lg">
                <div className="flex gap-0.5">
                  <button
                    onClick={() => {
                      console.log('[MapView] 📋 List filter: 전체');
                      setListFilter('all');
                    }}
                    className={`px-1.5 py-0.5 text-[9px] font-medium rounded transition-colors ${
                      listFilter === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    전체
                  </button>
                  <button
                    onClick={() => {
                      console.log('[MapView] 📋 List filter: 추가할 목록');
                      setListFilter('toAdd');
                    }}
                    className={`px-1.5 py-0.5 text-[9px] font-medium rounded transition-colors ${
                      listFilter === 'toAdd'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    추가필요
                  </button>
                  <button
                    onClick={() => {
                      console.log('[MapView] 📋 List filter: 추가된 목록');
                      setListFilter('added');
                    }}
                    className={`px-1.5 py-0.5 text-[9px] font-medium rounded transition-colors ${
                      listFilter === 'added'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    추가완료
                  </button>
                </div>
              </div>
            </div>
          ) : viewMode === 'inspection' ? (
            <div className="absolute top-4 right-2 z-10">
              <div className="bg-white rounded p-1 shadow-lg">
                <div className="flex gap-0.5">
                  <button
                    onClick={() => {
                      console.log('[MapView] 📋 List filter: 전체');
                      setListFilter('all');
                    }}
                    className={`px-1.5 py-0.5 text-[9px] font-medium rounded transition-colors ${
                      listFilter === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    전체
                  </button>
                  <button
                    onClick={() => {
                      console.log('[MapView] 📋 List filter: 점검대상목록');
                      setListFilter('target');
                    }}
                    className={`px-1.5 py-0.5 text-[9px] font-medium rounded transition-colors ${
                      listFilter === 'target'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    점검대상
                  </button>
                  <button
                    onClick={() => {
                      console.log('[MapView] 📋 List filter: 점검진행목록');
                      setListFilter('inProgress');
                    }}
                    className={`px-1.5 py-0.5 text-[9px] font-medium rounded transition-colors ${
                      listFilter === 'inProgress'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    진행중
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Selected AED Info Popup */}
          {selectedAED && popupPosition && (
            <div
              className="absolute bg-white rounded-lg shadow-xl z-20 w-[85vw] max-w-[280px]"
              style={{
                left: `${popupPosition.x}px`,
                top: `${popupPosition.y}px`,
                transform: 'translateY(-50%)',
                maxHeight: '80vh',
                overflowY: 'auto'
              }}
            >
              <div
                className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white transform rotate-45 ${
                  popupPosition.arrowLeft
                    ? '-left-1.5 shadow-[-2px_2px_4px_rgba(0,0,0,0.1)]'
                    : '-right-1.5 shadow-[2px_-2px_4px_rgba(0,0,0,0.1)]'
                }`}
              />
              <div className="p-2">
                {/* 헤더 + 서브 버튼 (우측 상단) */}
                <div className="flex items-start justify-between mb-1.5 gap-2">
                  <h3 className="text-xs font-bold text-gray-900 leading-tight flex-1 line-clamp-2">
                    {selectedAED.installation_institution || selectedAED.installation_org}
                  </h3>
                  {/* 작은 서브 버튼: 길찾기 + 로드뷰 */}
                  <div className="flex gap-0.5 flex-shrink-0">
                    <a
                      href={`https://map.kakao.com/link/to/${selectedAED.installation_institution || selectedAED.installation_org},${selectedAED.latitude},${selectedAED.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-amber-500/70 text-white px-1.5 py-0.5 rounded hover:bg-amber-500 transition-colors text-[8px] font-medium"
                    >
                      길찾기
                    </a>
                    <button
                      onClick={() => {
                        const url = `https://map.kakao.com/link/roadview/${selectedAED.latitude},${selectedAED.longitude}`;
                        window.open(url, '_blank');
                      }}
                      className="bg-blue-500/70 text-white px-1.5 py-0.5 rounded hover:bg-blue-500 transition-colors text-[8px] font-medium"
                    >
                      로드뷰
                    </button>
                  </div>
                </div>

                {/* 정보 그리드 - 압축 */}
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] mb-1.5">
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-gray-500 flex-shrink-0">제조사:</span>
                    <span className="text-gray-800 truncate">{selectedAED.manufacturer || '-'}</span>
                  </div>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-gray-500 flex-shrink-0">모델:</span>
                    <span className="text-gray-800 truncate">{selectedAED.model_name || '-'}</span>
                  </div>
                  <div className="col-span-2 flex items-baseline gap-0.5">
                    <span className="text-gray-500 flex-shrink-0">SN:</span>
                    <span className="text-gray-900 font-medium truncate">{selectedAED.equipment_serial}</span>
                  </div>
                  <div className="col-span-2 flex items-baseline gap-0.5">
                    <span className="text-gray-500 flex-shrink-0">주소:</span>
                    <span className="text-gray-800 line-clamp-1 text-[8px]">{selectedAED.installation_address || selectedAED.address || '-'}</span>
                  </div>
                  {selectedAED.installation_position && (
                    <div className="col-span-2 flex items-baseline gap-0.5">
                      <span className="text-gray-500 flex-shrink-0">위치:</span>
                      <span className="text-gray-800 truncate text-[8px]">{selectedAED.installation_position}</span>
                    </div>
                  )}
                </div>

                {/* 점검/만료 정보 */}
                <div className="border-t border-gray-200 pt-1 mb-1.5 space-y-0.5 text-[9px]">
                  <div className="flex items-center">
                    <span className="text-gray-500">최근점검일</span>
                    <span className="ml-1 text-gray-800 font-medium">{formatDate(selectedAED.last_inspection_date)}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-gray-500">패치유효기간</span>
                    <span className={`ml-1 ${getExpiryWarning(selectedAED.patch_expiry_date)?.className || 'text-gray-800'}`}>
                      {formatDate(selectedAED.patch_expiry_date)}
                      {getExpiryWarning(selectedAED.patch_expiry_date) && (
                        <span className="ml-0.5 text-[8px]">({getExpiryWarning(selectedAED.patch_expiry_date)?.text})</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-gray-500">배터리유효기간</span>
                    <span className={`ml-1 ${getExpiryWarning(selectedAED.battery_expiry_date)?.className || 'text-gray-800'}`}>
                      {formatDate(selectedAED.battery_expiry_date)}
                      {getExpiryWarning(selectedAED.battery_expiry_date) && (
                        <span className="ml-0.5 text-[8px]">({getExpiryWarning(selectedAED.battery_expiry_date)?.text})</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* 하단 메인 버튼: 액션 + 닫기 */}
                <div className="flex gap-1">
                  {viewMode === 'inspection' ? (
                    <button
                      onClick={() => {
                        if (onQuickInspect) {
                          onQuickInspect(selectedAED);
                        }
                        setSelectedAED(null);
                        setPopupPosition(null);
                      }}
                      className="flex-1 bg-emerald-600 text-white py-1.5 px-2 rounded hover:bg-emerald-700 transition-colors text-xs font-semibold shadow-sm"
                    >
                      점검 시작
                    </button>
                  ) : viewMode === 'admin' && (
                    scheduledEquipment.has(selectedAED.equipment_serial) ? (
                      inspectionSessions.get(selectedAED.equipment_serial)?.status === 'active' ? (
                        <button
                          onClick={() => {
                            if (onInspectionInProgress) {
                              onInspectionInProgress(selectedAED.equipment_serial);
                            }
                            setSelectedAED(null);
                            setPopupPosition(null);
                          }}
                          className="flex-1 bg-blue-600 text-white py-1.5 px-2 rounded hover:bg-blue-700 transition-colors text-xs font-semibold shadow-sm"
                        >
                          점검중
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (onCancelSchedule) {
                              onCancelSchedule(selectedAED.equipment_serial);
                            }
                            setSelectedAED(null);
                            setPopupPosition(null);
                          }}
                          className="flex-1 bg-red-600 text-white py-1.5 px-2 rounded hover:bg-red-700 transition-colors text-xs font-semibold shadow-sm"
                        >
                          일정 취소
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => {
                          if (onSchedule) {
                            onSchedule([selectedAED]);
                          }
                          setSelectedAED(null);
                          setPopupPosition(null);
                        }}
                        className="flex-1 bg-green-600 text-white py-1.5 px-2 rounded hover:bg-green-700 transition-colors text-xs font-semibold shadow-sm"
                      >
                        일정 추가
                      </button>
                    )
                  )}
                  <button
                    onClick={() => {
                      setSelectedAED(null);
                      setPopupPosition(null);
                    }}
                    className="px-3 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-xs font-semibold shadow-sm"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>

      {/* 장비 목록 - 모바일 only, 항상 표시 */}
      <div
        className="md:hidden bg-gray-950 overflow-y-auto relative"
        style={{ height: `${listHeight}%` }}
      >
        {/* 드래그 핸들 */}
        <div
          className="absolute top-0 left-0 right-0 h-8 flex items-center justify-center cursor-ns-resize bg-gradient-to-b from-gray-800/50 to-transparent hover:from-gray-700/70 active:from-gray-600/80 transition-colors z-10"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-8 h-0.5 bg-gray-500 rounded-full"></div>
            <div className="w-8 h-0.5 bg-gray-500 rounded-full"></div>
          </div>
        </div>

        <div className="p-2 pt-10">
          <div className="flex items-center justify-between mb-2 px-2">
            <h3 className="text-sm font-semibold text-gray-200">장비 목록</h3>
            <div className="text-xs text-gray-400">
              {dataLoading ? '로딩 중...' : `${filteredDisplayLocations.length}개`}
            </div>
          </div>

          <div className="space-y-1.5">
            {filteredDisplayLocations.map((location, index) => {
              const isCriticalDevice = location.external_display === 'N' &&
                location.external_non_display_reason &&
                location.external_non_display_reason.trim() !== '' &&
                location.external_non_display_reason !== '구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박';

              return (
                <div
                  key={index}
                  className={`relative overflow-hidden rounded border transition-colors ${
                    selectedAED?.equipment_serial === location.equipment_serial
                      ? 'border-green-600 bg-green-900/20'
                      : 'border-gray-800 bg-gray-900 hover:bg-gray-800/50'
                  }`}
                >
                  <div className="p-1 space-y-0.5">
                    {/* 첫 줄: 설치기관명 + 장비연번 + 차단 라벨 + 버튼 */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          handleLocationSelect(location);
                          // setMapCollapsed(false); // TODO: 지도 펼침 기능 구현
                        }}
                        className="font-medium text-lg sm:text-xs text-gray-100 hover:text-green-400 hover:underline text-left min-w-0 flex items-baseline gap-1 flex-1"
                      >
                        <span className="truncate">{location.installation_institution}</span>
                        <span className="text-[9px] text-gray-500 flex-shrink-0">
                          {location.equipment_serial || '-'}
                        </span>
                        {isCriticalDevice && (
                          <span className="text-[8px] px-1 py-[1px] bg-red-500 text-white rounded flex-shrink-0 font-semibold leading-tight">
                            차단
                          </span>
                        )}
                      </button>
                      {viewMode === 'inspection' ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onQuickInspect) onQuickInspect(location);
                          }}
                          className="text-[10px] px-1.5 py-0.5 h-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors flex-shrink-0"
                        >
                          점검
                        </button>
                      ) : scheduledEquipment.has(location.equipment_serial) ? (
                        inspectionSessions.get(location.equipment_serial)?.status === 'active' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onInspectionInProgress) onInspectionInProgress(location.equipment_serial);
                            }}
                            className="text-[10px] px-1.5 py-0.5 h-5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex-shrink-0"
                          >
                            점검중
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onCancelSchedule) onCancelSchedule(location.equipment_serial);
                            }}
                            className="text-[10px] px-1.5 py-0.5 h-5 bg-red-500 hover:bg-red-600 text-white rounded transition-colors flex-shrink-0"
                          >
                            취소
                          </button>
                        )
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSchedule) onSchedule([location]);
                          }}
                          className="text-[10px] px-1.5 py-0.5 h-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors flex-shrink-0"
                        >
                          추가
                        </button>
                      )}
                    </div>

                    {/* 둘째 줄: 주소 + 최종점검일 */}
                    <div className="flex items-center justify-between gap-1.5 text-[10px]">
                      <span className="text-gray-400 truncate flex-1">
                        {location.installation_address || '주소 미등록'}
                      </span>
                      {location.last_inspection_date && (
                        <span className="text-gray-500 flex-shrink-0 text-[9px]">
                          {new Date(location.last_inspection_date).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
