import { prisma } from '@/lib/prisma';

// 전국 시도별 구군 코드 매핑
const CITY_CODES_BY_REGION = {
  'SEO': { // 서울
    '종로구': 'jongno',
    '중구': 'jung',
    '용산구': 'yongsan',
    '성동구': 'seongdong',
    '광진구': 'gwangjin',
    '동대문구': 'dongdaemun',
    '중랑구': 'jungnang',
    '성북구': 'seongbuk',
    '강북구': 'gangbuk',
    '도봉구': 'dobong',
    '노원구': 'nowon',
    '은평구': 'eunpyeong',
    '서대문구': 'seodaemun',
    '마포구': 'mapo',
    '양천구': 'yangcheon',
    '강서구': 'gangseo',
    '구로구': 'guro',
    '금천구': 'geumcheon',
    '영등포구': 'yeongdeungpo',
    '동작구': 'dongjak',
    '관악구': 'gwanak',
    '서초구': 'seocho',
    '강남구': 'gangnam',
    '송파구': 'songpa',
    '강동구': 'gangdong',
  },
  'BUS': { // 부산
    '중구': 'jung',
    '서구': 'seo',
    '동구': 'dong',
    '영도구': 'yeongdo',
    '부산진구': 'busanjin',
    '동래구': 'dongnae',
    '남구': 'nam',
    '북구': 'buk',
    '해운대구': 'haeundae',
    '사하구': 'saha',
    '금정구': 'geumjeong',
    '강서구': 'gangseo',
    '연제구': 'yeonje',
    '수영구': 'suyeong',
    '사상구': 'sasang',
    '기장군': 'gijang',
  },
  'DAE': { // 대구
    '중구': 'jung',
    '동구': 'dong',
    '서구': 'seo',
    '남구': 'nam',
    '북구': 'buk',
    '수성구': 'suseong',
    '달서구': 'dalseo',
    '달성군': 'dalseong',
    '군위군': 'gunwi'
  },
  'INC': { // 인천
    '중구': 'jung',
    '동구': 'dong',
    '미추홀구': 'michuhol',
    '연수구': 'yeonsu',
    '남동구': 'namdong',
    '부평구': 'bupyeong',
    '계양구': 'gyeyang',
    '서구': 'seo',
    '강화군': 'ganghwa',
    '옹진군': 'ongjin',
  },
  'GWA': { // 광주
    '동구': 'dong',
    '서구': 'seo',
    '남구': 'nam',
    '북구': 'buk',
    '광산구': 'gwangsan',
  },
  'DAJ': { // 대전
    '동구': 'dong',
    '중구': 'jung',
    '서구': 'seo',
    '유성구': 'yuseong',
    '대덕구': 'daedeok',
  },
  'ULS': { // 울산
    '중구': 'jung',
    '남구': 'nam',
    '동구': 'dong',
    '북구': 'buk',
    '울주군': 'ulju',
  },
  'SEJ': { // 세종
    '세종시': 'sejong',
  },
  'GYG': { // 경기
    '수원시': 'suwon',
    '성남시': 'seongnam',
    '고양시': 'goyang',
    '용인시': 'yongin',
    '부천시': 'bucheon',
    '안산시': 'ansan',
    '안양시': 'anyang',
    '남양주시': 'namyangju',
    '화성시': 'hwaseong',
    '평택시': 'pyeongtaek',
    '의정부시': 'uijeongbu',
    '시흥시': 'siheung',
    '파주시': 'paju',
    '김포시': 'gimpo',
    '광명시': 'gwangmyeong',
    '광주시': 'gwangju',
    '군포시': 'gunpo',
    '오산시': 'osan',
    '이천시': 'icheon',
    '양주시': 'yangju',
    '안성시': 'anseong',
    '구리시': 'guri',
    '포천시': 'pocheon',
    '의왕시': 'uiwang',
    '하남시': 'hanam',
    '여주시': 'yeoju',
    '양평군': 'yangpyeong',
    '동두천시': 'dongducheon',
    '과천시': 'gwacheon',
    '가평군': 'gapyeong',
    '연천군': 'yeoncheon',
  }
};

async function validateAllHealthCenters() {
  console.log('=== 전국 보건소 city_code 검증 시작 ===\n');

  try {
    // 전체 health_center 조회
    const healthCenters = await prisma.organizations.findMany({
      where: {
        type: 'health_center'
      },
      select: {
        id: true,
        name: true,
        address: true,
        region_code: true,
        city_code: true
      },
      orderBy: [
        { region_code: 'asc' },
        { name: 'asc' }
      ]
    });

    console.log(`전국 보건소 ${healthCenters.length}개 발견\n`);

    // 통계
    const stats = {
      total: healthCenters.length,
      missing: 0,
      incorrect: 0,
      correct: 0,
      fixed: 0,
      failed: 0
    };

    // 시도별 그룹화
    const byRegion: Record<string, typeof healthCenters> = {};

    for (const hc of healthCenters) {
      const region = hc.region_code || 'UNKNOWN';
      if (!byRegion[region]) {
        byRegion[region] = [];
      }
      byRegion[region].push(hc);
    }

    // 시도별 검증 및 수정
    for (const [regionCode, centers] of Object.entries(byRegion)) {
      console.log(`\n===== ${regionCode} 지역 =====`);
      const cityCodeMap = CITY_CODES_BY_REGION[regionCode as keyof typeof CITY_CODES_BY_REGION];

      if (!cityCodeMap && regionCode !== 'UNKNOWN') {
        console.log(`⚠️  ${regionCode}에 대한 city_code 매핑 정보 없음 (군 지역 등)`);
        continue;
      }

      for (const center of centers) {
        let status = '';
        let detectedCity = null;
        let expectedCode = null;

        // 주소나 이름에서 구군 추출
        if (cityCodeMap) {
          for (const [cityName, code] of Object.entries(cityCodeMap)) {
            if (center.name.includes(cityName) || center.address?.includes(cityName)) {
              detectedCity = cityName;
              expectedCode = code;
              break;
            }
          }
        }

        // 상태 판단
        if (!center.city_code) {
          status = '❌ 누락';
          stats.missing++;

          // 수정 시도
          if (expectedCode) {
            try {
              await prisma.organizations.update({
                where: { id: center.id },
                data: { city_code: expectedCode }
              });
              status += ` → ✅ 수정됨 (${expectedCode})`;
              stats.fixed++;
            } catch (error) {
              status += ` → ⚠️ 수정 실패`;
              stats.failed++;
            }
          } else {
            status += ` → ⚠️ 구군 식별 불가`;
          }
        } else if (expectedCode && center.city_code !== expectedCode) {
          status = `⚠️ 불일치 (현재: ${center.city_code}, 예상: ${expectedCode})`;
          stats.incorrect++;

          // 수정 시도
          try {
            await prisma.organizations.update({
              where: { id: center.id },
              data: { city_code: expectedCode }
            });
            status += ` → ✅ 수정됨`;
            stats.fixed++;
          } catch (error) {
            status += ` → ⚠️ 수정 실패`;
            stats.failed++;
          }
        } else {
          status = '✅ 정상';
          stats.correct++;
        }

        // 문제가 있는 것만 출력
        if (!status.includes('✅ 정상')) {
          console.log(`${center.name}`);
          console.log(`  - 주소: ${center.address || '없음'}`);
          console.log(`  - city_code: ${center.city_code || '없음'}`);
          console.log(`  - 상태: ${status}`);
        }
      }

      // 시도별 요약
      const regionStats = centers.reduce((acc, c) => {
        if (!c.city_code) acc.missing++;
        else acc.correct++;
        return acc;
      }, { missing: 0, correct: 0 });

      console.log(`\n${regionCode} 요약: 정상 ${regionStats.correct}개, 누락 ${regionStats.missing}개`);
    }

    // 전체 통계
    console.log('\n' + '='.repeat(60));
    console.log('전체 검증 결과:');
    console.log(`  - 전체 보건소: ${stats.total}개`);
    console.log(`  - 정상: ${stats.correct}개 (${(stats.correct/stats.total*100).toFixed(1)}%)`);
    console.log(`  - 누락: ${stats.missing}개`);
    console.log(`  - 불일치: ${stats.incorrect}개`);
    console.log(`  - 수정 완료: ${stats.fixed}개`);
    console.log(`  - 수정 실패: ${stats.failed}개`);

    // 보건소 담당자 영향 분석
    console.log('\n=== 영향받는 보건소 담당자 ===\n');
    const affectedUsers = await prisma.user_profiles.findMany({
      where: {
        role: 'local_admin',
        organizations: {
          type: 'health_center',
          city_code: null
        }
      },
      include: {
        organizations: {
          select: {
            name: true,
            region_code: true,
            city_code: true
          }
        }
      }
    });

    if (affectedUsers.length > 0) {
      console.log(`city_code가 없는 보건소 담당자: ${affectedUsers.length}명`);
      for (const user of affectedUsers) {
        console.log(`- ${user.full_name} (${user.email})`);
        console.log(`  조직: ${user.organizations?.name}`);
        console.log(`  지역: ${user.organizations?.region_code}`);
      }
    } else {
      console.log('모든 보건소 담당자의 city_code가 정상 설정되어 있습니다.');
    }

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

validateAllHealthCenters().catch(console.error);