# 통합 명칭 관리 시스템(TNMS) 구현 로드맵

**작성일**: 2025-11-13
**최종 업데이트**: 2025-11-13
**상태**: 승인 대기
**소요 기간**: 30~34일 (약 5주)
**인력 규모**: 5~6명

---

## 목차

0. [임시 구현 상태 (2025-11-14)](#임시-구현-상태-2025-11-14)
1. [개요](#개요)
2. [문제 정의](#문제-정의)
3. [해결 방안](#해결-방안)
4. [사전 준비](#사전-준비-병행)
5. [Phase 1: 인프라 구축](#phase-1-인프라-구축-7일)
6. [Phase 2: MVP 마이그레이션](#phase-2-mvp-마이그레이션-4일)
7. [Phase 3: 대량 데이터 + 수동 검증](#phase-3-대량-데이터--수동-검증-7~10일)
8. [Phase 4: QA·보안·운영](#phase-4-qa보안운영-5~7일)
9. [최종 타임라인](#최종-타임라인)
10. [위험 관리](#위험-관리)
11. [체크리스트](#체크리스트)

---

## 임시 구현 상태 (2025-11-14)

### 상황: 장기 TNMS 구축 전 긴급 조치

2025-11-14, **"광주남구보건소" 자동 추천 실패 문제를 임시로 해결**하기 위해 **퍼지 매칭(Fuzzy Matching)** 기능을 급히 구현했습니다.

### 왜 임시 구현인가?

**근본 원인**: 데이터 정규화 부족
```
target_list_2025.sido: "광주" (비표준)
aed_data.sido: "광주광역시" (표준)
               ↑ 혼재된 지역명 → SQL WHERE 절 매칭 실패
```

**임시 해결책**: Levenshtein 거리 기반 퍼지 매칭
```
"광주남구보건소" → 정규화 → 유사도 계산 → 90% 신뢰도
(느리고 불완전하지만 즉시 작동)
```

### 임시 구현의 문제점

❌ **데이터 정규화 안 됨**: DB에 "광주" vs "광주광역시" 여전히 혼재
❌ **성능 영향**: Levenshtein 거리 계산 (~10ms 추가)
❌ **불완전함**: 70% 이상만 매칭 → 일부 경계 케이스 미처리
❌ **유지보수 어려움**: 한글 정규화 규칙 추가 필요 시마다 수정

### 향후 진행 계획

이 로드맵의 **Phase 1 ~ Phase 4**를 따라 진행하면서:

1. **즉시 (1주)**: Phase 1 병행 - 데이터 정규화 (sid 통일)
2. **1~2주**: 임시 퍼지 매칭으로 운영 (사용자 피드백 수집)
3. **2주 이후**: Phase 2 ~ Phase 4 진행하며 TNMS 구축
4. **TNMS 완성 후**: 임시 퍼지 매칭 **완전 제거**

### 상세 내용

- 임시 구현: [docs/planning/TEMPORARY_FUZZY_MATCHING_IMPLEMENTATION.md](TEMPORARY_FUZZY_MATCHING_IMPLEMENTATION.md)
- 구현 파일:
  - [lib/utils/string-similarity.ts](../../lib/utils/string-similarity.ts) (신규)
  - [app/api/compliance/management-number-candidates/route.ts](../../app/api/compliance/management-number-candidates/route.ts) (lines 514-551 추가)

---

## 개요

### 현재 문제

의무기관매칭 페이지에서 **자동 추천 기능이 작동하지 않음**:
- 선택: "광주남구보건소" (target_list_2025)
- 예상: 관련 AED 기관 추천
- 실제: "매칭 가능한 관리번호가 없습니다"

**근본 원인**: 데이터 불일치
```
target_list_2025: "광주남구보건소"
aed_data: "광주광역시남구보건소"
```

자동 추천 로직이 띄어쓰기를 제거한 후 정확히 일치만 검사하므로, 기관명 형식이 다르면 매칭 실패.

### 깊은 문제

이 문제는 **단순 버그가 아니라 아키텍처 결함**:
- target_list와 aed_data의 기관명이 일관성 없음
- 검색은 부분 문자열(ILIKE)이라 작동, 자동 추천은 정확히 일치만 가능
- 향후 대시보드, 통계, 검사기록 등 다른 기능에서도 동일 문제 반복될 예정

### 해결 방안

**통합 명칭 관리 시스템(TNMS: Terminology and Naming Management System)** 구축

모든 기관명을 **표준 코드(standard_code)** 기반으로 중앙화:
```
실제 기관명들 (다양한 형식)
    ↓
표준 명칭 (canonical_name)  ← 단일 진실 공급원
    ↓
별칭 리스트 (aliases)
    ↓
모든 서비스가 이 표준을 참조
```

이를 통해:
- 의무기관매칭의 자동 추천 정상화
- 향후 기능 확장 시 재작업 없음
- 데이터 품질 자동 모니터링
- 감시·감사 로그 완전화

---

## 문제 정의

### 현재 상황

**자동 추천 API 로직** (`app/api/compliance/management-number-candidates/route.ts`)
```sql
WHERE (
  REPLACE(gd.installation_institution, ' ', '') = REPLACE(${targetName}, ' ', '')
  OR REPLACE(gd.installation_institution, ' ', '') ILIKE '%' || REPLACE(${targetName}, ' ', '') || '%'
  OR REPLACE(${targetName}, ' ', '') ILIKE '%' || REPLACE(gd.installation_institution, ' ', '') || '%'
)
```

공백만 제거하고 비교하므로:
- "광주광역시남구보건소" ≠ "광주남구보건소" → **실패**

**지역 필터까지 포함**:
```sql
AND ad.sido = ${normalizedSido}
AND ad.gugun = ${normalizedGugun}
```

광주 남구 지역에만 검색하는데, 해당 지역에 "보건소" 단어를 포함하는 기관이 없으면 결과 없음.

### 근본 원인

1. **데이터 소스의 불일치**
   - target_list의 기관명 = "광주남구보건소" (약자형)
   - aed_data의 설치기관명 = "광주광역시남구보건소" (정식명)

2. **자동 추천의 취약한 정규화**
   - 공백만 제거 (띄어쓰기 차이 해결)
   - 행정단위 정규화 미흡 (광역시/시도 차이 미처리)
   - 유사도 매칭 알고리즘 없음 (정확히 일치만 가능)

3. **아키텍처 문제**
   - 기관명 정규화 규칙이 코드에 하드코딩됨
   - 각 서비스마다 독립적으로 처리 → 일관성 불가능
   - 향후 다시 동일 문제 반복 확실

---

## 해결 방안

### 전략: 외부화된 TNMS 구축

**목표**: 모든 기관명을 표준 코드 기반으로 중앙 관리

**기본 구조**:
```
institution_registry (표준 기관 레지스트리)
├─ standard_code (UUID 기반)
├─ canonical_name (정식 명칭)
├─ region_code (지역 코드)
└─ category (기관 분류)

institution_aliases (별칭 매핑)
├─ standard_code (FK)
├─ alias_name (실제 데이터에 있는 명칭)
├─ alias_source ('target_list' | 'aed_data' | ...)
├─ match_score (신뢰도, 0-100)
└─ reviewed_by (수동 검증자)

normalization_rules (정규화 규칙)
├─ rule_name ('remove_spaces', 'normalize_si_do', ...)
├─ rule_type ('regex' | 'lookup' | 'function')
├─ rule_spec (JSONB, 타입별 상세 명세)
└─ priority (실행 순서)
```

**효과**:
- 자동 추천 시 표준 기관명으로 비교 → 형식 차이 무시
- 정규화 규칙을 중앙에서 관리 → 코드 수정 불필요
- 모든 서비스가 동일 API 사용 → 일관성 보장
- 데이터 품질 자동 모니터링 가능

---

## 사전 준비 (병행)

### 인력 확보

```
필요 인력:

Backend 개발:
  - 역할: DB 스키마, API 구현, 마이그레이션 스크립트
  - 기간: Phase 1-2 (11일)
  - 1명

Frontend 개발:
  - 역할: 수동 검증 UI 구현
  - 기간: Phase 3a (3일)
  - 1명

데이터/ETL:
  - 역할: 행정안부 데이터 수집 파이프라인, 초기 데이터 로드
  - 기간: Phase 1 (2일) + 운영 (지속)
  - 1명

QA/테스트:
  - 역할: 테스트 케이스 작성, 성능/보안 검증
  - 기간: Phase 4a (3일)
  - 1명

보안:
  - 역할: 권한 모델 검증, 감사 로그 검증
  - 기간: Phase 4b (2일)
  - 1명

수동 검증:
  - 역할: ~500개 실패 항목 검증 (검증 기준 적용)
  - 기간: Phase 3b (5~7일)
  - 2명 (병렬 처리, 100건/일 × 2명)

운영:
  - 역할: 모니터링, 정규화 규칙 추가, 월간 리뷰
  - 기간: 지속 (주간 1시간 + 월간 리뷰 2시간)
  - 0.5명 (기존 운영팀의 일부)

합계: 5~6명 (개발 3, 데이터 1, QA 1, 보안 0.5, 검증 2, 운영 0.5)
```

### 리소스 체크리스트

```
□ 스테이징 DB 접근 권한
□ 프로덕션 DB 백업 전략 (마이그레이션 전)
□ 행정안전부 공개 데이터 API 또는 CSV 다운로드 경로
□ Slack 연동 (검증 실패 알림용)
□ Redis 또는 인메모리 캐시 환경
□ Feature flag 시스템 (gradual rollout용)
□ 모니터링 대시보드 (Prometheus/Grafana 등)
```

---

## Phase 1: 인프라 구축 (7일)

### 1-1. DB 스키마 설계 (2일)

#### Administrative Regions (행정구역 - 자동 수집)
```sql
CREATE TABLE aedpics.administrative_regions (
  region_code VARCHAR(20) PRIMARY KEY,
  region_type VARCHAR(20),              -- 'sido' | 'gugun' | 'eup_myeon_dong'
  korean_name VARCHAR(100) NOT NULL,
  short_name VARCHAR(50),               -- 약칭 (예: '광주')
  parent_code VARCHAR(20) REFERENCES administrative_regions(region_code),
  level INT CHECK (level IN (1, 2, 3)), -- 1: 시도, 2: 시군구, 3: 읍면동
  is_active BOOLEAN DEFAULT TRUE,
  source_url VARCHAR(500),              -- 행안부 공고 링크
  last_verified_date DATE,              -- 마지막 확인 날짜
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE aedpics.administrative_regions IS '행정구역 레지스트리 (자동 수집)';
COMMENT ON COLUMN aedpics.administrative_regions.last_verified_date IS '행정안전부 공식 공고와 마지막 동기화 날짜';

CREATE INDEX idx_region_name ON administrative_regions(korean_name);
CREATE INDEX idx_region_parent ON administrative_regions(parent_code);
```

**초기 데이터**: scripts/collect-administrative-regions.ts에서 자동 로드

#### Institution Registry (표준 기관명 레지스트리)
```sql
CREATE TABLE aedpics.institution_registry (
  standard_code VARCHAR(50) PRIMARY KEY, -- UUID 기반 (inst-abc123def456)
  canonical_name VARCHAR(255) NOT NULL,  -- 정식 명칭
  region_code VARCHAR(20),               -- FK to administrative_regions
  category VARCHAR(50),                  -- 기관 분류 ('health_center', 'hospital', ...)
  sub_category VARCHAR(100),             -- 세부 분류
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(255),               -- 감시용
  last_modified_by VARCHAR(255),
  last_modified_reason TEXT,
  FOREIGN KEY (region_code) REFERENCES administrative_regions(region_code)
);

CREATE INDEX idx_inst_canonical_name ON institution_registry(canonical_name);
CREATE INDEX idx_inst_region ON institution_registry(region_code);
CREATE INDEX idx_inst_active ON institution_registry(is_active);
```

#### Institution Aliases (별칭 및 정규화 매핑)
```sql
CREATE TABLE aedpics.institution_aliases (
  id BIGSERIAL PRIMARY KEY,
  standard_code VARCHAR(50) NOT NULL REFERENCES institution_registry(standard_code),
  alias_name VARCHAR(255) NOT NULL,      -- 실제 데이터에 있는 명칭
  alias_source VARCHAR(50),              -- 'target_list_2025' | 'aed_data' | 'legacy'
  match_score INT DEFAULT 100,           -- 유사도 가중치 (0-100)
  normalization_applied BOOLEAN DEFAULT FALSE, -- 정규화 규칙 적용 여부
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  reviewed_by VARCHAR(255),              -- 수동 검증자
  reviewed_at TIMESTAMP,
  CONSTRAINT valid_score CHECK (match_score >= 0 AND match_score <= 100)
);

CREATE INDEX idx_alias_name ON institution_aliases(alias_name);
CREATE INDEX idx_alias_source ON institution_aliases(alias_source);
CREATE INDEX idx_alias_standard_code ON institution_aliases(standard_code);
```

#### Normalization Rules (정규화 규칙 - 타입 안전)
```sql
CREATE TABLE aedpics.normalization_rules (
  rule_id SERIAL PRIMARY KEY,
  rule_name VARCHAR(100) NOT NULL UNIQUE, -- 'remove_spaces', 'normalize_si_do' 등
  rule_type VARCHAR(50),                   -- 'regex' | 'lookup' | 'function'
  rule_spec JSONB NOT NULL,                -- 타입별 상세 명세
  priority INT DEFAULT 100,                -- 낮을수록 먼저 실행
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by VARCHAR(255)
);

-- rule_spec 예시:
-- Type: regex
-- {
--   "pattern": "\\s+",
--   "replacement": "",
--   "flags": "g"
-- }
--
-- Type: lookup
-- {
--   "mappings": {
--     "동대문": "동대문구",
--     "광주": "광주광역시"
--   }
-- }
--
-- Type: function
-- {
--   "function_name": "normalize_si_do",
--   "params": ["institution_name"]
-- }

-- Validation constraint
CREATE OR REPLACE FUNCTION validate_rule_spec() RETURNS TRIGGER AS $$
BEGIN
  CASE NEW.rule_type
    WHEN 'regex' THEN
      IF NOT (NEW.rule_spec ? 'pattern' AND NEW.rule_spec ? 'replacement') THEN
        RAISE EXCEPTION 'regex rule_spec must have pattern and replacement';
      END IF;
    WHEN 'lookup' THEN
      IF NOT (NEW.rule_spec ? 'mappings') THEN
        RAISE EXCEPTION 'lookup rule_spec must have mappings';
      END IF;
    WHEN 'function' THEN
      IF NOT (NEW.rule_spec ? 'function_name') THEN
        RAISE EXCEPTION 'function rule_spec must have function_name';
      END IF;
  END CASE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_rule_spec_trigger
BEFORE INSERT OR UPDATE ON normalization_rules
FOR EACH ROW EXECUTE FUNCTION validate_rule_spec();
```

#### Institution Validation Log (자동 검증 결과)
```sql
CREATE TABLE aedpics.institution_validation_log (
  log_id BIGSERIAL PRIMARY KEY,
  validation_run_id VARCHAR(100),         -- 배치/수동 실행 ID
  run_type VARCHAR(50),                  -- 'batch' | 'manual' | 'pre_migration'
  source_table VARCHAR(100),             -- 'target_list_2025' | 'aed_data'
  source_name VARCHAR(255),              -- 원본 기관명
  matched_standard_code VARCHAR(50),     -- 일치한 표준코드 (NULL이면 실패)
  match_confidence INT,                  -- 매칭 신뢰도 (0-100)
  is_successful BOOLEAN,
  error_reason VARCHAR(500),
  manual_review_status VARCHAR(50),      -- 'pending' | 'approved' | 'rejected'
  manual_review_notes TEXT,
  reviewed_by VARCHAR(255),              -- 검증자
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_confidence CHECK (match_confidence >= 0 AND match_confidence <= 100)
);

CREATE INDEX idx_validation_run ON institution_validation_log(validation_run_id);
CREATE INDEX idx_validation_success ON institution_validation_log(is_successful);
```

#### Institution Audit Log (감사 추적)
```sql
CREATE TABLE aedpics.institution_audit_log (
  id BIGSERIAL PRIMARY KEY,
  action VARCHAR(50),                    -- 'create' | 'update' | 'delete' | 'alias_add' | 'review'
  table_name VARCHAR(100),               -- 어느 테이블 변경
  record_id VARCHAR(255),                -- 변경된 레코드 ID
  changed_fields JSONB,                  -- {before: {...}, after: {...}}
  actor_id VARCHAR(255),                 -- 누가 변경했는가
  actor_role VARCHAR(50),                -- 'admin' | 'reviewer' | 'system'
  reason TEXT,                           -- 변경 사유
  ip_address INET,                       -- 감사 추적용
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_record ON institution_audit_log(table_name, record_id);
CREATE INDEX idx_audit_actor ON institution_audit_log(actor_id);
CREATE INDEX idx_audit_action ON institution_audit_log(action);
```

#### Institution Metrics (모니터링 지표)
```sql
CREATE TABLE aedpics.institution_metrics (
  metric_id BIGSERIAL PRIMARY KEY,
  metric_date DATE NOT NULL,
  total_institutions INT,               -- 전체 기관 수
  total_aliases INT,                    -- 등록된 별칭 수
  matched_count INT,                    -- 표준 레지스트리에 매칭된 기관
  unmatched_count INT,                  -- 매칭 실패한 기관
  match_success_rate NUMERIC(5, 2),     -- 백분율 (0-100)
  auto_recommend_success_rate NUMERIC(5, 2), -- 자동 추천 성공률
  search_hit_rate NUMERIC(5, 2),        -- 검색 성공률
  validation_run_count INT,             -- 그 날 검증 실행 횟수
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_metrics_date ON institution_metrics(metric_date);
```

### 1-2. API 명세 및 거버넌스 (2일)

#### REST API 명세 (OpenAPI 3.0)

**Endpoint 1: 단일 기관명 해석**
```
POST /api/v1/tnms/resolve

Request:
{
  "name": "광주남구보건소",
  "region_code": "GJ-NG",           # 선택사항
  "scope": "region"                 # region | nationwide
}

Response (200):
{
  "standard_code": "inst-abc123def456",
  "canonical_name": "광주광역시남구보건소",
  "confidence": 95,
  "alias_used": "광주남구보건소",
  "region_code": "GJ-NG",
  "category": "health_center",
  "cached": false
}

Response (404):
{
  "error": "not_found",
  "message": "매칭되는 기관이 없습니다."
}
```

**Endpoint 2: 다중 기관명 일괄 해석**
```
POST /api/v1/tnms/resolve-batch

Request:
{
  "names": ["광주남구보건소", "대구중구보건소", ...],
  "region_code": "GJ-NG",      # 선택사항
  "limit": 500                  # 최대 500개
}

Response (200):
{
  "results": [
    {
      "input": "광주남구보건소",
      "match": {...}            # resolve와 동일
    },
    {
      "input": "존재하지않음",
      "match": null
    },
    ...
  ]
}
```

**Endpoint 3: 수동 검증 (관리자용)**
```
POST /api/admin/tnms-validation

Security: admin:validation 역할 필수

Request:
{
  "validation_log_id": 12345,
  "action": "approve" | "reject" | "create_new_institution",
  "standard_code": "inst-abc123def456",  # action=approve일 때만
  "reason": "광주남구와 광주광역시남구는 동일 기관으로 판단"
}

Response (201):
{
  "success": true,
  "audit_log_id": "audit-xyz789"
}
```

**Endpoint 4: 검증 결과 조회**
```
GET /api/admin/tnms-validation?source_table=target_list_2025&status=pending

Security: admin:validation 역할 필수

Response (200):
{
  "pending": [
    {
      "log_id": 12345,
      "source_name": "존재하지않는기관",
      "source_table": "target_list_2025",
      "match_confidence": 45,
      "auto_suggestions": [...]
    }
  ],
  "total": 127,
  "reviewed": 23
}
```

#### 인증 및 권한 모델

```
역할 정의:
├─ tnms:read         → API 조회 (모든 조회 엔드포인트)
├─ tnms:write        → 기관 정보 수정 (제한적)
├─ admin:validation  → 수동 검증 (POST /api/admin/tnms-validation)
├─ admin:tnms        → 전체 관리 (규칙 변경, 감사 로그 조회)
└─ system            → 배치 작업 자동 실행

토큰:
- Access token: 1시간 유효
- Refresh token: 72시간 유효
- Rate limit: 10 req/sec (역할별 조정 가능)
```

#### SLA (Service Level Agreement)

```
성능 목표:
├─ resolve (단일):
│   - Cache hit: < 100ms (P99)
│   - Cache miss: < 500ms (P99)
├─ resolve-batch (100개):
│   - < 1000ms (P99)
├─ 가용성:
│   - 목표: 99.9% uptime
│   - 오류율: < 0.1%
│
Fallback 정책:
1. Cache hit → 즉시 반환
2. Cache miss → DB 조회 (500ms 타임아웃)
3. DB 실패 → 마지막 캐시값 반환 또는 NULL
4. 전체 실패 → Circuit breaker 활성화 (5분간 fast-fail)
```

#### 캐시 전략 (다층 캐시)

```
레벨 1: 로컬 메모리 캐시 (인스턴스별)
├─ 크기: 10,000개 항목
├─ TTL: 1시간
├─ 용도: 자주 사용되는 기관명 (상위 80%)
└─ 무효화: 이벤트 기반

레벨 2: Redis (중앙화)
├─ 크기: 무제한
├─ TTL: 3600초 (1시간)
├─ 용도: 모든 조회 결과 캐싱
└─ 무효화: 자정 자동 재구축 + 이벤트 기반

캐시 무효화 이벤트:
┌─────────────────────────┐
│ institution_aliases     │
│ INSERT/UPDATE/DELETE    │
└────────────┬────────────┘
             │
    ┌────────▼────────────────┐
    │ DB Trigger              │
    │ → Publish Event (Queue) │
    └────────┬────────────────┘
             │
    ┌────────▼─────────────┐
    │ TNMS Service         │
    │ (webhook listener)   │
    └────────┬─────────────┘
             │
    ┌────────▼──────────────┐
    │ Redis 무효화          │
    │ + 로컬 캐시 갱신      │
    └──────────────────────┘

예상 시간: < 100ms
```

**캐시 재구축 정책**:
```
매일 자정 (0시):
1. 전체 alias 데이터 로드
2. 정규화 규칙 적용
3. Redis 새로 구축 (점진적, 100개 배치)
4. 진행 상태 로깅
5. 완료 후 슬랙 알림

예상 시간: 30~60초 (100,000개 기관 기준)
트래픽 영향: 무시할 수 있는 수준 (자정 사용량 최소)
```

#### 버전 관리

```
API 버전 정책:
├─ v1 (현재, 2025):
│   - 정확히 일치 / 정규화 / 부분 일치 (Jaro-Winkler)
│   - 캐싱 지원
│   - backward compatible
│
├─ v2 (예정, 2025 Q3):
│   - 자체 학습 유사도 모델
│   - 실시간 피드백 반영
│   - 다국어 지원 (future)
│
└─ 마이그레이션 정책:
    - 6개월 버퍼 (v1 유지)
    - v1 제거 전 고객 공지 (3개월 전)
    - Deprecation header 반영 (3개월 전)
```

### 1-3. 데이터 수집 파이프라인 (2일)

#### Administrative Regions 자동 수집

```typescript
// scripts/collect-administrative-regions.ts

import { administrativeRegionService } from '@/lib/services/tnms';

export async function collectAdministrativeRegions() {
  try {
    console.log('행정구역 데이터 수집 시작...');

    // 1. 행정안전부 공식 데이터 또는 공개 API에서 조회
    // 참고: https://www.juso.go.kr/addrlink/api/guide
    const regions = await fetchFromGovernmentDataPortal();

    // 2. Upsert (기존 코드는 update, 신규는 insert)
    const results = await administrativeRegionService.upsertBatch(regions);

    // 3. 검증: 불일치 항목 리포트
    const validation = await administrativeRegionService.validateRegionCodes();

    console.log(`
      수집 완료: ${results.inserted} 신규, ${results.updated} 업데이트
      검증 결과: ${validation.passed ? '성공' : '경고'}
      마지막 확인: ${new Date().toISOString()}
    `);

    return { success: true, results, validation };
  } catch (error) {
    console.error('행정구역 수집 실패:', error);
    // Slack 알림
    await notifySlack({
      channel: '#alert-tnms',
      text: '행정구역 데이터 수집 실패'
    });
    throw error;
  }
}

// 매월 2회 실행 (GitHub Actions 또는 수동)
// schedule:
//   - cron: '0 2 1 * *'      # 매월 1일 오전 2시
//   - cron: '0 2 15 * *'     # 매월 15일 오전 2시
```

#### 정규화 규칙 기본셋

```typescript
// scripts/seed-normalization-rules.ts

export async function seedNormalizationRules() {
  const basicRules = [
    {
      rule_name: 'remove_spaces',
      rule_type: 'regex',
      rule_spec: {
        pattern: '\\s+',
        replacement: '',
        flags: 'g'
      },
      priority: 10,
      description: '모든 공백 제거 (공백 형식 통일)'
    },
    {
      rule_name: 'normalize_si_do',
      rule_type: 'lookup',
      rule_spec: {
        mappings: {
          '광주광역시': '광주',
          '대구광역시': '대구',
          '서울특별시': '서울',
          '부산광역시': '부산',
          '인천광역시': '인천',
          '대전광역시': '대전',
          '울산광역시': '울산',
          '세종특별자치시': '세종',
          // ... (전국 17개 시도)
        }
      },
      priority: 20,
      description: '시도명 표준화 (광역시 → 약칭)'
    },
    {
      rule_name: 'remove_parentheses',
      rule_type: 'regex',
      rule_spec: {
        pattern: '\\([^)]*\\)',
        replacement: '',
        flags: 'g'
      },
      priority: 30,
      description: '괄호 및 내용 제거 (ex: 남구(광주) → 남구)'
    },
    {
      rule_name: 'normalize_gu_suffix',
      rule_type: 'regex',
      rule_spec: {
        pattern: '구$',
        replacement: '구',
        flags: ''
      },
      priority: 40,
      description: '구/군 접미사 정규화'
    }
  ];

  for (const rule of basicRules) {
    await prisma.normalization_rules.upsert({
      where: { rule_name: rule.rule_name },
      update: rule,
      create: rule
    });
  }

  console.log(`${basicRules.length}개 정규화 규칙 로드됨`);
}

// Phase 1 완료 시 1회 실행
```

### 1-4. MVP API 구현 (1일)

```typescript
// lib/services/tnms-service.ts

import jaroWinkler from 'jaro-winkler';
import { createClient } from 'redis';

export class TNMSService {
  private cache: Map<string, CacheEntry> = new Map();
  private redisClient = createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
  });

  constructor() {
    this.redisClient.connect();
  }

  /**
   * 단일 기관명 해석 (MVP v1)
   * - 정확히 일치 (100점)
   * - 정규화 후 유사도 (70~99점)
   * - 실패 (NULL)
   */
  async resolveByName(
    name: string,
    options?: ResolveOptions
  ): Promise<InstitutionMatch | null> {
    // 1. 정규화
    const normalized = await this.normalize(name);

    // 2. 캐시 확인
    const cacheKey = `tnms:${normalized}:${options?.region_code || 'all'}`;

    // 로컬 캐시 확인
    if (this.cache.has(cacheKey)) {
      const entry = this.cache.get(cacheKey)!;
      if (Date.now() - entry.timestamp < 3600000) { // 1시간
        return entry.data;
      } else {
        this.cache.delete(cacheKey);
      }
    }

    // Redis 캐시 확인
    try {
      const cached = await this.redisClient.get(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        // 로컬 캐시에도 저장
        this.cache.set(cacheKey, { data, timestamp: Date.now() });
        return data;
      }
    } catch (error) {
      console.error('Redis 캐시 조회 실패:', error);
      // Redis 실패해도 DB 조회 계속 진행
    }

    // 3. DB 쿼리 (정확히 일치 / 부분 일치)
    const match = await this.findMatch(normalized, options);

    // 4. 캐시 저장
    if (match) {
      try {
        await this.redisClient.setex(
          cacheKey,
          3600, // 1시간
          JSON.stringify(match)
        );
      } catch (error) {
        console.error('Redis 캐시 저장 실패:', error);
      }

      // 로컬 캐시에도 저장
      this.cache.set(cacheKey, { data: match, timestamp: Date.now() });
    }

    return match || null;
  }

  /**
   * 정규화 규칙 적용
   */
  private async normalize(text: string): Promise<string> {
    let result = text;

    // DB에서 규칙 조회 (캐시됨)
    const rules = await this.getNormalizationRules();

    for (const rule of rules) {
      try {
        if (rule.rule_type === 'regex') {
          const re = new RegExp(
            rule.rule_spec.pattern,
            rule.rule_spec.flags
          );
          result = result.replace(re, rule.rule_spec.replacement);
        } else if (rule.rule_type === 'lookup') {
          result = rule.rule_spec.mappings[result] || result;
        }
        // 'function' 타입은 Phase 2에서 추가
      } catch (error) {
        console.error(`규칙 적용 실패 (${rule.rule_name}):`, error);
      }
    }

    return result;
  }

  /**
   * 기관명 매칭 (정규화 후 유사도 계산)
   */
  private async findMatch(
    normalized: string,
    options?: ResolveOptions
  ): Promise<InstitutionMatch | null> {
    // 별칭 목록 조회
    const aliases = await this.getAliases(options?.region_code);

    let bestMatch: InstitutionMatch | null = null;

    for (const alias of aliases) {
      const normalizedAlias = await this.normalize(alias.alias_name);

      // 정확히 일치
      if (normalized === normalizedAlias) {
        return {
          standard_code: alias.standard_code,
          canonical_name: alias.canonical_name,
          confidence: 100,
          alias_used: alias.alias_name,
          region_code: alias.region_code,
          category: alias.category,
          cached: false
        };
      }

      // Jaro-Winkler 유사도 계산
      const similarity = jaroWinkler(normalized, normalizedAlias);
      const confidenceScore = Math.round(similarity * 100);

      // 70점 이상만 고려
      if (confidenceScore >= 70) {
        if (!bestMatch || confidenceScore > bestMatch.confidence) {
          bestMatch = {
            standard_code: alias.standard_code,
            canonical_name: alias.canonical_name,
            confidence: confidenceScore,
            alias_used: alias.alias_name,
            region_code: alias.region_code,
            category: alias.category,
            cached: false
          };
        }
      }
    }

    return bestMatch;
  }

  /**
   * 별칭 목록 조회 (지역 필터 선택사항)
   */
  private async getAliases(regionCode?: string): Promise<InstitutionAlias[]> {
    let query = prisma.institution_aliases.findMany({
      where: {
        is_active: true
      },
      include: {
        institution: {
          select: {
            canonical_name: true,
            category: true,
            region_code: true
          }
        }
      }
    });

    // 지역 필터
    if (regionCode && regionCode !== 'ALL') {
      // region_code가 정확히 일치 또는 부모 지역
      const region = await prisma.administrative_regions.findUnique({
        where: { region_code: regionCode }
      });

      if (region?.level === 1) {
        // 시도 → 해당 시도 내 모든 구군
        const childRegions = await prisma.administrative_regions.findMany({
          where: { parent_code: regionCode }
        });
        const regionCodes = [regionCode, ...childRegions.map(r => r.region_code)];

        query = query.where({
          institution: {
            region_code: { in: regionCodes }
          }
        });
      } else {
        // 시군구 → 정확히 일치
        query = query.where({
          institution: {
            region_code: regionCode
          }
        });
      }
    }

    return query;
  }

  /**
   * 정규화 규칙 조회 (캐시됨)
   */
  private async getNormalizationRules(): Promise<NormalizationRule[]> {
    // TODO: 캐시 구현 (메모리 또는 Redis)
    return prisma.normalization_rules.findMany({
      where: { is_active: true },
      orderBy: { priority: 'asc' }
    });
  }
}
```

---

## Phase 2: MVP 마이그레이션 (4일)

### 목표

Phase 1의 resolveByName v1 API를 사용하여 초기 데이터 매핑

### 2-1. Target_list 기관 로드 (1일)

```typescript
// scripts/migrate-institutions-phase2.ts

export async function migrateTargetListInstitutions() {
  const runId = `migration-target-${Date.now()}`;
  console.log(`[${runId}] Target_list 마이그레이션 시작`);

  try {
    // 1. target_list_2025의 모든 기관 조회 (중복 제거)
    const institutions = await prisma.target_list_2025.findMany({
      select: {
        institution_name: true,
        region_code: true,
        category: true
      },
      distinct: ['institution_name']
    });

    console.log(`[${runId}] 처리할 기관: ${institutions.length}개`);

    let created = 0;
    let skipped = 0;

    // 2. 각 기관을 institution_registry에 등록
    for (const inst of institutions) {
      // 이미 존재하는가?
      const existing = await prisma.institution_registry.findFirst({
        where: {
          canonical_name: inst.institution_name,
          region_code: inst.region_code
        }
      });

      if (existing) {
        skipped++;
        continue;
      }

      // 신규 기관 생성
      const standard_code = `inst-${crypto.randomUUID()}`;

      const newInst = await prisma.institution_registry.create({
        data: {
          standard_code,
          canonical_name: inst.institution_name,
          region_code: inst.region_code,
          category: inst.category,
          created_by: 'system:phase2_migration'
        }
      });

      // Alias로도 등록 (100점: 정확히 일치)
      await prisma.institution_aliases.create({
        data: {
          standard_code,
          alias_name: inst.institution_name,
          alias_source: 'target_list_2025',
          match_score: 100,
          reviewed_by: 'system:phase2_migration',
          reviewed_at: new Date()
        }
      });

      // 감사 로그
      await createAuditLog({
        action: 'create',
        table_name: 'institution_registry',
        record_id: standard_code,
        changed_fields: {
          canonical_name: inst.institution_name,
          region_code: inst.region_code
        },
        actor_id: 'system',
        actor_role: 'system',
        reason: 'Phase 2 마이그레이션'
      });

      created++;

      if ((created + skipped) % 100 === 0) {
        console.log(`[${runId}] 진행: ${created + skipped}/${institutions.length}`);
      }
    }

    console.log(`[${runId}] 완료: ${created}개 생성, ${skipped}개 스킵`);

  } catch (error) {
    console.error(`[${runId}] 실패:`, error);
    throw error;
  }
}
```

### 2-2. AED_data 설치기관 매핑 (2일)

```typescript
// scripts/migrate-aed-data-institutions.ts

export async function migrateAEDDataInstitutions() {
  const runId = `migration-aed-${Date.now()}`;
  const tnmsService = new TNMSService();

  console.log(`[${runId}] AED_data 마이그레이션 시작`);

  try {
    // 1. AED_data의 설치기관 조회 (중복 제거)
    const aedInsts = await prisma.aed_data.findMany({
      select: {
        installation_institution: true,
        region_code: true
      },
      distinct: ['installation_institution']
    });

    console.log(`[${runId}] 처리할 설치기관: ${aedInsts.length}개`);

    let autoMatched = 0;
    let pendingReview = 0;

    // 2. 각 설치기관을 aliases에 매핑
    for (const inst of aedInsts) {
      // 이미 등록되어 있는가?
      const existing = await prisma.institution_aliases.findFirst({
        where: {
          alias_name: inst.installation_institution,
          alias_source: 'aed_data'
        }
      });

      if (existing) {
        continue;
      }

      // TNMS에서 resolve 시도
      const match = await tnmsService.resolveByName(
        inst.installation_institution,
        { region_code: inst.region_code }
      );

      if (match && match.confidence >= 85) {
        // 자동 매칭 성공
        await prisma.institution_aliases.create({
          data: {
            standard_code: match.standard_code,
            alias_name: inst.installation_institution,
            alias_source: 'aed_data',
            match_score: match.confidence,
            reviewed_by: 'system:auto_match',
            reviewed_at: new Date()
          }
        });

        autoMatched++;
      } else {
        // 수동 검증 대기
        await prisma.institution_validation_log.create({
          data: {
            validation_run_id: runId,
            run_type: 'pre_migration',
            source_table: 'aed_data',
            source_name: inst.installation_institution,
            matched_standard_code: match?.standard_code || null,
            match_confidence: match?.confidence || 0,
            is_successful: !!match,
            manual_review_status: 'pending'
          }
        });

        pendingReview++;
      }

      if ((autoMatched + pendingReview) % 100 === 0) {
        console.log(`[${runId}] 진행: ${autoMatched + pendingReview}/${aedInsts.length}`);
      }
    }

    console.log(`[${runId}] 완료: 자동 매칭 ${autoMatched}개, 수동 검증 ${pendingReview}개`);

    // 검증 대기 항목 보고
    if (pendingReview > 0) {
      await notifySlack({
        channel: '#tnms-alerts',
        text: `Phase 2 마이그레이션: ${pendingReview}개 항목 수동 검증 필요`
      });
    }

  } catch (error) {
    console.error(`[${runId}] 실패:`, error);
    throw error;
  }
}
```

---

## Phase 3: 대량 데이터 + 수동 검증 (7~10일)

### 3-1. 수동 검증 UI & 백엔드 (3일)

#### 수동 검증 페이지 구현

**경로**: `/admin/tnms-validation`

**기능**:
```
1. 검증 대기 리스트 (Pending)
   - source_table별 필터 (target_list / aed_data)
   - 검색 (기관명)
   - 페이지네이션
   - 정렬 (생성일, 신뢰도)

2. 상세 검증 폼
   - 원본 기관명 (읽기 전용)
   - 자동 추천 기관명 + 신뢰도 (있으면)
   - 후보 검색 (추가로 찾기)
   - 승인/거부/새로 만들기 라디오 버튼
   - 승인 사유 (필수, 최소 10자)

3. 진행 상황 대시보드
   - 오늘 처리 건수
   - 누적 처리 건수
   - 성공률 (승인/거부 비율)
```

**백엔드 API** (감사 로그 포함)

```typescript
// app/api/admin/tnms-validation/route.ts

export async function POST(request: NextRequest) {
  const session = await getServerSession();

  // 권한 검증
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasPermission = await checkUserPermission(
    session.user.email,
    'admin:validation'
  );

  if (!hasPermission) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const {
    validation_log_id,
    action, // 'approve' | 'reject' | 'create_new'
    standard_code,
    reason
  } = await request.json();

  // 유효성 검사
  if (!reason || reason.trim().length < 10) {
    return NextResponse.json(
      { error: '사유는 최소 10자 이상이어야 합니다' },
      { status: 422 }
    );
  }

  try {
    // 1. 감사 로그 기록 (action 전에)
    const auditLog = await createAuditLog({
      action: 'manual_review',
      table_name: 'institution_validation_log',
      record_id: validation_log_id.toString(),
      changed_fields: {
        before: { manual_review_status: 'pending' },
        after: { manual_review_status: action }
      },
      actor_id: session.user.id,
      actor_role: 'reviewer',
      reason,
      ip_address: request.ip
    });

    // 2. 검증 로그 업데이트
    const validationLog = await prisma.institution_validation_log.update({
      where: { log_id: validation_log_id },
      data: {
        matched_standard_code: action === 'approve' ? standard_code : null,
        manual_review_status: action === 'approve' ? 'approved' : 'rejected',
        manual_review_notes: reason,
        reviewed_by: session.user.id,
        reviewed_at: new Date()
      }
    });

    // 3. action=approve인 경우 alias 생성
    if (action === 'approve' && standard_code) {
      await prisma.institution_aliases.create({
        data: {
          standard_code,
          alias_name: validationLog.source_name,
          alias_source: validationLog.source_table,
          match_score: 95, // 수동 검증이므로 높은 신뢰도
          reviewed_by: session.user.id,
          reviewed_at: new Date()
        }
      });

      // 캐시 무효화 이벤트 발행
      await publishCacheInvalidationEvent({
        type: 'alias_added',
        standard_code,
        timestamp: new Date()
      });
    }

    // 4. 응답
    return NextResponse.json({
      success: true,
      audit_log_id: auditLog.id,
      message: `검증 완료: ${action === 'approve' ? '승인' : '거부'}`
    }, { status: 201 });

  } catch (error) {
    console.error('검증 처리 실패:', error);

    await notifySlack({
      channel: '#alert-tnms',
      text: `검증 처리 실패 (ID: ${validation_log_id})`
    });

    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
```

### 3-2. 검증자 투입 및 일정 (4~5일)

```
Day 1: 검증자 온보딩 (교육 1시간)
  - TNMS 아키텍처 이해
  - 검증 기준 설명
  - UI 사용법 데모
  - 실습 (10개 항목)

Day 2-5: 일괄 검증
  - 검증 대기 항목: ~500~700개 (추정)
  - 처리량: 100건/일 × 2명 = 200건/일
  - 소요 기간: 5~7일

일일 진행상황:
  - 아침 미팅 (15분): 어제 결과, 오늘 일정
  - 검증 작업 (4시간)
  - 점심 (1시간)
  - 검증 작업 (3시간)
  - 저녁 리뷰 (30분): 오류 패턴, 규칙 추가 필요성 검토
```

**검증 기준**:
```
1. Confidence >= 85: 자동 승인 (수동 검증자가 빠르게 처리)
2. Confidence 70-84: 심사 필요 (후보군 여러 개 검토)
3. Confidence < 70: 신규 생성 또는 제외
4. 실패 (NULL): 신규 생성 또는 제외
```

### 3-3. 부분 배포: 광주 지역 먼저 (1일)

```
Phase 3 Day 3 (Wednesday):
1. 광주 지역 기관 검증 상태 확인
   - SELECT COUNT(*) FROM institution_validation_log
     WHERE source_table LIKE '%광주%' AND manual_review_status = 'pending'

2. 모두 검증 완료했으면 의무기관매칭 API 수정
   // app/api/compliance/management-number-candidates/route.ts
   // TNMS resolveByName 사용으로 변경

3. Feature flag 활성화 (광주만)
   // lib/config/feature-flags.ts
   // TNMS_ENABLED: true (지역별 설정)

4. 스테이징에서 1시간 테스트
5. 프로덕션 배포 (광주 지역만)
6. 24시간 모니터링
   - 자동 추천 성공률
   - 오류 로그
   - 사용자 피드백

Day 4 (Thursday):
- 광주 결과 검토
- 성공 시 다른 지역 확대 결정
- 추가 개선사항 협의
```

---

## Phase 4: QA·보안·운영 핸드오버 (5~7일)

### 4-1. QA 테스트 (3일)

#### 테스트 계획

**1. 기능 테스트** (1일)
```
□ 정규화 규칙
  ✓ remove_spaces: "광주 남구" → "광주남구"
  ✓ normalize_si_do: "광주광역시" → "광주"
  ✓ remove_parentheses: "남구(광주)" → "남구"

□ 매칭 알고리즘
  ✓ 정확히 일치: confidence = 100
  ✓ 부분 일치: 85 <= confidence < 100
  ✓ 유사도: 70 <= confidence < 85
  ✓ 실패: confidence < 70 또는 NULL

□ 캐싱
  ✓ 로컬 캐시 hit: < 10ms
  ✓ Redis hit: < 50ms
  ✓ Cache miss (DB): < 500ms
  ✓ TTL 검증: 정확히 3600초 후 만료
  ✓ 무효화 이벤트: < 100ms 내 처리

□ API
  ✓ /api/v1/tnms/resolve (단일)
  ✓ /api/v1/tnms/resolve-batch (다중)
  ✓ /api/admin/tnms-validation (검증)
  ✓ Rate limiting: 10req/sec 정상 작동
  ✓ Error handling: 모든 404, 500 처리
```

**2. 성능 테스트** (1일)
```
부하 테스트:
  - 동시 요청 100개
  - 각 요청 처리 시간 측정
  - P50, P95, P99 latency 기록

캐시 효율성:
  - Cache hit rate 측정 (목표: > 80%)
  - 메모리 사용량 (목표: < 500MB)
  - 네트워크 대역폭 (캐시 덕분에 감소율)
```

**3. 의무기관매칭 통합 테스트** (1일)
```
광주 지역 (부분 배포 데이터):
  □ "광주남구보건소" 선택 → 관리번호 추천 나옴
  □ "보건소" 검색 → 동일 결과
  □ "광주광역시남구보건소" 검색 → 동일 결과

다른 지역 (기존 로직):
  □ 자동 추천 여전히 작동
  □ 검색 여전히 작동
  □ 성능 저하 없음
```

#### 성능 메트릭 수집

```
메트릭:
├─ P50 latency (ms)
├─ P95 latency (ms)
├─ P99 latency (ms)
├─ Error rate (%)
├─ Cache hit rate (%)
├─ DB query count
└─ Memory usage (MB)

기준:
├─ 단일 resolve: P99 < 100ms (cache hit), < 500ms (miss)
├─ Batch resolve (100개): P99 < 1000ms
├─ Error rate: < 0.1%
├─ Cache hit rate: > 80%
└─ Memory: < 500MB
```

### 4-2. 보안 검증 (2일)

#### 보안 체크리스트

```
□ SQL Injection
  - 모든 쿼리가 parameterized
  - user input은 직접 SQL 사용 금지
  - Prisma ORM 사용

□ XSS (Cross-Site Scripting)
  - 입력값 sanitization
  - HTML 엔티티 인코딩
  - CSP header 설정

□ CSRF (Cross-Site Request Forgery)
  - POST/PUT/DELETE에 CSRF 토큰
  - SameSite cookie 설정

□ 권한 (Authorization)
  - RBAC 정상 작동
  - 역할 확인 (admin:validation)
  - IP 주소 기반 제한 (optional)

□ 감시/감사 (Audit)
  - 모든 민감 작업 기록
  - 누가/언제/뭘 했는지 추적 가능
  - 감사 로그 변조 불가능 (append-only)

□ 암호화
  - DB 연결 TLS
  - 로그 암호화 저장
  - 비밀정보 (API key 등) 환경변수로 관리

□ Rate Limiting
  - 활성화: 10 req/sec per IP
  - 초과 시 429 응답
  - 대역폭 DoS 방어

□ 데이터 보호
  - 민감정보 로깅 금지 (개인정보 등)
  - 감사 로그 retention policy (1년)
  - GDPR 준수 (개인정보 삭제 요청)
```

### 4-3. 운영 핸드오버 (2~3일)

#### 운영 문서화

**1. 운영 매뉴얼**

```markdown
## 일일 모니터링 체크리스트

### 아침 (9시)
- [ ] TNMS 성능 지표 확인
  - P99 latency: 목표 < 500ms
  - Error rate: 목표 < 0.1%
  - Cache hit rate: 목표 > 80%

- [ ] 어제 검증 결과 확인
  - 처리 건수
  - 실패율 (실패율 > 10%면 조사)

- [ ] Slack 알림 확인
  - TNMS 자동 알림
  - 긴급 이슈 체크

### 점심 (12시)
- [ ] 데이터 품질 지표
  - 신규 등록 기관 수
  - 규칙 추가 필요성 검토

### 저녁 (17시)
- [ ] 일일 리포트 작성
  - 주요 지표
  - 이상 징후
  - 개선 사항

## 알림 해석 가이드

### Level 1: INFO (파란색 이모지)
- 일일 통계 보고
- 정기 배치 완료
- 조치 불필요

### Level 2: WARNING (노란색 이모지)
- 실패율 10% 초과
- P99 latency 500ms 초과
- Cache hit rate 70% 미만
- → 1시간 내 원인 파악 필요

### Level 3: ERROR (빨간색 이모지)
- 실패율 20% 초과
- 자동 추천 기능 다운
- DB 연결 실패
- → 즉시 대응 (담당자 호출)

## 긴급 대응 절차

### Scenario 1: 자동 추천 성공률 급하락 (> 20%)
1. 최근 배포 내용 확인 (git log)
2. 정규화 규칙 변경 이력 확인
3. 문제 규칙 임시 비활성화 (is_active = FALSE)
4. 캐시 전체 재구축
5. 모니터링 (1시간)
6. 원인 분석 및 수정

### Scenario 2: 매칭 데이터 손상
1. 신중히 조사 (이전 백업 확인)
2. 필요시 마지막 알려진 좋은 상태로 복원
3. 데이터 검증 배치 재실행
4. 감사 로그 검토

### Scenario 3: 권한 누락
1. 관리자 확인 (admin:validation 역할)
2. 필요시 역할 추가
3. 재로그인
```

**2. 정규화 규칙 관리**

```markdown
## 규칙 추가 절차

### Step 1: 필요성 확인
- 검증 로그에서 실패 패턴 분석
- 예: "광주광역시"와 "광주" 같은 항목 다수 실패

### Step 2: 규칙 설계
- rule_type 선택 (regex / lookup / function)
- 테스트 케이스 작성

### Step 3: 개발 및 테스트
```sql
INSERT INTO normalization_rules (
  rule_name, rule_type, rule_spec, priority, description
) VALUES (
  'new_rule',
  'regex',
  '{
    "pattern": "...",
    "replacement": "...",
    "flags": "g"
  }'::jsonb,
  100,
  '...'
);
```

### Step 4: 영향도 평가
```typescript
// scripts/test-normalization-rule.ts
const testCases = [
  { input: "광주광역시", expected: "광주" },
  { input: "대구광역시", expected: "대구" },
  // ...
];

for (const testCase of testCases) {
  const result = await normalizeText(testCase.input);
  console.assert(result === testCase.expected, testCase);
}
```

### Step 5: 배포
- 규칙 is_active = TRUE
- 캐시 전체 재구축
- 모니터링 (24시간)

### Step 6: 롤백 (필요시)
- 규칙 is_active = FALSE
- 캐시 재구축
- 이전 동작으로 복구
```

**3. 데이터 품질 모니터링**

```markdown
## 월간 리뷰

### 지표 분석
1. 매칭 성공률 추이
   - 목표: 95% 이상
   - 원인: 새로운 기관명 패턴?

2. 자동 추천 성공률 (의무기관매칭)
   - 목표: 90% 이상
   - 개선: 정규화 규칙 추가 필요?

3. 검색 성공률
   - 목표: 98% 이상
   - 낮으면: 기본 검색어 패턴 분석

### 실패 항목 분석
- 상위 10개 패턴
- 공통 특징 파악
- 규칙 추가 또는 기관 데이터 수정

### 행정구역 확인
- 새로운 시군구 신설?
- 합병/분리 있었는가?
- 행정안전부 공고 확인 후 데이터 업데이트

### 회의
- 참석: Backend, Data, Operations
- 발제: 월간 지표 리뷰
- 결정: 개선사항 우선순위, 규칙 추가 여부
```

#### 운영팀 교육 (4시간)

```
Hour 1: TNMS 아키텍처 개요
  - 데이터 흐름 (institution_registry → aliases → resolveByName)
  - 테이블 구조 (institution_registry, aliases, ...)
  - API 개념 (standard_code 기반 통합)
  - 예시: "광주남구보건소" → inst-xxx123 → [여러 alias]

Hour 2: 모니터링 대시보드 사용법
  - Prometheus/Grafana 대시보드 접근
  - 주요 지표 읽는 법
  - 알림 설정
  - 로그 조회 (ELK 또는 CloudWatch)

Hour 3: 수동 검증 UI 사용법
  - 로그인 및 권한 확인
  - 검증 대기 리스트 조회
  - 상세 폼 작성
  - 감사 로그 확인

Hour 4: 실습
  - 실제 데이터로 몇 가지 검증 수행
  - 모니터링 대시보드에서 결과 확인
  - Q&A
```

---

## 최종 타임라인

| Phase | 항목 | 기간 | 누적 | 인력 |
|-------|------|------|-----|------|
| **사전** | 인력 확보, 리소스 준비 | - | - | PM |
| **1** | DB 설계 (1-1) | 2일 | 2일 | BE 1 |
| **1** | API 명세 (1-2) | 2일 | 4일 | BE 1 |
| **1** | 데이터 파이프라인 (1-3) | 2일 | 6일 | Data 1, BE 1 |
| **1** | MVP API 구현 (1-4) | 1일 | 7일 | BE 1 |
| **2** | MVP 마이그레이션 | 4일 | 11일 | BE 1 |
| **3a** | 수동 검증 UI & Backend | 3일 | 14일 | BE 1, FE 1 |
| **3b** | 대량 데이터 검증 (병렬) | 5~7일 | 19~21일 | 검증자 2명 |
| **3c** | 부분 배포 (광주) | 1일 | 20~22일 | BE 1 |
| **4a** | QA 테스트 | 3일 | 23~25일 | QA 1 |
| **4b** | 보안 검증 | 2일 | 25~27일 | Security 1 |
| **4c** | 운영 핸드오버 | 2일 | 27~29일 | BE + Ops |
| **버퍼** | 예상 밖 이슈, 변경 요청 | 3~5일 | - | - |
| **합계** | | | **30~34일** | **5~6명** |

---

## 위험 관리

### 주요 위험 요소

| 위험 | 확률 | 영향 | 대응책 |
|------|------|------|------|
| **마이그레이션 데이터 손상** | 중 | 높음 | Phase 1 완료 후 백업, 테스트 DB에서 먼저 검증 |
| **정규화 규칙 오류** | 중 | 중간 | 단위 테스트 (500+ 케이스), spot check |
| **성능 저하** | 중 | 중간 | 부하 테스트 (1000 동시), P99 latency 모니터링 |
| **수동 검증 인력 부족** | 낮음 | 높음 | 사전 일정 계획, 필요시 기간 연장 |
| **캐시 불일치** | 낮음 | 중간 | 이벤트 기반 무효화, 자정 자동 재구축 |
| **권한/감사 로그 누락** | 낮음 | 높음 | 보안 리뷰 (Phase 4b) |

### 롤백 계획

**문제 발생 시 (< 24시간)**:
1. 의무기관매칭 API feature flag 비활성화 (기존 로직으로 복구)
2. 원인 분석 (검증 로그, 성능 지표)
3. 수정 후 재검증
4. 스테이징에서 1시간 테스트
5. 프로덕션 재배포

**자동 감지 및 롤백**:
```
IF 자동 추천 성공률 < 80% (전주 대비 10%p 하락) THEN
  → Slack 긴급 알림
  → manual review 필요

IF 에러율 > 1% THEN
  → Feature flag 자동 비활성화
  → Slack 심각 알림
```

---

## 체크리스트

### 사전 준비
- [ ] 인력 확보 및 일정 공지
- [ ] 프로덕션 DB 백업 전략 수립
- [ ] 스테이징 환경 확보
- [ ] Slack 채널 생성 (#tnms-alerts, #tnms-validation)
- [ ] Feature flag 시스템 준비 (Launchdarkly 또는 custom)

### Phase 1
- [ ] DB 스키마 설계 문서 작성
- [ ] API 명세 (OpenAPI) 작성
- [ ] MVP 구현 및 단위 테스트
- [ ] 데이터 수집 파이프라인 작동 확인
- [ ] 스테이징에서 기본 기능 테스트

### Phase 2
- [ ] Target_list 기관 institution_registry 로드
- [ ] AED_data 설치기관 aliases 매핑
- [ ] 검증 로그 생성 및 확인 (pending 항목 수)
- [ ] 자동 매칭 통계 (confidence >= 85)

### Phase 3
- [ ] 수동 검증 UI 구현 및 권한 설정
- [ ] 검증자 교육 완료
- [ ] 광주 지역 검증 완료
- [ ] 의무기관매칭 API 수정 (TNMS resolveByName 사용)
- [ ] Feature flag 활성화 (광주만)
- [ ] 24시간 모니터링 및 결과 검토

### Phase 4
- [ ] QA 테스트 케이스 작성 및 실행
- [ ] 성능 메트릭 수집 (P50, P95, P99)
- [ ] 보안 검증 (SQL injection, XSS, CSRF 등)
- [ ] 감사 로그 정상 작동 확인
- [ ] 운영 문서 작성 완료
- [ ] 운영팀 교육 실시

### 최종 배포
- [ ] 다른 지역으로 확대 (순차적)
- [ ] 운영 모니터링 인수인계
- [ ] 사용자 피드백 수집
- [ ] 문서 최종 검토

---

## 참고 자료

### 관련 문서
- [의무기관매칭 개선 계획 (V3)](./OBLIGATION_MATCHING_IMPROVEMENT_PLAN.md)
- [Architecture Overview](../reference/architecture-overview.md)
- [Region Management Rules](../REGION_MANAGEMENT_RULES.md)

### 참고 링크
- [OpenAPI 3.0 Specification](https://spec.openapis.org/oas/v3.0.3)
- [Jaro-Winkler Algorithm](https://en.wikipedia.org/wiki/Jaro%E2%80%93Winkler_distance)
- [PostgreSQL JSONB](https://www.postgresql.org/docs/current/datatype-json.html)

---

**문서 작성**: Claude Code AI
**최종 업데이트**: 2025-11-13
**상태**: 승인 대기
**다음 단계**: 사용자 검토 및 Phase 1 시작

