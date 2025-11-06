# 이메일 전달성 위기 대응 방안

## 🔴 현재 위기 상황 (2025-11-07)

### 발견된 차단 패턴
| 수신 도메인 | noreply@aed.pics | noreply@nmc.or.kr | 문제 유형 |
|------------|-----------------|-------------------|-----------|
| naver.com  | ❌ 차단 | ✅ 정상 | 도메인 평판 |
| daum.net   | ? | ❌ 554 5.7.1 | 스팸 필터 차단 |
| nmc.or.kr  | ✅ 정상 | ❌ 차단 | 같은 도메인 문제 |
| gmail.com  | ? | ? | 미확인 |

### 근본 원인
1. **도메인 평판 문제**: 각 ISP가 특정 도메인을 다르게 평가
2. **SPF/DKIM 설정 불완전**: 발신자 인증 실패
3. **발송 패턴 이슈**: 짧은 시간 내 반복 발송
4. **같은 도메인 발송 문제**: nmc.or.kr → nmc.or.kr 내부 메일 정책
5. **NCP 서비스 일관성 문제**: 동일 수신자에 대해 18분 간격으로 상반된 결과
   - 14:11:07 - shn@nmc.or.kr: "NONEXISTENT_DOMAIN_ADDRESS" 에러
   - 14:29:49 - shn@nmc.or.kr: 성공적으로 발송됨

## 🛠️ 즉시 구현된 해결책

### 1. 스마트 발신자 선택 시스템
**파일**: `lib/email/smart-sender-selector.ts`

```typescript
// 수신 도메인별로 최적의 발신자 자동 선택
const sender = await selectSmartSender(recipientEmail);

// 실패 시 자동으로 다른 발신자로 로테이션
if (failed) {
  const newSender = rotateSender(currentSender, domain);
}
```

**특징**:
- 도메인별 차단 이력 학습
- 성공률 기반 자동 선택
- 실패 시 즉시 발신자 변경

### 2. 향상된 이메일 발송 시스템
**파일**: `lib/email/enhanced-ncp-email.ts`

```typescript
// 자동 재시도 with 발신자 변경
await sendEnhancedEmail(email, name, subject, body, {
  maxSenderRetries: 2,  // 최대 2개 발신자 시도
  skipValidation: false
});
```

**기능**:
- 이메일 유효성 사전 검증
- 실패 시 자동 발신자 변경
- 성공/실패 기록 및 학습

### 3. 이메일 검증 강화
**파일**: `lib/email/email-validator.ts`

- MX 레코드 확인
- 일회용 이메일 차단
- 바운스 이력 확인
- 내부 차단 목록 관리

### 4. 이메일 주소 정규화 (NCP 일관성 문제 해결)
**파일**: `lib/email/ncp-email.ts`

```typescript
// 모든 이메일 주소를 정규화하여 일관성 확보
function normalizeEmailAddress(email: string): string {
  return email.trim().toLowerCase();
}
```

**해결 효과**:
- 공백 문자로 인한 도메인 인식 실패 방지
- 대소문자 차이로 인한 불일치 해결
- NCP API의 간헐적 도메인 검증 실패 완화

## 📊 실행 가능한 진단 도구

### 1. 평판 및 설정 검사
```bash
# SPF, DKIM, DMARC 설정 확인
chmod +x scripts/check-email-reputation.sh
./scripts/check-email-reputation.sh

# 결과 예시:
# ✅ SPF 레코드 확인됨
# ⚠️ NCP IP (49.236.138.18) SPF에 없음
# ❌ DKIM 레코드 없음
```

### 2. 차단 목록 확인
```bash
# 특정 이메일 차단 상태 확인
npx tsx scripts/check-email-block-list.ts truth530@daum.net

# 발송 이력 및 통계 확인
npx tsx scripts/check-email-block-list.ts
```

### 3. 발송 테스트
```bash
# 기본 발송 테스트
npx tsx scripts/test/test-ncp-email.ts your-email@domain.com

# 스마트 발신자 테스트
npx tsx scripts/test/test-smart-sender.ts
```

## 🚀 적용 방법

### 1. 데이터베이스 마이그레이션
```bash
# 이메일 추적 테이블 생성
npx prisma migrate deploy
```

### 2. API 라우트 수정
```typescript
// app/api/auth/send-otp/route.ts
import { sendOTPEmail } from '@/lib/email/enhanced-ncp-email';

// 기존 코드 대체
const result = await sendOTPEmail(email, otp);
if (!result.success) {
  return NextResponse.json(
    { error: result.error },
    { status: 500 }
  );
}
```

### 3. 환경변수 확인
```bash
# .env.local
NCP_ACCESS_KEY="ncp_iam_BPAMKR..."
NCP_ACCESS_SECRET="ncp_iam_BPKMKRF..."

# 발신자 이메일은 코드에서 자동 선택됨
# NCP_SENDER_EMAIL 설정 불필요
```

## 📈 모니터링

### 1. 실시간 발송 통계
```typescript
import { getSenderStatistics } from '@/lib/email/smart-sender-selector';

// 최근 24시간 통계
const stats = await getSenderStatistics(24);
// {
//   "noreply@aed.pics": {
//     "total": 100,
//     "sent": 85,
//     "failed": 15,
//     "successRate": "85.0%"
//   },
//   "noreply@nmc.or.kr": {
//     "total": 50,
//     "sent": 45,
//     "failed": 5,
//     "successRate": "90.0%"
//   }
// }
```

### 2. 도메인별 차단 현황
```sql
-- 도메인별 실패율 조회
SELECT
  SUBSTRING(recipient_email FROM '@(.+)$') as domain,
  sender_email,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
  ROUND(100.0 * SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) / COUNT(*), 1) as failure_rate
FROM email_send_logs
WHERE sent_at > NOW() - INTERVAL '24 hours'
GROUP BY domain, sender_email
ORDER BY failure_rate DESC;
```

## 🎯 장기 개선 계획

### 1. DNS 설정 개선 (IT 관리자 협조 필요)

#### aed.pics 도메인
```dns
; SPF 레코드 (NCP IP 추가)
v=spf1 ip4:49.236.138.18 include:_spf.google.com ~all

; DKIM 레코드 설정
ncp._domainkey IN TXT "v=DKIM1; k=rsa; p=MIGfMA0..."

; DMARC 레코드
_dmarc IN TXT "v=DMARC1; p=quarantine; rua=mailto:admin@aed.pics"
```

#### nmc.or.kr 도메인
```dns
; SPF에 NCP IP 추가 요청
v=spf1 ... ip4:49.236.138.18 ... ~all
```

### 2. 발송 인프라 개선

#### 옵션 1: 전용 IP 구매
- NCP에서 전용 발송 IP 구매
- IP 평판 직접 관리
- 월 비용: 약 50,000원

#### 옵션 2: 3rd Party 서비스 병행
```typescript
// 주요 ISP별 다른 서비스 사용
const SENDER_SERVICES = {
  'naver.com': 'ncp',      // NCP 사용
  'gmail.com': 'sendgrid', // SendGrid 사용
  'daum.net': 'aws-ses'    // AWS SES 사용
};
```

#### 옵션 3: Transactional Email 서비스
- SendGrid, Mailgun, AWS SES 등
- 더 나은 전달성 보장
- 상세한 분석 제공

### 3. 발송 패턴 최적화

#### Warming Up 전략
```typescript
// 새 발신 도메인/IP 워밍업
const warmupSchedule = [
  { day: 1, volume: 50 },
  { day: 2, volume: 100 },
  { day: 3, volume: 200 },
  // ... 점진적 증가
];
```

#### 발송 시간 분산
```typescript
// 피크 시간 회피
const optimalSendTime = getOptimalSendTime(recipientDomain);
await scheduleEmail(email, optimalSendTime);
```

## 📝 체크리스트

### 즉시 조치사항
- [ ] 스마트 발신자 선택 시스템 적용
- [ ] 데이터베이스 마이그레이션 실행
- [ ] API 라우트 수정
- [ ] 모니터링 대시보드 구축

### 단기 개선 (1주 내)
- [ ] SPF 레코드에 NCP IP 추가 요청
- [ ] DKIM 설정 요청
- [ ] DMARC 정책 수립
- [ ] 발송 로그 분석 자동화

### 장기 개선 (1개월 내)
- [ ] 전용 IP 또는 3rd Party 서비스 검토
- [ ] 이메일 템플릿 최적화
- [ ] 발송 패턴 분석 및 개선
- [ ] A/B 테스트 시스템 구축

## 🆘 긴급 연락처

### NCP 지원
- 기술 지원: 1544-5876
- 이메일: support@ncloud.com
- [Cloud Outbound Mailer 문서](https://guide.ncloud-docs.com/docs/ko/cloudoutboundmailer-overview)

### IT 관리자 (DNS 설정)
- nmc.or.kr 도메인: IT 관리자 연락
- aed.pics 도메인: 도메인 등록업체 문의

## 💡 핵심 포인트

> **"하나의 발신자로 모든 수신자에게 보내는 것은 불가능하다"**

현재 이메일 생태계는 각 ISP가 독립적인 스팸 필터와 평판 시스템을 운영하므로, 하나의 완벽한 해결책은 없습니다.

**스마트 발신자 선택 시스템**은 이러한 현실을 받아들이고, 각 수신 도메인에 최적화된 발신자를 자동으로 선택하는 실용적 해결책입니다.

---

**작성일**: 2025-11-07
**작성자**: Claude Code (AI)
**문서 버전**: 1.0