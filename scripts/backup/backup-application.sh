#!/bin/bash

#
# AEDpics 애플리케이션 파일 백업 스크립트
#
# 사용법:
#   ./backup-application.sh
#
# 백업 파일 위치:
#   /var/backups/aedpics/aedpics_app_YYYYMMDD_HHMMSS.tar.gz
#

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 설정
APP_DIR="${APP_DIR:-/var/www/aedpics}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/aedpics}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/aedpics_app_$DATE.tar.gz"

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

log_info "애플리케이션 백업 시작..."
log_info "대상: $APP_DIR"

# 애플리케이션 백업 (node_modules, .next, logs 제외)
tar -czf "$BACKUP_FILE" \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='logs' \
    --exclude='.git' \
    --exclude='.env*' \
    -C "$(dirname $APP_DIR)" \
    "$(basename $APP_DIR)"

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
if tar -tzf "$BACKUP_FILE" >/dev/null 2>&1; then
    log_info "백업 파일 검증 완료"
else
    log_error "백업 파일 손상됨"
    exit 1
fi

# 오래된 백업 파일 삭제 (30일 이상)
log_info "30일 이상 된 백업 파일 삭제 중..."
DELETED_COUNT=$(find "$BACKUP_DIR" -name "aedpics_app_*.tar.gz" -mtime +30 -delete -print | wc -l)
if [ "$DELETED_COUNT" -gt 0 ]; then
    log_info "삭제된 백업 파일: $DELETED_COUNT개"
else
    log_info "삭제할 백업 파일 없음"
fi

# 백업 목록 표시
log_info "현재 백업 파일 목록:"
ls -lh "$BACKUP_DIR"/aedpics_app_*.tar.gz | tail -5

log_info "백업 프로세스 완료!"

exit 0
