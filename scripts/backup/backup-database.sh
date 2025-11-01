#!/bin/bash

#
# AEDpics 데이터베이스 백업 스크립트
#
# 사용법:
#   ./backup-database.sh
#
# 백업 파일 위치:
#   /var/backups/aedpics/aedpics_backup_YYYYMMDD_HHMMSS.sql.gz
#

set -e  # 에러 발생 시 스크립트 중단

# 색상 정의
RED='\033[0:31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 설정
DB_HOST="${DB_HOST:-pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-aedpics_production}"
DB_USER="${DB_USER:-aedpics_admin}"
DB_PASSWORD="${DB_PASSWORD:?ERROR: DB_PASSWORD environment variable is required}"
SCHEMA="aedpics"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/aedpics}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/aedpics_backup_$DATE.sql.gz"

# 로그 함수
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 백업 디렉토리 생성
if [ ! -d "$BACKUP_DIR" ]; then
    log_info "백업 디렉토리 생성: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
fi

log_info "데이터베이스 백업 시작..."
log_info "대상: $DB_HOST:$DB_PORT/$DB_NAME (스키마: $SCHEMA)"

# 백업 실행
PGPASSWORD=$DB_PASSWORD pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -n "$SCHEMA" \
    --no-owner \
    --no-acl \
    --verbose \
    2>&1 | gzip > "$BACKUP_FILE"

# 백업 파일 크기 확인
if [ -f "$BACKUP_FILE" ]; then
    FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log_info "백업 완료: $BACKUP_FILE ($FILE_SIZE)"
else
    log_error "백업 파일 생성 실패"
    exit 1
fi

# 백업 파일 무결성 검증
log_info "백업 파일 무결성 검증 중..."
if gzip -t "$BACKUP_FILE" 2>/dev/null; then
    log_info "백업 파일 검증 완료"
else
    log_error "백업 파일 손상됨"
    exit 1
fi

# 오래된 백업 파일 삭제 (7일 이상)
log_info "7일 이상 된 백업 파일 삭제 중..."
DELETED_COUNT=$(find "$BACKUP_DIR" -name "aedpics_backup_*.sql.gz" -mtime +7 -delete -print | wc -l)
if [ "$DELETED_COUNT" -gt 0 ]; then
    log_info "삭제된 백업 파일: $DELETED_COUNT개"
else
    log_info "삭제할 백업 파일 없음"
fi

# 백업 목록 표시
log_info "현재 백업 파일 목록:"
ls -lh "$BACKUP_DIR"/aedpics_backup_*.sql.gz | tail -5

log_info "백업 프로세스 완료!"

exit 0
