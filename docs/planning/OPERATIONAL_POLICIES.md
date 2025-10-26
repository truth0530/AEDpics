# 운영 정책 통합 문서

**최종 업데이트**: 2025-10-09
**상태**: ✅ 구현 완료 및 운영 중
**통합 문서**: inspection-assignment-policy.md, map-sync-ux.md

---

## 📋 목차

1. [시스템 개요](#시스템-개요)
2. [점검 할당 정책](#점검-할당-정책)
3. [역할별 동작 방식](#역할별-동작-방식)
4. [지도 동기화 UX](#지도-동기화-ux)
5. [데이터베이스 설계](#데이터베이스-설계)
6. [API 엔드포인트](#api-엔드포인트)
7. [구현 상태](#구현-상태)

---

## 시스템 개요

### 핵심 정책

AED 점검 시스템의 운영 정책은 두 가지 핵심 메뉴를 중심으로 작동합니다:

1. **우선순위 메뉴**: 점검 계획 수립 및 일정추가
2. **현장점검 메뉴**: 실제 점검 수행 (일정추가된 장비만)

### 주요 기능

- **일정추가 시스템**: 점검 대상 확정 및 할당
- **2단계 필터링**: 관할 지역 + 일정추가 여부
- **지도 자동 초기화**: 내 위치 기반 자동 설정
- **플로팅 버튼 UX**: 지도 이동 시 명확한 피드백

---

## 점검 할당 정책

### 핵심 정책

```
┌─────────────────────────────────────────────────────────────┐
│ 정책 1: 일정추가 = 점검 대상 확정                           │
├─────────────────────────────────────────────────────────────┤
│ - 우선순위 메뉴에서 "일정추가" 버튼 클릭                     │
│ - inspection_assignments 테이블에 할당 기록 생성             │
│ - 현장점검 메뉴에 해당 장비 노출                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 정책 2: 일정추가 하지 않은 장비는 현장점검 메뉴에서 숨김     │
├─────────────────────────────────────────────────────────────┤
│ - 보건소 담당자: 본인이 추가한 장비만 보임                   │
│ - 임시점검원: 본인에게 할당된 장비만 보임                    │
│ - 할당되지 않은 장비는 "존재하지 않는 것처럼" 처리          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 정책 3: 점검 완료된 장비는 현장점검 메뉴에서 비활성화        │
├─────────────────────────────────────────────────────────────┤
│ - 점검 상태가 'completed'인 장비는 회색 표시                │
│ - 클릭 불가 또는 "점검 완료됨" 안내                         │
│ - 재점검 필요 시 다시 일정추가 가능                         │
└─────────────────────────────────────────────────────────────┘
```

### 메뉴별 비교

| 메뉴 | 목적 | 대상 장비 | 주요 기능 | 사용자 |
|------|------|----------|----------|--------|
| **우선순위** | 점검 계획 수립 | 전체 AED (관할 내) | 일정추가, 우선순위 확인 | 보건소 담당자, 시도청, 중앙 |
| **현장점검** | 실제 점검 수행 | 일정추가된 AED만 | 점검 진행, 데이터 기록 | 보건소 담당자, 임시점검원 |

---

## 역할별 동작 방식

### 1. 보건소 담당자 (local_admin)

#### 우선순위 메뉴
```typescript
// 1. 전체 관할 AED 목록 조회 (우선순위 정렬)
const aedList = await supabase
  .from('aed_inspection_status')
  .select('*')
  .eq('sido', user.organization.region_code)
  .eq('gugun', user.organization.city_code)
  .order('priority_score', { ascending: false });

// 2. "일정추가" 버튼 클릭
const addToSchedule = async (equipmentSerial: string) => {
  await supabase.from('inspection_assignments').insert({
    equipment_serial: equipmentSerial,
    assigned_to: user.id,
    assigned_by: user.id,
    assignment_type: 'scheduled',
    scheduled_date: selectedDate,
    status: 'pending'
  });
};
```

#### 현장점검 메뉴
```typescript
// 본인이 일정추가한 장비만 조회
const assignedAEDs = await supabase
  .from('aed_data')
  .select('*, inspection_assignments!inner(*)')
  .eq('inspection_assignments.assigned_to', user.id)
  .eq('inspection_assignments.status', 'pending');
```

---

### 2. 임시점검원 (temporary_inspector)

#### 우선순위 메뉴 (접근 불가)
```typescript
// 임시점검원은 우선순위 메뉴 자체를 볼 수 없음
const canAccessPriorityMenu = (userRole: UserRole) => {
  return !['temporary_inspector'].includes(userRole);
};
```

#### 현장점검 메뉴 (할당된 장비만)
```typescript
// 보건소 담당자가 임시점검원에게 할당한 장비만 조회
const myAssignedAEDs = await supabase
  .from('aed_data')
  .select('*, inspection_assignments!inner(*)')
  .eq('inspection_assignments.assigned_to', user.id)
  .eq('inspection_assignments.status', 'pending');
```

---

### 3. 시도청 담당자 (regional_admin)

#### 우선순위 메뉴
```typescript
// 본인 시도 전체 AED 목록 조회 (모든 보건소)
const regionalAEDs = await supabase
  .from('aed_inspection_status')
  .select('*, inspection_assignments(*)')
  .eq('sido', user.region)
  .order('priority_score', { ascending: false });

// 보건소별 할당 현황 통계
<StatsSummary>
  <Stat label="전체 AED" value={regionalAEDs.length} />
  <Stat label="일정추가됨" value={scheduledCount} />
  <Stat label="미할당" value={unscheduledCount} />
</StatsSummary>
```

---

### 4. 중앙응급의료센터/보건복지부 (emergency_center_admin, ministry_admin)

#### 우선순위 메뉴
```typescript
// 전국 AED 목록 조회
const nationalAEDs = await supabase
  .from('aed_inspection_status')
  .select('*, inspection_assignments(*)')
  .order('priority_score', { ascending: false });

// 시도별 할당 현황 대시보드
<NationalDashboard>
  {REGIONS.map(region => (
    <RegionCard key={region.code}>
      <h3>{region.label}</h3>
      <Stats>
        <Stat label="전체 AED" value={regionStats[region.code].total} />
        <Stat label="일정추가" value={regionStats[region.code].scheduled} />
        <Stat label="점검 완료" value={regionStats[region.code].completed} />
      </Stats>
    </RegionCard>
  ))}
</NationalDashboard>
```

---

## 지도 동기화 UX

### 하이브리드 UX 전략

**"지능적 자동화 + 사용자 제어권"**

1. **초기 로드 시**: 자동 동기화 (직관성)
2. **이동 중**: 플로팅 버튼 표시 (안정성)
3. **명시적 조회**: 사용자가 결정 (제어권)

### UX 플로우

```
┌─────────────────────────────────────────────────────────┐
│ STEP 1: 초기 로드 (자동)                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 지도 탭 진입                                             │
│     ↓                                                   │
│ 내 위치 감지 (Geolocation API)                          │
│     ↓                                                   │
│ 역지오코딩 (Kakao Maps)                                 │
│     ↓                                                   │
│ 필터 자동 설정: "충남, 천안시"                           │
│     ↓                                                   │
│ API 호출 → 마커 표시                                     │
│                                                         │
│ ✅ 사용자 경험: "내 주변 AED가 바로 보인다!"              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ STEP 2: 지도 이동 (플로팅 버튼)                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 사용자가 지도 드래그/줌                                   │
│     ↓                                                   │
│ 지도 중심 변경 감지 (idle 이벤트)                         │
│     ↓                                                   │
│ 역지오코딩: "대구 수성구"                                │
│     ↓                                                   │
│ 플로팅 버튼 표시:                                        │
│ ┌─────────────────────────┐                            │
│ │ 📍 이 지역 조회           │                            │
│ │ 대구 수성구               │                            │
│ └─────────────────────────┘                            │
│                                                         │
│ ⚠️ 필터는 "충남, 천안시" 그대로 유지                      │
│ ⚠️ API 호출 안 함 (안정성 확보)                           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ STEP 3: 명시적 조회 (사용자 제어)                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ "이 지역 조회" 버튼 클릭                                  │
│     ↓                                                   │
│ 필터 업데이트: "대구, 수성구"                             │
│     ↓                                                   │
│ API 호출 → 마커 업데이트                                 │
│     ↓                                                   │
│ 플로팅 버튼 숨김                                         │
└─────────────────────────────────────────────────────────┘
```

### 초기 로드 로직

```typescript
useEffect(() => {
  if (!map || !isMapLoaded || !isInitialLoadRef.current) return;

  // 내 위치 감지
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      // 지도 중심 이동
      const moveLatLng = new window.kakao.maps.LatLng(lat, lng);
      map.setCenter(moveLatLng);

      // 역지오코딩
      const geocoder = new window.kakao.maps.services.Geocoder();
      geocoder.coord2RegionCode(lng, lat, (result, status) => {
        if (status === window.kakao.maps.services.Status.OK) {
          const region = result.find((r) => r.region_type === 'H');
          if (region) {
            const sidoFull = region.region_1depth_name;
            const gugun = region.region_2depth_name;
            const sidoShort = normalizeRegionName(sidoFull);

            // ✅ 필터 자동 설정 (초기 로드 시에만)
            window.sessionStorage.setItem('selectedSido', sidoShort);
            window.sessionStorage.setItem('selectedGugun', gugun);

            // 필터바에 알림
            window.dispatchEvent(new CustomEvent('mapRegionChanged', {
              detail: { sido: sidoShort, gugun, autoLoad: true }
            }));

            isInitialLoadRef.current = false;
          }
        }
      });
    },
    () => {
      // 위치 감지 실패 시 서울 시청으로 기본 설정
      const defaultLatLng = new window.kakao.maps.LatLng(37.5665, 126.9780);
      map.setCenter(defaultLatLng);
    }
  );
}, [map, isMapLoaded]);
```

### 플로팅 버튼 UI

```tsx
{/* 플로팅 "이 지역 조회" 버튼 */}
{showRegionButton && pendingRegion && (
  <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-10 animate-slide-down">
    <button
      onClick={() => {
        // 필터 업데이트
        window.sessionStorage.setItem('selectedSido', pendingRegion.sido);
        window.sessionStorage.setItem('selectedGugun', pendingRegion.gugun);

        // 필터바에 알림 (자동 조회 트리거)
        window.dispatchEvent(new CustomEvent('mapRegionChanged', {
          detail: {
            sido: pendingRegion.sido,
            gugun: pendingRegion.gugun,
            autoLoad: true
          }
        }));

        // 버튼 숨김
        setShowRegionButton(false);
        setPendingRegion(null);
      }}
      className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg shadow-lg"
    >
      <span className="text-2xl">📍</span>
      <div className="text-left">
        <div className="text-xs text-green-200">이 지역 조회</div>
        <div className="font-bold">{pendingRegion.sido} {pendingRegion.gugun}</div>
      </div>
    </button>
  </div>
)}
```

### 지도 2단계 필터링 (현장점검 메뉴)

**권장: 비활성화 + 구분 표시**

```typescript
// components/inspection/FieldInspectionMap.tsx
export function FieldInspectionMap() {
  const user = useUser();

  // 1. 관할 전체 AED 조회
  const { data: allAEDs } = useQuery({
    queryKey: ['jurisdiction-aeds', user.organization_id],
    queryFn: async () => {
      const res = await fetch('/api/aed-data', {
        method: 'POST',
        body: JSON.stringify({
          filters: {
            regionCodes: [user.organization.region_code],
            cityCodes: [user.organization.city_code]
          }
        })
      });
      return res.json();
    }
  });

  // 2. 할당된 AED 목록 조회
  const { data: assignedAEDs } = useQuery({
    queryKey: ['assigned-aeds', user.id],
    queryFn: () => fetch('/api/inspections/field/assigned').then(r => r.json())
  });

  // 3. 할당 여부 맵 생성
  const assignmentMap = useMemo(() => {
    const map = new Map();
    assignedAEDs?.data?.forEach((aed: any) => {
      map.set(aed.equipment_serial, aed);
    });
    return map;
  }, [assignedAEDs]);

  return (
    <KakaoMap center={userLocation} zoom={13}>
      {allAEDs?.data?.map((aed: AEDDevice) => {
        const assignment = assignmentMap.get(aed.equipment_serial);
        const isAssigned = !!assignment;
        const isCompleted = assignment?.assignment_status === 'completed';

        return (
          <Marker
            key={aed.equipment_serial}
            lat={aed.latitude}
            lng={aed.longitude}
            color={
              isCompleted ? 'gray' :    // 점검 완료
              isAssigned ? 'blue' :     // 일정추가됨
              'lightgray'               // 미할당 (비활성화)
            }
            opacity={isAssigned ? 1.0 : 0.4}
            disabled={!isAssigned || isCompleted}
            onClick={() => {
              if (!isAssigned) {
                toast.warning('일정추가가 필요한 장비입니다.');
              } else if (isCompleted) {
                toast.info('이미 점검 완료된 장비입니다.');
              } else {
                router.push(`/inspection/${aed.equipment_serial}`);
              }
            }}
          >
            <MarkerContent>
              <h4>{aed.installation_institution}</h4>
              {isCompleted && <Badge color="gray">✓ 점검 완료</Badge>}
              {isAssigned && !isCompleted && (
                <Badge color="blue">일정추가됨 ({assignment.scheduled_date})</Badge>
              )}
              {!isAssigned && <Badge color="lightgray">일정추가 필요</Badge>}
            </MarkerContent>
          </Marker>
        );
      })}
    </KakaoMap>
  );
}
```

---

## 데이터베이스 설계

### inspection_assignments 테이블

```sql
CREATE TABLE inspection_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- 할당 대상
  equipment_serial VARCHAR(255) NOT NULL REFERENCES aed_data(equipment_serial),

  -- 할당 정보
  assigned_to UUID NOT NULL REFERENCES user_profiles(id),
  assigned_by UUID NOT NULL REFERENCES user_profiles(id),

  -- 할당 타입
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('scheduled', 'urgent', 'follow_up')),

  -- 일정 정보
  scheduled_date DATE,
  scheduled_time TIME,

  -- 상태
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),

  -- 메타데이터
  notes TEXT,
  priority_level INT DEFAULT 0 CHECK (priority_level BETWEEN 0 AND 3),

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- 중복 방지
  CONSTRAINT unique_active_assignment UNIQUE (equipment_serial, assigned_to, status)
    WHERE status IN ('pending', 'in_progress')
);

-- 인덱스
CREATE INDEX idx_assignments_assigned_to_status
  ON inspection_assignments (assigned_to, status, scheduled_date DESC)
  WHERE status IN ('pending', 'in_progress');

CREATE INDEX idx_assignments_equipment_status
  ON inspection_assignments (equipment_serial, status, created_at DESC);

CREATE INDEX idx_assignments_scheduled_date
  ON inspection_assignments (scheduled_date DESC, status)
  WHERE status = 'pending';
```

**현재 레코드 수**: 18개

### assigned_aed_list 뷰 (현장점검 목록용)

```sql
CREATE VIEW assigned_aed_list AS
SELECT
  a.*,  -- 모든 aed_data 필드

  -- 할당 정보
  ia.id AS assignment_id,
  ia.assigned_to,
  ia.assigned_by,
  ia.assignment_type,
  ia.scheduled_date,
  ia.status AS assignment_status,
  ia.notes AS assignment_notes,

  -- 할당자 정보
  up_assigned_by.full_name AS assigned_by_name,
  up_assigned_by.organization_id AS assigned_by_org,

  -- 최신 점검 정보
  latest.id AS latest_inspection_id,
  latest.inspection_date AS last_inspection_date,
  latest.overall_status AS last_inspection_status,

  -- 점검 필요성 계산
  CASE
    WHEN ia.status = 'completed' THEN 'completed'
    WHEN ia.status = 'in_progress' THEN 'in_progress'
    WHEN ia.scheduled_date < CURRENT_DATE THEN 'overdue'
    WHEN ia.scheduled_date = CURRENT_DATE THEN 'today'
    WHEN ia.scheduled_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'upcoming'
    ELSE 'scheduled'
  END AS inspection_urgency

FROM aed_data a
INNER JOIN inspection_assignments ia ON a.equipment_serial = ia.equipment_serial
LEFT JOIN user_profiles up_assigned_by ON ia.assigned_by = up_assigned_by.id
LEFT JOIN LATERAL (
  SELECT id, equipment_serial, inspection_date, overall_status
  FROM aed_inspections
  WHERE equipment_serial = a.equipment_serial
  ORDER BY inspection_date DESC, created_at DESC
  LIMIT 1
) latest ON true

WHERE ia.status IN ('pending', 'in_progress');
```

---

## API 엔드포인트

### 일정추가 API

```typescript
// POST /api/inspections/assignments
export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    equipmentSerial,
    assignedTo,
    scheduledDate,
    assignmentType,
    notes
  } = body;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1. 중복 방지
  const { data: existing } = await supabase
    .from('inspection_assignments')
    .select('id')
    .eq('equipment_serial', equipmentSerial)
    .eq('assigned_to', assignedTo)
    .in('status', ['pending', 'in_progress'])
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: '이미 할당된 장비입니다.' },
      { status: 409 }
    );
  }

  // 2. 할당 생성
  const { data, error } = await supabase
    .from('inspection_assignments')
    .insert({
      equipment_serial: equipmentSerial,
      assigned_to: assignedTo,
      assigned_by: user.id,
      assignment_type: assignmentType || 'scheduled',
      scheduled_date: scheduledDate,
      notes,
      status: 'pending'
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

### 현장점검 목록 API

```typescript
// GET /api/inspections/field/assigned
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 역할별 쿼리
  let query = supabase
    .from('assigned_aed_list')
    .select('*')
    .order('inspection_urgency', { ascending: true })
    .order('scheduled_date', { ascending: true });

  // 본인에게 할당된 장비만
  query = query.eq('assigned_to', user.id);

  // 점검 대기 중 또는 진행 중만
  query = query.in('assignment_status', ['pending', 'in_progress']);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data,
    stats: {
      total: data.length,
      overdue: data.filter(d => d.inspection_urgency === 'overdue').length,
      today: data.filter(d => d.inspection_urgency === 'today').length,
      upcoming: data.filter(d => d.inspection_urgency === 'upcoming').length,
      in_progress: data.filter(d => d.assignment_status === 'in_progress').length
    }
  });
}
```

---

## 구현 상태

### ✅ 완료된 기능 (2025-10-09)

1. **점검 할당 시스템**
   - inspection_assignments 테이블 (18개 레코드)
   - assigned_aed_list 뷰
   - 일정추가 API
   - 할당된 목록 API

2. **지도 초기화 정책**
   - 내 위치 기반 자동 설정
   - 역지오코딩 통합
   - 필터 자동 동기화

3. **2단계 필터링**
   - 관할 지역 필터
   - 일정추가 여부 필터
   - 비활성화 마커 표시

4. **역할별 권한 제어**
   - 보건소 담당자 전체 기능
   - 임시점검원 제한 기능
   - 시도청/중앙 모니터링

### ⏳ 계획 중인 기능

1. **플로팅 버튼 UX**
   - 지도 이동 시 "이 지역 조회" 버튼
   - 3초 자동 숨김
   - 애니메이션

2. **대량 할당 도구**
   - CSV 업로드
   - 일괄 할당 처리

3. **할당 통계 대시보드**
   - 시도별 할당 현황
   - 점검 진행률 모니터링

---

## 운영 가이드

### 주의사항

**절대 금지 사항**:
1. ❌ inspection_assignments 테이블 직접 수정 금지
2. ❌ assigned_aed_list 뷰 정의 변경 금지
3. ❌ 중복 할당 허용 금지 (UNIQUE 제약조건 준수)

**권장 사항**:
1. ✅ 일정추가 전 중복 확인
2. ✅ 점검 완료 시 assignment status 업데이트
3. ✅ 주기적 통계 확인 (할당률, 완료율)

### 모니터링 쿼리

**미할당 AED 확인**:
```sql
SELECT COUNT(*)
FROM aed_data a
LEFT JOIN inspection_assignments ia ON a.equipment_serial = ia.equipment_serial
  AND ia.status IN ('pending', 'in_progress')
WHERE ia.id IS NULL;
```

**할당 통계**:
```sql
SELECT
  assignment_type,
  status,
  COUNT(*) as count
FROM inspection_assignments
GROUP BY assignment_type, status;
```

**지연 점검 확인**:
```sql
SELECT *
FROM inspection_assignments
WHERE status = 'pending'
  AND scheduled_date < CURRENT_DATE
ORDER BY scheduled_date ASC;
```

---

## 마이그레이션

### ✅ 완료된 마이그레이션

| 번호 | 파일명 | 설명 | 실행일 |
|------|--------|------|--------|
| 20251005 | [20251005_inspection_assignments.sql](../../supabase/migrations/20251005_inspection_assignments.sql) | 점검 할당 시스템 (테이블, 뷰, RLS) | 2025-10-05 |

**현재 상태**: 18개 할당 운영 중

**핵심 구성 요소**:
- `inspection_assignments` 테이블 - 점검 일정추가 및 할당 관리
- `assigned_aed_list` 뷰 - 현장점검 목록용 (세션 정보 포함)
- RLS 정책 - 본인 할당/본인이 생성한 기록만 접근
- EXCLUDE 제약조건 - 중복 할당 방지 (btree_gist 확장 사용)

### 📚 마이그레이션 상세 가이드

- [MIGRATION_GUIDE.md](../reference/MIGRATION_GUIDE.md) - 전체 마이그레이션 가이드
  - Phase 8: 점검 할당 시스템 (20251005번)
  - 검증 쿼리 및 주의사항
  - assigned_aed_list 뷰 상세 설명

---

## 참고 문서

- **마이그레이션**: [MIGRATION_GUIDE.md](../reference/MIGRATION_GUIDE.md) - 데이터베이스 마이그레이션 전체 가이드
- **점검 시스템**: [INSPECTION_SYSTEM.md](./INSPECTION_SYSTEM.md) - 8단계 점검 프로세스
- **매핑 시스템**: [MAPPING_SYSTEM.md](./MAPPING_SYSTEM.md) - 구비의무기관 매핑
- **지도 초기화**: [2025-10-06-map-init-policy.md](../reports/2025-10-06-map-init-policy.md)
- **프로젝트 상태**: [PROJECT_STATUS.md](../PROJECT_STATUS.md)

---

**작성**: AED Smart Check 개발팀
**최종 업데이트**: 2025-10-09
**상태**: ✅ 운영 중
**레코드**: inspection_assignments 18개 운영 중
