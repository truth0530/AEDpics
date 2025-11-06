# 점검 기능 구현 계획서 (2025-11-06)

## 개요
기존 점검 시스템의 4가지 핵심 기능을 완성하기 위한 상세 구현 계획입니다.
각 기능별로 현재 상태, 구현 방향, 테스트 전략을 제시합니다.

---

## 1. 엑셀 다운로드 필터링 (Priority: 🔴 높음 - 보안)

### 1.1 현황 분석

**현재 상태**: 다운로드 기능 자체가 없음
- `/api/inspections/export` 엔드포인트 미존재
- 권한 검증: access-control.ts에는 `canExportData` 권한 정의되어 있음
- 기존 시스템: `/api/aed-data/route.ts`에서 `enforceFilterPolicy` 사용하여 권한별 필터링 적용

**권한 정의 (확인됨)**:
```
master, emergency_center_admin, regional_emergency_center_admin,
ministry_admin, regional_admin, local_admin: canExportData = true

temporary_inspector, pending_approval, email_verified, rejected: canExportData = false
```

### 1.2 구현 범위

#### 1.2.1 역할별 다운로드 범위

| 역할 | 볼 수 있는 범위 | 비고 |
|------|----------------|------|
| master | 전국 전체 | 제약 없음 |
| ministry_admin | 전국 전체 | 제약 없음 |
| emergency_center_admin | 전국 전체 | 중앙응급의료센터 |
| regional_emergency_center_admin | 소속 시도 전체 | 17개 시도 응급의료지원센터 |
| regional_admin | 소속 시도 전체 | 시청/도청 담당자 |
| local_admin | 소속 시군구만 | 보건소 담당자 |
| temporary_inspector | 할당된 장비만 (시스템 거부) | 임시점검자 |

#### 1.2.2 구현할 엔드포인트

```
POST /api/inspections/export
- 요청 파라미터:
  - format: "excel" | "csv"
  - filters?: {
      regionCode?: string
      gugun?: string
      dateFrom?: string
      dateTo?: string
    }

응답:
- 성공 (200): 파일 스트림 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
- 권한 없음 (403): { error: "권한이 없습니다" }
- 필터 오류 (400): { error: "지역 필터를 지정해주세요" }
```

### 1.3 구현 방식 (공통 로직 재사용)

#### Step 1: 공통 필터링 로직 추출 (선택사항)
**현재**: `/api/aed-data/route.ts`에 분산되어 있음
**권장**: 공통 유틸리티로 추출 (선택)

```typescript
// lib/aed/shared-filter-logic.ts (새로 생성)
export async function applyAccessControl(
  userProfile: UserProfile,
  requestedFilters: { regionCodes?: string[], cityCodes?: string[] }
) {
  const accessScope = resolveAccessScope(userProfile);
  return enforceFilterPolicy({
    userProfile,
    accessScope,
    requestedFilters
  });
}
```

#### Step 2: 엔드포인트 구현

**파일**: `/app/api/inspections/export/route.ts` (새로 생성)

```typescript
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { resolveAccessScope } from "@/lib/auth/access-control";
import { enforceFilterPolicy } from "@/lib/aed/filter-policy";
import { maskSensitiveData } from "@/lib/data/masking";
import { logDataAccess } from "@/lib/audit/access-logger";
import ExcelJS from "exceljs";

export const POST = async (request: NextRequest) => {
  try {
    // 1. 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. 사용자 프로필 조회
    const userProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      include: { organizations: true }
    });

    // 3. 권한 확인
    if (!userProfile.can_export_data) {
      await logAccessRejection({
        userId: session.user.id,
        userRole: userProfile.role,
        reason: "Export permission denied",
        requestedFilters: {}
      });
      return NextResponse.json(
        { error: "점검 이력 내보내기 권한이 없습니다" },
        { status: 403 }
      );
    }

    // 4. 접근 범위 결정
    const accessScope = resolveAccessScope(userProfile);

    // 5. 필터 강제 적용
    const body = await request.json();
    const enforcementResult = enforceFilterPolicy({
      userProfile,
      accessScope,
      requestedFilters: {
        regionCodes: body.regionCodes,
        cityCodes: body.cityCodes,
        category_1: null,
        category_2: null,
        category_3: null
      }
    });

    if (!enforcementResult.success) {
      await logAccessRejection({
        userId: session.user.id,
        userRole: userProfile.role,
        reason: enforcementResult.reason,
        unauthorizedRegions: enforcementResult.unauthorizedRegions,
        unauthorizedCities: enforcementResult.unauthorizedCities
      });
      return NextResponse.json(
        { error: enforcementResult.reason },
        { status: enforcementResult.status }
      );
    }

    // 6. 점검 데이터 조회
    const inspections = await prisma.inspections.findMany({
      where: {
        // 권한 적용된 필터
        aed_data: {
          OR: [
            {
              sido: { in: enforcementResult.filters.regionCodes || undefined }
            },
            {
              gugun: { in: enforcementResult.filters.cityCodes || undefined }
            }
          ]
        }
      },
      include: {
        aed_data: true,
        inspector: { select: { full_name: true, email: true } }
      },
      orderBy: { created_at: 'desc' }
    });

    // 7. 민감 정보 마스킹
    const maskedInspections = inspections.map(inspection =>
      maskSensitiveData(inspection, userProfile.role)
    );

    // 8. Excel 생성
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("점검 이력");

    // 헤더 추가
    worksheet.columns = [
      { header: "점검ID", key: "id", width: 20 },
      { header: "AED ID", key: "equipment_serial", width: 20 },
      { header: "시도", key: "sido", width: 15 },
      { header: "시군구", key: "gugun", width: 15 },
      { header: "점검자", key: "inspector_name", width: 15 },
      { header: "점검 날짜", key: "inspection_date", width: 20 },
      // ... 더 많은 컬럼
    ];

    // 데이터 추가
    maskedInspections.forEach(inspection => {
      worksheet.addRow({
        id: inspection.id,
        equipment_serial: inspection.equipment_serial,
        sido: inspection.aed_data.sido,
        gugun: inspection.aed_data.gugun,
        inspector_name: inspection.inspector?.full_name,
        inspection_date: inspection.created_at
        // ...
      });
    });

    // 9. 파일 스트리밍
    const buffer = await workbook.xlsx.writeBuffer();

    // 10. 감사 로그
    await logDataAccess({
      userId: session.user.id,
      userRole: userProfile.role,
      action: "EXPORT_INSPECTIONS",
      recordCount: maskedInspections.length,
      filters: enforcementResult.filters
    });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="inspections_${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    });

  } catch (error) {
    logger.error("InspectionExportAPI", "Export failed", { error });
    return NextResponse.json(
      { error: "내보내기 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
};
```

### 1.4 테스트 전략

#### 단위 테스트 (Jest)
```typescript
// __tests__/api/inspections/export.test.ts

describe("POST /api/inspections/export", () => {

  test("regional_admin은 소속 시도의 데이터만 다운로드 가능", async () => {
    // 대구(DAE) 시청 담당자로 로그인
    // → 대구 데이터만 포함되어야 함
    // → 서울 데이터는 제외되어야 함
  });

  test("local_admin은 소속 시군구의 데이터만 다운로드 가능", async () => {
    // 서귀포시 보건소 담당자(고현아)로 로그인
    // → 서귀포 데이터만 포함
    // → 제주시 데이터 제외
  });

  test("temporary_inspector는 403 에러 반환", async () => {
    // 임시점검자로 로그인
    // → 403 권한 오류 반환
  });

  test("Excel 파일의 행 개수가 조회된 데이터와 일치", async () => {
    // 다운로드한 Excel 파일 파싱
    // → 행 개수 == 조회된 inspections 수
  });
});
```

#### 통합 테스트 (실제 계정)
```
Test Plan:
1. Master 계정: 전국 1000+ 행 다운로드 가능
2. Regional_admin(DAE): DAE 500+ 행, 전국 아님
3. Local_admin(Seogwipo): 50 행만
4. Temporary_inspector: 403 에러
5. Excel 파일 포맷: 컬럼 37개, 헤더 포함
```

---

## 2. 점검 이력 수정 (Priority: 🟡 중간)

### 2.1 현황 분석

**UI 상태**:
- 모든 Step이 `ReadOnly*` 컴포넌트 사용 중
- `canEdit` prop 정의되어 있으나 사용 안 함
- 삭제 버튼은 있음, 수정 버튼은 없음

**백엔드 상태**:
- PUT 엔드포인트 없음
- DELETE는 있음 (`/api/inspections/[id]/delete/route.ts`)
- 권한 검증 없음 (access-control.ts에 함수 정의 안 됨)

**감시 기능**:
- `inspection_field_comparisons` 테이블은 있으나 `modified_by` 필드 없음
- 변경 이력 추적 불가능

### 2.2 구현 범위

#### 2.2.1 권한 정의 (access-control.ts에 추가)

```typescript
export function canEditInspection(context: AccessContext): boolean {
  const { userProfile, targetInspection } = context;

  if (userProfile.role === 'master') return true;

  if (userProfile.role === 'emergency_center_admin') return true;

  if (userProfile.role === 'regional_emergency_center_admin') {
    // 소속 시도 내의 점검만 수정 가능
    return targetInspection.aed_data.sido ===
           getRegionLabel(userProfile.organization.region_code);
  }

  if (userProfile.role === 'local_admin') {
    // 관할 보건소 또는 담당자가 작성한 점검만
    return (
      targetInspection.equipment_serial in userProfile.assigned_devices ||
      targetInspection.inspector_id === userProfile.id
    );
  }

  if (userProfile.role === 'temporary_inspector') {
    // 본인이 작성한 점검만
    return targetInspection.inspector_id === userProfile.id;
  }

  return false;
}

export function canDeleteInspection(context: AccessContext): boolean {
  // 수정 권한이 있으면 삭제 권한도 있음 (더 높은 권한)
  return canEditInspection(context);
}
```

#### 2.2.2 백엔드 엔드포인트 구현

**파일**: `/app/api/inspections/[id]/route.ts` (수정 또는 새로 생성)

```typescript
// PUT: 점검 이력 수정
export const PUT = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. 기존 점검 기록 조회
    const inspection = await prisma.inspections.findUnique({
      where: { id: params.id },
      include: { aed_data: true, inspector: true }
    });

    if (!inspection) {
      return NextResponse.json(
        { error: "점검 기록을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 2. 권한 검증
    const canEdit = canEditInspection({
      userProfile: await getUserProfile(session.user.id),
      targetInspection: inspection
    });

    if (!canEdit) {
      return NextResponse.json(
        { error: "이 점검 이력을 수정할 권한이 없습니다" },
        { status: 403 }
      );
    }

    // 3. 수정할 필드만 추출 (보안)
    const body = await request.json();
    const allowedFields = [
      'battery_status', 'pad_status', 'visual_status',
      'operation_status', 'issues_found', 'notes'
    ];

    const updateData = {};
    allowedFields.forEach(field => {
      if (field in body) {
        updateData[field] = body[field];
      }
    });

    // 4. 기존 값과 새 값 비교 (변경 이력용)
    const changes = {};
    Object.keys(updateData).forEach(field => {
      if (inspection[field] !== updateData[field]) {
        changes[field] = {
          before: inspection[field],
          after: updateData[field]
        };
      }
    });

    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ inspection }, { status: 200 });
    }

    // 5. 점검 기록 수정
    const updated = await prisma.inspections.update({
      where: { id: params.id },
      data: {
        ...updateData,
        updated_at: new Date(),
        // 수정자 정보는 별도 테이블에 저장
      }
    });

    // 6. 변경 이력 기록 (inspection_field_comparisons 재사용)
    // modified_by 필드 추가 필요
    for (const [field, changeInfo] of Object.entries(changes)) {
      await prisma.inspection_field_comparisons.create({
        data: {
          inspection_id: params.id,
          equipment_serial: inspection.equipment_serial,
          field_name: field,
          inspection_value: changeInfo.after,
          aed_data_value: changeInfo.before,
          status_at_inspection: 'modified',
          // modified_by: session.user.id (필드 추가 필요)
          last_checked_at: new Date()
        }
      });
    }

    // 7. 감사 로그
    await logAudit({
      userId: session.user.id,
      action: "UPDATE_INSPECTION",
      resourceId: params.id,
      changes
    });

    return NextResponse.json({ inspection: updated }, { status: 200 });

  } catch (error) {
    logger.error("InspectionUpdateAPI", "Update failed", { error });
    return NextResponse.json(
      { error: "수정 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
};

// DELETE: 점검 이력 삭제
export const DELETE = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  // 기존 로직과 동일하지만 권한 검증 강화
  // ...
};
```

#### 2.2.3 데이터베이스 스키마 수정

**파일**: `/prisma/schema.prisma`

```prisma
// inspection_field_comparisons 테이블에 필드 추가
model inspection_field_comparisons {
  // ... 기존 필드

  // 수정자 정보 (추가)
  modified_by String?  @db.Uuid
  modified_at DateTime? @default(now())  // 기존 updated_at 대신 명시적으로

  // 관계 추가
  modifier user_profiles? @relation("InspectionModifier", fields: [modified_by], references: [id])
}
```

**마이그레이션**:
```bash
npx prisma migrate dev --name add_inspection_audit_fields
```

#### 2.2.4 프론트엔드 UI 수정

**파일**: `/components/inspection/InspectionHistoryModal.tsx`

```typescript
// 1. EditStep 컴포넌트 추가 필요
const STEP_TABS = [
  {
    id: 0,
    label: '1단계: 기본정보',
    component: isEditMode ? EditBasicInfoStep : ReadOnlyBasicInfoStep
  },
  // ...
];

// 2. 수정 모드 토글
const [isEditMode, setIsEditMode] = useState(false);
const [unsavedChanges, setUnsavedChanges] = useState({});

// 3. 저장 핸들러
const handleSave = async () => {
  try {
    setIsSaving(true);
    const response = await fetch(`/api/inspections/${inspection.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(unsavedChanges)
    });

    if (!response.ok) {
      const error = await response.json();
      alert(`저장 실패: ${error.error}`);
      return;
    }

    // Optimistic update: UI 즉시 반영
    setInspection(prev => ({ ...prev, ...unsavedChanges }));
    setIsEditMode(false);
    setUnsavedChanges({});
    onUpdate?.();

  } finally {
    setIsSaving(false);
  }
};

// 4. 취소 핸들러
const handleCancel = () => {
  if (Object.keys(unsavedChanges).length > 0) {
    if (!window.confirm('변경사항이 저장되지 않습니다. 계속하시겠습니까?')) {
      return;
    }
  }
  setIsEditMode(false);
  setUnsavedChanges({});
};

// 5. 권한 검증
const canEdit = canEditInspection({
  userProfile: session.user,
  targetInspection: inspection
});
```

### 2.3 테스트 전략

#### 수정/취소/권한 거부 플로우

```
Test Case 1: Master 계정의 수정 허용
├─ 점검 기록 조회
├─ 수정 모드 진입
├─ 필드 변경 (예: battery_status)
├─ 저장 (PUT /api/inspections/[id])
├─ inspection_field_comparisons에 변경 이력 기록됨
├─ UI에 즉시 반영 (Optimistic update)
└─ 감사 로그 생성

Test Case 2: Regional_admin이 타 시도 점검 수정 시도
├─ 대구 점검 기록 조회
├─ 서울 regional_admin으로 수정 시도
├─ 403 권한 오류 반환
└─ 감사 로그: "UNAUTHORIZED_UPDATE_ATTEMPT"

Test Case 3: 수정 중 취소
├─ 필드 변경 (unsavedChanges 생성)
├─ 취소 버튼 클릭
├─ 확인 대화창
├─ 서버로 전송되지 않음
└─ UI가 원본 데이터로 복원

Test Case 4: 동시 수정 (Conflict)
├─ 사용자 A가 데이터 수정 중
├─ 사용자 B가 같은 데이터 먼저 저장
├─ 사용자 A가 저장 시 버전 충돌 감지
├─ 최신 데이터 재조회 제안
└─ 재입력 요청
```

---

## 3. 점검불가 UI 완성 (Priority: 🟡 중간)

### 3.1 현황 분석

**이미 구현됨**:
- `UnavailableReasonModal` 컴포넌트 (UI 완성)
- `mark-unavailable` API (상태 저장)
- 사유 입력 필드 (기타 옵션 포함)

**부족한 부분**:
- QuickInspectPanel 통합 불완전
- 상태 변환 로직 (불가 → 진행중) 자동화 안 됨
- 통계 계산에서 처리 방식 불명확

### 3.2 구현 범위

#### 3.2.1 상태 변환 플로우

```
상태 다이어그램:

[대기중] ─→ [불가능] ─→ [대기중 (재점검)]
   ↓              ↓
[진행중]    [통계 제외]
   ↓
[완료]
```

#### 3.2.2 QuickInspectPanel 통합

**파일**: `/components/inspection/QuickInspectPanel.tsx` (수정)

```typescript
// 1. 불가 모달 상태 추가
const [showUnavailableModal, setShowUnavailableModal] = useState(false);

// 2. 불가 처리 핸들러
const handleMarkUnavailable = async (reason: string, note: string) => {
  try {
    const response = await fetch('/api/inspections/mark-unavailable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        equipment_serial: aedDevice.equipment_serial,
        reason,
        note,
        inspector_id: session.user.id
      })
    });

    if (!response.ok) {
      throw new Error('점검불가 처리 실패');
    }

    // 상태 업데이트
    setAssignmentStatus('unavailable');
    setShowUnavailableModal(false);

    // 사용자 피드백
    toast.success('점검불가로 표시되었습니다');

    // 점검 목록 새로고침
    onRefresh?.();

  } catch (error) {
    toast.error(`오류: ${error.message}`);
  }
};

// 3. 재점검 버튼 (불가 상태에서만 표시)
const handleRestartInspection = async () => {
  try {
    const response = await fetch('/api/inspections/mark-unavailable', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        equipment_serial: aedDevice.equipment_serial
      })
    });

    if (!response.ok) {
      throw new Error('재점검 시작 실패');
    }

    // 상태 변환: unavailable → pending
    setAssignmentStatus('pending');

    // 점검 시작
    handleStartInspection();

  } catch (error) {
    toast.error(`오류: ${error.message}`);
  }
};

// 4. 버튼 표시 로직
return (
  <div>
    {assignmentStatus === 'pending' ? (
      <>
        <Button onClick={handleStartInspection}>점검 시작</Button>
        <Button onClick={() => setShowUnavailableModal(true)} variant="outline">
          점검불가
        </Button>
      </>
    ) : assignmentStatus === 'unavailable' ? (
      <>
        <Button onClick={handleRestartInspection} variant="warning">
          재점검 시작
        </Button>
        <p className="text-sm text-gray-500">점검불가 사유: {unavailableNote}</p>
      </>
    ) : (
      // 진행중, 완료 상태
    )}

    <UnavailableReasonModal
      isOpen={showUnavailableModal}
      onClose={() => setShowUnavailableModal(false)}
      onSubmit={handleMarkUnavailable}
      equipment={aedDevice}
    />
  </div>
);
```

#### 3.2.3 권한 검증 (점검 재개)

**파일**: `/lib/auth/access-control.ts` (추가)

```typescript
export function canRestartInspection(context: AccessContext): boolean {
  const { userProfile, targetAssignment } = context;

  // 1. 점검불가 상태인지 확인
  if (targetAssignment.status !== 'unavailable') {
    return false;
  }

  // 2. 역할별 권한 확인
  if (userProfile.role === 'master') return true;

  if (userProfile.role === 'emergency_center_admin') return true;

  if (userProfile.role === 'regional_emergency_center_admin') {
    // 소속 시도 내의 장비만
    return targetAssignment.equipment.region_code ===
           userProfile.organization.region_code;
  }

  if (userProfile.role === 'local_admin') {
    // 관할 시군구만
    return targetAssignment.equipment.city_code ===
           userProfile.organization.city_code;
  }

  if (userProfile.role === 'temporary_inspector') {
    // 할당받은 장비만
    return targetAssignment.assigned_to === userProfile.id;
  }

  return false;
}
```

### 3.3 통계 영향 분석

**의문점**: 점검 완료율 계산에서 'unavailable' 상태 처리

**현재 계산 방식 (추정)**:
```typescript
const completedCount = await prisma.inspections.count({
  where: { status: 'completed' }
});

const totalCount = await prisma.inspection_assignments.count();

const completionRate = (completedCount / totalCount) * 100;
```

**문제**:
- unavailable 상태인 assignment가 denominator에 포함됨
- → 완료율이 불필요하게 낮아짐

**권장 수정**:
```typescript
// unavailable 제외
const countableAssignments = await prisma.inspection_assignments.count({
  where: {
    status: { notIn: ['unavailable', 'cancelled'] }
  }
});

const completedCount = await prisma.inspections.count({
  where: { status: 'completed' }
});

const completionRate = (completedCount / countableAssignments) * 100;
```

### 3.4 테스트 전략

```
QA Checklist:

점검불가 표시
├─ [ ] QuickInspectPanel에서 "점검불가" 버튼 클릭
├─ [ ] 사유 선택 (폐기, 고장, 분실, 기타)
├─ [ ] 기타 선택 시 텍스트 입력 가능
├─ [ ] 저장 후 inspection_assignments.status = 'unavailable'
└─ [ ] 점검 목록에서 "불가" 상태 표시

재점검 시작
├─ [ ] 불가 상태인 장비에서 "재점검 시작" 버튼 표시
├─ [ ] 권한 확인 (regional_admin은 타 시도 불가)
├─ [ ] 클릭 후 status → 'pending' 변환
├─ [ ] 점검 폼 새로 시작
└─ [ ] 이전 불가 사유는 기록으로 남음

통계 영향
├─ [ ] 점검 완료율 = (완료 수) / (전체 - 불가) 계산
├─ [ ] Dashboard에서 "불가" 건수 별도 표시
└─ [ ] 시도별 불가 사유 분포 리포트

동시성
├─ [ ] 사용자 A가 불가 처리 중 사용자 B가 점검 시작 → 충돌 처리
├─ [ ] 장비 할당 취소 후 불가 처리 → 오류 처리
└─ [ ] 불가 상태에서 강제로 완료 시도 → 거부
```

---

## 4. CPR 필드 일관성 (Priority: 🟡 중간)

### 4.1 현황 분석

**문제**: CPR 필드의 데이터 타입 불일치

**스키마** (prisma/schema.prisma, inspections 테이블):
```prisma
cpr_guidebook_available Boolean?  // ← Boolean
```

**엑셀 내보내기 (추정)**:
```typescript
// true/false 값 그대로 저장
worksheet.addCell(inspection.cpr_guidebook_available);

// → Excel에서 "true" 또는 "false" 로 표시 (영문, 불자연)
```

**권장 표현**: 한글 "예" / "아니오"

### 4.2 구현 범위

#### 옵션 A: 스키마 변경 (권장)

**파일**: `/prisma/schema.prisma`

```prisma
model inspections {
  // 변경 전
  // cpr_guidebook_available Boolean?

  // 변경 후
  cpr_guidebook_available String?  // "yes" | "no" | "unknown"
}
```

**마이그레이션**:
```bash
npx prisma migrate dev --name change_cpr_field_to_string

# migration 파일 내용
ALTER TABLE inspections
ALTER COLUMN cpr_guidebook_available TYPE varchar(20);

UPDATE inspections
SET cpr_guidebook_available = CASE
  WHEN cpr_guidebook_available = true THEN 'yes'
  WHEN cpr_guidebook_available = false THEN 'no'
  ELSE NULL
END;
```

**UI 수정** (components/inspection/CPRCheckStep.tsx):
```typescript
// 변경 전
<input type="checkbox" checked={cprAvailable} />

// 변경 후
<div className="flex gap-4">
  <label>
    <input
      type="radio"
      name="cpr"
      value="yes"
      checked={cprStatus === 'yes'}
      onChange={() => setCprStatus('yes')}
    />
    예
  </label>
  <label>
    <input
      type="radio"
      name="cpr"
      value="no"
      checked={cprStatus === 'no'}
      onChange={() => setCprStatus('no')}
    />
    아니오
  </label>
  <label>
    <input
      type="radio"
      name="cpr"
      value="unknown"
      checked={cprStatus === 'unknown'}
      onChange={() => setCprStatus('unknown')}
    />
    확인불가
  </label>
</div>
```

**기타 옵션 추가**:
```typescript
{cprStatus === 'other' && (
  <input
    type="text"
    placeholder="기타 사유를 입력해주세요"
    value={cprOtherText}
    onChange={(e) => setCprOtherText(e.target.value)}
  />
)}
```

#### 옵션 B: 엑셀 내보내기 변환 로직만 수정 (임시)

**파일**: `/app/api/inspections/export/route.ts`

```typescript
// 데이터 변환 함수
function convertCprStatus(value: boolean | null): string {
  if (value === true) return '예';
  if (value === false) return '아니오';
  return '미확인';
}

// 엑셀 추가 시
worksheet.addRow({
  // ...
  cpr_guidebook: convertCprStatus(inspection.cpr_guidebook_available),
  // ...
});
```

### 4.3 테스트 전략

```
Data Migration Test:

기존 데이터 검증
├─ [ ] SELECT COUNT(*) FROM inspections WHERE cpr_guidebook_available IS NOT NULL
├─ [ ] true → 'yes'로 정상 변환
├─ [ ] false → 'no'로 정상 변환
├─ [ ] NULL은 NULL로 유지
└─ [ ] 총 행 수 변화 없음

UI 테스트
├─ [ ] 점검 폼에서 라디오 버튼 선택 가능
├─ [ ] 기타 선택 시 텍스트 입력 필드 표시
└─ [ ] 저장 후 'yes'/'no'/'other' 값 저장됨

엑셀 내보내기 테스트
├─ [ ] true → "예"로 표시
├─ [ ] false → "아니오"로 표시
├─ [ ] NULL → "미확인"으로 표시
└─ [ ] 기타 → "기타: [입력 텍스트]"로 표시
```

---

## 5. Follow-ups 및 테스트 전략

### 5.1 엑셀 권한 패치 후 테스트

**단위 테스트** (Jest):
```typescript
// __tests__/lib/auth/export-permissions.test.ts

describe("Export Permission Validation", () => {

  test("local_admin이 다른 시군구 데이터 다운로드 시도 → 403", async () => {
    const seogwipoAdmin = { role: 'local_admin', organization: { city_code: 'seogwipo' } };
    const result = enforceFilterPolicy({
      userProfile: seogwipoAdmin,
      requestedFilters: { cityCodes: ['namdong'] }  // 다른 시군구
    });
    expect(result.success).toBe(false);
    expect(result.status).toBe(403);
  });

  test("ministry_admin은 모든 도시 다운로드 가능", async () => {
    const minAdmin = { role: 'ministry_admin' };
    const result = enforceFilterPolicy({
      userProfile: minAdmin,
      requestedFilters: { cityCodes: ['seogwipo', 'namdong', 'jeju'] }
    });
    expect(result.success).toBe(true);
  });
});
```

**통합 테스트** (E2E - Playwright):
```typescript
// e2e/export.spec.ts

test("Regional admin exports only their region's data", async () => {
  // 1. 대구 regional_admin 로그인
  await login('daegu_admin@korea.kr');

  // 2. 엑셀 다운로드 요청
  const downloadPromise = page.waitForEvent('download');
  await page.click('button:has-text("다운로드")');
  const download = await downloadPromise;

  // 3. Excel 파일 파싱
  const buffer = await download.path();
  const workbook = XLSX.readFile(buffer);
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[0]);

  // 4. 모든 행이 '대구'인지 확인
  const allDaegu = data.every(row => row['시도'] === '대구');
  expect(allDaegu).toBe(true);
});
```

### 5.2 점검 이력 UI 수정 시 권한 오류 재현

**QA 체크리스트**:
```
권한 거부 케이스:

1. Temporary Inspector가 다른 사람의 점검 수정 시도
   ├─ [ ] 점검 기록 조회 가능
   ├─ [ ] 수정 버튼 비활성화
   └─ [ ] PUT 요청 시 403 에러

2. Regional Admin이 타 지역 점검 수정
   ├─ [ ] 점검 기록 조회 가능 (권한에 따라)
   ├─ [ ] 수정 버튼 비활성화
   └─ [ ] PUT 요청 시 403 에러

3. 직급이 강등된 사용자의 권한 확인
   ├─ [ ] Master → Local Admin 강등
   ├─ [ ] 기존 전국 점검 수정 불가
   └─ [ ] 관할 시군구만 수정 가능
```

### 5.3 점검불가 → 재점검 전환 시나리오

**QA 체크리스트**:
```
상태 전환 시나리오:

1. 정상 흐름
   ├─ pending AED
   ├─ [점검불가] 클릭
   ├─ 사유 선택 및 저장
   ├─ status = 'unavailable'
   ├─ [재점검 시작] 버튼 표시
   ├─ 클릭
   ├─ status = 'pending'
   ├─ 점검 폼 새로 시작
   └─ 완료

2. 권한 거부
   ├─ Regional Admin(DAE) 로그인
   ├─ 인천 장비의 unavailable 상태 확인
   ├─ [재점검 시작] 클릭
   ├─ 403 에러 반환
   └─ 토스트 메시지: "권한이 없습니다"

3. 경쟁 조건 (Race Condition)
   ├─ 사용자 A: 장비 unavailable 표시
   ├─ 사용자 B: 동시에 같은 장비 점검 시작
   ├─ 먼저 도착한 요청 성공
   ├─ 뒤의 요청 conflict 오류
   └─ 사용자 B에게 "이미 처리되었습니다" 메시지

4. 통계 영향
   ├─ Dashboard 로드
   ├─ "점검불가" 카운트 표시
   ├─ 완료율 = (완료 / (전체 - 불가))
   └─ 시도별 불가 분포 차트
```

---

## 6. 구현 일정 추정

| 항목 | 예상 시간 | 우선순위 |
|------|----------|---------|
| 1. 엑셀 권한 필터링 | 2-3시간 | 🔴 높음 |
| 2. 점검 이력 수정 | 3-4시간 | 🟡 중간 |
| 3. 점검불가 UI 완성 | 2-3시간 | 🟡 중간 |
| 4. CPR 필드 일관성 | 1-2시간 | 🟡 중간 |
| **테스트 및 QA** | **4-6시간** | **필수** |
| **총합** | **~16-20시간** | - |

---

## 7. 위험 요소 및 대응책

### 7.1 엑셀 내보내기
- **위험**: 대용량 데이터(10만+ 행) 처리 시 메모리 부족
- **대응**: 스트리밍 방식 또는 배치 처리

### 7.2 점검 이력 수정
- **위험**: 동시 수정 시 데이터 불일치
- **대응**: 낙관적 업데이트 + 버전 충돌 감지

### 7.3 점검불가 → 재점검
- **위험**: 상태 로직 실수로 인한 데이터 손상
- **대응**: 상태 전환 테이블 명확히, 재점검 임시저장 별도 추적

### 7.4 CPR 필드 마이그레이션
- **위험**: 기존 boolean 데이터 손실
- **대응**: 마이그레이션 스크립트 백업 및 롤백 계획 수립

---

## 8. 다음 단계

1. **이번 검토 공유 및 피드백**
2. **구현 시작 (우선순위 순)**
   - Step 1: 엑셀 권한 (보안)
   - Step 2: 점검 이력 수정
   - Step 3: 점검불가 UI
   - Step 4: CPR 필드
3. **각 단계 완료 후 QA 체크리스트 실행**
4. **프로덕션 배포**

---

**작성일**: 2025-11-06
**작성자**: Claude Code
**다음 검토**: 구현 시작 전
