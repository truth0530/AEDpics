# Phase 1 최종 완료 및 QA/배포 가이드 (2025-11-10)

**상태**: ✅ **개발 완료 → QA 준비 단계**

---

## 1. Phase 1 구현 완료 요약

### 1.1 핵심 기능: 완료된 점검 관리 정책

**구현 위치**: [app/api/inspections/assignments/route.ts](../../app/api/inspections/assignments/route.ts)

**세 가지 기능**:

| 기능 | HTTP | 정책 | 상태 |
|------|------|------|------|
| 메모 수정 | PATCH | 완료된 점검도 메모 수정 가능 (타임스탐프 유지) | ✅ |
| 상태 변경 차단 | PATCH | completed → 다른 상태로 변경 불가 | ✅ |
| 마스터 삭제 | DELETE | 마스터만 완료된 점검 삭제 가능 (soft delete) | ✅ |

### 1.2 코드 검증 완료

```bash
npm run tsc      # ✅ 0 errors
npm run lint     # ✅ Passing
npm run build    # ✅ Success (118 pages)
```

### 1.3 비즈니스 로직 검증 (5가지 시나리오)

**검증 방법**: Prisma 직접 호출 (HTTP 계층 제외)
**검증 스크립트**: [test-scenarios-direct.mjs](../../test-scenarios-direct.mjs)

**결과**:

| Scenario | 설명 | 결과 |
|----------|------|------|
| A | 완료된 일정 메모 수정 → completed_at 유지 | ✅ PASS |
| B | 완료된 일정 상태 변경 시도 → 차단됨 | ✅ PASS |
| C | 마스터 계정의 완료된 일정 삭제 | ✅ PASS |
| D | 비마스터 계정의 완료된 일정 삭제 → 차단됨 | ✅ PASS |
| E | 비마스터의 본인 생성 pending 삭제 | ✅ PASS |

---

## 2. 최근 수정 사항 (2025-11-10)

### 2.1 메모 초기화 기능 추가

**파일**: [app/api/inspections/assignments/route.ts](../../app/api/inspections/assignments/route.ts) (lines 878-881)

**변경사항**:
```typescript
// BEFORE (undefined 값 무시)
if (notes) {
  updateData.notes = notes;
}

// AFTER (빈 문자열, null 허용)
if (notes !== undefined) {
  updateData.notes = notes;
}
```

**효과**: 사용자가 메모를 비우거나(빈 문자열) 삭제(null)할 수 있음

**커밋**: `118d2d4 "fix: 완료된 일정 메모 초기화 가능하도록 수정"`

---

## 3. QA 환경에서의 테스트 방법

### 3.1 준비 단계

1. **개발 서버 시작**:
```bash
npm run dev
# http://localhost:3000 에서 실행 확인
```

2. **마스터 계정 로그인**:
   - 이메일: `truth0530@nmc.or.kr` (또는 설정된 master 계정)
   - 승인 상태: `approved`

3. **테스트용 데이터 ID** (현재 DB):
   - **완료된 점검**: `14dec276-da44-4824-939a-7391a2558584`
   - **Pending 점검**: `039db787-096f-44c7-b745-2838edc6ca33`

### 3.2 시나리오 별 테스트

#### 시나리오 A: 완료된 점검 메모 수정 (허용)

```bash
# 1. 브라우저에서 점검 상세 모달 열기
# 점검 기록 → InspectionHistoryModal

# 2. 메모 필드 수정
# "테스트 메모 추가" 입력

# 3. 저장 버튼 클릭

# 4. 결과 확인
# - Status: completed (변화 없음) ✅
# - Notes: "테스트 메모 추가" ✅
# - Completed_at: 변경 전과 동일 ✅
```

#### 시나리오 B: 완료된 점검 상태 변경 차단

```bash
# 1. 상세 모달에서 상태를 pending으로 변경 시도

# 2. 기대 결과:
# - 에러 메시지: "완료된 일정의 상태를 변경할 수 없습니다."
# - 상태: completed (변화 없음) ✅
```

#### 시나리오 C: 마스터 계정의 점검 삭제 (허용)

```bash
# 1. 마스터 계정으로 로그인 확인
# 2. 완료된 점검 선택 → 삭제 버튼 클릭
# 3. 확인 다이얼로그 → "삭제" 확인

# 4. 결과 확인
# - Status: cancelled (soft delete) ✅
# - Cancelled_at: 현재 시간 설정됨 ✅
```

#### 시나리오 D: 비마스터 계정의 점검 삭제 차단

```bash
# 1. 비마스터 계정으로 로그인
#    (또는 다른 사용자가 생성한 점검 선택)

# 2. 완료된 점검의 삭제 버튼 클릭 시도

# 3. 기대 결과:
# - 삭제 버튼 비활성화 또는
# - 에러 메시지: "완료된 할당은 삭제할 수 없습니다." ✅
```

#### 시나리오 E: 비마스터의 본인 pending 삭제 (허용)

```bash
# 1. 비마스터 계정으로 본인이 생성한 pending 점검 찾기

# 2. 삭제 버튼 클릭

# 3. 결과 확인:
# - Status: cancelled ✅
# - Cancelled_at: 현재 시간 설정됨 ✅
```

### 3.3 콘솔 로그 확인

```bash
# 터미널에서 dev server 로그 모니터링
npm run dev

# 기대 로그 메시지:
# [InspectionAssignments:PATCH] Assignment status updated successfully
# [InspectionAssignments:DELETE] Assignment cancelled successfully
```

---

## 4. 배포 전 최종 체크리스트

### 4.1 코드 검증 (개발자용)

- [x] TypeScript 컴파일: `npm run tsc` → 0 errors
- [x] ESLint: `npm run lint` → Passing
- [x] 프로덕션 빌드: `npm run build` → Success
- [x] 커밋: `118d2d4` GitHub에 푸시 완료

### 4.2 QA 환경 테스트 (QA팀용)

- [ ] 시나리오 A 테스트 완료
- [ ] 시나리오 B 테스트 완료
- [ ] 시나리오 C 테스트 완료
- [ ] 시나리오 D 테스트 완료
- [ ] 시나리오 E 테스트 완료
- [ ] 콘솔 로그 확인 완료

### 4.3 배포 전 운영팀 확인 (운영팀용)

- [ ] 프로덕션 DB 백업 완료
- [ ] 배포 일정 공지 완료
- [ ] 롤백 계획 준비 완료
- [ ] 모니터링 알림 설정 완료

---

## 5. 배포 후 모니터링 (필수)

배포 후 **24시간 내** 다음을 확인하세요:

### 5.1 에러율 모니터링

```bash
pm2 logs --err | grep -i "unauthorized\|permission\|forbidden\|invalid"

# 기대: 0개 또는 매우 적음 (< 5개/시간)
```

### 5.2 API 응답 시간

```bash
pm2 logs | grep "InspectionAssignments" | tail -20

# 기대: 모든 응답 < 500ms
```

### 5.3 DB 데이터 무결성

```bash
PGPASSWORD='...' psql -c "
SELECT COUNT(*) as total,
       COUNT(CASE WHEN status='completed' AND completed_at IS NULL THEN 1 END) as anomaly
FROM inspection_assignments
WHERE updated_at > NOW() - INTERVAL '24 hours';"

# 기대: anomaly = 0 (이상 없음)
```

### 5.4 롤백 신호

다음 중 하나라도 발생하면 **즉시 롤백**:
- API 에러율 > 1%
- DB 데이터 이상 발견
- 권한 관련 501 에러
- completed_at이 현재 시간으로 업데이트됨 (타임스탐프 중복)

---

## 6. 운영 가이드

### 6.1 완료된 점검 관리 규칙

**마스터 계정** (`role = 'master'`):
- 모든 상태의 점검 삭제 가능 (soft delete → status='cancelled')
- 메모 수정 가능
- 상태 변경 차단 없음 (필요 시 직접 업데이트 가능)

**일반 계정** (보건소, 임시점검자):
- **본인이 생성한** pending만 삭제 가능
- **어떤 점검이든** 메모 수정 가능
- completed 상태의 점검은 **삭제 불가**
- completed 상태에서 **상태 변경 불가**

### 6.2 오류 메시지 대응

| 에러 메시지 | 원인 | 대응 |
|----------|------|------|
| "완료된 일정의 상태를 변경할 수 없습니다." | completed → 다른 상태로 변경 시도 | 정책상 불가. 메모만 수정 가능 |
| "완료된 할당은 삭제할 수 없습니다." | 비마스터가 completed 삭제 시도 | 마스터에 요청 필요 |
| "삭제 권한이 없습니다." | 본인이 아닌 다른 사용자의 pending 삭제 | 생성자만 삭제 가능 |

### 6.3 데이터 정정 절차

**실수로 잘못된 메모를 저장한 경우**:
1. 관리자 페이지에서 점검 레코드 선택
2. 메모 필드를 올바른 내용으로 수정
3. 저장 클릭
4. `completed_at`는 자동으로 유지됨 (정책 준수)

**완료된 점검을 취소해야 하는 경우**:
1. 마스터 계정으로 로그인
2. 점검 레코드 선택 → 삭제 버튼 클릭
3. 상태가 `cancelled`로 변경되고, `cancelled_at` 기록됨
4. 감사 로그에 삭제 내역 기록됨

---

## 7. 문제 해결 (Troubleshooting)

### Q: 메모를 입력했는데 저장되지 않음

**A**: 빈 문자열("")이 아닌지 확인
- 공백만 있는 경우: 저장됨 (스페이스 포함)
- 아무것도 입력 안 함: API에 전달 안 됨 (프론트 유효성 검사)

### Q: completed_at이 현재 시간으로 변경됨

**A**: 코드 버전 확인
1. [app/api/inspections/assignments/route.ts](../../app/api/inspections/assignments/route.ts) 라인 882 확인
2. `const isStatusChange = newStatus !== currentStatus;` 있는지 확인
3. 없으면 git pull 후 재배포

### Q: 삭제가 되지 않음 (마스터 계정)

**A**: 권한 확인
1. 마스터 계정인지 확인: `SELECT role FROM user_profiles WHERE id='...'` → `master`
2. 해당 점검의 생성자인지 확인: `assigned_by` 필드
3. 점검 상태 확인: `status='completed'`인지 (cancelled이면 이미 삭제됨)

---

## 8. 다음 단계 (Phase 2)

### 8.1 UI 개선

- [ ] [TeamMemberSelector](../../components/inspection/TeamMemberSelector.tsx): `assignment_scope` 선택 UI 추가
- [ ] [ScheduleModal](../../components/inspection/ScheduleModal.tsx): `assignment_scope` 매개변수 전달
- [ ] [AdminFullView](../../components/inspection/AdminFullView.tsx): `all_team` 필터링 표시

### 8.2 자동화 테스트

- [ ] API 핸들러 단위 테스트
- [ ] 통합 테스트 (권한 검증)
- [ ] E2E 테스트 (브라우저 자동화)

### 8.3 추가 기능

- [ ] 사진 스토리지 마이그레이션 (Supabase → NCP Object Storage)
- [ ] 점검 통계 대시보드
- [ ] 실시간 점검 현황 모니터링

---

## 9. 참고 문서

| 문서 | 용도 |
|------|------|
| [API_SCENARIO_VALIDATION_REPORT.md](./API_SCENARIO_VALIDATION_REPORT.md) | 기술적 검증 보고서 |
| [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) | 구현 완료 요약 |
| [OPERATIONAL_POLICIES.md](./OPERATIONAL_POLICIES.md) | 운영 정책 상세 |
| [test-scenarios-direct.mjs](../../test-scenarios-direct.mjs) | 검증 스크립트 |

---

## 10. 최종 배포 승인

**개발 완료 상태**: ✅

**필수 전제 조건**:
1. ✅ 코드 검증 완료
2. ✅ 5가지 비즈니스 로직 검증 완료
3. ⏳ **QA 환경 테스트 필수** (이 문서의 3번 섹션)
4. ⏳ **배포 후 24시간 모니터링 필수** (이 문서의 5번 섹션)

**배포 승인 서명** (해당 항목에 체크):
- [ ] 개발 리더: _________________ (날짜: _________)
- [ ] QA 리더: _________________ (날짜: _________)
- [ ] 운영 리더: _________________ (날짜: _________)

---

**작성**: 2025-11-10 08:00 KST
**작성자**: Claude Code
**상태**: QA_READY
**최종 검토**: 2025-11-10 08:15 KST
