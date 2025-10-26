# portal_to_ncp.py 사용 가이드

## 개요

e-gen 포털에서 자동으로 AED 데이터를 다운로드하고 NCP PostgreSQL에 업로드하는 통합 스크립트입니다.

**기반**: v7.91 Supabase → v8.0 NCP PostgreSQL 변환
**검증**: upload_to_ncp.py의 성공한 컬럼 매핑 및 UPSERT 로직 재사용
**특징**: DB 정보 및 포털 로그인 정보 하드코딩 (단독 실행 가능)

---

## 주요 기능

1. **Selenium 자동 다운로드**
   - e-gen 포털 자동 로그인 (OTP 지원)
   - 17개 시도별 데이터 자동 검색
   - 병렬 탭 관리로 빠른 다운로드

2. **NCP PostgreSQL 직접 업로드**
   - psycopg2 기반 고성능 UPSERT
   - 배치 처리 (500개씩)
   - 트랜잭션 안전성 보장

3. **스마트 데이터 관리**
   - 파일 우선순위 기반 중복 제거
   - 지역별 캐시 관리
   - 신규/수정/누락/복구 자동 추적

---

## 설정 방법

### 하드코딩된 정보 (파일 내부)

스크립트 파일 내부에 다음 정보가 하드코딩되어 있습니다:

```python
# 74-93줄: NCP PostgreSQL 설정 및 포털 로그인 정보
DB_CONFIG = {
    'host': 'pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com',
    'database': 'aedpics_production',
    'user': 'aedpics_admin',
    'password': 'AEDpics2025*NCP',
    'port': 5432
}

PORTAL_USERNAME = 'nemc1'
PORTAL_PASSWORD = 'dlsxm*0537'
```

**변경 필요 시**: 파일을 직접 수정하세요.

### 설정 없이 즉시 실행 가능

외부 설정 파일이나 환경변수 없이 단독 실행 가능합니다.

---

## 실행 방법

### 필수 패키지 설치

```bash
pip install psycopg2-binary selenium webdriver-manager pandas lxml beautifulsoup4
```

### 스크립트 실행

```bash
cd /Users/kwangsunglee/Projects/AEDpics/scripts
python3 portal_to_ncp.py
```

### 실행 과정

1. Chrome 브라우저 자동 실행
2. e-gen 포털 로그인
3. **OTP 입력 대기** (30초) - 수동 입력 필요
4. 17개 시도별 데이터 검색
5. Excel 파일 자동 다운로드
6. NCP PostgreSQL로 자동 업로드

---

## 로그 파일

실행 시 자동으로 로그 파일 생성:

```
aed_portal_sync_20251026_143000.log
```

로그에는 다음 정보가 포함됩니다:
- 각 시도별 다운로드 상태
- 파일 처리 우선순위
- 업로드 성공/실패 통계
- 오류 메시지 상세

---

## 주의사항

### 보안 (매우 중요)
- ⚠️ **이 파일에는 DB 비밀번호와 포털 로그인 정보가 하드코딩되어 있습니다**
- ⚠️ **절대 Git에 커밋하지 마세요**
- ⚠️ **외부 PC로 이동 후 프로젝트에서 삭제하세요**
- 파일 권한 설정: `chmod 600 portal_to_ncp.py`
- 외부 이동 권장 경로: `~/external-aed-scripts/`

### OTP 인증
- 스크립트 실행 후 30초 내에 OTP 입력 필요
- OTP 입력 시간이 부족하면 스크립트 수정:
  ```python
  # line 1063: OTP 대기 시간 조정
  time.sleep(30)  # 60으로 변경 가능
  ```

### Chrome 브라우저
- Chrome 브라우저가 설치되어 있어야 함
- ChromeDriver는 자동으로 다운로드됨 (webdriver-manager)

---

## 문제 해결

### 데이터베이스 연결 실패

```
NCP PostgreSQL 연결 실패: password authentication failed
```

**해결**:
- ncp_config.json의 password 확인
- NCP 방화벽 설정 확인 (IP 허용)

### Selenium 오류

```
SessionNotCreatedException: Chrome version mismatch
```

**해결**:
```bash
pip install --upgrade webdriver-manager
```

### 다운로드 타임아웃

```
다운로드 타임아웃: 300초 경과
```

**해결**:
- 네트워크 상태 확인
- timeout 값 증가:
  ```python
  # line 1190: wait_for_downloads 호출
  wait_for_downloads(expected_count, timeout=600)  # 300 → 600초
  ```

---

## 성능 최적화

### 배치 크기 조정

대용량 데이터 처리 시:

```json
{
  "batch_size": 1000,
  "stream_batch_size": 200
}
```

### 캐시 메모리 조정

```python
# line 501: AEDDataTracker.__init__
self.safe_cache = SafeCache(max_memory_mb=1024)  # 512 → 1024MB
```

---

## 스케줄링 (자동화)

### cron 설정 (매일 새벽 2시 실행)

```bash
crontab -e
```

```cron
0 2 * * * cd /Users/kwangsunglee/Projects/AEDpics/scripts && /usr/bin/python3 portal_to_ncp.py >> /var/log/aed_sync.log 2>&1
```

### 환경변수 포함

```cron
0 2 * * * export NCP_DB_PASSWORD="..." && cd /Users/kwangsunglee/Projects/AEDpics/scripts && /usr/bin/python3 portal_to_ncp.py >> /var/log/aed_sync.log 2>&1
```

---

## 외부 프로젝트로 이동 (향후)

현재는 테스트용으로 프로젝트 내부에 있지만, 검증 완료 후 외부로 이동할 예정:

```bash
# 이동 예정 위치
~/external-aed-scripts/
├── portal_to_ncp.py
├── ncp_config.json
└── logs/
```

---

## 버전 히스토리

- **v8.0** (2025-10-26): NCP PostgreSQL 버전 (현재)
  - Supabase → NCP 전환
  - upload_to_ncp.py 검증 로직 재사용
  - 환경변수 지원 추가

- **v7.91**: Supabase 버전 (레거시)
  - Selenium 자동 다운로드
  - 완전한 데이터 추적 시스템

---

## 문의

- 시스템 관리자: truth0530@nmc.or.kr
- 기술 지원: inhak@nmc.or.kr
