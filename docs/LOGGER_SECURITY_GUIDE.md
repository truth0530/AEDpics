# Logger 보안 가이드 (1인 개발자용)

## 민감정보 자동 마스킹

모든 로그는 **자동으로 민감정보를 마스킹**합니다. 별도 처리 불필요!

### 자동 마스킹되는 필드

```typescript
const SENSITIVE_FIELDS = [
  'password', 'passwordConfirm', 'oldPassword', 'newPassword',
  'token', 'accessToken', 'refreshToken',
  'apiKey', 'secret', 'secretKey', 'privateKey',
  'credential', 'authorization', 'cookie', 'sessionId',
  'ssn', 'cardNumber', 'cvv', 'pin', 'otp', 'code'
];
```

### 사용 예시

#### ❌ 잘못된 예 (과거)
```typescript
console.log('User login', { email, password });
// 위험! 비밀번호가 로그에 노출됨
```

#### ✅ 올바른 예 (현재)
```typescript
logger.info('Auth:login', 'User login attempt', { email, password });
// 출력: { email: "user@example.com", password: "***" }
// 자동으로 마스킹됨!
```

#### ✅ 중첩 객체도 자동 마스킹
```typescript
logger.info('API:sendOTP', 'OTP sent', {
  user: {
    email: 'test@example.com',
    password: 'secret123',  // 자동 마스킹
    otp: '123456'           // 자동 마스킹
  }
});

// 출력:
// {
//   user: {
//     email: "test@example.com",
//     password: "***",
//     otp: "***"
//   }
// }
```

## 성능 최적화 (1인 개발자용)

### 프로덕션에서 로그 레벨 제어

```typescript
// lib/logger.ts (이미 설정됨)
const options = {
  minLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
};

// 프로덕션에서는 warn, error만 출력
// 개발 환경에서는 모든 로그 출력
```

### Hot Path에서 로깅 최소화

```typescript
// ❌ 자주 실행되는 루프에서 로깅 (성능 저하)
data.forEach(item => {
  logger.info('Process', 'Processing item', { item }); // 매번 로그
});

// ✅ 요약만 로깅
const processed = data.map(process);
logger.info('Process', 'Batch processing complete', {
  count: processed.length
});
```

## 로그 볼륨 관리

### PM2 로그 로테이션 설정

서버에서 실행:
```bash
./scripts/setup-log-rotation.sh
```

설정 내용:
- 10MB마다 자동 로테이션
- 최근 7개 파일만 보관
- gzip 자동 압축

### 로그 파일 위치
```
/home/aedpics/logs/pm2-out.log       # 표준 출력
/home/aedpics/logs/pm2-error.log     # 에러 로그
/home/aedpics/logs/pm2-out.log.1.gz  # 압축된 이전 로그
```

## 환경변수 추가 가이드

### 빠른 추가 스크립트
```bash
./scripts/add-env-var.sh MY_API_KEY string required
```

출력:
```
✅ 아래 코드를 lib/env.ts에 추가하세요:

  MY_API_KEY: z.string().min(1, 'MY_API_KEY is required'),

그리고 .env.example에도 추가하세요:
MY_API_KEY=your_value_here
```

## 체크리스트 (1인 개발자용)

### 로깅 시 주의사항
- [ ] 비밀번호는 절대 로깅하지 않음 (자동 마스킹되지만 안심 금지)
- [ ] API 키는 절대 로깅하지 않음 (자동 마스킹됨)
- [ ] OTP 코드는 개발 환경에서만 로깅 (프로덕션 금지)
- [ ] 이메일 주소는 로깅 가능 (개인정보지만 식별용)

### 성능 최적화
- [ ] Hot path에서는 logger.debug 또는 로깅 최소화
- [ ] 프로덕션에서는 warn, error만 활성화
- [ ] 대용량 데이터는 요약만 로깅 (전체 배열 금지)

### 유지보수
- [ ] 새 환경변수는 lib/env.ts에 추가
- [ ] PM2 로그 로테이션 설정 확인 (월 1회)
- [ ] 로그 파일 크기 모니터링 (df -h 명령어)

## 긴급 상황 대응

### 로그가 너무 커질 때
```bash
# 서버 접속
ssh aedpics@223.130.150.133

# 로그 크기 확인
du -sh /home/aedpics/logs/*

# 즉시 정리 (주의: 로그 삭제됨)
pm2 flush

# 로테이션 설정 확인
pm2 conf pm2-logrotate
```

### 민감정보가 노출된 경우
1. 즉시 로그 파일 삭제: `pm2 flush`
2. 해당 API 키/토큰 재발급
3. logger.ts의 SENSITIVE_FIELDS에 해당 필드 추가
4. 재배포

## 참고 자료
- PM2 공식 문서: https://pm2.keymetrics.io/
- PM2 로그 로테이션: https://github.com/keymetrics/pm2-logrotate
- Zod 스키마: https://zod.dev/
