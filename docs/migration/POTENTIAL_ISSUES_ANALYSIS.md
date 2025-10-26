# NCP 마이그레이션 잠재적 문제 분석 및 개선 계획

작성일: 2025-10-25 21:00
분석 대상: Phase 3 완료 후 전체 시스템

---

## 발견된 문제

### 1. Supabase 참조가 남아있는 API 파일 (27개)

**문제**: 여전히 27개 API 파일이 Supabase를 사용 중
**영향**: 국정원 인증 차단, 빌드 실패 가능성
**우선순위**: 높음

#### 분류

**비밀번호 재설정 API (3개)**
- app/api/auth/verify-reset-token/route.ts
- app/api/auth/update-password/route.ts
- app/api/auth/reset-password/route.ts
- 해결: NextAuth 비밀번호 재설정 기능 구현 필요

**AED Data API (6개)** - 5/6 완료 (83%)
- app/api/aed-data/check-duplicate-serial/route.ts ✅
- app/api/aed-data/by-location/route.ts ✅
- app/api/aed-data/route.ts (메인 CRUD) ⏸️ 보류 (1092줄, 매우 복잡)
- app/api/aed-data/priority/route.ts ✅
- app/api/aed-data/timestamp/route.ts ✅
- app/api/aed-data/categories/route.ts ✅
- 해결: 5개 완료, 1개 보류 (2025-10-25)

**Notifications API (4개)** ✅ 완료
- app/api/notifications/approval-result/route.ts ✅
- app/api/notifications/mark-all-read/route.ts ✅
- app/api/notifications/new-signup/route.ts ✅
- app/api/notifications/create/route.ts ✅
- 해결: Prisma 변환 완료 (2025-10-25)

**Admin API (5개)**
- app/api/admin/organizations/route.ts
- app/api/admin/run-migration/route.ts
- app/api/admin/sync-health-centers/route.ts
- app/api/admin/seed-organizations/route.ts
- app/api/admin/notify-new-signup/route.ts
- 해결: Prisma 변환 필요

**Target Matching API (3개)**
- app/api/target-matching/bulk-confirm/route.ts
- app/api/target-matching/route.ts
- app/api/target-matching/stats/route.ts
- 해결: Prisma 변환 필요 (낮은 우선순위)

**기타 API (6개)**
- app/api/schedules/route.ts
- app/api/health-center-coords/route.ts
- app/api/external-mapping/route.ts
- app/api/external-mapping/stats/route.ts
- app/api/health-centers/sync/route.ts
- app/api/stats/route.ts
- 해결: Prisma 변환 필요

---

### 2. 클라이언트 페이지 Supabase 참조

**문제**: 추정 40-50개 클라이언트 파일이 Supabase 사용
**영향**: 기능 작동 불가, 런타임 에러
**우선순위**: 높음

**주요 영향 받는 페이지**:
- 관리자 페이지 (admin/*)
- 대시보드 (dashboard/*)
- 프로필 (profile/*)
- AED 데이터 (aed-data/*)
- 점검 (inspection/*)

**해결**: Supabase client → fetch API 전환

---

### 3. 환경변수 미정리

**문제**: Supabase 관련 환경변수가 여전히 존재
**영향**: 보안 위험, 혼란
**우선순위**: 중간

**제거 필요 환경변수**:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

**유지 필요 환경변수**:
- DATABASE_URL (NCP PostgreSQL)
- NEXTAUTH_URL
- NEXTAUTH_SECRET
- JWT_SECRET

**해결**: .env.local 및 .env.example 정리

---

### 4. Supabase 패키지 의존성

**문제**: package.json에 Supabase 패키지 존재
**영향**: 번들 크기 증가, 보안 위험
**우선순위**: 낮음

**제거 가능 패키지**:
- @supabase/supabase-js
- @supabase/ssr
- @supabase/auth-helpers-nextjs

**주의**: 모든 코드 변환 완료 후에만 제거

---

### 5. 데이터베이스 스키마 동기화

**현재 상태**: ✅ 동기화 완료
**확인 날짜**: 2025-10-25
**테이블 수**: 25개

**추가된 테이블** (Phase 3):
- approval_history
- 기타 1개 (확인 필요)

**권장 작업**:
- `npx prisma db pull` 주기적 실행
- `npx prisma db push` 스키마 변경 시 실행

---

## 우선순위별 개선 계획

### 우선순위 1: 핵심 API 변환 (즉시 실행)

**AED Data API (6개) - 3시간**
- 기능: 핵심 데이터 CRUD
- 영향: 전체 시스템 작동
- 변환 난이도: 중간

**Notifications API (4개) - 2시간**
- 기능: 사용자 알림
- 영향: 사용자 경험
- 변환 난이도: 낮음

**총 예상 시간**: 5시간

---

### 우선순위 2: 클라이언트 페이지 전환 (단기)

**영향이 큰 페이지 우선 (10개) - 3시간**
- app/(authenticated)/admin/users/page.tsx
- app/(authenticated)/admin/organizations/page.tsx
- app/(authenticated)/aed-data/AEDDataPageClient.tsx
- app/(authenticated)/dashboard/dashboard-client.tsx
- app/(authenticated)/profile/page.tsx
- 기타 핵심 5개

**나머지 페이지 (30개) - 4시간**
- 일괄 변환 스크립트 사용 가능

**총 예상 시간**: 7시간

---

### 우선순위 3: Admin API 변환 (중기)

**Admin API (5개) - 2시간**
- 기능: 시스템 관리
- 영향: 관리자만
- 변환 난이도: 중간

---

### 우선순위 4: 기타 API 변환 (장기)

**비밀번호 재설정 API (3개) - 2시간**
- NextAuth 재설정 기능 구현 필요

**Target Matching API (3개) - 2시간**
- 낮은 우선순위 기능

**기타 API (6개) - 2시간**
- schedules, health-centers, external-mapping, stats

**총 예상 시간**: 6시간

---

### 우선순위 5: 정리 작업 (최종)

**환경변수 정리 (30분)**
- Supabase 환경변수 제거
- .env.example 업데이트

**패키지 제거 (30분)**
- Supabase 패키지 제거
- package.json 정리
- 의존성 테스트

**레거시 코드 제거 (1시간)**
- lib/auth-legacy 제거 여부 결정
- 사용하지 않는 유틸리티 제거

**총 예상 시간**: 2시간

---

## 전체 타임라인

| 우선순위 | 작업 | 파일 수 | 예상 시간 | 시작 가능 |
|---------|------|---------|----------|-----------|
| 1 | AED Data + Notifications API | 10 | 5시간 | 즉시 |
| 2 | 클라이언트 페이지 | 40 | 7시간 | 우선순위 1 후 |
| 3 | Admin API | 5 | 2시간 | 우선순위 2 후 |
| 4 | 기타 API | 12 | 6시간 | 우선순위 3 후 |
| 5 | 정리 작업 | - | 2시간 | 모든 변환 완료 후 |

**총 예상 시간**: 22시간
**예상 완료**: 3-4일 (하루 6-8시간 작업 기준)

---

## 즉시 개선 가능한 항목

### 1. 빠른 승리 (Quick Wins)

**Notifications API 변환 (2시간)**
- 간단한 CRUD 로직
- 의존성 적음
- 즉시 테스트 가능

**환경변수 정리 (30분)**
- 위험도 낮음
- 즉시 적용 가능

**총 소요**: 2.5시간

---

### 2. 중간 승리 (Medium Wins)

**AED Data API 변환 (3시간)**
- 핵심 기능
- 중간 난이도
- 높은 가치

**Admin API 변환 (2시간)**
- 관리 기능
- 낮은 위험도

**총 소요**: 5시간

---

## 위험 요소

### 높은 위험

**1. AED Data API 변환 실패**
- 영향: 전체 시스템 작동 불가
- 완화: 충분한 테스트, 단계적 변환

**2. 클라이언트 페이지 대량 변환 오류**
- 영향: 사용자 경험 저하
- 완화: 우선순위별 점진적 변환, 회귀 테스트

### 중간 위험

**3. 데이터베이스 스키마 불일치**
- 영향: 런타임 에러
- 완화: 주기적 동기화, 테스트

**4. 환경변수 설정 오류**
- 영향: 배포 실패
- 완화: .env.example 정확한 관리

### 낮은 위험

**5. 패키지 제거 후 빌드 실패**
- 영향: 일시적 빌드 차단
- 완화: 테스트 환경에서 먼저 제거

---

## 권장 실행 순서

### Day 1 (6-8시간)
1. Notifications API 변환 (2시간)
2. AED Data API 변환 시작 (3시간)
3. 초기 테스트 (1시간)

### Day 2 (6-8시간)
1. AED Data API 변환 완료 (1시간)
2. Admin API 변환 (2시간)
3. 클라이언트 페이지 전환 시작 (3-5시간)

### Day 3 (6-8시간)
1. 클라이언트 페이지 전환 계속 (5시간)
2. 전체 빌드 테스트 (1시간)
3. 회귀 테스트 (1-2시간)

### Day 4 (4-6시간)
1. 나머지 API 변환 (3시간)
2. 정리 작업 (2시간)
3. 최종 테스트 (1시간)

---

## 체크리스트

### 변환 전 확인사항
- [ ] Prisma 스키���와 데이터베이스 동기화 확인
- [ ] TypeScript 에러 0개 확인
- [ ] 기존 API 테스트 통과
- [ ] 백업 생성

### 변환 중 확인사항
- [ ] 각 파일 변환 후 TypeScript 체크
- [ ] API 엔드포인트 테스트
- [ ] 로그 확인
- [ ] 에러 핸들링 검증

### 변환 후 확인사항
- [ ] 전체 빌드 성공
- [ ] E2E 테스트 통과
- [ ] 성능 테스트
- [ ] 보안 취약점 스캔
- [ ] 문서 업데이트

---

작성자: Claude Code
문서 버전: 1.0
최종 업데이트: 2025-10-25 21:00

**관련 문서**:
- [PHASE3_COMPLETE.md](./PHASE3_COMPLETE.md)
- [FINAL_MIGRATION_STATUS.md](./FINAL_MIGRATION_STATUS.md)
- [NEXTAUTH_PHASE2_PROGRESS.md](./NEXTAUTH_PHASE2_PROGRESS.md)
