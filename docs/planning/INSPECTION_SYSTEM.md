# 점검 시스템 통합 문서

**최종 업데이트**: 2025-10-09
**상태**: ✅ 구현 완료 및 운영 중
**통합 문서**: inspection-data-flow-final.md, snapshot-refresh-implementation.md, inspection-system-design.md

---

## 📋 목차

1. [시스템 개요](#시스템-개요)
2. [데이터 구조](#데이터-구조)
3. [스냅샷 자동 갱신 시스템](#스냅샷-자동-갱신-시스템)
4. [8단계 점검 프로세스](#8단계-점검-프로세스)
5. [API 엔드포인트](#api-엔드포인트)
6. [구현 상태](#구현-상태)

---

## 시스템 개요

### 핵심 목표
AED 점검 세션의 데이터 신선도를 자동으로 보장하고, 8단계 점검 프로세스를 통해 체계적인 현장 점검을 수행합니다.

### 주요 기능
1. **스냅샷 자동 갱신**: 점검 세션 데이터의 최신성 보장
2. **3-Tier 데이터 저장**: original_data, registered_data, inspected_data
3. **8단계 점검 플로우**: 기본 정보 → 장비 정보 → 위치 → 소모품 → 검증 → 문서화
4. **백그라운드 갱신**: 사용자 경험을 방해하지 않는 비동기 갱신

---

## 데이터 구조

### inspection_sessions 테이블

```sql
CREATE TABLE inspection_sessions (
  id UUID PRIMARY KEY,
  equipment_serial VARCHAR(255) NOT NULL,
  inspector_id UUID NOT NULL,

  -- 스냅샷 관리
  original_snapshot JSONB,           -- 세션 시작 시점 (불변)
  current_snapshot JSONB,             -- 갱신된 최신 데이터
  snapshot_updated_at TIMESTAMPTZ,    -- 마지막 갱신 시간
  last_accessed_at TIMESTAMPTZ,       -- 마지막 접근 시간

  -- 갱신 상태 추적
  refresh_status VARCHAR(20) DEFAULT 'idle',
  refresh_error TEXT,

  -- 점검 데이터
  step_data JSONB DEFAULT '{}',       -- 각 단계 입력 데이터
  field_changes JSONB DEFAULT '{}',   -- 변경된 필드 추적

  -- 상태 관리
  status VARCHAR(20) DEFAULT 'draft',
  current_step INTEGER DEFAULT 0,

  -- 시간 추적
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### inspections 테이블 (최종 점검 기록)

```sql
CREATE TABLE inspections (
  id UUID PRIMARY KEY,
  equipment_serial VARCHAR(255) NOT NULL,
  inspector_id UUID NOT NULL,

  -- 3-Tier 데이터 저장
  original_data JSONB,      -- 세션 시작 시점 데이터
  registered_data JSONB,    -- 점검 완료 시점 등록 데이터
  inspected_data JSONB,     -- 점검자가 확인/수정한 데이터

  -- 변경 사항
  field_changes JSONB,      -- 수정된 필드 목록

  -- 점검 정보
  inspection_date TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 스냅샷 자동 갱신 시스템

### v2.1 아키텍처

**4주 단계적 마이그레이션 전략**:
- Week 1: DB 컬럼 추가 (하위 호환성 100%)
- Week 2: API 듀얼 모드 (양쪽 모두 지원)
- Week 3: 프론트엔드 전환
- Week 4: device_info 제거 (2025-10-16 예정)

### 갱신 정책

| 조건 | 갱신 여부 | 이유 |
|------|----------|------|
| 점검 진행 중 (step > 0) | ❌ 안함 | 점검 중 데이터 변경 방지 |
| 1시간 이내 갱신 | ❌ 안함 | 불필요한 갱신 방지 |
| 이미 갱신 중 | ❌ 안함 | 중복 갱신 방지 |
| draft + 12시간 경과 | ✅ 갱신 | 테스트 세션 데이터 갱신 |
| 24시간 경과 | ✅ 갱신 | 모든 세션 일일 갱신 |

### 비동기 갱신 플로우

```
사용자 요청 → API
           ↓
    세션 즉시 반환 (~60ms)
           ↓
    last_accessed_at 업데이트 (비차단)
           ↓
    갱신 필요 여부 체크
           ↓
    중복 갱신 확인 (메모리 캐시)
           ↓
    refresh_status = 'refreshing'
           ↓
    백그라운드 갱신 시작 (비차단)
           ↓
    2-3초 후 UI 자동 반영
           ↓
    refresh_status = 'success' or 'failed'
```

### 성능 최적화

| 작업 | 최적화 전 | 최적화 후 | 개선율 |
|------|----------|----------|--------|
| 세션 조회 (갱신 불필요) | ~60ms | ~60ms | 0% |
| 세션 조회 (갱신 필요) | ~211ms | ~60ms | 71.6% ↓ |
| 사용자 체감 대기 시간 | ~211ms | ~60ms | 71.6% ↓ |
| 갱신 완료 시간 | 즉시 | 2-3초 후 | 비차단 |
| 중복 갱신 방지 | 없음 | 100% | 완전 차단 |

---

## 8단계 점검 프로세스

### 1. 기본 정보 확인 (BasicInfoStep)
- 관리번호, 장비연번, 설치기관, 주소, 담당자 연락처
- 원본 데이터와 현장 데이터 비교
- 변경 사항 자동 추적

### 2. 장비 정보 점검 (DeviceInfoStep)
- 제조사, 모델명, 일련번호
- 장치 상태 (normal/warning/malfunction/damaged)
- 표시등 상태 (green/red/blinking/off)
- 교체 예정일 자동 계산

### 3. 위치 검증 (LocationVerificationStep)
- 위치 확인 완료 여부
- 안내 표지판 설치 상태
- 접근성 확인
- GPS 좌표 자동 수집

### 4. 지도 위치 확인 (LocationMapStep)
- 등록된 좌표와 실제 위치 비교
- 거리 차이 계산
- 100m 이상 차이 시 경고

### 5. 보관함 점검 (StorageChecklistStep)
- 보관함 형태 (wall_mounted/standalone/cabinet/outdoor)
- 경보 시스템 설치 여부
- 6개 필수 체크리스트

### 6. 소모품 확인 (SuppliesCheckStep)
- 배터리 상태 및 유효기간
- 패드 상태 및 유효기간
- 30일 이내 만료 시 자동 경고

### 7. 데이터 검증 (DataValidationStep)
- 모든 필드 입력 완료 여부
- 필수 항목 검증
- 자동 검증 요약

### 8. 사진 및 문서화 (PhotoDocumentationStep)
- 필수 사진 3장 (장치 전체, 배터리, 패드)
- 선택 사진 (보관함, 표지판 등)
- 점검 시간 자동 기록

---

## API 엔드포인트

### 세션 관리

**세션 시작**
```http
POST /api/inspections/sessions
Content-Type: application/json

{
  "equipmentSerial": "AED-12345",
  "deviceSnapshot": { ... }
}

Response:
{
  "session": {
    "id": "uuid",
    "equipment_serial": "AED-12345",
    "original_snapshot": { ... },
    "current_snapshot": { ... },
    "refresh_status": "idle"
  }
}
```

**세션 조회 (자동 갱신 포함)**
```http
GET /api/inspections/sessions?sessionId=uuid

Response:
{
  "session": { ... },
  "refreshing": false,
  "refreshStatus": "success"
}
```

**수동 갱신**
```http
POST /api/inspections/sessions/{id}/refresh

Response:
{
  "success": true,
  "snapshot_updated_at": "2025-10-09T10:00:00Z",
  "message": "갱신이 완료되었습니다."
}
```

**세션 완료**
```http
PATCH /api/inspections/sessions/{id}
Content-Type: application/json

{
  "status": "completed",
  "final_data": { ... }
}

# RPC 함수 호출:
# complete_inspection_session(session_id, final_data)
# → inspections 테이블에 3-tier 데이터 저장
```

### RPC 함수

**complete_inspection_session**
```sql
CREATE OR REPLACE FUNCTION complete_inspection_session(
  p_session_id UUID,
  p_final_data JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  v_session inspection_sessions%ROWTYPE;
  v_latest_aed_data JSONB;
BEGIN
  -- 세션 정보 가져오기
  SELECT * INTO v_session
  FROM inspection_sessions
  WHERE id = p_session_id;

  -- 최신 aed_data 조회
  SELECT to_jsonb(a.*) INTO v_latest_aed_data
  FROM aed_data a
  WHERE a.equipment_serial = v_session.equipment_serial
  LIMIT 1;

  -- 3-tier 데이터 저장
  INSERT INTO inspections (
    equipment_serial,
    inspector_id,
    original_data,        -- v_session.original_snapshot
    registered_data,      -- v_latest_aed_data
    inspected_data,       -- v_session.step_data
    field_changes,
    inspection_date
  ) VALUES (
    v_session.equipment_serial,
    v_session.inspector_id,
    v_session.original_snapshot,
    v_latest_aed_data,
    v_session.step_data,
    v_session.field_changes,
    NOW()
  );

  -- 세션 완료 처리
  UPDATE inspection_sessions
  SET status = 'completed',
      completed_at = NOW()
  WHERE id = p_session_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 구현 상태

### ✅ 완료된 기능 (2025-10-09)

1. **데이터베이스 스키마**
   - Migration 55: 스냅샷 컬럼 추가 ([55_add_snapshot_refresh_v2_1.sql](../../supabase/migrations/55_add_snapshot_refresh_v2_1.sql))
   - Migration 56: RPC 함수 3-tier 데이터 저장 ([56_add_3tier_data_to_complete_inspection.sql](../../supabase/migrations/56_add_3tier_data_to_complete_inspection.sql))

2. **백그라운드 갱신 시스템**
   - 비동기 갱신 로직
   - LRU 캐시 중복 방지
   - 타임스탬프 기반 타임아웃

3. **8단계 점검 플로우**
   - 모든 스텝 컴포넌트 구현
   - 3단 레이아웃 (원본-점검-상태)
   - 실시간 검증 로직

4. **API 엔드포인트**
   - 세션 CRUD
   - 자동 갱신 API
   - 수동 갱신 API
   - RPC 함수 통합

### ⏳ 예정 작업 (Week 4 - 2025-10-16)

1. **device_info 컬럼 제거**
   - 1주간 안정성 모니터링
   - Migration 57 실행 (device_info DROP)
   - 선행 조건: API와 프론트엔드에서 current_snapshot 전환 완료

2. **모니터링 항목**
   - 에러율 < 0.1%
   - 갱신 성공률 > 95%
   - 사용자 피드백 수집

---

## 마이그레이션

### ✅ 완료된 마이그레이션

| 번호 | 파일명 | 설명 | 실행일 |
|------|--------|------|--------|
| 55 | [55_add_snapshot_refresh_v2_1.sql](../../supabase/migrations/55_add_snapshot_refresh_v2_1.sql) | 스냅샷 자동 갱신 컬럼 추가 (v2.1) | 2025-10-09 |
| 56 | [56_add_3tier_data_to_complete_inspection.sql](../../supabase/migrations/56_add_3tier_data_to_complete_inspection.sql) | 3-Tier 데이터 저장 (original, registered, inspected) | 2025-10-09 |

### ⏳ 예정된 마이그레이션

| 번호 | 파일명 | 설명 | 예정일 |
|------|--------|------|--------|
| 57 | 57_remove_device_info.sql | device_info 컬럼 제거 (하위 호환성 종료) | Week 4 (2025-10-16) |

### 📚 마이그레이션 상세 가이드

- [MIGRATION_GUIDE.md](../reference/MIGRATION_GUIDE.md) - 전체 마이그레이션 가이드
  - Phase 7: 스냅샷 자동 갱신 시스템 v2.1 (55-56번)
  - 검증 쿼리 및 주의사항
  - Week 4 이후 계획

---

## 참고 문서

- **마이그레이션**: [MIGRATION_GUIDE.md](../reference/MIGRATION_GUIDE.md) - 데이터베이스 마이그레이션 전체 가이드
- **매핑 시스템**: [MAPPING_SYSTEM.md](./MAPPING_SYSTEM.md) - 구비의무기관 매핑
- **운영 정책**: [OPERATIONAL_POLICIES.md](./OPERATIONAL_POLICIES.md) - 점검 할당 정책
- **프로젝트 상태**: [PROJECT_STATUS.md](../PROJECT_STATUS.md)

---

**작성**: AED Smart Check 개발팀
**최종 업데이트**: 2025-10-09
**상태**: ✅ 운영 중
**레코드**: inspection_sessions 3,047개, inspections 운영 중
