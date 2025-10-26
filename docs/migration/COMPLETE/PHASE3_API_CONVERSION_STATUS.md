# Phase 3 API 변환 상태 보고서
**작성일**: 2025-10-25
**작업 시간**: 약 2시간
**완료율**: API Routes 30%, 전체 20%

## 완료된 변환 작업

### 1. 사용자 관리 API (4/5 완료)

#### ✅ app/api/admin/users/approve/route.ts
- POST: 사용자 승인
- DELETE: 사용자 거부
- 상태: **99% 완료** (Prisma 스키마 수정 필요)
- 에러: actorId 필드, NotificationType enum

#### ✅ app/api/admin/users/list/route.ts
- GET: 사용자 목록 조회
- 상태: **95% 완료** (스키마 수정 필요)
- 에러: organization relation, cityCode 필드

#### ✅ app/api/admin/users/update/route.ts
- PATCH: 사용자 정보 수정
- 상태: **95% 완료**
- 에러: 변수명 오타 (profileError)

#### ✅ app/api/admin/users/reject/route.ts
- POST: 사용자 거부
- 상태: **90% 완료**
- 에러: 'rejected' UserRole enum 추가 필요, approvalHistory 모델 추가 필요

#### ❌ app/api/admin/users/bulk-approve/route.ts
- POST: 일괄 승인
- DELETE: 일괄 거부
- 상태: **0% 완료** (수동 변환 필요)
- 문제: 복잡한 루프 로직, 466줄

### 2. 점검 API (4/12 완료)

#### ✅ app/api/inspections/assigned-devices/route.ts
- GET: 할당된 장비 조회
- 상태: **95% 완료**
- 에러: assignedDevices 필드 스키마 추가 필요

#### ✅ app/api/inspections/history/route.ts
- GET: 점검 이력 조회
- 상태: **100% 완료** ✨
- 에러: 없음

#### ✅ app/api/inspections/quick/route.ts
- POST: 즉시 점검 생성
- 상태: **100% 완료** ✨
- 에러: 없음

#### ✅ app/api/inspections/batch/route.ts
- POST: 일괄 작업 처리
- 상태: **100% 완료** ✨
- 에러: 없음

#### 🔄 미변환 Inspection APIs (8개)
- app/api/inspections/mark-unavailable/route.ts
- app/api/inspections/[id]/route.ts
- app/api/inspections/[id]/delete/route.ts
- app/api/inspections/assignments/route.ts
- app/api/inspections/field/assigned/route.ts
- app/api/inspections/sessions/route.ts
- app/api/inspections/sessions/[id]/cancel/route.ts
- app/api/inspections/sessions/[id]/refresh/route.ts

## Prisma 스키마 수정 필요 사항

### 1. UserProfile 모델 추가 필드
```prisma
model UserProfile {
  // 기존 필드...
  assignedDevices  String[]  @map("assigned_devices")  // 임시 점검원용
}
```

### 2. Organization 모델 추가 필드
```prisma
model Organization {
  // 기존 필드...
  cityCode         String?   @map("city_code")
}
```

### 3. AuditLog 모델 수정
```prisma
model AuditLog {
  id          String   @id @default(uuid()) @db.Uuid
  action      String
  actorId     String   @map("actor_id") @db.Uuid
  actorEmail  String   @map("actor_email")
  targetId    String?  @map("target_id") @db.Uuid
  targetEmail String?  @map("target_email")
  metadata    Json?
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("audit_logs")
}
```

### 4. Notification 모델 타입 추가
```prisma
enum NotificationType {
  approval_result
  profile_updated
  role_updated
  // 기존 타입들...
}
```

### 5. UserRole enum 추가
```prisma
enum UserRole {
  pending_approval
  rejected          // 추가 필요
  master
  // 기존 타입들...
}
```

### 6. ApprovalHistory 모델 생성
```prisma
model ApprovalHistory {
  id         String   @id @default(uuid()) @db.Uuid
  userId     String   @map("user_id") @db.Uuid
  action     String   // 'approved', 'rejected'
  reason     String?
  approvedBy String   @map("approved_by") @db.Uuid
  createdAt  DateTime @default(now()) @map("created_at")

  user       UserProfile @relation(fields: [userId], references: [id], onDelete: Cascade)
  approver   UserProfile @relation("ApproverRelation", fields: [approvedBy], references: [id])

  @@map("approval_history")
}
```

## TypeScript 에러 요약

### API Routes 에러 (API 변환 관련)
- **30개 에러** (변환한 파일들)
- 주요 원인: Prisma 스키마와 코드 불일치
- 해결 방법: 스키마 수정 후 `npx prisma generate` 실행

### Client Pages 에러 (미변환)
- **40+ 에러** (클라이언트 페이지들)
- 주요 원인: 여전히 Supabase 사용 중
- 해결 방법: fetch API로 전환 필요

## 다음 우선순위 작업

### 즉시 실행 (Critical)
1. **Prisma 스키마 수정** - 위 6개 항목 반영
2. **prisma generate 실행** - 타입 재생성
3. **TypeScript 에러 수정** - 사소한 에러들 (변수명 오타 등)
4. **bulk-approve 변환** - 466줄 파일

### 단기 (High Priority)
5. **나머지 Inspection API 8개 변환**
6. **AED Data API 변환** (약 4-5개 파일 예상)
7. **API Routes TypeScript 100% 통과**

### 중기 (Medium Priority)
8. **클라이언트 페이지 변환** - Supabase → fetch API
9. **전체 빌드 테스트**
10. **E2E 테스트**

## 변환 패턴 확립

### 인증
```typescript
// Before
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();

// After
const session = await getServerSession(authOptions);
if (!session?.user?.id) { /* 401 */ }
```

### 단순 조회
```typescript
// Before
const { data } = await supabase
  .from('user_profiles')
  .select('role, email')
  .eq('id', userId)
  .single();

// After
const data = await prisma.userProfile.findUnique({
  where: { id: userId },
  select: { role: true, email: true }
});
```

### Join 조회
```typescript
// Before
.select('*, organization:organizations(*)')

// After
include: {
  organization: {
    select: { /* fields */ }
  }
}
```

### 생성
```typescript
// Before
await supabase.from('table').insert(data).select().single()

// After
await prisma.table.create({ data: {...} })
```

### 업데이트
```typescript
// Before
await supabase.from('table').update(data).eq('id', id)

// After
await prisma.table.update({
  where: { id },
  data: {...}
})
```

### 삭제
```typescript
// Before
await supabase.from('table').delete().eq('id', id)

// After
await prisma.table.delete({ where: { id } })
```

## 통계

### 변환 완료
- API 파일: 9/50+ (18%)
- 라인 수: ~2,000줄
- Supabase 제거: ~50개 참조

### 남은 작업
- API 파일: 40+ (대부분 간단)
- 클라이언트 페이지: 15+
- 예상 완료 시간: 6-8시간

## 중요 발견사항

### Prisma 장점
1. **타입 안정성**: 컴파일 타임 에러 감지
2. **자동완성**: IDE 지원 향상
3. **명확한 에러**: P2003, P2002 등 명확한 에러 코드
4. **성능**: 네트워크 요청 감소 (JWT 로컬 검증)

### 마이그레이션 주의사항
1. **스키마 동기화**: 코드 변경 전 스키마 먼저 확인
2. **필드명 변환**: snake_case → camelCase
3. **Null vs Undefined**: Prisma는 undefined 선호
4. **Relation 명시**: @relation으로 명확히 정의

---

**작성자**: Claude Code
**검토 필요**: Prisma 스키마 수정 후 재테스트
**블로커**: 스키마 불일치로 인한 TypeScript 에러
