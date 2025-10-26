# 점검 데이터 흐름 정책

**작성일**: 2025-10-14
**최종 수정**: 2025-10-14
**상태**: ✅ 구현 완료
**버전**: 2.0

## 목차
1. [실제 구현 상태](#실제-구현-상태)
2. [데이터 흐름 개요](#데이터-흐름-개요)
3. [3단계 데이터 관리](#3단계-데이터-관리)
4. [2025-10-14 통합 작업](#2025-10-14-통합-작업)
5. [사용 가이드](#사용-가이드)

---

## 실제 구현 상태

### ✅ 완벽하게 구현된 Sessions 기반 점검

**API**: `/api/inspections/sessions`

**위치**: `app/api/inspections/sessions/route.ts`

**기능**:
1. ✅ **스냅샷 자동 저장** (line 236-263)
   - `original_snapshot`: 점검 시작 시점 원본
   - `current_snapshot`: 자동 갱신되는 최신 데이터
   - `device_info`: 하위 호환성

2. ✅ **중복 세션 방지** (line 216-231)
   - 동일 사용자의 활성 세션 확인
   - 409 Conflict 에러 반환
   - 기존 `sessionId` 제공

3. ✅ **자동 갱신 시스템** (line 108-202)
   - 24시간 경과 시 자동 갱신
   - 백그라운드 비차단 처리
   - 갱신 상태 추적 (`refresh_status`)

4. ✅ **필드 변경 추적** (line 433-435)
   - `field_changes` JSONB 저장
   - 원본/수정 값 비교 가능

5. ✅ **세션 완료 처리** (line 460-467)
   - `complete_inspection_session()` RPC 호출
   - `inspection_sessions` → `inspections` 변환
   - 최종 결과 영구 저장

### ❌ 구식 Quick API (2025-10-14 통합됨)

**API**: `/api/inspections/quick` (더 이상 사용 안 함)

**문제점**:
- ❌ `inspection_sessions` 건너뜀
- ❌ 스냅샷 저장 안 됨
- ❌ 중복 세션 체크 없음
- ❌ "점검 세션이 시작되었습니다" 반복 문제

**해결**: `QuickInspectPanel.tsx`를 Sessions API 사용하도록 수정 완료

---

## 데이터 흐름 개요

### 핵심 원칙 (실제 구현됨)

```
┌─────────────────┐
│   aed_data      │ 1차: API 원본 데이터
│  (Read-Only)    │     매일 새벽 업데이트
└────────┬────────┘
         │
         │ [점검 시작] /api/inspections/sessions POST
         │ equipment_serial로 조회
         │ 전체 레코드 스냅샷 자동 저장
         ↓
┌─────────────────┐
│ inspection_     │ 2차: 점검 시작 시점 스냅샷
│   sessions      │     original_snapshot: 시작 시점 원본
│                 │     current_snapshot: 자동 갱신
│                 │     field_changes: 수정 추적
└────────┬────────┘
         │
         │ [점검 진행] PATCH
         │ 7단계 데이터 입력
         │ step_data 업데이트
         │
         │ [점검 완료] PATCH (status: completed)
         │ complete_inspection_session() RPC
         ↓
┌─────────────────┐
│  inspections    │ 3차: 최종 검증 결과
│  (영구 기록)    │     overall_status: 'completed'
│                 │     변경 내역 보존
└────────┬────────┘
         │
         │ [매일 새벽]
         │ 비교 분석 (향후 구현)
         ↓
┌─────────────────┐
│   aed_data      │ 1차: 업데이트된 데이터
│  (업데이트됨)   │     현행화 여부 확인
└─────────────────┘
```

### 목적
1. **데이터 무결성**: 원본 데이터(`aed_data`) 보호
2. **변경 추적**: `original_snapshot` vs `current_snapshot` 비교
3. **현행화 확인**: API 업데이트 반영 여부 모니터링 (향후)
4. **책임 추적**: 누가, 언제, 무엇을 변경했는지 기록

---

## 3단계 데이터 관리

### 1차 데이터: aed_data (마스터 원본)

**특징**:
- 매일 새벽 공공데이터포털 API에서 자동 업데이트
- ✅ 읽기 전용 (Read-Only)
- 전국 81,331대 AED 정보

**운영 정책**:
- ❌ 수동 수정 절대 금지
- ✅ SELECT 쿼리만 허용
- ✅ `equipment_serial`을 FK로 사용

---

### 2차 데이터: inspection_sessions (점검 시작 시점 스냅샷)

**특징**:
- ✅ 점검 시작 시 자동 생성
- ✅ `original_snapshot`: 시작 시점 원본 (불변)
- ✅ `current_snapshot`: 자동 갱신 (24시간마다)
- ✅ `field_changes`: 수정 내역 추적
- ✅ `step_data`: 7단계 진행 데이터

**테이블 구조** (실제):
```sql
CREATE TABLE inspection_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_serial VARCHAR(255) NOT NULL,
  inspector_id UUID NOT NULL REFERENCES user_profiles(id),

  -- 세션 상태
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),

  -- 진행 상태
  current_step INTEGER DEFAULT 0,
  step_data JSONB DEFAULT '{}',

  -- 🔑 핵심: 스냅샷 저장
  original_snapshot JSONB,     -- 시작 시점 원본 (불변)
  current_snapshot JSONB,      -- 자동 갱신 (24시간)
  device_info JSONB,           -- 하위 호환성

  -- 🔑 핵심: 필드 변경 추적
  field_changes JSONB DEFAULT '{}',

  -- 갱신 관리
  snapshot_updated_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  refresh_status VARCHAR(20),  -- idle/refreshing/success/failed
  refresh_error TEXT,

  -- 타임스탬프
  started_at TIMESTAMPTZ DEFAULT NOW(),
  paused_at TIMESTAMPTZ,
  resumed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**자동 갱신 로직** (구현됨):
```typescript
// line 108-140: shouldRefreshSnapshot()
function shouldRefreshSnapshot(session) {
  const hoursSinceUpdate = ...;

  // 🚫 점검 진행 중이면 갱신 안 함 (혼란 방지)
  if (session.status === 'active' && session.current_step > 0) {
    return false;
  }

  // 🚫 최근 1시간 이내 갱신했으면 스킵
  if (hoursSinceUpdate < 1) {
    return false;
  }

  // ✅ 24시간 경과 → 갱신
  if (hoursSinceUpdate >= 24) {
    return true;
  }

  return false;
}

// line 142-202: refreshSnapshotInBackground()
// 백그라운드에서 aed_data 최신 데이터 조회 후 current_snapshot 업데이트
```

**운영 정책**:
- ✅ 점검 시작 시 자동 스냅샷 저장
- ✅ 중복 세션 자동 감지 (409 에러)
- ✅ 24시간 후 자동 갱신 (백그라운드)
- ✅ 점검 완료 전까지 `status = 'active'` 유지

---

### 3차 데이터: inspections (점검 완료 최종 결과)

**특징**:
- ✅ 점검 완료 시 `complete_inspection_session()` RPC로 자동 생성
- ✅ 최종 검증된 데이터만 저장
- ✅ 이력 관리 및 통계 생성에 사용
- ✅ 수정 불가 (감사 추적 목적)

**생성 방법**:
```typescript
// PATCH /api/inspections/sessions (status: completed)
// → complete_inspection_session() RPC 호출
// → inspection_sessions → inspections 변환
```

**운영 정책**:
- ✅ 점검 완료 후에만 생성
- ✅ 수정 불가 (감사 추적 목적)
- ✅ `equipment_serial` 기반 이력 조회

---

## 2025-10-14 통합 작업

### 문제 진단

**발견된 이슈**:
1. 두 가지 점검 시작 API 공존
   - `/api/inspections/quick` (구식)
   - `/api/inspections/sessions` (신규, 완벽 구현)

2. `QuickInspectPanel` 컴포넌트가 구식 API 사용
   - 스냅샷 저장 안 됨
   - 중복 세션 체크 없음
   - "점검 세션이 시작되었습니다" 반복 문제

### 해결 방법

**수정 파일**: `app/aed-data/components/QuickInspectPanel.tsx`

**변경 내용**:
```typescript
// ❌ 기존 (구식 API)
await fetch('/api/inspections/quick', {
  method: 'POST',
  body: JSON.stringify({ deviceId: device.id }),
});

// ✅ 변경 (Sessions API)
await fetch('/api/inspections/sessions', {
  method: 'POST',
  body: JSON.stringify({
    equipmentSerial: device.equipment_serial || device.id,
  }),
});

// ✅ 409 에러 처리 추가 (중복 세션)
if (response.status === 409 && payload.sessionId) {
  showSuccess(
    '진행 중인 점검이 있습니다.',
    '기존 점검을 이어서 진행합니다.'
  );
  router.push(`/inspection/${encodeURIComponent(serial)}`);
  return;
}
```

### 효과

**즉시 해결**:
1. ✅ 중복 세션 자동 방지
2. ✅ 스냅샷 자동 저장
3. ✅ 필드 변경 추적 가능
4. ✅ 자동 갱신 시스템 활성화
5. ✅ "점검 세션이 시작되었습니다" 반복 문제 해결

**추가 이점**:
- ✅ 단일 통합된 점검 시작 로직
- ✅ 유지보수 간소화
- ✅ 코드 복잡도 감소

---

## 사용 가이드

### 점검 시작

**프론트엔드**:
```typescript
// 어디서든 이 API 사용
const response = await fetch('/api/inspections/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    equipmentSerial: 'AED-2024-001',
  }),
});

// 409 에러 처리
if (response.status === 409) {
  const { sessionId } = await response.json();
  // 기존 세션으로 이동
  router.push(`/inspection/${sessionId}`);
}
```

**자동으로 처리되는 것들**:
- ✅ `aed_data`에서 스냅샷 자동 조회
- ✅ `original_snapshot`, `current_snapshot`, `device_info` 자동 저장
- ✅ 중복 세션 자동 감지
- ✅ 24시간 후 자동 갱신 (백그라운드)

### 점검 진행

**단계 데이터 저장**:
```typescript
await fetch('/api/inspections/sessions', {
  method: 'PATCH',
  body: JSON.stringify({
    sessionId: 'uuid',
    currentStep: 3,
    stepData: {
      step1: { /* ... */ },
      step2: { /* ... */ },
      step3: { /* ... */ },
    },
  }),
});
```

### 필드 변경 추적

```typescript
await fetch('/api/inspections/sessions', {
  method: 'PATCH',
  body: JSON.stringify({
    sessionId: 'uuid',
    fieldChanges: {
      manufacturer: {
        original: 'A사',
        modified: 'B사',
        reason: '현장 확인 결과 실제 제조사 다름',
      },
    },
  }),
});
```

### 점검 완료

```typescript
await fetch('/api/inspections/sessions', {
  method: 'PATCH',
  body: JSON.stringify({
    sessionId: 'uuid',
    status: 'completed',
    finalizeData: {
      step1: { /* ... */ },
      // ... 전체 단계 데이터
      step7: { /* ... */ },
    },
  }),
});

// 자동으로 처리됨:
// 1. complete_inspection_session() RPC 호출
// 2. inspection_sessions → inspections 변환
// 3. 세션 상태 'completed'로 변경
// 4. completed_at 타임스탬프 저장
```

---

## 데이터 비교 예시

### 시나리오

```
T0: 2025-10-01 새벽
  aed_data 업데이트
  manufacturer: "A사"

T1: 2025-10-01 10:00 (점검 시작)
  POST /api/inspections/sessions
  original_snapshot.manufacturer: "A사"
  current_snapshot.manufacturer: "A사"

T2: 2025-10-01 10:30 (점검 진행)
  현장 확인 결과 실제 제조사는 "B사"
  field_changes.manufacturer: {
    original: "A사",
    modified: "B사",
    reason: "현장 확인 결과 불일치"
  }

T3: 2025-10-01 11:00 (점검 완료)
  PATCH /api/inspections/sessions (status: completed)
  → inspections 테이블에 최종 결과 저장
  → notes: "제조사 정보 불일치 - 실제 B사"

T4: 2025-10-02 새벽 (다음날)
  aed_data 업데이트

  Case 1: 반영된 경우
    aed_data.manufacturer: "B사"
    → ✅ 현행화 성공
    → 다음 점검 시 current_snapshot.manufacturer: "B사"

  Case 2: 미반영된 경우
    aed_data.manufacturer: "A사" (여전히)
    → ❌ 알림 필요 (향후 구현)
    → 다음 점검 시 또 불일치 감지됨
```

---

## 향후 개선 사항

### 우선순위 1: 현행화 모니터링 대시보드

**목적**: 점검 후 API 업데이트 반영률 추적

**기능**:
```sql
-- 점검 결과와 최신 aed_data 비교
SELECT
  i.equipment_serial,
  i.inspection_date,

  -- 제조사 비교
  CASE
    WHEN a.manufacturer != (s.original_snapshot->>'manufacturer')
    THEN 'API에서 변경됨'
    WHEN (s.field_changes->'manufacturer') IS NOT NULL
    THEN '점검에서 수정 요청'
    ELSE '동일'
  END as manufacturer_status

FROM inspections i
JOIN inspection_sessions s ON s.equipment_serial = i.equipment_serial
  AND s.status = 'completed'
JOIN aed_data a ON a.equipment_serial = i.equipment_serial
WHERE i.inspection_date > CURRENT_DATE - INTERVAL '7 days'
ORDER BY i.inspection_date DESC;
```

### 우선순위 2: 자동 세션 정리

**목적**: 24시간 이상 방치된 활성 세션 자동 취소

**구현 방안**:
```sql
-- Cron Job (매일 새벽 실행)
UPDATE inspection_sessions
SET
  status = 'cancelled',
  cancelled_at = NOW(),
  notes = COALESCE(notes, '') || '\n자동 취소: 24시간 초과'
WHERE
  status = 'active'
  AND started_at < NOW() - INTERVAL '24 hours';
```

### 우선순위 3: 스냅샷 차이 시각화

**목적**: 점검 전/후 변경 사항 시각적 비교

**UI 예시**:
```
┌─────────────────────────────────────────┐
│ 📊 변경 사항 비교                        │
├─────────────────────────────────────────┤
│ 제조사                                   │
│   원본: A사                              │
│   현재: B사                              │
│   변경: 점검 시 수정                     │
│                                          │
│ 설치 위치                                │
│   원본: 1층 로비                         │
│   현재: 1층 안내데스크 옆                │
│   변경: 위치 정보 구체화                 │
└─────────────────────────────────────────┘
```

---

## 결론

### ✅ 현재 상태 (2025-10-14)

**데이터 흐름 정책**:
- ✅ 3단계 데이터 분리 완벽 구현
- ✅ 스냅샷 자동 저장
- ✅ 중복 세션 방지
- ✅ 필드 변경 추적
- ✅ 자동 갱신 시스템
- ✅ 단일 통합된 점검 API

**효율성 및 합리성**:
- ✅ 데이터 무결성 보장
- ✅ 변경 추적 가능
- ✅ 현행화 모니터링 기반 마련
- ✅ 유지보수 간소화

### 📚 관련 문서

- [inspection-architecture.md](./inspection-architecture.md) - 점검 시스템 아키텍처
- [aed-data-state-management.md](./aed-data-state-management.md) - 데이터 상태 관리
- Migration 20: `20_create_inspection_sessions.sql`
- Migration 28: `28_add_field_changes_to_sessions.sql`
- `/api/inspections/sessions/route.ts` - 실제 구현 코드

**담당자**: AED Smart Check 개발팀
**최종 검토**: 2025-10-14 구현 완료
