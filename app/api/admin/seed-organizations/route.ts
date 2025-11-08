import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
/**
 * Organizations 데이터 자동 시딩 API
 *
 * 사용법: POST /api/admin/seed-organizations
 * 권한: Master 또는 Emergency Center Admin만 실행 가능
 */

import { NextRequest, NextResponse } from 'next/server';
import { hasSystemAdminAccess } from '@/lib/auth/permissions';
import { randomUUID } from 'crypto';
import { mapGugunToCityCode } from '@/lib/constants/regions';
import { validateAndNormalizeCityCode } from '@/lib/api/validation';

import { prisma } from '@/lib/prisma';
// 서울 보건소 데이터
const SEOUL_HEALTH_CENTERS = [
  { name: '서울특별시 강남구보건소', region: '서울', region_code: 'SEO', city_code: '강남구', contact_phone: '02-3423-7200', address: '서울특별시 강남구 선릉로 668' },
  { name: '서울특별시 강동구보건소', region: '서울', region_code: 'SEO', city_code: '강동구', contact_phone: '02-3425-8500', address: '서울특별시 강동구 성내로 45' },
  { name: '서울특별시 강북구보건소', region: '서울', region_code: 'SEO', city_code: '강북구', contact_phone: '02-901-7600', address: '서울특별시 강북구 한천로 897' },
  { name: '서울특별시 강서구보건소', region: '서울', region_code: 'SEO', city_code: '강서구', contact_phone: '02-2600-5800', address: '서울특별시 강서구 공항대로 561' },
  { name: '서울특별시 관악구보건소', region: '서울', region_code: 'SEO', city_code: '관악구', contact_phone: '02-879-7010', address: '서울특별시 관악구 관악로 145' },
  { name: '서울특별시 광진구보건소', region: '서울', region_code: 'SEO', city_code: '광진구', contact_phone: '02-450-1570', address: '서울특별시 광진구 자양로 117' },
  { name: '서울특별시 구로구보건소', region: '서울', region_code: 'SEO', city_code: '구로구', contact_phone: '02-860-3200', address: '서울특별시 구로구 구로중앙로 28길 66' },
  { name: '서울특별시 금천구보건소', region: '서울', region_code: 'SEO', city_code: '금천구', contact_phone: '02-2627-2114', address: '서울특별시 금천구 시흥대로73길 70' },
  { name: '서울특별시 노원구보건소', region: '서울', region_code: 'SEO', city_code: '노원구', contact_phone: '02-2116-3115', address: '서울특별시 노원구 노해로 437' },
  { name: '서울특별시 도봉구보건소', region: '서울', region_code: 'SEO', city_code: '도봉구', contact_phone: '02-2091-4600', address: '서울특별시 도봉구 방학로3길 117' },
  { name: '서울특별시 동대문구보건소', region: '서울', region_code: 'SEO', city_code: '동대문구', contact_phone: '02-2127-5000', address: '서울특별시 동대문구 홍릉로 81' },
  { name: '서울특별시 동작구보건소', region: '서울', region_code: 'SEO', city_code: '동작구', contact_phone: '02-820-1423', address: '서울특별시 동작구 장승배기로10길 42' },
  { name: '서울특별시 마포구보건소', region: '서울', region_code: 'SEO', city_code: '마포구', contact_phone: '02-3153-9020', address: '서울특별시 마포구 월드컵로 212' },
  { name: '서울특별시 서대문구보건소', region: '서울', region_code: 'SEO', city_code: '서대문구', contact_phone: '02-330-1801', address: '서울특별시 서대문구 연희로 242' },
  { name: '서울특별시 서초구보건소', region: '서울', region_code: 'SEO', city_code: '서초구', contact_phone: '02-2155-8000', address: '서울특별시 서초구 남부순환로 2584' },
  { name: '서울특별시 성동구보건소', region: '서울', region_code: 'SEO', city_code: '성동구', contact_phone: '02-2286-7000', address: '서울특별시 성동구 마장로 23길 10' },
  { name: '서울특별시 성북구보건소', region: '서울', region_code: 'SEO', city_code: '성북구', contact_phone: '02-2241-1740', address: '서울특별시 성북구 화랑로 63' },
  { name: '서울특별시 송파구보건소', region: '서울', region_code: 'SEO', city_code: '송파구', contact_phone: '02-2147-3420', address: '서울특별시 송파구 올림픽로 326' },
  { name: '서울특별시 양천구보건소', region: '서울', region_code: 'SEO', city_code: '양천구', contact_phone: '02-2620-3114', address: '서울특별시 양천구 목동동로 105' },
  { name: '서울특별시 영등포구보건소', region: '서울', region_code: 'SEO', city_code: '영등포구', contact_phone: '02-2670-3114', address: '서울특별시 영등포구 당산로 123' },
  { name: '서울특별시 용산구보건소', region: '서울', region_code: 'SEO', city_code: '용산구', contact_phone: '02-2199-8090', address: '서울특별시 용산구 녹사평대로 150' },
  { name: '서울특별시 은평구보건소', region: '서울', region_code: 'SEO', city_code: '은평구', contact_phone: '02-351-8114', address: '서울특별시 은평구 은평로 195' },
  { name: '서울특별시 종로구보건소', region: '서울', region_code: 'SEO', city_code: '종로구', contact_phone: '02-2148-3500', address: '서울특별시 종로구 자하문로19길 36' },
  { name: '서울특별시 중구보건소', region: '서울', region_code: 'SEO', city_code: '중구', contact_phone: '02-3396-4000', address: '서울특별시 중구 다산로 39길 16' },
  { name: '서울특별시 중랑구보건소', region: '서울', region_code: 'SEO', city_code: '중랑구', contact_phone: '02-2094-0700', address: '서울특별시 중랑구 봉화산로 179' },
];

// 부산 보건소 데이터
const BUSAN_HEALTH_CENTERS = [
  { name: '부산광역시 중구보건소', region: '부산', region_code: 'BUS', city_code: '중구', contact_phone: '051-600-4741', address: '부산광역시 중구 중구로 120' },
  { name: '부산광역시 서구보건소', region: '부산', region_code: 'BUS', city_code: '서구', contact_phone: '051-240-4000', address: '부산광역시 서구 부용로 30' },
  { name: '부산광역시 동구보건소', region: '부산', region_code: 'BUS', city_code: '동구', contact_phone: '051-440-4000', address: '부산광역시 동구 구청로1' },
  { name: '부산광역시 영도구보건소', region: '부산', region_code: 'BUS', city_code: '영도구', contact_phone: '051-419-4000', address: '부산광역시 영도구 태종로 423' },
  { name: '부산광역시 부산진구보건소', region: '부산', region_code: 'BUS', city_code: '부산진구', contact_phone: '051-605-6000', address: '부산광역시 부산진구 시민공원로 51' },
  { name: '부산광역시 동래구보건소', region: '부산', region_code: 'BUS', city_code: '동래구', contact_phone: '051-550-6800', address: '부산광역시 동래구 명륜로94번길 28' },
  { name: '부산광역시 남구보건소', region: '부산', region_code: 'BUS', city_code: '남구', contact_phone: '051-607-6400', address: '부산광역시 남구 유엔로 110' },
  { name: '부산광역시 북구보건소', region: '부산', region_code: 'BUS', city_code: '북구', contact_phone: '051-309-4000', address: '부산광역시 북구 낙동대로1570번길 33' },
  { name: '부산광역시 해운대구보건소', region: '부산', region_code: 'BUS', city_code: '해운대구', contact_phone: '051-749-7500', address: '부산광역시 해운대구 해운대로 452' },
  { name: '부산광역시 사하구보건소', region: '부산', region_code: 'BUS', city_code: '사하구', contact_phone: '051-220-5701', address: '부산광역시 사하구 당리로 59' },
];

// 대구 보건소 데이터
const DAEGU_HEALTH_CENTERS = [
  { name: '대구광역시 중구보건소', region: '대구', region_code: 'DAE', city_code: '중구', contact_phone: '053-661-3101', address: '대구광역시 중구 동덕로 117' },
  { name: '대구광역시 동구보건소', region: '대구', region_code: 'DAE', city_code: '동구', contact_phone: '053-662-3101', address: '대구광역시 동구 아양로 213' },
  { name: '대구광역시 서구보건소', region: '대구', region_code: 'DAE', city_code: '서구', contact_phone: '053-663-3101', address: '대구광역시 서구 국채보상로 257' },
  { name: '대구광역시 남구보건소', region: '대구', region_code: 'DAE', city_code: '남구', contact_phone: '053-664-3601', address: '대구광역시 남구 이천로 51' },
  { name: '대구광역시 북구보건소', region: '대구', region_code: 'DAE', city_code: '북구', contact_phone: '053-665-3101', address: '대구광역시 북구 연암로 40' },
  { name: '대구광역시 수성구보건소', region: '대구', region_code: 'DAE', city_code: '수성구', contact_phone: '053-666-3101', address: '대구광역시 수성구 달구벌대로 2423' },
  { name: '대구광역시 달서구보건소', region: '대구', region_code: 'DAE', city_code: '달서구', contact_phone: '053-667-5601', address: '대구광역시 달서구 학산로 45' },
  { name: '대구광역시 달성군보건소', region: '대구', region_code: 'DAE', city_code: '달성군', contact_phone: '053-668-3101', address: '대구광역시 달성군 논공읍 논공중앙로 43' },
];

const ALL_HEALTH_CENTERS = [
  ...SEOUL_HEALTH_CENTERS,
  ...BUSAN_HEALTH_CENTERS,
  ...DAEGU_HEALTH_CENTERS,
];

export async function POST(request: NextRequest) {
  try {
    // 현재 사용자 확인
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }

    // 현재 사용자의 프로필 조회
    const currentUserProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: { role: true, email: true },
    });

    if (!currentUserProfile) {
      return NextResponse.json(
        { error: '사용자 프로필을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 시스템 관리자 권한 확인
    if (!hasSystemAdminAccess(currentUserProfile.role)) {
      return NextResponse.json(
        { error: 'Organizations 데이터를 시딩할 권한이 없습니다. (Master 또는 Emergency Center Admin 필요)' },
        { status: 403 }
      );
    }

    // 기존 데이터 확인
    const existingCount = await prisma.organizations.count();

    console.log(`📊 기존 organizations 데이터: ${existingCount}개`);

    // 데이터 삽입 (createMany 사용)
    const organizationsToInsert = ALL_HEALTH_CENTERS.map(center => {
      // city_code 정규화 (한글 구군명 → city_code)
      const cityValidation = validateAndNormalizeCityCode(center.city_code);
      const normalizedCityCode = cityValidation.isValid
        ? cityValidation.normalizedCode
        : mapGugunToCityCode(center.city_code) || center.city_code;

      return {
        id: randomUUID(),
        name: center.name,
        city_code: normalizedCityCode,  // 정규화된 city_code 추가
        type: 'health_center',
        region_code: center.region_code,
        contact: center.contact_phone,
        address: center.address,
      };
    });

    const result = await prisma.organizations.createMany({
      data: organizationsToInsert as any,
      skipDuplicates: true, // 중복은 무시
    });

    // 최종 개수 확인
    const finalCount = await prisma.organizations.count();

    console.log(`✅ Organizations 시딩 완료: ${finalCount}개`);

    return NextResponse.json({
      success: true,
      message: 'Organizations 데이터가 성공적으로 시딩되었습니다.',
      data: {
        before: existingCount,
        after: finalCount,
        inserted: result.count,
      }
    });

  } catch (error) {
    console.error('❌ Seed organizations error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 현재 상태 확인용 GET 엔드포인트
export async function GET(request: NextRequest) {
  try {
    const count = await prisma.organizations.count();

    return NextResponse.json({
      count: count || 0,
      isEmpty: (count || 0) === 0,
      message: (count || 0) === 0
        ? 'Organizations 테이블이 비어있습니다. POST 요청으로 시딩해주세요.'
        : `Organizations 데이터 ${count}개가 존재합니다.`
    });

  } catch (error) {
    console.error('❌ Get organizations error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
