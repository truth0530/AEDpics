import { cache } from 'react';
import { PrismaClient } from '@prisma/client';
import type { UserProfile } from '@/packages/types';
import { normalizeRegionName } from '@/lib/constants/regions';

const prisma = new PrismaClient();

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
 * 역할별 대시보드 데이터 조회 (Prisma 버전)
 */
export const getCachedDashboardData = cache(async (userProfile: UserProfile): Promise<DashboardData> => {
  try {
    // 전국 또는 지역별 통계 집계
    const isNationalView = ['master', 'ministry_admin', 'emergency_center_admin', 'regional_emergency_center_admin'].includes(userProfile.role);

    if (isNationalView) {
      // 전국 시도별 통계 집계
      const regions = await prisma.aed_data.groupBy({
        by: ['sido'],
        _count: {
          _all: true
        },
        where: {
          sido: { not: null }
        }
      });

      const regionStats: RegionStats[] = await Promise.all(
        regions.map(async (region) => {
          const baseWhere = { sido: region.sido };

          // 각 통계를 개별로 계산
          const [
            total,
            mandatory,
            completed,
            blocked,
            uninspected
          ] = await Promise.all([
            prisma.aed_data.count({ where: baseWhere }),
            prisma.aed_data.count({
              where: {
                ...baseWhere,
                category_1: { in: MANDATORY_CATEGORIES }
              }
            }),
            prisma.aed_data.count({
              where: {
                ...baseWhere,
                last_inspection_date: { not: null }
              }
            }),
            prisma.aed_data.count({
              where: {
                ...baseWhere,
                external_display: 'N'
              }
            }),
            prisma.aed_data.count({
              where: {
                ...baseWhere,
                last_inspection_date: null
              }
            })
          ]);

          const nonMandatory = total - mandatory;
          const completedMandatory = await prisma.aed_data.count({
            where: {
              ...baseWhere,
              category_1: { in: MANDATORY_CATEGORIES },
              last_inspection_date: { not: null }
            }
          });
          const completedNonMandatory = completed - completedMandatory;

          return {
            region: region.sido || '알 수 없음',
            total,
            mandatory,
            nonMandatory,
            completed,
            completedMandatory,
            completedNonMandatory,
            urgent: 0,
            blocked,
            blockedMandatory: 0,
            blockedNonMandatory: 0,
            blockedInspected: 0,
            blockedInspectedMandatory: 0,
            blockedInspectedNonMandatory: 0,
            uninspected,
            uninspectedMandatory: mandatory - completedMandatory,
            uninspectedNonMandatory: nonMandatory - completedNonMandatory,
            fieldInspected: 0,
            fieldInspectedMandatory: 0,
            fieldInspectedNonMandatory: 0,
            assigned: 0,
            assignedMandatory: 0,
            assignedNonMandatory: 0,
            unavailable: 0,
            unavailableMandatory: 0,
            unavailableNonMandatory: 0,
            rate: total > 0 ? (completed / total) * 100 : 0
          };
        })
      );

      const totalAED = regionStats.reduce((sum, r) => sum + r.total, 0);
      const totalCompleted = regionStats.reduce((sum, r) => sum + r.completed, 0);

      return {
        title: '전국 시도별 AED 점검 현황',
        data: regionStats.sort((a, b) => b.total - a.total),
        totalAED,
        totalCompleted,
        totalUrgent: 0,
        completionRate: totalAED > 0 ? (totalCompleted / totalAED) * 100 : 0
      };
    } else {
      // 지역별 상세 통계
      const regionWhere = userProfile.region ? { sido: userProfile.region } : {};

      const [total, completed] = await Promise.all([
        prisma.aed_data.count({ where: regionWhere }),
        prisma.aed_data.count({
          where: {
            ...regionWhere,
            last_inspection_date: { not: null }
          }
        })
      ]);

      const mandatory = await prisma.aed_data.count({
        where: {
          ...regionWhere,
          category_1: { in: MANDATORY_CATEGORIES }
        }
      });

      const completedMandatory = await prisma.aed_data.count({
        where: {
          ...regionWhere,
          category_1: { in: MANDATORY_CATEGORIES },
          last_inspection_date: { not: null }
        }
      });

      const regionStat: RegionStats = {
        region: userProfile.region || '전체',
        total,
        mandatory,
        nonMandatory: total - mandatory,
        completed,
        completedMandatory,
        completedNonMandatory: completed - completedMandatory,
        urgent: 0,
        blocked: 0,
        blockedMandatory: 0,
        blockedNonMandatory: 0,
        blockedInspected: 0,
        blockedInspectedMandatory: 0,
        blockedInspectedNonMandatory: 0,
        uninspected: total - completed,
        uninspectedMandatory: mandatory - completedMandatory,
        uninspectedNonMandatory: (total - mandatory) - (completed - completedMandatory),
        fieldInspected: 0,
        fieldInspectedMandatory: 0,
        fieldInspectedNonMandatory: 0,
        assigned: 0,
        assignedMandatory: 0,
        assignedNonMandatory: 0,
        unavailable: 0,
        unavailableMandatory: 0,
        unavailableNonMandatory: 0,
        rate: total > 0 ? (completed / total) * 100 : 0
      };

      return {
        title: `${userProfile.region || '지역'} AED 점검 현황`,
        data: [regionStat],
        totalAED: total,
        totalCompleted: completed,
        totalUrgent: 0,
        completionRate: total > 0 ? (completed / total) * 100 : 0
      };
    }
  } catch (error) {
    console.error('Dashboard data query error:', error);

    // 에러 시 빈 데이터 반환
    return {
      title: 'AED 점검 현황',
      data: [],
      totalAED: 0,
      totalCompleted: 0,
      totalUrgent: 0,
      completionRate: 0
    };
  }
});

/**
 * 시간별 점검 통계 (Prisma 버전)
 */
export const getCachedHourlyInspections = cache(async (userProfile: UserProfile): Promise<any[]> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const inspections = await prisma.inspections.findMany({
      where: {
        inspection_date: {
          gte: today
        }
      },
      select: {
        inspection_date: true
      }
    });

    // 시간별 집계
    const hourlyData = Array(24).fill(null).map((_, hour) => ({
      hour: `${hour}시`,
      count: 0
    }));

    inspections.forEach(inspection => {
      if (inspection.inspection_date) {
        const hour = new Date(inspection.inspection_date).getHours();
        hourlyData[hour].count++;
      }
    });

    return hourlyData;
  } catch (error) {
    console.error('Hourly inspections query error:', error);
    return Array(24).fill(null).map((_, hour) => ({
      hour: `${hour}시`,
      count: 0
    }));
  }
});

/**
 * 일별 점검 통계 (Prisma 버전)
 */
export const getCachedDailyInspections = cache(async (userProfile: UserProfile): Promise<any[]> => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const inspections = await prisma.inspections.groupBy({
      by: ['inspection_date'],
      _count: {
        _all: true
      },
      where: {
        inspection_date: {
          gte: thirtyDaysAgo
        }
      },
      orderBy: {
        inspection_date: 'asc'
      }
    });

    // 날짜별 데이터 포맷
    const dailyMap = new Map<string, number>();
    inspections.forEach(item => {
      if (item.inspection_date) {
        const dateStr = new Date(item.inspection_date).toISOString().split('T')[0];
        dailyMap.set(dateStr, item._count._all);
      }
    });

    // 최근 30일 데이터 생성
    const dailyData = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayLabel = `${date.getMonth() + 1}/${date.getDate()}`;

      dailyData.push({
        day: dayLabel,
        count: dailyMap.get(dateStr) || 0
      });
    }

    return dailyData;
  } catch (error) {
    console.error('Daily inspections query error:', error);

    // 에러 시 빈 데이터 반환
    const dailyData = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayLabel = `${date.getMonth() + 1}/${date.getDate()}`;

      dailyData.push({
        day: dayLabel,
        count: 0
      });
    }
    return dailyData;
  }
});