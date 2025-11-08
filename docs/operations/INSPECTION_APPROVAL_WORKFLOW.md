# 점검 승인 워크플로우 및 지역담당자 위임 체계

## 개요

이 문서는 임시점검원의 점검 데이터 승인 프로세스와 지역담당자(regional_admin)에서 보건소 담당자(local_admin)로의 권한 이양 메커니즘을 설명합니다.

**핵심 원칙**:
- 임시점검원의 점검 데이터는 조직의 담당자가 승인해야 함
- 담당자가 없는 조직의 경우, 17개 지역응급의료센터(regional_admin)가 임시로 승인 권한 수행
- 향후 각 조직의 담당자가 가입하면 자동으로 권한 인수

## 1. 역할 및 권한 매트릭스

### 역할 정의

| 역할 | 조직 | 점검 승인 권한 | 범위 |
|------|------|-------------|------|
| **master** | 중앙 | 모든 점검 승인/거부 | 전국 (모든 조직) |
| **regional_admin** | 17개 시도 응급의료지원센터 | 담당자 없는 조직의 점검만 승인 | 해당 시도 내 조직들 |
| **local_admin** | 각 보건소 | 해당 조직의 점검만 승인/거부 | 소속 조직만 |
| **temporary_inspector** | 각 조직 | 점검 제출만 (승인 불가) | 소속 조직만 |

### 승인 권한 결정 로직

```typescript
// lib/utils/inspection-approval.ts: getApproverForInspection()

1. 조직에 local_admin이 있는가?
   ├─ Yes: local_admin이 승인 권한 담당
   └─ No: regional_admin(지역응급의료센터)이 임시 승인 권한 담당
```

**예시**:
- 충주시 보건소:
  - 현재: local_admin 없음 → 충청북도 응급의료지원센터(regional_admin) 승인
  - 미래: local_admin 충주시보건소담당자 등록 → 자동으로 충주시보건소담당자가 승인

## 2. 점검 승인 워크플로우

### 상태 전이도

```
점검 제출
    ↓
approval_status = 'submitted'
    ↓
[승인 대기]
regional_admin 또는 local_admin이 검토
    ├─ 승인 → approval_status = 'approved'
    │          approved_by = [approver_id]
    │          approved_at = [timestamp]
    └─ 거부 → approval_status = 'rejected'
             approved_by = [approver_id]
             approved_at = [timestamp]
             rejection_reason = [reason]
```

### 데이터베이스 스키마

#### inspections 테이블 확장 (2025-11-08)

```sql
ALTER TABLE "inspections" ADD COLUMN "approval_status" "inspection_approval_status" NOT NULL DEFAULT 'submitted';
ALTER TABLE "inspections" ADD COLUMN "approved_by_id" UUID;
ALTER TABLE "inspections" ADD COLUMN "approved_at" TIMESTAMPTZ(6);
ALTER TABLE "inspections" ADD COLUMN "rejection_reason" TEXT;

CREATE INDEX "idx_inspections_approval_status" ON "inspections"("approval_status");
CREATE INDEX "idx_inspections_approved_by_id" ON "inspections"("approved_by_id");
```

#### inspection_approval_status 열거형

```sql
CREATE TYPE "inspection_approval_status" AS ENUM (
  'submitted',  -- 방금 제출됨, 승인 대기 중
  'pending',    -- 승인 진행 중 (선택사항)
  'approved',   -- 승인됨
  'rejected'    -- 거부됨
);
```

## 3. API 엔드포인트

### 승인 API

#### GET `/api/inspections/pending`
현재 사용자가 승인해야 할 대기 중인 점검 목록 조회

```typescript
// 응답
{
  success: true,
  count: 10,
  inspections: [
    {
      id: "inspection-uuid",
      equipment_serial: "AED-12345",
      inspector_id: "user-uuid",
      approval_status: "submitted",
      created_at: "2025-11-08T10:30:00Z",
      user_profiles: { /* 점검원 정보 */ }
    }
  ]
}
```

**권한**:
- master: 모든 대기 점검
- regional_admin: 담당 지역의 담당자 없는 조직 점검들
- local_admin: 소속 조직의 점검들

---

#### GET `/api/inspections/{id}/approvers`
특정 점검의 승인자 정보 조회

```typescript
// 응답
{
  success: true,
  inspectionId: "inspection-uuid",
  currentStatus: "submitted",
  approverType: "local_admin",  // 또는 "regional_admin", "master"
  approvers: [
    {
      id: "user-uuid",
      email: "user@example.com",
      name: "담당자 이름"
    }
  ],
  organization: {
    id: "org-uuid",
    name: "충주시 보건소",
    region_code: "CBB"  // 충청북도
  },
  inspector: {
    id: "inspector-uuid",
    name: "임시점검원 이름"
  },
  currentApprover: null  // 아직 승인되지 않으면 null
}
```

---

#### PATCH `/api/inspections/{id}/approve`
점검 승인

```typescript
// 요청
PATCH /api/inspections/{id}/approve

// 응답 (성공)
{
  success: true,
  message: "Inspection approved successfully",
  inspection: {
    id: "inspection-uuid",
    approval_status: "approved",
    approved_by_id: "approver-uuid",
    approved_at: "2025-11-08T14:00:00Z",
    approved_by: {
      id: "approver-uuid",
      email: "approver@example.com",
      name: "승인자 이름"
    }
  }
}
```

**권한 검증**:
- master: 모든 점검 승인 가능
- regional_admin: 담당 지역의 local_admin 없는 조직만
- local_admin: 소속 조직만
- 그 외: 403 Forbidden

**상태 검증**:
- 'submitted' 또는 'pending' 상태만 승인 가능
- 이미 'approved' 또는 'rejected' 상태는 거부

---

#### PATCH `/api/inspections/{id}/reject`
점검 거부

```typescript
// 요청
PATCH /api/inspections/{id}/reject
{
  "reason": "배터리 상태 정보 불완전, 재점검 필요"
}

// 응답 (성공)
{
  success: true,
  message: "Inspection rejected successfully",
  inspection: {
    id: "inspection-uuid",
    approval_status: "rejected",
    rejection_reason: "배터리 상태 정보 불완전, 재점검 필요",
    approved_by_id: "approver-uuid",
    approved_at: "2025-11-08T14:05:00Z"
  }
}
```

**필수 항목**:
- reason: 거부 사유 (필수, 빈 문자열 불가)

## 4. 지역담당자(Regional Admin) 위임 메커니즘

### 현재 상태 (2025-11-08)

| 조직 | 담당자 | 상태 | 임시점검원 |
|------|--------|------|-----------|
| 충주시 보건소 (충청북도) | ❌ | local_admin 없음 | 김시하 (30개 장비) |
| 계룡시 보건소 (충청남도) | ❌ | local_admin 없음 | 유미경 (30개 장비) |
| 경산시 보건소 (경상북도) | ❌ | local_admin 없음 | 안은규 (30개 장비) |
| 부산북구 보건소 (부산) | ❌ | local_admin 없음 | 김강수 (30개 장비) |

### 위임 규칙

#### Rule 1: 조직에 local_admin이 없으면 regional_admin이 승인

```
임시점검원 점검 제출 (충주시 보건소)
    ↓
점검 시스템이 조직 확인: "충주시 보건소에 local_admin이 있는가?"
    ↓
없음 → regional_admin(충청북도 응급의료지원센터)이 승인 권한 획득
    ↓
충청북도 응급의료센터의 regional_admin:
  "PATCH /api/inspections/{id}/approve" 실행
  → approved_by_id = 충청북도응급의료센터_user_id
  → approval_status = 'approved'
```

#### Rule 2: local_admin이 등록되면 자동 권한 인수

```
시나리오: 2025-11-15에 충주시보건소담당자(이메일@korea.kr)가 회원가입

1. 회원가입 처리
   email: chungju-health@korea.kr
   role: local_admin
   organization_id: [충주시보건소_id]
   is_active: true

2. 데이터베이스 업데이트
   user_profiles.insert({
     id: new_uuid,
     email: chungju-health@korea.kr,
     role: 'local_admin',
     organization_id: [충주시보건소_id],
     is_active: true
   })

3. 캐시 무효화 (모든 클라이언트)
   - "/api/organizations/with-admin" 결과 갱신
   - 충주시 보건소가 admin_count: 1로 업데이트

4. 향후 김시하 점검 제출 시
   점검 시스템: "충주시 보건소에 local_admin 있나?"
   ↓
   있음! → 충주시보건소담당자(local_admin)가 승인
   ↓
   approved_by_id = 충주시보건소담당자_user_id
   (더 이상 충청북도응급의료센터가 아님)
```

### 핸드오버 메커니즘 구현

#### 1. 자동 권한 검사 (조회 시간)

```typescript
// lib/utils/inspection-approval.ts: getApproverForInspection()

export async function getApproverForInspection(organizationId: string) {
  const org = await prisma.organizations.findFirst({
    where: { id: organizationId },
    include: {
      user_profiles: {
        where: { role: 'local_admin', is_active: true },
        select: { id: true, email: true }
      }
    }
  });

  // Step 1: local_admin이 있는가? (우선순위 1)
  if (org.user_profiles.length > 0) {
    return {
      approverType: 'local_admin',
      approvers: org.user_profiles
    };
  }

  // Step 2: regional_admin 찾기 (우선순위 2)
  const regionalAdmin = await prisma.user_profiles.findFirst({
    where: {
      role: 'regional_admin',
      is_active: true,
      region_code: org.region_code
    }
  });

  if (regionalAdmin) {
    return {
      approverType: 'regional_admin',
      approvers: [regionalAdmin]
    };
  }

  // Step 3: master 찾기 (우선순위 3)
  const master = await prisma.user_profiles.findFirst({
    where: { role: 'master', is_active: true }
  });

  return {
    approverType: 'master',
    approvers: master ? [master] : []
  };
}
```

#### 2. 권한 검증 (승인 시간)

```typescript
// lib/utils/inspection-approval.ts: canUserApproveInspection()

export async function canUserApproveInspection(
  userId: string,
  inspectionId: string
): Promise<boolean> {
  const user = await prisma.user_profiles.findUnique({
    where: { id: userId },
    select: { role: true, organization_id: true, region_code: true }
  });

  // Master는 모든 점검 승인 가능
  if (user.role === 'master') {
    return true;
  }

  const inspection = await prisma.inspections.findUnique({
    where: { id: inspectionId },
    include: {
      user_profiles: {
        select: {
          organization_id: true,
          organizations: {
            select: {
              region_code: true,
              user_profiles: {
                where: { role: 'local_admin', is_active: true },
                select: { id: true }
              }
            }
          }
        }
      }
    }
  });

  const org = inspection.user_profiles.organizations;
  const hasLocalAdmin = org.user_profiles.length > 0;

  // Local admin: 소속 조직만 승인
  if (user.role === 'local_admin' && user.organization_id) {
    return inspection.user_profiles.organization_id === user.organization_id;
  }

  // Regional admin: 담당자 없는 조직의 지역 점검만 승인
  if (user.role === 'regional_admin') {
    return !hasLocalAdmin && org.region_code === user.region_code;
  }

  return false;
}
```

## 5. 사용 사례 (Use Cases)

### UC-1: 임시점검원 점검 제출 및 regional_admin 승인

```
참여자: 김시하(임시점검원), 충청북도응급의료센터담당자(regional_admin)

1. 김시하가 충주시 보건소에서 AED 점검 수행
   POST /api/inspections/quick
   {
     equipment_serial: "AED-CH-001",
     inspection_type: "monthly",
     overall_status: "normal"
   }
   → inspection_id = "insp-1234"
   → approval_status = "submitted"
   → created_at = "2025-11-08 10:00:00"

2. 충청북도 응급의료센터 담당자가 대기 중인 점검 확인
   GET /api/inspections/pending
   → 충주시 보건소의 "submitted" 상태 점검 1건 조회

3. 점검 세부 정보 확인
   GET /api/inspections/insp-1234/approvers
   → approverType: "regional_admin"
   → approvers: [충청북도응급의료센터담당자]

4. 점검 승인
   PATCH /api/inspections/insp-1234/approve
   → approval_status = "approved"
   → approved_by_id = "충청북도응급의료센터담당자_id"
   → approved_at = "2025-11-08 14:30:00"
```

### UC-2: Local Admin 등록 후 자동 권한 인수

```
참여자: 충주시보건소담당자(new local_admin), 시스템

[2025-11-15] 충주시보건소담당자 회원가입
1. 가입 요청
   POST /api/auth/signup
   {
     email: "jhwan@korea.kr",
     role: "local_admin",
     organization_id: "충주시보건소_id"
   }
   → user_profiles 테이블에 new 레코드 생성

2. [자동] 캐시 무효화
   - "/api/organizations/with-admin" 갱신
   - 충주시 보건소: admin_count 0→1

[2025-11-20] 김시하가 새로운 점검 제출
3. 점검 제출
   POST /api/inspections/quick
   {
     equipment_serial: "AED-CH-002",
     overall_status: "warning"
   }
   → inspection_id = "insp-5678"
   → approval_status = "submitted"

4. [자동] 권한 결정
   GET /api/inspections/insp-5678/approvers

   시스템 로직:
   a) 충주시보건소에 local_admin 있는가?
   b) 있음! → local_admin 권한 획득
   c) 충청북도응급의료센터가 아니라 충주시보건소담당자가 승인

   → approverType: "local_admin"
   → approvers: [충주시보건소담당자(jhwan@korea.kr)]

5. 점검 승인 (충주시보건소담당자가 수행)
   PATCH /api/inspections/insp-5678/approve
   → approval_status = "approved"
   → approved_by_id = "충주시보건소담당자_id"
   → 충청북도응급의료센터는 권한 없음 (검증 실패)
```

## 6. 모니터링 및 검증

### 검증 체크리스트

```
[ ] 모든 'submitted' 상태 점검에 대해 getApproverForInspection() 실행
    → regional_admin이 아닌 local_admin만 반환하는 경우
[ ] local_admin 등록 후 이전 regional_admin 점검도 'approved' 가능한가?
    → 아니오. 이미 'approved' 상태는 수정 불가
    → 신규 점검부터 local_admin이 승인
[ ] 권한 검증 실패 테스트 (403 Forbidden)
    → regional_admin이 다른 시도의 점검 승인 시도
    → local_admin이 다른 조직의 점검 승인 시도
```

### 대시보드 지표

```
1. 승인 대기 점검
   - 총 대기: N건
   - regional_admin 승인 대기: M건
   - local_admin 승인 대기: L건

2. 권한 이행 진행도
   - local_admin 등록 필요: 4곳 (충주, 계룡, 경산, 부산북구)
   - 완료: 0곳
   - 진행 중: 0곳

3. 감사 로그
   - 승인된 점검: N건 (approver: local_admin M건, regional_admin K건)
   - 거부된 점검: L건
```

## 7. 문제 해결

### Q: Local Admin이 등록되었는데도 Regional Admin이 승인 가능한가?

**A**: 아니오. `canUserApproveInspection()`은 `hasLocalAdmin` 여부를 체크합니다.

```typescript
if (user.role === 'regional_admin') {
  return !hasLocalAdmin && org.region_code === user.region_code;
  //     ↑ hasLocalAdmin이 true면 false 반환 → 승인 불가
}
```

### Q: 동일 조직에 Local Admin이 여러 명이면?

**A**: 모두 승인 권한 보유. `user_profiles` 테이블에서 `role='local_admin' AND is_active=true`인 모든 사용자가 승인 가능합니다.

### Q: 이미 Regional Admin이 승인한 점검을 Local Admin도 승인할 수 있는가?

**A**: 아니오. 이미 `approval_status = 'approved'`인 점검은 재승인 불가:

```typescript
if (inspection.approval_status !== 'submitted' &&
    inspection.approval_status !== 'pending') {
  return NextResponse.json(
    { error: `Cannot approve inspection with status: ${inspection.approval_status}` },
    { status: 400 }
  );
}
```

## 8. 마이그레이션 및 배포

### Prisma 마이그레이션 (2025-11-08)

```bash
# 마이그레이션 폴더
prisma/migrations/20251108_add_inspection_approval_fields/

# 변경 사항
1. inspection_approval_status enum 생성
2. inspections 테이블에 4개 칼럼 추가
3. 2개의 인덱스 추가
```

### 배포 절차

```bash
# 1. Prisma 마이그레이션 적용
npm run migrate:deploy

# 2. Prisma 클라이언트 재생성
npm run prisma:generate

# 3. 빌드 테스트
npm run build

# 4. 서버 재시작
pm2 reload ecosystem.config.js
```

## 9. 참고 문서

- [임시점검원 관리 표준 운영 절차](./TEMPORARY_INSPECTOR_MANAGEMENT.md)
- [조직 관리 현황 대시보드](./ORGANIZATION_COVERAGE_PANEL.md)
- [권한 체계 (CLAUDE.md)](../../CLAUDE.md#3-핵심-권한-체계-절대-불변)

---

**최종 업데이트**: 2025-11-08
**버전**: 1.0.0
**상태**: 구현 완료 ✅

