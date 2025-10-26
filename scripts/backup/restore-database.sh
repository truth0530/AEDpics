#!/bin/bash

#
# AEDpics 데이터베이스 복구 스크립트
#
# 사용법:
#   ./restore-database.sh <백업파일.sql.gz>
#
# 예시:
#   ./restore-database.sh /var/backups/aedpics/aedpics_backup_20251026_020000.sql.gz
#

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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

# 인자 확인
if [ $# -eq 0 ]; then
    log_error "백업 파일을 지정해주세요"
    echo "사용법: $0 <백업파일.sql.gz>"
    exit 1
fi

BACKUP_FILE="$1"

# 백업 파일 존재 확인
if [ ! -f "$BACKUP_FILE" ]; then
    log_error "백업 파일을 찾을 수 없습니다: $BACKUP_FILE"
    exit 1
fi

# 설정
DB_HOST="${DB_HOST:-pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-aedpics_production}"
DB_USER="${DB_USER:-aedpics_admin}"
DB_PASSWORD="${DB_PASSWORD:-AEDpics2025*NCP}"
SCHEMA="aedpics"

log_warn "====================================="
log_warn "경고: 데이터베이스 복구 작업"
log_warn "====================================="
log_warn "대상 DB: $DB_HOST:$DB_PORT/$DB_NAME"
log_warn "백업 파일: $BACKUP_FILE"
log_warn ""
log_warn "이 작업은 현재 데이터를 모두 삭제하고"
log_warn "백업 파일로 복원합니다."
log_warn ""

# 확인
read -p "계속하시겠습니까? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    log_info "복구 작업 취소됨"
    exit 0
fi

# 백업 파일 무결성 검증
log_info "백업 파일 무결성 검증 중..."
if gzip -t "$BACKUP_FILE" 2>/dev/null; then
    log_info "백업 파일 검증 완료"
else
    log_error "백업 파일이 손상되었습니다"
    exit 1
fi

# 현재 데이터 백업 (안전장치)
SAFETY_BACKUP="/tmp/aedpics_safety_backup_$(date +%Y%m%d_%H%M%S).sql.gz"
log_info "안전장치: 현재 데이터 임시 백업 중... ($SAFETY_BACKUP)"

PGPASSWORD=$DB_PASSWORD pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -n "$SCHEMA" \
    --no-owner \
    --no-acl \
    2>/dev/null | gzip > "$SAFETY_BACKUP"

log_info "안전 백업 완료"

# 스키마 삭제 및 재생성
log_info "기존 스키마 삭제 및 재생성 중..."

PGPASSWORD=$DB_PASSWORD psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -c "DROP SCHEMA IF EXISTS $SCHEMA CASCADE; CREATE SCHEMA $SCHEMA;"

log_info "스키마 재생성 완료"

# 데이터 복구
log_info "데이터베이스 복구 중..."

gunzip -c "$BACKUP_FILE" | PGPASSWORD=$DB_PASSWORD psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -v ON_ERROR_STOP=1 \
    --quiet

log_info "데이터베이스 복구 완료"

# 복구 검증
log_info "복구 검증 중..."

TABLE_COUNT=$(PGPASSWORD=$DB_PASSWORD psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$SCHEMA';" | tr -d ' ')

log_info "복구된 테이블 수: $TABLE_COUNT"

if [ "$TABLE_COUNT" -gt 0 ]; then
    log_info "복구 검증 완료"
    log_info "안전 백업 파일 위치: $SAFETY_BACKUP"
    log_warn "복구가 정상적으로 완료되면 안전 백업 파일을 삭제해주세요"
else
    log_error "복구 검증 실패 - 테이블이 없습니다"
    log_error "안전 백업 파일로 롤백하세요: $SAFETY_BACKUP"
    exit 1
fi

log_info "복구 프로세스 완료!"

exit 0
