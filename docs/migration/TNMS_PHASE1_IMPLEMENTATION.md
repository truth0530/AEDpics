# TNMS Phase 1 구현 완료 보고서

**작성일**: 2025-11-15
**상태**: 완료
**마일스톤**: Phase 3C - TNMS 서비스 로직 연동 검증

---

## 개요

TNMS(Trusted Name Matching Service) Phase 1 구현이 완료되었습니다. 기관명 정규화 및 다중 신호 기반 신뢰도 점수 계산 시스템이 데이터베이스 및 서비스 레이어에 완전히 통합되었습니다.

## 구현 완료 항목

### 1. 데이터베이스 스키마 (completed)

**위치**: [prisma/schema.prisma](../../prisma/schema.prisma) (lines 1106-1250)

#### 테이블 목록

| 테이블 | 목적 | 상태 |
|--------|------|------|
| `administrative_regions` | 17개 시도 및 계층 구조 관리 | ✅ 18개 데이터 삽입 완료 |
| `institution_registry` | 표준화된 기관 정보 저장소 | ✅ 스키마 준비 완료 (데이터 대기) |
| `institution_aliases` | 기관명 변형/별칭 관리 | ✅ 스키마 준비 완료 |
| `normalization_rules` | 정규화 규칙 저장소 (우선순위 기반) | ✅ 7개 규칙 삽입 완료 |
| `institution_validation_log` | 매칭 검증 로그 | ✅ 스키마 준비 완료 |
| `institution_audit_log` | 기관 데이터 변경 감사 로그 | ✅ 스키마 준비 완료 |
| `institution_metrics` | 일일 매칭 성공률 메트릭 | ✅ 스키마 준비 완료 |

#### 초기 데이터 상태

```
Administrative Regions: 18개 (중앙 1개 + 시도 17개)
├─ Level 0: KR (대한민국)
└─ Level 1: SEO, BUS, DAE, INC, GWA, DAJ, ULS, SEJ, GYE, GAN, CHB, CHN, JEB, JEN, GYB, GYN, JEJ

Normalization Rules: 7개 (우선순위 110 ~ 50)
├─ 병렬_처리_규칙 (priority: 110)
├─ 공통_접사_제거 (priority: 100)
├─ 시도_약칭_정규화 (priority: 90)
├─ 띄어쓰기_정규화 (priority: 80)
├─ 특수문자_제거 (priority: 70)
├─ 한글_숫자_정규화 (priority: 60)
└─ 주소_표준화 (priority: 50)
```

### 2. 서비스 레이어 (completed)

**위치**: [lib/services/tnms/](../../lib/services/tnms/)

#### 모듈 구조

```
lib/services/tnms/
├── text-normalizer.ts       # 기관명 텍스트 정규화
├── address-normalizer.ts    # 주소 정규화 및 해싱 (DB 기반)
├── score-engine.ts          # 다중 신호 신뢰도 점수 계산
├── tnms-service.ts          # 통합 서비스 인터페이스
└── index.ts                 # 모듈 내보내기
```

#### 각 모듈의 역할

##### text-normalizer.ts
- **기능**: 기관명 정규화 (DB의 normalization_rules 기반)
- **규칙 출처**: DB 쿼리 (캐싱)
- **신호**: normalization_signals 배열 반환
- **주요 메서드**:
  - `normalize(text)` - 텍스트 정규화
  - `clearCache()` - 캐시 초기화

**적용 규칙**:
1. 공통 접사 제거 (센터, 보건소, 협회 등)
2. 지역명 약칭 정규화 (administrative_regions 테이블 참조)
3. 공백 정규화 (연속된 공백 → 단일 공백)
4. 특수문자 제거 (보안 마침표, 하이픈, 괄호 제외)
5. 한글 숫자 정규화 (한글 → 아라비아 숫자)
6. 주소 표준화 (AddressNormalizer에 위임)

##### address-normalizer.ts
- **기능**: 주소 정규화 및 SHA-256 해시 생성
- **정책 준수**: DB의 administrative_regions에서 동적으로 지역명 매핑 로드 (하드코딩 금지)
- **캐싱**: 1시간 TTL
- **주요 메서드**:
  - `normalize(road_address, lot_address, region_code)` - 주소 정규화
  - `calculateSimilarity(address1, address2)` - 주소 유사도 (Levenshtein)
  - `clearCache()` - 캐시 초기화

**기능**:
- 도로명 주소 정규화 (e.g., "서울 강서구" → "서울특별시 강서구")
- 지번 주소 정규화 (e.g., "123번지" → "123")
- SHA-256 기반 중복 검증용 해시값 생성
- Levenshtein 거리 기반 주소 유사도 계산

##### score-engine.ts
- **기능**: Phase 1 신뢰도 점수 계산 (4가지 신호)
- **신호**:
  1. `text_match` (weight: 0.4) - 정확 문자열 일치도
  2. `name_similarity` (weight: 0.25) - Levenshtein 기반 유사도
  3. `address_match` (weight: 0.2) - 주소 해시 일치
  4. `region_code_match` (weight: 0.15) - 지역 코드 일치

- **점수 계산 공식**: `Σ(signal_value × weight) / Σ(weight) × 100`

- **권고사항** (Recommendation):
  - `auto_match` (점수 95점 이상, 3개 신호 일치) - 자동 매칭 진행
  - `manual_review` (점수 70-94점) - 수동 검토 필요
  - `reject` (점수 70점 미만) - 매칭 거부

##### tnms-service.ts
- **기능**: 통합 TNMS 서비스 (모든 모듈 조합)
- **주요 메서드**:
  - `normalizeAndMatch()` - 기관명 정규화 및 신뢰도 점수 계산
  - `searchAndRecommend()` - 기관 검색 및 자동 추천
  - `addAlias()` - 기관 별칭 추가
  - `recordMetrics()` - 일일 메트릭 기록
  - `logValidation()` - 검증 로그 기록

- **검증 로그**: institution_validation_log 테이블에 자동 기록
  - 정규화 신호
  - 매칭 신호
  - 주소 해시
  - 권고사항

### 3. 정책 준수

#### 지역명 관리 철칙 (CLAUDE.md Rule 8)

**준수 상황**:
- ❌ `address-normalizer.ts`의 지역명 매핑은 하드코딩 금지
- ✅ DB의 `administrative_regions` 테이블에서 동적으로 로드
- ✅ `short_name` → `korean_name` 매핑 생성 (캐싱)
- ✅ 캐시 만료 시 자동 갱신 (1시간 TTL)

**코드 예시**:
```typescript
// 정책 위반: ❌
const regionMappings = {
  '서울': '서울특별시',  // 하드코딩
  '부산': '부산광역시',
};

// 정책 준수: ✅
const regions = await prisma.administrative_regions.findMany({
  where: { is_active: true },
  select: { korean_name: true, short_name: true },
});
```

#### 단일 진실 소스 원칙 (CLAUDE.md Rule 1)

**적용**:
- 정규화 규칙 출처: `normalization_rules` 테이블 (단일 소스)
- 지역명 매핑 출처: `administrative_regions` 테이블 (단일 소스)
- 기관 표준 정보 출처: `institution_registry` 테이블 (단일 소스)

### 4. 타입 검증

```bash
npm run tsc
✅ 모든 타입 검사 통과 (0 errors)
```

### 5. 빌드 검증

```bash
npm run build
✅ Next.js 프로덕션 빌드 성공
├─ 118개 페이지 프리렌더링
├─ 미들웨어 컴파일
└─ 정적/동적 라우트 최적화 완료
```

## 데이터 흐름

```
기관명 입력
    ↓
[TextNormalizer]
- normalization_rules 조회 (DB)
- 규칙 적용 (우선순위 순)
- 정규화된 기관명 + 신호 반환
    ↓
[AddressNormalizer]
- administrative_regions 조회 (DB)
- 지역명 매핑 적용
- 주소 해시 생성 (SHA-256)
    ↓
[ScoreEngine]
- 4가지 신호 계산
  1. 정확 문자열 일치
  2. 문자 유사도 (Levenshtein)
  3. 주소 해시 일치
  4. 지역 코드 일치
- 최종 점수 계산
- 권고사항 결정
    ↓
[TnmsService]
- institution_registry에서 후보 검색
- 각 후보별 점수 계산
- 검증 로그 기록
- 메트릭 업데이트
    ↓
결과 반환
```

## 다음 단계

### Phase 2: 데이터 초기화 (예정)

1. **Institution Registry 백필**
   - e-gen 81,331개 AED 장비 데이터 변환
   - 표준 기관 코드 생성 (standard_code)
   - 정규화된 기관명 생성 (canonical_name)

2. **Institution Aliases 백필**
   - 각 AED의 보건소명을 별칭으로 저장
   - 정규화 완료 플래그 설정
   - 주소 매칭 여부 기록

### Phase 3: API 통합 (예정)

1. **자동 추천 API** (`/api/tnms/recommend`)
   - 기관명 입력 시 상위 5개 추천

2. **검증 결과 조회 API** (`/api/tnms/validation/{id}`)
   - 검증 로그 및 신호 상세 조회

3. **메트릭 대시보드** (`/dashboard/tnms-metrics`)
   - 일일 매칭 성공률
   - 신호별 기여도 분석

## 모니터링 및 메트릭

### 수집 지표

| 지표 | 계산식 | 용도 |
|------|--------|------|
| `match_success_rate` | (성공 매칭 / 전체 매칭) × 100 | Phase 1 신뢰도 검증 |
| `auto_recommend_success_rate` | (자동 추천 수용 / 전체 추천) × 100 | Phase 1 자동화율 |
| `search_hit_rate` | (검색 결과 있음 / 전체 검색) × 100 | Phase 1 커버리지 |
| `address_match_rate` | (주소 일치 / 전체 대상) × 100 | Phase 1 정확도 |

### 로깅

모든 매칭 시도는 `institution_validation_log` 테이블에 기록됨:
- 입력 기관명
- 정규화 신호
- 매칭 신호
- 최종 점수
- 권고사항

## 문제 해결

### 지역명 캐시 갱신

캐시된 지역명 매핑을 강제로 갱신하려면:

```typescript
import { addressNormalizer } from '@/lib/services/tnms';

addressNormalizer.clearCache();
```

### 규칙 캐시 갱신

정규화 규칙을 강제로 갱신하려면:

```typescript
import { textNormalizer } from '@/lib/services/tnms';

textNormalizer.clearCache();
```

## 테스트 스크립트

TNMS 서비스 검증:

```bash
npx ts-node scripts/test/tnms-service-test.ts
```

## 관련 문서

- [Prisma 스키마](../../prisma/schema.prisma) - TNMS 모델 정의
- [텍스트 정규화](../../lib/services/tnms/text-normalizer.ts) - 규칙 기반 정규화
- [주소 정규화](../../lib/services/tnms/address-normalizer.ts) - DB 기반 지역명 매핑
- [점수 엔진](../../lib/services/tnms/score-engine.ts) - 신뢰도 계산 로직
- [통합 서비스](../../lib/services/tnms/tnms-service.ts) - 통합 인터페이스

## 체크리스트

- [x] Prisma 스키마 정의
- [x] Administrative_regions 백필 (18개)
- [x] Normalization_rules 백필 (7개)
- [x] TextNormalizer 구현
- [x] AddressNormalizer 구현 (DB 기반 지역명)
- [x] ScoreEngine 구현
- [x] TnmsService 구현
- [x] 타입 검사 통과
- [x] 빌드 검증 통과
- [ ] institution_registry 백필 (예정)
- [ ] institution_aliases 백필 (예정)
- [ ] API 통합 (예정)
- [ ] 대시보드 구현 (예정)

---

**상태**: 완료 ✅
**다음 마일스톤**: Phase 2 - 데이터 초기화
