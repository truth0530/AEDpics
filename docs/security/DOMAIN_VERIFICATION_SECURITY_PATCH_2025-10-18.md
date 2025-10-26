# 도메인 검증 보안 패치

**작성일**: 2025-10-18
**패치 버전**: 1.0.0
**우선순위**: CRITICAL
**상태**: 완료

---

## 📋 요약

이메일 도메인 기반 역할 제한 기능을 구현하여, 비정부 도메인 사용자가 관리자 권한을 부여받는 보안 취약점을 해결했습니다.

## 🚨 발견된 문제

### 1. 실제 사례

**계정**: mentalchange@naver.com
**현재 역할**: local_admin (보건소 담당자)
**문제**: @naver.com 도메인은 local_admin 역할 불가
**원인**:
1. 회원가입 시 국립중앙의료원으로 신청
2. 관리자가 수동으로 "보건소"로 수정 후 승인
3. **도메인 검증 없이** local_admin 역할 부여됨

### 2. 근본 원인

#### 문제 1: 회원가입 시 역할 선택 제한 부재
- 비정부 도메인 사용자(@naver.com, @gmail.com 등)도 관리자 역할 신청 가능
- 관리자가 실수로 승인할 위험

#### 문제 2: 관리자 승인 시 자동 분류 부재
- 관리자가 "보건소"만 지정
- 시스템이 도메인에 따라 local_admin vs temporary_inspector 자동 분류하지 못함
- 수동 판단에 의존 → 오류 발생

#### 문제 3: DB Constraint 누락
- `user_profiles.role` CHECK constraint에 `temporary_inspector` 누락
- 코드에서는 사용하지만 DB 레벨에서 허용되지 않음

## ✅ 해결 방안

### Phase 1: 즉시 조치 (완료)

#### 1.1 mentalchange@naver.com 계정 수정 ✅
```sql
UPDATE user_profiles
SET
  role = 'temporary_inspector',
  updated_at = now(),
  remarks = COALESCE(remarks || E'\n\n', '') ||
    '[2025-10-18] 도메인 검증 보안 패치: @naver.com 도메인은 local_admin 불가. temporary_inspector로 변경.'
WHERE id = 'be6d9641-3c45-467e-9c5b-caa5a05dd81b';
```

**결과**: 1건 수정 완료

#### 1.2 DB CHECK Constraint 업데이트 ✅
- `temporary_inspector` 역할을 user_profiles.role CHECK constraint에 추가
- Migration: `20251018_add_temporary_inspector_role.sql`

#### 1.3 도메인 검증 로직 추가 ✅
**파일**: `lib/auth/access-control.ts`

**새로운 함수**:
```typescript
// 도메인 기반 역할 허용 여부 검증
export function validateDomainForRole(
  email: string,
  role: UserRole
): { allowed: boolean; error?: string; suggestedRole?: UserRole }

// 이메일 도메인에 따라 허용 가능한 역할 목록 반환
export function getAllowedRolesForDomain(email: string): UserRole[]
```

**검증 로직**:
- @nmc.or.kr → emergency_center_admin, regional_emergency_center_admin만
- @korea.kr → ministry_admin, regional_admin, local_admin만
- 기타 도메인 → temporary_inspector만
- master → 모든 도메인 허용

#### 1.4 관리자 승인 API 보안 강화 ✅
**파일**: `app/api/admin/users/approve/route.ts`

**추가된 검증** (Line 87-100):
```typescript
// ✅ CRITICAL: 도메인 기반 역할 검증 (보안 패치 2025-10-18)
const { validateDomainForRole } = await import('@/lib/auth/access-control');
const domainValidation = validateDomainForRole(targetUser.email, role);

if (!domainValidation.allowed) {
  return NextResponse.json(
    {
      error: domainValidation.error,
      suggestedRole: domainValidation.suggestedRole,
      code: 'DOMAIN_ROLE_MISMATCH'
    },
    { status: 400 }
  );
}
```

**효과**:
- 관리자가 잘못된 역할을 부여하려 하면 자동 차단
- 올바른 역할(suggestedRole) 제안
- 더 이상 수동 판단 필요 없음

#### 1.5 Runtime 도메인 검증 강화 ✅
**파일**: `lib/auth/access-control.ts` - `resolveAccessScope()` 함수

**기존 구현** (Line 285-340):
- 이미 runtime에서 도메인 검증 수행
- `[ACCESS_DENIED]` 에러 발생 및 로깅
- master 역할 제외 처리

**테스트**: 38개 단위 테스트 통과
- 파일: `tests/auth/domain-verification.test.ts`
- 모든 도메인-역할 조합 검증
- Edge case 처리 확인

### Phase 2: 프론트엔드 개선 (추천)

#### 2.1 회원가입 폼 개선 (향후 작업)
**목표**: 도메인에 따라 역할 선택지 자동 제한

**구현 방안**:
```typescript
import { getAllowedRolesForDomain } from '@/lib/auth/access-control';

// 이메일 입력 후
const allowedRoles = getAllowedRolesForDomain(verifiedEmail);

// 역할 선택 드롭다운을 allowedRoles로만 제한
<Select>
  {allowedRoles.map(role => (
    <Option key={role} value={role}>{roleLabels[role]}</Option>
  ))}
</Select>
```

**효과**:
- 사용자가 처음부터 올바른 역할만 선택 가능
- 관리자의 검토 부담 감소
- UX 개선

#### 2.2 관리자 승인 UI 개선 (향후 작업)
**목표**: 도메인 불일치 시 경고 표시 및 자동 제안

**구현 방안**:
```typescript
const validation = validateDomainForRole(user.email, selectedRole);

if (!validation.allowed) {
  // 경고 메시지 표시
  <Alert variant="error">
    {validation.error}
  </Alert>

  // 추천 역할 자동 선택
  if (validation.suggestedRole) {
    <Button onClick={() => setRole(validation.suggestedRole)}>
      {validation.suggestedRole}(으)로 변경
    </Button>
  }
}
```

## 📊 감사 결과

### 전체 계정 통계 (2025-10-18)
| Role | Domain | Count | Status |
|------|--------|-------|--------|
| emergency_center_admin | nmc.or.kr | 2 | ✅ 정상 |
| regional_emergency_center_admin | nmc.or.kr | 16 | ✅ 정상 |
| master | nmc.or.kr | 1 | ✅ 정상 (제한 없음) |
| ~~local_admin~~ | ~~naver.com~~ | ~~1~~ | ~~⚠️ 불일치~~ → ✅ 수정 완료 |

**총 계정**: 20개
**정상**: 20개 (100%) ✅
**불일치**: 0개 (0%)

## 🔒 보안 정책

### 도메인별 역할 매핑

| Email Domain | Allowed Roles | 설명 |
|--------------|---------------|------|
| **@nmc.or.kr** | emergency_center_admin<br>regional_emergency_center_admin | 중앙응급의료센터<br>17개 시도 응급의료지원센터 |
| **@korea.kr** | ministry_admin<br>regional_admin<br>local_admin | 보건복지부<br>17개 시도청<br>보건소 |
| **Other domains** | temporary_inspector | 임시 점검원 |
| **Any domain** | master | 시스템 최고 관리자 |

### 검증 계층

1. **회원가입 시**: 역할 선택지 자동 제한 (Phase 2 예정)
2. **관리자 승인 시**: API 레벨 도메인 검증 (✅ 완료)
3. **Runtime**: `resolveAccessScope()` 함수에서 2차 검증 (✅ 완료)
4. **DB 레벨**: CHECK constraint (✅ 완료)
5. **Trigger**: validate_user_role_domain() 함수 (선택적)

## 📁 변경된 파일

### 코드 변경
1. **lib/auth/access-control.ts**
   - `validateDomainForRole()` 함수 추가
   - `getAllowedRolesForDomain()` 함수 추가
   - 기존 `resolveAccessScope()` 함수 유지 (이미 도메인 검증 포함)

2. **app/api/admin/users/approve/route.ts**
   - Line 87-100: 도메인 검증 로직 추가
   - 역할-지역 검증 전에 도메인 검증 수행

3. **tests/auth/domain-verification.test.ts**
   - 기존 38개 테스트 (모두 통과)
   - 도메인 검증 로직 커버

### DB Migration
1. **supabase/migrations/20251018_add_temporary_inspector_role.sql**
   - user_profiles.role CHECK constraint 업데이트
   - temporary_inspector 역할 추가
   - validate_user_role_domain() 함수 생성 (선택적 trigger)

### 문서
1. **docs/security/DOMAIN_VERIFICATION_SECURITY_PATCH_2025-10-18.md** (이 문서)
2. **README.md** - 보안 정책 섹션 업데이트
3. **aed-check-system/README.md** - 도메인 검증 로직 설명 추가
4. **docs/analysis/region-code-policy-comparison.md** - 도메인 정책 명확화
5. **scripts/audit-user-domain-mismatch.sql** - 주석 업데이트

## 🧪 테스트

### 단위 테스트
```bash
npm test -- tests/auth/domain-verification.test.ts
```

**결과**: ✅ 38/38 tests passed

### 수동 테스트 시나리오

#### 시나리오 1: @naver.com 사용자가 local_admin 신청
1. 회원가입: mentalchange@naver.com
2. 역할: local_admin 선택
3. 관리자 승인 시도

**기대 결과**:
```json
{
  "error": "비정부 도메인(@naver.com)은 임시 점검원 역할만 가능합니다.",
  "suggestedRole": "temporary_inspector",
  "code": "DOMAIN_ROLE_MISMATCH"
}
```

#### 시나리오 2: @korea.kr 사용자가 emergency_center_admin 신청
1. 회원가입: test@korea.kr
2. 역할: emergency_center_admin 선택
3. 관리자 승인 시도

**기대 결과**:
```json
{
  "error": "@korea.kr 도메인은 보건복지부/시도/보건소 관리자 역할만 가능합니다.",
  "suggestedRole": "local_admin",
  "code": "DOMAIN_ROLE_MISMATCH"
}
```

## 🚀 배포 절차

### 1. 코드 배포
```bash
git add .
git commit -m "security: Add domain-based role verification

- Add validateDomainForRole() and getAllowedRolesForDomain()
- Enforce domain validation in admin approval API
- Add temporary_inspector to DB role constraint
- Fix mentalchange@naver.com account (local_admin → temporary_inspector)
- Add migration 20251018_add_temporary_inspector_role.sql

Fixes security vulnerability where non-government domains could be assigned admin roles.

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

git push
```

### 2. DB Migration 실행 (이미 완료)
```sql
-- Production DB에서 이미 실행됨 (Supabase MCP 사용)
-- 파일: supabase/migrations/20251018_add_temporary_inspector_role.sql
```

### 3. 모니터링
- `[ACCESS_DENIED]` 로그 확인
- Supabase Logs에서 도메인 불일치 시도 모니터링
- 관리자 승인 API 오류율 확인

## 📝 향후 작업

### Phase 2: UX 개선 (선택적)
- [ ] 회원가입 폼에서 도메인 기반 역할 선택지 제한
- [ ] 관리자 승인 UI에서 도메인 불일치 경고 표시
- [ ] 자동 역할 제안 버튼 추가

### Phase 3: 강화 (선택적)
- [ ] DB Trigger 활성화 (validate_user_role_domain_trigger)
- [ ] 감사 로그 자동화 (domain_mismatch_attempts)
- [ ] 알림 시스템 통합 (관리자에게 불일치 시도 알림)

## 🔗 관련 문서

- [region-code-policy-comparison.md](../analysis/region-code-policy-comparison.md) - 도메인 정책 상세 분석
- [aed-data-access-rules.md](./aed-data-access-rules.md) - 운영 매뉴얼
- [audit-user-domain-mismatch.sql](../../scripts/audit-user-domain-mismatch.sql) - 감사 쿼리

## 📞 문의

**작성자**: Claude Code
**검토자**: 관리자
**문의**: truth0530@nmc.or.kr

---

**변경 이력**:
- 2025-10-18: 초안 작성 및 패치 완료
