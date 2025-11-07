# PM2 Log Samples Reference - 2025-11-07

## Purpose
This document provides sample log outputs for troubleshooting. When production issues occur, compare actual logs with these samples to quickly diagnose the problem.

---

## Fix 1: Inspection Complete Session (completeSession)

### Expected Success Log Sequence

```
[11-07 00:45:23] [APP] [INFO]  InspectionSession:completeSession - Completing inspection
  sessionId: "sess-abc123def456"
  equipmentSerial: "AED-KR-001-00123"
  currentStep: 5

[11-07 00:45:24] [APP] [INFO]  InspectionSession:completeSession - Inspection completed successfully
  sessionId: "sess-abc123def456"
  equipmentSerial: "AED-KR-001-00123"
  status: "completed"
```

### What This Means
- Line 1: Function called with session ID and equipment info
- Line 2: API request succeeded, inspection marked as completed in database
- **Status**: ✅ WORKING - Both logs present within 1 second

### Expected Error Log Sequence

```
[11-07 00:45:23] [APP] [INFO]  InspectionSession:completeSession - Completing inspection
  sessionId: "sess-abc123def456"
  equipmentSerial: "AED-KR-001-00123"
  currentStep: 5

[11-07 00:45:24] [APP] [ERROR] InspectionSession:completeSession - API error response
  status: 500
  statusText: "Internal Server Error"
  body: "Error: Cannot update inspection: invalid_field"

[11-07 00:45:24] [APP] [ERROR] InspectionSession:completeSession - Failed to complete inspection
  sessionId: "sess-abc123def456"
  equipmentSerial: "AED-KR-001-00123"
  error: "API 오류 (500): Error: Cannot update inspection: invalid_field"
```

### What This Means
- Line 1: Function called normally
- Line 2: API returned error response (500 or 4xx)
- Line 3: Error caught, logged, and re-thrown to UI
- **Status**: ⚠️ EXPECTED ERROR HANDLING - Logs show what went wrong

### Missing Log = Problem

**If you see**:
```
[11-07 00:45:23] [APP] [INFO]  InspectionSession:completeSession - Completing inspection
  sessionId: "sess-abc123def456"
  equipmentSerial: "AED-KR-001-00123"
  currentStep: 5

(no more logs after this)
```

**Problem**: API request never returned (timeout or network issue)
**Action**: Check network logs, increase timeout, verify API endpoint

---

## Fix 2: User Information Update

### Expected Success Log Sequence

```
[11-07 00:50:12] [APP] [INFO]  PATCH /api/admin/users/update
  userId: "user-789xyz"
  targetEmail: "jisung@example.com"
  changes: {
    role: "pending_approval" → "local_admin"
    organization_id: null → "org-456"
    region_code: null → "DGU"
  }

[11-07 00:50:12] [APP] [INFO]  User profile updated successfully
  userId: "user-789xyz"
  email: "jisung@example.com"
  updatedFields: ["role", "organization_id", "region_code"]

[11-07 00:50:13] [APP] [INFO]  Audit log created
  action: "user_updated"
  actor: "truth0530@nmc.or.kr"
  target: "jisung@example.com"

[11-07 00:50:13] [APP] [INFO]  Notification sent
  recipient: "user-789xyz"
  type: "role_updated"
  message: "계정 정보가 수정되었습니다. 역할: 보건소 담당자"
```

### What This Means
- Line 1: API request received with update details
- Line 2: Prisma update succeeded, fields changed
- Line 3: Audit log recorded (for compliance)
- Line 4: Notification sent to user
- **Status**: ✅ WORKING - All 4 operations completed

### Expected Prisma Field Error (Before Fix)

```
[11-07 00:50:12] [APP] [INFO]  PATCH /api/admin/users/update
  userId: "user-789xyz"
  targetEmail: "jisung@example.com"
  changes: {
    organizationId: null → "org-456"  ❌ camelCase (WRONG)
    regionCode: null → "DGU"           ❌ camelCase (WRONG)
  }

[11-07 00:50:12] [APP] [WARN]  Prisma silently ignored unknown fields
  unknownFields: ["organizationId", "regionCode"]

[11-07 00:50:12] [APP] [INFO]  User profile updated successfully
  userId: "user-789xyz"
  email: "jisung@example.com"
  updatedFields: []  ❌ EMPTY - Nothing actually changed!
```

### What This Means
- Line 1-2: camelCase field names don't match Prisma schema
- Line 3-4: Prisma silently ignored them (no error thrown)
- **Status**: ❌ BUG - Changes didn't persist, but no error message
- **User sees**: Success message, but database unchanged

---

## How to Capture Logs

### View Real-time Logs

```bash
# SSH to production server
ssh admin@223.130.150.133

# View all logs
pm2 logs

# View specific app
pm2 logs aedpics

# View last 50 lines
pm2 logs --lines 50

# View errors only
pm2 logs --err

# View 1 minute of logs
pm2 logs --lines 1000 | grep "$(date '+%H:%M')"
```

### View Specific Error Logs

```bash
# View inspection-related errors
pm2 logs --err | grep -i "inspection\|complete"

# View user update errors
pm2 logs --err | grep -i "user_update\|organization\|region"

# View last error only
pm2 logs --err --lines 1
```

### Save Log Sample for Documentation

```bash
# Capture 30 lines of logs and save to file
pm2 logs --lines 30 > /tmp/pm2_sample_$(date +%Y%m%d_%H%M%S).log

# View saved logs
cat /tmp/pm2_sample_*.log
```

---

## Using These Samples

### For Troubleshooting During Testing

1. Run QA test (e.g., inspection complete)
2. Immediately check PM2 logs: `pm2 logs --lines 20`
3. Compare with samples above
4. If missing logs → Check logger configuration
5. If error logs → See error message details

### For Incident Response

1. User reports issue (e.g., "완료 버튼 눌러도 안 됨")
2. SSH to production: `ssh admin@223.130.150.133`
3. Check recent logs: `pm2 logs --err --lines 100 | grep -i inspection`
4. Compare with success log sample above
5. Identify if:
   - Missing logs → No network call
   - Error logs → API failure
   - Success logs → Issue is in UI or browser-side

### For Performance Monitoring

**Expected Response Time**: 500-1000ms from API call to completion log
```bash
# Find time between two logs
grep "Completing inspection" /var/log/pm2/aedpics-error.log
grep "Inspection completed successfully" /var/log/pm2/aedpics-error.log
# Calculate time difference
```

---

## Sample Log Locations

### Production Server
```
/var/log/pm2/aedpics-out.log       # Standard output
/var/log/pm2/aedpics-error.log     # Error output
```

### Local Development
```
Console (DevTools F12 > Console tab)
Terminal running: npm run dev
```

---

## Creating Custom Monitoring

### Simple Bash Script to Check for Recent Errors

```bash
#!/bin/bash
# check-production-errors.sh

LOGFILE="/var/log/pm2/aedpics-error.log"
SINCE_MINUTES=5

echo "Checking for errors in last $SINCE_MINUTES minutes..."
echo ""

# Look for inspection errors
echo "[Inspection Complete Errors]"
tail -500 "$LOGFILE" | grep "InspectionSession:completeSession" | tail -5
echo ""

# Look for user update errors
echo "[User Update Errors]"
tail -500 "$LOGFILE" | grep "user_update\|organizationId\|regionCode" | tail -5
echo ""

# Look for database errors
echo "[Database Errors]"
tail -500 "$LOGFILE" | grep "Prisma\|database\|connection" | tail -5
echo ""

echo "Last error logged:"
tail -1 "$LOGFILE"
```

**Usage**:
```bash
chmod +x check-production-errors.sh
./check-production-errors.sh
```

---

## Sharing Logs to Team

### For Slack Alerts (Recommended)

When errors occur, capture and share:

```bash
# Capture last 20 error lines
ERROR_LOG=$(pm2 logs --err --lines 20)

# Format for Slack
cat << EOF > /tmp/slack_alert.txt
🚨 Production Error Detected
Time: $(date)
Errors:
$ERROR_LOG
EOF

# Share file or copy to clipboard
cat /tmp/slack_alert.txt | xclip -selection clipboard
```

### For Documentation

```bash
# Save timestamped log sample
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
pm2 logs --lines 50 > "/tmp/log_sample_$TIMESTAMP.txt"

# Copy to docs folder for reference
cp "/tmp/log_sample_$TIMESTAMP.txt" \
   "/path/to/docs/log_samples/production_$TIMESTAMP.log"
```

---

## Testing Your Logging

### Verify Logging Works Locally

```typescript
// In your code
logger.info('InspectionSession:completeSession', 'Completing inspection', {
  sessionId: session.id,
  equipmentSerial: session.equipment_serial,
});

// Open browser DevTools (F12)
// Go to Console tab
// Should see formatted log message
// Expected output:
// [INFO] InspectionSession:completeSession - Completing inspection
//   sessionId: "..."
//   equipmentSerial: "..."
```

### Verify PM2 Logging Works

```bash
# SSH to server
ssh admin@223.130.150.133

# Trigger test inspection in UI (from another terminal)
# Then immediately check logs
pm2 logs aedpics

# Should see messages appear in real-time
```

---

## Troubleshooting Logger Issues

### If Logs Don't Appear

**Check 1**: Logger is initialized
```typescript
import { logger } from '@/lib/logger';

// Make sure logger is imported, not just logging to console
```

**Check 2**: Log level is appropriate
```typescript
logger.info(...)   // ✅ Should show
logger.debug(...)  // ❓ May not show in production
logger.error(...)  // ✅ Should show
```

**Check 3**: PM2 env is correct
```bash
pm2 show aedpics | grep -i "env\|NODE_ENV"
# Should show: NODE_ENV=production
```

**Check 4**: Restart PM2 after code changes
```bash
pm2 reload ecosystem.config.cjs
# or
pm2 restart aedpics
```

---

## Reference

- Logger Implementation: [lib/logger.ts](../../lib/logger.ts)
- Inspection Store: [lib/state/inspection-session-store.ts](../../lib/state/inspection-session-store.ts#L419)
- User Update API: [app/api/admin/users/update/route.ts](../../app/api/admin/users/update/route.ts#L154)
- PM2 Config: [ecosystem.config.cjs](../../ecosystem.config.cjs)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-07
**Audience**: Developers, QA Engineers, DevOps Team
