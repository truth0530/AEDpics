import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import type { UserProfile } from '@/packages/types';
import { normalizeRegionName } from '@/lib/constants/regions';
import { logger } from '@/lib/logger';

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
  blockedAssigned: number;
  blockedFieldInspected: number;
  uninspected: number;
  uninspectedMandatory: number;
  uninspectedNonMandatory: number;
  uninspectedAssigned: number;
  uninspectedFieldInspected: number;
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

// 구비의무기관 카테고리 (e-gen 시스템에서 이미 분류됨)
const MANDATORY_CATEGORY = '구비의무기관';

/**
 * 날짜 범위 필터 헬퍼 함수 (한국 시간대 기준)
 */
function getDateRangeForFilter(dateRange: 'all' | 'all' | 'today' | 'this_week' | 'this_month' | 'last_month'): {
  startDate: Date | null;
  endDate: Date | null;
} {
  // '전체'일 경우 date filter 없음
  if (dateRange === 'all') {
    return { startDate: null, endDate: null };
  }

  // 한국 시간대(KST, UTC+9)로 현재 시간 계산
  const nowUTC = new Date();
  const kstOffset = 9 * 60 * 60 * 1000; // 9시간을 밀리초로
  const nowKST = new Date(nowUTC.getTime() + kstOffset);

  // KST 기준 날짜 계산
  const year = nowKST.getUTCFullYear();
  const month = nowKST.getUTCMonth();
  const date = nowKST.getUTCDate();
  const dayOfWeek = nowKST.getUTCDay();

  let startDate: Date;
  let endDate: Date;

  switch (dateRange) {
    case 'today':
      // 오늘 00:00:00 KST ~ 23:59:59 KST
      startDate = new Date(Date.UTC(year, month, date, 0, 0, 0, 0) - kstOffset);
      endDate = new Date(Date.UTC(year, month, date, 23, 59, 59, 999) - kstOffset);
      break;
    case 'this_week':
      // 이번 주 일요일 00:00:00 KST ~ 오늘 23:59:59 KST
      startDate = new Date(Date.UTC(year, month, date - dayOfWeek, 0, 0, 0, 0) - kstOffset);
      endDate = new Date(Date.UTC(year, month, date, 23, 59, 59, 999) - kstOffset);
      break;
    case 'this_month':
      // 이번 달 1일 00:00:00 KST ~ 오늘 23:59:59 KST
      startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0) - kstOffset);
      endDate = new Date(Date.UTC(year, month, date, 23, 59, 59, 999) - kstOffset);
      break;
    case 'last_month':
      // 지난 달 1일 00:00:00 KST ~ 지난 달 마지막날 23:59:59 KST
      const lastMonthYear = month === 0 ? year - 1 : year;
      const lastMonth = month === 0 ? 11 : month - 1;
      const lastDayOfLastMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      startDate = new Date(Date.UTC(lastMonthYear, lastMonth, 1, 0, 0, 0, 0) - kstOffset);
      endDate = new Date(Date.UTC(lastMonthYear, lastMonth, lastDayOfLastMonth, 23, 59, 59, 999) - kstOffset);
      break;
  }

  return { startDate, endDate };
}

/**
 * 역할별 대시보드 데이터 조회 (Prisma 버전)
 */
export const getCachedDashboardData = cache(async (
  userProfile: UserProfile,
  selectedSido?: string,
  selectedGugun?: string
): Promise<DashboardData> => {
  try {
    // 지역명 정규화 (예: "대구광역시" → "대구")
    const normalizedSido = selectedSido ? normalizeRegionName(selectedSido) : selectedSido;
    const normalizedGugun = selectedGugun ? normalizeRegionName(selectedGugun) : selectedGugun;

    // 전국 또는 지역별 통계 집계
    const isNationalView = ['master', 'ministry_admin', 'emergency_center_admin', 'regional_emergency_center_admin'].includes(userProfile.role);

    if (isNationalView) {
      // 전국 시도별 통계 집계 (단일 쿼리로 최적화)
      // normalizedSido가 있으면 해당 시도만, normalizedGugun이 있으면 해당 구군만
      const groupByField = (normalizedSido && normalizedSido !== '전체') ? 'gugun' : 'sido';

      let aggregatedStats: Array<{
        region: string;
        total: bigint;
        mandatory: bigint;
        completed: bigint;
        blocked: bigint;
        uninspected: bigint;
        completed_mandatory: bigint;
      }>;

      if (normalizedGugun && normalizedGugun !== '전체') {
        // 특정 구군만 조회 (sido 조건 필수 추가 - 전국 동명 구군 중복 집계 방지)
        if (!normalizedSido || normalizedSido === '전체') {
          throw new Error('구군을 선택할 때는 시도 정보가 필요합니다');
        }

        aggregatedStats = await prisma.$queryRaw`
          SELECT
            gugun as region,
            COUNT(*) as total,
            SUM(CASE
              WHEN category_1 = '구비의무기관'
              THEN 1
              ELSE 0
            END) as mandatory,
            SUM(CASE
              WHEN last_inspection_date IS NOT NULL
              THEN 1
              ELSE 0
            END) as completed,
            SUM(CASE
              WHEN external_display = 'N'
              THEN 1
              ELSE 0
            END) as blocked,
            SUM(CASE
              WHEN last_inspection_date IS NULL
              THEN 1
              ELSE 0
            END) as uninspected,
            SUM(CASE
              WHEN category_1 = '구비의무기관'
                AND last_inspection_date IS NOT NULL
              THEN 1
              ELSE 0
            END) as completed_mandatory
          FROM aedpics.aed_data
          WHERE sido = ${normalizedSido} AND gugun = ${normalizedGugun}
          GROUP BY gugun
          ORDER BY total DESC
        `;
      } else if (normalizedSido && normalizedSido !== '전체') {
        // 특정 시도의 구군별 통계
        aggregatedStats = await prisma.$queryRaw`
          SELECT
            gugun as region,
            COUNT(*) as total,
            SUM(CASE
              WHEN category_1 = '구비의무기관'
              THEN 1
              ELSE 0
            END) as mandatory,
            SUM(CASE
              WHEN last_inspection_date IS NOT NULL
              THEN 1
              ELSE 0
            END) as completed,
            SUM(CASE
              WHEN external_display = 'N'
              THEN 1
              ELSE 0
            END) as blocked,
            SUM(CASE
              WHEN last_inspection_date IS NULL
              THEN 1
              ELSE 0
            END) as uninspected,
            SUM(CASE
              WHEN category_1 = '구비의무기관'
                AND last_inspection_date IS NOT NULL
              THEN 1
              ELSE 0
            END) as completed_mandatory
          FROM aedpics.aed_data
          WHERE sido = ${normalizedSido}
          GROUP BY gugun
          ORDER BY total DESC
        `;
      } else {
        // 전국 시도별 통계
        aggregatedStats = await prisma.$queryRaw`
          SELECT
            sido as region,
            COUNT(*) as total,
            SUM(CASE
              WHEN category_1 = '구비의무기관'
              THEN 1
              ELSE 0
            END) as mandatory,
            SUM(CASE
              WHEN last_inspection_date IS NOT NULL
              THEN 1
              ELSE 0
            END) as completed,
            SUM(CASE
              WHEN external_display = 'N'
              THEN 1
              ELSE 0
            END) as blocked,
            SUM(CASE
              WHEN last_inspection_date IS NULL
              THEN 1
              ELSE 0
            END) as uninspected,
            SUM(CASE
              WHEN category_1 = '구비의무기관'
                AND last_inspection_date IS NOT NULL
              THEN 1
              ELSE 0
            END) as completed_mandatory
          FROM aedpics.aed_data
          WHERE sido IS NOT NULL
          GROUP BY sido
          ORDER BY total DESC
        `;
      }

      // 실제 점검 건수 조회 (inspections 테이블) - 의무기관/비의무기관 구분
      let inspectionCounts: Array<{
        region: string;
        count: bigint;
        mandatory_count: bigint;
        non_mandatory_count: bigint;
      }> = [];

      try {
        if (normalizedGugun && normalizedGugun !== '전체' && normalizedSido && normalizedSido !== '전체') {
          // 특정 구군의 점검 건수
          inspectionCounts = await prisma.$queryRaw`
            SELECT
              a.gugun as region,
              COUNT(DISTINCT i.id)::bigint as count,
              COUNT(DISTINCT CASE WHEN a.category_1 = '구비의무기관' THEN i.id END)::bigint as mandatory_count,
              COUNT(DISTINCT CASE WHEN a.category_1 != '구비의무기관' THEN i.id END)::bigint as non_mandatory_count
            FROM aedpics.inspections i
            INNER JOIN aedpics.aed_data a ON i.equipment_serial = a.equipment_serial
            WHERE a.sido = ${normalizedSido} AND a.gugun = ${normalizedGugun}
            GROUP BY a.gugun
          `;
        } else if (normalizedSido && normalizedSido !== '전체') {
          // 특정 시도의 구군별 점검 건수
          inspectionCounts = await prisma.$queryRaw`
            SELECT
              a.gugun as region,
              COUNT(DISTINCT i.id)::bigint as count,
              COUNT(DISTINCT CASE WHEN a.category_1 = '구비의무기관' THEN i.id END)::bigint as mandatory_count,
              COUNT(DISTINCT CASE WHEN a.category_1 != '구비의무기관' THEN i.id END)::bigint as non_mandatory_count
            FROM aedpics.inspections i
            INNER JOIN aedpics.aed_data a ON i.equipment_serial = a.equipment_serial
            WHERE a.sido = ${normalizedSido}
            GROUP BY a.gugun
          `;
        } else {
          // 전국 시도별 점검 건수
          inspectionCounts = await prisma.$queryRaw`
            SELECT
              a.sido as region,
              COUNT(DISTINCT i.id)::bigint as count,
              COUNT(DISTINCT CASE WHEN a.category_1 = '구비의무기관' THEN i.id END)::bigint as mandatory_count,
              COUNT(DISTINCT CASE WHEN a.category_1 != '구비의무기관' THEN i.id END)::bigint as non_mandatory_count
            FROM aedpics.inspections i
            INNER JOIN aedpics.aed_data a ON i.equipment_serial = a.equipment_serial
            GROUP BY a.sido
          `;
        }
      } catch (error) {
        logger.error('dashboard-queries', 'Failed to fetch inspection counts', { error });
        // 점검 건수 조회 실패 시 빈 배열 사용 (다른 통계는 정상 표시)
        inspectionCounts = [];
      }

      // 일정추가 건수 조회 (inspection_schedule_entries 테이블)
      let scheduleCounts: Array<{
        region: string;
        count: bigint;
        mandatory_count: bigint;
        non_mandatory_count: bigint;
      }> = [];

      try {
        if (normalizedGugun && normalizedGugun !== '전체' && normalizedSido && normalizedSido !== '전체') {
          // 특정 구군의 일정추가 건수
          scheduleCounts = await prisma.$queryRaw`
            SELECT
              a.gugun as region,
              COUNT(DISTINCT s.id)::bigint as count,
              COUNT(DISTINCT CASE WHEN a.category_1 = '구비의무기관' THEN s.id END)::bigint as mandatory_count,
              COUNT(DISTINCT CASE WHEN a.category_1 != '구비의무기관' THEN s.id END)::bigint as non_mandatory_count
            FROM aedpics.inspection_schedule_entries s
            INNER JOIN aedpics.aed_data a ON s.device_equipment_serial = a.equipment_serial
            WHERE a.sido = ${normalizedSido} AND a.gugun = ${normalizedGugun}
            GROUP BY a.gugun
          `;
        } else if (normalizedSido && normalizedSido !== '전체') {
          // 특정 시도의 구군별 일정추가 건수
          scheduleCounts = await prisma.$queryRaw`
            SELECT
              a.gugun as region,
              COUNT(DISTINCT s.id)::bigint as count,
              COUNT(DISTINCT CASE WHEN a.category_1 = '구비의무기관' THEN s.id END)::bigint as mandatory_count,
              COUNT(DISTINCT CASE WHEN a.category_1 != '구비의무기관' THEN s.id END)::bigint as non_mandatory_count
            FROM aedpics.inspection_schedule_entries s
            INNER JOIN aedpics.aed_data a ON s.device_equipment_serial = a.equipment_serial
            WHERE a.sido = ${normalizedSido}
            GROUP BY a.gugun
          `;
        } else {
          // 전국 시도별 일정추가 건수
          scheduleCounts = await prisma.$queryRaw`
            SELECT
              a.sido as region,
              COUNT(DISTINCT s.id)::bigint as count,
              COUNT(DISTINCT CASE WHEN a.category_1 = '구비의무기관' THEN s.id END)::bigint as mandatory_count,
              COUNT(DISTINCT CASE WHEN a.category_1 != '구비의무기관' THEN s.id END)::bigint as non_mandatory_count
            FROM aedpics.inspection_schedule_entries s
            INNER JOIN aedpics.aed_data a ON s.device_equipment_serial = a.equipment_serial
            GROUP BY a.sido
          `;
        }
      } catch (error) {
        logger.error('dashboard-queries', 'Failed to fetch schedule counts', { error });
        // 일정추가 건수 조회 실패 시 빈 배열 사용
        scheduleCounts = [];
      }

      // 외부표출 차단(blocked) AED의 일정추가 건수 조회
      let blockedScheduleCounts: Array<{
        region: string;
        count: bigint;
      }> = [];

      try {
        if (normalizedGugun && normalizedGugun !== '전체' && normalizedSido && normalizedSido !== '전체') {
          blockedScheduleCounts = await prisma.$queryRaw`
            SELECT
              a.gugun as region,
              COUNT(DISTINCT s.id)::bigint as count
            FROM aedpics.inspection_schedule_entries s
            INNER JOIN aedpics.aed_data a ON s.device_equipment_serial = a.equipment_serial
            WHERE a.sido = ${normalizedSido} AND a.gugun = ${normalizedGugun} AND a.external_display = 'N'
            GROUP BY a.gugun
          `;
        } else if (normalizedSido && normalizedSido !== '전체') {
          blockedScheduleCounts = await prisma.$queryRaw`
            SELECT
              a.gugun as region,
              COUNT(DISTINCT s.id)::bigint as count
            FROM aedpics.inspection_schedule_entries s
            INNER JOIN aedpics.aed_data a ON s.device_equipment_serial = a.equipment_serial
            WHERE a.sido = ${normalizedSido} AND a.external_display = 'N'
            GROUP BY a.gugun
          `;
        } else {
          blockedScheduleCounts = await prisma.$queryRaw`
            SELECT
              a.sido as region,
              COUNT(DISTINCT s.id)::bigint as count
            FROM aedpics.inspection_schedule_entries s
            INNER JOIN aedpics.aed_data a ON s.device_equipment_serial = a.equipment_serial
            WHERE a.external_display = 'N'
            GROUP BY a.sido
          `;
        }
      } catch (error) {
        logger.error('dashboard-queries', 'Failed to fetch blocked schedule counts', { error });
        blockedScheduleCounts = [];
      }

      // 외부표출 차단(blocked) AED의 현장점검 건수 조회
      let blockedInspectionCounts: Array<{
        region: string;
        count: bigint;
      }> = [];

      try {
        if (normalizedGugun && normalizedGugun !== '전체' && normalizedSido && normalizedSido !== '전체') {
          blockedInspectionCounts = await prisma.$queryRaw`
            SELECT
              a.gugun as region,
              COUNT(DISTINCT i.id)::bigint as count
            FROM aedpics.inspections i
            INNER JOIN aedpics.aed_data a ON i.equipment_serial = a.equipment_serial
            WHERE a.sido = ${normalizedSido} AND a.gugun = ${normalizedGugun} AND a.external_display = 'N'
            GROUP BY a.gugun
          `;
        } else if (normalizedSido && normalizedSido !== '전체') {
          blockedInspectionCounts = await prisma.$queryRaw`
            SELECT
              a.gugun as region,
              COUNT(DISTINCT i.id)::bigint as count
            FROM aedpics.inspections i
            INNER JOIN aedpics.aed_data a ON i.equipment_serial = a.equipment_serial
            WHERE a.sido = ${normalizedSido} AND a.external_display = 'N'
            GROUP BY a.gugun
          `;
        } else {
          blockedInspectionCounts = await prisma.$queryRaw`
            SELECT
              a.sido as region,
              COUNT(DISTINCT i.id)::bigint as count
            FROM aedpics.inspections i
            INNER JOIN aedpics.aed_data a ON i.equipment_serial = a.equipment_serial
            WHERE a.external_display = 'N'
            GROUP BY a.sido
          `;
        }
      } catch (error) {
        logger.error('dashboard-queries', 'Failed to fetch blocked inspection counts', { error });
        blockedInspectionCounts = [];
      }

      // 미점검(uninspected) AED의 일정추가 건수 조회
      let uninspectedScheduleCounts: Array<{
        region: string;
        count: bigint;
      }> = [];

      try {
        if (normalizedGugun && normalizedGugun !== '전체' && normalizedSido && normalizedSido !== '전체') {
          uninspectedScheduleCounts = await prisma.$queryRaw`
            SELECT
              a.gugun as region,
              COUNT(DISTINCT s.id)::bigint as count
            FROM aedpics.inspection_schedule_entries s
            INNER JOIN aedpics.aed_data a ON s.device_equipment_serial = a.equipment_serial
            WHERE a.sido = ${normalizedSido} AND a.gugun = ${normalizedGugun} AND a.last_inspection_date IS NULL
            GROUP BY a.gugun
          `;
        } else if (normalizedSido && normalizedSido !== '전체') {
          uninspectedScheduleCounts = await prisma.$queryRaw`
            SELECT
              a.gugun as region,
              COUNT(DISTINCT s.id)::bigint as count
            FROM aedpics.inspection_schedule_entries s
            INNER JOIN aedpics.aed_data a ON s.device_equipment_serial = a.equipment_serial
            WHERE a.sido = ${normalizedSido} AND a.last_inspection_date IS NULL
            GROUP BY a.gugun
          `;
        } else {
          uninspectedScheduleCounts = await prisma.$queryRaw`
            SELECT
              a.sido as region,
              COUNT(DISTINCT s.id)::bigint as count
            FROM aedpics.inspection_schedule_entries s
            INNER JOIN aedpics.aed_data a ON s.device_equipment_serial = a.equipment_serial
            WHERE a.last_inspection_date IS NULL
            GROUP BY a.sido
          `;
        }
      } catch (error) {
        logger.error('dashboard-queries', 'Failed to fetch uninspected schedule counts', { error });
        uninspectedScheduleCounts = [];
      }

      // 미점검(uninspected) AED의 현장점검 건수 조회
      let uninspectedInspectionCounts: Array<{
        region: string;
        count: bigint;
      }> = [];

      try {
        if (normalizedGugun && normalizedGugun !== '전체' && normalizedSido && normalizedSido !== '전체') {
          uninspectedInspectionCounts = await prisma.$queryRaw`
            SELECT
              a.gugun as region,
              COUNT(DISTINCT i.id)::bigint as count
            FROM aedpics.inspections i
            INNER JOIN aedpics.aed_data a ON i.equipment_serial = a.equipment_serial
            WHERE a.sido = ${normalizedSido} AND a.gugun = ${normalizedGugun} AND a.last_inspection_date IS NULL
            GROUP BY a.gugun
          `;
        } else if (normalizedSido && normalizedSido !== '전체') {
          uninspectedInspectionCounts = await prisma.$queryRaw`
            SELECT
              a.gugun as region,
              COUNT(DISTINCT i.id)::bigint as count
            FROM aedpics.inspections i
            INNER JOIN aedpics.aed_data a ON i.equipment_serial = a.equipment_serial
            WHERE a.sido = ${normalizedSido} AND a.last_inspection_date IS NULL
            GROUP BY a.gugun
          `;
        } else {
          uninspectedInspectionCounts = await prisma.$queryRaw`
            SELECT
              a.sido as region,
              COUNT(DISTINCT i.id)::bigint as count
            FROM aedpics.inspections i
            INNER JOIN aedpics.aed_data a ON i.equipment_serial = a.equipment_serial
            WHERE a.last_inspection_date IS NULL
            GROUP BY a.sido
          `;
        }
      } catch (error) {
        logger.error('dashboard-queries', 'Failed to fetch uninspected inspection counts', { error });
        uninspectedInspectionCounts = [];
      }

      // 점검 불가(unavailable) 건수 조회 (inspection_assignments 테이블 - 의무기관/비의무기관 구분)
      let unavailableCounts: Array<{
        region: string;
        count: bigint;
        mandatory_count: bigint;
        non_mandatory_count: bigint;
      }> = [];

      try {
        if (normalizedGugun && normalizedGugun !== '전체' && normalizedSido && normalizedSido !== '전체') {
          // 특정 구군의 불가 건수
          unavailableCounts = await prisma.$queryRaw`
            SELECT
              a.gugun as region,
              COUNT(DISTINCT ia.id)::bigint as count,
              COUNT(DISTINCT CASE WHEN a.category_1 = '구비의무기관' THEN ia.id END)::bigint as mandatory_count,
              COUNT(DISTINCT CASE WHEN a.category_1 != '구비의무기관' THEN ia.id END)::bigint as non_mandatory_count
            FROM aedpics.inspection_assignments ia
            INNER JOIN aedpics.aed_data a ON ia.equipment_serial = a.equipment_serial
            WHERE ia.status = 'unavailable' AND a.sido = ${normalizedSido} AND a.gugun = ${normalizedGugun}
            GROUP BY a.gugun
          `;
        } else if (normalizedSido && normalizedSido !== '전체') {
          // 특정 시도의 구군별 불가 건수
          unavailableCounts = await prisma.$queryRaw`
            SELECT
              a.gugun as region,
              COUNT(DISTINCT ia.id)::bigint as count,
              COUNT(DISTINCT CASE WHEN a.category_1 = '구비의무기관' THEN ia.id END)::bigint as mandatory_count,
              COUNT(DISTINCT CASE WHEN a.category_1 != '구비의무기관' THEN ia.id END)::bigint as non_mandatory_count
            FROM aedpics.inspection_assignments ia
            INNER JOIN aedpics.aed_data a ON ia.equipment_serial = a.equipment_serial
            WHERE ia.status = 'unavailable' AND a.sido = ${normalizedSido}
            GROUP BY a.gugun
          `;
        } else {
          // 전국 시도별 불가 건수
          unavailableCounts = await prisma.$queryRaw`
            SELECT
              a.sido as region,
              COUNT(DISTINCT ia.id)::bigint as count,
              COUNT(DISTINCT CASE WHEN a.category_1 = '구비의무기관' THEN ia.id END)::bigint as mandatory_count,
              COUNT(DISTINCT CASE WHEN a.category_1 != '구비의무기관' THEN ia.id END)::bigint as non_mandatory_count
            FROM aedpics.inspection_assignments ia
            INNER JOIN aedpics.aed_data a ON ia.equipment_serial = a.equipment_serial
            WHERE ia.status = 'unavailable'
            GROUP BY a.sido
          `;
        }
      } catch (error) {
        logger.error('dashboard-queries', 'Failed to fetch unavailable counts', { error });
        unavailableCounts = [];
      }

      // 점검 건수를 Map으로 변환 (빠른 조회)
      const inspectionCountMap = new Map(
        inspectionCounts.map(ic => [
          ic.region,
          {
            total: Number(ic.count),
            mandatory: Number(ic.mandatory_count),
            nonMandatory: Number(ic.non_mandatory_count)
          }
        ])
      );

      // 일정추가 건수를 Map으로 변환 (빠른 조회)
      const scheduleCountMap = new Map(
        scheduleCounts.map(sc => [
          sc.region,
          {
            total: Number(sc.count),
            mandatory: Number(sc.mandatory_count),
            nonMandatory: Number(sc.non_mandatory_count)
          }
        ])
      );

      // blocked 일정추가 건수를 Map으로 변환
      const blockedScheduleCountMap = new Map(
        blockedScheduleCounts.map(bsc => [bsc.region, Number(bsc.count)])
      );

      // blocked 현장점검 건수를 Map으로 변환
      const blockedInspectionCountMap = new Map(
        blockedInspectionCounts.map(bic => [bic.region, Number(bic.count)])
      );

      // uninspected 일정추가 건수를 Map으로 변환
      const uninspectedScheduleCountMap = new Map(
        uninspectedScheduleCounts.map(usc => [usc.region, Number(usc.count)])
      );

      // uninspected 현장점검 건수를 Map으로 변환
      const uninspectedInspectionCountMap = new Map(
        uninspectedInspectionCounts.map(uic => [uic.region, Number(uic.count)])
      );

      // unavailable 건수를 Map으로 변환 (의무기관/비의무기관 구분)
      const unavailableCountMap = new Map(
        unavailableCounts.map(ac => [
          ac.region,
          {
            total: Number(ac.count),
            mandatory: Number(ac.mandatory_count),
            nonMandatory: Number(ac.non_mandatory_count)
          }
        ])
      );

      const regionStats: RegionStats[] = aggregatedStats.map((stat) => {
        const total = Number(stat.total);
        const mandatory = Number(stat.mandatory);
        const completed = Number(stat.completed);
        const blocked = Number(stat.blocked);
        const uninspected = Number(stat.uninspected);
        const completedMandatory = Number(stat.completed_mandatory);
        const nonMandatory = total - mandatory;
        const completedNonMandatory = completed - completedMandatory;

        // 실제 점검 건수 조회 (의무기관/비의무기관 구분)
        const inspectionData = inspectionCountMap.get(stat.region) || { total: 0, mandatory: 0, nonMandatory: 0 };
        const fieldInspected = inspectionData.total;
        const fieldInspectedMandatory = inspectionData.mandatory;
        const fieldInspectedNonMandatory = inspectionData.nonMandatory;

        // 일정추가 건수 조회 (의무기관/비의무기관 구분)
        const scheduleData = scheduleCountMap.get(stat.region) || { total: 0, mandatory: 0, nonMandatory: 0 };
        const assigned = scheduleData.total;
        const assignedMandatory = scheduleData.mandatory;
        const assignedNonMandatory = scheduleData.nonMandatory;

        // blocked 관련 건수 조회
        const blockedAssigned = blockedScheduleCountMap.get(stat.region) || 0;
        const blockedFieldInspected = blockedInspectionCountMap.get(stat.region) || 0;

        // uninspected 관련 건수 조회
        const uninspectedAssigned = uninspectedScheduleCountMap.get(stat.region) || 0;
        const uninspectedFieldInspected = uninspectedInspectionCountMap.get(stat.region) || 0;

        // unavailable 관련 건수 조회 (의무기관/비의무기관 구분)
        const unavailableData = unavailableCountMap.get(stat.region) || { total: 0, mandatory: 0, nonMandatory: 0 };
        const unavailable = unavailableData.total;
        const unavailableMandatory = unavailableData.mandatory;
        const unavailableNonMandatory = unavailableData.nonMandatory;

        return {
          region: stat.region || '알 수 없음',
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
          blockedAssigned,
          blockedFieldInspected,
          uninspected,
          uninspectedMandatory: mandatory - completedMandatory,
          uninspectedNonMandatory: nonMandatory - completedNonMandatory,
          uninspectedAssigned,
          uninspectedFieldInspected,
          fieldInspected,
          fieldInspectedMandatory,
          fieldInspectedNonMandatory,
          assigned,
          assignedMandatory,
          assignedNonMandatory,
          unavailable,
          unavailableMandatory,
          unavailableNonMandatory,
          rate: total > 0 ? (completed / total) * 100 : 0
        };
      });

      const totalAED = regionStats.reduce((sum, r) => sum + r.total, 0);
      const totalCompleted = regionStats.reduce((sum, r) => sum + r.completed, 0);

      let title = '전국 시도별 AED 점검 현황';
      if (normalizedGugun && normalizedGugun !== '전체') {
        title = `${normalizedGugun} AED 점검 현황`;
      } else if (normalizedSido && normalizedSido !== '전체') {
        title = `${normalizedSido} 전체 AED 점검 현황`;
      }

      return {
        title,
        data: regionStats,
        totalAED,
        totalCompleted,
        totalUrgent: 0,
        completionRate: totalAED > 0 ? (totalCompleted / totalAED) * 100 : 0
      };
    } else {
      // 지역별 상세 통계
      const regionWhere: any = {};
      if (selectedGugun && selectedGugun !== '전체') {
        regionWhere.gugun = selectedGugun;
      } else if (selectedSido) {
        regionWhere.sido = selectedSido;
      } else if (userProfile.region) {
        regionWhere.sido = userProfile.region;
      }

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
          category_1: MANDATORY_CATEGORY
        }
      });

      const completedMandatory = await prisma.aed_data.count({
        where: {
          ...regionWhere,
          category_1: MANDATORY_CATEGORY,
          last_inspection_date: { not: null }
        }
      });

      const regionStat: RegionStats = {
        region: selectedGugun || selectedSido || userProfile.region || '전체',
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
        blockedAssigned: 0,
        blockedFieldInspected: 0,
        uninspected: total - completed,
        uninspectedMandatory: mandatory - completedMandatory,
        uninspectedNonMandatory: (total - mandatory) - (completed - completedMandatory),
        uninspectedAssigned: 0,
        uninspectedFieldInspected: 0,
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
        title: `${selectedGugun || selectedSido || userProfile.region || '지역'} AED 점검 현황`,
        data: [regionStat],
        totalAED: total,
        totalCompleted: completed,
        totalUrgent: 0,
        completionRate: total > 0 ? (completed / total) * 100 : 0
      };
    }
  } catch (error) {
    logger.error('DashboardQueries:getCachedDashboardData', 'Dashboard data query error', error instanceof Error ? error : { error });

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
 * 시간별 점검 통계 (Prisma 버전) - 지역 필터링 지원
 */
export const getCachedHourlyInspections = cache(async (
  userProfile: UserProfile,
  dateRange?: 'all' | 'today' | 'this_week' | 'this_month' | 'last_month',
  selectedSido?: string,
  selectedGugun?: string
): Promise<any[]> => {
  try {
    const { startDate, endDate } = getDateRangeForFilter(dateRange || 'all');

    // 지역 필터링을 위한 조건 구성
    const normalizedSido = selectedSido ? normalizeRegionName(selectedSido) : selectedSido;
    const normalizedGugun = selectedGugun ? normalizeRegionName(selectedGugun) : selectedGugun;

    // 1. 해당 지역의 AED equipment_serial 목록 조회
    let equipmentSerials: string[] = [];

    if (normalizedGugun && normalizedGugun !== '전체' && normalizedSido && normalizedSido !== '전체') {
      // 특정 구군
      const aeds = await prisma.aed_data.findMany({
        where: {
          sido: normalizedSido,
          gugun: normalizedGugun
        },
        select: { equipment_serial: true }
      });
      equipmentSerials = aeds.map(aed => aed.equipment_serial);
    } else if (normalizedSido && normalizedSido !== '전체' && normalizedSido !== '시도') {
      // 특정 시도
      const aeds = await prisma.aed_data.findMany({
        where: { sido: normalizedSido },
        select: { equipment_serial: true }
      });
      equipmentSerials = aeds.map(aed => aed.equipment_serial);
    }

    // 2. 점검 데이터 조회 (지역 필터링 적용)
    const whereClause: any = {};

    // startDate/endDate가 null이 아닐 때만 created_at 필터 적용 ('all' 옵션일 때 null)
    if (startDate !== null && endDate !== null) {
      whereClause.created_at = {
        gte: startDate,
        lte: endDate
      };
    }

    if (equipmentSerials.length > 0) {
      whereClause.equipment_serial = { in: equipmentSerials };
    }

    const inspections = await prisma.inspections.findMany({
      where: whereClause,
      select: {
        created_at: true
      }
    });

    // 시간별 집계 (KST 기준)
    const hourlyData = Array(24).fill(null).map((_, hour) => ({
      hour: `${hour}시`,
      count: 0
    }));

    const kstOffset = 9 * 60 * 60 * 1000; // 9시간을 밀리초로
    inspections.forEach(inspection => {
      if (inspection.created_at) {
        // KST(UTC+9) 기준으로 시간 추출
        const inspectionTime = new Date(inspection.created_at).getTime();
        const kstTime = new Date(inspectionTime + kstOffset);
        const hour = kstTime.getUTCHours();
        hourlyData[hour].count++;
      }
    });

    return hourlyData;
  } catch (error) {
    logger.error('DashboardQueries:getCachedHourlyInspections', 'Hourly inspections query error', error instanceof Error ? error : { error });
    return Array(24).fill(null).map((_, hour) => ({
      hour: `${hour}시`,
      count: 0
    }));
  }
});

/**
 * 일별 점검 통계 (Prisma 버전) - 지역 필터링 지원
 */
export const getCachedDailyInspections = cache(async (
  userProfile: UserProfile,
  dateRange?: 'all' | 'today' | 'this_week' | 'this_month' | 'last_month',
  selectedSido?: string,
  selectedGugun?: string
): Promise<any[]> => {
  try {
    const { startDate, endDate } = getDateRangeForFilter(dateRange || 'all');

    // 지역 필터링을 위한 조건 구성
    const normalizedSido = selectedSido ? normalizeRegionName(selectedSido) : selectedSido;
    const normalizedGugun = selectedGugun ? normalizeRegionName(selectedGugun) : selectedGugun;

    // 1. 해당 지역의 AED equipment_serial 목록 조회
    let equipmentSerials: string[] = [];

    if (normalizedGugun && normalizedGugun !== '전체' && normalizedSido && normalizedSido !== '전체') {
      // 특정 구군
      const aeds = await prisma.aed_data.findMany({
        where: {
          sido: normalizedSido,
          gugun: normalizedGugun
        },
        select: { equipment_serial: true }
      });
      equipmentSerials = aeds.map(aed => aed.equipment_serial);
    } else if (normalizedSido && normalizedSido !== '전체' && normalizedSido !== '시도') {
      // 특정 시도
      const aeds = await prisma.aed_data.findMany({
        where: { sido: normalizedSido },
        select: { equipment_serial: true }
      });
      equipmentSerials = aeds.map(aed => aed.equipment_serial);
    }

    // 2. 점검 데이터 조회 (지역 필터링 적용)
    const whereClause: any = {};

    // startDate/endDate가 null이 아닐 때만 created_at 필터 적용 ('all' 옵션일 때 null)
    if (startDate !== null && endDate !== null) {
      whereClause.created_at = {
        gte: startDate,
        lte: endDate
      };
    }

    if (equipmentSerials.length > 0) {
      whereClause.equipment_serial = { in: equipmentSerials };
    }

    const inspections = await prisma.inspections.findMany({
      where: whereClause,
      select: {
        created_at: true
      }
    });

    // 날짜별 데이터 포맷 (KST 기준)
    const kstOffset = 9 * 60 * 60 * 1000; // 9시간을 밀리초로
    const dailyMap = new Map<string, number>();
    inspections.forEach(item => {
      if (item.created_at) {
        // KST(UTC+9) 기준으로 날짜 추출
        const inspectionTime = new Date(item.created_at).getTime();
        const kstDate = new Date(inspectionTime + kstOffset);
        const dateStr = kstDate.toISOString().split('T')[0];
        dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + 1);
      }
    });

    // 날짜 범위에 맞는 데이터 생성 (KST 기준)
    const dailyData = [];
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    for (let i = 0; i <= daysDiff; i++) {
      const date = new Date(startDate.getTime() + kstOffset);
      date.setUTCDate(date.getUTCDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dayLabel = `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;

      dailyData.push({
        day: dayLabel,
        count: dailyMap.get(dateStr) || 0
      });
    }

    return dailyData;
  } catch (error) {
    logger.error('DashboardQueries:getCachedDailyInspections', 'Daily inspections query error', error instanceof Error ? error : { error });

    // 에러 시 빈 데이터 반환 (KST 기준)
    const { startDate, endDate } = getDateRangeForFilter(dateRange || 'all');
    const kstOffset = 9 * 60 * 60 * 1000;
    const dailyData = [];
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    for (let i = 0; i <= daysDiff; i++) {
      const date = new Date(startDate.getTime() + kstOffset);
      date.setUTCDate(date.getUTCDate() + i);
      const dayLabel = `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;

      dailyData.push({
        day: dayLabel,
        count: 0
      });
    }
    return dailyData;
  }
});