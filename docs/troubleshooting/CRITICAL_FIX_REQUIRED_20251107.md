# 🚨 긴급 수정 필요 - 이메일 발송 실패 무한 루프

**작성일**: 2025-11-07
**긴급도**: 🔴 CRITICAL
**영향**: 모든 nmc.or.kr 도메인 사용자

## 문제 요약

**차단 해제가 무의미한 이유: 코드가 계속 차단되는 발송자를 사용합니다!**

## 🔥 즉시 수정 필요 (3개 파일)

### 1. 스마트 발신자 선택기 수정
**파일**: `lib/email/smart-sender-selector-simplified.ts`

**현재 (잘못됨) - Line 36:**
```typescript
'nmc.or.kr': ['noreply@aed.pics', 'noreply@nmc.or.kr'],
```

**수정:**
```typescript
'nmc.or.kr': ['noreply@nmc.or.kr', 'noreply@aed.pics'],
```

**이유**:
- noreply@aed.pics가 NCP에서 차단됨
- nmc.or.kr 도메인은 noreply@nmc.or.kr 사용해야 함

### 2. 승인 알림 수신자 이름 수정
**파일**: `app/api/admin/notify-new-signup/route.ts`

**현재 (잘못됨) - Line 44:**
```typescript
'관리자',  // 하드코딩
```

**수정 (route-fixed.ts 참고):**
```typescript
// 실제 이름 조회
const adminProfile = await prisma.user_profiles.findUnique({
  where: { email: adminEmail },
  select: { full_name: true }
});
const recipientName = adminProfile?.full_name || adminEmail.split('@')[0];
```

### 3. ministry_admin 제외
**파일**: `app/api/admin/notify-new-signup/route.ts`

**현재 (너무 광범위) - Line 20:**
```typescript
role: { in: ['master', 'emergency_center_admin', 'ministry_admin'] },
```

**수정:**
```typescript
role: { in: ['master', 'emergency_center_admin'] },  // ministry_admin 제외
```

## 📊 영향받는 사용자

| 이메일 | 현재 상황 | 수정 후 |
|--------|----------|---------|
| ymy0810@nmc.or.kr | ❌ 실패 (차단됨) | ✅ 정상 |
| youth991230@nmc.or.kr | ❌ 실패 (차단됨) | ✅ 정상 |
| 모든 @nmc.or.kr | ❌ 실패 | ✅ 정상 |

## 🔄 무한 루프 패턴

### 현재 (무한 루프):
```
1. nmc.or.kr 수신자 발견
2. noreply@aed.pics 선택 (우선순위)
3. NCP 차단으로 실패
4. 자동으로 차단 목록 추가
5. 수동 차단 해제
6. 1번으로 돌아감 (무한 반복)
```

### 수정 후:
```
1. nmc.or.kr 수신자 발견
2. noreply@nmc.or.kr 선택
3. 정상 발송
4. 완료
```

## ⚡ 즉시 실행 명령

### 1. 파일 백업
```bash
cp lib/email/smart-sender-selector-simplified.ts lib/email/smart-sender-selector-simplified.ts.backup
cp app/api/admin/notify-new-signup/route.ts app/api/admin/notify-new-signup/route.ts.backup
```

### 2. 수정 적용
```bash
# route-fixed.ts 내용으로 교체
cp app/api/admin/notify-new-signup/route-fixed.ts app/api/admin/notify-new-signup/route.ts
```

### 3. 스마트 선택기 수정
```bash
# 수동으로 36번 줄 수정 필요
# nmc.or.kr 우선순위 변경
```

### 4. 테스트
```bash
npx tsx scripts/test/test-smart-sender.ts ymy0810@nmc.or.kr
```

## ✅ 검증 체크리스트

- [ ] nmc.or.kr 도메인이 noreply@nmc.or.kr 사용 확인
- [ ] 수신자 이름이 실제 이름으로 표시
- [ ] ministry_admin이 알림 받지 않음
- [ ] NCP 차단 목록에 추가되지 않음

## 🎯 예상 결과

수정 후:
- **즉시 효과**: nmc.or.kr 도메인 이메일 100% 정상 발송
- **차단 해제 불필요**: 올바른 발송자 사용으로 차단 자체가 발생하지 않음
- **관리 부담 감소**: 수동 차단 해제 작업 불필요

---

**긴급도**: 즉시 수정 필요 (5분 이내)
**영향도**: 매우 높음 (모든 관리자 알림)