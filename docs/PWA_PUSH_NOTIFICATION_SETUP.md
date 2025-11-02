# PWA 푸시 알림 설정 가이드

## 개요

AEDpics 시스템에 PWA 푸시 알림 기능이 추가되었습니다.
사용자는 데이터 개선이 필요한 경우 실시간 브라우저 알림을 받을 수 있습니다.

## 설정 절차

### 1. VAPID 키 생성

```bash
npx web-push generate-vapid-keys
```

출력 예시:
```
=======================================
Public Key:
BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U

Private Key:
VCzVBrGDmJqPTFkGDG3-YGQtXOPz4K4FqXPzQF4uJJE
=======================================
```

### 2. 환경변수 설정

#### 로컬 개발 (`.env.local`)
```bash
# VAPID Keys for Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY="생성된_공개키"
VAPID_PRIVATE_KEY="생성된_비밀키"
VAPID_SUBJECT="mailto:noreply@nmc.or.kr"
```

#### 프로덕션 (GitHub Secrets)
다음 3개 시크릿을 추가해야 합니다:

1. `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
2. `VAPID_PRIVATE_KEY`
3. `VAPID_SUBJECT`

**중요**: `NEXT_PUBLIC_*` 접두사는 클라이언트에 노출됩니다. 공개키만 이 접두사를 사용해야 합니다.

### 3. UI 컴포넌트 추가

사용자 설정 페이지에 푸시 알림 관리 UI를 추가합니다:

```tsx
// app/(authenticated)/profile/menu/page.tsx 또는 설정 페이지
import PushNotificationManager from '@/components/notifications/PushNotificationManager';

export default function SettingsPage() {
  return (
    <div>
      {/* 기존 설정 항목들 */}

      {/* 푸시 알림 설정 */}
      <PushNotificationManager />
    </div>
  );
}
```

## 작동 방식

### 구독 프로세스

1. **권한 요청**: 사용자가 "권한 요청" 버튼 클릭
2. **브라우저 프롬프트**: 브라우저가 알림 권한 요청
3. **구독 생성**: 권한 승인 시 `PushManager.subscribe()` 호출
4. **서버 저장**: 구독 정보를 DB에 저장 (`push_subscriptions` 테이블)

### 알림 발송 프로세스

1. **CRON 작업**: 매주 월요일 9시에 실행
2. **문제 조회**: 30일 이상 방치된 critical/major 문제 검색
3. **알림 발송**:
   - 이메일: NCP Cloud Outbound Mailer
   - 푸시: Web Push API (VAPID)
4. **알림 표시**: Service Worker가 브라우저 알림 표시

## 데이터베이스 스키마

```sql
CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  endpoint varchar(500) NOT NULL,
  p256dh_key varchar(200) NOT NULL,
  auth_key varchar(200) NOT NULL,
  user_agent varchar(500),
  created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at timestamptz(6),

  UNIQUE (user_id, endpoint)
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);
```

## API 엔드포인트

### GET `/api/push/vapid-public-key`
VAPID 공개키 반환 (클라이언트 구독 시 필요)

### POST `/api/push/subscribe`
푸시 구독 정보 저장

**Request Body**:
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "...",
    "auth": "..."
  }
}
```

### POST `/api/push/unsubscribe`
푸시 구독 해제

### POST `/api/push/test`
테스트 알림 발송 (현재 사용자의 모든 구독)

## 브라우저 호환성

| 브라우저 | 지원 여부 | 비고 |
|---------|---------|------|
| Chrome 50+ | ✅ | 완벽 지원 |
| Firefox 44+ | ✅ | 완벽 지원 |
| Safari 16.4+ | ✅ | iOS/macOS 모두 지원 |
| Edge 79+ | ✅ | 완벽 지원 |
| Opera 37+ | ✅ | 완벽 지원 |
| Samsung Internet | ✅ | 완벽 지원 |

**참고**:
- iOS Safari는 16.4 이상에서만 지원
- 개인정보 보호 모드에서는 일부 제한 있음
- HTTPS 필수 (localhost는 예외)

## 보안 고려사항

### 1. VAPID 키 관리
- ✅ 비밀키는 서버 환경변수에만 저장
- ✅ 공개키만 클라이언트에 노출
- ✅ 키 재발급 시 모든 구독 무효화됨 주의

### 2. 구독 정보 보안
- ✅ endpoint URL에 민감 정보 포함 가능
- ✅ HTTPS 통신 필수
- ✅ 사용자별 구독 격리 (user_id foreign key)

### 3. 데이터 전송
- ✅ 페이로드 최대 4KB 제한
- ✅ 민감 정보는 URL만 전송, 페이지에서 조회
- ✅ TTL 설정 (24시간)

## 잠재적 문제 및 해결 방안

### 문제 1: Service Worker 등록 실패
**원인**: HTTPS 미사용 또는 브라우저 미지원
**해결**:
- 프로덕션에서 HTTPS 필수
- 로컬 개발은 localhost 사용

### 문제 2: 푸시 알림 미표시
**원인**:
- Service Worker 이벤트 리스너 누락
- VAPID 키 불일치
- 브라우저 권한 거부

**해결**:
```bash
# 브라우저 콘솔에서 확인
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('SW 등록:', reg);
});

Notification.requestPermission().then(permission => {
  console.log('알림 권한:', permission);
});
```

### 문제 3: 구독이 자동 만료
**원인**:
- 사용자가 브라우저 데이터 삭제
- FCM/APNS 토큰 만료
- 구독 endpoint 변경

**해결**:
- 주기적으로 `getSubscription()` 호출하여 재구독
- `last_used_at` 필드로 오래된 구독 정리

### 문제 4: 대량 알림 발송 성능
**원인**: 동시 구독자 많을 경우 블로킹

**해결**:
```typescript
// 배치 처리 (현재 구현됨)
for (const sub of subscriptions) {
  await sendPushNotification(sub, payload);
  // 너무 빠르면 rate limit 가능성
  await new Promise(resolve => setTimeout(resolve, 100));
}
```

## 테스트 방법

### 1. 로컬 테스트

```bash
# 1. 개발 서버 실행
npm run dev

# 2. 브라우저에서 접속
# https://localhost:3001 (HTTPS 필요)

# 3. 설정 페이지에서 "권한 요청" 클릭

# 4. "테스트" 버튼 클릭하여 알림 확인
```

### 2. 프로덕션 테스트

```bash
# CRON API 직접 호출 (권한 있는 경우)
curl -X GET https://aed.pics/api/push/test \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 3. 브라우저 DevTools 활용

```javascript
// 콘솔에서 현재 구독 확인
navigator.serviceWorker.ready.then(reg => {
  reg.pushManager.getSubscription().then(sub => {
    console.log('구독 정보:', sub);
  });
});

// 알림 권한 확인
console.log('알림 권한:', Notification.permission);
```

## 모니터링 및 유지보수

### 1. 구독 통계 조회

```sql
-- 활성 구독 수
SELECT COUNT(*) FROM aedpics.push_subscriptions;

-- 사용자별 구독 수
SELECT user_id, COUNT(*) as subscription_count
FROM aedpics.push_subscriptions
GROUP BY user_id
ORDER BY subscription_count DESC;

-- 오래된 구독 (90일 이상 미사용)
SELECT * FROM aedpics.push_subscriptions
WHERE last_used_at < NOW() - INTERVAL '90 days'
OR last_used_at IS NULL;
```

### 2. 로그 확인

```bash
# PM2 로그
pm2 logs | grep "PushNotification"

# CRON 실행 로그
pm2 logs | grep "CRON:send-improvement-alerts"
```

### 3. 정기 점검 (월 1회 권장)

- [ ] VAPID 키 유효성 확인
- [ ] 오래된 구독 정리 (90일 이상 미사용)
- [ ] 발송 성공률 확인
- [ ] 에러 로그 분석

## 문의

기술 문제: truth0530@nmc.or.kr
