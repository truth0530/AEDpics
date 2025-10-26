# Phase 3 Prisma 변환 진행 상황
**작성일**: 2025-10-25
**작업 시간**: 진행 중
**목표**: Supabase 쿼리 → Prisma 쿼리 전면 변환

## 완료된 작업

### 1. 사용자 관리 API 변환 (5개 파일)

#### app/api/admin/users/approve/route.ts
- POST: 사용자 승인 로직 Prisma 변환
- DELETE: 사용자 거부 로직 Prisma 변환
- **변환 내용**:
  - `supabase.auth.getUser()` → `getServerSession(authOptions)`
  - `supabase.from('user_profiles')` → `prisma.userProfile`
  - `supabase.from('audit_logs')` → `prisma.auditLog`
  - `supabase.from('notifications')` → `prisma.notification`
  - Supabase Auth Admin API 제거 (이메일 업데이트는 user_profiles에서 직접 처리)
  - 모든 `user.id` → `session.user.id` 변경
- **라인 수**: 678줄

#### app/api/admin/users/list/route.ts
- GET: 사용자 목록 조회 (필터링, 검색, 페이지네이션)
- **변환 내용**:
  - 복잡한 Supabase 쿼리 빌더 → Prisma where 조건 객체
  - `.or()` 필터 → Prisma OR 조건
  - `.range()` 페이지네이션 → Prisma skip/take
  - Organization join → Prisma include
  - 에러 처리 개선 (try-catch 구조화)
- **라인 수**: 149줄

#### app/api/admin/users/update/route.ts
- PATCH: 승인된 사용자 정보 수정
- **변환 내용**:
  - Supabase update → Prisma update with dynamic data
  - 조건부 필드 업데이트 로직 Prisma 형식으로 변환
  - Audit log + Notification 변환
- **라인 수**: 225줄

#### app/api/admin/users/reject/route.ts
- POST: 사용자 가입 거부
- **변환 내용**:
  - 완전 재작성 (sed 스크립트로 손상된 파일 복구)
  - Prisma 패턴 적용
  - Approval history 테이블 연동
- **라인 수**: 127줄

#### app/api/admin/users/bulk-approve/route.ts
- POST: 다수 사용자 일괄 승인
- DELETE: 다수 사용자 일괄 거부
- **상태**: 부분 변환 (루프 내 쿼리 변환 필요)
- **라인 수**: 466줄

### 2. 변환 패턴 확립

#### 인증 패턴
```typescript
// Before (Supabase)
const supabase = await createClient();
const { data: { user }, error: authError } = await supabase.auth.getUser();

// After (NextAuth)
const session = await getServerSession(authOptions);
if (!session?.user?.id) { ... }
```

#### 단일 레코드 조회
```typescript
// Before (Supabase)
const { data, error } = await supabase
  .from('user_profiles')
  .select('role, email')
  .eq('id', userId)
  .single();

// After (Prisma)
const data = await prisma.userProfile.findUnique({
  where: { id: userId },
  select: { role: true, email: true }
});
```

#### 업데이트
```typescript
// Before (Supabase)
const { error } = await supabase
  .from('user_profiles')
  .update({ role: 'approved', isActive: true })
  .eq('id', userId);

// After (Prisma)
await prisma.userProfile.update({
  where: { id: userId },
  data: { role: 'approved', isActive: true }
});
```

#### 복잡한 쿼리 (필터링 + 페이지네이션)
```typescript
// Before (Supabase)
let query = supabase
  .from('user_profiles')
  .select('*', { count: 'exact' })
  .eq('role', 'pending_approval')
  .or('full_name.ilike.%search%,email.ilike.%search%')
  .order('created_at', { ascending: false })
  .range(0, 49);

// After (Prisma)
const where: any = {
  role: 'pending_approval',
  OR: [
    { fullName: { contains: search, mode: 'insensitive' } },
    { email: { contains: search, mode: 'insensitive' } }
  ]
};

const [data, count] = await Promise.all([
  prisma.userProfile.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: 0,
    take: 50
  }),
  prisma.userProfile.count({ where })
]);
```

#### Join 쿼리
```typescript
// Before (Supabase)
.select('*, organization:organizations(id, name, type)')

// After (Prisma)
include: {
  organization: {
    select: { id: true, name: true, type: true }
  }
}
```

### 3. 에러 코드 매핑

| Supabase 에러 코드 | Prisma 에러 코드 | 의미 |
|-------------------|------------------|------|
| `23503` | `P2003` | Foreign key constraint violation |
| `23505` | `P2002` | Unique constraint violation |
| N/A | `P2025` | Record not found |

## 진행 중인 작업

### Inspection APIs 변환 (진행 중)

**완료 (8개)**:
- app/api/inspections/assigned-devices/route.ts ✓
- app/api/inspections/history/route.ts ✓
- app/api/inspections/quick/route.ts ✓
- app/api/inspections/batch/route.ts ✓
- app/api/inspections/sessions/[id]/cancel/route.ts ✓
- app/api/inspections/[id]/delete/route.ts ✓
- app/api/inspections/[id]/route.ts ✓ (GET + PATCH)
- app/api/inspections/mark-unavailable/route.ts ✓ (POST + DELETE)

**남은 작업 (4개)**:
- app/api/inspections/field/assigned/route.ts
- app/api/inspections/assignments/route.ts (42 참조, 복잡)
- app/api/inspections/sessions/route.ts (52 참조, 가장 복잡)
- app/api/inspections/sessions/[id]/refresh/route.ts

## TypeScript 컴파일 현황

### API Routes (변환 완료)
- 사용자 관리 API: 컴파일 성공
- 나머지 API: Supabase 임포트 제거 완료, 쿼리 변환 필요

### Client Pages (미변환)
- admin 페이지 (organization-changes, organizations, statistics, users)
- AED data 페이지
- Inspection 페이지
- Profile 페이지
- **총 에러**: ~45개 (모두 클라이언트 컴포넌트)

## 다음 단계

1. Inspection API 변환 (4개 파일)
2. AED Data API 변환
3. 클라이언트 페이지 Supabase 제거 (fetch API로 전환)
4. TypeScript 전체 빌드 테스트
5. NCP 배포 준비

## 통계

- 변환 완료 파일: 5/50+ (10%)
- 완전 제거된 Supabase 참조: ~40개
- 남은 Supabase 참조: ~100개 (대부분 클라이언트 페이지)
- 예상 완료 시간: 4-6시간

## 주의사항

- 모든 이메일 업데이트는 user_profiles 테이블에서만 처리 (NextAuth는 auth 테이블 관리 안 함)
- Prisma는 null 대신 undefined 사용 (조건부 필드 업데이트 시 주의)
- Supabase `.single()` 호출 시 에러 처리 → Prisma는 null 반환 확인
- 전화번호 암호화/복호화는 기존 로직 유지

---

**작성자**: Claude Code
**검토 필요**: bulk-approve.ts 일괄 승인/거부 루프 로직
