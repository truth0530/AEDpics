# 🌏 지역 코드 관리 가이드라인

> **⚠️ 중요**: 이 시스템에서 지역 코드는 모든 기능의 핵심입니다.
> 데이터 조회, 권한 관리, 대시보드, 보고서 등 모든 곳에서 **반드시 이 가이드를 준수**해야 합니다.

## 📌 핵심 원칙

### 1. **단일 진실의 원천 (Single Source of Truth)**
- 모든 지역 코드 정의는 **`lib/constants/regions.ts`** 에만 존재
- 절대 하드코딩하지 않음
- 모든 변환/매핑 로직은 regions.ts의 함수 사용

### 2. **3가지 지역 표현 형식**

| 형식 | 예시 | 용도 | 소스 |
|------|------|------|------|
| **정식명칭** | "충청남도", "대구광역시" | DB 원본, 공식 문서 | 카카오맵 API |
| **짧은 이름** | "충남", "대구" | UI 표시, 필터 | `REGIONS.label` |
| **지역 코드** | "CHN", "DAE" | 내부 로직, 권한 관리 | `REGIONS.code` |

### 3. **절대 금지 사항**

```typescript
// ❌ 절대 하지 말 것
const region = "충청남도".replace("도", ""); // "충청남" (잘못된 값!)
const region = sido.slice(0, 2); // 예측 불가능한 결과
const region = "충남"; // 하드코딩

// ✅ 반드시 이렇게
import { REGION_LABEL_TO_CODE, REGIONS } from '@/lib/constants/regions';
const code = REGION_LABEL_TO_CODE["충청남도"]; // "CHN"
const label = REGIONS.find(r => r.code === code)?.label; // "충남"
```

## 🔄 주요 사용 사례

### Case 1: 카카오맵 역지오코딩 (지도 → 지역명)

```typescript
// MapView.tsx 예시
import { REGION_LABEL_TO_CODE, REGIONS } from '@/lib/constants/regions';

geocoder.coord2RegionCode(lng, lat, function(result, status) {
  const sidoFull = result.region_1depth_name; // "충청남도"

  // ✅ 정식명칭 → 짧은 이름 변환
  const regionCode = REGION_LABEL_TO_CODE[sidoFull];
  const sidoShort = regionCode
    ? REGIONS.find(r => r.code === regionCode)?.label
    : sidoFull;

  // sidoShort = "충남" (DB와 일치!)
});
```

### Case 2: 관할 보건소 ↔ 시군구 매칭

```typescript
// 보건소명에서 지역 추출
const healthCenter = "대구광역시 수성구 보건소";

// ✅ 올바른 방법
import { extractRegionFromOrgName } from '@/lib/utils/region-matcher';
const { sido, gugun } = extractRegionFromOrgName(healthCenter);
// sido: "대구", gugun: "수성구"
```

### Case 3: 회원가입 시 소속기관 선택

```typescript
// organizations 테이블의 region_code 사용
// ✅ 이미 표준화된 코드 사용
const org = {
  region_code: "DAE",  // organizations 테이블에 저장된 값
  city_code: "수성구"
};

// 표시용 변환
const displayName = REGIONS.find(r => r.code === org.region_code)?.label;
// displayName: "대구"
```

### Case 4: 필터/드롭다운 UI

```typescript
// ✅ REGIONS 직접 사용
import { REGIONS } from '@/lib/constants/regions';

<Select>
  {REGIONS.map(region => (
    <Option key={region.code} value={region.label}>
      {region.label}
    </Option>
  ))}
</Select>

// 선택된 값: region.label ("충남", "대구" 등)
// API 전송 시: 그대로 사용 (DB와 일치)
```

## 📊 데이터 흐름도

```
카카오맵 API           프론트엔드              백엔드              데이터베이스
─────────────         ────────────           ────────           ─────────────
"충청남도"              "충남"                "충남"              "충남"
   │                    │                     │                  │
   │  REGION_LABEL_     │                     │                  │
   │  TO_CODE 변환      │   필터/쿼리          │   SQL WHERE      │
   └──────────────────→ └───────────────────→ └────────────────→ │
                                                                  │
"대구광역시 수성구"      "대구", "수성구"      "대구", "수성구"     sido="대구"
보건소                                                            gugun="수성구"
```

## 🛠️ 유틸리티 함수

### regions.ts에서 제공하는 함수들

```typescript
// 1. 정식명칭 → 코드
REGION_LABEL_TO_CODE["충청남도"] // "CHN"

// 2. 코드 → 짧은 이름
REGIONS.find(r => r.code === "CHN")?.label // "충남"

// 3. 짧은 이름 → 좌표
REGIONS.find(r => r.label === "충남")?.latitude // 36.5184

// 4. 코드 → 정식명칭
REGION_CODE_TO_LABEL["CHN"] // "충청남도"

// 5. 별칭 목록
REGION_ALIASES["CHN"] // ["충청남도", "충남"]
```

## 🔍 일관성 검증

### DB 데이터 검증 쿼리

```sql
-- aed_data 테이블의 sido 값이 REGIONS.label과 일치하는지 확인
SELECT DISTINCT sido
FROM aed_data
WHERE sido NOT IN ('서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
                   '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주');

-- organizations 테이블의 region_code가 유효한지 확인
SELECT DISTINCT region_code
FROM organizations
WHERE region_code NOT IN ('SEO', 'BUS', 'DAE', 'INC', 'GWA', 'DAJ', 'ULS', 'SEJ',
                          'GYE', 'GAN', 'CHB', 'CHN', 'JEB', 'JEN', 'GYB', 'GYN', 'JEJ', 'KR');
```

### 코드 검증 체크리스트

- [ ] 지역명을 정규식으로 처리하지 않았는가?
- [ ] 하드코딩된 지역명이 없는가?
- [ ] regions.ts의 함수를 사용했는가?
- [ ] 변환된 값이 DB의 실제 값과 일치하는가?

## 📝 수정 이력

| 날짜 | 변경 내용 | 담당자 |
|------|----------|--------|
| 2025-01-05 | 초기 가이드라인 작성 | Claude |
| 2025-01-05 | MapView.tsx 정규식 문제 수정 | Claude |

## 🚨 문제 발생 시

1. **먼저 확인**: `/lib/constants/regions.ts` 파일
2. **변환 로직 확인**: 이 가이드라인의 예시 참고
3. **DB 데이터 확인**: 실제 저장된 값과 비교
4. **문의**: 이 가이드라인을 업데이트하거나 팀과 공유

---

**마지막 업데이트**: 2025-01-05
**작성자**: AED 픽스 개발팀
**중요도**: ⭐⭐⭐⭐⭐ (최고)
