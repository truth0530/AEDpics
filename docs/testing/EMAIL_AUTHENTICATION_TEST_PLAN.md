# Email Authentication Flow Test Plan

**Created**: 2025-10-28
**Status**: Ready for Testing
**Production URL**: https://aed.pics

## Overview

This document outlines the comprehensive test plan for email authentication functionality using NCP Cloud Outbound Mailer service.

## Prerequisites

### Server Configuration Required

Before testing, verify the following on the production server (223.130.150.133):

```bash
# SSH into production server
ssh root@223.130.150.133

# Navigate to application directory
cd /var/www/aedpics

# Verify .env file contains NCP email credentials
cat .env | grep -E 'NCP_ACCESS_KEY|NCP_ACCESS_SECRET|NCP_SENDER_EMAIL'

# Expected output:
# NCP_ACCESS_KEY=your_access_key_here
# NCP_ACCESS_SECRET=your_access_secret_here
# NCP_SENDER_EMAIL=noreply@aed.pics

# Check PM2 status
pm2 status

# Check PM2 environment variables
pm2 env 0 | grep -E 'NCP_ACCESS_KEY|NCP_ACCESS_SECRET|NCP_SENDER_EMAIL'

# If environment variables are not loaded, restart PM2
pm2 restart aedpics
pm2 save
```

### NCP Cloud Outbound Mailer Configuration

1. **Sender Email Verification**: `noreply@aed.pics` must be verified in NCP Console
   - Login to https://console.ncloud.com/cloudOutboundMailer
   - Navigate to: Cloud Outbound Mailer > Sender Email Management
   - Verify `noreply@aed.pics` status is "Verified"

2. **API Key Validation**: Confirm NCP_ACCESS_KEY and NCP_ACCESS_SECRET are correct
   - Location: NCP Console > My Page > Authentication Key Management
   - Check key creation date and permissions

3. **Monthly Limit**: Verify email quota
   - Default: 1,000,000 emails/month (free tier)
   - Check current usage in NCP Console

## Test Cases

### Test 1: User Registration with OTP Email

**Objective**: Verify new user can register and receive OTP via NCP email

**Steps**:
1. Navigate to https://aed.pics/auth/signup
2. Enter valid email from allowed domains:
   - Test with: `korea.kr`, `nmc.or.kr`, `gmail.com`, `naver.com`
3. Click "인증번호 받기" (Send OTP)
4. Check email inbox for OTP code
5. Enter OTP code in verification field
6. Click "인증 확인" (Verify)
7. Complete registration with:
   - Name
   - Password (min 8 characters)
   - Organization selection
   - Terms acceptance
8. Submit registration

**Expected Results**:
- OTP email delivered within 30 seconds
- Email subject: "[AED관리시스템] 이메일 인증번호"
- Email contains 6-digit OTP code
- OTP code expires after 5 minutes
- Successful registration creates user in `user_profiles` table with status "pending"
- Admin notification email sent to MASTER_EMAIL

**API Endpoints Involved**:
- POST `/api/auth/send-otp`
- POST `/api/auth/verify-otp`
- POST `/api/auth/signup`

**Database Verification**:
```sql
-- Check OTP was created
SELECT * FROM aedpics.email_verification_codes
WHERE email = 'test@korea.kr'
ORDER BY created_at DESC LIMIT 1;

-- Check user was created
SELECT * FROM aedpics.user_profiles
WHERE email = 'test@korea.kr';

-- Expected status: 'pending'
-- Expected approval_status: 'pending'
```

### Test 2: Domain Validation (Security)

**Objective**: Verify server-side email domain validation blocks invalid domains

**Steps**:
1. Navigate to https://aed.pics/auth/signup
2. Try to send OTP to invalid domains:
   - `test@invalidcompany.com`
   - `user@random-domain.net`
   - `admin@suspicious-site.org`
3. Observe error messages

**Expected Results**:
- Client-side validation blocks invalid domains immediately
- If bypassing client-side (via API), server returns 400 Bad Request
- Error message: "허용되지 않은 이메일 도메인입니다"

**Test Methods**:
```bash
# Test via curl (bypassing client-side validation)
curl -X POST https://aed.pics/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "test@invalid.com"}'

# Expected response:
# {"error": "허용되지 않은 이메일 도메인입니다."}
# Status: 400
```

### Test 3: Password Reset Flow

**Objective**: Verify existing users can reset passwords via email

**Steps**:
1. Navigate to https://aed.pics/auth/forgot-password
2. Enter registered email address
3. Click "비밀번호 재설정 링크 보내기" (Send reset link)
4. Check email inbox for password reset email
5. Click reset link in email
6. Enter new password (twice for confirmation)
7. Submit new password
8. Try logging in with new password

**Expected Results**:
- Password reset email delivered within 30 seconds
- Email subject: "[AED관리시스템] 비밀번호 재설정"
- Reset link valid for 1 hour
- Reset link format: `https://aed.pics/auth/reset-password?token=...`
- Successful password update
- Old password no longer works
- Can login with new password

**API Endpoints Involved**:
- POST `/api/auth/reset-password` (send email)
- POST `/api/auth/update-password` (update password)

**Database Verification**:
```sql
-- Check reset token was created
SELECT * FROM aedpics.password_reset_tokens
WHERE user_id = (SELECT id FROM aedpics.user_profiles WHERE email = 'test@korea.kr')
ORDER BY created_at DESC LIMIT 1;

-- Verify token expiration time is 1 hour from creation
-- Verify token is marked as used after password reset
```

### Test 4: Login/Logout Flow

**Objective**: Verify authentication after user approval

**Prerequisites**: User must be approved by admin (approval_status = 'approved')

**Steps**:
1. Admin approves user in admin panel
2. Navigate to https://aed.pics/auth/login
3. Enter email and password
4. Click "로그인" (Login)
5. Verify redirect to dashboard
6. Check session persistence (refresh page)
7. Click "로그아웃" (Logout)
8. Verify redirect to login page

**Expected Results**:
- Successful login creates NextAuth session
- User redirected to `/home` or appropriate dashboard
- Session persists across page refreshes
- Protected routes accessible after login
- Logout clears session
- Protected routes redirect to login after logout

**Session Verification**:
```bash
# Check NextAuth session in browser DevTools
# Application > Cookies > next-auth.session-token

# Verify session in database
SELECT * FROM aedpics.user_sessions
WHERE user_id = (SELECT id FROM aedpics.user_profiles WHERE email = 'test@korea.kr')
ORDER BY created_at DESC LIMIT 1;
```

### Test 5: Admin Notification on New Signup

**Objective**: Verify admin receives notification when new user registers

**Steps**:
1. Complete a new user registration (Test 1)
2. Check MASTER_EMAIL inbox (admin@nmc.or.kr)
3. Verify notification email received

**Expected Results**:
- Admin receives email notification within 30 seconds
- Email subject: "[AED관리시스템] 새로운 가입 신청"
- Email contains:
  - New user's email
  - New user's name
  - Organization
  - Registration timestamp
  - Link to admin approval page

**API Endpoint**:
- POST `/api/admin/notify-new-signup`

### Test 6: Rate Limiting

**Objective**: Verify rate limiting prevents abuse

**Steps**:
1. Send OTP request multiple times rapidly (>3 times in 1 minute)
2. Observe rate limiting response

**Expected Results**:
- After 3 OTP requests within 60 seconds, return 429 Too Many Requests
- Response includes:
  - `X-RateLimit-Limit: 3`
  - `X-RateLimit-Remaining: 0`
  - `X-RateLimit-Reset: <timestamp>`
  - `Retry-After: <seconds>`
- Error message: "너무 많은 시도입니다. 잠시 후 다시 시도해주세요."

**Test Method**:
```bash
# Send multiple OTP requests rapidly
for i in {1..5}; do
  curl -X POST https://aed.pics/api/auth/send-otp \
    -H "Content-Type: application/json" \
    -d '{"email": "test@korea.kr"}' \
    -i
  echo "Request $i completed"
done
```

### Test 7: NCP Email Retry Logic

**Objective**: Verify exponential backoff retry on email failures

**Test Method**: Monitor PM2 logs during email send operations

```bash
# On production server
pm2 logs aedpics --lines 100 | grep -A 5 'NCP Email'
```

**Expected Behavior**:
- First attempt immediate
- Second attempt after 1 second (if first fails)
- Third attempt after 2 seconds (if second fails)
- Log messages show retry attempts
- Final failure after 3 attempts

**Success Criteria**:
- Email delivery succeeds on retry after transient network errors
- Logs show: "NCP Email sent successfully on attempt X"

### Test 8: Email Content Validation

**Objective**: Verify email templates render correctly

**Verification Points**:

**OTP Email**:
- Subject: "[AED관리시스템] 이메일 인증번호"
- Contains 6-digit OTP code in large, readable font
- Contains expiration notice (5분 이내 입력)
- Sender: "AED관리시스템 <noreply@aed.pics>"
- HTML formatting renders correctly in Gmail, Naver, Daum

**Password Reset Email**:
- Subject: "[AED관리시스템] 비밀번호 재설정"
- Contains clickable reset link
- Link includes valid JWT token
- Contains expiration notice (1시간 이내)
- Sender: "AED관리시스템 <noreply@aed.pics>"

**Admin Notification Email**:
- Subject: "[AED관리시스템] 새로운 가입 신청"
- Contains user details in readable format
- Contains approval link
- Professional formatting

## Performance Benchmarks

### Email Delivery Times

| Scenario | Target | Acceptable |
|----------|--------|------------|
| OTP Email | < 10s | < 30s |
| Password Reset | < 10s | < 30s |
| Admin Notification | < 15s | < 60s |

### API Response Times

| Endpoint | Target | Acceptable |
|----------|--------|------------|
| /api/auth/send-otp | < 200ms | < 500ms |
| /api/auth/verify-otp | < 100ms | < 300ms |
| /api/auth/signup | < 300ms | < 1000ms |
| /api/auth/reset-password | < 200ms | < 500ms |
| /api/auth/update-password | < 200ms | < 500ms |

## Error Scenarios to Test

### 1. Network Failures
- Simulate NCP API timeout
- Verify retry logic activates
- Verify graceful error handling

### 2. Invalid OTP Code
- Enter wrong OTP code
- Verify error message
- Verify OTP remains valid (not consumed)

### 3. Expired OTP Code
- Request OTP
- Wait > 5 minutes
- Try to verify expired OTP
- Verify error message

### 4. Used OTP Code
- Verify OTP code once
- Try to reuse same OTP
- Verify rejection

### 5. Password Reset Token Expiry
- Request password reset
- Wait > 1 hour
- Try to reset password with expired token
- Verify error message

### 6. Concurrent OTP Requests
- Request OTP twice in quick succession
- Verify only latest OTP is valid
- Verify previous OTP is invalidated

## Monitoring and Logging

### Server Logs to Monitor

```bash
# Real-time PM2 logs
pm2 logs aedpics --lines 50

# Filter for email-related logs
pm2 logs aedpics | grep -E 'OTP|Email|NCP'

# Check for errors
pm2 logs aedpics --err

# Check application startup
pm2 logs aedpics | grep -A 10 'ready started server'
```

### Database Queries for Monitoring

```sql
-- Check recent OTP codes
SELECT email, code, used, expires_at, created_at
FROM aedpics.email_verification_codes
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 20;

-- Check pending user approvals
SELECT email, name, organization_code, created_at
FROM aedpics.user_profiles
WHERE approval_status = 'pending'
ORDER BY created_at DESC;

-- Check recent password reset requests
SELECT u.email, prt.token, prt.expires_at, prt.used, prt.created_at
FROM aedpics.password_reset_tokens prt
JOIN aedpics.user_profiles u ON prt.user_id = u.id
WHERE prt.created_at > NOW() - INTERVAL '1 day'
ORDER BY prt.created_at DESC;

-- Check recent login history
SELECT u.email, lh.login_time, lh.ip_address, lh.user_agent
FROM aedpics.login_history lh
JOIN aedpics.user_profiles u ON lh.user_id = u.id
WHERE lh.login_time > NOW() - INTERVAL '1 day'
ORDER BY lh.login_time DESC
LIMIT 20;
```

## Troubleshooting Guide

### Issue: OTP emails not being received

**Possible Causes**:
1. NCP environment variables not loaded in PM2
2. Sender email not verified in NCP Console
3. API keys incorrect or expired
4. Email marked as spam

**Diagnosis Steps**:
```bash
# Check PM2 environment variables
pm2 env 0 | grep NCP

# Check PM2 logs for errors
pm2 logs aedpics --err | grep -i email

# Test NCP API credentials manually
curl -X POST https://mail.apigw.ntruss.com/api/v1/mails \
  -H "x-ncp-apigw-timestamp: $(date +%s)000" \
  -H "x-ncp-iam-access-key: YOUR_ACCESS_KEY" \
  -H "x-ncp-apigw-signature-v1: YOUR_SIGNATURE" \
  -H "Content-Type: application/json" \
  -d '{
    "senderAddress": "noreply@aed.pics",
    "title": "Test Email",
    "body": "Test",
    "recipients": [{"address": "test@example.com", "name": "Test", "type": "R"}]
  }'
```

**Solutions**:
1. Restart PM2: `pm2 restart aedpics`
2. Verify sender email in NCP Console
3. Regenerate API keys if needed
4. Check spam folder and whitelist sender

### Issue: "Email service is not configured" error

**Cause**: NCP_ACCESS_KEY, NCP_ACCESS_SECRET, or NCP_SENDER_EMAIL not set

**Solution**:
```bash
# Verify .env file
cat /var/www/aedpics/.env | grep NCP

# Restart PM2 to reload environment variables
pm2 restart aedpics
pm2 save
```

### Issue: Rate limiting triggered too easily

**Cause**: Multiple test attempts or aggressive automation

**Solution**:
- Wait for rate limit reset (check `Retry-After` header)
- Adjust rate limit configuration in `lib/rate-limit.ts` if needed
- Use different email addresses for testing

## Success Criteria

All tests pass when:

- [ ] OTP emails delivered successfully within 30 seconds
- [ ] Domain validation blocks invalid email domains
- [ ] Password reset emails delivered successfully
- [ ] Login/logout flow works correctly
- [ ] Admin notifications sent on new signups
- [ ] Rate limiting prevents abuse
- [ ] Retry logic handles transient failures
- [ ] Email templates render correctly in major email clients
- [ ] All API response times within acceptable ranges
- [ ] Error scenarios handled gracefully
- [ ] Database records created correctly
- [ ] Logs show no critical errors

## Next Steps After Testing

1. **If tests pass**:
   - Mark email authentication flow as complete
   - Proceed to admin approval feature development
   - Update PRODUCTION_DEPLOYMENT_STATUS.md

2. **If tests fail**:
   - Document failures in detail
   - Check server logs for error messages
   - Verify NCP Console configuration
   - Fix issues and retest
   - Update this document with findings

## Related Documentation

- [NCP Production Setup Guide](../deployment/NCP_PRODUCTION_SETUP.md)
- [Production Deployment Status](../deployment/PRODUCTION_DEPLOYMENT_STATUS.md)
- [Environment Variables Example](../../.env.example)
- [NCP Email Implementation](../../lib/email/ncp-email.ts)

## Contact

For issues or questions:
- System Administrator: truth0530@nmc.or.kr
- Technical Support: inhak@nmc.or.kr
- Project Manager: woo@nmc.or.kr

---

**Last Updated**: 2025-10-28
**Author**: Claude (AI Assistant)
**Review Status**: Pending User Review
