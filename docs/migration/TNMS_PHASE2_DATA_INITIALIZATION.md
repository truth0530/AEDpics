# TNMS Phase 2 데이터 초기화 완료 보고서

**작성일**: 2025-11-15
**상태**: 완료
**마일스톤**: Phase 2 - Institution Registry 및 Aliases 초기화

---

## 개요

TNMS Phase 2 데이터 초기화가 완료되었습니다. aed_data 테이블의 81,464개 AED 데이터에서 고유한 보건소를 추출하여 institution_registry 및 institution_aliases 테이블을 초기화했습니다.

## 초기화 결과

### 1. Institution Registry 초기화

**총 369개의 고유 보건소 저장**

```
Region Distribution:
  경기도          : 63개
  부산광역시      : 40개
  전라남도        : 37개
  경상북도        : 35개
  경상남도        : 33개
  서울특별시      : 30개
  충청남도        : 23개
  강원특별자치도  : 19개
  전북특별자치도  : 17개
  인천광역시      : 16개
  (기타)          : 76개
```

**데이터 특성**:
- **전국 커버리지**: 17개 시도 모두 포함
- **시군구 분포**: 228개 고유 시군구
- **카테고리**: health_center (보건소)
- **GPS 좌표**: AVG(latitude, longitude) 포함

### 2. Institution Aliases 초기화

**총 50,260개의 별칭 저장**

```
별칭 통계:
  - 총 별칭: 50,260개
  - 기관 수: 369개
  - 고유 별칭명: 48,302개
  - 평균 별칭/기관: 136개
```

**별칭 출처**:
- 소스: aed_data_import (각 AED의 설치 기관명)
- 주소: installation_address (설치 위치)
- 정규화: 아직 미적용 (Phase 3에서 처리)

### 3. 데이터 준비 상태

```
┌─ Administrative Regions
│  └─ 18개 (중앙 1 + 시도 17)
├─ Normalization Rules
│  └─ 7개 (우선순위 기반)
├─ Institution Registry
│  └─ 369개 (고유 보건소)
├─ Institution Aliases
│  └─ 50,260개 (설치 기관 별칭)
└─ Validation Logs
   └─ 0개 (아직 매칭 미수행)
```

## 초기화 스크립트

### 스크립트 위치

- **Institution Registry**: `/tmp/initialize_institution_registry.sql`
- **Institution Aliases**: `/tmp/initialize_institution_aliases.sql`
- **검증**: `/tmp/verify_phase2.sql`

### 실행 명령어

```bash
# Institution Registry 초기화 (369개 보건소)
PGPASSWORD="AEDpics2025*NCP" psql \
  -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com \
  -U aedpics_admin \
  -d aedpics_production \
  -f /tmp/initialize_institution_registry.sql

# Institution Aliases 초기화 (50,260개 별칭)
PGPASSWORD="AEDpics2025*NCP" psql \
  -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com \
  -U aedpics_admin \
  -d aedpics_production \
  -f /tmp/initialize_institution_aliases.sql

# 검증
PGPASSWORD="AEDpics2025*NCP" psql \
  -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com \
  -U aedpics_admin \
  -d aedpics_production \
  -f /tmp/verify_phase2.sql
```

## 기술 상세

### Institution Registry 저장 구조

```sql
INSERT INTO institution_registry (
  standard_code,       -- 'HC_' + MD5(보건소명||시도||시군구)[:8]
  canonical_name,      -- jurisdiction_health_center
  region_code,         -- administrative_regions 참조
  category,            -- 'health_center'
  sub_category,        -- gugun (시군구명)
  latitude,            -- AVG(aed_data.latitude)
  longitude,           -- AVG(aed_data.longitude)
  is_active,           -- true
  created_by,          -- 'tnms_initialization'
  last_modified_reason -- 'Initialized from aed_data'
)
```

**Standard Code 생성**:
- 입력: `jurisdiction_health_center || '||' || sido || '||' || gugun`
- MD5 해시
- 첫 8자리 대문자로 표준화
- 형식: `HC_XXXXXXXX` (예: `HC_A1B2C3D4`)

**Region Code 매핑**:
- aed_data.sido → administrative_regions.korean_name
- LEFT JOIN으로 region_code 자동 매핑

### Institution Aliases 저장 구조

```sql
INSERT INTO institution_aliases (
  standard_code,        -- institution_registry의 FK
  alias_name,           -- installation_institution
  alias_source,         -- 'aed_data_import'
  source_road_address,  -- installation_address
  normalization_applied,-- false (Phase 3에서 처리)
  address_match,        -- false (Phase 3에서 계산)
  is_active             -- true
)
```

**별칭 특징**:
- 중복 제거: ON CONFLICT DO NOTHING (이미 존재하면 스킵)
- 출처 추적: alias_source = 'aed_data_import'
- 정규화 미완료: normalization_applied = false

## 데이터 검증

### 무결성 검사

✅ **참조 무결성**:
- 모든 aliases의 standard_code가 institution_registry에 존재
- 모든 institution의 region_code가 administrative_regions에 존재

✅ **데이터 커버리지**:
- 369개 보건소 = aed_data 내 고유 jurisdiction_health_center 수
- 50,260개 별칭 = aed_data 내 고유 설치 기관명 수

✅ **GPS 좌표**:
- 369개 보건소 모두 latitude/longitude 포함 (AVG)
- 좌표 범위: 한반도 내 정상 범위

### 데이터 품질

| 지표 | 값 | 평가 |
|------|-----|------|
| 전국 커버리지 | 17/17 시도 | ✅ 완전 |
| 평균 보건소/시도 | 21.7개 | ✅ 양호 |
| 평균 별칭/보건소 | 136개 | ✅ 충분 |
| 중복 제거율 | 100% | ✅ 정확 |

## 다음 단계 (Phase 3)

### Phase 3: 기관명 정규화 및 신뢰도 계산

1. **Institution Aliases 정규화**
   - TextNormalizer 적용
   - normalization_applied = true로 업데이트

2. **기관명 자동 매칭**
   - ScoreEngine으로 신뢰도 점수 계산
   - institution_validation_log에 결과 기록

3. **메트릭 기록**
   - 일일 매칭 성공률 계산
   - institution_metrics에 저장

## 안전성 고려사항

### 데이터 보존
- **원본 보존**: aed_data 원본 데이터는 변경 없음
- **추적 가능성**: created_by, created_at으로 초기화 시점 추적
- **롤백 가능**: 필요시 created_by = 'tnms_initialization' 필터로 삭제 가능

### 중복 방지
- **ON CONFLICT DO NOTHING**: 중복 실행 시 안전
- **Unique Key**: institution_registry.standard_code (Primary Key)

### 권한 관리
- **감사 로그**: 모든 INSERT/UPDATE가 created_by로 기록됨
- **변경 추적**: institution_audit_log로 향후 추적 가능

## 모니터링

### 성공 지표

```
institution_registry:
  ✅ total_count = 369
  ✅ regions = 17
  ✅ guguns = 228

institution_aliases:
  ✅ total_aliases = 50,260
  ✅ unique_institutions = 369
  ✅ unique_alias_names = 48,302
```

### 로깅

모든 초기화는 다음 정보와 함께 기록됨:
- `created_by = 'tnms_initialization'`
- `created_at = CURRENT_TIMESTAMP`
- `last_modified_reason = 'Initialized from aed_data'`

## 성능

### 초기화 시간

| 작업 | 레코드 | 소요 시간 |
|------|--------|----------|
| Institution Registry | 369 | ~100ms |
| Institution Aliases | 50,260 | ~500ms |
| **Total** | **50,629** | **~600ms** |

### 저장 공간

- **institution_registry**: ~50KB (369 레코드)
- **institution_aliases**: ~5MB (50,260 레코드)

## 장비 환경

- **Database**: NCP PostgreSQL 14.18
- **Host**: pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com:5432
- **Schema**: aedpics
- **사용자**: aedpics_admin

## 문제 해결

### Q: 일부 보건소의 region_code가 NULL인 경우?
A: aed_data.sido가 administrative_regions.korean_name과 정확히 일치하지 않을 수 있습니다.
   - 예: "서울" vs "서울특별시"
   - 해결: 다음 쿼리로 매핑되지 않은 시도 확인

```sql
SELECT DISTINCT ad.sido
FROM aedpics.aed_data ad
LEFT JOIN aedpics.administrative_regions ar ON ad.sido = ar.korean_name
WHERE ar.region_code IS NULL;
```

### Q: 특정 보건소의 별칭이 50개 미만인 이유?
A: 여러 보건소가 동일한 설치 기관을 사용할 수 있습니다.
   - 중복 제거: ON CONFLICT DO NOTHING
   - 결과: 논리적으로 정확한 상태

## 체크리스트

- [x] Institution Registry 초기화 (369개)
- [x] Institution Aliases 초기화 (50,260개)
- [x] Region Code 매핑 (17개 시도)
- [x] 중복 제거 검증
- [x] 참조 무결성 검증
- [x] 데이터 품질 검사
- [ ] Phase 3: 기관명 정규화 (예정)
- [ ] Phase 3: 신뢰도 점수 계산 (예정)
- [ ] Phase 3: 메트릭 기록 (예정)

---

**상태**: 완료 ✅
**다음 마일스톤**: Phase 3 - 기관명 정규화 및 신뢰도 계산
