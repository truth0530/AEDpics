# AEDpics 점검 시스템 문서

이 디렉토리는 AEDpics 점검 기능의 설계, 구현, 데이터 흐름 관련 문서를 포함합니다.

## 문서 구조

### 1. 데이터 흐름 분석

#### `DATA_PROPAGATION_PHASE3_5_ANALYSIS.md` (상세)
- **대상**: 개발자, 아키텍트
- **내용**:
  - Phase 3 (PDF 보고서): 보고서 생성 모듈 분석
  - Phase 4 (대시보드): AdminFullView 데이터 흐름
  - Phase 5 (통계): 통계 API 집계 로직
  - 각 파일별 라인 번호와 함수 설명
  - 데이터베이스 쿼리 분석
  - 포함/미포함 필드 명시

**주요 섹션**:
- 3.1-3.2: PDF/Excel 생성 (report-generator.ts, export/route.ts)
- 4.1-4.3: 대시보드 (history/route.ts, AdminFullView.tsx, InspectionHistoryModal.tsx)
- 5.1-5.3: 통계 (stats/route.ts, DashboardPageClient.tsx)

#### `DATA_PROPAGATION_SUMMARY.md` (요약)
- **대상**: 빠른 참조가 필요한 개발자
- **내용**:
  - 파일 위치 및 기능 매핑표
  - 데이터 저장 구조 다이어그램
  - Phase별 데이터 흐름 플로우 차트
  - 주요 발견사항 (StorageChecklist, ManagerEducation)
  - 개선 기회와 SQL 쿼리 예제
  - 요청/응답 JSON 예시
  - 데이터 추적 체크리스트

---

## 핵심 발견사항

### StorageChecklist 데이터
```
저장: inspections.inspected_data.storage (JSON)
조회: /api/inspections/history → step_data.storage
표시: InspectionHistoryModal > ReadOnlyStorageChecklistStep
내보내기: ❌ Phase 3 미포함
통계: ❌ Phase 5 미포함
```

### ManagerEducation 데이터
```
저장: inspections.inspected_data.documentation (JSON)
조회: /api/inspections/history → step_data.documentation
표시: InspectionHistoryModal > ReadOnlyInspectionSummaryStep
내보내기: ❌ Phase 3 미포함
통계: ❌ Phase 5 미포함
```

### 데이터 전파 경로
```
Phase 3 (Export)
├─ 기본 상태: ✅
├─ StorageChecklist: ❌
└─ ManagerEducation: ❌

Phase 4 (Dashboard)
├─ 기본 상태: ✅
├─ StorageChecklist: ✅ (step_data.storage)
└─ ManagerEducation: ✅ (step_data.documentation)

Phase 5 (Statistics)
├─ overall_status: ✅
├─ inspection_type: ✅
├─ StorageChecklist: ❌
└─ ManagerEducation: ❌
```

---

## 파일 위치 매퍼

| 기능 | 파일 | 경로 |
|-----|------|------|
| PDF/Excel 생성 | report-generator.ts | lib/ |
| Excel 내보내기 API | export/route.ts | app/api/inspections/ |
| 점검 이력 조회 API | history/route.ts | app/api/inspections/ |
| 대시보드 UI | AdminFullView.tsx | components/inspection/ |
| 이력 상세 모달 | InspectionHistoryModal.tsx | components/inspection/ |
| 보관함 표시 | ReadOnlyStorageChecklistStep.tsx | components/inspection/steps/ |
| 완료 정보 표시 | ReadOnlyInspectionSummaryStep.tsx | components/inspection/steps/ |
| 통계 API | stats/route.ts | app/api/inspections/ |

---

## 데이터베이스 스키마

### inspections 테이블 주요 필드

**기본 정보**
- id, equipment_serial, inspector_id
- inspection_date, inspection_type

**상태 필드** (5가지)
- visual_status
- battery_status
- pad_status
- operation_status
- overall_status

**4단계 데이터** (JSON)
- inspected_data
  - basicInfo
  - deviceInfo
  - storage (보관함)
  - documentation (완료 정보)

**메모/첨부**
- notes
- issues_found[]
- photos[]

**기타**
- inspection_latitude, inspection_longitude
- created_at, updated_at, completed_at
- approval_status, approved_by_id, rejected_reason

---

## API 엔드포인트

### Phase 3
- `POST /api/inspections/export`
  - 쿼리: regionCodes[], cityCodes[], limit
  - 응답: Excel 파일 (binary)

### Phase 4
- `GET /api/inspections/history`
  - 쿼리: equipment_serial?, hours?, mode?
  - 응답: InspectionHistory[]

### Phase 5
- `GET /api/inspections/stats`
  - 쿼리: period? ('7d'|'30d'|'90d'|'1y'), groupBy?
  - 응답: { overview, byStatus, byType, trend, byRegion, topInspectors }

---

## 개선 기회

### 1. Phase 3 (Export) 강화
- [ ] StorageChecklist 데이터 포함
- [ ] ManagerEducation 정보 포함
- [ ] 보관함 형태별 별도 시트 추가

### 2. Phase 5 (Statistics) 확장
- [ ] 보관함 형태별 분포 집계
- [ ] 체크리스트 완성도 계산
- [ ] 점검자별 교육 이수율 통계
- [ ] 장비별 점검 빈도 분석

### 3. 데이터베이스 최적화
- [ ] step_data JSON 필드 인덱싱
- [ ] 자주 사용되는 쿼리 최적화
- [ ] 통계용 구체화 뷰(Materialized View) 생성

---

## 관련 문서

- [점검 기능 현황](../../CLAUDE.md#phase-5-기능-구현) - CLAUDE.md의 Phase 5 섹션
- [시스템 아키텍처](../reference/architecture-overview.md)
- [AED 데이터 스키마](../reference/aed-data-schema.md)
- [점검 기능 상세 현황](../../CLAUDE.md#점검-기능-상세-현황-2025-10-28)

---

## 데이터 흐름 빠른 참조

### 사용자가 "점검 완료" 클릭 시
```
User → UI (점검 폼 5단계)
    → API (POST /inspection/save)
    → DB (inspections 테이블 저장)
       └─ inspected_data: { basicInfo, deviceInfo, storage, documentation }
```

### 관리자가 "점검 이력 조회" 클릭 시
```
Admin → AdminFullView
     → getInspectionHistory()
     → GET /api/inspections/history
     → DB (SELECT with inspected_data)
     → InspectionHistoryModal
        └─ 4단계 탭 표시
           ├─ storage 표시
           └─ documentation 표시
```

### 대시보드에서 "통계" 조회 시
```
Dashboard → GET /api/inspections/stats
         → DB (GROUP BY overall_status, inspection_type, ...)
         → Charts (byStatus, byType, trend, byRegion)
         
⚠️ 주의: StorageChecklist, ManagerEducation 데이터는 
포함되지 않음 (별도 쿼리 필요)
```

---

## 체크리스트: 새 기능 추가 시

### Excel 내보내기에 새 필드 추가
- [ ] inspections 테이블에 필드 확인
- [ ] app/api/inspections/export/route.ts 수정 (라인 305-327)
- [ ] ReportGenerator.generateExcel() 수정 (라인 144-159)
- [ ] Excel 헤더 추가

### 통계 API에 새 집계 추가
- [ ] app/api/inspections/stats/route.ts 수정
- [ ] Prisma 쿼리 또는 raw SQL 추가
- [ ] 응답 스키마 수정 (라인 204-239)
- [ ] 대시보드 컴포넌트에서 표시

### 대시보드에 새 모달 추가
- [ ] InspectionHistory 인터페이스 확인 (session-utils.ts 라인 208-235)
- [ ] 새 ReadOnly 컴포넌트 생성 (components/inspection/steps/)
- [ ] InspectionHistoryModal에 탭 추가 (라인 23-28)

---

## 문서 유지보수

이 문서는 다음 파일 변경 시 업데이트 필요:
- `lib/report-generator.ts` (Phase 3)
- `app/api/inspections/export/route.ts` (Phase 3)
- `app/api/inspections/history/route.ts` (Phase 4)
- `components/inspection/AdminFullView.tsx` (Phase 4 UI)
- `app/api/inspections/stats/route.ts` (Phase 5)
- `prisma/schema.prisma` (스키마 변경 시)

마지막 업데이트: 2025-11-09
