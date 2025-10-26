# 2025년 매핑 시스템 전환 전략

**작성일**: 2025-10-10
**상태**: 📋 계획 단계
**관련 문서**: [MAPPING_SYSTEM.md](./MAPPING_SYSTEM.md)

---

## 📋 목차

1. [배경 및 목적](#배경-및-목적)
2. [2024년 현황](#2024년-현황)
3. [2025년 전환 시나리오](#2025년-전환-시나리오)
4. [일일 갱신 전략](#일일-갱신-전략)
5. [점검 시스템 통합](#점검-시스템-통합)
6. [구현 우선순위](#구현-우선순위)

---

## 배경 및 목적

### 핵심 요구사항

**변경되는 데이터**:
1. **target_list_2024** → **target_list_2025** (연 1회 변경)
   - 2024년: 26,724개 의무시설
   - 2025년: 미정 (Q2 예상)

2. **aed_data** (매일 갱신 예정)
   - Python 스크립트: 매일 새벽 3시
   - UPSERT 방식: `equipment_serial` 기준
   - 현재: 80,863대

**매칭 갱신 규칙**:
- 2024년 → 2025년 전환 시: 전체 재매칭 (1회성)
- 2025년 운영 중: 미확정 관리번호만 매일 재확인
- 이유: 2025년 의무시설인데 AED 미설치 시 매일 모니터링 필요

---

## 2024년 현황

### ✅ 완료된 작업

```
management_number_group_mapping: 50,010개
├─ target_key_2024: 26,724개 의무시설 매칭
├─ auto_suggested_2024: 자동 제안 매칭
├─ auto_confidence_2024: 평균 69.81점
├─ confirmed_2024: 확정 매칭 (보건소 담당자 확인)
└─ 커버리지: 80,863대 AED (100%)

target_list_2024: 26,724개
└─ 2024년 구비의무기관 목록
```

### 🔄 현재 운영 방식

```
1. aed_data는 정적 (매일 갱신 안됨)
2. management_number_group_mapping 고정
3. 재매칭 불필요 (2024년 목록 확정)
```

---

## 2025년 전환 시나리오

### Phase 1: target_list_2025 준비 (2025 Q2)

```sql
-- Step 1: 2025년 의무시설 테이블 생성
CREATE TABLE target_list_2025 (
  target_key VARCHAR(255) PRIMARY KEY,
  sido VARCHAR(50),
  gugun VARCHAR(50),
  institution_name VARCHAR(255),
  division VARCHAR(100),
  sub_division VARCHAR(100),
  target_keygroup VARCHAR(255),
  ...
);

-- Step 2: 데이터 업로드
INSERT INTO target_list_2025 ...;
-- 예상: 28,000개 (2024년 26,724개 대비 증가 가능)
```

### Phase 2: 전체 재매칭 (1회성 작업)

```sql
-- Step 1: 2025년 매칭 함수 생성 (46번 migration 복제)
CREATE OR REPLACE FUNCTION auto_match_management_numbers_batch_2025(
  p_limit INTEGER DEFAULT 500,
  p_min_confidence NUMERIC DEFAULT 60.0
)
RETURNS INTEGER AS $$
-- 로직: target_list_2025 기준으로 매칭
-- 결과: target_key_2025, auto_suggested_2025 컬럼 채움
$$ LANGUAGE plpgsql;

-- Step 2: 기존 50,010개 관리번호 재매칭
-- 타임아웃 방지: 500개씩 100회 실행
DO $$
DECLARE
  v_total INTEGER := 0;
  v_batch INTEGER;
BEGIN
  FOR i IN 1..100 LOOP
    SELECT auto_match_management_numbers_batch_2025(500, 60.0) INTO v_batch;
    v_total := v_total + v_batch;

    RAISE NOTICE 'Batch %: % mappings created (Total: %)', i, v_batch, v_total;

    -- 타임아웃 방지
    PERFORM pg_sleep(2);

    -- 더 이상 매칭 안되면 종료
    EXIT WHEN v_batch = 0;
  END LOOP;
END $$;
```

### Phase 3: 신규 관리번호 추가

```sql
-- aed_data 증가 시 신규 관리번호 발견
-- 예: 80,863대 → 85,000대 증가 시

INSERT INTO management_number_group_mapping (management_number)
SELECT DISTINCT management_number
FROM aed_data
WHERE management_number NOT IN (
  SELECT management_number FROM management_number_group_mapping
)
AND management_number IS NOT NULL;

-- 신규 관리번호 자동 매칭
SELECT auto_match_management_numbers_batch_2025(5000, 60.0);
```

---

## 일일 갱신 전략

### 시나리오: 2025년 운영 중

```
매일 새벽 3시: Python 스크립트 실행
  └─ aed_data UPSERT (equipment_serial 기준)
  └─ 80,863대 → 80,950대 (87대 증가 예시)

매일 새벽 4시: 자동 매칭 스크립트
  ├─ 신규 관리번호 발견 및 추가
  └─ 미확정 관리번호만 재매칭
```

### 구현: Cron Job + PostgreSQL Function

#### 1. 미확정 재매칭 함수

```sql
CREATE OR REPLACE FUNCTION auto_match_unconfirmed_2025()
RETURNS INTEGER AS $$
DECLARE
  v_matched_count INTEGER := 0;
  v_mgmt_number RECORD;
  v_best_match RECORD;
BEGIN
  -- 미확정 관리번호만 처리
  FOR v_mgmt_number IN
    SELECT management_number
    FROM management_number_group_mapping
    WHERE confirmed_2025 = FALSE
       OR confirmed_2025 IS NULL
    LIMIT 1000  -- 타임아웃 방지
  LOOP
    -- 최고 점수 매칭 재시도
    SELECT * INTO v_best_match
    FROM auto_match_single_management_number_2025(v_mgmt_number.management_number)
    ORDER BY total_score DESC
    LIMIT 1;

    -- 신뢰도 60% 이상이면 업데이트
    IF v_best_match.total_score >= 60.0 THEN
      UPDATE management_number_group_mapping
      SET
        auto_suggested_2025 = v_best_match.target_key,
        auto_confidence_2025 = v_best_match.total_score,
        auto_matching_reason_2025 = v_best_match.matching_reason,
        updated_at = NOW()
      WHERE management_number = v_mgmt_number.management_number;

      v_matched_count := v_matched_count + 1;
    END IF;
  END LOOP;

  RETURN v_matched_count;
END;
$$ LANGUAGE plpgsql;
```

#### 2. 신규 관리번호 자동 추가 함수

```sql
CREATE OR REPLACE FUNCTION add_new_management_numbers()
RETURNS INTEGER AS $$
DECLARE
  v_inserted_count INTEGER;
BEGIN
  -- 신규 관리번호 발견 및 추가
  INSERT INTO management_number_group_mapping (management_number)
  SELECT DISTINCT management_number
  FROM aed_data
  WHERE management_number NOT IN (
    SELECT management_number FROM management_number_group_mapping
  )
  AND management_number IS NOT NULL;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  -- 신규 관리번호 즉시 매칭
  IF v_inserted_count > 0 THEN
    PERFORM auto_match_management_numbers_batch_2025(v_inserted_count, 60.0);
  END IF;

  RETURN v_inserted_count;
END;
$$ LANGUAGE plpgsql;
```

#### 3. Cron Job 스케줄

```bash
# /etc/crontab 또는 cron 설정

# 매일 새벽 3시: Python 스크립트 (외부 프로젝트)
0 3 * * * cd /path/to/python/project && python3 aed_sync.py

# 매일 새벽 4시: 자동 매칭 (Python 실행 후)
0 4 * * * psql $DATABASE_URL -c "SELECT add_new_management_numbers();"
5 4 * * * psql $DATABASE_URL -c "SELECT auto_match_unconfirmed_2025();"
```

---

## 점검 시스템 통합

### 목적
점검 시 의무시설 여부를 자동으로 확인하고 inspections 테이블에 기록

### inspections 테이블 확장

```sql
-- Migration 60: inspection 테이블에 의무시설 필드 추가
ALTER TABLE inspections
ADD COLUMN target_key_2024 VARCHAR(255),
ADD COLUMN target_key_2025 VARCHAR(255),
ADD COLUMN is_mandatory_facility BOOLEAN DEFAULT FALSE,
ADD COLUMN matching_confidence NUMERIC(5,2),
ADD COLUMN matching_method VARCHAR(50);  -- 'auto', 'confirmed'

-- 인덱스
CREATE INDEX idx_inspections_mandatory
ON inspections(is_mandatory_facility)
WHERE is_mandatory_facility = TRUE;

-- 통계 쿼리용
CREATE INDEX idx_inspections_target_2025
ON inspections(target_key_2025)
WHERE target_key_2025 IS NOT NULL;
```

### API 수정: /api/inspections/quick/route.ts

```typescript
// 82행 이전에 추가: 의무시설 매칭 정보 조회
const { data: aedInfo } = await supabase
  .from('aed_data')
  .select('management_number')
  .eq('id', device.id)
  .single();

let matchingInfo = null;

if (aedInfo?.management_number) {
  const { data: mapping } = await supabase
    .from('management_number_group_mapping')
    .select(`
      target_key_2024,
      auto_suggested_2024,
      auto_confidence_2024,
      confirmed_2024,
      target_key_2025,
      auto_suggested_2025,
      auto_confidence_2025,
      confirmed_2025
    `)
    .eq('management_number', aedInfo.management_number)
    .maybeSingle();

  if (mapping) {
    // 현재 연도에 맞는 매칭 정보 선택
    const currentYear = new Date().getFullYear();
    const useYear = currentYear >= 2025 ? 2025 : 2024;

    const targetKey = useYear === 2025
      ? mapping.target_key_2025
      : mapping.target_key_2024;

    const autoSuggested = useYear === 2025
      ? mapping.auto_suggested_2025
      : mapping.auto_suggested_2024;

    matchingInfo = {
      target_key_2024: mapping.target_key_2024,
      target_key_2025: mapping.target_key_2025,
      is_mandatory: !!(targetKey || autoSuggested),
      confidence: useYear === 2025
        ? mapping.auto_confidence_2025
        : mapping.auto_confidence_2024,
      method: (useYear === 2025 ? mapping.confirmed_2025 : mapping.confirmed_2024)
        ? 'confirmed'
        : 'auto',
    };
  }
}

// 82-92행 수정: inspections INSERT에 의무시설 정보 추가
const { error: insertError, data } = await supabase
  .from('inspections')
  .insert({
    aed_data_id: device.id,
    equipment_serial: device.equipment_serial,
    inspector_id: user.id,
    inspection_type: 'special',
    overall_status: 'pending',

    // ✅ 추가: 의무시설 매칭 정보
    target_key_2024: matchingInfo?.target_key_2024,
    target_key_2025: matchingInfo?.target_key_2025,
    is_mandatory_facility: matchingInfo?.is_mandatory || false,
    matching_confidence: matchingInfo?.confidence,
    matching_method: matchingInfo?.method,
  })
  .select('id, inspection_date, overall_status')
  .single();
```

### UI 표시: 점검 화면

```typescript
// components/inspection/InspectionWorkflow.tsx

{matchingInfo?.is_mandatory && (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
    <div className="flex items-center gap-2 mb-2">
      <Badge variant="blue">구비의무기관</Badge>
      {matchingInfo.method === 'confirmed' ? (
        <Badge variant="green">확정 매칭</Badge>
      ) : (
        <Badge variant="yellow">
          자동 매칭 ({matchingInfo.confidence?.toFixed(1)}%)
        </Badge>
      )}
    </div>

    <p className="text-sm text-gray-700">
      이 AED는 {currentYear}년 구비의무기관에 설치된 장비입니다.
    </p>

    {matchingInfo.method !== 'confirmed' && matchingInfo.confidence < 80 && (
      <p className="text-sm text-orange-600 mt-2 flex items-center gap-1">
        <AlertCircle className="w-4 h-4" />
        매칭 신뢰도가 낮습니다. 관할 보건소에 확인이 필요합니다.
      </p>
    )}
  </div>
)}
```

---

## 구현 우선순위

### 🔴 High Priority (Q4 2024 - Q1 2025)

#### 1. Python 스크립트 스케줄링 검증 ⭐ 최우선
- **목적**: aed_data 일일 갱신 테스트
- **작업**:
  1. Python 스크립트 수동 실행 테스트
  2. management_number_group_mapping 영향 없음 확인
  3. Cron 스케줄 설정 (매일 3am)
- **예상 기간**: 1주
- **담당**: 인프라팀

#### 2. inspections 테이블 확장
- **목적**: 점검 시 의무시설 정보 기록
- **작업**:
  1. Migration 60 작성 및 실행
  2. /api/inspections/quick/route.ts 수정
  3. UI 컴포넌트 업데이트
  4. 테스트 (의무시설/일반시설 구분 표시)
- **예상 기간**: 2주
- **담당**: 백엔드 + 프론트엔드팀

#### 3. 모니터링 대시보드
- **목적**: 매칭 현황 실시간 모니터링
- **지표**:
  - 전체 관리번호 / 매칭 완료 / 미매칭
  - 신뢰도별 분포 (90%+, 70-89%, 60-69%, 60% 미만)
  - 확정/미확정 비율
  - 일일 신규 관리번호 추가 현황
- **예상 기간**: 1주
- **담당**: 프론트엔드팀

---

### 🟡 Medium Priority (Q2 2025)

#### 4. target_list_2025 준비
- **목적**: 2025년 의무시설 목록 업로드
- **작업**:
  1. Migration 58 작성 (target_list_2025 테이블)
  2. CSV 데이터 검증 및 업로드
  3. target_keygroup 생성
- **예상 기간**: 2주
- **담당**: 데이터팀 + 백엔드팀

#### 5. 2025년 매칭 함수 구현
- **목적**: 2025년 자동 매칭 지원
- **작업**:
  1. Migration 59 작성 (함수들 복제 및 수정)
  2. `auto_match_management_numbers_batch_2025()`
  3. `auto_match_single_management_number_2025()`
  4. `auto_match_unconfirmed_2025()`
  5. `add_new_management_numbers()`
  6. 테스트 (500개씩 배치 실행)
- **예상 기간**: 3주
- **담당**: 백엔드팀

#### 6. 전체 재매칭 실행 (2024 → 2025)
- **목적**: 50,010개 관리번호 2025년 재매칭
- **작업**:
  1. 배치 스크립트 작성 (500개씩 100회)
  2. 타임아웃 모니터링
  3. 매칭 결과 검증
  4. 저신뢰도(<60%) 수동 검토
- **예상 기간**: 1주 (실행) + 2주 (검토)
- **담당**: 백엔드팀 + 운영팀

---

### 🟢 Low Priority (Q3 2025)

#### 7. 일일 갱신 자동화
- **목적**: 미확정 관리번호 자동 재매칭
- **작업**:
  1. Cron Job 설정 (매일 4am, 4:05am)
  2. 로그 모니터링 시스템
  3. 실패 시 알림 (Slack/Email)
- **예상 기간**: 1주
- **담당**: DevOps팀

#### 8. 매칭 품질 개선
- **목적**: 저신뢰도 매칭 개선
- **작업**:
  1. 매칭 알고리즘 개선 (주소/기관명 가중치 조정)
  2. 기계학습 모델 학습 (선택)
  3. 수동 매칭 UI 개선
- **예상 기간**: 4주
- **담당**: 백엔드팀 + 데이터팀

---

## 타임라인

```
2024 Q4 (10-12월)
├─ Week 1-2: Python 스크립트 스케줄링 테스트 ✅
├─ Week 3-4: inspections 테이블 확장 및 UI 구현
└─ Week 5-6: 모니터링 대시보드

2025 Q1 (1-3월)
├─ 2024년 매칭 안정화 운영
└─ 2025년 준비 (target_list_2025 데이터 확보)

2025 Q2 (4-6월)
├─ Week 1-2: target_list_2025 업로드
├─ Week 3-5: 2025년 매칭 함수 구현
├─ Week 6-7: 전체 재매칭 실행 (50,010개)
└─ Week 8-9: 결과 검토 및 수동 보정

2025 Q3 (7-9월)
├─ 일일 갱신 자동화
└─ 매칭 품질 개선
```

---

## 체크리스트

### 2024 Q4
- [ ] Python 스크립트 수동 실행 테스트
- [ ] Cron 스케줄 설정 (3am)
- [ ] Migration 60 실행 (inspections 확장)
- [ ] /api/inspections/quick/route.ts 수정
- [ ] 점검 UI 의무시설 뱃지 표시
- [ ] 모니터링 대시보드 구현

### 2025 Q2
- [ ] target_list_2025 데이터 확보
- [ ] Migration 58 실행 (target_list_2025)
- [ ] Migration 59 실행 (2025 매칭 함수)
- [ ] 전체 재매칭 실행 (50,010개)
- [ ] 저신뢰도 수동 검토

### 2025 Q3
- [ ] Cron Job 설정 (4am 자동 매칭)
- [ ] 로그 모니터링 시스템
- [ ] 알림 시스템 (Slack/Email)

---

## 참고 문서

- [MAPPING_SYSTEM.md](./MAPPING_SYSTEM.md) - 매핑 시스템 전체 개요
- [INSPECTION_SYSTEM.md](./INSPECTION_SYSTEM.md) - 점검 시스템 구조
- [MIGRATION_GUIDE.md](../reference/MIGRATION_GUIDE.md) - 마이그레이션 가이드
- [docs/reports/2025-10-05-target-matching.md](../reports/2025-10-05-target-matching.md) - 2024년 매칭 완료 보고서

---

**작성**: AED Smart Check 개발팀
**최종 업데이트**: 2025-10-10
**다음 검토일**: 2025-01-01 (2025년 계획 최종 확정)
