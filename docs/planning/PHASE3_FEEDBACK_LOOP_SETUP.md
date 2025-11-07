# Phase 3 피드백 루프 구조화

**목적**: Phase 2 운영팀 피드백과 Phase 3 개발팀 협의 결과를 체계적으로 수집·반영하기

**상태**: 인프라 설정 완료 (실제 피드백은 11월부터 수집)

---

## 1. 피드백 수집 채널

### 1.1 Slack 채널 구조

**주 채널**: #phase3-integration (이미 생성됨)

**부 채널들**:

| 채널 | 목적 | 주요 메시지 |
|------|------|-----------|
| #phase2-ops | Phase 2 운영 이슈 | MODE_TOGGLE 사용 문의, 교육 피드백 |
| #phase3-dev | Phase 3 개발 진행 | 설계 협의 결과, 구현 이슈, PR 리뷰 |
| #phase3-edgen | e-gen 협의 전용 | API 명세, 동기화 테스트 결과 |
| #phase3-storage | Storage 마이그레이션 전용 | NCP 버킷 설정, 데이터 이전 진행상황 |
| #phase3-dashboard | Dashboard 개발 전용 | 대시보드 요구사항, UI 검토 |

**채널 권한**:
- #phase3-integration: 모든 팀 멤버
- #phase2-ops: 운영팀 + Backend 담당자
- #phase3-dev: 개발팀 + 기술 리더
- #phase3-edgen: Backend + e-gen 담당자
- #phase3-storage: Infra + NCP 담당자
- #phase3-dashboard: Frontend + 운영팀

### 1.2 메시지 형식 및 태그

**피드백 메시지 형식**:
```
[카테고리] 제목
담당자: @이름
마감: YYYY-MM-DD
상태: 신규 / 진행중 / 해결됨

상세 내용:
- 문제점
- 예상 영향
- 제안 방안
```

**카테고리 태그** (Slack 검색 용이):
- `[Question]`: 질문 사항
- `[Issue]`: 버그 또는 문제
- `[Decision]`: 의사결정 필요
- `[Feedback]`: 개선 피드백
- `[Blocker]`: 진행 방해 요소
- `[Info]`: 정보 공유

### 1.3 메시지 스레드 관리

모든 피드백은 스레드에서 논의:
```
Main: [Issue] MODE_TOGGLE 사용자 혼동 보고
└─ Thread: 상세 논의, 해결책, 결과
```

**스레드 정리**: 주 1회 (금요일 오후) - 해결된 이슈는 클로징 표시

---

## 2. Notion 페이지 구조 (피드백 중앙 저장소)

**URL**: AEDpics 팀 Notion 워크스페이스 (기존 설정 활용)

**페이지 구조**:
```
AEDpics (Root)
├─ Phase 2 (운영팀)
│  ├─ MODE_TOGGLE Feedback (데이터베이스)
│  └─ 교육 세션 기록 (페이지)
│
├─ Phase 3 설계 (개발팀)
│  ├─ e-gen 협의록 (페이지)
│  ├─ NCP 협의록 (페이지)
│  ├─ Dashboard 협의록 (페이지)
│  └─ TBD 진행 상황 (데이터베이스)
│
└─ Phase 3 개발 추적
   ├─ Week 1 스프린트 (데이터베이스)
   ├─ Week 2 스프린트 (데이터베이스)
   └─ Week 3 스프린트 (데이터베이스)
```

### 2.1 MODE_TOGGLE Feedback 데이터베이스

**용도**: 운영팀이 보고하는 MODE_TOGGLE 관련 질문/문제/피드백 수집

**필드**:
| 필드 | 타입 | 설명 |
|------|------|------|
| Date | Date | 보고 날짜 |
| Reporter | Person | 보건소 담당자 이름 |
| Region | Multi-select | 지역 (시도/시군구) |
| Category | Select | Question / Bug / Suggestion |
| Content | Text | 상세 내용 |
| Status | Select | New / In Review / Resolved |
| Action | Text | 대응 방안 |
| Resolution Date | Date | 해결 완료 일자 |

**예시**:
```
Date: 2025-11-08
Reporter: 서울시 강서구 보건소 담당자
Category: Question
Content: "주소 모드와 관할보건소 모드에서 나오는 AED 개수가 다르면 혼동됩니다"
Status: Resolved
Action: "MODE_TOGGLE_USAGE_GUIDE.md 예시 보강 (Q1 답변 강화)"
Resolution Date: 2025-11-12
```

**모니터링**: 주 1회 (목요일) - 미해결 항목 추적

### 2.2 협의록 페이지 (e-gen, NCP, Dashboard)

**목적**: 각 팀 협의 후 결과를 문서화하고 설계 반영 상태 추적

**구성 (각 협의마다)**:

```markdown
## e-gen 팀 협의록
날짜: 2025-11-10 (또는 11-11)
시간: 14:00-15:00
참석자: Backend 개발자, e-gen 담당자 (2명)

### 합의 항목

| 항목 | 현재 설계 | 협의 결과 | 문서 업데이트 |
|------|---------|---------|--------------|
| API 엔드포인트 | [TBD] | GET /api/aed/list, /incremental | ✅ v1.1 반영 |
| 인증 방식 | [TBD] | API Key in Header | ✅ v1.1 반영 |
| 레이트 리미팅 | 3회/초 | 10회/초 (조정) | ✅ v1.1 반영 |
| ... | ... | ... | ... |

### 미해결 항목

- [ ] 테스트 API 엔드포인트 제공 (e-gen 담당, 마감: 11-14)
- [ ] API 문서 Swagger 형식 제공 (e-gen 담당, 마감: 11-14)

### 액션 아이템

| 담당자 | 항목 | 마감 | 상태 |
|--------|------|------|------|
| Backend 개발자 | PHASE3_DESIGN_EDGEN_SYNC.md v1.1 업데이트 | Fri 11-12 09:00 | ☐ |
| e-gen 담당자 | 테스트 API 엔드포인트 제공 | Thu 11-14 | ☐ |
| ... | ... | ... | ... |
```

**저장 위치**: `/AEDpics/Phase 3 설계/e-gen 협의록`

---

## 3. GitHub 이슈 추적 (기술 이슈 전용)

**목적**: 코드 변경, 아키텍처 이슈, 버그 등 기술적 문제만 추적

**이슈 라벨**:
- `phase2/ops`: Phase 2 운영팀 요청
- `phase3/edgen-sync`: e-gen 동기화 관련
- `phase3/storage-migration`: Storage 마이그레이션 관련
- `phase3/dashboard`: Dashboard 개발 관련
- `bug`: 버그
- `enhancement`: 개선 사항
- `blocked`: 진행 방해 요소

**예시 이슈**:
```
Title: e-gen API 동기화 중 타임아웃 처리

Labels: phase3/edgen-sync, bug

Body:
동기화 중 e-gen API가 응답 시간이 초과하는 경우 재시도 로직 필요

Steps to reproduce:
1. Batch sync 실행 (04:00)
2. 대량 데이터 (>10,000개) 조회
3. 네트워크 지연 상황

Expected: 지수 백오프 재시도 후 성공
Actual: 타임아웃 후 전체 배치 실패

Assigned to: @backend-dev
Due date: Mon 11-24
```

**추적**: Sprint 보드 (GitHub Projects 활용)

---

## 4. 주간 피드백 정리 프로세스

### 매주 금요일 오후 2시 (15:00)

**진행자**: 기술 리더
**참석자**: 개발팀 + 운영팀 리더

**의제** (30분):

1. **Phase 2 피드백 검토** (10분)
   - MODE_TOGGLE 관련 문의 현황
   - 해결되지 않은 이슈 추출
   - 다음주 개선 사항 우선순위

2. **Phase 3 협의 진행 상황** (15분)
   - 각 팀 협의 진행률 확인
   - 미해결 TBD 항목 논의
   - 설계 문서 업데이트 진행상황

3. **통합 이슈 해결** (5분)
   - Phase 2와 3 간 영향 분석
   - 리스크 식별 및 대응책 수립

**산출물**:
- Notion 피드백 데이터베이스 업데이트
- Slack #phase3-integration 주간 요약 포스팅
- 다음주 우선순위 정리

**기록**: Notion 페이지 → `/AEDpics/주간 검토 기록`

---

## 5. 협의 결과 문서화 및 설계 반영 플로우

### 단계 1: 협의 완료 (11월 10-11일)

각 담당자가 협의 후 즉시:
1. Slack에 `[Decision]` 태그로 결과 공유
2. Notion 협의록 페이지에 상세 기록
3. TBD 체크리스트 업데이트

### 단계 2: 설계 문서 업데이트 (11월 12일 09:00까지)

각 담당자가 24시간 내 수행:
1. 협의 결과를 설계 문서 (v1.1)에 반영
2. GitHub에 PR 생성
3. 기술 리더에게 리뷰 요청
4. Slack에 PR 링크 공유 (`[Info] v1.1 업데이트 완료`)

### 단계 3: 최종 통합 검토 (11월 11일 16:00)

Integration Design Review Meeting:
1. 3개 설계 문서 (v1.1) 최종 검토
2. 승인 및 v1.2 확정
3. Notion에 최종 협의 결과 정리
4. 모든 문서 merge 완료

---

## 6. 피드백 반영 우선순위

### 높음 (즉시 반영)
- Blocker: 개발 진행을 방해하는 요소
- Critical Issue: 데이터 무결성, 보안 문제
- 협의 결과: 3팀 협의에서 합의된 사항

### 중간 (주간 반영)
- Enhancement: 효율성 개선, 사용성 향상
- 운영팀 피드백: MODE_TOGGLE 관련 개선 건의

### 낮음 (스프린트 계획 시 고려)
- Nice-to-have: 부가 기능, 최적화
- 향후 Phase 검토 대상

---

## 7. Slack 메시지 예시 및 템플릿

### Phase 2 운영팀 피드백

```
[Feedback] MODE_TOGGLE 사용자 교육 후 질문 정리
담당자: @운영팀리더
마감: 없음 (정보 공유)

오늘 교육 세션 후 수집한 주요 질문:
1. "관할보건소 모드가 왜 필요한가?" → MODE_TOGGLE_GUIDE Q2 강화 필요
2. "다른 지역 데이터는 왜 보여지는가?" → 설명 부재
3. 모바일 환경에서 라디오 버튼이 작다 → UI 개선 고려

https://www.notion.so/... (피드백 상세 페이지)
```

### Phase 3 협의 결과 공유

```
[Decision] e-gen API 협의 완료
담당자: @backend-dev
마감: 2025-11-12 09:00

합의 사항:
✅ 엔드포인트: GET /api/aed/list, GET /api/aed/incremental
✅ 인증: API Key (Header: X-API-Key)
✅ 레이트 리미팅: 10 req/sec

미해결:
⏳ 테스트 API 엔드포인트 제공 (e-gen 담당, 11-14까지)

설계 문서 업데이트: PHASE3_DESIGN_EDGEN_SYNC.md v1.1
마감: 2025-11-12 09:00

협의 상세 기록: https://www.notion.so/... (협의록)
```

### 기술 이슈 리포팅

```
[Issue] e-gen 동기화 타임아웃 처리 필요
담당자: @backend-dev
마감: 2025-11-24 (Week 1)

상황:
- 대량 데이터 동기화 중 API 응답 지연
- 현재: 타임아웃 후 전체 배치 실패
- 필요: 지수 백오프 재시도 로직

GitHub Issue: https://github.com/truth0530/AEDpics/issues/XXX
상태: Assigned to @backend-dev
```

---

## 8. 모니터링 및 대시보드

### 주간 진행 현황판 (Notion)

```
Phase 3 진행률 대시보드
├─ 협의 진행률
│  ├─ e-gen: ████░ 80% (협의 완료, 문서 업데이트 대기)
│  ├─ NCP: ████░ 80%
│  └─ Dashboard: ███░░ 60%
├─ TBD 해결 현황
│  ├─ 확정: 12개
│  ├─ 보류: 3개
│  └─ 추가검토: 2개
└─ 위험 항목
   ├─ Blocker: 0개
   ├─ 긴급: 1개
   └─ 주의: 3개
```

**수정**: 매주 금요일 15:00 (피드백 정리 회의 후)

---

## 9. 피드백 루프 연락처

| 역할 | 이름 | Slack ID | 담당 채널 |
|------|------|----------|---------|
| 기술 리더 | @Tech Lead | @tech-lead | #phase3-integration |
| Backend 리더 | @Backend Dev | @backend-dev | #phase3-edgen |
| Infra 리더 | @Infra Dev | @infra-dev | #phase3-storage |
| Frontend 리더 | @Frontend Dev | @frontend-dev | #phase3-dashboard |
| 운영팀 리더 | @Ops Lead | @ops-lead | #phase2-ops |
| e-gen 담당자 | @e-gen Contact | @edgen-contact | #phase3-edgen |
| NCP 담당자 | @NCP Contact | @ncp-contact | #phase3-storage |

---

## 10. FAQ

**Q: 피드백이 있으면 언제 보내나요?**
A: 언제든 Slack 해당 채널에 `[Category]` 태그로 메시지 포스팅. 긴급하면 `[Blocker]` 태그 사용.

**Q: Notion과 GitHub, Slack 중 어디에 저장하나요?**
A: 3곳 모두 활용. GitHub = 코드/기술, Notion = 협의록/피드백, Slack = 실시간 소통

**Q: 해결된 피드백은 어디에 보관하나요?**
A: Notion 데이터베이스의 Status를 "Resolved"로 변경. 월별로 아카이브.

**Q: Phase 2와 3의 충돌이 생기면?**
A: 금요일 피드백 회의에서 우선순위 결정. 필요시 기술 리더가 중재.

---

**마지막 업데이트**: 2025-11-07
**문서 버전**: 1.0.0
**다음 액션**: Slack 채널 권한 설정 + Notion 페이지 생성 (기존 설정 활용 가능)
