# Upload Script 테스트 가이드

## 개요

`scripts/upload_to_ncp.py` 스크립트를 프로덕션 환경에서 실행하기 전 **반드시** 소규모 샘플 데이터로 테스트해야 합니다.

## 주요 변경 사항 (2025-11-12)

### 1. Rate Limiting 추가
- 카카오 API 호출 간 100ms 대기 (초당 최대 10건)
- 과도한 API 호출로 인한 rate limit 초과 방지

### 2. 통계 수집
- Regex 파싱 성공/실패율 추적
- 카카오 API 호출 횟수 및 성공률 추적
- 실행 완료 시 자동으로 통계 출력

### 3. Two-Stage Validation
- 1단계: Regex 기반 파싱 (빠름, API 호출 없음)
- 2단계: Kakao API fallback (정확함, 도로명 주소 지원)

## 테스트 전 준비

### 1. 샘플 데이터 준비

**중요**: 전체 데이터를 한 번에 업로드하지 마세요!

```bash
# 방법 1: 엑셀에서 직접 샘플 추출
# - 원본 파일을 열어서 상위 10-20행만 복사
# - 새 파일로 저장: sample_10_rows.xlsx

# 방법 2: Python으로 샘플 추출 (CSV 파일인 경우)
python3 << EOF
import pandas as pd
df = pd.read_csv('target_list_2025.csv', nrows=20)
df.to_excel('sample_20_rows.xlsx', index=False)
EOF
```

**샘플 데이터 권장 구성**:
- 정형화된 주소 (예: "경북 경산시 금박로 95") - 10행
- 도로명 주소만 있는 경우 (예: "테헤란로 152") - 5행
- 빈 주소 또는 불완전한 주소 - 5행

### 2. 환경변수 설정

```bash
# 1. .env.local 확인 (또는 생성)
cat .env.local | grep KAKAO

# 2. 카카오 API 키가 없으면 추가
export NEXT_PUBLIC_KAKAO_MAP_APP_KEY="your_actual_key_here"

# 3. 데이터베이스 연결 정보 확인
export DATABASE_URL="postgresql://user:password@host:port/database?schema=aedpics"
```

**API 키 없이 테스트**:
- 환경변수를 설정하지 않으면 regex 기반 파싱만 사용됩니다
- 경고 로그가 출력되지만 스크립트는 정상 동작합니다

### 3. 의존성 설치

```bash
# Python 패키지 설치
pip install pandas openpyxl psycopg2-binary requests beautifulsoup4

# 또는 requirements.txt가 있는 경우
pip install -r scripts/requirements.txt
```

## 테스트 실행

### 1단계: 소규모 샘플 테스트 (필수)

```bash
# 10-20행 샘플로 테스트
python3 scripts/upload_to_ncp.py sample_10_rows.xlsx

# 또는 dry-run 모드 (데이터베이스에 실제 쓰지 않음)
# TODO: dry-run 옵션 추가 예정
```

**예상 소요 시간**:
- 10행: 약 5-10초
- 20행: 약 10-20초
- 카카오 API 호출이 많으면 더 오래 걸릴 수 있음 (rate limiting)

### 2단계: 로그 분석

실행 중 다음 로그를 확인하세요:

```
2025-11-12 10:00:00 - INFO - 카카오 API 키 로드 성공 - 주소 검증에 카카오 API 사용
2025-11-12 10:00:01 - INFO - 주소 기반 sido/gugun 검증 시작...
2025-11-12 10:00:02 - INFO - 카카오 API 성공 - '테헤란로 152...' → sido='서울특별시', gugun='강남구'
2025-11-12 10:00:03 - INFO - sido/gugun 검증 완료:
  - sido: 수정 2건, 빈 값 채움 3건
  - gugun: 수정 1건, 빈 값 채움 3건

=== 주소 파싱 통계 ===
  총 처리: 20건
  - Regex 성공: 15건 (75.0%)
  - Regex 실패: 5건
  - 카카오 API 호출: 5건
  - 카카오 API 성공: 4건
  - 카카오 API 실패: 1건
```

**주의 깊게 볼 통계**:
- **Regex 성공률**: 70% 이상이면 정상
- **카카오 API 호출 횟수**: Regex 실패 건수와 일치해야 함
- **카카오 API 실패**: 타임아웃이나 잘못된 주소
- **Rate limiting 경고**: "카카오 API 응답 오류 (HTTP 429)" 메시지가 없어야 함

### 3단계: 데이터베이스 검증

```bash
# 업로드된 데이터 확인
PGPASSWORD="password" psql -h host -U user -d database << EOF
\c aedpics_production
SET search_path TO aedpics;

-- 최근 업로드된 데이터 확인
SELECT
    target_key,
    institution_name,
    sido,
    gugun,
    address
FROM target_list_2025
ORDER BY created_at DESC
LIMIT 10;
EOF
```

**확인 사항**:
- [ ] sido 값이 정확한가? (예: "경상북도", "서울특별시")
- [ ] gugun 값이 정확한가? (예: "경산시", "강남구")
- [ ] 주소와 sido/gugun이 일치하는가?
- [ ] NULL 값이 예상대로 처리되었는가?

### 4단계: 중간 규모 테스트

소규모 테스트가 성공하면:

```bash
# 100행 정도 테스트
python3 scripts/upload_to_ncp.py sample_100_rows.xlsx
```

**통계 확인**:
- 카카오 API 호출 횟수가 예상 범위 내인가?
- Rate limiting 경고가 없는가?
- 전체 실행 시간이 합리적인가? (100행 → 약 1-2분)

## 문제 해결

### Q1: "카카오 API 키 없음" 경고

```
WARNING - 카카오 API 키 없음 - regex 기반 주소 파싱만 사용
```

**해결책**:
```bash
# 환경변수 설정
export NEXT_PUBLIC_KAKAO_MAP_APP_KEY="your_key"

# 또는 .env.local에 추가
echo 'NEXT_PUBLIC_KAKAO_MAP_APP_KEY="your_key"' >> .env.local
source .env.local
```

### Q2: "카카오 API 타임아웃" 빈번

```
WARNING - 카카오 API 타임아웃: '주소...'
```

**원인**: 네트워크 불안정 또는 카카오 서버 응답 지연

**해결책**:
1. 네트워크 연결 확인
2. 타임아웃 값 증가 (scripts/upload_to_ncp.py line 391)
   ```python
   response = requests.get(url, headers=headers, params=params, timeout=10)  # 5→10초
   ```

### Q3: Rate Limiting (HTTP 429)

```
WARNING - 카카오 API 응답 오류 (HTTP 429): '주소...'
```

**원인**: 초당 요청 제한 초과

**해결책**:
1. Rate limiting 간격 증가 (scripts/upload_to_ncp.py line 411, 427)
   ```python
   time.sleep(0.2)  # 0.1→0.2초
   ```
2. 데이터를 더 작은 배치로 나누어 처리

### Q4: Regex 성공률이 너무 낮음 (<50%)

**원인**: 주소 형식이 예상과 다름

**해결책**:
1. 샘플 주소 확인
2. 로그에서 실패한 주소 패턴 분석
3. `_extract_sido_gugun_from_address()` 함수 개선 필요

### Q5: 데이터베이스 연결 실패

```
ERROR - 데이터베이스 연결 실패: connection refused
```

**해결책**:
```bash
# 연결 정보 확인
psql $DATABASE_URL -c "SELECT 1"

# SSH 터널이 필요한 경우
ssh -L 5432:pg-xxx.vpc-pub-cdb-kr.ntruss.com:5432 user@bastion-host
```

## 프로덕션 배포 전 체크리스트

- [ ] 소규모 샘플 (10-20행) 테스트 성공
- [ ] 중간 규모 샘플 (100행) 테스트 성공
- [ ] Regex 성공률 70% 이상
- [ ] 카카오 API Rate limiting 경고 없음
- [ ] 데이터베이스에 정확한 값 저장 확인
- [ ] 통계 로그 분석 완료
- [ ] 백업 생성 (기존 데이터)

## 백업 및 롤백

### 배포 전 백업

```sql
-- 전체 테이블 백업
CREATE TABLE aedpics.target_list_2025_backup AS
SELECT * FROM aedpics.target_list_2025;

-- 또는 pg_dump
pg_dump -h host -U user -d database -t aedpics.target_list_2025 > backup_2025.sql
```

### 롤백

```sql
-- 방법 1: 백업에서 복구
TRUNCATE aedpics.target_list_2025;
INSERT INTO aedpics.target_list_2025
SELECT * FROM aedpics.target_list_2025_backup;

-- 방법 2: pg_restore
psql -h host -U user -d database < backup_2025.sql
```

## 성능 예측

**예상 처리 속도**:
- Regex만 사용: 약 500-1000행/분
- 카카오 API 사용 (20% fallback): 약 100-200행/분
- 전체 데이터 (10,000행): 약 50분-100분

**최적화 팁**:
1. 데이터를 1,000행 단위로 나누어 처리
2. Rate limiting 간격 조정 (0.1초 → 0.05초, 위험 감수)
3. 여러 API 키 사용 (순환, 카카오 정책 확인 필요)

## 참고 문서

- [카카오 로컬 API 문서](https://developers.kakao.com/docs/latest/ko/local/dev-guide)
- [Prisma Schema](../../prisma/schema.prisma)
- [지역 관리 규칙](../REGION_MANAGEMENT_RULES.md)

---

**마지막 업데이트**: 2025-11-12
**작성자**: AEDpics Development Team
