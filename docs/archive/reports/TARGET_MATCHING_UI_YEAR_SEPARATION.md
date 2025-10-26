# 의무기관매칭 UI 개선: 연도별 탭 분리 구현

**작성일**: 2025-10-15
**작성자**: Claude AI
**목적**: 2024년/2025년 데이터를 탭으로 분리하여 관리

---

## 1. 구현 개요

### 목표
- 2024년 데이터와 2025년 데이터를 UI에서 명확히 구분
- 2025년 데이터는 준비 중이므로 비활성화
- API 레벨에서 연도 파라미터 지원
- 향후 2025년 데이터 준비 시 쉽게 활성화 가능

### 구현 범위
1. ✅ UI: 연도 선택 탭 추가
2. ✅ API: year 파라미터 지원
3. ✅ 2025년 데이터 요청 시 404 에러 처리
4. ⏳ 브라우저 테스트 필요

---

## 2. 수정된 파일

### 2.1 UI 컴포넌트

#### `/app/(authenticated)/admin/target-matching/TargetMatchingClient.tsx`

**변경사항**:
```typescript
// 1. 연도 상태 추가
const [selectedYear, setSelectedYear] = useState<2024 | 2025>(2024);

// 2. Query key에 year 포함
queryKey: ['target-matching-stats', selectedYear]
queryKey: ['target-matchings', selectedYear, activeTab, filters]

// 3. API 호출 시 year 파라미터 전달
const res = await fetch(`/api/target-matching/stats?year=${selectedYear}`);
params.append('year', selectedYear.toString());

// 4. Mutation에 year 전달
body: JSON.stringify({ managementNumber, year: selectedYear.toString() })
body: JSON.stringify({ year: selectedYear.toString() })

// 5. 연도 선택 UI 추가
<div className="flex items-center justify-between gap-2">
  <div className="flex gap-2">
    <Button
      variant={selectedYear === 2024 ? 'default' : 'outline'}
      onClick={() => setSelectedYear(2024)}
      className="h-8 px-3 text-xs sm:text-sm"
    >
      📅 2024년 기준
    </Button>
    <Button
      variant={selectedYear === 2025 ? 'default' : 'outline'}
      onClick={() => setSelectedYear(2025)}
      disabled
      className="h-8 px-3 text-xs sm:text-sm"
    >
      📅 2025년 기준 (준비중)
    </Button>
  </div>
  {stats && selectedYear === 2024 && (
    <div className="text-xs text-gray-400 hidden md:block">
      평균 신뢰도: <span className="text-blue-400 font-semibold">{stats.avg_confidence.toFixed(2)}점</span>
      {stats.avg_confidence >= 80 && <span className="text-green-400 ml-1">✓ 목표 달성</span>}
    </div>
  )}
</div>
```

---

### 2.2 API Routes

#### `/app/api/target-matching/stats/route.ts`

**변경사항**:
```typescript
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || '2024';

    // 2025년은 아직 준비 중
    if (year === '2025') {
      return NextResponse.json(
        { error: '2025년 데이터는 준비 중입니다' },
        { status: 404 }
      );
    }

    // 2024년 데이터 처리 (기존 로직)
    const { data: mappings, error } = await supabase
      .from('management_number_group_mapping')
      .select('auto_confidence_2024, confirmed_2024, management_number');

    // ... 통계 계산 및 반환
  }
}
```

#### `/app/api/target-matching/route.ts`

**변경사항**:
```typescript
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;

    const year = searchParams.get('year') || '2024';
    const confidenceLevel = searchParams.get('confidence_level') || 'all';
    // ... 기타 파라미터

    // 2025년은 아직 준비 중
    if (year === '2025') {
      return NextResponse.json(
        { error: '2025년 데이터는 준비 중입니다' },
        { status: 404 }
      );
    }

    // 2024년 데이터 처리 (기존 로직)
    const query = supabase.rpc('get_target_matching_list_2024', {
      p_confidence_level: confidenceLevel,
      p_sido: sido || null,
      p_search: search || null,
      p_confirmed_only: confirmedOnly,
    });

    // ... 결과 반환
  }
}
```

#### `/app/api/target-matching/confirm/route.ts`

**변경사항**:
```typescript
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { managementNumber, year = '2024' } = body;

    if (!managementNumber) {
      return NextResponse.json(
        { error: 'Management number is required' },
        { status: 400 }
      );
    }

    // 2025년은 아직 준비 중
    if (year === '2025') {
      return NextResponse.json(
        { error: '2025년 데이터는 준비 중입니다' },
        { status: 404 }
      );
    }

    // ... 기존 확정 로직
  }
}
```

#### `/app/api/target-matching/bulk-confirm/route.ts`

**변경사항**:
```typescript
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { year = '2024' } = body;

    // 2025년은 아직 준비 중
    if (year === '2025') {
      return NextResponse.json(
        { error: '2025년 데이터는 준비 중입니다' },
        { status: 404 }
      );
    }

    // ... 기존 일괄 확정 로직
  }
}
```

---

## 3. 동작 방식

### 3.1 기본 플로우 (2024년)

```
사용자: "📅 2024년 기준" 버튼 클릭
  ↓
selectedYear 상태: 2024로 설정
  ↓
React Query 자동 리페치:
  - queryKey: ['target-matching-stats', 2024]
  - queryKey: ['target-matchings', 2024, activeTab, filters]
  ↓
API 호출:
  - GET /api/target-matching/stats?year=2024
  - GET /api/target-matching?year=2024&confidence_level=high&...
  ↓
API 응답:
  - 2024년 데이터 정상 반환
  ↓
UI 업데이트:
  - 통계 표시
  - 매칭 목록 표시
  - 평균 신뢰도 표시 (우측 상단)
```

### 3.2 비활성화 상태 (2025년)

```
사용자: "📅 2025년 기준 (준비중)" 버튼 클릭 시도
  ↓
Button disabled 속성으로 클릭 불가
  ↓
만약 API 직접 호출 시:
  - GET /api/target-matching/stats?year=2025
  ↓
API 응답:
  - HTTP 404
  - { error: '2025년 데이터는 준비 중입니다' }
```

---

## 4. 향후 2025년 데이터 활성화 방법

### 4.1 준비 사항

1. **데이터베이스 마이그레이션**
   ```sql
   -- target_list_2025 테이블 생성
   -- management_number_group_mapping에 2025 컬럼 추가:
   --   - target_key_2025
   --   - auto_suggested_2025
   --   - auto_confidence_2025
   --   - confirmed_2025
   --   - modified_by_2025
   --   - modified_at_2025
   --   - auto_matching_reason_2025
   ```

2. **PostgreSQL 함수 복제**
   ```sql
   -- get_target_matching_list_2025 함수 생성
   -- confirm_management_number_match_2025 함수 생성
   -- (또는 기존 함수를 year 파라미터로 통합)
   ```

### 4.2 코드 변경

#### 1) API Routes 수정

**`/app/api/target-matching/stats/route.ts`**:
```typescript
export async function GET(request: NextRequest) {
  const year = searchParams.get('year') || '2024';

  // 2025년 활성화: 아래 if문 제거 또는 수정
  // if (year === '2025') {
  //   return NextResponse.json({ error: '2025년 데이터는 준비 중입니다' }, { status: 404 });
  // }

  // 연도별 컬럼명 결정
  const confidenceCol = year === '2025' ? 'auto_confidence_2025' : 'auto_confidence_2024';
  const confirmedCol = year === '2025' ? 'confirmed_2025' : 'confirmed_2024';

  const { data: mappings, error } = await supabase
    .from('management_number_group_mapping')
    .select(`${confidenceCol}, ${confirmedCol}, management_number`);

  // ... 통계 계산 (컬럼명만 동적으로 변경)
}
```

**`/app/api/target-matching/route.ts`**:
```typescript
export async function GET(request: NextRequest) {
  const year = searchParams.get('year') || '2024';

  // 2025년 활성화: if문 제거
  // if (year === '2025') { ... }

  // 연도별 함수명 결정
  const rpcFunction = year === '2025'
    ? 'get_target_matching_list_2025'
    : 'get_target_matching_list_2024';

  const query = supabase.rpc(rpcFunction, {
    p_confidence_level: confidenceLevel,
    p_sido: sido || null,
    p_search: search || null,
    p_confirmed_only: confirmedOnly,
  });

  // ... 결과 반환
}
```

**`/app/api/target-matching/confirm/route.ts`**:
```typescript
export async function POST(request: NextRequest) {
  const { managementNumber, year = '2024' } = body;

  // 2025년 활성화: if문 제거
  // if (year === '2025') { ... }

  // 연도별 함수명 결정
  const rpcFunction = year === '2025'
    ? 'confirm_management_number_match_2025'
    : 'confirm_management_number_match';

  const { data, error } = await supabase.rpc(rpcFunction, {
    p_management_number: managementNumber,
  });

  // ... 결과 반환
}
```

**`/app/api/target-matching/bulk-confirm/route.ts`**:
```typescript
export async function POST(request: NextRequest) {
  const { year = '2024' } = body;

  // 2025년 활성화: if문 제거
  // if (year === '2025') { ... }

  // 연도별 컬럼명 결정
  const confidenceCol = year === '2025' ? 'auto_confidence_2025' : 'auto_confidence_2024';
  const confirmedCol = year === '2025' ? 'confirmed_2025' : 'confirmed_2024';

  const { data: highConfidenceMappings, error: fetchError } = await supabase
    .from('management_number_group_mapping')
    .select('management_number')
    .gte(confidenceCol, 90)
    .eq(confirmedCol, false);

  // ... 일괄 확정 로직
}
```

#### 2) UI 컴포넌트 수정

**`/app/(authenticated)/admin/target-matching/TargetMatchingClient.tsx`**:
```typescript
// 2025년 버튼 활성화
<Button
  variant={selectedYear === 2025 ? 'default' : 'outline'}
  onClick={() => setSelectedYear(2025)}
  disabled={false}  // ← disabled 제거
  className="h-8 px-3 text-xs sm:text-sm"
>
  📅 2025년 기준
</Button>

// 통계 표시 조건 수정
{stats && (
  <div className="text-xs text-gray-400 hidden md:block">
    평균 신뢰도: <span className="text-blue-400 font-semibold">{stats.avg_confidence.toFixed(2)}점</span>
    {stats.avg_confidence >= 80 && <span className="text-green-400 ml-1">✓ 목표 달성</span>}
  </div>
)}
```

#### 3) TypeScript 인터페이스 확장 (선택사항)

**`/app/(authenticated)/admin/target-matching/TargetMatchingClient.tsx`**:
```typescript
interface TargetMatching {
  management_number: string;

  // 2024년 컬럼
  target_key_2024: string | null;
  auto_suggested_2024: string | null;
  auto_confidence_2024: number | null;
  confirmed_2024: boolean;
  modified_by_2024: string | null;
  modified_at_2024: string | null;

  // 2025년 컬럼 추가
  target_key_2025?: string | null;
  auto_suggested_2025?: string | null;
  auto_confidence_2025?: number | null;
  confirmed_2025?: boolean;
  modified_by_2025?: string | null;
  modified_at_2025?: string | null;

  // 공통 필드
  aed_institution: string;
  target_institution: string;
  sido: string;
  gugun: string;
  aed_count: number;
  matching_reason: any;
}
```

---

## 5. 테스트 가이드

### 5.1 수동 테스트 체크리스트

#### 기본 기능
- [ ] "📅 2024년 기준" 버튼 클릭 시 데이터 로드 확인
- [ ] 통계 카드 정상 표시 확인 (총 매칭, 확정, 대기, 고신뢰도 등)
- [ ] 평균 신뢰도 우측 상단 표시 확인
- [ ] "📅 2025년 기준 (준비중)" 버튼이 disabled 상태인지 확인

#### 필터 기능
- [ ] 신뢰도 탭 전환 (고신뢰도/중신뢰도/저신뢰도/전체) 정상 동작
- [ ] 지역 필터 적용 확인
- [ ] 검색 기능 확인
- [ ] 확정만 보기 필터 확인

#### 매칭 관리
- [ ] 개별 매칭 확정 버튼 클릭 시 정상 동작
- [ ] 일괄 확정 (고신뢰도) 버튼 클릭 시 정상 동작
- [ ] 확정 후 통계 자동 갱신 확인

#### 연도 전환
- [ ] 2024년 ↔ 다른 탭 전환 시 데이터 리로드 확인
- [ ] React Query 캐시 키 분리 확인 (개발자 도구 React Query DevTools)

### 5.2 API 테스트

#### 2024년 데이터 (정상 케이스)
```bash
# 통계 조회
curl "http://localhost:3000/api/target-matching/stats?year=2024"
# 예상: 200 OK, 통계 데이터 반환

# 매칭 목록 조회
curl "http://localhost:3000/api/target-matching?year=2024&confidence_level=high"
# 예상: 200 OK, 고신뢰도 매칭 목록 반환

# 개별 확정
curl -X POST "http://localhost:3000/api/target-matching/confirm" \
  -H "Content-Type: application/json" \
  -d '{"managementNumber":"test-001","year":"2024"}'
# 예상: 200 OK (인증 필요)

# 일괄 확정
curl -X POST "http://localhost:3000/api/target-matching/bulk-confirm" \
  -H "Content-Type: application/json" \
  -d '{"year":"2024"}'
# 예상: 200 OK (인증 필요)
```

#### 2025년 데이터 (비활성화 케이스)
```bash
# 통계 조회
curl "http://localhost:3000/api/target-matching/stats?year=2025"
# 예상: 404 Not Found, { error: '2025년 데이터는 준비 중입니다' }

# 매칭 목록 조회
curl "http://localhost:3000/api/target-matching?year=2025"
# 예상: 404 Not Found, { error: '2025년 데이터는 준비 중입니다' }

# 개별 확정
curl -X POST "http://localhost:3000/api/target-matching/confirm" \
  -H "Content-Type: application/json" \
  -d '{"managementNumber":"test-001","year":"2025"}'
# 예상: 404 Not Found, { error: '2025년 데이터는 준비 중입니다' }

# 일괄 확정
curl -X POST "http://localhost:3000/api/target-matching/bulk-confirm" \
  -H "Content-Type: application/json" \
  -d '{"year":"2025"}'
# 예상: 404 Not Found, { error: '2025년 데이터는 준비 중입니다' }
```

---

## 6. 주의사항

### 6.1 데이터 정합성
- 2024년 데이터와 2025년 데이터는 **완전히 독립적**으로 관리
- `management_number`는 두 연도 모두 동일하지만, 매칭 결과는 다를 수 있음
- 확정 상태(`confirmed_2024`, `confirmed_2025`)도 독립적으로 관리

### 6.2 성능 고려사항
- React Query 캐시 키에 `selectedYear` 포함으로 연도별 캐싱
- 연도 전환 시 기존 캐시 유지 (불필요한 재요청 방지)
- 50,010건 데이터 로드는 pagination 또는 가상 스크롤 고려 필요 (향후)

### 6.3 에러 처리
- 2025년 데이터 요청 시 명확한 404 에러 메시지
- UI에서 버튼 비활성화로 사용자 혼란 최소화
- API 레벨에서도 방어 코드 적용

---

## 7. 구현 완료 상태

### ✅ 완료된 작업
1. UI 연도 선택 탭 추가
2. selectedYear 상태 관리
3. React Query 캐시 키에 year 포함
4. API Routes에 year 파라미터 지원 추가:
   - `/api/target-matching/stats/route.ts`
   - `/api/target-matching/route.ts`
   - `/api/target-matching/confirm/route.ts`
   - `/api/target-matching/bulk-confirm/route.ts`
5. 2025년 데이터 404 에러 처리
6. 개발 서버 컴파일 확인 (오류 없음)

### ⏳ 다음 단계
1. **브라우저 테스트**: 실제 UI에서 연도 전환 동작 확인
2. **Git 커밋**: 변경사항 커밋 및 푸시
3. **2025년 데이터 준비** (향후):
   - CSV 파일 준비
   - 데이터베이스 마이그레이션 (컬럼 추가)
   - PostgreSQL 함수 생성/수정
   - API 및 UI 활성화

---

## 8. 관련 문서

- [Migration 47: 구비의무기관 매칭 관리 UI 지원 함수](../../supabase/migrations/47_target_matching_ui_functions.sql)
- [Migration 67: 매칭 알고리즘 개선](../../supabase/migrations/67_improve_matching_algorithm_jaro_winkler.sql)
- [2024/2025 전체 계획](./TARGET_MATCHING_2024_2025_PLAN.md)
- [복원 분석 보고서](./TARGET_MATCHING_RESTORATION_ANALYSIS.md)

---

**문서 버전**: 1.0
**최종 수정일**: 2025-10-15
