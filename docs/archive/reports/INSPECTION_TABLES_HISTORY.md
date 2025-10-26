# Inspection 테이블 변경 이력

**최종 업데이트**: 2025-10-08
**목적**: inspection 관련 테이블의 전체 변경 이력 문서화

## 핵심 테이블: inspections

### 전체 변경 이력

```
┌─────────────────────────────────────────────────────┐
│ Migration 04 (2025-09-10)                           │
│ CREATE TABLE inspections                            │
│ - aed_devices 참조 (device_id FK)                   │
│ - 초기 점검 스키마                                    │
└──────────────┬──────────────────────────────────────┘
               │
               │ DROP (06에서 삭제)
               ▼
┌─────────────────────────────────────────────────────┐
│ Migration 06 (2025-09-13)                           │
│ DROP TABLE inspections CASCADE                      │
│ CREATE TABLE aed_inspections                        │
│ - equipment_serial 기반으로 재설계                   │
│ - aed_data 참조 (equipment_serial FK)               │
└──────────────┬──────────────────────────────────────┘
               │
               │ (중간 과정: aed_inspections → aed_inspections_v2?)
               │ (마이그레이션 파일에는 기록 없음)
               ▼
┌─────────────────────────────────────────────────────┐
│ Migration 51 (2025-10-05)                           │
│ ALTER TABLE aed_inspections_v2 RENAME TO inspections│
│ - aed_ 접두어 제거                                   │
│ - 네이밍 일관성 확보                                 │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
        ┌──────────────┐
        │ inspections  │ ← 현재 테이블명 (최종)
        └──────────────┘
```

### 핵심 변경 사항

1. **FK 참조 변경**:
   - Migration 04: `device_id` (aed_devices 참조)
   - Migration 06 이후: `equipment_serial` (aed_data 참조)

2. **테이블명 변경**:
   - `inspections` (04) → `aed_inspections` (06) → `inspections` (51)

3. **중간 이름 aed_inspections_v2**:
   - Migration 파일에는 생성 기록이 없음
   - Migration 51에서 이름 변경 시도
   - 실제로는 `aed_inspections`에서 직접 변경되었을 가능성

### 현재 상태 (2025-10-08)

**테이블명**: `inspections`
**스키마 기준**: Migration 06 (equipment_serial 기반)
**코드 사용**:
- `lib/services/aed-data-service.ts:122` - `.from('inspections')`
- `app/api/inspections/quick/route.ts:83` - `.from('inspections')`

---

## 관련 VIEW: inspection_status

### 변경 이력

```
Migration 06 (2025-09-13):
  CREATE VIEW aed_inspection_status

Migration 51 (2025-10-05):
  ALTER VIEW aed_inspection_status RENAME TO inspection_status
```

**현재 VIEW명**: `inspection_status`

---

## 기타 Inspection 테이블들

### inspection_schedules
- **생성**: Migration 05 (2025-09-10) - `team_management.sql`
- **이름 변경**: 없음 (처음부터 `inspection_schedules`)
- **Migration 54 불필요**: `aed_inspection_schedules`가 존재한 적 없음

### inspection_schedule_entries
- **생성**: Migration 16 (날짜 미상)
- **이름 변경**: 없음 (처음부터 `inspection_schedule_entries`)
- **목적**: 점검 일정 항목 관리

### inspection_sessions
- **생성**: Migration 20 (날짜 미상)
- **이름 변경**: 없음 (처음부터 `inspection_sessions`)
- **목적**: 진행중인 점검 세션 관리

### inspection_assignments
- **생성**: Migration 파일 미확인
- **상태**: 계획 단계 또는 별도 생성
- **목적**: 점검 할당 관리

---

## 삭제된 테이블

### aed_devices
- **생성**: Migration 04
- **삭제**: Migration 06 (`DROP TABLE IF EXISTS public.aed_devices CASCADE`)
- **대체**: `aed_data` 테이블 사용

---

## 문서 업데이트 체크리스트

### 완료 ✅
- [x] `docs/current/inspection-architecture.md` - inspections 테이블 반영
- [x] `docs/reference/architecture-overview.md` - 테이블 수 업데이트

### 확인 필요
- [ ] `README.md` - inspection 테이블 언급 여부
- [ ] `supabase/README.md` - 스키마 문서
- [ ] `docs/current/current-status.md` - 테이블 리스트
- [ ] 기타 planning 문서들

---

## 참고 문서

- [TABLE_RENAME_PLAN.md](TABLE_RENAME_PLAN.md) - 원래 계획 (Migration 51 실행 계획)
- [supabase/migrations/51_rename_inspection_tables.sql](supabase/migrations/51_rename_inspection_tables.sql) - 실제 실행된 마이그레이션
- [supabase/migrations/06_fix_inspection_schema.sql](supabase/migrations/06_fix_inspection_schema.sql) - aed_inspections 재설계
- [supabase/migrations/04_aed_tables.sql](supabase/migrations/04_aed_tables.sql) - 초기 inspections 테이블

---

**작성자**: AED Smart Check 개발팀
**목적**: 테이블 이름 변경으로 인한 혼란 방지 및 역사 기록
