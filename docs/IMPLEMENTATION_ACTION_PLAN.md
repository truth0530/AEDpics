# 구현 실행 계획

**작성일**: 2025-11-06
**상태**: ✅ 4가지 검증 완료, 실행 계획 수립
**승인자**: 자동 (검증 기반)

---

## 주요 발견사항 (검증 기반)

### 🔴 CRITICAL 3가지 - 즉시 수정 필요

#### 1. 지역 비교 로직 - 경우 2 확정
**발견**: local_admin 10명 모두 city_code(시군구) 단위 관할
**영향**: PATCH 엔드포인트의 권한 검증 로직 전체 수정 필수
**수정 방법**:
- CITY_CODE_TO_GUGUN_MAP 사용하여 city_code → gugun 매핑
- canEditInspection()에 매핑된 gugun 전달
- inspection.aed_data.gugun과 비교

#### 2. aed_data null 발생률 - 50% (1% 임계값 초과)
**발견**: 14/28 검사 기록이 null aed_data_id 보유
**영향**: UI에서 수정 불가 기록 발생 가능
**수정 방법**:
- 400 Bad Request 응답 유지
- 단, 에러 메시지 개선: "장비 정보가 삭제된 상태입니다. 복구될 때까지 수정 불가"
- UI에서 null 레코드 그레이 아웃 처리

#### 3. Export 권한 플래그 - 90% false (배포 불가)
**발견**: 9/10 local_admin이 can_export_data = false
**영향**: export 엔드포인트 배포 전 플래그 업데이트 필수
**수정 방법**:
```sql
UPDATE aedpics.user_profiles
SET can_export_data = true
WHERE role IN ('regional_admin', 'local_admin')
  AND can_export_data = false;
```

### 🟡 MEDIUM 1가지 - 코드 버그

#### 4. 필드 매핑 불일치
**발견**: allowedFields = camelCase, Prisma schema = snake_case
**추가 버그**:
1. ministry_admin이 edit 권한 보유 (읽기 전용이어야 함)
2. updated_at이 updatedAt (camelCase) - Prisma 스키마 불일치
3. aed_data 로드 안됨 → 지역 비교 로직 실행 불가

**수정 방법**:
- allowedFields를 snake_case로 통일
- permissions.ts의 canEditInspection() 재사용
- fieldMapping 제거
- aed_data 로드 추가

---

## 실행 순서

### Phase 1: 즉시 실행 (2025-11-06)
**담당**: QA / DBA
**예상 시간**: 5분

```bash
# SQL 실행: export 권한 플래그 업데이트
psql "postgresql://aedpics_admin:***@pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com:5432/aedpics_production" << 'EOF'
UPDATE aedpics.user_profiles
SET can_export_data = true
WHERE role IN ('regional_admin', 'local_admin')
  AND can_export_data = false;

-- 검증
SELECT COUNT(*) as export_enabled
FROM aedpics.user_profiles
WHERE role IN ('regional_admin', 'local_admin') AND can_export_data = true;
EOF
```

**확인 사항**:
- [ ] 9명의 local_admin이 can_export_data=true로 업데이트됨
- [ ] 검증 쿼리 결과: 10 (또는 regional_admin 추가시 더 많음)

### Phase 2: v5.0 계획 업데이트 (2025-11-06)
**담당**: 개발팀 리드
**예상 시간**: 30분

[docs/inspection_revised_implementation_plan_v5.md](inspection_revised_implementation_plan_v5.md) 업데이트:

#### Section 2.1 PATCH 엔드포인트 (2-Stage Phase 2-2)

**변경사항 1: inspection 쿼리**
```typescript
// 기존
const inspection = await prisma.inspections.findUnique({
  where: { id: inspectionId },
  select: { id: true, inspector_id: true }
});

// 수정됨
const inspection = await prisma.inspections.findUnique({
  where: { id: inspectionId },
  select: {
    id: true,
    inspector_id: true,
    aed_data: {
      select: { gugun: true }  // ← 필수 추가
    }
  }
});

if (!inspection.aed_data) {
  return NextResponse.json(
    { error: '장비 정보가 삭제된 상태입니다. 복구될 때까지 이 기록은 수정할 수 없습니다.' },
    { status: 400 }
  );
}
```

**변경사항 2: 권한 검증**
```typescript
// 기존 (INCORRECT)
const isAdmin = profile?.role &&
  ['master', 'emergency_center_admin', 'ministry_admin'].includes(profile.role);
const isOwner = inspection.inspector_id === session.user.id;
if (!isOwner && !isAdmin) return error;

// 수정됨 (CORRECT)
import { canEditInspection } from '@/lib/inspections/permissions';
import { CITY_CODE_TO_GUGUN_MAP } from '@/lib/constants/regions';

// profile 쿼리에 organizations 추가
const profile = await prisma.user_profiles.findUnique({
  where: { id: session.user.id },
  select: {
    role: true,
    organizations: {  // ← plural form
      select: { city_code: true }
    }
  }
});

// 지역 비교를 위해 city_code → gugun 매핑
const userGugun = CITY_CODE_TO_GUGUN_MAP[profile?.organizations?.city_code]
  || profile?.organizations?.city_code;

const hasPermission = canEditInspection(
  profile.role,
  session.user.id,
  inspection.inspector_id,
  userGugun,                    // ← 매핑된 gugun
  inspection.aed_data.gugun     // ← aed_data의 gugun
);

if (!hasPermission) {
  const detail = checkInspectionPermission(...);
  return NextResponse.json({ error: detail.reason }, { status: 403 });
}
```

**변경사항 3: 필드 매핑**
```typescript
// 기존 (INCORRECT)
const allowedFields = [
  'notes',
  'visualStatus',         // ← camelCase (틀림)
  'batteryStatus',
  'padStatus',
  'operationStatus',
  'overallStatus',
  'issuesFound',
];

const fieldMapping: Record<string, string> = {
  'visual_status': 'visualStatus',  // ← 반대 방향 매핑
  'battery_status': 'batteryStatus',
  // ...
};

Object.keys(updates).forEach((field) => {
  const camelField = fieldMapping[field] || field;
  if (allowedFields.includes(camelField)) {
    updateData[camelField] = updates[field];  // ← camelCase 저장 (틀림)
  }
});

const updatedInspection = await prisma.inspections.update({
  where: { id: inspectionId },
  data: updateData  // ← Prisma는 snake_case 기대
});

// 수정됨 (CORRECT)
const allowedFields = [
  'notes',
  'visual_status',        // ← snake_case (맞음)
  'battery_status',
  'pad_status',
  'operation_status',
  'overall_status',
  'issues_found',
];

// fieldMapping 제거 - 이미 일치함!
const updateData: any = { updated_at: new Date() };  // ← snake_case

Object.keys(updates).forEach((field) => {
  if (allowedFields.includes(field)) {
    updateData[field] = updates[field];  // ← 그대로 저장 (맞음)
  }
});

const updatedInspection = await prisma.inspections.update({
  where: { id: inspectionId },
  data: updateData  // ← Prisma와 일치!
});
```

#### Section 1 Export 엔드포인트 (1-Stage)

**권한 검증 추가**:
```typescript
// 이중 검증 필수
if (!profile?.can_export_data) {
  return NextResponse.json(
    { error: 'Export permission denied' },
    { status: 403 }
  );
}

const exportableRoles = ['master', 'emergency_center_admin', 'regional_admin', 'local_admin'];
if (!exportableRoles.includes(profile.role)) {
  return NextResponse.json(
    { error: 'Role cannot export' },
    { status: 403 }
  );
}
```

### Phase 3: PATCH 엔드포인트 구현 (2025-11-06 또는 2025-11-07)
**담당**: 개발팀
**예상 시간**: 2-3시간 (4개 버그 수정)

**파일**: [app/api/inspections/[id]/route.ts](../../app/api/inspections/[id]/route.ts)

**수정 목록**:
- [ ] inspection 쿼리에 aed_data { gugun } 추가
- [ ] aed_data null 체크 추가
- [ ] permission 로직: canEditInspection() 사용
- [ ] userGugun 매핑 구현
- [ ] allowedFields를 snake_case로 변경
- [ ] fieldMapping 제거
- [ ] updated_at을 snake_case로 변경
- [ ] test: 4개 샘플 gugun으로 권한 검증

### Phase 4: Export 엔드포인트 구현 (병렬 가능)
**담당**: 개발팀
**예상 시간**: 3-4시간

**파일**: /app/api/inspections/export/route.ts (신규)

**체크리스트**:
- [ ] can_export_data flag 검증
- [ ] 역할별 권한 검증
- [ ] enforceFilterPolicy 재사용
- [ ] ExcelJS로 파일 생성
- [ ] 응답 스트리밍
- [ ] 감사 로그 기록

---

## 배포 전 QA 체크리스트

### 사전 준비 (배포 전)
- [ ] Phase 1 SQL 실행 완료 (export 플래그)
- [ ] v5.0 계획 문서 업데이트 완료
- [ ] 코드 검토 완료

### PATCH 엔드포인트 테스트 (2-Stage)

**테스트 케이스 1: 권한 검증**
```bash
# local_admin (고현아) 권한: JEJ / seogwipo
# 테스트 1-1: 자신의 구군 내 점검 기록 수정 - ALLOW
PATCH /api/inspections/{제주특별자치도의_seogwipo_점검}
Authorization: Bearer <고현아_token>
Body: { visual_status: "normal" }
Expected: 200 OK

# 테스트 1-2: 다른 구군 점검 기록 수정 - DENY
PATCH /api/inspections/{대구광역시_중구_점검}
Authorization: Bearer <고현아_token>
Expected: 403 Forbidden
```

**테스트 케이스 2: aed_data null 처리**
```bash
# 테스트 2-1: aed_data_id IS NULL인 기록 수정 시도
PATCH /api/inspections/{null_aed_data_점검}
Authorization: Bearer <고현아_token>
Body: { visual_status: "normal" }
Expected: 400 Bad Request
Response: {
  "error": "장비 정보가 삭제된 상태입니다. 복구될 때까지 이 기록은 수정할 수 없습니다."
}
```

**테스트 케이스 3: 필드 매핑**
```bash
# 테스트 3-1: snake_case 필드 전송
PATCH /api/inspections/{점검ID}
Authorization: Bearer <token>
Body: {
  "visual_status": "normal",
  "battery_status": "good",
  "pad_status": "good",
  "operation_status": "normal",
  "overall_status": "normal",
  "notes": "점검 완료"
}
Expected: 200 OK, 모든 필드가 DB에 저장됨
```

### Export 엔드포인트 테스트 (1-Stage)

**테스트 케이스 1: 권한 검증**
```bash
# 테스트 1-1: can_export_data=true인 local_admin - ALLOW
POST /api/inspections/export
Authorization: Bearer <고현아_token> (after Phase 1)
Body: { region_filter: "제주특별자치도", city_filter: "서귀포시" }
Expected: 200 OK, Excel 파일 반환

# 테스트 1-2: can_export_data=false인 계정 - DENY
Expected: 403 Forbidden (before Phase 1)
Expected: 200 OK (after Phase 1)

# 테스트 1-3: ministry_admin (읽기 전용) - DENY
POST /api/inspections/export
Authorization: Bearer <ministry_admin_token>
Expected: 403 Forbidden (regardless of flag)
```

---

## 구현 일정

```
2025-11-06 (금)
├─ 09:00-09:05: Phase 1 - export 플래그 SQL 실행
├─ 09:05-09:35: Phase 2 - v5.0 계획 업데이트
├─ 09:35-12:00: Phase 3 - PATCH 버그 수정 (병렬)
└─ 09:35-12:00: Phase 4 - Export 엔드포인트 (병렬)

2025-11-07 (토)
├─ 테스트 및 QA (병렬)
├─ 버그 수정
└─ 최종 검증
```

---

## 리스크 및 대응 방안

### Risk 1: aed_data null 데이터 량 (50%)
**영향도**: 중간
**대응**: 원인 파악 후 정상화 작업 별도 진행

### Risk 2: Export 플래그 일괄 업데이트
**영향도**: 낮음
**대응**: Phase 1 완료 후 즉시 검증

### Risk 3: regional_admin이 없는 상태에서 export 배포
**영향도**: 낮음
**대응**: export 엔드포인트는 regional_admin 준비 후 활성화 (또는 코드는 준비, 플래그는 추후)

---

## 최종 확인

**검증 완료 상황**:
- ✅ 지역 비교 로직: 시군구 단위 (경우 2) 확정
- ✅ aed_data null: 50% 발생률 확인, 메시지 필요
- ✅ Export 플래그: 90% false, SQL 준비됨
- ✅ 필드 매핑: 4개 버그 식별 및 수정 방법 제시

**구현 시작 가능**: ✅ YES

**다음 액션**: Phase 1 SQL 실행 + Phase 2 계획 업데이트 후 Phase 3/4 병렬 구현

---

**작성**: Claude Code
**최종 검토**: 자동 (검증 기반)
**승인 상태**: ✅ 구현 준비 완료
