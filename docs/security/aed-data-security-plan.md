# AED 데이터 보안 최종 구현 계획

## 🎯 핵심 원칙
**마스킹 ❌ 필터링 ✅** - 권한 없는 지역 데이터는 아예 제공하지 않음

## 📊 권한별 필터링 매트릭스

| 역할 | 이메일 도메인 | allowedRegionCodes | allowedCityCodes | 필수 필터 | 자동 적용 |
|-----|-------------|-------------------|------------------|----------|----------|
| **master** | - | `null` (전국) | `null` (전체) | 없음 | ❌ |
| **emergency_center_admin** | @nmc.or.kr | `null` (전국) | `null` (전체) | 없음 | ❌ |
| **ministry_admin** | @korea.kr | `null` (전국) | `null` (전체) | 없음 | ❌ |
| **regional_admin** | @korea.kr | `[소속시도]` | `null` (시도내 전체) | sido | ✅ |
| **local_admin** | @korea.kr | `[소속시도]` | `[소속시군구]` | sido, gugun | ✅ |
| **temporary_inspector** | - | Error | Error | - | - |
| **pending_approval** | - | Block | Block | - | - |
| **email_verified** | - | Block | Block | - | - |

## 🔐 3단계 보안 레이어 구현

### Layer 1: API 레벨 필터링
**파일**: `app/api/aed-data/route.ts` (라인 56-102)

```typescript
// 현재 구현 검증 포인트
const accessScope = resolveAccessScope(userProfile);  // ✅ 구현됨

// enforceFilterPolicy에서 처리해야 할 로직
const enforcementResult = enforceFilterPolicy({
  userProfile,
  accessScope,
  requestedFilters: filters,
});

// 검증 필요 사항:
// 1. regional_admin이 필터 미제공 시 → 소속 시도 자동 주입 ✅
// 2. regional_admin이 타 시도 요청 시 → 403 반환 ⚠️ 확인 필요
// 3. local_admin이 필터 미제공 시 → 소속 시도/시군구 자동 주입 ✅
// 4. local_admin이 타 지역 요청 시 → 403 반환 ⚠️ 확인 필요
```

**수정 필요 코드**:
```typescript
// lib/aed/filter-policy.ts 수정
export function enforceFilterPolicy({
  userProfile,
  accessScope,
  requestedFilters,
}: FilterEnforcementParams): FilterEnforcementResult {
  // ... 기존 코드

  // 권한별 자동 필터 적용
  if (userProfile.role === 'regional_admin' || userProfile.role === 'local_admin') {
    // allowedRegionCodes가 있으면 강제 적용
    if (accessScope.allowedRegionCodes) {
      if (!requestedFilters.regionCodes?.length) {
        // 필터 미제공 시 자동 적용
        regionCodes = accessScope.allowedRegionCodes;
        appliedDefaults.push('sido');
      } else {
        // 제공된 필터가 허용 범위 내인지 검증
        const unauthorized = requestedFilters.regionCodes.filter(
          code => !accessScope.allowedRegionCodes!.includes(code)
        );
        if (unauthorized.length > 0) {
          return {
            success: false,
            status: 403,
            reason: '허용되지 않은 시도 코드가 포함되어 있습니다',
            unauthorizedRegions: unauthorized,
            // ...
          };
        }
      }
    }
    // 시군구도 동일한 로직 적용
  }
}
```

### Layer 2: Filter Policy 검증
**파일**: `lib/aed/filter-policy.ts`

```typescript
// 역할별 필터 정책 (현재 상태 확인)
const ROLE_FILTER_POLICY: Record<UserRole, FilterPolicy> = {
  master: {
    required: [],  // ✅ 올바름
    requireOneOf: undefined,  // ⚠️ 제거 필요
  },
  emergency_center_admin: {
    required: [],  // ✅ 올바름
    requireOneOf: undefined,  // ⚠️ 제거 필요
  },
  ministry_admin: {
    required: [],  // ✅ 올바름
    requireOneOf: undefined,  // ⚠️ 제거 필요
  },
  regional_admin: {
    required: ['sido'],  // ✅ 올바름
    requireOneOf: undefined,
  },
  local_admin: {
    required: ['sido', 'gugun'],  // ✅ 올바름
    requireOneOf: undefined,
  },
  // ...
};
```

### Layer 3: RPC 함수 보안 강화
**파일**: `supabase/add_security_to_rpc.sql` (새로 생성)

```sql
-- RPC 함수 보안 검증 추가
-- 이 스크립트는 fix_aed_data_functions_v2_corrected.sql 적용 후 실행

-- 1. 역할별 필터 검증 함수 생성
CREATE OR REPLACE FUNCTION validate_role_filters(
  p_role TEXT,
  p_regions TEXT[],
  p_cities TEXT[]
) RETURNS VOID AS $$
BEGIN
  -- regional_admin 검증
  IF p_role = 'regional_admin' THEN
    IF p_regions IS NULL OR array_length(p_regions, 1) = 0 THEN
      RAISE EXCEPTION 'regional_admin must provide region filter'
        USING HINT = 'Region filter is required for regional administrators';
    END IF;
    -- 추가: 단일 시도만 허용
    IF array_length(p_regions, 1) > 1 THEN
      RAISE EXCEPTION 'regional_admin can only access one region'
        USING HINT = 'Multiple regions not allowed for regional administrators';
    END IF;
  END IF;

  -- local_admin 검증
  IF p_role = 'local_admin' THEN
    IF p_regions IS NULL OR array_length(p_regions, 1) = 0 OR
       p_cities IS NULL OR array_length(p_cities, 1) = 0 THEN
      RAISE EXCEPTION 'local_admin must provide both region and city filters'
        USING HINT = 'Both region and city filters are required for local administrators';
    END IF;
    -- 추가: 단일 시도/시군구만 허용
    IF array_length(p_regions, 1) > 1 OR array_length(p_cities, 1) > 1 THEN
      RAISE EXCEPTION 'local_admin can only access one region and one city'
        USING HINT = 'Multiple regions or cities not allowed for local administrators';
    END IF;
  END IF;

  -- temporary_inspector 차단
  IF p_role = 'temporary_inspector' THEN
    RAISE EXCEPTION 'temporary_inspector cannot access AED data'
      USING HINT = 'Temporary inspectors do not have AED data access rights';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. get_aed_data_filtered 함수 수정 (보안 검증 추가)
DROP FUNCTION IF EXISTS get_aed_data_filtered CASCADE;
CREATE OR REPLACE FUNCTION get_aed_data_filtered(
  p_user_role TEXT,
  p_region_codes TEXT[] DEFAULT NULL,
  -- ... 기존 파라미터
) RETURNS TABLE(...) AS $$
BEGIN
  -- 보안 검증 추가
  PERFORM validate_role_filters(p_user_role, p_region_codes, p_city_codes);

  -- 기존 쿼리 로직...
  RETURN QUERY
  SELECT ...
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. get_aed_data_by_jurisdiction 특별 처리
-- local_admin의 관할보건소 기준 조회는 예외 허용
```

## 🔍 관할보건소 기준 조회 특별 처리

### local_admin의 jurisdiction 모드
```typescript
// app/api/aed-data/route.ts (라인 119-134)
if (filters.queryCriteria === 'jurisdiction') {
  rpcFunction = 'get_aed_data_by_jurisdiction';
  rpcParams = {
    p_user_role: userProfile.role,
    p_region_codes: finalRegionCodes,  // 보조 필터
    p_city_codes: finalCityCodes,      // 보조 필터
    p_health_center_id: userProfile.organization?.id || null,  // 주 필터
    // ...
  };
}
```

**중요**: jurisdiction 모드에서는 관할보건소가 타 지역 AED를 관리할 수 있으므로, 시도/시군구 필터 검증을 완화해야 함

## 🧪 검증 테스트 시나리오

### 브라우저 콘솔 테스트 스크립트
```javascript
// 테스트 헬퍼 함수
async function testRole(role, testCases) {
  console.log(`\n=== Testing ${role} ===`);
  for (const test of testCases) {
    const response = await fetch(`/api/aed-data?${test.params}`, {
      credentials: 'include'
    });
    const result = {
      description: test.description,
      expected: test.expected,
      actual: response.status,
      passed: response.status === test.expected
    };
    console.log(result.passed ? '✅' : '❌', result);
  }
}

// 1. master 계정 테스트
await testRole('master', [
  { params: 'criteria=address', expected: 200, description: '필터 없음' },
  { params: 'criteria=address&region=SEO', expected: 200, description: '단일 시도' },
  { params: 'criteria=address&region=SEO&region=BUS', expected: 200, description: '다중 시도' }
]);

// 2. regional_admin 테스트 (서울시청)
await testRole('regional_admin', [
  { params: 'criteria=address', expected: 200, description: '필터 없음 → 자동 서울' },
  { params: 'criteria=address&region=BUS', expected: 403, description: '타 시도 → 거부' },
  { params: 'criteria=address&city=강남구', expected: 200, description: '서울 내 구' }
]);

// 3. local_admin 테스트 (서울 강남구 보건소)
await testRole('local_admin', [
  { params: 'criteria=address', expected: 200, description: '필터 없음 → 자동 강남구' },
  { params: 'criteria=address&city=서초구', expected: 403, description: '타 구 → 거부' },
  { params: 'criteria=jurisdiction', expected: 200, description: '관할 기준 → 성공' }
]);
```

## 📋 구현 체크리스트

### 🔴 즉시 실행 (오늘)
- [ ] 브라우저에서 현재 상태 테스트
  - [ ] master로 로그인 → 전국 데이터 조회 가능 확인
  - [ ] regional_admin으로 로그인 → 소속 시도만 조회 확인
  - [ ] local_admin으로 로그인 → 소속 시군구만 조회 확인
- [ ] API 응답의 `filters.enforced.appliedDefaults` 확인
- [ ] 403 에러 발생 시점 확인

### 🟡 중요 구현 (이번 주)
- [ ] `enforceFilterPolicy` 함수 수정
  - [ ] regional_admin 타 시도 차단 로직 강화
  - [ ] local_admin 타 시군구 차단 로직 강화
- [ ] `supabase/add_security_to_rpc.sql` 작성 및 적용
  - [ ] validate_role_filters 함수 생성
  - [ ] RPC 함수에 검증 추가
- [ ] 단위 테스트 작성
  - [ ] 각 역할별 필터 자동 적용 테스트
  - [ ] 권한 우회 시도 차단 테스트

### 🟢 향후 개선 (Stage 2 이후)
- [ ] display_allowed 기반 비공개 데이터 필터링
  - [ ] p_user_role별 display_allowed 처리
  - [ ] 통계에서 hidden_count 정확도 개선
- [ ] 성능 최적화
  - [ ] 지역 필터 인덱스 추가
  - [ ] 쿼리 실행 계획 분석
- [ ] 로깅 강화
  - [ ] 403 거부 로그 기록
  - [ ] 권한 우회 시도 탐지

## 📁 파일별 수정 위치

| 파일 | 수정 내용 | 우선순위 |
|-----|----------|----------|
| `lib/aed/filter-policy.ts` | enforceFilterPolicy 권한 검증 강화 | 🔴 긴급 |
| `supabase/add_security_to_rpc.sql` | RPC 보안 검증 추가 | 🟡 중요 |
| `app/api/aed-data/route.ts` | 에러 메시지 개선 | 🟢 개선 |
| `tests/api/aed-data.test.ts` | 권한별 테스트 케이스 | 🟡 중요 |

## 🚀 배포 전 최종 검증

### Staging 환경 테스트
```sql
-- 1. Staging에 모든 SQL 적용
-- fix_aed_data_functions_v2_corrected.sql
-- add_security_to_rpc.sql

-- 2. 권한별 RPC 직접 호출 테스트
-- master: 전체 조회
SELECT COUNT(*) FROM get_aed_data_filtered('master', NULL, NULL, NULL, NULL, NULL, 10, 0);

-- regional_admin: 필터 필수
SELECT COUNT(*) FROM get_aed_data_filtered('regional_admin', NULL, NULL, NULL, NULL, NULL, 10, 0);
-- Expected: ERROR

-- local_admin: 두 필터 모두 필수
SELECT COUNT(*) FROM get_aed_data_filtered('local_admin', ARRAY['SEO'], NULL, NULL, NULL, NULL, 10, 0);
-- Expected: ERROR
```

### Production 롤백 계획
```sql
-- 백업 (배포 전)
CREATE TABLE rpc_backup_20250921 AS
SELECT pg_get_functiondef(oid) as definition, proname
FROM pg_proc
WHERE proname IN ('get_aed_data_filtered', 'get_aed_data_by_jurisdiction', 'get_aed_data_summary');

-- 롤백 (필요 시)
-- 백업된 함수 정의 복원
```

## 📌 핵심 성공 지표

1. **권한별 필터 자동 적용** ✅
   - regional_admin: 소속 시도 자동 적용
   - local_admin: 소속 시도/시군구 자동 적용

2. **권한 우회 차단** ✅
   - 타 지역 요청 시 403 반환
   - RPC 레벨에서도 검증

3. **관할보건소 모드** ✅
   - local_admin의 jurisdiction 조회 허용
   - 타 지역 AED 포함 가능

---
*작성일: 2025-09-21*
*버전: FINAL v1.0*
*상태: 구현 준비 완료*