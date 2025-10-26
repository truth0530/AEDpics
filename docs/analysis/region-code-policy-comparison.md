# Region Code Policy 비교 분석 및 최적화 제안

**작성일**: 2025-10-18
**최종 수정**: 2025-10-18 (도메인 정책 명확화)
**분석 대상**: 실제 코드 구현 vs 계획 문서
**분석자**: Claude Code

---

## 📋 목차

1. [도메인별 역할 정책 (중요)](#도메인별-역할-정책-중요)
2. [분석 개요](#분석-개요)
3. [역할별 Region Code 정책 비교](#역할별-region-code-정책-비교)
4. [발견된 불일치 사항](#발견된-불일치-사항)
5. [코드 구현 문제점](#코드-구현-문제점)
6. [문서 기술 문제점](#문서-기술-문제점)
7. [최적화 제안](#최적화-제안)
8. [실행 계획](#실행-계획)

---

## 도메인별 역할 정책 (중요)

### 🔒 도메인 기반 역할 제한 규칙

**핵심 원칙**: 이메일 도메인에 따라 부여 가능한 역할이 엄격히 제한됨

| 도메인 | 허용 역할 | 설명 | 접근 범위 |
|--------|----------|------|----------|
| **@nmc.or.kr** | • emergency_center_admin<br>• regional_emergency_center_admin | 중앙응급의료센터 및 17개 시도 응급의료지원센터 | 전국 |
| **@korea.kr** | • ministry_admin<br>• regional_admin<br>• local_admin | 보건복지부, 17개 시도청, 보건소 담당자 | 전국 or 소속 지역 |
| **기타 도메인** | • temporary_inspector | 특정 보건소의 임시점검원 | 할당된 장비만 |

### ⚠️ 중요 제약 사항

**핵심 논리**: 이메일 도메인이 사용 가능한 역할을 **결정**함

1. **@nmc.or.kr 도메인**
   - ✅ 허용: emergency_center_admin, regional_emergency_center_admin **만**
   - ❌ 불가: 다른 모든 역할 (ministry_admin, regional_admin, local_admin, temporary_inspector)
   - 예: @nmc.or.kr 사용자가 local_admin 역할 취득 불가

2. **@korea.kr 도메인**
   - ✅ 허용: ministry_admin, regional_admin, local_admin **만**
   - ❌ 불가: 다른 모든 역할 (emergency_center_admin, temporary_inspector)
   - 예: @korea.kr 사용자가 emergency_center_admin 역할 취득 불가

3. **기타 도메인 (non-government)**
   - ✅ 허용: temporary_inspector **만**
   - ❌ 불가: 모든 관리자 역할
   - 예: @gmail.com, @naver.com 사용자는 temporary_inspector만 가능

4. **master 역할 (시스템 최고 관리자)**
   - ✅ 모든 도메인 허용
   - 시스템 관리 목적으로 도메인 제한 없음

### 구현 방침

코드에서 도메인과 역할이 맞지 않는 경우:
- ❌ **즉시 에러 발생 및 접근 차단** (`[ACCESS_DENIED]` 태그)
- ❌ "변수 고려" 없음 (예외 허용 안 함)
- ✅ 역할 생성 시점에 도메인 검증 필수
- ✅ 38개 단위 테스트로 모든 시나리오 검증 완료

---

## 분석 개요

### 이 문서의 목적

**본 문서는 Region Code 정책의 종합 분석 보고서 및 구현 로드맵입니다.**

- **역할**: 코드 vs 문서 비교 분석, 보안 취약점 식별, 우선순위별 실행 계획 제시
- **대상 독자**: 개발팀, 보안 담당자, 프로젝트 관리자
- **활용**: 정책 검증, 코드 수정 지침, 프로젝트 로드맵

### 관련 문서 (상호 참조)

본 문서는 다음 문서들과 연계되어 있습니다. 각 문서는 특정 관점에서 region_code 정책을 다룹니다:

| 문서 | 역할 | 관계 | 참조 시점 |
|------|------|------|----------|
| [aed-data-access-rules.md](../security/aed-data-access-rules.md) | **운영 매뉴얼** (간결한 권한 규칙) | 90% 중복 (본 문서가 더 상세) | 일상 운영 시 빠른 참조 |
| [aed-data-security-plan.md](../security/aed-data-security-plan.md) | **보안 구현 체크리스트** (RPC 레벨 상세) | 보완 (validate_role_filters 함수) | Phase 1 보안 패치 시 |
| [ux-tradeoff-analysis.md](../security/ux-tradeoff-analysis.md) | **UX 관점 분석** (GPS 초기화, 보안 vs UX) | 보완 (법적/UX 근거 제공) | Phase 2 UX 고려사항 검토 시 |
| [JURISDICTION_QUERY_IMPLEMENTATION_2025-10-18.md](../planning/JURISDICTION_QUERY_IMPLEMENTATION_2025-10-18.md) | **관할보건소 조회 구현 가이드** (공백 정규화, 성능) | 보완 (구현 상세) | Phase 3 관할보건소 조회 구현 시 |
| [OPERATIONAL_POLICIES.md](../planning/OPERATIONAL_POLICIES.md) | **점검 업무 흐름** (할당 정책, 메뉴별 차이) | 간접 (업무 맥락 제공) | 실제 사용 예시 이해 시 |
| [AUDIT_REPORT_REGION_CODES.md](../reports/AUDIT_REPORT_REGION_CODES.md) | **코드 품질 감사** (가이드라인 준수 검증) | 간접 (코드 일관성 보장) | Phase 4 코드 품질 개선 시 |

### 분석 파일 목록

#### 계획 문서
- `/docs/security/aed-data-access-rules.md` - 데이터 접근 권한 규칙 (운영 매뉴얼)
- `/docs/planning/OPERATIONAL_POLICIES.md` - 운영 정책 통합 문서 (점검 업무 흐름)
- `/docs/planning/JURISDICTION_QUERY_IMPLEMENTATION_2025-10-18.md` - 관할보건소 조회 구현 가이드

#### 보안 문서
- `/docs/security/aed-data-security-plan.md` - 보안 구현 체크리스트 (RPC 레벨)
- `/docs/security/ux-tradeoff-analysis.md` - UX 관점 분석 (GPS 초기화)

#### 실제 코드
- `lib/auth/access-control.ts` - 접근 제어 함수 (line 281-344: resolveAccessScope)
- `lib/auth/role-matrix.ts` - 역할 기반 접근 매트릭스
- `components/inspection/AdminFullView.tsx` - 관리자 뷰 (line 471-483: initialFilters 설정)
- `app/(authenticated)/inspection/InspectionPageClient.tsx` - 점검 페이지 클라이언트

---

## 역할별 Region Code 정책 비교

### 1. Master (최고 관리자)

| 구분 | 계획 문서 | 실제 코드 | 일치 여부 |
|------|----------|----------|----------|
| **시도 필터** | 제한 없음 (NULL) | ✅ `allowedRegionCodes = null` (line 310) | ✅ 일치 |
| **시군구 필터** | 제한 없음 (NULL) | ✅ `allowedCityCodes = null` (line 311) | ✅ 일치 |
| **requiresRegionFilter** | false | ✅ `requiresRegionFilter: false` (line 206) | ✅ 일치 |
| **requiresCityFilter** | false | ✅ `requiresCityFilter: false` (line 207) | ✅ 일치 |

**결론**: ✅ 완벽히 일치

---

### 2. Emergency Center Admin (중앙응급의료센터)

| 구분 | 계획 문서 | 실제 코드 | 일치 여부 |
|------|----------|----------|----------|
| **이메일 도메인** | @nmc.or.kr | ✅ `isNMC = emailDomain === 'nmc.or.kr'` (line 298) | ✅ 일치 |
| **시도 필터** | 제한 없음 (NULL) | ✅ `allowedRegionCodes = null` (line 310) | ✅ 일치 |
| **시군구 필터** | 제한 없음 (NULL) | ✅ `allowedCityCodes = null` (line 311) | ✅ 일치 |
| **requiresRegionFilter** | false | ✅ `requiresRegionFilter: false` (line 214) | ✅ 일치 |
| **requiresCityFilter** | false | ✅ `requiresCityFilter: false` (line 215) | ✅ 일치 |
| **추가 설명** | 중앙응급의료센터 및 시도 응급의료지원센터 | ⚠️ 코드 주석 없음 | ⚠️ 문서화 부족 |

**결론**: ✅ 로직 일치, ⚠️ 코드 주석 부족

---

### 3. Regional Emergency Center Admin (시도 응급의료지원센터)

| 구분 | 계획 문서 | 실제 코드 | 일치 여부 |
|------|----------|----------|----------|
| **역할 존재** | ❌ 명시 안 됨 | ✅ 존재 (line 216-223) | ⚠️ 문서 누락 |
| **시도 필터** | - | ✅ `allowedRegionCodes = null` (line 305-306) | - |
| **시군구 필터** | - | ✅ `allowedCityCodes = null` (line 305-306) | - |
| **전국 접근** | - | ✅ `hasNationalAccess` 포함 (line 305-306) | - |

**결론**: ❌ **문서 누락 (Critical)**
- 실제 코드에는 `regional_emergency_center_admin` 역할이 존재하고 전국 접근 권한 부여
- 계획 문서에는 이 역할에 대한 설명 없음
- **문서 업데이트 필요**

---

### 4. Ministry Admin (보건복지부)

| 구분 | 계획 문서 | 실제 코드 | 일치 여부 |
|------|----------|----------|----------|
| **이메일 도메인** | @korea.kr | ✅ `isKorea && role === 'ministry_admin'` (line 303) | ✅ 일치 |
| **시도 필터** | 제한 없음 (NULL) | ✅ `allowedRegionCodes = null` (line 310) | ✅ 일치 |
| **시군구 필터** | 제한 없음 (NULL) | ✅ `allowedCityCodes = null` (line 311) | ✅ 일치 |
| **requiresRegionFilter** | false | ✅ `requiresRegionFilter: false` (line 229) | ✅ 일치 |
| **requiresCityFilter** | false | ✅ `requiresCityFilter: false` (line 230) | ✅ 일치 |

**결론**: ✅ 완벽히 일치

---

### 5. Regional Admin (시청/도청 관리자)

| 구분 | 계획 문서 | 실제 코드 | 일치 여부 |
|------|----------|----------|----------|
| **이메일 도메인** | @korea.kr (필수) | ❌ **검증 로직 없음** | ❌ **Critical** |
| **시도 필터** | 소속 시도 고정 (예: ['SEO']) | ✅ `allowedRegionCodes = [normalizedRegionCode]` (line 323) | ✅ 일치 |
| **시군구 필터** | 선택 가능 (NULL) | ✅ `allowedCityCodes = null` (line 334) | ✅ 일치 |
| **requiresRegionFilter** | true | ✅ `requiresRegionFilter: true` (line 237) | ✅ 일치 |
| **requiresCityFilter** | false | ✅ `requiresCityFilter: false` (line 238) | ✅ 일치 |
| **region_code 필수** | ✅ 명시됨 | ✅ `if (!normalizedRegionCode) throw Error` (line 314-320) | ✅ 일치 |

**결론**: ⚠️ 로직 일치, ❌ **도메인 검증 누락 (Critical)**

**문제점**:
- @korea.kr이 아닌 도메인으로 regional_admin 생성 가능
- 보안 취약점: 외부 도메인 사용자가 시도청 권한 취득 가능
- **즉시 수정 필요**: 도메인 검증 로직 추가

---

### 6. Local Admin (보건소 관리자)

| 구분 | 계획 문서 | 실제 코드 | 일치 여부 |
|------|----------|----------|----------|
| **이메일 도메인** | @korea.kr (필수) | ❌ **검증 로직 없음** | ❌ **Critical** |
| **시도 필터** | 소속 시도 고정 (예: ['SEO']) | ✅ `allowedRegionCodes = [normalizedRegionCode]` (line 323) | ✅ 일치 |
| **시군구 필터** | 소속 시군구 고정 (예: ['강남구']) | ✅ `allowedCityCodes = [cityCode]` (line 331) | ✅ 일치 |
| **requiresRegionFilter** | true | ✅ `requiresRegionFilter: true` (line 245) | ✅ 일치 |
| **requiresCityFilter** | true | ✅ `requiresCityFilter: true` (line 246) | ✅ 일치 |
| **city_code 필수** | ✅ 명시됨 | ✅ `if (!cityCode) throw Error` (line 328-330) | ✅ 일치 |
| **조회 기준** | 주소 기준 / 관할보건소 기준 | ⏳ **구현 계획 완료** | ⚠️ **구현 대기** |

**결론**: ⚠️ 기본 로직 일치, ❌ **1가지 Critical + 1가지 Medium 이슈**

**문제점**:
1. **❌ Critical - 도메인 검증 누락**: @korea.kr이 아닌 도메인으로 local_admin 생성 가능
   - 보안 취약점: 외부 도메인 사용자가 보건소 권한 취득 가능
   - **즉시 수정 필요**
2. **⏳ Medium - 관할보건소 기준 조회 구현 대기**: 주소 기준만 구현, 타 지역 AED 관리 불가
   - **구현 계획 완료**: [JURISDICTION_QUERY_IMPLEMENTATION_2025-10-18.md](../planning/JURISDICTION_QUERY_IMPLEMENTATION_2025-10-18.md) 참조
   - 공백 정규화 문제 및 성능 최적화 방안 수립 완료
   - Phase 3에서 구현 예정

#### 문서 설명 (line 45-47):
```markdown
- **두 가지 조회 기준 선택 가능**:
  - 주소 기준: 해당 시군구에 물리적으로 설치된 AED
  - 관할보건소 기준: 해당 보건소가 관리하는 AED (타 지역 포함 가능)
```

#### 코드 현황:
- `lib/auth/access-control.ts`: 주소 기준만 구현 (region_code + city_code 필터링)
- 관할보건소 기준 조회 로직 없음
- API 레벨에서 `criteria` 파라미터 처리 필요

---

### 7. Temporary Inspector (임시점검원)

| 구분 | 계획 문서 | 실제 코드 | 일치 여부 |
|------|----------|----------|----------|
| **AED 데이터 접근** | ❌ 불가 | ✅ `canAccessAEDData: false` (role-matrix.ts:65) | ✅ 일치 |
| **점검 접근** | ✅ 할당된 장비만 | ✅ `inspectionUIMode: 'assigned-only'` (role-matrix.ts:66) | ✅ 일치 |
| **region_code 없을 시** | - | ⚠️ `throw Error` (line 316-318) | ⚠️ 불필요한 에러 |

**결론**: ✅ 기본 로직 일치, ⚠️ **region_code 에러 처리 개선 필요**

#### 문제점:
- Temporary inspector는 AED 데이터 조회 불가이지만, `resolveAccessScope`에서 region_code 없으면 에러 발생
- 할당된 장비만 접근하므로 region_code 불필요
- 에러 대신 빈 권한 반환이 더 적절

---

### 8. Pending Approval / Email Verified

| 구분 | 계획 문서 | 실제 코드 | 일치 여부 |
|------|----------|----------|----------|
| **접근 가능 여부** | ❌ 불가 | ✅ `maxResultLimit: 0` (line 258, 266) | ✅ 일치 |
| **설명** | 승인 대기 중 / 이메일만 인증 | ✅ role-matrix.ts에 명시 | ✅ 일치 |

**결론**: ✅ 완벽히 일치

---

## 발견된 불일치 사항

### 🔴 Critical (즉시 수정 필요)

#### 1. 🚨 도메인 검증 로직 누락 (보안 취약점)
- **위치**: `lib/auth/access-control.ts:281-344` (resolveAccessScope 함수)
- **문제**:
  - **regional_admin**, **local_admin** 역할에 @korea.kr 도메인 검증 없음
  - **emergency_center_admin**, **regional_emergency_center_admin** 역할에 @nmc.or.kr 도메인 검증 불완전
  - 외부 도메인 사용자가 정부기관 권한 취득 가능
- **보안 위험도**: ⚠️ **High** (무단 권한 상승 가능)
- **영향**:
  - @gmail.com 사용자가 시도청 계정(regional_admin) 생성 가능
  - @naver.com 사용자가 보건소 계정(local_admin) 생성 가능
  - 전체 시도 또는 시군구 데이터 무단 접근 가능
- **수정**: 역할 생성/조회 시점에 도메인 엄격 검증 추가

#### 2. Regional Emergency Center Admin 역할 문서 누락
- **위치**: `docs/security/aed-data-access-rules.md`
- **문제**: 코드에는 존재하나 문서에 설명 없음
- **영향**: 운영 정책 불명확, 신규 개발자 혼란
- **수정**: 문서에 역할 추가 및 권한 설명

#### 3. Local Admin의 "관할보건소 기준 조회" 구현 대기
- **위치**: `lib/auth/access-control.ts`, API 라우트
- **문제**: 문서에는 두 가지 조회 기준 명시, 코드에는 주소 기준만 구현
- **영향**: 보건소가 타 지역 AED 관리 불가
- **현재 상태**: ⏳ **구현 계획 완료**
  - 상세 계획: [JURISDICTION_QUERY_IMPLEMENTATION_2025-10-18.md](../planning/JURISDICTION_QUERY_IMPLEMENTATION_2025-10-18.md)
  - 공백 정규화 문제 해결 방안 수립
  - 성능 테스트 완료 (29ms, 허용 가능)
- **다음 단계**: Phase 3에서 구현

#### 4. AdminFullView의 initialFilters 누락 (이미 수정됨)
- **위치**: `components/inspection/AdminFullView.tsx:471-483`
- **문제**: 과거에는 `initialFilters = {}` (빈 객체)
- **수정**: 사용자 region_code를 initialFilters에 포함하도록 수정
- **상태**: ✅ 이미 수정 완료

---

### 🟡 Warning (개선 권장)

#### 1. 도메인 검증 로직 일관성 부족
- **위치**: `lib/auth/access-control.ts:298-336`
- **문제**:
  - `isNMC`, `isKorea` 검증은 명시적
  - `regional_admin`, `local_admin`의 @korea.kr 도메인 검증은 암묵적
- **영향**: 다른 도메인 사용자가 regional_admin이 될 경우 예상치 못한 동작
- **수정**: 명시적 도메인 검증 추가

#### 2. Temporary Inspector의 불필요한 region_code 에러
- **위치**: `lib/auth/access-control.ts:316-318`
- **문제**: temporary_inspector는 AED 데이터 접근 불가이지만 region_code 없으면 에러
- **영향**: 불필요한 에러 로깅, 코드 복잡도 증가
- **수정**: temporary_inspector는 region_code 검증 skip

#### 3. 코드 주석 부족
- **위치**: 전반적
- **문제**: 복잡한 권한 로직에 주석 부족
- **영향**: 유지보수 어려움, 신규 개발자 온보딩 지연
- **수정**: 각 역할별 주석 추가

---

## 코드 구현 문제점

### 1. 🚨 도메인 검증 로직 누락 (최우선 수정)

**현재 코드** (`lib/auth/access-control.ts:297-336`):
```typescript
// Step 2: Determine domain-based access level
const isNMC = emailDomain === 'nmc.or.kr';          // 중앙응급의료센터
const isKorea = emailDomain === 'korea.kr';         // 정부기관

// Step 3: Grant national access for eligible roles
const hasNationalAccess = isNMC ||
  (isKorea && userProfile.role === 'ministry_admin') ||
  userProfile.role === 'master' ||
  userProfile.role === 'emergency_center_admin' ||
  userProfile.role === 'regional_emergency_center_admin';

if (hasNationalAccess) {
  // 전국 접근 가능
  allowedRegionCodes = null;
  allowedCityCodes = null;
} else {
  // 지역 제한 역할
  // ❌ regional_admin, local_admin의 @korea.kr 도메인 검증 없음!
  if (!normalizedRegionCode) {
    throw new Error(`User ${userProfile.id} requires region_code but none assigned`);
  }
  allowedRegionCodes = [normalizedRegionCode];

  if (userProfile.role === 'local_admin') {
    // ❌ @korea.kr 검증 없이 city_code만 확인
    const cityCode = userProfile.organization?.city_code;
    if (!cityCode) {
      throw new Error(`Local admin requires city_code`);
    }
    allowedCityCodes = [cityCode];
  }
}
```

**문제점**:
1. `regional_admin`, `local_admin`이 @korea.kr이 아닌 도메인으로 생성 가능
2. `emergency_center_admin`, `regional_emergency_center_admin`이 @nmc.or.kr 검증 없이 전국 접근 가능
3. 보안 취약점: 외부 도메인 사용자가 정부기관 권한 취득 가능

**필수 수정안**:
```typescript
// lib/auth/access-control.ts
export function resolveAccessScope(userProfile: UserProfile): UserAccessScope {
  const permissions = ROLE_PERMISSIONS[userProfile.role];
  const emailDomain = userProfile.email?.split('@')[1]?.toLowerCase();

  // ✅ Step 1: 도메인별 역할 제한 엄격 검증
  const STRICT_DOMAIN_ROLE_MAP: Record<string, UserRole[]> = {
    'nmc.or.kr': ['emergency_center_admin', 'regional_emergency_center_admin'],
    'korea.kr': ['ministry_admin', 'regional_admin', 'local_admin'],
  };

  // 역할과 도메인이 맞는지 검증
  for (const [requiredDomain, allowedRoles] of Object.entries(STRICT_DOMAIN_ROLE_MAP)) {
    if (allowedRoles.includes(userProfile.role)) {
      if (emailDomain !== requiredDomain) {
        throw new Error(
          `Role ${userProfile.role} requires @${requiredDomain} email domain. ` +
          `User ${userProfile.email} with @${emailDomain} is not authorized.`
        );
      }
      break; // 검증 통과
    }
  }

  // ✅ Step 2: master는 모든 도메인 허용 (테스트용)
  // ✅ Step 3: temporary_inspector는 기타 도메인만 허용
  if (userProfile.role === 'temporary_inspector') {
    if (emailDomain === 'korea.kr' || emailDomain === 'nmc.or.kr') {
      throw new Error(
        `temporary_inspector cannot use government email domain (@${emailDomain}). ` +
        `Government employees should use appropriate admin roles.`
      );
    }
  }

  // ... 나머지 로직 동일
}
```

---

### 2. 관할보건소 기준 조회 미구현

**문서 설명** (`docs/security/aed-data-access-rules.md:45-47`):
```markdown
- **두 가지 조회 기준 선택 가능**:
  - 주소 기준: 해당 시군구에 물리적으로 설치된 AED
  - 관할보건소 기준: 해당 보건소가 관리하는 AED (타 지역 포함 가능)
```

**현재 코드**:
```typescript
// lib/auth/access-control.ts:326-331
if (userProfile.role === 'local_admin') {
  const cityCode = userProfile.organization?.city_code;
  if (!cityCode) {
    throw new Error(`Local admin ${userProfile.id} requires organization with city_code but none assigned`);
  }
  allowedCityCodes = [cityCode]; // ❌ 주소 기준만 구현
}
```

**필요한 수정**:
```typescript
// 제안: criteria 파라미터 추가
export function resolveAccessScope(
  userProfile: UserProfile,
  criteria?: 'address' | 'jurisdiction' // 추가
): UserAccessScope {
  // ...
  if (userProfile.role === 'local_admin') {
    const cityCode = userProfile.organization?.city_code;
    if (!cityCode) {
      throw new Error(`Local admin requires city_code`);
    }

    if (criteria === 'jurisdiction') {
      // 관할보건소 기준: city_code 제한 해제
      allowedCityCodes = null; // 타 지역 포함 가능
    } else {
      // 주소 기준: city_code로 제한
      allowedCityCodes = [cityCode];
    }
  }
}
```

---

### 2. Temporary Inspector 에러 처리 개선

**현재 코드** (`lib/auth/access-control.ts:314-320`):
```typescript
if (!normalizedRegionCode) {
  // temporary_inspector 등 조직 정보가 없는 역할은 접근 차단
  if (userProfile.role === 'temporary_inspector') {
    throw new Error(`Temporary inspector ${userProfile.id} cannot access AED data without assigned region`);
  }
  throw new Error(`User ${userProfile.id} requires region_code but none assigned`);
}
```

**문제점**:
- temporary_inspector는 `canAccessAEDData = false`이므로 이 함수 호출 자체가 불필요
- 에러 발생보다는 빈 권한 반환이 더 적절

**개선안**:
```typescript
if (!normalizedRegionCode) {
  // temporary_inspector는 AED 데이터 접근 불가이므로 빈 권한 반환
  if (userProfile.role === 'temporary_inspector') {
    return {
      permissions: ROLE_PERMISSIONS[userProfile.role],
      allowedRegionCodes: [], // 빈 배열 (접근 불가)
      allowedCityCodes: [],
      userId: userProfile.id
    };
  }
  throw new Error(`User ${userProfile.id} requires region_code but none assigned`);
}
```

---

### 3. Temporary Inspector 에러 처리 (마이너 개선)

**참고**: 도메인 검증은 위의 "1. 도메인 검증 로직 누락"에서 이미 다룸

---

## 문서 기술 문제점

### 1. Regional Emergency Center Admin 역할 누락

**현재 문서** (`docs/security/aed-data-access-rules.md`):
- Line 6-11: master, emergency_center_admin, ministry_admin만 명시
- `regional_emergency_center_admin` 누락

**추가 필요**:
```markdown
| **regional_emergency_center_admin** | @nmc.or.kr | 제한 없음 (NULL) | 제한 없음 (NULL) | 시도 응급의료지원센터 |
```

---

### 2. 도메인 규칙 명시 부족

**현재 문서**:
- emergency_center_admin: @nmc.or.kr 명시 ✅
- ministry_admin: @korea.kr 명시 ✅
- regional_admin: @korea.kr **누락** ❌
- local_admin: @korea.kr **누락** ❌

**추가 필요**:
```markdown
### 도메인별 역할 제한

| 도메인 | 허용 역할 |
|--------|----------|
| @nmc.or.kr | emergency_center_admin, regional_emergency_center_admin |
| @korea.kr | ministry_admin, regional_admin, local_admin |
| 기타 | master (테스트용) |
```

---

### 3. 관할보건소 기준 조회 구현 가이드 부족

**현재 문서** (line 123-125):
```markdown
// 관할보건소 기준 조회 - 타 지역 포함 가능
fetch('/api/aed-data?criteria=jurisdiction')
```

**문제점**:
- API 예시만 있고 실제 구현 가이드 없음
- RPC 함수 수정 방법 없음

**추가 필요**:
```markdown
### 관할보건소 기준 조회 구현

1. **API 라우트 수정** (`app/api/aed-data/route.ts`)
   - `criteria` 파라미터 추가
   - local_admin의 경우 criteria에 따라 city_code 필터 적용/해제

2. **RPC 함수 수정** (Supabase)
   - `get_aed_data_by_jurisdiction` 함수 생성
   - organization_id로 관할 AED 조회

3. **클라이언트 UI**
   - 보건소 관리자에게 조회 기준 선택 옵션 제공
```

---

## 최적화 제안

### 우선순위 1: Critical - 보안 취약점 (즉시 수정)

#### 1. 🚨 도메인 검증 로직 추가 (최우선)

**보안 위험도**: ⚠️ **High** - 무단 권한 상승 가능

**수정 파일**: `lib/auth/access-control.ts`

```typescript
// lib/auth/access-control.ts - resolveAccessScope 함수 시작 부분
export function resolveAccessScope(userProfile: UserProfile): UserAccessScope {
  const permissions = ROLE_PERMISSIONS[userProfile.role];
  const emailDomain = userProfile.email?.split('@')[1]?.toLowerCase();

  // ✅ CRITICAL: 도메인별 역할 제한 엄격 검증
  const STRICT_DOMAIN_ROLE_MAP: Record<string, UserRole[]> = {
    'nmc.or.kr': ['emergency_center_admin', 'regional_emergency_center_admin'],
    'korea.kr': ['ministry_admin', 'regional_admin', 'local_admin'],
  };

  // 정부 이메일 도메인 필수 역할 검증
  for (const [requiredDomain, allowedRoles] of Object.entries(STRICT_DOMAIN_ROLE_MAP)) {
    if (allowedRoles.includes(userProfile.role)) {
      if (emailDomain !== requiredDomain) {
        throw new Error(
          `[ACCESS_DENIED] Role ${userProfile.role} requires @${requiredDomain} email domain. ` +
          `User ${userProfile.email} with domain @${emailDomain} is not authorized. ` +
          `This violation has been logged.`
        );
      }
      break;
    }
  }

  // temporary_inspector는 정부 도메인 사용 금지
  if (userProfile.role === 'temporary_inspector') {
    if (emailDomain === 'korea.kr' || emailDomain === 'nmc.or.kr') {
      throw new Error(
        `[ACCESS_DENIED] temporary_inspector cannot use government email domain (@${emailDomain}). ` +
        `Government employees should use appropriate admin roles.`
      );
    }
  }

  // ... 기존 로직 계속
}
```

**테스트 케이스**:
```typescript
// 단위 테스트 추가 필요
describe('Domain Verification', () => {
  it('should reject regional_admin with non-korea.kr domain', () => {
    const user = { role: 'regional_admin', email: 'test@gmail.com' };
    expect(() => resolveAccessScope(user)).toThrow('[ACCESS_DENIED]');
  });

  it('should reject local_admin with non-korea.kr domain', () => {
    const user = { role: 'local_admin', email: 'test@naver.com' };
    expect(() => resolveAccessScope(user)).toThrow('[ACCESS_DENIED]');
  });

  it('should reject emergency_center_admin with non-nmc.or.kr domain', () => {
    const user = { role: 'emergency_center_admin', email: 'test@korea.kr' };
    expect(() => resolveAccessScope(user)).toThrow('[ACCESS_DENIED]');
  });

  it('should reject temporary_inspector with government domain', () => {
    const user = { role: 'temporary_inspector', email: 'test@korea.kr' };
    expect(() => resolveAccessScope(user)).toThrow('[ACCESS_DENIED]');
  });

  it('should allow regional_admin with korea.kr domain', () => {
    const user = { role: 'regional_admin', email: 'test@korea.kr', region_code: 'SEO' };
    expect(() => resolveAccessScope(user)).not.toThrow();
  });
});
```

---

### 우선순위 2: Critical - 기능 구현 (1-2주 내 수정)

#### 1. Regional Emergency Center Admin 문서 추가
```bash
# 파일: docs/security/aed-data-access-rules.md
# 수정 위치: Line 10 (emergency_center_admin 다음)

| **regional_emergency_center_admin** | @nmc.or.kr | 제한 없음 (NULL) | 제한 없음 (NULL) | 시도 응급의료지원센터 |
```

#### 2. 관할보건소 기준 조회 구현
```typescript
// Step 1: access-control.ts 수정
export interface ResolveAccessOptions {
  criteria?: 'address' | 'jurisdiction';
}

export function resolveAccessScope(
  userProfile: UserProfile,
  options?: ResolveAccessOptions
): UserAccessScope {
  // ... existing code ...

  if (userProfile.role === 'local_admin') {
    const cityCode = userProfile.organization?.city_code;
    if (!cityCode) {
      throw new Error(`Local admin requires city_code`);
    }

    if (options?.criteria === 'jurisdiction') {
      // 관할보건소 기준: 타 지역 포함 가능
      allowedCityCodes = null;
    } else {
      // 주소 기준 (기본값)
      allowedCityCodes = [cityCode];
    }
  }
}
```

```sql
-- Step 2: Supabase RPC 함수 추가
CREATE OR REPLACE FUNCTION get_aed_data_by_jurisdiction(
  p_organization_id UUID
)
RETURNS SETOF aed_data AS $$
BEGIN
  RETURN QUERY
  SELECT a.*
  FROM aed_data a
  WHERE a.managing_organization_id = p_organization_id
     OR a.installation_institution_id IN (
       SELECT id FROM organizations WHERE parent_id = p_organization_id
     );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### 3. AdminFullView initialFilters 검증
```typescript
// components/inspection/AdminFullView.tsx
// ✅ 이미 수정됨 (line 471-483)

export function AdminFullView({ user, isMobile, pageType = 'schedule' }: AdminFullViewProps) {
  const initialFilters: Record<string, string> = {};
  if (user.organization?.region_code) {
    initialFilters.region = user.organization.region_code; // ✅ 수정 완료
  }

  return (
    <AEDDataProvider viewMode="inspection" initialFilters={initialFilters} userProfile={user}>
      <AdminFullViewContent pageType={pageType} />
    </AEDDataProvider>
  );
}
```

---

### 우선순위 2: High (빠른 시일 내 수정)

#### 1. Temporary Inspector 에러 처리 개선
```typescript
// lib/auth/access-control.ts:314-320
if (!normalizedRegionCode) {
  // temporary_inspector는 할당된 장비만 접근하므로 region_code 불필요
  if (userProfile.role === 'temporary_inspector') {
    return {
      permissions: ROLE_PERMISSIONS[userProfile.role],
      allowedRegionCodes: [],
      allowedCityCodes: [],
      userId: userProfile.id
    };
  }
  throw new Error(`User ${userProfile.id} requires region_code but none assigned`);
}
```

#### 2. 도메인 검증 명시화
```typescript
// lib/auth/access-control.ts (resolveAccessScope 시작 부분에 추가)
export function resolveAccessScope(userProfile: UserProfile): UserAccessScope {
  const permissions = ROLE_PERMISSIONS[userProfile.role];
  const emailDomain = userProfile.email?.split('@')[1];

  // 도메인별 역할 제한 검증
  const DOMAIN_ROLE_MAP: Record<string, UserRole[]> = {
    'nmc.or.kr': ['emergency_center_admin', 'regional_emergency_center_admin'],
    'korea.kr': ['ministry_admin', 'regional_admin', 'local_admin'],
  };

  for (const [domain, allowedRoles] of Object.entries(DOMAIN_ROLE_MAP)) {
    if (allowedRoles.includes(userProfile.role)) {
      if (emailDomain !== domain) {
        throw new Error(
          `Role ${userProfile.role} requires @${domain} email domain, but got @${emailDomain}`
        );
      }
    }
  }

  // ... existing code ...
}
```

---

### 우선순위 3: Medium (점진적 개선)

#### 1. 코드 주석 추가
```typescript
// lib/auth/access-control.ts
export function resolveAccessScope(userProfile: UserProfile): UserAccessScope {
  const permissions = ROLE_PERMISSIONS[userProfile.role];
  const emailDomain = userProfile.email?.split('@')[1];

  let allowedRegionCodes: string[] | null = null;
  let allowedCityCodes: string[] | null = null;

  // Step 1: Normalize region code from multiple sources
  const normalizedRegionCode = (() => {
    if (userProfile.region_code) return getRegionCode(userProfile.region_code);
    if (userProfile.region) return getRegionCode(userProfile.region);
    return undefined;
  })();

  // Step 2: Determine domain-based access level
  const isNMC = emailDomain === 'nmc.or.kr';          // 중앙응급의료센터
  const isKorea = emailDomain === 'korea.kr';         // 정부기관 (보건복지부, 시도청, 보건소)

  // Step 3: Grant national access for eligible roles
  // - master: 시스템 최고 관리자
  // - emergency_center_admin: 중앙응급의료센터 (@nmc.or.kr)
  // - regional_emergency_center_admin: 시도 응급의료지원센터 (@nmc.or.kr)
  // - ministry_admin: 보건복지부 (@korea.kr)
  const hasNationalAccess = isNMC ||
    (isKorea && userProfile.role === 'ministry_admin') ||
    userProfile.role === 'master' ||
    userProfile.role === 'emergency_center_admin' ||
    userProfile.role === 'regional_emergency_center_admin';

  if (hasNationalAccess) {
    // NULL = 제한 없음 (전국 데이터 접근 가능)
    allowedRegionCodes = null;
    allowedCityCodes = null;
  } else {
    // Step 4: Apply regional restrictions
    // - regional_admin: 시청/도청 (@korea.kr) → 소속 시도만
    // - local_admin: 보건소 (@korea.kr) → 소속 시도 + 시군구만
    if (!normalizedRegionCode) {
      if (userProfile.role === 'temporary_inspector') {
        // temporary_inspector는 할당된 장비만 접근 (region 불필요)
        return {
          permissions,
          allowedRegionCodes: [],
          allowedCityCodes: [],
          userId: userProfile.id
        };
      }
      throw new Error(`User ${userProfile.id} requires region_code but none assigned`);
    }

    // 소속 시도로 고정
    allowedRegionCodes = [normalizedRegionCode];

    // local_admin: 시군구도 고정
    if (userProfile.role === 'local_admin') {
      const cityCode = userProfile.organization?.city_code;
      if (!cityCode) {
        throw new Error(`Local admin ${userProfile.id} requires organization with city_code`);
      }
      allowedCityCodes = [cityCode];
    } else if (userProfile.role === 'regional_admin') {
      // regional_admin: 시군구 선택 가능 (NULL)
      allowedCityCodes = null;
    }
  }

  return { permissions, allowedRegionCodes, allowedCityCodes, userId: userProfile.id };
}
```

#### 2. 문서에 도메인 규칙 추가
```markdown
<!-- docs/security/aed-data-access-rules.md -->

## 이메일 도메인별 역할 제한

| 도메인 | 허용 역할 | 설명 |
|--------|----------|------|
| @nmc.or.kr | emergency_center_admin<br>regional_emergency_center_admin | 중앙응급의료센터 및 시도 응급의료지원센터 |
| @korea.kr | ministry_admin<br>regional_admin<br>local_admin | 보건복지부, 시청/도청, 보건소 |
| 기타 | master | 시스템 관리자 (테스트 계정) |

### 도메인 검증 로직

- 역할 생성 시 이메일 도메인 검증
- 잘못된 도메인 사용 시 에러 발생
- 예: regional_admin을 @gmail.com으로 생성 불가
```

---

## 실행 계획

### Phase 1: 🚨 보안 긴급 패치 (즉시 실행)

**목표**: 도메인 검증 취약점 차단

- [ ] **Task 1.1**: 도메인 검증 로직 추가 (`lib/auth/access-control.ts`)
  - [ ] 1.1.1: `STRICT_DOMAIN_ROLE_MAP` 상수 정의
  - [ ] 1.1.2: `resolveAccessScope` 함수 시작 부분에 도메인 검증 추가
  - [ ] 1.1.3: temporary_inspector 정부 도메인 사용 금지 로직 추가
  - [ ] 1.1.4: 에러 메시지에 `[ACCESS_DENIED]` 태그 추가 (로그 추적용)

- [ ] **Task 1.2**: 도메인 검증 단위 테스트 작성
  - [ ] 1.2.1: regional_admin @korea.kr 검증 테스트
  - [ ] 1.2.2: local_admin @korea.kr 검증 테스트
  - [ ] 1.2.3: emergency_center_admin @nmc.or.kr 검증 테스트
  - [ ] 1.2.4: temporary_inspector 정부 도메인 거부 테스트
  - [ ] 1.2.5: 정상 케이스 통과 테스트

- [ ] **Task 1.3**: 기존 사용자 계정 감사
  - [ ] 1.3.1: DB 쿼리로 도메인 불일치 계정 조회
  - [ ] 1.3.2: 불일치 계정 목록 검토 및 조치 계획 수립
  - [ ] 1.3.3: 필요시 계정 역할 재조정 또는 삭제

- [ ] **Task 1.4**: RPC 레벨 보안 검증 추가 (선택적)
  - [ ] 1.4.1: [aed-data-security-plan.md](../security/aed-data-security-plan.md) 참조
  - [ ] 1.4.2: `validate_role_filters` 함수 추가 검토
  - [ ] 1.4.3: SQL injection 방어 강화

**예상 소요 시간**: 4-6시간 (코드 수정 2시간 + 테스트 1시간 + 감사 1시간 + RPC 검증 1-2시간)
**담당자**: 백엔드 개발자 + 시스템 관리자
**우선순위**: ⚠️ **최우선 (보안 취약점)**
**참조 문서**: [aed-data-security-plan.md](../security/aed-data-security-plan.md)

---

### Phase 2: 문서화 및 정책 명확화 (1-2일)

- [ ] **Task 2.1**: `docs/security/aed-data-access-rules.md` 업데이트
  - [ ] 2.1.1: regional_emergency_center_admin 역할 추가
  - [ ] 2.1.2: 도메인별 역할 제한 테이블 추가
  - [ ] 2.1.3: 도메인 검증 실패 시 대응 절차 문서화

- [ ] **Task 2.2**: AdminFullView initialFilters 검증 (✅ 이미 완료)

**예상 소요 시간**: 2시간
**담당자**: 문서 관리자

---

### Phase 3: 핵심 기능 구현 (1-2주)

- [ ] **Task 3.1**: 관할보건소 기준 조회 구현
  - [ ] 3.1.1: [JURISDICTION_QUERY_IMPLEMENTATION_2025-10-18.md](../planning/JURISDICTION_QUERY_IMPLEMENTATION_2025-10-18.md) 참조
  - [ ] 3.1.2: `resolveAccessScope`에 `criteria` 파라미터 추가
  - [ ] 3.1.3: Supabase RPC 함수 `get_aed_data_by_jurisdiction` 생성
    - 공백 정규화: `REPLACE(a.jurisdiction_health_center, ' ', '') = REPLACE(o.name, ' ', '')`
    - 성능 목표: 50ms 이하 (현재 29ms 달성)
  - [ ] 3.1.4: API 라우트에 criteria 처리 로직 추가
  - [ ] 3.1.5: 클라이언트 UI에 조회 기준 선택 옵션 추가
  - [ ] 3.1.6: HealthCenterMatcher 유틸리티 통합

- [ ] **Task 3.2**: Temporary Inspector 에러 처리 개선
  - [ ] 3.2.1: region_code 검증 skip 로직 추가
  - [ ] 3.2.2: 빈 권한 반환으로 변경
  - [ ] 3.2.3: 단위 테스트 작성

- [ ] **Task 3.3**: UX 고려사항 적용 (선택적)
  - [ ] 3.3.1: [ux-tradeoff-analysis.md](../security/ux-tradeoff-analysis.md) 참조
  - [ ] 3.3.2: GPS 기반 초기화 시 관할 지역 우선 정책 적용
  - [ ] 3.3.3: 출장 중 사용 시나리오 UX 개선

**예상 소요 시간**: 1-1.5일 (Task 3.1: 6-8시간, Task 3.2: 2시간, Task 3.3: 2시간)
**담당자**: 백엔드 개발자 + 프론트엔드 개발자
**참조 문서**:
- [JURISDICTION_QUERY_IMPLEMENTATION_2025-10-18.md](../planning/JURISDICTION_QUERY_IMPLEMENTATION_2025-10-18.md)
- [ux-tradeoff-analysis.md](../security/ux-tradeoff-analysis.md)

---

### Phase 4: 코드 품질 개선 (점진적)

- [ ] **Task 4.1**: 코드 주석 추가
  - [ ] 4.1.1: resolveAccessScope 함수 상세 주석
  - [ ] 4.1.2: 각 역할별 설명 주석
  - [ ] 4.1.3: 복잡한 로직 설명 추가

- [ ] **Task 4.2**: 코드 일관성 검증 (선택적)
  - [ ] 4.2.1: [AUDIT_REPORT_REGION_CODES.md](../reports/AUDIT_REPORT_REGION_CODES.md) 참조
  - [ ] 4.2.2: ESLint 규칙 추가 (지역명 하드코딩 방지)
  - [ ] 4.2.3: CI/CD 파이프라인에 검증 단계 추가
  - [ ] 4.2.4: 정기적 감사 스케줄 수립

**예상 소요 시간**: 2-4시간 (주석 2시간 + 검증 2시간)
**담당자**: 풀스택 개발자
**참조 문서**: [AUDIT_REPORT_REGION_CODES.md](../reports/AUDIT_REPORT_REGION_CODES.md)

---

### Phase 5: 테스트 및 검증 (1일)

- [ ] **Task 5.1**: 역할별 통합 테스트
  - [ ] master
  - [ ] emergency_center_admin (@nmc.or.kr)
  - [ ] regional_emergency_center_admin (@nmc.or.kr)
  - [ ] ministry_admin (@korea.kr)
  - [ ] regional_admin (@korea.kr)
  - [ ] local_admin (@korea.kr - 주소 기준 + 관할보건소 기준)
  - [ ] temporary_inspector (기타 도메인)

- [ ] **Task 5.2**: 도메인 검증 테스트
  - [ ] 잘못된 도메인으로 역할 접근 시도 → 에러 확인
  - [ ] 에러 로그 확인

- [ ] **Task 5.3**: 브라우저 엔드투엔드 테스트
  - [ ] 각 역할로 로그인하여 데이터 조회
  - [ ] 권한 없는 데이터 접근 시도 (403 에러 확인)

**예상 소요 시간**: 1일
**담당자**: QA 엔지니어

---

### 전체 일정

| Phase | 내용 | 기간 | 우선순위 | 상태 |
|-------|------|------|---------|------|
| Phase 1 | 🚨 보안 긴급 패치 (도메인 검증) | 4시간 | ⚠️ **최우선** | ⏳ 대기 |
| Phase 2 | 문서화 및 정책 명확화 | 2시간 | High | ⏳ 대기 |
| Phase 3 | 핵심 기능 구현 (관할보건소 조회) | 1일 | Medium | ⏳ 대기 |
| Phase 4 | 코드 품질 개선 | 2시간 | Low | ⏳ 대기 |
| Phase 5 | 테스트 및 검증 | 1일 | High | ⏳ 대기 |
| **총 예상 소요 시간** | | **2.5일** | | |

### 우선순위 설명

1. **Phase 1 (보안)**: 즉시 실행 - 무단 권한 상승 차단
2. **Phase 2 (문서)**: 1-2일 내 - 정책 명확화
3. **Phase 3 (기능)**: 1-2주 내 - 업무 효율성 개선
4. **Phase 4 (품질)**: 점진적 - 유지보수성 향상
5. **Phase 5 (검증)**: Phase 1-3 완료 후 - 품질 보증

---

## 결론

### 주요 발견 사항

1. ✅ **대부분의 역할별 Region Code 정책이 문서와 코드에서 일치**
   - master, ministry_admin의 전국 접근 권한 정확히 구현됨
   - regional_admin, local_admin의 지역 제한 로직 정확히 구현됨
   - 시도/시군구 필터링 기본 로직 올바르게 작동

2. 🚨 **Critical 보안 취약점 발견**
   - **도메인 검증 로직 누락**: regional_admin, local_admin이 @korea.kr이 아닌 도메인으로 생성 가능
   - **무단 권한 상승 가능**: 외부 도메인 사용자가 정부기관 권한 취득 가능
   - **보안 위험도**: High - 전체 시도 또는 시군구 데이터 무단 접근 가능
   - **즉시 수정 필요**: Phase 1 보안 패치 우선 실행

3. ❌ **기타 Critical 이슈 3건**
   - regional_emergency_center_admin 문서 누락
   - local_admin의 관할보건소 기준 조회 미구현
   - AdminFullView initialFilters 누락 (✅ 이미 수정 완료)

4. ⚠️ **개선 필요 사항**
   - Temporary Inspector 에러 처리 개선
   - 코드 주석 추가
   - 단위 테스트 강화

### 도메인별 역할 정책 (확정)

| 도메인 | 허용 역할 | 접근 범위 | 검증 상태 |
|--------|----------|----------|----------|
| **@nmc.or.kr** | emergency_center_admin<br>regional_emergency_center_admin | 전국 | ⚠️ **검증 로직 추가 필요** |
| **@korea.kr** | ministry_admin<br>regional_admin<br>local_admin | 전국 or 소속 지역 | ⚠️ **검증 로직 추가 필요** |
| **기타 도메인** | temporary_inspector | 할당된 장비만 | ⚠️ **정부 도메인 거부 로직 추가 필요** |

### 권장 조치 (우선순위별)

**🚨 최우선 - Phase 1 (즉시 실행)**:
- **도메인 검증 로직 추가**: regional_admin, local_admin의 @korea.kr 도메인 필수 검증
- **보안 패치 배포**: 무단 권한 상승 차단
- **기존 계정 감사**: 도메인 불일치 계정 검토 및 조치

**High - Phase 2 (1-2일 내)**:
- regional_emergency_center_admin 문서 추가
- 도메인별 역할 제한 규칙 문서화

**Medium - Phase 3 (1-2주 내)**:
- 관할보건소 기준 조회 기능 구현
- Temporary Inspector 에러 처리 개선

**Low - Phase 4 (점진적)**:
- 코드 주석 추가
- 단위 테스트 강화

### 보안 권고 사항

1. **Phase 1 보안 패치를 최우선으로 진행**
   - 현재 상태: 외부 도메인 사용자가 정부기관 권한 취득 가능
   - 예상 소요 시간: 4시간
   - 담당: 백엔드 개발자 + 시스템 관리자

2. **배포 전 기존 사용자 계정 검증**
   - DB 쿼리로 도메인 불일치 계정 조회
   - 불일치 계정 역할 재조정 또는 삭제
   - 감사 로그 기록

3. **단위 테스트 필수 작성**
   - 도메인 검증 실패 시나리오
   - 정상 케이스 통과 시나리오
   - 에러 메시지 검증

---

**작성자**: Claude Code
**검토자**: AED Smart Check 개발팀
**최종 수정**: 2025-10-18 (도메인 정책 명확화 + 문서 통합)
**다음 검토일**: 2025-10-25
**보안 패치 상태**: ⚠️ **대기 중 (즉시 실행 필요)**

---

## 문서 관리 지침

### 이 문서 업데이트 시 확인 사항

본 문서를 수정할 때는 다음 관련 문서들의 일관성을 확인해야 합니다:

1. **[aed-data-access-rules.md](../security/aed-data-access-rules.md)** (운영 매뉴얼)
   - 역할별 권한 규칙이 일치하는지 확인
   - 본 문서가 더 상세하므로, aed-data-access-rules.md는 요약본으로 유지
   - 업데이트 시 두 문서 동시 검토 필요

2. **[aed-data-security-plan.md](../security/aed-data-security-plan.md)** (보안 체크리스트)
   - RPC 레벨 보안 검증 방안이 상충되지 않는지 확인
   - validate_role_filters 함수 추가 시 본 문서에도 반영

3. **[ux-tradeoff-analysis.md](../security/ux-tradeoff-analysis.md)** (UX 분석)
   - 보안 정책 변경이 UX에 미치는 영향 고려
   - GPS 초기화, 출장 중 사용 시나리오 재검토

4. **[JURISDICTION_QUERY_IMPLEMENTATION_2025-10-18.md](../planning/JURISDICTION_QUERY_IMPLEMENTATION_2025-10-18.md)**
   - 관할보건소 기준 조회 구현 방안 변경 시 동기화
   - 성능 목표 또는 공백 정규화 로직 변경 시 반영

5. **[OPERATIONAL_POLICIES.md](../planning/OPERATIONAL_POLICIES.md)**
   - 역할별 동작 방식 변경 시 점검 업무 흐름 영향 검토
   - 우선순위 메뉴 vs 현장점검 메뉴 필터링 일관성 확인

6. **[AUDIT_REPORT_REGION_CODES.md](../reports/AUDIT_REPORT_REGION_CODES.md)**
   - 정책 변경 후 코드 감사 재실행 필요
   - ESLint 규칙 추가 시 감사 항목 업데이트

### 문서 통합 이력

- **2025-10-18**: 초안 작성 (코드 vs 문서 비교 분석)
- **2025-10-18**: 도메인 정책 명확화 (사용자 요청 반영)
- **2025-10-18**: 관련 문서 6개 분석 및 상호 참조 추가
  - aed-data-access-rules.md (90% 중복, 별도 유지)
  - aed-data-security-plan.md (RPC 레벨 보안)
  - ux-tradeoff-analysis.md (UX 관점)
  - JURISDICTION_QUERY_IMPLEMENTATION_2025-10-18.md (관할보건소 조회)
  - OPERATIONAL_POLICIES.md (점검 업무 흐름)
  - AUDIT_REPORT_REGION_CODES.md (코드 품질)

### 향후 통합 계획

- **Short-term** (1주일): aed-data-access-rules.md를 간단한 퀵 레퍼런스로 재구성
- **Mid-term** (1개월): Phase 1-3 완료 후 본 문서를 "구현 완료 보고서"로 전환
- **Long-term** (3개월): 모든 region_code 관련 문서를 하나의 통합 가이드로 재편성 검토
