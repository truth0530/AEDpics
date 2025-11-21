# NCP 이메일 발송 문제 완전 해결 분석 (2025-11-22)

## 요약
2025년 10월 31일부터 시작된 Daum/Naver 이메일 발송 실패 문제가 2025년 11월 22일 완전히 해결되었습니다.

## 핵심 해결책: 도메인별 발신자 전략

| 수신자 도메인 | 발신자 | 결과 | 요청 ID (증거) |
|-------------|--------|------|-------------|
| @daum.net | noreply@nmc.or.kr | ✅ 성공 | 20251122000002804903 |
| @naver.com | noreply@aed.pics | ✅ 성공 | 20251122000003089104 |
| @nmc.or.kr | noreply@nmc.or.kr | ✅ 성공 | 20251122000003366701 |

## 타임라인

### Phase 1: 문제 발생 (2025-10-31)
- **Commit 240972d**: 도메인별 동적 발신자 선택 시스템 도입
- **결과**: Daum 이메일 발송 실패 시작
- **원인**: 복잡한 로직으로 인한 혼란

### Phase 2: 실패 시도들 (2025-11-07 ~ 2025-11-21)
다양한 시도들이 모두 실패:

#### 1. noreply@aed.pics 고정 시도
- **Commit ebd58ba (2025-11-07)**: noreply@aed.pics 비활성화
- **결과**:
  - Daum: SECURITY_AND_POLICY_ERROR
  - 요청 ID: 20251121000094332603 (truth530@daum.net 실패)

#### 2. noreply@nmc.or.kr 고정 시도
- **Commit ebc0513 (2025-11-21)**: Daum용 nmc.or.kr 고정
- **결과**:
  - Daum: SEND_BLOCK_ADDRESS
  - 요청 ID: 20251121000104135502 (truth530@daum.net 차단)

#### 3. 스마트 발신자 선택 시도
- **3개 커밋 (2025-11-21)**: 실패율 기반 자동 선택
- **결과**: 두 발신자 모두 Daum 차단

### Phase 3: 근본 원인 발견 (2025-11-22 00:00-01:00)

#### 테스트를 통한 발견
1. **admin@aed.pics 테스트**
   - 요청 ID: 20251122000001749602
   - 결과: SEND_BLOCK_ADDRESS
   - 결론: 새 발신자도 차단됨

2. **noreply@daum.net 테스트**
   - 요청 ID: 20251122000002056202 (truth530@daum.net)
   - 결과: MAIL_SENT (성공!)
   - 요청 ID: 20251122000002059604 (wowow212@daum.net)
   - 결과: MAILBOX_ERROR (잘못된 발신자 주소)

3. **핵심 발견**: NCP가 DMARC 정책에 따라 자동 차단
   - Daum은 nmc.or.kr 도메인을 신뢰
   - Naver는 aed.pics 도메인을 신뢰
   - 교차 발송시 SECURITY_AND_POLICY_ABNORMAL 발생

### Phase 4: 최종 해결 (2025-11-22 01:00)

#### 검증된 해결책 구현
```typescript
// lib/email/ncp-email.ts (lines 304-314)
const domain = to.split('@')[1]?.toLowerCase();

if (domain === 'naver.com') {
  senderEmail = 'noreply@aed.pics';  // Naver는 이것만 성공
} else if (domain === 'daum.net' || domain === 'hanmail.net') {
  senderEmail = 'noreply@nmc.or.kr';  // Daum은 이것만 성공
} else if (domain === 'nmc.or.kr') {
  senderEmail = 'noreply@nmc.or.kr';  // 같은 도메인
} else {
  senderEmail = 'noreply@aed.pics';  // 기본값 (Gmail 등)
}
```

#### 최종 검증 테스트
- **Commit 6af6988**: "fix: 도메인별 발신자 선택으로 이메일 발송 문제 해결"
- Daum 테스트: ✅ 성공 (20251122000002804903)
- Naver 테스트: ✅ 성공 (20251122000003089104)
- NMC 테스트: ✅ 성공 (3개 계정 모두)

## 오류 유형별 분석

### 1. SECURITY_AND_POLICY_ERROR
- **원인**: DMARC 정책 위반 (발신자 도메인 인증 실패)
- **발생 조건**: Daum에 noreply@aed.pics로 발송시
- **해결**: noreply@nmc.or.kr 사용

### 2. SECURITY_AND_POLICY_ABNORMAL
- **원인**: SPF/DKIM 정책 불일치
- **발생 조건**: Naver에 noreply@nmc.or.kr로 발송시
- **해결**: noreply@aed.pics 사용

### 3. SEND_BLOCK_ADDRESS
- **원인**: NCP 자동 보안 정책으로 수신자 차단
- **영향받은 계정들** (영구 차단 목록):
  - songyi@nmc.or.kr
  - doctor@nmc.or.kr
  - youth991230@nmc.or.kr
  - minseo7112@nmc.or.kr
  - ymy0810@nmc.or.kr
  - seoha@nmc.or.kr
  - song0811@nmc.or.kr
  - zmzm4628@nmc.or.kr
- **해결**: NCP 기술지원팀 요청 필요 (개별 해제 불가능)

### 4. MAILBOX_ERROR
- **원인**: 잘못된 발신자 주소 형식
- **예시**: noreply@daum.net (존재하지 않는 발신자)
- **해결**: 유효한 발신자 주소만 사용

### 5. RECIPIENT_ADDRESS_ERROR
- **원인**: 수신자 주소 오타 또는 존재하지 않는 계정
- **예시**: truth0530@daum.net (0이 추가됨)
- **해결**: 정확한 이메일 주소 확인

## 교훈

### 1. NCP Block List의 특성
- 발신자 변경으로는 우회 불가능
- 수신자 주소 자체가 차단됨
- 자동 보안 정책은 되돌리기 어려움

### 2. DMARC/SPF 정책의 중요성
- 메일 제공업체별로 신뢰하는 발신자 도메인이 다름
- 한 발신자로 모든 도메인에 발송 불가능
- 도메인 정렬(alignment)이 핵심

### 3. 디버깅 방법론
- 추측이 아닌 실제 테스트로 검증
- NCP 콘솔 로그가 진실의 소스
- 요청 ID로 추적 가능

## 현재 상태 (2025-11-22)

### 검증 완료
- ✅ Daum/Hanmail 발송 성공
- ✅ Naver 발송 성공
- ✅ NMC 내부 발송 성공
- ✅ GitHub 자동 배포 완료

### 미해결 이슈
- 일부 NMC 계정 영구 차단 (8개 계정)
- NCP 기술지원 요청 필요

## 참고 자료
- [초기 문제 분석](./EMAIL_SENDING_ISSUE_RESOLUTION.md)
- [스마트 발신자 실패 분석](./SMART_SENDER_FAILURE_ANALYSIS_2025-11-22.md)
- [최종 해결 커밋](https://github.com/username/AEDpics/commit/6af6988)

---

문서 작성일: 2025-11-22
작성자: Claude & 이광성