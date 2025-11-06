# NCP 차단 해제 - 5분 해결 가이드

## 🚨 긴급: noreply@aed.pics 차단 해제 필요

### 즉시 실행 (3단계)

#### 1️⃣ NCP Console 접속
```
https://console.ncloud.com
→ Cloud Outbound Mailer
→ Send block list
```

#### 2️⃣ 차단 목록 검색
```
검색창: noreply@aed.pics
```

#### 3️⃣ 차단 해제
```
[차단 해제] 버튼 클릭
사유: "시스템 발송 계정"
```

---

## ✅ 확인된 차단 패턴 (2025-11-07)

| 발송자 | 네이버 | 다음/한메일 | nmc.or.kr | Gmail |
|--------|--------|-------------|-----------|-------|
| noreply@aed.pics | ❌ 차단 | ✅ 정상 | ✅ 정상 | ? |
| noreply@nmc.or.kr | ✅ 정상 | ❌ 차단 | ❌ 같은도메인 | ? |

---

## 📧 현재 실패하는 이메일들

### youth991230@nmc.or.kr
- **문제**: SEND_BLOCK_ADDRESS
- **원인**: noreply@aed.pics가 NCP에서 차단됨
- **해결**: 위 3단계 실행

### truth530@daum.net
- **문제**: 554 5.7.1 스팸 차단
- **원인**: noreply@nmc.or.kr이 다음에서 차단
- **해결**: 이미 스마트 발신자가 자동 처리 중

### db9312@hanmail.net
- **문제**: 554 5.7.1 스팸 차단
- **원인**: noreply@nmc.or.kr이 한메일에서 차단
- **해결**: 이미 스마트 발신자가 자동 처리 중

---

## 🔍 차단 상태 확인 명령어

```bash
# 발송자 차단 상태 테스트
npx tsx scripts/check-sender-block-status.ts

# 특정 수신자 테스트
npx tsx scripts/test/test-smart-sender.ts youth991230@nmc.or.kr
```

---

## ⚠️ 주의사항

**절대 하지 말 것:**
- youth991230@nmc.or.kr을 차단 목록에서 검색 (수신자임!)
- 개인 이메일로 발송자 변경 (truth0530@nmc.or.kr 사용 금지)
- API 키 재발급 (다른 시스템 영향)

**반드시 할 것:**
- noreply@aed.pics 차단 해제
- 시스템 계정만 발송자로 사용
- 차단 사유 확인 및 기록

---

**소요 시간**: 5분
**난이도**: 쉬움
**효과**: 즉시 이메일 발송 정상화