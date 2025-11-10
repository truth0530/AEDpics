# 스테이징 테스트 빠른 시작 가이드

**작성일**: 2025-11-10
**상태**: 스테이징 배포 완료 후 실행
**예상 소요시간**: 1-2시간 (4개 필수 테스트)

---

## 배포 확인 (배포 완료 후 즉시 실행)

배포 완료 직후 이 명령어들을 실행하여 서버 상태를 확인하세요:

```bash
# 스테이징 서버에 접속
ssh user@staging-server

# 1. 프로세스 상태 확인 (온라인 상태 확인)
pm2 status

# 2. 웹 응답 확인 (HTTP 200 OK 확인)
curl -I https://staging.aed.pics

# 3. 로그 확인 (에러 없는지 확인)
pm2 logs --err --lines 20
```

**성공 기준**:
- [ ] pm2 status에서 status가 "online"
- [ ] curl -I 응답이 "HTTP/2 200"
- [ ] 에러 로그 없음 (또는 이전 에러만 있음)

---

## 필수 테스트 4가지

### Test 1: 로그인 성능 (15분)

**목표**: 스피너 표시 < 200ms, 전체 완료 < 2초

**실행 방법**:
1. Chrome 개발자 도구 열기 (F12)
2. Network 탭 → Throttling을 "No throttling"으로 설정
3. Console 탭 열기 (F12 → Console)
4. 아래 코드 붙여넣고 엔터:

```javascript
// 로그인 성능 측정 코드
console.time('LOGIN_TOTAL');
console.time('SPINNER_DELAY');

// 페이지에 설정된 setRedirecting 호출 감시
const originalSetState = Object.getOwnPropertyDescriptor(
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.currentFiber?.return?.memoizedState || {},
  'setState'
);

// 이메일/비밀번호 입력
document.querySelector('input[type="email"]').value = 'test@nmc.or.kr';
document.querySelector('input[type="password"]').value = 'password123';

// 로그인 버튼 클릭
document.querySelector('button[type="submit"]').click();

// 스피너 표시 감시
const spinnerObserver = setInterval(() => {
  const spinner = document.querySelector('[role="progressbar"]') ||
                 document.querySelector('.spinner') ||
                 document.querySelector('svg.animate-spin');
  if (spinner) {
    console.timeEnd('SPINNER_DELAY');
    clearInterval(spinnerObserver);
  }
}, 10);

// 로그인 완료 감시 (리다이렉트 또는 대시보드 로드)
const redirectObserver = setInterval(() => {
  if (window.location.pathname !== '/auth/signin') {
    console.timeEnd('LOGIN_TOTAL');
    clearInterval(redirectObserver);
  }
}, 100);
```

**확인 항목**:
- [ ] SPINNER_DELAY < 200ms (스피너가 빨리 나타남)
- [ ] LOGIN_TOTAL < 2000ms (전체 로그인 < 2초)
- [ ] 스피너가 부드럽게 회전하는지 확인
- [ ] Network 탭에서 요청 순서 확인

**3G 속도 테스트**:
1. Network 탭 → Throttling을 "Slow 3G"로 변경
2. 위 과정 반복
3. **중요**: 스피너가 표시되어야 함 (로딩 체감도 개선 확인)

**기록**:
```
Test 1 - 로그인 성능
[] 정상 네트워크: SPINNER_DELAY = ___ms, LOGIN_TOTAL = ___ms
[] 3G 네트워크: 스피너 표시 확인됨 (Y/N)
[] UI 반응성 정상 (Y/N)
```

---

### Test 2: 로그아웃 안정성 (15분)

**목표**: 네트워크 오류 상황에서도 /auth/signin으로 이동

**정상 로그아웃**:
1. 대시보드 접속
2. 프로필 드롭다운 또는 로그아웃 버튼 클릭
3. 즉시 /auth/signin으로 이동하는지 확인

**네트워크 오류 시뮬레이션**:
1. Chrome 개발자 도구 → Network 탭
2. "Offline" 상태로 체크 (또는 Throttling을 "Offline"으로 설정)
3. 로그아웃 버튼 클릭
4. Console에서 에러 확인:
   ```javascript
   // Console 메시지 확인
   // "로그아웃 처리 중 오류: TypeError: ..." 또는 유사 메시지
   ```
5. **중요**: 네트워크 오류에도 불구하고 /auth/signin으로 이동하는지 확인

**느린 네트워크 시뮬레이션**:
1. Network 탭 → Throttling을 "Slow 3G"로 설정
2. 로그아웃 버튼 클릭
3. 시간이 걸려도 /auth/signin으로 이동하는지 확인 (5-10초)

**기록**:
```
Test 2 - 로그아웃 안정성
[] 정상 로그아웃: /auth/signin 이동 확인 (Y/N)
[] 네트워크 오류 시: 에러 로그 보임 (Y/N), 이동 완료 (Y/N)
[] 느린 네트워크: 이동 완료 (Y/N)
```

---

### Test 3: 민감정보 필터링 (10분)

**목표**: API 응답에 password_hash, account_locked 등이 없는지 확인

**실행 방법**:
1. Chrome 개발자 도구 → Network 탭
2. 로그인하여 대시보드 접속
3. Network 탭에서 "/api/user/profile" 요청 찾기
4. 해당 요청 클릭 → Response 탭 확인

**확인 항목** (다음 필드가 없어야 함):
- [ ] password_hash 없음
- [ ] account_locked 없음
- [ ] lock_reason 없음
- [ ] approval_status 없음

**있어야 하는 필드**:
- [ ] id 있음
- [ ] email 있음
- [ ] full_name 있음
- [ ] role 있음
- [ ] organization_id 있음
- [ ] is_active 있음

**기록**:
```
Test 3 - 민감정보 필터링
[] password_hash 미노출 (Y/N)
[] account_locked 미노출 (Y/N)
[] lock_reason 미노출 (Y/N)
[] approval_status 미노출 (Y/N)
[] 필요한 필드만 반환 (Y/N)
```

---

### Test 4: 프로필 로드 실패 폴백 (10분)

**목표**: 프로필 API 장애 시에도 /dashboard로 폴백

**실행 방법**:
1. Chrome 개발자 도구 → Console
2. 다음 코드 실행 (Network 요청 차단):

```javascript
// 프로필 API만 차단
const originalFetch = window.fetch;
window.fetch = async (url, options) => {
  if (url.includes('/api/user/profile')) {
    throw new Error('Network error (simulated)');
  }
  return originalFetch(url, options);
};

console.log('프로필 API 차단됨. 이제 로그인하세요.');
```

3. 로그인 버튼 클릭
4. **중요**: 에러가 나도 /dashboard로 이동하는지 확인
5. Console에서 에러 메시지 확인:
   ```
   "프로필 로드 실패: Error: Network error (simulated)"
   ```

**성공 기준**:
- [ ] 프로필 로드 실패 로그 보임
- [ ] /dashboard로 자동 이동
- [ ] 사용자가 갇히지 않음 (폴백 작동)

**기록**:
```
Test 4 - 프로필 로드 실패 폴백
[] 프로필 API 차단 후 에러 로그 보임 (Y/N)
[] /dashboard로 자동 이동 (Y/N)
[] 사용자 경험 정상 (Y/N)
```

---

## 성능 검증 기준

### 통과 기준

```
로그인 성능:
- 스피너 표시: < 200ms
- 전체 완료: < 2000ms
- 3G에서도 스피너 표시됨

로그아웃 안정성:
- 정상: 1-2초 이내 이동
- 네트워크 오류: 콘솔 에러 + 이동 완료
- 느린 네트워크: 5-10초 후 이동

민감정보:
- password_hash 없음
- account_locked 없음
- lock_reason 없음

폴백:
- 프로필 로드 실패 시 /dashboard로 이동
- 콘솔에 에러 로그 기록됨
```

### 미통과 기준

| 문제 | 원인 | 대응 |
|------|------|------|
| 로그인이 여전히 느림 (> 2초) | 서버 성능 또는 네트워크 | 배포 상태 재확인, 서버 로그 검증 |
| 스피너가 안 나타남 | setRedirecting 타이밍 | 코드 재검증, 배포 재실행 |
| 로그아웃 실패 | 네트워크 오류 시에도 catch 블록 미작동 | 코드 재검증, 배포 재실행 |
| 민감정보 노출됨 | select 블록 미적용 | 코드 재검증, 배포 재실행 |
| 프로필 로드 실패해도 갇힘 | try-catch/폴백 미작동 | 코드 재검증, 배포 재실행 |

---

## 다음 단계

### 모든 테스트 통과 시
```
1. 이 문서의 기록 항목 모두 "Y" 또는 "합격"으로 표시
2. 아래 문구 복사하여 팀에 보고:

테스트 결과: 합격
- Test 1 (로그인 성능): 통과
- Test 2 (로그아웃 안정성): 통과
- Test 3 (민감정보 필터링): 통과
- Test 4 (프로필 폴백): 통과

배포 승인: 프로덕션 배포 준비 완료
```

### 어느 하나라도 실패 시
```
1. 실패한 항목 확인
2. 서버 로그 검토:
   pm2 logs --err --lines 100

3. 문제 분석:
   - 배포 실패? → 배포 로그 확인
   - 코드 오류? → DEPLOY_TO_STAGING.md의 "배포 실패 시 대응" 참조
   - 네트워크? → Throttling 설정 재확인

4. 필요시 재배포:
   ./scripts/deploy-staging.sh
   또는 DEPLOY_TO_STAGING.md의 방법 재실행
```

---

## 실행 체크리스트

### Before Testing (배포 직후)
- [ ] pm2 status에서 online 확인
- [ ] curl -I https://staging.aed.pics에서 HTTP 200 확인
- [ ] pm2 logs에서 에러 없음 확인

### Test 1 - 로그인 성능
- [ ] 정상 네트워크에서 성능 측정 완료
- [ ] 3G 네트워크에서 스피너 확인 완료
- [ ] 기록 작성 완료

### Test 2 - 로그아웃 안정성
- [ ] 정상 로그아웃 테스트 완료
- [ ] 네트워크 오류 시뮬레이션 테스트 완료
- [ ] 느린 네트워크 테스트 완료
- [ ] 기록 작성 완료

### Test 3 - 민감정보 필터링
- [ ] API 응답 확인 완료
- [ ] 제외할 필드 모두 없음 확인
- [ ] 필요 필드 모두 있음 확인
- [ ] 기록 작성 완료

### Test 4 - 프로필 로드 실패
- [ ] Network 차단 상태에서 로그인 테스트
- [ ] /dashboard로 폴백 확인
- [ ] 콘솔 에러 로그 확인
- [ ] 기록 작성 완료

### After Testing
- [ ] 모든 기록 작성 완료
- [ ] 결과 검토 (통과/미통과)
- [ ] 다음 단계 결정

---

## 문제 발생 시 빠른 진단

### 배포 직후 pm2 status가 "errored"인 경우
```bash
# 1. 에러 로그 확인
pm2 logs --err --lines 50

# 2. 빌드 에러 있는지 확인
npm run build

# 3. 재배포
./scripts/deploy-staging.sh
```

### 로그인이 계속 느린 경우
```bash
# 1. 서버 성능 확인
pm2 status

# 2. 데이터베이스 응답 시간 확인
# 스테이징 DB 로그 검토

# 3. Network 탭에서 각 요청 시간 확인
# authorize 요청: 100ms 이내?
# session 요청: 50-150ms?
# profile 요청: 100-200ms?
```

### 로그아웃이 여전히 실패하는 경우
```bash
# 1. 콘솔 에러 메시지 확인
# "로그아웃 처리 중 오류:" 메시지 보이는지?

# 2. signOut 함수 호출 확인
# Network 탭에서 /api/auth/callback/signout 요청 보이는지?

# 3. 코드 재검증
cat components/logout-button.tsx | grep -A 10 "try {"
```

### 민감정보가 노출되는 경우
```bash
# 1. 프로필 API 응답 확인
curl https://staging.aed.pics/api/user/profile/[USER_ID]

# 2. password_hash가 응답에 포함되어 있는지 확인
# 있으면: select 블록이 적용되지 않음

# 3. 코드 재검증
cat app/api/user/profile/[id]/route.ts | grep -A 15 "select:"
```

---

**다음 단계**: 모든 테스트 통과 후 PRODUCTION_DEPLOYMENT_GUIDE.md를 참조하여 프로덕션 배포 진행

