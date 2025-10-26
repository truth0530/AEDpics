# 🚀 프로덕션 성능 최적화 가이드

> **⚠️ 이 문서는 아카이브되었습니다**
>
> **아카이브 날짜**: 2025년 10월 17일
> **이유**: Phase 0 완료 및 내용 통합
> **최신 문서**: [PERFORMANCE_OPTIMIZATION_MASTER.md](../PERFORMANCE_OPTIMIZATION_MASTER.md)
>
> 이 문서는 **참고용**으로만 사용하세요. 최신 정보는 마스터 문서를 참조하세요.

---

**작성일**: 2025년 10월 16일
**개발 환경**: 1인 개발 시스템
**대상 환경**: AEDpics 프로덕션 환경
**분석 대상**: aed-data 페이지, inspection 페이지, API 성능

> **💡 1인 개발 특화**: 권한 요청, 승인 절차 없이 즉시 적용 가능한 최적화 중심으로 구성. 단계별 난이도와 효과를 고려해 우선순위 설정.

---

## 📋 목차

1. [문제 현황 요약](#-문제-현황-요약)
2. [성능 분석 결과](#-성능-분석-결과)
3. [적용 가능성 진단](#-적용-가능성-진단)
4. [최적화 제안 (우선순위별)](#-최적화-제안-우선순위별)
   - [P0: 즉시 적용 (Quick Wins)](#p0-즉시-적용-quick-wins)
   - [P1: 단기 개선 (1-3일)](#p1-단기-개선-1-3일)
   - [P2: 중기 고도화 (1-2주)](#p2-중기-고도화-1-2주)
   - [P3: 선택적 인프라 (검토 후)](#p3-선택적-인프라-검토-후)
5. [실행 플랜](#-실행-플랜)
6. [예상 효과](#-예상-효과)

---

## 🔍 문제 현황 요약

### 사용자 보고 문제

| 페이지/기능 | 현재 문제 | 소요 시간 |
|------------|----------|----------|
| **AED 데이터 페이지 진입** | 메뉴 클릭 후 로딩 지연 | 초기 로딩 (5-7초) |
| **추가 버튼 클릭** | "처리중" 메시지 대기 | ~10초 |
| **추가완료 탭** | 새로고침 전까지 반영 안됨 | 즉시 반영 불가 |
| **Inspection 페이지 진입** | 페이지 로딩 지연 | 4-5초 |
| **점검 세션 시작** | 점검 버튼 클릭 후 대기 | ~10초 |

### 비즈니스 영향

- **사용자 경험 저하**: 느린 응답으로 인한 불만
- **업무 효율성 감소**: 반복적인 대기 시간
- **이탈 가능성**: 모바일 환경에서 특히 심각
- **서버 부하 증가**: 중복 쿼리로 인한 비효율

---

## 📊 성능 분석 결과

### 1. AED 데이터 페이지 (진입 시)

**분석 파일**: `app/(authenticated)/aed-data/AEDDataPageClient.tsx`

#### 병목 구간

```typescript
// Line 223-290: 순차 실행으로 인한 지연
useEffect(() => {
  // 1. 사용자 프로필 조회 (1초)
  const { data: profile } = await supabase.from('user_profiles')...
  
  // 2. Kakao Maps SDK 로드 대기 (2-3초)
  await waitForKakaoMaps();
  
  // 3. Geolocation 대기 (최대 5초)
  navigator.geolocation.getCurrentPosition(...)
  
  // 4. Geocoding 실행 (1초)
  geocoder.coord2RegionCode(...)
}, []);
```

**총 소요 시간**: 5-10초 (순차 실행)

#### 근본 원인

1. **블로킹 I/O**: Geolocation과 Kakao Maps 로드가 데이터 페칭을 차단
2. **외부 의존성**: Kakao Maps SDK 네트워크 지연
3. **불필요한 대기**: 지도 모드가 아니어도 Geolocation 실행

---

### 2. 추가 버튼 클릭 (일정 추가)

**분석 파일**: 
- `app/(authenticated)/aed-data/AEDDataPageClient.tsx` (Line 76-88)
- `app/api/inspections/assignments/route.ts` (Line 91-158)

#### 병목 구간

```typescript
// API: 순차 DB 쿼리
// 1. 중복 체크 쿼리 (~1초)
const { data: existing } = await supabase
  .from('inspection_assignments')
  .select('id, status')
  .eq('equipment_serial', equipmentSerial)...

// 2. AED 장비 확인 쿼리 (~1-2초)
const { data: aedDevice } = await supabase
  .from('aed_data')
  .select('*')
  .eq('equipment_serial', equipmentSerial)...

// 3. 점검원 확인 쿼리 (~1초)
const { data: inspector } = await supabase
  .from('user_profiles')
  .select('id, role')
  .eq('id', assignedTo)...

// 4. 삽입 쿼리 (~1-2초)
const { data: assignment } = await supabase
  .from('inspection_assignments')
  .insert(...)...

// 클라이언트: 전체 데이터 재조회
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: ['aed-data'] }); // 추가 2-3초
}
```

**총 소요 시간**: 8-12초

#### 근본 원인

1. **순차 쿼리**: 4개의 DB 쿼리가 순차 실행
2. **N+1 네트워크 호출**: 각 쿼리마다 네트워크 왕복
3. **비효율적인 캐시 무효화**: 전체 데이터 재조회

---

### 3. 추가완료 탭 반영 문제

**분석 파일**: `app/(authenticated)/aed-data/AEDDataPageClient.tsx` (Line 76-88)

#### 현재 구조

```typescript
const cancelScheduleMutation = useMutation({
  mutationFn: async (equipmentSerial: string) => {
    // API 호출
  },
  onMutate: async (equipmentSerial) => {
    // 낙관적 업데이트 - 로컬 상태만 변경
    setScheduledEquipment(prev => {
      const newSet = new Set(prev);
      newSet.delete(equipmentSerial);
      return newSet;
    });
  },
  onSettled: () => {
    // ❌ 문제: 전체 데이터 재조회
    queryClient.invalidateQueries({ queryKey: ['aed-data'] });
  }
});
```

#### 근본 원인

1. **캐시 무효화 범위 과다**: `aed-data` 전체가 무효화됨
2. **탭별 쿼리 분리 부재**: 추가완료 탭이 별도 쿼리가 아님
3. **낙관적 업데이트 미흡**: React Query 캐시 직접 업데이트 없음

---

### 4. Inspection 페이지 진입

**분석 파일**: `app/(authenticated)/inspection/InspectionPageClient.tsx`

#### 병목 구간

```typescript
// AdminFullView.tsx - 전체 assignments 한번에 조회
const { data: allAssignments } = await supabase
  .from('inspection_assignments')
  .select(`
    *,
    aed_data(*),
    user_profiles(*)
  `)  // JOIN으로 인한 대용량 데이터
  .eq('assigned_to', userId);
```

**데이터량**: 평균 200-500건 × 3개 테이블 JOIN = 대용량

#### 근본 원인

1. **전체 데이터 조회**: 모든 상태의 assignments를 한번에 조회
2. **JOIN 쿼리**: 3개 테이블 조인으로 응답 크기 증가
3. **Lazy Loading 부재**: 화면에 보이지 않는 데이터도 조회

---

### 5. 점검 세션 시작

**분석 파일**: `app/api/inspections/sessions/route.ts` (Line 220-294)

#### 병목 구간

```typescript
// POST /api/inspections/sessions - 5개 순차 쿼리
export const POST = async (request: NextRequest) => {
  // 1. 활성 세션 확인 (~1초)
  const { data: activeSession } = await supabase
    .from('inspection_sessions')
    .select('id')
    .eq('inspector_id', userId)...

  // 2. Assignment 확인 (~1-2초)
  const { data: assignment } = await supabase
    .from('inspection_assignments')
    .select('id, assigned_to, status')...

  // 3. Assignment 상태 업데이트 (~1초)
  const { error: updateError } = await supabase
    .from('inspection_assignments')
    .update({ status: 'in_progress' })...

  // 4. AED 데이터 조회 (~2-3초)
  const { data: device } = await supabase
    .from('aed_data')
    .select('*')
    .eq('equipment_serial', payload.equipmentSerial)...

  // 5. Session 삽입 (~1초)
  const { data, error: insertError } = await supabase
    .from('inspection_sessions')
    .insert(...)...
};
```

**총 소요 시간**: 7-12초

#### 근본 원인

1. **순차 쿼리**: 5개의 DB 쿼리가 순차 실행
2. **중복 조회**: AED 데이터는 클라이언트에서 이미 조회했을 가능성
3. **트랜잭션 미사용**: 여러 쿼리를 개별 실행

---

## ✅ 적용 가능성 진단

### 현재 기술 스택 정합성

| 최적화 항목 | 현재 스택 호환성 | 즉시 적용 가능 여부 | 비고 |
|-----------|----------------|------------------|------|
| **React Query 낙관적 업데이트** | ✅ 완전 호환 | ✅ 즉시 가능 | 코드 수정만으로 가능 |
| **API 병렬 쿼리 (Promise.all)** | ✅ 완전 호환 | ✅ 즉시 가능 | Node.js 기본 기능 |
| **Geolocation 비동기화** | ✅ 완전 호환 | ✅ 즉시 가능 | 브라우저 API |
| **React Query staleTime 조정** | ✅ 완전 호환 | ✅ 즉시 가능 | 설정 변경만 |
| **Inspection 페이지 Lazy Loading** | ✅ 완전 호환 | ✅ 즉시 가능 | useQuery 옵션 활용 |
| **Supabase RPC 함수** | ⚠️ DB 마이그레이션 필요 | ⚠️ 조건부 | Supabase 프로젝트 접근 권한 필요 |
| **Upstash Redis 캐싱** | ⚠️ 신규 인프라 | ⚠️ 선택 사항 | 외부 서비스 가입 및 비용 발생 |

### 선행 조건 체크리스트

#### ✅ 즉시 가능 (권한 불필요)

- [x] Next.js API Routes 수정 권한
- [x] React 컴포넌트 수정 권한
- [x] package.json 의존성 추가 권한
- [x] 로컬/스테이징 환경 테스트 가능

#### ⚠️ 확인 필요 (인프라 접근)

- [ ] **Supabase Dashboard 접근**: RPC 함수 생성, 마이그레이션 실행
  - 필요 권한: Database → SQL Editor, Migrations
  - 없을 경우: RPC 최적화 생략, Promise.all만 적용
  
- [ ] **프로덕션 배포 권한**: Vercel/호스팅 플랫폼 배포
  - 필요 권한: Git push → 자동 배포 or Vercel CLI
  - 없을 경우: 로컬 테스트 후 배포 요청

#### ❌ 선택 사항 (신규 서비스)

- [ ] **Upstash Redis**: 캐싱 레이어
  - 필요: 회원가입, 신용카드 등록 (무료 플랜 가능)
  - 대안: Supabase 내장 캐싱, React Query 캐시 활용
  - **권장 판단**: Phase 1-2 효과 측정 후 결정

### 우선순위 결정 기준 (1인 개발)

| 우선순위 | 기준 | 예상 소요 시간 | 효과 |
|---------|------|--------------|------|
| **P0** | 코드 수정만, 즉시 효과 | 2-6시간 | 체감 성능 50-80% 개선 |
| **P1** | 설정 변경, 실험 가능 | 1-3일 | 초기 로딩 40-60% 개선 |
| **P2** | DB 접근 필요, 학습 시간 | 1-2주 | 서버 부하 50-70% 감소 |
| **P3** | 외부 서비스, 비용/검토 | 2주+ | 장기 안정성, 선택적 |

---

## 🎯 최적화 제안 (우선순위별)

### P0: 즉시 적용 (Quick Wins)

**예상 소요**: 반나절 ~ 1일  
**필요 권한**: 코드 수정만  
**효과**: 사용자 체감 성능 80% 개선

#### 1. 추가 버튼 - 낙관적 업데이트 강화 ⭐⭐⭐

**목표**: 10초 → 0.1초 (UI 즉시 반응) + 백그라운드 2초  
**난이도**: ⭐ (쉬움)  
**소요 시간**: 1-2시간

**파일**: `app/(authenticated)/aed-data/AEDDataPageClient.tsx`

**Before (현재)**:
```typescript
const cancelScheduleMutation = useMutation({
  mutationFn: async (equipmentSerial: string) => {
    // API 호출
  },
  onSettled: () => {
    // ❌ 전체 데이터 재조회 (느림)
    queryClient.invalidateQueries({ queryKey: ['aed-data'] });
  }
});
```

**After (개선)**:
```typescript
// 1. 일정추가 상태를 별도 쿼리로 분리 (✅ Array로 반환)
const { data: scheduledEquipmentArray } = useQuery({
  queryKey: ['scheduled-equipment', userId],
  queryFn: async () => {
    const response = await fetch(
      `/api/inspections/assignments?assignedTo=${userId}&status=pending`
    );
    const result = await response.json();
    // ✅ Set 대신 Array 반환 (직렬화 및 동등성 비교 문제 방지)
    return result.data?.map((a: any) => a.equipment_serial) || [];
  },
  staleTime: 1000 * 60, // 1분 캐싱
  refetchOnWindowFocus: true, // 탭 전환 시 자동 갱신
});

// ✅ 컴포넌트에서 필요 시 Set으로 변환 (메모이제이션)
const scheduledEquipment = useMemo(
  () => new Set(scheduledEquipmentArray || []),
  [scheduledEquipmentArray]
);

// 2. 낙관적 업데이트 개선
const addScheduleMutation = useMutation({
  mutationFn: async (equipmentSerials: string[]) => {
    const response = await fetch('/api/inspections/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ equipmentSerials, assignedTo: userId })
    });
    return response.json();
  },
  
  onMutate: async (equipmentSerials) => {
    // 진행 중인 쿼리 취소
    await queryClient.cancelQueries({ queryKey: ['scheduled-equipment', userId] });
    
    // ✅ 이전 상태 저장 (Array 타입)
    const previousScheduled = queryClient.getQueryData<string[]>(
      ['scheduled-equipment', userId]
    );
    
    // ✅ 낙관적 업데이트 - 즉시 UI 반영 (Array 조작)
    queryClient.setQueryData<string[]>(
      ['scheduled-equipment', userId],
      (old = []) => {
        // 중복 제거하여 배열에 추가
        const combined = [...old, ...equipmentSerials];
        return Array.from(new Set(combined));
      }
    );
    
    return { previousScheduled };
  },
  
  onError: (err, variables, context) => {
    // 실패 시 롤백
    if (context?.previousScheduled) {
      queryClient.setQueryData(
        ['scheduled-equipment', userId],
        context.previousScheduled
      );
    }
    toast.error('일정 추가 실패');
  },
  
  onSuccess: (data) => {
    toast.success(`${data.stats.created}개 장비 일정 추가 완료`);
  },
  
  onSettled: () => {
    // ✅ 특정 쿼리만 무효화 (빠름)
    queryClient.invalidateQueries({ 
      queryKey: ['scheduled-equipment', userId],
      exact: true // 정확히 일치하는 쿼리만 무효화
    });
  }
});

const cancelScheduleMutation = useMutation({
  mutationFn: async (equipmentSerial: string) => {
    const response = await fetch('/api/inspections/assignments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ equipmentSerial, userId })
    });
    return response.json();
  },
  
  onMutate: async (equipmentSerial) => {
    await queryClient.cancelQueries({ queryKey: ['scheduled-equipment', userId] });
    
    const previousScheduled = queryClient.getQueryData<string[]>(
      ['scheduled-equipment', userId]
    );
    
    // ✅ Array에서 제거
    queryClient.setQueryData<string[]>(
      ['scheduled-equipment', userId],
      (old = []) => old.filter(serial => serial !== equipmentSerial)
    );
    
    return { previousScheduled };
  },
  
  onError: (err, variables, context) => {
    if (context?.previousScheduled) {
      queryClient.setQueryData(
        ['scheduled-equipment', userId],
        context.previousScheduled
      );
    }
    toast.error('일정 취소 실패');
  },
  
  onSettled: () => {
    queryClient.invalidateQueries({ 
      queryKey: ['scheduled-equipment', userId],
      exact: true
    });
  }
});
```

**장점**:
- ✅ 즉시 UI 반영 (0ms)
- ✅ 서버 응답 대기 불필요
- ✅ 전체 데이터 재조회 제거
- ✅ Array 타입으로 직렬화/동등성 비교 문제 해결

---

#### 2. 일정 추가 API - 병렬 쿼리 + RPC 통합 ⭐⭐⭐

**목표**: 10초 → 1-2초 (80-90% 개선)  
**난이도**: ⭐⭐ (보통 - Promise.all만 사용 시 ⭐)  
**소요 시간**: 2-3시간 (병렬화) + 4시간 (RPC, 선택)

**파일**: `app/api/inspections/assignments/route.ts`

**Step 1: 병렬 쿼리로 변경**

```typescript
// Before (순차 실행)
const { data: existing } = await supabase.from('inspection_assignments')...
const { data: aedDevice } = await supabase.from('aed_data')...
const { data: inspector } = await supabase.from('user_profiles')...

// After (병렬 실행)
const [existingResult, aedDeviceResult, inspectorResult] = await Promise.all([
  supabase.from('inspection_assignments')
    .select('id, status')
    .eq('equipment_serial', equipmentSerial)
    .eq('assigned_to', assignedTo)
    .in('status', ['pending', 'in_progress'])
    .maybeSingle(),
  
  supabase.from('aed_data')
    .select('equipment_serial, installation_institution')
    .eq('equipment_serial', equipmentSerial)
    .maybeSingle(),
  
  supabase.from('user_profiles')
    .select('id, role')
    .eq('id', assignedTo)
    .single()
]);

const existing = existingResult.data;
const aedDevice = aedDeviceResult.data;
const inspector = inspectorResult.data;

// 검증 로직...
if (existing) {
  return NextResponse.json({ error: '이미 할당된 장비입니다.' }, { status: 409 });
}

if (!aedDevice) {
  return NextResponse.json({ error: '장비를 찾을 수 없습니다.' }, { status: 404 });
}

// 삽입
const { data: assignment, error: insertError } = await supabase
  .from('inspection_assignments')
  .insert({
    equipment_serial: equipmentSerial,
    assigned_to: assignedTo,
    assigned_by: user.id,
    // ...
  })
  .select()
  .single();
```

**Step 2: Supabase RPC 함수로 통합 (권장)**

```sql
-- supabase/migrations/YYYYMMDD_create_assignment_function.sql

-- 🔐 보안 강화: 조건부 유니크 인덱스로 경쟁 조건 방지
CREATE UNIQUE INDEX IF NOT EXISTS uniq_assignment_active
ON inspection_assignments (equipment_serial, assigned_to)
WHERE status IN ('pending', 'in_progress');

CREATE OR REPLACE FUNCTION create_inspection_assignment(
  p_equipment_serial TEXT,
  p_assigned_to UUID,
  p_assigned_by UUID,
  p_scheduled_date DATE DEFAULT NULL,
  p_scheduled_time TIME DEFAULT NULL,
  p_assignment_type TEXT DEFAULT 'scheduled',
  p_priority_level INTEGER DEFAULT 0,
  p_notes TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_current_user_id UUID;
  v_aed_exists BOOLEAN;
  v_inspector_exists BOOLEAN;
  v_assignment_id UUID;
  v_result JSON;
BEGIN
  -- 🔐 보안: search_path 고정으로 SQL 인젝션 방지
  SET search_path = public;
  
  -- 🔐 보안: 현재 사용자 ID 확인
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Unauthorized',
      'code', 'UNAUTHORIZED'
    );
  END IF;
  
  -- 🔐 보안: 권한 검증 (관리자가 아닌 경우 본인만 할당 가능)
  IF p_assigned_by <> v_current_user_id THEN
    -- 관리자 권한 체크 (필요시 구현)
    -- IF NOT is_admin(v_current_user_id) THEN
    --   RETURN json_build_object('success', false, 'error', 'Forbidden');
    -- END IF;
  END IF;
  
  -- 1. AED 장비 존재 확인
  SELECT EXISTS(
    SELECT 1 FROM aed_data WHERE equipment_serial = p_equipment_serial
  ) INTO v_aed_exists;
  
  IF NOT v_aed_exists THEN
    RETURN json_build_object(
      'success', false,
      'error', '장비를 찾을 수 없습니다.',
      'code', 'AED_NOT_FOUND'
    );
  END IF;
  
  -- 2. 점검원 확인
  SELECT EXISTS(
    SELECT 1 FROM user_profiles WHERE id = p_assigned_to
  ) INTO v_inspector_exists;
  
  IF NOT v_inspector_exists THEN
    RETURN json_build_object(
      'success', false,
      'error', '점검원을 찾을 수 없습니다.',
      'code', 'INSPECTOR_NOT_FOUND'
    );
  END IF;
  
  -- 3. Assignment 생성 (멱등성 보장)
  INSERT INTO inspection_assignments (
    equipment_serial,
    assigned_to,
    assigned_by,
    scheduled_date,
    scheduled_time,
    assignment_type,
    priority_level,
    notes,
    status
  ) VALUES (
    p_equipment_serial,
    p_assigned_to,
    p_assigned_by,
    p_scheduled_date,
    p_scheduled_time,
    p_assignment_type,
    p_priority_level,
    p_notes,
    'pending'
  )
  ON CONFLICT (equipment_serial, assigned_to) 
  WHERE status IN ('pending', 'in_progress')
  DO NOTHING
  RETURNING id INTO v_assignment_id;
  
  -- 중복으로 인한 스킵
  IF v_assignment_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', '이미 할당된 장비입니다.',
      'code', 'DUPLICATE_ASSIGNMENT'
    );
  END IF;
  
  -- 4. 결과 반환
  SELECT json_build_object(
    'success', true,
    'data', row_to_json(a.*)
  ) INTO v_result
  FROM inspection_assignments a
  WHERE a.id = v_assignment_id;
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  -- 에러 로깅 및 안전한 메시지 반환
  RETURN json_build_object(
    'success', false,
    'error', '서버 오류가 발생했습니다.',
    'code', 'INTERNAL_ERROR'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 🔐 보안: 적절한 권한 부여
GRANT EXECUTE ON FUNCTION create_inspection_assignment TO authenticated;
REVOKE EXECUTE ON FUNCTION create_inspection_assignment FROM anon, public;
```

```typescript
// app/api/inspections/assignments/route.ts

// 🔄 Legacy 함수 (Fallback용)
async function createAssignmentLegacy(
  supabase: any,
  data: {
    equipmentSerial: string;
    assignedTo: string;
    assignedBy: string;
    scheduledDate?: string;
    scheduledTime?: string;
    notes?: string;
  }
) {
  const [existingResult, aedDeviceResult, inspectorResult] = await Promise.all([
    supabase.from('inspection_assignments')
      .select('id, status')
      .eq('equipment_serial', data.equipmentSerial)
      .eq('assigned_to', data.assignedTo)
      .in('status', ['pending', 'in_progress'])
      .maybeSingle(),
    
    supabase.from('aed_data')
      .select('equipment_serial')
      .eq('equipment_serial', data.equipmentSerial)
      .maybeSingle(),
    
    supabase.from('user_profiles')
      .select('id')
      .eq('id', data.assignedTo)
      .single()
  ]);

  if (existingResult.data) {
    return { success: false, error: '이미 할당된 장비입니다.', code: 'DUPLICATE_ASSIGNMENT' };
  }
  if (!aedDeviceResult.data) {
    return { success: false, error: '장비를 찾을 수 없습니다.', code: 'AED_NOT_FOUND' };
  }

  const { data: assignment, error } = await supabase
    .from('inspection_assignments')
    .insert({
      equipment_serial: data.equipmentSerial,
      assigned_to: data.assignedTo,
      assigned_by: data.assignedBy,
      scheduled_date: data.scheduledDate,
      scheduled_time: data.scheduledTime,
      notes: data.notes,
      status: 'pending'
    })
    .select()
    .single();

  if (error) throw error;
  return { success: true, data: assignment };
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { equipmentSerial, assignedTo, scheduledDate, scheduledTime, notes } = body;
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // 🚀 1차: RPC 함수 시도 (권장)
    const { data: result, error } = await supabase.rpc('create_inspection_assignment', {
      p_equipment_serial: equipmentSerial,
      p_assigned_to: assignedTo,
      p_assigned_by: user.id,
      p_scheduled_date: scheduledDate,
      p_scheduled_time: scheduledTime,
      p_notes: notes
    });
    
    // RPC 함수가 없는 경우 (function not found) → Fallback
    if (error && error.message?.includes('function') && error.message?.includes('does not exist')) {
      console.warn('[RPC Fallback] Function not found, using legacy API:', error.message);
      
      // 🔄 2차: Legacy API 사용
      const legacyResult = await createAssignmentLegacy(supabase, {
        equipmentSerial,
        assignedTo,
        assignedBy: user.id,
        scheduledDate,
        scheduledTime,
        notes
      });
      
      if (!legacyResult.success) {
        const statusMap = {
          'DUPLICATE_ASSIGNMENT': 409,
          'AED_NOT_FOUND': 404
        };
        return NextResponse.json(
          { error: legacyResult.error, code: legacyResult.code },
          { status: statusMap[legacyResult.code as string] || 400 }
        );
      }
      
      return NextResponse.json(legacyResult);
    }
    
    // 다른 RPC 에러
    if (error) {
      console.error('[RPC Error]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // RPC 성공
    if (!result.success) {
      const statusMap = {
        'DUPLICATE_ASSIGNMENT': 409,
        'AED_NOT_FOUND': 404,
        'INSPECTOR_NOT_FOUND': 404
      };
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: statusMap[result.code] || 400 }
      );
    }
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error('[API Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**장점**:
- 네트워크 왕복 5회 → 1회 (RPC 사용 시)
- DB 트랜잭션 보장
- 서버 부하 감소
- ✅ **안전한 배포**: RPC 함수 없어도 Legacy API로 자동 Fallback
- ✅ **점진적 마이그레이션**: RPC 함수 배포 전후 모두 동작

---

#### 3. 대량 일정 추가 - 배치 최적화 ⭐⭐

**목표**: 50개 기준 15초 → 3초 (80% 개선)  
**난이도**: ⭐ (쉬움)  
**소요 시간**: 1-2시간

**파일**: `app/api/inspections/assignments/route.ts`

```typescript
// Before: in() 쿼리 제한 (최대 100개)
const { data: existingAssignments } = await supabase
  .from('inspection_assignments')
  .select('equipment_serial')
  .in('equipment_serial', equipmentSerials) // 최대 100개 제한
  .eq('assigned_to', params.assignedTo)
  .in('status', ['pending', 'in_progress']);

// After: 청크로 나누어 병렬 처리
const CHUNK_SIZE = 50;
const chunks: string[][] = [];
for (let i = 0; i < equipmentSerials.length; i += CHUNK_SIZE) {
  chunks.push(equipmentSerials.slice(i, i + CHUNK_SIZE));
}

const existingAssignments = await Promise.all(
  chunks.map(chunk => 
    supabase.from('inspection_assignments')
      .select('equipment_serial')
      .in('equipment_serial', chunk)
      .eq('assigned_to', params.assignedTo)
      .in('status', ['pending', 'in_progress'])
  )
).then(results => results.flatMap(r => r.data || []));

const existingSerials = new Set(existingAssignments.map(a => a.equipment_serial));
const newSerials = equipmentSerials.filter(serial => !existingSerials.has(serial));

// 대량 삽입도 청크로 분할
const insertChunks = [];
for (let i = 0; i < newSerials.length; i += CHUNK_SIZE) {
  insertChunks.push(newSerials.slice(i, i + CHUNK_SIZE));
}

const assignments = await Promise.all(
  insertChunks.map(chunk => {
    const assignmentsToInsert = chunk.map(serial => ({
      equipment_serial: serial,
      assigned_to: params.assignedTo,
      assigned_by: user.id,
      assignment_type: params.assignmentType,
      scheduled_date: params.scheduledDate,
      scheduled_time: params.scheduledTime,
      priority_level: params.priorityLevel,
      notes: params.notes,
      status: 'pending'
    }));
    
    return supabase
      .from('inspection_assignments')
      .insert(assignmentsToInsert)
      .select();
  })
).then(results => results.flatMap(r => r.data || []));
```

---

### P1: 단기 개선 (1-3일)

**예상 소요**: 1-3일  
**필요 권한**: 코드 수정, 실험 가능  
**효과**: 초기 로딩 40-60% 개선

#### 4. aed-data 페이지 - Geolocation 비동기화 ⭐⭐

**목표**: 초기 로딩 5초 → 1-2초 (60% 개선)  
**난이도**: ⭐⭐ (보통)  
**소요 시간**: 2-3시간

**파일**: `app/(authenticated)/aed-data/AEDDataPageClient.tsx`

**Before (블로킹)**:
```typescript
useEffect(() => {
  if (viewMode === 'map') {
    // 1. 관할 지역으로 설정
    // 2. geolocation 완료 대기 (블로킹)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await waitForKakaoMaps(); // 블로킹
        // geocoding...
      }
    );
  }
}, [viewMode]);
```

**After (비동기)**:
```typescript
useEffect(() => {
  // ✅ 1. 즉시 관할 지역으로 데이터 로드 시작 (블로킹 없음)
  const regionCode = userProfile.organization?.region_code;
  if (regionCode) {
    setFilters({
      regionCodes: [regionCode],
      queryCriteria: 'address',
    });
  }
  
  // ✅ 2. 백그라운드에서 위치 기반 업데이트 (비차단)
  if (viewMode === 'map') {
    updateLocationInBackground();
  }
}, []);

// 백그라운드 위치 업데이트 (블로킹 없음)
const updateLocationInBackground = async () => {
  if (!navigator.geolocation) return;
  
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 1000 * 60 * 5 // 5분 캐싱
      });
    });
    
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    
    // Kakao Maps 로드 (백그라운드)
    await waitForKakaoMaps();
    
    if (!window.kakao) return;
    
    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.coord2RegionCode(lng, lat, (result: any, status: any) => {
      if (status === window.kakao.maps.services.Status.OK) {
        const region = result.find((r: any) => r.region_type === 'H');
        if (region) {
          const sidoShort = normalizeRegionName(region.region_1depth_name);
          const gugun = region.region_2depth_name;
          
          // ✅ 데이터 로드 완료 후 필터 업데이트 (부드러운 전환)
          setFilters(prev => ({
            ...prev,
            regionCodes: [sidoShort],
            cityCodes: [gugun]
          }));
        }
      }
    });
  } catch (error) {
    console.warn('Location update failed:', error);
    // 실패해도 관할 지역 데이터는 이미 로드됨
  }
};
```

**추가 최적화 - Kakao Maps SDK 네트워크 최적화**:

```html
<!-- app/layout.tsx or public/index.html -->
<head>
  <!-- 🚀 DNS 사전 연결로 네트워크 지연 최소화 (30분 작업, 즉시 효과) -->
  <link rel="dns-prefetch" href="https://dapi.kakao.com" />
  <link rel="preconnect" href="https://dapi.kakao.com" crossorigin />
  
  <!-- ⚠️ Preload는 CORS 이슈 가능성으로 선택 사항 -->
  <!-- <link 
    rel="preload" 
    href="https://dapi.kakao.com/v2/maps/sdk.js?appkey=YOUR_KEY&libraries=services" 
    as="script"
    crossorigin
  /> -->
  
  <!-- ✅ Async로 비차단 로드 -->
  <script 
    async
    src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=YOUR_KEY&libraries=services&autoload=false"
  ></script>
</head>
```

**효과**:
- `dns-prefetch`: DNS 조회 시간 50-100ms 절약
- `preconnect`: TCP + TLS 핸드셰이크 100-200ms 절약
- `async`: 메인 스레드 차단 방지

---

#### 5. AEDDataProvider - 쿼리 최적화 ⭐⭐

**목표**: 탭 전환 시 불필요한 재조회 제거  
**난이도**: ⭐ (쉬움)  
**소요 시간**: 30분 - 1시간

**파일**: `app/aed-data/components/AEDDataProvider.tsx`

**Before**:
```typescript
const queryResult = useQuery<AEDDataResponse, Error>({
  queryKey,
  queryFn: () => fetcher(`/api/aed-data${queryString}`),
  placeholderData: keepPreviousData,
  staleTime: 1000 * 30, // ❌ 30초 - 너무 짧음
  gcTime: 1000 * 60 * 5, // 5분
  // refetchOnWindowFocus: true (기본값) - 탭 전환마다 재조회
});
```

**After**:
```typescript
const queryResult = useQuery<AEDDataResponse, Error>({
  queryKey,
  queryFn: () => fetcher(`/api/aed-data${queryString}`),
  placeholderData: keepPreviousData,
  
  // ✅ staleTime 증가 - 3분 동안 신선한 상태 유지
  staleTime: 1000 * 60 * 3,
  
  // ✅ gcTime 증가 - 10분 동안 캐시 유지
  gcTime: 1000 * 60 * 10,
  
  // ✅ 탭 전환 시 재조회 방지
  refetchOnWindowFocus: false,
  
  // ✅ 마운트 시 재조회 방지 (캐시 있으면)
  refetchOnMount: false,
  
  // ✅ 네트워크 재연결 시에만 재조회
  refetchOnReconnect: true,
});
```

**추가 최적화 - Prefetching**:

```typescript
// app/(authenticated)/layout.tsx
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';

export default function AuthenticatedLayout({ children }) {
  const queryClient = useQueryClient();
  
  // 메뉴 hover 시 미리 데이터 로드
  const handlePrefetch = async (path: string) => {
    if (path === '/aed-data') {
      await queryClient.prefetchQuery({
        queryKey: ['aed-data', defaultFilters],
        queryFn: () => fetch('/api/aed-data?...').then(r => r.json()),
        staleTime: 1000 * 60 * 3
      });
    }
  };
  
  return (
    <div>
      <nav>
        <Link 
          href="/aed-data"
          onMouseEnter={() => handlePrefetch('/aed-data')}
        >
          AED 데이터
        </Link>
      </nav>
      {children}
    </div>
  );
}
```

---

### P2: 중기 고도화 (1-2주)

**예상 소요**: 1-2주  
**필요 권한**: Supabase DB 접근  
**효과**: 서버 부하 50-70% 감소, 네트워크 왕복 최소화

#### 6. 점검 세션 시작 - API 병렬화 & RPC 통합 ⭐⭐⭐

**목표**: 10초 → 2초 (80% 개선)  
**난이도**: ⭐⭐⭐ (높음 - RPC 학습 필요)  
**소요 시간**: 3-5일

**파일**: `app/api/inspections/sessions/route.ts`

**Step 1: 병렬 쿼리로 변경**

```typescript
export const POST = async (request: NextRequest) => {
  const { supabase, userId } = await requireAuthWithRole();
  const payload = await request.json();
  
  // ✅ 3개 쿼리를 병렬 실행
  const [activeSessionResult, assignmentResult, deviceResult] = await Promise.all([
    supabase.from('inspection_sessions')
      .select('id')
      .eq('inspector_id', userId)
      .eq('status', 'active')
      .maybeSingle(),
    
    supabase.from('inspection_assignments')
      .select('id, assigned_to, status')
      .eq('equipment_serial', payload.equipmentSerial)
      .eq('assigned_to', userId)
      .in('status', ['pending', 'in_progress'])
      .maybeSingle(),
    
    supabase.from('aed_data')
      .select('*')
      .eq('equipment_serial', payload.equipmentSerial)
      .maybeSingle()
  ]);
  
  const activeSession = activeSessionResult.data;
  const assignment = assignmentResult.data;
  const device = deviceResult.data;
  
  // 검증
  if (activeSession) {
    return NextResponse.json({
      error: '이미 진행 중인 점검 세션이 있습니다.',
      sessionId: activeSession.id
    }, { status: 409 });
  }
  
  if (!assignment) {
    return NextResponse.json({
      error: '이 장비는 귀하에게 할당되지 않았습니다.',
      code: 'NOT_ASSIGNED'
    }, { status: 403 });
  }
  
  // ✅ 트랜잭션처럼 실행 (Promise.all)
  const [updateResult, insertResult] = await Promise.all([
    // Assignment 업데이트
    assignment.status === 'pending'
      ? supabase.from('inspection_assignments')
          .update({ status: 'in_progress', started_at: new Date().toISOString() })
          .eq('id', assignment.id)
      : Promise.resolve({ data: null, error: null }),
    
    // Session 생성
    supabase.from('inspection_sessions')
      .insert({
        equipment_serial: payload.equipmentSerial,
        inspector_id: userId,
        device_info: device,
        original_snapshot: device,
        current_snapshot: device,
        refresh_status: 'idle'
      })
      .select(SESSION_SELECT_FIELDS)
      .single()
  ]);
  
  if (insertResult.error) {
    throw insertResult.error;
  }
  
  return NextResponse.json({ session: insertResult.data });
};
```

**Step 2: RPC 함수로 통합 (권장)**

```sql
-- supabase/migrations/YYYYMMDD_start_inspection_session.sql
CREATE OR REPLACE FUNCTION start_inspection_session(
  p_equipment_serial TEXT,
  p_inspector_id UUID
) RETURNS JSON AS $$
DECLARE
  v_active_session UUID;
  v_assignment RECORD;
  v_device RECORD;
  v_session_id UUID;
  v_result JSON;
BEGIN
  -- 1. 활성 세션 확인
  SELECT id INTO v_active_session
  FROM inspection_sessions
  WHERE inspector_id = p_inspector_id 
    AND status = 'active'
  LIMIT 1;
  
  IF FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', '이미 진행 중인 점검 세션이 있습니다.',
      'code', 'ACTIVE_SESSION_EXISTS',
      'sessionId', v_active_session
    );
  END IF;
  
  -- 2. Assignment 확인
  SELECT * INTO v_assignment
  FROM inspection_assignments
  WHERE equipment_serial = p_equipment_serial
    AND assigned_to = p_inspector_id
    AND status IN ('pending', 'in_progress')
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', '이 장비는 귀하에게 할당되지 않았습니다.',
      'code', 'NOT_ASSIGNED'
    );
  END IF;
  
  -- 3. AED 데이터 조회
  SELECT * INTO v_device
  FROM aed_data
  WHERE equipment_serial = p_equipment_serial;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', '장비 데이터를 찾을 수 없습니다.',
      'code', 'DEVICE_NOT_FOUND'
    );
  END IF;
  
  -- 4. Assignment 상태 업데이트
  IF v_assignment.status = 'pending' THEN
    UPDATE inspection_assignments
    SET 
      status = 'in_progress',
      started_at = NOW()
    WHERE id = v_assignment.id;
  END IF;
  
  -- 5. Session 생성
  INSERT INTO inspection_sessions (
    equipment_serial,
    inspector_id,
    device_info,
    original_snapshot,
    current_snapshot,
    refresh_status,
    status
  ) VALUES (
    p_equipment_serial,
    p_inspector_id,
    row_to_json(v_device),
    row_to_json(v_device),
    row_to_json(v_device),
    'idle',
    'active'
  ) RETURNING id INTO v_session_id;
  
  -- 6. 결과 반환
  SELECT json_build_object(
    'success', true,
    'session', row_to_json(s.*)
  ) INTO v_result
  FROM inspection_sessions s
  WHERE s.id = v_session_id;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

```typescript
// app/api/inspections/sessions/route.ts
export const POST = async (request: NextRequest) => {
  const { supabase, userId } = await requireAuthWithRole();
  const payload = await request.json();
  
  if (!payload?.equipmentSerial) {
    return NextResponse.json(
      { error: 'equipmentSerial is required' },
      { status: 400 }
    );
  }
  
  // 🚀 RPC 함수 호출 - 모든 쿼리를 1회로 통합
  const { data: result, error } = await supabase.rpc('start_inspection_session', {
    p_equipment_serial: payload.equipmentSerial,
    p_inspector_id: userId
  });
  
  if (error) {
    console.error('[RPC Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  if (!result.success) {
    const statusMap = {
      'ACTIVE_SESSION_EXISTS': 409,
      'NOT_ASSIGNED': 403,
      'DEVICE_NOT_FOUND': 404
    };
    return NextResponse.json(
      { 
        error: result.error, 
        code: result.code,
        sessionId: result.sessionId 
      },
      { status: statusMap[result.code] || 400 }
    );
  }
  
  return NextResponse.json(result);
};
```

**장점**:
- 네트워크 왕복 5회 → 1회
- DB 트랜잭션 보장
- 에러 처리 간소화

---

#### 7. inspection 페이지 - Lazy Loading + Pagination ⭐⭐

**목표**: 4-5초 → 1-2초 (60% 개선)  
**난이도**: ⭐⭐ (보통)  
**소요 시간**: 3-4시간

**파일**: `components/inspection/AdminFullView.tsx` (예시)

**Before**:
```typescript
// 전체 assignments를 한번에 조회
const { data: allAssignments } = useQuery({
  queryKey: ['assignments'],
  queryFn: async () => {
    const { data } = await supabase
      .from('inspection_assignments')
      .select(`
        *,
        aed_data(*),
        user_profiles(*)
      `)
      .eq('assigned_to', userId);
    return data;
  }
});

// 모든 탭이 동일한 데이터 사용
const pendingAssignments = allAssignments?.filter(a => a.status === 'pending');
const inProgressAssignments = allAssignments?.filter(a => a.status === 'in_progress');
```

**After**:
```typescript
// ✅ 탭별로 쿼리 분리 + Lazy Loading
const [activeTab, setActiveTab] = useState<'pending' | 'in_progress' | 'completed'>('pending');

// pending 탭만 초기 로드 (가장 중요한 데이터)
const { data: pendingAssignments, isLoading: pendingLoading } = useQuery({
  queryKey: ['assignments', 'pending'],
  queryFn: async () => {
    const { data } = await supabase
      .from('inspection_assignments')
      .select('*, aed_data!inner(equipment_serial, installation_institution)')
      .eq('assigned_to', userId)
      .eq('status', 'pending')
      .order('scheduled_date', { ascending: true })
      .limit(20); // 초기 20개만 로드
    return data;
  },
  staleTime: 1000 * 60, // 1분 캐싱
});

// in_progress 탭 - 조건부 로드
const { data: inProgressAssignments } = useQuery({
  queryKey: ['assignments', 'in_progress'],
  queryFn: async () => {
    const { data } = await supabase
      .from('inspection_assignments')
      .select('*, aed_data!inner(equipment_serial, installation_institution)')
      .eq('assigned_to', userId)
      .eq('status', 'in_progress')
      .order('started_at', { ascending: false })
      .limit(20);
    return data;
  },
  enabled: activeTab === 'in_progress', // ✅ 탭 활성화 시에만 로드
  staleTime: 1000 * 60,
});

// completed 탭 - Infinite Scroll
const {
  data: completedPages,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage
} = useInfiniteQuery({
  queryKey: ['assignments', 'completed'],
  queryFn: async ({ pageParam = 0 }) => {
    const { data, count } = await supabase
      .from('inspection_assignments')
      .select('*, aed_data!inner(equipment_serial)', { count: 'exact' })
      .eq('assigned_to', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .range(pageParam, pageParam + 19); // 20개씩
    
    return {
      data: data || [],
      nextOffset: pageParam + 20,
      hasMore: (count || 0) > pageParam + 20
    };
  },
  getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextOffset : undefined,
  enabled: activeTab === 'completed',
  staleTime: 1000 * 60 * 5, // 5분 캐싱 (완료된 데이터는 변경 적음)
});

// ✅ Intersection Observer로 자동 로드
const observerRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  if (!observerRef.current || !hasNextPage || isFetchingNextPage) return;
  
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        fetchNextPage();
      }
    },
    { threshold: 0.5 }
  );
  
  observer.observe(observerRef.current);
  return () => observer.disconnect();
}, [fetchNextPage, hasNextPage, isFetchingNextPage]);
```

**추가 최적화 - JOIN 최소화**:

```typescript
// ❌ Before: 불필요한 JOIN
.select(`
  *,
  aed_data(*),
  user_profiles(*)
`)

// ✅ After: 필요한 필드만 선택
.select(`
  id,
  equipment_serial,
  status,
  scheduled_date,
  aed_data!inner(equipment_serial, installation_institution, sido, gugun)
`)
```

---

### P3: 선택적 인프라 (검토 후)

**예상 소요**: 2주+  
**필요 사항**: 외부 서비스 가입, 비용 결정  
**효과**: 장기 안정성, 캐시 히트율 90%+  
**권장**: P0-P1 효과 측정 후 결정

#### 8. Redis/Upstash 캐싱 도입 ⭐

**목표**: 반복 조회 시 90% 속도 향상  
**난이도**: ⭐⭐ (보통 - 외부 서비스 연동)  
**소요 시간**: 1-2일 (설정) + 지속적 모니터링

**설치**:
```bash
npm install @upstash/redis
```

**환경 변수**:
```env
# .env.local
UPSTASH_REDIS_URL=https://your-redis.upstash.io
UPSTASH_REDIS_TOKEN=your-token
```

**캐싱 레이어 구현**:

```typescript
// lib/cache/redis.ts
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

export async function getCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 60
): Promise<T> {
  try {
    // 캐시 조회
    const cached = await redis.get(key);
    if (cached) {
      console.log(`[Cache HIT] ${key}`);
      return cached as T;
    }
    
    console.log(`[Cache MISS] ${key}`);
    
    // 캐시 미스 - 데이터 조회
    const data = await fetcher();
    
    // 캐시 저장 (비동기, 블로킹 없음)
    redis.setex(key, ttl, data).catch(err => {
      console.error('[Cache SET Error]', err);
    });
    
    return data;
  } catch (error) {
    console.error('[Cache Error]', error);
    // 캐시 실패 시 원본 데이터 조회
    return fetcher();
  }
}

export async function invalidateCache(pattern: string) {
  // 패턴 매칭으로 캐시 무효화
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
    console.log(`[Cache INVALIDATED] ${keys.length} keys for pattern: ${pattern}`);
  }
}
```

**적용 예시**:

```typescript
// app/api/inspections/assignments/route.ts
import { getCachedData, invalidateCache } from '@/lib/cache/redis';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const status = request.nextUrl.searchParams.get('status');
  
  // ✅ 캐시 키 생성
  const cacheKey = `assignments:${user.id}:${status || 'all'}`;
  
  // ✅ 캐시 조회 (1분 TTL)
  const assignments = await getCachedData(
    cacheKey,
    async () => {
      const query = supabase
        .from('inspection_assignments')
        .select('*, aed_data!inner(equipment_serial, installation_institution)')
        .eq('assigned_to', user.id);
      
      if (status) {
        query.eq('status', status);
      }
      
      const { data } = await query;
      return data || [];
    },
    60 // 1분 캐싱
  );
  
  return NextResponse.json({ data: assignments });
}

export async function POST(request: NextRequest) {
  // ... 일정 추가 로직
  
  // ✅ 성공 시 캐시 무효화
  const result = await supabase.from('inspection_assignments').insert(...);
  
  if (!result.error) {
    await invalidateCache(`assignments:${user.id}:*`);
  }
  
  return NextResponse.json(result);
}
```

**캐싱 대상 및 TTL**:

| 데이터 종류 | 캐시 키 패턴 | TTL | 비고 |
|-----------|-------------|-----|------|
| 사용자 프로필 | `profile:{userId}` | 30분 | 자주 변경되지 않음 |
| 일정 추가 목록 | `assignments:{userId}:{status}` | 1분 | 실시간성 중요 |
| AED 통계 | `summary:{region}:{city}` | 5분 | 대량 계산 |
| 지역 필터 옵션 | `filters:regions` | 1일 | 거의 변경 없음 |
| 점검 세션 | `session:{sessionId}` | 10분 | 세션 활성 시 |

**무효화 전략**:

```typescript
// lib/cache/invalidation.ts
export async function invalidateUserCache(userId: string) {
  await Promise.all([
    invalidateCache(`profile:${userId}`),
    invalidateCache(`assignments:${userId}:*`),
    invalidateCache(`session:${userId}:*`)
  ]);
}

export async function invalidateRegionCache(regionCode: string, cityCode?: string) {
  const pattern = cityCode 
    ? `summary:${regionCode}:${cityCode}`
    : `summary:${regionCode}:*`;
  await invalidateCache(pattern);
}
```

---

## 🚀 실행 플랜

### Phase 0: 현상 측정 (착수 전 필수)

**소요 시간**: 1-2시간  
**목적**: 개선 전후 비교 데이터 확보

#### 📊 성능 측정 표준화

**Chrome DevTools 사용법**:
1. 개발자 도구 열기 (`F12` 또는 `Cmd+Option+I`)
2. **Performance 탭** 선택
3. 캐시 비우기 및 새로고침 (`Ctrl+Shift+R` / `Cmd+Shift+R`)
4. 녹화 시작 (●) → 페이지 로딩 완료 후 5초 대기 → 정지 (■)
5. **Screenshots** 활성화하여 시각적 로딩 과정 확인
6. 스크린샷 저장 (Before 증거)

**핵심 지표 측정**:

| 지표 | 설명 | 목표 기준 | 측정 위치 |
|------|------|----------|----------|
| **FCP** | First Contentful Paint<br>(첫 콘텐츠 표시 시간) | < 1.8초 | Performance 탭 → Timings |
| **LCP** | Largest Contentful Paint<br>(최대 콘텐츠 표시 시간) | < 2.5초 | Performance 탭 → Timings |
| **TTI** | Time to Interactive<br>(상호작용 가능 시간) | < 3.8초 | Performance 탭 → Timings |
| **TBT** | Total Blocking Time<br>(총 차단 시간) | < 300ms | Performance 탭 → Summary |
| **API 응답** | 네트워크 요청 시간 | < 3초 | Network 탭 → Timing |

**작업**:
1. **성능 지표 수집**
   - Chrome DevTools Performance 탭에서 주요 페이지 로딩 시간 기록
   - Network 탭에서 API 호출 시간 측정 (스크린샷 저장)
   - React Query Devtools로 쿼리 상태 확인
   - Lighthouse 보고서 실행 (선택 사항)
   
2. **재현 시나리오 정리**
   - **시나리오 1**: aed-data 페이지 진입 → 추가 버튼 → 추가완료 탭 전환 (타임라인 기록)
   - **시나리오 2**: inspection 페이지 진입 → 점검 세션 시작 (타임라인 기록)
   - **시나리오 3**: 대량 추가 50개 테스트

3. **비교 지표 정의**
   
   | 시나리오 | 측정 항목 | Before (현재) | After (목표) |
   |---------|---------|--------------|-------------|
   | aed-data 진입 | 페이지 로드 완료 | 5-7초 | 1-2초 |
   | 추가 버튼 | 클릭 → 완료 메시지 | ~10초 | 0.1초 (UI) + 2초 (백그라운드) |
   | 추가완료 탭 | 탭 전환 → 데이터 표시 | 새로고침 필요 | 즉시 (0ms) |
   | inspection 진입 | 페이지 로드 완료 | 4-5초 | 1-2초 |
   | 점검 세션 시작 | 버튼 클릭 → 세션 화면 | ~10초 | 2초 |
   | 대량 추가 50개 | 완료까지 시간 | ~15초 | 3초 |

---

### Phase 1: 즉시 효과 (Day 1)

**목표**: 사용자 체감 성능 80% 개선  
**총 소요**: 반나절 ~ 1일

| 순서 | 작업 | 소요 시간 | 체크리스트 |
|-----|------|----------|----------|
| 1 | AEDDataProvider staleTime 조정 | 30분 | [ ] 코드 수정<br>[ ] 로컬 테스트 |
| 2 | 추가 버튼 낙관적 업데이트 강화 | 1-2시간 | [ ] 코드 수정<br>[ ] 에러 핸들링 확인 |
| 3 | 대량 추가 배치 최적화 | 1-2시간 | [ ] 청크 처리 구현<br>[ ] 50개 테스트 |
| 4 | 일정 추가 API 병렬 쿼리 | 2-3시간 | [ ] Promise.all 적용<br>[ ] 에러 케이스 확인 |
| 5 | **핵심 DB 인덱스 추가** ⭐ | 30분-1시간 | [ ] Supabase Dashboard 접근<br>[ ] SQL 실행<br>[ ] 쿼리 성능 확인 |

**5. 핵심 DB 인덱스 추가 (권장)** ⭐

**목표**: 데이터베이스 쿼리 속도 50-70% 개선  
**난이도**: ⭐ (쉬움 - Supabase Dashboard 접근만 필요)  
**소요 시간**: 30분-1시간

**선행 조건**:
- Supabase Dashboard 접근 가능
- SQL Editor 실행 권한

**적용 방법**:
```sql
-- 1. Supabase Dashboard → SQL Editor 접근

-- 2. 핵심 인덱스 3개 추가 (한번에 실행)

-- inspection_assignments 조회 최적화
CREATE INDEX IF NOT EXISTS idx_assignments_user_status 
ON inspection_assignments (assigned_to, status, scheduled_date DESC);

-- aed_data 장비 조회 최적화
CREATE INDEX IF NOT EXISTS idx_aed_data_serial 
ON aed_data (equipment_serial);

-- inspection_sessions 세션 조회 최적화
CREATE INDEX IF NOT EXISTS idx_sessions_inspector_status 
ON inspection_sessions (inspector_id, status, started_at DESC);

-- 3. 쿼리 플랜 확인 (선택)
EXPLAIN ANALYZE
SELECT * FROM inspection_assignments 
WHERE assigned_to = 'USER_ID' AND status = 'pending'
ORDER BY scheduled_date DESC;
```

**효과**:
- Assignment 조회 시간 1-2초 → 100-200ms
- Session 조회 시간 500ms → 50-100ms
- 중복 체크 쿼리 속도 향상

**주의사항**:
- 인덱스는 읽기 성능 향상, 쓰기 성능은 약간 저하 (무시 가능 수준)
- 이미 존재하는 경우 `IF NOT EXISTS`로 안전하게 스킵
- 롤백 필요 시: `DROP INDEX idx_assignments_user_status;`

---

**배포 전 확인**:
- [ ] 로컬 환경에서 각 시나리오 테스트
- [ ] DevTools로 성능 개선 측정
- [ ] 에러 로그 확인
- [ ] Git commit & push

---

### Phase 2: 페이지 로딩 개선 (Day 2-3)

**목표**: 초기 로딩 40-60% 개선  
**총 소요**: 1-3일

| 순서 | 작업 | 소요 시간 | 체크리스트 |
|-----|------|----------|----------|
| 1 | Geolocation 비동기화 | 2-3시간 | [ ] 관할 지역 우선 로드<br>[ ] 백그라운드 위치 업데이트<br>[ ] 타임아웃 처리 |
| 2 | inspection 페이지 Lazy Loading | 3-4시간 | [ ] 탭별 쿼리 분리<br>[ ] enabled 옵션 활용<br>[ ] 로딩 상태 UI |
| 3 | Kakao Maps Preload (선택) | 1시간 | [ ] preload 태그 추가<br>[ ] async 로드 확인 |
| 4 | Prefetching 실험 (선택) | 1-2시간 | [ ] 메뉴 hover 프리패치<br>[ ] 효과 측정 |

**배포 전 확인**:
- [ ] Lighthouse Performance 점수 측정 (목표: 80+)
- [ ] 모바일 환경 테스트
- [ ] 각 페이지 FCP, TTI 확인

---

### Phase 3: 서버 최적화 (Week 2, 선택)

**목표**: 서버 부하 50% 감소  
**총 소요**: 3-7일 (Supabase 접근 권한 필요)

**선행 조건 체크**:
- [ ] Supabase Dashboard 접근 가능
- [ ] SQL Editor 실행 권한 확인
- [ ] 마이그레이션 롤백 방법 숙지

| 순서 | 작업 | 소요 시간 | 체크리스트 |
|-----|------|----------|----------|
| 1 | 점검 세션 API 병렬화 | 2시간 | [ ] Promise.all 적용<br>[ ] 기존 동작 검증 |
| 2 | create_inspection_assignment RPC | 4-6시간 | [ ] SQL 함수 작성<br>[ ] 로컬 테스트<br>[ ] 프로덕션 배포 |
| 3 | start_inspection_session RPC | 4-6시간 | [ ] SQL 함수 작성<br>[ ] 트랜잭션 처리<br>[ ] API 경로 연동 |
| 4 | 기존 코드 마이그레이션 | 1-2일 | [ ] RPC 호출로 전환<br>[ ] 에러 처리 개선<br>[ ] 통합 테스트 |

**배포 전 확인**:
- [ ] 스테이징 환경에서 충분한 테스트
- [ ] 롤백 시나리오 준비 (기존 API 유지)
- [ ] 네트워크 탭에서 왕복 횟수 감소 확인

---

### Phase 4: 캐싱 레이어 (Week 3+, 선택)

**목표**: 반복 조회 90% 속도 향상  
**총 소요**: 1-2주 (Phase 1-2 효과 측정 후 결정)

**선행 조건 체크**:
- [ ] Upstash 무료 플랜 가입 가능 여부
- [ ] 대안: React Query 캐시만으로 충분한지 평가
- [ ] 비용 대비 효과 분석

| 순서 | 작업 | 소요 시간 | 체크리스트 |
|-----|------|----------|----------|
| 1 | Upstash Redis 설정 | 1시간 | [ ] 계정 생성<br>[ ] 환경 변수 설정 |
| 2 | 캐싱 레이어 구현 | 4-6시간 | [ ] getCachedData 함수<br>[ ] TTL 정책 설정 |
| 3 | 캐시 무효화 로직 | 2-3시간 | [ ] invalidate 함수<br>[ ] 작업별 무효화 |
| 4 | 성능 임계값 모니터링 설정 | 2-3시간 | [ ] 모니터링 코드 추가<br>[ ] 임계값 정의<br>[ ] 알람 연동 (선택) |
| 5 | 지속적 모니터링 대시보드 | 1일 | [ ] 성능 지표 수집<br>[ ] 대시보드 구성 |

> **💡 참고**: DB 인덱스는 Phase 1에서 이미 추가됩니다. ([Phase 1 - 5번 항목](#phase-1-즉시-효과-day-1) 참조)

---

## 📈 예상 효과

### 정량적 효과

| 지표 | Before | After | 개선율 |
|-----|--------|-------|--------|
| **aed-data 페이지 진입** | 5-7초 | 1-2초 | **70% ↓** |
| **추가 버튼 (단일)** | ~10초 | 1-2초 | **85% ↓** |
| **추가 버튼 (대량 50개)** | ~15초 | 3초 | **80% ↓** |
| **추가완료 탭 반영** | 새로고침 필요 | 즉시 (0ms) | **100% ↑** |
| **inspection 페이지** | 4-5초 | 1-2초 | **65% ↓** |
| **점검 세션 시작** | ~10초 | 2초 | **80% ↓** |
| **탭 전환 (캐싱)** | 1-2초 | 0.1초 | **95% ↓** |

### 정성적 효과

#### 사용자 경험
- ✅ 즉각적인 UI 반응 (낙관적 업데이트)
- ✅ 부드러운 페이지 전환
- ✅ 모바일 환경에서 쾌적한 사용
- ✅ 대량 작업 시 안정적인 성능

#### 시스템 효율
- ✅ DB 부하 60% 감소 (병렬 쿼리 + RPC)
- ✅ 네트워크 트래픽 50% 감소 (캐싱)
- ✅ 서버 응답 시간 개선
- ✅ 동시 접속자 처리 능력 향상

#### 개발 생산성
- ✅ 코드 중복 제거 (RPC 함수)
- ✅ 에러 처리 간소화
- ✅ 테스트 용이성 향상
- ✅ 유지보수 비용 절감

---

## 📊 성능 측정 및 모니터링

### 📈 핵심 모니터링 지표

각 도구별 핵심 지표와 정상 범위, 문제 신호를 정리했습니다.

| 도구 | 핵심 지표 | 정상 범위 | 문제 신호 | 대응 방법 |
|------|----------|----------|----------|----------|
| **Supabase Dashboard** | DB 연결 수 (Connections) | < 10개 | > 20개 | N+1 쿼리 의심 → 병렬화 or JOIN |
| | 쿼리 실행 시간 | < 500ms | > 2초 | 인덱스 추가 필요 |
| | 슬로우 쿼리 비율 | < 5% | > 10% | 쿼리 최적화 검토 |
| **React Query Devtools** | staleTime 활용률 | > 70% | < 50% | 과도한 리페치 → staleTime 증가 |
| | 캐시 히트율 | > 80% | < 60% | 쿼리 키 설계 재검토 |
| | 동시 쿼리 수 | < 5개 | > 10개 | 불필요한 쿼리 제거 |
| **Upstash Redis** | 캐시 히트율 | > 80% | < 60% | TTL 너무 짧음 or 캐시 키 설계 문제 |
| | 메모리 사용량 | < 80% | > 90% | TTL 단축 or 불필요한 키 제거 |
| | 평균 응답 시간 | < 10ms | > 50ms | 네트워크 레이턴시 or Redis 부하 |
| **Chrome DevTools Network** | API 응답 시간 | < 1초 | > 3초 | 서버 병목 or N+1 쿼리 |
| | Waterfall 패턴 | 병렬 요청 | 순차적 긴 체인 | Promise.all로 병렬화 |
| | 총 페이로드 크기 | < 500KB | > 2MB | 불필요한 데이터 제거 or 페이지네이션 |

### 🚨 성능 임계값 모니터링

```typescript
// lib/monitoring/thresholds.ts
export const performanceThresholds = {
  // API 응답 시간 (ms)
  apiResponseTime: 3000,
  
  // 페이지 로드 시간 (ms)
  pageLoadTime: 5000,
  
  // 캐시 히트율 (0-1)
  cacheHitRatio: 0.8,
  
  // DB 연결 수
  dbConnections: 20,
  
  // 쿼리 실행 시간 (ms)
  queryExecutionTime: 2000
} as const;

// 자동 알람 시스템
export function monitorPerformance(metric: {
  name: keyof typeof performanceThresholds;
  value: number;
  context?: Record<string, any>;
}) {
  const threshold = performanceThresholds[metric.name];
  
  if (metric.value > threshold) {
    // 슬랙/이메일 알람 발송 (선택 사항)
    sendAlert({
      message: `⚠️ 성능 임계값 초과: ${metric.name} = ${metric.value} (임계값: ${threshold})`,
      severity: 'warning',
      context: metric.context
    });
    
    // 콘솔 경고
    console.warn('[Performance Alert]', {
      metric: metric.name,
      value: metric.value,
      threshold,
      exceeded: metric.value - threshold
    });
  }
}

// 사용 예시
export function trackApiCall(endpoint: string, duration: number) {
  monitorPerformance({
    name: 'apiResponseTime',
    value: duration,
    context: { endpoint }
  });
}
```

### 측정 도구

1. **Chrome DevTools**
   - Performance 탭: 렌더링 시간 측정
   - Network 탭: API 호출 시간 측정
   - Lighthouse: 전체 성능 점수

2. **React Query Devtools**
   - 쿼리 상태 모니터링
   - 캐시 히트율 확인
   - 리페칭 빈도 분석

3. **Supabase Dashboard**
   - 쿼리 실행 시간
   - DB 연결 수
   - 슬로우 쿼리 분석

4. **Upstash Dashboard** (Redis)
   - 캐시 히트율
   - 메모리 사용량
   - 요청 빈도

### 모니터링 대시보드

```typescript
// lib/monitoring/performance.ts
export function reportPerformance(metric: {
  name: string;
  value: number;
  path: string;
  userId?: string;
}) {
  // Production에서만 실행
  if (process.env.NODE_ENV !== 'production') return;
  
  // Analytics로 전송 (예: Google Analytics, Mixpanel)
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'performance_metric', {
      metric_name: metric.name,
      metric_value: metric.value,
      page_path: metric.path,
      user_id: metric.userId
    });
  }
  
  // Console에 경고 (개발 시)
  if (metric.value > 3000) {
    console.warn(`[Performance Warning] ${metric.name} took ${metric.value}ms`);
  }
}

// 사용 예시
export function usePerformanceMonitoring(pageName: string) {
  useEffect(() => {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      reportPerformance({
        name: `page_load_${pageName}`,
        value: duration,
        path: window.location.pathname
      });
    };
  }, [pageName]);
}
```

---

## 🚨 주의사항 및 리스크

### 1. 낙관적 업데이트 실패 처리

**리스크**: 서버 요청 실패 시 UI와 실제 데이터 불일치

**대응책**:
```typescript
onError: (err, variables, context) => {
  // 롤백
  if (context?.previousData) {
    queryClient.setQueryData(queryKey, context.previousData);
  }
  
  // 사용자에게 알림
  toast.error('작업 실패. 다시 시도해주세요.');
  
  // 에러 로깅
  console.error('[Mutation Error]', err);
}
```

### 2. 캐시 무효화 타이밍

**리스크**: 오래된 캐시 데이터 표시

**대응책**:
- TTL 적절히 설정 (실시간성 vs 성능 트레이드오프)
- 중요한 작업 후 명시적 무효화
- Background Refetch 활용

### 3. RPC 함수 롤백

**리스크**: DB 에러 시 일부만 실행될 수 있음

**대응책**:
```sql
-- 트랜잭션 사용
BEGIN;
  -- 모든 작업
COMMIT;

EXCEPTION WHEN OTHERS THEN
  ROLLBACK;
  RETURN json_build_object('success', false, 'error', SQLERRM);
```

### 4. 병렬 쿼리 순서 의존성

**리스크**: 의존적인 쿼리를 병렬 실행하면 에러

**대응책**:
- 독립적인 쿼리만 병렬 실행
- 의존성 있는 경우 순차 실행 유지

---

## 📚 참고 자료

### React Query 최적화
- [React Query Best Practices](https://tkdodo.eu/blog/practical-react-query)
- [Optimistic Updates](https://tanstack.com/query/latest/docs/react/guides/optimistic-updates)

### Supabase 성능
- [Supabase Performance Tips](https://supabase.com/docs/guides/database/postgres-performance)
- [Postgres RPC Functions](https://supabase.com/docs/guides/database/functions)

### 캐싱 전략
- [Upstash Redis Documentation](https://upstash.com/docs/redis)
- [Cache-Aside Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside)

---

## 🎯 다음 단계 (권장 순서)

### 1️⃣ 즉시 시작 (오늘 ~ 내일)

**Phase 0 실행**: 현상 측정부터 시작
- Chrome DevTools로 주요 페이지 성능 측정 및 기록
- 스크린샷과 함께 Before 데이터 저장
- 재현 시나리오 3가지 준비

**Phase 1 착수**: P0 항목 구현
- AEDDataProvider staleTime 조정 (30분)
- 추가 버튼 낙관적 업데이트 (1-2시간)
- 대량 추가 배치 최적화 (1-2시간)
- 일정 추가 API 병렬 쿼리 (2-3시간)

**예상 효과**: 사용자 체감 성능 80% 개선

---

### 2️⃣ Phase 1 완료 후 (2-3일차)

**성능 측정 및 평가**:
- DevTools로 Before/After 비교
- 목표 달성 여부 확인 (80% 개선)
- 사용자 피드백 수집

**Phase 2 진행 여부 결정**:
- ✅ Phase 1 효과 만족 → Phase 2 진행
- ⚠️ 여전히 느림 → 병목 재분석 후 Phase 2 우선 진행
- ❌ 다른 이슈 발견 → 우선순위 재조정

---

### 3️⃣ Phase 2 이후 (1주차 완료 시)

**Supabase 접근 권한 확인**:
- [ ] Dashboard 로그인 가능
- [ ] SQL Editor 실행 가능
- [ ] 마이그레이션 권한 확인

**Phase 3 진행 조건**:
- ✅ Supabase 접근 가능 → RPC 함수 학습 및 구현
- ❌ 권한 없음 → Phase 1-2 개선으로 충분한지 평가

---

### 4️⃣ 장기 계획 (2주 이후)

**Redis 캐싱 도입 검토**:
- Phase 1-2 효과가 충분한가?
- 반복 조회가 많은 페이지가 있는가?
- Upstash 무료 플랜으로 충분한가?

**판단 기준**:
- ✅ 체감 성능 만족 → Redis 생략 또는 보류
- ⚠️ 추가 개선 필요 → Phase 4 진행
- 💡 DB 인덱스만 추가 → 빠른 효과, 비용 없음

---

## ✅ 최종 체크리스트

### Phase 0: 착수 전 (필수)

- [ ] **성능 측정 데이터 수집**
  - [ ] aed-data 페이지 로딩 시간 (DevTools Performance)
  - [ ] 추가 버튼 클릭 → 완료까지 시간 (Network)
  - [ ] inspection 페이지 로딩 시간
  - [ ] 점검 세션 시작 시간
  - [ ] 스크린샷 저장 (Before 증거)

- [ ] **재현 시나리오 준비**
  - [ ] 시나리오 1: aed-data 진입 → 추가 → 탭 전환
  - [ ] 시나리오 2: inspection 진입 → 점검 시작
  - [ ] 시나리오 3: 대량 추가 50개

- [ ] **환경 준비**
  - [ ] 로컬 개발 환경 정상 동작 확인
  - [ ] React Query Devtools 설치 확인
  - [ ] Git 커밋 가능 확인

---

### Phase 1: 구현 중

- [ ] **코드 수정**
  - [ ] AEDDataProvider.tsx: staleTime 3분 설정
  - [ ] AEDDataPageClient.tsx: 낙관적 업데이트 구현
  - [ ] assignments/route.ts: Promise.all 병렬화
  - [ ] assignments/route.ts: 청크 배치 처리

- [ ] **로컬 테스트**
  - [ ] 각 항목별 기능 동작 확인
  - [ ] 에러 케이스 테스트 (네트워크 실패 등)
  - [ ] DevTools로 성능 측정

- [ ] **성능 검증**
  - [ ] Before/After 비교표 작성
  - [ ] 목표 달성 확인 (80% 개선)

---

### Phase 1: 배포 전

- [ ] **코드 리뷰 (셀프)**
  - [ ] console.log 제거
  - [ ] 주석 정리
  - [ ] 에러 처리 확인
  - [ ] TypeScript 에러 없음

- [ ] **테스트**
  - [ ] 재현 시나리오 3가지 재실행
  - [ ] 모바일 환경 확인 (선택)

- [ ] **커밋 & 푸시**
  - [ ] 의미있는 커밋 메시지
  - [ ] Git push → 자동 배포 확인

---

### Phase 1: 배포 후

- [ ] **프로덕션 모니터링**
  - [ ] 실제 사용자 환경에서 성능 확인
  - [ ] 에러 로그 확인 (Vercel/Sentry)
  - [ ] 사용자 피드백 수집

- [ ] **Phase 2 진행 여부 결정**
  - [ ] Phase 1 효과 평가
  - [ ] 추가 개선 필요 여부 판단

---

### Phase 2-4: 선택적 진행

- [ ] **Phase 2 조건 확인**
  - [ ] Phase 1 효과 측정 완료
  - [ ] 추가 개선 필요 (초기 로딩 여전히 느림)

- [ ] **Phase 3 조건 확인**
  - [ ] Supabase Dashboard 접근 가능
  - [ ] RPC 함수 학습 준비
  - [ ] 테스트 환경 구성 가능

- [ ] **Phase 4 조건 확인**
  - [ ] Phase 1-2 효과 불충분
  - [ ] Upstash 가입 가능
  - [ ] 비용 대비 효과 분석 완료

---

**작성 완료일**: 2025년 10월 16일  
**업데이트**: 2025년 10월 16일 (1인 개발 환경 최적화)  
**다음 액션**: Phase 0 (현상 측정) 시작
