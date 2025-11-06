# 이메일 발송 실패 근본 원인 분석

**작성일**: 2025-11-07
**상태**: 🔴 CRITICAL - 즉시 수정 필요

## 🎯 핵심 발견: 양미연이 "관리자"로 표시되는 이유

### 코드 위치
`/app/api/admin/notify-new-signup/route.ts` (line 44)

### 문제 코드
```typescript
await sendSimpleEmail(
  config,
  adminEmail,     // ymy0810@nmc.or.kr
  '관리자',        // ❌ 하드코딩된 이름
  제목,
  내용
);
```

### 실제 동작
1. 이경진(네이버) 가입 시도
2. 시스템이 관리자들에게 알림 발송
3. 양미연(ymy0810@nmc.or.kr)도 리스트에 포함
4. **"관리자"라는 이름으로 발송**
5. NCP가 이상 감지 → 차단

## 🔍 NCP 자동 차단 메커니즘

### 차단 트리거 조건
| 조건 | 결과 | 재발 가능성 |
|------|------|------------|
| 수신자 이름 불일치 | 스팸 의심 → 차단 | 높음 |
| RECIPIENT_ADDRESS_ERROR | 즉시 차단 | 매우 높음 |
| Hard Bounce | 즉시 차단 | 매우 높음 |
| Soft Bounce 5회 | 차단 | 중간 |
| 스팸 신고 | 영구 차단 | 낮음 |

### 현재 패턴
```
발송 시도 → 실패 → 자동 차단 → 수동 해제 → 재발송 → 다시 실패 → 다시 차단
```

**⚠️ 차단 해제만으로는 해결 불가!**

## 🛠️ 즉시 수정 필요 사항

### 1. notify-new-signup 수정
```typescript
// 현재 (잘못됨)
'관리자',

// 수정안 1: 실제 이름 조회
const adminProfile = await prisma.user_profiles.findUnique({
  where: { email: adminEmail },
  select: { full_name: true }
});
const recipientName = adminProfile?.full_name || adminEmail.split('@')[0];

// 수정안 2: 이메일에서 추출
const recipientName = adminEmail.split('@')[0]; // ymy0810
```

### 2. 관리자 권한 재정의
```typescript
// 현재 (너무 광범위)
role: { in: ['master', 'emergency_center_admin', 'ministry_admin'] }

// 수정안 (실제 승인 권한자만)
role: { in: ['master', 'emergency_center_admin'] }
```

## 📊 영향받는 사용자

### 확인 필요
1. **양미연 (ymy0810@nmc.or.kr)**
   - 실제 역할: ministry_admin?
   - 승인 권한: 없음?
   - 해결: 알림 대상에서 제외

2. **youth991230@nmc.or.kr**
   - 실제 역할: 일반 사용자
   - 문제: 승인 이메일 못 받음
   - 해결: 정상 발송 필요

## 🚨 즉시 조치 계획

### Step 1: 코드 수정 (10분)
1. notify-new-signup에서 수신자 이름 동적 설정
2. ministry_admin 제외 또는 별도 처리

### Step 2: 데이터 확인 (5분)
```sql
-- 양미연 권한 확인
SELECT email, full_name, role, is_active
FROM user_profiles
WHERE email = 'ymy0810@nmc.or.kr';

-- ministry_admin 전체 확인
SELECT email, full_name, role
FROM user_profiles
WHERE role = 'ministry_admin' AND is_active = true;
```

### Step 3: 테스트 (10분)
1. 수정된 코드로 테스트 발송
2. NCP Console에서 정상 표시 확인
3. 차단 목록 추가 여부 모니터링

## 💡 핵심 인사이트

### 왜 계속 차단되는가?
1. **수신자 이름 불일치**: "관리자" ≠ 실제 이름
2. **반복 실패**: 같은 문제로 계속 실패
3. **NCP 학습**: 패턴을 스팸으로 인식

### 왜 차단 해제가 무의미한가?
- **근본 원인 미해결**: 코드가 그대로면 재발
- **NCP 자동화**: 실패 감지 시 즉시 재차단
- **신뢰도 하락**: 반복 차단으로 평판 악화

## 📝 교훈

1. **하드코딩 금지**: 수신자 이름은 동적으로
2. **권한 명확화**: 승인 권한자 명확히 구분
3. **테스트 중요**: 실제 이름 표시 확인 필수

## 🔗 관련 문서
- [이메일 위기 요약](./EMAIL_CRISIS_EXECUTIVE_SUMMARY.md)
- [NCP Console 해석](./NCP_CONSOLE_DISPLAY_CLARIFICATION.md)
- [실행 계획](./EMAIL_ACTION_PLAN_20251107.md)

---

**다음 단계**: notify-new-signup 코드 즉시 수정