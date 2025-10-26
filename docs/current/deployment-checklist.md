# Stage 1 배포 체크리스트

## 📚 프로젝트 문서 목차

### 핵심 문서
- [README.md](../README.md) - 프로젝트 개요 및 시작 가이드
- [CLAUDE.md](../CLAUDE.md) - AI 개발 가이드라인
- [archive/2025-09/deprecated_plans/STAGE_EXECUTION_PLAN.md](../archive/2025-09/deprecated_plans/STAGE_EXECUTION_PLAN.md) - 5단계 실행 계획 (Stage 0-4)
- [docs/DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - 배포 체크리스트 (현재 문서)

## 1. Supabase 데이터베이스 설정

### 마이그레이션 적용
```sql
-- Supabase Dashboard > SQL Editor에서 실행
-- 파일: supabase/migrations/20250920_add_inspection_schedule_entries.sql

CREATE TABLE IF NOT EXISTS public.inspection_schedule_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_equipment_serial VARCHAR(255) NOT NULL REFERENCES aed_data(equipment_serial) ON DELETE CASCADE,
    scheduled_for TIMESTAMPTZ NOT NULL,
    assignee_identifier TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    notes TEXT,
    created_by UUID NOT NULL REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 적용 확인
- [ ] inspection_schedule_entries 테이블 생성 확인
- [ ] 인덱스 생성 확인
- [ ] RLS 정책 적용 확인
- [ ] 트리거 작동 확인

## 2. 환경 변수 설정

### 로컬 개발 (.env.local)
```bash
# 기능 플래그
NEXT_PUBLIC_FEATURE_QUICK_INSPECT=true
NEXT_PUBLIC_FEATURE_SCHEDULE=true
NEXT_PUBLIC_FEATURE_BULK_ACTIONS=false  # Stage 3에서 활성화

# 기존 설정 유지
NEXT_PUBLIC_SUPABASE_URL=https://aieltmidsagiobpuebvv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[기존 키 유지]
```

### Vercel 프로덕션
1. Vercel Dashboard > Settings > Environment Variables
2. 다음 변수 추가:
   - `NEXT_PUBLIC_FEATURE_QUICK_INSPECT`: `true`
   - `NEXT_PUBLIC_FEATURE_SCHEDULE`: `true`
   - `NEXT_PUBLIC_FEATURE_BULK_ACTIONS`: `false`

## 3. 코드 검증

### 타입 체크
```bash
npx tsc --noEmit
```
- [ ] TypeScript 컴파일 오류 없음

### 린트 체크
```bash
npx next lint
```
- [ ] ESLint 오류 없음

### 테스트 실행
```bash
npm test
```
- [ ] 모든 테스트 통과
- [ ] 커버리지 80% 이상

### 빌드 테스트
```bash
npm run build
```
- [ ] 빌드 성공
- [ ] 번들 사이즈 확인

## 4. 기능 테스트

### 즉시 점검 기능
- [ ] 로그인 후 /aed-data 페이지 접근
- [ ] AED 목록에서 액션 버튼 메뉴 확인
- [ ] "즉시 점검" 클릭 시 패널 열림
- [ ] 점검 시작 버튼 클릭 시 API 호출 성공
- [ ] 성공 토스트 메시지 표시
- [ ] /inspection/[id] 페이지로 이동

### 일정 추가 기능
- [ ] "일정 추가" 클릭 시 모달 열림
- [ ] 날짜, 시간, 담당자, 우선순위 입력
- [ ] 저장 시 중복 검사 작동
- [ ] 성공 토스트 메시지 표시
- [ ] /scheduler 페이지로 이동

### 권한별 테스트
- [ ] temporary_inspector: 모든 액션 비활성화
- [ ] pending_approval: 모든 액션 비활성화
- [ ] email_verified: 모든 액션 비활성화
- [ ] local_admin: 모든 액션 활성화
- [ ] regional_admin: 모든 액션 활성화
- [ ] ministry_admin: 모든 액션 활성화
- [ ] emergency_center_admin: 모든 액션 활성화
- [ ] master: 모든 액션 활성화

## 5. 성능 검증

### 페이지 로딩
- [ ] /aed-data 페이지 로딩 < 3초
- [ ] 첫 번째 콘텐츠 표시 < 1.5초
- [ ] 상호작용 준비 < 2초

### API 응답
- [ ] /api/inspections/quick < 500ms
- [ ] /api/schedules < 500ms

### 대량 데이터
- [ ] 1000개 AED 목록 렌더링 부드러움
- [ ] 스크롤 성능 60fps 유지

## 6. 보안 점검

### API 보안
- [ ] 인증되지 않은 요청 차단
- [ ] 권한 없는 장치 접근 차단
- [ ] SQL 인젝션 방어
- [ ] XSS 방어

### 데이터 보호
- [ ] 민감 정보 마스킹 작동
- [ ] RLS 정책 정상 작동
- [ ] 로그에 민감 정보 없음

## 7. 배포

### Git 커밋
```bash
git add .
git commit -m "feat: Stage 1 MVP 완료 - 즉시 점검 및 일정 추가 기능"
git push origin main
```

### Vercel 자동 배포
- [ ] 빌드 성공
- [ ] 배포 완료
- [ ] 프로덕션 URL 접근 가능

## 8. 배포 후 검증

### 프로덕션 테스트
- [ ] https://aed-check-system.vercel.app 접속
- [ ] 로그인 정상 작동
- [ ] 즉시 점검 기능 작동
- [ ] 일정 추가 기능 작동
- [ ] 토스트 알림 표시

### 모니터링
- [ ] 에러 로그 확인
- [ ] 성능 메트릭 확인
- [ ] 사용자 피드백 수집

## 9. 롤백 계획

문제 발생 시:
1. Vercel Dashboard에서 이전 배포로 롤백
2. 환경 변수에서 기능 플래그 비활성화:
   - `NEXT_PUBLIC_FEATURE_QUICK_INSPECT`: `false`
   - `NEXT_PUBLIC_FEATURE_SCHEDULE`: `false`
3. 문제 수정 후 재배포

## 10. 다음 단계 (Stage 2)

Stage 1 안정화 후:
- [ ] 사용자 피드백 수집 및 반영
- [ ] Stage 2 요구사항 정의
- [ ] 실시간 동기화 아키텍처 설계
- [ ] 팀 대시보드 UI 디자인

---

**마지막 업데이트**: 2025-09-20
**작성자**: AED 점검 시스템 개발팀
**문서 버전**: 1.0.0