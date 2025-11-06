# 점검 기능 구현 계획서 - v5.0 (최종 확정)

**작성일**: 2025-11-06
**상태**: ✅ 최종 확정
**버전**: v5.0 (v4.0의 구체적 이슈 4가지 해결)

---

## 최종 이슈 검토 및 수정

### 이슈 1: user_profiles 관계명 명확화

**v4.0 오류**:
```typescript
profile.organization?.region_code  // ❌ 관계명 불명확
```

**실제 스키마** (prisma/schema.prisma:700):
```prisma
organizations  organizations?  @relation(fields: [organization_id], references: [id])
```

**v5.0 수정**:
```typescript
// ✅ 올바른 접근 방식 (단수형)
profile.organizations?.region_code  // organizations는 nullable

// 또는 select 시 별칭 사용
select: {
  role: true,
  org: { select: { region_code: true } }  // @relation의 이름과 일치
}
// 접근: profile.org?.region_code
```

**권장**: 별칭 없이 `profile.organizations?.region_code` 사용 (가장 간단)

---

### 이슈 2: inspection.aed_data null 처리 명시

**현재 상황**:
- inspections.aed_data는 nullable (prisma/schema.prisma:280)
- 일부 inspection 기록은 equipment_serial만 있고 aed_data 참조 없음
- inspection.aed_data?.sido 접근 시 null 가능

**v5.0 명시**: null인 경우 처리 방안

#### 옵션 A: 권한 검증 실패로 처리 (보안 중심)
```typescript
const inspection = await prisma.inspections.findUnique({
  where: { id: inspectionId },
  select: {
    id: true,
    inspector_id: true,
    aed_data: { select: { sido: true } }
  }
});

if (!inspection) {
  return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });
}

// ← null 체크 추가
if (!inspection.aed_data) {
  return NextResponse.json(
    { error: 'Associated device data not found' },
    { status: 400 }  // 또는 403 (권한 불명확)
  );
}

// 이후 inspection.aed_data?.sido로 안전 접근
const hasPermission = canEditInspection(
  profile.role,
  session.user.id,
  inspection.inspector_id,
  profile.organizations?.region_code,
  inspection.aed_data.sido  // ← null 아님 보장
);
```

#### 옵션 B: 지역 검증 건너뛰기 (관용적)
```typescript
if (!inspection.aed_data?.sido) {
  // 관할 지역 검증 불가 → local_admin 접근 제한
  // master, emergency_center_admin만 허용
  const allowedRoles = ['master', 'emergency_center_admin'];
  if (!allowedRoles.includes(profile.role)) {
    return NextResponse.json(
      { error: 'Inspection region data unavailable' },
      { status: 403 }
    );
  }
}

// 정상적인 지역 검증
const hasPermission = canEditInspection(
  profile.role,
  session.user.id,
  inspection.inspector_id,
  profile.organizations?.region_code,
  inspection.aed_data?.sido || undefined  // null이면 undefined 전달
);
```

**결정**: **옵션 A 권장** (명확성 + 보안)
- null이면 400 Bad Request 반환
- 지역 데이터 없는 inspection은 수정 불가 정책

---

### 이슈 3: camelCase ↔ snake_case 필드명 검증

**현재 상황**:

**InspectionHistory 타입** (lib/inspections/session-utils.ts:208-229):
```typescript
export interface InspectionHistory {
  visual_status: string;        // ← snake_case
  battery_status: string;       // ← snake_case
  pad_status: string;           // ← snake_case
  operation_status: string;     // ← snake_case
  overall_status: string;       // ← snake_case
  notes?: string;               // ← snake_case
  issues_found?: string[];      // ← snake_case
  // ...
}
```

**현재 PATCH route.ts** (app/api/inspections/[id]/route.ts:105-113):
```typescript
const allowedFields = [
  'notes',
  'visualStatus',              // ← camelCase ❌
  'batteryStatus',             // ← camelCase ❌
  'padStatus',                 // ← camelCase ❌
  'operationStatus',           // ← camelCase ❌
  'overallStatus',             // ← camelCase ❌
  'issuesFound',               // ← camelCase ❌
];
```

**클라이언트 전송** (lib/inspections/session-utils.ts:330):
```typescript
// InspectionHistory 타입으로 전송 → snake_case
body: JSON.stringify(updates)  // { visual_status: ..., battery_status: ... }
```

**문제**: 클라이언트는 snake_case(`visual_status`), allowedFields는 camelCase(`visualStatus`)
→ 모든 필드가 필터링됨 (업데이트 안 됨)

**v5.0 수정**: allowedFields를 snake_case로 변경

```typescript
// 수정 전 (잘못됨)
const allowedFields = [
  'notes',
  'visualStatus',              // ← 클라이언트가 보내는 키와 불일치
  'batteryStatus',
  // ...
];

// 수정 후 (올바름)
const allowedFields = [
  'notes',
  'visual_status',             // ← InspectionHistory와 일치
  'battery_status',
  'pad_status',
  'operation_status',
  'overall_status',
  'issues_found',
];

// fieldMapping도 정규화 로직 불필요 (이미 snake_case)
const updateData: any = {
  updated_at: new Date(),
};

Object.keys(updates).forEach((field) => {
  if (allowedFields.includes(field)) {
    updateData[field] = updates[field];  // ← 그대로 사용
  }
});
```

**결론**:
- InspectionHistory는 snake_case
- 클라이언트는 snake_case 전송
- allowedFields는 snake_case (현재는 camelCase ← 버그)
- fieldMapping 불필요 (이미 일치함)

---

### 이슈 4: Export 권한 검증 (can_export_data 플래그)

**현재 상황**:
- user_profiles.can_export_data 필드 존재 (prisma/schema.prisma:654)
- permissions.ts의 역할 기반 함수만으로는 부족
- 추가로 can_export_data 플래그 확인 필요

**v5.0 명시**: Export 권한 검증 함수

```typescript
// lib/inspections/permissions.ts에 추가 (또는 lib/aed/filter-policy.ts)
export function canExportInspections(
  userRole: UserRole,
  canExportDataFlag: boolean
): boolean {
  // 역할 기반 체크
  const roleAllowed = [
    'master',
    'emergency_center_admin',
    'regional_emergency_center_admin',
    'regional_admin',
    'local_admin'
  ].includes(userRole);

  // 플래그 기반 체크 (override)
  // can_export_data = false인 경우 무조건 거부
  return roleAllowed && canExportDataFlag;
}
```

**또는 간단한 버전**:
```typescript
// API 엔드포인트 내에서 직접 검증
if (!profile?.can_export_data) {
  return NextResponse.json(
    { error: 'Export permission denied' },
    { status: 403 }
  );
}

// 역할도 확인
const roleAllowed = ['master', 'emergency_center_admin', 'regional_admin', 'local_admin'].includes(profile.role);
if (!roleAllowed) {
  return NextResponse.json(
    { error: 'Insufficient role for export' },
    { status: 403 }
  );
}
```

**v5.0 결정**: 두 가지 모두 확인
1. profile.can_export_data = true
2. userRole이 export 가능한 역할

---

## 최종 구현 계획 (v5.0)

### 0-Stage: 기술 부채 해결

✅ **완료**
- 0-1: unavailable_reason enum 'lost' 추가
- 0-2: unavailable 통계 집계 구현

---

### 1-Stage: Export 엔드포인트 (3-4시간)

#### 1.1 권한 검증 (명확화)

```typescript
// POST /api/inspections/export
const profile = await prisma.user_profiles.findUnique({
  where: { id: session.user.id },
  select: {
    role: true,
    can_export_data: true,        // ← 플래그 확인
    organizations: { select: { region_code: true, city_code: true } }
  }
});

// 체크 1: can_export_data 플래그
if (!profile?.can_export_data) {
  return NextResponse.json(
    { error: '데이터 다운로드 권한이 없습니다' },
    { status: 403 }
  );
}

// 체크 2: 역할 기반 확인
const exportableRoles = ['master', 'emergency_center_admin', 'regional_admin', 'local_admin'];
if (!exportableRoles.includes(profile.role)) {
  return NextResponse.json(
    { error: '해당 역할은 다운로드 권한이 없습니다' },
    { status: 403 }
  );
}
```

#### 1.2 enforceFilterPolicy 적용

기존 계획 유지 (변경 없음)

---

### 2-Stage: PATCH 버그 수정 (2.5-3시간)

#### 2.1 inspection 쿼리 확대 + null 처리

```typescript
const inspection = await prisma.inspections.findUnique({
  where: { id: inspectionId },
  select: {
    id: true,
    inspector_id: true,
    aed_data: {
      select: {
        sido: true,
        gugun: true
      }
    }
  }
});

if (!inspection) {
  return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });
}

// ← 추가: aed_data null 처리 (옵션 A)
if (!inspection.aed_data) {
  return NextResponse.json(
    { error: '연관된 장비 데이터를 찾을 수 없습니다' },
    { status: 400 }
  );
}
```

#### 2.2 권한 검증 재구현

```typescript
// profile 확대 로드
const profile = await prisma.user_profiles.findUnique({
  where: { id: session.user.id },
  select: {
    role: true,
    organizations: {
      select: {
        region_code: true  // ← 단수형 organizations 사용
      }
    }
  }
});

// 기존 함수 호출 (위치 인자)
const hasPermission = canEditInspection(
  profile.role,
  session.user.id,
  inspection.inspector_id,
  profile.organizations?.region_code,  // ← 단수형 + nullable
  inspection.aed_data.sido              // ← null 아님 보장
);

if (!hasPermission) {
  const permissionDetail = checkInspectionPermission(
    profile.role,
    session.user.id,
    inspection.inspector_id,
    profile.organizations?.region_code,
    inspection.aed_data.sido
  );
  return NextResponse.json(
    { error: permissionDetail.reason },
    { status: 403 }
  );
}
```

#### 2.3 필드명 수정 (snake_case로 통일)

**문제**:
```typescript
// 현재 (잘못됨)
const allowedFields = [
  'notes',
  'visualStatus',        // ← camelCase (InspectionHistory와 불일치)
  'batteryStatus',
  'padStatus',
  'operationStatus',
  'overallStatus',
  'issuesFound',
];
```

**수정 후** (snake_case):
```typescript
const allowedFields = [
  'notes',
  'visual_status',       // ← snake_case (InspectionHistory와 일치)
  'battery_status',
  'pad_status',
  'operation_status',
  'overall_status',
  'issues_found',
];

// fieldMapping은 불필요 (이미 snake_case)
const updateData: any = {
  updated_at: new Date(),
};

Object.keys(updates).forEach((field) => {
  if (allowedFields.includes(field)) {
    updateData[field] = updates[field];  // ← 그대로 저장
  }
});
```

#### 2.4 최종 테스트 케이스

```typescript
describe("PATCH /api/inspections/[id] - v5.0 최종", () => {
  test("aed_data 없으면 400 반환", async () => {
    // aed_data_id가 null인 inspection
    // → 400 Bad Request
  });

  test("profile.organizations로 지역 확인", async () => {
    // profile.organizations.region_code로 권한 검증
    // → 정상 작동 확인
  });

  test("snake_case 필드 업데이트", async () => {
    // 요청: { visual_status: 'normal' }
    // → DB에 visual_status로 저장 (camelCase 아님)
  });

  test("can_export_data 없으면 export 403", async () => {
    // can_export_data=false 사용자로 export 요청
    // → 403 Forbidden
  });
});
```

---

### 3-Stage: 불가 상태 UI (변경 없음)

기존 계획 유지

---

### 4-Stage: CPR 필드 (변경 없음)

기존 계획 유지

---

## 최종 체크리스트

### 1-Stage (Export)
- [ ] can_export_data 플래그 확인
- [ ] 역할 기반 검증
- [ ] enforceFilterPolicy 적용
- [ ] 감사 로그

### 2-Stage (PATCH)
- [ ] aed_data 포함 + null 처리
- [ ] profile.organizations 접근 (단수형)
- [ ] canEditInspection 위치 인자 호출
- [ ] allowedFields를 snake_case로 변경
- [ ] fieldMapping 제거 또는 비활성화

### 배포 전
- [ ] TypeScript 컴파일 통과
- [ ] Jest 테스트 통과
- [ ] 수동 QA 완료
- [ ] null 케이스 확인

---

## 코드 위치 참고

| 항목 | 파일:라인 |
|-----|---------|
| user_profiles 관계 | prisma/schema.prisma:700 |
| can_export_data 필드 | prisma/schema.prisma:654 |
| InspectionHistory 타입 | lib/inspections/session-utils.ts:208-229 |
| inspections 모델 (aed_data 관계) | prisma/schema.prisma:280 |
| PATCH 엔드포인트 (allowedFields) | app/api/inspections/[id]/route.ts:105-113 |
| updateInspectionRecord | lib/inspections/session-utils.ts:320-343 |

---

**최종 상태**: ✅ **v5.0 최종 확정, 구현 시작 가능**

**버전 이력**:
- v1.0: 초기 계획 (부분 정보)
- v2.0: 코드 검증 후 상세 분석
- v3.0: 신중한 재검토 (3가지 오류 수정)
- v4.0: 이슈 재검토 (구현 이슈 명확화)
- v5.0: 최종 확정 (4가지 구체적 이슈 해결)
