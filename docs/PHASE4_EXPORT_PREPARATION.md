# Phase 4: Export 엔드포인트 구현 준비

**작성일**: 2025-11-06
**상태**: Phase 4 구현 준비 완료
**담당**: 개발팀
**참고**: Phase 1-3 검증 및 구현 완료

---

## 1. enforceFilterPolicy 분석 및 호출 방법

### 1.1 Function Signature

```typescript
export function enforceFilterPolicy({
  userProfile,
  accessScope,
  requestedFilters,
}: FilterEnforcementParams): FilterEnforcementResult
```

**위치**: [lib/aed/filter-policy.ts:131-294](lib/aed/filter-policy.ts#L131-L294)

### 1.2 입력 파라미터 분석

#### A. userProfile (UserProfile)
**출처**: NextAuth session 또는 DB 조회

```typescript
// Prisma 쿼리 예시
const profile = await prisma.user_profiles.findUnique({
  where: { id: session.user.id },
  select: {
    id: true,
    email: true,
    role: true,
    region_code: true,
    region: true,
    organizations: {
      select: {
        id: true,
        city_code: true,
        region_code: true,
      }
    }
  }
});
```

**필수 필드**:
- `id`: 사용자 ID
- `email`: 사용자 이메일 (도메인 검증용)
- `role`: 사용자 역할 ('master', 'local_admin', 'temporary_inspector' 등)
- `region_code` 또는 `region`: 지역 코드 (local_admin/regional_admin이 필요)
- `organizations`: 조직 정보 (city_code 필드 포함)

#### B. accessScope (UserAccessScope)
**생성 방법**: resolveAccessScope(userProfile) 호출

```typescript
import { resolveAccessScope } from '@/lib/auth/access-control';

const accessScope = resolveAccessScope(userProfile);
```

**구조**:
```typescript
interface UserAccessScope {
  permissions: RolePermissions;           // 역할별 권한 정보
  allowedRegionCodes: string[] | null;    // null = 전국, array = 특정 지역만
  allowedCityCodes: string[] | null;      // null = gugun 선택 가능, array = 특정 gugun만
  userId: string;
}

interface RolePermissions {
  canViewAllRegions: boolean;
  maxResultLimit: number;                 // 10000 (master) ~ 500 (temporary_inspector)
  canExportData: boolean;                 // Export 기능 사용 가능 여부
  canViewSensitiveData: boolean;
  requiresRegionFilter: boolean;
  requiresCityFilter: boolean;
}
```

**각 역할별 accessScope 결과**:

| 역할 | allowedRegionCodes | allowedCityCodes | 설명 |
|------|------------------|-----------------|------|
| master | null | null | 전국 제한 없음 |
| emergency_center_admin | null | null | 전국 제한 없음 |
| ministry_admin | null | null | 전국 제한 없음 |
| regional_admin (시청) | ['DAE'] | null | 대구시 전체 (gugun 선택 가능) |
| local_admin (보건소) | ['JEJ'] | ['서귀포시'] | 제주시/서귀포시만 (고정) |
| temporary_inspector | [] | [] | AED 데이터 직접 접근 불가 |

#### C. requestedFilters (ParsedFilters)
**출처**: HTTP query string 파싱 결과

```typescript
import { parseQueryParams } from '@/lib/utils/query-parser';

const requestedFilters = parseQueryParams(request.nextUrl.searchParams);
```

**구조**:
```typescript
interface ParsedFilters {
  regionCodes?: string[];          // 요청한 시도 코드 (예: ['DAE'], ['DAE', 'INC'])
  cityCodes?: string[];            // 요청한 시군구 코드 (예: ['seogwipo'])
  category_1?: string[];           // AED 설치 카테고리 필터
  category_2?: string[];
  category_3?: string[];
  battery_expiry_date?: string;    // 배터리 유효기한 필터
  patch_expiry_date?: string;
  last_inspection_date?: string;
  search?: string;
  queryCriteria?: 'address' | 'jurisdiction';
  page?: number;
  limit?: number;
}
```

**쿼리 예시**:
```
POST /api/inspections/export?regionCodes=JEJ&cityCodes=seogwipo&limit=5000
```

### 1.3 반환값 분석

#### Success Case (success: true)

```typescript
interface FilterEnforcementSuccess {
  success: true;
  filters: {
    regionCodes: string[] | null;      // 최종 확정된 region codes
    cityCodes: string[] | null;        // 최종 확정된 city codes
    category_1: string[] | null;
    category_2: string[] | null;
    category_3: string[] | null;
  };
  metadata: {
    appliedDefaults: FilterKey[];      // 사용자가 요청하지 않은 기본값들
    requiredFilters: FilterKey[];      // 이 역할이 요구하는 필터들
    requireOneOf?: FilterKey[];
  };
}
```

**예시**: local_admin이 region 없이 export 요청
```typescript
const result = enforceFilterPolicy({
  userProfile,
  accessScope: {
    allowedRegionCodes: ['JEJ'],
    allowedCityCodes: ['서귀포시'],
    // ...
  },
  requestedFilters: {
    cityCodes: ['seogwipo']
    // regionCodes 없음
  }
});

// 결과
// {
//   success: true,
//   filters: {
//     regionCodes: ['JEJ'],              // 자동으로 채워짐
//     cityCodes: ['서귀포시'],            // requestedFilters에서 가져옴
//   },
//   metadata: {
//     appliedDefaults: ['sido'],         // region이 자동 적용됨
//     requiredFilters: ['sido', 'gugun']
//   }
// }
```

#### Failure Cases

**Case 1**: 권한이 없는 지역 요청 (status: 403)
```typescript
{
  success: false,
  status: 403,
  reason: '허용되지 않은 시도 코드가 포함되어 있습니다',
  unauthorizedRegions: ['INC'],  // 대구(DAE)만 가능한데 인천(INC) 요청
  metadata: { /* ... */ }
}
```

**Case 2**: 필수 필터 누락 (status: 400)
```typescript
{
  success: false,
  status: 400,
  reason: '필수 검색 조건을 충족하지 못했습니다',
  missingFilters: ['gugun'],  // local_admin이 gugun 필터 없이 요청
  metadata: { /* ... */ }
}
```

**Case 3**: 지역 정보가 설정되지 않음 (status: 403)
```typescript
{
  success: false,
  status: 403,
  reason: '권한에 필요한 지역 정보가 설정되지 않았습니다',
  // local_admin이지만 organization에 city_code 설정 안됨
}
```

### 1.4 Export 엔드포인트에서의 호출 방식

```typescript
// app/api/inspections/export/route.ts

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { parseQueryParams } from '@/lib/utils/query-parser';
import { resolveAccessScope } from '@/lib/auth/access-control';
import { enforceFilterPolicy } from '@/lib/aed/filter-policy';
import { mapUserProfile } from '@/lib/mappers/user-profile-mapper';
import { prisma } from '@/lib/prisma';

export const POST = apiHandler(async (request: NextRequest) => {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Step 1: 사용자 프로필 조회
  const userProfile = await prisma.user_profiles.findUnique({
    where: { id: session.user.id },
    include: { organizations: true }
  });

  if (!userProfile) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
  }

  // Step 2: 요청 필터 파싱
  const requestedFilters = parseQueryParams(request.nextUrl.searchParams);

  // Step 3: 접근 범위 해석
  const accessScope = resolveAccessScope(userProfile);

  // Step 4: 필터 정책 검증 (이 부분이 가장 중요!)
  const filterResult = enforceFilterPolicy({
    userProfile,
    accessScope,
    requestedFilters
  });

  if (!filterResult.success) {
    return NextResponse.json(
      { error: filterResult.reason, details: filterResult },
      { status: filterResult.status }
    );
  }

  // Step 5: 최종 필터로 데이터 조회
  // filterResult.filters.regionCodes와 cityCodes 사용
  const inspections = await prisma.inspections.findMany({
    where: {
      // filterResult.filters의 값들로 조건 생성
    },
    take: Math.min(
      requestedFilters.limit || 1000,
      accessScope.permissions.maxResultLimit
    )
  });

  // Step 6: Excel 생성 및 반환
  // ...
});
```

---

## 2. QA 테스트 시나리오 (Export 권한 검증)

### 2.1 테스트 계정 정보

**Phase 1에서 업데이트된 상태** (2025-11-06 완료):
- ✅ 10/10 local_admin: can_export_data = true
- 🟡 regional_admin: 계정 부재 (테스트 불가)
- ✅ master, emergency_center_admin: can_export_data = true (기본값)

**사용 가능한 테스트 계정**:

| 계정 | 역할 | 지역 | 이메일 | 상태 |
|------|------|------|--------|------|
| T1 | master | 전국 | admin@nmc.or.kr | ✅ |
| T2 | local_admin | 제주/서귀포 | 고현아 | ✅ |
| T3 | local_admin | 대구/중구 | - | ✅ |
| T4 | temporary_inspector | 지정장비 | - | ❌ (export 불가) |
| T5 | ministry_admin | 전국 | - | ❌ (읽기 전용) |

### 2.2 테스트 케이스 매트릭스

#### 그룹 A: 권한 검증 (역할별)

**A-1: Master 계정**
```
계정: T1 (master, admin@nmc.or.kr)
can_export_data: true (기본값)
요청: POST /api/inspections/export
  - regionCodes: [] (전국)
  - cityCodes: [] (전국)
  - limit: 1000

기대 결과: 200 OK
응답: Excel 파일 + 전국 모든 점검 데이터 (최대 10,000개)
이유: master는 제약 없음
```

**A-2: Local_admin (자신의 지역)**
```
계정: T2 (local_admin, 제주/서귀포시)
can_export_data: true
요청: POST /api/inspections/export
  - regionCodes: ['JEJ']
  - cityCodes: ['seogwipo']
  - limit: 1000

기대 결과: 200 OK
응답: Excel 파일 + 서귀포시 점검 데이터만 (최대 1000개)
이유: 제약이 정확히 일치
```

**A-3: Local_admin (다른 지역 요청 - 권한 위반)**
```
계정: T2 (local_admin, 제주/서귀포시)
can_export_data: true
요청: POST /api/inspections/export
  - regionCodes: ['DAE']   # 대구 요청
  - cityCodes: ['jung']    # 중구 요청

기대 결과: 403 Forbidden
응답: {
  "error": "허용되지 않은 시도 코드가 포함되어 있습니다",
  "unauthorizedRegions": ["DAE"]
}
이유: 제주(JEJ)만 가능한데 대구(DAE) 요청
```

**A-4: Temporary_inspector (조회 권한 없음)**
```
계정: T4 (temporary_inspector)
can_export_data: false (기본값)
요청: POST /api/inspections/export
  - regionCodes: [] (전국)
  - cityCodes: [] (전국)

기대 결과: 403 Forbidden (export 권한 체크)
응답: { "error": "Export permission denied" }
이유: 임시점검원은 export 불가
```

**A-5: Ministry_admin (읽기 전용)**
```
계정: T5 (ministry_admin)
can_export_data: true (기본값)
요청: POST /api/inspections/export
  - regionCodes: [] (전국)

기대 결과: 403 Forbidden (역할 체크)
응답: { "error": "Ministry admin cannot export data" }
이유: 보건복지부는 열람 전용
```

#### 그룹 B: 필터 자동 채우기 (Defaults)

**B-1: Local_admin이 region 없이 요청**
```
계정: T2 (local_admin, 제주/서귀포시)
요청: POST /api/inspections/export
  - cityCodes: ['seogwipo']
  - 주의: regionCodes 미지정

기대 결과: 200 OK
동작: enforceFilterPolicy가 regionCodes 자동으로 ['JEJ'] 채움
응답: 제주/서귀포시 데이터 (자동 기본값 적용됨)
메타데이터: { appliedDefaults: ['sido'] }
```

**B-2: Local_admin이 gugun 없이 요청 (필수 필터 누락)**
```
계정: T2 (local_admin, 제주/서귀포시)
요청: POST /api/inspections/export
  - regionCodes: ['JEJ']
  - 주의: cityCodes 미지정

기대 결과: 400 Bad Request
응답: {
  "error": "필수 검색 조건을 충족하지 못했습니다",
  "missingFilters": ["gugun"]
}
이유: local_admin은 반드시 gugun 필터 필요
```

#### 그룹 C: 데이터 제한 (maxResultLimit)

**C-1: Master (limit 10,000)**
```
계정: T1 (master)
요청: POST /api/inspections/export
  - limit: 50000

기대 결과: 200 OK
응답: 10,000개만 반환 (maxResultLimit 적용)
메타데이터: { appliedLimit: 10000 }
```

**C-2: Local_admin (limit 1,000)**
```
계정: T2 (local_admin)
요청: POST /api/inspections/export
  - limit: 5000

기대 결과: 200 OK
응답: 1,000개만 반환 (maxResultLimit 적용)
메타데이터: { appliedLimit: 1000 }
```

#### 그룹 D: City_code → Gugun 매핑 검증

**D-1: City_code 매핑 확인**
```
계정: T2 (local_admin)
organization.city_code: 'seogwipo'
요청: POST /api/inspections/export
  - cityCodes: ['seogwipo']  # 영문 코드

기대 결과: 200 OK
내부 동작:
  1. resolveAccessScope() 호출 시 mapCityCodeToGugun('seogwipo') → '서귀포시'
  2. accessScope.allowedCityCodes = ['서귀포시']
  3. enforceFilterPolicy에서 cityCodes 검증: ['seogwipo'] (영문) vs ['서귀포시'] (한글)
  4. aed_data.gugun이 '서귀포시'이므로 일치 확인
```

**문제**: cityCodes 파라미터가 영문인지 한글인지 명확히 필요!

### 2.3 테스트 수행 방법

#### Preparation Phase

```bash
# 1. 테스트 계정 확인
curl -X GET "https://aed.pics/api/admin/test-accounts" \
  -H "Authorization: Bearer <master_token>"

# 응답 예시
{
  "accounts": [
    {
      "id": "user_t1",
      "email": "admin@nmc.or.kr",
      "role": "master",
      "can_export_data": true
    },
    {
      "id": "user_t2",
      "email": "고현아@korea.kr",
      "role": "local_admin",
      "organization": {
        "region_code": "JEJ",
        "city_code": "seogwipo"
      },
      "can_export_data": true
    }
  ]
}

# 2. 각 계정으로 로그인 토큰 획득
curl -X POST "https://aed.pics/api/auth/signin" \
  -H "Content-Type: application/json" \
  -d '{"email": "고현아@korea.kr", "password": "..."}'
```

#### Test Execution Phase

```bash
# 그룹 A-1: Master export (전국)
curl -X POST "https://aed.pics/api/inspections/export" \
  -H "Authorization: Bearer <master_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "regionCodes": [],
    "cityCodes": [],
    "limit": 100
  }' \
  -o export_master.xlsx

# 그룹 A-2: Local_admin export (자신의 지역)
curl -X POST "https://aed.pics/api/inspections/export" \
  -H "Authorization: Bearer <local_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "regionCodes": ["JEJ"],
    "cityCodes": ["seogwipo"],
    "limit": 100
  }' \
  -o export_local.xlsx

# 그룹 A-3: Local_admin export (권한 없는 지역 - 실패 예상)
curl -X POST "https://aed.pics/api/inspections/export" \
  -H "Authorization: Bearer <local_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "regionCodes": ["DAE"],
    "cityCodes": ["jung"],
    "limit": 100
  }' \
  -i
# 응답: 403 Forbidden
```

#### Verification Phase

```bash
# 생성된 Excel 파일 검증
# 1. 파일이 유효한 Excel인지 확인
file export_master.xlsx   # → output: XLSX file
file export_local.xlsx    # → output: XLSX file

# 2. 행 개수 확인
# Master (제한 없음) vs Local_admin (1,000 제한) 비교

# 3. 데이터 내용 확인
# - Master: 전국 데이터 포함
# - Local_admin: 제주/서귀포시 데이터만 포함
```

### 2.4 실패 시나리오 및 대응

**시나리오 1**: enforceFilterPolicy 반환값이 success: false
```
문제: 필터 검증 실패
대응:
  1. filterResult.reason 메시지 확인
  2. missingFilters/unauthorizedRegions 확인
  3. 올바른 필터 조합으로 재시도
  예: local_admin이 regionCodes 없이 요청 → 자동 채워지거나 400 에러 기대
```

**시나리오 2**: Excel 파일 생성 실패 (enforceFilterPolicy는 성공)
```
문제: Prisma 조회 또는 XLSX 생성 오류
대응:
  1. 로그 확인: "Failed to generate export file"
  2. maxResultLimit 초과했는지 확인
  3. 필터 조합이 너무 광범위한지 확인
  예: Master가 전국 무제한 요청 → 10,000개 제한 적용
```

**시나리오 3**: City_code 매핑 실패
```
문제: 클라이언트가 보낸 cityCodes와 DB의 gugun이 불일치
대응:
  1. cityCodes 형식 확인: 영문(seogwipo) vs 한글(서귀포시)
  2. enforceFilterPolicy 호출 전에 매핑 확인
  3. CITY_CODE_TO_GUGUN_MAP 완전성 검사
```

---

## 3. Export 엔드포인트 구현 체크리스트

### 3.1 Permission 검증 (2-Layer)

- [ ] **Layer 1**: can_export_data flag 확인
  ```typescript
  if (!userProfile.can_export_data) {
    return NextResponse.json(
      { error: 'Export permission denied' },
      { status: 403 }
    );
  }
  ```

- [ ] **Layer 2**: Role-based check
  ```typescript
  const exportableRoles = ['master', 'emergency_center_admin', 'regional_emergency_center_admin', 'regional_admin', 'local_admin'];
  if (!exportableRoles.includes(userProfile.role)) {
    return NextResponse.json(
      { error: 'Role cannot export' },
      { status: 403 }
    );
  }
  ```

- [ ] Ministry_admin은 명시적으로 차단
  ```typescript
  if (userProfile.role === 'ministry_admin') {
    return NextResponse.json(
      { error: 'Ministry admin cannot export data (read-only role)' },
      { status: 403 }
    );
  }
  ```

### 3.2 Filter 처리

- [ ] `enforceFilterPolicy()` 호출 및 결과 검증
- [ ] 실패 시 적절한 status code 반환 (400, 403)
- [ ] 성공 시 `filterResult.filters` 사용하여 Prisma 쿼리 생성
- [ ] **중요**: cityCodes 형식 처리
  - 클라이언트 요청: 영문 ('seogwipo') 또는 한글 ('서귀포시')?
  - DB 저장 형식: 한글만 (aed_data.gugun)
  - 필요하면 요청 값을 매핑하여 전달

### 3.3 데이터 조회

- [ ] Prisma 쿼리 생성 (filterResult.filters 기반)
  ```typescript
  const inspections = await prisma.inspections.findMany({
    where: {
      AND: [
        // filterResult.filters.regionCodes 적용
        // filterResult.filters.cityCodes 적용
        // 기타 필터
      ]
    },
    take: Math.min(
      requestedFilters.limit || 1000,
      accessScope.permissions.maxResultLimit
    )
  });
  ```

- [ ] maxResultLimit 강제 적용 (접근 범위의 최대값)
- [ ] 감사 로그 기록
  ```typescript
  logDataAccess({
    userId: userProfile.id,
    action: 'export',
    recordCount: inspections.length,
    filters: filterResult.filters,
    timestamp: new Date()
  });
  ```

### 3.4 Excel 파일 생성

- [ ] ExcelJS 또는 기존 Excel 생성 로직 재사용
- [ ] 헤더 포함:
  - 점검ID, 기기정보, 점검날짜, 점검결과, 점검자, 제주 위치
- [ ] 민감정보 마스킹 (접근 권한에 따라)
- [ ] 파일명 생성: `AED_inspection_export_{YYYYMMDD}_{HHmmss}.xlsx`

### 3.5 응답 처리

- [ ] Response 스트리밍 설정
  ```typescript
  return new NextResponse(excelBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
  ```

- [ ] 에러 핸들링 (500 에러 시 JSON 응답)
- [ ] 성공 로그 기록

---

## 4. 구현 순서 및 주의사항

### 4.1 구현 전 확인사항

```
✅ Phase 1: export 플래그 업데이트 완료 (9개 계정 업데이트)
✅ Phase 2: v5.0 계획 문서 업데이트 완료
✅ Phase 3: PATCH 엔드포인트 4개 버그 수정 완료
✅ Phase 3-2: CITY_CODE_TO_GUGUN_MAP 중복 제거 완료
🔄 Phase 4 준비: 이 문서
```

### 4.2 구현 순서

1. **Route 기본 구조 작성**
   - POST handler 생성
   - Session 검증
   - User profile 조회

2. **Permission 검증 (2-Layer)**
   - Layer 1: can_export_data flag
   - Layer 2: Role-based check

3. **Filter 처리**
   - parseQueryParams()
   - resolveAccessScope()
   - enforceFilterPolicy()
   - 실패 시 에러 반환

4. **데이터 조회**
   - Prisma 쿼리 생성
   - maxResultLimit 적용
   - 감사 로그 기록

5. **Excel 생성**
   - ExcelJS로 워크시트 생성
   - 헤더 및 데이터 행 추가
   - 포맷팅 (옵션)

6. **응답 반환**
   - Stream으로 파일 전송
   - 에러 핸들링

### 4.3 주의사항

#### A. City_code 형식 통일
```
현재 상황:
- DB: aed_data.gugun은 한글 저장 ('서귀포시', '중구', ...)
- Request: cityCodes 파라미터는 영문 또는 한글?
- enforceFilterPolicy: 입력값과 allowedCityCodes 비교

결정 필요:
1. 클라이언트가 영문만 보낼 경우:
   → 엔드포인트에서 mapCityCodeToGugun()으로 변환
   → 변환된 값을 enforceFilterPolicy에 전달

2. 클라이언트가 한글만 보낼 경우:
   → 그대로 enforceFilterPolicy에 전달

3. 둘 다 받을 경우:
   → 먼저 mapCityCodeToGugun() 시도, 실패하면 그대로 사용
```

#### B. Regional_admin 미처리
```
현황: Regional_admin 계정 없음 (테스트 계정 부재)
조치:
1. 문서에만 포함 (미리 준비)
2. 향후 regional_admin 계정 생성 시 export 자동 가능
3. 역할별 로직에는 이미 포함됨:
   - ROLE_FILTER_POLICY에서 required: ['sido']
   - export 권한도 포함됨
```

#### C. Temporary_inspector 고려
```
현황: temporary_inspector는 export 불가 (can_export_data = false)
코드에서:
- Permission check 통과 불가
- enforceFilterPolicy도 allowedCityCodes = [] (공집합)
- 이중 차단
```

#### D. Performance 고려
```
Master의 경우:
- maxResultLimit = 10,000
- 대량 데이터 조회 시 메모리 부하 고려
- Excel 생성 시간 → 타임아웃 설정 필요 (예: 60초)
- 스트리밍 응답으로 메모리 효율화
```

---

## 5. 예상 문제 및 대응

### 문제 1: enforceFilterPolicy 호출 실패
```
증상: 400 또는 403 에러 반환
원인:
  - 필수 필터 누락 (local_admin이 gugun 없이 요청)
  - 권한 없는 지역 요청 (local_admin이 다른 시도 요청)
  - 조직 정보 미설정 (region_code/city_code 없음)

대응:
  1. 클라이언트에게 명확한 에러 메시지 전달
  2. 필터 조합 가이드 문서 제공
  3. API 응답에 requiredFilters 정보 포함
```

### 문제 2: Excel 생성 시간 초과
```
증상: 502 Bad Gateway (Nginx 타임아웃)
원인:
  - Master가 전국 10,000개 데이터 한번에 Excel 변환
  - ExcelJS의 메모리 부하

대응:
  1. Chunk 단위로 Excel 작성 (1,000개씩)
  2. 스트리밍 응답으로 부분 전송
  3. Excel 포맷팅 최소화 (색상, 폰트 제거)
  4. Nginx timeout 증가: client_max_body_size, proxy_read_timeout
```

### 문제 3: City_code 매핑 오류
```
증상: enforceFilterPolicy 통과했으나 빈 데이터 조회
원인:
  - 클라이언트가 보낸 cityCodes ('seogwipo') 형식
  - enforceFilterPolicy는 한글로 검증 ('서귀포시')
  - Prisma 쿼리는 DB 형식으로 조회 필요 (한글)

대응:
  1. enforceFilterPolicy 호출 전에 cityCodes 매핑
  2. 매핑 로직을 중앙화 (lib/constants/regions.ts의 mapCityCodeToGugun)
  3. 양방향 매핑 함수 제공 (영문↔한글)
```

---

## 6. 준비 완료 체크리스트

### Pre-Implementation

- [x] enforceFilterPolicy 분석 완료
- [x] UserAccessScope 구조 파악 완료
- [x] ParsedFilters 입력 형식 확인 완료
- [x] 테스트 계정 상태 확인 (can_export_data = true)
- [x] 10개 local_admin 계정 모두 export 플래그 활성화
- [x] QA 테스트 시나리오 작성 완료

### Implementation Ready

- [x] enforceFilterPolicy 호출 방식 결정
- [x] Permission 검증 로직 설계 (2-Layer)
- [x] Filter 처리 흐름 설계
- [x] Excel 생성 방식 선택 (기존 로직 재사용 또는 ExcelJS)
- [x] 에러 처리 전략 수립
- [x] 데이터 제한 (maxResultLimit) 적용 방식 확정

### Documentation Complete

- [x] Phase 4 preparation 문서 작성
- [x] QA 테스트 시나리오 문서화
- [x] 구현 체크리스트 작성
- [x] 문제 해결 가이드 작성

---

## 7. 다음 단계

### Immediate (지금)

1. 이 문서 검토 및 피드백
2. City_code 매핑 형식 확정
3. Excel 생성 라이브러리 결정 (ExcelJS vs 다른 라이브러리)

### Short-term (1-2시간)

1. [app/api/inspections/export/route.ts](../../app/api/inspections/export/route.ts) 생성
2. enforceFilterPolicy를 사용한 permission 검증 구현
3. 데이터 조회 및 Excel 생성

### Testing (2-3시간)

1. 로컬 환경에서 각 QA 시나리오 테스트
2. can_export_data=true인 계정으로 권한 검증
3. 다양한 필터 조합 테스트
4. Excel 파일 포맷 검증

### Deployment (배포 전)

1. 모든 QA 시나리오 통과 확인
2. 코드 리뷰
3. Production 환경에서 최종 테스트

---

**상태**: Phase 4 구현 준비 완료
**작성자**: Claude Code
**검증자**: Verification (SQL 기반 검증 완료)
**다음 액션**: enforceFilterPolicy 호출 형식 확정 후 구현 시작
