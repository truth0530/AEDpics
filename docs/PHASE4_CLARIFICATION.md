# Phase 4 최종 명확화 문서

**작성일**: 2025-11-06
**상태**: 구현 직전 최종 확정
**목적**: 구현 중 흔들리지 않도록 모든 불명확한 부분 정리

---

## 1. Excel 라이브러리 확정 ✅

### 코드 근거

**클라이언트 사용 현황**:
```bash
$ grep -r "xlsx" app/ lib/ --include="*.ts" --include="*.tsx"
```

**확인된 파일들**:
- `app/(authenticated)/inspection-effect/page.tsx`: `import * as XLSX from 'xlsx'`
- `app/(authenticated)/inspections/improvement-reports/page.tsx`: `import * as XLSX from 'xlsx'`
- `lib/report-generator.ts`: `import * as XLSX from 'xlsx'`
- `components/inspection/AdminFullView.tsx` (line 28): `import * as XLSX from 'xlsx'`

**ExcelJS 설치 상태**:
```bash
$ grep exceljs package.json
# 결과: (없음 - 설치되지 않음)
```

### 결정

**✅ 확정: SheetJS (xlsx) 사용**

**근거**:
1. 클라이언트에서 이미 4개 파일에서 활용 중
2. 일관성 있는 라이브러리 선택
3. 추가 의존성 설치 불필요
4. Node.js 환경에서도 동작 확인됨 (lib/report-generator.ts)

**구현 방식**:
```typescript
import * as XLSX from 'xlsx';

// 엔드포인트에서 사용
const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.json_to_sheet(inspections);
XLSX.utils.book_append_sheet(workbook, worksheet, 'Inspections');

const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

return new NextResponse(Buffer.from(excelBuffer), {
  headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="export_${Date.now()}.xlsx"`
  }
});
```

---

## 2. Result Limit 강제 메커니즘 명확화 ✅

### 코드 근거

#### 2.1 accessScope에서의 정의
**파일**: [lib/auth/access-control.ts:321-409](lib/auth/access-control.ts#L321-L409)

```typescript
interface RolePermissions {
  canViewAllRegions: boolean;
  maxResultLimit: number;  // ← 여기서 정의
  canExportData: boolean;
  canViewSensitiveData: boolean;
  requiresRegionFilter: boolean;
  requiresCityFilter: boolean;
}

const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  master: { maxResultLimit: 10000, ... },                           // 10,000
  emergency_center_admin: { maxResultLimit: 10000, ... },           // 10,000
  regional_emergency_center_admin: { maxResultLimit: 10000, ... },  // 10,000
  ministry_admin: { maxResultLimit: 10000, ... },                   // 10,000
  regional_admin: { maxResultLimit: 5000, ... },                    // 5,000
  local_admin: { maxResultLimit: 1000, ... },                       // 1,000
  temporary_inspector: { maxResultLimit: 500, ... },                // 500
  pending_approval: { maxResultLimit: 0, ... },                     // 0
  email_verified: { maxResultLimit: 0, ... },                       // 0
  rejected: { maxResultLimit: 0, ... },                             // 0
};
```

#### 2.2 실제 강제 위치
**파일**: [app/api/aed-data/route.ts:304](app/api/aed-data/route.ts#L304)

```typescript
const maxLimit = Math.min(accessScope.permissions.maxResultLimit, 10000);
// take: maxLimit 으로 Prisma 쿼리에 적용
```

### 결정: Export 엔드포인트에서도 동일하게 강제

**구현**:
```typescript
// app/api/inspections/export/route.ts

const accessScope = resolveAccessScope(userProfile);

// 클라이언트 요청 limit와 권한의 maxResultLimit 중 작은 값 사용
const finalLimit = Math.min(
  requestedFilters.limit || 1000,
  accessScope.permissions.maxResultLimit
);

const inspections = await prisma.inspections.findMany({
  // ... where 조건 ...
  take: finalLimit  // ← 여기서 강제됨
});
```

**유효성 검사**:
```typescript
// 선택사항: 0인 역할(pending_approval, email_verified, rejected)은 사전에 차단
if (accessScope.permissions.maxResultLimit <= 0) {
  return NextResponse.json(
    { error: 'Export permission denied (insufficient role)' },
    { status: 403 }
  );
}
```

**문서화**:
- [ ] 응답 헤더에 적용된 limit 포함 (선택사항)
  ```
  X-Applied-Limit: 1000
  X-Role-Max-Limit: 1000
  ```

---

## 3. 데이터 마스킹 구체화 ✅

### 기존 마스킹 함수

**파일**: [lib/data/masking.ts:34-95](lib/data/masking.ts#L34-L95)

```typescript
export function maskSensitiveData(
  devices: any[],
  accessScope: UserAccessScope
): any[]
```

### 마스킹되는 필드 (canViewSensitiveData=false 일 때)

| 필드명 | 마스킹 형식 | 예시 |
|--------|-----------|------|
| contact_phone | OO-***-OOOO | 02-***-1234 |
| detailed_address | (동/호수 제거) + *** | 서울 강남구 강남대로 *** |
| contact_email | OOO***@ | abc***@naver.com |

### Export 엔드포인트에서의 적용

**Step 1: 데이터 조회**
```typescript
let inspections = await prisma.inspections.findMany({
  // ... where, take ...
  include: {
    aed_data: true,  // AED 장비 정보
    user_profiles: true  // 점검자 정보
  }
});
```

**Step 2: 마스킹 적용**
```typescript
import { maskSensitiveData } from '@/lib/data/masking';

// 각 inspection의 aed_data에 대해 마스킹 적용
inspections = inspections.map(inspection => ({
  ...inspection,
  aed_data: maskSensitiveData(
    [inspection.aed_data],
    accessScope
  )[0]  // 배열이므로 첫 번째 요소 추출
}));
```

**Step 3: Excel 생성 (마스킹된 데이터로)**
```typescript
const worksheet = XLSX.utils.json_to_sheet(inspections);
// 마스킹된 데이터로 Excel 생성
```

### 역할별 마스킹 여부

| 역할 | canViewSensitiveData | 마스킹 적용 |
|------|----------------------|-----------|
| master | true | ❌ 미적용 |
| emergency_center_admin | true | ❌ 미적용 |
| ministry_admin | true | ❌ 미적용 |
| regional_admin | true | ❌ 미적용 |
| regional_emergency_center_admin | true | ❌ 미적용 |
| local_admin | false | ✅ 적용 |
| temporary_inspector | false | ✅ 적용 |
| pending_approval | false | ✅ 적용 |
| email_verified | false | ✅ 적용 |
| rejected | false | ✅ 적용 |

---

## 4. City_code 매핑 오류 처리 전략 ✅

### 문제 정의

```typescript
// 현재 mapCityCodeToGugun의 동작
const mapCityCodeToGugun = (cityCode: string | null | undefined): string | null => {
  if (!cityCode) return null;
  return CITY_CODE_TO_GUGUN_MAP[cityCode] || cityCode;  // ← 실패 시 원본 반환!
};

// 문제: 매핑 실패한 값(새 코드, 오탈자 등)이 조용히 통과
const unmappedCode = 'unknown_city';
const result = mapCityCodeToGugun(unmappedCode);
// result = 'unknown_city' (원본 그대로!)
// enforceFilterPolicy에서 ['unknown_city'] vs allowedCityCodes ['서귀포시'] → 403 발생
```

### 해결책: 명시적 검증 추가

**구현**:
```typescript
// app/api/inspections/export/route.ts

import { mapCityCodeToGugun, CITY_CODE_TO_GUGUN_MAP } from '@/lib/constants/regions';

// Step 1: City_code 정규화 + 검증
const normalizedCityCodes = (requestedFilters.cityCodes || []).map(code => {
  const mapped = mapCityCodeToGugun(code);

  // Check 1: null은 비어있음
  if (!mapped) {
    throw new Error(`Invalid city_code: ${code} could not be mapped`);
  }

  // Check 2: 매핑이 정말 일어났는지 확인 (원본과 다른지)
  const isValidMapping = mapped !== code || Object.values(CITY_CODE_TO_GUGUN_MAP).includes(code);

  if (!isValidMapping) {
    logger.warn('Export:CityCodeMapping', 'Unmapped city code used', {
      requestedCode: code,
      mappedValue: mapped,
      isKorean: /[가-힣]/.test(code)
    });
    // 선택: 경고 로그만 남기고 계속 진행 또는 400 throw
    // 권장: 경고 로그만 남기기 (사용자가 한글 직접 입력한 경우도 있음)
  }

  return mapped;
}).filter(Boolean);

// Step 2: enforceFilterPolicy에 정규화된 값 전달
const filterResult = enforceFilterPolicy({
  userProfile,
  accessScope,
  requestedFilters: {
    ...requestedFilters,
    cityCodes: normalizedCityCodes  // 정규화된 값만 전달
  }
});

if (!filterResult.success) {
  return NextResponse.json(
    {
      error: filterResult.reason,
      detail: filterResult.unauthorizedCities ?
        `허용되지 않은 시군구: ${filterResult.unauthorizedCities.join(', ')}` :
        undefined
    },
    { status: filterResult.status }
  );
}
```

**로깅 정책**:
```typescript
logger.warn('Export:CityCodeMapping', 'City code mapping details', {
  original: code,
  mapped: mappedValue,
  isKorean: /[가-힣]/.test(code),
  foundInMap: Object.keys(CITY_CODE_TO_GUGUN_MAP).includes(code),
  timestamp: new Date().toISOString()
});
```

### 테스트 케이스 추가

```bash
# Test Case 1: 유효한 영문 코드
curl -X POST /api/inspections/export \
  -H "Content-Type: application/json" \
  -d '{ "cityCodes": ["seogwipo"] }'
# 기대: 200 OK (매핑됨)

# Test Case 2: 유효한 한글 코드
curl -X POST /api/inspections/export \
  -d '{ "cityCodes": ["서귀포시"] }'
# 기대: 200 OK (그대로 전달)

# Test Case 3: 무효한 코드
curl -X POST /api/inspections/export \
  -d '{ "cityCodes": ["invalid_city_123"] }'
# 기대: 400 Bad Request 또는 403 Forbidden
# 로그: "Unmapped city code" 경고 기록
```

---

## 5. Can_export_data 플래그 최종 상태 ✅

### 현황 (2025-11-06 확인)

**쿼리 결과**:
```sql
SELECT
  role,
  COUNT(*) as total_count,
  COUNT(CASE WHEN can_export_data = true THEN 1 END) as export_enabled,
  COUNT(CASE WHEN can_export_data = false THEN 1 END) as export_disabled
FROM aedpics.user_profiles
WHERE role IN ('master', 'emergency_center_admin', 'regional_admin', 'local_admin')
GROUP BY role;
```

**결과**:

| role | total_count | export_enabled | export_disabled |
|------|-------------|----------------|-----------------|
| master | 1 | 1 (100%) | 0 |
| emergency_center_admin | 5 | 0 (0%) | 5 (⚠️) |
| local_admin | 10 | 10 (100%) | 0 |
| regional_admin | 0 | - | - |

### ⚠️ 발견: emergency_center_admin이 모두 false

**상태**: 구현 전 추가 업데이트 필요

**권장 조치**:
```sql
-- emergency_center_admin도 export 권한 활성화
UPDATE aedpics.user_profiles
SET can_export_data = true
WHERE role IN ('emergency_center_admin', 'regional_emergency_center_admin')
  AND can_export_data = false;

-- 검증
SELECT
  role,
  COUNT(*) as total,
  COUNT(CASE WHEN can_export_data = true THEN 1 END) as enabled
FROM aedpics.user_profiles
WHERE role IN ('emergency_center_admin', 'regional_emergency_center_admin')
GROUP BY role;
```

### QA 테스트 계정 최종 상태

| 계정 | 역할 | 지역 | can_export_data | 테스트 가능 |
|------|------|------|-----------------|-----------|
| Master | master | 전국 | ✅ true | ✅ 가능 |
| ECC Admin 1-5 | emergency_center_admin | 전국 | ❌ false (주의!) | ⚠️ SQL 업데이트 필요 |
| Local Admin 1-10 | local_admin | 지역별 | ✅ true | ✅ 가능 |
| Temporary | temporary_inspector | 지정장비 | false | ❌ 불가 (의도적) |

---

## 6. QA 테스트 시나리오 구체화 ✅

### 예시: A-2 Local_admin (자신의 지역)

**이전 (모호함)**:
```
A-2: Local_admin export (자신의 지역)
기대 결과: 200 OK
응답: Excel 파일 + 서귀포시 점검 데이터만
이유: 제약이 정확히 일치
```

**개선된 버전 (명확함)**:
```
A-2: Local_admin export (자신의 지역)

요청:
POST /api/inspections/export
Authorization: Bearer <local_admin_seogwipo_token>
Content-Type: application/json
{
  "regionCodes": ["JEJ"],
  "cityCodes": ["seogwipo"],
  "limit": 100
}

기대 HTTP Response:
- Status: 200 OK
- Headers:
  - Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  - Content-Disposition: attachment; filename="export_*.xlsx"
- Body: Excel 파일 바이너리

검증 항목:
1. Status가 정확히 200인가?
2. Excel 파일이 유효한가? (file 명령어로 확인)
3. Excel 행 개수가 <= 1,000개인가? (local_admin maxResultLimit)
4. 모든 행의 sido='제주특별자치도', gugun='서귀포시'인가?
5. 민감정보(phone, email, detailed_address) 마스킹되었는가?
```

### 예시: A-3 Local_admin (권한 없는 지역)

**개선된 버전**:
```
A-3: Local_admin export (권한 없는 지역 요청 - 거부)

요청:
POST /api/inspections/export
Authorization: Bearer <local_admin_seogwipo_token>
Content-Type: application/json
{
  "regionCodes": ["DAE"],
  "cityCodes": ["jung"]
}

기대 HTTP Response:
- Status: 403 Forbidden
- Content-Type: application/json
- Body:
  {
    "error": "허용되지 않은 시도 코드가 포함되어 있습니다",
    "unauthorizedRegions": ["DAE"],
    "details": {
      "userAllowedRegions": ["JEJ"],
      "requestedRegions": ["DAE"]
    }
  }

검증 항목:
1. Status가 정확히 403인가?
2. error 메시지가 명확한가?
3. unauthorizedRegions 배열에 정확한 코드가 포함되었는가?
```

### 테스트 체크리스트 (구체화)

```markdown
## Test Execution Checklist

### Group A: Permission Validation

- [ ] A-1: Master account
  - [ ] POST /api/inspections/export (전국)
  - [ ] Response status: 200
  - [ ] Excel file present
  - [ ] Row count: <= 10,000 (maxResultLimit)

- [ ] A-2: Local_admin own region
  - [ ] POST /api/inspections/export (자신의 지역)
  - [ ] Response status: 200
  - [ ] Excel file present
  - [ ] Row count: <= 1,000 (maxResultLimit)
  - [ ] All rows: sido, gugun match

- [ ] A-3: Local_admin forbidden region
  - [ ] POST /api/inspections/export (권한 없는 지역)
  - [ ] Response status: 403
  - [ ] Response body contains "unauthorizedRegions"

- [ ] A-4: Temporary_inspector
  - [ ] POST /api/inspections/export
  - [ ] Response status: 403
  - [ ] Error: "Export permission denied"

- [ ] A-5: Ministry_admin
  - [ ] POST /api/inspections/export
  - [ ] Response status: 403
  - [ ] Error: "read-only role"

### Group B: Filter Auto-filling

- [ ] B-1: Region auto-filled
  - [ ] Request: cityCodes only (regionCodes 미지정)
  - [ ] Response status: 200
  - [ ] Metadata: { appliedDefaults: ['sido'] }

- [ ] B-2: Missing required filter
  - [ ] Request: regionCodes only (cityCodes 미지정, local_admin)
  - [ ] Response status: 400
  - [ ] Error: "missingFilters": ["gugun"]

### Group C: Data Limits

- [ ] C-1: Master (limit: 10,000)
  - [ ] Request: limit=50000
  - [ ] Response: limited to 10,000 rows
  - [ ] Header: X-Applied-Limit: 10000

- [ ] C-2: Local_admin (limit: 1,000)
  - [ ] Request: limit=5000
  - [ ] Response: limited to 1,000 rows
  - [ ] Header: X-Applied-Limit: 1000

### Group D: Data Masking

- [ ] D-1: Master (canViewSensitiveData=true)
  - [ ] contact_phone: Not masked (전체 표시)
  - [ ] contact_email: Not masked (전체 표시)
  - [ ] detailed_address: Not masked (전체 표시)

- [ ] D-2: Local_admin (canViewSensitiveData=false)
  - [ ] contact_phone: Masked (XX-***-XXXX)
  - [ ] contact_email: Masked (XXX***@)
  - [ ] detailed_address: Masked (끝 부분 제거)

### Group E: City_code Mapping

- [ ] E-1: Valid English code
  - [ ] cityCodes: ["seogwipo"]
  - [ ] Response status: 200
  - [ ] Log: No warnings

- [ ] E-2: Valid Korean code
  - [ ] cityCodes: ["서귀포시"]
  - [ ] Response status: 200
  - [ ] Log: No warnings

- [ ] E-3: Invalid code
  - [ ] cityCodes: ["unknown_city_xyz"]
  - [ ] Response status: 403 or 400
  - [ ] Log: "Unmapped city code" warning
```

---

## 7. 최종 구현 체크리스트

### Pre-Implementation Checklist

- [x] enforceFilterPolicy 완전 분석
- [x] maxResultLimit 코드 위치 확인 (lib/auth/access-control.ts + app/api/aed-data/route.ts)
- [x] 데이터 마스킹 함수 확인 (lib/data/masking.ts)
- [x] Excel 라이브러리 선정 (xlsx - SheetJS)
- [x] can_export_data 플래그 상태 확인 (local_admin: 100%, emergency_center_admin: 0%)
- [x] city_code 매핑 오류 처리 정책 수립

### Implementation Ready

#### A. 권한 검증
```typescript
// Layer 1: can_export_data flag (DB)
if (!profile?.can_export_data) {
  return NextResponse.json({ error: 'Export permission denied' }, { status: 403 });
}

// Layer 2: Role-based check
const exportableRoles = ['master', 'emergency_center_admin', 'regional_emergency_center_admin', 'regional_admin', 'local_admin'];
if (!exportableRoles.includes(profile.role)) {
  return NextResponse.json({ error: 'Role cannot export' }, { status: 403 });
}

// Layer 3: maxResultLimit check
if (accessScope.permissions.maxResultLimit <= 0) {
  return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
}
```

#### B. Filter 처리
```typescript
// City_code 매핑 + 검증
const normalizedCityCodes = (requestedFilters.cityCodes || [])
  .map(code => {
    const mapped = mapCityCodeToGugun(code);
    if (!mapped) {
      logger.warn('Export:CityCodeMapping', 'Invalid city_code', { code });
    }
    return mapped;
  })
  .filter(Boolean);

// enforceFilterPolicy 호출
const filterResult = enforceFilterPolicy({
  userProfile,
  accessScope,
  requestedFilters: {
    ...requestedFilters,
    cityCodes: normalizedCityCodes
  }
});

if (!filterResult.success) {
  return NextResponse.json(
    { error: filterResult.reason },
    { status: filterResult.status }
  );
}
```

#### C. 데이터 조회 + 마스킹
```typescript
// 데이터 조회 (maxResultLimit 강제)
let inspections = await prisma.inspections.findMany({
  where: buildWhereClause(filterResult.filters),
  take: Math.min(
    requestedFilters.limit || 1000,
    accessScope.permissions.maxResultLimit
  )
});

// 마스킹 적용
inspections = inspections.map(inspection => ({
  ...inspection,
  aed_data: maskSensitiveData([inspection.aed_data], accessScope)[0]
}));
```

#### D. Excel 생성 + 응답
```typescript
// XLSX 생성
const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.json_to_sheet(inspections);
XLSX.utils.book_append_sheet(workbook, worksheet, 'Inspections');

const excelBuffer = XLSX.write(workbook, {
  bookType: 'xlsx',
  type: 'array'
});

// 감사 로그
logDataAccess({
  userId: profile.id,
  action: 'export',
  recordCount: inspections.length,
  filters: filterResult.filters,
  success: true
});

// 응답 전송
return new NextResponse(Buffer.from(excelBuffer), {
  headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="AED_export_${Date.now()}.xlsx"`,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'X-Applied-Limit': inspections.length.toString()
  }
});
```

### Testing Ready

- [ ] SQL 실행: emergency_center_admin도 can_export_data=true로 업데이트 (필수!)
- [ ] 8개 시나리오 모두 테스트 (A1-A5, B1-B2, C1-C2, D1-D2, E1-E3)
- [ ] 각 시나리오별 HTTP status + response body JSON 검증
- [ ] Excel 파일 유효성 확인 (file 명령어)
- [ ] 데이터 마스킹 확인 (민감정보 가려짐)
- [ ] 로그 기록 확인

---

## 8. 다음 액션

### Phase 1+: 긴급 SQL 업데이트 (5분)

```sql
-- Emergency center admin 플래그 활성화
UPDATE aedpics.user_profiles
SET can_export_data = true
WHERE role IN ('emergency_center_admin', 'regional_emergency_center_admin')
  AND can_export_data = false;

-- 검증
SELECT
  role,
  COUNT(*) as total,
  COUNT(CASE WHEN can_export_data = true THEN 1 END) as enabled
FROM aedpics.user_profiles
WHERE role IN ('master', 'emergency_center_admin', 'regional_emergency_center_admin', 'local_admin')
GROUP BY role
ORDER BY role;
```

### Phase 4: 구현 시작 (2-3시간)

1. `/api/inspections/export/route.ts` 생성
2. 위의 4가지 섹션 (A-D) 구현
3. TypeScript + ESLint 검증
4. 로컬 테스트

### QA & 배포 (2-3시간)

1. 8개 시나리오 테스트 (위의 체크리스트)
2. 성능 테스트 (10,000개 행 Excel 생성)
3. 코드 리뷰
4. Production 배포

---

**상태**: 🟢 구현 직전 모든 불명확성 제거 완료
**다음**: Phase 1 SQL 업데이트 → Phase 4 구현 시작

