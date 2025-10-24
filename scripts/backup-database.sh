#!/bin/bash

###############################################################################
# Automated Database Backup Script
# For Naver Cloud Platform PostgreSQL
#
# Usage:
#   ./scripts/backup-database.sh
#
# Cron (Daily at 2 AM):
#   0 2 * * * /home/aedpics/apps/AEDpics/scripts/backup-database.sh >> /home/aedpics/logs/backup.log 2>&1
###############################################################################

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_ONLY=$(date +%Y-%m-%d)

# Load environment variables
if [ -f "$PROJECT_DIR/.env.production" ]; then
    export $(grep -v '^#' "$PROJECT_DIR/.env.production" | xargs)
fi

# Validate DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "[ERROR] DATABASE_URL is not set"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup file paths
SQL_FILE="$BACKUP_DIR/db_backup_${TIMESTAMP}.sql"
GZ_FILE="${SQL_FILE}.gz"

# Start backup
echo "=========================================="
echo "Database Backup Started"
echo "=========================================="
echo "Timestamp: $TIMESTAMP"
echo "Backup Directory: $BACKUP_DIR"
echo "Retention: $RETENTION_DAYS days"
echo ""

# Perform backup
echo "[1/5] Creating database dump..."
pg_dump "$DATABASE_URL" \
    --no-owner \
    --no-acl \
    --verbose \
    --file="$SQL_FILE" \
    2>&1 | tee -a "$BACKUP_DIR/backup_${DATE_ONLY}.log"

if [ $? -eq 0 ]; then
    echo "✓ Database dump completed"
    DUMP_SIZE=$(du -h "$SQL_FILE" | cut -f1)
    echo "  Size: $DUMP_SIZE"
else
    echo "✗ Database dump failed"
    exit 1
fi

# Compress backup
echo ""
echo "[2/5] Compressing backup..."
gzip "$SQL_FILE"

if [ $? -eq 0 ]; then
    echo "✓ Compression completed"
    COMPRESSED_SIZE=$(du -h "$GZ_FILE" | cut -f1)
    echo "  Compressed size: $COMPRESSED_SIZE"
else
    echo "✗ Compression failed"
    exit 1
fi

# Verify backup
echo ""
echo "[3/5] Verifying backup..."
if [ -f "$GZ_FILE" ] && [ -s "$GZ_FILE" ]; then
    echo "✓ Backup file exists and is not empty"

    # Test gunzip (without extracting)
    gunzip -t "$GZ_FILE" 2>&1

    if [ $? -eq 0 ]; then
        echo "✓ Backup file integrity verified"
    else
        echo "✗ Backup file is corrupted"
        exit 1
    fi
else
    echo "✗ Backup file is missing or empty"
    exit 1
fi

# Generate checksums
echo ""
echo "[4/5] Generating checksums..."
CHECKSUM_FILE="$BACKUP_DIR/checksums_${DATE_ONLY}.txt"
md5sum "$GZ_FILE" >> "$CHECKSUM_FILE"
sha256sum "$GZ_FILE" >> "$CHECKSUM_FILE"
echo "✓ Checksums saved to $CHECKSUM_FILE"

# Cleanup old backups
echo ""
echo "[5/5] Cleaning up old backups..."
DELETED_COUNT=0

find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -print0 | while IFS= read -r -d '' file; do
    echo "  Deleting: $file"
    rm -f "$file"
    DELETED_COUNT=$((DELETED_COUNT + 1))
done

if [ $DELETED_COUNT -gt 0 ]; then
    echo "✓ Deleted $DELETED_COUNT old backups"
else
    echo "✓ No old backups to delete"
fi

# Summary
echo ""
echo "=========================================="
echo "Backup Completed Successfully"
echo "=========================================="
echo "Backup file: $GZ_FILE"
echo "Size: $COMPRESSED_SIZE"
echo "Retention: $RETENTION_DAYS days"
echo ""
echo "To restore this backup:"
echo "  gunzip -c $GZ_FILE | psql \"\$DATABASE_URL\""
echo "=========================================="

# Optional: Upload to Object Storage
if [ "$UPLOAD_TO_OBJECT_STORAGE" = "true" ]; then
    echo ""
    echo "[OPTIONAL] Uploading to Object Storage..."

    # This requires AWS CLI configured for NCP Object Storage
    # aws --endpoint-url=$OBJECT_STORAGE_ENDPOINT \
    #     s3 cp "$GZ_FILE" "s3://$OBJECT_STORAGE_BUCKET/backups/$(basename $GZ_FILE)"

    echo "✓ Upload to Object Storage (not implemented yet)"
fi

# Send notification (optional)
if [ ! -z "$BACKUP_NOTIFICATION_EMAIL" ]; then
    echo ""
    echo "[OPTIONAL] Sending notification email..."

    # Send email notification
    # mail -s "Backup Completed: $TIMESTAMP" "$BACKUP_NOTIFICATION_EMAIL" <<EOF
    # Database backup completed successfully.
    #
    # Backup file: $GZ_FILE
    # Size: $COMPRESSED_SIZE
    # Timestamp: $TIMESTAMP
    # EOF

    echo "✓ Notification email sent (not implemented yet)"
fi

exit 0
