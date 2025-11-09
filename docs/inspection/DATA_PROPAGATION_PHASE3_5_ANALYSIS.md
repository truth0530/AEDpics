# AEDpics 점검 시스템 - 데이터 흐름 분석 (Phase 3-5)

## 개요
이 문서는 AEDpics 점검 시스템의 데이터 흐름을 Phase 3 (PDF 보고서), Phase 4 (관리자 대시보드), Phase 5 (통계)로 나누어 분석합니다.

---

## PHASE 3: PDF 보고서 생성 (Report Generation)

### 3.1 보고서 생성 모듈
**파일**: `/Users/kwangsunglee/Projects/AEDpics/lib/report-generator.ts`

#### 주요 클래스
- `ReportGenerator` (lines 37-236)
  - `generatePDF(data: ReportData)` (lines 39-112)
  - `generateExcel(data: ReportData)` (lines 115-206)
  - `generateMonthlyReport(year, month, devices)` (lines 209-235)

#### ReportData 인터페이스 (lines 23-35)
```typescript
export interface ReportData {
  title: string;
  date: Date;
  summary: {
    totalDevices: number;
    inspected: number;
    pending: number;
    urgent: number;
  };
  devices: Array<Record<string, unknown>>;
  inspector?: string;
  organization?: string;
}
```

#### 포함되는 장비 필드 (Excel export - lines 144-159)
- id, name, location, priority, lastCheck
- batteryExpiry, padExpiry
- modelName, manufacturer, serialNumber
- installationOrg, installDate, manager, contact, notes

**중요 발견**: 
- StorageChecklist 데이터: **미포함** ❌
- ManagerEducation 데이터: **미포함** ❌
- 점검 상태 필드만 포함 (visual_status, battery_status, pad_status 등)

### 3.2 Excel 내보내기 API
**파일**: `/Users/kwangsunglee/Projects/AEDpics/app/api/inspections/export/route.ts`

#### 엔드포인트
- **POST** `/api/inspections/export`
- v5.3 Equipment-Centric Pattern 사용

#### 데이터 흐름 (lines 305-327)
```typescript
const excelData = inspections.map(inspection => ({
  '점검ID': inspection.id,
  '장비번호': inspection.equipment_serial,
  '설치기관': inspection.aed_data?.installation_institution,
  '시도': inspection.aed_data?.sido,
  '시군구': inspection.aed_data?.gugun,
  '점검일': inspection.inspection_date,
  '점검자': inspection.user_profiles?.full_name,
  '시각상태': inspection.visual_status,
  '배터리상태': inspection.battery_status,
  '패드상태': inspection.pad_status,
  '작동상태': inspection.operation_status,
  '종합상태': inspection.overall_status,
  '발견사항': inspection.issues_found?.join(', '),
  '비고': inspection.notes
}));
```

**포함되는 필드**:
- 기본 정보: id, equipment_serial, inspection_date, inspector_name/email
- 상태 필드: visual_status, battery_status, pad_status, operation_status, overall_status
- 메모/사진: notes, issues_found

**미포함 필드** ❌:
- StorageChecklist: 보관함 형태, 체크리스트 항목
- ManagerEducation: 관리자 교육 정보
- step_data: 4단계 전체 데이터

#### 데이터베이스 쿼리 (lines 278-293)
```typescript
let inspections = await prisma.inspections.findMany({
  where: {...},
  include: {
    aed_data: true,
    user_profiles: { select: { full_name: true, email: true } }
  },
  take: finalLimit,
  orderBy: { inspection_date: 'desc' }
});
```

**주의**: `step_data` 또는 `inspected_data` 필드를 명시적으로 select하지 않음

---

## PHASE 4: 관리자 대시보드 (AdminFullView Dashboard)

### 4.1 점검 이력 조회 API
**파일**: `/Users/kwangsunglee/Projects/AEDpics/app/api/inspections/history/route.ts`

#### 엔드포인트
- **GET** `/api/inspections/history`
- 쿼리 파라미터: `equipment_serial`, `hours`, `mode` ('address'|'jurisdiction')

#### 반환 데이터 구조 (lines 225-260)
```typescript
{
  id: inspection.id,
  equipment_serial: inspection.equipment_serial,
  inspector_name: inspection.user_profiles?.full_name,
  inspection_date: inspection.inspection_date,
  visual_status: inspection.visual_status,
  battery_status: inspection.battery_status,
  pad_status: inspection.pad_status,
  operation_status: inspection.operation_status,
  overall_status: inspection.overall_status,
  notes: inspection.notes,
  issues_found: inspection.issues_found,
  photos: inspection.photos,
  inspection_latitude: inspection.inspection_latitude,
  inspection_longitude: inspection.inspection_longitude,
  step_data: inspection.inspected_data || {},  // inspected_data를 step_data로 매핑
  original_data: inspection.original_data || {},
  aed_data: { ... }
}
```

#### 데이터베이스 쿼리 (lines 158-181)
```typescript
const inspections = await prisma.inspections.findMany({
  where,
  include: {
    user_profiles: { select: { full_name: true, email: true } },
    aed_data: {
      select: {
        installation_institution: true,
        sido: true,
        gugun: true,
        installation_address: true,
        last_inspection_date: true,
        jurisdiction_health_center: true
      }
    }
  },
  orderBy: { inspection_date: 'desc' }
});
```

**포함되는 데이터**:
- ✅ `inspected_data` → `step_data`로 매핑됨 (Line 248)
- ✅ 4단계 전체 데이터 포함 가능 (하위 항목: basicInfo, deviceInfo, storage, documentation)

### 4.2 InspectionHistoryModal 표시 구조
**파일**: `/Users/kwangsunglee/Projects/AEDpics/components/inspection/InspectionHistoryModal.tsx`

#### 4단계 탭 구조 (lines 23-28)
```typescript
const STEP_TABS = [
  { id: 0, label: '1단계: 기본정보', component: ReadOnlyBasicInfoStep },
  { id: 1, label: '2단계: 장비정보', component: ReadOnlyDeviceInfoStep },
  { id: 2, label: '3단계: 보관함', component: ReadOnlyStorageChecklistStep },
  { id: 3, label: '4단계: 점검요약', component: ReadOnlyInspectionSummaryStep },
];
```

#### 3단계: ReadOnlyStorageChecklistStep
**파일**: `/Users/kwangsunglee/Projects/AEDpics/components/inspection/steps/ReadOnlyStorageChecklistStep.tsx`

**데이터 소스** (line 16):
```typescript
const storage = stepData.storage || {};
```

**표시되는 필드** (lines 94-128):
- storage.storage_type (보안 캐비넷, 벽면 설치형, 없음)
- storage.checklist_items (각 항목의 label, status)
- storage.notes
- storage.photos (첨부 사진 개수)

**주의**: 실제 데이터는 `stepData.storage` 내에만 존재, 상위 inspection 객체에는 없음

#### 4단계: ReadOnlyInspectionSummaryStep  
**파일**: `/Users/kwangsunglee/Projects/AEDpics/components/inspection/steps/ReadOnlyInspectionSummaryStep.tsx`

**데이터 소스** (line 16):
```typescript
const documentation = stepData.documentation || {};
```

**표시되는 필드** (lines 74-201):
- inspection 객체의 기본 정보
- inspection.visual_status, battery_status, pad_status, operation_status, overall_status
- inspection.issues_found
- inspection.inspection_latitude, inspection.longitude
- inspection.notes
- inspection.photos
- documentation.completed_time (점검 완료 시간)

**주의**: documentation은 stepData 내부에만 존재

### 4.3 AdminFullView 데이터 흐름
**파일**: `/Users/kwangsunglee/Projects/AEDpics/components/inspection/AdminFullView.tsx`

#### 점검 이력 로드 (lines 131-145)
```typescript
useEffect(() => {
  async function loadInspectionHistory() {
    if (viewMode === 'completed') {
      const mode = user?.role === 'local_admin' ? filterMode : 'address';
      const history = await getInspectionHistory(undefined, 720, mode); // 최근 30일
      setInspectionHistoryList(history);
    }
  }
  loadInspectionHistory();
}, [viewMode, filterMode, user?.role]);
```

#### 점검 이력 보기 (lines 262-277)
```typescript
const handleViewInspectionHistory = async (equipmentSerial: string) => {
  const mode = user?.role === 'local_admin' ? filterMode : 'address';
  const history = await getInspectionHistory(equipmentSerial, 24, mode);
  if (history && history.length > 0) {
    setSelectedInspection(history[0]); // 가장 최근 항목 선택
    setShowHistoryModal(true);
  }
};
```

**데이터 흐름**:
1. `AdminFullView` → `getInspectionHistory()` (session-utils.ts)
2. → `/api/inspections/history` API 호출
3. → `InspectionHistory[]` 반환
4. → `InspectionHistoryModal`에 전달
5. → `ReadOnlyStorageChecklistStep`, `ReadOnlyInspectionSummaryStep` 렌더링

---

## PHASE 5: 통계 대시보드 (Statistics Dashboard)

### 5.1 점검 통계 API
**파일**: `/Users/kwangsunglee/Projects/AEDpics/app/api/inspections/stats/route.ts`

#### 엔드포인트
- **GET** `/api/inspections/stats`
- 쿼리 파라미터: `period` ('7d'|'30d'|'90d'|'1y'), `groupBy` ('day'|'week'|'month')

#### 집계 데이터 (lines 79-240)

**1. 전체 점검 통계** (lines 80-103)
```typescript
const totalInspections = await prisma.inspections.count({
  where: { inspection_date: { gte: startDate } }
});

const completedInspections = await prisma.inspections.count({
  where: {
    inspection_date: { gte: startDate },
    completed_at: { not: null }
  }
});
```

**2. 상태별 분포** (lines 106-114)
```typescript
const inspectionsByStatus = await prisma.inspections.groupBy({
  by: ['overall_status'],
  where: { inspection_date: { gte: startDate } },
  _count: true
});
```

**쿼리되는 필드**: `overall_status`

**3. 검사 유형별 분포** (lines 117-125)
```typescript
const inspectionsByType = await prisma.inspections.groupBy({
  by: ['inspection_type'],
  where: { inspection_date: { gte: startDate } },
  _count: true
});
```

**쿼리되는 필드**: `inspection_type`

**4. 기간별 추이** (lines 128-139)
```typescript
SELECT DATE(inspection_date) as date, COUNT(*) as count
FROM aedpics.inspections
WHERE inspection_date >= ${startDate}
GROUP BY DATE(inspection_date)
```

**5. 지역별 점검 현황** (lines 142-155)
```typescript
SELECT ad.sido, COUNT(i.id) as count
FROM aedpics.inspections i
JOIN aedpics.aed_data ad ON i.equipment_serial = ad.equipment_serial
WHERE i.inspection_date >= ${startDate}
GROUP BY ad.sido
```

**6. 점검자별 실적** (lines 158-178)
```typescript
SELECT
  i.inspector_id, up.full_name, up.email,
  COUNT(i.id) as count,
  AVG(EXTRACT(EPOCH FROM (i.completed_at - i.inspection_date))) as avg_duration
FROM aedpics.inspections i
LEFT JOIN aedpics.user_profiles up ON i.inspector_id = up.id
WHERE i.inspection_date >= ${startDate} AND i.completed_at IS NOT NULL
GROUP BY i.inspector_id, up.full_name, up.email
```

#### 반환 데이터 구조 (lines 204-239)
```typescript
{
  overview: {
    total, completed, inProgress, today, avgDuration
  },
  byStatus: { [status]: count },
  byType: { [type]: count },
  trend: [{ date, count }],
  byRegion: [{ sido, count }],
  topInspectors: [{ id, name, email, count, avgDuration }],
  period, groupBy, startDate, endDate
}
```

**포함되는 필드**:
- ✅ overall_status (상태별 분포)
- ✅ inspection_type (유형별 분포)
- ✅ inspection_date (기간별 추이)
- ✅ completed_at (점검 완료 시간, 소요 시간 계산)
- ✅ inspector_id (점검자별 실적)

**미포함 필드** ❌:
- StorageChecklist: 체크리스트 항목, 상태
- ManagerEducation: 교육 이수 여부, 점검자 교육 내용
- step_data / inspected_data: 4단계 상세 데이터

### 5.2 대시보드 컴포넌트
**파일**: `/Users/kwangsunglee/Projects/AEDpics/app/(authenticated)/dashboard/DashboardPageClient.tsx`

**현재 상태**: 역할별 대시보드 라우팅 (lines 84-100)
- admin-full: `AdminFullDashboard`
- local-full: `LocalFullDashboard`
- read-only: `ReadOnlyDashboard`
- inspector-only: `InspectorOnlyDashboard`

**참고**: 실제 통계 데이터 집계 구현은 각 역할별 대시보드 컴포넌트에서 수행됨

### 5.3 성능 대시보드
**파일**: `/Users/kwangsunglee/Projects/AEDpics/app/(authenticated)/performance/PerformanceDashboard.tsx`

**현재 상태**: 브라우저 Performance API 기반 메트릭만 표시
- Page Load Time
- DOM Content Loaded
- Time to Interactive

**미구현**: 점검 데이터 기반 성능 통계

---

## 데이터 흐름 요약표

### Prisma inspections 테이블 필드 (Line 256-286)
```
기본 정보:
- id, aed_data_id, equipment_serial, inspector_id
- inspection_date, inspection_type

상태 필드:
- visual_status, battery_status, pad_status, operation_status, overall_status

메모/첨부:
- notes, issues_found[], photos[]

위치 정보:
- inspection_latitude, inspection_longitude

4단계 데이터:
- inspected_data (JSON) ← step_data로 사용됨
- original_data (JSON) ← e-gen 메타데이터
- registered_data (JSON)
- issues (JSON)

승인 정보:
- approval_status, approved_by_id, approved_at, rejection_reason

시간 정보:
- created_at, updated_at, completed_at
```

### 각 Phase별 데이터 포함 현황

| 필드 | Phase 3 (PDF) | Phase 4 (Dashboard) | Phase 5 (Stats) |
|-----|---|---|---|
| overall_status | ✅ | ✅ | ✅ |
| visual_status | ✅ | ✅ | ❌ |
| battery_status | ✅ | ✅ | ❌ |
| pad_status | ✅ | ✅ | ❌ |
| operation_status | ✅ | ✅ | ❌ |
| issues_found | ✅ | ✅ | ❌ |
| notes | ✅ | ✅ | ❌ |
| photos | ✅ | ✅ | ❌ |
| **StorageChecklist** | ❌ | ⚠️ (stepData만) | ❌ |
| **ManagerEducation** | ❌ | ⚠️ (stepData만) | ❌ |
| step_data (inspected_data) | ❌ | ✅ | ❌ |
| inspection_date | ✅ | ✅ | ✅ |
| completed_at | ❌ | ✅ | ✅ |
| inspector_id | ✅ | ✅ | ✅ |

---

## 핵심 발견사항

### 1. StorageChecklist 데이터 처리 ⚠️
- **저장 위치**: `inspections.inspected_data.storage` (JSON)
- **조회**: `getInspectionHistory()` → `step_data.storage`로 매핑
- **표시**: `InspectionHistoryModal` → `ReadOnlyStorageChecklistStep`에서만 표시
- **Excel 내보내기**: 미포함 (export API에서 select 안 함)
- **통계**: 미포함 (집계 쿼리에서 사용 안 함)

### 2. ManagerEducation 데이터 처리 ⚠️
- **저장 위치**: `inspections.inspected_data.documentation` (JSON)
- **조회**: `getInspectionHistory()` → `step_data`로 매핑
- **표시**: `InspectionHistoryModal` → `ReadOnlyInspectionSummaryStep`에서만 표시
- **Excel 내보내기**: 미포함
- **통계**: 미포함
- **참고**: `documentation.completed_time` 필드 포함

### 3. Inspection History API의 중요성
- `/api/inspections/history` 엔드포인트가 `step_data` 매핑의 유일한 통로
- `inspected_data`를 `step_data`로 이름 변경 (line 248)
- 4단계 전체 데이터를 한 번에 로드 가능

### 4. 데이터 마이그레이션 포인트
- `inspected_data` 필드: 4단계 전체 JSON 데이터 저장
  - `basicInfo`: 점검 기본 정보
  - `deviceInfo`: 장비 정보 (제조사, 모델, 배터리/패드 유효기간)
  - `storage`: 보관함 정보 (체크리스트 항목, 상태)
  - `documentation`: 완료 정보 (완료 시간 등)

### 5. 데이터베이스 쿼리 최적화 기회
- Phase 3 (export): `step_data` 필드를 select하면 StorageChecklist 포함 가능
- Phase 5 (stats): 별도 집계 쿼리 필요 (현재는 기본 상태만 집계)

---

## 결론

**데이터 흐름 경로**:
```
저장:           Inspection + step_data (JSON)
    ↓
조회 (Phase 4):  /api/inspections/history → InspectionHistory[] → InspectionHistoryModal
    ↓                                      (step_data 매핑)
표시:           ReadOnlyStorageChecklistStep + ReadOnlyInspectionSummaryStep
    ↓
내보내기 (Phase 3): /api/inspections/export (step_data 미포함)
통계 (Phase 5):     /api/inspections/stats (집계만, 상세 데이터 미포함)
```

**다음 개선 영역**:
1. Phase 3: Excel 내보내기에 StorageChecklist 데이터 추가 필요
2. Phase 5: 통계 API에 StorageChecklist 관련 집계 추가 필요
3. Phase 5: 보관함 형태별 분포, 체크리스트 항목별 완성도 등 추가 집계 고려

