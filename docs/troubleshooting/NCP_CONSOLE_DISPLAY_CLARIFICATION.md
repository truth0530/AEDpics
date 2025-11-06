# NCP Console Display 해석 가이드 - 치명적 오해 바로잡기

**작성일**: 2025-11-07
**중요도**: 🔴 CRITICAL - 명의 도용 오해 해소

## 핵심 요약: youth991230@nmc.or.kr은 피해자입니다!

**오해**: "youth991230@nmc.or.kr이 발송자로 표시되어 명의 도용된 것 같다"
**진실**: youth991230@nmc.or.kr은 **수신자**입니다. 발송자가 차단되어 이메일을 못 받은 피해자입니다.

## NCP Console 화면 해석법

### 실제 화면 표시 구조
```
수신자: youth991230@nmc.or.kr  ← 이메일을 받을 사람 (피해자)
상태: SEND_BLOCK_ADDRESS      ← 발송자가 차단됨 (noreply@aed.pics)
```

### 에러 코드 의미

| 에러 코드 | 실제 의미 | 차단된 주체 |
|----------|----------|------------|
| **SEND_BLOCK_ADDRESS** | 발송자 주소가 차단됨 | noreply@aed.pics (발송자) |
| RECIPIENT_BLOCK_ADDRESS | 수신자가 차단됨 | 수신자 이메일 |
| UNAUTHORIZED_SENDER | 인증되지 않은 발송자 | 발송자 |

## 2025-11-06 10:59:22 사건 분석

### 화면에 보인 것
- 수신자: youth991230@nmc.or.kr
- 에러: SEND_BLOCK_ADDRESS

### 실제 상황
1. **발송 시도**: noreply@aed.pics → youth991230@nmc.or.kr
2. **NCP 차단**: noreply@aed.pics가 차단 목록에 있음
3. **결과**: youth991230@nmc.or.kr이 이메일을 받지 못함
4. **표시**: NCP Console이 수신자(피해자)를 보여줌

### 명의 도용이 아닌 이유
- youth991230@nmc.or.kr은 **발송자가 아님**
- 이 사람은 이메일을 **받지 못한 피해자**
- 실제 발송자는 **noreply@aed.pics** (시스템 계정)

## 즉시 해결 방법

### 1단계: NCP Console 접속
```
1. NCP Console 로그인
2. Cloud Outbound Mailer 메뉴 진입
3. Send block list 선택
```

### 2단계: 차단된 발송자 확인
```
검색창에 입력: noreply@aed.pics
```

### 3단계: 차단 해제
```
1. noreply@aed.pics 항목 찾기
2. 차단 해제 버튼 클릭
3. 해제 사유: "시스템 발송 계정"
```

## 차단 이력 확인 결과

### 현재 차단된 발송자 (2025-11-07 기준)
- **noreply@aed.pics**: NCP에서 차단 (SEND_BLOCK_ADDRESS)
- **noreply@nmc.or.kr**: 일부 도메인에서 차단

### 차단 사유 추정
1. 과거 스팸 신고
2. Hard bounce 누적
3. 수신자 도메인 정책
4. SPF/DKIM 인증 실패

## 혼동을 일으키는 NCP UI 문제점

### 문제점
- "수신자" 라벨이 명확하지만 위치가 혼동 유발
- 에러 메시지가 발송자 문제임을 명시하지 않음
- 차단 주체를 직접 표시하지 않음

### 개선 제안 (NCP에 건의)
```
현재: 수신자: youth991230@nmc.or.kr | SEND_BLOCK_ADDRESS
개선: 수신자: youth991230@nmc.or.kr | 발송자(noreply@aed.pics) 차단됨
```

## 관련 사용자들 영향 분석

### youth991230@nmc.or.kr
- **역할**: 일반 사용자 (수신자)
- **상태**: 피해자 (이메일 못 받음)
- **조치**: 없음 (발송자 차단 해제 필요)

### truth530@daum.net
- **문제**: 554 5.7.1 스팸 차단
- **원인**: noreply@nmc.or.kr이 다음에서 차단
- **해결**: noreply@aed.pics로 발송자 변경

### db9312@hanmail.net
- **문제**: 동일 (한메일 = 다음 계열)
- **해결**: noreply@aed.pics 사용

## 검증 스크립트

### 차단 상태 확인
```bash
npx tsx scripts/check-sender-block-status.ts
```

### 특정 수신자 테스트
```bash
npx tsx scripts/test/test-smart-sender.ts youth991230@nmc.or.kr
```

## 핵심 교훈

### DO ✅
- NCP Console의 "수신자" 필드는 정말 수신자임
- SEND_BLOCK_ADDRESS는 발송자 차단 의미
- 차단 목록에서 시스템 계정 확인

### DON'T ❌
- 수신자를 발송자로 오해하지 말 것
- 명의 도용으로 성급히 판단하지 말 것
- 개인을 의심하기 전에 시스템 확인

## 결론

**youth991230@nmc.or.kr님은 아무 잘못이 없습니다.**

이 분은:
- 관리자 승인 이메일을 받아야 할 수신자
- noreply@aed.pics 차단으로 이메일을 못 받은 피해자
- 명의 도용과 전혀 관련 없음

**실제 문제**: noreply@aed.pics가 NCP에서 차단되어 있음
**해결책**: NCP Console에서 noreply@aed.pics 차단 해제

---

이 문서는 NCP Console 화면 해석의 혼란을 방지하기 위해 작성되었습니다.
추가 의문사항이 있으면 스크린샷과 함께 분석을 요청하세요.