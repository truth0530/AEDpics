// 실제 데이터 기반 AED 시스템 정보
export const REAL_WORLD_DATA = {
  // 실제 AED 제조사 및 모델 정보
  AED_MANUFACTURERS: [
    {
      name: "필립스 (Philips)",
      country: "네덜란드",
      models: [
        {
          name: "하트스타트 HS1",
          weight: "1.5kg",
          features: ["음성안내", "Bi-Phasic 기술", "자동 자가진단"],
          battery_life: "4년",
          pad_life: "2년",
          shock_time: "8초 이내"
        },
        {
          name: "하트스타트 FRx", 
          weight: "1.6kg",
          features: ["퀵쇼크 기술", "견고한 설계", "음성/시각 안내"],
          battery_life: "4년",
          pad_life: "2년", 
          shock_time: "평균 8.4초"
        }
      ]
    },
    {
      name: "CU메디칼",
      country: "한국",
      models: [
        {
          name: "CU-SP1",
          weight: "2.0kg",
          features: ["한국어 음성안내", "LCD 디스플레이", "자동진단"],
          battery_life: "5년",
          pad_life: "2년",
          shock_time: "10초 이내"
        }
      ]
    },
    {
      name: "지올 (ZOLL)",
      country: "미국",
      models: [
        {
          name: "AED Plus",
          weight: "3.1kg", 
          features: ["실시간 CPR 피드백", "긴 배터리 수명"],
          battery_life: "5년",
          pad_life: "5년",
          shock_time: "8초 이내"
        }
      ]
    },
    {
      name: "피지오컨트롤 (Physio-Control)",
      country: "미국",
      models: [
        {
          name: "LIFEPAK CR Plus",
          weight: "2.0kg",
          features: ["cprMAX 기술", "견고한 방수 설계"], 
          battery_life: "4년",
          pad_life: "2년",
          shock_time: "8초 이내"
        }
      ]
    }
  ],

  // 실제 지역별 보건소 대표 명단 (261개 중 주요 지역)
  HEALTH_CENTERS_SAMPLE: [
    // 서울특별시 (25개)
    { region: "서울", name: "종로구보건소", contact: "02-2148-3500", address: "서울특별시 종로구 율곡로 27" },
    { region: "서울", name: "중구보건소", contact: "02-3396-5101", address: "서울특별시 중구 다산로 120" },
    { region: "서울", name: "용산구보건소", contact: "02-2199-8000", address: "서울특별시 용산구 녹사평대로 166" },
    { region: "서울", name: "성동구보건소", contact: "02-2286-7000", address: "서울특별시 성동구 고산자로 270" },
    { region: "서울", name: "광진구보건소", contact: "02-450-1306", address: "서울특별시 광진구 자양로 117" },
    { region: "서울", name: "동대문구보건소", contact: "02-2127-5000", address: "서울특별시 동대문구 천호대로 145" },
    { region: "서울", name: "중랑구보건소", contact: "02-2094-0500", address: "서울특별시 중랑구 신내로 169" },
    { region: "서울", name: "성북구보건소", contact: "02-2241-1330", address: "서울특별시 성북구 화랑로 63" },
    { region: "서울", name: "강북구보건소", contact: "02-901-7620", address: "서울특별시 강북구 한천로 897" },
    { region: "서울", name: "도봉구보건소", contact: "02-2091-4000", address: "서울특별시 도봉구 노해로 656" },

    // 부산광역시 (16개) 
    { region: "부산", name: "중구보건소", contact: "051-600-4701", address: "부산광역시 중구 대청로 120" },
    { region: "부산", name: "서구보건소", contact: "051-240-4000", address: "부산광역시 서구 구덕로 225" },
    { region: "부산", name: "동구보건소", contact: "051-440-6000", address: "부산광역시 동구 구청로 1" },
    { region: "부산", name: "영도구보건소", contact: "051-419-4000", address: "부산광역시 영도구 신선로 48" },
    { region: "부산", name: "부산진구보건소", contact: "051-605-6000", address: "부산광역시 부산진구 황령대로 320" },

    // 대구광역시 (8개)
    { region: "대구", name: "중구보건소", contact: "053-661-3000", address: "대구광역시 중구 달성로 15" },
    { region: "대구", name: "동구보건소", contact: "053-662-3000", address: "대구광역시 동구 동부로 145" },
    { region: "대구", name: "서구보건소", contact: "053-663-3000", address: "대구광역시 서구 국채보상로 257" },
    { region: "대구", name: "남구보건소", contact: "053-664-3000", address: "대구광역시 남구 명덕로 104" },

    // 인천광역시 (10개)
    { region: "인천", name: "중구보건소", contact: "032-760-6000", address: "인천광역시 중구 축항대로 7" },
    { region: "인천", name: "동구보건소", contact: "032-770-6000", address: "인천광역시 동구 금곡로 25" },
    { region: "인천", name: "미추홀구보건소", contact: "032-880-5000", address: "인천광역시 미추홀구 독정이로 165" },

    // 광주광역시 (5개)
    { region: "광주", name: "동구보건소", contact: "062-608-8300", address: "광주광역시 동구 서남로 1" },
    { region: "광주", name: "서구보건소", contact: "062-350-4000", address: "광주광역시 서구 내방로 111" },
    { region: "광주", name: "남구보건소", contact: "062-607-4000", address: "광주광역시 남구 봉선로 1" },

    // 대전광역시 (5개)
    { region: "대전", name: "동구보건소", contact: "042-251-6000", address: "대전광역시 동구 우암로 294" },
    { region: "대전", name: "중구보건소", contact: "042-580-3000", address: "대전광역시 중구 대종로 490" },

    // 울산광역시 (5개)  
    { region: "울산", name: "중구보건소", contact: "052-290-4000", address: "울산광역시 중구 북부순환도로 200" },
    { region: "울산", name: "남구보건소", contact: "052-226-2701", address: "울산광역시 남구 돋질로 233" },

    // 세종특별자치시 (1개)
    { region: "세종", name: "세종특별자치시보건소", contact: "044-301-2000", address: "세종특별자치시 한누리대로 2130" },

    // 경기도 (31개 중 주요 지역)
    { region: "경기", name: "수원시보건소", contact: "031-228-5000", address: "경기도 수원시 영통구 월드컵로 195" },
    { region: "경기", name: "성남시보건소", contact: "031-729-3000", address: "경기도 성남시 분당구 운중로 90" },
    { region: "경기", name: "고양시보건소", contact: "031-8075-4000", address: "경기도 고양시 덕양구 화정로 75" },
    { region: "경기", name: "용인시보건소", contact: "031-324-4000", address: "경기도 용인시 처인구 중부대로 1199" },
    { region: "경기", name: "부천시보건소", contact: "032-625-4000", address: "경기도 부천시 원미구 길주로 210" },

    // 강원도 (18개 중 주요 지역)
    { region: "강원", name: "춘천시보건소", contact: "033-250-3000", address: "강원도 춘천시 금강로 113" },
    { region: "강원", name: "원주시보건소", contact: "033-737-4000", address: "강원도 원주시 원일로 85" },
    { region: "강원", name: "강릉시보건소", contact: "033-660-3000", address: "강원도 강릉시 하슬라로 42" },

    // 충청북도 (11개 중 주요 지역)
    { region: "충북", name: "청주시보건소", contact: "043-201-3000", address: "충청북도 청주시 상당구 상당로 155" },
    { region: "충북", name: "충주시보건소", contact: "043-850-3000", address: "충청북도 충주시 으뜸로 21" },

    // 충청남도 (15개 중 주요 지역)  
    { region: "충남", name: "천안시보건소", contact: "041-521-3000", address: "충청남도 천안시 동남구 영성로 75" },
    { region: "충남", name: "아산시보건소", contact: "041-540-2000", address: "충청남도 아산시 번영로 224번길 20" },

    // 전라북도 (14개 중 주요 지역)
    { region: "전북", name: "전주시보건소", contact: "063-281-2000", address: "전라북도 전주시 완산구 노송광장로 10" },
    { region: "전북", name: "군산시보건소", contact: "063-463-5000", address: "전라북도 군산시 신영로 22" },

    // 전라남도 (22개 중 주요 지역)
    { region: "전남", name: "목포시보건소", contact: "061-270-3000", address: "전라남도 목포시 영산로 630" },
    { region: "전남", name: "여수시보건소", contact: "061-690-8000", address: "전라남도 여수시 시청로 1" },

    // 경상북도 (23개 중 주요 지역)
    { region: "경북", name: "포항시보건소", contact: "054-270-2000", address: "경상북도 포항시 남구 시청로 1" },
    { region: "경북", name: "경주시보건소", contact: "054-779-8000", address: "경상북도 경주시 양정로 140" },

    // 경상남도 (18개 중 주요 지역)
    { region: "경남", name: "창원시보건소", contact: "055-225-4000", address: "경상남도 창원시 의창구 중앙대로 151" },
    { region: "경남", name: "진주시보건소", contact: "055-749-5000", address: "경상남도 진주시 드래곤로 126" },

    // 제주특별자치도 (2개)
    { region: "제주", name: "제주시보건소", contact: "064-728-4000", address: "제주특별자치도 제주시 연삼로 473" },
    { region: "제주", name: "서귀포시보건소", contact: "064-760-4000", address: "제주특별자치도 서귀포시 중앙로 105" }
  ],

  // 지역별 특성 데이터
  REGIONAL_CHARACTERISTICS: [
    {
      region: "서울",
      climate: "도시형",
      특성: ["높은 인구밀도", "지하철역 다수", "고층건물"],
      주요관심사항: ["접근성", "교통편의성", "응답시간"]
    },
    {
      region: "부산", 
      climate: "해안형",
      특성: ["해안 도시", "염분 노출", "습도 높음"],
      주요관심사항: ["염분 부식", "습도 관리", "해안 접근성"]
    },
    {
      region: "강원",
      climate: "산간형", 
      특성: ["산악 지형", "겨울 혹한", "접근성 제한"],
      주요관심사항: ["겨울철 배터리", "산간 접근성", "응급 이송"]
    },
    {
      region: "제주",
      climate: "도서형",
      특성: ["섬 지역", "강풍", "염분"],
      주요관심사항: ["강풍 대비", "염분 부식", "응급 이송"]
    }
  ],

  // 실제 점검 우선순위 요소
  PRIORITY_FACTORS: [
    {
      factor: "배터리 만료일",
      weight: 0.3,
      description: "교체 시기 임박도"
    },
    {
      factor: "패드 만료일", 
      weight: 0.25,
      description: "소모품 교체 필요성"
    },
    {
      factor: "최근 점검일",
      weight: 0.2, 
      description: "점검 주기 준수"
    },
    {
      factor: "지리적 거리",
      weight: 0.15,
      description: "이동 효율성"
    },
    {
      factor: "사용 빈도",
      weight: 0.1,
      description: "실제 활용도"
    }
  ]
} as const;