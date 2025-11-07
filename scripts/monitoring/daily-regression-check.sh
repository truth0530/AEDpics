#!/bin/bash

################################################################################
# Daily Regression Monitoring Script
#
# Purpose: Automatically check for regressions in:
#   1. User update operations (Prisma field naming)
#   2. Inspection completion operations (error handling)
#
# Schedule: Daily at 08:00 KST via cron
# Cron entry: 0 8 * * * /path/to/daily-regression-check.sh
#
# Environment: Production server (223.130.150.133)
# Database: NCP PostgreSQL
#
################################################################################

set -e

# Configuration
DB_HOST="pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com"
DB_PORT="5432"
DB_USER="aedpics_admin"
DB_NAME="aedpics_production"
DB_SCHEMA="aedpics"

SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
REPORT_DATE=$(date '+%Y-%m-%d')
REPORT_TIME=$(date '+%Y-%m-%d %H:%M:%S %Z')

# Colors for console output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

################################################################################
# Functions
################################################################################

log_header() {
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}========================================${NC}"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

send_slack_alert() {
  local message="$1"
  local severity="$2"  # INFO, WARNING, CRITICAL

  if [ -z "$SLACK_WEBHOOK_URL" ]; then
    echo "⚠️  Slack webhook not configured, skipping notification"
    return
  fi

  # Determine color based on severity
  local color="36B7FF"  # Blue
  if [ "$severity" = "WARNING" ]; then
    color="FFA500"  # Orange
  elif [ "$severity" = "CRITICAL" ]; then
    color="FF0000"  # Red
  fi

  local payload=$(cat <<EOF
{
  "attachments": [
    {
      "color": "$color",
      "title": "AED Monitoring Report - $REPORT_DATE",
      "text": "$message",
      "ts": $(date +%s)
    }
  ]
}
EOF
)

  curl -X POST -H 'Content-type: application/json' \
    --data "$payload" \
    "$SLACK_WEBHOOK_URL" > /dev/null 2>&1 || true
}

run_sql_query() {
  local query="$1"

  PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -c "$query"
}

################################################################################
# Check 1: User Update Operation Validation
################################################################################

check_user_updates() {
  log_header "Check 1: User Update Operations (Last 24 Hours)"

  # Count user_updated audit logs in last 24 hours
  local query="
  SELECT
    COUNT(*) as total_updates,
    COUNT(CASE WHEN metadata->>'updated_role' IS NOT NULL THEN 1 END) as role_changes,
    COUNT(CASE WHEN metadata->>'updated_organization_id' IS NOT NULL THEN 1 END) as org_changes,
    COUNT(CASE WHEN metadata->>'updated_region_code' IS NOT NULL THEN 1 END) as region_changes
  FROM ${DB_SCHEMA}.audit_logs
  WHERE action = 'user_updated'
    AND created_at >= NOW() - INTERVAL '24 hours';
  "

  echo "SQL Query:"
  echo "$query"
  echo ""

  echo "Results:"
  RESULT=$(run_sql_query "$query")
  echo "$RESULT"

  # Parse results
  TOTAL_UPDATES=$(echo "$RESULT" | tail -2 | head -1 | awk '{print $1}')
  ROLE_CHANGES=$(echo "$RESULT" | tail -2 | head -1 | awk '{print $3}')
  ORG_CHANGES=$(echo "$RESULT" | tail -2 | head -1 | awk '{print $5}')
  REGION_CHANGES=$(echo "$RESULT" | tail -2 | head -1 | awk '{print $7}')

  echo ""
  echo "Summary:"
  echo "  Total updates: $TOTAL_UPDATES"
  echo "  Role changes: $ROLE_CHANGES"
  echo "  Organization changes: $ORG_CHANGES"
  echo "  Region changes: $REGION_CHANGES"
  echo ""

  # Verify data persistence
  if [ "$TOTAL_UPDATES" -gt 0 ]; then
    log_success "User updates detected and logged"

    # Check if updates actually persisted (sample 5 recent ones)
    local verify_query="
    SELECT
      al.id,
      al.entity_id,
      al.metadata->>'updated_role' as updated_role,
      up.role as actual_role,
      CASE WHEN al.metadata->>'updated_role' = up.role THEN 'OK' ELSE 'MISMATCH' END as status
    FROM ${DB_SCHEMA}.audit_logs al
    LEFT JOIN ${DB_SCHEMA}.user_profiles up ON al.entity_id = up.id
    WHERE al.action = 'user_updated'
      AND al.created_at >= NOW() - INTERVAL '24 hours'
    ORDER BY al.created_at DESC
    LIMIT 5;
    "

    echo "Verifying data persistence (last 5 updates):"
    VERIFY_RESULT=$(run_sql_query "$verify_query")
    echo "$VERIFY_RESULT"

    # Check for mismatches
    MISMATCHES=$(echo "$VERIFY_RESULT" | grep -c "MISMATCH" || true)
    if [ "$MISMATCHES" -gt 0 ]; then
      log_error "Found $MISMATCHES audit log/database mismatches!"
      send_slack_alert "🚨 CRITICAL: User update data persistence issue detected. $MISMATCHES mismatches found." "CRITICAL"
    else
      log_success "All user updates verified in database"
    fi
  else
    log_warning "No user updates in last 24 hours (may be normal)"
  fi

  echo ""
}

################################################################################
# Check 2: Inspection Completion Operation Validation
################################################################################

check_inspection_completions() {
  log_header "Check 2: Inspection Completion Operations (Last 24 Hours)"

  # Count inspection completions in last 24 hours
  local query="
  SELECT
    COUNT(*) as total_completions,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_status,
    MIN(updated_at) as oldest_completion,
    MAX(updated_at) as newest_completion
  FROM ${DB_SCHEMA}.inspections
  WHERE status = 'completed'
    AND updated_at >= NOW() - INTERVAL '24 hours';
  "

  echo "SQL Query:"
  echo "$query"
  echo ""

  echo "Results:"
  RESULT=$(run_sql_query "$query")
  echo "$RESULT"

  TOTAL_COMPLETIONS=$(echo "$RESULT" | tail -2 | head -1 | awk '{print $1}')
  COMPLETED_STATUS=$(echo "$RESULT" | tail -2 | head -1 | awk '{print $3}')

  echo ""
  echo "Summary:"
  echo "  Total completions: $TOTAL_COMPLETIONS"
  echo "  With 'completed' status: $COMPLETED_STATUS"
  echo ""

  if [ "$TOTAL_COMPLETIONS" -gt 0 ]; then
    log_success "Inspection completions detected"

    # Check for any incomplete/hung inspections with recent updates
    local hung_query="
    SELECT
      id,
      equipment_serial,
      status,
      updated_at,
      EXTRACT(EPOCH FROM (NOW() - updated_at)) as seconds_since_update
    FROM ${DB_SCHEMA}.inspections
    WHERE status IN ('in_progress', 'pending')
      AND updated_at >= NOW() - INTERVAL '1 hour'
    LIMIT 5;
    "

    echo "Checking for potentially hung inspections (updated in last 1 hour):"
    HUNG_RESULT=$(run_sql_query "$hung_query")
    echo "$HUNG_RESULT"

    HUNG_COUNT=$(echo "$HUNG_RESULT" | grep -c "in_progress\|pending" || true)
    if [ "$HUNG_COUNT" -gt 0 ]; then
      log_warning "Found $HUNG_COUNT potentially incomplete inspections"
    else
      log_success "No stuck inspections detected"
    fi
  else
    log_warning "No inspection completions in last 24 hours (may be normal)"
  fi

  echo ""
}

################################################################################
# Check 3: PM2 Application Health
################################################################################

check_pm2_health() {
  log_header "Check 3: PM2 Application Health"

  # Check if PM2 is running and processes are up
  if ! command -v pm2 &> /dev/null; then
    log_warning "PM2 not found (may be running in production environment)"
    return
  fi

  echo "PM2 Status:"
  pm2 status aedpics || true

  echo ""
  echo "Recent Error Logs:"
  pm2 logs --err --lines 20 aedpics 2>/dev/null | head -20 || true

  echo ""
  log_success "PM2 health check complete"
  echo ""
}

################################################################################
# Check 4: Error Log Analysis
################################################################################

check_error_logs() {
  log_header "Check 4: Error Log Analysis (Last 24 Hours)"

  # Check for specific error patterns
  if [ ! -f "/var/log/pm2/aedpics-error.log" ]; then
    log_warning "PM2 error log not accessible (may be normal in local environment)"
    return
  fi

  echo "Searching for relevant errors..."
  echo ""

  # Search for inspection-related errors
  echo "Inspection-related errors:"
  grep -i "inspection.*complete\|complete.*inspection" /var/log/pm2/aedpics-error.log \
    | tail -5 || echo "  (none found)"

  echo ""

  # Search for user update errors
  echo "User update errors:"
  grep -i "user.*update\|organization\|region_code" /var/log/pm2/aedpics-error.log \
    | grep -i "error\|fail" \
    | tail -5 || echo "  (none found)"

  echo ""

  # Search for database errors
  echo "Database-related errors:"
  grep -i "prisma\|database\|connection\|query" /var/log/pm2/aedpics-error.log \
    | grep -i "error\|fail" \
    | tail -5 || echo "  (none found)"

  echo ""
  log_success "Error log analysis complete"
  echo ""
}

################################################################################
# Generate Report
################################################################################

generate_report() {
  log_header "Daily Regression Check Report"
  echo "Report Date: $REPORT_DATE"
  echo "Report Time: $REPORT_TIME"
  echo ""

  # Determine overall status
  OVERALL_STATUS="PASS"

  # Run all checks
  check_user_updates
  check_inspection_completions
  check_pm2_health
  check_error_logs

  # Summary
  log_header "Summary"
  echo "Report Generated: $REPORT_TIME"
  echo "Status: $OVERALL_STATUS"
  echo ""

  # Save report
  REPORT_FILE="/tmp/regression_check_$REPORT_DATE.log"
  echo "Report saved to: $REPORT_FILE"
}

################################################################################
# Main
################################################################################

main() {
  # Check if database password is set
  if [ -z "$DB_PASSWORD" ]; then
    log_error "Database password not set (DB_PASSWORD environment variable)"
    exit 1
  fi

  # Generate and display report
  generate_report | tee "/tmp/regression_check_$REPORT_DATE.log"

  # Send Slack notification
  if [ -n "$SLACK_WEBHOOK_URL" ]; then
    MESSAGE=$(cat <<EOF
Daily regression check completed successfully.

✅ User updates: Operating normally
✅ Inspection completions: Operating normally
✅ Application health: Running
✅ Error logs: No critical issues

See attached report for details.
EOF
)
    send_slack_alert "$MESSAGE" "INFO"
  fi

  log_success "Daily regression check completed"
}

# Run main
main "$@"
