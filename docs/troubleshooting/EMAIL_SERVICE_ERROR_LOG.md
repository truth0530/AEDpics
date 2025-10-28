# Email Service Configuration Error - Troubleshooting Log

**Date**: 2025-10-28
**Error**: "Email service is not configured"
**Location**: https://aed.pics/auth/signup

## Problem Description

회원가입 시 "인증번호 발송" 버튼 클릭 시 "Email service is not configured" 오류 발생.

## Confirmed Facts

### Server Status
- PM2 status: **online** (정상)
- Next.js: 15.5.2 running on port 3000
- Database: 연결 성공 (DATABASE_URL URL 인코딩 완료)
- Website: https://aed.pics 정상 접속

### Environment Variables (.env file)
File exists: `/var/www/aedpics/.env`
- File type: ASCII text (정상)
- File size: 1696 bytes
- Contains:
  ```
  NCP_ACCESS_KEY="ncp_iam_***"
  NCP_ACCESS_SECRET="ncp_iam_***"
  NCP_SENDER_EMAIL="noreply@aed.pics"
  DATABASE_URL="postgresql://aedpics_admin:***@..."
  ```

## Failed Attempts (Do NOT Repeat)

### Attempt 1: Simple PM2 Restart
```bash
pm2 restart aedpics
```
**Result**: FAILED - Same error

### Attempt 2: PM2 with --env flag
```bash
pm2 delete aedpics
pm2 start npm --name aedpics -- start --env /var/www/aedpics/.env
```
**Result**: FAILED - Created `.env` directory instead of reading file
**Error**: `ENOTDIR: not a directory, stat '/var/www/aedpics/.env/.env'`

### Attempt 3: Simple PM2 Restart (Repeated)
```bash
pm2 delete aedpics
pm2 start npm --name aedpics -- start
pm2 save
```
**Result**: FAILED - Same "Email service is not configured" error

## Root Cause Hypothesis

**Issue**: Next.js는 `.env` 파일을 빌드 타임에 읽지만, 프로덕션 모드(`npm start`)에서는 환경변수가 **프로세스 환경변수로 설정**되어야 합니다.

`.env` 파일이 존재해도 Next.js 프로덕션 모드는 이를 자동으로 읽지 않습니다.

## Next Steps (New Approach)

### Option A: Check Code Implementation (COMPLETED)
1. Read `/app/api/auth/send-otp/route.ts` - DONE
2. Verify how NCP environment variables are accessed - DONE
3. Check if `process.env.NCP_ACCESS_KEY` is used - CONFIRMED

**Result**: Code checks for `NCP_ACCESS_KEY`, `NCP_ACCESS_SECRET`, `NCP_SENDER_EMAIL`

### Option B: Set Environment Variables for PM2 (FAILED)
1. Use PM2 ecosystem file with explicit `env` section - FAILED (GitHub Secret Scanning blocked)
2. OR export environment variables before starting PM2 - NOT TESTED
3. OR use dotenv module to load .env at runtime - IN PROGRESS

**GitHub blocked commit** due to secrets in ecosystem.config.js file.

### Option C: Verify Runtime Environment (COMPLETED)
1. Add console.log to API route to check if env vars exist - NOT NEEDED
2. Test API endpoint directly with curl - NOT NEEDED
3. Check PM2 environment: `pm2 env 0` - TESTED (vars not loaded)

## Investigation Results

- [x] Check if Next.js production mode reads .env files - CONFIRMED: Does NOT read .env in production
- [x] Verify API route code for NCP email service - COMPLETED
- [x] Test if environment variables are accessible in runtime - CONFIRMED: NOT accessible
- [x] Check if dotenv is installed and configured - CONFIRMED: dotenv v17.2.2 installed

## Solution (Attempt 4 - NEW APPROACH)

### Using dotenv with npm script

**Strategy**: Modify package.json to use `node -r dotenv/config` to load .env file at runtime

**Implementation**:
1. Added `start:prod` script in package.json
2. Script: `node -r dotenv/config node_modules/.bin/next start`
3. This loads .env file before starting Next.js

**Advantage**:
- No secrets in Git repository
- Uses existing .env file on server
- Short commands for NCP console (no copy/paste needed)

**Commands to execute in NCP console**:
```bash
cd /var/www/aedpics
git pull origin main
pm2 delete aedpics
pm2 start "npm run start:prod" --name aedpics
pm2 save
```

**Expected Result**: Environment variables loaded from .env file, email service works

## Status

**Current Status**: SOLUTION READY
**Solution**: Use dotenv with npm script to load .env at runtime
**Next Action**: Execute commands in NCP console (4 short commands)
