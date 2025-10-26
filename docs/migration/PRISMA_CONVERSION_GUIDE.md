# Prisma 변환 가이드

**목적**: Supabase 쿼리를 Prisma 쿼리로 변환하는 방법

---

## 변환 패턴

### 1. Import 변경

**Before (Supabase)**:
```typescript
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createClient();
  // ...
}
```

**After (Prisma + NextAuth)**:
```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  const session = await getServerSession(authOptions);
  // ...
}
```

---

### 2. 인증 확인

**Before**:
```typescript
const { data: { user }, error } = await supabase.auth.getUser();
if (error || !user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**After**:
```typescript
const session = await getServerSession(authOptions);
if (!session?.user?.id) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

---

### 3. 데이터 조회 (SELECT)

#### 단일 레코드

**Before**:
```typescript
const { data, error } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('id', userId)
  .single();
```

**After**:
```typescript
const data = await prisma.userProfile.findUnique({
  where: { id: userId }
});
```

#### 여러 레코드

**Before**:
```typescript
const { data, error } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('role', 'admin');
```

**After**:
```typescript
const data = await prisma.userProfile.findMany({
  where: { role: 'admin' }
});
```

#### 관계 포함 (JOIN)

**Before**:
```typescript
const { data } = await supabase
  .from('user_profiles')
  .select(`
    *,
    organizations(*)
  `)
  .eq('id', userId)
  .single();
```

**After**:
```typescript
const data = await prisma.userProfile.findUnique({
  where: { id: userId },
  include: {
    organization: true
  }
});
```

---

### 4. 데이터 생성 (INSERT)

**Before**:
```typescript
const { data, error } = await supabase
  .from('user_profiles')
  .insert({
    id: uuidv4(),
    email: 'test@example.com',
    full_name: 'Test User'
  })
  .select()
  .single();
```

**After**:
```typescript
const data = await prisma.userProfile.create({
  data: {
    id: uuidv4(),
    email: 'test@example.com',
    fullName: 'Test User'
  }
});
```

---

### 5. 데이터 수정 (UPDATE)

**Before**:
```typescript
const { data, error } = await supabase
  .from('user_profiles')
  .update({ role: 'admin' })
  .eq('id', userId)
  .select()
  .single();
```

**After**:
```typescript
const data = await prisma.userProfile.update({
  where: { id: userId },
  data: { role: 'admin' }
});
```

---

### 6. 데이터 삭제 (DELETE)

**Before**:
```typescript
const { error } = await supabase
  .from('user_profiles')
  .delete()
  .eq('id', userId);
```

**After**:
```typescript
await prisma.userProfile.delete({
  where: { id: userId }
});
```

---

## 테이블명 매핑

| Supabase 테이블 | Prisma 모델 | 예시 |
|----------------|------------|------|
| `user_profiles` | `userProfile` | `prisma.userProfile` |
| `organizations` | `organization` | `prisma.organization` |
| `aed_data` | `aedData` | `prisma.aedData` |
| `inspections` | `inspection` | `prisma.inspection` |
| `inspection_schedules` | `inspectionSchedule` | `prisma.inspectionSchedule` |
| `login_history` | `loginHistory` | `prisma.loginHistory` |
| `notifications` | `notification` | `prisma.notification` |

**규칙**: snake_case → camelCase

---

## 필드명 매핑

| Supabase 필드 | Prisma 필드 | 예시 |
|--------------|------------|------|
| `full_name` | `fullName` | `profile.fullName` |
| `organization_id` | `organizationId` | `profile.organizationId` |
| `organization_name` | `organizationName` | `profile.organizationName` |
| `region_code` | `regionCode` | `profile.regionCode` |
| `created_at` | `createdAt` | `profile.createdAt` |
| `updated_at` | `updatedAt` | `profile.updatedAt` |

**규칙**: snake_case → camelCase

---

## 복잡한 쿼리 예시

### WHERE 조건

**Before**:
```typescript
const { data } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('region', '서울')
  .eq('is_active', true)
  .order('created_at', { ascending: false })
  .limit(10);
```

**After**:
```typescript
const data = await prisma.userProfile.findMany({
  where: {
    region: '서울',
    isActive: true
  },
  orderBy: {
    createdAt: 'desc'
  },
  take: 10
});
```

### OR 조건

**Before**:
```typescript
const { data } = await supabase
  .from('user_profiles')
  .select('*')
  .or('role.eq.admin,role.eq.master');
```

**After**:
```typescript
const data = await prisma.userProfile.findMany({
  where: {
    OR: [
      { role: 'admin' },
      { role: 'master' }
    ]
  }
});
```

### IN 조건

**Before**:
```typescript
const { data } = await supabase
  .from('user_profiles')
  .select('*')
  .in('role', ['admin', 'master', 'regional_admin']);
```

**After**:
```typescript
const data = await prisma.userProfile.findMany({
  where: {
    role: {
      in: ['admin', 'master', 'regional_admin']
    }
  }
});
```

### COUNT

**Before**:
```typescript
const { count } = await supabase
  .from('user_profiles')
  .select('*', { count: 'exact', head: true })
  .eq('is_active', true);
```

**After**:
```typescript
const count = await prisma.userProfile.count({
  where: {
    isActive: true
  }
});
```

---

## 실제 변환 예시

### 예시 1: 사용자 목록 API

**파일**: `app/api/admin/users/list/route.ts`

**Before**:
```typescript
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: users } = await supabase
    .from('user_profiles')
    .select(`
      *,
      organizations(*)
    `)
    .order('created_at', { ascending: false });

  return NextResponse.json({ users });
}
```

**After**:
```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const users = await prisma.userProfile.findMany({
    include: {
      organization: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return NextResponse.json({ users });
}
```

---

### 예시 2: 사용자 승인 API

**파일**: `app/api/admin/users/approve/route.ts`

**Before**:
```typescript
const { data } = await supabase
  .from('user_profiles')
  .update({
    role: newRole,
    is_active: true,
    approved_by: adminId,
    approved_at: new Date().toISOString()
  })
  .eq('id', userId)
  .select()
  .single();
```

**After**:
```typescript
const data = await prisma.userProfile.update({
  where: { id: userId },
  data: {
    role: newRole,
    isActive: true,
    approvedBy: adminId,
    approvedAt: new Date()
  }
});
```

---

## 에러 처리

**Before (Supabase)**:
```typescript
const { data, error } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('id', userId)
  .single();

if (error) {
  return NextResponse.json({ error: error.message }, { status: 500 });
}
```

**After (Prisma)**:
```typescript
try {
  const data = await prisma.userProfile.findUnique({
    where: { id: userId }
  });

  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
} catch (error) {
  return NextResponse.json({ error: 'Database error' }, { status: 500 });
}
```

---

## 변환 체크리스트

각 API 파일을 변환할 때 다음을 확인하세요:

- [ ] Supabase import 제거
- [ ] Prisma import 추가
- [ ] NextAuth import 추가 (인증 필요 시)
- [ ] `createClient()` 제거
- [ ] `supabase.auth.getUser()` → `getServerSession()`
- [ ] `supabase.from()` → `prisma.tableName`
- [ ] 테이블명 snake_case → camelCase
- [ ] 필드명 snake_case → camelCase
- [ ] `.select()` → `findMany/findUnique` + `include`
- [ ] `.insert()` → `create()`
- [ ] `.update()` → `update()`
- [ ] `.delete()` → `delete()`
- [ ] 에러 처리 try-catch 추가
- [ ] TypeScript 타입 확인
- [ ] 테스트 실행

---

## 우선순위 변환 리스트

### 긴급 (사용자 인증/관리)

1. ✅ app/api/auth/me/route.ts
2. ⏸️ app/api/auth/update-password/route.ts
3. ⏸️ app/api/auth/check-account-integrity/route.ts
4. ⏸️ app/api/admin/users/list/route.ts
5. ⏸️ app/api/admin/users/approve/route.ts
6. ⏸️ app/api/admin/users/update/route.ts
7. ⏸️ app/api/admin/users/reject/route.ts
8. ⏸️ app/api/admin/users/bulk-approve/route.ts

### 중요 (데이터 관리)

9. ⏸️ app/api/aed-data/route.ts
10. ⏸️ app/api/aed-data/categories/route.ts
11. ⏸️ app/api/aed-data/priority/route.ts
12. ⏸️ app/api/admin/organizations/route.ts

### 보통 (기타 기능)

13. ⏸️ app/api/inspections/* (10+개 파일)
14. ⏸️ app/api/external-mapping/* (2개 파일)
15. ⏸️ 나머지 API 파일들

---

## 참고 자료

- [Prisma 공식 문서](https://www.prisma.io/docs)
- [NextAuth 공식 문서](https://next-auth.js.org/)
- [Prisma CRUD](https://www.prisma.io/docs/concepts/components/prisma-client/crud)
- [Prisma Relations](https://www.prisma.io/docs/concepts/components/prisma-client/relation-queries)

---

**작성일**: 2025-10-25
**작성자**: Claude (AI Assistant)
**상태**: Phase 3 가이드
