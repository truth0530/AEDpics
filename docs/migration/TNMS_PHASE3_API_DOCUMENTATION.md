# TNMS Phase 3 API 문서

**작성일**: 2025-11-15
**상태**: 완료
**마일스톤**: Phase 3 - API 엔드포인트 구현

---

## 개요

TNMS Phase 3에서 3개의 REST API 엔드포인트를 구현했습니다.

- `/api/tnms/recommend` - 기관명 자동 추천
- `/api/tnms/validate` - 검증 결과 조회 및 수정
- `/api/tnms/metrics` - 성공률 및 통계 조회

---

## 1. 기관명 추천 API

### Endpoint
```
POST /api/tnms/recommend
GET /api/tnms/recommend?institution_name=...&region_code=...&limit=5
```

### 설명
입력된 기관명을 정규화하고, 가장 유사한 기관을 자동으로 추천합니다.

### 요청

**POST (권장)**:
```json
{
  "institution_name": "서울강서구보건소",
  "region_code": "SEO",
  "address": "서울시 강서구",
  "limit": 5
}
```

**GET**:
```
GET /api/tnms/recommend?institution_name=서울강서구보건소&region_code=SEO&limit=5
```

### 요청 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| institution_name | string | ✓ | 기관명 (필수) |
| region_code | string | - | 지역 코드 (예: SEO, BUS) |
| address | string | - | 주소 (정규화 보조용) |
| limit | number | - | 추천 개수 (1-20, 기본값: 5) |

### 응답 (성공)

```json
{
  "success": true,
  "data": {
    "input": {
      "institution_name": "서울강서구보건소",
      "region_code": "SEO",
      "address": null
    },
    "normalization": {
      "original": "서울강서구보건소",
      "normalized": "서울특별시 강서구 보건소",
      "signals": [
        {
          "rule_id": 1,
          "rule_name": "공통_접사_제거",
          "applied": true
        }
      ]
    },
    "recommendations": [
      {
        "standard_code": "HC_A1B2C3D4",
        "canonical_name": "서울특별시 강서구 보건소",
        "confidence_score": 95,
        "recommendation": "auto_match",
        "signals": [
          {
            "name": "text_match",
            "value": 100,
            "weight": 0.4,
            "contribution": 40.0
          },
          {
            "name": "name_similarity",
            "value": 92,
            "weight": 0.25,
            "contribution": 23.0
          },
          {
            "name": "address_match",
            "value": 100,
            "weight": 0.2,
            "contribution": 20.0
          },
          {
            "name": "region_code_match",
            "value": 100,
            "weight": 0.15,
            "contribution": 15.0
          }
        ]
      }
    ],
    "best_match": {
      "standard_code": "HC_A1B2C3D4",
      "canonical_name": "서울특별시 강서구 보건소",
      "confidence_score": 95,
      "recommendation": "auto_match"
    }
  },
  "timestamp": "2025-11-15T15:30:00.000Z"
}
```

### 응답 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| success | boolean | 요청 성공 여부 |
| data.input | object | 입력 정보 |
| data.normalization | object | 정규화 결과 |
| data.recommendations | array | 추천 기관 목록 (최대 limit개) |
| data.best_match | object | 최고 신뢰도 기관 |
| timestamp | string | 응답 시간 (ISO 8601) |

### 신뢰도 점수 기준

| 점수 | 권고 | 설명 |
|------|------|------|
| 95+ | auto_match | 자동 매칭 가능 |
| 70-94 | manual_review | 수동 검토 필요 |
| <70 | reject | 매칭 거부 |

### 오류 응답

```json
{
  "error": "institution_name is required and must be a string",
  "status": 400
}
```

**상태 코드**:
- `400` - 입력 검증 실패
- `500` - 서버 오류

---

## 2. 검증 결과 조회 API

### Endpoint
```
GET /api/tnms/validate?validation_run_id=...
POST /api/tnms/validate (로그 수정)
```

### 설명
과거 매칭 검증 결과를 조회하고, 수동 검토 상태를 업데이트합니다.

### 요청 (GET)

```
GET /api/tnms/validate?validation_run_id=UUID&limit=20&offset=0
GET /api/tnms/validate?source_name=서울&matched_standard_code=HC_A1B2C3D4
```

### 쿼리 파라미터

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| validation_run_id | string | 검증 실행 ID (UUID) |
| source_name | string | 원본 기관명 (포함 검색) |
| matched_standard_code | string | 매칭된 표준 코드 |
| limit | number | 페이지 크기 (1-100, 기본: 20) |
| offset | number | 페이지 오프셋 (기본: 0) |

**최소 1개 필터 필수**

### 응답 (성공)

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "log_id": "12345",
        "validation_run_id": "uuid-123",
        "run_type": "auto_match",
        "source_table": "api_recommend",
        "source_name": "서울강서구보건소",
        "matched_standard_code": "HC_A1B2C3D4",
        "match_confidence": 95,
        "is_successful": true,
        "error_reason": null,
        "manual_review_status": null,
        "manual_review_notes": null,
        "debug_signals": {
          "normalization_signals": [...],
          "match_signals": [...]
        },
        "created_at": "2025-11-15T15:30:00.000Z"
      }
    ],
    "pagination": {
      "total": 50,
      "limit": 20,
      "offset": 0,
      "has_more": true
    }
  },
  "timestamp": "2025-11-15T15:30:00.000Z"
}
```

### 요청 (POST - 수동 검토)

```json
{
  "log_id": "12345",
  "manual_review_status": "approved",
  "manual_review_notes": "확인됨",
  "reviewed_by": "admin@nmc.or.kr"
}
```

### POST 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| log_id | string | ✓ | 검증 로그 ID |
| manual_review_status | string | ✓ | approved/rejected/pending |
| manual_review_notes | string | - | 검토 메모 |
| reviewed_by | string | - | 검토자 이메일 |

### POST 응답

```json
{
  "success": true,
  "data": {
    "log_id": "12345",
    "manual_review_status": "approved",
    "manual_review_notes": "확인됨",
    "reviewed_by": "admin@nmc.or.kr"
  },
  "timestamp": "2025-11-15T15:30:00.000Z"
}
```

---

## 3. 메트릭 조회 API

### Endpoint
```
GET /api/tnms/metrics?start_date=2025-11-01&end_date=2025-11-15
POST /api/tnms/metrics (메트릭 기록)
```

### 설명
일일 매칭 성공률, 신호 기여도, 기관 커버리지 등 메트릭을 조회합니다.

### 요청 (GET)

```
GET /api/tnms/metrics
GET /api/tnms/metrics?start_date=2025-11-01&end_date=2025-11-15&metric_type=all
```

### 쿼리 파라미터

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| start_date | string | 30일 전 | 시작 날짜 (YYYY-MM-DD) |
| end_date | string | 오늘 | 종료 날짜 (YYYY-MM-DD) |
| metric_type | string | all | all/summary/signals |

### 응답 (성공)

```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2025-11-01",
      "end": "2025-11-15",
      "days": 14
    },
    "summary": {
      "total_validations": 1000,
      "success_count": 950,
      "failure_count": 50,
      "success_rate": "95.00%"
    },
    "daily_metrics": [
      {
        "metric_date": "2025-11-15",
        "total_institutions": 369,
        "total_aliases": 50260,
        "matched_count": 48000,
        "unmatched_count": 2260,
        "match_success_rate": "94.55",
        "auto_recommend_success_rate": "92.30",
        "search_hit_rate": "98.50",
        "address_match_rate": "89.20",
        "validation_run_count": 500
      }
    ],
    "signal_analysis": {
      "text_match": {
        "count": 800,
        "avg_contribution": "38.50",
        "max_value": 100
      },
      "name_similarity": {
        "count": 700,
        "avg_contribution": "22.80",
        "max_value": 98
      },
      "address_match": {
        "count": 750,
        "avg_contribution": "19.20",
        "max_value": 100
      },
      "region_code_match": {
        "count": 850,
        "avg_contribution": "14.50",
        "max_value": 100
      }
    },
    "institution_coverage": [
      {
        "region_code": "SEO",
        "institution_count": 30
      },
      {
        "region_code": "BUS",
        "institution_count": 40
      }
    ]
  },
  "timestamp": "2025-11-15T15:30:00.000Z"
}
```

### 요청 (POST - 메트릭 기록)

```json
{
  "metric_date": "2025-11-15"
}
```

### POST 응답

```json
{
  "success": true,
  "message": "Metrics recorded for 2025-11-15",
  "timestamp": "2025-11-15T15:30:00.000Z"
}
```

---

## 사용 예시

### 예시 1: 보건소명으로 기관 추천

```bash
curl -X POST https://aed.pics/api/tnms/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "institution_name": "서울강서구보건소",
    "region_code": "SEO"
  }'
```

**응답**: 신뢰도 95%로 매칭된 기관 정보

### 예시 2: 검증 로그 조회

```bash
curl https://aed.pics/api/tnms/validate?source_name=서울&limit=10
```

**응답**: "서울"을 포함한 기관의 검증 이력 10건

### 예시 3: 매칭 성공률 조회

```bash
curl https://aed.pics/api/tnms/metrics?metric_type=summary
```

**응답**: 전체 매칭 성공률 및 신호 기여도 통계

---

## 에러 처리

### 공통 에러 응답

```json
{
  "success": false,
  "error": "Failed to process request",
  "details": "Detailed error message",
  "timestamp": "2025-11-15T15:30:00.000Z"
}
```

### 상태 코드

| 코드 | 의미 | 해결방법 |
|------|------|---------|
| 200 | OK | 정상 응답 |
| 201 | Created | 리소스 생성됨 |
| 400 | Bad Request | 입력값 검증 |
| 500 | Server Error | 로그 확인 |

---

## Rate Limiting (향후)

현재 rate limiting 없음. 추후 구현 예정:
- 기관당 100 req/min
- IP당 1000 req/min

---

## 인증 (향후)

현재 인증 없음. NextAuth.js 통합 예정:
- Bearer token 기반
- 역할별 권한 (admin, user)

---

## 체크리스트

- [x] `/api/tnms/recommend` 구현
- [x] `/api/tnms/validate` 구현 (조회/수정)
- [x] `/api/tnms/metrics` 구현
- [x] TypeScript 타입 검사 통과
- [ ] 통합 테스트
- [ ] API 문서 (OpenAPI/Swagger)
- [ ] 성능 테스트
- [ ] 인증 추가
- [ ] Rate limiting 추가

---

## 다음 단계

1. **통합 테스트**: 실제 데이터로 API 검증
2. **API 문서**: Swagger/OpenAPI 생성
3. **클라이언트**: 대시보드에 API 연동
4. **모니터링**: 성공률 및 응답 시간 모니터링

---

**상태**: 완료 ✅
**다음 마일스톤**: Phase 4 - 통합 테스트 및 모니터링
