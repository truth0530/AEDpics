# 점검 기능 구현 계획서 - 수정판 (2025-11-06)

## 변경 이력

| 버전 | 날짜 | 변경사항 |
|------|------|---------|
| v1.0 | 2025-11-06 | 초기 계획 (부분적 정보) |
| v2.0 | 2025-11-06 (수정) | 코드 검증 후 상세 분석 완료 |

---

## 주요 발견사항 (이전 계획과의 차이)

### 1. Export 엔드포인트 현황 재확인
**이전**: "필터링만 빠져 있음"
**실제**: **엔드포인트 자체가 없음** (완전히 새로 구현 필요)

### 2. 성능 평가 재검토
**이전**: "대용량 처리 시 병목 우려"
**실제**:
- DB 단계 필터링으로 안전함 (WHERE 조건이 SQL에 포함)
- 커서 기반 페이지네이션 (O(1) 복잡도)
- maxResultLimit = 10,000 (충분한 범위)

### 3. 기술 부채 발견
**새로 식별된 항목**:
- **unavailable_reason enum 불일치** (🔴 CRITICAL)
  - schema.prisma: ['disposed', 'broken', 'other']
  - 실제 코드: ['disposed', 'broken', 'lost', 'other']
  - mark-unavailable/route.ts에서 'lost' 사용 중
- **unavailable 통계 미집계** (DashboardStats에 필드 있으나 SQL 미포함)
- **CPR 필드 미존재** (스키마에도 코드에도 없음)

---

## 구현 계획 (우선순위 재정렬)

### 0단계: 기술 부채 해결 (선행 작업)

#### 0-1. unavailable_reason enum 수정 (🔴 CRITICAL - 1시간)

**파일**: `/prisma/schema.prisma` (line 935-939)

**현재 문제**:
```prisma
enum unavailable_reason {
  disposed
  broken      // ← 'lost' 없음
  other
}
```

**실제 사용** (mark-unavailable/route.ts line 39):
```typescript
['disposed', 'broken', 'lost', 'other'].includes(reason)
```

**수정 방법**:
```prisma
enum unavailable_reason {
  disposed
  broken
  lost       // ← 추가
  other
}
```

**마이그레이션**:
```bash
npx prisma migrate dev --name fix_unavailable_reason_enum
```

**테스트**:
- [ ] UnavailableReasonModal에서 '분실' 옵션 선택 가능
- [ ] API 저장 시 'lost' 값 정상 저장
- [ ] 데이터베이스 enum 타입 확인

**배포 순서**: 즉시 (선행 작업)

---

#### 0-2. unavailable 통계 집계 추가 (1-2시간)

**파일**: `/lib/aed/dashboard-queries.ts` (line 156-166)

**현재 상태**:
- DashboardStats에 `unavailable`, `unavailable_mandatory` 필드 정의됨
- SQL에서 집계하지 않음 (항상 0)

**수정 방법**:
```typescript
// Line 156-180: SQL 쿼리 수정
SUM(CASE
  WHEN ia.status = 'unavailable' THEN 1
  ELSE 0
END) as unavailable,

SUM(CASE
  WHEN a.category_1 = '구비의무기관'
    AND ia.status = 'unavailable' THEN 1
  ELSE 0
END) as unavailable_mandatory,
```

**검증 쿼리**:
```sql
-- 검증: unavailable 개수 확인
SELECT COUNT(*) FROM inspection_assignments
WHERE status = 'unavailable';
```

**테스트**:
- [ ] Dashboard unavailable 통계 표시
- [ ] 시도별 unavailable 카운트 정확성
- [ ] 배치 작업(/api/cron/*)에서 unavailable 제외 여부 확인

**배포 순서**: 0-1 이후 (즉시)

---

### 1단계: 엑셀 다운로드 필터링 (Priority: 🔴 높음 - 3-4시간)

#### 1.1 엔드포인트 구현

**파일**: `/app/api/inspections/export/route.ts` (새로 생성)

**설계**:
```
POST /api/inspections/export
├─ 인증 확인
├─ 권한 검증 (canExportData)
├─ enforceFilterPolicy 적용
│  ├─ 역할별 범위 제한
│  ├─ 권한 미통과 시 403
│  └─ 필터 강제 적용
├─ Prisma OR Prisma.$queryRaw로 데이터 조회
│  (대용량 대비 페이지네이션 또는 스트리밍)
├─ Excel 생성 (ExcelJS)
├─ 파일 스트리밍 반환
└─ 감사 로그 기록
```

**코드 템플릿**:
```typescript
export const POST = async (request: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userProfile = await prisma.user_profiles.findUnique({
    where: { id: session.user.id },
    include: { organizations: true }
  });

  // 1. canExportData 확인
  if (!userProfile.can_export_data) {
    return NextResponse.json({ error: "Export permission denied" }, { status: 403 });
  }

  // 2. enforceFilterPolicy 적용 (lib/aed/filter-policy.ts 재사용)
  const accessScope = resolveAccessScope(userProfile);
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
    return NextResponse.json({ error: enforcementResult.reason }, { status: enforcementResult.status });
  }

  // 3. 데이터 조회 (enforceFilterPolicy 결과 사용)
  const filteredRegions = enforcementResult.filters.regionCodes;
  const filteredCities = enforcementResult.filters.cityCodes;

  const inspections = await prisma.inspections.findMany({
    where: {
      aed_data: {
        AND: [
          { sido: { in: filteredRegions } },
          filteredCities ? { gugun: { in: filteredCities } } : {}
        ]
      }
    },
    include: { aed_data: true, inspector: true },
    take: 10000  // maxResultLimit 준수
  });

  // 4. Excel 생성 및 스트리밍
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("점검 이력");
  // ... 헤더/데이터 추가

  const buffer = await workbook.xlsx.writeBuffer();

  // 5. 감사 로그
  await logDataAccess({
    userId: session.user.id,
    action: "EXPORT_INSPECTIONS",
    recordCount: inspections.length
  });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="inspections_${new Date().toISOString().split('T')[0]}.xlsx"`
    }
  });
};
```

**배포 순서**:
1. 백엔드: POST 엔드포인트 구현
2. 테스트: 권한별 필터링 검증
3. 프론트: Export 버튼 추가 UI

**배포 전 체크리스트**:
- [ ] TypeScript 컴파일 성공
- [ ] Unit test: regional_admin은 DAE만, local_admin은 자신의 시군구만
- [ ] Integration test: 권한 거부 시 403 반환
- [ ] 감사 로그 정상 기록

---

#### 1.2 테스트 전략

**자동화 테스트** (Jest):
```typescript
describe("POST /api/inspections/export", () => {
  test("local_admin은 관할 시군구만 다운로드", async () => {
    // 서귀포 담당자(고현아)로 요청
    // → 응답에 seogwipo 데이터만 포함
    // → 타 시도 데이터 없음
  });

  test("regional_admin은 소속 시도만", async () => {
    // 대구 담당자로 요청
    // → 대구 데이터만
  });

  test("권한 없는 사용자 403", async () => {
    // temporary_inspector로 요청
    // → 403 반환
  });
});
```

**수동 테스트** (QA):
```
Test Case: Excel 파일 검증
├─ 다운로드 완료
├─ 파일 확장자: .xlsx
├─ 행 개수: 조회된 inspections.length와 일치
├─ 컬럼 37개 포함
├─ 민감 정보 마스킹 확인 (개인정보 없음)
└─ 날짜 형식: 일관성 있음
```

**책임**: QA 팀 (의존성 없음, 병렬 진행 가능)

---

### 2단계: 점검 이력 수정 (Priority: 🟡 중간 - 4-6시간)

#### 2.1 배포 순서 및 마이그레이션

**마이그레이션 단계**:

```
Phase 1: 스키마 준비 (PR 1)
├─ inspection_field_comparisons에 필드 추가
│  ├─ modified_by: String @db.Uuid (nullable)
│  ├─ modified_at: DateTime @default(now())
│  └─ reason: String? (수정 사유)
├─ Prisma migrate dev
└─ 롤백 계획: DROP COLUMN modified_by, modified_at, reason

Phase 2: 백엔드 구현 (PR 2 - Phase 1 이후)
├─ PUT /api/inspections/[id] 엔드포인트
├─ canEditInspection(context) 권한 함수
├─ 동시성 제어:
│  ├─ ETag 또는 updated_at 체크
│  ├─ version conflict 감지
│  └─ 409 Conflict 응답
├─ 변경 이력 저장 (inspection_field_comparisons)
└─ 감사 로그

Phase 3: 프론트엔드 (PR 3 - Phase 2 이후)
├─ InspectionHistoryModal 쓰기 모드 추가
├─ EditBasicInfoStep 등 컴포넌트
├─ 동시성 처리:
│  ├─ 409 응답 시 최신 데이터 재조회
│  ├─ 병합 또는 재입력 선택
│  └─ Optimistic update 실패 처리
└─ 권한 검증 (canEdit=false 시 버튼 숨김)
```

**핵심: 스키마 변경 후 백엔드, 그 후 프론트**
- DB 마이그레이션 완료 후 API 배포
- API 안정화 후 UI 배포

---

#### 2.2 동시성 제어 (Lock 전략)

**선택지**:

**Option A: ETag 방식** (권장)
```typescript
// GET /api/inspections/[id]
{
  inspection: { ... },
  etag: "sha256:abc123..."
}

// PUT /api/inspections/[id]
PUT /api/inspections/[id]
{
  data: { ... },
  etag: "sha256:abc123..."
}

// 검증:
const currentETag = calculateETag(inspection);
if (etag !== currentETag) {
  return NextResponse.json({ error: "Resource has been modified" }, { status: 409 });
}
```

**Option B: updated_at 체크** (간단함)
```typescript
// PUT 시 updated_at 비교
const inspection = await prisma.inspections.findUnique({ where: { id } });
if (inspection.updated_at !== body.updated_at) {
  return NextResponse.json(
    { error: "Conflict", latestData: inspection },
    { status: 409 }
  );
}
```

**선택**: Option B (구현 간단, 검증 실패 시 최신 데이터 제공)

---

#### 2.3 UI에서의 Optimistic Update 처리

```typescript
// InspectionHistoryModal.tsx
const handleSave = async () => {
  const originalData = { ...inspection };

  // Step 1: 즉시 UI 업데이트 (Optimistic)
  setInspection(prev => ({ ...prev, ...unsavedChanges }));

  try {
    // Step 2: 서버 요청
    const response = await fetch(`/api/inspections/${inspection.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...unsavedChanges,
        updated_at: inspection.updated_at
      })
    });

    if (response.status === 409) {
      // Step 3: Conflict 발생 시 처리
      const { latestData } = await response.json();

      // 옵션 1: 자동 병합 (해결 가능한 경우)
      const mergedData = mergeConflict(originalData, unsavedChanges, latestData);
      setInspection(mergedData);

      // 옵션 2: 사용자에게 선택 제공
      const shouldRetry = window.confirm(
        '다른 사용자가 변경했습니다. 최신 데이터를 확인한 후 다시 입력하시겠습니까?'
      );

      if (shouldRetry) {
        setInspection(latestData);
        setUnsavedChanges({});
        return;
      }
    }

    if (response.ok) {
      const updated = await response.json();
      setInspection(updated);
      setUnsavedChanges({});
      onUpdate?.();
    } else {
      // 다른 에러: UI 롤백
      setInspection(originalData);
      toast.error("저장 실패");
    }
  } catch (error) {
    setInspection(originalData);  // 롤백
    toast.error("네트워크 오류");
  }
};
```

---

#### 2.4 권한 검증 (access-control.ts)

```typescript
export function canEditInspection(context: AccessContext): boolean {
  const { userProfile, targetInspection } = context;

  if (userProfile.role === 'master') return true;
  if (userProfile.role === 'emergency_center_admin') return true;

  if (userProfile.role === 'regional_emergency_center_admin') {
    // 소속 시도 내의 점검만
    return (
      targetInspection.aed_data.region_code ===
      userProfile.organization.region_code
    );
  }

  if (userProfile.role === 'local_admin') {
    // 관할 시군구 또는 본인 점검
    return (
      targetInspection.aed_data.city_code ===
      userProfile.organization.city_code ||
      targetInspection.inspector_id === userProfile.id
    );
  }

  if (userProfile.role === 'temporary_inspector') {
    return targetInspection.inspector_id === userProfile.id;
  }

  return false;
}
```

---

#### 2.5 테스트 전략

**자동화 테스트** (Jest):
```typescript
describe("PUT /api/inspections/[id]", () => {
  test("권한 있는 사용자만 수정 가능", async () => {
    // master: 성공
    // regional_admin(DAE): 대구 점검만 가능
    // temporary_inspector: 본인 점검만
  });

  test("409 Conflict 시 최신 데이터 포함", async () => {
    // 동시 수정 시뮬레이션
    // 409 응답에 latestData 포함
  });
});
```

**수동 테스트** (QA 체크리스트):
```
점검 이력 수정 플로우
├─ [ ] Master 계정으로 수정 가능
├─ [ ] 수정 후 inspection_field_comparisons에 기록
├─ [ ] 감시 로그에 modified_by 저장됨
├─ [ ] Regional_admin이 타 시도 수정 시도 → 403
├─ [ ] 수정 중 다른 사용자가 변경 → 409 + 재입력
├─ [ ] Optimistic update 실패 시 UI 롤백
└─ [ ] 수정 사유 저장 가능

권한 거부 케이스
├─ [ ] Temporary_inspector가 다른 사람의 점검 수정 시도 → 403
├─ [ ] Regional_admin이 타 시도 → 403
└─ [ ] 권한 미조회 사용자 → 401
```

**책임**: QA 팀 (환경: staging)
**일정**: 백엔드 배포 후 1-2일 (병렬 가능)

---

### 3단계: 점검불가 UI 완성 (Priority: 🟡 중간 - 2-3시간)

#### 3.1 현황 재정렬

**실제 현황** (코드 확인):
- UnavailableReasonModal: 완성됨 ✅
- QuickInspectPanel: 통합 시작됨 ✅
- mark-unavailable API: 작동 중 ✅
- unavailable_reason enum: 수정 필요 (0단계)

**추가 필요 작업**:
1. 상태 전환 흐름 자동화 (unavailable ↔ pending)
2. 통계에 unavailable 포함 (0-2단계)
3. 권한 재검증 (점검불가 후 재개 시)
4. 과거 불가 기록 보존 (감시 로그)

---

#### 3.2 구현 내용

**파일 1**: `/components/inspection/QuickInspectPanel.tsx` (수정)

```typescript
// 현재 상태에 따른 버튼 표시
const renderActionButtons = () => {
  if (assignmentStatus === 'pending') {
    return (
      <>
        <Button onClick={handleStartInspection}>점검 시작</Button>
        <Button onClick={() => setShowUnavailableModal(true)} variant="outline">
          점검불가
        </Button>
      </>
    );
  }

  if (assignmentStatus === 'unavailable') {
    return (
      <>
        <Button onClick={handleRestartInspection} className="bg-orange-500">
          재점검 시작
        </Button>
        <p className="text-sm text-gray-600">
          불가 사유: {unavailableReason.note}
        </p>
      </>
    );
  }

  // 진행중, 완료 상태는 기존 버튼
  return <ExistingButtons />;
};

const handleRestartInspection = async () => {
  // 1. 상태 검증
  if (assignmentStatus !== 'unavailable') {
    toast.error("점검불가 상태가 아닙니다");
    return;
  }

  // 2. 권한 재검증
  const canRestart = await checkPermission('canRestartInspection', {
    equipmentSerial: aedDevice.equipment_serial,
    equipmentRegion: aedDevice.region_code,
    equipmentCity: aedDevice.city_code
  });

  if (!canRestart) {
    toast.error("재점검 시작 권한이 없습니다");
    return;
  }

  // 3. 상태 업데이트: unavailable → pending
  const response = await fetch('/api/inspections/mark-unavailable', {
    method: 'DELETE',
    body: JSON.stringify({
      equipment_serial: aedDevice.equipment_serial
    })
  });

  if (!response.ok) {
    toast.error("재점검 시작 실패");
    return;
  }

  // 4. 과거 불가 기록은 inspection_assignments.notes에 보존됨
  // 5. 상태 변환 및 점검 시작
  setAssignmentStatus('pending');
  handleStartInspection();

  // 6. 감시 로그 (자동으로 기록됨)
};
```

**파일 2**: `/lib/auth/access-control.ts` (추가)

```typescript
export function canRestartInspection(context: AccessContext): boolean {
  const { userProfile, targetAssignment } = context;

  // 1. 점검불가 상태인지 확인
  if (targetAssignment.status !== 'unavailable') {
    return false;
  }

  // 2. 역할별 권한
  if (userProfile.role === 'master') return true;
  if (userProfile.role === 'emergency_center_admin') return true;

  if (userProfile.role === 'regional_emergency_center_admin') {
    return (
      targetAssignment.equipment.region_code ===
      userProfile.organization.region_code
    );
  }

  if (userProfile.role === 'local_admin') {
    return (
      targetAssignment.equipment.city_code ===
      userProfile.organization.city_code
    );
  }

  if (userProfile.role === 'temporary_inspector') {
    return targetAssignment.assigned_to === userProfile.id;
  }

  return false;
}
```

---

#### 3.3 통계에 unavailable 포함 (0단계의 연속)

**확인사항**:
- [ ] DashboardStats.unavailable이 실제로 업데이트되는가?
- [ ] 배치 작업(/api/cron/*)에서 unavailable을 제외하는가?
- [ ] BI 쿼리가 unavailable을 고려하는가?

**작업**:
```
Phase 1: dashboard-queries.ts 업데이트 (0-2단계)
├─ SQL 쿼리에 unavailable 집계 추가
├─ 테스트: SELECT COUNT(*) FROM inspection_assignments WHERE status='unavailable'
└─ Dashboard에 unavailable 카운트 표시

Phase 2: 배치 작업 검토
├─ /app/api/cron/send-improvement-alerts/route.ts 확인
├─ unavailable 상태 제외 여부 결정
└─ 필요시 쿼리 수정

Phase 3: 완료율 계산 수정
├─ 완료율 = (완료 수) / (전체 - 불가)
└─ Dashboard에 명시
```

---

#### 3.4 테스트 전략

**자동화 테스트** (Jest):
```typescript
describe("Unavailable Inspection Flow", () => {
  test("점검불가 표시 후 재점검 시작", async () => {
    // pending → [점검불가 클릭] → unavailable
    // → [재점검 시작] → pending (검증)
  });

  test("재점검 시 권한 검증", async () => {
    // regional_admin(DAE)가 인천 장비 재점검 시도 → 403
  });
});
```

**수동 테스트** (QA):
```
상태 전환 검증
├─ [ ] Pending 상태에서 "점검불가" 버튼 클릭
├─ [ ] 사유 선택 (폐기, 고장, 분실, 기타)
├─ [ ] 저장 후 inspection_assignments.status = 'unavailable'
├─ [ ] [재점검 시작] 버튼 표시됨
├─ [ ] 클릭 후 상태 = 'pending', 점검 폼 초기화
└─ [ ] 과거 불가 사유는 inspection_assignments.notes 남음

통계 검증
├─ [ ] Dashboard "점검불가" 카운트 표시
├─ [ ] 완료율 = (완료 / (전체 - 불가)) 계산 정확
└─ [ ] 배치 작업이 unavailable 제외

권한 검증
├─ [ ] Regional_admin이 타 시도 재점검 불가 (403)
├─ [ ] Temporary_inspector가 할당받은 장비만 재점검 가능
└─ [ ] Local_admin이 타 보건소 재점검 불가
```

**책임**: QA 팀
**일정**: 0-2단계 후 병렬 진행 가능

---

### 4단계: CPR 필드 타입 통일 (Priority: 🟡 중간 - 3-4시간)

#### 4.1 현황 재확인

**코드 검색 결과**:
- 스키마에 `cpr_guidebook_available` 필드: **없음**
- 코드에서 참조: **없음**
- **결론**: 이 필드는 필요 없을 수도 있음

**확인 필요**:
1. 실제로 CPR 필드를 저장하는가?
2. CPR 정보가 어느 필드에 저장되는가?
3. 엑셀 내보내기에서 CPR 항목이 있는가?

**조사 과제**:
```bash
grep -r "cpr" --include="*.ts" --include="*.tsx" --include="prisma" 2>/dev/null | head -20
```

#### 4.2 조건부 구현

**조건 1**: CPR 필드가 스키마에 없는 경우
→ 스킵 (기존 기능과 무관)

**조건 2**: CPR 필드가 boolean인 경우 (발견되면)
→ 다음과 같이 진행:

```
Phase 1: 스키마 변경
├─ cpr_guidebook_available: Boolean → String
├─ 값 정의: "yes" | "no" | "unknown" | "other"
├─ 마이그레이션: true→"yes", false→"no", NULL→NULL

Phase 2: API 스펙 업데이트
├─ Response DTO 변경
├─ Zod/Yup validation 스키마
└─ API 문서 업데이트

Phase 3: UI 수정
├─ 라디오 버튼 (yes/no/unknown)
├─ "기타" 선택 시 텍스트 입력
└─ 점검 폼에서 선택 가능

Phase 4: 엑셀 내보내기
├─ 한글 표시: "예" / "아니오" / "미확인" / "기타"
└─ 기타 사유 포함
```

**일정**: 조사 + 조건부 3-4시간

---

### 5단계: 배포 및 검증

#### 5.1 배포 순서 (시간 순)

```
Day 1 (아침):
├─ [0-1] unavailable_reason enum 수정
│  └─ Prisma migrate + 검증 (30분)
├─ [0-2] unavailable 통계 집계
│  └─ SQL 쿼리 수정 + dashboard 확인 (1시간)
└─ [1] Export 엔드포인트
   ├─ 백엔드 구현 (2시간)
   ├─ 단위 테스트 (1시간)
   └─ 권한별 검증 (수동, 병렬)

Day 2 (오후):
├─ [1 마무리] Export UI + 통합 테스트
│  └─ 프론트 구현 (1시간)
├─ [2-1] 점검 이력 수정 (스키마)
│  └─ Prisma migrate (30분)
└─ [2-2] 점검 이력 수정 (백엔드)
   └─ PUT 엔드포인트 + 동시성 제어 (2시간)

Day 3 (오전):
├─ [2-3] 점검 이력 수정 (프론트)
│  ├─ EditStep 컴포넌트 (1시간)
│  ├─ Optimistic update (1시간)
│  └─ 통합 테스트 (수동, 병렬)
└─ [3] 점검불가 UI 완성
   ├─ QuickInspectPanel 통합 (1시간)
   ├─ 권한 재검증 (30분)
   └─ QA 체크리스트 (병렬)

Day 4:
├─ [4] CPR 필드 (조사 후 필요시)
│  └─ 조사 + 조건부 구현 (3-4시간)
└─ [전체] 통합 테스트 + 버그 수정
   └─ 하루 (병렬 QA)
```

**총 소요 시간**: ~16-20시간 (개발) + 4-6시간 (QA) = **약 20-26시간**

---

#### 5.2 각 단계의 롤백 계획

| 단계 | 롤백 방법 | 위험도 |
|------|---------|--------|
| 0-1 | `prisma migrate resolve --rolled-back` | 낮음 |
| 0-2 | SQL 쿼리 원상 복구 | 낮음 |
| 1 | API 삭제, feature flag 비활성화 | 낮음 |
| 2-1 | `prisma migrate resolve` | 중간 (데이터) |
| 2-2 | API 롤백, DB 롤백 | 높음 |
| 2-3 | UI 롤백 (feature flag) | 낮음 |
| 3 | UI 롤백 (feature flag) | 낮음 |
| 4 | `prisma migrate resolve` | 중간 (데이터) |

**권장**: 각 단계마다 staging 환경에서 롤백 테스트

---

## 기술 부채 정리

### High Priority

| 항목 | 상태 | 일정 |
|------|------|------|
| unavailable_reason enum | 🔴 Critical | 0-1 (즉시) |
| unavailable 통계 미집계 | 🟠 High | 0-2 (즉시) |
| API 스펙 미정의 | 🟠 High | Phase 2-3 중 포함 |

### Medium Priority

| 항목 | 상태 | 일정 |
|------|------|------|
| 필드명 혼합 (camelCase/snake_case) | 🟡 Medium | 기술 부채로 분류 (향후) |
| modified_by 필드 추가 | 🟡 Medium | Phase 2-1 중 포함 |
| CPR 필드 타입 | 🟡 Medium | 4단계 (조사 후 필요시) |

---

## 테스트 책임 및 자동화 수준

### 자동화 테스트 (Jest/Playwright)
- 담당: 개발 팀
- 시간: 각 단계의 20%
- 우선순위: 0단계, 1단계, 2단계

### 수동 테스트 (QA)
- 담당: QA 팀
- 시간: 4-6시간 (병렬 진행)
- 환경: staging + production (선택)

### 체크리스트
- [ ] 각 단계별 QA 체크리스트 작성 완료
- [ ] 자동화 테스트 커버리지 70% 이상
- [ ] 롤백 테스트 1회 이상 실행

---

## 최종 일정표

| Phase | 내용 | 시간 | 책임 | 상태 |
|-------|------|------|------|------|
| 0 | 기술 부채 | 1.5h | 개발 | 선행 |
| 1 | Export | 3-4h | 개발 + QA | 병렬 |
| 2 | 점검 수정 | 4-6h | 개발 + QA | 순차 (DB 마이그레이션) |
| 3 | 점검불가 | 2-3h | 개발 + QA | 병렬 (0 이후) |
| 4 | CPR 필드 | 3-4h | 개발 | 조사 후 필요시 |
| 통합/QA | 검증 | 2h | QA | 최종 |
| **총합** | | **16-20h** | | |

---

## 다음 단계

1. **CPR 필드 전수 조사** (1시간)
   - 스키마 검색 확인
   - 코드 참조 위치 식별

2. **0단계 즉시 시작** (unavailable_reason enum)
   - 마이그레이션 스크립트 작성
   - 검증 쿼리 준비

3. **각 단계별 상세 설계 문서** (당일)
   - API 스펙 (OpenAPI/Zod)
   - UI 목업
   - 테스트 케이스

4. **QA 환경 준비**
   - staging 데이터 백업
   - 롤백 계획 공유

---

**문서 작성 완료**: 2025-11-06
**다음 검토**: 0단계 시작 전
**마지막 업데이트**: v2.0
