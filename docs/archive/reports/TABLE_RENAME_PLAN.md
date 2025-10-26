# Inspection 테이블 네이밍 통일 계획

**작성일**: 2025-10-05
**목적**: inspection 관련 테이블명에서 `aed_` 접두어 제거 및 통일

## 변경 매핑 테이블

### 테이블 (Tables)

| 현재 이름 | 새 이름 | 비고 |
|---------|--------|------|
| `aed_inspections_v2` | `inspections` | ✅ 실제 DB 존재, 최종 점검 기록 |
| `inspection_sessions` | `inspection_sessions` | ✅ 변경 없음 |
| `inspection_schedules` | `inspection_schedules` | ✅ 변경 없음 (Migration 05) |
| `inspection_schedule_entries` | `inspection_schedule_entries` | ✅ 변경 없음 (Migration 16) |
| `inspection_assignments` | `inspection_assignments` | ✅ 변경 없음 (새로 생성할 테이블) |

### 뷰 (Views)

| 현재 이름 | 새 이름 | 비고 |
|---------|--------|------|
| `aed_inspection_status` | `inspection_status` | Migration 06 |
| `health_center_inspection_summary` | `health_center_inspection_summary` | ✅ 변경 없음 |
| `health_center_inspection_stats` | `health_center_inspection_stats` | ✅ 변경 없음 |
| `inspection_priorities` | `inspection_priorities` | ✅ 변경 없음 |
| `inspection_schedule_overview` | `inspection_schedule_overview` | ✅ 변경 없음 |
| `inspection_session_stats` | `inspection_session_stats` | ✅ 변경 없음 |

### 함수 (Functions)

| 현재 이름 | 새 이름 | 비고 |
|---------|--------|------|
| `complete_inspection_session` | `complete_inspection_session` | ✅ 변경 없음 (내부적으로 inspections 참조) |
| `get_active_session` | `get_active_session` | ✅ 변경 없음 |

## 최종 변경 사항 요약

**실제 변경 필요한 항목**: 2개
1. ✅ 테이블: `aed_inspections_v2` → `inspections`
2. ✅ 뷰: `aed_inspection_status` → `inspection_status`

## 영향 받는 파일 목록

### 1. 마이그레이션 파일 (SQL)
- `supabase/migrations/06_fix_inspection_schema.sql` (aed_inspections, aed_inspection_status)
- `supabase/migrations/20_create_inspection_sessions.sql` (aed_inspections_v2 참조)
- `supabase/migrations/28_add_field_changes_to_sessions.sql` (확인 필요)

### 2. API 코드 (TypeScript)
- `app/api/inspections/quick/route.ts`
- `app/api/inspections/sessions/route.ts`
- `app/api/schedules/route.ts`
- `lib/stats.ts`
- `tests/api/inspections.test.ts`

### 3. 컴포넌트 코드 (TypeScript/React)
- `app/(authenticated)/team-dashboard/team-dashboard-client.tsx`
- `lib/realtime/*.ts` (여러 파일)
- `lib/services/aed-data-service.ts`

### 4. 문서 파일 (Markdown)
- `docs/current/inspection-architecture.md`
- `docs/planning/*.md` (여러 파일)
- `supabase/ACTUAL_SCHEMA_REFERENCE.md`
- 기타 문서 20+ 파일

## 실행 순서

### Phase 1: Supabase DB 직접 변경 (안전)
```sql
-- 1. 뷰 이름 변경 (의존성 없음)
ALTER VIEW aed_inspection_status RENAME TO inspection_status;

-- 2. 테이블 이름 변경 (FK, 트리거 자동 유지됨)
ALTER TABLE aed_inspections_v2 RENAME TO inspections;

-- 3. 검증
\dt inspections
\dv inspection_status
```

### Phase 2: RPC 함수 재생성
```sql
-- Migration 20의 complete_inspection_session 함수 재실행
-- INSERT INTO aed_inspections_v2 → INSERT INTO inspections
```

### Phase 3: 코드 일괄 변경
1. 마이그레이션 파일
2. TypeScript/JavaScript 코드
3. 문서 파일

### Phase 4: 검증
```bash
# 1. 남은 참조 확인
grep -r "aed_inspections_v2" --include="*.ts" --include="*.sql" --include="*.md"
grep -r "aed_inspection_status" --include="*.ts" --include="*.sql" --include="*.md"

# 2. 새 이름 정상 작동 확인
grep -r "from('inspections')" --include="*.ts"
grep -r "from('inspection_status')" --include="*.ts"
```

## 롤백 계획

문제 발생 시:
```sql
-- 즉시 되돌리기
ALTER TABLE inspections RENAME TO aed_inspections_v2;
ALTER VIEW inspection_status RENAME TO aed_inspection_status;
```

## 체크리스트

- [ ] Phase 1: DB 테이블/뷰 이름 변경
- [ ] Phase 2: RPC 함수 재생성
- [ ] Phase 3-1: Migration 파일 수정
- [ ] Phase 3-2: TypeScript 코드 수정
- [ ] Phase 3-3: 문서 파일 수정
- [ ] Phase 4: grep 검증
- [ ] 최종 테스트: 점검 기능 동작 확인
