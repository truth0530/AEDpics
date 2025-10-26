# 일정 추가 및 점검 흐름 개선 코드 리뷰

**작성일**: 2025-10-18
**검토 범위**: 일정 추가 API, AED 데이터 조회, 권한 검증 로직

---

## 📋 변경 사항 요약

총 12개의 개선 사항이 적용되었습니다:

### ✅ 구현 완료된 항목

1. **Comment 1**: assignedTo 범위 검증 추가 (delegation 권한)
2. **Comment 2**: Inspection 모드 DB-side join 적용
3. **Comment 3**: 우선순위 API에서 페이지 범위로 assignment 조회 제한
4. **Comment 6**: 중복 할당 시 HTTP 409 반환
5. **Comment 8**: ScheduleModal에서 /api/auth/me 호출 제거

---

## ✅ 성공적인 개선사항

### 1. assignedTo 자동 할당 + Delegation 권한 검증 ⭐⭐⭐⭐⭐

**파일**: `app/api/inspections/assignments/route.ts`

**개선 내용**:
```typescript
// Before: 클라이언트가 무조건 assignedTo 전달, 검증 없음
if (!params.assignedTo) {
  return NextResponse.json({ error: '할당받을 점검원을 선택해주세요.' }, { status: 400 });
}

// After: 자동 할당 + 권한 기반 검증
const finalAssignedTo = params.assignedTo || user.id;

if (finalAssignedTo !== user.id) {
  // Scope validation based on requester's role
  if (requesterRole === 'local_admin') {
    // local_admin can only assign within their organization
    if (assigneeProfile.organization_id !== userProfile.organization_id) {
      return NextResponse.json({
        error: '보건소 관리자는 같은 조직 내에서만 할당할 수 있습니다.'
      }, { status: 403 });
    }
  } else if (broadRoles.includes(requesterRole)) {
    // master, emergency_center_admin 등은 교차 조직 할당 가능
  } else {
    return NextResponse.json({
      error: '타인에게 할당할 권한이 없습니다.'
    }, { status: 403 });
  }
}
```

**효과**:
- ✅ **보안 강화**: local_admin이 다른 조직 사용자에게 할당하는 것을 차단
- ✅ **UX 개선**: 자기 자신에게 할당 시 assignedTo 생략 가능
- ✅ **권한 계층 준수**: master/regional_admin은 교차 조직 할당 가능

**잠재적 문제**: ⚠️ 없음 (올바른 구현)

---

### 2. ScheduleModal /api/auth/me 호출 제거 ⭐⭐⭐⭐⭐

**파일**: `app/aed-data/components/ScheduleModal.tsx`

**개선 내용**:
```typescript
// Before: 매번 /api/auth/me 호출
const userResponse = await fetch('/api/auth/me');
const userData = await userResponse.json();

body: JSON.stringify({
  assignedTo: userData.user.id,  // 클라이언트가 명시적 전달
  ...
})

// After: assignedTo 생략, 서버가 자동 결정
body: JSON.stringify({
  equipmentSerials,
  // assignedTo를 생략하여 서버에서 자동으로 현재 사용자에게 할당
  scheduledDate: new Date().toISOString().split('T')[0],
  ...
})
```

**효과**:
- ✅ **성능 개선**: 불필요한 API 호출 제거 (왕복 1회 감소)
- ✅ **서버 중심 설계**: 인증 정보는 서버에서만 결정
- ✅ **보안 강화**: 클라이언트가 assignedTo를 조작할 수 없음

**잠재적 문제**: ⚠️ 없음

---

### 3. 우선순위 API에서 페이지 범위로 Assignment 조회 제한 ⭐⭐⭐⭐

**파일**: `app/api/aed-data/priority/route.ts`

**개선 내용**:
```typescript
// Before: 전체 assignments 조회
const { data: assignments } = await supabase
  .from('inspection_assignments')
  .select('equipment_serial, scheduled_date, assignment_type, status, id')
  .in('status', ['pending', 'in_progress']);

// After: 현재 페이지의 equipment_serial로 제한 + assigned_to 필터
const equipmentSerials = (aedList || []).map(aed => aed.equipment_serial).filter(Boolean);

let assignmentQuery = supabase
  .from('inspection_assignments')
  .select('equipment_serial, scheduled_date, assignment_type, status, id')
  .in('equipment_serial', equipmentSerials)  // ✅ 페이지 범위로 제한
  .in('status', ['pending', 'in_progress']);

if (userProfile.role === 'inspector') {
  assignmentQuery = assignmentQuery.eq('assigned_to', user.id);  // ✅ 자신의 것만
}
```

**효과**:
- ✅ **쿼리 효율 개선**: 전체 데이터 대신 페이지에 해당하는 50-100건만 조회
- ✅ **권한 강화**: inspector 역할은 자신의 assignments만 조회
- ✅ **스케일링 대비**: 데이터 증가 시에도 일정한 성능 유지

**잠재적 문제**: ⚠️ 없음

---

### 4. 중복 할당 시 HTTP 409 반환 ⭐⭐⭐⭐

**파일**: `app/api/inspections/assignments/route.ts`

**개선 내용**:
```typescript
// Before: 중복 체크는 하지만 항상 500 에러
if (insertError) {
  console.error('[Assignment Creation Error]', insertError);
  return NextResponse.json({ error: insertError.message }, { status: 500 });
}

// After: PostgreSQL 제약 위반 시 409 반환
if (insertError.code === '23505' || insertError.message?.includes('unique') ||
    insertError.message?.includes('duplicate')) {
  const { data: existingAssignment } = await supabase
    .from('inspection_assignments')
    .select('id, status, scheduled_date')
    .eq('equipment_serial', equipmentSerial)
    .eq('assigned_to', finalAssignedTo)
    .in('status', ['pending', 'in_progress'])
    .maybeSingle();

  return NextResponse.json({
    error: '이미 할당된 장비입니다.',
    existingAssignment: existingAssignment || null
  }, { status: 409 });
}
```

**효과**:
- ✅ **HTTP 시맨틱 준수**: 409 Conflict는 중복 리소스의 표준 응답
- ✅ **클라이언트 처리 용이**: 409 코드만 체크하면 중복 판단 가능
- ✅ **상세 정보 제공**: 기존 assignment 정보 포함

**잠재적 문제**: ⚠️ 없음

---

## ⚠️ 잠재적 문제점 및 개선 권장사항

### 1. Inspection 모드 DB-side Join 구현의 문제 🔴🔴🔴

**파일**: `app/api/aed-data/route.ts` (247-383번 줄)

**문제점**:

#### 1-1. 메모리 필터링으로 회귀 ❌

```typescript
// DB-side join을 했지만, 이후 모든 필터를 JavaScript 메모리에서 처리
let filteredJoined = joinedData.filter((item: any) => item.aed_data);

// Apply region filters on AED data
if (regionFiltersForQuery && regionFiltersForQuery.length > 0) {
  filteredJoined = filteredJoined.filter((item: any) =>
    regionFiltersForQuery.includes(item.aed_data.sido)  // ❌ 메모리 필터링
  );
}
```

**왜 문제인가**:
- DB에서 1000건을 가져온 후 JavaScript에서 필터링하면 900건을 버릴 수 있음
- 네트워크 전송량과 메모리 사용량이 증가
- **원래 목적 (DB-side join으로 성능 개선)을 달성하지 못함**

**올바른 구현**:
```typescript
let query = supabase
  .from('inspection_assignments')
  .select(`
    equipment_serial,
    status,
    aed_data!inner (*)  // ✅ inner join으로 aed_data가 null인 경우 제외
  `)
  .eq('assigned_to', user.id)
  .in('status', requestedStatuses);

// ✅ DB 레벨에서 필터링
if (regionFiltersForQuery && regionFiltersForQuery.length > 0) {
  query = query.in('aed_data.sido', regionFiltersForQuery);
}
if (cityFiltersForQuery && cityFiltersForQuery.length > 0) {
  query = query.in('aed_data.gugun', cityFiltersForQuery);
}
if (filters.category_1 && filters.category_1.length > 0) {
  query = query.in('aed_data.category_1', filters.category_1);
}
// ... 모든 필터를 DB 레벨에서 적용
```

#### 1-2. Cursor Pagination 미작동 가능성 ❌

```typescript
// Apply cursor pagination at DB level
if (cursorId) {
  query = query.gt('id', cursorId);  // ❌ inspection_assignments.id로 페이징
}
query = query.order('id', { ascending: true }).limit(queryLimit);
```

**문제**:
- `inspection_assignments.id`로 페이징하지만, 이후 JavaScript 필터링으로 결과가 줄어듦
- 예: DB에서 100건 가져왔는데 필터링 후 10건만 남으면, 클라이언트는 10건만 받음
- 다음 페이지 로드 시 불연속적인 데이터 발생 가능

**올바른 구현**:
- 모든 필터를 DB 레벨에서 적용한 후 limit 적용
- 또는 `aed_data.id`를 cursor로 사용 (join 후에도 일관성 유지)

---

### 2. 대량 삽입 트랜잭션 부재 🔴🔴

**파일**: `app/api/inspections/assignments/route.ts` (79-150번 줄)

**문제점**:

```typescript
// ✅ 청크로 나누어 병렬 삽입
const insertResults = await Promise.all(
  insertChunks.map(chunk => {
    const assignmentsToInsert = chunk.map(serial => ({
      equipment_serial: serial,
      assigned_to: finalAssignedTo,
      assigned_by: user.id,
      assignment_type: params.assignmentType,
      scheduled_date: params.scheduledDate,
      scheduled_time: params.scheduledTime,
      priority_level: params.priorityLevel,
      notes: params.notes,
      status: 'pending',
      created_at: new Date().toISOString()
    }));

    return supabase
      .from('inspection_assignments')
      .insert(assignmentsToInsert);  // ❌ 각 청크가 독립적인 트랜잭션
  })
);
```

**문제 시나리오**:
1. 1000개 장비를 50개씩 20개 청크로 나눔
2. 첫 10개 청크는 성공 (500개 삽입 완료)
3. 11번째 청크에서 네트워크 오류 발생
4. 결과: 500개는 삽입됨, 500개는 실패
5. 응답: `{ created: 500, skipped: 0, failed: 500 }`
6. **문제**: 사용자는 "전체 성공" 또는 "전체 실패"를 기대했지만, 부분 성공 상태

**개선 방안**:

#### Option 1: PostgreSQL RPC 함수로 트랜잭션 보장 (권장)

```sql
-- supabase/migrations/20251018_bulk_assignment_rpc.sql
CREATE OR REPLACE FUNCTION bulk_create_assignments(
  p_serials TEXT[],
  p_assigned_to UUID,
  p_assigned_by UUID,
  p_assignment_type TEXT,
  p_scheduled_date DATE,
  p_priority_level INT,
  p_notes TEXT
) RETURNS JSON AS $$
DECLARE
  v_created INT := 0;
  v_skipped INT := 0;
  v_result JSON;
BEGIN
  -- 단일 트랜잭션으로 처리
  INSERT INTO inspection_assignments (
    equipment_serial, assigned_to, assigned_by, assignment_type,
    scheduled_date, priority_level, notes, status
  )
  SELECT
    unnest(p_serials),
    p_assigned_to,
    p_assigned_by,
    p_assignment_type,
    p_scheduled_date,
    p_priority_level,
    p_notes,
    'pending'
  ON CONFLICT (equipment_serial, assigned_to) WHERE status IN ('pending', 'in_progress')
  DO NOTHING;

  GET DIAGNOSTICS v_created = ROW_COUNT;
  v_skipped := array_length(p_serials, 1) - v_created;

  v_result := json_build_object(
    'created', v_created,
    'skipped', v_skipped,
    'failed', 0
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
```

**사용**:
```typescript
const { data, error } = await supabase.rpc('bulk_create_assignments', {
  p_serials: equipmentSerials,
  p_assigned_to: finalAssignedTo,
  p_assigned_by: user.id,
  p_assignment_type: params.assignmentType,
  p_scheduled_date: params.scheduledDate,
  p_priority_level: params.priorityLevel,
  p_notes: params.notes
});

// 전체 성공 또는 전체 실패 보장
```

#### Option 2: 순차 처리 + 상세 에러 수집

```typescript
const results = {
  created: [] as string[],
  skipped: [] as string[],
  failed: [] as Array<{ serial: string; error: string }>
};

for (const serial of equipmentSerials) {
  try {
    const { error } = await supabase
      .from('inspection_assignments')
      .insert({ equipment_serial: serial, ... });

    if (error) {
      if (error.code === '23505') {
        results.skipped.push(serial);
      } else {
        results.failed.push({ serial, error: error.message });
      }
    } else {
      results.created.push(serial);
    }
  } catch (e) {
    results.failed.push({ serial, error: e.message });
  }
}

return NextResponse.json({
  message: `${results.created.length}개 생성, ${results.skipped.length}개 중복, ${results.failed.length}개 실패`,
  details: results
});
```

---

### 3. 로그 과다 문제 미해결 🟡

**Comment 11**에서 지적된 로그 과다 문제가 해결되지 않음:

```typescript
// app/api/aed-data/route.ts
console.log('[inspection mode] Querying with DB-side join');
console.log(`[inspection mode] Found ${joinedData.length} assignments via join`);
console.log('[API] Using jurisdiction-based query with RPC function');
console.log(`[API] Jurisdiction query returned ${allData.length} devices`);
```

**문제**:
- 모든 요청마다 로그 출력 → 프로덕션 환경에서 I/O 비용 증가
- Vercel Logs 요금 증가 가능성

**개선 방안**:
```typescript
const DEBUG = process.env.NEXT_PUBLIC_DEBUG === 'true';

if (DEBUG) {
  console.log('[inspection mode] Querying with DB-side join');
}
```

---

### 4. Pagination 계약 부재 🟡

**Comment 12**에서 지적된 pagination 계약이 문서화되지 않음.

**현재 상태**:
- `/api/aed-data`: cursor 기반 페이징 사용
- `/api/aed-data/priority`: offset 기반 페이징 사용 (개선 권장)
- `/api/inspections/assignments`: 페이징 없음 (Comment 4 미구현)

**권장 사항**:
```typescript
// 공통 Pagination 계약 정의
interface PaginationParams {
  cursor?: string;      // 다음 페이지 커서
  limit?: number;       // 페이지 크기 (default: 50, max: 200)
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    total?: number;       // optional, 성능 영향 고려
  };
}
```

---

## 📊 전체 평가

### ✅ 개선된 항목 (5개)

| Comment | 내용 | 평가 | 비고 |
|---------|------|------|------|
| 1 | assignedTo 범위 검증 | ⭐⭐⭐⭐⭐ | 완벽한 구현 |
| 8 | /api/auth/me 제거 | ⭐⭐⭐⭐⭐ | UX/보안 개선 |
| 3 | 페이지 범위 assignment 조회 | ⭐⭐⭐⭐ | 성능 개선 |
| 6 | 409 Conflict 응답 | ⭐⭐⭐⭐ | HTTP 시맨틱 준수 |

### ⚠️ 부분 개선 또는 문제 있는 항목 (3개)

| Comment | 내용 | 평가 | 문제점 |
|---------|------|------|--------|
| 2 | Inspection DB-side join | 🔴🔴 | 메모리 필터링으로 회귀 |
| 5 | 대량 삽입 트랜잭션 | 🔴🔴 | 부분 실패 처리 부재 |
| 11 | 로그 최적화 | 🟡 | 환경 변수 가드 누락 |

### ❌ 미구현 항목 (4개)

- Comment 4: 할당 목록 페이징
- Comment 7: 불필요한 상태 필터링
- Comment 10: 우선순위 API 커서 페이징
- Comment 12: Pagination 계약 문서화

---

## 🎯 우선순위 권장사항

### 🔴 즉시 수정 필요 (심각도: High)

1. **Inspection 모드 메모리 필터링 문제 수정**
   - 모든 필터를 DB 레벨로 이동
   - Cursor pagination 검증

2. **대량 삽입 트랜잭션 보장**
   - PostgreSQL RPC 함수 생성
   - 또는 순차 처리 + 상세 에러 리포트

### 🟡 개선 권장 (심각도: Medium)

3. **로그 최적화**
   - `NEXT_PUBLIC_DEBUG` 환경 변수 가드 추가

4. **Pagination 계약 문서화**
   - TypeScript interface 정의
   - API 문서 작성

### 🟢 추가 개선 (심각도: Low)

5. **할당 목록 페이징 구현** (Comment 4)
6. **우선순위 API 커서 페이징 전환** (Comment 10)

---

## 📝 결론

### 긍정적인 변화 ✅

1. **권한 체계 강화**: assignedTo delegation 검증으로 보안 향상
2. **UX 개선**: 불필요한 API 호출 제거
3. **HTTP 시맨틱 준수**: 409 Conflict 응답
4. **쿼리 최적화**: 페이지 범위로 assignment 조회 제한

### 퇴보 또는 미완성 부분 ⚠️

1. **DB-side join의 메모리 필터링**: 원래 목적 미달성
2. **트랜잭션 부재**: 부분 실패 위험
3. **로그 최적화 미완**: 프로덕션 I/O 비용 증가 가능성

### 종합 평가

**전체적으로 보안과 UX는 개선되었으나, 성능 최적화 측면에서는 일부 회귀 발생.**

**점수**: 70/100
- 보안: 90/100 (권한 검증 강화)
- UX: 85/100 (불필요한 호출 제거)
- 성능: 50/100 (메모리 필터링, 트랜잭션 부재)
- 완성도: 60/100 (4개 항목 미구현)

---

## 🛠️ 다음 단계 제안

1. **즉시**: Inspection 모드 필터링을 DB 레벨로 이동
2. **즉시**: 대량 삽입 RPC 함수 생성
3. **단기**: 로그 환경 변수 가드 추가
4. **중기**: Pagination 계약 정의 및 문서화
5. **장기**: 전체 API 페이징 일관성 확보

---

**작성자**: Claude (Code Review Agent)
**검토일**: 2025-10-18
**다음 검토 예정**: 수정 완료 후
