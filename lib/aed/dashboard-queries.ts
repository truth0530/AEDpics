import { cache } from 'react';
// TODO: Supabase 서버 클라이언트 임시 비활성화
// import { createClient } from '@/lib/supabase/server';
import type { UserProfile } from '@/packages/types';
import { normalizeRegionName } from '@/lib/constants/regions';

interface DashboardStats {
  total: number;
  mandatory: number;
  nonMandatory: number;
  completed: number;
  completedMandatory: number;
  completedNonMandatory: number;
  urgent: number;
  blocked: number;
  blockedMandatory: number;
  blockedNonMandatory: number;
  blockedInspected: number;
  blockedInspectedMandatory: number;
  blockedInspectedNonMandatory: number;
  uninspected: number;
  uninspectedMandatory: number;
  uninspectedNonMandatory: number;
  fieldInspected: number;
  fieldInspectedMandatory: number;
  fieldInspectedNonMandatory: number;
  assigned: number;
  assignedMandatory: number;
  assignedNonMandatory: number;
  unavailable: number;
  unavailableMandatory: number;
  unavailableNonMandatory: number;
}

interface RegionStats extends DashboardStats {
  region: string;
  rate: number;
}

export interface DashboardData {
  title: string;
  data: RegionStats[];
  totalAED: number;
  totalCompleted: number;
  totalUrgent: number;
  completionRate: number;
}

// 구비의무기관 목록
const MANDATORY_CATEGORIES = ['공동주택', '공항·항만·역사', '학교', '대규모점포'];

/**
 * 역할별 대시보드 데이터 조회 (SQL에서 필터링 및 집계)
 */
export const getCachedDashboardData = async (userProfile: UserProfile): Promise<DashboardData> => {
    const supabase = await createClient();

    if (userProfile.role === 'master' || userProfile.role === 'ministry_admin' || userProfile.role === 'emergency_center_admin' || userProfile.role === 'regional_emergency_center_admin') {
      // 전국 시도별 현황 - SQL에서 집계
      // Supabase JS 클라이언트 우회하고 직접 REST API 호출
      const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // 캐시 완전 우회: 헤더에만 의존
      const response = await fetch(`${apiUrl}/rest/v1/rpc/get_dashboard_stats_by_region`, {
        method: 'POST',
        headers: {
          'apikey': apiKey || '',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        body: JSON.stringify({}),  // RPC 호출시 빈 객체 전달
        cache: 'no-store',  // Next.js fetch 캐시 비활성화
        next: { revalidate: 0 }  // 즉시 재검증
      });

      const regionStats = await response.json();
      const error = response.ok ? null : regionStats;

      console.log('[Dashboard] Direct REST API call result:', {
        dataLength: regionStats?.length,
        error,
        sampleData: regionStats?.[0],
        hasBlockedInspected: 'blocked_inspected_count' in (regionStats?.[0] || {}),
        rawKeys: Object.keys(regionStats?.[0] || {})
      });

      if (!regionStats || regionStats.length === 0) {
        console.warn('[Dashboard] No regionStats data returned');
        return {
          title: '전국 시도별 AED 점검 현황',
          data: [],
          totalAED: 0,
          totalCompleted: 0,
          totalUrgent: 0,
          completionRate: 0,
        };
      }

      // 시도명 정규화 후 데이터 그룹화
      const normalizedStats = regionStats.map((stat: any) => ({
        ...stat,
        region: normalizeRegionName(stat.region || '미분류')
      }));

      // 같은 region끼리 합산
      const regionMap = new Map<string, any>();
      normalizedStats.forEach((stat: any) => {
        const existing = regionMap.get(stat.region);
        if (existing) {
          // 기존 데이터와 합산
          regionMap.set(stat.region, {
            region: stat.region,
            total_count: (existing.total_count || 0) + (stat.total_count || 0),
            mandatory_count: (existing.mandatory_count || 0) + (stat.mandatory_count || 0),
            non_mandatory_count: (existing.non_mandatory_count || 0) + (stat.non_mandatory_count || 0),
            completed_count: (existing.completed_count || 0) + (stat.completed_count || 0),
            completed_mandatory_count: (existing.completed_mandatory_count || 0) + (stat.completed_mandatory_count || 0),
            completed_non_mandatory_count: (existing.completed_non_mandatory_count || 0) + (stat.completed_non_mandatory_count || 0),
            urgent_count: (existing.urgent_count || 0) + (stat.urgent_count || 0),
            blocked_count: (existing.blocked_count || 0) + (stat.blocked_count || 0),
            blocked_mandatory_count: (existing.blocked_mandatory_count || 0) + (stat.blocked_mandatory_count || 0),
            blocked_non_mandatory_count: (existing.blocked_non_mandatory_count || 0) + (stat.blocked_non_mandatory_count || 0),
            blocked_inspected_count: (existing.blocked_inspected_count || 0) + (stat.blocked_inspected_count || 0),
            blocked_inspected_mandatory_count: (existing.blocked_inspected_mandatory_count || 0) + (stat.blocked_inspected_mandatory_count || 0),
            blocked_inspected_non_mandatory_count: (existing.blocked_inspected_non_mandatory_count || 0) + (stat.blocked_inspected_non_mandatory_count || 0),
            uninspected_count: (existing.uninspected_count || 0) + (stat.uninspected_count || 0),
            uninspected_mandatory_count: (existing.uninspected_mandatory_count || 0) + (stat.uninspected_mandatory_count || 0),
            uninspected_non_mandatory_count: (existing.uninspected_non_mandatory_count || 0) + (stat.uninspected_non_mandatory_count || 0),
            field_inspected_count: (existing.field_inspected_count || 0) + (stat.field_inspected_count || 0),
            field_inspected_mandatory_count: (existing.field_inspected_mandatory_count || 0) + (stat.field_inspected_mandatory_count || 0),
            field_inspected_non_mandatory_count: (existing.field_inspected_non_mandatory_count || 0) + (stat.field_inspected_non_mandatory_count || 0),
            assigned_count: (existing.assigned_count || 0) + (stat.assigned_count || 0),
            assigned_mandatory_count: (existing.assigned_mandatory_count || 0) + (stat.assigned_mandatory_count || 0),
            assigned_non_mandatory_count: (existing.assigned_non_mandatory_count || 0) + (stat.assigned_non_mandatory_count || 0),
          });
        } else {
          regionMap.set(stat.region, stat);
        }
      });

      // Map을 배열로 변환하고 완료율 재계산
      const mergedStats = Array.from(regionMap.values()).map((stat: any) => {
        const totalCount = stat.total_count || 0;
        const completedCount = stat.completed_count || 0;
        return {
          ...stat,
          completion_rate: totalCount > 0 ? Math.round((completedCount / totalCount) * 1000) / 10 : 0
        };
      });

      const data: RegionStats[] = mergedStats.map((stat: any) => ({
        region: stat.region,
        total: stat.total_count || 0,
        mandatory: stat.mandatory_count || 0,
        nonMandatory: stat.non_mandatory_count || 0,
        completed: stat.completed_count || 0,
        completedMandatory: stat.completed_mandatory_count || 0,
        completedNonMandatory: stat.completed_non_mandatory_count || 0,
        urgent: stat.urgent_count || 0,
        rate: stat.completion_rate || 0,
        blocked: stat.blocked_count || 0,
        blockedMandatory: stat.blocked_mandatory_count || 0,
        blockedNonMandatory: stat.blocked_non_mandatory_count || 0,
        blockedInspected: stat.blocked_inspected_count || 0,
        blockedInspectedMandatory: stat.blocked_inspected_mandatory_count || 0,
        blockedInspectedNonMandatory: stat.blocked_inspected_non_mandatory_count || 0,
        uninspected: stat.uninspected_count || 0,
        uninspectedMandatory: stat.uninspected_mandatory_count || 0,
        uninspectedNonMandatory: stat.uninspected_non_mandatory_count || 0,
        fieldInspected: stat.field_inspected_count || 0,
        fieldInspectedMandatory: stat.field_inspected_mandatory_count || 0,
        fieldInspectedNonMandatory: stat.field_inspected_non_mandatory_count || 0,
        assigned: stat.assigned_count || 0,
        assignedMandatory: stat.assigned_mandatory_count || 0,
        assignedNonMandatory: stat.assigned_non_mandatory_count || 0,
        unavailable: stat.unavailable_count || 0,
        unavailableMandatory: stat.unavailable_mandatory_count || 0,
        unavailableNonMandatory: stat.unavailable_non_mandatory_count || 0,
      }));

      const totalAED = data.reduce((sum, r) => sum + r.total, 0);
      const totalCompleted = data.reduce((sum, r) => sum + r.completed, 0);
      const totalUrgent = data.reduce((sum, r) => sum + r.urgent, 0);
      const completionRate = totalAED > 0 ? Math.round((totalCompleted / totalAED) * 1000) / 10 : 0;

      return {
        title: '전국 시도별 AED 점검 현황',
        data: data.sort((a, b) => b.total - a.total),
        totalAED,
        totalCompleted,
        totalUrgent,
        completionRate,
      };
    } else if (userProfile.role === 'regional_admin') {
      // 시군구별 현황 - SQL에서 지역 필터링 및 집계
      const userRegion = userProfile.organization?.region_code;

      if (!userRegion) {
        return {
          title: `${userProfile.organization?.name || '시도'} 시군구별 AED 점검 현황`,
          data: [],
          totalAED: 0,
          totalCompleted: 0,
          totalUrgent: 0,
          completionRate: 0,
        };
      }

      const { data: cityStats } = await supabase.rpc('get_dashboard_stats_by_city', {
        p_region_code: userRegion,
      });

      if (!cityStats) {
        return {
          title: `${userProfile.organization?.name || '시도'} 시군구별 AED 점검 현황`,
          data: [],
          totalAED: 0,
          totalCompleted: 0,
          totalUrgent: 0,
          completionRate: 0,
        };
      }

      const data: RegionStats[] = cityStats.map((stat: any) => ({
        region: stat.city || '미분류',
        total: stat.total_count || 0,
        mandatory: stat.mandatory_count || 0,
        nonMandatory: stat.non_mandatory_count || 0,
        completed: stat.completed_count || 0,
        completedMandatory: stat.completed_mandatory_count || 0,
        completedNonMandatory: stat.completed_non_mandatory_count || 0,
        urgent: stat.urgent_count || 0,
        rate: stat.completion_rate || 0,
        blocked: stat.blocked_count || 0,
        blockedMandatory: stat.blocked_mandatory_count || 0,
        blockedNonMandatory: stat.blocked_non_mandatory_count || 0,
        blockedInspected: stat.blocked_inspected_count || 0,
        blockedInspectedMandatory: stat.blocked_inspected_mandatory_count || 0,
        blockedInspectedNonMandatory: stat.blocked_inspected_non_mandatory_count || 0,
        uninspected: stat.uninspected_count || 0,
        uninspectedMandatory: stat.uninspected_mandatory_count || 0,
        uninspectedNonMandatory: stat.uninspected_non_mandatory_count || 0,
        fieldInspected: stat.field_inspected_count || 0,
        fieldInspectedMandatory: stat.field_inspected_mandatory_count || 0,
        fieldInspectedNonMandatory: stat.field_inspected_non_mandatory_count || 0,
        assigned: stat.assigned_count || 0,
        assignedMandatory: stat.assigned_mandatory_count || 0,
        assignedNonMandatory: stat.assigned_non_mandatory_count || 0,
        unavailable: stat.unavailable_count || 0,
        unavailableMandatory: stat.unavailable_mandatory_count || 0,
        unavailableNonMandatory: stat.unavailable_non_mandatory_count || 0,
      }));

      const totalAED = data.reduce((sum, r) => sum + r.total, 0);
      const totalCompleted = data.reduce((sum, r) => sum + r.completed, 0);
      const totalUrgent = data.reduce((sum, r) => sum + r.urgent, 0);
      const completionRate = totalAED > 0 ? Math.round((totalCompleted / totalAED) * 1000) / 10 : 0;

      return {
        title: `${userProfile.organization?.name || '시도'} 시군구별 AED 점검 현황`,
        data: data.sort((a, b) => b.total - a.total),
        totalAED,
        totalCompleted,
        totalUrgent,
        completionRate,
      };
    } else {
      // 보건소: 관할지역 현황 - SQL에서 보건소 필터링
      const userHealthCenter = userProfile.organization?.name;

      if (!userHealthCenter) {
        return {
          title: `${userProfile.organization?.name || '관할지역'} AED 점검 현황`,
          data: [],
          totalAED: 0,
          totalCompleted: 0,
          totalUrgent: 0,
          completionRate: 0,
        };
      }

      const { data: healthCenterStats } = await supabase.rpc('get_dashboard_stats_by_health_center', {
        p_health_center: userHealthCenter,
      });

      const stat = healthCenterStats?.[0] || {
        total_count: 0,
        mandatory_count: 0,
        non_mandatory_count: 0,
        completed_count: 0,
        completed_mandatory_count: 0,
        completed_non_mandatory_count: 0,
        urgent_count: 0,
        completion_rate: 0,
      };

      const data: RegionStats[] = [
        {
          region: userProfile.organization?.name || '관할지역',
          total: stat.total_count,
          mandatory: stat.mandatory_count,
          nonMandatory: stat.non_mandatory_count,
          completed: stat.completed_count,
          completedMandatory: stat.completed_mandatory_count,
          completedNonMandatory: stat.completed_non_mandatory_count,
          urgent: stat.urgent_count,
          rate: stat.completion_rate,
          blocked: stat.blocked_count || 0,
          blockedMandatory: stat.blocked_mandatory_count || 0,
          blockedNonMandatory: stat.blocked_non_mandatory_count || 0,
          blockedInspected: stat.blocked_inspected_count || 0,
          blockedInspectedMandatory: stat.blocked_inspected_mandatory_count || 0,
          blockedInspectedNonMandatory: stat.blocked_inspected_non_mandatory_count || 0,
          uninspected: stat.uninspected_count || 0,
          uninspectedMandatory: stat.uninspected_mandatory_count || 0,
          uninspectedNonMandatory: stat.uninspected_non_mandatory_count || 0,
          fieldInspected: stat.field_inspected_count || 0,
          fieldInspectedMandatory: stat.field_inspected_mandatory_count || 0,
          fieldInspectedNonMandatory: stat.field_inspected_non_mandatory_count || 0,
          assigned: stat.assigned_count || 0,
          assignedMandatory: stat.assigned_mandatory_count || 0,
          assignedNonMandatory: stat.assigned_non_mandatory_count || 0,
          unavailable: stat.unavailable_count || 0,
          unavailableMandatory: stat.unavailable_mandatory_count || 0,
          unavailableNonMandatory: stat.unavailable_non_mandatory_count || 0,
        },
      ];

      return {
        title: `${userProfile.organization?.name || '관할지역'} AED 점검 현황`,
        data,
        totalAED: stat.total_count,
        totalCompleted: stat.completed_count,
        totalUrgent: stat.urgent_count,
        completionRate: stat.completion_rate,
      };
    }
  };

/**
 * 시도 목록 조회 (캐싱)
 */
export const getCachedSidoList = cache(async (): Promise<string[]> => {
  const supabase = await createClient();

  const { data } = await supabase
    .from('aed_data')
    .select('sido')
    .not('sido', 'is', null)
    .order('sido');

  if (!data) return [];

  return Array.from(new Set(data.map((d) => d.sido).filter(Boolean)));
});

/**
 * 시도별 구군 목록 조회 (캐싱)
 */
export const getCachedGugunMap = cache(async (): Promise<Record<string, string[]>> => {
  const supabase = await createClient();

  const { data } = await supabase
    .from('aed_data')
    .select('sido, gugun, city_code')
    .not('sido', 'is', null);

  if (!data) return {};

  const gugunByDo: Record<string, Set<string>> = {};

  data.forEach((device) => {
    const sido = device.sido || '미분류';
    const gugun = device.gugun || device.city_code || '미분류';
    if (!gugunByDo[sido]) gugunByDo[sido] = new Set();
    gugunByDo[sido].add(gugun);
  });

  return Object.fromEntries(
    Object.entries(gugunByDo).map(([sido, gugunSet]) => [sido, Array.from(gugunSet).sort()])
  );
});

/**
 * 시간대별 점검 현황 조회 (최근 24시간)
 */
export interface HourlyInspectionData {
  hour: string;
  mandatory: number;
  nonMandatory: number;
}

export const getCachedHourlyInspections = cache(
  async (userProfile: UserProfile): Promise<HourlyInspectionData[]> => {
    const supabase = await createClient();

    // 최근 24시간 동안 완료된 점검 조회
    const { data: inspections } = await supabase
      .from('inspection_assignments')
      .select('completed_at, equipment_serial, aed_data!inner(category_1)')
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .gte('completed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (!inspections) {
      return Array.from({ length: 24 }, (_, i) => ({
        hour: `${i}시`,
        mandatory: 0,
        nonMandatory: 0,
      }));
    }

    // 시간대별로 그룹화
    const hourlyStats: Record<number, { mandatory: number; nonMandatory: number }> = {};
    for (let i = 0; i < 24; i++) {
      hourlyStats[i] = { mandatory: 0, nonMandatory: 0 };
    }

    inspections.forEach((inspection: any) => {
      if (inspection.completed_at) {
        const hour = new Date(inspection.completed_at).getHours();
        const isMandatory = MANDATORY_CATEGORIES.includes(inspection.aed_data?.category_1);

        if (isMandatory) {
          hourlyStats[hour].mandatory++;
        } else {
          hourlyStats[hour].nonMandatory++;
        }
      }
    });

    return Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}시`,
      mandatory: hourlyStats[i].mandatory,
      nonMandatory: hourlyStats[i].nonMandatory,
    }));
  }
);

/**
 * 날짜별 점검건수 조회 (최근 7일)
 */
export interface DailyInspectionData {
  date: string;
  mandatory: number;
  nonMandatory: number;
}

export const getCachedDailyInspections = cache(
  async (userProfile: UserProfile): Promise<DailyInspectionData[]> => {
    const supabase = await createClient();

    // 최근 7일 동안 완료된 점검 조회
    const { data: inspections } = await supabase
      .from('inspection_assignments')
      .select('completed_at, equipment_serial, aed_data!inner(category_1)')
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .gte('completed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (!inspections) {
      const dates = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        dates.push({
          date: `${date.getMonth() + 1}/${date.getDate()}`,
          mandatory: 0,
          nonMandatory: 0,
        });
      }
      return dates;
    }

    // 날짜별로 그룹화
    const dailyStats: Record<string, { mandatory: number; nonMandatory: number }> = {};
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      dailyStats[dateKey] = { mandatory: 0, nonMandatory: 0 };
    }

    inspections.forEach((inspection: any) => {
      if (inspection.completed_at) {
        const completedDate = new Date(inspection.completed_at);
        const dateKey = `${completedDate.getFullYear()}-${String(completedDate.getMonth() + 1).padStart(2, '0')}-${String(completedDate.getDate()).padStart(2, '0')}`;

        if (dailyStats[dateKey]) {
          const isMandatory = MANDATORY_CATEGORIES.includes(inspection.aed_data?.category_1);

          if (isMandatory) {
            dailyStats[dateKey].mandatory++;
          } else {
            dailyStats[dateKey].nonMandatory++;
          }
        }
      }
    });

    const result = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      result.push({
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        mandatory: dailyStats[dateKey].mandatory,
        nonMandatory: dailyStats[dateKey].nonMandatory,
      });
    }

    return result;
  }
);
