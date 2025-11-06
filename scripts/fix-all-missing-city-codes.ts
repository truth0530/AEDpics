import { prisma } from '@/lib/prisma';

// 전국 모든 시도 구군 매핑 (완전판)
const COMPLETE_CITY_CODES = {
  // 기존 매핑 (이미 처리된 것들)
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
    '세종': 'sejong',
    '세종시': 'sejong',
    '세종특별자치시': 'sejong'
  },
  'GYE': { // 경기
    '수원': 'suwon',
    '수원시': 'suwon',
    '장안구': 'jangan',
    '권선구': 'gwonseon',
    '팔달구': 'paldal',
    '영통구': 'yeongtong',
    '성남': 'seongnam',
    '성남시': 'seongnam',
    '수정구': 'sujeong',
    '중원구': 'jungwon',
    '분당구': 'bundang',
    '고양': 'goyang',
    '고양시': 'goyang',
    '덕양구': 'deokyang',
    '일산동구': 'ilsandong',
    '일산서구': 'ilsanseo',
    '용인': 'yongin',
    '용인시': 'yongin',
    '처인구': 'cheoin',
    '기흥구': 'giheung',
    '수지구': 'suji',
    '부천': 'bucheon',
    '부천시': 'bucheon',
    '안산': 'ansan',
    '안산시': 'ansan',
    '상록구': 'sangrok',
    '단원구': 'danwon',
    '안양': 'anyang',
    '안양시': 'anyang',
    '만안구': 'manan',
    '동안구': 'dongan',
    '남양주': 'namyangju',
    '남양주시': 'namyangju',
    '화성': 'hwaseong',
    '화성시': 'hwaseong',
    '평택': 'pyeongtaek',
    '평택시': 'pyeongtaek',
    '의정부': 'uijeongbu',
    '의정부시': 'uijeongbu',
    '시흥': 'siheung',
    '시흥시': 'siheung',
    '파주': 'paju',
    '파주시': 'paju',
    '김포': 'gimpo',
    '김포시': 'gimpo',
    '광명': 'gwangmyeong',
    '광명시': 'gwangmyeong',
    '광주': 'gwangju',
    '광주시': 'gwangju',
    '군포': 'gunpo',
    '군포시': 'gunpo',
    '오산': 'osan',
    '오산시': 'osan',
    '이천': 'icheon',
    '이천시': 'icheon',
    '양주': 'yangju',
    '양주시': 'yangju',
    '안성': 'anseong',
    '안성시': 'anseong',
    '구리': 'guri',
    '구리시': 'guri',
    '포천': 'pocheon',
    '포천시': 'pocheon',
    '의왕': 'uiwang',
    '의왕시': 'uiwang',
    '하남': 'hanam',
    '하남시': 'hanam',
    '여주': 'yeoju',
    '여주시': 'yeoju',
    '양평': 'yangpyeong',
    '양평군': 'yangpyeong',
    '동두천': 'dongducheon',
    '동두천시': 'dongducheon',
    '과천': 'gwacheon',
    '과천시': 'gwacheon',
    '가평': 'gapyeong',
    '가평군': 'gapyeong',
    '연천': 'yeoncheon',
    '연천군': 'yeoncheon',
  },
  'GAN': { // 강원
    '춘천': 'chuncheon',
    '춘천시': 'chuncheon',
    '원주': 'wonju',
    '원주시': 'wonju',
    '강릉': 'gangneung',
    '강릉시': 'gangneung',
    '동해': 'donghae',
    '동해시': 'donghae',
    '태백': 'taebaek',
    '태백시': 'taebaek',
    '속초': 'sokcho',
    '속초시': 'sokcho',
    '삼척': 'samcheok',
    '삼척시': 'samcheok',
    '홍천': 'hongcheon',
    '홍천군': 'hongcheon',
    '횡성': 'hoengseong',
    '횡성군': 'hoengseong',
    '영월': 'yeongwol',
    '영월군': 'yeongwol',
    '평창': 'pyeongchang',
    '평창군': 'pyeongchang',
    '정선': 'jeongseon',
    '정선군': 'jeongseon',
    '철원': 'cheorwon',
    '철원군': 'cheorwon',
    '화천': 'hwacheon',
    '화천군': 'hwacheon',
    '양구': 'yanggu',
    '양구군': 'yanggu',
    '인제': 'inje',
    '인제군': 'inje',
    '고성': 'goseong',
    '고성군': 'goseong',
    '양양': 'yangyang',
    '양양군': 'yangyang',
  },
  'CHB': { // 충북
    '청주': 'cheongju',
    '청주시': 'cheongju',
    '상당구': 'sangdang',
    '서원구': 'seowon',
    '흥덕구': 'heungdeok',
    '청원구': 'cheongwon',
    '충주': 'chungju',
    '충주시': 'chungju',
    '제천': 'jecheon',
    '제천시': 'jecheon',
    '보은': 'boeun',
    '보은군': 'boeun',
    '옥천': 'okcheon',
    '옥천군': 'okcheon',
    '영동': 'yeongdong',
    '영동군': 'yeongdong',
    '증평': 'jeungpyeong',
    '증평군': 'jeungpyeong',
    '진천': 'jincheon',
    '진천군': 'jincheon',
    '괴산': 'goesan',
    '괴산군': 'goesan',
    '음성': 'eumseong',
    '음성군': 'eumseong',
    '단양': 'danyang',
    '단양군': 'danyang',
  },
  'CHN': { // 충남
    '천안': 'cheonan',
    '천안시': 'cheonan',
    '동남구': 'dongnam',
    '서북구': 'seobuk',
    '공주': 'gongju',
    '공주시': 'gongju',
    '보령': 'boryeong',
    '보령시': 'boryeong',
    '아산': 'asan',
    '아산시': 'asan',
    '서산': 'seosan',
    '서산시': 'seosan',
    '논산': 'nonsan',
    '논산시': 'nonsan',
    '계룡': 'gyeryong',
    '계룡시': 'gyeryong',
    '당진': 'dangjin',
    '당진시': 'dangjin',
    '금산': 'geumsan',
    '금산군': 'geumsan',
    '부여': 'buyeo',
    '부여군': 'buyeo',
    '서천': 'seocheon',
    '서천군': 'seocheon',
    '청양': 'cheongyang',
    '청양군': 'cheongyang',
    '홍성': 'hongseong',
    '홍성군': 'hongseong',
    '예산': 'yesan',
    '예산군': 'yesan',
    '태안': 'taean',
    '태안군': 'taean',
  },
  'JEB': { // 전북
    '전주': 'jeonju',
    '전주시': 'jeonju',
    '완산구': 'wansan',
    '덕진구': 'deokjin',
    '군산': 'gunsan',
    '군산시': 'gunsan',
    '익산': 'iksan',
    '익산시': 'iksan',
    '정읍': 'jeongeup',
    '정읍시': 'jeongeup',
    '남원': 'namwon',
    '남원시': 'namwon',
    '김제': 'gimje',
    '김제시': 'gimje',
    '완주': 'wanju',
    '완주군': 'wanju',
    '진안': 'jinan',
    '진안군': 'jinan',
    '무주': 'muju',
    '무주군': 'muju',
    '장수': 'jangsu',
    '장수군': 'jangsu',
    '임실': 'imsil',
    '임실군': 'imsil',
    '순창': 'sunchang',
    '순창군': 'sunchang',
    '고창': 'gochang',
    '고창군': 'gochang',
    '부안': 'buan',
    '부안군': 'buan',
  },
  'JEN': { // 전남
    '목포': 'mokpo',
    '목포시': 'mokpo',
    '여수': 'yeosu',
    '여수시': 'yeosu',
    '순천': 'suncheon',
    '순천시': 'suncheon',
    '나주': 'naju',
    '나주시': 'naju',
    '광양': 'gwangyang',
    '광양시': 'gwangyang',
    '담양': 'damyang',
    '담양군': 'damyang',
    '곡성': 'gokseong',
    '곡성군': 'gokseong',
    '구례': 'gurye',
    '구례군': 'gurye',
    '고흥': 'goheung',
    '고흥군': 'goheung',
    '보성': 'boseong',
    '보성군': 'boseong',
    '화순': 'hwasun',
    '화순군': 'hwasun',
    '장흥': 'jangheung',
    '장흥군': 'jangheung',
    '강진': 'gangjin',
    '강진군': 'gangjin',
    '해남': 'haenam',
    '해남군': 'haenam',
    '영암': 'yeongam',
    '영암군': 'yeongam',
    '무안': 'muan',
    '무안군': 'muan',
    '함평': 'hampyeong',
    '함평군': 'hampyeong',
    '영광': 'yeonggwang',
    '영광군': 'yeonggwang',
    '장성': 'jangseong',
    '장성군': 'jangseong',
    '완도': 'wando',
    '완도군': 'wando',
    '진도': 'jindo',
    '진도군': 'jindo',
    '신안': 'sinan',
    '신안군': 'sinan',
  },
  'GYB': { // 경북
    '포항': 'pohang',
    '포항시': 'pohang',
    '남구': 'nam',
    '북구': 'buk',
    '경주': 'gyeongju',
    '경주시': 'gyeongju',
    '김천': 'gimcheon',
    '김천시': 'gimcheon',
    '안동': 'andong',
    '안동시': 'andong',
    '구미': 'gumi',
    '구미시': 'gumi',
    '영주': 'yeongju',
    '영주시': 'yeongju',
    '영천': 'yeongcheon',
    '영천시': 'yeongcheon',
    '상주': 'sangju',
    '상주시': 'sangju',
    '문경': 'mungyeong',
    '문경시': 'mungyeong',
    '경산': 'gyeongsan',
    '경산시': 'gyeongsan',
    '군위': 'gunwi',
    '군위군': 'gunwi',
    '의성': 'uiseong',
    '의성군': 'uiseong',
    '청송': 'cheongsong',
    '청송군': 'cheongsong',
    '영양': 'yeongyang',
    '영양군': 'yeongyang',
    '영덕': 'yeongdeok',
    '영덕군': 'yeongdeok',
    '청도': 'cheongdo',
    '청도군': 'cheongdo',
    '고령': 'goryeong',
    '고령군': 'goryeong',
    '성주': 'seongju',
    '성주군': 'seongju',
    '칠곡': 'chilgok',
    '칠곡군': 'chilgok',
    '예천': 'yecheon',
    '예천군': 'yecheon',
    '봉화': 'bonghwa',
    '봉화군': 'bonghwa',
    '울진': 'uljin',
    '울진군': 'uljin',
    '울릉': 'ulleung',
    '울릉군': 'ulleung',
  },
  'GYN': { // 경남
    '창원': 'changwon',
    '창원시': 'changwon',
    '의창구': 'uichang',
    '성산구': 'seongsan',
    '마산합포구': 'masanhappo',
    '마산회원구': 'masanhoewon',
    '진해구': 'jinhae',
    '진주': 'jinju',
    '진주시': 'jinju',
    '통영': 'tongyeong',
    '통영시': 'tongyeong',
    '사천': 'sacheon',
    '사천시': 'sacheon',
    '김해': 'gimhae',
    '김해시': 'gimhae',
    '밀양': 'miryang',
    '밀양시': 'miryang',
    '거제': 'geoje',
    '거제시': 'geoje',
    '양산': 'yangsan',
    '양산시': 'yangsan',
    '의령': 'uiryeong',
    '의령군': 'uiryeong',
    '함안': 'haman',
    '함안군': 'haman',
    '창녕': 'changnyeong',
    '창녕군': 'changnyeong',
    '고성': 'goseong',
    '고성군': 'goseong',
    '남해': 'namhae',
    '남해군': 'namhae',
    '하동': 'hadong',
    '하동군': 'hadong',
    '산청': 'sancheong',
    '산청군': 'sancheong',
    '함양': 'hamyang',
    '함양군': 'hamyang',
    '거창': 'geochang',
    '거창군': 'geochang',
    '합천': 'hapcheon',
    '합천군': 'hapcheon',
  },
  'JEJ': { // 제주
    '제주': 'jeju',
    '제주시': 'jeju',
    '서귀포': 'seogwipo',
    '서귀포시': 'seogwipo',
    '동부': 'dongbu',
    '서부': 'seobu',
    '남원': 'namwon',
    '한림': 'hallim',
    '대정': 'daejeong',
    '성산': 'seongsan',
    '안덕': 'andeok',
    '표선': 'pyoseon'
  }
};

async function fixAllMissingCityCodes() {
  console.log('=== 전국 보건소 city_code 일괄 수정 시작 ===\n');

  try {
    // city_code가 없는 모든 보건소 조회
    const missingHealthCenters = await prisma.organizations.findMany({
      where: {
        type: 'health_center',
        city_code: null
      },
      select: {
        id: true,
        name: true,
        address: true,
        region_code: true,
        city_code: true
      }
    });

    console.log(`누락된 보건소: ${missingHealthCenters.length}개 발견\n`);

    let successCount = 0;
    let failCount = 0;
    const failedList: any[] = [];

    for (const hc of missingHealthCenters) {
      const regionCode = hc.region_code;
      const cityMap = COMPLETE_CITY_CODES[regionCode as keyof typeof COMPLETE_CITY_CODES];

      if (!cityMap) {
        console.log(`⚠️  ${hc.name}: 지역코드 ${regionCode} 매핑 없음`);
        failCount++;
        failedList.push(hc);
        continue;
      }

      // 이름이나 주소에서 구군 찾기
      let foundCity = null;
      let foundCode = null;

      for (const [cityName, cityCode] of Object.entries(cityMap)) {
        if (hc.name.includes(cityName) || (hc.address && hc.address.includes(cityName))) {
          foundCity = cityName;
          foundCode = cityCode;
          break;
        }
      }

      if (foundCode) {
        try {
          await prisma.organizations.update({
            where: { id: hc.id },
            data: { city_code: foundCode }
          });
          console.log(`✅ ${hc.name}: ${foundCode} 설정 완료`);
          successCount++;
        } catch (error) {
          console.log(`❌ ${hc.name}: 업데이트 실패`);
          failCount++;
          failedList.push(hc);
        }
      } else {
        console.log(`⚠️  ${hc.name}: 구군 식별 실패`);
        console.log(`    주소: ${hc.address}`);
        failCount++;
        failedList.push(hc);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('처리 완료:');
    console.log(`  - 성공: ${successCount}개`);
    console.log(`  - 실패: ${failCount}개`);
    console.log(`  - 전체: ${missingHealthCenters.length}개`);

    if (failedList.length > 0) {
      console.log('\n실패 목록:');
      for (const hc of failedList.slice(0, 10)) {
        console.log(`  - ${hc.name} (${hc.region_code})`);
        console.log(`    주소: ${hc.address}`);
      }
      if (failedList.length > 10) {
        console.log(`  ... 외 ${failedList.length - 10}개`);
      }
    }

    // 최종 검증
    const finalCheck = await prisma.organizations.findMany({
      where: {
        type: 'health_center'
      },
      select: {
        city_code: true
      }
    });

    const withCityCode = finalCheck.filter(hc => hc.city_code).length;
    const withoutCityCode = finalCheck.filter(hc => !hc.city_code).length;

    console.log('\n=== 최종 결과 ===');
    console.log(`전체 보건소: ${finalCheck.length}개`);
    console.log(`city_code 있음: ${withCityCode}개 (${(withCityCode/finalCheck.length*100).toFixed(1)}%)`);
    console.log(`city_code 없음: ${withoutCityCode}개 (${(withoutCityCode/finalCheck.length*100).toFixed(1)}%)`);

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAllMissingCityCodes().catch(console.error);