/**
 * 시군구 관련 상수 및 유틸리티
 * 전국 기본 시군구 코드 및 매핑 관리
 */

export interface City {
  code: string;
  name: string;
  regionCode: string;
  type: 'city' | 'county' | 'district';
}

// 주요 시군구 매핑 (실제 운영 시 전체 리스트 필요)
export const CITIES: City[] = [
  // 서울특별시
  { code: '11010', name: '종로구', regionCode: 'SEO', type: 'district' },
  { code: '11020', name: '중구', regionCode: 'SEO', type: 'district' },
  { code: '11030', name: '용산구', regionCode: 'SEO', type: 'district' },
  { code: '11040', name: '성동구', regionCode: 'SEO', type: 'district' },
  { code: '11050', name: '광진구', regionCode: 'SEO', type: 'district' },
  { code: '11060', name: '동대문구', regionCode: 'SEO', type: 'district' },
  { code: '11070', name: '중랑구', regionCode: 'SEO', type: 'district' },
  { code: '11080', name: '성북구', regionCode: 'SEO', type: 'district' },
  { code: '11090', name: '강북구', regionCode: 'SEO', type: 'district' },
  { code: '11100', name: '도봉구', regionCode: 'SEO', type: 'district' },
  { code: '11110', name: '노원구', regionCode: 'SEO', type: 'district' },
  { code: '11120', name: '은평구', regionCode: 'SEO', type: 'district' },
  { code: '11130', name: '서대문구', regionCode: 'SEO', type: 'district' },
  { code: '11140', name: '마포구', regionCode: 'SEO', type: 'district' },
  { code: '11150', name: '양천구', regionCode: 'SEO', type: 'district' },
  { code: '11160', name: '강서구', regionCode: 'SEO', type: 'district' },
  { code: '11170', name: '구로구', regionCode: 'SEO', type: 'district' },
  { code: '11180', name: '금천구', regionCode: 'SEO', type: 'district' },
  { code: '11190', name: '영등포구', regionCode: 'SEO', type: 'district' },
  { code: '11200', name: '동작구', regionCode: 'SEO', type: 'district' },
  { code: '11210', name: '관악구', regionCode: 'SEO', type: 'district' },
  { code: '11220', name: '서초구', regionCode: 'SEO', type: 'district' },
  { code: '11230', name: '강남구', regionCode: 'SEO', type: 'district' },
  { code: '11240', name: '송파구', regionCode: 'SEO', type: 'district' },
  { code: '11250', name: '강동구', regionCode: 'SEO', type: 'district' },

  // 부산광역시
  { code: '21010', name: '중구', regionCode: 'BUS', type: 'district' },
  { code: '21020', name: '서구', regionCode: 'BUS', type: 'district' },
  { code: '21030', name: '동구', regionCode: 'BUS', type: 'district' },
  { code: '21040', name: '영도구', regionCode: 'BUS', type: 'district' },
  { code: '21050', name: '부산진구', regionCode: 'BUS', type: 'district' },
  { code: '21060', name: '동래구', regionCode: 'BUS', type: 'district' },
  { code: '21070', name: '남구', regionCode: 'BUS', type: 'district' },
  { code: '21080', name: '북구', regionCode: 'BUS', type: 'district' },
  { code: '21090', name: '해운대구', regionCode: 'BUS', type: 'district' },
  { code: '21100', name: '사하구', regionCode: 'BUS', type: 'district' },
  { code: '21110', name: '금정구', regionCode: 'BUS', type: 'district' },
  { code: '21120', name: '강서구', regionCode: 'BUS', type: 'district' },
  { code: '21130', name: '연제구', regionCode: 'BUS', type: 'district' },
  { code: '21140', name: '수영구', regionCode: 'BUS', type: 'district' },
  { code: '21150', name: '사상구', regionCode: 'BUS', type: 'district' },
  { code: '21310', name: '기장군', regionCode: 'BUS', type: 'county' },

  // 경기도 주요 시군
  { code: '31010', name: '수원시', regionCode: 'GYE', type: 'city' },
  { code: '31020', name: '성남시', regionCode: 'GYE', type: 'city' },
  { code: '31030', name: '의정부시', regionCode: 'GYE', type: 'city' },
  { code: '31040', name: '안양시', regionCode: 'GYE', type: 'city' },
  { code: '31050', name: '부천시', regionCode: 'GYE', type: 'city' },
  { code: '31060', name: '광명시', regionCode: 'GYE', type: 'city' },
  { code: '31070', name: '평택시', regionCode: 'GYE', type: 'city' },
  { code: '31080', name: '동두천시', regionCode: 'GYE', type: 'city' },
  { code: '31090', name: '안산시', regionCode: 'GYE', type: 'city' },
  { code: '31100', name: '고양시', regionCode: 'GYE', type: 'city' },
  { code: '31110', name: '과천시', regionCode: 'GYE', type: 'city' },
  { code: '31120', name: '구리시', regionCode: 'GYE', type: 'city' },
  { code: '31130', name: '남양주시', regionCode: 'GYE', type: 'city' },
  { code: '31140', name: '오산시', regionCode: 'GYE', type: 'city' },
  { code: '31150', name: '시흥시', regionCode: 'GYE', type: 'city' },
  { code: '31160', name: '군포시', regionCode: 'GYE', type: 'city' },
  { code: '31170', name: '의왕시', regionCode: 'GYE', type: 'city' },
  { code: '31180', name: '하남시', regionCode: 'GYE', type: 'city' },
  { code: '31190', name: '용인시', regionCode: 'GYE', type: 'city' },
  { code: '31200', name: '파주시', regionCode: 'GYE', type: 'city' },
  { code: '31210', name: '이천시', regionCode: 'GYE', type: 'city' },
  { code: '31220', name: '안성시', regionCode: 'GYE', type: 'city' },
  { code: '31230', name: '김포시', regionCode: 'GYE', type: 'city' },
  { code: '31240', name: '화성시', regionCode: 'GYE', type: 'city' },
  { code: '31250', name: '광주시', regionCode: 'GYE', type: 'city' },
  { code: '31260', name: '양주시', regionCode: 'GYE', type: 'city' },
  { code: '31270', name: '포천시', regionCode: 'GYE', type: 'city' },
  { code: '31280', name: '여주시', regionCode: 'GYE', type: 'city' },
  { code: '31350', name: '연천군', regionCode: 'GYE', type: 'county' },
  { code: '31370', name: '가평군', regionCode: 'GYE', type: 'county' },
  { code: '31380', name: '양평군', regionCode: 'GYE', type: 'county' },

  // 대구광역시
  { code: '22010', name: '중구', regionCode: 'DAE', type: 'district' },
  { code: '22020', name: '동구', regionCode: 'DAE', type: 'district' },
  { code: '22030', name: '서구', regionCode: 'DAE', type: 'district' },
  { code: '22040', name: '남구', regionCode: 'DAE', type: 'district' },
  { code: '22050', name: '북구', regionCode: 'DAE', type: 'district' },
  { code: '22060', name: '수성구', regionCode: 'DAE', type: 'district' },
  { code: '22070', name: '달서구', regionCode: 'DAE', type: 'district' },
  { code: '22310', name: '달성군', regionCode: 'DAE', type: 'county' },
  { code: '22080', name: '군위군', regionCode: 'DAE', type: 'county' },

  // 인천광역시
  { code: '23010', name: '중구', regionCode: 'INC', type: 'district' },
  { code: '23020', name: '동구', regionCode: 'INC', type: 'district' },
  { code: '23030', name: '미추홀구', regionCode: 'INC', type: 'district' },
  { code: '23040', name: '연수구', regionCode: 'INC', type: 'district' },
  { code: '23050', name: '남동구', regionCode: 'INC', type: 'district' },
  { code: '23060', name: '부평구', regionCode: 'INC', type: 'district' },
  { code: '23070', name: '계양구', regionCode: 'INC', type: 'district' },
  { code: '23080', name: '서구', regionCode: 'INC', type: 'district' },
  { code: '23310', name: '강화군', regionCode: 'INC', type: 'county' },
  { code: '23320', name: '옹진군', regionCode: 'INC', type: 'county' },

  // 광주광역시
  { code: '24010', name: '동구', regionCode: 'GWA', type: 'district' },
  { code: '24020', name: '서구', regionCode: 'GWA', type: 'district' },
  { code: '24030', name: '남구', regionCode: 'GWA', type: 'district' },
  { code: '24040', name: '북구', regionCode: 'GWA', type: 'district' },
  { code: '24050', name: '광산구', regionCode: 'GWA', type: 'district' },

  // 대전광역시
  { code: '25010', name: '동구', regionCode: 'DAJ', type: 'district' },
  { code: '25020', name: '중구', regionCode: 'DAJ', type: 'district' },
  { code: '25030', name: '서구', regionCode: 'DAJ', type: 'district' },
  { code: '25040', name: '유성구', regionCode: 'DAJ', type: 'district' },
  { code: '25050', name: '대덕구', regionCode: 'DAJ', type: 'district' },

  // 울산광역시
  { code: '26010', name: '중구', regionCode: 'ULS', type: 'district' },
  { code: '26020', name: '남구', regionCode: 'ULS', type: 'district' },
  { code: '26030', name: '동구', regionCode: 'ULS', type: 'district' },
  { code: '26040', name: '북구', regionCode: 'ULS', type: 'district' },
  { code: '26310', name: '울주군', regionCode: 'ULS', type: 'county' },

  // 세종특별자치시
  { code: '29010', name: '세종시', regionCode: 'SEJ', type: 'city' },

  // 강원특별자치도 주요 시군
  { code: '32010', name: '춘천시', regionCode: 'GAN', type: 'city' },
  { code: '32020', name: '원주시', regionCode: 'GAN', type: 'city' },
  { code: '32030', name: '강릉시', regionCode: 'GAN', type: 'city' },
  { code: '32040', name: '동해시', regionCode: 'GAN', type: 'city' },
  { code: '32050', name: '태백시', regionCode: 'GAN', type: 'city' },
  { code: '32060', name: '속초시', regionCode: 'GAN', type: 'city' },
  { code: '32070', name: '삼척시', regionCode: 'GAN', type: 'city' },
  { code: '32310', name: '홍천군', regionCode: 'GAN', type: 'county' },
  { code: '32320', name: '횡성군', regionCode: 'GAN', type: 'county' },
  { code: '32330', name: '영월군', regionCode: 'GAN', type: 'county' },
  { code: '32340', name: '평창군', regionCode: 'GAN', type: 'county' },
  { code: '32350', name: '정선군', regionCode: 'GAN', type: 'county' },
  { code: '32360', name: '철원군', regionCode: 'GAN', type: 'county' },
  { code: '32370', name: '화천군', regionCode: 'GAN', type: 'county' },
  { code: '32380', name: '양구군', regionCode: 'GAN', type: 'county' },
  { code: '32390', name: '인제군', regionCode: 'GAN', type: 'county' },
  { code: '32400', name: '고성군', regionCode: 'GAN', type: 'county' },
  { code: '32410', name: '양양군', regionCode: 'GAN', type: 'county' },

  // 충청북도 주요 시군
  { code: '33010', name: '청주시', regionCode: 'CHU', type: 'city' },
  { code: '33020', name: '충주시', regionCode: 'CHU', type: 'city' },
  { code: '33030', name: '제천시', regionCode: 'CHU', type: 'city' },
  { code: '33320', name: '보은군', regionCode: 'CHU', type: 'county' },
  { code: '33330', name: '옥천군', regionCode: 'CHU', type: 'county' },
  { code: '33340', name: '영동군', regionCode: 'CHU', type: 'county' },
  { code: '33350', name: '증평군', regionCode: 'CHU', type: 'county' },
  { code: '33360', name: '진천군', regionCode: 'CHU', type: 'county' },
  { code: '33370', name: '괴산군', regionCode: 'CHU', type: 'county' },
  { code: '33380', name: '음성군', regionCode: 'CHU', type: 'county' },
  { code: '33390', name: '단양군', regionCode: 'CHU', type: 'county' },

  // 충청남도 주요 시군
  { code: '34010', name: '천안시', regionCode: 'CHN', type: 'city' },
  { code: '34020', name: '공주시', regionCode: 'CHN', type: 'city' },
  { code: '34030', name: '보령시', regionCode: 'CHN', type: 'city' },
  { code: '34040', name: '아산시', regionCode: 'CHN', type: 'city' },
  { code: '34050', name: '서산시', regionCode: 'CHN', type: 'city' },
  { code: '34060', name: '논산시', regionCode: 'CHN', type: 'city' },
  { code: '34070', name: '계룡시', regionCode: 'CHN', type: 'city' },
  { code: '34080', name: '당진시', regionCode: 'CHN', type: 'city' },
  { code: '34310', name: '금산군', regionCode: 'CHN', type: 'county' },
  { code: '34330', name: '부여군', regionCode: 'CHN', type: 'county' },
  { code: '34340', name: '서천군', regionCode: 'CHN', type: 'county' },
  { code: '34350', name: '청양군', regionCode: 'CHN', type: 'county' },
  { code: '34360', name: '홍성군', regionCode: 'CHN', type: 'county' },
  { code: '34370', name: '예산군', regionCode: 'CHN', type: 'county' },
  { code: '34380', name: '태안군', regionCode: 'CHN', type: 'county' },

  // 전북특별자치도 주요 시군
  { code: '35010', name: '전주시', regionCode: 'JEO', type: 'city' },
  { code: '35020', name: '군산시', regionCode: 'JEO', type: 'city' },
  { code: '35030', name: '익산시', regionCode: 'JEO', type: 'city' },
  { code: '35040', name: '정읍시', regionCode: 'JEO', type: 'city' },
  { code: '35050', name: '남원시', regionCode: 'JEO', type: 'city' },
  { code: '35060', name: '김제시', regionCode: 'JEO', type: 'city' },
  { code: '35310', name: '완주군', regionCode: 'JEO', type: 'county' },
  { code: '35320', name: '진안군', regionCode: 'JEO', type: 'county' },
  { code: '35330', name: '무주군', regionCode: 'JEO', type: 'county' },
  { code: '35340', name: '장수군', regionCode: 'JEO', type: 'county' },
  { code: '35350', name: '임실군', regionCode: 'JEO', type: 'county' },
  { code: '35360', name: '순창군', regionCode: 'JEO', type: 'county' },
  { code: '35370', name: '고창군', regionCode: 'JEO', type: 'county' },
  { code: '35380', name: '부안군', regionCode: 'JEO', type: 'county' },

  // 전라남도 주요 시군
  { code: '36010', name: '목포시', regionCode: 'JEN', type: 'city' },
  { code: '36020', name: '여수시', regionCode: 'JEN', type: 'city' },
  { code: '36030', name: '순천시', regionCode: 'JEN', type: 'city' },
  { code: '36040', name: '나주시', regionCode: 'JEN', type: 'city' },
  { code: '36050', name: '광양시', regionCode: 'JEN', type: 'city' },
  { code: '36310', name: '담양군', regionCode: 'JEN', type: 'county' },
  { code: '36320', name: '곡성군', regionCode: 'JEN', type: 'county' },
  { code: '36330', name: '구례군', regionCode: 'JEN', type: 'county' },
  { code: '36340', name: '고흥군', regionCode: 'JEN', type: 'county' },
  { code: '36350', name: '보성군', regionCode: 'JEN', type: 'county' },
  { code: '36360', name: '화순군', regionCode: 'JEN', type: 'county' },
  { code: '36370', name: '장흥군', regionCode: 'JEN', type: 'county' },
  { code: '36380', name: '강진군', regionCode: 'JEN', type: 'county' },
  { code: '36390', name: '해남군', regionCode: 'JEN', type: 'county' },
  { code: '36400', name: '영암군', regionCode: 'JEN', type: 'county' },
  { code: '36410', name: '무안군', regionCode: 'JEN', type: 'county' },
  { code: '36420', name: '함평군', regionCode: 'JEN', type: 'county' },
  { code: '36430', name: '영광군', regionCode: 'JEN', type: 'county' },
  { code: '36440', name: '장성군', regionCode: 'JEN', type: 'county' },
  { code: '36450', name: '완도군', regionCode: 'JEN', type: 'county' },
  { code: '36460', name: '진도군', regionCode: 'JEN', type: 'county' },
  { code: '36470', name: '신안군', regionCode: 'JEN', type: 'county' },

  // 경상북도 주요 시군
  { code: '37010', name: '포항시', regionCode: 'GYB', type: 'city' },
  { code: '37020', name: '경주시', regionCode: 'GYB', type: 'city' },
  { code: '37030', name: '김천시', regionCode: 'GYB', type: 'city' },
  { code: '37040', name: '안동시', regionCode: 'GYB', type: 'city' },
  { code: '37050', name: '구미시', regionCode: 'GYB', type: 'city' },
  { code: '37060', name: '영주시', regionCode: 'GYB', type: 'city' },
  { code: '37070', name: '영천시', regionCode: 'GYB', type: 'city' },
  { code: '37080', name: '상주시', regionCode: 'GYB', type: 'city' },
  { code: '37090', name: '문경시', regionCode: 'GYB', type: 'city' },
  { code: '37100', name: '경산시', regionCode: 'GYB', type: 'city' },
  { code: '37310', name: '의성군', regionCode: 'GYB', type: 'county' },
  { code: '37320', name: '청송군', regionCode: 'GYB', type: 'county' },
  { code: '37330', name: '영양군', regionCode: 'GYB', type: 'county' },
  { code: '37340', name: '영덕군', regionCode: 'GYB', type: 'county' },
  { code: '37350', name: '청도군', regionCode: 'GYB', type: 'county' },
  { code: '37360', name: '고령군', regionCode: 'GYB', type: 'county' },
  { code: '37370', name: '성주군', regionCode: 'GYB', type: 'county' },
  { code: '37380', name: '칠곡군', regionCode: 'GYB', type: 'county' },
  { code: '37390', name: '예천군', regionCode: 'GYB', type: 'county' },
  { code: '37400', name: '봉화군', regionCode: 'GYB', type: 'county' },
  { code: '37410', name: '울진군', regionCode: 'GYB', type: 'county' },
  { code: '37420', name: '울릉군', regionCode: 'GYB', type: 'county' },

  // 경상남도 주요 시군
  { code: '38010', name: '창원시', regionCode: 'GYN', type: 'city' },
  { code: '38020', name: '진주시', regionCode: 'GYN', type: 'city' },
  { code: '38030', name: '통영시', regionCode: 'GYN', type: 'city' },
  { code: '38040', name: '사천시', regionCode: 'GYN', type: 'city' },
  { code: '38050', name: '김해시', regionCode: 'GYN', type: 'city' },
  { code: '38060', name: '밀양시', regionCode: 'GYN', type: 'city' },
  { code: '38070', name: '거제시', regionCode: 'GYN', type: 'city' },
  { code: '38080', name: '양산시', regionCode: 'GYN', type: 'city' },
  { code: '38310', name: '의령군', regionCode: 'GYN', type: 'county' },
  { code: '38320', name: '함안군', regionCode: 'GYN', type: 'county' },
  { code: '38330', name: '창녕군', regionCode: 'GYN', type: 'county' },
  { code: '38340', name: '고성군', regionCode: 'GYN', type: 'county' },
  { code: '38350', name: '남해군', regionCode: 'GYN', type: 'county' },
  { code: '38360', name: '하동군', regionCode: 'GYN', type: 'county' },
  { code: '38370', name: '산청군', regionCode: 'GYN', type: 'county' },
  { code: '38380', name: '함양군', regionCode: 'GYN', type: 'county' },
  { code: '38390', name: '거창군', regionCode: 'GYN', type: 'county' },
  { code: '38400', name: '합천군', regionCode: 'GYN', type: 'county' },

  // 제주특별자치도
  { code: '39010', name: '제주시', regionCode: 'JEJ', type: 'city' },
  { code: '39020', name: '서귀포시', regionCode: 'JEJ', type: 'city' },
];

// 코드 → 이름 매핑
export const CITY_CODE_TO_NAME: Record<string, string> = CITIES.reduce(
  (acc, city) => ({ ...acc, [city.code]: city.name }),
  {}
);

// 지역별 시군구 그룹핑
export const CITIES_BY_REGION: Record<string, City[]> = CITIES.reduce(
  (acc, city) => {
    if (!acc[city.regionCode]) {
      acc[city.regionCode] = [];
    }
    acc[city.regionCode].push(city);
    return acc;
  },
  {} as Record<string, City[]>
);

/**
 * 시군구 코드로 이름 가져오기
 */
export function getCityName(code: string): string {
  return CITY_CODE_TO_NAME[code] || code;
}

/**
 * 지역별 시군구 목록 가져오기
 */
export function getCitiesByRegion(regionCode: string): City[] {
  return CITIES_BY_REGION[regionCode] || [];
}

/**
 * 시군구 검색
 */
export function searchCities(query: string): City[] {
  return CITIES.filter(city =>
    city.name.includes(query) ||
    city.code.includes(query)
  );
}

/**
 * 시군구 코드 배열을 이름 배열로 변환
 * DB에는 실제 이름이 저장되어 있으므로, 코드가 아닌 이름을 그대로 반환
 */
export function mapCityCodesToNames(codes?: string[] | null): string[] | null {
  if (!codes || codes.length === 0) {
    return null;
  }

  // 코드가 숫자로 시작하면 코드로 간주하여 변환
  // 그렇지 않으면 이미 이름이므로 그대로 반환
  return codes.map(code => {
    if (/^\d/.test(code)) {
      return getCityName(code);
    }
    return code; // 이미 이름인 경우 그대로 반환
  });
}

/**
 * 전체 시군구 목록 (드롭다운용)
 */
export function getAllCities(): City[] {
  return CITIES;
}