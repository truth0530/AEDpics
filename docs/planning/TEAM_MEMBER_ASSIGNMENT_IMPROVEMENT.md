# 팀원 할당 기능 개선 계획 (상세판)

## Executive Summary

현재 "담당자 선택" 모달에서 팀원이 표시되지 않는 문제를 근본적으로 해결하고, 권한 검증, 성능 최적화, 명확한 의미론을 갖춘 할당 시스템을 구축하는 계획입니다.

**핵심 원칙**:
- Authorization: 조직 경계와 역할 기반 접근 제어
- Clarity: "전체" vs "미할당" vs "본인" 명확한 구분
- Performance: N+1 쿼리 제거, 인덱스 최적화
- Safety: 테스트 기반 개발

---

## 1. 근본 원인 분석 (재검토)

### 1.1 왜 팀원이 보이지 않는가?

**현재 API 흐름**:
```
/api/team/members
  ↓
SELECT * FROM team_members
WHERE organization_id = $1 AND is_active = true
  ↓
Result: [] (비어있음)
```

**문제점**:
- `team_members` 테이블은 **선택적 마스터 데이터** (backup, 통계용)
- 실제 **활성 사용자는 `user_profiles`에만 존재**
- `user_profiles` 테이블에 `organization_id`, `role`, `region_code`, `district` 존재

**올바른 접근**:
- 신뢰할 수 있는 단일 소스: `user_profiles`
- 필터링 기준: region_code, organization_id, role, approval status

---

## 2. 권한 기반 팀원 필터링 (RBAC)

### 2.1 권한 규칙 정의 (CLAUDE.md 기준)

**중앙응급의료센터** (email: @nmc.or.kr, organization_type: central)
- 조회 권한: 전국 모든 user_profiles
- 할당 가능: 전국 모든 사용자
- 제외: 다른 조직 승인 대기 중인 사용자

**시도 응급의료지원센터** (organization_type: provincial, region_code: 대구)
- 조회 권한: 같은 region_code의 모든 사용자
- 할당 가능: 같은 region_code + 같은 organization_type 또는 하위(보건소)
- 제외: 다른 시도 사용자

**보건소** (organization_type: district_health_center, region_code: 대구, district: 중구)
- 조회 권한: 같은 district의 모든 사용자 + 상위 조직(시도) + 중앙
- 할당 가능: 같은 district 사용자
- 제외: 다른 district 사용자

**보건복지부** (email: @korea.kr, organization_type: ministry)
- 조회 권한: 전국 모든 사용자
- 할당 가능: 전국 모든 사용자

### 2.2 쿼리 필터 규칙

```typescript
// 권한 결정 로직
function getTeamMemberFilter(currentUser: UserProfile) {
  const { role, organization_id, region_code, district } = currentUser;
  const org = await getOrganization(organization_id);

  // 1. 중앙 권한: 전국
  if (org.type === 'central') {
    return {
      is_active: true,
      approved_by: { not: null },  // 승인된 사용자만
      id: { not: currentUser.id }  // 자신 제외
      // region_code 필터 없음 = 전국
    };
  }

  // 2. 시도 권한: 같은 시도
  if (org.type === 'provincial') {
    return {
      region_code: currentUser.region_code,  // 같은 시도만
      is_active: true,
      approved_by: { not: null },
      id: { not: currentUser.id }
    };
  }

  // 3. 보건소 권한: 같은 구군
  if (org.type === 'district_health_center') {
    return {
      region_code: currentUser.region_code,
      district: currentUser.district,  // 같은 구군만
      is_active: true,
      approved_by: { not: null },
      id: { not: currentUser.id }
    };
  }

  // 4. 보건복지부: 전국
  if (org.type === 'ministry') {
    return {
      is_active: true,
      approved_by: { not: null },
      id: { not: currentUser.id }
    };
  }

  // 기본값: 권한 없음
  return { id: { in: [] } };
}
```

### 2.3 Approval 상태 확인 강화

**현재**: `approved_by: { not: null }`만 사용

**개선**: 승인 상태가 취소되거나 만료되었을 수 있음을 고려
```typescript
// 더 엄격한 필터
const validMembers = await prisma.user_profiles.findMany({
  where: {
    region_code: currentUser.region_code,
    is_active: true,
    approved_by: { not: null },
    approved_at: { not: null },
    account_locked: false,  // ← 추가: 잠긴 계정 제외
    rejection_count: { lt: 3 },  // ← 추가: 거부된 사용자 제외
    id: { not: currentUser.id }
  }
});
```

---

## 3. 할당 범위(Assignment Scope) 정의

### 3.1 문제: assigned_to = null의 중의성

**현재**:
```typescript
assigned_to = null  // "미할당"인가? "전체"인가?
```

**해결: 새로운 필드 추가**

#### 3.1.1 마이그레이션: inspection_assignments 확장

```prisma
// prisma/schema.prisma
model inspection_assignments {
  id                    String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  equipment_serial      String    @db.VarChar(255)

  // 기존 필드
  assigned_to           String?   @db.Uuid
  assigned_by           String?   @db.Uuid
  status                String?   @default("pending")

  // NEW: 할당 범위 명확화
  assignment_scope      assignment_scope @default("assigned")  // ← NEW

  // ... 기타 필드들

  @@index([assigned_to, assignment_scope], map: "idx_assignments_scope")
  @@index([assignment_scope], map: "idx_assignments_scope_only")
}

// NEW enum
enum assignment_scope {
  assigned       // assigned_to가 특정 사용자
  all_team       // 전체 팀원 접근 가능 (assigned_to = null)
  unassigned     // 미할당 (할당 전 초기 상태)
}
```

#### 3.1.2 의미 정의

| 상태 | assigned_to | assignment_scope | 의미 | UI 표시 |
|------|-------------|------------------|------|--------|
| 본인 할당 | UUID | assigned | 특정 사용자에게 할당 | "이름" |
| 전체 할당 | null | all_team | 조직 내 모든 팀원 접근 가능 | "전체" |
| 미할당 | null | unassigned | 아직 할당되지 않음 | "미할당" |

---

## 4. 개선된 API: /api/team/members

### 4.1 쿼리 최적화 (N+1 제거)

```typescript
// app/api/team/members/route.ts
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. 현재 사용자 조회 (organization 포함)
    const userProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      include: {  // ← include로 N+1 방지
        organizations: {
          select: {
            id: true,
            type: true,
            name: true
          }
        }
      },
      select: {
        id: true,
        organization_id: true,
        role: true,
        region_code: true,
        district: true,
        full_name: true,
        organizations: true  // ← 위에서 select한 결과
      }
    });

    if (!userProfile?.organization_id) {
      return NextResponse.json(
        { error: 'User organization not found' },
        { status: 404 }
      );
    }

    // 2. 권한 결정
    const filter = getTeamMemberFilter(userProfile);

    // 3. 팀원 목록 조회 (single query)
    const members = await prisma.user_profiles.findMany({
      where: filter,
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        organization_id: true,
        region_code: true,
        district: true,
        position: true,
        organizations: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      },
      orderBy: [
        { organizations: { type: 'asc' } },  // 조직 타입별 정렬
        { role: 'asc' },
        { full_name: 'asc' }
      ],
      take: 100  // ← 페이지네이션: 처음 100명만
    });

    // 4. 할당 통계 (batch query로 N+1 방지)
    const memberIds = members.map(m => m.id);
    const stats = await prisma.inspection_assignments.groupBy({
      by: ['assigned_to'],
      where: {
        assigned_to: { in: memberIds },
        status: { in: ['pending', 'in_progress'] },
        assignment_scope: { not: 'unassigned' }  // ← NEW
      },
      _count: { id: true }
    });

    const statsMap = new Map(stats.map(s => [s.assigned_to, s._count.id]));

    // 5. 완료 통계 (이번 달)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const completed = await prisma.inspection_assignments.groupBy({
      by: ['assigned_to'],
      where: {
        assigned_to: { in: memberIds },
        status: 'completed',
        completed_at: { gte: startOfMonth }
      },
      _count: { id: true }
    });

    const completedMap = new Map(completed.map(c => [c.assigned_to, c._count.id]));

    // 6. 응답 구성 (정규화: members만 반환, 그룹핑은 클라이언트에서)
    const membersWithStats = members.map(m => ({
      id: m.id,
      email: m.email,
      full_name: m.full_name,
      role: m.role,
      organization_id: m.organization_id,
      organization_name: m.organizations?.name || 'Unknown',
      organization_type: m.organizations?.type || 'other',
      region_code: m.region_code,
      district: m.district,
      position: m.position,
      current_assigned: statsMap.get(m.id) || 0,
      completed_this_month: completedMap.get(m.id) || 0
    }));

    return NextResponse.json({
      success: true,
      data: {
        members: membersWithStats,  // ← 정규화된 배열만
        currentUser: {
          id: session.user.id,
          name: userProfile.full_name,
          role: userProfile.role,
          organization_type: userProfile.organizations?.type || 'other'
        },
        pagination: {
          count: membersWithStats.length,
          hasMore: membersWithStats.length === 100,  // 100명 제한
          limit: 100
        },
        meta: {
          // 클라이언트에서 그룹핑하기 위한 메타데이터
          groupBy: 'organization_type',  // 어떻게 그룹핑할지 힌트
          searchable: true,
          selfExcluded: true
        }
      }
    });

  } catch (error) {
    console.error('[Team Members API Error]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 4.2 검색/필터링 지원

```typescript
// GET /api/team/members?search=김철수&org_type=district_health_center&limit=20&offset=0
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get('search');
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  // 기본 필터 + 검색 조건
  const filter = {
    ...getTeamMemberFilter(userProfile),
    ...(search && {
      OR: [
        { full_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    })
  };

  const members = await prisma.user_profiles.findMany({
    where: filter,
    skip: offset,
    take: limit,
    // ... 나머지 코드
  });
}
```

---

## 5. TeamMemberSelector 컴포넌트 개선

### 5.1 역할별/조직별 그룹핑 (클라이언트)

```typescript
// components/team/TeamMemberSelector.tsx
export function TeamMemberSelector({
  onSelect,
  defaultValue,
  showSelfOption = true,
  showAllTeamOption = true  // NEW
}: TeamMemberSelectorProps) {

  const { data, isLoading, error } = useQuery<TeamMembersResponse>({
    queryKey: ['team-members'],
    queryFn: async () => {
      const res = await fetch('/api/team/members?limit=100');
      if (!res.ok) throw new Error('Failed to fetch team members');
      return res.json();
    }
  });

  const members = data?.data?.members || [];
  const currentUser = data?.data?.currentUser;

  // 클라이언트에서 그룹핑 (API 응답을 정규화하므로)
  const groupedByOrgType = useMemo(() => {
    return members.reduce((acc, member) => {
      const key = member.organization_type;
      if (!acc[key]) acc[key] = [];
      acc[key].push(member);
      return acc;
    }, {} as Record<string, typeof members>);
  }, [members]);

  // 각 조직 타입별 레이블
  const getOrgTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'central': '중앙응급의료센터',
      'provincial': '시도응급의료지원센터',
      'district_health_center': '보건소',
      'ministry': '보건복지부',
      'other': '기타'
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-4">
      <RadioGroup value={selectedId} onValueChange={setSelectedId}>

        {/* 1. 전체 팀원 옵션 (NEW) */}
        {showAllTeamOption && (
          <div className="flex items-center space-x-2 p-3 rounded-lg border-2 border-purple-500 bg-purple-900/20">
            <RadioGroupItem value="all-team" id="all-team" />
            <Label htmlFor="all-team" className="flex-1 cursor-pointer">
              <div className="font-medium text-white">전체 팀원이 접근 가능</div>
              <div className="text-xs text-gray-400">
                {members.length}명의 팀원이 이 일정을 볼 수 있습니다
              </div>
            </Label>
          </div>
        )}

        {/* 2. 본인에게 할당 */}
        {showSelfOption && (
          <div className="flex items-center space-x-2 p-3 rounded-lg border border-gray-700 bg-gray-800/50 hover:bg-gray-700/50">
            <RadioGroupItem value="self" id="self" />
            <Label htmlFor="self" className="flex-1 cursor-pointer">
              <div className="font-medium text-white">본인에게 할당</div>
              <div className="text-xs text-gray-400">
                {currentUser?.name} (직접 점검)
              </div>
              <span className="inline-block mt-1 px-2 py-1 bg-green-900/30 border border-green-500/30 rounded text-xs text-green-400">
                추천
              </span>
            </Label>
          </div>
        )}

        {/* 3. 조직별 팀원 목록 */}
        {Object.entries(groupedByOrgType).map(([orgType, orgMembers]) => (
          <div key={orgType} className="space-y-2">
            {/* 조직 타입 헤더 */}
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-4 px-1">
              {getOrgTypeLabel(orgType)}
            </div>

            {/* 각 팀원 항목 */}
            {orgMembers.map(member => (
              <div
                key={member.id}
                className="flex items-center space-x-2 p-3 rounded-lg border border-gray-700 bg-gray-800/50 hover:bg-gray-700/50"
              >
                <RadioGroupItem value={member.id} id={member.id} />
                <Label htmlFor={member.id} className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between gap-2">
                    {/* 왼쪽: 사용자 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white">{member.full_name}</div>
                      <div className="text-xs text-gray-400 truncate">
                        {member.email}
                      </div>
                      {member.position && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {member.position} · {member.organization_name}
                        </div>
                      )}
                    </div>

                    {/* 오른쪽: 통계 */}
                    <div className="flex items-center gap-3 text-sm ml-4">
                      <div className="text-center">
                        <div className="text-gray-400 text-xs">할당</div>
                        <div className="text-white font-medium">
                          {member.current_assigned}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-400 text-xs">완료</div>
                        <div className="text-green-400 font-medium">
                          {member.completed_this_month}
                        </div>
                      </div>
                    </div>
                  </div>
                </Label>
              </div>
            ))}
          </div>
        ))}
      </RadioGroup>

      {/* 도움말 */}
      <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
        <p className="text-xs text-blue-300">
          <strong>할당 방식:</strong>
        </p>
        <ul className="text-xs text-blue-300 space-y-1 mt-2 ml-4 list-disc">
          <li><strong>본인:</strong> 직접 점검하는 경우</li>
          <li><strong>팀원:</strong> 특정 팀원에게 담당 책임을 넘기는 경우</li>
          <li><strong>전체:</strong> 팀 내 누구나 처리할 수 있도록 공개하는 경우</li>
        </ul>
      </div>
    </div>
  );
}
```

### 5.2 대량 사용자 처리 (페이지네이션)

```typescript
// 사용자가 100명을 초과하는 경우
if (members.length >= 100) {
  return (
    <div className="space-y-4">
      {/* 검색 필드 */}
      <div className="relative">
        <input
          type="text"
          placeholder="팀원 이름, 이메일 검색..."
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* 필터링된 결과 렌더링 */}
      {/* ... RadioGroup 렌더링 ... */}

      {/* 더보기 버튼 */}
      {!searchResults && members.length >= 100 && (
        <button
          onClick={() => setShowMore(true)}
          className="w-full py-2 text-center text-xs text-gray-400 hover:text-gray-300 border border-gray-700 rounded"
        >
          더보기 ({members.length}+ 팀원)
        </button>
      )}
    </div>
  );
}
```

---

## 6. ScheduleModal 개선

### 6.1 첫 번째 단계: 책임 명확화

```typescript
// app/aed-data/components/ScheduleModal.tsx
{step === 'confirm' ? (
  <div className="space-y-6">
    <div>
      <h2 className="text-xl font-semibold text-white mb-3">일정 추가 확인</h2>
      <p className="text-base text-gray-300">
        {isMultiple
          ? `선택한 ${deviceList.length}개의 장비를 일정에 추가하시겠습니까?`
          : '선택한 장비를 일정에 추가하시겠습니까?'}
      </p>
    </div>

    {/* NEW: 할당 방식 설명 */}
    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 space-y-3">
      <p className="text-sm text-blue-300 font-medium">
        다음 단계에서 다음 중 하나를 선택합니다:
      </p>
      <ul className="text-xs text-blue-300 space-y-2 ml-4 list-disc">
        <li>
          <strong>본인:</strong> 직접 점검 담당
        </li>
        <li>
          <strong>팀원:</strong> {' '}
          <span className="text-gray-300">
            해당 팀원에게 할당 (팀원의 대시보드에 표시, 이메일 알림)
          </span>
        </li>
        <li>
          <strong>전체:</strong> {' '}
          <span className="text-gray-300">
            조직의 모든 팀원이 접근 가능 (공동 처리)
          </span>
        </li>
      </ul>
    </div>

    <div className="flex gap-3 justify-center">
      <Button
        onClick={onClose}
        variant="outline"
        className="px-8 py-2"
      >
        취소
      </Button>
      <Button
        onClick={() => setStep('assign-member')}
        className="px-8 py-2 bg-green-600 hover:bg-green-700"
      >
        다음
      </Button>
    </div>
  </div>
) : null}
```

### 6.2 할당 처리 로직 (assignment_scope 반영)

```typescript
const handleAssignAndCreate = async () => {
  setIsSubmitting(true);

  try {
    const equipmentSerials = deviceList
      .map(d => d.equipment_serial)
      .filter(Boolean);

    // assignedToUserId 값 분석
    let assignmentScope: 'assigned' | 'all_team' | 'unassigned' = 'unassigned';
    let assignedToValue: string | null = null;

    if (assignedToUserId === 'all-team') {
      assignmentScope = 'all_team';
      assignedToValue = null;
    } else if (assignedToUserId === 'self' || assignedToUserId === null) {
      assignmentScope = 'assigned';
      assignedToValue = null;  // null = 현재 사용자
    } else {
      assignmentScope = 'assigned';
      assignedToValue = assignedToUserId;
    }

    const response = await fetch('/api/inspections/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        equipmentSerials,
        assignedTo: assignedToValue,
        assignmentScope,  // NEW
        scheduledDate: new Date().toISOString().split('T')[0],
        scheduledTime: null,
        assignmentType: 'scheduled',
        priorityLevel: 0,
        notes: getAssignmentNote(assignmentScope, assignedToValue)
      })
    });

    // ... 나머지 처리
  } finally {
    setIsSubmitting(false);
  }
};

function getAssignmentNote(scope: string, assignedTo: string | null): string {
  switch (scope) {
    case 'all_team':
      return '전체 팀원 할당';
    case 'assigned':
      return assignedTo ? `팀원 할당: ${assignedTo}` : '본인 할당';
    default:
      return '일정 추가';
  }
}
```

---

## 7. API: /api/inspections/assignments 개선

```typescript
// app/api/inspections/assignments/route.ts
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      equipmentSerials,
      assignedTo,
      assignmentScope,  // NEW
      scheduledDate,
      notes
    } = body;

    // 권한 검증: assignedTo가 현재 사용자가 할당 가능한 범위인지 확인
    if (assignedTo) {
      const targetUser = await prisma.user_profiles.findUnique({
        where: { id: assignedTo },
        include: { organizations: true }
      });

      if (!targetUser) {
        return NextResponse.json(
          { error: 'Target user not found' },
          { status: 404 }
        );
      }

      // 권한 검증: 같은 지역인지, 조직 계층이 맞는지 확인
      if (!canAssignToUser(session.user.id, assignedTo)) {
        return NextResponse.json(
          { error: 'Forbidden: Cannot assign to this user' },
          { status: 403 }
        );
      }
    }

    // 일괄 할당
    const created: string[] = [];
    const errors: string[] = [];

    for (const serial of equipmentSerials) {
      try {
        // 이미 할당되었는지 확인
        const existing = await prisma.inspection_assignments.findFirst({
          where: {
            equipment_serial: serial,
            status: { in: ['pending', 'in_progress'] }
          }
        });

        if (existing) {
          errors.push(serial);
          continue;
        }

        // 새 할당 생성
        await prisma.inspection_assignments.create({
          data: {
            equipment_serial: serial,
            assigned_to: assignedTo || undefined,
            assigned_by: session.user.id,
            assignment_scope: assignmentScope || 'assigned',  // NEW
            status: 'pending',
            scheduled_date: scheduledDate,
            notes
          }
        });

        created.push(serial);
      } catch (err) {
        errors.push(serial);
      }
    }

    // 응답
    if (created.length === 0) {
      return NextResponse.json(
        {
          error: '할당 실패',
          stats: { created: 0, skipped: errors.length }
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      stats: {
        created: created.length,
        skipped: errors.length,
        errors: errors.slice(0, 10)  // 최대 10개 에러만 반환
      }
    });

  } catch (error) {
    console.error('[Assignments API Error]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## 8. 이중 관점 필터링 구현

### 8.1 "일정관리" 메뉴 (관리자 뷰)

```typescript
// app/aed-data/page.tsx - "추가된목록" 탭
// 모든 inspection_assignments 표시 (자신이 만든 것)
const scheduledItems = inspectionAssignments.where(
  ia => ia.assigned_by === session.user.id  // 자신이 할당한 모든 것
);

// 렌더링
{scheduledItems.map(item => (
  <tr key={item.id}>
    <td>{item.assignment_info?.assigned_by_name}</td>  // 추가자
    <td>{renderAssignmentTarget(item)}</td>  // 담당자 (표시 방식은 아래 참조)
    <td>{item.assignment_info?.created_at}</td>
  </tr>
))}

function renderAssignmentTarget(item: AssignmentInfo): string {
  switch (item.assignment_scope) {
    case 'all_team':
      return '전체';  // ← NEW: 명확한 표시
    case 'assigned':
      return item.assigned_to_name || '미할당';
    case 'unassigned':
      return '미할당';
    default:
      return '미지정';
  }
}
```

### 8.2 "현장점검" 메뉴 (작업자 뷰)

```typescript
// app/inspection/page.tsx
// 현재 사용자에게 할당된 것만 표시
const myItems = inspectionAssignments.where(ia => {
  // 경우 1: 본인에게 명시적 할당
  if (ia.assigned_to === session.user.id && ia.assignment_scope === 'assigned') {
    return true;
  }

  // 경우 2: "전체" 할당된 것 (모든 팀원이 접근 가능)
  if (ia.assignment_scope === 'all_team') {
    return true;
  }

  // 경우 3: 미할당인 것 (선택 사항: 포함하거나 제외)
  // return ia.assignment_scope === 'unassigned';

  return false;
});
```

---

## 9. 데이터베이스 마이그레이션

### 9.1 스키마 변경

```prisma
// prisma/schema.prisma

// NEW enum 추가
enum assignment_scope {
  assigned      // 특정 사용자 할당
  all_team      // 전체 팀원 할당
  unassigned    // 미할당 (초기 상태)
}

// inspection_assignments 확장
model inspection_assignments {
  // ... 기존 필드 ...

  // NEW: 할당 범위 명확화
  assignment_scope    assignment_scope @default("assigned")

  // 기존 인덱스 유지
  @@index([assigned_to, status, scheduled_date(sort: Desc)], map: "idx_assignments_user_status")

  // NEW: assignment_scope 기반 쿼리 최적화
  @@index([assignment_scope], map: "idx_inspection_assignments_scope")
  @@index([assigned_to, assignment_scope, status], map: "idx_assignments_scope_status")
}

// user_profiles 인덱스 개선
model user_profiles {
  // ... 기존 필드 ...

  // NEW: 팀원 필터링 쿼리 최적화
  @@index([region_code, is_active, approved_by], map: "idx_user_profiles_region_active_approved")
  @@index([district, is_active, approved_by], map: "idx_user_profiles_district_active_approved")
  @@index([organization_id, is_active, role], map: "idx_user_profiles_org_active_role")
}
```

### 9.2 마이그레이션 스크립트

```bash
# prisma/migrations/[timestamp]_add_assignment_scope/migration.sql
ALTER TABLE inspection_assignments ADD COLUMN assignment_scope VARCHAR(20) DEFAULT 'assigned';
ALTER TABLE inspection_assignments ADD CONSTRAINT ck_assignment_scope
  CHECK (assignment_scope IN ('assigned', 'all_team', 'unassigned'));

CREATE INDEX idx_inspection_assignments_scope
  ON inspection_assignments(assignment_scope);
CREATE INDEX idx_assignments_scope_status
  ON inspection_assignments(assigned_to, assignment_scope, status);

CREATE INDEX idx_user_profiles_region_active_approved
  ON user_profiles(region_code, is_active, approved_by);
CREATE INDEX idx_user_profiles_district_active_approved
  ON user_profiles(district, is_active, approved_by);
CREATE INDEX idx_user_profiles_org_active_role
  ON user_profiles(organization_id, is_active, role);
```

### 9.3 데이터 마이그레이션

```typescript
// scripts/migrations/add_assignment_scope.ts
async function migrateAssignmentScope() {
  // assigned_to가 null이 아닌 모든 레코드 → 'assigned'
  await prisma.inspection_assignments.updateMany({
    where: { assigned_to: { not: null } },
    data: { assignment_scope: 'assigned' }
  });

  // assigned_to가 null인 모든 레코드 → 'unassigned' (나중에 'all_team'으로 수동 업데이트)
  await prisma.inspection_assignments.updateMany({
    where: { assigned_to: null },
    data: { assignment_scope: 'unassigned' }
  });

  console.log('✅ Assignment scope migration complete');
}
```

---

## 10. 포괄적 테스트 전략

### 10.1 행복 경로 테스트

```typescript
// __tests__/api/team-members.test.ts
describe('GET /api/team/members', () => {

  it('중앙 권한: 전국 팀원 조회', async () => {
    const { members } = await getTeamMembers('central-user');
    expect(members.length).toBeGreaterThan(0);
    expect(members.map(m => m.region_code)).toContain('DAE');
    expect(members.map(m => m.region_code)).toContain('SEO');
  });

  it('시도 권한: 같은 시도 팀원만 조회', async () => {
    const { members } = await getTeamMembers('daegu-provincial-user');
    expect(members.every(m => m.region_code === 'DAE')).toBe(true);
  });

  it('보건소 권한: 같은 구군 팀원만 조회', async () => {
    const { members } = await getTeamMembers('daegu-jung-health-center-user');
    expect(members.every(m =>
      m.region_code === 'DAE' && m.district === '중구'
    )).toBe(true);
  });

  it('자신은 제외됨', async () => {
    const { members, currentUser } = await getTeamMembers('any-user');
    expect(members.map(m => m.id)).not.toContain(currentUser.id);
  });

  it('승인되지 않은 사용자 제외', async () => {
    const { members } = await getTeamMembers('central-user');
    expect(members.every(m => m.approved_by !== null)).toBe(true);
  });
});
```

### 10.2 Edge Case 테스트

```typescript
describe('Edge Cases', () => {

  it('권한 없는 사용자: 팀원 목록 비어있음', async () => {
    const { members } = await getTeamMembers('no-permission-user');
    expect(members.length).toBe(0);
  });

  it('조직이 없는 사용자: 에러 반환', async () => {
    const response = await getTeamMembers('no-org-user');
    expect(response.status).toBe(404);
  });

  it('대량 사용자(100명+): 페이지네이션 작동', async () => {
    const { members, pagination } = await getTeamMembers('high-user-count-region');
    expect(members.length).toBe(100);
    expect(pagination.hasMore).toBe(true);
  });

  it('검색 필터: 이름 기반 검색', async () => {
    const { members } = await getTeamMembers('central-user', { search: '김철수' });
    expect(members.every(m =>
      m.full_name.includes('김철수') || m.email.includes('김철수')
    )).toBe(true);
  });
});
```

### 10.3 할당 권한 테스트

```typescript
describe('POST /api/inspections/assignments', () => {

  it('다른 지역 사용자에게 할당 시도: 403 Forbidden', async () => {
    const response = await assignTo('daegu-user', 'seoul-user-id');
    expect(response.status).toBe(403);
  });

  it('승인되지 않은 사용자에게 할당 시도: 404 Not Found', async () => {
    const response = await assignTo('central-user', 'pending-approval-user-id');
    expect(response.status).toBe(404);
  });

  it('assignment_scope = "all_team": 할당 생성', async () => {
    const result = await createAssignment({
      equipmentSerials: ['ABC123'],
      assignedTo: null,
      assignmentScope: 'all_team'
    });
    expect(result.stats.created).toBe(1);

    const record = await getAssignmentRecord('ABC123');
    expect(record.assignment_scope).toBe('all_team');
  });

  it('중복 할당 시: 409 Conflict', async () => {
    await createAssignment({ equipmentSerials: ['ABC123'] });
    const response = await createAssignment({ equipmentSerials: ['ABC123'] });
    expect(response.status).toBe(409);
  });
});
```

### 10.4 UI 통합 테스트

```typescript
describe('ScheduleModal Flow', () => {

  it('전체 팀원 선택 시 assignment_scope = all_team', async () => {
    render(<ScheduleModal devices={[aedDevice]} />);

    // Step 1: 확인
    fireEvent.click(screen.getByText('다음'));

    // Step 2: 전체 선택
    fireEvent.click(screen.getByLabelText('전체 팀원이 접근 가능'));
    fireEvent.click(screen.getByText('일정 추가'));

    // 검증: API 호출 확인
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/inspections/assignments',
        expect.objectContaining({
          body: expect.stringContaining('"assignmentScope":"all_team"')
        })
      );
    });
  });

  it('팀원 선택 시 assigned_to 설정', async () => {
    render(<ScheduleModal devices={[aedDevice]} />);
    fireEvent.click(screen.getByText('다음'));

    // 팀원 선택
    const memberRadio = screen.getByLabelText(/김철수/);
    fireEvent.click(memberRadio);
    fireEvent.click(screen.getByText('일정 추가'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/inspections/assignments',
        expect.objectContaining({
          body: expect.stringContaining('assignedTo')
        })
      );
    });
  });
});
```

### 10.5 이중 관점 테스트

```typescript
describe('Dual View (일정관리 vs 현장점검)', () => {

  it('관리자: 자신이 할당한 모든 일정 조회', async () => {
    const result = await getScheduledItems('admin-user', { view: 'management' });
    expect(result.items.every(i => i.assigned_by === 'admin-user')).toBe(true);
  });

  it('작업자: 본인에게 할당된 것만 조회', async () => {
    const result = await getScheduledItems('worker-user', { view: 'worker' });
    expect(result.items.every(i =>
      i.assigned_to === 'worker-user' || i.assignment_scope === 'all_team'
    )).toBe(true);
  });

  it('전체 할당된 항목: 모든 팀원이 조회 가능', async () => {
    const all_team_item = await createAssignment({
      assignmentScope: 'all_team'
    });

    const workerView = await getScheduledItems('any-worker', { view: 'worker' });
    expect(workerView.items.map(i => i.id)).toContain(all_team_item.id);
  });
});
```

---

## 11. 구현 계획 (상세 체크리스트)

### Phase 0: 사전 준비 (Day 0-1)

**Target: DB 검증 및 위험요소 제거, 마이그레이션 안전성 확보**

#### 0.1 user_profiles 필수값 검증

**Timeline: Day 0 | Effort: 1.5h | Risk: Medium**

- [ ] **NOT NULL 제약 확인**
  ```sql
  -- 각 컬럼별 NULL 카운트 확인
  SELECT
    COUNT(CASE WHEN organization_id IS NULL THEN 1 END) as null_org,
    COUNT(CASE WHEN region_code IS NULL THEN 1 END) as null_region,
    COUNT(CASE WHEN district IS NULL THEN 1 END) as null_district
  FROM user_profiles
  WHERE is_active = true AND approved_by IS NOT NULL;
  ```

- [ ] **NULL이 있는 경우 데이터 정제**
  - [ ] organization_id NULL: 사용자 승인 거부 또는 organization 할당
  - [ ] region_code NULL: CLAUDE.md 권한 규칙으로 역계산 (조직 타입 기반)
  - [ ] district NULL: 보건소 사용자 중 NULL은 사전에 수정

- [ ] **스키마 수정** (Prisma)
  ```prisma
  model user_profiles {
    organization_id String @db.Uuid  // NOT NULL로 변경 (조건부)
    region_code String?  // 보건소가 아닌 사용자는 NOT NULL
    district String?     // 보건소 사용자는 NOT NULL
  }
  ```

---

#### 0.2 team_members 사용처 감사

**Timeline: Day 0 | Effort: 1h | Risk: Low**

- [ ] **코드베이스 검색**
  ```bash
  grep -r "team_members" --include="*.ts" --include="*.tsx" app/
  grep -r "TeamMembers" --include="*.ts" --include="*.tsx" lib/
  ```

- [ ] **발견된 사용처 문서화**
  - [ ] API 엔드포인트 (현재: /api/team/members)
  - [ ] 데이터베이스 배치 작업
  - [ ] 대시보드/리포트
  - [ ] 기타 쿼리

- [ ] **폐기 전략 수립**
  - [ ] 사용처 없으면: Phase 3 후 폐기 계획
  - [ ] 사용처 있으면: 뷰(View) 또는 동기화 로직 유지

---

#### 0.3 기존 inspection_assignments 데이터 감사

**Timeline: Day 0-1 | Effort: 1.5h | Risk: Low**

- [ ] **assigned_to = NULL 레코드 현황**
  ```sql
  SELECT COUNT(*) as null_assigned_to,
         COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress')) as active_null,
         COUNT(*) FILTER (WHERE status = 'completed') as completed_null
  FROM inspection_assignments
  WHERE assigned_to IS NULL;
  ```

- [ ] **completed 상태 중복 할당 확인**
  ```sql
  SELECT equipment_serial, COUNT(*) as assignment_count
  FROM inspection_assignments
  WHERE status = 'completed'
  GROUP BY equipment_serial
  HAVING COUNT(*) > 1;
  ```

- [ ] **결과 판단**
  - [ ] NULL 레코드 < 10: 수동 정리 가능
  - [ ] NULL 레코드 > 10: 자동화된 정리 스크립트 필요
  - [ ] completed 중복: 비즈니스 정책 확인 (재할당 허용 여부)

---

#### Phase 0 체크아웃

- [ ] user_profiles NULL 데이터 정제 완료
- [ ] team_members 사용처 문서화 완료
- [ ] inspection_assignments 데이터 감사 완료
- [ ] 마이그레이션 스크립트 준비 완료

**Estimate: 4 hours | Owner: Backend/DBA**

---

### Phase 1: 스키마 및 백엔드 (Week 1)

**Target: 모든 백엔드 로직 완성, 로컬 테스트 통과**

#### 1.1 Prisma 마이그레이션 작업

**Timeline: Day 1-2 | Effort: 2h | Risk: Low**

- [ ] **assignment_scope enum 추가**
  - [ ] `prisma/schema.prisma`에 enum 정의
    ```prisma
    enum assignment_scope {
      assigned
      all_team
      unassigned
    }
    ```
  - [ ] 파일 검증: `npm run prisma:validate`

- [ ] **inspection_assignments 모델 확장**
  - [ ] `assignment_scope` 필드 추가 (기본값: "assigned")
  - [ ] `@@index([assignment_scope])` 추가
  - [ ] `@@index([assigned_to, assignment_scope, status])` 추가

- [ ] **user_profiles 모델 인덱스 강화**
  - [ ] `@@index([region_code, is_active, approved_by])` 추가 (권한 필터)
  - [ ] `@@index([district, is_active, approved_by])` 추가 (보건소 필터)
  - [ ] `@@index([organization_id, is_active, role])` 추가 (조직 필터)
  - [ ] **Trigram 인덱스** (검색 성능 500ms SLA): 마이그레이션 SQL로 직접 생성
    ```sql
    CREATE INDEX idx_user_profiles_full_name_trigram ON user_profiles
      USING GIN (full_name gin_trgm_ops);
    CREATE INDEX idx_user_profiles_email_trigram ON user_profiles
      USING GIN (email gin_trgm_ops);
    ```

- [ ] **마이그레이션 파일 생성**
  ```bash
  npx prisma migrate dev --name add_assignment_scope
  ```
  - [ ] 마이그레이션 스크립트 검토 (`prisma/migrations/*/migration.sql`)
  - [ ] 기존 데이터 마이그레이션:
    - [ ] `assigned_to IS NOT NULL` → `assignment_scope = 'assigned'`
    - [ ] `assigned_to IS NULL` → `assignment_scope = 'unassigned'`

- [ ] **Prisma Client 재생성**
  ```bash
  npx prisma generate
  ```

- [ ] **마이그레이션 로컬 테스트**
  - [ ] 로컬 DB에서 새 필드 확인: `SELECT assignment_scope FROM inspection_assignments LIMIT 1`
  - [ ] 인덱스 생성 확인: `SELECT indexname FROM pg_indexes WHERE tablename = 'inspection_assignments'`

---

#### 1.2 권한 유틸 구현

**Timeline: Day 2-3 | Effort: 3h | Risk: Medium**

- [ ] **`lib/utils/team-authorization.ts` 파일 생성**
  - [ ] 인터페이스 정의
    ```typescript
    interface UserPermissions {
      canViewTeamMembers: boolean;
      viewScope: 'all' | 'region' | 'district' | 'self';
      canAssignTo: (targetUserId: string) => Promise<boolean>;
    }
    ```

  - [ ] `getTeamMemberFilter()` 함수 구현
    - [ ] 중앙 사용자: 제한 없음
    - [ ] 시도 사용자: 같은 region_code만
    - [ ] 보건소 사용자: 같은 region_code + district
    - [ ] 보건복지부: 제한 없음
    - [ ] 기본값: 권한 없음 (빈 배열)

  - [ ] `canAssignToUser()` 함수 구현 (조직 타입 분기 필수)
    ```typescript
    // 중앙/보건복지부: 전국 할당 가능 (승인 여부만 확인)
    if (['central', 'ministry'].includes(current.organization.type)) {
      return isApprovedUser(target);  // 지역 제약 X
    }

    // 시도/보건소: 같은 지역만
    if (current.region_code !== target.region_code) {
      return false;
    }

    // 보건소: 같은 구군만
    if (current.organization.type === 'district_health_center' &&
        current.district !== target.district) {
      return false;
    }

    return isApprovedUser(target);
    ```
    - [ ] 승인 상태 확인 (approved_by, !account_locked, rejection_count < 3)

  - [ ] `getOrganizationType()` 헬퍼 함수
  - [ ] `isApprovedUser()` 헬퍼 함수

- [ ] **단위 테스트 작성** (`lib/utils/__tests__/team-authorization.test.ts`)
  - [ ] `getTeamMemberFilter()`: 중앙/시도/보건소 권한별 테스트
  - [ ] `canAssignToUser()`:
    - [ ] 같은 지역 ✅
    - [ ] 다른 지역 ❌
    - [ ] 미승인 사용자 ❌
    - [ ] 잠긴 계정 ❌
  - [ ] `npm test -- team-authorization.test.ts` 통과 확인

---

#### 1.3 /api/team/members 재작성

**Timeline: Day 3-4 | Effort: 4h | Risk: Medium**

- [ ] **기존 API 백업**
  - [ ] `app/api/team/members/route.ts.bak` 파일 생성

- [ ] **쿼리 최적화: N+1 제거**
  - [ ] `user_profiles` 모델 `include`로 `organizations` 로드
  - [ ] 할당 통계를 `groupBy`로 배치 처리
  - [ ] 완료 통계를 별도 `groupBy`로 배치 처리
  - [ ] 성능 확인: Prisma Studio에서 쿼리 수 < 3

- [ ] **권한 기반 필터링 적용**
  - [ ] `getTeamMemberFilter()` 호출
  - [ ] `approval_notifications` 제외하기
  - [ ] `account_locked = false` 조건 추가

- [ ] **페이지네이션 구현**
  - [ ] 쿼리 파라미터: `limit`, `offset`
  - [ ] 기본값: `limit=100`
  - [ ] 응답에 `pagination` 객체 추가:
    ```typescript
    pagination: {
      count: number,
      hasMore: boolean,
      limit: number,
      offset: number
    }
    ```

- [ ] **검색 필터 구현**
  - [ ] 쿼리 파라미터: `search`
  - [ ] 검색 대상: `full_name`, `email` (case-insensitive)
  - [ ] 검색 없으면 전체 조회

- [ ] **응답 정규화**
  - [ ] `members` 배열만 반환 (그룹핑은 클라이언트에서)
  - [ ] `currentUser` 메타데이터 포함
  - [ ] `meta.groupBy = 'organization_type'` 힌트 추가

- [ ] **로깅 추가**
  ```typescript
  logger.info('TeamMembersAPI', {
    userId: session.user.id,
    membersCount: members.length,
    filterApplied: filter // 디버깅용
  });
  ```

- [ ] **API 테스트** (Postman/curl)
  - [ ] `GET /api/team/members` (기본)
  - [ ] `GET /api/team/members?search=김철수`
  - [ ] `GET /api/team/members?limit=20&offset=0`
  - [ ] 응답 시간 < 500ms 확인

---

#### 1.4 /api/inspections/assignments 강화

**Timeline: Day 4 | Effort: 3h | Risk: High**

- [ ] **요청 바디 확장 및 입력 검증**
  - [ ] `assignmentScope` 파라미터 추가 (기본값: 'assigned')
  - [ ] 검증 1: `['assigned', 'all_team', 'unassigned']` 중 하나
  - [ ] **검증 2: 조합 검증** (애플리케이션 레벨)
    ```typescript
    if (assignmentScope === 'assigned' && !assignedTo) {
      // 본인 할당으로 해석 → OK
      assignedTo = null;  // 현재 사용자 자동 설정
    } else if (assignmentScope === 'all_team' && assignedTo) {
      return 400;  // 모순: 전체 할당인데 특정 사용자?
    } else if (assignmentScope === 'all_team' && !assignedTo) {
      // OK: 전체 할당
    }
    ```

- [ ] **권한 검증 강화**
  - [ ] `canAssignToUser()` 호출
  - [ ] 403 응답: 권한 없음
  - [ ] 404 응답: 사용자 없음
  - [ ] 감사 로깅: 권한 위반 시도 (보안)

- [ ] **데이터 저장 로직**
  - [ ] `assignment_scope` 필드에 값 저장
  - [ ] `assignmentScope = 'all_team'` 시: `assigned_to = null`
  - [ ] `assignmentScope = 'assigned'` 시: `assigned_to = assignedTo || null`

- [ ] **중복 할당 방지** (completed 상태 포함)
  - [ ] **비즈니스 정책**: completed 상태는 "이미 점검 완료" → 재할당 불가
  - [ ] 업데이트된 로직:
    ```typescript
    const existing = await prisma.inspection_assignments.findFirst({
      where: {
        equipment_serial: serial,
        status: { in: ['pending', 'in_progress', 'completed'] },  // completed 추가
        assignment_scope: { not: 'unassigned' }
      }
    });

    if (existing) {
      errors.push(serial);  // 이미 할당됨
      continue;
    }
    ```

- [ ] **감사 로깅**
  ```typescript
  logger.warn('AssignmentAuthorizationDenied', {
    user_id: session.user.id,
    target_user_id: assignedTo,
    reason: 'Cross-organization assignment',
    timestamp: new Date()
  });
  ```

- [ ] **에러 응답 개선**
  - [ ] 409 Conflict: 이미 할당됨 (stats 포함)
  - [ ] 403 Forbidden: 권한 없음
  - [ ] 400 Bad Request: 잘못된 assignment_scope
  - [ ] 500 Internal Server Error: 기타

- [ ] **API 테스트**
  - [ ] `POST /api/inspections/assignments` (기본)
  - [ ] `assignmentScope = 'all_team'` 요청
  - [ ] 교차 조직 할당 차단 확인 (403)
  - [ ] 미승인 사용자 할당 차단 확인 (404)

---

#### Phase 1 체크아웃

- [ ] `npm run tsc` 통과 (TypeScript 오류 없음)
- [ ] `npm run lint` 통과 (코드 스타일)
- [ ] `npm run build` 성공 (프로덕션 빌드)
- [ ] DB 마이그레이션 성공 (로컬)
- [ ] API 권한 테스트 수동으로 통과
- [ ] 성능 메트릭: `/api/team/members` < 500ms

**Estimate: 12 hours | Owner: Backend**

---

### Phase 2: 프론트엔드 (Week 2)

**Target: UI 컴포넌트 완성, 로컬 통합 테스트 통과**

#### 2.1 TeamMemberSelector 컴포넌트 개선

**Timeline: Day 5-6 | Effort: 3h | Risk: Medium**

- [ ] **현재 코드 분석**
  - [ ] `components/team/TeamMemberSelector.tsx` 검토
  - [ ] 기존 UI 구조 파악 (RadioGroup 기반)

- [ ] **"전체 팀원" 옵션 추가**
  - [ ] `showAllTeamOption` prop 추가
  - [ ] RadioGroup에 "all-team" 옵션 추가
  - [ ] 스타일: border-purple-500, bg-purple-900/20
  - [ ] 설명: "{count}명의 팀원이 이 일정을 볼 수 있습니다"

- [ ] **역할→조직 그룹핑 변경 (클라이언트)**
  - [ ] `groupedByOrgType` useMemo 추가
  - [ ] 조직 타입별 정렬: central > provincial > district_health_center > ministry
  - [ ] 각 조직 그룹 헤더 렌더링

- [ ] **조직 타입 배지 추가**
  - [ ] `getOrgTypeLabel()` 함수
    - [ ] 'central' → '중앙응급의료센터'
    - [ ] 'provincial' → '시도응급의료지원센터'
    - [ ] 'district_health_center' → '보건소'
    - [ ] 'ministry' → '보건복지부'
  - [ ] 각 팀원 항목에 조직명/위치 표시

- [ ] **검색 및 더보기 기능**
  - [ ] 100명 이상일 경우 검색 필드 표시
  - [ ] `search` state 추가
  - [ ] 입력창: placeholder "팀원 이름, 이메일 검색..."
  - [ ] 필터링 로직: `includes()` (클라이언트) 또는 API 호출 (선택)
  - [ ] "더보기" 버튼: 추가 사용자 로드

- [ ] **통계 정보 유지**
  - [ ] `current_assigned`: 할당된 일정 수
  - [ ] `completed_this_month`: 이번 달 완료 수
  - [ ] 오른쪽 정렬 표시

- [ ] **도움말 카드 개선**
  - [ ] 세 가지 할당 방식 설명
  - [ ] 본인: 직접 점검하는 경우
  - [ ] 팀원: 특정 팀원에게 책임 넘기기
  - [ ] 전체: 팀 내 누구나 처리 가능

- [ ] **접근성 개선**
  - [ ] Label htmlFor 연결 확인
  - [ ] ARIA labels 추가 (검색 필드 등)

- [ ] **컴포넌트 테스트**
  - [ ] "본인에게 할당" 렌더링 확인
  - [ ] 100명 미만: 검색 필드 없음
  - [ ] 100명 이상: 검색 필드 표시
  - [ ] 조직별 그룹핑 확인
  - [ ] "전체 팀원" 선택 가능 확인

---

#### 2.2 ScheduleModal 첫 단계 개선

**Timeline: Day 6 | Effort: 2h | Risk: Low**

- [ ] **확인 메시지 개선**
  - [ ] 기존 메시지 유지 (선택 장비 수)
  - [ ] 추가: 안내 카드 (bg-blue-900/20)

- [ ] **안내 카드 내용**
  ```
  "다음 단계에서 다음 중 하나를 선택합니다:"
  • 본인: 직접 점검 담당
  • 팀원: 해당 팀원에게 할당 (팀원의 대시보드에 표시, 이메일 알림)
  • 전체: 조직의 모든 팀원이 접근 가능 (공동 처리)
  ```

- [ ] **상태 관리: assignedToUserId**
  - [ ] 'self' | 'all-team' | UUID 구분
  - [ ] 초기값: null (다음 단계 진행 시 명시)

- [ ] **단계 전환 상태 관리 검증**
  - [ ] step = 'confirm' 시 안내 카드 표시
  - [ ] "다음" 클릭 → step = 'assign-member'로 전환
  - [ ] "이전" 클릭 → step = 'confirm'로 돌아가기

- [ ] **모달 테스트**
  - [ ] 안내 카드 렌더링 확인
  - [ ] "다음" 클릭 → TeamMemberSelector 표시 확인
  - [ ] "이전" 클릭 → 첫 단계로 돌아가기 확인

---

#### 2.3 AssignmentScope 처리 로직 추가

**Timeline: Day 6 | Effort: 2h | Risk: Medium**

- [ ] **assignedToUserId 분석 함수** (`ScheduleModal.tsx`)
  ```typescript
  function analyzeAssignment(value: string | null) {
    if (value === 'all-team') {
      return { scope: 'all_team', assignedTo: null };
    } else if (value === 'self' || value === null) {
      return { scope: 'assigned', assignedTo: null };
    } else {
      return { scope: 'assigned', assignedTo: value };
    }
  }
  ```

- [ ] **API 호출 수정**
  ```typescript
  const { scope, assignedTo } = analyzeAssignment(assignedToUserId);

  const response = await fetch('/api/inspections/assignments', {
    method: 'POST',
    body: JSON.stringify({
      equipmentSerials,
      assignedTo,
      assignmentScope: scope,  // NEW
      // ... 기타 필드
    })
  });
  ```

- [ ] **테스트**
  - [ ] "본인" 선택 → scope='assigned', assignedTo=null
  - [ ] "팀원" 선택 → scope='assigned', assignedTo={userId}
  - [ ] "전체" 선택 → scope='all_team', assignedTo=null

---

#### 2.4 AdminFullView 개선

**Timeline: Day 7 | Effort: 2h | Risk: Low**

- [ ] **현재 상태 분석**
  - [ ] "추가된목록" 탭 확인
  - [ ] 기존 필드: 추가일시, 추가자, 담당 (이미 구현됨)

- [ ] **assignment_scope 반영**
  - [ ] `renderAssignmentTarget()` 함수 생성
    ```typescript
    function renderAssignmentTarget(item): string {
      switch (item.assignment_scope) {
        case 'all_team': return '전체';
        case 'assigned': return item.assigned_to_name || '미할당';
        case 'unassigned': return '미할당';
        default: return '미지정';
      }
    }
    ```

  - [ ] 담당 열 렌더링 시 함수 적용
  - [ ] "전체" 표시 시 다른 스타일 (배경색 다르게)

- [ ] **필터링 로직 유지**
  - [ ] 기존 필터 (본인이 할당한 것) 유지
  - [ ] assignment_scope 추가 필터는 아직 미적용 (향후)

- [ ] **테스트**
  - [ ] assignment_scope='assigned' → 사용자명 표시
  - [ ] assignment_scope='all_team' → '전체' 표시
  - [ ] 스타일 확인

---

#### 2.5 InspectionList 개선 (현장점검)

**Timeline: Day 7 | Effort: 2h | Risk: Medium**

- [ ] **현재 위치 파악**
  - [ ] `app/inspection/` 디렉토리 구조 확인
  - [ ] 현재 필터링 로직 분석

- [ ] **이중 관점 필터링 구현**
  ```typescript
  // 현장점검: 본인 + "전체" 할당만 표시
  const myItems = inspectionAssignments.filter(ia => {
    // 경우 1: 본인에게 명시적 할당
    if (ia.assigned_to === session.user.id &&
        ia.assignment_scope === 'assigned') {
      return true;
    }
    // 경우 2: 전체 할당 (모든 팀원 접근)
    if (ia.assignment_scope === 'all_team') {
      return true;
    }
    return false;
  });
  ```

- [ ] **UI 표시 개선**
  - [ ] "전체 할당" 항목에 배지 추가 (Badge: "팀 할당")
  - [ ] 할당자 정보 표시 (누가 할당했는가)

- [ ] **테스트**
  - [ ] 본인 할당 항목 표시 ✅
  - [ ] "전체 할당" 항목 표시 ✅
  - [ ] 다른 사용자에게 할당된 항목 숨김 ✅
  - [ ] 미할당 항목 처리 확인

---

#### Phase 2 체크아웃

- [ ] `npm run tsc` 통과
- [ ] `npm run lint` 통과
- [ ] `npm run build` 성공
- [ ] 모든 컴포넌트 로컬 렌더링 테스트 통과
- [ ] 브라우저 개발자 도구에서 에러 없음
- [ ] TeamMemberSelector: 팀원 목록 표시
- [ ] ScheduleModal: 3단계 흐름 완성
- [ ] 데이터 API 호출 성공 (Network 탭)

**Estimate: 11 hours | Owner: Frontend**

---

### Phase 3: 테스트 및 배포 (Week 3)

**Target: 배포 준비 완료, 프로덕션 배포**

#### 3.1 자동화 테스트 작성

**Timeline: Day 8-9 | Effort: 5h | Risk: Medium**

- [ ] **API 권한 테스트** (`__tests__/api/team-members.permission.test.ts`)
  - [ ] 중앙 사용자: 전국 팀원 조회
  - [ ] 시도 사용자: 같은 시도만
  - [ ] 보건소 사용자: 같은 구군만
  - [ ] 자신 제외 확인
  - [ ] 미승인 사용자 제외 확인

- [ ] **API 검색/페이지네이션 테스트**
  - [ ] `?search=김철수` 필터링
  - [ ] `?limit=20&offset=0` 페이지네이션
  - [ ] `hasMore` 플래그 정확성
  - [ ] 응답 시간 < 500ms

- [ ] **assignment_scope 생성 테스트**
  - [ ] `scope='assigned'`: assignment_scope 저장됨
  - [ ] `scope='all_team'`: assignment_scope 저장, assigned_to=null
  - [ ] `scope='unassigned'`: assignment_scope 저장

- [ ] **assignment_scope 조회 테스트**
  - [ ] "일정관리": 모든 할당 항목 조회 (자신이 할당한 것)
  - [ ] "현장점검": 본인+전체 할당만 조회
  - [ ] 필터링 로직 정확성

- [ ] **권한 위반 테스트**
  - [ ] 교차 조직 할당: 403
  - [ ] 미승인 사용자 할당: 404
  - [ ] 이미 할당된 장비: 409

- [ ] **프론트엔드 컴포넌트 테스트** (`__tests__/components/TeamMemberSelector.test.tsx`)
  - [ ] 렌더링: 팀원 목록 표시
  - [ ] "본인에게 할당" 옵션 표시
  - [ ] "전체 팀원" 옵션 표시
  - [ ] 조직별 그룹핑
  - [ ] 검색 필터 작동
  - [ ] 라디오 선택 이벤트

- [ ] **ScheduleModal 테스트**
  - [ ] Step 1: 안내 카드 표시
  - [ ] Step 1→2: "다음" 클릭 전환
  - [ ] Step 2: TeamMemberSelector 렌더링
  - [ ] "전체 팀원" 선택 시 API 호출 검증
  - [ ] Step 3: 성공/점검 시작 옵션

- [ ] **테스트 실행**
  ```bash
  npm run test -- __tests__/api/team-members
  npm run test -- __tests__/api/assignments
  npm run test -- __tests__/components/TeamMemberSelector
  npm run test -- __tests__/components/ScheduleModal
  ```
  - [ ] 모든 테스트 통과
  - [ ] 커버리지: > 80%

---

#### 3.2 수동 테스트 시나리오

**Timeline: Day 9-10 | Effort: 4h | Risk: High**

**준비 사항**:
- [ ] 3개 테스트 계정 준비
  - [ ] 중앙 (truth0530@nmc.or.kr)
  - [ ] 시도 (시도응급의료지원센터)
  - [ ] 보건소 (nemcdg@nmc.or.kr - 중구보건소)

**시나리오 1: 중앙 사용자 - 전국 할당**
- [ ] truth0530으로 로그인
- [ ] "추가할목록"에서 AED 선택 (여러 지역)
- [ ] "추가" 버튼 클릭
- [ ] Step 1: 안내 카드 확인
- [ ] "다음" 클릭 → Step 2
- [ ] 팀원 목록 확인 (전국 모든 보건소 사용자 표시)
- [ ] 다양한 지역 팀원 선택 가능 확인
- [ ] "전체 팀원" 선택 가능 확인
- [ ] "일정 추가" 클릭
- [ ] Step 3: 성공 메시지 확인
- [ ] "추가된목록" 탭: 새 항목 표시 확인
  - [ ] 추가자: truth0530의 이름
  - [ ] 담당: 선택한 팀원 이름 또는 "전체"

**시나리오 2: 시도 사용자 - 시도 내 할당**
- [ ] 시도 계정으로 로그인 (대구 시도응급의료지원센터)
- [ ] "추가할목록"에서 대구 AED 선택
- [ ] "추가" → Step 2
- [ ] 팀원 목록 확인 (대구만 표시)
- [ ] 다른 시도 팀원 표시 안 됨 확인
- [ ] 같은 시도 여러 보건소의 팀원 선택 가능 확인
- [ ] "전체 팀원" 선택 (대구의 전체)
- [ ] 할당 완료
- [ ] "추가된목록": 담당 필드 정확성 확인

**시나리오 3: 보건소 사용자 - 구군 내 할당**
- [ ] nemcdg로 로그인 (대구 중구보건소)
- [ ] "추가할목록"에서 중구 AED 선택
- [ ] "추가" → Step 2
- [ ] 팀원 목록 확인 (중구만 표시)
- [ ] 다른 구의 팀원 표시 안 됨 확인
- [ ] 중구 팀원만 선택 가능 확인
- [ ] "본인에게 할당" 선택 (추천)
- [ ] 할당 완료
- [ ] "현장점검" 메뉴: 새 항목 자동 표시 확인
- [ ] "일정관리" → "추가된목록": 담당 필드 = nemcdg 이름

**시나리오 4: 권한 위반 차단 확인**
- [ ] truth0530 (중앙)으로 로그인
- [ ] "추가할목록"에서 AED 선택
- [ ] "추가" → Step 2
- [ ] 미승인 사용자 시도 할당 (DB에서 승인 취소한 계정)
  - [ ] 선택 불가능 확인 또는 API 에러 확인
- [ ] 다른 시도 보건소 팀원에게 할당 시도 (권한 없음)
  - [ ] 선택 불가능 또는 403 에러 확인

**시나리오 5: "전체 팀원" 할당 검증**
- [ ] truth0530으로 AED 할당 (전체 팀원)
- [ ] 다른 계정(보건소 팀원)으로 로그인
- [ ] "현장점검" 메뉴 확인
- [ ] 방금 할당된 AED 자동 표시 확인
- [ ] "일정관리" → "추가된목록": 담당 필드 = "전체"

**시나리오 6: 대량 사용자 UI 확인** (선택)
- [ ] 중앙 계정으로 팀원 선택 모달
- [ ] 사용자 100명 이상인 경우
- [ ] 검색 필드 표시 확인
- [ ] 검색 필터링 작동 확인
- [ ] "더보기" 버튼 작동 확인

**테스트 결과 문서화**:
- [ ] 체크리스트 작성: `docs/testing/MANUAL_TEST_RESULTS.md`
- [ ] 스크린샷: 각 시나리오별 (필요시)
- [ ] 발견된 버그: GitHub Issues 등록

---

#### 3.3 배포 준비

**Timeline: Day 10 | Effort: 2h | Risk: High**

- [ ] **롤백 플랜 수립**
  - [ ] 마이그레이션 롤백 스크립트 준비
    ```sql
    ALTER TABLE inspection_assignments
    DROP COLUMN assignment_scope;
    ```
  - [ ] 기능 플래그 비활성화 스크립트
  - [ ] 알림: 데이터 손실 가능성 및 대처 방안

- [ ] **기능 플래그 토글 스크립트 작성**
  - [ ] `FEATURE_TEAM_MEMBER_ASSIGNMENT_V2=false` (기본)
  - [ ] 배포 후 `= true`로 전환
  - [ ] 점진적 롤아웃 준비 (e.g., 10% → 50% → 100%)

- [ ] **감시 대시보드 준비**
  - [ ] Datadog/CloudWatch 메트릭 설정
    - [ ] `/api/team/members` 응답 시간
    - [ ] 권한 위반 시도 (403 에러)
    - [ ] assignment_scope별 생성 건수
    - [ ] API 에러율

  - [ ] 로깅 쿼리 준비
    ```sql
    SELECT COUNT(*)
    FROM inspection_assignments
    WHERE assignment_scope = 'all_team'
    AND created_at > NOW() - INTERVAL '1 day';
    ```

- [ ] **배포 전 체크리스트** (프로덕션 배포 직전)
  - [ ] `npm run tsc` ✅
  - [ ] `npm run lint` ✅
  - [ ] `npm run build` ✅
  - [ ] 모든 자동화 테스트 ✅
  - [ ] 수동 테스트 결과 ✅
  - [ ] 마이그레이션 스크립트 검증 ✅
  - [ ] 롤백 플랜 확인 ✅
  - [ ] 팀 간 커뮤니케이션 ✅

- [ ] **배포 수행**
  - [ ] 테스트 환경에 먼저 배포
    ```bash
    git push origin main
    # CI/CD 파이프라인 자동 실행
    ```
  - [ ] 테스트 환경 검증 (1-2시간)
  - [ ] 프로덕션 배포 승인
  - [ ] 기능 플래그 활성화 (수동 또는 자동)
  - [ ] 배포 로그 모니터링

- [ ] **배포 후 모니터링** (24시간)
  - [ ] 에러율 모니터링 (< 0.1%)
  - [ ] 응답 시간 모니터링 (< 500ms)
  - [ ] 사용자 피드백 수집
  - [ ] 데이터 정합성 검증
    ```sql
    SELECT COUNT(*)
    FROM inspection_assignments
    WHERE assignment_scope IS NULL;
    -- 결과: 0 (모든 레코드에 값 있어야 함)
    ```

- [ ] **배포 완료 문서화**
  - [ ] 배포 노트 작성
  - [ ] 변경 로그 업데이트
  - [ ] 팀 공지

---

#### Phase 3 체크아웃

- [ ] 모든 자동화 테스트 통과 (> 80% 커버리지)
- [ ] 수동 테스트 6가지 시나리오 완료
- [ ] 버그 0개 (Critical/High priority)
- [ ] 롤백 플랜 검증됨
- [ ] 감시 대시보드 구성됨
- [ ] 팀 간 배포 커뮤니케이션 완료
- [ ] 배포 후 24시간 모니터링 완료
- [ ] 프로덕션 사용자 피드백 수집됨

**Estimate: 11 hours | Owner: QA + DevOps + Backend**

---

## 전체 타임라인

| Phase | 작업 | 기간 | 담당 |
|-------|------|------|------|
| 1 | Prisma 마이그레이션 | Day 1-2 | Backend |
| 1 | 권한 유틸 구현 | Day 2-3 | Backend |
| 1 | /api/team/members 재작성 | Day 3-4 | Backend |
| 1 | /api/inspections/assignments 강화 | Day 4 | Backend |
| 2 | TeamMemberSelector 개선 | Day 5-6 | Frontend |
| 2 | ScheduleModal 개선 | Day 6-7 | Frontend |
| 2 | AdminFullView + InspectionList | Day 7 | Frontend |
| 3 | 자동화 테스트 | Day 8-9 | QA |
| 3 | 수동 테스트 | Day 9-10 | QA |
| 3 | 배포 준비 및 수행 | Day 10 | DevOps |

**총 예상 기간**: 2주 (부분 병렬 작업 가능)

---

## 병렬 작업 가능성

- **Day 5-7**: Backend (Phase 1 완료 후) + Frontend (Phase 2) 병렬 진행
- **Day 8-10**: Frontend (완료 후) + QA/DevOps 병렬 진행

최대 병렬화 시 **10일 (2주)** 압축 가능

---

## 12. 위험 완화 전략

### 12.1 교차 조직 할당 방지

```typescript
// 매우 엄격한 권한 검증
async function canAssignToUser(
  currentUserId: string,
  targetUserId: string
): Promise<boolean> {
  const current = await prisma.user_profiles.findUnique({
    where: { id: currentUserId },
    include: { organizations: true }
  });

  const target = await prisma.user_profiles.findUnique({
    where: { id: targetUserId },
    include: { organizations: true }
  });

  // 1. 기본: 같은 지역인지 확인
  if (current!.region_code !== target!.region_code) {
    return false;
  }

  // 2. 조직 타입별 추가 검증
  const currentOrgType = current!.organizations?.type;
  const targetOrgType = target!.organizations?.type;

  // 보건소 사용자는 보건소 내에서만 할당
  if (currentOrgType === 'district_health_center') {
    if (current!.district !== target!.district) {
      return false;
    }
  }

  // 3. 대상 사용자가 승인되었는지 확인
  if (!target!.approved_by || target!.account_locked) {
    return false;
  }

  return true;
}
```

### 12.2 중복 할당 방지

```typescript
// 기존 로직 유지하되, assignment_scope도 함께 확인
const existing = await prisma.inspection_assignments.findFirst({
  where: {
    equipment_serial: serial,
    status: { in: ['pending', 'in_progress'] },
    assignment_scope: { not: 'unassigned' }  // ← assignment_scope 제외
  }
});
```

### 12.3 승인 만료 처리 (향후 개선)

```typescript
// 향후 개선: 승인 만료 시간 추가
model user_profiles {
  // ...
  approved_at        DateTime?
  approval_expires_at DateTime?  // ← 향후 추가
}

// 승인 유효성 검증
function isApprovalValid(user: UserProfile): boolean {
  if (!user.approved_at || !user.approved_by) return false;

  // 승인 만료 시간이 있으면 확인
  if (user.approval_expires_at) {
    return new Date() < user.approval_expires_at;
  }

  return true;
}
```

---

## 13. 모니터링 및 로깅

```typescript
// 모든 할당 작업 로깅
logger.info('Assignment Created', {
  equipment_serial: serial,
  assigned_to: assignedToValue,
  assignment_scope: assignmentScope,
  assigned_by: session.user.id,
  timestamp: new Date().toISOString()
});

// 권한 위반 로깅 (보안 감사용)
logger.warn('Authorization Denied', {
  user_id: session.user.id,
  target_user_id: assignedToValue,
  reason: 'Cross-organization assignment',
  timestamp: new Date().toISOString()
});
```

---

## 14. 검증 체크리스트 (구현 완료 시)

- [ ] Prisma 마이그레이션 완료 및 배포됨
- [ ] `/api/team/members` N+1 쿼리 제거됨 (Prisma Profiler 확인)
- [ ] 모든 권한 검증 함수 통과
- [ ] TeamMemberSelector: 자신 제외, "전체" 옵션 표시됨
- [ ] ScheduleModal: 할당 방식 설명 표시됨
- [ ] API: assignment_scope 필드 저장됨
- [ ] 관리자 뷰: "전체" vs "개인" 구분 표시
- [ ] 작업자 뷰: 본인 + "전체" 항목만 표시
- [ ] 자동화 테스트: 모든 시나리오 통과
- [ ] 수동 테스트: 3가지 권한 레벨 검증 완료

---

## 15. 추적 메트릭

배포 후 모니터링할 메트릭:

1. **팀원 목록 조회 시간**: < 500ms
2. **N+1 쿼리 발생**: 0
3. **권한 위반 시도**: 모니터링 (공격 패턴 감지)
4. **할당 성공률**: 95% 이상
5. **사용자 만족도**: "팀원이 제대로 보인다" 피드백
