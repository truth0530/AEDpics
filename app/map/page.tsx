'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { waitForKakaoMaps } from '@/lib/constants/kakao';

interface AEDLocation {
  equipment_serial: string;
  installation_institution: string;
  installation_address: string;
  installation_location_address?: string;
  installation_position?: string;
  latitude: number;
  longitude: number;
  sido?: string;
  gugun?: string;
  model_name?: string;
  installation_date?: string;
  institution_contact?: string;
  last_seen_date?: string;
  patch_expiry_date?: string;
  battery_expiry_date?: string;
  category_1?: string;
  category_2?: string;
  category_3?: string;
}

// 지역 데이터
const REGIONS = [
  { code: '서울', name: '서울특별시' },
  { code: '부산', name: '부산광역시' },
  { code: '대구', name: '대구광역시' },
  { code: '인천', name: '인천광역시' },
  { code: '광주', name: '광주광역시' },
  { code: '대전', name: '대전광역시' },
  { code: '울산', name: '울산광역시' },
  { code: '세종', name: '세종특별자치시' },
  { code: '경기', name: '경기도' },
  { code: '충북', name: '충청북도' },
  { code: '충남', name: '충청남도' },
  { code: '전북', name: '전북특별자치도' },
  { code: '전남', name: '전라남도' },
  { code: '경북', name: '경상북도' },
  { code: '경남', name: '경상남도' },
  { code: '제주', name: '제주특별자치도' },
  { code: '강원', name: '강원특별자치도' },
];

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
   
  const [map, setMap] = useState<any>(null);
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [locationError, setLocationError] = useState<string>('');
  const [selectedAED, setSelectedAED] = useState<AEDLocation | null>(null);
  const [aedLocations, setAedLocations] = useState<AEDLocation[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
   
  const markersRef = useRef<any[]>([]);
   
  const clustererRef = useRef<any>(null);

  // 검색 필터 상태
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    region: '',
    city: '',
    category1: '',
    category2: '',
    category3: ''
  });

  // AED 데이터 가져오기
  const fetchAEDLocations = useCallback(async (bounds?: { west: number; south: number; east: number; north: number }) => {
    try {
      setDataLoading(true);

      const params = new URLSearchParams();
      // 성능 최적화: 초기 로딩 속도 개선을 위해 500개로 제한
      // 줌인/이동 시 bounds 기반으로 해당 영역만 로드
      params.append('limit', '500');

      if (bounds) {
        params.append('bounds', `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`);
      }

      // 필터 적용
      if (filters.search) params.append('search', filters.search);
      if (filters.region) params.append('region', filters.region);
      if (filters.city) params.append('city', filters.city);
      if (filters.category1) params.append('category1', filters.category1);
      if (filters.category2) params.append('category2', filters.category2);
      if (filters.category3) params.append('category3', filters.category3);

      const response = await fetch(`/api/public/aed-locations?${params}`);
      const data = await response.json();

      if (data.locations) {
        setAedLocations(data.locations);
        console.log(`Loaded ${data.locations.length} AED locations`);
      }
    } catch (error) {
      console.error('Failed to fetch AED locations:', error);
      setLocationError('AED 데이터를 불러올 수 없습니다.');
    } finally {
      setDataLoading(false);
    }
  }, [filters]);

  // 지도에 마커 추가
  const addMarkers = useCallback(() => {
    if (!map || !window.kakao) return;

    // 기존 마커 제거
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // 클러스터러 제거
    if (clustererRef.current) {
      clustererRef.current.clear();
    }

    const markers: any[] = [];

    // AED 마커 생성 - 연두색 하트에 흰색 번개 디자인
    aedLocations.forEach((aed) => {
      const svgString = `
          <svg width="36" height="42" viewBox="0 0 36 42" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
                <feOffset dx="0" dy="2" result="offsetblur"/>
                <feFlood flood-color="#000000" flood-opacity="0.3"/>
                <feComposite in2="offsetblur" operator="in"/>
                <feMerge>
                  <feMergeNode/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <path d="M18 8C16 2 10 0 6 4C2 8 2 12 2 14C2 22 18 36 18 36S34 22 34 14C34 12 34 8 30 4C26 0 20 2 18 8Z"
                  fill="#84cc16" stroke="white" stroke-width="1.5" filter="url(#shadow)"/>
            <path d="M23 12L15 22H21L13 30L21 20H15L23 12Z"
                  fill="white" stroke="#4ade80" stroke-width="0.5"/>
          </svg>
        `;
      const markerImage = new window.kakao.maps.MarkerImage(
        'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString))),
        new window.kakao.maps.Size(36, 42),
        { offset: new window.kakao.maps.Point(18, 42) }
      );

      const marker = new window.kakao.maps.Marker({
        position: new window.kakao.maps.LatLng(aed.latitude, aed.longitude),
        image: markerImage,
        title: aed.installation_institution
      });

      // 마커 클릭 이벤트
      window.kakao.maps.event.addListener(marker, 'click', function() {
        setSelectedAED(aed);

        // 지도 중심 이동
        const moveLatLng = new window.kakao.maps.LatLng(aed.latitude, aed.longitude);
        map.panTo(moveLatLng);
      });

      markers.push(marker);
    });

    // 클러스터러는 일단 제외하고 일반 마커로 표시
    // TODO: 클러스터러 라이브러리 로드 후 추가
    markers.forEach(marker => {
      marker.setMap(map);
    });
    markersRef.current = markers;
  }, [map, aedLocations]);

  // 카카오맵 초기화
  const initializeMap = useCallback(() => {
    console.log('Initializing map...', {
      kakaoLoaded: !!window.kakao,
      mapsLoaded: !!window.kakao?.maps
    });

    if (!window.kakao || !window.kakao.maps) {
      console.error('Kakao Maps SDK not loaded');
      setLocationError('카카오맵을 불러올 수 없습니다.');
      setIsLoading(false);
      return;
    }

    const container = mapRef.current;
    if (!container) {
      console.error('Map container not found');
      return;
    }

    try {
      const options = {
        center: new window.kakao.maps.LatLng(37.5665, 126.9780), // 서울시청 기본 위치
        level: 7, // 더 넓은 영역을 보도록 설정
      };

      const mapInstance = new window.kakao.maps.Map(container, options);
      setMap(mapInstance);
      console.log('Map initialized successfully');

      // 지도 컨트롤 추가
      const mapTypeControl = new window.kakao.maps.MapTypeControl();
      mapInstance.addControl(mapTypeControl, window.kakao.maps.ControlPosition.TOPRIGHT);

      const zoomControl = new window.kakao.maps.ZoomControl();
      mapInstance.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);

      // 지도 이동/줌 완료 이벤트
      window.kakao.maps.event.addListener(mapInstance, 'idle', function() {
        const bounds = mapInstance.getBounds();
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();

        // 지도 영역 내 데이터만 다시 로드 (성능 최적화)
        const level = mapInstance.getLevel();
        if (level <= 8) { // 줌 레벨이 충분히 가까울 때만
          fetchAEDLocations({
            west: sw.getLng(),
            south: sw.getLat(),
            east: ne.getLng(),
            north: ne.getLat()
          });
        }
      });

      // 현재 위치 가져오기
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const locPosition = new window.kakao.maps.LatLng(lat, lng);

            setCurrentPosition({ lat, lng });

            // 현재 위치로 지도 중심 이동
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
          },
          (error) => {
            console.error('Error getting location:', error);
            // 위치 정보 오류는 무시하고 기본 위치 사용
          }
        );
      }

      // 초기 데이터 로드
      fetchAEDLocations();
      setIsLoading(false);

    } catch (error) {
      console.error('Error initializing map:', error);
      setLocationError('지도 초기화 중 오류가 발생했습니다.');
      setIsLoading(false);
    }
  }, [fetchAEDLocations]);

  // 마커 업데이트
  useEffect(() => {
    if (map && aedLocations.length > 0) {
      addMarkers();
    }
  }, [map, aedLocations, addMarkers]);

  // 현재 위치로 이동
  const moveToCurrentLocation = () => {
    if (map && currentPosition) {
      const moveLatLng = new window.kakao.maps.LatLng(currentPosition.lat, currentPosition.lng);
      map.setCenter(moveLatLng);
      map.setLevel(5);
    }
  };

  // 전체 AED 보기 (서울 지역)
  const showSeoulArea = () => {
    if (map) {
      const seoulCenter = new window.kakao.maps.LatLng(37.5665, 126.9780);
      map.setCenter(seoulCenter);
      map.setLevel(8);
    }
  };

  // 검색 수행
  const handleSearch = () => {
    fetchAEDLocations();
    setShowFilters(false);
  };

  // 필터 초기화
  const resetFilters = () => {
    setFilters({
      search: '',
      region: '',
      city: '',
      category1: '',
      category2: '',
      category3: ''
    });
  };

  // 날짜 포맷팅
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ko-KR');
  };

  // 유효기간 확인 및 경고 표시
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

  useEffect(() => {
    let cancelled = false;

    waitForKakaoMaps()
      .then(() => {
        if (cancelled) return;
        console.log('Kakao maps available, initializing...');
        initializeMap();
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to load Kakao Maps SDK:', error);
        setLocationError('카카오맵을 불러올 수 없습니다. 페이지를 새로고침해주세요.');
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initializeMap]);

  return (
    <div className="min-h-screen bg-gray-900 relative">

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-sm shadow-md">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800">AED 위치 지도</h1>
              <p className="text-sm text-gray-600">
                {dataLoading ? '데이터 로딩 중...' : `${aedLocations.length}개 AED 표시`}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                검색 필터
              </button>
              <button
                onClick={() => window.history.back()}
                className="text-gray-600 hover:text-gray-800 transition-colors p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* 검색 필터 패널 */}
        {showFilters && (
          <div className="px-4 pb-4 border-t border-gray-200 bg-white">
            <div className="mt-4 space-y-3">
              {/* 검색어 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">검색어</label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="기관명, 주소, 위치 검색"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* 지역 선택 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">시/도</label>
                  <select
                    value={filters.region}
                    onChange={(e) => setFilters({ ...filters, region: e.target.value, city: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">전체</option>
                    {REGIONS.map(region => (
                      <option key={region.code} value={region.code}>{region.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">시/군/구</label>
                  <input
                    type="text"
                    value={filters.city}
                    onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                    placeholder="시/군/구 입력"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    disabled={!filters.region}
                  />
                </div>
              </div>

              {/* 카테고리 필터 */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">분류1</label>
                  <input
                    type="text"
                    value={filters.category1}
                    onChange={(e) => setFilters({ ...filters, category1: e.target.value })}
                    placeholder="분류1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">분류2</label>
                  <input
                    type="text"
                    value={filters.category2}
                    onChange={(e) => setFilters({ ...filters, category2: e.target.value })}
                    placeholder="분류2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">분류3</label>
                  <input
                    type="text"
                    value={filters.category3}
                    onChange={(e) => setFilters({ ...filters, category3: e.target.value })}
                    placeholder="분류3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* 버튼 */}
              <div className="flex gap-2">
                <button
                  onClick={handleSearch}
                  className="flex-1 bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors"
                >
                  검색
                </button>
                <button
                  onClick={resetFilters}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  초기화
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Map Container */}
      <div
        ref={mapRef}
        className="w-full h-screen"
        style={{ minHeight: '100vh' }}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center z-30">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4 mx-auto"></div>
            <p className="text-white">지도를 불러오는 중...</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {locationError && !isLoading && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg z-30">
          {locationError}
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

        <button
          onClick={showSeoulArea}
          className="bg-white rounded-full p-3 shadow-lg hover:bg-gray-100 transition-colors group"
          title="서울 전체 보기"
        >
          <svg className="w-6 h-6 text-gray-700 group-hover:text-green-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </button>
      </div>

      {/* Legend */}
      <div className="absolute top-24 right-4 bg-white rounded-lg p-4 shadow-lg z-10">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">범례</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
            <span className="text-xs text-gray-600">내 위치</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 36 42" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 8C16 2 10 0 6 4C2 8 2 12 2 14C2 22 18 36 18 36S34 22 34 14C34 12 34 8 30 4C26 0 20 2 18 8Z"
                    fill="#84cc16"/>
              <path d="M23 12L15 22H21L13 30L21 20H15L23 12Z" fill="white"/>
            </svg>
            <span className="text-xs text-gray-600">AED</span>
          </div>
        </div>
      </div>

      {/* Selected AED Info */}
      {selectedAED && (
        <div className="absolute bottom-8 right-4 bg-white rounded-lg shadow-xl z-10 max-w-md">
          <div className="p-4">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold text-gray-800 pr-2">{selectedAED.installation_institution}</h3>
              <button
                onClick={() => setSelectedAED(null)}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="font-medium text-gray-500">장비연번:</span>
                  <p className="text-gray-800">{selectedAED.equipment_serial}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-500">모델명:</span>
                  <p className="text-gray-800">{selectedAED.model_name || '-'}</p>
                </div>
              </div>

              <div>
                <span className="font-medium text-gray-500">설치주소:</span>
                <p className="text-gray-800">{selectedAED.installation_address}</p>
              </div>

              {selectedAED.installation_position && (
                <div>
                  <span className="font-medium text-gray-500">설치위치:</span>
                  <p className="text-gray-800">{selectedAED.installation_position}</p>
                </div>
              )}

              {selectedAED.institution_contact && (
                <div>
                  <span className="font-medium text-gray-500">연락처:</span>
                  <p className="text-gray-800">{selectedAED.institution_contact}</p>
                </div>
              )}

              {/* 유효기간 정보 */}
              <div className="pt-2 border-t border-gray-200 space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-500">최근점검:</span>
                  <span className="text-gray-800">{formatDate(selectedAED.last_seen_date)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="font-medium text-gray-500">패치만료:</span>
                  <span className={getExpiryWarning(selectedAED.patch_expiry_date)?.className || 'text-gray-800'}>
                    {formatDate(selectedAED.patch_expiry_date)}
                    {getExpiryWarning(selectedAED.patch_expiry_date) && (
                      <span className="ml-1">({getExpiryWarning(selectedAED.patch_expiry_date)?.text})</span>
                    )}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="font-medium text-gray-500">배터리만료:</span>
                  <span className={getExpiryWarning(selectedAED.battery_expiry_date)?.className || 'text-gray-800'}>
                    {formatDate(selectedAED.battery_expiry_date)}
                    {getExpiryWarning(selectedAED.battery_expiry_date) && (
                      <span className="ml-1">({getExpiryWarning(selectedAED.battery_expiry_date)?.text})</span>
                    )}
                  </span>
                </div>
              </div>

              {/* 분류 정보 */}
              {(selectedAED.category_1 || selectedAED.category_2 || selectedAED.category_3) && (
                <div className="pt-2 border-t border-gray-200">
                  <span className="font-medium text-gray-500">분류:</span>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {selectedAED.category_1 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">{selectedAED.category_1}</span>
                    )}
                    {selectedAED.category_2 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">{selectedAED.category_2}</span>
                    )}
                    {selectedAED.category_3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">{selectedAED.category_3}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <a
                href={`https://map.kakao.com/link/to/${selectedAED.installation_institution},${selectedAED.latitude},${selectedAED.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-yellow-500 text-white py-2 px-3 rounded-lg hover:bg-yellow-600 transition-colors text-sm text-center"
              >
                길찾기
              </a>
              <button
                onClick={() => {
                  const url = `https://map.kakao.com/link/roadview/${selectedAED.latitude},${selectedAED.longitude}`;
                  window.open(url, '_blank');
                }}
                className="flex-1 bg-blue-500 text-white py-2 px-3 rounded-lg hover:bg-blue-600 transition-colors text-sm"
              >
                로드뷰
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}