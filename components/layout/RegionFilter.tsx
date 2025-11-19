'use client';

// IMPORTANT: 지역명 정규화 시 반드시 docs/REGION_MANAGEMENT_RULES.md 참조
// - 절대 임의로 정규화 규칙을 만들지 말 것
// - lib/constants/regions.ts의 함수만 사용할 것

import { useState, useEffect, useRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import type { UserProfile } from '@/packages/types';
import { REGIONS, mapCityCodeToGugun, getRegionCode, getGugunHierarchy } from '@/lib/constants/regions';
import type { GugunHierarchy } from '@/lib/constants/regions';

interface RegionFilterProps {
  user: UserProfile;
  onChange?: (sidoCode: string, gugun: string, sidoLabel: string) => void;
}

// 시도 목록 (짧은 이름 사용: "서울", "부산" 등)
const SIDO_LIST = REGIONS.filter(r => r.code !== 'KR').map(r => r.label);


export function RegionFilter({ user, onChange }: RegionFilterProps) {
  // 사용자 권한에 따라 초기값 설정
  const canChangeSidoRole =
    user.role === 'ministry_admin' ||
    user.role === 'emergency_center_admin' ||
    user.role === 'regional_emergency_center_admin' ||
    user.role === 'master';

  // 사용자의 소속 조직 지역 (organization.region_code 또는 user.region_code)
  const userRegionCode = (user.organization as any)?.region_code || user.region_code;
  const userRegionLabel = userRegionCode ? REGIONS.find(r => r.code === userRegionCode)?.label || '서울' : '서울';

  // 보건소 담당자: 시군구 고정
  const isHealthCenterStaff = user.role === 'local_admin';

  const userCityCode = (user.organization as any)?.city_code;
  // ✅ city_code를 실제 gugun 이름으로 변환 (예: "seogwipo" → "서귀포시")
  // null일 경우 기본값 "전체" 사용
  const userCity = mapCityCodeToGugun(userCityCode) || '전체';

  // regional_emergency_center_admin는 자신의 관할 지역을 기본값으로 설정
  // ministry_admin, emergency_center_admin, master는 '시도' (전체)를 기본값으로 설정
  const getInitialSido = () => {
    // ✅ sessionStorage 제거 - 순수하게 사용자 프로필 기반 초기화
    if (user.role === 'regional_emergency_center_admin') {
      return userRegionLabel; // 자신의 관할 지역 (변경 가능)
    } else if (canChangeSidoRole) {
      return '시도'; // 전국 권한: 전체
    } else {
      return userRegionLabel; // 시도/구군 권한: 자신의 지역 (고정)
    }
  };

  const getInitialGugun = () => {
    // ✅ sessionStorage 제거 - 순수하게 사용자 프로필 기반 초기화
    // 보건소 담당자는 자신의 구군으로 고정
    if (isHealthCenterStaff) {
      return userCity;
    }

    return '전체';
  };

  const [selectedSido, setSelectedSido] = useState(getInitialSido());
  const [selectedGugun, setSelectedGugun] = useState(getInitialGugun());
  const fallbackRegionCode = userRegionCode || 'SEO';
  const [gugunHierarchy, setGugunHierarchy] = useState<GugunHierarchy[]>(getGugunHierarchy(fallbackRegionCode));
  const onChangeRef = useRef(onChange);

  // ✅ 성능 최적화: 이전 값 추적하여 실제 변경 시에만 이벤트 dispatch
  // 초기값은 undefined로 설정하여 첫 마운트 시 이벤트가 발송되도록 함
  const prevSidoRef = useRef<string | undefined>(undefined);
  const prevGugunRef = useRef<string | undefined>(undefined);

  // onChange ref 업데이트
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // ✅ regionSelected 이벤트 구독 (사용자가 드롭다운에서 선택하거나 현위치 버튼 클릭 시)
  useEffect(() => {
    const handleRegionSelected = (e: CustomEvent) => {
      const { sido, gugun } = e.detail;

      // 시도가 변경되는 경우인지 확인
      const isSidoChanging = sido && sido !== '시도' && sido !== selectedSido;

      // 시도 체크 및 업데이트
      if (sido && sido !== '시도') {
        // 권한 체크: 시도 변경 불가능한 사용자는 자신의 지역만
        if (!canChangeSidoRole && sido !== userRegionLabel) {
          console.log('[RegionFilter] Cannot change sido for this user role');
          return;
        }
        setSelectedSido(sido);
      }

      // 구군 체크 및 업데이트
      // 시도가 변경되는 경우에는 구군을 무시하고 '전체'로 리셋
      if (isSidoChanging) {
        setSelectedGugun('전체');
      } else if (gugun && gugun !== '구군') {
        // 보건소 담당자: 자신의 구군만 허용
        if (isHealthCenterStaff && gugun !== userCity) {
          return;
        }
        setSelectedGugun(gugun);
      }
    };

    window.addEventListener('regionSelected', handleRegionSelected as EventListener);
    return () => window.removeEventListener('regionSelected', handleRegionSelected as EventListener);
  }, [canChangeSidoRole, userRegionLabel, isHealthCenterStaff, userCity, selectedSido]);

  // 권한 체크:
  // - local_admin(보건소) + 비정부 이메일: 필터 숨김 (자신의 조직 지역만 조회)
  // - temporary_inspector: 필터 숨김 (자신의 조직 지역만 조회)
  // - regional_admin(시도청): 시도는 고정, 구군만 표시
  // - ministry_admin, emergency_center_admin, regional_emergency_center_admin: 시도/구군 모두 표시

  const isGovernmentEmail = user.email.endsWith('korea.kr') || user.email.endsWith('nmc.or.kr');

  const shouldShowFilter =
    user.role === 'ministry_admin' ||
    user.role === 'emergency_center_admin' ||
    user.role === 'regional_emergency_center_admin' ||
    user.role === 'master' ||
    user.role === 'regional_admin';

  // local_admin도 정부 이메일이면 표시 (특수 케이스)
  const shouldShowForLocalAdmin = user.role === 'local_admin' && isGovernmentEmail;

  // 시도 변경 권한: 보건복지부, 중앙응급의료센터, 응급의료지원센터만 가능
  const canChangeSido =
    user.role === 'ministry_admin' ||
    user.role === 'emergency_center_admin' ||
    user.role === 'regional_emergency_center_admin' ||
    user.role === 'master';

  useEffect(() => {
    // 시도가 변경되면 해당 시도의 구군 계층 구조 업데이트
    const regionCode = getRegionCode(selectedSido);
    const newHierarchy = regionCode ? getGugunHierarchy(regionCode) : [];
    setGugunHierarchy(newHierarchy);

    // 기본값은 '전체'으로 설정
    setSelectedGugun('전체');
  }, [selectedSido]);

  // regional_admin(시도청)인 경우 본인 시도로 초기화
  useEffect(() => {
    if (user.role === 'regional_admin' && (user.organization as any)?.region_code) {
      // region_code를 한글 시도명으로 변환
      const regionLabel = REGIONS.find(r => r.code === (user.organization as any).region_code)?.label;
      if (regionLabel) {
        setSelectedSido(regionLabel);
      }
    }
  }, [user.role, user.organization]);

  // 시도 또는 구군이 변경될 때 onChange 콜백 호출 및 regionSelected 이벤트 dispatch
  useEffect(() => {
    // ✅ 성능 최적화: 값이 실제로 변경되었을 때만 이벤트 dispatch
    const isChanged = selectedSido !== prevSidoRef.current || selectedGugun !== prevGugunRef.current;

    if (selectedSido && selectedGugun && isChanged) {
      // 이전 값 업데이트
      prevSidoRef.current = selectedSido;
      prevGugunRef.current = selectedGugun;

      // ✅ 한글 시도명을 지역코드로 변환 (예: "대구" → "DAE")
      const regionCode = getRegionCode(selectedSido);

      // onChange 콜백 호출 (레거시 지원)
      if (onChangeRef.current) {
        onChangeRef.current(regionCode || selectedSido, selectedGugun, selectedSido);
      }

      // ✅ regionSelected 이벤트 dispatch (모든 리스너에게 전파)
      window.dispatchEvent(new CustomEvent('regionSelected', {
        detail: {
          sido: selectedSido,
          gugun: selectedGugun,
          regionCode: regionCode || selectedSido
        }
      }));
    }
  }, [selectedSido, selectedGugun]);

  if (!shouldShowFilter && !shouldShowForLocalAdmin) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={selectedSido}
        onValueChange={setSelectedSido}
        disabled={!canChangeSido}
      >
        <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-7 md:h-8 w-24 md:w-32 text-[11px] md:text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {canChangeSido && (
            <SelectItem value="시도">시도</SelectItem>
          )}
          {SIDO_LIST.map((sido) => (
            <SelectItem key={sido} value={sido}>{sido}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selectedGugun}
        onValueChange={setSelectedGugun}
        disabled={isHealthCenterStaff}
      >
        <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-7 md:h-8 w-20 md:w-24 text-[11px] md:text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="전체">전체</SelectItem>
          {gugunHierarchy.map(({ gugun, subGuguns }) => {
            if (subGuguns.length > 0) {
              return (
                <SelectGroup key={gugun}>
                  <SelectLabel className="pl-2 text-[10px] text-gray-500">{gugun}</SelectLabel>
                  <SelectItem value={gugun}>{gugun}</SelectItem>
                  {subGuguns.map((sub) => (
                    <SelectItem key={sub} value={sub} className="pl-6">
                      {sub}
                    </SelectItem>
                  ))}
                </SelectGroup>
              );
            } else {
              return <SelectItem key={gugun} value={gugun}>{gugun}</SelectItem>;
            }
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
