# API Response & Type Consistency Skill

## 목적
API 엔드포인트의 응답 스키마와 TypeScript 타입 정의가 항상 동기화되어 있는지 검증하고, 타입 불일치로 인한 런타임 에러를 사전에 방지합니다.

## 개요
이 Skill은 API 추가/수정 직후, 정기적인 타입 검증 시 다음을 자동으로 검증합니다:
- API 응답 데이터 vs TypeScript 타입 매칭
- 필드명 일관성 (camelCase vs snake_case)
- 필수 필드 누락 확인
- Optional 필드 올바른 설정
- 응답 시간 분석
- 페이지네이션 패턴 일관성
- 에러 응답 형식 통일
- OpenAPI 문서 최신 상태

## 실행 방법

### 1단계: API 응답 샘플 수집
```bash
# 모든 API 엔드포인트 목록 생성
find app/api -name "route.ts" | sort > /tmp/api-routes.txt

# 각 API의 응답 스키마 문서 확인
grep -r "NextResponse.json" app/api/*/route.ts | head -20
```

### 2단계: 필드명 일관성 검사
```bash
# camelCase vs snake_case 검사 패턴

# DB에서 조회 시 (snake_case)
SELECT user_id, region_code, approval_status FROM aedpics.user_profiles;

# API 응답에서 (camelCase)
{
  "userId": "...",      // ✓ camelCase
  "regionCode": "...",  // ✓ camelCase
  "approvalStatus": "..."  // ✓ camelCase
}

# 검사 명령
grep -E "snake_case|user_id|region_code|approval_status" app/api/*/route.ts | grep "json" | grep -v "SELECT"
```

### 3단계: TypeScript 타입 검증
```bash
# 1. 모든 응답 타입 정의 확인
find lib/types -name "*.ts" -exec grep -l "Response\|API" {} \;

# 2. API 라우트와 타입 정의 비교
grep -r "NextResponse.json" app/api/ | sed 's/.*json(//' | head -10

# 3. 타입 정의의 완전성 검사
grep -r "interface.*Response" lib/types/ | wc -l

# 4. 타입 문자열 검사 (any 사용 찾기)
grep -r "any\|unknown" lib/types/ | grep -v "// @ts-ignore"
```

### 4단계: 필수 필드 vs Optional 필드 검증
```bash
# 1. DB 스키마에서 NOT NULL 필드 확인
PGPASSWORD="[PASSWORD]" psql -h [HOST] -U aedpics_admin -d aedpics_production -c "
  SELECT column_name, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'aedpics' AND table_name = 'inspections'
  ORDER BY ordinal_position;
"

# 2. TypeScript 타입에서 Optional 확인
grep -A 50 "interface InspectionResponse" lib/types/api.ts | grep "?"

# 3. 일치도 검사 (DB NOT NULL = TS 필수 필드)
# DB NOT NULL: id, equipment_id, created_at, updated_at, overall_status
# TS에서 Optional인지 확인: id?, equipment_id?, ...
```

### 5단계: 응답 시간 분석
```bash
# 프로덕션 환경 API 응답 시간 측정
for endpoint in "/api/inspections/history" "/api/aed-data" "/api/organizations"; do
  echo "Testing: $endpoint"
  time curl -s "https://aed.pics$endpoint" | jq '.data | length' 2>/dev/null
done

# 로컬 개발 환경
for endpoint in "/api/inspections/history" "/api/aed-data" "/api/organizations"; do
  echo "Testing: $endpoint"
  curl -w "@curl-format.txt" -o /dev/null -s "http://localhost:3000$endpoint"
done

# curl-format.txt 내용:
#     time_namelookup:  %{time_namelookup}\n
#     time_connect:     %{time_connect}\n
#     time_appconnect:  %{time_appconnect}\n
#     time_starttransfer: %{time_starttransfer}\n
#     time_total:       %{time_total}\n
```

### 6단계: 페이지네이션 패턴 검증
```bash
# 페이지네이션을 사용하는 API 확인
grep -r "limit\|offset\|skip\|take" app/api/ | grep -v "node_modules"

# 예상 패턴
# GET /api/inspections?limit=10&offset=20
# 응답: { data: [...], total: 1000, limit: 10, offset: 20, hasMore: true }

# 검증 포인트:
# 1. limit/offset 필드 존재하는가?
# 2. total 필드가 있는가?
# 3. hasMore 필드가 있는가?
# 4. 모든 페이지네이션 API가 동일 패턴인가?
```

### 7단계: 에러 응답 형식 통일
```bash
# 모든 에러 응답 형식 확인
grep -r "error:\|code:" app/api/ | head -20

# 표준 에러 형식
{
  "error": "Unauthorized",
  "code": "UNAUTHORIZED",
  "status": 401,
  "message": "사용자 인증이 필요합니다"
}

# 형식 검증 스크립트
grep -r "status.*40[0-9]\|status.*50[0-9]" app/api/*/route.ts | \
  grep -v "error.*code" | \
  grep -v "code.*error"
```

### 8단계: Mock 데이터 vs 실제 응답 비교
```bash
# 1. Mock 데이터 파일 확인
find . -name "*.mock.ts" -o -name "*mock*.ts" | grep -v node_modules

# 2. 응답 타입과 mock 데이터 비교
# lib/types/api.ts의 InspectionResponse vs
# lib/mocks/inspection-response.ts의 샘플 데이터

# 3. 필드 일치도 검사
# Mock에만 있는 필드: 타입에 추가해야 함
# 타입에만 있는 필드: Mock 데이터에 추가해야 함

# 검사 도구
function compare_fields() {
  local type_file=$1
  local mock_file=$2

  # 간단한 필드 비교 (완전한 것은 아니지만)
  echo "=== Fields in Type ==="
  grep -o "[a-zA-Z_]*:" $type_file | sort | uniq

  echo "=== Fields in Mock ==="
  grep -o "[a-zA-Z_]*:" $mock_file | sort | uniq
}
```

## 검증 체크리스트

### 필수 검증 항목

#### A. 응답 필드명 일관성 (Priority 1)
- [ ] 모든 API 응답이 camelCase 사용하는가?
- [ ] 모든 DB 필드가 snake_case인가?
- [ ] 변환 과정에서 필드 누락이 없는가?
  ```typescript
  // ✓ 올바른 예
  const apiResponse = {
    userId: user.user_id,      // snake_case → camelCase
    regionCode: user.region_code,
    createdAt: user.created_at
  };

  // ❌ 잘못된 예
  const apiResponse = {
    user_id: user.user_id,    // snake_case 그대로
    region_code: user.region_code
  };
  ```
- [ ] Prisma의 camelCase 필드명과 일치하는가?

#### B. 필수/Optional 필드 정확성 (Priority 1)
- [ ] DB의 NOT NULL 필드가 TS에서 Optional이 아닌가?
- [ ] DB의 nullable 필드가 TS에서 Optional인가?
- [ ] API 응답에서 항상 포함되는 필드가 Optional인지 확인
  ```typescript
  // ✓ 올바른 예 (DB NOT NULL)
  interface UserResponse {
    id: string;              // 필수
    email: string;           // 필수
    region?: string;         // Optional
    remarks?: string;        // Optional
  }

  // ❌ 잘못된 예
  interface UserResponse {
    id?: string;             // Optional이면 안 됨
    email?: string;          // 항상 있어야 함
    region: string;          // nullable인데 필수?
  }
  ```

#### C. 응답 스키마 일관성 (Priority 1)
- [ ] 모든 성공 응답이 동일한 구조인가?
  ```typescript
  // 표준 성공 응답
  {
    "success": true,
    "data": { ... },
    "message": "작업 완료"
  }
  ```
- [ ] 모든 에러 응답이 동일한 구조인가?
  ```typescript
  // 표준 에러 응답
  {
    "error": "ErrorCode",
    "message": "에러 메시지",
    "status": 400,
    "code": "ERROR_CODE"
  }
  ```
- [ ] 응답 구조가 문서화되어 있는가?

#### D. 타입 정의 완전성 (Priority 1)
- [ ] 모든 API가 응답 타입을 정의했는가?
- [ ] 응답 타입에 `any` 사용이 없는가?
  ```bash
  # 검사 명령
  grep -r "any" lib/types/api.ts | wc -l  # 0이어야 함
  ```
- [ ] 응답 타입이 실제 응답과 일치하는가?
- [ ] 제네릭 사용이 적절한가?
  ```typescript
  // ✓ 올바른 예
  interface ApiResponse<T> {
    data: T;
    success: boolean;
  }

  type InspectionResponse = ApiResponse<Inspection>;

  // ❌ 잘못된 예
  interface InspectionResponse {
    data: any;    // any 사용
    success: boolean;
  }
  ```

#### E. 페이지네이션 일관성 (Priority 2)
- [ ] 모든 list API가 페이지네이션을 지원하는가?
- [ ] limit/offset 패턴이 일관된가?
  ```typescript
  // 표준 패턴
  interface PaginatedResponse<T> {
    data: T[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  }
  ```
- [ ] 기본값(limit=10, offset=0)이 설정되었는가?
- [ ] 최대 limit이 제한되었는가? (예: 1000)

#### F. 에러 응답 형식 (Priority 2)
- [ ] 모든 에러가 동일한 형식인가?
- [ ] HTTP 상태 코드가 올바른가?
  ```
  400: Bad Request (클라이언트 오류)
  401: Unauthorized (인증 필요)
  403: Forbidden (권한 없음)
  404: Not Found (리소스 없음)
  500: Internal Server Error (서버 오류)
  ```
- [ ] 에러 코드가 명확하고 일관된가?
  ```typescript
  {
    "error": "ValidationError",
    "code": "INVALID_EMAIL_FORMAT",
    "message": "이메일 형식이 올바르지 않습니다",
    "status": 400
  }
  ```

#### G. 응답 시간 최적화 (Priority 3)
- [ ] API 응답 시간이 500ms 이내인가?
  ```bash
  # 응답 시간 측정
  curl -w "Time: %{time_total}s\n" -o /dev/null -s "https://aed.pics/api/aed-data"
  # Expected: < 500ms for normal queries
  ```
- [ ] 대용량 데이터 응답에 페이지네이션이 있는가?
- [ ] 불필요한 필드가 제외되었는가?
  ```typescript
  // 최적화: 필요한 필드만 선택
  const inspection = await prisma.inspections.findUnique({
    where: { id },
    select: {
      id: true,
      equipment_id: true,
      status: true,
      // password_hash, private_key 등 민감 정보 제외
    }
  });
  ```

#### H. Mock 데이터 동기화 (Priority 2)
- [ ] Mock 데이터가 최신 API 응답과 일치하는가?
- [ ] Mock 데이터가 실제 가능한 값을 포함하는가?
- [ ] Mock 데이터가 테스트 커버리지를 충분히 하는가?

#### I. OpenAPI/Swagger 문서 (Priority 3)
- [ ] OpenAPI 문서가 생성되었는가?
- [ ] 문서의 모든 엔드포인트가 현재 코드와 일치하는가?
- [ ] 응답 스키마 문서가 최신인가?
- [ ] 예제 응답이 정확한가?

## 자동화 검증 스크립트

### 전체 검증 자동 실행
```typescript
// scripts/validate-api-types.ts
import * as fs from 'fs';
import * as path from 'path';

interface ApiValidationResult {
  endpoint: string;
  hasTypeDefinition: boolean;
  hasAnyType: boolean;
  fieldNamingConsistent: boolean;
  requiredFieldsCorrect: boolean;
  issues: string[];
}

async function validateApiResponseTypes(): Promise<void> {
  console.log('[API Response Type Consistency] Starting...\n');

  const results: ApiValidationResult[] = [];

  // Step 1: 모든 API 라우트 스캔
  const apiDir = 'app/api';
  const routes = scanApiRoutes(apiDir);

  console.log(`Found ${routes.length} API endpoints\n`);

  // Step 2: 각 API 라우트 검증
  for (const route of routes) {
    const result = await validateRoute(route);
    results.push(result);

    if (result.issues.length > 0) {
      console.log(`⚠️  ${route}: ${result.issues.length} issues found`);
      result.issues.forEach(issue => console.log(`   - ${issue}`));
    } else {
      console.log(`✓ ${route}: OK`);
    }
  }

  // Step 3: 요약 리포트
  console.log('\n[Summary]');
  console.log(`Total endpoints: ${results.length}`);
  console.log(`With issues: ${results.filter(r => r.issues.length > 0).length}`);
  console.log(`Type definitions: ${results.filter(r => r.hasTypeDefinition).length}`);
  console.log(`Using 'any': ${results.filter(r => r.hasAnyType).length}`);

  // Step 4: 상세 리포트 생성
  generateReport(results);
}

function scanApiRoutes(dir: string): string[] {
  const routes: string[] = [];
  // 재귀적으로 route.ts 파일 찾기
  return routes;
}

async function validateRoute(route: string): Promise<ApiValidationResult> {
  const result: ApiValidationResult = {
    endpoint: route,
    hasTypeDefinition: false,
    hasAnyType: false,
    fieldNamingConsistent: true,
    requiredFieldsCorrect: true,
    issues: []
  };

  // 구현...

  return result;
}

function generateReport(results: ApiValidationResult[]): void {
  const report = `
# API Response Type Consistency Report

Generated: ${new Date().toISOString()}

## Summary
- Total endpoints: ${results.length}
- With issues: ${results.filter(r => r.issues.length > 0).length}
- All clear: ${results.filter(r => r.issues.length === 0).length}

## Details
${results
  .filter(r => r.issues.length > 0)
  .map(
    r => `
### ${r.endpoint}
${r.issues.map(i => `- ${i}`).join('\n')}
`
  )
  .join('\n')}
`;

  fs.writeFileSync('reports/api-type-consistency.md', report);
  console.log('Report saved to: reports/api-type-consistency.md');
}

validateApiResponseTypes().catch(console.error);
```

## 실전 예제

### 예제 1: 올바른 API 응답 타입
```typescript
// lib/types/api.ts
interface Inspection {
  id: string;           // 필수, DB에서 NOT NULL
  equipmentId: string;  // 필수, camelCase 변환
  status: string;       // 필수, enum 값
  overallStatus: string;// 필수, enum 값
  photosCount?: number; // Optional, 추가 정보
  remarks?: string;     // Optional, nullable 필드
  createdAt: string;    // 필수, ISO 8601
  updatedAt: string;    // 필수, ISO 8601
}

interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}

interface ApiError {
  success: false;
  error: string;
  code: string;
  status: number;
  message: string;
}

type InspectionResponse = ApiResponse<Inspection>;

// app/api/inspections/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const inspection = await prisma.inspections.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        equipment_id: true,    // DB: snake_case
        status: true,
        overall_status: true,
        photos_count: true,
        remarks: true,
        created_at: true,
        updated_at: true
        // password 등 민감 정보 제외
      }
    });

    if (!inspection) {
      return NextResponse.json(
        {
          success: false,
          error: 'NotFound',
          code: 'INSPECTION_NOT_FOUND',
          status: 404,
          message: '점검 기록을 찾을 수 없습니다'
        } as ApiError,
        { status: 404 }
      );
    }

    // snake_case → camelCase 변환
    const response: InspectionResponse = {
      success: true,
      data: {
        id: inspection.id,
        equipmentId: inspection.equipment_id,
        status: inspection.status,
        overallStatus: inspection.overall_status,
        photosCount: inspection.photos_count,
        remarks: inspection.remarks,
        createdAt: inspection.created_at,
        updatedAt: inspection.updated_at
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'InternalServerError',
        code: 'SERVER_ERROR',
        status: 500,
        message: '서버 오류가 발생했습니다'
      } as ApiError,
      { status: 500 }
    );
  }
}
```

### 예제 2: 페이지네이션 구현
```typescript
// lib/types/api.ts
interface PaginatedResponse<T> {
  success: true;
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// app/api/inspections/route.ts
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 1000);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const [data, total] = await Promise.all([
    prisma.inspections.findMany({
      take: limit,
      skip: offset,
      select: { /* ... */ }
    }),
    prisma.inspections.count()
  ]);

  return NextResponse.json({
    success: true,
    data: data.map(/* snake_case → camelCase */),
    total,
    limit,
    offset,
    hasMore: offset + limit < total
  } as PaginatedResponse<Inspection>);
}
```

## 주의사항

### 타입 안정성
- `any` 사용은 마지막 수단 - 가능한 구체적인 타입 정의
- Optional 필드는 신중하게 설정 (클라이언트 버그 유발)
- 필드 추가 시 API 버전 관리 고려

### 성능 최적화
- 대용량 응답은 페이지네이션 필수
- 불필요한 필드 조회 제외
- N+1 쿼리 문제 주의

### 호환성
- 필드 제거는 메이저 버전 변경
- 새 필드는 Optional로 추가 (후방 호환성)
- 필드명 변경은 신중하게 (API 문서 동시 업데이트)

## 관련 파일

- API 타입 정의: [lib/types/](/lib/types/)
- API 라우트: [app/api/](/app/api/)
- 테스트: [app/__tests__/api.test.ts](/app/__tests__/api.test.ts) (있는 경우)

## 추가 도움말

### TypeScript 유틸리티
```typescript
// Prisma 응답을 API 응답으로 변환하는 유틸
export function mapDbToApiResponse<T>(dbData: any, mapper: (d: any) => T): T {
  return mapper(dbData);
}

// 타입 안전한 필드 선택
type Select<T> = {
  [K in keyof T]?: boolean;
};

// 사용 예
const fields: Select<UserProfile> = {
  id: true,
  email: true,
  // password: true,  // 컴파일 오류 없지만 의도적 누락
};
```

---

**마지막 업데이트**: 2025년 11월 9일
**버전**: 1.0
**관련 Skill**: pre-deployment-validation, hardcoding-detection
