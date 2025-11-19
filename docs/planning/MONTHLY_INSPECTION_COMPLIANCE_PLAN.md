# 매월 1회 점검 여부 항목 추가 계획서

**작성일**: 2025-11-19
**상태**: 보류 (검토 완료, 구현 대기)
**우선순위**: 중간

---

## 1. 요구사항 요약

### 1.1 추가 항목
```
항목명: 매월 1회 이상 점검 후 시군구에 통보 했는지 여부
위치: 현장점검 모달 Step 3 (ManagerEducationStep)

선택지:
  - 매월 1회 점검 ✓
  - 매월 1회 미점검
    └─ 미점검 선택 시: 미점검 사유 작성 (필수)
```

### 1.2 법적 근거
- 응급의료에 관한 법률 시행규칙 제5조의2
- 설치자/관리자는 매월 1회 이상 작동 상태 점검 의무
- 시군구(보건소)에 점검 결과 통보 의무

---

## 2. 최종 권장 구현 방안

### 2.1 위치: Step 3 확장

**현재**: "관리책임자 교육"
**변경 후**: "관리책임자 교육 및 법적 의무 확인"

**구조**:
```
Step 3: ManagerEducationStep
├─ Section 1: 관리책임자 교육 이수 현황 (기존)
│  ├─ education_status
│  ├─ not_completed_reason
│  ├─ education_other_text
│  └─ message_to_mohw
│
└─ Section 2: 매월 1회 점검 의무 (신규)
   ├─ monthly_inspection_done (boolean) [필수]
   │  └─ true: 매월 1회 점검
   │  └─ false: 매월 1회 미점검
   │
   └─ monthly_inspection_skipped_reason (string) [조건부 필수]
      └─ 미점검 시 사유 입력
```

### 2.2 데이터 저장 구조

**타입 정의**:
```typescript
interface MonthlyInspectionCompliance {
  monthly_inspection_done: boolean;           // 매월 점검 여부
  monthly_inspection_skipped_reason?: string; // 미점검 사유 (미점검 시 필수)
  monthly_inspection_confirmed_at?: string;   // 확인 시각
}
```

**저장 위치**: JSON 필드 활용 (스키마 변경 불필요)
```json
// inspection_sessions.step_data
{
  "managerEducation": {
    "education_status": "...",
    "not_completed_reason": "...",
    "monthly_inspection_done": true,
    "monthly_inspection_skipped_reason": null
  }
}

// inspections.inspected_data (완료 시)
{
  "managerEducation": {
    "education_status": "...",
    "monthly_inspection_done": true,
    "monthly_inspection_skipped_reason": null
  }
}
```

---

## 3. 스키마 영향 분석

### 3.1 변경 필요 없음

| 테이블 | 변경 | 이유 |
|--------|------|------|
| inspection_sessions | 없음 | JSON 필드 `step_data` 활용 |
| inspections | 없음 | JSON 필드 `inspected_data` 활용 |
| inspection_field_comparisons | 없음 | 장비 정보 비교용 (법적 의무와 무관) |
| inspection_edit_logs | 없음 | 자동 추적 (기존 로직 활용) |

### 3.2 향후 최적화 (선택)

**10만 건 초과 시 물리적 칼럼 추가 고려**:
```sql
ALTER TABLE aedpics.inspections
ADD COLUMN monthly_inspection_done BOOLEAN DEFAULT NULL,
ADD COLUMN monthly_inspection_skipped_reason TEXT DEFAULT NULL;

-- 인덱스 생성
CREATE INDEX idx_inspections_monthly_compliance
ON aedpics.inspections(monthly_inspection_done)
WHERE monthly_inspection_done IS NOT NULL;
```

---

## 4. 통계/대시보드 영향

### 4.1 추가 통계 항목

**API 응답 구조** (`/api/inspections/stats`):
```typescript
{
  // ... 기존 항목들
  monthlyComplianceRate: {
    total: 500,                  // 전체 점검 건수
    compliant: 450,              // 매월 점검 O
    nonCompliant: 50,            // 매월 점검 X
    complianceRate: 90.0,        // 준수율 (%)
    topSkipReasons: [            // 미점검 사유 TOP 5
      { reason: "신규 설치", count: 20 },
      { reason: "관리자 부재", count: 15 },
      ...
    ]
  }
}
```

### 4.2 SQL 쿼리 예시

**준수율 계산**:
```sql
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN (inspected_data->'managerEducation'->>'monthly_inspection_done')::boolean = true THEN 1 ELSE 0 END) as compliant,
  SUM(CASE WHEN (inspected_data->'managerEducation'->>'monthly_inspection_done')::boolean = false THEN 1 ELSE 0 END) as non_compliant
FROM aedpics.inspections
WHERE inspection_date >= $1
  AND inspected_data->'managerEducation'->>'monthly_inspection_done' IS NOT NULL;
```

**미점검 사유 TOP 5**:
```sql
SELECT
  inspected_data->'managerEducation'->>'monthly_inspection_skipped_reason' as reason,
  COUNT(*) as count
FROM aedpics.inspections
WHERE (inspected_data->'managerEducation'->>'monthly_inspection_done')::boolean = false
GROUP BY reason
ORDER BY count DESC
LIMIT 5;
```

### 4.3 캐싱 전략

```typescript
// /api/inspections/stats/route.ts
import { cache } from '@/lib/cache';

const cacheKey = `stats:monthly-compliance:${period}`;
const cached = cache.get(cacheKey);
if (cached) return cached;

const data = await calculateMonthlyCompliance();
cache.set(cacheKey, data, 300); // 5분 TTL
```

---

## 5. 잠재적 문제 및 해결 방안

### 문제 1: 기존 진행 중 세션과 충돌

**시나리오**: 사용자가 Step 2까지 진행 후 중단 → 코드 배포 → 재개 시 새 필드 누락

**해결**:
```typescript
// ManagerEducationStep.tsx - useEffect 초기화
useEffect(() => {
  if (!stepData.managerEducation) {
    updateStepData('managerEducation', {
      education_status: undefined,
      monthly_inspection_done: undefined,  // 신규 필드 기본값
      monthly_inspection_skipped_reason: undefined
    });
  }
}, []);

// checkRequiredFields 수정
const checkRequiredFields = () => {
  const data = stepData.managerEducation || {};

  if (!data.education_status) return false;

  // 신규 필드 검증
  if (data.monthly_inspection_done === undefined) return false;
  if (data.monthly_inspection_done === false && !data.monthly_inspection_skipped_reason?.trim()) {
    return false;
  }

  return true;
};
```

### 문제 2: 통계 쿼리 성능 저하

**해결 1**: 부분 인덱스 (PostgreSQL GIN)
```sql
CREATE INDEX idx_inspections_monthly_compliance_gin
ON aedpics.inspections
USING gin ((inspected_data->'managerEducation'));
```

**해결 2**: 캐싱 (5분 TTL)

**해결 3**: 물리적 칼럼 추가 (장기 계획, 10만 건 초과 시)

### 문제 3: 과거 데이터 호환성

**시나리오**: 2025-11-19 이전 점검 데이터는 필드 없음

**해결**:
```typescript
// NULL 처리
const complianceRate = inspections
  .filter(i => i.inspected_data?.managerEducation?.monthly_inspection_done !== undefined)
  .reduce((acc, i) => {
    if (i.inspected_data.managerEducation.monthly_inspection_done) acc.compliant++;
    else acc.nonCompliant++;
    return acc;
  }, { compliant: 0, nonCompliant: 0, total: 0 });
```

**UI 표시**:
```
매월 점검 준수율: 90.0% (450/500)
※ 2025-11-19 이전 데이터는 집계에서 제외되었습니다.
```

### 문제 4: 승인 워크플로우 검증

**해결**: 승인 전 필수 확인
```typescript
// /api/inspections/[id]/approve/route.ts
if (!inspection.inspected_data?.managerEducation?.monthly_inspection_done) {
  return NextResponse.json({
    error: '매월 점검 여부가 기록되지 않았습니다.'
  }, { status: 400 });
}
```

---

## 6. 구현 계획 (단계별)

### Phase 1: Step 3 UI 수정 (1-2시간)
- [ ] ManagerEducationStep.tsx 수정
  - Section 2 추가: "매월 1회 점검 의무"
  - 라디오 버튼: monthly_inspection_done (true/false)
  - 조건부 텍스트에리어: monthly_inspection_skipped_reason
- [ ] checkRequiredFields 로직 업데이트
- [ ] TypeScript 타입 추가

**파일**:
- `components/inspection/steps/ManagerEducationStep.tsx`
- `lib/types/inspection.ts` (필요 시)

### Phase 2: 점검 완료 로직 수정 (30분)
- [ ] InspectionWorkflow.tsx - completeSession 확인
- [ ] /api/inspections/sessions/route.ts - step_data 저장 확인

**파일**:
- `components/inspection/InspectionWorkflow.tsx`
- `app/api/inspections/sessions/route.ts`

### Phase 3: 통계 API 추가 (1-2시간)
- [ ] monthlyComplianceRate 계산 로직 추가
- [ ] JSON 쿼리 작성
- [ ] 캐싱 적용
- [ ] 타입 정의 업데이트

**파일**:
- `app/api/inspections/stats/route.ts`
- `lib/types/inspection.ts`

### Phase 4: 대시보드 UI 추가 (2-3시간)
- [ ] MonthlyComplianceChart.tsx 신규 생성
  - 준수율 표시 (Progress Bar)
  - 미점검 사유 TOP 5 (Bar Chart)
- [ ] 대시보드 페이지에 추가

**파일**:
- `components/dashboard/MonthlyComplianceChart.tsx` (신규)
- `app/(authenticated)/dashboard/page.tsx`

### Phase 5: 테스트 및 검증 (1-2시간)
- [ ] 기존 진행 중 세션 재개 테스트
- [ ] 점검 완료 → inspected_data 저장 확인
- [ ] 통계 API 응답 확인
- [ ] 대시보드 렌더링 확인
- [ ] 승인 워크플로우 검증

**총 예상 시간**: 5-9시간

---

## 7. 체크리스트

### 배포 전 확인사항
- [ ] 기존 진행 중 세션 호환성
- [ ] JSON 쿼리 성능 측정
- [ ] 캐싱 동작 확인
- [ ] 타입 안정성 검증
- [ ] 승인 워크플로우 테스트

### 배포 후 모니터링
- [ ] 준수율 추이 관찰
- [ ] 미점검 사유 분석
- [ ] 통계 API 응답 시간
- [ ] 사용자 피드백 수집

---

## 8. 참고 문서

**관련 파일**:
- `components/inspection/InspectionWorkflow.tsx` - 메인 워크플로우
- `components/inspection/steps/ManagerEducationStep.tsx` - Step 3
- `app/api/inspections/sessions/route.ts` - 세션 API
- `app/api/inspections/stats/route.ts` - 통계 API
- `prisma/schema.prisma` - 스키마 (라인 225-255, 257-295)

**기존 분석 문서**:
- 점검 모달 구조: Task 결과 1 참조
- 점검 스키마: Task 결과 2 참조

---

## 9. 의사결정 기록

**날짜**: 2025-11-19

**결정 사항**:
1. **위치**: Step 3 (ManagerEducationStep) 확장 채택
   - 이유: 법적 의무 맥락 일치, 기존 워크플로우 최소 변경
2. **스키마**: JSON 필드 활용 (inspected_data)
   - 이유: 마이그레이션 불필요, 빠른 배포
3. **통계**: 캐싱 전략 (5분 TTL)
   - 이유: JSON 쿼리 성능 보완

**보류 이유**: 다른 급한 작업 우선 처리 필요

**재개 시점**: TBD

---

**작성자**: AI Assistant (Claude)
**검토자**: 이광성
**최종 수정일**: 2025-11-19
