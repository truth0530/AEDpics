'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { AEDDataProvider, useAEDData } from '@/app/aed-data/components/AEDDataProvider';
import { DataTable } from '@/app/aed-data/components/DataTable';
import { AEDFilterBar } from '@/app/aed-data/components/AEDFilterBar';
import { MapView } from '@/components/inspection/MapView';
import { ScheduleModal } from '@/app/aed-data/components/ScheduleModal';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import type { UserProfile } from '@/packages/types';
import { normalizeRegionName } from '@/lib/constants/regions';
import { waitForKakaoMaps } from '@/lib/constants/kakao';
import { useAEDDataFreshness } from '@/lib/hooks/use-aed-data-cache';

interface AEDDataPageClientProps {
  initialFilters: Record<string, string | string[] | undefined>;
  userProfile: UserProfile;
}

function AEDDataContent({ userProfile }: { userProfile: UserProfile }) {
  const [viewMode, setViewMode] = useState<'toAdd' | 'map' | 'scheduled' | 'all'>('toAdd'); // 기본 탭을 '추가할목록'으로 변경
  const { data, isLoading, isFetching, error, setFilters, scheduled, refetch } = useAEDData();
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedDevices, setSelectedDevices] = useState<any[]>([]);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set());
  const [initialLocationLoading, setInitialLocationLoading] = useState(true);
  const [filterCollapsed, setFilterCollapsed] = useState(false);
  const queryClient = useQueryClient();

  // ✅ 매일 교체되는 데이터셋 캐시 무효화 훅
  const { isDataFresh, lastUpdated, snapshotDate } = useAEDDataFreshness();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEBUG === 'true' && isDataFresh) {
      console.log('[AEDDataPageClient] Data freshness check:', {
        lastUpdated,
        snapshotDate
      });
    }
  }, [isDataFresh, lastUpdated, snapshotDate]);

  // ✅ 일정추가 상태는 메인 쿼리에 포함되어 있음 (별도 API 호출 제거)
  // ✅ 컴포넌트에서 필요 시 Set으로 변환 (메모이제이션)
  const scheduledEquipment = useMemo(
    () => new Set(scheduled || []),
    [scheduled]
  );
  const contentRef = useRef<HTMLDivElement>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);
  const isRegionChangeInProgress = useRef(false);
  const hasInitializedDefaultFilters = useRef(false);

  // 체크박스 선택 핸들러
  const handleDeviceSelect = (deviceId: string, checked: boolean) => {
    setSelectedDeviceIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(deviceId);
      } else {
        newSet.delete(deviceId);
      }
      return newSet;
    });
  };

  // 전체 선택/해제 - DataTable에서 전달받은 실제 devices 기준
  const handleSelectAll = (checked: boolean) => {
    console.log('[AEDDataPageClient] handleSelectAll:', { checked });
    // DataTable이 내부적으로 처리하므로 여기서는 아무것도 하지 않음
    // DataTable의 toggleSelectAll이 개별 onDeviceSelect를 호출할 것임
  };

  // 일정추가 버튼 클릭
  const handleScheduleClick = () => {
    const selected = data?.filter(d =>
      selectedDeviceIds.has(d.equipment_serial || d.id)
    ) || [];
    setSelectedDevices(selected);
    setShowScheduleModal(true);
  };

  // 일정 취소 mutation
  const cancelScheduleMutation = useMutation({
    mutationFn: async (equipmentSerial: string) => {
      // 1. 할당 정보 조회
      const response = await fetch(`/api/inspections/assignments?assignedTo=${userProfile.id}&equipmentSerial=${equipmentSerial}`);
      if (!response.ok) {
        throw new Error('할당 정보를 조회할 수 없습니다.');
      }

      const result = await response.json();
      // pending 또는 scheduled 상태의 할당 찾기
      const assignment = result.data?.find((a: any) =>
        a.equipment_serial === equipmentSerial &&
        (a.status === 'pending' || a.status === 'scheduled')
      );

      if (!assignment) {
        // 이미 점검이 시작되었거나 취소할 수 있는 일정이 없는 경우
        throw new Error('취소할 수 있는 일정이 없습니다. 이미 점검이 시작되었거나 완료된 상태일 수 있습니다.');
      }

      // 2. 할당 취소
      const cancelResponse = await fetch(`/api/inspections/assignments?id=${assignment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' })
      });

      if (!cancelResponse.ok) {
        const error = await cancelResponse.json();
        throw new Error(error.error || '일정 취소에 실패했습니다.');
      }

      return { equipmentSerial };
    },
    onMutate: async (equipmentSerial) => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({ queryKey: ['scheduled-equipment', userProfile.id] });

      // ✅ 이전 상태 저장 (Array 타입)
      const previousScheduled = queryClient.getQueryData<string[]>(
        ['scheduled-equipment', userProfile.id]
      );

      // ✅ 낙관적 업데이트 - 즉시 UI 반영 (Array에서 제거)
      queryClient.setQueryData<string[]>(
        ['scheduled-equipment', userProfile.id],
        (old = []) => old.filter(serial => serial !== equipmentSerial)
      );

      return { previousScheduled };
    },
    onSuccess: () => {
      // ✅ 성공 시 사용자 피드백 (혼란 방지)
      console.log('일정이 취소되었습니다.');
      // TODO: Toast 알림 추가 가능
    },
    onError: (err, variables, context) => {
      // 실패 시 롤백
      console.error('Failed to cancel schedule:', err);
      if (context?.previousScheduled) {
        queryClient.setQueryData(
          ['scheduled-equipment', userProfile.id],
          context.previousScheduled
        );
      }
      // ✅ 사용자에게 에러 메시지 표시
      alert(err instanceof Error ? err.message : '일정 취소에 실패했습니다.');
    },
    onSettled: () => {
      // ✅ aed-data 캐시도 무효화 (UI 즉시 업데이트)
      queryClient.invalidateQueries({
        queryKey: ['scheduled-equipment', userProfile.id],
        exact: true
      });
      queryClient.invalidateQueries({ 
        queryKey: ['aed-data'],
        refetchType: 'active' // 현재 활성화된 쿼리만 재조회
      });
    }
  });

  // ✅ 일정추가된 장비 목록은 useQuery로 자동 관리됨 (useEffect 제거)

  // AEDDataContent 레벨에서 mapRegionChanged 이벤트 리스닝
  useEffect(() => {
    const handleMapRegionChanged = (event: CustomEvent) => {
      const { sido, gugun } = event.detail;
      console.log('[AEDDataPageClient] 🗺️ mapRegionChanged received:', { sido, gugun });

      // 지역 변경 시작 플래그 설정 (자동 접기 방지)
      isRegionChangeInProgress.current = true;

      // 필터 업데이트
      setFilters({
        regionCodes: [sido],
        cityCodes: [gugun],
        queryCriteria: 'address',
      });

      // 1초 후 플래그 해제
      setTimeout(() => {
        isRegionChangeInProgress.current = false;
      }, 1000);
    };

    window.addEventListener('mapRegionChanged', handleMapRegionChanged as EventListener);

    return () => {
      window.removeEventListener('mapRegionChanged', handleMapRegionChanged as EventListener);
    };
  }, [setFilters]);

  // 페이지 로드 시 초기화: 전체목록/추가된목록 탭 = 관할지역 고정, 지도 탭 = 위치 기반
  useEffect(() => {
    // 🔒 무한 루프 방지: 이미 초기화했으면 실행하지 않음
    if (hasInitializedDefaultFilters.current) {
      console.log('[AEDDataPageClient] Filters already initialized, skipping');
      return;
    }

    let cancelled = false;

    const initializeFilters = async () => {
      // 사용자가 필터를 수정했는지 확인하는 세션 플래그
      const userModifiedFilters = typeof window !== 'undefined'
        ? window.sessionStorage.getItem('aed_filters_user_modified')
        : null;

      console.log('[AEDDataPageClient] User modified filters?', userModifiedFilters);

      // 목록 탭 (추가할목록/추가된목록/전체목록): 관할 지역으로 고정
      if (viewMode === 'toAdd' || viewMode === 'scheduled' || viewMode === 'all') {
        console.log('[AEDDataPageClient] 목록 탭: 관할 지역으로 필터 설정');

        // accessScope에서 관할 지역 가져오기
        const response = await fetch('/api/user/profile');
        if (!response.ok) {
          console.error('[AEDDataPageClient] Failed to fetch user profile');
          setInitialLocationLoading(false);
          hasInitializedDefaultFilters.current = true;
          return;
        }

        const profile = await response.json();

        if (profile?.organization) {
          const regionCode = profile.organization.region_code;
          const cityCode = profile.organization.city_code;

          const newFilters: any = {
            regionCodes: regionCode ? [regionCode] : undefined,
            cityCodes: cityCode ? [cityCode] : undefined,
            queryCriteria: 'address',
          };

          // ✅ 사용자 선택 존중: category_1 강제 제거
          // 초기 로드 시에도 사용자가 직접 선택하도록 함
          console.log('[AEDDataPageClient] ✅ Setting initial filters without forced category_1');

          setFilters(newFilters);
        }

        setInitialLocationLoading(false);
        hasInitializedDefaultFilters.current = true; // 초기화 완료
        return;
      }

      // 지도 탭: 먼저 관할 지역으로 설정 후, 위치 기반으로 업데이트
      if (viewMode === 'map') {
        // 1. 먼저 관할 지역으로 필터 설정 (즉시 데이터 로드)
        const response = await fetch('/api/user/profile');
        if (!response.ok) {
          console.error('[AEDDataPageClient] Failed to fetch user profile');
          setInitialLocationLoading(false);
          hasInitializedDefaultFilters.current = true;
          return;
        }

        const profile = await response.json();

        if (profile?.organization) {
          const regionCode = profile.organization.region_code;

          const initialFilters: any = {
            regionCodes: regionCode ? [regionCode] : undefined,
            queryCriteria: 'address',
          };

          // ✅ 사용자 선택 존중: category_1 강제 제거
          console.log('[AEDDataPageClient] ✅ Map mode: Setting initial filters without forced category_1');

          setFilters(initialFilters);
        }

        // 2. geolocation으로 현재 위치 기반 필터 업데이트 (선택적)
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              if (cancelled) return;

              const lat = position.coords.latitude;
              const lng = position.coords.longitude;

              console.log('[AEDDataPageClient] Current position:', lat, lng);

              try {
                // Kakao Maps SDK 로드 대기
                await waitForKakaoMaps();

                if (cancelled || !window.kakao) return;

                // Geocoder로 주소 변환
                const geocoder = new window.kakao.maps.services.Geocoder();
                geocoder.coord2RegionCode(lng, lat, function(result: any, status: any) {
                  if (cancelled) return;

                  if (status === window.kakao.maps.services.Status.OK) {
                    const region = result.find((r: any) => r.region_type === 'H');
                    if (region) {
                      const sidoFull = region.region_1depth_name; // 예: "대구광역시"
                      const gugun = region.region_2depth_name;     // 예: "중구"

                      // normalizeRegionName 사용: "대구광역시" → "대구"
                      const sidoShort = normalizeRegionName(sidoFull);

                      console.log('[AEDDataPageClient] Detected location:', {
                        full: sidoFull,
                        short: sidoShort,
                        city: gugun
                      });

                      // sessionStorage에 저장
                      if (typeof window !== 'undefined') {
                        window.sessionStorage.setItem('selectedSido', sidoShort);
                        window.sessionStorage.setItem('selectedGugun', gugun);
                      }

                      // 필터 적용
                      const newFilters: any = {
                        regionCodes: [sidoShort],
                        cityCodes: [gugun],
                        queryCriteria: 'address',
                      };

                      // 초기 로드 시에만 구비의무기관 기본값 적용
                      if (!userModifiedFilters) {
                        newFilters.category_1 = ['구비의무기관'];
                        console.log('[AEDDataPageClient] ✅ Applying default category_1 (first load)');
                      }

                      setFilters(newFilters);

                      // 필터바에 알림 (드롭다운 업데이트용)
                      setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('mapRegionChanged', {
                          detail: { sido: sidoShort, gugun }
                        }));
                      }, 100);

                      setInitialLocationLoading(false);
                      hasInitializedDefaultFilters.current = true; // 초기화 완료
                    }
                  } else {
                    console.warn('[AEDDataPageClient] Geocoding failed');
                    setInitialLocationLoading(false);
                  }
                });
              } catch (error) {
                console.error('[AEDDataPageClient] Failed to load Kakao Maps:', error);
                setInitialLocationLoading(false);
                hasInitializedDefaultFilters.current = true; // 초기화 완료 (실패 시에도)
              }
            },
            (error) => {
              if (cancelled) return;
              console.warn('[AEDDataPageClient] Location permission denied:', error);
              setInitialLocationLoading(false);
              hasInitializedDefaultFilters.current = true; // 초기화 완료 (실패 시에도)
            },
            {
              enableHighAccuracy: false,
              timeout: 5000,
              maximumAge: 0
            }
          );
        } else {
          console.warn('[AEDDataPageClient] Geolocation not supported or not in map mode');
          setInitialLocationLoading(false);
          hasInitializedDefaultFilters.current = true; // 초기화 완료 (geolocation 없는 경우에도)
        }
        return;
      }
    };

    initializeFilters();

    return () => {
      cancelled = true;
    };
  }, [setFilters, viewMode, userProfile.id]);

  // 스마트 자동 접기: 필터 영역 외부 클릭 시 자동으로 접기
  useEffect(() => {
    if (filterCollapsed) return; // 이미 접혀있으면 실행 안함

    const handleClickOutside = (event: MouseEvent) => {
      // 지역 변경 중에는 자동 접기 방지
      if (isRegionChangeInProgress.current) {
        console.log('[AEDDataPageClient] Region change in progress, skipping auto-collapse');
        return;
      }

      const target = event.target as HTMLElement;

      // ✅ 접기/펼치기 토글 버튼 영역만 감지
      const toggleButton = document.querySelector('button[aria-label*="검색 조건"]');

      // 토글 버튼과 그 주변 (10px)만 클릭했을 때만 접기/펼치기 실행
      if (toggleButton && toggleButton.contains(target)) {
        // 토글 버튼 클릭 시에는 별도 onClick 핸들러가 처리하므로 여기서는 아무것도 하지 않음
        return;
      }

      // 필터바 외부 클릭은 무시 (자동 접기 제거)
      // 사용자가 명시적으로 토글 버튼을 클릭해야만 접히도록 변경
    };

    // 약간의 지연 후 이벤트 리스너 등록 (초기 렌더링 직후 바로 닫히는 것 방지)
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside as any);
    }, 500);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside as any);
    };
  }, [filterCollapsed]);

  // 스마트 자동 접기: 스크롤 시작 시 자동으로 접기
  useEffect(() => {
    if (filterCollapsed) return; // 이미 접혀있으면 실행 안함

    let scrollTimer: NodeJS.Timeout;
    let lastScrollY = 0;

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;

      // 스크롤 방향 감지 (아래로 스크롤할 때만 접기)
      const currentScrollY = target.scrollTop || window.scrollY;

      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        // 아래로 스크롤 + 50px 이상 스크롤됨
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          if (!filterCollapsed) {
            setFilterCollapsed(true);
          }
        }, 150); // 150ms 디바운스
      }

      lastScrollY = currentScrollY;
    };

    // 여러 스크롤 가능한 요소에 리스너 등록
    const scrollableElements = document.querySelectorAll('[data-scrollable="true"]');
    scrollableElements.forEach(el => {
      el.addEventListener('scroll', handleScroll);
    });

    // window 스크롤도 감지
    window.addEventListener('scroll', handleScroll);

    return () => {
      clearTimeout(scrollTimer);
      scrollableElements.forEach(el => {
        el.removeEventListener('scroll', handleScroll);
      });
      window.removeEventListener('scroll', handleScroll);
    };
  }, [filterCollapsed]);

  const dataCount = data?.length || 0;

  // GPS 좌표가 있는 장비만 필터링
  const locationsWithGPS = data?.filter(item => {
    const hasLat = item.latitude !== null && item.latitude !== undefined && item.latitude !== 0;
    const hasLng = item.longitude !== null && item.longitude !== undefined && item.longitude !== 0;
    return hasLat && hasLng;
  }) || [];

  console.log('[AEDDataPageClient] Data for map:', {
    total: dataCount,
    withGPS: locationsWithGPS.length,
    sample: locationsWithGPS.slice(0, 3).map(item => ({
      institution: item.installation_institution || item.installation_org,
      address: item.address || item.installation_address,
      lat: item.latitude,
      lng: item.longitude
    }))
  });

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
      {/* 위치 로딩 오버레이 */}
      {initialLocationLoading && (
        <div className="absolute inset-0 bg-gray-950/90 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4 mx-auto"></div>
            <p className="text-white text-sm">현재 위치를 확인하는 중...</p>
            <p className="text-gray-400 text-xs mt-2">위치 권한을 허용하면 내 주변 AED를 바로 확인할 수 있습니다</p>
          </div>
        </div>
      )}

      {/* 에러 메시지 토스트 (지도 탭에서만) */}
      {viewMode === 'map' && error && error.includes('권한 없음') && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 max-w-md">
          <div className="bg-yellow-900/90 border border-yellow-600 text-yellow-100 px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium">접근 권한이 없는 지역입니다</p>
                <p className="text-xs text-yellow-200/80 mt-1">
                  관할 지역으로 지도를 이동하거나, 목록 탭에서 조회해주세요.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation - 모바일에서 여백 없이 꽉 채움 */}
      <div className="flex items-center justify-between -mb-px flex-wrap sm:flex-nowrap gap-0 sm:gap-0 -mx-2 sm:mx-0">
        <div className="flex gap-0 sm:gap-1 w-full sm:w-auto">
            <button
              onClick={() => setViewMode('toAdd')}
              className={`flex-1 sm:flex-none px-1 sm:px-3 md:px-4 py-2 sm:py-2.5 text-sm font-medium border-b-2 transition-colors ${
                viewMode === 'toAdd'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-center gap-1 sm:gap-2">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>추가할목록</span>
              </div>
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex-1 sm:flex-none px-1 sm:px-3 md:px-4 py-2 sm:py-2.5 text-sm font-medium border-b-2 transition-colors ${
                viewMode === 'map'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-center gap-1 sm:gap-2">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <span>지도</span>
              </div>
            </button>
            <button
              onClick={() => setViewMode('scheduled')}
              className={`flex-1 sm:flex-none px-1 sm:px-3 md:px-4 py-2 sm:py-2.5 text-sm font-medium border-b-2 transition-colors ${
                viewMode === 'scheduled'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-center gap-1 sm:gap-2">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>추가된목록</span>
              </div>
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={`flex-1 sm:flex-none px-1 sm:px-3 md:px-4 py-2 sm:py-2.5 text-sm font-medium border-b-2 transition-colors ${
                viewMode === 'all'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-center gap-1 sm:gap-2">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <span>전체목록</span>
              </div>
            </button>
          </div>
        {/* 상단 "일정추가" 버튼 제거: 하단 DataTable의 "일정 예약 (N개)" 버튼만 사용 */}
      </div>

      {/* Filter Bar - 목록 뷰일 때는 일반 배치, 지도 뷰일 때는 오버레이 */}
      {(viewMode === 'toAdd' || viewMode === 'all' || viewMode === 'scheduled') && (
        <>
          {!filterCollapsed && (
            <div ref={filterBarRef}>
              <AEDFilterBar />
            </div>
          )}
          {/* 필터 접기/펼치기 토글 버튼 - PC와 모바일 모두 표시 */}
          <button
            onClick={() => setFilterCollapsed(!filterCollapsed)}
            className="w-full bg-gray-800/50 backdrop-blur-md hover:bg-gray-700/60 transition-all flex items-center justify-center py-0.5 shadow-sm border-b border-gray-700/20"
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
        </>
      )}

      {/* Content Area */}
      <div ref={contentRef} className="flex-1 overflow-hidden flex flex-col">
        {/* 지도 뷰일 때 필터바 - flex 레이아웃 (반응형) */}
        {viewMode === 'map' && (
          <div className="flex-shrink-0">
            {!filterCollapsed && (
              <div ref={filterBarRef}>
                <AEDFilterBar />
              </div>
            )}
            {/* 필터 접기/펼치기 토글 버튼 - 가운데 상단에 탭 형태로 배치 */}
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
          </div>
        )}

        {viewMode === 'toAdd' || viewMode === 'all' || viewMode === 'scheduled' ? (
          isLoading ? (
            <div className="p-4">
              <TableSkeleton rows={10} columns={8} />
            </div>
          ) : (
            <DataTable
              scheduledEquipment={scheduledEquipment}
              onCancelSchedule={(equipmentSerial) => {
                cancelScheduleMutation.mutate(equipmentSerial);
              }}
              isFetching={isFetching}
              selectedDeviceIds={selectedDeviceIds}
              onDeviceSelect={handleDeviceSelect}
              onSelectAll={handleSelectAll}
              scheduleFilter={
                viewMode === 'toAdd' ? 'unscheduled' : // 추가할목록: 미추가 장비만
                viewMode === 'scheduled' ? 'scheduled' : // 추가된목록: 추가된 장비만
                'all' // 전체목록: 모두 표시
              }
              totalDataCount={data?.length || 0}
              currentViewMode={viewMode === 'toAdd' ? 'list' : viewMode === 'scheduled' ? 'completed' : 'map'}
              pageType="schedule"
            />
          )
        ) : (
          <div className="flex-1 overflow-hidden">
            <MapView
              locations={locations}
              isLoading={isLoading}
              useMapBasedLoading={false}
              userProfile={userProfile}
              viewMode="admin"
              scheduledEquipment={scheduledEquipment}
              onSchedule={(locations) => {
                const devices = locations.map(loc => ({
                  id: loc.equipment_serial,
                  equipment_serial: loc.equipment_serial,
                  installation_institution: loc.installation_institution,
                  installation_address: loc.installation_address
                }));
                setSelectedDevices(devices);
                setShowScheduleModal(true);
              }}
              onCancelSchedule={(equipmentSerial) => {
                cancelScheduleMutation.mutate(equipmentSerial);
              }}
            />
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && selectedDevices.length > 0 && (
        <ScheduleModal
          devices={selectedDevices}
          onClose={() => {
            setShowScheduleModal(false);
            setSelectedDevices([]);
          }}
          onScheduled={() => {
            setShowScheduleModal(false);

            // ✅ React Query 캐시 직접 업데이트 (낙관적 업데이트)
            queryClient.setQueryData<string[]>(
              ['scheduled-equipment', userProfile.id],
              (old = []) => {
                const newSerials = selectedDevices
                  .map(device => device.equipment_serial)
                  .filter(Boolean) as string[];
                return [...old, ...newSerials];
              }
            );

            // ✅ 백그라운드에서 서버 데이터 동기화
            queryClient.invalidateQueries({
              queryKey: ['scheduled-equipment', userProfile.id],
              exact: true
            });

            setSelectedDevices([]);
            setSelectedDeviceIds(new Set());

            // ✅ 리스트 새로고침하여 추가된 장비를 목록에서 제거
            refetch();
          }}
        />
      )}
    </div>
  );
}

export function AEDDataPageClient({ initialFilters, userProfile }: AEDDataPageClientProps) {
  console.log('[AEDDataPageClient] Rendering with viewMode="admin"');
  return (
    <AEDDataProvider
      initialFilters={initialFilters}
      userProfile={userProfile}
      viewMode="admin"
      includeSchedule={true}  // ✅ 일정추가 정보 포함 (API 호출 통합)
    >
      <AEDDataContent userProfile={userProfile} />
    </AEDDataProvider>
  );
}
