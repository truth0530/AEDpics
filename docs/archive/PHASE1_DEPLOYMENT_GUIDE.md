# 🚀 Phase 1 배포 가이드

Phase 1 코드 수정이 완료되었습니다! 이제 배포하고 효과를 측정하겠습니다.

---

## ✅ 완료된 작업

### 1. AEDDataProvider SWR 옵션 최적화 ⚡
**파일**: `app/(authenticated)/aed-data/components/AEDDataProvider.tsx`

**변경사항**:
- `revalidateOnMount: false` 추가 (마운트 시 재검증 방지)
- `dedupingInterval: 60000` 증가 (2초 → 60초)
- `shouldRetryOnError: false` 추가 (빠른 실패)

**예상 효과**: 탭 전환 시 불필요한 재조회 제거

---

### 2. 추가 버튼 낙관적 업데이트 강화 🎯
**파일**: `aed-check-system/app/(authenticated)/aed-data/AEDDataPageClient.tsx`

**변경사항**:
- useEffect → useQuery로 전환 (scheduledEquipment 관리)
- Set → Array로 캐시 데이터 구조 변경 (직렬화 문제 해결)
- React Query 캐시 직접 업데이트 (낙관적 업데이트)
- exact: true로 정확한 쿼리 무효화

**예상 효과**: 
- 10초 → 0.1초 (UI 즉시 반응)
- 전체 데이터 재조회 제거

---

### 3. 대량 추가 배치 최적화 📦
**파일**: `aed-check-system/app/api/inspections/assignments/route.ts`

**변경사항**:
- 청크 크기 50개로 설정
- 중복 체크를 청크 단위로 병렬 처리 (Promise.all)
- 대량 삽입도 청크 단위로 병렬 처리

**예상 효과**: 
- 50개 기준 15초 → 3초 (80% 개선)

---

### 4. 일정 추가 API 병렬 쿼리 🚀
**파일**: `aed-check-system/app/api/inspections/assignments/route.ts`

**변경사항**:
- 순차 쿼리 3개 → Promise.all로 병렬 실행
  1. 중복 체크
  2. AED 장비 확인
  3. 점검원 확인

**예상 효과**: 
- 10초 → 1-2초 (80-90% 개선)

---

### 5. 핵심 DB 인덱스 추가 (실행 필요) ⭐
**파일**: `aed-check-system/supabase/migrations/20250000000000_add_performance_indexes.sql`

**인덱스 3개**:
1. `idx_assignments_user_status` - inspection_assignments 조회 최적화
2. `idx_aed_data_serial` - AED 장비 검색 최적화
3. `idx_sessions_inspector_status` - 점검 세션 조회 최적화

**예상 효과**: 
- Assignment 조회 시간 1-2초 → 100-200ms
- Session 조회 시간 500ms → 50-100ms

---

## 🎯 배포 순서

### Step 1: 로컬 테스트 (선택)

```bash
# 개발 서버 실행
npm run dev

# 테스트 시나리오 확인
# 1. aed-data 페이지 진입 → 로딩 속도 확인
# 2. 추가 버튼 클릭 → 즉시 UI 반응 확인
# 3. 대량 추가 50개 → 속도 확인
```

---

### Step 2: DB 인덱스 추가 (Supabase Dashboard)

```bash
# 1. Supabase Dashboard 접속
# https://supabase.com/dashboard/project/YOUR_PROJECT_ID

# 2. SQL Editor 열기 (왼쪽 메뉴)

# 3. 아래 SQL 실행
```

```sql
-- inspection_assignments 인덱스
CREATE INDEX IF NOT EXISTS idx_assignments_user_status 
ON inspection_assignments (assigned_to, status, scheduled_date DESC);

-- aed_data 검색 최적화
CREATE INDEX IF NOT EXISTS idx_aed_data_serial 
ON aed_data (equipment_serial);

-- inspection_sessions 인덱스
CREATE INDEX IF NOT EXISTS idx_sessions_inspector_status 
ON inspection_sessions (inspector_id, status, started_at DESC);
```

```bash
# 4. 인덱스 생성 확인
```

```sql
SELECT schemaname, tablename, indexname, indexdef 
FROM pg_indexes 
WHERE indexname IN (
  'idx_assignments_user_status',
  'idx_aed_data_serial',
  'idx_sessions_inspector_status'
);
```

**예상 결과**: 3개의 인덱스가 표시되어야 함

---

### Step 3: Git Commit & Push

```bash
# 1. 변경사항 확인
git status
git diff

# 2. 추가된 파일 확인
# - app/(authenticated)/aed-data/components/AEDDataProvider.tsx (수정)
# - aed-check-system/app/(authenticated)/aed-data/AEDDataPageClient.tsx (수정)
# - aed-check-system/app/api/inspections/assignments/route.ts (수정)
# - aed-check-system/supabase/migrations/20250000000000_add_performance_indexes.sql (신규)
# - aed-check-system/docs/PERFORMANCE_MEASUREMENT_GUIDE.md (신규)
# - aed-check-system/docs/PHASE1_DEPLOYMENT_GUIDE.md (신규)

# 3. Commit
git add .
git commit -m "feat: Phase 1 성능 최적화 적용

- AEDDataProvider SWR 옵션 최적화 (캐싱 개선)
- 추가 버튼 낙관적 업데이트 강화 (useQuery + React Query 캐시)
- 대량 추가 배치 최적화 (청크 단위 병렬 처리)
- 일정 추가 API 병렬 쿼리 (순차 → 병렬)
- 핵심 DB 인덱스 추가 (3개)

예상 효과:
- 사용자 체감 성능 80% 개선
- 추가 버튼 10초 → 0.1초 (UI)
- 대량 추가 50개 15초 → 3초
- API 응답 시간 50-70% 개선

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"

# 4. Push (자동 배포 트리거)
git push origin main
```

---

### Step 4: 배포 확인

```bash
# Vercel Dashboard에서 배포 상태 확인
# https://vercel.com/dashboard

# 배포 완료 후 프로덕션 URL 접속하여 테스트
```

---

## 📊 성능 측정 (After)

### 측정 순서

1. **Phase 0 가이드 참고**: `docs/PERFORMANCE_MEASUREMENT_GUIDE.md`
2. **재현 시나리오 재실행**: Before 데이터와 비교
3. **결과 기록**: After 데이터 수집

### 측정 항목

| 시나리오 | Before | After (목표) | 실제 After | 개선율 |
|---------|--------|-------------|----------|--------|
| aed-data 진입 | _____초 | 1-2초 | _____초 | ____% |
| 추가 버튼 | _____초 | 0.1초 (UI) | _____초 | ____% |
| 추가완료 탭 | 새로고침 필요 | 즉시 (0ms) | _____  | ____% |
| 대량 추가 50개 | _____초 | 3초 | _____초 | ____% |
| inspection 진입 | _____초 | 1-2초 | _____초 | ____% |
| 점검 세션 시작 | _____초 | 2초 | _____초 | ____% |

---

## 🚨 트러블슈팅

### 문제 1: 인덱스 생성 실패

**증상**: SQL 실행 시 에러 발생

**해결**:
```sql
-- 기존 인덱스가 있는지 확인
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('inspection_assignments', 'aed_data', 'inspection_sessions');

-- 중복 인덱스 제거
DROP INDEX IF EXISTS idx_assignments_user_status;
DROP INDEX IF EXISTS idx_aed_data_serial;
DROP INDEX IF EXISTS idx_sessions_inspector_status;

-- 다시 생성
```

---

### 문제 2: 빌드 에러

**증상**: Vercel 배포 시 TypeScript 에러

**해결**:
```bash
# 로컬에서 빌드 테스트
npm run build

# 에러 확인 후 수정
npm run typecheck
```

---

### 문제 3: 낙관적 업데이트가 작동하지 않음

**증상**: 추가 버튼 클릭 후 UI가 즉시 반응하지 않음

**확인사항**:
1. React Query Devtools 확인 (F12 → React Query 탭)
2. `scheduled-equipment` 쿼리 상태 확인
3. 콘솔에 에러 로그 확인

**해결**:
- 브라우저 캐시 클리어 후 재시도
- React Query 버전 확인 (`package.json`)

---

## ✅ 체크리스트

### 배포 전
- [ ] 로컬 환경에서 각 시나리오 테스트
- [ ] TypeScript 에러 없음 확인
- [ ] Git commit 메시지 작성

### 배포 중
- [ ] Supabase 인덱스 추가 완료
- [ ] Git push 완료
- [ ] Vercel 배포 성공 확인

### 배포 후
- [ ] 프로덕션에서 각 시나리오 테스트
- [ ] Phase 0 가이드로 After 데이터 측정
- [ ] Before/After 비교표 작성
- [ ] 개선율 계산

---

## 🎉 다음 단계

Phase 1 완료 및 효과 측정 후:

1. **목표 달성 시** (80% 개선):
   - Phase 2 (페이지 로딩 개선) 검토
   - 필요 시 추가 최적화

2. **목표 미달 시**:
   - 병목 구간 재분석
   - 추가 최적화 항목 검토

---

**작성일**: 2025-01-16  
**예상 소요**: 30분 (배포 + 측정)  
**다음 액션**: Step 1부터 시작
