# 점검 시스템 아키텍처 (통합본)

**최초 작성일**: 2025-09-13
**최종 업데이트**: 2025-10-14
**상태**: 운영 중
**목적**: 점검 기능 전체 아키텍처 (백엔드 + 프론트엔드)

> **🔗 관련 문서**: [inspection-data-flow.md](./inspection-data-flow.md) - 점검 데이터 흐름 정책 및 실제 구현 상태

> **⚠️ 필독**: 이 문서는 실제 마이그레이션 파일(`supabase/migrations/`)을 기준으로 작성되었습니다.
>
> **진실 공급원**: `supabase/ACTUAL_SCHEMA_REFERENCE.md` + `supabase/migrations/`
>
> **이전 버전**: [archive/INSPECTION_ARCHITECTURE.md](../archive/INSPECTION_ARCHITECTURE.md) - 2025-09-13 DB 중심 설계서 참고

## 📋 목차

1. [기술 스택](#기술-스택)
2. [데이터베이스 설계](#데이터베이스-설계)
3. [API 아키텍처](#api-아키텍처)
4. [프론트엔드 상태 관리](#프론트엔드-상태-관리)
5. [점검 프로세스](#점검-프로세스)
6. [성능 최적화](#성능-최적화)
7. [보안 및 권한](#보안-및-권한)
8. [오프라인 지원](#오프라인-지원)

---

## 기술 스택

### 프론트엔드
- **데이터 페칭**: React Query (SWR 사용 금지)
- **상태 관리**: Zustand (클라이언트 직접 호출 금지)
- **UI**: Next.js Server Components + Shadcn/ui
- **오프라인**: IndexedDB + React Query 캐싱

### 백엔드
- **API**: Next.js Route Handlers
- **데이터베이스**: Supabase PostgreSQL (서버에서만 접근)
- **인증**: Supabase Auth + RLS
- **스토리지**: Supabase Storage (사진 첨부)

---

## 데이터베이스 설계

### 🎯 설계 원칙

1. **데이터 분리**: 마스터 데이터(aed_data)와 점검 기록(inspections) 완전 분리
2. **equipment_serial 기반**: 매일 데이터 교체에도 안정적인 연계
3. **ON DELETE RESTRICT**: 점검 기록 보호 보장

### 📊 핵심 테이블

#### 1. aed_data (읽기 전용 마스터 데이터)
```sql
-- 80,766개 AED 레코드 (매일 파이썬 스크립트로 업데이트)
aed_data {
  id INTEGER PRIMARY KEY,                 -- ❌ 불안정 (매일 변경)
  equipment_serial VARCHAR UNIQUE,        -- ✅ 안정적 연계키
  management_number VARCHAR,              -- 관리번호

  -- 지역 정보
  sido VARCHAR,                          -- 시도 (17개)
  gugun VARCHAR,                         -- 구군
  jurisdiction_health_center VARCHAR,    -- 관할보건소

  -- 장비 정보
  manufacturer VARCHAR,                   -- 제조사
  model_name VARCHAR,                    -- 모델명

  -- 설치 정보
  installation_institution VARCHAR,      -- 설치기관
  installation_address TEXT,            -- 설치주소
  installation_position VARCHAR,        -- 설치위치

  -- 유효기간 정보
  battery_expiry_date DATE,             -- 배터리 유효기간
  patch_expiry_date DATE,               -- 패치 유효기간
  device_expiry_date DATE,              -- 장치 유효기간

  created_at TIMESTAMP,
  updated_at TIMESTAMP
}
```

#### 2. inspections (점검 기록 전용)
> **✅ 실제 사용 중인 테이블**: `inspections` (최종 이름)
>
> **변경 이력**:
> - Migration 06 (2025-09-13): `aed_inspections` 테이블로 생성
> - Migration 51 (2025-10-05): `inspections`로 이름 변경 (aed_ 접두어 제거)
>
> **⚠️ 주의**: `aed_inspections`, `aed_inspections_v2`는 더 이상 존재하지 않습니다

```sql
-- 현장 점검 결과 저장 테이블
-- 최초 생성: supabase/migrations/06_fix_inspection_schema.sql (aed_inspections)
-- 최종 이름: supabase/migrations/51_rename_inspection_tables.sql (inspections)
inspections {
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 🔑 AED 장치 참조
  equipment_serial VARCHAR(255) NOT NULL,  -- aed_data.equipment_serial과 연계

  -- 점검 메타데이터
  inspector_id UUID REFERENCES user_profiles(id),
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  inspection_type VARCHAR(50) DEFAULT 'routine',
  inspection_latitude NUMERIC,
  inspection_longitude NUMERIC,

  -- 점검 상태 (2025-10-08 추가)
  inspection_status VARCHAR(50) DEFAULT 'scheduled'
    CHECK (inspection_status IN ('scheduled', 'in_progress', 'completed', 'failed')),

  -- 🔍 점검 결과
  battery_status VARCHAR(50),
  pad_status VARCHAR(50),
  operation_status VARCHAR(50),
  visual_status VARCHAR(50),
  overall_status VARCHAR(50) DEFAULT 'pending',

  -- 📝 점검 상세
  issues_found TEXT,
  notes TEXT,

  -- 🗄️ 증빙 자료
  photos TEXT[],

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
}

-- 인덱스 추가 (점검 상태 기반 조회 최적화)
CREATE INDEX idx_inspections_status
  ON inspections(inspection_status, inspection_date DESC);
```

> **주의**: 이 스키마는 실제 운영 DB를 기준으로 작성되었습니다.
> Migration 파일과 차이가 있을 수 있습니다.

#### 3. inspection_sessions (점검 세션 관리)

> **📌 최신 스키마 (2025-10-14 업데이트)**:
> Week 2-3에 스냅샷 갱신 기능 추가됨. 상세 정보는 [inspection-data-flow.md](./inspection-data-flow.md) 참조.

```sql
-- 진행 중인 점검 세션 임시 저장
CREATE TABLE inspection_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_serial VARCHAR(255) NOT NULL,
  inspector_id UUID NOT NULL REFERENCES user_profiles(id),

  -- 세션 상태
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),

  -- 진행 상태
  current_step INTEGER DEFAULT 0,
  step_data JSONB DEFAULT '{}',

  -- 🔑 스냅샷 관리 (Week 2-3 추가)
  original_snapshot JSONB,        -- 시작 시점 원본 (불변)
  current_snapshot JSONB,         -- 자동 갱신 (24시간마다)
  device_info JSONB,              -- 하위 호환성 (deprecated)
  snapshot_updated_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  refresh_status VARCHAR(20),     -- 'idle'|'refreshing'|'success'|'failed'
  refresh_error TEXT,

  -- 🔑 필드 변경 추적
  field_changes JSONB DEFAULT '{}',

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

**주요 기능** (2025-10-14):
- ✅ **자동 스냅샷 저장**: 점검 시작 시 `aed_data` 전체 복사
- ✅ **24시간 자동 갱신**: 백그라운드에서 `current_snapshot` 업데이트
- ✅ **중복 세션 방지**: 동일 사용자의 활성 세션 자동 감지
- ✅ **필드 변경 추적**: 수정 전/후 비교 가능

### 📊 통합 조회 뷰

#### aed_inspection_status 뷰
```sql
-- AED별 최신 점검 상태 통합 뷰
CREATE VIEW aed_inspection_status AS
SELECT
  a.*,  -- 모든 aed_data 필드

  -- 최신 점검 정보
  latest.id as latest_inspection_id,
  COALESCE(latest.inspection_date, '1900-01-01'::date) as last_inspection_date,
  COALESCE(latest.overall_status, 'never_inspected') as inspection_status,
  latest.inspector_name as last_inspector,

  -- 점검 필요성 계산
  CASE
    WHEN latest.inspection_date IS NULL THEN 'never_inspected'
    WHEN latest.inspection_date < CURRENT_DATE - INTERVAL '60 days' THEN 'overdue'
    WHEN latest.inspection_date < CURRENT_DATE - INTERVAL '30 days' THEN 'due_soon'
    WHEN latest.overall_status = 'fail' THEN 'failed_last'
    ELSE 'current'
  END as inspection_priority,

  -- 유효기간 상태
  CASE
    WHEN a.battery_expiry_date < CURRENT_DATE OR a.patch_expiry_date < CURRENT_DATE THEN 'expired'
    WHEN a.battery_expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
    ELSE 'valid'
  END as expiry_status,

  -- 우선순위 점수 (0-100, 높을수록 긴급)
  CASE
    WHEN latest.inspection_date IS NULL THEN 100
    WHEN latest.overall_status = 'fail' THEN 90
    WHEN a.battery_expiry_date < CURRENT_DATE THEN 85
    WHEN latest.inspection_date < CURRENT_DATE - INTERVAL '60 days' THEN 80
    ELSE 10
  END as priority_score

FROM aed_data a
LEFT JOIN LATERAL (
  SELECT id, equipment_serial, inspection_date, overall_status, inspector_name
  FROM aed_inspections
  WHERE equipment_serial = a.equipment_serial
  ORDER BY inspection_date DESC, created_at DESC
  LIMIT 1
) latest ON true;
```

---

## API 아키텍처

### 🔌 API 엔드포인트

> **📌 2025-10-14 업데이트**: `/api/inspections/quick` 폐기, Sessions API로 통합됨.
> 상세 사항은 [inspection-data-flow.md#2025-10-14-통합-작업](./inspection-data-flow.md#2025-10-14-통합-작업) 참조.

#### 점검 세션 관리 (통합 API)
```typescript
POST   /api/inspections/sessions           - 새 세션 시작 (중복 체크 포함)
GET    /api/inspections/sessions?sessionId=[id]  - 세션 조회
GET    /api/inspections/sessions?status=active   - 활성 세션 목록
PATCH  /api/inspections/sessions           - 진행 상태 저장
PATCH  /api/inspections/sessions (status: completed) - 세션 완료
```

**주요 기능** (실제 구현됨):
- ✅ **중복 세션 방지**: 409 Conflict 응답 + 기존 `sessionId` 반환
- ✅ **자동 스냅샷**: `aed_data` 전체 레코드 `original_snapshot`에 저장
- ✅ **백그라운드 갱신**: 24시간 경과 시 `current_snapshot` 자동 업데이트
- ✅ **완료 시 RPC 호출**: `complete_inspection_session()` → `inspections` 테이블 저장

#### 점검 결과 저장
```typescript
POST /api/inspections/results              - 최종 결과 저장
GET  /api/inspections/history/[serial]     - 점검 이력 조회
GET  /api/inspections/statistics           - 점검 통계
```

#### AED 장치 조회
```typescript
GET /api/aed-devices                       - 점검 대상 AED 목록
GET /api/aed-devices/[serial]              - 특정 AED 상세 정보
GET /api/aed-devices/priority              - 우선순위 기반 정렬
```

### 🛡️ API 보안 규칙

```typescript
// ❌ 절대 금지: 클라이언트에서 Supabase 직접 호출
import { createClient } from '@supabase/supabase-js' // 클라이언트에서 사용 금지!

// ✅ 올바른 패턴: API Route Handler 경유
// app/api/inspections/route.ts
import { createServerClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  const supabase = createServerClient()
  // 서버에서만 DB 접근
  const { data, error } = await supabase
    .from('inspections')
    .insert(...)

  return Response.json(data)
}
```

---

## 프론트엔드 상태 관리

### Zustand 스토어 구조

```typescript
// lib/state/inspection-session-store.ts
interface InspectionSessionStore {
  // 세션 정보
  currentSession: InspectionSession | null;
  currentStep: number;
  stepData: Record<string, any>;

  // 액션
  startSession: (deviceSerial: string) => Promise<void>;
  saveProgress: (step: number, data: any) => void;
  completeSession: () => Promise<void>;
  cancelSession: () => void;

  // 오프라인 지원
  pendingChanges: any[];
  syncPendingChanges: () => Promise<void>;
}
```

## React Query 통합

```typescript
// hooks/use-inspection-session.ts
export function useInspectionSession(sessionId: string) {
  return useQuery({
    queryKey: ['inspection-session', sessionId],
    queryFn: () => fetchSession(sessionId),
    staleTime: 1000 * 60 * 5, // 5분
    cacheTime: 1000 * 60 * 30, // 30분
    refetchOnWindowFocus: false,
  });
}

// hooks/use-save-progress.ts
export function useSaveProgress() {
  return useMutation({
    mutationFn: saveProgress,
    onSuccess: () => {
      queryClient.invalidateQueries(['inspection-session']);
    },
  });
}
```

---

## 점검 프로세스

### 🔄 점검 워크플로우

```typescript
// 점검 프로세스 전체 흐름
class InspectionWorkflow {
  // 1. 점검 대상 AED 조회
  async getAEDsForInspection(filters) {
    return await supabase
      .from('aed_inspection_status')
      .select('*')
      .order('priority_score', { ascending: false });
  }

  // 2. 점검 기록 생성
  async startInspection(equipmentSerial) {
    // equipment_serial 유효성 검사
    const aedDevice = await this.validateAEDDevice(equipmentSerial);

    // 점검 기록 생성
    return await supabase
      .from('inspections')
      .insert({
        equipment_serial: equipmentSerial,
        inspector_id: userId,
        confirmed_manufacturer: aedDevice.manufacturer,
        confirmed_model_name: aedDevice.model_name
      });
  }

  // 3. 점검 결과 업데이트
  async updateInspectionResults(inspectionId, results) {
    return await supabase
      .from('inspections')
      .update(results)
      .eq('id', inspectionId);
  }
}
```

### 7단계 점검 프로세스

### 단계별 컴포넌트 구조
```
components/inspection/steps/
├── BasicInfoStep.tsx        # 1. 기본 정보 확인
├── DeviceInfoStep.tsx       # 2. 장비 정보 점검
├── LocationVerificationStep.tsx  # 3. 위치 검증
├── StorageChecklistStep.tsx     # 4. 보관함 점검
├── SuppliesCheckStep.tsx        # 5. 소모품 확인
├── DataValidationStep.tsx       # 6. 데이터 검증
└── PhotoDocumentationStep.tsx   # 7. 사진/문서화
```

### 각 단계별 데이터 구조
```typescript
interface StepData {
  basicInfo: {
    management_number: string;
    installation_institution: string;
    contact_info: string;
    corrections?: string;
  };
  deviceInfo: {
    manufacturer: string;
    model_name: string;
    serial_number: string;
    replacement_date?: string;
  };
  location: {
    address_confirmed: boolean;
    gps_verified: boolean;
    installation_position: string;
    location_notes?: string;
  };
  storage: {
    storage_type: string;
    alarm_system: boolean;
    signage_status: string;
    checklist_items: Record<string, boolean>;
  };
  supplies: {
    battery_expiry: string;
    pad_expiry: string;
    additional_items: string[];
  };
  validation: {
    required_fields_complete: boolean;
    warnings: string[];
    priority_level: number;
  };
  documentation: {
    photos: string[]; // Storage URLs
    notes: string;
    inspector_signature?: string;
  };
}
```

---

## 성능 최적화

### 🚀 인덱스 전략

```sql
-- aed_data 테이블
CREATE UNIQUE INDEX idx_aed_data_equipment_serial ON aed_data(equipment_serial);
CREATE INDEX idx_aed_data_sido_manufacturer ON aed_data(sido, manufacturer);
CREATE INDEX idx_aed_data_expiry_dates ON aed_data(battery_expiry_date, patch_expiry_date);

-- inspections 테이블
CREATE INDEX idx_inspections_equipment_serial ON inspections(equipment_serial);
CREATE INDEX idx_inspections_equipment_date ON inspections(equipment_serial, inspection_date DESC);
CREATE INDEX idx_inspections_priority_status ON inspections(priority_level, overall_status, inspection_date DESC);
```

### 🔍 쿼리 최적화 예시

```sql
-- ✅ 점검 필요 AED 조회 (우선순위순)
SELECT equipment_serial, manufacturer, model_name, sido,
       inspection_priority, priority_score, last_inspection_date
FROM aed_inspection_status
WHERE sido = '서울'
ORDER BY priority_score DESC, last_inspection_date ASC
LIMIT 50;

-- ✅ 보건소별 점검 현황
SELECT jurisdiction_health_center,
       COUNT(*) as total_devices,
       COUNT(CASE WHEN inspection_priority = 'current' THEN 1 END) as up_to_date,
       COUNT(CASE WHEN inspection_priority IN ('overdue', 'never_inspected') THEN 1 END) as overdue
FROM aed_inspection_status
GROUP BY jurisdiction_health_center
ORDER BY (COUNT(CASE WHEN inspection_priority IN ('overdue', 'never_inspected') THEN 1 END)::FLOAT / COUNT(*)) DESC;
```

### 📈 확장성 고려사항

#### 수평적 확장 (80만대 대비)
- **파티셔닝**: 시도별 테이블 분할
- **인덱스 최적화**: 복합 인덱스 활용
- **캐싱**: Redis를 통한 자주 조회되는 데이터 캐싱

#### 기능적 확장
- **실시간 알림**: WebSocket 또는 Server-Sent Events
- **이미지 업로드**: S3 연동 및 썸네일 생성
- **보고서 생성**: PDF 자동 생성 및 이메일 발송

---

## 보안 및 권한

### 🔐 RLS (Row Level Security) 정책

```sql
-- 점검 기록 보안 정책
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;

-- 본인 점검 기록만 수정 가능
CREATE POLICY "inspections_own_records" ON inspections
  FOR ALL USING (inspector_id = auth.uid());

-- 같은 조직 점검 기록 조회 가능
CREATE POLICY "inspections_same_org_read" ON inspections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles up1
      JOIN user_profiles up2 ON up1.organization_id = up2.organization_id
      WHERE up1.id = auth.uid() AND up2.id = inspections.inspector_id
    )
  );

-- 관리자 모든 권한
CREATE POLICY "inspections_admin_all" ON inspections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('master', 'emergency_center_admin')
    )
  );
```

### 🛡️ 데이터 무결성 검사

```sql
-- 고아 점검 기록 확인 함수
CREATE FUNCTION check_orphaned_inspections()
RETURNS TABLE(inspection_id UUID, equipment_serial VARCHAR, inspection_date DATE)
AS $$
BEGIN
  RETURN QUERY
  SELECT i.id, i.equipment_serial, i.inspection_date
  FROM inspections i
  LEFT JOIN aed_data a ON i.equipment_serial = a.equipment_serial
  WHERE a.equipment_serial IS NULL;
END;
$$ LANGUAGE plpgsql;
```

---

## 오프라인 지원

### IndexedDB + React Query 캐싱

```typescript
// lib/offline/inspection-cache.ts
import { openDB } from 'idb';

const db = await openDB('inspection-cache', 1, {
  upgrade(db) {
    db.createObjectStore('sessions', { keyPath: 'id' });
    db.createObjectStore('pending-uploads', { keyPath: 'id' });
  },
});

// 오프라인 저장
export async function saveOfflineSession(session: InspectionSession) {
  await db.put('sessions', session);
}

// 온라인 복귀 시 동기화
export async function syncPendingSessions() {
  const pending = await db.getAll('pending-uploads');
  for (const session of pending) {
    await uploadSession(session);
    await db.delete('pending-uploads', session.id);
  }
}
```

---

## 🎯 예상 문제점 및 해결 방안

### 1. 데이터 정합성 문제
**문제**: 매일 데이터 교체 시 equipment_serial 불일치
**해결**:
- 교체 전 정합성 검사 스크립트 실행
- 고아 레코드 모니터링 알림 시스템
- equipment_serial 제약조건으로 무결성 보장

### 2. 성능 문제
**문제**: 80,766개 레코드 JOIN 시 성능 저하
**해결**:
- equipment_serial 인덱스 최적화
- 뷰(view) 사용으로 복잡한 쿼리 캐싱
- 페이지네이션으로 대량 데이터 처리

### 3. 동시성 문제
**문제**: 점검 중 데이터 교체 발생
**해결**:
- 점검 진행 중 알림 시스템
- 트랜잭션으로 원자성 보장
- 낙관적 잠금으로 충돌 해결

---

## 📊 전체 데이터베이스 테이블 목록

> **⚠️ 진실 공급원**: `supabase/migrations/` 폴더의 마이그레이션 파일
>
> **최종 확인일**: 2025-10-04

### ✅ 현재 사용 중인 테이블 (마이그레이션 기준)

#### 핵심 테이블
- `aed_data` - AED 장비 마스터 데이터 (81,331개 레코드)
- `inspections` - 점검 기록 (최종 테이블명)
- `inspection_sessions` - 점검 세션 관리
- `user_profiles` - 사용자 프로필
- `organizations` - 기관 정보

#### 일정 및 알림
- `inspection_schedules` - 점검 일정 템플릿
- `inspection_schedule_entries` - 점검 일정 항목
- `notifications` - 알림
- `notification_history` - 알림 이력
- `notification_templates` - 알림 템플릿
- `scheduled_notifications` - 예약 알림
- `user_notification_settings` - 사용자 알림 설정
- `push_subscriptions` - 푸시 구독

#### 인증 및 보안
- `login_history` - 로그인 이력
- `otp_rate_limits` - OTP 발송 제한
- `audit_logs` - 감사 로그
- `profile_change_history` - 프로필 변경 이력

#### 조직 및 팀
- `organization_change_requests` - 조직 변경 요청
- `team_members` - 팀 멤버
- `team_permissions` - 팀 권한
- `team_activity_logs` - 팀 활동 로그
- `task_assignments` - 작업 할당

#### GPS 및 데이터 분석
- `gps_issues` - GPS 문제 기록
- `gps_analysis_logs` - GPS 분석 로그
- `management_number_group_mapping` - 관리번호 그룹 매핑

#### 시스템
- `schema_migrations` - 스키마 마이그레이션 이력

### ❌ 삭제된 테이블 (마이그레이션에서 DROP됨)
- 초기 `inspections` 테이블 - Migration 06에서 삭제 후 재생성
- `aed_devices` - Migration 06에서 삭제 → `aed_data` 사용
- `aed_target_mapping` - 중복 데이터로 삭제
- `target_list_2024` - 임시 테이블, 삭제됨
- `email_verification_codes` - 초기 버전, 삭제됨

### ⚠️ 존재하지 않는 테이블 (더 이상 사용 안 함)
- ❌ `aed_inspections` - Migration 51에서 `inspections`로 이름 변경됨
- ❌ `aed_inspections_v2` - Migration 51 이전의 중간 이름, 현재 `inspections`
- ❌ `inspection_snapshots` - 계획만 있었고 구현 안 됨

---

## 📚 참고 문서

### 필수 참조 (진실 공급원)
1. **[ACTUAL_SCHEMA_REFERENCE.md](../../supabase/ACTUAL_SCHEMA_REFERENCE.md)** - 실제 DB 스키마
2. **[supabase/migrations/](../../supabase/migrations/)** - 마이그레이션 파일 (번호순)
3. **[DOCUMENTATION_POLICY.md](../DOCUMENTATION_POLICY.md)** - 문서 관리 정책

### 현재 문서
- [aed-data-state-management.md](./aed-data-state-management.md) - AED 데이터 상태 관리
- [current-status.md](./current-status.md) - 현재 프로젝트 상태

### 데이터베이스
- [06_fix_inspection_schema.sql](../../supabase/migrations/06_fix_inspection_schema.sql) - 점검 스키마
- [04_aed_tables.sql](../../supabase/migrations/04_aed_tables.sql) - AED 테이블 생성

### 아카이브 (역사적 기록, 참고 금지)
- [INSPECTION_ARCHITECTURE.md](../archive/INSPECTION_ARCHITECTURE.md) - 2025-09-13 DB 중심 설계서 (구버전)
- [archive/README.md](../archive/README.md) - 아카이브 폴더 경고문

---

## ⚠️ 주의사항

### 절대 금지
- ❌ 튜토리얼 컴포넌트 복사
- ❌ 클라이언트에서 Supabase 직접 호출
- ❌ aed_data 테이블 직접 수정

### 필수 준수
- ✅ 모든 DB 접근은 API Route Handler 경유
- ✅ React Query + Zustand 패턴 준수
- ✅ equipment_serial 기반 참조 사용

---

**최종 업데이트**: 2025-10-14
**설계 버전**: 3.2 (스냅샷 갱신 기능 추가 반영)
**진실 공급원**: `supabase/migrations/` + `ACTUAL_SCHEMA_REFERENCE.md`
**관리자**: AED Smart Check 개발팀

---

## 📌 문서 신뢰성 보증

이 문서는 다음을 기준으로 작성되었습니다:

✅ **마이그레이션 파일 검증 완료** (2025-10-08)
✅ **실제 테이블명 확인** (`inspections` - Migration 51에서 최종 확정)
✅ **테이블 이름 변경 이력 반영** (`aed_inspections` → `inspections`)
✅ **코드 구현 확인** (app/api/inspections/sessions/route.ts)
✅ **2025-10-14 업데이트**: 스냅샷 갱신 기능, Quick API 통합

---

## 📚 관련 문서

**필수 읽기**:
- **[inspection-data-flow.md](./inspection-data-flow.md)** - 점검 데이터 흐름 정책 및 실제 구현 상태 (2025-10-14)
- [aed-data-state-management.md](./aed-data-state-management.md) - AED 데이터 화면 상태 관리

**참조 문서**:
- [ACTUAL_SCHEMA_REFERENCE.md](../../supabase/ACTUAL_SCHEMA_REFERENCE.md) - 실제 DB 스키마
- [DOCUMENTATION_POLICY.md](../DOCUMENTATION_POLICY.md) - 문서 관리 정책
- Migration 20: `20_create_inspection_sessions.sql`
- Migration 28: `28_add_field_changes_to_sessions.sql`