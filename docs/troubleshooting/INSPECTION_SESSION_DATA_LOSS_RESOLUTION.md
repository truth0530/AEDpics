# 점검 세션 데이터 손실 및 필드 비교 미작동 해결 가이드

**작성일**: 2025-11-19
**문제 발견**: 점검 세션 중단 시 데이터 손실, inspection_field_comparisons 레코드 미생성
**해결 상태**: 부분 해결 (문제 2 완전 해결, 문제 1 해결 방안 제시)

---

## 목차

1. [문제 요약](#문제-요약)
2. [근본 원인 분석](#근본-원인-분석)
3. [해결 방안](#해결-방안)
4. [구현 완료 사항](#구현-완료-사항)
5. [향후 구현 필요 사항](#향후-구현-필요-사항)
6. [검증 방법](#검증-방법)

---

## 문제 요약

### 문제 1: 세션 중단 시 "점검 자체를 하지 않은 것처럼" 되는 현상

**증상**:
- 사용자가 점검 진행 중 네트워크 끊김, 브라우저 닫기 등으로 세션이 중단됨
- 재접속 시 마지막 편집 내용이 모두 사라짐
- "처음부터 다시 시작" 해야 하는 것처럼 보임

**영향 범위**:
- 사용자 경험 저하
- 반복 작업으로 인한 시간 낭비
- 점검 포기 가능성 증가

### 문제 2: 점검 완료 후 필드 비교 데이터 미생성 (개선 리포트 미작동)

**증상**:
- 점검은 완료되지만 `inspection_field_comparisons` 테이블에 레코드 없음
- 개선 리포트에서 "미확인" 또는 허위 "일치" 데이터 표시
- 배터리/패드 만료일 비교, 개선 추적 등 모든 필드 비교 기능 미작동

**영향 범위**:
- 개선 리포트 기능 완전 미작동
- 필드별 변경 이력 추적 불가
- 데이터 품질 개선 모니터링 불가

---

## 근본 원인 분석

### 문제 1 원인: 자동 저장 메커니즘 부재

#### 현재 아키텍처

```
사용자 입력 → store.stepData (메모리) → [수동 저장] → DB
                ↓
           브라우저 닫기/새로고침
                ↓
           메모리 손실 (데이터 휘발)
```

#### 데이터 흐름

1. **점검 시작**: `/api/inspections/sessions` POST → 세션 생성
2. **사용자 입력**: `store.setStepData()` → 메모리에만 저장
3. **저장 시점**:
   - `handleNext()` (다음 단계 이동)
   - `handleComplete()` (점검 완료)
   - **자동 저장 없음!**
4. **세션 중단**: 브라우저 닫기, 네트워크 끊김
5. **메모리 손실**: `store.stepData` 휘발
6. **재접속**: `loadSession()` → DB에서 마지막 저장 시점 데이터만 로드

#### 관련 파일

- `components/inspection/InspectionWorkflow.tsx` (Line 94-106)
  - `saveProgressMutation` 정의
  - 자동 호출 메커니즘 없음
- `lib/state/inspection-session-store.ts` (Line 260-333)
  - `persistProgress()` 함수 정상 작동
  - 주기적 저장 없음
- `app/api/inspections/sessions/route.ts` (Line 293-603)
  - PATCH 엔드포인트 정상 작동
  - 클라이언트에서 호출되지 않음

### 문제 2 원인: analyzeInspectionFields() 호출 누락

#### 현재 상황

```typescript
// lib/inspections/field-comparison.ts
export async function analyzeInspectionFields(...) {
  // ✅ 함수 정의됨
  // ✅ 로직 정상
  // ❌ 어디서도 호출되지 않음!
}

// app/api/inspections/sessions/route.ts (수정 전)
import { prisma } from '@/lib/prisma';
// ❌ analyzeInspectionFields import 없음

export async function PATCH(request: NextRequest) {
  // ...
  const createdInspection = await tx.inspections.create({...});

  // ❌ analyzeInspectionFields 호출 없음

  return NextResponse.json({ inspection: createdInspection });
}
```

#### 결과

- `inspections` 테이블: 레코드 생성됨 ✅
- `inspection_field_comparisons` 테이블: 레코드 없음 ❌
- 개선 리포트: 비교 데이터 없어서 미작동 ❌

---

## 해결 방안

### 문제 2 해결: analyzeInspectionFields() 호출 추가 (완료)

#### 수정 내용

**파일**: `app/api/inspections/sessions/route.ts`

```typescript
// 1. import 추가
import { analyzeInspectionFields } from '@/lib/inspections/field-comparison';

// 2. 점검 완료 트랜잭션 후 호출 추가 (Line 525-548)
try {
  logger.info('InspectionSessions:PATCH', 'Starting field comparison analysis', {
    inspectionId: result.inspection.id,
    equipment_serial: existingSession.equipment_serial,
  });

  await analyzeInspectionFields(
    result.inspection.id,
    existingSession.equipment_serial,
    inspectedData
  );

  logger.info('InspectionSessions:PATCH', 'Field comparison analysis completed', {
    inspectionId: result.inspection.id,
  });
} catch (analysisError) {
  // 필드 분석 실패는 치명적이지 않으므로 경고만 로그
  logger.warn('InspectionSessions:PATCH', 'Field comparison analysis failed', {
    inspectionId: result.inspection.id,
    equipment_serial: existingSession.equipment_serial,
    error: analysisError instanceof Error ? analysisError.message : 'Unknown error',
  });
}
```

#### 기대 효과

✅ 점검 완료 시 자동으로 필드 비교 수행
✅ `inspection_field_comparisons` 테이블에 레코드 생성
✅ 개선 리포트 정상 작동
✅ 배터리/패드 만료일 비교 가능
✅ 필드별 변경 이력 추적 가능

---

### 문제 1 해결: 자동 저장 메커니즘 구현 (향후 구현 필요)

#### 방안 A: 자동 저장 타이머 (권장)

**구현 위치**: `components/inspection/InspectionWorkflow.tsx`

```typescript
// 30초마다 자동 저장
useEffect(() => {
  const autoSaveInterval = setInterval(async () => {
    if (sessionId && !isSaving) {
      console.log('[AutoSave] Saving progress...');
      await persistProgress();
    }
  }, 30000); // 30초

  return () => clearInterval(autoSaveInterval);
}, [sessionId, persistProgress, isSaving]);

// 페이지 떠나기 전 저장
useEffect(() => {
  const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
    if (sessionId && hasUnsavedChanges) {
      e.preventDefault();
      await persistProgress();
      return (e.returnValue = '저장되지 않은 변경사항이 있습니다.');
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [sessionId, hasUnsavedChanges, persistProgress]);
```

**기대 효과**:
- 30초마다 자동 저장
- 브라우저 닫기 전 경고 및 저장
- 네트워크 재연결 시 최대 30초 전 상태까지 복구 가능

#### 방안 B: localStorage 백업 (보조)

**구현 위치**: `lib/state/inspection-session-store.ts`

```typescript
// persistProgress에 localStorage 백업 추가
persistProgress: async () => {
  const { sessionId, stepData, currentStep } = get();

  // 1. DB 저장
  await fetch('/api/inspections/sessions', {...});

  // 2. localStorage 백업 (브라우저 재시작 대비)
  localStorage.setItem(
    `inspection_backup_${sessionId}`,
    JSON.stringify({
      sessionId,
      stepData,
      currentStep,
      savedAt: new Date().toISOString(),
    })
  );
}

// loadSession에 localStorage 복구 추가
loadSession: async (sessionId: string) => {
  // 1. DB 로드
  const session = await fetch(`/api/inspections/sessions/${sessionId}`);

  // 2. localStorage 백업 확인
  const backup = localStorage.getItem(`inspection_backup_${sessionId}`);
  if (backup) {
    const backupData = JSON.parse(backup);
    const backupDate = new Date(backupData.savedAt);
    const sessionDate = new Date(session.updated_at);

    // 백업이 더 최신이면 사용
    if (backupDate > sessionDate) {
      return backupData;
    }
  }

  return session;
}
```

**기대 효과**:
- 브라우저 재시작 후에도 데이터 복구
- 오프라인 상태에서도 작업 가능
- DB 저장 실패 시 백업으로 복구

#### 방안 C: 변경 감지 플래그 (필수)

**구현 위치**: `lib/state/inspection-session-store.ts`

```typescript
interface InspectionSessionState {
  lastSavedAt: Date | null;
  hasUnsavedChanges: boolean;

  markAsSaved: () => void;
  markAsChanged: () => void;
}

const useInspectionSessionStore = create<InspectionSessionState>((set, get) => ({
  lastSavedAt: null,
  hasUnsavedChanges: false,

  setStepData: (step, data) => {
    set((state) => ({
      stepData: { ...state.stepData, [step]: data },
      hasUnsavedChanges: true,  // 변경 플래그
    }));
  },

  markAsSaved: () => set({
    hasUnsavedChanges: false,
    lastSavedAt: new Date()
  }),
}));
```

**UI 표시**:

```typescript
// components/inspection/InspectionWorkflow.tsx
export default function InspectionWorkflow({ equipmentSerial }: Props) {
  const { hasUnsavedChanges, lastSavedAt } = useInspectionSessionStore();

  return (
    <div>
      {hasUnsavedChanges ? (
        <Badge variant="warning">저장되지 않음</Badge>
      ) : lastSavedAt ? (
        <Badge variant="success">
          {formatDistanceToNow(lastSavedAt, { locale: ko })} 전 저장됨
        </Badge>
      ) : null}

      {/* 기존 워크플로우 */}
    </div>
  );
}
```

---

## 구현 완료 사항

### ✅ 문제 2 해결: analyzeInspectionFields() 호출 추가

**커밋**: `fix: inspection_field_comparisons 레코드 생성 누락 문제 해결`

**변경 파일**:
- `app/api/inspections/sessions/route.ts`
  - Line 6: `import { analyzeInspectionFields }` 추가
  - Line 525-548: 필드 비교 분석 호출 추가

**예상 결과**:
- 다음 점검 완료부터 `inspection_field_comparisons` 레코드 자동 생성
- 개선 리포트 정상 작동
- 필드 비교 기능 활성화

---

## 향후 구현 필요 사항

### ⏳ 문제 1 해결: 자동 저장 메커니즘

**우선순위**: High

**필요 작업**:

1. **자동 저장 타이머 구현** (2시간 예상)
   - `components/inspection/InspectionWorkflow.tsx` 수정
   - 30초마다 `persistProgress()` 호출
   - `beforeunload` 이벤트 핸들러 추가

2. **변경 감지 플래그 추가** (1시간 예상)
   - `lib/state/inspection-session-store.ts` 수정
   - `hasUnsavedChanges` 상태 추가
   - `lastSavedAt` 타임스탬프 추가

3. **UI 저장 상태 표시** (30분 예상)
   - `InspectionWorkflow` 헤더에 뱃지 추가
   - 저장 시간 표시

4. **localStorage 백업** (1시간 예상, 선택)
   - `persistProgress()` 수정
   - `loadSession()` 수정
   - 백업 데이터 복구 로직

**예상 총 소요 시간**: 4-5시간

---

## 검증 방법

### 문제 2 검증 (inspection_field_comparisons 생성)

#### 테스트 시나리오

1. **점검 완료 수행**:
   ```bash
   # 1. 웹에서 점검 완료
   # 2. 서버 로그 확인
   pm2 logs --lines 50 | grep "Field comparison"

   # 예상 로그:
   # [INFO] Starting field comparison analysis
   # [INFO] Field comparison analysis completed
   ```

2. **DB 확인**:
   ```sql
   -- 1. 최근 점검 ID 확인
   SELECT id, equipment_serial, inspection_date
   FROM inspections
   ORDER BY inspection_date DESC
   LIMIT 1;

   -- 2. field_comparisons 레코드 확인
   SELECT COUNT(*)
   FROM inspection_field_comparisons
   WHERE inspection_id = 'INSPECTION_ID_FROM_STEP1';

   -- 예상: COUNT > 0

   -- 3. 생성된 레코드 확인
   SELECT field_name, field_category, inspection_value, aed_data_value, improvement_status
   FROM inspection_field_comparisons
   WHERE inspection_id = 'INSPECTION_ID_FROM_STEP1'
   ORDER BY field_category, field_name;
   ```

3. **개선 리포트 확인**:
   - 웹에서 `/admin/reports/improvements` 접속
   - 최근 점검 데이터 표시 확인
   - "미확인" 대신 실제 비교 결과 표시 확인

#### 예상 결과

✅ 서버 로그에 "Field comparison analysis completed" 출력
✅ `inspection_field_comparisons` 테이블에 10-15개 레코드 생성
✅ 개선 리포트에서 필드별 비교 데이터 표시

### 문제 1 검증 (자동 저장, 향후 구현 후)

#### 테스트 시나리오

1. **자동 저장 동작 확인**:
   ```bash
   # 1. 점검 페이지 진입
   # 2. 개발자 도구 > Console 확인
   # [AutoSave] Saving progress...  (30초마다 출력)
   ```

2. **저장 상태 UI 확인**:
   - 입력 후: "저장되지 않음" 뱃지 표시
   - 30초 후: "30초 전 저장됨" 뱃지 표시

3. **브라우저 닫기 경고**:
   - 입력 후 브라우저 닫기 시도
   - "저장되지 않은 변경사항이 있습니다." 경고 표시

4. **데이터 복구 테스트**:
   ```bash
   # 1. 점검 입력 (저장 안 함)
   # 2. 30초 대기 (자동 저장)
   # 3. 브라우저 닫기
   # 4. 재접속
   # 5. 이전 입력 내용 표시 확인
   ```

#### 예상 결과

✅ 30초마다 자동 저장
✅ 브라우저 닫기 전 경고
✅ 재접속 시 데이터 복구
✅ 최대 30초 이내 작업 손실

---

## 참고 자료

### 관련 파일

- `app/api/inspections/sessions/route.ts` - 세션 관리 API
- `lib/state/inspection-session-store.ts` - 상태 관리
- `lib/inspections/field-comparison.ts` - 필드 비교 로직
- `components/inspection/InspectionWorkflow.tsx` - 클라이언트 UI
- `prisma/schema.prisma` - 스키마 정의
  - `inspection_sessions` (Line 229-259)
  - `inspection_field_comparisons` (Line 300-329)

### 관련 문서

- [docs/reference/ARCHITECTURE_OVERVIEW.md](../reference/ARCHITECTURE_OVERVIEW.md) - 시스템 아키텍처
- [docs/reference/aed-data-schema.md](../reference/aed-data-schema.md) - 데이터 스키마
- [CLAUDE.md](../../CLAUDE.md) - 개발 가이드라인

---

**마지막 업데이트**: 2025-11-19
**작성자**: Claude Code
**버전**: 1.0
