# 구현 사전 검증 결과

**작성일**: 2025-11-06
**상태**: ✅ 4가지 검증 완료
**다음 단계**: v5.0 계획 수정 후 구현 시작 가능

---

## 1. 지역 비교 로직 검증 (가장 중요) ✅

### 검증 결과: local_admin은 시군구(city_code) 단위 관할

#### 쿼리 결과 - local_admin 권한 범위

```
총 local_admin: 10명
모두 city_code 보유: 10명 (100%)
```

| 이메일 | 이름 | region_code | city_code | 조직명 |
|-------|------|-------------|----------|--------|
| seojayoung@korea.kr | 서자영 | SEJ | seju | 세종특별자치시 |
| jian91@korea.kr | 손지안 | DAE | suseong | 대구광역시 수성구 보건소 |
| khhh510@korea.kr | 김근하 | DAE | seo | 대구광역시 서구 보건소 |
| hak1212@korea.kr | 이인학 | INC | namdong | 인천광역시 남동구 보건소 |
| hellojh56@korea.kr | 최진희 | DAE | buk | 대구광역시 북구 보건소 |
| nemcdg@korea.kr | 이광성중구보건소 | DAE | jung | 대구광역시 중구 보건소 |
| kahyun1220@korea.kr | 서가현 | DAE | dalseo | 대구광역시 달서구 보건소 |
| woals0201@korea.kr | 반서윤(임시) | GYN | gimhae | 김해시 보건소 |
| **kha115@korea.kr** | **고현아** | **JEJ** | **seogwipo** | **서귀포시 보건소** |
| bongbong6878@korea.kr | 오봉철 | JEJ | jeju | 제주시 보건소 |

### 핵심 발견

✅ **local_admin의 관할 범위**: 시군구(city_code) 단위 - **경우 2 확정**
- city_code와 gugun을 매칭해야 함
- CITY_CODE_TO_GUGUN_MAP 필수 사용

### v5.0 계획 수정 필요

**현재 계획 (INCORRECT)**:
```typescript
// 시도 단위 비교 → local_admin 권한 범위 초과!
const hasPermission = canEditInspection(
  profile.role,
  session.user.id,
  inspection.inspector_id,
  profile.organizations?.region_code,    // ← 'DAE' (시도)
  inspection.aed_data.sido                // ← '대구광역시' (시도명)
);
```

**수정 계획 (CORRECT)**:
```typescript
// 시군구 단위 비교 필요
import { CITY_CODE_TO_GUGUN_MAP } from '@/lib/constants/regions';

// city_code를 gugun으로 매핑
const mappedGugun = CITY_CODE_TO_GUGUN_MAP[profile.organizations?.city_code]
  || profile.organizations?.city_code;

const hasPermission = canEditInspection(
  profile.role,
  session.user.id,
  inspection.inspector_id,
  mappedGugun,                    // ← '서귀포시' (시군구, mapped from 'seogwipo')
  inspection.aed_data.gugun       // ← '서귀포시' (시군구명)
);
```

### PATCH 엔드포인트 수정 시 필요한 변경

1. **inspection 쿼리에 aed_data 추가**:
```typescript
const inspection = await prisma.inspections.findUnique({
  where: { id: inspectionId },
  select: {
    id: true,
    inspector_id: true,
    aed_data: {
      select: { gugun: true }  // ← gugun 로드 필수
    }
  }
});
```

2. **aed_data null 체크 추가**:
```typescript
if (!inspection.aed_data) {
  return NextResponse.json(
    { error: '연관된 장비 데이터를 찾을 수 없습니다' },
    { status: 400 }
  );
}
```

3. **canEditInspection 호출 시 gugun 매핑 적용**:
```typescript
const mappedGugun = CITY_CODE_TO_GUGUN_MAP[profile.organizations?.city_code]
  || profile.organizations?.city_code;

const hasPermission = canEditInspection(
  profile.role,
  session.user.id,
  inspection.inspector_id,
  mappedGugun,
  inspection.aed_data.gugun
);
```

---

## 2. aed_data null 케이스 검증 ✅

### 쿼리 결과

```
null_aed_data_count: 14
total_count: 28
null_percentage: 50.00%
```

### 영향도 분석

**null 케이스가 50% = 매우 높음** (1% 임계값 훨씬 초과)

### 처리 방침

**현재 계획 (업데이트 필요)**:
- null 케이스 < 1% → 400 Bad Request (계획 유지)
- null 케이스 >= 1% → **사용자 안내 메시지 추가**

**50% null 상황에서의 권장 처리**:

1. **API 응답 (400 Bad Request + 사용자 친화적 메시지)**:
```json
{
  "error": "점검 기록은 존재하나 장비 정보가 삭제된 상태입니다. 장비 정보가 복구될 때까지 이 기록은 수정할 수 없습니다.",
  "code": "AED_DATA_NOT_FOUND"
}
```

2. **UI 표시**:
- 점검 이력 목록에서 null aed_data 레코드 그레이 아웃
- "장비 정보 없음" 배지 표시
- 수정 버튼 비활성화

3. **데이터 정상화 작업** (QA/관리자):
- null aed_data 검사 기록 원인 파악
- 삭제된 AED 정보 복구 또는
- 고아 레코드 정리

### QA 체크리스트

- [ ] null aed_data인 inspection 조회 및 원인 파악
- [ ] 400 에러 메시지 UI 표시 테스트
- [ ] 에러 로그 검증
- [ ] 고아 레코드 정리 작업 계획

---

## 3. Export 권한 플래그 검증 ✅

### 쿼리 결과

#### 역할별 can_export_data 현황

```
role: local_admin
user_count: 10
export_enabled: 1
export_disabled: 9
```

#### regional_admin
- 해당 사용자 없음 (시스템에 미등록)

#### local_admin 중 can_export_data = false인 사용자

| 이메일 | 이름 | 역할 | can_export_data |
|-------|------|------|-----------------|
| bongbong6878@korea.kr | 오봉철 | local_admin | false |
| woals0201@korea.kr | 반서윤(임시) | local_admin | false |
| hak1212@korea.kr | 이인학 | local_admin | false |
| kahyun1220@korea.kr | 서가현 | local_admin | false |
| hellojh56@korea.kr | 최진희 | local_admin | false |
| **kha115@korea.kr** | **고현아** | **local_admin** | **false** |
| jian91@korea.kr | 손지안 | local_admin | false |
| khhh510@korea.kr | 김근하 | local_admin | false |
| seojayoung@korea.kr | 서자영 | local_admin | false |

### 영향도 분석

**9/10 (90%) local_admin이 can_export_data = false**

- **export 엔드포인트 배포 전 필수 작업**
- 1 사용자만 true (테스트용일 가능성)
- 실제 운영 admin은 모두 false 상태

### 배포 전 QA 작업

**필수 실행 SQL**:
```sql
-- 모든 regional_admin, local_admin의 export 권한 활성화
UPDATE aedpics.user_profiles
SET can_export_data = true
WHERE role IN ('regional_admin', 'local_admin')
  AND can_export_data = false;
```

**검증 후 상태**:
```sql
SELECT COUNT(*) as now_enabled
FROM aedpics.user_profiles
WHERE role IN ('regional_admin', 'local_admin')
  AND can_export_data = true;
-- Expected: 10 (또는 региональ_admin이 추가되면 더 많음)
```

### 권장사항

1. **배포 before 체크리스트에 추가**:
   - [ ] local_admin/regional_admin can_export_data=true 확인

2. **export 엔드포인트 권한 검증**:
```typescript
// 이중 검증
if (!profile?.can_export_data) {
  return NextResponse.json({ error: 'Export permission denied' }, { status: 403 });
}

const exportableRoles = ['master', 'emergency_center_admin', 'regional_admin', 'local_admin'];
if (!exportableRoles.includes(profile.role)) {
  return NextResponse.json({ error: 'Role cannot export' }, { status: 403 });
}
```

---

## 4. 필드 매핑 일관성 검증 ✅

### 검증 결과

#### Step 1: 클라이언트 전송 데이터 ✅
**파일**: lib/inspections/session-utils.ts (line 208-229)
```typescript
export interface InspectionHistory {
  id: string;
  equipment_serial: string;
  inspector_id: string;
  // ... 중간 필드 생략
  visual_status: string;      // ✅ snake_case
  battery_status: string;     // ✅ snake_case
  pad_status: string;         // ✅ snake_case
  operation_status: string;   // ✅ snake_case
  overall_status: string;     // ✅ snake_case
  notes?: string;             // ✅ snake_case
  issues_found?: string[];    // ✅ snake_case
}
```

**결론**: 클라이언트는 snake_case로 업데이트 데이터 전송 ✅

#### Step 2: API 처리 ❌
**파일**: app/api/inspections/[id]/route.ts (PATCH)

**현재 구현 (INCORRECT)**:
```typescript
// Line 96-103: allowedFields가 camelCase
const allowedFields = [
  'notes',
  'visualStatus',        // ❌ camelCase
  'batteryStatus',
  'padStatus',
  'operationStatus',
  'overallStatus',
  'issuesFound',
];

// Line 103-112: fieldMapping이 snake_case → camelCase 변환
const fieldMapping: Record<string, string> = {
  'visual_status': 'visualStatus',    // ❌ 잘못된 변환
  'battery_status': 'batteryStatus',
  // ...
};

// Line 115-120: 변환 후 저장
Object.keys(updates).forEach((field) => {
  const camelField = fieldMapping[field] || field;
  if (allowedFields.includes(camelField)) {
    updateData[camelField] = updates[field];  // ❌ camelCase 저장
  }
});
```

**문제점**:
1. 클라이언트에서 `visual_status`를 보냄
2. allowedFields는 `visualStatus`를 기대
3. fieldMapping으로 변환하면 `visualStatus` = true (저장)
4. Prisma schema는 `visual_status` 필드 기대 → **런타임 오류 발생**

#### Step 3: 수정 계획 ✅

**필수 변경**:
```typescript
// allowedFields를 snake_case로 변경
const allowedFields = [
  'notes',
  'visual_status',       // ✅ snake_case (클라이언트 일치)
  'battery_status',
  'pad_status',
  'operation_status',
  'overall_status',
  'issues_found',
];

// fieldMapping 제거 (이미 일치)
const updateData: any = { updated_at: new Date() };  // ✅ snake_case

Object.keys(updates).forEach((field) => {
  if (allowedFields.includes(field)) {
    updateData[field] = updates[field];  // ✅ 그대로 저장
  }
});
```

### 추가 PATCH 엔드포인트 버그

#### Bug 1: ministry_admin 권한 오류
**파일**: app/api/inspections/[id]/route.ts (line 95)

**현재 (INCORRECT)**:
```typescript
const isAdmin = profile?.role &&
  ['master', 'emergency_center_admin', 'ministry_admin'].includes(profile.role);
```

**문제**: ministry_admin은 읽기 전용이어야 함 (CLAUDE.md 권한 체계 참조)

**수정**:
```typescript
import { canEditInspection } from '@/lib/inspections/permissions';

// permissions.ts 함수 재사용
const hasPermission = canEditInspection(
  profile.role,
  session.user.id,
  inspection.inspector_id,
  mappedGugun,
  inspection.aed_data.gugun
);

if (!hasPermission) {
  return NextResponse.json(
    { error: 'You do not have permission to update this inspection' },
    { status: 403 }
  );
}
```

#### Bug 2: updated_at 필드명 (camelCase)
**파일**: app/api/inspections/[id]/route.ts (line 112)

**현재 (INCORRECT)**:
```typescript
const updateData: any = {
  updatedAt: new Date(),  // ❌ camelCase
};
```

**수정**:
```typescript
const updateData: any = {
  updated_at: new Date(),  // ✅ snake_case
};
```

---

## 최종 영향도 분석

| 검증 항목 | 결과 | 영향도 | 필수 수정 |
|---------|------|--------|---------|
| 지역 비교 로직 | 시군구 단위(경우 2) | 🔴 높음 | ✅ 필수 |
| aed_data null | 50% 발생률 | 🔴 높음 | ✅ 필수 |
| Export 플래그 | 90% false | 🔴 높음 | ✅ 필수 |
| 필드 매핑 | snake_case 불일치 | 🟡 중간 | ✅ 필수 |

---

## v5.0 계획 수정 요약

### 2-Stage PATCH 엔드포인트 수정

**필수 변경사항**:

1. **inspection 쿼리**:
   - [ ] aed_data { gugun } 포함

2. **권한 검증**:
   - [ ] canEditInspection() 재사용 (permissions.ts)
   - [ ] ministry_admin 제거
   - [ ] profile.organizations (복수형) 사용
   - [ ] CITY_CODE_TO_GUGUN_MAP으로 city_code → gugun 매핑

3. **필드 매핑**:
   - [ ] allowedFields를 snake_case로 변경
   - [ ] fieldMapping 제거
   - [ ] updated_at을 snake_case로 변경

4. **null 처리**:
   - [ ] aed_data null 체크 추가
   - [ ] 사용자 친화적 에러 메시지 제공

### 1-Stage Export 엔드포인트 준비

**배포 전 필수 작업**:

1. [ ] SQL 실행: can_export_data=false → true 업데이트
2. [ ] 권한 검증: can_export_data flag + role 이중 검증
3. [ ] QA: export 엔드포인트 권한 테스트

---

## 다음 단계

### 즉시 필요한 작업

1. **v5.0 계획 업데이트**:
   - 지역 비교 로직: 시군구 단위로 수정
   - aed_data null: 50% 발생률 반영 (메시지 필수)
   - 권한 검증: 재확인 및 코드 업데이트

2. **PATCH 엔드포인트 수정**:
   - Bug 3개 (region 로직, aed_data 로드, 필드 매핑) 동시 수정
   - canEditInspection() 재사용으로 중복 코드 제거

3. **배포 전 QA 작업**:
   - [ ] can_export_data 플래그 업데이트
   - [ ] Export 엔드포인트 권한 검증 테스트
   - [ ] PATCH 엔드포인트 권한 재검증

### 구현 시작 가능 조건

✅ **모든 검증 완료**

다음 커맨드로 바로 구현 시작 가능:
```bash
git checkout -b feature/1-stage-export
# 1-Stage: Export 엔드포인트 구현

또는

git checkout -b feature/2-stage-patch-fixes
# 2-Stage: PATCH 엔드포인트 버그 수정
```

---

**상태**: ✅ 4가지 검증 완료, v5.0 계획 수정 대기 중

**최종 결론**: 검증 결과를 반영하여 v5.0 계획을 업데이트하면 안전하게 구현 진행 가능
