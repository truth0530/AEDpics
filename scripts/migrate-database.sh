#!/bin/bash

###############################################################################
# Database Migration Script
# Supabase → Naver Cloud Platform PostgreSQL
#
# Usage:
#   ./scripts/migrate-database.sh
#
# Environment Variables Required:
#   SUPABASE_DB_URL: Source database URL
#   NCP_DB_URL: Target database URL
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
log_info "Checking prerequisites..."

if ! command -v pg_dump &> /dev/null; then
    log_error "pg_dump not found. Please install PostgreSQL client tools."
    exit 1
fi

if ! command -v psql &> /dev/null; then
    log_error "psql not found. Please install PostgreSQL client tools."
    exit 1
fi

log_info "✓ PostgreSQL client tools found"

# Check environment variables
if [ -z "$SUPABASE_DB_URL" ]; then
    log_error "SUPABASE_DB_URL is not set"
    exit 1
fi

if [ -z "$NCP_DB_URL" ]; then
    log_error "NCP_DB_URL is not set"
    exit 1
fi

log_info "✓ Environment variables configured"

# Create backups directory
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"
log_info "✓ Backup directory created: $BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/supabase_backup_$TIMESTAMP.sql"

# Step 1: Backup Supabase database
log_info "Step 1/5: Backing up Supabase database..."
pg_dump "$SUPABASE_DB_URL" \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    --exclude-table-data='spatial_ref_sys' \
    --exclude-table-data='geography_columns' \
    --exclude-table-data='geometry_columns' \
    -f "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    log_info "✓ Backup completed: $BACKUP_FILE"
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log_info "  Backup size: $BACKUP_SIZE"
else
    log_error "Backup failed"
    exit 1
fi

# Step 2: Validate backup file
log_info "Step 2/5: Validating backup file..."
if [ ! -s "$BACKUP_FILE" ]; then
    log_error "Backup file is empty"
    exit 1
fi

LINE_COUNT=$(wc -l < "$BACKUP_FILE")
log_info "✓ Backup file validated (${LINE_COUNT} lines)"

# Step 3: Test NCP database connection
log_info "Step 3/5: Testing NCP database connection..."
psql "$NCP_DB_URL" -c "SELECT version();" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    log_info "✓ NCP database connection successful"
else
    log_error "Cannot connect to NCP database"
    exit 1
fi

# Step 4: Restore to NCP database
log_info "Step 4/5: Restoring to NCP database..."
log_warn "This will overwrite existing data. Continue? (y/N)"
read -r CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    log_info "Migration cancelled by user"
    exit 0
fi

psql "$NCP_DB_URL" -f "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    log_info "✓ Database restored successfully"
else
    log_error "Database restore failed"
    exit 1
fi

# Step 5: Verify migration
log_info "Step 5/5: Verifying migration..."

# Count users
USER_COUNT=$(psql "$NCP_DB_URL" -t -c "SELECT COUNT(*) FROM users;" | tr -d ' ')
log_info "  Users: $USER_COUNT"

# Count AED devices
AED_COUNT=$(psql "$NCP_DB_URL" -t -c "SELECT COUNT(*) FROM aed_devices;" | tr -d ' ')
log_info "  AED Devices: $AED_COUNT"

# Count inspection records
INSPECTION_COUNT=$(psql "$NCP_DB_URL" -t -c "SELECT COUNT(*) FROM inspection_records;" | tr -d ' ')
log_info "  Inspection Records: $INSPECTION_COUNT"

# Compress backup file
log_info "Compressing backup file..."
gzip "$BACKUP_FILE"
log_info "✓ Backup compressed: ${BACKUP_FILE}.gz"

# Summary
echo ""
log_info "======================================"
log_info "Migration completed successfully!"
log_info "======================================"
log_info "Backup file: ${BACKUP_FILE}.gz"
log_info "Users migrated: $USER_COUNT"
log_info "AED devices migrated: $AED_COUNT"
log_info "Inspection records migrated: $INSPECTION_COUNT"
log_info "======================================"
echo ""

# Next steps
log_info "Next steps:"
echo "1. Run Prisma migrations: npx prisma migrate deploy"
echo "2. Generate Prisma client: npx prisma generate"
echo "3. Verify data integrity"
echo "4. Update application .env file with NCP_DB_URL"
echo "5. Test application"
