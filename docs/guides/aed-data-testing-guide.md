# AED Data 테스트 가이드 (상세 버전)

## 1단계: 브라우저 테스트 및 에러 캡처

### 1.1 초기 로딩 테스트
```javascript
// 브라우저 개발자 도구 Console에서 실행
// 네트워크 탭 열어두고 시작

// 1. 페이지 접속
window.location.href = '/aed-data';

// 2. 에러 발생 시 캡처
// Console 에러 예시:
// - "Failed to fetch data"
// - "Unauthorized"
// - "Query failed: structure of query does not match"

// 3. Network 탭에서 실패한 요청 확인
// - Status Code (400/403/500)
// - Response Body의 error 메시지
// - Request Headers (인증 토큰 확인)
```

### 1.2 에러별 대응 방법
| 에러 코드 | 에러 메시지 | 대응 방법 |
|---------|------------|----------|
| 401 | Unauthorized | 로그인 상태 확인, 세션 갱신 |
| 400 | 시도/시군구 또는 기관 구분을 선택해주세요 | filter-policy.ts 확인 |
| 403 | 허용되지 않은 시도 코드 | access-control.ts 확인 |
| 500 | structure of query does not match | RPC 함수 반환 타입 확인 |

## 2단계: 전체 필터 조합 테스트

### 2.1 필터별 API 호출 테스트
```javascript
// 브라우저 콘솔에서 순차 실행

// 테스트 헬퍼 함수
async function testAPI(params, description) {
  console.log(`\n=== Testing: ${description} ===`);
  const url = `/api/aed-data?${params}`;
  try {
    const response = await fetch(url, { credentials: 'include' });
    const data = await response.json();

    if (response.ok) {
      console.log('✅ Success:', {
        status: response.status,
        dataCount: data.data?.length || 0,
        summary: data.summary
      });
    } else {
      console.error('❌ Failed:', {
        status: response.status,
        error: data.error,
        details: data
      });
    }
    return { success: response.ok, data };
  } catch (error) {
    console.error('❌ Network Error:', error);
    return { success: false, error };
  }
}

// 1. 주소 기준 조회
await testAPI('criteria=address', '주소 기준 - 필터 없음');
await testAPI('criteria=address&region=SEO', '주소 기준 - 서울');
await testAPI('criteria=address&region=SEO&city=강남구', '주소 기준 - 서울 강남구');

// 2. 관할보건소 기준 조회
await testAPI('criteria=jurisdiction', '관할보건소 기준 - 필터 없음');
await testAPI('criteria=jurisdiction&region=SEO', '관할보건소 기준 - 서울');

// 3. 만료일 필터
await testAPI('criteria=address&region=SEO&expiry=expired', '만료된 장치');
await testAPI('criteria=address&region=SEO&expiry=in30', '30일 이내 만료');
await testAPI('criteria=address&region=SEO&expiry=in60', '60일 이내 만료');
await testAPI('criteria=address&region=SEO&expiry=in90', '90일 이내 만료');

// 4. 운영 상태 필터
await testAPI('criteria=address&region=SEO&status=정상', '정상 운영');
await testAPI('criteria=address&region=SEO&status=점검필요&status=고장', '점검필요+고장');

// 5. 카테고리 필터
await testAPI('criteria=address&region=SEO&category=의료기관', '의료기관');
await testAPI('criteria=address&region=SEO&category=공공기관', '공공기관');

// 6. 복합 필터
await testAPI('criteria=address&region=SEO&city=강남구&expiry=in30&status=정상', '복합 필터');
```

### 2.2 결과 검증 체크리스트
- [ ] 각 필터별 data 배열 반환 확인
- [ ] summary 통계 정확성 (total, expired, expiringSoon 등)
- [ ] pagination 정보 (page, limit, hasMore)
- [ ] filters.applied가 요청과 일치하는지
- [ ] filters.enforced에 자동 적용된 필터 확인

## 3단계: 민감 데이터 마스킹 검증

### 3.1 권한별 데이터 노출 테스트
```javascript
// 실제 응답 데이터 검증
async function checkDataMasking() {
  const response = await fetch('/api/aed-data?criteria=address&region=SEO&limit=5', {
    credentials: 'include'
  });
  const result = await response.json();

  if (result.data && result.data.length > 0) {
    const sample = result.data[0];
    console.log('\n=== 데이터 마스킹 검증 ===');

    // 1. 공개/비공개 확인
    console.log('is_public_visible:', sample.is_public_visible);

    // 2. 민감 필드 확인
    const sensitiveFields = {
      'institution_contact': sample.institution_contact,
      'contact_phone': sample.contact_phone,
      'manager': sample.manager
    };

    console.table(sensitiveFields);

    // 3. 마스킹 패턴 확인
    Object.entries(sensitiveFields).forEach(([field, value]) => {
      if (value) {
        if (value.includes('***') || value.includes('XXX')) {
          console.log(`✅ ${field}: 마스킹됨`);
        } else if (value.length > 0) {
          console.warn(`⚠️ ${field}: 마스킹 안됨 - "${value}"`);
        }
      }
    });

    // 4. 역할 확인
    const userInfo = await fetch('/api/auth/me', { credentials: 'include' });
    const user = await userInfo.json();
    console.log('현재 사용자 역할:', user.role);
    console.log('canViewSensitiveData:', user.permissions?.canViewSensitiveData);
  }
}

await checkDataMasking();
```

### 3.2 역할별 예상 동작
| 역할 | is_public_visible=false | institution_contact | manager |
|-----|------------------------|-------------------|---------|
| master | 볼 수 있음 | 원본 표시 | 원본 표시 |
| regional_admin | 볼 수 있음 | 원본 표시 | 원본 표시 |
| local_admin | 볼 수 있음 | 마스킹 (010-****-****) | 원본 표시 |
| email_verified | 못 봄 (필터링됨) | 마스킹 | 마스킹 |

## 4단계: 단위 테스트 설계

### 4.1 테스트 환경 설정
```typescript
// tests/api/aed-data.test.ts
import { createMocks } from 'node-mocks-http';
import { createClient } from '@supabase/supabase-js';
import handler from '@/app/api/aed-data/route';

// Supabase 모킹
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
    })),
    rpc: jest.fn(),
  })),
}));

// 인증 컨텍스트 주입
const mockAuthContext = (role: string, userId: string) => {
  const mockSupabase = createClient as jest.MockedFunction<typeof createClient>;
  const client = mockSupabase();

  (client.auth.getUser as jest.Mock).mockResolvedValue({
    data: {
      user: { id: userId, email: 'test@example.com' }
    },
    error: null
  });

  (client.from as jest.Mock).mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: {
        id: userId,
        role,
        organization_id: null
      },
      error: null
    })
  });

  return client;
};
```

### 4.2 테스트 케이스
```typescript
describe('AED Data API', () => {
  it('master role should see all data without filters', async () => {
    const client = mockAuthContext('master', 'user-123');

    // RPC 응답 모킹
    (client.rpc as jest.Mock).mockResolvedValueOnce({
      data: [/* mock AED data */],
      error: null
    });

    const { req, res } = createMocks({
      method: 'GET',
      query: { criteria: 'address' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(client.rpc).toHaveBeenCalledWith(
      'get_aed_data_filtered',
      expect.objectContaining({
        p_user_role: 'master',
        p_limit: 100,
        p_offset: 0
      })
    );
  });

  it('should enforce filters for local_admin', async () => {
    // local_admin은 시도/시군구 필터 필수
    const client = mockAuthContext('local_admin', 'user-456');

    const { req, res } = createMocks({
      method: 'GET',
      query: { criteria: 'address' }, // 필터 없음
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    const body = JSON.parse(res._getData());
    expect(body.error).toContain('필수 검색 조건');
  });
});
```

## 5단계: Staging 배포 검증

### 5.1 배포 전 체크리스트
```sql
-- 1. Production 현재 상태 백업
SELECT COUNT(*) as current_count,
       MAX(updated_at) as last_update
FROM aed_data;

-- 2. Staging에 RPC 함수 적용
-- fix_aed_data_functions_v2_corrected.sql 실행

-- 3. Staging 테스트 쿼리
SELECT * FROM get_aed_data_filtered('master', NULL, NULL, NULL, NULL, NULL, 10, 0);

-- 4. Production과 결과 비교
WITH staging_data AS (
  SELECT * FROM staging.get_aed_data_filtered('master', ARRAY['SEO'], NULL, NULL, NULL, NULL, 100, 0)
),
production_data AS (
  SELECT * FROM production.get_aed_data_filtered('master', ARRAY['SEO'], NULL, NULL, NULL, NULL, 100, 0)
)
SELECT
  (SELECT COUNT(*) FROM staging_data) as staging_count,
  (SELECT COUNT(*) FROM production_data) as production_count,
  CASE
    WHEN (SELECT COUNT(*) FROM staging_data) = (SELECT COUNT(*) FROM production_data)
    THEN '✅ 일치'
    ELSE '❌ 불일치'
  END as validation;
```

### 5.2 롤백 계획
```sql
-- 이전 버전 백업 (배포 전 실행)
CREATE OR REPLACE FUNCTION get_aed_data_filtered_backup AS
  SELECT pg_get_functiondef('get_aed_data_filtered'::regproc);

-- 문제 발생 시 롤백
-- 1. 백업된 함수 정의 복원
-- 2. 또는 fix_aed_data_functions_v2.sql (이전 버전) 재실행
```

## 트러블슈팅 가이드

### 일반적인 문제와 해결
| 증상 | 원인 | 해결 방법 |
|-----|------|----------|
| 데이터가 안 보임 | 필터 정책 | filter-policy.ts의 requireOneOf 확인 |
| 500 에러 지속 | RPC 타입 불일치 | Supabase 로그에서 정확한 컬럼 확인 |
| 권한 오류 | 세션 만료 | 로그아웃 후 재로그인 |
| 느린 응답 | 인덱스 부재 | idx_aed_data_* 인덱스 확인 |

---
*작성일: 2025-09-21*
*최종 테스트: 배포 전 필수 실행*