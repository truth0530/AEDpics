# 가입 프로세스 보안 검토 보고서

**날짜**: 2025-11-10
**대상**: 역할-조직 일관성 검증
**상태**: 🔴 **중요 취약점 발견**

---

## 문제 상황

`vkarmav@naver.com` 계정이 다음과 같은 데이터 불일치로 인해 점검 시작 시 로그아웃되는 문제 발생:

```
계정 정보:
- 이메일: vkarmav@naver.com (임시점검원)
- 저장된 organization_name: 중앙응급의료센터 ❌
- 실제 할당 조직: 제주시 보건소 ✓
- 권한: temporary_inspector

role: temporary_inspector는 health_center(보건소)만 선택 가능해야 함
하지만 중앙응급의료센터(emergency_center)를 선택했음
```

---

## 근본 원인 분석

### 1. 가입 프로세스의 검증 부족

**파일**: `/app/api/auth/signup/route.ts`

**현재 검증 항목**:
```typescript
// ✅ 이메일 도메인 검증 (라인 60-65)
if (!isAllowedEmailDomain(email)) {
  return error('허용되지 않은 이메일 도메인입니다');
}

// ✅ 지역 정보 검증 (라인 87-101)
const regionValidation = validateRegionInfo(organizationInfo);

// ✅ 임시점검원 조직 검증 (라인 107-160)
if (isTemporaryInspector && profileData.organizationId) {
  // local_admin 유무 확인만 함
  const organization = await prisma.organizations.findFirst({...});
  if (organization.user_profiles.length === 0) {
    return error('담당자가 없습니다');
  }
}
```

**부족한 검증**:
```typescript
// ❌ 없음: 역할과 조직 타입의 일관성 검증
// temporary_inspector가 emergency_center를 선택하는 것을 막지 않음
// regional_admin이 health_center를 선택하는 것을 막지 않음
```

### 2. 프론트엔드 필터링의 한계

**파일**: `/app/auth/signup/page.tsx`

**현재 프론트엔드 필터링** (라인 136-157):
```typescript
if (domain !== 'korea.kr' && domain !== 'nmc.or.kr') {
  // 임시점검원: local_admin이 있는 조직만 표시
  const response = await fetch(
    `/api/organizations/with-admin?region=${region}`
  );
  setDynamicOrganizations(orgNames);
}
```

**문제점**:
- 프론트엔드 필터링만 의존 (우회 가능)
- 조직 타입(health_center vs emergency_center)으로 필터링하지 않음
- 사용자가 브라우저 개발자 도구로 조직 ID를 임의로 변경 가능

---

## CLAUDE.md 권한 체계 재확인

### 역할-조직 타입 매핑 (절대 불변)

```typescript
// lib/constants/role-organization-mapping.ts
{
  'emergency_center_admin': ['emergency_center'],           // 응급의료센터만
  'regional_emergency_center_admin': ['emergency_center'],  // 응급의료센터만
  'ministry_admin': ['province'],                           // 시도만
  'regional_admin': ['province'],                           // 시도만
  'local_admin': ['health_center'],                         // 보건소만
  'temporary_inspector': ['health_center'],                 // 보건소만 ⚠️
  'master': ['province', 'health_center', 'emergency_center']
}
```

**임시점검원(temporary_inspector)**:
- **필수 조직 타입**: `health_center` (보건소) 만
- **금지 조직 타입**: `emergency_center`, `province`

---

## 검증 코드 체크리스트

### 현재 구현 현황

| 검증 항목 | 구현 | 파일 | 상태 |
|---------|------|------|------|
| 이메일 도메인 | ✅ | signup/route.ts:60 | 정상 |
| 지역 정보 | ✅ | signup/route.ts:87 | 부분 |
| 임시점검원 local_admin | ✅ | signup/route.ts:110 | 불완전 |
| **역할-조직 타입** | ❌ | **없음** | **누락** |
| 조직 타입 추론 | ✅ | region-validation.ts:192 | 미사용 |

---

## 개선 방안

### 1단계: 백엔드 검증 추가 (필수)

**수정 위치**: `/app/api/auth/signup/route.ts` (라인 160 이후)

```typescript
// 추가할 코드
import {
  ROLE_ORGANIZATION_TYPE_MAP
} from '@/lib/constants/role-organization-mapping';
import { inferOrganizationType } from '@/lib/auth/region-validation';

// 8.5. 역할-조직 타입 일관성 검증 (신규)
const organizationRole = profileData.role || 'temporary_inspector';
const organizationType = inferOrganizationType(
  profileData.organizationName || ''
);

const allowedTypes = ROLE_ORGANIZATION_TYPE_MAP[organizationRole] || [];
if (!allowedTypes.includes(organizationType)) {
  return NextResponse.json(
    {
      success: false,
      error: `${organizationRole} 역할은 ${organizationType} 조직을 선택할 수 없습니다. ` +
             `허용된 조직 타입: ${allowedTypes.join(', ')}`
    },
    { status: 400 }
  );
}
```

### 2단계: 프론트엔드 필터링 강화

**수정 위치**: `/app/auth/signup/page.tsx` (라인 134-156)

```typescript
// 현재 (부족함)
if (domain !== 'korea.kr' && domain !== 'nmc.or.kr') {
  const response = await fetch(`/api/organizations/with-admin?region=...`);
  // 모든 health_center 반환
}

// 개선 안 (역할별 필터링)
if (domain !== 'korea.kr' && domain !== 'nmc.or.kr') {
  // 임시점검원이므로 역할을 'temporary_inspector'로 지정
  const response = await fetch(
    `/api/organizations/with-admin?region=${region}&role=temporary_inspector`
  );
  // API에서 health_center만 필터링하여 반환
}
```

### 3단계: API 엔드포인트 강화

**수정 위치**: `/app/api/organizations/with-admin/route.ts`

현재 코드는 이미 `role` 파라미터와 `ROLE_ORGANIZATION_TYPE_MAP`을 사용하고 있습니다. ✅

```typescript
// 이미 구현되어 있음
const allowedTypes = getAllowedOrganizationTypes(role);
if (role && !includeAll && allowedTypes.length > 0) {
  type: { in: allowedTypes as any }  // 역할별 필터링
}
```

---

## 검증 흐름 (개선 후)

```
사용자 가입 (vkarmav@naver.com)
    ↓
1. 이메일 도메인 검증: naver.com ✓ (허용)
    ↓
2. 임시점검원 판정: domain !== 'korea.kr' && domain !== 'nmc.or.kr'
    ↓
3. 조직 선택 (프론트엔드):
   - 조직 목록 요청: /api/organizations/with-admin?region=JEJ&role=temporary_inspector
   - API 응답: health_center 타입만 필터링하여 반환
   - 사용자: 제주시 보건소 (O) / 중앙응급의료센터 (X) 선택 불가
    ↓
4. 가입 제출 (백엔드):
   - 조직명: "중앙응급의료센터" ← 선택 불가하므로 여기까지 올 수 없음
    ↓
5. 역할-조직 타입 검증:
   - 역할: temporary_inspector
   - 조직 타입: emergency_center
   - allowedTypes: ['health_center']
   - 결과: ❌ 일치하지 않음 → 거부
    ↓
6. 에러 메시지: "temporary_inspector 역할은 emergency_center 조직을 선택할 수 없습니다"
```

---

## 테스트 케이스

### Case 1: 임시점검원이 응급의료센터 선택 (차단되어야 함)
```
- 이메일: test@naver.com
- 역할: temporary_inspector
- 조직: 중앙응급의료센터
- 예상 결과: ❌ 거부 (역할-조직 타입 불일치)
```

### Case 2: 임시점검원이 보건소 선택 (허용되어야 함)
```
- 이메일: test@naver.com
- 역할: temporary_inspector
- 조직: 제주시 보건소
- 예상 결과: ✅ 허용
```

### Case 3: 지역담당자가 보건소 선택 (차단되어야 함)
```
- 이메일: test@korea.kr
- 역할: regional_admin (지역담당자)
- 조직: 보건소 (health_center)
- 예상 결과: ❌ 거부 (regional_admin은 province만 선택 가능)
```

### Case 4: nmc.or.kr은 모든 조직 선택 가능 (허용)
```
- 이메일: test@nmc.or.kr
- 역할: emergency_center_admin
- 조직: 보건소, 응급의료센터, 시도 등
- 예상 결과: ✅ 모두 허용
```

---

## 권장 조치

### 우선순위 1 (즉시 시행)
- ✅ **완료**: vkarmav@naver.com 계정 수정 (2025-11-10)
  - organization_name: "중앙응급의료센터" → "제주시 보건소"
  - in_progress 할당 4개 → pending으로 리셋

### 우선순위 2 (이번 주)
- [ ] 백엔드 검증 코드 추가 (`/app/api/auth/signup/route.ts`)
  - 역할-조직 타입 일관성 검증
  - 모든 허용 역할에 대해 매핑 검증

### 우선순위 3 (다음주)
- [ ] 관리자 화면 수정 기능에도 동일한 검증 적용
  - `/app/(authenticated)/admin/users/edit/[id]/page.tsx`
  - 역할 변경 시 조직 재검증

### 우선순위 4 (지속적)
- [ ] 정기적인 데이터 무결성 점검
  - 역할-조직 타입 매칭 확인
  - organization_name vs organizations 테이블 비교

---

## 결론

현재 시스템은:
- **프론트엔드**: 필터링으로 부분 제어 (우회 가능)
- **백엔드**: 지역 정보는 검증하지만 역할-조직 매핑은 검증 없음
- **결과**: 임시점검원이 다른 타입의 조직을 선택할 수 있는 보안 취약점 존재

**개선 후**:
- 프론트엔드 + 백엔드 이중 검증으로 완전한 보호 가능
- vkarmav@naver.com처럼 데이터 불일치로 인한 버그 사전 방지
- CLAUDE.md의 절대 불변 권한 체계를 기술적으로 강제

---

## 첨부

- `lib/constants/role-organization-mapping.ts` - 역할-조직 매핑 (이미 구현됨)
- `lib/auth/region-validation.ts` - 조직 타입 추론 (미사용, 활용 필요)
- `app/api/organizations/with-admin/route.ts` - API 필터링 (정상 동작)
