# AED 데이터 Import 가이드

**작성일**: 2025-10-25
**버전**: 1.0.0

## 개요

e-gen 포털에서 다운로드한 AED 데이터를 NCP PostgreSQL로 import하는 가이드입니다.

- **스크립트**: `scripts/upload_to_ncp.py`
- **대상 DB**: NCP PostgreSQL (aedpics_production)
- **스키마**: aedpics
- **테이블**: aed_data

## 사전 준비

### 1. Python 패키지 설치

```bash
pip3 install psycopg2-binary beautifulsoup4 lxml pandas numpy
```

### 2. 데이터 파일 준비

#### e-gen 포털에서 다운로드
1. https://portal.nemc.or.kr:444 접속
2. AED 등록현황 다운로드 (17개 시도별)
3. 파일명 형식: `AED등록현황*.xls`
4. 실제 형식: HTML 테이블 (`.xls` 확장자이지만 HTML)

#### 파일 저장 위치 (권장)
```
/Users/kwangsunglee/Projects/AEDpics/data/e-gen/
├── AED등록현황_서울.xls
├── AED등록현황_경기.xls
├── AED등록현황_인천.xls
... (17개 시도)
```

## 스크립트 사용법

### 기본 사용법

```bash
# 단일 파일 업로드
python3 scripts/upload_to_ncp.py <파일경로>

# 디렉토리 전체 업로드 (디렉토리 내 모든 AED등록현황*.xls 파일)
python3 scripts/upload_to_ncp.py <디렉토리경로>
```

### 사용 예시

#### 1. 단일 CSV 파일 업로드 (테스트)
```bash
python3 scripts/upload_to_ncp.py scripts/test_data_sample.csv
```

**출력 예시**:
```
2025-10-25 18:25:25,282 - INFO - NCP PostgreSQL 연결 성공
============================================================
2025-10-25 18:25:25,282 - INFO - 파일 업로드 시작: test_data_sample.csv
============================================================
2025-10-25 18:25:25,286 - INFO - CSV 데이터 로드 완료: 3행 × 14열
2025-10-25 18:25:25,294 - INFO - 데이터 전처리 완료: 3행, 14개 컬럼
2025-10-25 18:25:25,295 - INFO - 총 3개 레코드를 500개씩 배치 처리
2025-10-25 18:25:25,334 - INFO - 배치 UPSERT 성공: 3개
============================================================
2025-10-25 18:25:25,334 - INFO - 업로드 완료
2025-10-25 18:25:25,334 - INFO - 총 레코드: 3
2025-10-25 18:25:25,334 - INFO - 신규 삽입: 1
2025-10-25 18:25:25,334 - INFO - 기존 수정: 2
============================================================
```

#### 2. e-gen .xls 파일 업로드
```bash
python3 scripts/upload_to_ncp.py data/e-gen/AED등록현황_서울.xls
```

#### 3. 디렉토리 전체 업로드 (17개 시도 모두)
```bash
python3 scripts/upload_to_ncp.py data/e-gen/
```

**출력 예시**:
```
############################################################
디렉토리 업로드: data/e-gen/
파일 수: 17
############################################################

============================================================
파일 업로드 시작: AED등록현황_서울.xls
============================================================
... (각 파일별 진행 상황)
============================================================

############################################################
전체 업로드 완료
처리 파일: 17
총 레코드: 81,331
신규 삽입: 40,000
기존 수정: 41,331
총 오류: 0
############################################################
```

## 데이터 처리 과정

### 1. 파일 로드
- `.csv`: pandas로 직접 읽기
- `.xls`: HTML 파싱 (BeautifulSoup) → DataFrame

### 2. 컬럼 매핑
e-gen CSV 컬럼 → Prisma 스키마 필드

| CSV 컬럼 | Prisma 필드 | 타입 |
|----------|-------------|------|
| 장비연번 | equipment_serial | String (Unique) |
| 시_도 | sido | String |
| 구_군 | gugun | String |
| 설치기관명 | installation_institution | String |
| 설치위치 | installation_position | String |
| 모델명 | model_name | String |
| 제조사 | manufacturer | String |
| 경도 | longitude | Decimal(11,8) |
| 위도 | latitude | Decimal(10,8) |
| 배터리_유효기간 | battery_expiry_date | Date |
| 패치_유효기간 | patch_expiry_date | Date |

전체 50개 컬럼 매핑 상세: [CSV_STRUCTURE_ANALYSIS.md](CSV_STRUCTURE_ANALYSIS.md)

### 3. 데이터 변환
- **날짜**: 다양한 형식 → `YYYY-MM-DD`
  - 지원: `YYYY-MM-DD`, `YYYY/MM/DD`, `YYYYMMDD`, `DD-MM-YYYY`
  - 특수값: "필요", "신규", "미정" → NULL
- **GPS 좌표**: String → Float
- **NULL 처리**: NaN, 'nan', '', 'None' → NULL

### 4. UPSERT 처리
```sql
INSERT INTO aedpics.aed_data (...)
VALUES (...)
ON CONFLICT (equipment_serial)
DO UPDATE SET
  sido = EXCLUDED.sido,
  gugun = EXCLUDED.gugun,
  ...
  updated_at = NOW()
```

- **신규**: equipment_serial이 없으면 INSERT
- **수정**: equipment_serial이 있으면 UPDATE
- **배치 크기**: 500개씩 처리
- **트랜잭션**: 배치 단위로 commit

## 데이터 검증

### 1. 레코드 수 확인
```bash
PGPASSWORD='AEDpics2025*NCP' psql \
  -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com \
  -U aedpics_admin \
  -d aedpics_production \
  -p 5432 \
  -c "SELECT COUNT(*) FROM aedpics.aed_data;"
```

**기대 결과**: 81,331개 (2025년 9월 통계)

### 2. 시도별 집계
```sql
SELECT
  sido,
  COUNT(*) as count,
  COUNT(DISTINCT equipment_serial) as unique_count
FROM aedpics.aed_data
GROUP BY sido
ORDER BY count DESC;
```

### 3. GPS 좌표 검증
```sql
SELECT
  COUNT(*) as total,
  COUNT(longitude) as with_longitude,
  COUNT(latitude) as with_latitude,
  COUNT(CASE WHEN longitude IS NOT NULL AND latitude IS NOT NULL THEN 1 END) as with_both
FROM aedpics.aed_data;
```

### 4. 배터리 만료일 검증
```sql
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN battery_expiry_date < CURRENT_DATE THEN 1 END) as expired,
  COUNT(CASE WHEN battery_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' THEN 1 END) as expiring_soon
FROM aedpics.aed_data;
```

## 성능 최적화

### 배치 크기 조정
스크립트 내부에서 배치 크기를 조정할 수 있습니다:

```python
# scripts/upload_to_ncp.py
class AEDDataUploader:
    def __init__(self, db_config: Dict[str, str]):
        ...
        self.batch_size = 500  # 기본값: 500
```

- **작은 배치 (100~200)**: 메모리 사용량 적음, 속도 느림
- **큰 배치 (500~1000)**: 메모리 사용량 많음, 속도 빠름
- **권장**: 500 (테스트 완료)

### 인덱스 활용
```sql
-- equipment_serial에 UNIQUE 인덱스 (자동)
-- sido, manufacturer 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_aed_data_sido_manufacturer
ON aedpics.aed_data(sido, manufacturer);

-- 배터리/패치 만료일 인덱스
CREATE INDEX IF NOT EXISTS idx_aed_data_expiry_dates
ON aedpics.aed_data(battery_expiry_date, patch_expiry_date);
```

## 트러블슈팅

### 1. 연결 오류
```
psycopg2.OperationalError: could not connect to server
```

**해결**:
- NCP 방화벽 설정 확인 (5432 포트)
- 데이터베이스 정보 확인
  - Host: pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com
  - Port: 5432
  - Database: aedpics_production
  - User: aedpics_admin

### 2. 스키마 오류
```
permission denied for schema public
```

**해결**:
스크립트는 자동으로 `search_path=aedpics` 설정

### 3. 컬럼명 불일치
```
ERROR: column "xxx" of relation "aed_data" does not exist
```

**해결**:
- CSV 컬럼명 확인
- `_get_column_mapping()` 함수에서 매핑 추가
- Prisma 스키마와 일치하는지 확인

### 4. 날짜 형식 오류
```
invalid input syntax for type date
```

**해결**:
- `_parse_date()` 함수가 자동으로 처리
- 지원하지 않는 형식이면 NULL로 변환

### 5. 중복 키 오류
```
duplicate key value violates unique constraint
```

**해결**:
- UPSERT 방식이므로 정상 (자동으로 UPDATE)
- 로그에서 "기존 수정" 카운트 확인

## 주의사항

### 1. 데이터 백업
대량 import 전에 반드시 백업:
```bash
PGPASSWORD='AEDpics2025*NCP' pg_dump \
  -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com \
  -U aedpics_admin \
  -d aedpics_production \
  -n aedpics \
  -F c \
  -f backup_$(date +%Y%m%d_%H%M%S).dump
```

### 2. 트랜잭션 롤백
스크립트는 배치 단위로 commit하므로, 중간에 실패하면 일부 데이터만 저장될 수 있습니다.

### 3. 실행 시간
- 1,000개: 약 2~3초
- 10,000개: 약 20~30초
- 81,331개: 약 2~3분 (예상)

### 4. 메모리 사용량
- 대용량 파일 (10,000개 이상)은 충분한 메모리 필요
- 권장: 최소 2GB RAM

## 자동화

### Cron Job 설정 (일일 동기화)
```bash
# crontab -e
0 2 * * * /usr/bin/python3 /path/to/AEDpics/scripts/upload_to_ncp.py /path/to/data/e-gen/ >> /path/to/logs/aed_import.log 2>&1
```

매일 오전 2시에 자동 import 실행

## 참고 문서

- [CSV 파일 구조 분석](CSV_STRUCTURE_ANALYSIS.md)
- [Prisma 스키마](../prisma/schema.prisma)
- [마이그레이션 상태](../MIGRATION_STATUS.md)
- [원본 Supabase 스크립트](../scripts/upload_to_supabase.py)

## 문제 발생 시

1. 로그 확인: 스크립트 실행 시 콘솔 출력
2. 데이터베이스 로그: NCP Console에서 확인
3. 이슈 리포트: GitHub Issues
4. 연락처: truth0530@nmc.or.kr
