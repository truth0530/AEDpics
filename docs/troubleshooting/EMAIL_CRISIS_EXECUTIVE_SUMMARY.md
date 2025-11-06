# 이메일 발송 위기 대응 - 실행 요약

**작성일**: 2025-11-07
**상태**: 긴급 대응 완료, 모니터링 중

## 🚨 긴급 공지: youth991230@nmc.or.kr 오해 해소

**오해**: "youth991230@nmc.or.kr이 관리자인 것처럼 이메일을 발송하고 있다"
**진실**: youth991230@nmc.or.kr은 **수신자(피해자)**입니다. 발송자 차단으로 이메일을 못 받았습니다.

- NCP Console의 "수신자" 표시는 정확합니다
- SEND_BLOCK_ADDRESS는 발송자(noreply@aed.pics) 차단을 의미합니다
- **즉시 조치**: NCP Console에서 noreply@aed.pics 차단 해제 필요

자세한 설명: [NCP_CONSOLE_DISPLAY_CLARIFICATION.md](./NCP_CONSOLE_DISPLAY_CLARIFICATION.md)

## 1. 핵심 문제

### 발견된 3가지 주요 문제
1. **도메인별 차단**: 각 이메일 제공업체가 다른 발신자를 차단
2. **NCP 서비스 일관성 부족**: 동일 수신자에 대해 상반된 결과 (18분 간격)
3. **과거 차단 이력 누적**: Hard bounce, 스팸 신고로 인한 영구 차단

## 2. 즉시 구현된 해결책

### A. 스마트 발신자 선택 시스템
```
네이버 → noreply@nmc.or.kr 사용
다음 → noreply@aed.pics 사용
nmc.or.kr → noreply@aed.pics 사용
```

### B. 이메일 주소 정규화
```typescript
// NCP 일관성 문제 해결
email.trim().toLowerCase()
```

### C. 자동 재시도 및 발신자 변경
- 실패 시 자동으로 다른 발신자로 재시도
- 성공/실패 패턴 학습 및 기록

## 3. 생성된 핵심 파일

| 파일 | 역할 |
|------|------|
| `lib/email/smart-sender-selector.ts` | 도메인별 최적 발신자 선택 |
| `lib/email/enhanced-ncp-email.ts` | 향상된 발송 시스템 (자동 재시도) |
| `lib/email/email-validator.ts` | 사전 검증 (MX, 차단 목록) |
| `lib/email/ncp-email.ts` (수정) | 이메일 정규화 추가 |

## 4. 테스트 도구

```bash
# 스마트 발신자 테스트
npx tsx scripts/test/test-smart-sender.ts

# 정규화 테스트
npx tsx scripts/test/test-email-normalization.ts

# 차단 목록 확인
npx tsx scripts/check-email-block-list.ts

# NCP DNS 진단
npx tsx scripts/diagnose-ncp-dns.ts
```

## 5. 즉시 필요한 조치

### 데이터베이스 마이그레이션
```bash
npx prisma migrate deploy
```

### API 라우트 수정
```typescript
// app/api/auth/send-otp/route.ts
import { sendOTPEmail } from '@/lib/email/enhanced-ncp-email';

const result = await sendOTPEmail(email, otp);
if (!result.success) {
  return NextResponse.json({ error: result.error }, { status: 500 });
}
```

## 6. 차단 현황 (2025-11-07 기준)

| 수신자 | noreply@aed.pics | noreply@nmc.or.kr | 상태 |
|--------|------------------|-------------------|------|
| @naver.com | ❌ | ✅ | 확인됨 |
| @daum.net | 추정 ✅ | ❌ (554 5.7.1) | 확인됨 |
| @nmc.or.kr | ✅ | ❌ (같은 도메인) | 확인됨 |
| @gmail.com | ? | ? | 미확인 |

## 7. 모니터링 명령어

```bash
# 발송 통계 (최근 24시간)
npx tsx -e "
import { getSenderStatistics } from './lib/email/smart-sender-selector';
console.log(await getSenderStatistics(24));
"

# 실시간 로그
pm2 logs --lines 100 | grep "Email"
```

## 8. 장기 개선 필요사항

1. **DNS 설정**
   - SPF에 NCP IP (49.236.138.18) 추가 요청
   - DKIM 설정 요청
   - DMARC 정책 수립

2. **대안 검토**
   - 전용 IP 구매 (월 50,000원)
   - SendGrid/AWS SES 병행 사용
   - Transactional Email 서비스 도입

## 9. 핵심 교훈

> **"하나의 발신자로 모든 수신자에게 보내는 것은 불가능하다"**

각 ISP가 독립적인 스팸 필터를 운영하므로, 수신 도메인에 맞는 발신자를 자동 선택하는 것이 유일한 실용적 해결책입니다.

## 10. 긴급 연락처

- NCP 기술지원: 1544-5876
- IT 관리자: (DNS 설정 변경 요청)
- 개발팀: truth0530@nmc.or.kr

---

**다음 단계**:
1. 프로덕션 배포 (enhanced-ncp-email.ts 적용)
2. 24시간 모니터링
3. 추가 차단 패턴 발견 시 smart-sender-selector.ts 업데이트