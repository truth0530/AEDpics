# AED 데이터 접근 권한 규칙 정리

**문서 타입**: 운영 매뉴얼 (간결한 권한 규칙 참조)
**최종 수정**: 2025-10-18
**관련 문서**: [region-code-policy-comparison.md](../analysis/region-code-policy-comparison.md) (상세 분석 및 구현 계획)

> **📌 Note**: 본 문서는 일상 운영을 위한 빠른 참조용입니다.
> 상세한 분석, 보안 취약점, 구현 계획은 [region-code-policy-comparison.md](../analysis/region-code-policy-comparison.md)를 참조하세요.

---

## 도메인별 역할 제한 (중요)

| 도메인 | 허용 역할 | 접근 범위 |
|--------|----------|----------|
| **@nmc.or.kr** | emergency_center_admin, regional_emergency_center_admin | 전국 |
| **@korea.kr** | ministry_admin, regional_admin, local_admin | 전국 or 소속 지역 |
| **기타 도메인** | temporary_inspector | 할당된 장비만 |

⚠️ **보안 주의**: 도메인과 역할이 일치하지 않으면 접근 거부됩니다.

---

## 권한별 데이터 필터링 규칙

### 1. 전국 권한 (필터 제한 없음)

| 역할 | 이메일 도메인 | 시도 필터 | 시군구 필터 | 설명 |
|-----|-------------|----------|-----------|------|
| **master** | - | 제한 없음 (NULL) | 제한 없음 (NULL) | 모든 데이터 조회 가능 |
| **emergency_center_admin** | @nmc.or.kr | 제한 없음 (NULL) | 제한 없음 (NULL) | 중앙응급의료센터 및 시도 응급의료지원센터 |
| **ministry_admin** | @korea.kr | 제한 없음 (NULL) | 제한 없음 (NULL) | 보건복지부 |

#### 특징:
- `allowedRegionCodes = null` (17개 시도 모두 선택 가능)
- `allowedCityCodes = null` (모든 시군구 선택 가능)
- 필터를 선택하지 않아도 전체 데이터 조회 가능
- `requiresRegionFilter = false`
- `requiresCityFilter = false`

### 2. 시도 권한 (시도 고정, 시군구 선택 가능)

| 역할 | 이메일 도메인 | 시도 필터 | 시군구 필터 | 설명 |
|-----|-------------|----------|-----------|------|
| **regional_admin** | @korea.kr | 소속 시도 고정 | 선택 가능 (NULL) | 시청/도청 관리자 |

#### 특징:
- `allowedRegionCodes = [소속 시도 코드]` (예: ['SEO'])
- `allowedCityCodes = null` (해당 시도 내 모든 시군구 선택 가능)
- 소속 시도는 자동으로 필터에 적용됨
- `requiresRegionFilter = true` (시도 필수)
- `requiresCityFilter = false` (시군구 선택적)

### 3. 시군구 권한 (시도 및 시군구 모두 고정)

| 역할 | 이메일 도메인 | 시도 필터 | 시군구 필터 | 설명 |
|-----|-------------|----------|-----------|------|
| **local_admin** | @korea.kr | 소속 시도 고정 | 소속 시군구 고정 | 보건소 관리자 |

#### 특징:
- `allowedRegionCodes = [소속 시도 코드]` (예: ['SEO'])
- `allowedCityCodes = [소속 시군구 코드]` (예: ['강남구'])
- 필터가 자동으로 소속 지역으로 고정됨
- `requiresRegionFilter = true` (시도 필수)
- `requiresCityFilter = true` (시군구 필수)
- **두 가지 조회 기준 선택 가능**:
  - 주소 기준: 해당 시군구에 물리적으로 설치된 AED
  - 관할보건소 기준: 해당 보건소가 관리하는 AED (타 지역 포함 가능)

### 4. 제한적 권한

| 역할 | 접근 가능 여부 | 설명 |
|-----|--------------|------|
| **temporary_inspector** | ❌ 불가 | AED 데이터 조회 불가, 할당된 점검만 수행 |
| **pending_approval** | ❌ 불가 | 승인 대기 중 |
| **email_verified** | ❌ 불가 | 이메일만 인증된 상태 |

## 실제 구현 예시

### API 레벨 필터 적용 (`/app/api/aed-data/route.ts`)

```typescript
// 접근 범위 계산
const accessScope = resolveAccessScope(userProfile);

// 권한에 따른 필터 강제 적용
const enforcedFilters = {
  regionCodes: accessScope.allowedRegionCodes || requestedFilters.regionCodes,
  cityCodes: accessScope.allowedCityCodes || requestedFilters.cityCodes
};

// NULL인 경우 사용자가 자유롭게 선택 가능
// 값이 있는 경우 해당 값으로 고정
```

### RPC 함수에서의 필터 적용

```sql
-- 주소 기준 조회
WHERE
  -- 시도 필터
  (p_region_codes IS NULL OR a.sido IN (
    -- region_codes를 시도명으로 변환
  ))
  AND
  -- 시군구 필터
  (p_city_codes IS NULL OR a.gugun = ANY(p_city_codes))
```

## 권한별 테스트 시나리오

### 1. master 계정 테스트
```javascript
// 필터 없이 조회 - 성공해야 함
fetch('/api/aed-data?criteria=address')

// 특정 시도 선택 - 성공해야 함
fetch('/api/aed-data?criteria=address&region=SEO')

// 여러 시도 선택 - 성공해야 함
fetch('/api/aed-data?criteria=address&region=SEO&region=BUS')
```

### 2. regional_admin 테스트 (서울시청 소속)
```javascript
// 필터 없이 조회 - 자동으로 서울 데이터만
fetch('/api/aed-data?criteria=address')

// 다른 시도 선택 시도 - 403 에러
fetch('/api/aed-data?criteria=address&region=BUS')

// 서울 내 구 선택 - 성공
fetch('/api/aed-data?criteria=address&city=강남구')
```

### 3. local_admin 테스트 (서울 강남구 보건소)
```javascript
// 필터 없이 조회 - 자동으로 서울 강남구 데이터만
fetch('/api/aed-data?criteria=address')

// 다른 구 선택 시도 - 403 에러
fetch('/api/aed-data?criteria=address&city=서초구')

// 관할보건소 기준 조회 - 타 지역 포함 가능
fetch('/api/aed-data?criteria=jurisdiction')
```

## 중요 포인트

1. **데이터 마스킹 X, 데이터 필터링 O**
   - 민감 정보를 가리는 것이 아니라 권한 없는 지역 데이터를 아예 보여주지 않음

2. **자동 필터 적용**
   - regional_admin, local_admin은 소속 지역이 자동으로 필터에 적용됨
   - 사용자가 필터를 선택하지 않아도 자동 적용

3. **필터 우회 방지**
   - 클라이언트에서 다른 지역을 요청해도 서버에서 차단
   - `enforceFilterPolicy` 함수가 이를 담당

4. **관할보건소 기준 조회**
   - local_admin(보건소)만 사용 가능
   - 물리적 위치와 관리 주체가 다른 경우를 위한 기능

## 실행 체크리스트

### 오늘
- [ ] 역할별 브라우저 테스트 수행 후 `/docs/AED_DATA_ACCESS_RULES.md`에 결과 기록
- [ ] `regional_admin`·`local_admin`의 403 응답 캡처 및 아카이브

### 이번 주
- [ ] Supabase RPC 보안 검증(`validate_role_filters`) 추가 후 재테스트
- [ ] 역할별 API 단위 테스트 작성 (master/지역/보건소)

### 추후
- [ ] `display_allowed` 기반 권한 처리 보강 사항 정리
- [ ] 성능/인덱스 점검 결과 반영

## 추가 개선 사항

### 구현 완료
- ✅ RPC 함수에서 p_user_role 활용
- ✅ 비공개 데이터(display_allowed) 권한별 처리
- ✅ 성능 최적화를 위한 인덱스 추가

### 향후 개선 방향
- 감사 로그 강화 (접근 이력 추적)
- 더 세분화된 지역별 권한 관리

---
*작성일: 2025-09-21*
*최종 수정: 2025-10-03 구현 상태 반영*
