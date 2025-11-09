# AEDpics 점검 데이터 전파 분석 - 요약본

## 빠른 참조표

### 파일 위치 및 기능

| Phase | 파일명 | 경로 | 주요 기능 | 라인 |
|-------|--------|------|---------|------|
| 3 | report-generator.ts | `lib/` | PDF/Excel 생성 | 37-236 |
| 3 | export/route.ts | `app/api/inspections/` | Excel 데이터 내보내기 | 278-327 |
| 4 | history/route.ts | `app/api/inspections/` | 점검 이력 조회 API | 158-260 |
| 4 | AdminFullView.tsx | `components/inspection/` | 대시보드 UI | 262-277 |
| 4 | InspectionHistoryModal.tsx | `components/inspection/` | 이력 상세 모달 | 23-150 |
| 4 | ReadOnlyStorageChecklistStep.tsx | `components/inspection/steps/` | 보관함 표시 | 15-131 |
| 4 | ReadOnlyInspectionSummaryStep.tsx | `components/inspection/steps/` | 완료 정보 표시 | 15-204 |
| 5 | stats/route.ts | `app/api/inspections/` | 통계 집계 API | 79-240 |

---

## 데이터 저장 구조

### Prisma inspections 테이블
```
┌─────────────────────────────────────────┐
│        inspections (테이블)              │
├─────────────────────────────────────────┤
│ 기본 정보                                 │
│  • id, equipment_serial, inspector_id   │
│  • inspection_date, inspection_type     │
│                                         │
│ 상태 필드                                 │
│  • visual_status, battery_status        │
│  • pad_status, operation_status         │
│  • overall_status                       │
│                                         │
│ 메모/첨부                                 │
│  • notes, issues_found[], photos[]      │
│                                         │
│ JSON 데이터 (4단계 전체)                   │
│  • inspected_data (JSON)                │
│    └── basicInfo                        │
│    └── deviceInfo                       │
│    └── storage (보관함)                  │
│    └── documentation (완료 정보)         │
│                                         │
│ 승인 정보                                 │
│  • approval_status, approved_by_id      │
│  • approved_at, rejection_reason        │
│                                         │
│ 시간 정보                                 │
│  • created_at, updated_at, completed_at│
└─────────────────────────────────────────┘
```

---

## Phase별 데이터 흐름

### PHASE 3: PDF 내보내기

```
사용자가 "보고서 다운로드" 클릭
    ↓
export/route.ts (POST)
    ↓
SELECT from inspections WHERE ... (aed_data 포함)
    ↓
Excel 생성:
  • 점검ID, 장비번호, 설치기관, 지역
  • 시각상태, 배터리상태, 패드상태, 작동상태, 종합상태
  • 발견사항, 비고
    ↓
.xlsx 파일 다운로드
```

**미포함 데이터**:
- StorageChecklist (보관함 체크리스트)
- ManagerEducation (관리자 교육 정보)
- step_data 전체 (상세 점검 데이터)

**이유**: `inspected_data` 필드를 select하지 않음 (line 278-293)

---

### PHASE 4: 대시보드 (AdminFullView)

```
viewMode === 'completed' 또는 사용자가 장비 클릭
    ↓
AdminFullView.handleViewInspectionHistory()
    ↓
getInspectionHistory() [session-utils.ts]
    ↓
fetch /api/inspections/history?equipment_serial=...&mode=address
    ↓
history/route.ts (GET)
    ↓
SELECT from inspections WITH aed_data
  + inspected_data (JSON) ← 핵심!
    ↓
응답 데이터:
  {
    id, equipment_serial, inspector_name,
    visual_status, battery_status, pad_status,
    operation_status, overall_status,
    notes, issues_found, photos,
    inspection_latitude, inspection_longitude,
    step_data: { ← inspected_data를 이름 변경
      basicInfo: {...},
      deviceInfo: {...},
      storage: {...},
      documentation: {...}
    },
    aed_data: {...}
  }
    ↓
InspectionHistoryModal 렌더링
    ↓
4단계 탭:
  1단계: BasicInfo
  2단계: DeviceInfo
  3단계: ReadOnlyStorageChecklistStep
        └─ stepData.storage 사용
  4단계: ReadOnlyInspectionSummaryStep
        └─ inspection + stepData.documentation 사용
```

**포함되는 데이터**: ✅
- StorageChecklist (step_data.storage)
- ManagerEducation (step_data.documentation)
- 4단계 전체 상세 데이터

---

### PHASE 5: 통계 (Statistics)

```
사용자가 대시보드 접근
    ↓
fetch /api/inspections/stats?period=30d
    ↓
stats/route.ts (GET)
    ↓
데이터 집계:

1. 기본 통계
   SELECT COUNT(*) FROM inspections WHERE inspection_date >= startDate
   
2. 상태별 분포
   GROUP BY overall_status
   
3. 유형별 분포
   GROUP BY inspection_type
   
4. 기간별 추이
   GROUP BY DATE(inspection_date)
   
5. 지역별 현황
   JOIN aed_data ON equipment_serial
   GROUP BY ad.sido
   
6. 점검자별 실적
   GROUP BY inspector_id
   AVG(completed_at - inspection_date)
    ↓
응답:
{
  overview: { total, completed, inProgress, today, avgDuration },
  byStatus: { [status]: count },
  byType: { [type]: count },
  trend: [{ date, count }],
  byRegion: [{ sido, count }],
  topInspectors: [{ name, count, avgDuration }]
}
    ↓
대시보드 컴포넌트에서 시각화
```

**포함되는 데이터**: ⚠️ 제한적
- overall_status (상태별 분포)
- inspection_type (유형별 분포)
- inspection_date (기간별 추이)
- completed_at (소요 시간 계산)
- inspector_id (점검자 실적)

**미포함 데이터**: ❌
- StorageChecklist (보관함 형태, 체크리스트 항목별 분석 불가)
- ManagerEducation (점검자별 교육 여부 분석 불가)
- step_data 상세 필드

---

## 핵심 데이터 흐름 다이어그램

```
DATABASE (inspections)
    │
    ├─────────────────┬──────────────────┬─────────────────┐
    │                 │                  │                 │
    │                 │                  │                 │
    ▼                 ▼                  ▼                 ▼
 
Phase 3         Phase 4 API         Phase 4 UI       Phase 5
Export API      history API         Dashboard        Stats API
    │               │                    │                │
    │               │                    │                │
SELECT:         SELECT:             UI Display       SELECT:
• Basic         • Basic             • Modal          • Count
  fields        • status            • 4 Tabs         • Group By
• Status        • Storage ✅        • Storage ✅     • Aggregate
• Notes         • Documentation ✅  • Education ✅
                • step_data ✅

OUTPUT:         OUTPUT:             OUTPUT:          OUTPUT:
.xlsx           InspectionHistory   ReadOnly         { byStatus,
                []                  Components       byType,
                                                     trend,
                                                     byRegion }
```

---

## 주요 발견사항

### 1️⃣ StorageChecklist 데이터 위치
- **저장**: `inspections.inspected_data.storage` (JSON 필드)
- **조회 경로**:
  - Phase 4 Only: `/api/inspections/history` → `step_data.storage`
- **표시 위치**: `InspectionHistoryModal` > `ReadOnlyStorageChecklistStep`
- **내보내기**: Phase 3 export API에 미포함 ❌
- **통계**: Phase 5 stats API에 미포함 ❌

### 2️⃣ ManagerEducation 데이터 위치
- **저장**: `inspections.inspected_data.documentation` (JSON 필드)
- **조회 경로**:
  - Phase 4 Only: `/api/inspections/history` → `step_data.documentation`
- **표시 위치**: `InspectionHistoryModal` > `ReadOnlyInspectionSummaryStep`
- **내보내기**: Phase 3 export API에 미포함 ❌
- **통계**: Phase 5 stats API에 미포함 ❌

### 3️⃣ inspected_data → step_data 매핑
- `/api/inspections/history` (line 248)에서만 이루어짐
- Phase 3, Phase 5는 직접 접근 불가
- 4단계 전체 데이터를 한 번에 로드할 수 있는 유일한 통로

### 4️⃣ 데이터베이스 쿼리 차이
```
Phase 3:
  SELECT visual_status, battery_status, pad_status, ... 
  FROM inspections
  WHERE ... LIMIT 1000
  
Phase 4:
  SELECT *, inspected_data  ← JSON 전체 포함
  FROM inspections
  WHERE ...
  
Phase 5:
  GROUP BY overall_status, inspection_type
  COUNT(*), AVG(duration)
```

---

## 개선 기회

### Phase 3 (Export)
❌ 현재: StorageChecklist 미포함
✅ 개선: inspected_data를 select하여 storage 정보 포함
```typescript
// 추가 필요
const storageData = inspection.inspected_data?.storage || {};
'보관함형태': storageData.storage_type,
'보관함체크': storageData.checklist_items?.toString(),
```

### Phase 5 (Statistics)
❌ 현재: 기본 상태 집계만 지원
✅ 개선 1: 보관함 형태별 분포
```typescript
SELECT 
  JSON_EXTRACT(inspected_data, '$.storage.storage_type') as storage_type,
  COUNT(*) as count
FROM inspections
GROUP BY storage_type
```

✅ 개선 2: 체크리스트 완성도
```typescript
SELECT 
  equipment_serial,
  JSON_ARRAY_LENGTH(
    JSON_EXTRACT(inspected_data, '$.storage.checklist_items')
  ) as checklist_count,
  SUM(CASE WHEN ... THEN 1 ELSE 0 END) as completed_count
```

✅ 개선 3: 교육 이수율
```typescript
SELECT 
  inspector_id,
  COUNT(*) as total_inspections,
  SUM(CASE WHEN 
    JSON_EXTRACT(inspected_data, '$.documentation.manager_educated') = true 
    THEN 1 ELSE 0 END) as educated_count
FROM inspections
GROUP BY inspector_id
```

---

## 요청/응답 예시

### Phase 4: /api/inspections/history 응답
```json
{
  "success": true,
  "count": 1,
  "inspections": [
    {
      "id": "uuid",
      "equipment_serial": "AED-001",
      "inspection_date": "2025-11-09T10:30:00Z",
      "visual_status": "good",
      "battery_status": "good",
      "pad_status": "warning",
      "operation_status": "good",
      "overall_status": "warning",
      "notes": "배터리 만료일 임박",
      "issues_found": ["battery_expiring_soon"],
      "photos": ["url1", "url2"],
      "step_data": {
        "basicInfo": { ... },
        "deviceInfo": { 
          "manufacturer": "Philips",
          "model_name": "HeartStart OnSite",
          "battery_expiry_date": "2025-12-15"
        },
        "storage": {
          "storage_type": "cabinet",
          "checklist_items": [
            { "label": "청결 상태", "value": "good" },
            { "label": "설명서 구비", "value": "warning" }
          ]
        },
        "documentation": {
          "completed_time": "2025-11-09T10:45:00Z"
        }
      },
      "aed_data": { ... }
    }
  ]
}
```

### Phase 3: Excel 컬럼
```
점검ID | 장비번호 | 시도 | 시군구 | 설치기관 | 모델 | 제조사 | 점검일 | 점검자 | 시각상태 | 배터리상태 | 패드상태 | 작동상태 | 종합상태 | 발견사항 | 비고
```

### Phase 5: /api/inspections/stats 응답
```json
{
  "overview": {
    "total": 1250,
    "completed": 1150,
    "inProgress": 50,
    "today": 45,
    "avgDuration": 15
  },
  "byStatus": {
    "good": 920,
    "warning": 200,
    "bad": 30
  },
  "byType": {
    "monthly": 1100,
    "special": 120,
    "emergency": 30
  },
  "byRegion": [
    { "sido": "서울특별시", "count": 250 },
    { "sido": "경기도", "count": 300 }
  ]
}
```

---

## 체크리스트: 데이터 추적

다음 표를 사용하여 특정 필드가 어떤 Phase를 통해 전파되는지 확인하세요.

```
필드명 → Phase 3 → Phase 4 → Phase 5
================================================
overall_status        YES      YES      YES (groupBy)
visual_status         YES      YES      NO
battery_status        YES      YES      NO
pad_status            YES      YES      NO
operation_status      YES      YES      NO
issues_found          YES      YES      NO
notes                 YES      YES      NO
photos                YES      YES      NO
inspection_date       YES      YES      YES (trend)
completed_at          NO       YES      YES (duration)
inspector_id          YES      YES      YES (groupBy)
StorageChecklist      NO       YES      NO
ManagerEducation      NO       YES      NO
step_data             NO       YES      NO
```

