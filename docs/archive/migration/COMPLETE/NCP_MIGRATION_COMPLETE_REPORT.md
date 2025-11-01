# NCP 마이그레이션 완료 보고서

**작성일**: 2025-10-25
**작성자**: Claude (AI Assistant)
**프로젝트**: AEDpics - 전국 AED 관리 시스템

---

## 목차
1. [개요](#개요)
2. [데이터베이스 마이그레이션](#데이터베이스-마이그레이션)
3. [테이블별 상세 현황](#테이블별-상세-현황)
4. [API 변환 현황](#api-변환-현황)
5. [남은 작업](#남은-작업)
6. [권장사항](#권장사항)

---

## 개요

### 마이그레이션 배경
- **목적**: Supabase → NCP PostgreSQL 전환 (국정원 인증 요구사항)
- **기간**: 2025-10-11 ~ 2025-10-25 (15일)
- **범위**: 데이터베이스 스키마 + 데이터 + API 전환

### 완료 현황

| 구분 | 완료 | 전체 | 완료율 |
|------|------|------|--------|
| 데이터베이스 테이블 | 27 | 27 | 100% |
| 데이터 마이그레이션 | 5 | 5 | 100% |
| Prisma 스키마 동기화 | 26 모델 | 26 | 100% |
| API 파일 변환 | 42 | 64 | 65.6% |
| 클라이언트 페이지 | 0 | ~50 | 0% |

**총 마이그레이션 데이터**: 158,704 records

---

## 데이터베이스 마이그레이션

### 1. 데이터 마이그레이션 완료 (5개 테이블)

#### 1.1 aed_data (AED 장치 정보)
- **레코드 수**: 81,443
- **작업 내용**:
  - 10개 필드 추가 (report_date, installation_location_address, data_status 등)
  - 16개 인덱스 생성
  - search_vector 필드 + GIN 인덱스 (full-text search)
  - 4개 NOT NULL 제약조건 제거
- **GPS 커버리지**: 96.22% (78,361/81,443)
- **검증**: ✅ 완료

#### 1.2 target_list_2024 (구비의무기관)
- **레코드 수**: 26,724
- **작업 내용**:
  - 기존 테이블 DROP 후 재생성 (구조 불일치)
  - 4개 인덱스 생성
  - update trigger 생성
- **데이터 분포**: 경기(4,529), 부산(2,648), 경남(2,355)
- **검증**: ✅ 완료

#### 1.3 organizations (조직 정보)
- **레코드 수**: 291
- **작업 내용**:
  - city_code 필드 추가 (시군구 권한 필터링)
  - 기존 데이터 보존
- **구성**: 중앙 1개, 시도 17개, 시군구 273개
- **검증**: ✅ 완료

#### 1.4 management_number_group_mapping (매핑 데이터)
- **레코드 수**: 50,222
- **작업 내용**:
  - 신규 테이블 생성
  - 4개 Foreign Key (user_profiles)
  - 6개 인덱스
- **용도**: AED management_number ↔ target 그룹 매핑 (2024/2025)
- **검증**: ✅ 완료

#### 1.5 user_profiles (사용자 프로필)
- **레코드 수**: 24
- **작업 내용**:
  - 14개 필드 추가
  - user_role ENUM에 2개 값 추가 (total 9개)
  - 6개 인덱스
  - ON CONFLICT UPDATE로 기존 데이터 업데이트
- **구성**: Master 1명, Regional Emergency Center Admin 17명, 기타 6명
- **검증**: ✅ 완료

### 2. 스키마 Only 테이블 (22개)

#### 2.1 Inspection 관련 (4개)
- `inspection_assignments` (점검 할당)
- `inspection_schedules` (점검 일정)
- `inspection_sessions` (점검 세션)
- `inspections` (점검 기록)
- **상태**: 0 records (사용자 재등록 필요, 테스트 데이터 삭제됨)

#### 2.2 Notification 관련 (2개)
- `notification_templates` (알림 템플릿)
- `notifications` (알림)
- **상태**: 0 records (운영 시 데이터 생성 예정)

#### 2.3 시스템 테이블 (7개)
- `accounts`, `sessions`, `verification_tokens` (NextAuth)
- `audit_logs`, `login_history` (감사)
- `gps_issues`, `gps_analysis_logs` (GPS 검증)
- **상태**: 0 records (운영 데이터)

#### 2.4 기능 테이블 (9개)
- `target_list_devices` (타겟 매칭)
- `task_assignments` (작업 관리)
- `team_members`, `team_permissions`, `team_activity_logs` (팀 협업)
- `schedule_instances`, `inspection_schedule_entries` (스케줄)
- `otp_rate_limits` (Rate Limiting)
- `_prisma_migrations` (Prisma 마이그레이션)
- **상태**: 0 records (기능 추가 시 사용)

---

## 테이블별 상세 현황

### 📊 레코드 수 요약

| 테이블명 | 레코드 수 | 상태 | 비고 |
|---------|----------|------|------|
| aed_data | 81,443 | ✅ | 10개 필드 추가, 16 인덱스 |
| target_list_2024 | 26,724 | ✅ | 테이블 재생성 |
| organizations | 291 | ✅ | city_code 추가 |
| management_number_group_mapping | 50,222 | ✅ | 매핑 데이터 |
| user_profiles | 24 | ✅ | 14개 필드 추가 |
| **나머지 22개 테이블** | **0** | **스키마만** | **운영 시 생성** |

### 🔧 인덱스 통계

| 테이블 | 인덱스 수 | 주요 인덱스 |
|--------|-----------|-------------|
| aed_data | 16 | equipment_serial, sido+gugun, GPS, search_vector(GIN) |
| user_profiles | 6 | email(UNIQUE), role, organization_name, account_type |
| management_number_group_mapping | 6 | management_number(UNIQUE), target_key_2024/2025 |
| inspection_assignments | 8 | equipment_serial, assigned_to, status 조합 |
| inspection_sessions | 5 | equipment_serial, inspector_id, status |
| notifications | 5 | recipient_id+is_read+created_at |

### 🔗 Foreign Key 관계

**user_profiles 중심 관계도**:
- user_profiles ← 23개 테이블에서 참조
  - accounts, sessions (NextAuth)
  - inspection 관련 4개
  - management_number_group_mapping (4개 FK)
  - notifications (2개 FK)
  - team 관련 4개
  - 기타 9개

---

## API 변환 현황

### ✅ 완료된 API (42개)

#### 1. Notifications API (4개)
- `/api/notifications/approval-result`
- `/api/notifications/mark-all-read`
- `/api/notifications/new-signup`
- `/api/notifications/create`

#### 2. AED Data API (5개)
- `/api/aed-data/check-duplicate-serial`
- `/api/aed-data/by-location`
- `/api/aed-data/priority` (city_code 활성화)
- `/api/aed-data/timestamp`
- `/api/aed-data/categories`

#### 3. Inspections API (5개)
- `/api/inspections/quick`
- `/api/inspections/mark-unavailable`
- `/api/inspections/[id]`
- `/api/inspections/[id]/delete`
- `/api/inspections/assignments`

#### 4. 기타 완료 API (28개)
- User management, Organizations, GPS 등

### ❌ 남은 API (22개)

#### 카테고리별 분류

**1. Admin API (5개)**
- `/api/admin/notify-new-signup`
- `/api/admin/seed-organizations`
- `/api/admin/sync-health-centers`
- `/api/admin/run-migration`
- `/api/admin/bulk-approve` (추정)

**2. Auth API (4개)**
- `/api/auth/send-otp` ⚠️ Supabase Auth
- `/api/auth/check-email` ⚠️ Supabase Auth
- `/api/auth/verify-otp` ⚠️ Supabase Auth
- `/api/auth/admin-signup` ⚠️ Supabase Auth

**3. Target Matching API (3개)**
- `/api/target-matching`
- `/api/target-matching/stats`
- `/api/target-matching/bulk-confirm`

**4. External Mapping API (2개)**
- `/api/external-mapping`
- `/api/external-mapping/stats`

**5. Health Centers API (2개)**
- `/api/health-centers/sync`
- `/api/health-center-coords`

**6. Debug API (2개)**
- `/api/debug/check-auth-users` ⚠️ Supabase Auth
- `/api/debug/delete-auth-user` ⚠️ Supabase Auth

**7. 기타 API (4개)**
- `/api/schedules` ⚠️ Supabase Auth
- `/api/stats`
- `/api/cron/gps-analysis`
- `/api/public/aed-locations`
- `/api/aed-data` (1092줄, 매우 복잡) ⚠️

---

## 남은 작업

### 1. API 변환 (22개 파일)

**난이도별 분류**:

#### 🟢 간단 (예상 1-2시간)
- stats API
- external-mapping API
- health-centers API
- public API

#### 🟡 중간 (예상 3-5시간)
- target-matching API
- admin API (일부)
- cron API

#### 🔴 복잡 (예상 5-10시간)
- **Auth API (4개)**: Supabase Auth → NextAuth 전환 필요
- **Debug API (2개)**: Auth 시스템 종속
- **schedules API**: Auth + 복잡한 비즈니스 로직
- **aed-data/route.ts (1092줄)**: 매우 복잡한 쿼리 로직

**예상 총 소요 시간**: 15-20시간

### 2. 클라이언트 페이지 변환 (40-50개 파일)

**주요 변경사항**:
- `import { createClient } from '@/lib/supabase/client'` 제거
- `supabase.from()` → `fetch('/api/...')` 전환
- 인증 상태: `supabase.auth.getUser()` → `useSession()` (NextAuth)

**예상 총 소요 시간**: 20-30시간

### 3. 환경변수 및 패키지 정리

**제거 대상**:
```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

**package.json**:
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.x.x",  // 제거
    "@supabase/ssr": "^0.x.x"  // 제거
  }
}
```

**예상 총 소요 시간**: 1-2시간

---

## 권장사항

### 1. API 변환 우선순위

**Phase 1: 간단한 API (1-2일)**
1. public/aed-locations
2. stats
3. external-mapping (2개)
4. health-centers (2개)

**Phase 2: 중간 난이도 API (3-5일)**
1. target-matching (3개)
2. admin API (비-Auth 종속)
3. cron/gps-analysis

**Phase 3: 복잡한 API (5-7일)**
1. schedules
2. aed-data/route.ts
3. Auth API (4개) - 전문가 검토 필요
4. Debug API (2개)

### 2. 인증 시스템 전환 전략

**현재 상황**:
- Supabase Auth: auth.users 테이블 관리
- NextAuth: user_profiles + accounts 테이블 사용

**문제점**:
- auth.users 테이블 없음 (Supabase Auth 전용)
- 일부 API가 auth.users에 직접 접근

**해결 방안**:
1. **Option A**: NextAuth만 사용, user_profiles로 중복 확인
2. **Option B**: NextAuth + 커스텀 auth.users 테이블 생성
3. **Option C**: 전문가 컨설팅 (권장)

**권장**: Option A (단순함, 안정성)

### 3. 테스트 계획

**데이터베이스 테스트**:
- ✅ 스키마 동기화 완료
- ✅ Prisma Client 생성 완료
- ⏳ Foreign Key 제약조건 테스트
- ⏳ 트리거 함수 테스트

**API 테스트**:
- ⏳ 완료된 42개 API 통합 테스트
- ⏳ 남은 22개 API 변환 후 테스트

**E2E 테스트**:
- ⏳ 회원가입 플로우
- ⏳ 점검 등록 플로우
- ⏳ 데이터 조회/수정 플로우

### 4. 배포 전 체크리스트

**필수 작업**:
- [ ] 모든 API 변환 완료 (22개)
- [ ] 모든 클라이언트 페이지 변환 완료 (40-50개)
- [ ] Supabase 관련 코드 완전 제거
- [ ] 환경변수 정리
- [ ] package.json 정리
- [ ] TypeScript 타입 검사 (`npm run tsc`)
- [ ] ESLint 검사 (`npm run lint`)
- [ ] 프로덕션 빌드 테스트 (`npm run build`)
- [ ] E2E 테스트 (회원가입, 점검, 조회)

**권장 작업**:
- [ ] 성능 테스트 (250개 보건소 동시 접속)
- [ ] 보안 취약점 점검
- [ ] 데이터베이스 백업 체계 구축
- [ ] 모니터링 시스템 설정

---

## 부록

### A. Prisma 스키마 통계

**총 모델**: 26개

**주요 타입**:
- UUID: 대부분의 ID
- ENUM: user_role, notification_type, schedule_priority 등
- JSONB: 복잡한 데이터 (inspection data, matching reason 등)
- TEXT[]: permission_scope, assigned_devices, issues_found 등
- tsvector: search_vector (full-text search)

**Unsupported 타입**:
- tsvector (aed_data.search_vector) - 읽기 전용, Prisma Client에서 미지원

### B. 환경 정보

**NCP PostgreSQL**:
- 호스트: pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com
- 포트: 5432
- 데이터베이스: aedpics_production
- 스키마: aedpics
- 사용자: aedpics_admin

**로컬 개발 환경**:
- Node.js: v18+
- Next.js: 14.x
- Prisma: 6.18.0
- TypeScript: 5.x

### C. 관련 문서

- [README.md](../../README.md) - 프로젝트 개요
- [CLAUDE.md](../../CLAUDE.md) - AI 개발 가이드라인
- [docs/current/CURRENT_STATUS.md](../current/CURRENT_STATUS.md) - 현재 상황
- [docs/reference/ARCHITECTURE_OVERVIEW.md](../reference/ARCHITECTURE_OVERVIEW.md) - 아키텍처
- [supabase/README.md](../../supabase/README.md) - 데이터베이스 관리

---

**마지막 업데이트**: 2025-10-25 23:00 KST
**문서 버전**: 1.0.0
**작성자**: Claude AI Assistant

**다음 단계**: API 변환 작업 시작 (22개 파일)
