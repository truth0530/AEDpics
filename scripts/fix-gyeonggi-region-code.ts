import { prisma } from '@/lib/prisma';

async function fixGyeonggiRegionCode() {
  console.log('=== 경기도 region_code 수정 (GYE → GYG) ===\n');

  try {
    // 1. 수정 전 확인
    const beforeCount = await prisma.organizations.count({
      where: {
        region_code: 'GYE',
        type: 'health_center'
      }
    });

    console.log(`수정 전: GYE로 등록된 보건소 ${beforeCount}개\n`);

    if (beforeCount === 0) {
      console.log('수정할 보건소가 없습니다.');
      return;
    }

    // 2. GYE → GYG 수정
    const result = await prisma.organizations.updateMany({
      where: {
        region_code: 'GYE',
        type: 'health_center'
      },
      data: {
        region_code: 'GYG',
        updated_at: new Date()
      }
    });

    console.log(`✅ ${result.count}개 보건소의 region_code를 GYE → GYG로 수정 완료\n`);

    // 3. 수정 후 확인
    const afterGYE = await prisma.organizations.count({
      where: {
        region_code: 'GYE',
        type: 'health_center'
      }
    });

    const afterGYG = await prisma.organizations.count({
      where: {
        region_code: 'GYG',
        type: 'health_center'
      }
    });

    console.log('=== 수정 후 현황 ===');
    console.log(`GYE 보건소: ${afterGYE}개 (0개여야 정상)`);
    console.log(`GYG 보건소: ${afterGYG}개 (42개여야 정상)`);

    // 4. 샘플 확인
    const samples = await prisma.organizations.findMany({
      where: {
        region_code: 'GYG',
        type: 'health_center'
      },
      select: {
        name: true,
        region_code: true,
        city_code: true,
        address: true
      },
      take: 5
    });

    console.log('\n=== 수정된 보건소 샘플 ===');
    for (const org of samples) {
      console.log(`✅ ${org.name}`);
      console.log(`   region_code: ${org.region_code}`);
      console.log(`   city_code: ${org.city_code}`);
      console.log(`   주소: ${org.address}`);
    }

    // 5. 전체 시도별 보건소 수 재확인
    const allRegions = await prisma.organizations.groupBy({
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

    console.log('\n=== 최종 시도별 보건소 현황 ===');
    const regionNames: Record<string, string> = {
      'SEO': '서울특별시',
      'BUS': '부산광역시',
      'DAE': '대구광역시',
      'INC': '인천광역시',
      'GWA': '광주광역시',
      'DAJ': '대전광역시',
      'ULS': '울산광역시',
      'SEJ': '세종특별자치시',
      'GYG': '경기도',
      'CHB': '충청북도',
      'CHN': '충청남도',
      'JEB': '전북특별자치도',
      'JEN': '전라남도',
      'GYB': '경상북도',
      'GYN': '경상남도',
      'GAN': '강원특별자치도',
      'JEJ': '제주특별자치도'
    };

    let total = 0;
    for (const region of allRegions) {
      const regionName = regionNames[region.region_code || ''] || region.region_code;
      console.log(`${regionName} (${region.region_code}): ${region._count.id}개`);
      total += region._count.id;
    }
    console.log(`\n전체: ${total}개`);

    console.log('\n✅ 경기도 region_code 수정 완료!');

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixGyeonggiRegionCode().catch(console.error);