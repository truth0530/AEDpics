# 점검 기능 구현 계획서 - v3.0 (신중한 재검토)

**작성일**: 2025-11-06
**상태**: ✅ 재검토 완료
**버전**: v3.0 (v2.0의 오류 3가지 전면 수정)

---

## 주요 수정사항 (v2.0 → v3.0)

### 수정 1: Export 기능 현황 재파악

**v2.0 오류**: "Export 엔드포인트 자체가 없음 - 완전히 새로 구현"

**실제 상황**:
- ✅ **클라이언트 기능 이미 존재**: [components/inspection/AdminFullView.tsx](components/inspection/AdminFullView.tsx#L309) (handleExcelDownload)
- ❌ **서버 필터링 & 권한 제어 없음**: 클라이언트가 메모리 기반으로 현재 데이터만 다운로드

**올바른 계획**:
```
현재 상태: 클라이언트 XLSX 다운로드 (권한/필터링 없음)
↓
개선안: 서버 엔드포인트 추가 → 권한 검증 + DB 필터링 적용
(기존 클라이언트 기능은 보안상 서버 엔드포인트로 대체)
```

---

### 수정 2: 점검 이력 수정 API 현황 재파악

**v2.0 오류**: "새로 만드는 PUT 엔드포인트"

**실제 상황**:
- ✅ **기존 PATCH 엔드포인트 존재**: [app/api/inspections/[id]/route.ts](app/api/inspections/[id]/route.ts#L65)
- ❌ **권한 버그**: ministry_admin을 관리자로 취급 (line 97)
  - 정책: [lib/inspections/permissions.ts](lib/inspections/permissions.ts#L53) - ministry_admin은 `canEdit: false`
  - 코드: PATCH line 97 - ministry_admin을 `['master', 'emergency_center_admin', 'ministry_admin']`에 포함
- ❌ **타입 버그**: updateData에 camelCase 필드명 저장 (line 115-135)
  - updateData: { visualStatus, batteryStatus, ... } (camelCase)
  - Prisma 스키마: visual_status, battery_status, ... (snake_case)
  - 결과: 런타임에 필드 매핑 오류 발생

**올바른 계획**:
```
현재 상태: PATCH 엔드포인트 존재하지만 2개 버그 있음
↓
개선안: 기존 PATCH 버그 수정 (권한 재검증 + 타입 매핑 수정)
```

---

### 수정 3: 권한 함수 현황 재파악

**v2.0 오류**: "access-control.ts에 신규 canEditInspection() 추가"

**실제 상황**:
- ✅ **권한 함수 이미 존재**: [lib/inspections/permissions.ts](lib/inspections/permissions.ts#L57) (canEditInspection)
- ❌ **코드와 정책 불일치**:
  - permissions.ts: 명확한 역할별 정책 정의됨
  - PATCH 라인 97: 이 정책을 무시하고 ministry_admin 포함

**올바른 계획**:
```
현재 상태: 기존 permissions.ts 함수 존재, 하지만 PATCH에서 무시됨
↓
개선안: PATCH 엔드포인트에서 permissions.ts의 canEditInspection() 재활용
(정책 중앙화 + 코드-UI 일관성 확보)
```

---

## 구현 계획 (우선순위 재정렬)

### 0-Stage: 기술 부채 해결 (이미 완료)

- ✅ 0-1: unavailable_reason enum 'lost' 추가 (완료)
- ✅ 0-2: unavailable 통계 집계 구현 (완료)

참고: [docs/0_STAGE_COMPLETION_SUMMARY.md](docs/0_STAGE_COMPLETION_SUMMARY.md)

---

### 1-Stage: Export 엔드포인트 강화 (3-4시간)

#### 1.1 현황 분석

| 항목 | 상태 | 위치 |
|-----|------|------|
| 클라이언트 XLSX 다운로드 | ✅ 완성 | AdminFullView.tsx:309 |
| 서버 필터링 | ❌ 없음 | - |
| 권한 검증 | ❌ 없음 | - |
| 대용량 처리 | ❌ 미검증 | - |

#### 1.2 작업 내용

**신규 파일**: `/app/api/inspections/export/route.ts`

**목표**:
- 기존 클라이언트 XLSX 기능을 서버 엔드포인트로 제공
- 역할별 권한 검증 (canExportData)
- DB 필터링 적용 (enforceFilterPolicy 재사용)
- 감사 로그 기록

**API 스펙**:
```
POST /api/inspections/export
Request:
{
  filters: {
    regionCodes?: string[],
    cityCodes?: string[],
    startDate?: string,
    endDate?: string
  }
}

Response (200):
- Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
- 파일 스트리밍

Response (403):
{ error: "권한 없음" }

Response (409):
{ error: "필터 정책 위반", reason: "..." }
```

**구현 체크리스트**:
- [ ] POST 엔드포인트 작성
- [ ] enforceFilterPolicy 적용 (lib/aed/filter-policy.ts 재사용)
- [ ] ExcelJS로 XLSX 생성
- [ ] 스트리밍 응답 구현
- [ ] 감사 로그 기록

**권한 검증**:
```typescript
// lib/inspections/permissions.ts 활용
const canExport = userProfile.role === 'master'
  || userProfile.role === 'emergency_center_admin'
  || userProfile.role === 'regional_emergency_center_admin'
  || userProfile.role === 'regional_admin'
  || userProfile.role === 'local_admin';
```

**성능 고려**:
- maxResultLimit = 10,000 준수 (이미 enforceFilterPolicy에 포함)
- 커서 기반 페이지네이션 활용
- 메모리 스트리밍 (파일 시스템 저장 금지)

#### 1.3 테스트 계획

**자동화 (Jest)**:
```typescript
describe("POST /api/inspections/export", () => {
  test("local_admin은 관할 지역만 다운로드", async () => {
    // 고현아(서귀포) 계정으로 요청
    // → 서귀포 데이터만 포함 확인
  });

  test("regional_admin은 소속 시도만", async () => {
    // 대구 담당자로 요청
    // → 대구 데이터만 포함 확인
  });

  test("temporary_inspector는 403", async () => {
    // 임시점검원으로 요청
    // → 403 응답 확인
  });
});
```

**수동 (QA)**:
- [ ] 권한별 필터링 검증
- [ ] Excel 파일 형식 확인
- [ ] 대용량 다운로드 (10,000건) 성공
- [ ] 감사 로그 기록 확인

#### 1.4 배포 순서

1. **백엔드 (PR)**: /api/inspections/export 엔드포인트
2. **테스트**: Jest + 수동 QA (병렬 가능)
3. **프론트**: AdminFullView.tsx에서 서버 엔드포인트 호출 변경

#### 1.5 롤백 계획

```bash
# 롤백 시 기존 클라이언트 기능 복구
# AdminFullView.tsx의 handleExcelDownload는 변경 없음
# API 호출만 제거
```

---

### 2-Stage: 점검 이력 수정 API 버그 수정 (2-3시간)

#### 2.1 현황 분석

| 버그 | 위치 | 심각도 | 영향 |
|-----|------|--------|------|
| ministry_admin 권한 오류 | route.ts:97 | 🔴 높음 | 정책 위반 |
| camelCase 타입 버그 | route.ts:115-135 | 🔴 높음 | 런타임 오류 |
| 정책 재검증 필요 | 전체 | 🟡 중간 | 일관성 부재 |

#### 2.2 버그 수정 작업

**파일**: `/app/api/inspections/[id]/route.ts` (기존 PATCH 엔드포인트 수정)

**버그 1: 권한 검증 재구현**

```typescript
// 현재 (잘못됨)
const isAdmin = profile?.role && ['master', 'emergency_center_admin', 'ministry_admin'].includes(profile.role);

// 수정안: permissions.ts 함수 활용
import { canEditInspection } from '@/lib/inspections/permissions';

const permission = canEditInspection({
  userProfile: profile,
  targetInspection: inspection,
  userId: session.user.id,
  userRegionCode: profile.organization?.region_code,
  inspectionRegionCode: inspection.aed_data?.sido
});

if (!permission.canEdit) {
  return NextResponse.json({ error: permission.reason }, { status: 403 });
}
```

**정책 참고** (lib/inspections/permissions.ts line 52-93):
- master: 무제한 수정 가능
- emergency_center_admin: 무제한 수정 가능
- ministry_admin: **읽기 전용 (수정 불가)** ← 현재 코드와 충돌!
- regional_admin: 소속 시도만 수정 가능
- local_admin: 관할 지역만 수정 가능
- temporary_inspector: 본인 점검만 수정 가능

**버그 2: camelCase → snake_case 매핑 수정**

```typescript
// 현재 (잘못됨)
const updateData: any = {
  updatedAt: new Date(),  // camelCase
  visualStatus: updates.visual_status,  // camelCase
  // ...
};

// 수정안: Prisma 스키마 필드명 사용
const updateData: any = {
  updated_at: new Date(),  // snake_case (스키마와 일치)
  visual_status: updates.visual_status,  // snake_case
  battery_status: updates.battery_status,  // snake_case
  pad_status: updates.pad_status,  // snake_case
  operation_status: updates.operation_status,  // snake_case
  overall_status: updates.overall_status,  // snake_case
  notes: updates.notes,  // snake_case
  issues_found: updates.issues_found,  // snake_case
};
```

**참고**: Prisma 스키마에서 field name 확인
```prisma
model inspections {
  id String @id
  equipment_serial String
  inspector_id String
  inspection_date DateTime
  visual_status status_enum?
  battery_status status_enum?
  pad_status status_enum?
  operation_status status_enum?
  overall_status status_enum?
  notes String?
  issues_found String[]
  updated_at DateTime @updatedAt
  // ...
}
```

#### 2.3 추가 개선사항

**동시성 제어** (선택사항 - 향후 단계):
- 현재 PATCH는 동시성 제어 없음
- 필요시 `updated_at` 체크 추가 (409 Conflict 반환)

**감사 로그** (선택사항 - 향후 단계):
- 누가, 언제, 뭘 바꿨는지 기록
- inspection_field_comparisons 테이블 활용

#### 2.4 테스트 계획

**자동화 (Jest)**:
```typescript
describe("PATCH /api/inspections/[id]", () => {
  test("ministry_admin은 403 반환", async () => {
    // 보건복지부 계정으로 수정 요청
    // → 403 Forbidden 확인 (permissions.ts 정책 준수)
  });

  test("local_admin은 관할 지역만 수정", async () => {
    // 서귀포 담당자가 타 지역 점검 수정 시도
    // → 403 Forbidden
  });

  test("camelCase 필드명 없음", async () => {
    // 요청: { visualStatus: 'normal' }
    // → DB에 visual_status로 저장되는지 확인
  });
});
```

**수동 (QA)**:
- [ ] 각 역할별 수정 권한 검증
- [ ] 필드값 올바르게 저장 확인
- [ ] DB 컬럼명과 일치 확인

#### 2.5 배포 순서

1. **백엔드 (단일 PR)**: 권한 + 타입 버그 수정
2. **테스트**: Jest + 수동 검증 (병렬)
3. **모니터링**: 프로덕션 배포 후 PATCH 호출 로그 확인

#### 2.6 롤백 계획

```bash
# 롤백 시 기존 코드로 복구
git revert <commit-hash>

# 주의: 이미 업데이트된 데이터는 되돌릴 수 없음
# → 점검 이력은 불변 데이터로 취급하는 것이 원칙
```

---

### 3-Stage: 불가 상태 UI 완성 (2-3시간)

#### 3.1 현황

| 기능 | 상태 | 위치 |
|-----|------|------|
| QuickInspectPanel | ✅ 있음 | components/inspection/QuickInspectPanel.tsx |
| UnavailableReasonModal | ✅ 있음 | components/inspection/UnavailableReasonModal.tsx |
| 통계 집계 | ✅ 완료 (0-Stage) | lib/aed/dashboard-queries.ts |

#### 3.2 작업 내용

**목표**: 기존 컴포넌트 통합 + 상태 전환 로직

**체크리스트**:
- [ ] QuickInspectPanel에서 "점검불가" 선택 시 UnavailableReasonModal 호출
- [ ] Modal에서 선택한 사유를 API로 전송
- [ ] inspection_assignments.status: pending → unavailable
- [ ] 대시보드 unavailable 통계 자동 갱신 (0-Stage에서 이미 구현됨)
- [ ] 반대 방향: unavailable → pending (재점검) 로직 추가

#### 3.3 테스트

- [ ] 상태 전환 동작 확인
- [ ] 통계 업데이트 확인

---

### 4-Stage: CPR 필드 (조사 필요)

#### 4.1 사전 조사 필요

현재 상태:
- [ ] Prisma 스키마: cpr_guidebook_available 필드 없음
- [ ] 코드: CPR 관련 참조 0개
- [ ] UI: CPR 입력 필드 없음

**결정 필요**:
1. CPR 필드가 실제로 필요한가?
2. 필요하면 어느 테이블에 추가할 것인가?
3. API 스펙은 무엇인가?

#### 4.2 추가 작업 (조건부)

필요성이 확인되면:
- 스키마 변경 (필드 추가)
- API 스펙 정의
- UI 구현

---

## 병렬 작업 가능 범위

### Day 1
- **1-Stage**: 백엔드 구현 (3-4시간)
- **병렬**: Jest 테스트 작성 (1-2시간)

### Day 2
- **2-Stage**: PATCH 버그 수정 (2-3시간)
- **병렬**: QA 테스트 준비 (1시간)

### Day 3
- **1-Stage**: 수동 QA (1-2시간)
- **병렬**: 2-Stage QA 실행 (1-2시간)
- **병렬**: 3-Stage 통합 (1시간)

### Day 4
- **모니터링 & 문서화**

---

## 권한 정책 검증 (최종 확인)

**현재 코드 상태**:

| 역할 | Export | PATCH | 정책 일치 |
|-----|--------|-------|---------|
| master | ✅ 가능 | ✅ 가능 | ✅ 일치 |
| emergency_center_admin | ✅ 가능 | ✅ 가능 (수정 필요) | ❌ 불일치 |
| ministry_admin | ❌ 불가 | ❌ 불가 (현재 버그) | 🟡 명확화 필요 |
| regional_admin | ✅ 시도별 | ✅ 시도별 | ✅ 일치 |
| local_admin | ✅ 시군구별 | ✅ 시군구별 | ✅ 일치 |
| temporary_inspector | ❌ 불가 | ✅ 본인만 | ❌ 불일치 |

**주의**: Export와 PATCH 정책을 통일하려면 permissions.ts를 정책의 단일 소스로 삼아야 함.

---

## 최종 체크리스트

### 구현 전
- [ ] 이 계획서를 사용자와 공유 및 승인 받음
- [ ] 각 단계별 담당자 확정
- [ ] 테스트 환경 데이터 준비

### 구현 중
- [ ] 타입스크립트 컴파일 통과
- [ ] ESLint 통과
- [ ] 프로덕션 빌드 성공

### 배포 전
- [ ] 단위 테스트 통과 (Jest)
- [ ] 통합 테스트 통과 (수동)
- [ ] 권한 검증 확인

### 배포 후
- [ ] 모니터링 (로그 확인)
- [ ] 사용자 피드백 수집
- [ ] 문서 업데이트

---

## 참고 문서

- [lib/inspections/permissions.ts](lib/inspections/permissions.ts) - 권한 정책 정의
- [app/api/inspections/[id]/route.ts](app/api/inspections/[id]/route.ts) - 현재 PATCH 구현
- [lib/aed/filter-policy.ts](lib/aed/filter-policy.ts) - 필터 정책
- [docs/0_STAGE_COMPLETION_SUMMARY.md](docs/0_STAGE_COMPLETION_SUMMARY.md) - 0-Stage 완료 보고서

---

**최종 상태**: ✅ v3.0 신중한 재검토 완료
**다음 단계**: 사용자 승인 후 1-Stage 구현 시작
