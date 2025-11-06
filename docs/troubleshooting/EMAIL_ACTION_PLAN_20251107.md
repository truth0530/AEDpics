# 이메일 발송 문제 최종 해결 계획

**작성일**: 2025-11-07
**작성자**: 시스템 분석팀
**긴급도**: 🔴 CRITICAL

## 📋 현재 상황 요약

### ✅ 해결된 문제들
1. **스마트 발신자 선택 시스템** 구현 완료
   - 네이버 → noreply@nmc.or.kr 자동 선택
   - 다음/한메일 → noreply@aed.pics 자동 선택

2. **null username 버그** 수정 완료
   - approval-email.ts, rejection-email.ts 수정

3. **이메일 정규화** 구현 완료
   - trim(), toLowerCase() 적용으로 NCP 일관성 문제 해결

### ❌ 미해결 문제
1. **noreply@aed.pics가 NCP에서 차단됨**
   - youth991230@nmc.or.kr 등 수신 실패
   - SEND_BLOCK_ADDRESS 에러 지속

## 🎯 즉시 실행 계획 (30분 소요)

### Step 1: NCP 차단 해제 (5분)
```bash
1. NCP Console 접속
   https://console.ncloud.com

2. Cloud Outbound Mailer → Send block list

3. 검색: "noreply@aed.pics"
   ⚠️ youth991230 검색 금지! (수신자임)

4. [차단 해제] 클릭
   사유: "시스템 발송 계정"
```

### Step 2: 테스트 발송 (10분)
```bash
# 차단 해제 확인 테스트
npx tsx scripts/check-sender-block-status.ts

# 특정 수신자 테스트
npx tsx scripts/test/test-smart-sender.ts youth991230@nmc.or.kr
```

### Step 3: 실패 사용자 재발송 (15분)
```sql
-- 최근 24시간 내 실패한 승인 이메일 조회
SELECT DISTINCT email, name, created_at
FROM user_profiles
WHERE approval_status = 'approved'
  AND created_at > NOW() - INTERVAL '24 hours'
  AND email IN (
    'youth991230@nmc.or.kr',
    'ymy0810@nmc.or.kr',
    -- 기타 실패한 이메일들
  );
```

수동 재발송 또는 스크립트 실행:
```bash
npx tsx scripts/resend-failed-approval-emails.ts
```

## 📊 모니터링 체크리스트

### 즉시 확인 (차단 해제 후)
- [ ] noreply@aed.pics → youth991230@nmc.or.kr 발송 성공
- [ ] noreply@aed.pics → ymy0810@nmc.or.kr 발송 성공
- [ ] 기타 nmc.or.kr 도메인 발송 정상

### 24시간 모니터링
- [ ] 다음/한메일 발송률 (목표: 95% 이상)
- [ ] 네이버 발송률 (목표: 95% 이상)
- [ ] nmc.or.kr 발송률 (목표: 100%)
- [ ] 새로운 차단 발생 여부

## 🔍 문제 재발 시 진단 순서

1. **에러 로그 확인**
   ```bash
   pm2 logs --err --lines 100 | grep "Email"
   ```

2. **발송자별 상태 확인**
   ```bash
   npx tsx scripts/check-sender-block-status.ts
   ```

3. **도메인별 테스트**
   ```bash
   # 네이버
   npx tsx scripts/test/test-smart-sender.ts test@naver.com

   # 다음
   npx tsx scripts/test/test-smart-sender.ts test@daum.net

   # 한메일
   npx tsx scripts/test/test-smart-sender.ts test@hanmail.net
   ```

## 📝 장기 개선 과제

### 1주일 내
- [ ] 이메일 발송 이력 DB 테이블 생성
- [ ] 실시간 모니터링 대시보드 구현
- [ ] 자동 차단 감지 및 알림 시스템

### 1개월 내
- [ ] 전용 IP 구매 검토 (월 50,000원)
- [ ] SPF/DKIM/DMARC 설정 강화
- [ ] Fallback 이메일 서비스 구축 (SendGrid/AWS SES)

## ⚠️ 중요 교훈

### DO ✅
- NCP Console 에러 메시지 정확히 해석
- 수신자와 발송자 구분 명확히
- 시스템 계정만 발송자로 사용
- 도메인별 차단 패턴 기록

### DON'T ❌
- 수신자를 발송자로 오해
- 개인 이메일을 발송자로 사용
- API 키 임의 재발급
- 차단 이유 확인 없이 해제

## 📞 비상 연락처

- **NCP 기술지원**: 1544-5876
- **시스템 관리자**: truth0530@nmc.or.kr
- **IT 관리자**: (DNS/DMARC 설정)

## 🔗 관련 문서

1. [NCP Console 화면 해석 가이드](./NCP_CONSOLE_DISPLAY_CLARIFICATION.md)
2. [이메일 위기 종합 요약](./EMAIL_CRISIS_EXECUTIVE_SUMMARY.md)
3. [빠른 차단 해제 가이드](./NCP_BLOCK_QUICK_FIX.md)
4. [이메일 디버깅 체크리스트](./EMAIL_DEBUGGING_CHECKLIST.md)

---

**다음 업데이트**: 차단 해제 후 결과 보고
**예상 완료 시간**: 2025-11-07 15:00