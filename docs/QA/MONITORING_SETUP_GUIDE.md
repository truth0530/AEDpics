# Automated Regression Monitoring Setup Guide

## Overview

This guide explains how to set up and maintain automated regression monitoring for the two production fixes deployed on 2025-11-07:

1. **Fix #1**: Inspection Complete Button - completeSession() logging
2. **Fix #2**: User Information Update - Prisma field naming (snake_case)

---

## Part 1: PM2 Log Samples (Documentation)

### What It Does
Provides reference samples of expected log outputs for troubleshooting and incident response.

### Location
[docs/QA/PM2_LOG_SAMPLES.md](PM2_LOG_SAMPLES.md)

### How to Use

**During Testing**:
```bash
# Run QA test
# Then immediately check logs
pm2 logs --lines 20

# Compare with sample in PM2_LOG_SAMPLES.md
# Expected success logs show 4 entries within 1 second
```

**During Incident Response**:
1. SSH to production
2. Check logs: `pm2 logs --err --lines 50`
3. Compare with samples in document
4. Identify if logs are missing (no network call) or show errors (API failure)

**Share with Team**:
```bash
# Capture and save log sample
pm2 logs --lines 50 > /tmp/incident_logs_$(date +%Y%m%d_%H%M%S).log

# Copy to Slack or email
```

---

## Part 2: Automatic Daily Regression Check Script

### What It Does

The script (`scripts/monitoring/daily-regression-check.sh`) automatically verifies:

1. **User Update Operations**:
   - Counts user_updated audit logs in last 24 hours
   - Verifies data actually persisted to database
   - Detects audit/DB mismatches (early warning of camelCase regression)

2. **Inspection Completions**:
   - Counts inspections marked as 'completed' in last 24 hours
   - Detects potentially hung/incomplete inspections
   - Monitors for timeout or network issues

3. **Application Health**:
   - Checks PM2 process status
   - Monitors recent error logs
   - Verifies Slack webhook connectivity

4. **Error Log Analysis**:
   - Searches for specific error patterns
   - Detects Prisma/database issues
   - Identifies user update and inspection-related errors

### Location
[scripts/monitoring/daily-regression-check.sh](../../scripts/monitoring/daily-regression-check.sh)

### Manual Execution

**Run locally** (development):
```bash
# Set environment variables
export DB_PASSWORD="your_password"
export DB_HOST="pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com"
export DB_USER="aedpics_admin"
export DB_NAME="aedpics_production"
export SLACK_WEBHOOK_URL="https://hooks.slack.com/..." # optional

# Make executable
chmod +x scripts/monitoring/daily-regression-check.sh

# Run
scripts/monitoring/daily-regression-check.sh
```

**Run on production server**:
```bash
# SSH to server
ssh admin@223.130.150.133

# Set environment variables
export DB_PASSWORD="$YOUR_DB_PASSWORD"
export SLACK_WEBHOOK_URL="$YOUR_SLACK_WEBHOOK"

# Run script
bash /path/to/daily-regression-check.sh
```

**Output**:
- Console output with color-coded results (✅ success, ❌ error, ⚠️  warning)
- Log file: `/tmp/regression_check_YYYY-MM-DD.log`
- Slack notification (if webhook configured)
- GitHub issue creation (if failures detected)

### What "Normal" Looks Like

**Success Run**:
```
✅ User updates detected and logged
✅ All user updates verified in database
✅ Inspection completions detected
✅ No stuck inspections detected
✅ PM2 health check complete
✅ Daily regression check completed
```

**Warning Run** (may be normal):
```
⚠️  No user updates in last 24 hours (may be normal)
⚠️  No inspection completions in last 24 hours (may be normal)
```

**Error Run** (investigation needed):
```
❌ Found 3 audit log/database mismatches!
❌ Inspection data not persisting to database
❌ Database password not set (DB_PASSWORD environment variable)
```

---

## Part 3: GitHub Actions Automated Scheduling

### What It Does

Runs the regression check script automatically every day at 08:00 KST (23:00 UTC) via GitHub Actions.

### Location
[.github/workflows/daily-regression-check.yml](.github/workflows/daily-regression-check.yml)

### Setup Instructions

#### Step 1: Add Repository Secrets

Go to **GitHub Settings** > **Secrets and variables** > **Actions**

Add these secrets:
```
DATABASE_PASSWORD              # NCP PostgreSQL password
SLACK_WEBHOOK_REGRESSION_CHECK # Slack webhook for alerts
```

**How to get Slack webhook**:
1. Go to Slack workspace
2. Create incoming webhook: https://api.slack.com/messaging/webhooks
3. Choose channel for regression check alerts
4. Copy webhook URL
5. Add to GitHub secrets

#### Step 2: Verify Workflow is Enabled

1. Go to **GitHub** > **Actions** > **Daily Regression Check**
2. Should show as "Active"
3. Next scheduled run time shown at bottom

#### Step 3: Test Manually (First Time)

1. Go to **Actions** > **Daily Regression Check**
2. Click **Run workflow**
3. Choose branch (main)
4. Click **Run workflow**
5. Monitor output in real-time
6. Check Slack for notification

### Workflow Steps

1. **Checkout code**: Gets latest repository code
2. **Install PostgreSQL client**: Required for database queries
3. **Run regression check**: Executes monitoring script
4. **Upload report**: Saves report to GitHub artifacts (30-day retention)
5. **Create issue if critical**: Auto-creates issue if failures detected

### Monitoring the Workflow

**In GitHub**:
```
Actions > Daily Regression Check > [Latest Run]
```

Status indicators:
- ✅ Green: All checks passed
- ⚠️  Orange: Warnings but no critical issues
- ❌ Red: Critical failures, investigation needed

**In Slack**:
- Daily notifications at 08:00 KST
- Success: "Daily regression check completed successfully"
- Critical: "CRITICAL: User update data persistence issue detected"

**Email**:
- GitHub can email when workflows fail
- Configure at **Settings** > **Notifications**

---

## Part 4: Response Procedures

### When Monitoring Detects Issues

#### Scenario 1: User Update Data Mismatch

**Symptom**: `Found X audit log/database mismatches!`

**Action**:
1. SSH to production: `ssh admin@223.130.150.133`
2. Check recent user updates:
   ```bash
   psql -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com \
        -U aedpics_admin \
        -d aedpics_production \
        -c "SELECT * FROM audit_logs WHERE action='user_updated'
            ORDER BY created_at DESC LIMIT 5;"
   ```
3. Compare with actual user_profiles table values
4. Check if camelCase field names appear in logs (= regression to Fix #2)
5. If found, rollback to previous commit:
   ```bash
   git revert 9097472
   npm run build
   pm2 reload ecosystem.config.cjs
   ```

#### Scenario 2: Inspection Completions Not Persisting

**Symptom**: `Stuck inspections detected` or `Inspection data not persisting`

**Action**:
1. Check inspection complete button logs:
   ```bash
   pm2 logs --err | grep "InspectionSession:completeSession"
   ```
2. Look for error messages in API response
3. Check database connection:
   ```bash
   psql -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com \
        -U aedpics_admin \
        -d aedpics_production \
        -c "SELECT NOW();"
   ```
4. If database OK, check Prisma logs
5. If camelCase fields found, rollback to previous commit:
   ```bash
   git revert c6da14c
   npm run build
   pm2 reload ecosystem.config.cjs
   ```

#### Scenario 3: Multiple Critical Issues

**Symptom**: Red status, multiple failures in one run

**Action** (Emergency Procedure):
1. Alert team in Slack immediately
2. Consider rollback to last known-good state:
   ```bash
   git checkout 6f7efee  # Last stable before these fixes
   npm run build
   pm2 reload ecosystem.config.cjs
   ```
3. Create incident report
4. Analyze what went wrong
5. Plan re-deployment after fixes

---

## Part 5: Maintenance and Tuning

### Adjust Check Frequency

To run more frequently (e.g., every 4 hours instead of daily):

1. Edit `.github/workflows/daily-regression-check.yml`
2. Change cron schedule:
   ```yaml
   # Current: daily at 08:00 KST
   - cron: '0 23 * * *'

   # New: every 4 hours
   - cron: '0 */4 * * *'
   ```
3. Push changes

### Adjust Database Lookback Window

To check last 48 hours instead of 24 hours:

1. Edit `scripts/monitoring/daily-regression-check.sh`
2. Change `INTERVAL '24 hours'` to `INTERVAL '48 hours'`
3. Change `INTERVAL '1 hour'` to `INTERVAL '2 hours'`

### Add Custom Checks

To add additional checks (e.g., payment processing, email sending):

1. Add new function to `daily-regression-check.sh`:
   ```bash
   check_payment_operations() {
     log_header "Check X: Payment Operations"
     # Your SQL query here
     log_success "Payment check complete"
   }
   ```

2. Call function in `main()`:
   ```bash
   check_user_updates
   check_inspection_completions
   check_payment_operations  # NEW
   check_pm2_health
   ```

3. Commit and push

### Review Reports

GitHub stores reports for 30 days.

To access:
1. **Actions** > **Daily Regression Check**
2. Click on a run date
3. Scroll down to "Artifacts"
4. Download `regression-check-report-XXX`

---

## Part 6: Integration with Monitoring Tools

### Grafana Dashboard (Optional)

To display regression check results in Grafana:

1. Create data source pointing to PostgreSQL
2. Create dashboard with panels:
   - User updates (last 24 hours)
   - Inspection completions (last 24 hours)
   - Failed checks count
   - Last check timestamp

3. Sample panel query:
   ```sql
   SELECT
     COUNT(*) as total_updates,
     NOW() as timestamp
   FROM audit_logs
   WHERE action='user_updated'
     AND created_at >= NOW() - INTERVAL '24 hours';
   ```

### CloudWatch Monitoring (Optional)

To send metrics to AWS CloudWatch:

1. Edit `daily-regression-check.sh`
2. Add at end:
   ```bash
   aws cloudwatch put-metric-data \
     --namespace AEDpics \
     --metric-name RegressionCheckStatus \
     --value $CHECK_STATUS
   ```

3. Create CloudWatch dashboard for alerting

---

## Part 7: Team Communication

### Slack Integration

**Setup**:
1. Create dedicated Slack channel: `#aedpics-monitoring`
2. Get webhook URL
3. Add to GitHub secrets

**Expected Messages**:
```
[08:00 KST Daily] ✅ Regression check passed
  - 5 user updates verified
  - 12 inspections completed
  - No errors detected

[Any time] 🚨 CRITICAL: User update data mismatch
  - 3 mismatches found
  - See: [GitHub Actions URL]
```

### Email Notifications

**Setup**:
1. Go to **Settings** > **Notifications**
2. Enable "Email on workflow failures"

**How it works**:
- Email sent only if workflow fails
- Includes run URL and error details
- Can set up team distribution list

### Documentation Location

Share these resources with team:
1. **Incident Response**: [PM2_LOG_SAMPLES.md](PM2_LOG_SAMPLES.md)
2. **Deployment Details**: [DEPLOYMENT_SUMMARY_2025-11-07.md](DEPLOYMENT_SUMMARY_2025-11-07.md)
3. **QA Validation**: [POST_DEPLOYMENT_QA_2025-11-07.md](POST_DEPLOYMENT_QA_2025-11-07.md)
4. **This Guide**: [MONITORING_SETUP_GUIDE.md](MONITORING_SETUP_GUIDE.md)

---

## Part 8: Troubleshooting

### "GitHub workflow fails with 'DB_PASSWORD not set'"

**Fix**:
1. Go to **Settings** > **Secrets and variables** > **Actions**
2. Verify `DATABASE_PASSWORD` secret exists
3. If not, add it
4. Verify it's not in public repo (check `.env.example` has placeholder only)

### "Slack notifications not received"

**Fix**:
1. Verify webhook URL is correct: `echo $SLACK_WEBHOOK_URL`
2. Test manually: `curl -X POST -H 'Content-type: application/json' --data '{"text":"test"}' $SLACK_WEBHOOK_URL`
3. Check Slack channel is correct in workflow
4. Verify bot permissions in Slack workspace

### "Script runs but finds false positives"

**Fix**:
1. Check SQL queries in script (may need adjustment for your data patterns)
2. Adjust timeframes: change `24 hours` to `48 hours` if traffic is low
3. Add filtering for test accounts/data

### "Database connection times out"

**Fix**:
1. Verify database is accessible from GitHub Actions runner
2. Check security groups on NCP allow GitHub IPs
3. Verify credentials are correct
4. Try manual query:
   ```bash
   psql -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com \
        -U aedpics_admin \
        -d aedpics_production \
        -c "SELECT NOW();"
   ```

---

## Summary Checklist

### Initial Setup
- [ ] Created GitHub secrets (DATABASE_PASSWORD, SLACK_WEBHOOK_REGRESSION_CHECK)
- [ ] Verified workflow is enabled
- [ ] Tested workflow manually once
- [ ] Verified Slack notifications received
- [ ] Shared documentation with team

### Ongoing Operations
- [ ] Review daily reports (or set Slack notifications)
- [ ] Keep PM2_LOG_SAMPLES.md up-to-date
- [ ] Monitor for false positives (adjust timeframes if needed)
- [ ] Add additional checks as needed
- [ ] Review reports monthly for trends

### Incident Response
- [ ] Team knows to check PM2_LOG_SAMPLES.md
- [ ] Rollback procedure documented and tested
- [ ] Team has access to production server
- [ ] Slack channel configured for emergency alerts

---

## References

- **Regression Check Script**: [scripts/monitoring/daily-regression-check.sh](../../scripts/monitoring/daily-regression-check.sh)
- **GitHub Workflow**: [.github/workflows/daily-regression-check.yml](.github/workflows/daily-regression-check.yml)
- **PM2 Log Samples**: [PM2_LOG_SAMPLES.md](PM2_LOG_SAMPLES.md)
- **Deployment Summary**: [DEPLOYMENT_SUMMARY_2025-11-07.md](DEPLOYMENT_SUMMARY_2025-11-07.md)

---

**Document Version**: 1.0
**Created**: 2025-11-07
**Last Updated**: 2025-11-07
**Audience**: DevOps, Backend Engineers, QA Team
