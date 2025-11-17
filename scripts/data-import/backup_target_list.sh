#!/bin/bash
# target_list_2025 테이블 백업 스크립트

set -e  # 에러 발생 시 즉시 중단

echo "=================================="
echo "target_list_2025 백업 시작"
echo "=================================="

# 프로젝트 루트로 이동
cd "$(dirname "$0")/../.."

# 환경변수 로드
if [ ! -f .env.local ]; then
    echo "Error: .env.local 파일을 찾을 수 없습니다."
    exit 1
fi

# DATABASE_URL에서 비밀번호 추출
export PGPASSWORD=$(grep DATABASE_URL .env.local | cut -d':' -f3 | cut -d'@' -f1)

if [ -z "$PGPASSWORD" ]; then
    echo "Error: DATABASE_URL에서 비밀번호를 추출할 수 없습니다."
    exit 1
fi

# 백업 디렉토리 확인
mkdir -p data/backup

# 백업 파일명 생성
BACKUP_FILE="data/backup/target_list_2025_backup_$(date +%Y%m%d_%H%M%S).sql"

echo "백업 시작..."
echo "대상: target_list_2025 테이블"
echo "파일: $BACKUP_FILE"

# pg_dump 실행
pg_dump \
  -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com \
  -p 5432 \
  -U aedpics_admin \
  -d aedpics_production \
  -n aedpics \
  -t target_list_2025 \
  --data-only \
  --no-owner \
  --no-privileges \
  > "$BACKUP_FILE"

# 백업 성공 확인
if [ -f "$BACKUP_FILE" ]; then
    FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    LINE_COUNT=$(wc -l < "$BACKUP_FILE")

    echo "=================================="
    echo "백업 완료!"
    echo "=================================="
    echo "파일: $BACKUP_FILE"
    echo "크기: $FILE_SIZE"
    echo "라인수: $LINE_COUNT"
    echo ""
    echo "백업 파일 목록:"
    ls -lh data/backup/target_list_2025_backup_*.sql | tail -5
else
    echo "Error: 백업 파일 생성 실패"
    exit 1
fi

# PGPASSWORD 제거
unset PGPASSWORD
