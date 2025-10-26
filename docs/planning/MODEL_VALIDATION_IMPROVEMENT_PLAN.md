# 제조사/모델 검증 시스템 개선 계획

**작성일**: 2025-10-16  
**상태**: 계획 (미구현)  
**우선순위**: P2 (Phase 2 - 중기)  
**예상 소요**: 3-5일

---

## 📋 목차

1. [배경 및 문제점](#배경-및-문제점)
2. [현재 시스템 분석](#현재-시스템-분석)
3. [개선 목표](#개선-목표)
4. [기술 설계](#기술-설계)
5. [구현 단계](#구현-단계)
6. [예상 효과](#예상-효과)
7. [리스크 및 대응방안](#리스크-및-대응방안)

---

## 배경 및 문제점

### 현재 상황

전국 약 **8만대의 AED 장비** 데이터를 관리하는 시스템에서, 점검 시 제조사와 모델명 검증이 필요합니다.

### 핵심 문제

#### 1. **하드코딩된 검증 방식**
```typescript
// ❌ 현재: 수동으로 관리되는 고정 리스트
const KNOWN_MANUFACTURER_MODELS = {
  '메디아나': ['HeartOn A15', 'Hearton A15', 'HeartOn A10'],
  '라디안': ['HR-501', 'HR-501-B', 'HR-502']
};
```

**문제점**:
- 실제 8만대 데이터를 활용하지 않음
- 수동 관리로 인한 유지보수 부담
- 신규 모델 자동 인식 불가

#### 2. **통계 기반 검증 부재**

**시나리오**:
- **100대가 "HeartOn A15-G14"로 등록됨** → 정상 모델? 100명의 오타?
- **1대만 "NewModel XYZ-2024"로 등록됨** → 신제품? 1명의 오타?

**현재**: 구분 불가 ❌  
**필요**: 빈도 기반 신뢰도 계산 필요 ✅

#### 3. **오타 탐지 없음**

| 입력 | 실제 의도 | 현재 처리 |
|------|----------|----------|
| HeartOm A15 | HeartOn A15 | ❌ 알 수 없는 모델 |
| HR-051 | HR-501 | ❌ 알 수 없는 모델 |
| HeartStart FRX | HeartStart FRx | ❌ 알 수 없는 모델 |

---

## 현재 시스템 분석

### 검증 플로우

```
점검자 입력 → 제조사 정규화 → 하드코딩 리스트 매칭 → 결과 표시
                                      ↓
                              매칭 실패 시 경고
```

### 제한 사항

1. **데이터 활용 없음**: 8만대 통계 미활용
2. **정적 검증**: 데이터 변화 반영 안됨
3. **신뢰도 없음**: 모든 경고가 동일한 중요도
4. **오타 미탐지**: 유사 모델명 제안 없음

---

## 개선 목표

### 1. 데이터 기반 검증 체계 구축

- [x] ~~하드코딩 리스트 기반~~
- [ ] **실시간 통계 기반 검증**

### 2. 신뢰도 등급 시스템

| 빈도 | 신뢰도 | 처리 방식 |
|------|--------|----------|
| 1,000대 이상 | High | 자동 승인 (경고 없음) |
| 100-999대 | Medium | 자동 승인 (정보성 메시지) |
| 10-99대 | Low | 경고 + 계속 진행 가능 |
| 1-9대 | Very Low | 경고 + 관리자 승인 권장 |

### 3. 오타 자동 탐지 및 제안

```
입력: "HeartOm A15"
→ 퍼지 매칭 분석
→ 제안: "HeartOn A15 (18,320대 등록됨)"
→ [자동 수정] [무시하고 계속]
```

### 4. 신규 모델 승인 플로우

```
1대 등록 → 관리자 알림 → 제조사 카탈로그 확인 → 승인/거부
```

---

## 기술 설계

### 1. 데이터베이스 스키마

#### 1-1. 모델 통계 테이블

```sql
CREATE TABLE model_statistics (
  -- 기본 정보
  manufacturer VARCHAR(255) NOT NULL,
  model_name VARCHAR(255) NOT NULL,
  
  -- 통계 데이터
  frequency INTEGER NOT NULL DEFAULT 0,
  percentage DECIMAL(5,2),
  
  -- 정규화된 값 (검색 최적화)
  normalized_manufacturer VARCHAR(255),
  normalized_model VARCHAR(255),
  
  -- 메타데이터
  first_seen TIMESTAMP DEFAULT NOW(),
  last_updated TIMESTAMP DEFAULT NOW(),
  
  -- 승인 상태 (소수 모델용)
  approval_status VARCHAR(20) DEFAULT 'pending',
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMP,
  
  PRIMARY KEY (manufacturer, model_name)
);

-- 인덱스
CREATE INDEX idx_model_stats_normalized 
  ON model_statistics(normalized_manufacturer, normalized_model);

CREATE INDEX idx_model_stats_frequency 
  ON model_statistics(frequency DESC);

CREATE INDEX idx_model_stats_approval 
  ON model_statistics(approval_status) 
  WHERE frequency < 10;
```

#### 1-2. 모델 승인 이력

```sql
CREATE TABLE model_approval_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer VARCHAR(255) NOT NULL,
  model_name VARCHAR(255) NOT NULL,
  action VARCHAR(20) NOT NULL, -- 'approved', 'rejected', 'flagged'
  reason TEXT,
  evidence JSONB, -- 제조사 카탈로그 링크, 사진 등
  
  acted_by UUID REFERENCES user_profiles(id),
  acted_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (manufacturer, model_name) 
    REFERENCES model_statistics(manufacturer, model_name)
);
```

---

### 2. 통계 수집 시스템

#### 2-1. 일일 배치 작업

```sql
-- 매일 새벽 2시 실행 (Supabase cron 또는 Vercel Cron)
INSERT INTO model_statistics (
  manufacturer,
  model_name,
  frequency,
  percentage,
  normalized_manufacturer,
  normalized_model,
  last_updated
)
SELECT 
  manufacturer,
  model_name,
  COUNT(*) as frequency,
  ROUND(
    COUNT(*) * 100.0 / 
    SUM(COUNT(*)) OVER (PARTITION BY manufacturer), 
    2
  ) as percentage,
  -- 정규화: (주) 제거, 소문자, 공백 제거
  LOWER(REGEXP_REPLACE(
    REGEXP_REPLACE(manufacturer, '\(주\)|주식회사', '', 'g'),
    '\s+', '', 'g'
  )) as normalized_manufacturer,
  LOWER(REGEXP_REPLACE(model_name, '\s+', '', 'g')) as normalized_model,
  NOW()
FROM aed_data
WHERE manufacturer IS NOT NULL 
  AND model_name IS NOT NULL
GROUP BY manufacturer, model_name
ON CONFLICT (manufacturer, model_name) 
DO UPDATE SET 
  frequency = EXCLUDED.frequency,
  percentage = EXCLUDED.percentage,
  normalized_manufacturer = EXCLUDED.normalized_manufacturer,
  normalized_model = EXCLUDED.normalized_model,
  last_updated = NOW();

-- 신규 소수 모델 자동 플래그
UPDATE model_statistics
SET approval_status = 'pending'
WHERE frequency < 10 
  AND approval_status IS NULL
  AND first_seen > NOW() - INTERVAL '7 days';
```

#### 2-2. Vercel Cron 설정

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/update-model-statistics",
      "schedule": "0 2 * * *"
    }
  ]
}
```

#### 2-3. API 엔드포인트

```typescript
// app/api/cron/update-model-statistics/route.ts
export async function GET(request: Request) {
  // Vercel Cron Secret 검증
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  
  // 통계 업데이트 SQL 실행
  const { error } = await supabase.rpc('update_model_statistics');
  
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  
  return Response.json({ success: true, updated_at: new Date() });
}
```

---

### 3. 검증 로직 개선

#### 3-1. 통계 기반 검증

```typescript
// lib/validation/model-validator.ts

interface ModelStatistics {
  manufacturer: string;
  model_name: string;
  frequency: number;
  percentage: number;
  approval_status?: string;
}

interface ValidationResult {
  isValid: boolean;
  confidence: 'very_high' | 'high' | 'medium' | 'low' | 'very_low';
  message: string;
  suggestion?: string;
  requiresApproval: boolean;
}

export async function validateModel(
  manufacturer: string,
  modelName: string
): Promise<ValidationResult> {
  // 1. 통계 조회
  const statistics = await fetchModelStatistics(manufacturer);
  
  if (!statistics || statistics.length === 0) {
    return {
      isValid: false,
      confidence: 'very_low',
      message: `등록되지 않은 제조사: "${manufacturer}"`,
      requiresApproval: true
    };
  }
  
  // 2. 정규화된 매칭
  const normalizedInput = normalizeModelName(modelName);
  
  // 2-1. 정확 매칭
  const exactMatch = statistics.find(s => 
    normalizeModelName(s.model_name) === normalizedInput
  );
  
  if (exactMatch) {
    return getConfidenceByFrequency(exactMatch);
  }
  
  // 2-2. 접두사 매칭
  const prefixMatch = statistics.find(s => {
    const normalized = normalizeModelName(s.model_name);
    return normalizedInput.startsWith(normalized) ||
           normalized.startsWith(normalizedInput);
  });
  
  if (prefixMatch) {
    return getConfidenceByFrequency(prefixMatch, true);
  }
  
  // 3. 퍼지 매칭 (오타 탐지)
  const fuzzyMatch = findSimilarModel(
    normalizedInput, 
    statistics.map(s => s.model_name)
  );
  
  if (fuzzyMatch) {
    return {
      isValid: false,
      confidence: 'medium',
      message: `"${modelName}"는 오타일 수 있습니다`,
      suggestion: fuzzyMatch.model_name,
      requiresApproval: false
    };
  }
  
  // 4. 완전히 새로운 모델
  return {
    isValid: false,
    confidence: 'very_low',
    message: `신규 모델이거나 오류: "${modelName}"`,
    requiresApproval: true
  };
}

function getConfidenceByFrequency(
  stat: ModelStatistics,
  isPartialMatch: boolean = false
): ValidationResult {
  const { frequency, model_name, approval_status } = stat;
  
  // 빈도 기반 신뢰도
  if (frequency >= 1000) {
    return {
      isValid: true,
      confidence: 'very_high',
      message: `${frequency.toLocaleString()}대 확인 (${stat.percentage}%)`,
      requiresApproval: false
    };
  } else if (frequency >= 100) {
    return {
      isValid: true,
      confidence: 'high',
      message: `${frequency}대 확인 (${stat.percentage}%)`,
      requiresApproval: false
    };
  } else if (frequency >= 10) {
    return {
      isValid: true,
      confidence: 'medium',
      message: `${frequency}대 확인 (소수 보급 모델)`,
      requiresApproval: false
    };
  } else {
    // 10대 미만 - 승인 상태 확인
    if (approval_status === 'approved') {
      return {
        isValid: true,
        confidence: 'medium',
        message: `${frequency}대 확인 (관리자 승인됨)`,
        requiresApproval: false
      };
    } else {
      return {
        isValid: false,
        confidence: 'very_low',
        message: `${frequency}대만 확인 - 신제품 또는 오류`,
        requiresApproval: true
      };
    }
  }
}
```

#### 3-2. 퍼지 매칭 (Levenshtein Distance)

```typescript
// lib/validation/fuzzy-matcher.ts

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function findSimilarModel(
  input: string,
  knownModels: string[],
  threshold: number = 2
): { model_name: string; distance: number } | null {
  const normalizedInput = normalizeModelName(input);
  
  let bestMatch: { model_name: string; distance: number } | null = null;
  
  for (const model of knownModels) {
    const normalizedModel = normalizeModelName(model);
    const distance = levenshteinDistance(normalizedInput, normalizedModel);
    
    if (distance <= threshold) {
      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = { model_name: model, distance };
      }
    }
  }
  
  return bestMatch;
}

function normalizeModelName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9-]/g, '');
}
```

---

### 4. UI 개선

#### 4-1. 신뢰도 기반 표시

```tsx
// components/inspection/steps/DeviceInfoStep.tsx

const ModelValidationBadge = ({ validation }: { validation: ValidationResult }) => {
  const confidenceColors = {
    very_high: 'bg-green-900/20 border-green-600/50 text-green-300',
    high: 'bg-green-900/20 border-green-600/30 text-green-300',
    medium: 'bg-yellow-900/20 border-yellow-600/30 text-yellow-300',
    low: 'bg-orange-900/20 border-orange-600/30 text-orange-300',
    very_low: 'bg-red-900/20 border-red-600/30 text-red-300'
  };
  
  const icons = {
    very_high: '✓✓',
    high: '✓',
    medium: 'ℹ',
    low: '⚠',
    very_low: '✗'
  };
  
  return (
    <div className={`rounded border px-2 py-1 text-xs ${confidenceColors[validation.confidence]}`}>
      <span className="mr-1">{icons[validation.confidence]}</span>
      {validation.message}
      
      {validation.suggestion && (
        <div className="mt-1">
          <button className="text-blue-400 hover:text-blue-300 underline">
            {validation.suggestion}로 수정
          </button>
        </div>
      )}
    </div>
  );
};
```

#### 4-2. 관리자 승인 UI

```tsx
// app/(authenticated)/admin/model-approval/page.tsx

export default function ModelApprovalPage() {
  const { data: pendingModels } = useQuery({
    queryKey: ['pending-models'],
    queryFn: async () => {
      const response = await fetch('/api/admin/model-approvals?status=pending');
      return response.json();
    }
  });
  
  return (
    <div>
      <h1>신규 모델 승인 대기 목록</h1>
      
      <table>
        <thead>
          <tr>
            <th>제조사</th>
            <th>모델명</th>
            <th>빈도</th>
            <th>최초 등록</th>
            <th>조치</th>
          </tr>
        </thead>
        <tbody>
          {pendingModels?.map(model => (
            <tr key={`${model.manufacturer}-${model.model_name}`}>
              <td>{model.manufacturer}</td>
              <td>{model.model_name}</td>
              <td>{model.frequency}대</td>
              <td>{formatDate(model.first_seen)}</td>
              <td>
                <button onClick={() => approveModel(model)}>승인</button>
                <button onClick={() => rejectModel(model)}>거부</button>
                <button onClick={() => flagModel(model)}>추후 검토</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 구현 단계

### Phase 1: 데이터베이스 준비 (1일)

**목표**: 통계 수집 인프라 구축

- [ ] `model_statistics` 테이블 생성
- [ ] `model_approval_history` 테이블 생성
- [ ] 인덱스 추가
- [ ] 초기 통계 데이터 수집 (1회 실행)

**SQL 파일**:
- `supabase/migrations/XX_create_model_statistics.sql`

**검증**:
```sql
-- 통계 확인
SELECT manufacturer, COUNT(*) as model_count, SUM(frequency) as total_devices
FROM model_statistics
GROUP BY manufacturer
ORDER BY total_devices DESC;

-- 예상: 메디아나 35,420대, 씨유메디칼 28,750대 등
```

---

### Phase 2: 통계 업데이트 자동화 (0.5일)

**목표**: 매일 자동 통계 갱신

- [ ] Supabase RPC 함수 작성 (`update_model_statistics`)
- [ ] Vercel Cron 엔드포인트 생성
- [ ] 환경 변수 설정 (`CRON_SECRET`)
- [ ] 테스트 실행

**파일**:
- `supabase/migrations/XX_create_update_statistics_function.sql`
- `app/api/cron/update-model-statistics/route.ts`
- `vercel.json` (cron 설정 추가)

**검증**:
```bash
# 수동 트리거 테스트
curl -X GET https://www.aed.pics/api/cron/update-model-statistics \
  -H "Authorization: Bearer $CRON_SECRET"

# 결과: {"success": true, "updated_at": "2025-10-16T..."}
```

---

### Phase 3: 검증 로직 구현 (1.5일)

**목표**: 통계 기반 검증 시스템

- [ ] `lib/validation/model-validator.ts` 작성
- [ ] `lib/validation/fuzzy-matcher.ts` 작성
- [ ] API 엔드포인트 (`/api/validation/model`)
- [ ] 단위 테스트 작성

**파일**:
- `lib/validation/model-validator.ts`
- `lib/validation/fuzzy-matcher.ts`
- `app/api/validation/model/route.ts`
- `__tests__/validation/model-validator.test.ts`

**테스트 케이스**:
```typescript
describe('Model Validation', () => {
  it('should validate high-frequency model', async () => {
    const result = await validateModel('(주)메디아나', 'HeartOn A15');
    expect(result.confidence).toBe('very_high');
    expect(result.isValid).toBe(true);
  });
  
  it('should detect typo', async () => {
    const result = await validateModel('(주)메디아나', 'HeartOm A15');
    expect(result.suggestion).toBe('HeartOn A15');
  });
  
  it('should flag low-frequency model', async () => {
    const result = await validateModel('(주)메디아나', 'NewModel XYZ');
    expect(result.confidence).toBe('very_low');
    expect(result.requiresApproval).toBe(true);
  });
});
```

---

### Phase 4: 프론트엔드 통합 (1일)

**목표**: DeviceInfoStep에 검증 UI 추가

- [ ] `ModelValidationBadge` 컴포넌트 작성
- [ ] DeviceInfoStep에 실시간 검증 통합
- [ ] 오타 제안 UI 추가
- [ ] 사용자 피드백 수집

**파일**:
- `components/inspection/ModelValidationBadge.tsx`
- `components/inspection/steps/DeviceInfoStep.tsx` (수정)

**UI 개선**:
```tsx
// 기존: 단순 경고 메시지
⚠️ "메디아나"의 알려지지 않은 모델: "HeartOm A15"

// 개선: 신뢰도 + 제안
✓✓ 18,320대 확인 (51.7%) - 정상 모델
ℹ 8,450대 확인 (23.9%) - 소수 보급 모델
⚠ "HeartOm A15"는 오타일 수 있습니다
   → HeartOn A15 (18,320대)로 수정하시겠습니까?
   [자동 수정] [무시하고 계속]
✗ 1대만 확인 - 신제품이거나 오류 (관리자 승인 필요)
```

---

### Phase 5: 관리자 승인 시스템 (1일)

**목표**: 소수 모델 수동 승인

- [ ] 관리자 대시보드 페이지 생성
- [ ] 승인/거부/플래그 API 엔드포인트
- [ ] 승인 이력 추적
- [ ] 알림 시스템 (선택)

**파일**:
- `app/(authenticated)/admin/model-approval/page.tsx`
- `app/(authenticated)/admin/model-approval/ApprovalTable.tsx`
- `app/api/admin/model-approvals/route.ts`

**권한 체크**:
```typescript
// 관리자 또는 총괄 관리자만 접근
if (!['admin', 'super_admin'].includes(userRole)) {
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

## 예상 효과

### 1. 정확도 향상

| 지표 | Before | After |
|------|--------|-------|
| **오탐지율** | 15-20% | **< 5%** |
| **오타 탐지** | 0% | **80-90%** |
| **신규 모델 인식** | 수동 업데이트 필요 | **자동 (7일 이내)** |

### 2. 운영 효율성

- **통계 업데이트**: 자동 (매일 새벽 2시)
- **신규 모델 추가**: 관리자 승인 (1-2분)
- **하드코딩 리스트 관리**: 불필요

### 3. 사용자 경험

```
Before:
⚠️ "알려지지 않은 모델: Hearton A15-G14"
→ 사용자 혼란: "이게 정상인데 왜 경고?"

After:
✓ 8,450대 확인 (23.9%) - 정상 모델
→ 사용자 신뢰: "많이 쓰이는 모델이구나"
```

### 4. 데이터 품질

- **오타 즉시 수정**: "HeartOm" → "HeartOn"
- **일관성 유지**: 정규화된 모델명 사용
- **이상치 조기 발견**: 1-9대 모델 자동 플래그

---

## 리스크 및 대응방안

### 리스크 1: 통계 수집 실패

**원인**:
- Supabase 쿼리 타임아웃 (8만건 GROUP BY)
- Vercel Cron 실행 실패

**대응**:
1. 청크 단위 처리 (제조사별 분할)
2. 타임아웃 증가 (60초 → 180초)
3. 실패 시 슬랙 알림
4. 수동 실행 버튼 제공

---

### 리스크 2: 퍼지 매칭 오버헤드

**원인**:
- Levenshtein 알고리즘은 O(n*m) 복잡도
- 모델명 수백 개 × 매 입력마다 실행

**대응**:
1. 정규화된 인덱스 활용 (normalized_model)
2. 빈도 상위 50개만 퍼지 매칭
3. 결과 캐싱 (React Query, 5분)

---

### 리스크 3: 대량 오타 등록

**시나리오**:
- 100대가 모두 "HeartOm A15"로 잘못 등록됨
- 시스템이 정상 모델로 학습

**대응**:
1. 제조사 공식 카탈로그 주기적 대조 (분기별)
2. 빈도 급증 모델 자동 플래그 (1주일 내 10→100대)
3. 관리자 검토 대시보드

---

### 리스크 4: 신제품 즉시 인식 불가

**시나리오**:
- 새 모델 출시 → 1대 등록 → "오류" 경고

**대응**:
1. 제조사 공식 발표 모니터링
2. 관리자 사전 승인 기능
3. 빠른 승인 프로세스 (1-2일 내)

---

## 부록

### A. 통계 쿼리 예시

```sql
-- 제조사별 장비 수
SELECT 
  manufacturer,
  COUNT(*) as device_count,
  COUNT(DISTINCT model_name) as model_variety,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM aed_data), 2) as market_share
FROM aed_data
WHERE manufacturer IS NOT NULL
GROUP BY manufacturer
ORDER BY device_count DESC;

-- 모델별 빈도 (메디아나)
SELECT 
  model_name,
  COUNT(*) as frequency,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM aed_data
WHERE manufacturer LIKE '%메디아나%'
GROUP BY model_name
ORDER BY frequency DESC;

-- 소수 모델 (10대 미만)
SELECT 
  manufacturer,
  model_name,
  COUNT(*) as frequency
FROM aed_data
WHERE manufacturer IS NOT NULL
GROUP BY manufacturer, model_name
HAVING COUNT(*) < 10
ORDER BY frequency DESC;
```

---

### B. API 엔드포인트 명세

#### GET /api/statistics/models

**파라미터**:
- `manufacturer` (string, required): 제조사명

**응답**:
```json
{
  "statistics": [
    {
      "manufacturer": "(주)메디아나",
      "model_name": "HeartOn A15",
      "frequency": 18320,
      "percentage": 51.7,
      "normalized_manufacturer": "메디아나",
      "normalized_model": "heartona15",
      "approval_status": "auto_approved"
    }
  ]
}
```

#### POST /api/validation/model

**요청**:
```json
{
  "manufacturer": "(주)메디아나",
  "model_name": "HeartOm A15"
}
```

**응답**:
```json
{
  "isValid": false,
  "confidence": "medium",
  "message": "\"HeartOm A15\"는 오타일 수 있습니다",
  "suggestion": "HeartOn A15",
  "suggestionFrequency": 18320,
  "requiresApproval": false
}
```

---

### C. 참고 자료

- [Levenshtein Distance Algorithm](https://en.wikipedia.org/wiki/Levenshtein_distance)
- [Fuzzy String Matching in JavaScript](https://github.com/aceakash/string-similarity)
- [Supabase Cron Jobs](https://supabase.com/docs/guides/database/postgres-functions#cron-jobs)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)

---

**문서 종료**  
**검토자**: (미정)  
**승인 후 착수 예정일**: Phase 2 시작 시
