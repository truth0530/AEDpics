# 0-Stage 완료 - 긴급 기술 부채 해결

**작성일**: 2025-11-06
**상태**: ✅ 완료
**커밋**: 5d5c2fe

---

## 개요

검증 기반 분석에서 식별된 2개의 CRITICAL 기술 부채를 모두 해결했습니다. 이 0-Stage 작업은 **다음 단계들의 선행 조건**으로, 반드시 먼저 완료되어야 했습니다.

---

## 0-1: unavailable_reason Enum 수정 ✅

### 문제
```
Schema (prisma/schema.prisma):
enum unavailable_reason {
  disposed
  broken
  other
}

Code (mark-unavailable/route.ts 라인 39):
if (!reason || !['disposed', 'broken', 'lost', 'other'].includes(reason)) {
```

**Enum 불일치**: 코드에서 'lost' 값을 사용하지만 스키마에 정의되지 않음
→ 런타임 검증 실패 발생 가능

### 해결책

#### 1.1 스키마 업데이트
**파일**: prisma/schema.prisma (라인 935-939)
```typescript
enum unavailable_reason {
  disposed
  broken
  lost        // ← 추가됨
  other
}
```

#### 1.2 데이터베이스 마이그레이션
**파일**: prisma/migrations/20251106_add_lost_to_unavailable_reason/migration.sql

```sql
-- PostgreSQL enum 값 추가 (이미 존재하면 스킵)
ALTER TYPE "aedpics"."unavailable_reason" ADD VALUE 'lost' BEFORE 'other';
```

**실행**: `npx prisma migrate deploy` 성공

#### 1.3 Prisma 클라이언트 재생성
```bash
npx prisma generate
```

### 검증 결과

| 항목 | 결과 |
|-----|------|
| 마이그레이션 적용 | ✅ 성공 |
| Prisma 클라이언트 생성 | ✅ 성공 |
| TypeScript 컴파일 | ✅ 통과 |
| 빌드 | ✅ 성공 |

---

## 0-2: unavailable 통계 집계 누락 해결 ✅

### 문제

**파일**: lib/aed/dashboard-queries.ts

#### 문제 상황
- DashboardStats 인터페이스: unavailable, unavailableMandatory, unavailableNonMandatory 필드 정의됨
- SQL 쿼리: 이들 통계 집계 없음
- 반환값: 모두 hardcoded 0

```typescript
// 라인 702-704 (수정 전)
unavailable: 0,
unavailableMandatory: 0,
unavailableNonMandatory: 0,
```

**결과**: 대시보드에서 unavailable 상태의 AED 건수가 항상 0으로 표시됨

### 해결책

#### 2.1 unavailable 건수 쿼리 추가
**위치**: lib/aed/dashboard-queries.ts (라인 534-586)

3가지 시나리오별 쿼리 추가:
- 전국 시도별 집계
- 특정 시도의 구군별 집계
- 특정 구군의 집계

**쿼리 특징**:
```sql
SELECT
  a.region as region,  -- gugun or sido
  COUNT(DISTINCT ia.id)::bigint as count,
  COUNT(DISTINCT CASE WHEN a.category_1 = '구비의무기관' THEN ia.id END)::bigint as mandatory_count,
  COUNT(DISTINCT CASE WHEN a.category_1 != '구비의무기관' THEN ia.id END)::bigint as non_mandatory_count
FROM aedpics.inspection_assignments ia
INNER JOIN aedpics.aed_data a ON ia.equipment_serial = a.equipment_serial
WHERE ia.status = 'unavailable'  -- ← 핵심 필터
GROUP BY region
```

**의무기관 구분**: category_1 필드로 의무/비의무 기관 분류

#### 2.2 unavailableCountMap 추가
**위치**: lib/aed/dashboard-queries.ts (라인 632-642)

```typescript
const unavailableCountMap = new Map(
  unavailableCounts.map(ac => [
    ac.region,
    {
      total: Number(ac.count),
      mandatory: Number(ac.mandatory_count),
      nonMandatory: Number(ac.non_mandatory_count)
    }
  ])
);
```

#### 2.3 데이터 추출 및 반환
**위치**: lib/aed/dashboard-queries.ts (라인 674-678, 708-710)

```typescript
// 데이터 추출
const unavailableData = unavailableCountMap.get(stat.region) || { total: 0, mandatory: 0, nonMandatory: 0 };
const unavailable = unavailableData.total;
const unavailableMandatory = unavailableData.mandatory;
const unavailableNonMandatory = unavailableData.nonMandatory;

// 반환값 (hardcoded 0에서 변경)
unavailable,              // 0 → 실제 값
unavailableMandatory,     // 0 → 실제 값
unavailableNonMandatory,  // 0 → 실제 값
```

### 검증 결과

| 항목 | 결과 |
|-----|------|
| 쿼리 문법 검증 | ✅ 통과 |
| TypeScript 타입 검사 | ✅ 통과 |
| ESLint | ✅ 통과 |
| 빌드 (141 페이지) | ✅ 성공 |

---

## 영향 범위 분석

### 직접 영향
1. **unavailable_reason enum** 사용 시:
   - mark-unavailable/route.ts: 이제 'lost' 값 검증 성공
   - inspection_assignments: 'lost' 값 저장 가능

2. **Dashboard 통계**:
   - unavailable 필드: 이제 실제 건수 표시
   - unavailableMandatory: 의무기관 중 불가 건수 표시
   - unavailableNonMandatory: 비의무기관 중 불가 건수 표시

### 간접 영향
- 점검 통계 기능 정확성 향상
- 향후 상태 전환 UI (unavailable ↔ pending) 구현 기반 준비

---

## 기술 스택 확인

### 사용된 기술
- **PostgreSQL Enum**: ALTER TYPE ... ADD VALUE
- **Prisma Migration**: SQL 기반 마이그레이션
- **Raw SQL**: $queryRaw 템플릿
- **TypeScript**: 타입 안정성 확보

### 버전 정보
- Prisma: v6.18.0
- Next.js: 15.5.2
- PostgreSQL: NCP Cloud DB

---

## 다음 단계 (1-Stage 이후)

0-Stage가 완료되었으므로, 다음 4개 스테이지를 순차적으로 진행 가능:

1. **1-Stage: Export 엔드포인트 구현** (3-4시간)
   - /api/inspections/export/route.ts 신규 생성
   - enforceFilterPolicy 재사용

2. **2-Stage: 점검 이력 수정 기능** (4-6시간)
   - Phase 2-1: 스키마 (modified_by, reason 필드)
   - Phase 2-2: 백엔드 (PUT 엔드포인트)
   - Phase 2-3: 프론트엔드 (EditStep 컴포넌트)

3. **3-Stage: 불가 상태 UI 완성** (2-3시간)
   - 점검불가 사유 선택 모달
   - 재점검 상태 전환
   - 통계 자동 갱신

4. **4-Stage: CPR 필드** (3-4시간 - 조사 필요)
   - 추가 필요성 검증 필요
   - 조건부 구현

---

## 커밋 정보

```
Commit: 5d5c2fe
Author: Claude Code
Date: 2025-11-06

feat: 0-Stage 긴급 수정 - enum 불일치 및 통계 집계 누락 해결

Changes:
  - schema.prisma: unavailable_reason enum에 'lost' 추가
  - migrations/20251106_add_lost_to_unavailable_reason: 마이그레이션 파일
  - lib/aed/dashboard-queries.ts: unavailable 통계 쿼리 및 집계 추가

Pre-commit checks: ✅ All passed
```

---

## 교훈

1. **Enum 일관성**: 스키마와 코드의 enum 값이 정확히 일치해야 함
2. **SQL 쿼리 누락**: 인터페이스 필드가 정의되었어도 실제 SQL이 없으면 0으로 반환됨
3. **데이터 검증**: 마이그레이션 후 반드시 Prisma generate 실행
4. **점진적 개선**: 0-Stage 완료 후 다음 단계 진행 가능

---

**최종 상태**: ✅ 0-Stage 완료, 1-Stage 시작 준비 완료

다음 작업: 1-Stage Export 엔드포인트 구현 대기
