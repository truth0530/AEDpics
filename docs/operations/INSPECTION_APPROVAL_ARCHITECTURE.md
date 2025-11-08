# 점검 승인 구조 검토 보고서

**작성일**: 2025-11-08
**상태**: 현황 분석 및 개선 계획

---

## 1. 현재 아키텍처 평가

### 1.1 권한 체계 (✅ 정의됨)

```typescript
// lib/utils/user-roles.ts에서 정의
역할 계층:
  - master (중앙 관리자)
    ├─ regional_admin (시도 응급의료지원센터 - 17개)
    │  ├─ local_admin (보건소 담당자)
    │  └─ temporary_inspector (임시 점검원)
    └─ ...

현재 담당자 분포:
  - regional_admin: 17개 (이론상 전국 커버)
  - local_admin: 9개 (대구 5, 경남 1, 인천 1, 제주 2)
  - temporary_inspector: 8명 (4명 고아 상태)
```

### 1.2 점검 데이터 모델 (⚠️ 승인 메커니즘 부족)

**Prisma 스키마 (inspections 모델)**:

```typescript
model inspections {
  id: String                 // 점검 ID
  equipment_serial: String   // AED 장비
  inspector_id: String       // 점검자 ID (user_profiles.id)
  inspection_date: Date      // 점검 날짜

  // 점검 결과
  visual_status: String
  battery_status: String
  pad_status: String
  operation_status: String
  overall_status: String

  // 메타데이터
  completed_at: DateTime     // 완료 시간
  created_at: DateTime
  updated_at: DateTime

  // ❌ 없는 필드:
  // - approved_by (승인자)
  // - reviewed_by (리뷰어)
  // - approval_status (승인 상태)
  // - rejection_reason (거부 사유)
}
```

### 1.3 구조적 문제점

#### 문제 1: 점검 승인 프로세스 없음
```
현황:
  - 임시점검원이 점검 데이터를 제출 → 즉시 저장
  - regional_admin이나 local_admin이 검토할 수 없음
  - 승인/거부/수정 요청 메커니즘 없음

영향:
  - 데이터 품질 보증 불가
  - 감시 체계 미흡
  - 책임 추적 불가
```

#### 문제 2: 임시점검원의 대리 승인 경로 없음
```
현황:
  - 임시점검원이 점검 결과를 제출하면
  - 누가 이를 최종 승인하는지 불명확

예상 흐름 (구현 필요):
  1. 임시점검원 → 점검 제출
  2. local_admin 있으면 → 보건소 담당자 승인
  3. local_admin 없으면 → regional_admin (응급의료지원센터) 대리 승인
  4. regional_admin 없으면 → master 승인

현재: 이 흐름이 구현되지 않음
```

#### 문제 3: local_admin 등장 후 권한 이양 메커니즘 불명확
```
시나리오:
  1. 충주시 보건소에 new local_admin 계정 생성
  2. 기존 regional_admin(충청북도)이 처리하던 점검들의
     승인권이 자동으로 local_admin으로 이양되는가?

현재: 수동 프로세스이거나 구현되지 않음
```

---

## 2. 구조 검증 체크리스트

### 2.1 권한 기반 접근 제어 (RBAC)

- [x] 역할 정의: `temporary_inspector`, `local_admin`, `regional_admin` 명확함
- [x] 역할 계층: 명확한 계층 구조 정의됨
- [ ] **점검 승인 권한 정의**: 누가 무엇을 승인할 수 있는지 불명확
  - 임시점검원의 점검을 누가 최종 승인하는가?
  - regional_admin이 여러 지역의 점검을 승인할 수 있는가?
  - local_admin 생성 후 권한 자동 이양되는가?

### 2.2 API 레벨 검증

**현재 구현된 API**:
- ✅ `/api/inspections/history` - 점검 이력 조회
- ✅ `/api/inspections/sessions` - 점검 세션 (미확인 구현)
- ✅ `/api/organizations/with-admin` - local_admin 있는 조직 조회
- ⚠️ `/api/inspections/*` - 승인/거부 엔드포인트 없음

**필요한 API**:
```typescript
// 임시점검원 입장
POST /api/inspections/submit
  - 점검 데이터 제출
  - 대기 상태로 저장

// local_admin/regional_admin 입장
GET /api/inspections/pending
  - 승인 대기 중인 점검 목록 조회
  - 권한 기반 필터링

PATCH /api/inspections/{id}/approve
  - 점검 승인
  - approved_by 필드 기록

PATCH /api/inspections/{id}/reject
  - 점검 거부
  - rejection_reason 기록
```

### 2.3 UI/UX 검증

**현재 구현된 화면**:
- ✅ 임시점검원 입장: 점검 입력, 결과 제출
- ⚠️ local_admin 입장: 자신의 조직 점검만 승인 가능
- ❌ regional_admin 입장: 대리 승인 UI 없음

**필요한 UI**:
```
1. regional_admin 대시보드
   - "승인 대기" 탭: 담당 지역 all 점검
   - "승인됨" 탭: 최근 승인 이력
   - "거부됨" 탭: 거부 사유 포함

2. local_admin 생성 후 자동 표시
   - 기존 regional_admin 항목 해제
   - 새 local_admin 항목 활성화
```

### 2.4 데이터 모델 검증

**필요한 필드 추가**:
```typescript
model inspections {
  // 현재 필드들...

  // ❌ 추가 필요
  status: enum {
    'submitted',    // 임시점검원 제출
    'pending',      // 승인 대기
    'approved',     // 승인됨
    'rejected',     // 거부됨
  }

  approved_by?: String @db.Uuid     // 승인자 ID (regional_admin or local_admin)
  approved_at?: DateTime             // 승인 시간
  rejection_reason?: String          // 거부 사유

  // Prisma relation
  approver?: user_profiles @relation(
    fields: [approved_by],
    references: [id]
  )
}
```

---

## 3. 권장 구현 전략

### 3.1 Phase 1: 데이터 모델 확장 (우선순위 1)

```sql
-- Prisma migration
ALTER TABLE inspections ADD COLUMN approval_status TEXT DEFAULT 'pending';
ALTER TABLE inspections ADD COLUMN approved_by UUID;
ALTER TABLE inspections ADD COLUMN approved_at TIMESTAMP;
ALTER TABLE inspections ADD COLUMN rejection_reason TEXT;
ALTER TABLE inspections ADD COLUMN approval_notes TEXT;

CREATE INDEX idx_inspections_approval_status
  ON inspections(approval_status);
CREATE INDEX idx_inspections_approved_by
  ON inspections(approved_by);
```

**변경 이유**:
- 현재: 점검 완료 시 자동 저장 → 데이터 품질 검증 불가
- 개선: 승인 단계 추가 → 데이터 신뢰도 향상

### 3.2 Phase 2: 권한 기반 승인 로직 (우선순위 1)

```typescript
// lib/utils/inspection-approval.ts (신규)

/**
 * 점검 승인자 결정
 *
 * 규칙:
 * 1. local_admin이 있으면 → 해당 보건소 담당자가 승인
 * 2. local_admin 없으면 → regional_admin (응급의료지원센터) 대리 승인
 * 3. regional_admin도 없으면 → master 승인
 */
export async function getApproverForInspection(
  organizationId: string
): Promise<{
  approverId: string;
  approverRole: 'local_admin' | 'regional_admin' | 'master';
  organizationId: string;
}> {
  // 1. 해당 조직의 local_admin 확인
  const localAdmin = await prisma.user_profiles.findFirst({
    where: {
      organization_id: organizationId,
      role: 'local_admin',
      is_active: true
    }
  });

  if (localAdmin) {
    return {
      approverId: localAdmin.id,
      approverRole: 'local_admin',
      organizationId
    };
  }

  // 2. 조직의 지역을 확인하여 regional_admin 찾기
  const org = await prisma.organizations.findUnique({
    where: { id: organizationId }
  });

  if (org?.region_code) {
    const regionalAdmin = await prisma.user_profiles.findFirst({
      where: {
        role: 'regional_admin',
        region_code: org.region_code,
        is_active: true
      }
    });

    if (regionalAdmin) {
      return {
        approverId: regionalAdmin.id,
        approverRole: 'regional_admin',
        organizationId
      };
    }
  }

  // 3. master 찾기 (fallback)
  const master = await prisma.user_profiles.findFirst({
    where: {
      role: 'master',
      is_active: true
    }
  });

  if (master) {
    return {
      approverId: master.id,
      approverRole: 'master',
      organizationId
    };
  }

  throw new Error('No approver found');
}

/**
 * 승인 대기 중인 점검 조회 (권한 기반)
 */
export async function getPendingInspectionsForUser(
  userId: string
): Promise<Array<{
  id: string;
  inspector: string;
  organization: string;
  region: string;
  submittedAt: DateTime;
}>> {
  const user = await prisma.user_profiles.findUnique({
    where: { id: userId }
  });

  if (!user) throw new Error('User not found');

  if (user.role === 'local_admin') {
    // 보건소 담당자 → 자신의 조직 점검만 조회
    return await prisma.inspections.findMany({
      where: {
        approval_status: 'pending',
        user_profiles: {
          organization_id: user.organization_id
        }
      }
    });
  } else if (user.role === 'regional_admin') {
    // 응급의료지원센터 → 지역 내 모든 점검 조회
    return await prisma.inspections.findMany({
      where: {
        approval_status: 'pending',
        user_profiles: {
          organizations: {
            region_code: user.region_code
          }
        }
      }
    });
  } else if (user.role === 'master') {
    // 시스템 관리자 → 모든 점검 조회
    return await prisma.inspections.findMany({
      where: {
        approval_status: 'pending'
      }
    });
  }

  return [];
}
```

### 3.3 Phase 3: 승인/거부 API (우선순위 1)

```typescript
// app/api/inspections/approve/route.ts (신규)

export async function PATCH(request: NextRequest) {
  const { inspectionId, decision, notes } = await request.json();

  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const user = await prisma.user_profiles.findUnique({
    where: { id: session.user.id }
  });

  if (!user || !['local_admin', 'regional_admin', 'master'].includes(user.role)) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  const inspection = await prisma.inspections.findUnique({
    where: { id: inspectionId },
    include: {
      user_profiles: {
        include: {
          organizations: true
        }
      }
    }
  });

  if (!inspection) {
    return NextResponse.json(
      { error: 'Inspection not found' },
      { status: 404 }
    );
  }

  // 권한 확인
  if (user.role === 'local_admin') {
    // 자신의 조직 점검만 승인 가능
    if (inspection.user_profiles?.organization_id !== user.organization_id) {
      return NextResponse.json(
        { error: 'Cannot approve inspection from other organization' },
        { status: 403 }
      );
    }
  } else if (user.role === 'regional_admin') {
    // 자신의 지역 점검만 승인 가능
    if (inspection.user_profiles?.organizations?.region_code !== user.region_code) {
      return NextResponse.json(
        { error: 'Cannot approve inspection from other region' },
        { status: 403 }
      );
    }
  }
  // master는 모두 가능

  // 승인/거부 처리
  const updatedInspection = await prisma.inspections.update({
    where: { id: inspectionId },
    data: {
      approval_status: decision === 'approve' ? 'approved' : 'rejected',
      approved_by: user.id,
      approved_at: new Date(),
      rejection_reason: decision === 'reject' ? (notes || '') : null,
      approval_notes: notes
    }
  });

  return NextResponse.json(updatedInspection);
}
```

### 3.4 Phase 4: local_admin 생성 시 자동 처리 (우선순위 2)

```typescript
// app/api/admin/users/route.ts에서 local_admin 생성 시

// 새로운 local_admin이 생성되면
if (profileData.role === 'local_admin') {
  // 해당 조직의 기존 "pending" 점검들의 승인자를 변경
  await prisma.inspections.updateMany({
    where: {
      user_profiles: {
        organization_id: profileData.organization_id,
        organizations: {
          id: profileData.organization_id
        }
      },
      approval_status: 'pending'
    },
    data: {
      // 기존 regional_admin 승인으로 설정되어 있으면
      // 자동으로 새 local_admin으로 변경되도록 구성
      // (또는 재심사 요청)
    }
  });
}
```

---

## 4. 현재 상태 vs 이상적 상태 비교

| 항목 | 현재 상태 | 이상적 상태 | 우선순위 |
|------|---------|----------|--------|
| **권한 정의** | ✅ 완료 | ✅ 완료 | - |
| **점검 승인 메커니즘** | ❌ 없음 | ✅ 존재 | **P0** |
| **regional_admin 대리 승인** | ❌ 없음 | ✅ 구현 | **P0** |
| **local_admin 자동 인수** | ❌ 없음 | ✅ 자동 | **P1** |
| **권한 기반 필터링** | ⚠️ 부분 | ✅ 완전 | **P1** |
| **감시/감독 추적** | ❌ 없음 | ✅ 완전 | **P1** |
| **임시점검원 안내** | ✅ 있음 | ✅ 개선 | **P2** |

---

## 5. 구현 로드맵

### Week 1 (우선순위 P0)
```
1. Prisma migration 작성
   - inspections 테이블에 approval_status, approved_by, approved_at 추가

2. 점검 승인 유틸 작성
   - getApproverForInspection()
   - getPendingInspectionsForUser()

3. 승인/거부 API 구현
   - PATCH /api/inspections/{id}/approve
```

### Week 2 (우선순위 P0)
```
4. 임시점검원 점검 제출 로직 수정
   - 완료 시 자동 저장 → pending 상태로 저장

5. regional_admin 대시보드 구현
   - "승인 대기" 탭: 지역 내 모든 pending 점검

6. 테스트
   - 임시점검원 → 제출 → regional_admin 승인
   - 승인 이력 추적
```

### Week 3 (우선순위 P1)
```
7. local_admin 자동 인수 로직
   - new local_admin 생성 → 기존 regional_admin 작업 인수

8. local_admin 대시보드 개선
   - 자신의 조직 점검만 표시

9. 통합 테스트
   - regional_admin 대리 → local_admin 자동 전환
```

---

## 6. 검증 기준

### 6.1 기능 검증
```
☐ 임시점검원이 점검 제출 → pending 상태
☐ local_admin이 있으면 → local_admin 승인 화면에 보임
☐ local_admin이 없으면 → regional_admin 승인 화면에 보임
☐ regional_admin이 승인 → approved 상태로 변경
☐ 승인자 정보 추적 가능 (approved_by, approved_at)
```

### 6.2 권한 검증
```
☐ local_admin은 자신의 조직 점검만 승인 가능
☐ regional_admin은 지역 내 모든 점검 승인 가능
☐ master는 모든 점검 승인 가능
☐ temporary_inspector는 점검만 제출 가능 (승인 불가)
```

### 6.3 자동화 검증
```
☐ new local_admin 생성 후 자동으로 권한 이양
☐ 기존 pending 점검은 적절히 재할당
☐ UI도 자동으로 업데이트
```

---

## 7. 결론

### 현재 상태
✅ **권한 체계는 완벽하지만**
❌ **실행 메커니즘이 부족함**

### 문제의 본질
- 임시점검원이 점검을 제출하면 → 자동 저장
- 누가 이를 승인하는지 → 메커니즘 없음
- regional_admin이 대리 역할을 할 수 있지만 → UI/API 없음

### 개선 영향도
- **구조적**: 데이터 품질 보증 체계 구축
- **운영적**: 책임 추적 및 감시 체계 강화
- **사용자 경험**: regional_admin, local_admin이 실제로 역할 수행 가능

### 권장 결론
**즉시 구현 필요** (P0)
1. 점검 승인 메커니즘 추가
2. regional_admin 대리 승인 API
3. local_admin 자동 인수 로직

이들이 없으면, 임시점검원들의 데이터가 검증 없이 축적되는 문제가 발생합니다.