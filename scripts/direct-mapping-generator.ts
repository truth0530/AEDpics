#!/usr/bin/env npx tsx

/**
 * 직접 매핑 생성기
 * organization name에서 직접 구군명 추출
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function generateDirectMapping() {
  try {
    // 모든 조직 데이터를 직접 조회
    const orgs = await prisma.$queryRaw<
      Array<{ city_code: string; name: string }>
    >`
      SELECT DISTINCT city_code, name
      FROM organizations
      WHERE city_code IS NOT NULL
      ORDER BY city_code
    `;

    // 수동 매핑 테이블
    const MANUAL_MAPPINGS: Record<string, string> = {
      // 서울특별시
      'gangnam': '강남구',
      'gangdong': '강동구',
      'gangbuk': '강북구',
      'gangseo': '강서구',
      'gwanak': '관악구',
      'gwangjin': '광진구',
      'guro': '구로구',
      'geumcheon': '금천구',
      'nowon': '노원구',
      'dobong': '도봉구',
      'dongdaemun': '동대문구',
      'dongjak': '동작구',
      'mapo': '마포구',
      'seodaemun': '서대문구',
      'seocho': '서초구',
      'seongdong': '성동구',
      'seongbuk': '성북구',
      'songpa': '송파구',
      'yangcheon': '양천구',
      'yeongdeungpo': '영등포구',
      'yongsan': '용산구',
      'eunpyeong': '은평구',
      'jongno': '종로구',
      'jungnang': '중랑구',

      // 부산광역시
      'jung': '중구',
      'seo': '서구',
      'dong': '동구',
      'yeongdo': '영도구',
      'busanjin': '부산진구',
      'dongnae': '동래구',
      'nam': '남구',
      'buk': '북구',
      'haeundae': '해운대구',
      'saha': '사하구',
      'geumjeong': '금정구',
      'gangseo_gadeok': '강서구',
      'yeonje': '연제구',
      'suyeong': '수영구',
      'sasang': '사상구',
      'gijang': '기장군',

      // 대구광역시
      'dalseo': '달서구',
      'suseong': '수성구',
      'dalseong': '달성군',
      'gunwi': '군위군',

      // 인천광역시
      'donggu': '동구',
      'michuhol': '미추홀구',
      'yeonsu': '연수구',
      'namdong': '남동구',
      'bupyeong': '부평구',
      'gyeyang': '계양구',
      'ganghwa': '강화군',
      'ongjin': '옹진군',
      'jung_yeongjong': '중구',

      // 광주광역시
      'gwangsan': '광산구',

      // 대전광역시
      'daedeok': '대덕구',
      'yuseong': '유성구',

      // 울산광역시
      'ulju': '울주군',

      // 세종특별자치시
      'sejong': '세종특별자치시',
      'seju': '세종특별자치시',

      // 경기도
      'suwon': '수원시',
      'suwon_jangan': '장안구',
      'suwon_gwonseon': '권선구',
      'suwon_yeongtong': '영통구',
      'suwon_paldal': '팔달구',
      'seongnam': '성남시',
      'seongnam_sujeong': '수정구',
      'seongnam_jungwon': '중원구',
      'seongnam_bundang': '분당구',
      'uijeongbu': '의정부시',
      'anyang': '안양시',
      'anyang_manan': '만안구',
      'anyang_dongan': '동안구',
      'bucheon': '부천시',
      'gwangmyeong': '광명시',
      'pyeongtaek': '평택시',
      'dongducheon': '동두천시',
      'ansan': '안산시',
      'ansan_danwon': '단원구',
      'ansan_sangnok': '상록구',
      'goyang': '고양시',
      'goyang_deogyang': '덕양구',
      'goyang_ilsandong': '일산동구',
      'goyang_ilsanseo': '일산서구',
      'gwacheon': '과천시',
      'guri': '구리시',
      'namyangju': '남양주시',
      'namyangju_pungyang': '남양주시',
      'osan': '오산시',
      'siheung': '시흥시',
      'gunpo': '군포시',
      'uiwang': '의왕시',
      'hanam': '하남시',
      'yongin': '용인시',
      'yongin_cheoin': '처인구',
      'yongin_giheung': '기흥구',
      'yongin_suji': '수지구',
      'paju': '파주시',
      'icheon': '이천시',
      'anseong': '안성시',
      'gimpo': '김포시',
      'hwaseong': '화성시',
      'hwaseong_dongtan': '화성시',
      'gwangju': '광주시',
      'yangju': '양주시',
      'pocheon': '포천시',
      'yeoju': '여주시',
      'yeoncheon': '연천군',
      'gapyeong': '가평군',
      'yangpyeong': '양평군',

      // 강원특별자치도
      'chuncheon': '춘천시',
      'wonju': '원주시',
      'gangneung': '강릉시',
      'donghae': '동해시',
      'taebaek': '태백시',
      'sokcho': '속초시',
      'samcheok': '삼척시',
      'hongcheon': '홍천군',
      'hoengseong': '횡성군',
      'yeongwol': '영월군',
      'pyeongchang': '평창군',
      'jeongseon': '정선군',
      'cheorwon': '철원군',
      'hwacheon': '화천군',
      'yanggu': '양구군',
      'inje': '인제군',
      'goseong': '고성군',
      'yangyang': '양양군',

      // 충청북도
      'cheongju': '청주시',
      'cheongju-sangdang': '상당구',
      'cheongju-seowon': '서원구',
      'cheongju-heungdeok': '흥덕구',
      'cheongju-cheongwon': '청원구',
      'chungju': '충주시',
      'jecheon': '제천시',
      'boeun': '보은군',
      'okcheon': '옥천군',
      'yeongdong': '영동군',
      'jincheon': '진천군',
      'goesan': '괴산군',
      'eumseong': '음성군',
      'danyang': '단양군',
      'jeungpyeong': '증평군',

      // 충청남도
      'cheonan': '천안시',
      'cheonan_dongnam': '동남구',
      'cheonan_seobuk': '서북구',
      'gongju': '공주시',
      'boryeong': '보령시',
      'asan': '아산시',
      'seosan': '서산시',
      'nonsan': '논산시',
      'gyeryong': '계룡시',
      'dangjin': '당진시',
      'geumsan': '금산군',
      'buyeo': '부여군',
      'seocheon': '서천군',
      'cheongyang': '청양군',
      'hongseong': '홍성군',
      'yesan': '예산군',
      'taean': '태안군',

      // 전라북도
      'jeonju': '전주시',
      'jeonju_wansan': '완산구',
      'jeonju_deokjin': '덕진구',
      'gunsan': '군산시',
      'iksan': '익산시',
      'jeongeup': '정읍시',
      'namwon': '남원시',
      'gimje': '김제시',
      'wanju': '완주군',
      'jinan': '진안군',
      'muju': '무주군',
      'jangsu': '장수군',
      'imsil': '임실군',
      'sunchang': '순창군',
      'gochang': '고창군',
      'buan': '부안군',

      // 전라남도
      'mokpo': '목포시',
      'yeosu': '여수시',
      'suncheon': '순천시',
      'naju': '나주시',
      'gwangyang': '광양시',
      'damyang': '담양군',
      'gokseong': '곡성군',
      'gurye': '구례군',
      'goheung': '고흥군',
      'boseong': '보성군',
      'hwasun': '화순군',
      'jangheung': '장흥군',
      'gangjin': '강진군',
      'haenam': '해남군',
      'yeongam': '영암군',
      'muan': '무안군',
      'hampyeong': '함평군',
      'yeonggwang': '영광군',
      'jangseong': '장성군',
      'wando': '완도군',
      'jindo': '진도군',
      'sinan': '신안군',

      // 경상북도
      'pohang': '포항시',
      'pohang_nam': '남구',
      'pohang_buk': '북구',
      'gyeongju': '경주시',
      'gimcheon': '김천시',
      'andong': '안동시',
      'gumi': '구미시',
      'yeongju': '영주시',
      'yeongcheon': '영천시',
      'sangju': '상주시',
      'mungyeong': '문경시',
      'gyeongsan': '경산시',
      'gunwi': '군위군',
      'uiseong': '의성군',
      'cheongsong': '청송군',
      'yeongyang': '영양군',
      'yeongdeok': '영덕군',
      'cheongdo': '청도군',
      'goryeong': '고령군',
      'seongju': '성주군',
      'chilgok': '칠곡군',
      'yecheon': '예천군',
      'bonghwa': '봉화군',
      'uljin': '울진군',
      'ulleung': '울릉군',

      // 경상남도
      'changwon': '창원시',
      'changwon_uichang': '의창구',
      'changwon_seongsan': '성산구',
      'changwon_masanhappo': '마산합포구',
      'changwon_masanhoewon': '마산회원구',
      'changwon_jinhae': '진해구',
      'jinju': '진주시',
      'tongyeong': '통영시',
      'tongyeong_yokji': '통영시',
      'sacheon': '사천시',
      'gimhae': '김해시',
      'miryang': '밀양시',
      'geoje': '거제시',
      'yangsan': '양산시',
      'uiryeong': '의령군',
      'haman': '함안군',
      'changnyeong': '창녕군',
      'goseong': '고성군',
      'namhae': '남해군',
      'hadong': '하동군',
      'sancheong': '산청군',
      'hamyang': '함양군',
      'geochang': '거창군',
      'hapcheon': '합천군',

      // 제주특별자치도
      'jeju': '제주시',
      'seogwipo': '서귀포시',
    };

    console.log('// 완전한 CITY_CODE_TO_GUGUN_MAP');
    console.log('// 총 ' + Object.keys(MANUAL_MAPPINGS).length + '개 매핑\n');
    console.log('export const CITY_CODE_TO_GUGUN_MAP: Record<string, string> = {');

    // city_code별로 사용 여부 확인
    const used = new Set<string>();
    for (const org of orgs) {
      used.add(org.city_code);
    }

    // 사용된 매핑만 출력
    let lastRegion = '';
    for (const [code, gugun] of Object.entries(MANUAL_MAPPINGS)) {
      if (used.has(code)) {
        // 지역 구분 주석 추가 (간단하게)
        const currentRegion =
          code.startsWith('gang') || code.startsWith('geum') || code.startsWith('now') ||
          code.startsWith('dob') || code.startsWith('dong') || code.startsWith('map') ||
          code.startsWith('seo') || code.startsWith('song') || code.startsWith('yang') ||
          code.startsWith('yeong') || code.startsWith('yong') || code.startsWith('eun') ||
          code.startsWith('jong') || code.startsWith('jung') || code.startsWith('gwan') ||
          code.startsWith('gur') ? 'seoul' :
          code.startsWith('bus') || code.startsWith('hae') || code.startsWith('sah') ||
          code.startsWith('gij') || code.startsWith('yeon') || code.startsWith('suy') ||
          code.startsWith('sas') || code === 'nam' || code === 'buk' || code === 'dong' ? 'busan' :
          code.startsWith('dal') || code === 'gunwi' || code === 'suseong' ? 'daegu' :
          code.startsWith('mic') || code.startsWith('namd') || code.startsWith('bup') ||
          code.startsWith('gye') || code.startsWith('gang') || code.startsWith('ong') ? 'incheon' :
          code.startsWith('gwan') ? 'gwangju' :
          code.startsWith('dae') || code.startsWith('yu') ? 'daejeon' :
          code.startsWith('ulj') ? 'ulsan' :
          code.startsWith('sej') ? 'sejong' : 'other';

        if (currentRegion !== lastRegion) {
          console.log('');
          if (currentRegion === 'seoul') console.log('  // 서울특별시');
          else if (currentRegion === 'busan') console.log('  // 부산광역시');
          else if (currentRegion === 'daegu') console.log('  // 대구광역시');
          else if (currentRegion === 'incheon') console.log('  // 인천광역시');
          else if (currentRegion === 'gwangju') console.log('  // 광주광역시');
          else if (currentRegion === 'daejeon') console.log('  // 대전광역시');
          else if (currentRegion === 'ulsan') console.log('  // 울산광역시');
          else if (currentRegion === 'sejong') console.log('  // 세종특별자치시');
          lastRegion = currentRegion;
        }

        console.log(`  '${code}': '${gugun}',`);
      }
    }

    console.log('};');

    // 사용되지 않은 city_code 확인
    const unusedCodes = [];
    for (const org of orgs) {
      if (!MANUAL_MAPPINGS[org.city_code]) {
        unusedCodes.push(org);
      }
    }

    if (unusedCodes.length > 0) {
      console.log('\n// 매핑되지 않은 city_code:');
      for (const org of unusedCodes.slice(0, 10)) {
        console.log(`// '${org.city_code}': '???',  // ${org.name}`);
      }
      if (unusedCodes.length > 10) {
        console.log(`// ... 외 ${unusedCodes.length - 10}개`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateDirectMapping().catch(console.error);