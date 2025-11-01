# 코드 리뷰: 잠재적 문제점 및 개선 사항

**작성일**: 2025-11-01
**검토 범위**: 전체 프로젝트 로직 및 보안
**우선순위**: Critical > High > Medium > Low

---

## Critical Issues (즉시 수정 필요)

### 1. 보안 취약점: 프로덕션 코드에 테스트 도메인 허용

**위치**: [lib/auth/access-control.ts:529](lib/auth/access-control.ts#L529)

**문제**:
```typescript
const allowedDomains = new Set(['korea.kr', 'nmc.or.kr', 'naver.com']); // naver.com for testing
```

프로덕션 환경에서 `naver.com` 도메인이 정부기관 역할 접근을 허용하고 있습니다.

**영향**:
- `naver.com` 이메일 계정이 `ministry_admin`, `regional_admin`, `local_admin` 역할로 AED 데이터 접근 가능
- 비인가 사용자의 민감 데이터 접근 위험
- 국정원 인증 요구사항 위반

**해결 방법**:
```typescript
// ✅ 수정안
const allowedDomains = new Set(['korea.kr', 'nmc.or.kr']);
// 테스트는 별도 환경변수나 테스트 환경에서만 활성화
```

**우선순위**: Critical - 즉시 수정 필요

---

### 2. 권한 체계 불일치: temporary_inspector AED 데이터 접근

**위치**:
- [lib/auth/access-control.ts:512-550](lib/auth/access-control.ts#L512-L550) `canAccessAEDData()`
- [lib/auth/access-control.ts:552-583](lib/auth/access-control.ts#L552-L583) `canAccessInspectionMenu()`

**문제**:
```typescript
// canAccessAEDData() - Line 515-517
if (role === 'temporary_inspector') {
  return false; // AED 데이터 접근 불가
}

// canAccessInspectionMenu() - Line 559-567
const allowedRoles: UserRole[] = [
  'temporary_inspector', // 점검 메뉴 접근 가능
];
```

**영향**:
- `temporary_inspector` 사용자는 점검 메뉴에 접근할 수 있지만 AED 데이터를 조회할 수 없음
- 점검 기능 자체가 작동하지 않을 가능성
- 사용자 혼란 및 기능 장애

**해결 방법**:
1. `temporary_inspector`가 할당된 장비만 조회할 수 있도록 변경
2. 또는 점검 메뉴 접근도 차단

**우선순위**: Critical - 기능 장애 가능성

---

## High Priority (빠른 수정 권장)

### 3. 데이터 정합성: city_code 필수 체크의 잠재적 문제

**위치**: [lib/auth/access-control.ts:492-497](lib/auth/access-control.ts#L492-L497)

**문제**:
```typescript
if (userProfile.role === 'local_admin') {
  const cityCode = userProfile.organization?.city_code;
  if (!cityCode) {
    throw new Error(`Local admin ${userProfile.id} requires organization with city_code but none assigned`);
  }
  allowedCityCodes = [cityCode];
}
```

**Prisma 스키마**:
```prisma
model organizations {
  city_code  String?  // nullable
}
```

**영향**:
- `city_code`가 `null`인 organization에 속한 `local_admin` 사용자는 시스템 사용 불가
- 기존 데이터에 `city_code`가 없는 경우 런타임 에러 발생
- 261개 보건소 중 일부가 `city_code` 없을 가능성

**해결 방법**:
1. 데이터베이스에서 모든 organization의 `city_code` 확인
2. `city_code` 없는 조직 데이터 보완
3. 또는 `city_code` 없을 때 대체 로직 구현

**우선순위**: High - 데이터 의존성 문제

---

### 4. 타입 안전성: 명시적 타입 캐스팅 남용

**위치**: [app/api/aed-data/route.ts](app/api/aed-data/route.ts)
- Line 198: `userProfile as any`
- Line 207: `userProfile as any`
- Line 241: `userProfile as any`

**문제**:
```typescript
// ❌ 안티패턴
if (!canAccessAEDData(userProfile as any)) {
  return NextResponse.json({
    error: 'AED data access not permitted for this role'
  }, { status: 403 });
}
```

**영향**:
- TypeScript의 타입 체크 우회
- 런타임 타입 에러 가능성
- 유지보수성 저하

**해결 방법**:
```typescript
// ✅ 개선안 1: UserProfile 타입 확장
import type { UserProfile } from '@/packages/types';

interface UserProfileWithOrg extends UserProfile {
  organizations?: {
    id: string;
    name: string;
    type: organization_type;
    region_code: string | null;
    // ...
  } | null;
}

const userProfile = await prisma.user_profiles.findUnique({
  // ...
}) as UserProfileWithOrg;

// ✅ 개선안 2: 타입 가드 함수 사용
function isValidUserProfile(profile: unknown): profile is UserProfile {
  // 타입 검증 로직
  return true;
}
```

**우선순위**: High - 코드 품질 및 안정성

---

### 5. 권한 체계 문서와 구현 간 불일치 검증 필요

**CLAUDE.md 권한 정의** (1-1절):
```markdown
#### 시군구 권한 (소속 시도 및 시군구 고정)
- @korea.kr 중 보건소: 소속 시도 고정 표시, 소속 시군구 고정 표시, 변경 불가
- 두 가지 조회 기준 선택 가능:
  - 주소 기준: 해당 시군구에 물리적으로 설치된 AED
  - 관할보건소 기준: 해당 보건소가 관리하는 AED (타 지역 포함 가능)
```

**코드 구현**:
- `queryCriteria` 파라미터로 "jurisdiction" vs "address" 선택 가능 (Line 547, 690)
- 관할보건소 기준 조회 로직 존재 (Line 547-686)

**확인 필요사항**:
1. UI에서 두 가지 조회 기준 선택 가능한지 확인
2. 보건소 사용자에게 실제로 두 옵션이 제공되는지 검증
3. 관할보건소 기준 조회 시 타 지역 AED가 정상 조회되는지 테스트

**우선순위**: High - 핵심 요구사항 준수

---

## Medium Priority (점진적 개선)

### 6. 중복 점검 관련 테이블 및 로직

**Prisma 스키마에서 발견된 중복**:
```prisma
model inspection_schedules {
  // 점검 스케줄 (구버전?)
}

model inspection_schedule_entries {
  // 점검 스케줄 엔트리 (신버전?)
}

model inspection_assignments {
  // 점검 할당
}

model inspection_sessions {
  // 점검 세션
}

model inspections {
  // 점검 결과
}
```

**문제**:
- `inspection_schedules`와 `inspection_schedule_entries`가 유사한 역할
- 어떤 테이블을 사용해야 하는지 불명확
- 코드에서 두 테이블을 모두 사용하는지 확인 필요

**영향**:
- 데이터 일관성 문제 가능성
- 개발자 혼란
- 유지보수 복잡도 증가

**해결 방법**:
1. 사용하지 않는 테이블 식별
2. 단일 테이블로 통합
3. 마이그레이션 스크립트 작성

**우선순위**: Medium - 기능은 작동하지만 개선 필요

---

### 7. 환경변수 검증 부재

**문제**:
현재 환경변수 검증이 런타임에만 발생하여 에러 발견이 늦어질 수 있음

**예시**:
```typescript
const DATABASE_URL = process.env.DATABASE_URL; // 검증 없음
```

**해결 방법**:
```typescript
// lib/env.ts (신규 파일)
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  // ...
});

export const env = envSchema.parse(process.env);
```

**우선순위**: Medium - 운영 안정성 개선

---

### 8. 로깅 일관성 부족

**문제**:
```typescript
// 여러 로깅 방식이 혼재
console.log('[API route] ...'); // 일부는 접두사 있음
console.log('Direct query result:'); // 일부는 접두사 없음
console.error('AED data query error:'); // console.error 사용
```

**영향**:
- 로그 추적 및 필터링 어려움
- 프로덕션 환경에서 로그 관리 복잡

**해결 방법**:
```typescript
// lib/logger.ts
export const logger = {
  info: (context: string, message: string, meta?: any) => {
    console.log(`[${context}] ${message}`, meta);
  },
  error: (context: string, error: Error, meta?: any) => {
    console.error(`[${context}] ${error.message}`, { stack: error.stack, ...meta });
  },
  // ...
};
```

**우선순위**: Medium - 운영 효율성

---

## Low Priority (향후 개선)

### 9. 매직 넘버 및 하드코딩된 값

**예시**:
```typescript
const maxLimit = Math.min(accessScope.permissions.maxResultLimit, 10000); // Line 286
const pageSize = Math.min(Math.max(1, requestedLimit), maxLimit);
const queryLimit = pageSize + 1;
```

**개선안**:
```typescript
const CONFIG = {
  MAX_QUERY_LIMIT: 10000,
  DEFAULT_PAGE_SIZE: 30,
  // ...
} as const;
```

**우선순위**: Low - 가독성 개선

---

### 10. 주석 처리된 코드 제거

**위치**: [app/api/aed-data/route.ts:232-237](app/api/aed-data/route.ts#L232-L237)

```typescript
// management_number 또는 equipment_serial로 조회하는 경우 지역 필터 불필요
// local_admin/regional_admin의 경우 enforceFilterPolicy에서 자동으로 기본 지역 적용하므로 여기서는 체크하지 않음
// if (!filters.management_number && !filters.equipment_serial && !filters.regionCodes && !accessScope.permissions.canViewAllRegions) {
//   return NextResponse.json({
//     error: '지역 필터를 지정해야 합니다. (관할 시도/시군구를 선택해주세요.)'
//   }, { status: 400 });
// }
```

**해결 방법**: 주석 제거 또는 필요 시 별도 문서화

**우선순위**: Low - 코드 정리

---

## 권장 조치 사항

### 즉시 (이번 주 내)
1. ✅ naver.com 테스트 도메인 제거 (Critical)
2. ✅ temporary_inspector 권한 로직 수정 (Critical)
3. ✅ city_code 데이터 정합성 확인 (High)

### 단기 (2주 내)
4. ✅ 타입 안전성 개선 (any 캐스팅 제거)
5. ✅ 권한 체계 문서-코드 일치 검증
6. ✅ 환경변수 검증 시스템 구축

### 중기 (1개월 내)
7. ✅ 점검 테이블 통합 검토
8. ✅ 로깅 시스템 표준화
9. ✅ 설정 값 중앙 관리

### 장기 (분기 내)
10. ✅ 코드 리팩토링 (주석 제거, 매직 넘버 상수화)
11. ✅ 유닛 테스트 추가
12. ✅ 통합 테스트 구축

---

## 테스트 권장사항

### 1. 권한 체계 테스트
```typescript
describe('Access Control', () => {
  it('should deny naver.com domain for admin roles', () => {
    // naver.com 제거 후 테스트
  });

  it('should allow temporary_inspector to access assigned devices', () => {
    // 할당된 장비만 접근 가능 확인
  });

  it('should enforce city_code for local_admin', () => {
    // city_code 없는 경우 에러 처리 확인
  });
});
```

### 2. 관할보건소 기준 조회 테스트
```typescript
describe('Jurisdiction Query', () => {
  it('should return AEDs from other regions managed by health center', () => {
    // 타 지역 AED 조회 확인
  });

  it('should respect queryCriteria parameter', () => {
    // address vs jurisdiction 조회 결과 차이 확인
  });
});
```

### 3. 데이터 정합성 테스트
```typescript
describe('Data Integrity', () => {
  it('should have city_code for all local_admin organizations', async () => {
    const orgs = await prisma.organizations.findMany({
      where: { type: 'health_center' }
    });

    orgs.forEach(org => {
      expect(org.city_code).not.toBeNull();
    });
  });
});
```

---

## 참고 문서

- [CLAUDE.md - 권한 체계](CLAUDE.md#1-1-핵심-권한-체계-절대-불변)
- [Prisma Schema](prisma/schema.prisma)
- [Access Control](lib/auth/access-control.ts)
- [AED Data API](app/api/aed-data/route.ts)

---

**검토자**: Claude AI
**최종 업데이트**: 2025-11-01
**다음 검토 예정**: 문제 수정 후
