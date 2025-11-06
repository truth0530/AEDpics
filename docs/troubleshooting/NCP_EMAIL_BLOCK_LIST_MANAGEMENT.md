# NCP Cloud Outbound Mailer 차단 목록(Send Block List) 관리 가이드

## 문제 현황
- 2025-11-07: truth530@daum.net이 차단 목록에 등록되어 있음을 발견
- 회원가입 시도 시 이메일이 도착하지 않음
- NCP 콘솔에서 수동으로 차단 해제

## 차단 목록에 추가되는 주요 원인

### 1. Hard Bounce (하드 바운스)
**원인**: 영구적 전달 실패
- 존재하지 않는 이메일 주소
- 잘못된 도메인명
- 삭제된 이메일 계정

**NCP 정책**:
- Hard Bounce 3회 발생 시 자동으로 차단 목록 추가
- 수동 해제 전까지 영구 차단

### 2. Soft Bounce 반복
**원인**: 일시적 전달 실패가 계속됨
- 메일함 용량 초과
- 수신 서버 일시적 오류
- 네트워크 타임아웃

**NCP 정책**:
- Soft Bounce 5회 연속 발생 시 차단 목록 추가
- 24시간 후 자동 해제 (설정에 따라 다름)

### 3. Spam Complaint (스팸 신고)
**원인**: 수신자가 스팸으로 신고
- 수신자가 메일을 스팸으로 분류
- ISP(인터넷 서비스 제공자)의 자동 필터링

**NCP 정책**:
- 스팸 신고 1회로도 차단 가능
- 수동 해제 필요

### 4. Rate Limiting 위반
**원인**: 과도한 발송 시도
- 동일 수신자에게 짧은 시간 내 반복 발송
- 시스템에서 설정한 발송 한도 초과

**NCP 정책**:
- 분당 100통 이상 발송 시 자동 차단
- 동일 수신자 5분 내 3회 이상 발송 시 차단

## 현재 시스템의 문제점과 개선 필요사항

### 1. 차단 목록 모니터링 부재
**문제**:
- 어떤 이메일이 차단되었는지 확인 불가
- 차단된 시기와 원인을 알 수 없음

**해결 방안**:
```bash
# NCP API를 통한 차단 목록 조회 (현재 미구현)
# 매일 자동으로 차단 목록을 조회하고 알림
```

### 2. 바운스 처리 로직 부재
**문제**:
- 이메일 발송 실패 시 단순히 에러만 로깅
- 바운스 타입 구분 없음

**개선 필요**:
```typescript
// lib/email/bounce-handler.ts (신규 생성 필요)
export async function handleEmailBounce(
  email: string,
  bounceType: 'hard' | 'soft',
  reason: string
) {
  // 1. 데이터베이스에 바운스 기록
  // 2. Hard bounce 3회 이상 시 이메일 차단
  // 3. 관리자 알림
}
```

### 3. 이메일 검증 부재
**문제**:
- 가입 시 이메일 유효성 검사 없음
- 존재하지 않는 이메일도 OTP 발송 시도

**개선 필요**:
```typescript
// 이메일 형식 검증 강화
function validateEmail(email: string): boolean {
  // 1. 정규식 검증
  // 2. DNS MX 레코드 확인
  // 3. 일회용 이메일 차단
  return true;
}
```

## 차단 목록 확인 방법

### 1. NCP 콘솔에서 확인 (수동)
1. NCP 콘솔 로그인: https://console.ncloud.com/
2. Services > Application Services > Cloud Outbound Mailer
3. 좌측 메뉴 > Send Block List
4. 검색창에 이메일 주소 입력

### 2. API를 통한 확인 (자동화 필요)
```typescript
// scripts/check-block-list.ts (신규 생성 필요)
async function checkBlockList() {
  // NCP API 호출
  const endpoint = 'https://mail.apigw.ntruss.com/api/v1/block-list';

  // 차단된 이메일 목록 조회
  const response = await fetch(endpoint, {
    headers: {
      'x-ncp-iam-access-key': process.env.NCP_ACCESS_KEY,
      // ... 인증 헤더
    }
  });

  const blockList = await response.json();
  return blockList;
}
```

## 차단 방지 대책

### 1. Rate Limiting 강화 (이미 구현됨)
현재 `lib/email/email-rate-limiter.ts`에서 관리:
- 수신자당 일일 최대 10회
- 수신자당 시간당 최대 3회
- 같은 도메인 5분 내 최대 2회
- 쿨다운: 5분

### 2. 이메일 검증 추가 (구현 필요)
```typescript
// 가입 전 이메일 유효성 확인
export async function preValidateEmail(email: string) {
  // 1. 형식 검증
  // 2. MX 레코드 확인
  // 3. 블랙리스트 확인
  // 4. 일회용 이메일 차단
}
```

### 3. 바운스 웹훅 설정 (구현 필요)
```typescript
// app/api/webhooks/ncp-bounce/route.ts
export async function POST(request: NextRequest) {
  const { email, bounceType, reason } = await request.json();

  // 1. 바운스 기록 저장
  await prisma.email_bounces.create({
    data: { email, bounce_type: bounceType, reason }
  });

  // 2. Hard bounce 누적 확인
  const bounceCount = await prisma.email_bounces.count({
    where: { email, bounce_type: 'hard' }
  });

  // 3. 3회 이상 시 내부 차단 목록에 추가
  if (bounceCount >= 3) {
    await prisma.blocked_emails.create({
      data: { email, reason: 'Too many hard bounces' }
    });
  }
}
```

### 4. 정기 모니터링 스크립트 (구현 필요)
```bash
# scripts/monitor-email-health.ts
# 매일 실행하여:
# 1. NCP 차단 목록 조회
# 2. 바운스 통계 확인
# 3. 발송 성공률 계산
# 4. 이상 패턴 알림
```

## 즉시 실행 가능한 조치

### 1. 차단 목록 전수 조사
```bash
# NCP 콘솔에서 수동으로 확인
# Services > Cloud Outbound Mailer > Send Block List
# 전체 목록 Export 후 분석
```

### 2. 데이터베이스 테이블 생성
```sql
-- 바운스 기록 테이블
CREATE TABLE email_bounces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL,
  bounce_type VARCHAR(10) NOT NULL, -- 'hard' or 'soft'
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 내부 차단 목록 테이블
CREATE TABLE blocked_emails (
  email VARCHAR(255) PRIMARY KEY,
  reason TEXT,
  blocked_at TIMESTAMP DEFAULT NOW(),
  unblocked_at TIMESTAMP NULL
);

-- 이메일 발송 로그 테이블
CREATE TABLE email_send_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  status VARCHAR(20), -- 'sent', 'failed', 'bounced', 'blocked'
  error_message TEXT,
  sent_at TIMESTAMP DEFAULT NOW()
);
```

### 3. 가입 프로세스 개선
```typescript
// 가입 시 이메일 검증 강화
async function validateEmailBeforeSending(email: string) {
  // 1. 내부 차단 목록 확인
  const isBlocked = await prisma.blocked_emails.findUnique({
    where: { email }
  });

  if (isBlocked) {
    throw new Error('이 이메일 주소는 사용할 수 없습니다.');
  }

  // 2. 최근 바운스 이력 확인
  const recentBounces = await prisma.email_bounces.count({
    where: {
      email,
      bounce_type: 'hard',
      created_at: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    }
  });

  if (recentBounces >= 2) {
    throw new Error('이메일 주소 확인이 필요합니다.');
  }
}
```

## 장기 개선 계획

### 1. NCP API 통합
- 차단 목록 자동 조회 API
- 바운스 웹훅 수신
- 발송 통계 모니터링

### 2. 이메일 품질 관리
- Double opt-in 구현
- 이메일 검증 서비스 연동
- 발송 평판 모니터링

### 3. 사용자 경험 개선
- 차단된 이메일 사용자에게 대체 연락 방법 제공
- 이메일 변경 기능 제공
- 발송 실패 시 상세한 안내 제공

## 관련 파일
- `lib/email/ncp-email.ts` - 이메일 발송 로직
- `lib/email/email-rate-limiter.ts` - 발송 빈도 제한
- `app/api/auth/send-otp/route.ts` - OTP 발송 API

## 참고 자료
- [NCP Cloud Outbound Mailer 가이드](https://guide.ncloud-docs.com/docs/ko/cloudoutboundmailer-overview)
- [이메일 전달성 가이드](https://www.mailgun.com/guides/email-deliverability/)

---

작성일: 2025-11-07
작성자: Claude Code (AI)