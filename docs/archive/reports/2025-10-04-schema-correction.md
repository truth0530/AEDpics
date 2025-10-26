# 데이터베이스 스키마 문서 정정 보고서

**작성일**: 2025-10-04
**작성자**: Senior Developer
**검증 기준**: Production DB 실제 상태

---

## 📋 개요

2차 인턴의 보고서를 기반으로 문서와 실제 DB 간 불일치를 검증하고 수정했습니다.

---

## 🔍 검증 결과

### 1. ✅ aed_inspections vs aed_inspections_v2 (인턴 보고서: 타당)

**발견 사항**:
- **실제 Production DB**: `aed_inspections_v2` 테이블만 존재 (35개 레코드)
- **문서**: `aed_inspections` 표기
- **Migration 06**: `aed_inspections` 생성 SQL 있으나 **미적용**

**영향 분석**:
```
코드 사용 현황:
✅ /api/inspections/quick/route.ts → aed_inspections_v2 사용 (정상)
❌ /tutorial2/services/InspectionService.ts → aed_inspections 사용 (작동 불가)
```

**조치 완료**:
1. ✅ [inspection-architecture.md](current/inspection-architecture.md#L81-L130) 수정
   - 테이블명 `aed_inspections` → `aed_inspections_v2`
   - 실제 스키마로 업데이트 (19개 컬럼)
   - Production 검증일 명시

2. ✅ [inspection-system-design.md](planning/inspection-system-design.md#L143) 수정
   - 테이블명 변경 및 주의사항 추가

3. ✅ [tutorial2/DEPRECATED.md](../app/tutorial2/DEPRECATED.md) 생성
   - 폐기된 코드 경고 문서 작성
   - 대체 방안 안내

---

### 2. ✅ inspection_snapshots, field_modifications (인턴 보고서: 타당)

**발견 사항**:
- [INSPECTION_REDESIGN_PLAN.md](archive/2025-10/deprecated_plans/INSPECTION_REDESIGN_PLAN.md)에만 정의
- **실제 DB에 존재하지 않음**
- 해당 문서는 이미 `deprecated_plans/` 폴더에 위치

**조치 완료**:
- ✅ 폴더 위치가 이미 적절함 (archive/deprecated_plans/)
- ✅ 추가 조치 불필요

---

### 3. ✅ inspection_schedules vs aed_inspection_schedules (인턴 보고서: 타당)

**발견 사항**:
- **실제 DB**: `aed_inspection_schedules` 존재
- Migration 16에서 생성됨

**조치 완료**:
- ✅ 현행 문서는 이미 `aed_inspection_schedules` 사용 중
- ✅ 아카이브 문서는 역사 보존 차원에서 수정 안 함

---

### 4. ⚠️ audit_logs, login_history (인턴 보고서: 부분 타당)

**발견 사항**:
- **Migration 파일 존재**:
  - `20250927_create_audit_logs.sql`
  - `20250927_create_missing_tables.sql`
- **실제 DB**: 두 테이블 **미생성**
- **원인**: 마이그레이션이 Production에 적용되지 않음

**조치 필요** (후속 작업):
```bash
# Supabase Dashboard SQL Editor에서 실행 필요
/supabase/migrations/20250927_create_missing_tables.sql
/supabase/migrations/20250927_create_audit_logs.sql
```

**문서 조치**:
- ✅ [db-fix-guide.md](troubleshooting/db-fix-guide.md) 이미 존재
- ✅ 수동 실행 가이드 포함됨

---

### 5. ❌ aed_data 테이블 부재 (인턴 보고서: 오류)

**발견 사항**:
- **실제 DB**: `aed_data` 테이블 **존재함** ✅
- 인턴이 참조한 문서는 오래된 아카이브

**조치 완료**:
- ✅ 아카이브 문서는 수정하지 않음 (역사 보존)

---

## 📊 수정 요약

| 항목 | 파일 | 수정 내용 | 상태 |
|------|------|----------|------|
| 1 | inspection-architecture.md | 테이블명 및 스키마 수정 | ✅ 완료 |
| 2 | inspection-system-design.md | 테이블명 변경 | ✅ 완료 |
| 3 | tutorial2/DEPRECATED.md | 폐기 경고 문서 생성 | ✅ 완료 |
| 4 | field_changes 컬럼 | 문서 통일 (1차 인턴 지적) | ✅ 완료 |

---

## 🎯 실제 Production 스키마 (2025-10-04 검증)

### 점검 관련 테이블

1. **aed_inspections_v2** (35개 레코드)
   ```sql
   컬럼: aed_data_id, battery_status, completed_at, created_at,
         equipment_serial, id, inspection_date, inspection_latitude,
         inspection_longitude, inspection_type, inspector_id, issues_found,
         notes, operation_status, overall_status, pad_status,
         photos, updated_at, visual_status
   ```

2. **inspection_sessions** (field_changes 포함)
   ```sql
   컬럼: cancelled_at, completed_at, created_at, current_step,
         device_info, equipment_serial, field_changes, id,
         inspector_id, notes, paused_at, resumed_at,
         started_at, status, step_data, updated_at
   ```

3. **aed_inspection_schedules**
   - 실제 존재 확인

---

## ⚠️ 주의사항

### 코드 사용 금지
- ❌ `/app/tutorial2/` 폴더의 모든 코드
- 이유: `aed_inspections` 테이블 참조 (존재하지 않음)

### 사용 가능한 코드
- ✅ `/api/inspections/quick/route.ts` - `aed_inspections_v2` 사용
- ✅ `/components/inspection/` - 최신 점검 컴포넌트

---

## 📚 참고 문서

### 최신 문서 (현행)
- [inspection-architecture.md](current/inspection-architecture.md) ✅ 업데이트됨
- [inspection-system-design.md](planning/inspection-system-design.md) ✅ 업데이트됨

### 아카이브 문서
- [INSPECTION_REDESIGN_PLAN.md](archive/2025-10/deprecated_plans/INSPECTION_REDESIGN_PLAN.md) (미구현 계획)
- 아카이브 문서는 역사 보존을 위해 수정하지 않음

---

## 🔄 향후 작업

1. **마이그레이션 실행** (우선순위: 중)
   - `audit_logs` 테이블 생성
   - `login_history` 테이블 생성

2. **Migration 정리** (우선순위: 낮)
   - Migration 06의 `aed_inspections` 제거 또는 주석 처리
   - `aed_inspections_v2` 생성 마이그레이션 문서화

3. **Tutorial2 완전 제거** (우선순위: 낮)
   - 현재는 DEPRECATED 표시만 함
   - 향후 완전 삭제 고려

---

**검증 방법**:
```javascript
// Production DB 직접 확인
const { data } = await supabase.from('aed_inspections_v2').select('*').limit(1);
const { data: sessions } = await supabase.from('inspection_sessions').select('*').limit(1);
```

**최종 검토**: 2025-10-04
**다음 검토 예정**: 2025-11-01
