# data/backup - 데이터 백업 파일

이 디렉토리는 target_list_2025 테이블의 백업 파일을 저장하는 곳입니다.

## 백업 파일 형식

```
target_list_2025_backup_YYYYMMDD_HHMMSS.sql
```

예시: `target_list_2025_backup_20251117_180000.sql`

## 백업 생성 방법

### 방법 1: pg_dump 사용 (권장)

```bash
pg_dump \
  -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com \
  -U aedpics_admin \
  -d aedpics_production \
  -n aedpics \
  -t target_list_2025 \
  --data-only \
  > data/backup/target_list_2025_backup_$(date +%Y%m%d_%H%M%S).sql
```

### 방법 2: 스크립트 사용

```bash
cd scripts/data-import
bash backup_target_list.sh
```

## 복구 방법

```bash
# 1. 현재 데이터 삭제 (주의!)
psql -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com \
  -U aedpics_admin \
  -d aedpics_production \
  -c "SET search_path TO aedpics; TRUNCATE TABLE target_list_2025 CASCADE;"

# 2. 백업 복구
psql -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com \
  -U aedpics_admin \
  -d aedpics_production \
  < data/backup/target_list_2025_backup_YYYYMMDD_HHMMSS.sql
```

## 주의사항

- 이 디렉토리의 파일은 Git에 커밋되지 않습니다
- 백업은 정기적으로 수행하세요
- 중요 작업 전 반드시 백업하세요
- 백업 파일은 최소 3개 이상 유지 권장

## 백업 시점

필수 백업 시점:
1. target_list_2025 데이터 교체 전
2. 대량 데이터 수정 전
3. 스키마 변경 전
4. 주간 정기 백업

## 백업 파일 보관

- 최근 3개월 백업: 로컬 보관
- 3개월 이상 백업: 외부 스토리지 이동 (NCP Object Storage 권장)
