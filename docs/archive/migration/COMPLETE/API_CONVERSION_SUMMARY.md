# API 변환 작업 요약

**작성일**: 2025-10-25
**진행 세션**: 간단한 API 변환 (Auth 불필요)

---

## 변환 완료 API (47개)

### 이번 세션에서 추가된 API (5개)

#### 1. /api/public/aed-locations (Public API)
- **파일**: [app/api/public/aed-locations/route.ts](../../app/api/public/aed-locations/route.ts)
- **변환 내용**:
  - Supabase createClient → PrismaClient
  - `supabase.from('aed_data').select()` → `prisma.aed_data.findMany()`
  - 복잡한 OR 조건 변환 (검색어)
  - bounds (지도 영역) 필터링
  - Decimal 타입 처리 (latitude, longitude)
- **상태**: ✅ 완료
- **테스트**: ⏳ 필요

#### 2. /api/stats
- **파일**: [app/api/stats/route.ts](../../app/api/stats/route.ts)
- **변환 내용**:
  - 3개 count 쿼리 병렬 처리
  - `supabase.from().select('*', { count: 'exact', head: true })` → `prisma.count()`
  - 폴백 데이터 업데이트 (실제 데이터 기준)
- **상태**: ✅ 완료
- **테스트**: ⏳ 필요

#### 3. /api/target-matching (GET)
- **파일**: [app/api/target-matching/route.ts](../../app/api/target-matching/route.ts)
- **변환 내용**:
  - RPC 함수 `get_target_matching_list_2024` 제거
  - Prisma where 조건으로 변환 (confidence level, confirmed, search)
  - Decimal 타입 처리 (auto_confidence_2024)
  - sido 필터는 post-processing (클라이언트 사이드)
- **상태**: ✅ 완료
- **데이터**: management_number_group_mapping (50,222 records)

#### 4. /api/target-matching/stats (GET)
- **파일**: [app/api/target-matching/stats/route.ts](../../app/api/target-matching/stats/route.ts)
- **변환 내용**:
  - 병렬 쿼리로 성능 최적화
  - Decimal 타입 Number 변환
  - TypeScript filter로 통계 계산
- **상태**: ✅ 완료

#### 5. /api/target-matching/bulk-confirm (POST)
- **파일**: [app/api/target-matching/bulk-confirm/route.ts](../../app/api/target-matching/bulk-confirm/route.ts)
- **변환 내용**:
  - Supabase Auth → NextAuth (getServerSession)
  - RPC 함수 `confirm_management_number_match` 제거
  - Prisma updateMany로 일괄 업데이트 (성능 향상)
  - confirmed_by_2024, confirmed_at_2024 자동 설정
- **상태**: ✅ 완료

### 이전 세션에서 완료된 API (42개)

**Notifications API (4개)**
- approval-result, mark-all-read, new-signup, create

**AED Data API (5개)**
- check-duplicate-serial, by-location, priority, timestamp, categories

**Inspections API (5개)**
- quick, mark-unavailable, [id], [id]/delete, assignments

**기타 (28개)**
- User management, Organizations, GPS 등

---

## Skip된 API (NCP에 테이블/함수 없음)

### 1. External Mapping API (2개)

**테이블/함수 부재**:
- `aed_persistent_mapping` 테이블 없음
- `match_external_system()` RPC 함수 없음
- `verify_external_mapping()` RPC 함수 없음

**영향받는 파일**:
- `/api/external-mapping` (GET, POST, PATCH, DELETE)
- `/api/external-mapping/stats`

**권장사항**:
- 이 기능이 필요한 경우 Supabase에서 테이블 및 RPC 함수 정의 가져와서 NCP에 생성 필요
- 또는 기능 제거

### 2. Health Centers API (2개)

**테이블/함수 부재**:
- `health_centers` 테이블 없음
- `health_center_aliases` 테이블 없음
- `find_health_center_id()` RPC 함수 없음

**영향받는 파일**:
- `/api/health-centers/sync` (POST, GET)
- `/api/health-center-coords`

**권장사항**:
- organizations 테이블의 health_center 타입으로 대체 가능
- 또는 Supabase에서 테이블 정의 가져오기

---

## 남은 API (Auth 시스템 변환 필요, 15개)

### Auth 관련 API (4개) ⚠️ 복잡

**파일**:
- `/api/auth/send-otp` ⚠️ Supabase Auth
- `/api/auth/check-email` ⚠️ Supabase Auth (auth.users 확인)
- `/api/auth/verify-otp` ⚠️ Supabase Auth
- `/api/auth/admin-signup` ⚠️ Supabase Auth

**문제점**:
- `supabase.auth.getUser()` 사용
- `auth.users` 테이블 직접 접근
- NextAuth로 전환 필요

**권장사항**: 인증 전문가 검토 필요

### ~~Target Matching API (3개)~~ ✅ 완료

**파일**:
- ✅ `/api/target-matching`
- ✅ `/api/target-matching/stats`
- ✅ `/api/target-matching/bulk-confirm`

**상태**: 모두 변환 완료 (2025-10-25)

### Admin API (5개)

**파일**:
- `/api/admin/notify-new-signup`
- `/api/admin/seed-organizations`
- `/api/admin/sync-health-centers`
- `/api/admin/run-migration`
- `/api/admin/bulk-approve` (추정)

**확인 필요**:
- Auth 시스템 사용 여부
- 관리자 권한 확인 로직

### Debug API (2개)

**파일**:
- `/api/debug/check-auth-users` ⚠️ Supabase Auth
- `/api/debug/delete-auth-user` ⚠️ Supabase Auth

**문제점**: auth.users 테이블 직접 접근

**권장사항**: NextAuth 전환 또는 삭제

### 기타 API (4개)

**파일**:
- `/api/schedules` ⚠️ Supabase Auth + 복잡한 로직
- `/api/cron/gps-analysis`
- `/api/aed-data/route.ts` (1092줄) ⚠️ 매우 복잡

**예상 작업 시간**: 10-15시간

---

## 완료 통계

| 구분 | 완료 | 전체 | 완료율 |
|------|------|------|--------|
| 데이터베이스 마이그레이션 | 27 | 27 | 100% |
| 간단한 API (Auth 불필요) | 44 | 44 | 100% |
| Target Matching API | 3 | 3 | 100% |
| 복잡한 API (Auth 필요) | 0 | 15 | 0% |
| Skip (테이블 없음) | 4 | 4 | 100% |
| **총 API** | **47** | **66** | **71.2%** |

---

## 다음 단계 권장사항

### Option 1: Target Matching API 변환 (우선순위 높음)
- management_number_group_mapping 테이블 사용 (이미 마이그레이션됨)
- 50,222개 매핑 데이터 활용 가능
- 예상 시간: 3-5시간

### Option 2: Admin API 변환
- 관리자 기능 필요
- Auth 시스템 확인 필요
- 예상 시간: 3-5시간

### Option 3: Auth 시스템 전환 (전문가 필요)
- Supabase Auth → NextAuth 완전 전환
- auth.users 테이블 대체 방안
- 예상 시간: 10-15시간

### Option 4: 클라이언트 페이지 전환
- 40-50개 파일
- Supabase client → fetch API
- 예상 시간: 20-30시간

---

## 기술적 이슈

### 1. Supabase Auth → NextAuth 전환 패턴

**현재 (Supabase)**:
```typescript
const { data: { user }, error } = await supabase.auth.getUser();
if (error || !user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**변환 후 (NextAuth)**:
```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const session = await getServerSession(authOptions);
if (!session?.user?.id) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### 2. RPC 함수 처리

**문제**: Supabase RPC 함수를 Prisma로 어떻게 전환?

**해결 방안**:
1. **Option A**: PostgreSQL 함수 그대로 유지 → Prisma.$queryRaw() 사용
2. **Option B**: TypeScript 함수로 재작성
3. **Option C**: Prisma의 비즈니스 로직으로 대체

**권장**: Option B (TypeScript로 재작성) - 유지보수 용이

### 3. 누락된 테이블 처리

**aed_persistent_mapping**:
- 외부 시스템 ID 매핑
- 필요 시 Supabase에서 스키마 가져오기

**health_centers**:
- organizations 테이블로 대체 가능
- type = 'health_center' 필터링

---

## 권장 작업 순서

**Phase 1: 완료 (이번 세션)**
1. ✅ public/aed-locations
2. ✅ stats

**Phase 2: 다음 우선순위 (3-5일)**
1. target-matching API (3개)
2. admin API (비-Auth 종속)
3. cron/gps-analysis

**Phase 3: Auth 시스템 전환 (5-7일, 전문가 필요)**
1. Auth API (4개)
2. schedules
3. Debug API (2개)

**Phase 4: 메인 AED API (2-3일)**
1. aed-data/route.ts (1092줄)

**Phase 5: 클라이언트 전환 (2-3주)**
1. 40-50개 페이지 파일

---

**마지막 업데이트**: 2025-10-25 23:45 KST
**문서 버전**: 1.1.0
**다음 작업**: Admin API 변환 또는 클라이언트 페이지 전환

---

## 변환 완료 세부 내역 (47개)

**By Category**:
- Notifications: 4
- AED Data: 5
- Inspections: 5
- Target Matching: 3 ✨ NEW
- Stats/Public: 2 ✨ NEW
- User Management: ~8
- Organizations: ~5
- GPS: ~5
- 기타: ~10

**By Conversion Method**:
- Direct Prisma queries: 35
- With NextAuth: 8
- RPC → TypeScript logic: 3 (target-matching)
- No conversion (same as before): 1
