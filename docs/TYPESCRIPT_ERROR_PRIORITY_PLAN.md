# TypeScript 오류 우선순위별 수정 계획

**작성일**: 2025-10-26
**총 오류 수**: 319개
**배포 차단 여부**: 없음 (ignoreBuildErrors: true)

---

## 우선순위 분류

### P0 - 배포 차단 (0개)
**상태**: 없음
- next.config.ts의 `ignoreBuildErrors: true` 설정으로 빌드 가능
- 프로덕션 배포에 기술적 차단 요소 없음

### P1 - 런타임 에러 위험 (70개)
**영향**: 실제 사용되는 API/컴포넌트에서 런타임 에러 발생 가능
**목표**: 2일 이내 수정

#### 1.1 사용되지 않는 Prisma 테이블 참조 (7개)
- `approvalHistory` - 존재하지 않는 테이블
- `aedPersistentMapping` - 존재하지 않는 테이블

**파일**:
- app/api/admin/users/reject/route.ts (1개)
- app/api/external-mapping/route.ts (6개)

**수정 방법**:
- 기능이 사용되는 경우: Prisma schema에 테이블 추가
- 기능이 사용되지 않는 경우: 501 Not Implemented 응답으로 비활성화

#### 1.2 Prisma 테이블명 오류 (10개)
camelCase 대신 snake_case 사용 필요

**파일별 오류**:
- app/api/health/route.ts (2개)
  - `organization` → `organizations`
  - `aedData` → `aed_data`

- app/api/inspections/assigned-devices/route.ts (1개)
  - `aedData` → `aed_data`

- app/api/inspections/assignments/route.ts (3개)
  - `inspectionsAssignment` → `inspection_assignments`

**수정 방법**: 일괄 sed 치환

#### 1.3 Prisma 필드명 오류 (50개)
camelCase 대신 snake_case 사용 필요

**주요 패턴**:
- `inspectorId` → `inspector_id`
- `equipmentSerial` → `equipment_serial`
- `inspectionDate` → `inspection_date`
- `organizationId` → `organization_id`
- `assignedDevices` → `assigned_devices`

**파일**:
- app/api/inspections/[id]/delete/route.ts (3개)
- app/api/inspections/[id]/route.ts (4개)
- app/api/inspections/assigned-devices/route.ts (3개)
- app/api/inspections/assignments/route.ts (4개)
- app/api/inspections/sessions/route.ts (10개 추정)
- components/inspection/steps/InspectionSummaryStep.tsx (20개 추정)

**수정 방법**: 개별 파일 수정 또는 일괄 sed 치환

#### 1.4 Prisma include 관계명 오류 (3개)
- `inspector` → `user_profiles` (Prisma relation)
- `aedData` → `aed_data` (Prisma relation)

**파일**:
- app/api/inspections/[id]/delete/route.ts (1개)
- app/api/inspections/[id]/route.ts (2개)

**수정 방법**:
```typescript
// Before
include: { inspector: true }

// After
include: { user_profiles: true }
// Then access as: inspection.user_profiles
```

---

### P2 - 타입 안정성 저하 (150개)
**영향**: 기능은 동작하지만 타입 체크 없이 실행
**목표**: 2주 이내 점진적 수정

#### 2.1 Components 타입 오류 (90개)
**파일**:
- components/inspection/steps/InspectionSummaryStep.tsx (46개)
- components/inspection/steps/StorageChecklistStep.tsx (9개)
- app/aed-data/components/* (15개)
- components/layout/* (10개)
- components/admin/* (10개)

**주요 문제**:
- Props 타입 불일치
- 누락된 필드
- any 타입 사용

**수정 방법**: 개별 컴포넌트별로 타입 정의 추가

#### 2.2 Library 타입 오류 (40개)
**파일**:
- lib/auth/* (15개)
- lib/realtime/* (10개)
- lib/services/* (8개)
- lib/stats.ts (5개)
- lib/aed/* (2개)

**주요 문제**:
- 공통 타입 인터페이스 불일치
- Prisma 타입과 커스텀 타입 충돌

**수정 방법**: lib/types/index.ts 통합 정리

#### 2.3 API Routes 기타 오류 (20개)
**파일**:
- app/api/cron/gps-analysis/route.ts (14개) - Decimal 타입 변환
- app/api/admin/seed-organizations/route.ts (1개)
- app/api/admin/stats/route.ts (3개)
- app/api/organizations/search/route.ts (2개)

**주요 문제**:
- Decimal → number 변환 필요
- UUID 타입 불일치

---

### P3 - 비프로덕션 코드 (99개)
**영향**: 프로덕션 배포와 무관
**목표**: 시간 여유 시 수정

#### 3.1 Scripts (24개)
**파일**:
- scripts/migrate-from-supabase.ts (12개)
- scripts/test/test-prisma.ts (5개)
- scripts/validate-region-codes.ts (4개)
- scripts/utils/* (3개)

**수정 여부**: 선택적 (실행 시에만 수정)

#### 3.2 Tutorial/Sample Data (15개)
**파일**:
- app/tutorial-guide/components/TutorialPageClient.tsx (3개)
- lib/data/tutorial-sample-data.ts (12개)

**수정 여부**: MVP에서 제외 시 수정 불필요

#### 3.3 Legacy/Optional Features (60개)
**파일**:
- app/api/external-mapping/* (18개)
- app/api/cron/gps-analysis/* (14개)
- app/api/health-centers/sync/* (4개)
- lib/realtime/* (15개) - Supabase realtime 제거 예정
- lib/monitoring/* (5개)
- lib/constants/* (4개)

**수정 방법**:
- 사용 중인 기능: 개별 수정
- 미사용 기능: 비활성화 또는 삭제

---

## 추천 수정 순서

### 1단계: 빠른 승리 (1일, 17개 오류)
✅ **이미 완료**:
- [x] email_verification_codes 테이블 추가 (9개 수정)
- [x] user_role enum에 rejected 추가 (3개 수정)
- [x] organizations에 city_code 추가 (2개 수정)
- [x] auth API 필드명 수정 (3개 수정)

### 2단계: Prisma 테이블/필드명 일괄 수정 (2시간, 60개 오류)
🔄 **진행 권장**:
1. Prisma 테이블명 치환 (10개)
   ```bash
   sed -i "s/\.aedData\./\.aed_data\./g" app/api/**/*.ts
   sed -i "s/\.organization\./\.organizations\./g" app/api/**/*.ts
   ```

2. Prisma 필드명 치환 (50개)
   ```bash
   sed -i "s/inspectorId/inspector_id/g" app/api/inspections/**/*.ts
   sed -i "s/equipmentSerial/equipment_serial/g" app/api/inspections/**/*.ts
   ```

### 3단계: 사용되지 않는 기능 비활성화 (30분, 7개 오류)
```typescript
// app/api/admin/users/reject/route.ts
// approvalHistory 참조 제거 또는 주석 처리

// app/api/external-mapping/route.ts
// 501 Not Implemented 반환으로 변경
```

### 4단계: Inspection API include 수정 (1시간, 3개 오류)
```typescript
// Before
include: { inspector: true, aedData: true }

// After
include: { user_profiles: true, aed_data: true }

// Response 반환 시 alias 추가
return {
  ...inspection,
  inspector: inspection.user_profiles,
  aedData: inspection.aed_data
}
```

---

## 예상 효과

| 단계 | 소요 시간 | 수정 오류 수 | 잔여 오류 |
|------|----------|-------------|----------|
| 초기 | - | - | 319 |
| 1단계 완료 | 1일 | 17 | 302 |
| 2단계 | 2시간 | 60 | 242 |
| 3단계 | 30분 | 7 | 235 |
| 4단계 | 1시간 | 3 | 232 |
| **합계** | **1.5일** | **87개** | **232개** |

잔여 232개 중:
- **P2 (타입 안정성)**: 150개 - 점진적 수정 (2주)
- **P3 (비프로덕션)**: 82개 - 선택적 수정

---

## 권장 사항

### 즉시 실행 (배포 전 필수)
1. **2단계 Prisma 일괄 수정** - 60개 오류, 2시간 소요
   - 가장 빠르게 많은 오류 해결 가능
   - 런타임 에러 위험 제거

2. **3단계 미사용 기능 비활성화** - 7개 오류, 30분 소요
   - approvalHistory, aedPersistentMapping 제거

### 배포 후 점진적 수정
1. **P2 Components** - 주요 사용 컴포넌트부터 우선 수정
2. **P2 Library** - lib/types 통합 후 일괄 적용
3. **P3 Scripts** - 실행 필요 시에만 수정

### 장기 개선
1. TypeScript strict 모드 활성화 검토
2. next.config.ts `ignoreBuildErrors: false`로 변경
3. CI/CD 파이프라인에 타입 체크 추가

---

## 다음 작업 선택지

**A. 즉시 수정 시작** (2-3시간):
- 2단계 + 3단계 + 4단계 일괄 수정
- 70개 오류 해결 → 249개로 감소

**B. 현재 상태로 배포**:
- ignoreBuildErrors로 빌드 가능
- 런타임 테스트로 실제 에러 확인 후 수정

**C. 우선순위 재검토**:
- 실제 사용하는 기능만 식별
- 해당 기능의 오류만 집중 수정

---

**작성자**: Claude (AI Assistant)
**최종 업데이트**: 2025-10-26 18:30 KST
