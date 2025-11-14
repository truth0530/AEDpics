# TNMS API 수동 테스트 가이드

**목적**: 실제 사용자 계정으로 TNMS API의 401/403 권한 검증 확인

**소요 시간**: 약 15분

---

## 준비 단계

### 1. 개발 서버 시작
```bash
npm run dev
```

대기: 8-10초 동안 서버가 시작될 때까지 기다림

확인: 터미널에 "Ready in" 메시지 표시

### 2. 데이터베이스 테스트 사용자 확인
```bash
# 테스트 사용자 확인 (필수)
psql $DATABASE_URL -c "
  SELECT id, email, role FROM aedpics.user_profiles
  LIMIT 5;
"
```

사용자 역할:
- `admin`: 관리자 권한 (모든 기능 접근 가능)
- `user`: 일반 사용자 (읽기 전용)
- `health_center_admin`: 보건소 관리자 (해당 지역만)

### 3. 테스트용 이메일 준비
```
비관리자: user@example.com (또는 실제 user 이메일)
관리자: admin@nmc.or.kr (또는 실제 admin 이메일)
```

---

## 테스트 케이스 1: 인증 없이 POST 요청 (401 Unauthorized)

### 단계 1: 터미널에서 curl로 테스트
```bash
curl -X POST http://localhost:3000/api/tnms/validate \
  -H "Content-Type: application/json" \
  -d '{"log_id": "1", "manual_review_status": "approved"}'
```

### 예상 결과
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

### HTTP 상태 코드
```
401 Unauthorized
```

### 검증 체크리스트
- [ ] 상태 코드: 401
- [ ] 응답에 "Unauthorized" 포함
- [ ] 응답에 "Authentication required" 포함

---

## 테스트 케이스 2: 비관리자로 로그인 후 POST 요청 (403 Forbidden)

### 단계 1: 브라우저에서 로그인
```
URL: http://localhost:3000/auth/signin
```

### 단계 2: 비관리자 계정으로 로그인
- 이메일: `user@example.com` (또는 실제 일반 사용자 이메일)
- 비밀번호: 해당 사용자의 비밀번호

### 단계 3: 로그인 확인
로그인 후:
- 대시보드 페이지로 리다이렉트됨
- URL: `http://localhost:3000/dashboard`

### 단계 4: 개발자 도구에서 쿠키 확인
```
F12 → Application → Cookies → http://localhost:3000
```

쿠키 찾기:
- `next-auth.session-token` 또는 `__Secure-next-auth.session-token`

### 단계 5: curl로 POST 요청 (세션 포함)
```bash
# 쿠키 값 설정
COOKIE_VALUE="your-session-token-value"

# POST 요청
curl -X POST http://localhost:3000/api/tnms/validate \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=$COOKIE_VALUE" \
  -d '{"log_id": "1", "manual_review_status": "approved"}'
```

### 예상 결과
```json
{
  "error": "Forbidden",
  "message": "Only administrators can update validation logs"
}
```

### HTTP 상태 코드
```
403 Forbidden
```

### 검증 체크리스트
- [ ] 상태 코드: 403 (또는 400/500 - 데이터 없으면)
- [ ] 응답에 "Forbidden" 포함
- [ ] 응답에 "Only administrators" 포함

---

## 테스트 케이스 3: 관리자로 로그인 후 POST 요청 (200 또는 400)

### 단계 1: 로그아웃
```
http://localhost:3000/auth/signin 에서 로그아웃 버튼
```

또는 쿠키 삭제:
```bash
# 브라우저 개발자 도구에서
# Application → Cookies → localhost → 삭제
```

### 단계 2: 관리자 계정으로 로그인
- 이메일: `admin@nmc.or.kr` (또는 실제 관리자 이메일)
- 비밀번호: 관리자 비밀번호

### 단계 3: 로그인 확인
- 대시보드로 이동됨
- 관리자 메뉴 항목 표시

### 단계 4: 개발자 도구에서 새 쿠키 확인
```
F12 → Application → Cookies
```

### 단계 5: curl로 POST 요청 (관리자 세션)
```bash
# 새로운 쿠키 값으로 설정
ADMIN_COOKIE="admin-session-token"

curl -X POST http://localhost:3000/api/tnms/validate \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=$ADMIN_COOKIE" \
  -d '{"log_id": "1", "manual_review_status": "approved"}'
```

### 예상 결과
```json
{
  "success": true,
  "data": {
    "log_id": "1",
    "manual_review_status": "approved",
    "reviewed_by": "admin@nmc.or.kr"
  },
  "timestamp": "2025-11-14T..."
}
```

또는 유효하지 않은 log_id 시:
```json
{
  "success": false,
  "error": "Failed to update validation log",
  "details": "..."
}
```

### HTTP 상태 코드
```
200 OK (성공) 또는 400/500 (데이터 오류)
```

### 검증 체크리스트
- [ ] 상태 코드: 200/400/500 (403 아님)
- [ ] 403 Forbidden 에러 없음
- [ ] 요청이 처리됨 (성공 또는 데이터 검증 에러)

---

## 테스트 케이스 4: @nmc.or.kr 도메인 관리자 테스트

### 단계 1: @nmc.or.kr 이메일로 가입
```
Email: testadmin@nmc.or.kr
```

### 단계 2: 데이터베이스에서 역할 확인
```bash
psql $DATABASE_URL -c "
  SELECT email, role FROM aedpics.user_profiles
  WHERE email LIKE '%@nmc.or.kr';
"
```

### 단계 3: @nmc.or.kr 이메일로 로그인
- 이메일: `testadmin@nmc.or.kr`
- 비밀번호: 설정한 비밀번호

### 단계 4: POST 요청 수행
```bash
curl -X POST http://localhost:3000/api/tnms/validate \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=$NMC_COOKIE" \
  -d '{"log_id": "1", "manual_review_status": "approved"}'
```

### 예상 결과
```
@nmc.or.kr 도메인이면 관리자 권한이 자동으로 부여됨
상태 코드: 200/400/500 (403 아님)
```

### 검증 체크리스트
- [ ] @nmc.or.kr 이메일: 관리자 권한 자동 부여
- [ ] 403 Forbidden 에러 없음
- [ ] POST 요청 처리됨

---

## 모든 엔드포인트 테스트

### POST /api/tnms/recommend (모든 인증 사용자)
```bash
# 비관리자로도 접근 가능
curl -X POST http://localhost:3000/api/tnms/recommend \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=$COOKIE" \
  -d '{"institution_name": "서울보건소"}'
```

**예상**: 200 OK (요청 처리됨)

### GET /api/tnms/metrics (모든 인증 사용자)
```bash
curl -X GET "http://localhost:3000/api/tnms/metrics" \
  -H "Cookie: next-auth.session-token=$COOKIE"
```

**예상**: 200 OK (모든 인증 사용자 접근 가능)

### POST /api/tnms/metrics (관리자만)
```bash
curl -X POST http://localhost:3000/api/tnms/metrics \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=$COOKIE" \
  -d '{"metric_date": "2025-11-14"}'
```

**비관리자**: 403 Forbidden
**관리자**: 200/201 OK

---

## 결과 기록

테스트 완료 후 다음을 기록하세요:

```markdown
## TNMS API 수동 테스트 결과

테스트 날짜: 2025-11-14
테스트자: [이름]

### 401 Unauthorized (인증 없음)
- POST /api/tnms/validate: [✅ PASS / ❌ FAIL]
- POST /api/tnms/metrics: [✅ PASS / ❌ FAIL]

### 403 Forbidden (비관리자)
- POST /api/tnms/validate: [✅ PASS / ❌ FAIL]
- POST /api/tnms/metrics: [✅ PASS / ❌ FAIL]

### 200 OK (관리자)
- POST /api/tnms/validate: [✅ PASS / ❌ FAIL]
- POST /api/tnms/metrics: [✅ PASS / ❌ FAIL]

### @nmc.or.kr 도메인 관리자
- 자동 권한 부여: [✅ PASS / ❌ FAIL]

### 전체 결과
- [✅ 모두 통과 / ❌ 일부 실패]

실패 항목이 있으면 상세 정보 기록:
- 예상 값:
- 실제 값:
- 에러 메시지:
```

---

## 문제 해결

### 로그인이 되지 않음
```bash
# 사용자 존재 확인
psql $DATABASE_URL -c "
  SELECT * FROM aedpics.user_profiles
  WHERE email = 'test@example.com';
"
```

### 쿠키를 얻을 수 없음
```bash
# NextAuth 디버그 모드
echo "NEXTAUTH_DEBUG=true" >> .env.local
npm run dev
```

### 403 대신 500 에러 발생
```bash
# 로그 확인
npm run dev 출력 확인
```

---

## 자동화 테스트 실행

수동 테스트 대신 자동화 스크립트 사용:

```bash
# 401 테스트 (자동화)
npm run test:tnms

# 403 테스트 (가이드 포함)
node scripts/test/tnms-403-test.mjs
```

---

**테스트 완료 후**: 결과를 기록하고 Git에 커밋하세요.

```bash
git add docs/testing/TNMS_MANUAL_TEST_GUIDE.md
git commit -m "test: TNMS 수동 테스트 완료"
git push
```
