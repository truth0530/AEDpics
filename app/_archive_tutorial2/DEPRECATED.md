# ⚠️ DEPRECATED - Tutorial2

**상태**: 폐기됨 (Deprecated)
**날짜**: 2025-10-04
**이유**: 실제 DB 스키마와 불일치

---

## 문제점

이 폴더의 코드는 **`aed_inspections` 테이블**을 사용하도록 작성되었으나,
실제 Production DB에는 **`aed_inspections_v2` 테이블**만 존재합니다.

따라서 이 코드를 실행하면 **런타임 에러**가 발생합니다:

```
Could not find the table 'public.aed_inspections' in the schema cache
```

---

## 영향 받는 파일

- `services/InspectionService.ts` - `aed_inspections` 테이블 사용 (5군데)
- 기타 tutorial2 관련 컴포넌트

---

## 대체 방안

**현재 사용 중인 점검 시스템**:
- API: `/api/inspections/quick/` (✅ `aed_inspections_v2` 사용)
- 컴포넌트: `components/inspection/` 폴더

**문서**:
- [inspection-architecture.md](../docs/current/inspection-architecture.md) - 최신 아키텍처

---

## 조치사항

1. ❌ **이 폴더의 코드를 사용하지 마세요**
2. ✅ 새로운 점검 기능은 `components/inspection/` 기반으로 개발
3. ✅ API는 `/api/inspections/` 사용

---

**작성자**: Senior Developer
**검증일**: 2025-10-04
