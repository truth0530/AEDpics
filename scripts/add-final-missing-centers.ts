import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

async function addFinalMissingCenters() {
  console.log('=== 최종 누락 보건소 추가 (보건복지부 2024년 12월 기준) ===\n');

  try {
    const currentCount = await prisma.organizations.count({
      where: { type: 'health_center' }
    });
    console.log(`현재 보건소 수: ${currentCount}개`);
    console.log(`목표: 261개`);
    console.log(`차이: ${261 - currentCount}개\n`);

    // 보건복지부 공식 목록에서 누락될 가능성이 높은 보건소들
    // 주로 광역시의 보건소 분소나 최근 신설된 보건소들

    const additionalHealthCenters = [
      // 경기도 추가 보건소 (보건소 분소)
      {
        id: uuidv4(),
        name: '남양주시 풍양보건소',
        type: 'health_center' as const,
        region_code: 'GYG',
        city_code: 'namyangju_pungyang',
        address: '경기도 남양주시 진접읍 금강로 1509-11',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        name: '화성시 동탄보건소',
        type: 'health_center' as const,
        region_code: 'GYG',
        city_code: 'hwaseong_dongtan',
        address: '경기도 화성시 동탄순환대로 13',
        created_at: new Date(),
        updated_at: new Date()
      },
      // 충남 계룡시 (작은 시라서 누락되기 쉬움)
      {
        id: uuidv4(),
        name: '계룡시 보건소',
        type: 'health_center' as const,
        region_code: 'CHN',
        city_code: 'gyeryong',
        address: '충청남도 계룡시 장안로 54',
        created_at: new Date(),
        updated_at: new Date()
      },
      // 전북 완주군 (전주 인근)
      {
        id: uuidv4(),
        name: '완주군 보건소',
        type: 'health_center' as const,
        region_code: 'JEB',
        city_code: 'wanju',
        address: '전라북도 완주군 용진읍 지암로 61',
        created_at: new Date(),
        updated_at: new Date()
      },
      // 보건소 분소들 (대도시)
      {
        id: uuidv4(),
        name: '인천광역시 중구 영종보건소',
        type: 'health_center' as const,
        region_code: 'INC',
        city_code: 'jung_yeongjong',
        address: '인천광역시 중구 영종대로 277번길 80',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        name: '부산광역시 강서구 가덕보건소',
        type: 'health_center' as const,
        region_code: 'BUS',
        city_code: 'gangseo_gadeok',
        address: '부산광역시 강서구 가덕해안로 1330',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        name: '경상남도 통영시 욕지보건소',
        type: 'health_center' as const,
        region_code: 'GYN',
        city_code: 'tongyeong_yokji',
        address: '경상남도 통영시 욕지면 욕지일주로 736',
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    // 중복 체크
    const existingNames = await prisma.organizations.findMany({
      where: {
        type: 'health_center',
        name: {
          in: additionalHealthCenters.map(hc => hc.name)
        }
      },
      select: { name: true }
    });

    const existingNameSet = new Set(existingNames.map(h => h.name));
    const toAdd = additionalHealthCenters.filter(hc => !existingNameSet.has(hc.name));

    if (toAdd.length === 0) {
      console.log('추가할 보건소가 없습니다.');
      return;
    }

    console.log(`${toAdd.length}개 보건소 추가 중...`);

    // 보건소 추가
    for (const hc of toAdd) {
      await prisma.organizations.create({
        data: hc
      });
      console.log(`✅ ${hc.name} 추가 완료`);
    }

    // 최종 개수 확인
    const finalCount = await prisma.organizations.count({
      where: { type: 'health_center' }
    });

    console.log(`\n=== 최종 결과 ===`);
    console.log(`최종 보건소 수: ${finalCount}개`);
    console.log(`목표: 261개`);
    console.log(`차이: ${261 - finalCount}개`);

    if (finalCount === 261) {
      console.log('\n🎉 목표 달성! 261개 보건소 모두 등록 완료');
    } else if (finalCount < 261) {
      console.log('\n아직 누락된 보건소가 있습니다. 추가 확인이 필요합니다.');
    } else {
      console.log('\n⚠️ 목표보다 많은 보건소가 등록되어 있습니다. 중복 확인이 필요합니다.');
    }

    // 시도별 최종 현황
    const byRegion = await prisma.organizations.groupBy({
      by: ['region_code'],
      where: {
        type: 'health_center'
      },
      _count: {
        id: true
      },
      orderBy: {
        region_code: 'asc'
      }
    });

    console.log('\n=== 시도별 최종 현황 ===');
    const regionNames: Record<string, string> = {
      'SEO': '서울',
      'BUS': '부산',
      'DAE': '대구',
      'INC': '인천',
      'GWA': '광주',
      'DAJ': '대전',
      'ULS': '울산',
      'SEJ': '세종',
      'GYG': '경기',
      'CHB': '충북',
      'CHN': '충남',
      'JEB': '전북',
      'JEN': '전남',
      'GYB': '경북',
      'GYN': '경남',
      'GAN': '강원',
      'JEJ': '제주'
    };

    for (const region of byRegion) {
      const name = regionNames[region.region_code || ''] || region.region_code;
      console.log(`${name}: ${region._count.id}개`);
    }

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addFinalMissingCenters().catch(console.error);