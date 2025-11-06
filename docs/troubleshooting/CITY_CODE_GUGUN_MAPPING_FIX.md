# City Code to Gugun Mapping Fix
## 고현아 데이터 조회 불가 문제 해결

**작성 날짜**: 2025-11-06
**해결 상태**: 완료
**영향 범위**: local_admin 사용자 전체 (10명)

---

## 1. 문제 분석

### 증상
- 제주도 서귀포시 보건소 담당자 고현아가 데이터 조회 불가
- 다른 지역 local_admin 사용자들도 유사한 문제 발생 가능
- API에서 응답 데이터 없음 (Empty result set)

### 근본 원인
**City Code와 Gugun의 포맷 불일치**

| 항목 | 형식 | 저장 위치 | 예시 |
|------|------|----------|------|
| City Code | 영문 | organizations.city_code | "seogwipo" |
| Gugun | 한글 | aed_data.gugun | "서귀포시" |

**문제의 연쇄 과정**:
1. 고현아의 organization.city_code = "seogwipo" (영문)
2. API의 `resolveAccessScope`에서 allowedCityCodes = ["seogwipo"] 설정
3. API 쿼리에서 `aed_data.gugun = "seogwipo"` 검색
4. 실제 DB에는 gugun = "서귀포시" (한글)이므로 매칭 안 됨
5. **결과: 데이터 조회 불가**

---

## 2. 검증 결과

### 두 관점에서 일관성 검증

#### Perspective 1: 지역별 일관성 ✓ 통과
- 모든 18개 지역이 영문 city_code로 통일
- 0개 지역에서 혼합 포맷(한글/영문) 사용
- **결론**: 지역 데이터 포맷은 일관됨

#### Perspective 2: 사용자 계정 일관성 ✓ 통과
- 10명의 local_admin 사용자 모두 영문 city_code 보유
- 세종 담당자만 city_code=null (예외)
- **결론**: 모든 사용자가 일관된 영문 city_code 사용

### 식별된 City Code 매핑 필요 항목

**제주도 (JEJ)**:
- jeju → 제주시
- seogwipo → 서귀포시

**대구광역시 (DAE)**:
- jung → 중구
- dalseo → 달서구
- buk → 북구
- suseong → 수성구
- seo → 서구

**인천광역시 (INC)**:
- namdong → 남동구
- ganghwa → 강화군
- gyeyang → 계양구
- michuhol → 미추홀구
- bupyeong → 부평구
- yeonsu → 연수구
- ongjin → 옹진군
- jung_yeongjong → 영종

**경남 (GYN)**:
- gimhae → 김해시

**충청북도 (CHB)**:
- goesan → 괴산군
- danyang → 단양군
- boeun → 보은군
- yeongdong → 영동군
- okcheon → 옥천군
- eumseong → 음성군
- jecheon → 제천시
- jeungpyeong → 증평군
- jincheon → 진천군
- cheongju → 청주시
- chungju → 충주시

**세종특별자치시 (SEJ)**:
- seju → 세종특별자치시

---

## 3. 구현된 해결책

### 3.1 RegionFilter.tsx - Frontend 매핑
**파일**: `components/layout/RegionFilter.tsx`

```typescript
// city_code를 실제 gugun 이름으로 변환
const CITY_CODE_TO_GUGUN_MAP: Record<string, string> = {
  // 제주도 (JEJ)
  'jeju': '제주시',
  'seogwipo': '서귀포시',

  // 대구광역시 (DAE), 인천, 경남, 충북, 세종...
  // 전체 매핑 추가됨 (위 섹션 2 참고)
};

function mapCityCodeToGugun(cityCode: string | undefined): string {
  if (!cityCode) return '구군';
  return CITY_CODE_TO_GUGUN_MAP[cityCode] || cityCode;
}
```

**역할**:
- local_admin 사용자의 city_code를 화면에 표시할 한글 gugun 이름으로 변환
- 사용자가 선택한 지역값이 실제 AED 데이터의 gugun 필드와 일치

### 3.2 access-control.ts - Backend 매핑
**파일**: `lib/auth/access-control.ts`

```typescript
const CITY_CODE_TO_GUGUN_MAP: Record<string, string> = {
  // RegionFilter.tsx와 동일한 매핑
};

function mapCityCodeToGugun(cityCode: string | null | undefined): string | null {
  if (!cityCode) return null;
  return CITY_CODE_TO_GUGUN_MAP[cityCode] || cityCode;
}

// resolveAccessScope 함수 내에서:
if (userProfile.role === 'local_admin') {
  const cityCode = userProfile.organization?.city_code;
  if (cityCode) {
    // city_code를 실제 gugun 이름으로 변환
    const mappedGugun = mapCityCodeToGugun(cityCode);
    allowedCityCodes = mappedGugun ? [mappedGugun] : [cityCode];
  }
}
```

**역할**:
- API 권한 검증에서 allowedCityCodes를 설정할 때 city_code를 한글 gugun으로 변환
- 이후 쿼리에서 `aed_data.gugun = "서귀포시"` 등으로 정확하게 검색 가능

---

## 4. 데이터 흐름 확인

### Before (문제 상황)
```
1. Frontend: 사용자 city_code = "seogwipo"
2. RegionFilter: 매핑 없음 → "seogwipo" 그대로 전송
3. API: allowedCityCodes = ["seogwipo"]
4. Query: SELECT * FROM aed_data WHERE gugun = "seogwipo"
5. Result: ❌ 매칭 안 됨 (실제 gugun = "서귀포시")
```

### After (해결 후)
```
1. Frontend: 사용자 city_code = "seogwipo"
2. RegionFilter: mapCityCodeToGugun("seogwipo") → "서귀포시"
3. API: allowedCityCodes = ["서귀포시"]
4. Query: SELECT * FROM aed_data WHERE gugun = "서귀포시"
5. Result: ✓ 정상 조회
```

---

## 5. 검증 체크리스트

- [x] TypeScript 타입 검사 통과
- [x] Production 빌드 성공
- [x] RegionFilter.tsx에 매핑 추가
- [x] access-control.ts에 매핑 추가
- [x] 모든 식별된 city_code 포함
- [x] 두 파일의 매핑 동기화
- [x] Fallback 로직 구현 (미지원 city_code는 원본 사용)

---

## 6. 향후 개선사항

### 단기 (필수)
1. **통일된 매핑 위치**: 현재 RegionFilter와 access-control에 중복됨
   - 향후 `lib/utils/city-code-mapping.ts` 같은 중앙 집중식 파일로 통합 가능

2. **세종 보건소 city_code 추가**: 현재 null 상태
   - organization.city_code = "seju" 설정 필요

### 중기 (권장)
1. **매핑 자동 생성**: AED 데이터와 organizations 테이블을 분석하여 자동으로 매핑 생성
2. **DB 레벨 매핑**: VIEW나 함수로 city_code → gugun 변환을 쿼리 시점에 처리
3. **정기적 검증**: 새로운 city_code 추가 시 매핑이 함께 추가되는지 확인

### 장기 (구조 개선)
1. **city_code 표준화**: organizations 테이블에 city_code 대신 직접 gugun 저장
   - 마이그레이션 비용 vs 일관성 향상 고려
2. **AED 데이터 정규화**: city_code 필드 추가로 매핑 제거

---

## 7. 관련 파일 목록

| 파일 | 변경 사항 | 라인 |
|------|---------|------|
| components/layout/RegionFilter.tsx | CITY_CODE_TO_GUGUN_MAP 추가 | 38-78 |
| lib/auth/access-control.ts | 매핑 함수 추가, allowedCityCodes 수정 | 10-60, 587-590 |
| scripts/validate-city-code-consistency.ts | 검증 스크립트 (실행 완료) | - |

---

## 8. 테스트 방법

### Frontend 테스트
1. 고현아 계정으로 로그인
2. RegionFilter에서 "서귀포시"가 표시되는지 확인
3. AED 지도에서 서귀포 지역 데이터가 로드되는지 확인

### API 테스트
```bash
# curl로 API 직접 테스트
curl -H "Authorization: Bearer TOKEN" \
  "https://aed.pics/api/aed-data?regionCodes=JEJ&cityCodes=서귀포시"
```

### 데이터베이스 검증
```sql
-- 서귀포시 AED 데이터 확인
SELECT COUNT(*) FROM aed_data
WHERE gugun = '서귀포시';

-- 고현아의 organization 확인
SELECT id, name, city_code, region_code
FROM organizations
WHERE id = (SELECT organization_id FROM user_profiles WHERE full_name = '고현아');
```

---

## 9. 문제 해결 히스토리

| 날짜 | 상황 | 조치 |
|------|------|------|
| 2025-11-05 | 초기 문제 발견 | 원인 분석 시작 |
| 2025-11-06 | 근본 원인 파악 | city_code vs gugun 포맷 불일치 |
| 2025-11-06 | 두 관점 검증 완료 | 모든 city_code 목록 확보 |
| 2025-11-06 | RegionFilter 수정 | CITY_CODE_TO_GUGUN_MAP 추가 |
| 2025-11-06 | access-control 수정 | allowedCityCodes 매핑 적용 |
| 2025-11-06 | 빌드 검증 완료 | TypeScript, ESLint, Build 모두 통과 |

---

## 10. 핵심 교훈

1. **외부 데이터 포맷의 다양성 인식**
   - 조직에 저장된 city_code(영문)과 AED 데이터의 gugun(한글)이 다름
   - 매핑 레이어 필수

2. **양방향 검증의 중요성**
   - Frontend에서만 처리하면 API 직접 호출 시 오류 발생
   - Backend에서도 동일한 매핑 필요

3. **조직-데이터 간 일관성 유지**
   - 새로운 city_code 추가 시 매핑도 함께 추가
   - 정기적인 검증 자동화 권장

---

**최종 상태**: ✅ 모든 changes committed and deployed
**다음 단계**: 프로덕션 환경에서 고현아 계정으로 데이터 조회 확인
