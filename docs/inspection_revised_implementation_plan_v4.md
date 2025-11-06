# 점검 기능 구현 계획서 - v4.0 (이슈 재검토 완료)

**작성일**: 2025-11-06
**상태**: ✅ 이슈 재검토 완료
**버전**: v4.0 (v3.0의 3가지 구현 이슈 수정)

---

## 선행 이슈 분석

### 이슈 1: canEditInspection 함수 호출 방식 불일치

**현재 구현** (lib/inspections/permissions.ts:99-105):
```typescript
export function canEditInspection(
  userRole: UserRole,
  userId: string,
  inspectorId: string,
  userRegionCode?: string | null,
  inspectionRegionCode?: string | null
): boolean
```

**v3.0 계획 오류**:
```typescript
// ❌ 잘못된 호출 방식 (객체)
const permission = canEditInspection({
  userProfile: profile,
  targetInspection: inspection,
  userId: session.user.id,
  userRegionCode: profile.organization?.region_code,
  inspectionRegionCode: inspection.aed_data?.sido
});
```

**올바른 호출 방식** (위치 인자):
```typescript
// ✅ 올바른 호출 방식
const canEdit = canEditInspection(
  profile.role,                    // userRole
  session.user.id,                 // userId
  inspection.inspector_id,         // inspectorId
  profile.organization?.region_code, // userRegionCode
  inspection.aed_data?.sido        // inspectionRegionCode (주의: 지역 코드 필요)
);
```

**결정**: 기존 함수 시그니처 유지 (변경 최소화)

---

### 이슈 2: 관련 데이터 누락으로 권한 검증 불완전

**현재 구현** (app/api/inspections/[id]/route.ts:79-85):
```typescript
const inspection = await prisma.inspections.findUnique({
  where: { id: inspectionId },
  select: {
    id: true,
    inspector_id: true    // ← 이것만 있음
  }
});
```

**문제점**:
- `aed_data`를 로드하지 않음
- regional/local admin의 권한 검증 불가능
- `inspection.aed_data?.sido` (시도 코드) 접근 불가

**수정 방안**:
```typescript
const inspection = await prisma.inspections.findUnique({
  where: { id: inspectionId },
  select: {
    id: true,
    inspector_id: true,
    aed_data: {
      select: {
        sido: true,        // ← 추가: 시도 코드
        gugun: true        // ← 추가: 시군구 코드 (향후 사용)
      }
    }
  }
});
```

**영향**:
- local_admin 권한 검증 가능 (같은 지역만 수정)
- regional_admin 권한 검증 가능 (같은 시도만 수정)

---

### 이슈 3: camelCase ↔ snake_case 매핑 누락

**데이터 흐름**:

```
클라이언트 (camelCase)
  ↓
updateInspectionRecord (lib/inspections/session-utils.ts:330)
  JSON.stringify(updates) → { visualStatus: ..., batteryStatus: ..., ... }
  ↓
PATCH /api/inspections/[id]
  ↓
route.ts (app/api/inspections/[id]/route.ts:115-135)
  ❌ updateData: { visualStatus, batteryStatus, ... }  (camelCase)
  ↓
Prisma.inspections.update()
  ❌ 기대: { visual_status, battery_status, ... }  (snake_case)
  결과: 필드 미매칭, 업데이트 실패
```

**현재 시도된 매핑** (route.ts:120-128):
```typescript
const fieldMapping: Record<string, string> = {
  'notes': 'notes',
  'visual_status': 'visualStatus',      // ← snake → camel 변환
  'battery_status': 'batteryStatus',    // ← 이 방향
  // ...
};

Object.keys(updates).forEach((field) => {
  const camelField = fieldMapping[field] || field;  // ← 역변환 없음
  if (allowedFields.includes(camelField)) {
    updateData[camelField] = updates[field];        // ← camelCase 저장
  }
});
```

**문제점**:
1. fieldMapping이 snake → camel 방향 (클라이언트는 camelCase로 보냄)
2. 역변환이 없음 (camel → snake)
3. updateData 키가 camelCase (Prisma 스키마와 불일치)

**올바른 매핑** (3가지 선택지):

#### 선택지 A: API에서 정규화 (권장)
```typescript
// fieldMapping을 camel → snake로 변경
const fieldMapping: Record<string, string> = {
  'notes': 'notes',
  'visualStatus': 'visual_status',      // ← camel → snake
  'batteryStatus': 'battery_status',
  'padStatus': 'pad_status',
  'operationStatus': 'operation_status',
  'overallStatus': 'overall_status',
  'issuesFound': 'issues_found',
};

// updateData에 snake_case 저장
const updateData: any = {
  updated_at: new Date(),  // snake_case
};

Object.keys(updates).forEach((field) => {
  const snakeField = fieldMapping[field] || field;  // camel → snake 변환
  if (allowedFields.includes(field)) {  // allowedFields도 camelCase 유지
    updateData[snakeField] = updates[field];  // snake_case로 저장
  }
});
```

#### 선택지 B: 클라이언트에서 정규화
```typescript
// lib/inspections/session-utils.ts updateInspectionRecord 수정
const normalizedUpdates = {
  notes: updates.notes,
  visual_status: updates.visualStatus,
  battery_status: updates.batteryStatus,
  pad_status: updates.padStatus,
  operation_status: updates.operationStatus,
  overall_status: updates.overallStatus,
  issues_found: updates.issuesFound,
};

body: JSON.stringify(normalizedUpdates)  // snake_case로 전송
```

#### 선택지 C: 중앙화된 유틸 함수
```typescript
// lib/inspections/field-mapping.ts (신규)
export const INSPECTION_FIELD_MAP = {
  visualStatus: 'visual_status',
  batteryStatus: 'battery_status',
  // ...
} as const;

export function normalizeInspectionUpdate(
  camelCaseUpdates: Record<string, any>
): Record<string, any> {
  const normalized: Record<string, any> = {};
  Object.entries(camelCaseUpdates).forEach(([camelKey, value]) => {
    const snakeKey = INSPECTION_FIELD_MAP[camelKey as keyof typeof INSPECTION_FIELD_MAP];
    if (snakeKey) {
      normalized[snakeKey] = value;
    } else {
      normalized[camelKey] = value;
    }
  });
  return normalized;
}
```

**결정**: **선택지 A (API에서 정규화)** 권장
- 단일 책임: API가 요청 데이터 변환 담당
- 비용 최소: 기존 updateInspectionRecord 유지
- 확장성: 향후 필드 추가 시 API에서만 수정

---

## 구현 계획 (확정판 - v4.0)

### 0-Stage: 기술 부채 해결

✅ **완료**
- 0-1: unavailable_reason enum 'lost' 추가
- 0-2: unavailable 통계 집계 구현

참고: [docs/0_STAGE_COMPLETION_SUMMARY.md](docs/0_STAGE_COMPLETION_SUMMARY.md)

---

### 1-Stage: Export 엔드포인트 강화 (3-4시간)

#### 1.1 작업 내용

**신규 파일**: `/app/api/inspections/export/route.ts`

**API 스펙**:
```
POST /api/inspections/export
Request:
{
  filters: {
    regionCodes?: string[],
    cityCodes?: string[],
    startDate?: string,
    endDate?: string
  }
}

Response (200):
- Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
- 파일 스트리밍 (최대 10,000건)

Response (403):
{ error: "권한 없음", reason: "..." }

Response (409):
{ error: "필터 정책 위반", reason: "..." }
```

#### 1.2 구현 체크리스트

- [ ] POST 엔드포인트 작성
- [ ] enforceFilterPolicy 적용 (lib/aed/filter-policy.ts 재사용)
- [ ] permissions.ts의 권한 함수 활용
- [ ] ExcelJS로 XLSX 생성
- [ ] 스트리밍 응답 구현
- [ ] 감사 로그 기록

#### 1.3 배포 순서

1. **백엔드**: /api/inspections/export 엔드포인트
2. **테스트**: Jest (권한별 필터링) + 수동 QA (파일 검증)
3. **프론트**: AdminFullView.tsx에서 서버 호출로 변경 (선택사항)

---

### 2-Stage: 점검 이력 수정 API 버그 수정 (2.5-3시간)

#### 2.1 버그 목록

| 버그 | 파일:라인 | 심각도 | 해결 방법 |
|-----|---------|--------|---------|
| ministry_admin 권한 오류 | route.ts:97 | 🔴 높음 | canEditInspection 적용 |
| 지역 데이터 누락 | route.ts:79-85 | 🔴 높음 | aed_data 포함 추가 |
| camelCase 타입 버그 | route.ts:115-135 | 🔴 높음 | fieldMapping 역변환 |

#### 2.2 버그 수정 상세

##### 수정 1: 검사 데이터 로드 (route.ts:79-85)

**현재 (잘못됨)**:
```typescript
const inspection = await prisma.inspections.findUnique({
  where: { id: inspectionId },
  select: {
    id: true,
    inspector_id: true
  }
});
```

**수정 후**:
```typescript
const inspection = await prisma.inspections.findUnique({
  where: { id: inspectionId },
  select: {
    id: true,
    inspector_id: true,
    aed_data: {
      select: {
        sido: true,   // 시도 코드 (regional/local 권한 검증용)
        gugun: true   // 시군구 코드 (향후 사용)
      }
    }
  }
});
```

##### 수정 2: 권한 검증 재구현 (route.ts:91-102)

**현재 (잘못됨)**:
```typescript
const isAdmin = profile?.role &&
  ['master', 'emergency_center_admin', 'ministry_admin'].includes(profile.role);
const isOwner = inspection.inspector_id === session.user.id;

if (!isOwner && !isAdmin) {
  return NextResponse.json(
    { error: 'You do not have permission to update this inspection' },
    { status: 403 }
  );
}
```

**수정 후**:
```typescript
// 기존 권한 함수 활용 (lib/inspections/permissions.ts)
import { canEditInspection } from '@/lib/inspections/permissions';

// profile 로드 확대
const profile = await prisma.user_profiles.findUnique({
  where: { id: session.user.id },
  select: {
    role: true,
    organization: {
      select: {
        region_code: true  // 시도 코드 (regional 권한용)
      }
    }
  }
});

// 권한 검증
const hasPermission = canEditInspection(
  profile.role,                      // userRole
  session.user.id,                   // userId
  inspection.inspector_id,           // inspectorId
  profile.organization?.region_code, // userRegionCode
  inspection.aed_data?.sido          // inspectionRegionCode
);

if (!hasPermission) {
  const permissionDetail = checkInspectionPermission(
    profile.role,
    session.user.id,
    inspection.inspector_id,
    profile.organization?.region_code,
    inspection.aed_data?.sido
  );
  return NextResponse.json(
    { error: 'Permission denied', reason: permissionDetail.reason },
    { status: 403 }
  );
}
```

##### 수정 3: camelCase → snake_case 정규화 (route.ts:115-135)

**현재 (잘못됨)**:
```typescript
const fieldMapping: Record<string, string> = {
  'notes': 'notes',
  'visual_status': 'visualStatus',   // ← 역방향
  'battery_status': 'batteryStatus',
  'pad_status': 'padStatus',
  'operation_status': 'operationStatus',
  'overall_status': 'overallStatus',
  'issues_found': 'issuesFound',
};

const updateData: any = {
  updatedAt: new Date(),  // ← camelCase
};

Object.keys(updates).forEach((field) => {
  const camelField = fieldMapping[field] || field;
  if (allowedFields.includes(camelField)) {
    updateData[camelField] = updates[field];  // ← camelCase 저장
  }
});
```

**수정 후** (선택지 A: API에서 정규화):
```typescript
const fieldMapping: Record<string, string> = {
  'notes': 'notes',
  'visualStatus': 'visual_status',        // ← camel → snake
  'batteryStatus': 'battery_status',
  'padStatus': 'pad_status',
  'operationStatus': 'operation_status',
  'overallStatus': 'overall_status',
  'issuesFound': 'issues_found',
};

const allowedFields = ['notes', 'visualStatus', 'batteryStatus', 'padStatus', 'operationStatus', 'overallStatus', 'issuesFound'];

const updateData: any = {
  updated_at: new Date(),  // ← snake_case
};

Object.keys(updates).forEach((field) => {
  if (allowedFields.includes(field)) {
    const snakeField = fieldMapping[field];  // camel → snake 변환
    updateData[snakeField] = updates[field];  // snake_case 저장
  }
});
```

#### 2.3 수정 후 데이터 흐름

```
클라이언트 (camelCase)
  { visualStatus: 'normal', batteryStatus: 'ok' }
  ↓
PATCH /api/inspections/[id]
  ↓
route.ts 정규화
  fieldMapping: visualStatus → visual_status
  updateData: { visual_status: 'normal', battery_status: 'ok' }  (snake_case)
  ↓
Prisma.inspections.update()
  ✅ 필드명 일치: visual_status, battery_status
```

#### 2.4 테스트 계획

**자동화 (Jest)**:
```typescript
describe("PATCH /api/inspections/[id]", () => {
  test("ministry_admin은 403 반환 (정책 준수)", async () => {
    // 보건복지부 계정으로 수정 요청 → 403
  });

  test("local_admin은 관할 지역 외 403", async () => {
    // 서귀포 담당자가 대구 점검 수정 시도 → 403
  });

  test("camelCase 필드 정확하게 저장", async () => {
    // 요청: { visualStatus: 'normal' }
    // DB 확인: visual_status = 'normal' (snake_case)
  });

  test("관할 지역 내 수정 성공", async () => {
    // 서귀포 담당자가 서귀포 점검 수정 → 200
  });
});
```

**수동 (QA)**:
- [ ] 각 역할별 권한 검증
- [ ] DB 컬럼명 (snake_case)로 저장 확인
- [ ] 필드값 정확성 검증

#### 2.5 배포 순서

1. **단일 PR**: 모든 버그 수정 (권한 + 데이터 로드 + 타입 정규화)
2. **테스트**: Jest + 수동 검증 (병렬)
3. **모니터링**: 프로덕션 배포 후 로그 확인

#### 2.6 롤백 계획

```bash
# 롤백 시 기존 코드로 복구
git revert <commit-hash>

# 주의: 이미 업데이트된 데이터는 복구 불가
```

---

### 3-Stage: 불가 상태 UI 완성 (2-3시간)

#### 3.1 목표

기존 컴포넌트 통합 + 상태 전환 로직 완성

#### 3.2 체크리스트

- [ ] QuickInspectPanel → UnavailableReasonModal 연결
- [ ] 불가 사유 API 전송
- [ ] inspection_assignments.status: pending → unavailable
- [ ] 대시보드 unavailable 통계 자동 갱신 (0-Stage 완료)
- [ ] 역방향: unavailable → pending 재점검 로직

---

### 4-Stage: CPR 필드 (조사 필요)

**조사 대상**:
- [ ] CPR 필드 실제 필요성 검증
- [ ] 어느 테이블에 추가할지 결정
- [ ] API 스펙 정의

---

## 의존성 정리

### 2-Stage가 1-Stage와 독립적

```
1-Stage (Export)
  └─ 독립적 (enforceFilterPolicy 재사용, 기존 권한 함수 사용)

2-Stage (PATCH 버그 수정)
  └─ 1-Stage와 무관
  └─ canEditInspection 함수 사용 (기존)
  └─ aed_data 로드 추가 (새로움)
```

### 병렬 작업 가능

- **Day 1**: 1-Stage 백엔드 (3-4시간) + Jest 작성 (1-2시간)
- **Day 2**: 2-Stage PATCH 수정 (2.5-3시간) + Jest 작성 (1시간)
- **Day 3**: 1-Stage 수동 QA (1-2시간) + 2-Stage 수동 QA (1-2시간) + 3-Stage 통합 (1시간)

---

## 최종 체크리스트

### 구현 전
- [ ] 이 계획서 검토 및 승인
- [ ] 각 단계별 담당자 확정
- [ ] 테스트 환경 데이터 준비

### 구현 중
- [ ] 타입스크립트 컴파일 통과
- [ ] ESLint 통과
- [ ] 프로덕션 빌드 성공

### 배포 전
- [ ] Jest 테스트 통과
- [ ] 수동 QA 완료
- [ ] 권한 정책 재검증

### 배포 후
- [ ] 프로덕션 로그 모니터링
- [ ] 사용자 피드백 수집

---

## 참고 문서 & 코드 위치

| 항목 | 파일:라인 |
|-----|---------|
| canEditInspection (기존 함수) | lib/inspections/permissions.ts:99-114 |
| checkInspectionPermission | lib/inspections/permissions.ts:24-94 |
| PATCH 엔드포인트 (수정 대상) | app/api/inspections/[id]/route.ts:65-160 |
| updateInspectionRecord (클라이언트) | lib/inspections/session-utils.ts:320-343 |
| enforceFilterPolicy | lib/aed/filter-policy.ts:131-294 |

---

**최종 상태**: ✅ v4.0 이슈 재검토 완료, 구현 준비 완료

**버전 이력**:
- v1.0: 초기 계획 (부분 정보)
- v2.0: 코드 검증 후 상세 분석
- v3.0: 신중한 재검토 (3가지 오류 수정)
- v4.0: 이슈 재검토 (구현 이슈 명확화)
