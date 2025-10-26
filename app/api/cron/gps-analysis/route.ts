import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  // Vercel Cron Job 인증 확인
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    console.log('[GPS Analysis Cron] 분석 시작:', new Date().toISOString());

    // 1. AED 데이터 가져오기
    const aedData = await prisma.aed_data.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
    });

    if (!aedData || aedData.length === 0) {
      return NextResponse.json({
        success: true,
        message: '분석할 데이터 없음',
        analyzed: 0
      });
    }

    // 2. GPS 이상 분석
    interface GpsIssue {
      aed_data_id: number;
      management_number: string;
      issue_type: string;
      severity: string;
      description: string;
      detected_lat: number;
      detected_lng: number;
      expected_lat?: number;
      expected_lng?: number;
      metadata: Record<string, unknown>;
    }
    const issues: GpsIssue[] = [];
    const DEFAULT_COORDS = [
      { lat: 37.5677264605676, lng: 127.005484601979 },
      { lat: 37.5665, lng: 127.0784 },
      { lat: 37.5665, lng: 126.9780 },
      { lat: 35.1796, lng: 129.0756 },
      { lat: 33.4996, lng: 126.5312 }
    ];

    for (const device of aedData) {
      const { id, management_number, latitude, longitude, sido, gugun, installation_address } = device;

      // 디폴트 좌표 검사
      for (const defaultCoord of DEFAULT_COORDS) {
        if (Math.abs(latitude - defaultCoord.lat) < 0.0001 &&
            Math.abs(longitude - defaultCoord.lng) < 0.0001) {
          issues.push({
            aed_data_id: id,
            management_number,
            issue_type: 'default_coord',
            severity: 'critical',
            description: '디폴트 좌표가 설정되어 있습니다',
            detected_lat: latitude,
            detected_lng: longitude,
            metadata: { default_name: '메인 디폴트' }
          });
          break;
        }
      }

      // 시도 범위 검사
      const regionBounds: { [key: string]: { min_lat: number; max_lat: number; min_lng: number; max_lng: number } } = {
        '서울': { min_lat: 37.42, max_lat: 37.70, min_lng: 126.76, max_lng: 127.20 },
        '부산': { min_lat: 35.05, max_lat: 35.33, min_lng: 128.85, max_lng: 129.28 },
        '제주': { min_lat: 33.20, max_lat: 33.57, min_lng: 126.15, max_lng: 126.95 },
        '경기': { min_lat: 36.89, max_lat: 38.30, min_lng: 126.38, max_lng: 127.83 },
        '강원': { min_lat: 37.02, max_lat: 38.63, min_lng: 127.09, max_lng: 129.37 }
      };

      const sidoPrefix = sido?.substring(0, 2);
      if (sidoPrefix && regionBounds[sidoPrefix]) {
        const bounds = regionBounds[sidoPrefix];
        if (latitude < bounds.min_lat || latitude > bounds.max_lat ||
            longitude < bounds.min_lng || longitude > bounds.max_lng) {
          issues.push({
            aed_data_id: id,
            management_number,
            issue_type: 'address_mismatch',
            severity: 'high',
            description: `${sido} 지역 범위를 벗어난 좌표`,
            detected_lat: latitude,
            detected_lng: longitude,
            expected_lat: (bounds.min_lat + bounds.max_lat) / 2,
            expected_lng: (bounds.min_lng + bounds.max_lng) / 2,
            metadata: { sido, gugun, address: installation_address }
          });
        }
      }
    }

    // 3. 클러스터 검사 (같은 좌표에 여러 AED)
    interface AedDevice {
      id: number;
      management_number: string;
      latitude: number;
      longitude: number;
    }
    const coordMap = new Map<string, AedDevice[]>();
    for (const device of aedData) {
      const key = `${device.latitude.toFixed(4)},${device.longitude.toFixed(4)}`;
      if (!coordMap.has(key)) {
        coordMap.set(key, []);
      }
      coordMap.get(key)!.push(device);
    }

    for (const [coord, devices] of coordMap.entries()) {
      if (devices.length >= 10) {
        const [lat, lng] = coord.split(',').map(Number);
        for (const device of devices) {
          issues.push({
            aed_data_id: device.id,
            management_number: device.management_number,
            issue_type: 'cluster',
            severity: devices.length >= 20 ? 'high' : 'medium',
            description: `${devices.length}개의 AED가 같은 좌표에 위치`,
            detected_lat: lat,
            detected_lng: lng,
            metadata: {
              cluster_size: devices.length,
              other_devices: devices.map((d) => d.management_number)
            }
          });
        }
      }
    }

    // 4. 기존 이슈 삭제 (오늘 날짜)
    const today = new Date().toISOString().split('T')[0];
    const todayStart = new Date(today + 'T00:00:00Z');
    const todayEnd = new Date(today + 'T23:59:59Z');

    try {
      await prisma.gps_issues.deleteMany({
        where: {
          created_at: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      });
    } catch (deleteError) {
      console.error('기존 이슈 삭제 실패:', deleteError);
    }

    // 5. 새로운 이슈 저장
    if (issues.length > 0) {
      await prisma.gps_issues.createMany({
        data: issues,
      });
    }

    // 6. 분석 로그 저장
    await prisma.gps_analysis_logs.create({
      data: {
        analysis_date: new Date(today),
        total_records: aedData.length,
        issues_found: issues.length,
        default_coordinates: issues.filter(i => i.issue_type === 'default_coord').length,
        address_mismatch: issues.filter(i => i.issue_type === 'address_mismatch').length,
        outliers: issues.filter(i => i.issue_type === 'outlier').length,
        duplicate_coordinates: 0,
        clusters: issues.filter(i => i.issue_type === 'cluster').length,
        execution_time_ms: 0,
        status: 'success',
      },
    });

    console.log('[GPS Analysis Cron] 분석 완료:', {
      total: aedData.length,
      issues: issues.length,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      analyzed: aedData.length,
      issues_found: issues.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[GPS Analysis Cron] 오류:', error);

    // 오류 로그 저장
    await prisma.gps_analysis_logs.create({
      data: {
        analysis_date: new Date(new Date().toISOString().split('T')[0]),
        total_records: 0,
        issues_found: 0,
        default_coordinates: 0,
        address_mismatch: 0,
        outliers: 0,
        duplicate_coordinates: 0,
        clusters: 0,
        execution_time_ms: 0,
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return NextResponse.json(
      {
        error: 'GPS 분석 실패',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}