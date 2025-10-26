'use client';

import { useState, useMemo, useEffect } from 'react';
import { normalizeToDaily, calculateChartMaxValue, type HourlyRawData } from '@/lib/utils/chartDataProcessor';

interface DashboardData {
  title: string;
  data: RegionData[];
  totalAED: number;
  totalCompleted: number;
  totalUrgent: number;
  completionRate: number;
}

interface RegionData {
  region: string;
  total: number;
  mandatory: number;           // 구비의무기관 AED 수
  nonMandatory: number;        // 구비의무기관 외 AED 수
  completed: number;
  completedMandatory: number;  // 구비의무기관 완료
  completedNonMandatory: number; // 구비의무기관 외 완료
  urgent: number;
  rate: number;
}

interface AEDDashboardProps {
  dashboardData: DashboardData;
  allDevices: any[];
  sidoList: string[];
  gugunMap: Record<string, string[]>;
  userRole: string;
}

// 구비의무기관 판별 함수
function isMandatoryInstitution(category1: string | null): boolean {
  if (!category1) return false;
  const mandatory = ['공동주택', '공항·항만·역사', '학교', '대규모점포'];
  return mandatory.includes(category1);
}

// 긴급 점검 필요 여부 판별
function isUrgent(device: any): boolean {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  if (device.battery_expiry_date) {
    const batteryExpiry = new Date(device.battery_expiry_date);
    if (batteryExpiry < thirtyDaysFromNow) return true;
  }

  if (device.patch_expiry_date) {
    const patchExpiry = new Date(device.patch_expiry_date);
    if (patchExpiry < thirtyDaysFromNow) return true;
  }

  if (device.last_inspection_date) {
    const lastInspection = new Date(device.last_inspection_date);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    if (lastInspection < ninetyDaysAgo) return true;
  }

  return false;
}

export function AEDDashboard({ dashboardData, allDevices, sidoList, gugunMap, userRole }: AEDDashboardProps) {
  const [selectedSido, setSelectedSido] = useState<string>('all');
  const [selectedGugun, setSelectedGugun] = useState<string>('all');
  const [timeRange, setTimeRange] = useState('today');

  // 시도 변경 시 구군 초기화
  const handleSidoChange = (sido: string) => {
    setSelectedSido(sido);
    setSelectedGugun('all');
  };

  // AppHeader에서 발송하는 시간 범위 변경 이벤트 수신
  useEffect(() => {
    const handleTimeRangeChange = (event: CustomEvent) => {
      setTimeRange(event.detail.timeRange);
    };

    window.addEventListener('timeRangeChanged', handleTimeRangeChange as EventListener);

    // 초기값 로드
    if (typeof window !== 'undefined') {
      const savedTimeRange = window.sessionStorage.getItem('dashboardTimeRange');
      if (savedTimeRange) {
        setTimeRange(savedTimeRange);
      }
    }

    return () => {
      window.removeEventListener('timeRangeChanged', handleTimeRangeChange as EventListener);
    };
  }, []);

  // RegionFilter에서 발송하는 지역 변경 이벤트 수신
  useEffect(() => {
    const handleRegionChange = (event: CustomEvent) => {
      const { sido, gugun } = event.detail;
      console.log('[AEDDashboard] Region changed:', { sido, gugun });
      setSelectedSido(sido);
      setSelectedGugun(gugun);
    };

    window.addEventListener('regionSelected', handleRegionChange as EventListener);

    // 초기값 로드
    if (typeof window !== 'undefined') {
      const savedSido = window.sessionStorage.getItem('selectedSido');
      const savedGugun = window.sessionStorage.getItem('selectedGugun');
      if (savedSido) setSelectedSido(savedSido);
      if (savedGugun) setSelectedGugun(savedGugun);
    }

    return () => {
      window.removeEventListener('regionSelected', handleRegionChange as EventListener);
    };
  }, []);

  // 더미 데이터 생성 함수
  const generateDummyData = () => {
    return {
      totalAED: 350,
      totalMandatory: 211,
      totalNonMandatory: 139,
      assignedMandatory: 25,
      assignedNonMandatory: 15,
      completedMandatory: 8,
      completedNonMandatory: 2,
      // 외부표출 차단
      totalBlocked: 45,
      assignedBlocked: 5,
      completedBlocked: 1,
      // 미점검 장비 (90일 이상)
      totalUninspected: 28,
      assignedUninspected: 10,
      completedUninspected: 3,
    };
  };

  const dummyStats = generateDummyData();

  // 필터링된 데이터 계산
  const filteredData = useMemo(() => {
    // 더미 데이터 - 17개 시도 (완료율에 차이를 둠: 40%~95%)
    const dummySidoData = [
      { region: '서울', mandatory: 3500, nonMandatory: 2100, completedMandatory: 3150, completedNonMandatory: 1890, urgent: 45 },  // 90%, 90%
      { region: '부산', mandatory: 1800, nonMandatory: 1200, completedMandatory: 1530, completedNonMandatory: 1020, urgent: 28 },  // 85%, 85%
      { region: '대구', mandatory: 1200, nonMandatory: 800, completedMandatory: 960, completedNonMandatory: 640, urgent: 18 },    // 80%, 80%
      { region: '인천', mandatory: 1500, nonMandatory: 950, completedMandatory: 1200, completedNonMandatory: 713, urgent: 22 },   // 80%, 75%
      { region: '광주', mandatory: 850, nonMandatory: 600, completedMandatory: 638, completedNonMandatory: 420, urgent: 15 },     // 75%, 70%
      { region: '대전', mandatory: 900, nonMandatory: 650, completedMandatory: 675, completedNonMandatory: 423, urgent: 16 },     // 75%, 65%
      { region: '울산', mandatory: 650, nonMandatory: 450, completedMandatory: 455, completedNonMandatory: 270, urgent: 12 },     // 70%, 60%
      { region: '세종', mandatory: 300, nonMandatory: 200, completedMandatory: 285, completedNonMandatory: 190, urgent: 5 },      // 95%, 95%
      { region: '경기', mandatory: 5200, nonMandatory: 3400, completedMandatory: 4420, completedNonMandatory: 2890, urgent: 72 }, // 85%, 85%
      { region: '강원', mandatory: 800, nonMandatory: 550, completedMandatory: 520, completedNonMandatory: 330, urgent: 14 },     // 65%, 60%
      { region: '충북', mandatory: 700, nonMandatory: 480, completedMandatory: 455, completedNonMandatory: 288, urgent: 13 },     // 65%, 60%
      { region: '충남', mandatory: 950, nonMandatory: 650, completedMandatory: 570, completedNonMandatory: 325, urgent: 17 },     // 60%, 50%
      { region: '전북', mandatory: 850, nonMandatory: 580, completedMandatory: 510, completedNonMandatory: 290, urgent: 15 },     // 60%, 50%
      { region: '전남', mandatory: 900, nonMandatory: 620, completedMandatory: 495, completedNonMandatory: 248, urgent: 16 },     // 55%, 40%
      { region: '경북', mandatory: 1100, nonMandatory: 750, completedMandatory: 605, completedNonMandatory: 375, urgent: 19 },    // 55%, 50%
      { region: '경남', mandatory: 1600, nonMandatory: 1100, completedMandatory: 1120, completedNonMandatory: 660, urgent: 25 },  // 70%, 60%
      { region: '제주', mandatory: 400, nonMandatory: 280, completedMandatory: 380, completedNonMandatory: 266, urgent: 8 },      // 95%, 95%
    ];

    // 더미 구군 데이터
    const dummyGugunData: Record<string, any[]> = {
      '서울': [
        { region: '종로구', mandatory: 180, nonMandatory: 110, completedMandatory: 171, completedNonMandatory: 105, urgent: 2 },   // 95%, 95%
        { region: '중구', mandatory: 150, nonMandatory: 90, completedMandatory: 135, completedNonMandatory: 81, urgent: 2 },       // 90%, 90%
        { region: '용산구', mandatory: 160, nonMandatory: 100, completedMandatory: 136, completedNonMandatory: 85, urgent: 2 },    // 85%, 85%
        { region: '성동구', mandatory: 140, nonMandatory: 85, completedMandatory: 112, completedNonMandatory: 68, urgent: 2 },     // 80%, 80%
        { region: '광진구', mandatory: 145, nonMandatory: 88, completedMandatory: 109, completedNonMandatory: 66, urgent: 2 },     // 75%, 75%
        { region: '동대문구', mandatory: 155, nonMandatory: 95, completedMandatory: 109, completedNonMandatory: 67, urgent: 2 },   // 70%, 70%
        { region: '중랑구', mandatory: 150, nonMandatory: 92, completedMandatory: 98, completedNonMandatory: 55, urgent: 2 },      // 65%, 60%
        { region: '성북구', mandatory: 165, nonMandatory: 100, completedMandatory: 99, completedNonMandatory: 55, urgent: 2 },     // 60%, 55%
        { region: '강북구', mandatory: 135, nonMandatory: 82, completedMandatory: 74, completedNonMandatory: 41, urgent: 2 },      // 55%, 50%
        { region: '도봉구', mandatory: 140, nonMandatory: 85, completedMandatory: 70, completedNonMandatory: 38, urgent: 2 },      // 50%, 45%
        { region: '노원구', mandatory: 200, nonMandatory: 120, completedMandatory: 170, completedNonMandatory: 102, urgent: 3 },   // 85%, 85%
        { region: '은평구', mandatory: 170, nonMandatory: 105, completedMandatory: 119, completedNonMandatory: 68, urgent: 2 },    // 70%, 65%
        { region: '서대문구', mandatory: 145, nonMandatory: 88, completedMandatory: 94, completedNonMandatory: 53, urgent: 2 },    // 65%, 60%
        { region: '마포구', mandatory: 175, nonMandatory: 108, completedMandatory: 149, completedNonMandatory: 92, urgent: 2 },    // 85%, 85%
        { region: '양천구', mandatory: 180, nonMandatory: 110, completedMandatory: 144, completedNonMandatory: 88, urgent: 2 },    // 80%, 80%
        { region: '강서구', mandatory: 210, nonMandatory: 130, completedMandatory: 158, completedNonMandatory: 91, urgent: 3 },    // 75%, 70%
        { region: '구로구', mandatory: 160, nonMandatory: 98, completedMandatory: 96, completedNonMandatory: 49, urgent: 2 },      // 60%, 50%
        { region: '금천구', mandatory: 130, nonMandatory: 80, completedMandatory: 65, completedNonMandatory: 32, urgent: 2 },      // 50%, 40%
        { region: '영등포구', mandatory: 170, nonMandatory: 105, completedMandatory: 145, completedNonMandatory: 89, urgent: 2 },  // 85%, 85%
        { region: '동작구', mandatory: 155, nonMandatory: 95, completedMandatory: 109, completedNonMandatory: 62, urgent: 2 },     // 70%, 65%
        { region: '관악구', mandatory: 165, nonMandatory: 100, completedMandatory: 99, completedNonMandatory: 55, urgent: 2 },     // 60%, 55%
        { region: '서초구', mandatory: 190, nonMandatory: 115, completedMandatory: 181, completedNonMandatory: 109, urgent: 3 },   // 95%, 95%
        { region: '강남구', mandatory: 220, nonMandatory: 135, completedMandatory: 209, completedNonMandatory: 128, urgent: 3 },   // 95%, 95%
        { region: '송파구', mandatory: 200, nonMandatory: 122, completedMandatory: 180, completedNonMandatory: 110, urgent: 3 },   // 90%, 90%
        { region: '강동구', mandatory: 165, nonMandatory: 100, completedMandatory: 132, completedNonMandatory: 75, urgent: 2 },    // 80%, 75%
      ],
      '대구': [
        { region: '중구', mandatory: 120, nonMandatory: 80, completedMandatory: 114, completedNonMandatory: 76, urgent: 2 },      // 95%, 95%
        { region: '동구', mandatory: 135, nonMandatory: 90, completedMandatory: 122, completedNonMandatory: 81, urgent: 2 },      // 90%, 90%
        { region: '서구', mandatory: 145, nonMandatory: 95, completedMandatory: 123, completedNonMandatory: 81, urgent: 2 },      // 85%, 85%
        { region: '남구', mandatory: 140, nonMandatory: 85, completedMandatory: 112, completedNonMandatory: 68, urgent: 2 },      // 80%, 80%
        { region: '북구', mandatory: 180, nonMandatory: 110, completedMandatory: 135, completedNonMandatory: 77, urgent: 2 },     // 75%, 70%
        { region: '수성구', mandatory: 160, nonMandatory: 100, completedMandatory: 112, completedNonMandatory: 65, urgent: 2 },   // 70%, 65%
        { region: '달서구', mandatory: 190, nonMandatory: 120, completedMandatory: 114, completedNonMandatory: 60, urgent: 3 },   // 60%, 50%
        { region: '달성군', mandatory: 110, nonMandatory: 70, completedMandatory: 55, completedNonMandatory: 28, urgent: 2 },      // 50%, 40%
        { region: '군위군', mandatory: 80, nonMandatory: 50, completedMandatory: 32, completedNonMandatory: 15, urgent: 1 },       // 40%, 30%
      ],
      '부산': [
        { region: '중구', mandatory: 110, nonMandatory: 70, completedMandatory: 105, completedNonMandatory: 67, urgent: 1 },      // 95%, 95%
        { region: '서구', mandatory: 95, nonMandatory: 60, completedMandatory: 86, completedNonMandatory: 54, urgent: 1 },        // 90%, 90%
        { region: '동구', mandatory: 85, nonMandatory: 55, completedMandatory: 72, completedNonMandatory: 47, urgent: 1 },        // 85%, 85%
        { region: '영도구', mandatory: 90, nonMandatory: 58, completedMandatory: 72, completedNonMandatory: 46, urgent: 1 },      // 80%, 80%
        { region: '부산진구', mandatory: 150, nonMandatory: 95, completedMandatory: 113, completedNonMandatory: 71, urgent: 2 },  // 75%, 75%
        { region: '동래구', mandatory: 130, nonMandatory: 85, completedMandatory: 91, completedNonMandatory: 60, urgent: 2 },     // 70%, 70%
        { region: '남구', mandatory: 125, nonMandatory: 80, completedMandatory: 81, completedNonMandatory: 52, urgent: 2 },       // 65%, 65%
        { region: '북구', mandatory: 135, nonMandatory: 90, completedMandatory: 81, completedNonMandatory: 54, urgent: 2 },       // 60%, 60%
        { region: '해운대구', mandatory: 160, nonMandatory: 105, completedMandatory: 88, completedNonMandatory: 58, urgent: 2 },  // 55%, 55%
        { region: '사하구', mandatory: 120, nonMandatory: 75, completedMandatory: 60, completedNonMandatory: 38, urgent: 2 },     // 50%, 50%
        { region: '금정구', mandatory: 115, nonMandatory: 72, completedMandatory: 92, completedNonMandatory: 58, urgent: 2 },     // 80%, 80%
        { region: '강서구', mandatory: 105, nonMandatory: 68, completedMandatory: 74, completedNonMandatory: 48, urgent: 1 },     // 70%, 70%
        { region: '연제구', mandatory: 98, nonMandatory: 62, completedMandatory: 69, completedNonMandatory: 43, urgent: 1 },      // 70%, 70%
        { region: '수영구', mandatory: 92, nonMandatory: 58, completedMandatory: 74, completedNonMandatory: 46, urgent: 1 },      // 80%, 80%
        { region: '사상구', mandatory: 110, nonMandatory: 70, completedMandatory: 55, completedNonMandatory: 35, urgent: 2 },     // 50%, 50%
        { region: '기장군', mandatory: 88, nonMandatory: 55, completedMandatory: 53, completedNonMandatory: 33, urgent: 1 },      // 60%, 60%
      ],
      '인천': [
        { region: '중구', mandatory: 100, nonMandatory: 65, completedMandatory: 95, completedNonMandatory: 62, urgent: 1 },       // 95%, 95%
        { region: '동구', mandatory: 88, nonMandatory: 55, completedMandatory: 79, completedNonMandatory: 50, urgent: 1 },        // 90%, 90%
        { region: '미추홀구', mandatory: 135, nonMandatory: 90, completedMandatory: 115, completedNonMandatory: 77, urgent: 2 },  // 85%, 85%
        { region: '연수구', mandatory: 145, nonMandatory: 95, completedMandatory: 116, completedNonMandatory: 76, urgent: 2 },    // 80%, 80%
        { region: '남동구', mandatory: 160, nonMandatory: 105, completedMandatory: 120, completedNonMandatory: 79, urgent: 2 },   // 75%, 75%
        { region: '부평구', mandatory: 155, nonMandatory: 100, completedMandatory: 109, completedNonMandatory: 70, urgent: 2 },   // 70%, 70%
        { region: '계양구', mandatory: 140, nonMandatory: 92, completedMandatory: 91, completedNonMandatory: 60, urgent: 2 },     // 65%, 65%
        { region: '서구', mandatory: 170, nonMandatory: 110, completedMandatory: 102, completedNonMandatory: 66, urgent: 2 },     // 60%, 60%
        { region: '강화군', mandatory: 95, nonMandatory: 60, completedMandatory: 48, completedNonMandatory: 30, urgent: 1 },      // 50%, 50%
        { region: '옹진군', mandatory: 75, nonMandatory: 48, completedMandatory: 30, completedNonMandatory: 19, urgent: 1 },      // 40%, 40%
      ],
      '광주': [
        { region: '동구', mandatory: 160, nonMandatory: 105, completedMandatory: 152, completedNonMandatory: 100, urgent: 2 },    // 95%, 95%
        { region: '서구', mandatory: 180, nonMandatory: 120, completedMandatory: 162, completedNonMandatory: 108, urgent: 2 },    // 90%, 90%
        { region: '남구', mandatory: 170, nonMandatory: 115, completedMandatory: 145, completedNonMandatory: 98, urgent: 2 },     // 85%, 85%
        { region: '북구', mandatory: 190, nonMandatory: 125, completedMandatory: 152, completedNonMandatory: 100, urgent: 3 },    // 80%, 80%
        { region: '광산구', mandatory: 150, nonMandatory: 100, completedMandatory: 105, completedNonMandatory: 70, urgent: 2 },   // 70%, 70%
      ],
      '대전': [
        { region: '동구', mandatory: 165, nonMandatory: 108, completedMandatory: 157, completedNonMandatory: 103, urgent: 2 },    // 95%, 95%
        { region: '중구', mandatory: 180, nonMandatory: 118, completedMandatory: 162, completedNonMandatory: 106, urgent: 2 },    // 90%, 90%
        { region: '서구', mandatory: 220, nonMandatory: 145, completedMandatory: 187, completedNonMandatory: 123, urgent: 3 },    // 85%, 85%
        { region: '유성구', mandatory: 195, nonMandatory: 128, completedMandatory: 156, completedNonMandatory: 102, urgent: 2 },  // 80%, 80%
        { region: '대덕구', mandatory: 140, nonMandatory: 92, completedMandatory: 98, completedNonMandatory: 64, urgent: 2 },     // 70%, 70%
      ],
      '울산': [
        { region: '중구', mandatory: 120, nonMandatory: 80, completedMandatory: 114, completedNonMandatory: 76, urgent: 1 },      // 95%, 95%
        { region: '남구', mandatory: 155, nonMandatory: 102, completedMandatory: 140, completedNonMandatory: 92, urgent: 2 },     // 90%, 90%
        { region: '동구', mandatory: 95, nonMandatory: 62, completedMandatory: 81, completedNonMandatory: 53, urgent: 1 },        // 85%, 85%
        { region: '북구', mandatory: 165, nonMandatory: 108, completedMandatory: 132, completedNonMandatory: 86, urgent: 2 },     // 80%, 80%
        { region: '울주군', mandatory: 115, nonMandatory: 75, completedMandatory: 81, completedNonMandatory: 53, urgent: 2 },     // 70%, 70%
      ],
      '세종': [
        { region: '세종시', mandatory: 300, nonMandatory: 200, completedMandatory: 285, completedNonMandatory: 190, urgent: 5 },  // 95%, 95%
      ],
      '경기': [
        { region: '수원시', mandatory: 420, nonMandatory: 280, completedMandatory: 399, completedNonMandatory: 266, urgent: 6 },  // 95%, 95%
        { region: '성남시', mandatory: 380, nonMandatory: 250, completedMandatory: 342, completedNonMandatory: 225, urgent: 5 },  // 90%, 90%
        { region: '고양시', mandatory: 350, nonMandatory: 230, completedMandatory: 298, completedNonMandatory: 196, urgent: 5 },  // 85%, 85%
        { region: '용인시', mandatory: 320, nonMandatory: 210, completedMandatory: 256, completedNonMandatory: 168, urgent: 4 },  // 80%, 80%
        { region: '부천시', mandatory: 280, nonMandatory: 185, completedMandatory: 210, completedNonMandatory: 139, urgent: 4 },  // 75%, 75%
        { region: '안산시', mandatory: 260, nonMandatory: 172, completedMandatory: 182, completedNonMandatory: 120, urgent: 3 },  // 70%, 70%
        { region: '안양시', mandatory: 240, nonMandatory: 158, completedMandatory: 156, completedNonMandatory: 103, urgent: 3 },  // 65%, 65%
        { region: '남양주시', mandatory: 220, nonMandatory: 145, completedMandatory: 132, completedNonMandatory: 87, urgent: 3 }, // 60%, 60%
        { region: '화성시', mandatory: 200, nonMandatory: 132, completedMandatory: 110, completedNonMandatory: 73, urgent: 3 },   // 55%, 55%
        { region: '평택시', mandatory: 180, nonMandatory: 118, completedMandatory: 90, completedNonMandatory: 59, urgent: 2 },    // 50%, 50%
      ],
      '강원': [
        { region: '춘천시', mandatory: 155, nonMandatory: 102, completedMandatory: 147, completedNonMandatory: 97, urgent: 2 },   // 95%, 95%
        { region: '원주시', mandatory: 145, nonMandatory: 95, completedMandatory: 131, completedNonMandatory: 86, urgent: 2 },    // 90%, 90%
        { region: '강릉시', mandatory: 135, nonMandatory: 88, completedMandatory: 115, completedNonMandatory: 75, urgent: 2 },    // 85%, 85%
        { region: '동해시', mandatory: 85, nonMandatory: 56, completedMandatory: 68, completedNonMandatory: 45, urgent: 1 },      // 80%, 80%
        { region: '태백시', mandatory: 65, nonMandatory: 42, completedMandatory: 49, completedNonMandatory: 32, urgent: 1 },      // 75%, 75%
        { region: '속초시', mandatory: 75, nonMandatory: 49, completedMandatory: 53, completedNonMandatory: 34, urgent: 1 },      // 70%, 70%
        { region: '삼척시', mandatory: 80, nonMandatory: 52, completedMandatory: 52, completedNonMandatory: 34, urgent: 1 },      // 65%, 65%
        { region: '홍천군', mandatory: 70, nonMandatory: 46, completedMandatory: 42, completedNonMandatory: 28, urgent: 1 },      // 60%, 60%
      ],
      '충북': [
        { region: '청주시', mandatory: 260, nonMandatory: 172, completedMandatory: 247, completedNonMandatory: 163, urgent: 4 },  // 95%, 95%
        { region: '충주시', mandatory: 130, nonMandatory: 85, completedMandatory: 117, completedNonMandatory: 77, urgent: 2 },    // 90%, 90%
        { region: '제천시', mandatory: 95, nonMandatory: 62, completedMandatory: 81, completedNonMandatory: 53, urgent: 1 },      // 85%, 85%
        { region: '보은군', mandatory: 55, nonMandatory: 36, completedMandatory: 44, completedNonMandatory: 29, urgent: 1 },      // 80%, 80%
        { region: '옥천군', mandatory: 58, nonMandatory: 38, completedMandatory: 44, completedNonMandatory: 29, urgent: 1 },      // 75%, 75%
        { region: '영동군', mandatory: 52, nonMandatory: 34, completedMandatory: 36, completedNonMandatory: 24, urgent: 1 },      // 70%, 70%
      ],
      '충남': [
        { region: '천안시', mandatory: 265, nonMandatory: 175, completedMandatory: 252, completedNonMandatory: 166, urgent: 4 },  // 95%, 95%
        { region: '공주시', mandatory: 105, nonMandatory: 69, completedMandatory: 95, completedNonMandatory: 62, urgent: 1 },     // 90%, 90%
        { region: '보령시', mandatory: 92, nonMandatory: 60, completedMandatory: 78, completedNonMandatory: 51, urgent: 1 },      // 85%, 85%
        { region: '아산시', mandatory: 145, nonMandatory: 95, completedMandatory: 116, completedNonMandatory: 76, urgent: 2 },    // 80%, 80%
        { region: '서산시', mandatory: 115, nonMandatory: 76, completedMandatory: 86, completedNonMandatory: 57, urgent: 2 },     // 75%, 75%
        { region: '논산시', mandatory: 98, nonMandatory: 64, completedMandatory: 69, completedNonMandatory: 45, urgent: 1 },      // 70%, 70%
        { region: '계룡시', mandatory: 55, nonMandatory: 36, completedMandatory: 36, completedNonMandatory: 23, urgent: 1 },      // 65%, 65%
        { region: '당진시', mandatory: 85, nonMandatory: 56, completedMandatory: 51, completedNonMandatory: 34, urgent: 1 },      // 60%, 60%
      ],
      '전북': [
        { region: '전주시', mandatory: 245, nonMandatory: 162, completedMandatory: 233, completedNonMandatory: 154, urgent: 4 },  // 95%, 95%
        { region: '군산시', mandatory: 135, nonMandatory: 89, completedMandatory: 122, completedNonMandatory: 80, urgent: 2 },    // 90%, 90%
        { region: '익산시', mandatory: 145, nonMandatory: 95, completedMandatory: 123, completedNonMandatory: 81, urgent: 2 },    // 85%, 85%
        { region: '정읍시', mandatory: 95, nonMandatory: 62, completedMandatory: 76, completedNonMandatory: 50, urgent: 1 },      // 80%, 80%
        { region: '남원시', mandatory: 88, nonMandatory: 58, completedMandatory: 66, completedNonMandatory: 44, urgent: 1 },      // 75%, 75%
        { region: '김제시', mandatory: 82, nonMandatory: 54, completedMandatory: 57, completedNonMandatory: 38, urgent: 1 },      // 70%, 70%
      ],
      '전남': [
        { region: '목포시', mandatory: 125, nonMandatory: 82, completedMandatory: 119, completedNonMandatory: 78, urgent: 2 },    // 95%, 95%
        { region: '여수시', mandatory: 155, nonMandatory: 102, completedMandatory: 140, completedNonMandatory: 92, urgent: 2 },   // 90%, 90%
        { region: '순천시', mandatory: 145, nonMandatory: 95, completedMandatory: 123, completedNonMandatory: 81, urgent: 2 },    // 85%, 85%
        { region: '나주시', mandatory: 98, nonMandatory: 64, completedMandatory: 78, completedNonMandatory: 51, urgent: 1 },      // 80%, 80%
        { region: '광양시', mandatory: 115, nonMandatory: 76, completedMandatory: 86, completedNonMandatory: 57, urgent: 2 },     // 75%, 75%
        { region: '담양군', mandatory: 52, nonMandatory: 34, completedMandatory: 36, completedNonMandatory: 24, urgent: 1 },      // 70%, 70%
        { region: '곡성군', mandatory: 45, nonMandatory: 30, completedMandatory: 29, completedNonMandatory: 19, urgent: 1 },      // 65%, 65%
        { region: '구례군', mandatory: 42, nonMandatory: 28, completedMandatory: 25, completedNonMandatory: 17, urgent: 1 },      // 60%, 60%
      ],
      '경북': [
        { region: '포항시', mandatory: 185, nonMandatory: 122, completedMandatory: 176, completedNonMandatory: 116, urgent: 3 },  // 95%, 95%
        { region: '경주시', mandatory: 145, nonMandatory: 95, completedMandatory: 131, completedNonMandatory: 86, urgent: 2 },    // 90%, 90%
        { region: '김천시', mandatory: 105, nonMandatory: 69, completedMandatory: 89, completedNonMandatory: 59, urgent: 1 },     // 85%, 85%
        { region: '안동시', mandatory: 115, nonMandatory: 76, completedMandatory: 92, completedNonMandatory: 61, urgent: 2 },     // 80%, 80%
        { region: '구미시', mandatory: 165, nonMandatory: 108, completedMandatory: 124, completedNonMandatory: 81, urgent: 2 },   // 75%, 75%
        { region: '영주시', mandatory: 88, nonMandatory: 58, completedMandatory: 62, completedNonMandatory: 41, urgent: 1 },      // 70%, 70%
        { region: '영천시', mandatory: 82, nonMandatory: 54, completedMandatory: 53, completedNonMandatory: 35, urgent: 1 },      // 65%, 65%
        { region: '상주시', mandatory: 75, nonMandatory: 49, completedMandatory: 45, completedNonMandatory: 29, urgent: 1 },      // 60%, 60%
      ],
      '경남': [
        { region: '창원시', mandatory: 420, nonMandatory: 278, completedMandatory: 399, completedNonMandatory: 264, urgent: 6 },  // 95%, 95%
        { region: '진주시', mandatory: 165, nonMandatory: 108, completedMandatory: 149, completedNonMandatory: 97, urgent: 2 },   // 90%, 90%
        { region: '통영시', mandatory: 105, nonMandatory: 69, completedMandatory: 89, completedNonMandatory: 59, urgent: 1 },     // 85%, 85%
        { region: '사천시', mandatory: 95, nonMandatory: 62, completedMandatory: 76, completedNonMandatory: 50, urgent: 1 },      // 80%, 80%
        { region: '김해시', mandatory: 245, nonMandatory: 162, completedMandatory: 184, completedNonMandatory: 122, urgent: 3 },  // 75%, 75%
        { region: '밀양시', mandatory: 98, nonMandatory: 64, completedMandatory: 69, completedNonMandatory: 45, urgent: 1 },      // 70%, 70%
        { region: '거제시', mandatory: 125, nonMandatory: 82, completedMandatory: 81, completedNonMandatory: 53, urgent: 2 },     // 65%, 65%
        { region: '양산시', mandatory: 155, nonMandatory: 102, completedMandatory: 93, completedNonMandatory: 61, urgent: 2 },    // 60%, 60%
      ],
      '제주': [
        { region: '제주시', mandatory: 255, nonMandatory: 168, completedMandatory: 242, completedNonMandatory: 160, urgent: 4 },  // 95%, 95%
        { region: '서귀포시', mandatory: 145, nonMandatory: 95, completedMandatory: 131, completedNonMandatory: 86, urgent: 2 },  // 90%, 90%
      ],
    };

    let regionData: any[] = [];

    // 1. 복지부, 중앙응급의료센터, 응급의료지원센터 계정
    if (userRole === 'master' || userRole === 'ministry_admin' || userRole === 'emergency_center_admin' || userRole === 'regional_emergency_center_admin') {
      if (selectedSido === 'all' || selectedSido === '시도') {
        // 시도 전체 보기
        regionData = dummySidoData;
      } else {
        // 특정 시도의 구군 보기
        regionData = dummyGugunData[selectedSido] || [];

        // 구군 필터
        if (selectedGugun !== 'all' && selectedGugun !== '구군') {
          regionData = regionData.filter(r => r.region === selectedGugun);
        }
      }
    }
    // 2. 시도청 계정 (regional_admin)
    else if (userRole === 'regional_admin') {
      // dashboardData에서 현재 시도 파악 (임시로 서울 사용)
      const currentSido = '서울'; // TODO: 실제로는 사용자 정보에서 가져와야 함
      regionData = dummyGugunData[currentSido] || [];

      // 구군 필터
      if (selectedGugun !== 'all' && selectedGugun !== '구군') {
        regionData = regionData.filter(r => r.region === selectedGugun);
      }
    }
    // 3. 보건소 계정 (health_center)
    else if (userRole === 'health_center') {
      // 관할 구군만 표시 (임시로 종로구 사용)
      const currentGugun = '종로구'; // TODO: 실제로는 사용자 정보에서 가져와야 함
      const currentSido = '서울';
      const gugunList = dummyGugunData[currentSido] || [];
      regionData = gugunList.filter(r => r.region === currentGugun);
    }
    // 4. 기타 role - 기본적으로 전체 시도 표시
    else {
      regionData = dummySidoData;
    }

    // 데이터 변환
    const processedData = regionData.map(stats => {
      const total = stats.mandatory + stats.nonMandatory;
      const completed = stats.completedMandatory + stats.completedNonMandatory;
      return {
        region: stats.region,
        total,
        mandatory: stats.mandatory,
        nonMandatory: stats.nonMandatory,
        completed,
        completedMandatory: stats.completedMandatory,
        completedNonMandatory: stats.completedNonMandatory,
        urgent: stats.urgent,
        rate: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
      };
    });

    const totalAED = processedData.reduce((sum, r) => sum + r.total, 0);
    const totalCompleted = processedData.reduce((sum, r) => sum + r.completed, 0);
    const totalUrgent = processedData.reduce((sum, r) => sum + r.urgent, 0);
    const completionRate = totalAED > 0 ? Math.round((totalCompleted / totalAED) * 1000) / 10 : 0;

    return {
      data: processedData,
      totalAED,
      totalCompleted,
      totalUrgent,
      completionRate,
    };

    // TODO: 실제 데이터 사용 코드 - 향후 활성화
    // if (selectedSido !== 'all') {
    //   devices = devices.filter(d => d.sido === selectedSido);
    // }
    // if (selectedGugun !== 'all') {
    //   devices = devices.filter(d => (d.gugun || d.city_code) === selectedGugun);
    // }
    // ... 실제 데이터 집계 로직
  }, [allDevices, selectedSido, selectedGugun, userRole, dashboardData]);

  // 구군 옵션 목록
  const gugunOptions = selectedSido !== 'all' && gugunMap[selectedSido] ? gugunMap[selectedSido] : [];

  return (
    <div className="min-h-screen bg-gray-950 p-4">
      {/* 상단 필터 영역 */}
      <div className="flex flex-col md:flex-row justify-end items-start md:items-center mb-6 gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full md:w-auto">
          {/* 구군 필터 */}
          {(userRole === 'master' || userRole === 'ministry_admin') && selectedSido !== 'all' && (
            <select
              value={selectedGugun}
              onChange={(e) => setSelectedGugun(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-gray-100 px-3 py-2 rounded-lg text-sm w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">전체 구군</option>
              {gugunOptions.map(gugun => (
                <option key={gugun} value={gugun}>{gugun}</option>
              ))}
            </select>
          )}

          <div className="text-xs text-gray-500">
            최종 업데이트: {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* 점검 현황 차트 영역 - 컴팩트 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        {/* 1. 전체 */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-4">전체</h3>

          {/* 워크플로우 3단계 */}
          <div className="space-y-3">
            {/* 우선순위 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-blue-400">1</span>
                  </div>
                  <span className="text-xs text-gray-400">일정관리</span>
                </div>
                <span className="text-sm font-semibold text-blue-400">{dummyStats.totalAED}대</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div className="bg-blue-500 h-1.5 rounded-full" style={{width: '100%'}}></div>
              </div>
            </div>

            {/* 일정추가 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-orange-400">2</span>
                  </div>
                  <span className="text-xs text-gray-400">일정추가</span>
                </div>
                <span className="text-sm font-semibold text-orange-400">
                  {dummyStats.assignedMandatory + dummyStats.assignedNonMandatory}대
                  <span className="text-xs text-gray-500 ml-1">
                    ({Math.round(((dummyStats.assignedMandatory + dummyStats.assignedNonMandatory) / dummyStats.totalAED) * 100)}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div className="bg-orange-500 h-1.5 rounded-full" style={{width: `${Math.round(((dummyStats.assignedMandatory + dummyStats.assignedNonMandatory) / dummyStats.totalAED) * 100)}%`}}></div>
              </div>
            </div>

            {/* 점검완료 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-green-400">3</span>
                  </div>
                  <span className="text-xs text-gray-400">점검완료</span>
                </div>
                <span className="text-sm font-semibold text-green-400">
                  {dummyStats.completedMandatory + dummyStats.completedNonMandatory}대
                  <span className="text-xs text-gray-500 ml-1">
                    ({Math.round(((dummyStats.completedMandatory + dummyStats.completedNonMandatory) / dummyStats.totalAED) * 100)}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div className="bg-green-500 h-1.5 rounded-full" style={{width: `${Math.round(((dummyStats.completedMandatory + dummyStats.completedNonMandatory) / dummyStats.totalAED) * 100)}%`}}></div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. 구비의무기관 */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-4">구비의무기관</h3>

          {/* 워크플로우 3단계 */}
          <div className="space-y-3">
            {/* 우선순위 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-blue-400">1</span>
                  </div>
                  <span className="text-xs text-gray-400">일정관리</span>
                </div>
                <span className="text-sm font-semibold text-blue-400">{dummyStats.totalMandatory}대</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div className="bg-blue-500 h-1.5 rounded-full" style={{width: '100%'}}></div>
              </div>
            </div>

            {/* 일정추가 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-orange-400">2</span>
                  </div>
                  <span className="text-xs text-gray-400">일정추가</span>
                </div>
                <span className="text-sm font-semibold text-orange-400">
                  {dummyStats.assignedMandatory}대
                  <span className="text-xs text-gray-500 ml-1">
                    ({Math.round((dummyStats.assignedMandatory / dummyStats.totalMandatory) * 100)}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div className="bg-orange-500 h-1.5 rounded-full" style={{width: `${Math.round((dummyStats.assignedMandatory / dummyStats.totalMandatory) * 100)}%`}}></div>
              </div>
            </div>

            {/* 점검완료 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-green-400">3</span>
                  </div>
                  <span className="text-xs text-gray-400">점검완료</span>
                </div>
                <span className="text-sm font-semibold text-green-400">
                  {dummyStats.completedMandatory}대
                  <span className="text-xs text-gray-500 ml-1">
                    ({Math.round((dummyStats.completedMandatory / dummyStats.totalMandatory) * 100)}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div className="bg-green-500 h-1.5 rounded-full" style={{width: `${Math.round((dummyStats.completedMandatory / dummyStats.totalMandatory) * 100)}%`}}></div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. 구비의무기관 외 */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-4">구비의무기관 외</h3>

          {/* 워크플로우 3단계 */}
          <div className="space-y-3">
            {/* 우선순위 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-blue-400">1</span>
                  </div>
                  <span className="text-xs text-gray-400">일정관리</span>
                </div>
                <span className="text-sm font-semibold text-blue-400">{dummyStats.totalNonMandatory}대</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div className="bg-blue-500 h-1.5 rounded-full" style={{width: '100%'}}></div>
              </div>
            </div>

            {/* 일정추가 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-orange-400">2</span>
                  </div>
                  <span className="text-xs text-gray-400">일정추가</span>
                </div>
                <span className="text-sm font-semibold text-orange-400">
                  {dummyStats.assignedNonMandatory}대
                  <span className="text-xs text-gray-500 ml-1">
                    ({Math.round((dummyStats.assignedNonMandatory / dummyStats.totalNonMandatory) * 100)}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div className="bg-orange-500 h-1.5 rounded-full" style={{width: `${Math.round((dummyStats.assignedNonMandatory / dummyStats.totalNonMandatory) * 100)}%`}}></div>
              </div>
            </div>

            {/* 점검완료 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-green-400">3</span>
                  </div>
                  <span className="text-xs text-gray-400">점검완료</span>
                </div>
                <span className="text-sm font-semibold text-green-400">
                  {dummyStats.completedNonMandatory}대
                  <span className="text-xs text-gray-500 ml-1">
                    ({Math.round((dummyStats.completedNonMandatory / dummyStats.totalNonMandatory) * 100)}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div className="bg-green-500 h-1.5 rounded-full" style={{width: `${Math.round((dummyStats.completedNonMandatory / dummyStats.totalNonMandatory) * 100)}%`}}></div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. 외부표출 차단 */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-4">외부표출 차단</h3>

          {/* 워크플로우 3단계 */}
          <div className="space-y-3">
            {/* 우선순위 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-blue-400">1</span>
                  </div>
                  <span className="text-xs text-gray-400">일정관리</span>
                </div>
                <span className="text-sm font-semibold text-blue-400">{dummyStats.totalBlocked}대</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div className="bg-blue-500 h-1.5 rounded-full" style={{width: '100%'}}></div>
              </div>
            </div>

            {/* 일정추가 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-orange-400">2</span>
                  </div>
                  <span className="text-xs text-gray-400">일정추가</span>
                </div>
                <span className="text-sm font-semibold text-orange-400">
                  {dummyStats.assignedBlocked}대
                  <span className="text-xs text-gray-500 ml-1">
                    ({Math.round((dummyStats.assignedBlocked / dummyStats.totalBlocked) * 100)}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div className="bg-orange-500 h-1.5 rounded-full" style={{width: `${Math.round((dummyStats.assignedBlocked / dummyStats.totalBlocked) * 100)}%`}}></div>
              </div>
            </div>

            {/* 점검완료 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-green-400">3</span>
                  </div>
                  <span className="text-xs text-gray-400">점검완료</span>
                </div>
                <span className="text-sm font-semibold text-green-400">
                  {dummyStats.completedBlocked}대
                  <span className="text-xs text-gray-500 ml-1">
                    ({Math.round((dummyStats.completedBlocked / dummyStats.totalBlocked) * 100)}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div className="bg-green-500 h-1.5 rounded-full" style={{width: `${Math.round((dummyStats.completedBlocked / dummyStats.totalBlocked) * 100)}%`}}></div>
              </div>
            </div>
          </div>
        </div>

        {/* 5. 미점검 장비 */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-4">미점검 장비</h3>

          {/* 워크플로우 3단계 */}
          <div className="space-y-3">
            {/* 우선순위 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-blue-400">1</span>
                  </div>
                  <span className="text-xs text-gray-400">일정관리</span>
                </div>
                <span className="text-sm font-semibold text-blue-400">{dummyStats.totalUninspected}대</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div className="bg-blue-500 h-1.5 rounded-full" style={{width: '100%'}}></div>
              </div>
            </div>

            {/* 일정추가 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-orange-400">2</span>
                  </div>
                  <span className="text-xs text-gray-400">일정추가</span>
                </div>
                <span className="text-sm font-semibold text-orange-400">
                  {dummyStats.assignedUninspected}대
                  <span className="text-xs text-gray-500 ml-1">
                    ({Math.round((dummyStats.assignedUninspected / dummyStats.totalUninspected) * 100)}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div className="bg-orange-500 h-1.5 rounded-full" style={{width: `${Math.round((dummyStats.assignedUninspected / dummyStats.totalUninspected) * 100)}%`}}></div>
              </div>
            </div>

            {/* 점검완료 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-green-400">3</span>
                  </div>
                  <span className="text-xs text-gray-400">점검완료</span>
                </div>
                <span className="text-sm font-semibold text-green-400">
                  {dummyStats.completedUninspected}대
                  <span className="text-xs text-gray-500 ml-1">
                    ({Math.round((dummyStats.completedUninspected / dummyStats.totalUninspected) * 100)}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div className="bg-green-500 h-1.5 rounded-full" style={{width: `${Math.round((dummyStats.completedUninspected / dummyStats.totalUninspected) * 100)}%`}}></div>
              </div>
            </div>
          </div>
        </div>

        {/* 시간대별 점검 현황 */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 md:col-span-1 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-300">
              시간대별 점검 현황
            </h3>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                <span className="text-gray-400">누적</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-gray-400">
                  {timeRange === 'today' ? '오늘' : timeRange === 'week' ? '이번 주' : timeRange === 'month' ? '이번 달' : '올해'}
                </span>
              </div>
            </div>
          </div>
          <div className="relative h-32 px-4 py-2">
            <svg width="100%" height="128" viewBox="0 0 1000 128" preserveAspectRatio="none" className="overflow-visible">
              {(() => {
                // TODO: 실제 API 호출로 대체 필요
                // const apiData = await fetch('/api/dashboard/time-based-inspection?timeRange=' + timeRange);
                // const { currentData, cumulativeData, maxCount } = processChartData(apiData);

                // 현재 기간 원본 데이터 (더미 - 실제로는 API에서 받아야 함)
                const currentPeriodRaw: HourlyRawData[] = [
                  {hour: '08', totalCount: 0, activeDays: 1},
                  {hour: '09', totalCount: 1, activeDays: 1},
                  {hour: '10', totalCount: 2, activeDays: 1},
                  {hour: '11', totalCount: 1, activeDays: 1},
                  {hour: '12', totalCount: 0, activeDays: 1},
                  {hour: '13', totalCount: 1, activeDays: 1},
                  {hour: '14', totalCount: 3, activeDays: 1},
                  {hour: '15', totalCount: 1, activeDays: 1},
                  {hour: '16', totalCount: 1, activeDays: 1},
                  {hour: '17', totalCount: 0, activeDays: 1},
                  {hour: '18', totalCount: 0, activeDays: 1},
                  {hour: '19', totalCount: 0, activeDays: 1},
                  {hour: '20', totalCount: 0, activeDays: 1}
                ];

                // 누적 원본 데이터 (더미 - 120일간 누적, 하루 평균 2~6건)
                const cumulativeRaw: HourlyRawData[] = [
                  {hour: '08', totalCount: 240, activeDays: 120},  // 평균 2건/일
                  {hour: '09', totalCount: 360, activeDays: 120},  // 평균 3건/일
                  {hour: '10', totalCount: 600, activeDays: 120},  // 평균 5건/일
                  {hour: '11', totalCount: 480, activeDays: 120},  // 평균 4건/일
                  {hour: '12', totalCount: 360, activeDays: 120},  // 평균 3건/일
                  {hour: '13', totalCount: 480, activeDays: 120},  // 평균 4건/일
                  {hour: '14', totalCount: 720, activeDays: 120},  // 평균 6건/일
                  {hour: '15', totalCount: 600, activeDays: 120},  // 평균 5건/일
                  {hour: '16', totalCount: 480, activeDays: 120},  // 평균 4건/일
                  {hour: '17', totalCount: 360, activeDays: 120},  // 평균 3건/일
                  {hour: '18', totalCount: 240, activeDays: 120},  // 평균 2건/일
                  {hour: '19', totalCount: 120, activeDays: 120},  // 평균 1건/일
                  {hour: '20', totalCount: 120, activeDays: 120}   // 평균 1건/일
                ];

                // 유틸리티 함수를 사용하여 하루 평균으로 정규화
                const currentData = normalizeToDaily(currentPeriodRaw);
                const cumulativeData = normalizeToDaily(cumulativeRaw);
                const maxCount = calculateChartMaxValue(currentData, cumulativeData);

                const chartHeight = 100;
                const chartPadding = 14;
                const svgWidth = 1000;

                return (
                  <g>
                    {/* 그리드 라인 */}
                    <line x1="0" y1={chartPadding} x2={svgWidth} y2={chartPadding} stroke="#374151" strokeWidth="1" />
                    <line x1="0" y1={chartPadding + chartHeight * 0.33} x2={svgWidth} y2={chartPadding + chartHeight * 0.33} stroke="#374151" strokeWidth="1" strokeDasharray="2,2" />
                    <line x1="0" y1={chartPadding + chartHeight * 0.66} x2={svgWidth} y2={chartPadding + chartHeight * 0.66} stroke="#374151" strokeWidth="1" strokeDasharray="2,2" />
                    <line x1="0" y1={chartPadding + chartHeight} x2={svgWidth} y2={chartPadding + chartHeight} stroke="#374151" strokeWidth="1" />

                    {/* 누적 그래프 - 배경 (흐린 선) */}
                    <polyline
                      points={cumulativeData.map((item, index) => {
                        const x = (index / (cumulativeData.length - 1)) * svgWidth;
                        const y = chartPadding + chartHeight - (item.count / maxCount) * chartHeight;
                        return `${x},${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#1e40af"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.2"
                      vectorEffect="non-scaling-stroke"
                    />

                    {/* 누적 그래프 - 메인 */}
                    <polyline
                      points={cumulativeData.map((item, index) => {
                        const x = (index / (cumulativeData.length - 1)) * svgWidth;
                        const y = chartPadding + chartHeight - (item.count / maxCount) * chartHeight;
                        return `${x},${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />

                    {/* 누적 데이터 포인트 */}
                    {cumulativeData.map((item, index) => {
                      const x = (index / (cumulativeData.length - 1)) * svgWidth;
                      const y = chartPadding + chartHeight - (item.count / maxCount) * chartHeight;
                      return (
                        <g key={`cumulative-${item.hour}`}>
                          <circle
                            cx={x}
                            cy={y}
                            r="3"
                            fill="#2563eb"
                            stroke="#1f2937"
                            strokeWidth="1.5"
                            className="hover:r-5 transition-all cursor-pointer"
                          />
                        </g>
                      );
                    })}

                    {/* 현재 기간 그래프 - 배경 (흐린 선) */}
                    <polyline
                      points={currentData.map((item, index) => {
                        const x = (index / (currentData.length - 1)) * svgWidth;
                        const y = chartPadding + chartHeight - (item.count / maxCount) * chartHeight;
                        return `${x},${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.2"
                      vectorEffect="non-scaling-stroke"
                    />

                    {/* 현재 기간 그래프 - 메인 */}
                    <polyline
                      points={currentData.map((item, index) => {
                        const x = (index / (currentData.length - 1)) * svgWidth;
                        const y = chartPadding + chartHeight - (item.count / maxCount) * chartHeight;
                        return `${x},${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />

                    {/* 현재 기간 데이터 포인트 */}
                    {currentData.map((item, index) => {
                      const x = (index / (currentData.length - 1)) * svgWidth;
                      const y = chartPadding + chartHeight - (item.count / maxCount) * chartHeight;
                      return (
                        <g key={item.hour}>
                          <circle
                            cx={x}
                            cy={y}
                            r="4"
                            fill="#10b981"
                            stroke="#1f2937"
                            strokeWidth="2"
                            className="hover:r-6 transition-all cursor-pointer"
                          />
                          {item.count > 0 && (
                            <text
                              x={x}
                              y={y - 10}
                              textAnchor="middle"
                              fill="#10b981"
                              fontSize="10"
                              fontWeight="bold"
                            >
                              {item.count}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })()}
            </svg>

            {/* X축 라벨 */}
            <div className="flex justify-between mt-2">
              {['08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'].map((hour) => (
                <span key={hour} className="text-[10px] text-gray-500">{hour}</span>
              ))}
            </div>
          </div>
        </div>

        {/* 날짜별 점검건수 */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 md:col-span-1 lg:col-span-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-300">
              날짜별 점검건수
            </h3>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-orange-500"></div>
                <span className="text-gray-400">구비의무기관</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-sky-500"></div>
                <span className="text-gray-400">구비의무기관외</span>
              </div>
            </div>
          </div>
          <div className="relative h-32 px-4 py-2">
            <svg width="100%" height="128" viewBox="0 0 1000 128" preserveAspectRatio="none" className="overflow-visible">
              {(() => {
                // TODO: 실제 API 호출로 대체 필요
                // const apiData = await fetch('/api/dashboard/daily-inspection?timeRange=' + timeRange);

                // 더미 데이터 - 날짜별 점검건수 (최근 7일)
                const dailyData = [
                  {date: '12/08', mandatory: 8, nonMandatory: 5},
                  {date: '12/09', mandatory: 12, nonMandatory: 7},
                  {date: '12/10', mandatory: 10, nonMandatory: 6},
                  {date: '12/11', mandatory: 15, nonMandatory: 9},
                  {date: '12/12', mandatory: 11, nonMandatory: 8},
                  {date: '12/13', mandatory: 13, nonMandatory: 10},
                  {date: '12/14', mandatory: 9, nonMandatory: 6}
                ];

                const maxCount = Math.max(...dailyData.map(d => d.mandatory + d.nonMandatory));
                const chartHeight = 100;
                const chartPadding = 14;
                const svgWidth = 1000;
                const barWidth = svgWidth / (dailyData.length * 2.5); // 막대 너비
                const groupWidth = svgWidth / dailyData.length; // 그룹 간격

                return (
                  <g>
                    {/* 그리드 라인 */}
                    <line x1="0" y1={chartPadding} x2={svgWidth} y2={chartPadding} stroke="#374151" strokeWidth="1" />
                    <line x1="0" y1={chartPadding + chartHeight * 0.33} x2={svgWidth} y2={chartPadding + chartHeight * 0.33} stroke="#374151" strokeWidth="1" strokeDasharray="2,2" />
                    <line x1="0" y1={chartPadding + chartHeight * 0.66} x2={svgWidth} y2={chartPadding + chartHeight * 0.66} stroke="#374151" strokeWidth="1" strokeDasharray="2,2" />
                    <line x1="0" y1={chartPadding + chartHeight} x2={svgWidth} y2={chartPadding + chartHeight} stroke="#374151" strokeWidth="1" />

                    {/* 막대 그래프 */}
                    {dailyData.map((item, index) => {
                      const xCenter = (index + 0.5) * groupWidth;
                      const mandatoryHeight = (item.mandatory / maxCount) * chartHeight;
                      const nonMandatoryHeight = (item.nonMandatory / maxCount) * chartHeight;
                      const totalHeight = mandatoryHeight + nonMandatoryHeight;

                      return (
                        <g key={item.date}>
                          {/* 구비의무기관 (아래쪽) */}
                          <rect
                            x={xCenter - barWidth / 2}
                            y={chartPadding + chartHeight - mandatoryHeight}
                            width={barWidth}
                            height={mandatoryHeight}
                            fill="#f97316"
                            stroke="#1f2937"
                            strokeWidth="1"
                            className="hover:opacity-80 transition-opacity cursor-pointer"
                          />
                          {/* 구비의무기관외 (위쪽) */}
                          <rect
                            x={xCenter - barWidth / 2}
                            y={chartPadding + chartHeight - totalHeight}
                            width={barWidth}
                            height={nonMandatoryHeight}
                            fill="#0ea5e9"
                            stroke="#1f2937"
                            strokeWidth="1"
                            className="hover:opacity-80 transition-opacity cursor-pointer"
                          />
                          {/* 합계 표시 */}
                          <text
                            x={xCenter}
                            y={chartPadding + chartHeight - totalHeight - 5}
                            textAnchor="middle"
                            fill="#9ca3af"
                            fontSize="10"
                            fontWeight="bold"
                          >
                            {item.mandatory + item.nonMandatory}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })()}
            </svg>

            {/* X축 라벨 */}
            <div className="flex justify-between mt-2">
              {['12/08', '12/09', '12/10', '12/11', '12/12', '12/13', '12/14'].map((date) => (
                <span key={date} className="text-[10px] text-gray-500">{date}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 지역별 점검 현황 - 컴팩트 테이블 */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-medium text-gray-300">지역별 AED 점검현황</h2>
          <div className="flex gap-2">
            <button className="text-xs px-3 py-1 bg-gray-800 text-gray-400 rounded hover:bg-gray-700 transition-colors">
              PDF
            </button>
            <button className="text-xs px-3 py-1 bg-gray-800 text-gray-400 rounded hover:bg-gray-700 transition-colors">
              Excel
            </button>
          </div>
        </div>

        {/* 모바일: 카드 형식 */}
        <div className="md:hidden space-y-2 max-h-[calc(100vh-32rem)] overflow-y-auto">
          {filteredData.data.map((region, index) => {
            const mandatoryRate = region.mandatory > 0 ? Math.round((region.completedMandatory / region.mandatory) * 1000) / 10 : 0;
            const nonMandatoryRate = region.nonMandatory > 0 ? Math.round((region.completedNonMandatory / region.nonMandatory) * 1000) / 10 : 0;

            return (
              <div key={index} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-gray-100 font-medium text-sm">{region.region}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded ${region.rate >= 85 ? 'text-green-400 bg-green-500/10' : region.rate >= 80 ? 'text-yellow-400 bg-yellow-500/10' : 'text-red-400 bg-red-500/10'}`}>
                    전체 {region.rate}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                  <div>
                    <div className="text-gray-500">총 AED</div>
                    <div className="text-gray-300 font-medium">{region.total.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">완료</div>
                    <div className="text-green-400 font-medium">{region.completed.toLocaleString()}</div>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-gray-500">의무기관</span>
                      <span className={`font-medium ${mandatoryRate >= 85 ? 'text-orange-400' : mandatoryRate >= 80 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {mandatoryRate}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1">
                      <div
                        className={`h-1 rounded-full ${mandatoryRate >= 85 ? 'bg-orange-500' : mandatoryRate >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${mandatoryRate}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-gray-500">의무기관외</span>
                      <span className={`font-medium ${nonMandatoryRate >= 85 ? 'text-sky-400' : nonMandatoryRate >= 80 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {nonMandatoryRate}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1">
                      <div
                        className={`h-1 rounded-full ${nonMandatoryRate >= 85 ? 'bg-sky-500' : nonMandatoryRate >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${nonMandatoryRate}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 데스크톱: 컴팩트 테이블 */}
        <div className="hidden md:block overflow-auto max-h-[calc(100vh-28rem)]">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 sticky top-0">
              <tr>
                <th rowSpan={2} className="text-center py-3 px-2 text-xs font-medium text-gray-400 border-r border-gray-700 w-20">지역</th>
                <th colSpan={2} className="text-center py-2 px-3 text-xs font-medium text-gray-400 border-r border-gray-700">총 AED</th>
                <th colSpan={2} className="text-center py-2 px-3 text-xs font-medium text-gray-400 border-r border-gray-700">완료</th>
                <th colSpan={2} className="text-center py-2 px-3 text-xs font-medium text-gray-400 border-r border-gray-700">진행률</th>
                <th rowSpan={2} className="text-center py-3 px-3 text-xs font-medium text-gray-400">전체</th>
              </tr>
              <tr>
                <th className="text-right py-2 px-2 text-xs font-medium text-gray-500 border-r border-gray-700">의무</th>
                <th className="text-right py-2 px-2 text-xs font-medium text-gray-500 border-r border-gray-700">외</th>
                <th className="text-right py-2 px-2 text-xs font-medium text-gray-500 border-r border-gray-700">의무</th>
                <th className="text-right py-2 px-2 text-xs font-medium text-gray-500 border-r border-gray-700">외</th>
                <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 border-r border-gray-700">의무</th>
                <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 border-r border-gray-700">외</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.data.map((region, index) => {
                const mandatoryRate = region.mandatory > 0 ? Math.round((region.completedMandatory / region.mandatory) * 1000) / 10 : 0;
                const nonMandatoryRate = region.nonMandatory > 0 ? Math.round((region.completedNonMandatory / region.nonMandatory) * 1000) / 10 : 0;

                return (
                  <tr key={index} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                    <td className="py-2 px-2 text-gray-100 font-medium text-center border-r border-gray-800">{region.region}</td>
                    <td className="py-2 px-2 text-gray-300 text-right border-r border-gray-800">{(region.mandatory || 0).toLocaleString()}</td>
                    <td className="py-2 px-2 text-gray-400 text-right border-r border-gray-800">{(region.nonMandatory || 0).toLocaleString()}</td>
                    <td className="py-2 px-2 text-green-400 text-right border-r border-gray-800">{(region.completedMandatory || 0).toLocaleString()}</td>
                    <td className="py-2 px-2 text-green-500 text-right border-r border-gray-800">{(region.completedNonMandatory || 0).toLocaleString()}</td>
                    <td className="py-2 px-2 border-r border-gray-800">
                      <div className="flex items-center gap-1">
                        <div className="w-16 bg-gray-800 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${mandatoryRate >= 85 ? 'bg-orange-500' : mandatoryRate >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${mandatoryRate}%` }}
                          ></div>
                        </div>
                        <span className={`text-[10px] font-medium min-w-[32px] text-right ${mandatoryRate >= 85 ? 'text-orange-400' : mandatoryRate >= 80 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {mandatoryRate}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-2 border-r border-gray-800">
                      <div className="flex items-center gap-1">
                        <div className="w-16 bg-gray-800 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${nonMandatoryRate >= 85 ? 'bg-sky-500' : nonMandatoryRate >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${nonMandatoryRate}%` }}
                          ></div>
                        </div>
                        <span className={`text-[10px] font-medium min-w-[32px] text-right ${nonMandatoryRate >= 85 ? 'text-sky-400' : nonMandatoryRate >= 80 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {nonMandatoryRate}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-1">
                        <div className="w-16 bg-gray-800 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${region.rate >= 85 ? 'bg-green-500' : region.rate >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${region.rate}%` }}
                          ></div>
                        </div>
                        <span className={`text-[10px] font-medium min-w-[32px] text-right ${region.rate >= 85 ? 'text-green-400' : region.rate >= 80 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {region.rate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}