import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface SystemStats {
  totalDevices: number;
  totalHealthCenters: number;
  totalProvinces: number;
  monitoring: string;
  inspectionStats?: {
    inspected: number;
    overdue: number;
    completionRate: number;
  };
}

export async function getSystemStats(): Promise<SystemStats> {
  try {
    // AED 장비 총 대수
    const totalDevices = await prisma.aedDevice.count();

    // 보건소 수 (distinct health_center_name)
    const healthCenters = await prisma.aedDevice.findMany({
      where: {
        health_center_name: {
          not: null
        }
      },
      select: {
        health_center_name: true
      },
      distinct: ['health_center_name']
    });

    // 시도 수 (distinct sido)
    const provinces = await prisma.aedDevice.findMany({
      where: {
        sido: {
          not: null
        }
      },
      select: {
        sido: true
      },
      distinct: ['sido']
    });

    // 점검 현황 조회
    let inspectionStats;
    try {
      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [totalInspections, recentInspections] = await Promise.all([
        prisma.inspection.count(),
        prisma.inspection.count({
          where: {
            inspection_date: {
              gte: thirtyDaysAgo
            }
          }
        })
      ]);

      if (totalInspections > 0) {
        const inspected = recentInspections;
        const overdue = totalDevices - recentInspections;
        const completionRate = Math.round((inspected / totalDevices) * 100);

        inspectionStats = {
          inspected,
          overdue: Math.max(0, overdue),
          completionRate: Math.min(100, completionRate)
        };
      }
    } catch (inspectionError) {
      console.log('Inspection stats not available:', inspectionError);
    }

    return {
      totalDevices,
      totalHealthCenters: healthCenters.length,
      totalProvinces: provinces.length,
      monitoring: '24/7',
      inspectionStats
    };
  } catch (error) {
    console.error('Stats query error:', error);
    // 에러 시 기본값 반환
    return {
      totalDevices: 0,
      totalHealthCenters: 261,
      totalProvinces: 17,
      monitoring: '24/7'
    };
  }
}
