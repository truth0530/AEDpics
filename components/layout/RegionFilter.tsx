'use client';

import { useState, useEffect, useRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { UserProfile } from '@/packages/types';
import { REGIONS } from '@/lib/constants/regions';

interface RegionFilterProps {
  user: UserProfile;
  onChange?: (sido: string, gugun: string) => void;
}

// 시도 목록 (짧은 이름 사용: "서울", "부산" 등)
const SIDO_LIST = REGIONS.filter(r => r.code !== 'KR').map(r => r.label);

// 구군 목록 (시도별) - 짧은 이름 키 사용
const GUGUN_MAP: Record<string, string[]> = {
  '서울': ['종로구', '중구', '용산구', '성동구', '광진구', '동대문구', '중랑구', '성북구', '강북구', '도봉구', '노원구', '은평구', '서대문구', '마포구', '양천구', '강서구', '구로구', '금천구', '영등포구', '동작구', '관악구', '서초구', '강남구', '송파구', '강동구'],
  '부산': ['중구', '서구', '동구', '영도구', '부산진구', '동래구', '남구', '북구', '해운대구', '사하구', '금정구', '강서구', '연제구', '수영구', '사상구', '기장군'],
  '대구': ['중구', '동구', '서구', '남구', '북구', '수성구', '달서구', '달성군', '군위군'],
  '인천': ['중구', '동구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서구', '강화군', '옹진군'],
  '광주': ['동구', '서구', '남구', '북구', '광산구'],
  '대전': ['동구', '중구', '서구', '유성구', '대덕구'],
  '울산': ['중구', '남구', '동구', '북구', '울주군'],
  '세종': ['세종시'],
  '경기': ['수원시', '성남시', '고양시', '용인시', '부천시', '안산시', '안양시', '남양주시', '화성시', '평택시', '의정부시', '시흥시', '파주시', '김포시', '광명시', '광주시', '군포시', '오산시', '이천시', '양주시', '안성시', '구리시', '포천시', '의왕시', '하남시', '여주시', '양평군', '동두천시', '과천시', '가평군', '연천군'],
  '강원': ['춘천시', '원주시', '강릉시', '동해시', '태백시', '속초시', '삼척시', '홍천군', '횡성군', '영월군', '평창군', '정선군', '철원군', '화천군', '양구군', '인제군', '고성군', '양양군'],
  '충북': ['청주시', '충주시', '제천시', '보은군', '옥천군', '영동군', '증평군', '진천군', '괴산군', '음성군', '단양군'],
  '충남': ['천안시', '공주시', '보령시', '아산시', '서산시', '논산시', '계룡시', '당진시', '금산군', '부여군', '서천군', '청양군', '홍성군', '예산군', '태안군'],
  '전북': ['전주시', '군산시', '익산시', '정읍시', '남원시', '김제시', '완주군', '진안군', '무주군', '장수군', '임실군', '순창군', '고창군', '부안군'],
  '전남': ['목포시', '여수시', '순천시', '나주시', '광양시', '담양군', '곡성군', '구례군', '고흥군', '보성군', '화순군', '장흥군', '강진군', '해남군', '영암군', '무안군', '함평군', '영광군', '장성군', '완도군', '진도군', '신안군'],
  '경북': ['포항시', '경주시', '김천시', '안동시', '구미시', '영주시', '영천시', '상주시', '문경시', '경산시', '군위군', '의성군', '청송군', '영양군', '영덕군', '청도군', '고령군', '성주군', '칠곡군', '예천군', '봉화군', '울진군', '울릉군'],
  '경남': ['창원시', '진주시', '통영시', '사천시', '김해시', '밀양시', '거제시', '양산시', '의령군', '함안군', '창녕군', '고성군', '남해군', '하동군', '산청군', '함양군', '거창군', '합천군'],
  '제주': ['제주시', '서귀포시'],
};

// city_code를 실제 gugun 이름으로 변환
const CITY_CODE_TO_GUGUN_MAP: Record<string, string> = {
  // 제주도 (JEJ)
  'jeju': '제주시',
  'seogwipo': '서귀포시',

  // 대구광역시 (DAE)
  'jung': '중구',
  'dalseo': '달서구',
  'buk': '북구',
  'suseong': '수성구',
  'seo': '서구',

  // 인천광역시 (INC)
  'namdong': '남동구',
  'ganghwa': '강화군',
  'gyeyang': '계양구',
  'michuhol': '미추홀구',
  'bupyeong': '부평구',
  'yeonsu': '연수구',
  'ongjin': '옹진군',
  'jung_yeongjong': '영종',

  // 경남 (GYN)
  'gimhae': '김해시',

  // 충청북도 (CHB)
  'goesan': '괴산군',
  'danyang': '단양군',
  'boeun': '보은군',
  'yeongdong': '영동군',
  'okcheon': '옥천군',
  'eumseong': '음성군',
  'jecheon': '제천시',
  'jeungpyeong': '증평군',
  'jincheon': '진천군',
  'cheongju': '청주시',
  'chungju': '충주시',

  // 세종특별자치시 (SEJ)
  'seju': '세종특별자치시',
};

function mapCityCodeToGugun(cityCode: string | undefined): string {
  if (!cityCode) return '구군';
  return CITY_CODE_TO_GUGUN_MAP[cityCode] || cityCode;
}

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
  const userCity = mapCityCodeToGugun(userCityCode);

  // regional_emergency_center_admin는 자신의 관할 지역을 기본값으로 설정
  // ministry_admin, emergency_center_admin, master는 '시도' (전체)를 기본값으로 설정
  const getInitialSido = () => {
    // sessionStorage 값이 있으면 우선 사용 (위치 기반)
    if (typeof window !== 'undefined') {
      const storedSido = window.sessionStorage.getItem('selectedSido');
      if (storedSido && storedSido !== '시도') {
        // 권한 체크: 시도 변경 불가능한 사용자는 자신의 지역만
        if (!canChangeSidoRole && storedSido !== userRegionLabel) {
          console.log('[RegionFilter] User cannot change sido, using user region:', userRegionLabel);
          return userRegionLabel;
        }
        return storedSido;
      }
    }

    if (user.role === 'regional_emergency_center_admin') {
      return userRegionLabel; // 자신의 관할 지역
    } else if (canChangeSidoRole) {
      return '시도'; // 전체
    } else {
      return userRegionLabel; // 자신의 지역
    }
  };

  const getInitialGugun = () => {
    // sessionStorage 값이 있으면 우선 사용 (위치 기반)
    if (typeof window !== 'undefined') {
      const storedGugun = window.sessionStorage.getItem('selectedGugun');
      if (storedGugun && storedGugun !== '구군') {
        // 보건소 담당자: 자신의 구군만 허용
        if (isHealthCenterStaff && storedGugun !== userCity) {
          console.log('[RegionFilter] Health center staff can only view their city:', userCity);
          return userCity;
        }
        return storedGugun;
      }
    }

    // 보건소 담당자는 자신의 구군으로 고정
    if (isHealthCenterStaff) {
      return userCity;
    }

    return '구군';
  };

  const [selectedSido, setSelectedSido] = useState(getInitialSido());
  const [selectedGugun, setSelectedGugun] = useState(getInitialGugun());
  const [gugunList, setGugunList] = useState<string[]>(['구군', ...(GUGUN_MAP[userRegionLabel] || GUGUN_MAP['서울'] || [])]);
  const onChangeRef = useRef(onChange);

  // onChange ref 업데이트
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // sessionStorage 값 변경 감지 (지도에서 위치 이동 시)
  useEffect(() => {
    const handleStorageChange = (e: CustomEvent) => {
      const { sido, gugun } = e.detail;

      console.log('[RegionFilter] Map region changed:', { sido, gugun });

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
      if (gugun && gugun !== '구군') {
        // 보건소 담당자: 자신의 구군만 허용
        if (isHealthCenterStaff && gugun !== userCity) {
          console.log('[RegionFilter] Health center staff cannot view other cities');
          return;
        }
        setSelectedGugun(gugun);
      }
    };

    window.addEventListener('mapRegionChanged', handleStorageChange as EventListener);
    return () => window.removeEventListener('mapRegionChanged', handleStorageChange as EventListener);
  }, [canChangeSidoRole, userRegionLabel, isHealthCenterStaff, userCity]);

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
    // 시도가 변경되면 해당 시도의 구군 목록 업데이트 ('구군' 추가)
    const baseGugunList = GUGUN_MAP[selectedSido] || [];
    const newGugunList = ['구군', ...baseGugunList];
    setGugunList(newGugunList);

    // 기본값은 '구군'으로 설정
    setSelectedGugun('구군');
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

  // 시도 또는 구군이 변경될 때 onChange 콜백 호출
  useEffect(() => {
    if (onChangeRef.current && selectedSido && selectedGugun) {
      onChangeRef.current(selectedSido, selectedGugun);
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
          {gugunList.map((gugun) => (
            <SelectItem key={gugun} value={gugun}>{gugun}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
