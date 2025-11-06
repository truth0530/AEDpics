import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

async function addMissingHealthCenters() {
  console.log('=== 누락된 보건소 추가 ===\n');

  try {
    // 현재 보건소 목록 확인
    const existingHealthCenters = await prisma.organizations.findMany({
      where: {
        type: 'health_center'
      },
      select: {
        name: true,
        region_code: true,
        city_code: true,
        address: true
      }
    });

    console.log(`현재 보건소 수: ${existingHealthCenters.length}개\n`);

    // 이름으로 중복 체크 함수
    const exists = (name: string, region: string) => {
      return existingHealthCenters.some(hc =>
        hc.name.includes(name) && hc.region_code === region
      );
    };

    // 추가해야 할 보건소 목록 (보건복지부 공식 목록 기준)
    const missingHealthCenters = [
      // 경기도 - 누락 가능성이 높은 시들
      {
        name: '광명시 보건소',
        region_code: 'GYG',
        city_code: 'gwangmyeong',
        address: '경기도 광명시 오리로 613'
      },
      {
        name: '동두천시 보건소',
        region_code: 'GYG',
        city_code: 'dongducheon',
        address: '경기도 동두천시 중앙로 167'
      },
      {
        name: '의정부시 보건소',
        region_code: 'GYG',
        city_code: 'uijeongbu',
        address: '경기도 의정부시 범골로 131'
      },
      {
        name: '구리시 보건소',
        region_code: 'GYG',
        city_code: 'guri',
        address: '경기도 구리시 건원대로34번길 84'
      },
      {
        name: '군포시 보건소',
        region_code: 'GYG',
        city_code: 'gunpo',
        address: '경기도 군포시 군포로 221'
      },
      {
        name: '의왕시 보건소',
        region_code: 'GYG',
        city_code: 'uiwang',
        address: '경기도 의왕시 오봉로 34'
      },
      {
        name: '부천시 보건소',
        region_code: 'GYG',
        city_code: 'bucheon',
        address: '경기도 부천시 옥산로10번길 16'
      }
    ];

    // 실제로 누락된 보건소만 필터링
    const toAdd = [];
    for (const hc of missingHealthCenters) {
      const nameKey = hc.name.replace('시 보건소', '').replace('군 보건소', '').replace('구 보건소', '');
      if (!exists(nameKey, hc.region_code)) {
        toAdd.push(hc);
        console.log(`✅ 추가 예정: ${hc.name} (${hc.region_code})`);
      } else {
        console.log(`⏭️ 이미 존재: ${hc.name}`);
      }
    }

    if (toAdd.length === 0) {
      console.log('\n추가할 보건소가 없습니다.');

      // 실제로 빠진 보건소 찾기 위한 추가 분석
      console.log('\n=== 추가 분석 ===');

      // 각 시도별 개수 확인
      const byRegion = await prisma.organizations.groupBy({
        by: ['region_code'],
        where: {
          type: 'health_center'
        },
        _count: {
          id: true
        }
      });

      const regionCounts: Record<string, number> = {};
      for (const r of byRegion) {
        regionCounts[r.region_code || ''] = r._count.id;
      }

      // 보건복지부 공식 통계 (2024년 12월 기준)
      const official: Record<string, number> = {
        'SEO': 25,  // 서울
        'BUS': 16,  // 부산
        'DAE': 8,   // 대구 (군위군 편입 전)
        'INC': 10,  // 인천
        'GWA': 5,   // 광주
        'DAJ': 5,   // 대전
        'ULS': 5,   // 울산
        'SEJ': 1,   // 세종
        'GYG': 44,  // 경기 (실제 44-45개 정도)
        'GAN': 18,  // 강원
        'CHB': 14,  // 충북 (청주 4개 포함)
        'CHN': 16,  // 충남 (천안 2개 포함)
        'JEB': 15,  // 전북 (전주 2개 포함)
        'JEN': 22,  // 전남
        'GYB': 23,  // 경북 (포항 2개 포함)
        'GYN': 22,  // 경남 (창원 5개 포함)
        'JEJ': 6    // 제주
      };

      console.log('\n시도별 차이:');
      for (const [code, officialCount] of Object.entries(official)) {
        const current = regionCounts[code] || 0;
        const diff = officialCount - current;
        if (diff !== 0) {
          console.log(`${code}: 현재 ${current}개, 공식 ${officialCount}개 (${diff > 0 ? '+' : ''}${diff})`);
        }
      }

      return;
    }

    // 보건소 추가
    console.log(`\n${toAdd.length}개 보건소 추가 중...`);

    for (const hc of toAdd) {
      const newOrg = await prisma.organizations.create({
        data: {
          id: uuidv4(),
          name: hc.name,
          type: 'health_center',
          region_code: hc.region_code,
          city_code: hc.city_code,
          address: hc.address,
          created_at: new Date(),
          updated_at: new Date()
        }
      });
      console.log(`✅ ${hc.name} 추가 완료`);
    }

    // 최종 개수 확인
    const finalCount = await prisma.organizations.count({
      where: { type: 'health_center' }
    });

    console.log(`\n최종 보건소 수: ${finalCount}개`);
    console.log(`목표: 261개`);
    console.log(`차이: ${261 - finalCount}개`);

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addMissingHealthCenters().catch(console.error);