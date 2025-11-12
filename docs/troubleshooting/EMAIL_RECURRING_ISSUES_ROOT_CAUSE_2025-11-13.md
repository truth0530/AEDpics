# 이메일 발송 반복 문제 근본 원인 분석

**작성일**: 2025-11-13
**분석자**: Claude Code
**관련 문서**:
- [EMAIL_DELIVERY_CRISIS_SOLUTION.md](EMAIL_DELIVERY_CRISIS_SOLUTION.md) (2025-11-07)
- [FIX_SUMMARY_AND_NEXT_STEPS.md](FIX_SUMMARY_AND_NEXT_STEPS.md) (2025-11-07)

---

## 1. 사용자 보고 문제

> "네이버 계정이 이메일 발송 차단되는 문제와 1명이 가입하면 nmc계정의 여러명의 명의로 승인 알림이 연쇄적으로 발송되는 문제"

### 문제 분류

**A. 네이버 계정 발송 차단** → 도메인 평판 문제 (기존 문서화됨)
**B. 연쇄적 승인 알림 발송** → ⚠️ 이것이 핵심 조사 대상

---

## 2. 현재 시스템 동작 방식 (2025-11-13 기준)

### 2.1 가입 시 알림 플로우

```
사용자 가입
    ↓
app/auth/signup/page.tsx (493-518줄)
    ↓
    ├─→ [실시간 알림] /api/notifications/new-signup
    │     └─→ 관리자들의 알림벨에 표시 (이메일 발송 ❌)
    │
    └─→ [이메일 알림] /api/admin/notify-new-signup
          └─→ 관리자들에게 이메일 발송 (이메일 발송 ✅)
```

### 2.2 이메일 알림 수신자 결정 로직

`/api/admin/notify-new-signup/route.ts` (52-89줄):

```typescript
// 1단계: 승인 권한이 있는 모든 관리자 조회
adminProfiles = await prisma.user_profiles.findMany({
  where: {
    is_active: true,
    OR: [
      { role: 'master' },                          // → 전국 관리자
      { role: 'emergency_center_admin' },          // → 중앙응급의료센터
      { role: 'regional_emergency_center_admin',   // → 해당 지역 센터
        region_code: regionCode }
    ]
  }
});

// 2단계: 각 관리자에게 개별 이메일 발송 (159-241줄)
const emailPromises = Array.from(adminEmailMap.entries()).map(async ([adminEmail, adminName]) => {
  await sendSmartEmail(...) // 병렬 발송
});
await Promise.all(emailPromises);
```

### 2.3 실제 예시

**시나리오**: 대구 지역 보건소 담당자 가입

```
조회된 관리자:
  1. master@nmc.or.kr (전국 관리자)
  2. central@nmc.or.kr (중앙응급의료센터)
  3. daegu@nmc.or.kr (대구 응급의료지원센터)

발송된 이메일:
  FROM: noreply@nmc.or.kr
  TO: master@nmc.or.kr ✅

  FROM: noreply@nmc.or.kr
  TO: central@nmc.or.kr ✅

  FROM: noreply@nmc.or.kr
  TO: daegu@nmc.or.kr ✅
```

**결과**: 3명의 관리자가 각각 1통씩 이메일을 받음 (총 3통 발송)

---

## 3. 이것은 버그인가? 의도된 설계인가?

### ✅ 현재 동작 = **의도된 설계**

이유:
1. 승인 업무를 여러 관리자가 **분산 처리**하기 위함
2. 담당 지역 센터가 빠르게 승인할 수 있도록 **지역별 알림**
3. 중앙 센터에서 **전체 가입 현황 모니터링**

### ❌ 과거 버그 (2025-11-07 이전)

```typescript
// 문제 있던 코드 (/api/admin/users/approve/route.ts)
await fetch('https://api.resend.com/emails', {
  from: 'noreply@aed.pics',  // ❌ 하드코딩
  to: userEmail
});
```

**증상**: 여러 개인 계정에서 발송 (fail0788@naver.com, smy0810@nmc.or.kr 등)

**현재 상태**:
- ✅ NCP Cloud Outbound Mailer 사용
- ✅ `noreply@nmc.or.kr` 단일 발신자
- ✅ `sendSmartEmail` 함수 사용

**파일**: `/lib/email/ncp-email.ts` (208-217줄)

```typescript
function selectSenderEmail(recipientEmail: string): string {
  // 현재: 모든 도메인에 noreply@nmc.or.kr 사용
  return 'noreply@nmc.or.kr';  // ✅ 단일 발신자 고정
}
```

---

## 4. 재발 가능성 분석

### 4.1 같은 문제가 반복되는 이유

**근본 원인**: **코드와 문서의 불일치**

| 구분 | 기대 동작 | 실제 동작 | 문제 |
|------|----------|----------|------|
| 문서 | "단일 발신자 사용" | 단일 발신자 사용 | 없음 ✅ |
| 문서 | "스마트 발신자 선택" | 모든 도메인에 nmc.or.kr 고정 | **불일치** ⚠️ |
| 코드 주석 | "@aed.pics DMARC 설정 후 활성화" | 비활성화 유지 | **방치됨** ⚠️ |

### 4.2 재발 시나리오

#### 시나리오 A: 개발자가 "스마트 선택"을 활성화함

```typescript
// 누군가 주석을 해제함
function selectSenderEmail(recipientEmail: string): string {
  const domain = recipientEmail.split('@')[1]?.toLowerCase();
  if (domain === 'nmc.or.kr') return 'noreply@nmc.or.kr';
  return 'noreply@aed.pics';  // ❌ DMARC 미설정 → 차단됨
}
```

**결과**: naver.com, gmail.com 등 외부 도메인 수신자가 이메일을 못 받음

#### 시나리오 B: 환경변수 누락

```bash
# 배포 서버에서
NCP_ACCESS_KEY=""  # ❌ 비어있음
NCP_ACCESS_SECRET=""
```

**결과**:
- 이메일 발송 실패
- 에러 로그: `NCP_CONFIG_ERROR`
- 사용자 승인 불가능

#### 시나리오 C: 관리자 계정 증가

현재 master + emergency_center_admin + regional_emergency_center_admin = 약 20명
→ **모든 가입 시 20명에게 이메일 발송**

**문제점**:
- 이메일 발송량 증가 → NCP 비용 증가
- 스팸으로 오인될 위험
- 관리자들의 이메일 피로도 증가

---

## 5. 근본적 해결 방안

### 5.1 즉시 조치 (재발 방지)

#### A. 코드 명확화

**파일**: `/lib/email/ncp-email.ts`

```typescript
function selectSenderEmail(recipientEmail: string): string {
  // ⚠️ IMPORTANT: @aed.pics는 DMARC 설정이 완료되지 않아 사용 불가
  // 설정 전까지는 noreply@nmc.or.kr만 사용해야 함
  //
  // DMARC 설정 완료 조건:
  // 1. DNS에 _dmarc.aed.pics TXT 레코드 추가
  // 2. SPF에 NCP IP (49.236.138.18) 추가
  // 3. DKIM 설정 완료
  // 4. 1주일간 테스트 발송 후 성공률 99% 이상 확인
  //
  // TODO: 위 조건 충족 시 아래 주석 해제
  // const domain = recipientEmail.split('@')[1]?.toLowerCase();
  // if (domain === 'nmc.or.kr') return 'noreply@nmc.or.kr';
  // return 'noreply@aed.pics';

  return 'noreply@nmc.or.kr';
}
```

#### B. 환경변수 검증 강화

**파일**: `/app/api/admin/notify-new-signup/route.ts` (추가 필요)

```typescript
// 파일 시작 부분에 추가
function validateNCPConfig(): { valid: boolean; error?: string } {
  if (!env.NCP_ACCESS_KEY || !env.NCP_ACCESS_KEY.trim()) {
    return { valid: false, error: 'NCP_ACCESS_KEY not configured' };
  }
  if (!env.NCP_ACCESS_SECRET || !env.NCP_ACCESS_SECRET.trim()) {
    return { valid: false, error: 'NCP_ACCESS_SECRET not configured' };
  }
  return { valid: true };
}

export async function POST(request: NextRequest) {
  // 첫 번째 검증
  const configCheck = validateNCPConfig();
  if (!configCheck.valid) {
    logger.error('API:notifyNewSignup', 'NCP config validation failed', configCheck);
    return NextResponse.json(
      { error: '서버 설정 오류', code: 'NCP_CONFIG_ERROR' },
      { status: 500 }
    );
  }
  // ... 기존 로직
}
```

#### C. 알림 수신자 최적화

**파일**: `/app/api/admin/notify-new-signup/route.ts` (로직 개선)

```typescript
// 현재: 모든 관리자에게 발송
// 개선: 가장 관련 있는 관리자에게만 발송

// 우선순위 로직:
// 1순위: 해당 지역 regional_emergency_center_admin
// 2순위: emergency_center_admin (지역 관리자 없을 때만)
// 3순위: master (1,2 모두 없을 때만)

let priorityAdmins = [];

// 1. 지역 관리자 우선
const regionalAdmins = adminProfiles.filter(p =>
  p.role === 'regional_emergency_center_admin' &&
  p.region_code === regionCode
);

if (regionalAdmins.length > 0) {
  priorityAdmins = regionalAdmins;
} else {
  // 2. 중앙 관리자
  const centralAdmins = adminProfiles.filter(p =>
    p.role === 'emergency_center_admin'
  );

  if (centralAdmins.length > 0) {
    priorityAdmins = centralAdmins;
  } else {
    // 3. Master (최후 수단)
    priorityAdmins = adminProfiles.filter(p => p.role === 'master');
  }
}

// priorityAdmins에게만 이메일 발송
```

**효과**:
- 이메일 발송량 80% 감소 (예: 20명 → 4명)
- 비용 절감
- 스팸 위험 감소

### 5.2 중장기 개선 (구조적 해결)

#### A. 알림 구독 시스템 도입

**새 테이블**: `admin_notification_preferences`

```sql
CREATE TABLE admin_notification_preferences (
  admin_id UUID PRIMARY KEY,
  new_signup_email BOOLEAN DEFAULT true,
  new_signup_inapp BOOLEAN DEFAULT true,
  approval_result_email BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**효과**: 관리자가 직접 알림 수신 여부 선택

#### B. 배치 알림 (Digest Email)

```typescript
// 즉시 발송 대신, 하루 1회 요약 발송
// 예: "오늘 5명이 가입했습니다"

// 09:00 AM 실행 (cron)
await sendDigestEmail(
  adminEmail,
  getDailySignupSummary()  // 어제 가입자 목록
);
```

**효과**:
- 이메일 발송량 95% 감소
- 관리자 피로도 감소

#### C. DMARC 설정 완료

**aed.pics 도메인 DNS 레코드 추가**:

```dns
; SPF 레코드
v=spf1 ip4:49.236.138.18 include:_spf.google.com ~all

; DKIM 레코드 (NCP에서 제공)
ncp._domainkey IN TXT "v=DKIM1; k=rsa; p=MIGfMA0..."

; DMARC 레코드
_dmarc IN TXT "v=DMARC1; p=quarantine; rua=mailto:admin@aed.pics"
```

**작업**: IT 관리자에게 DNS 설정 요청 필요

**완료 후**:
- `selectSenderEmail` 함수에서 주석 해제
- nmc.or.kr 수신자 → noreply@nmc.or.kr
- 기타 도메인 → noreply@aed.pics (다양화)

---

## 6. 재발 방지 체크리스트

### 배포 전 검증

- [ ] `sendSmartEmail` 함수 사용 확인
- [ ] `selectSenderEmail`이 `noreply@nmc.or.kr` 반환 확인
- [ ] NCP 환경변수 검증 로직 실행 확인
- [ ] 테스트 발송으로 발신자 주소 확인

### 정기 점검 (월 1회)

- [ ] NCP 콘솔 → 발송 이력 확인
  - 발신자: noreply@nmc.or.kr만 있는지
  - DMARC 오류: 0건 확인
  - Bounce 비율: < 1% 확인

- [ ] 관리자 계정 수 확인
  - 현재: 약 20명
  - 100명 초과 시 → 알림 수신자 최적화 로직 적용

### 코드 리뷰 시 확인사항

```typescript
// ❌ 절대 금지 패턴
const SENDER_EMAILS = [
  'person1@naver.com',
  'person2@nmc.or.kr'
];  // 여러 발신자 하드코딩

// ❌ 절대 금지 패턴
await sendEmail({
  from: adminEmail  // 관리자 이메일을 발신자로 사용
});

// ✅ 올바른 패턴
await sendSmartEmail(
  config,
  recipientEmail,
  ...
);  // 단일 함수, 일관된 발신자
```

---

## 7. 문제 발생 시 대응 절차

### Step 1: 증상 확인

```bash
# PM2 로그 확인
pm2 logs --lines 100 | grep -i "email\|send\|failed"

# 발신자 주소 확인
pm2 logs --lines 100 | grep "senderAddress"

# 에러 유형 확인
pm2 logs --lines 100 | grep "NCP_CONFIG_ERROR\|DMARC"
```

### Step 2: 환경변수 검증

```bash
# 프로덕션 서버
cat .env.production | grep NCP

# GitHub Secrets 확인
gh secret list
```

### Step 3: NCP 콘솔 확인

```
NCP Console → Cloud Outbound Mailer → 발송 이력
- 발신자 주소 확인
- DMARC 상태 확인
- Bounce 이유 확인
```

### Step 4: 긴급 조치

```bash
# 문제 코드 롤백
git revert HEAD
git push origin main

# 또는 환경변수 수정
gh secret set NCP_ACCESS_KEY --body "ncp_iam_BPAMKR..."
gh workflow run deploy-production.yml
```

---

## 8. 핵심 요약

### 현재 상태 (2025-11-13)

| 구분 | 상태 | 설명 |
|------|------|------|
| 발신자 주소 | ✅ 정상 | `noreply@nmc.or.kr` 단일 사용 |
| 이메일 발송 시스템 | ✅ 정상 | NCP Cloud Outbound Mailer |
| 다중 관리자 알림 | ✅ 의도된 설계 | 승인 권한자 모두에게 발송 |
| 환경변수 검증 | ⚠️ 부분 구현 | approve에만 있음, notify에는 없음 |
| DMARC 설정 | ❌ 미완료 | aed.pics 도메인 사용 불가 |

### 과거 문제 (2025-11-07 이전)

| 문제 | 원인 | 해결 상태 |
|------|------|----------|
| 여러 개인 계정 발송 | Resend API 사용 | ✅ 해결 (NCP 전환) |
| DMARC 정책 위반 | 하드코딩된 발신자 | ✅ 해결 (sendSmartEmail) |

### 재발 위험 요소

| 위험 | 가능성 | 대응 방안 |
|------|--------|----------|
| 스마트 선택 활성화 | 중간 | 주석에 명확한 조건 명시 |
| 환경변수 누락 | 낮음 | notify에 검증 로직 추가 |
| 관리자 계정 급증 | 낮음 | 우선순위 로직 도입 |

---

## 9. 액션 아이템

### 즉시 (이번 주)

- [ ] `/app/api/admin/notify-new-signup/route.ts`에 환경변수 검증 추가
- [ ] `/lib/email/ncp-email.ts` 주석 상세화
- [ ] 이 문서를 팀과 공유

### 단기 (1개월 내)

- [ ] 알림 수신자 최적화 로직 구현 (우선순위 기반)
- [ ] DMARC 설정 완료 (IT 관리자 협조)
- [ ] 관리자용 알림 설정 페이지 구현

### 장기 (3개월 내)

- [ ] 배치 알림 시스템 도입 (Daily Digest)
- [ ] 이메일 발송 통계 대시보드 구축
- [ ] A/B 테스트: 즉시 vs 배치 알림

---

**문서 버전**: 1.0
**다음 리뷰**: 2025-12-13
**담당자**: truth0530@nmc.or.kr
