# Phase 2 UI 구현 계획 (Assignment Scope 기능)

**상태**: ✏️ **계획 단계**
**예상 기간**: 1주일 (3-5일 개발 + 2일 테스트)

---

## 1. 개요

Phase 1에서 완료된 점검 관리 정책의 API 백엔드를 바탕으로, Phase 2에서는 **assignment_scope** 기능의 UI를 구현합니다.

### 1.1 Assignment Scope란?

완료된 점검을 **다시 할당**할 때, 누가 볼 수 있는지를 제어합니다.

| Scope | 설명 | 사용 사례 |
|-------|------|----------|
| `assigned` | 할당받은 사람만 볼 수 있음 (기본값) | 개별 점검자 할당 |
| `all_team` | 팀원 모두가 볼 수 있음 | 팀 공동 작업 점검 |
| `unassigned` | 아직 할당되지 않음 | 예약 점검 |

**주의**: Phase 1에서 이 값은 저장되지만, UI에서 선택 기능은 아직 구현되지 않았습니다.

---

## 2. 영향받는 컴포넌트

### 2.1 TeamMemberSelector ([components/inspection/TeamMemberSelector.tsx](../../components/inspection/TeamMemberSelector.tsx))

**현재 상태**: 팀원 선택만 가능

**필요 변경사항**:
```typescript
// BEFORE (line ~50)
<div>
  <label>팀원 선택</label>
  <select onChange={handleTeamMemberChange}>
    {teamMembers.map(member => (
      <option key={member.id} value={member.id}>
        {member.name}
      </option>
    ))}
  </select>
</div>

// AFTER
<div>
  <label>팀원 선택</label>
  <select onChange={handleTeamMemberChange}>
    {teamMembers.map(member => (
      <option key={member.id} value={member.id}>
        {member.name}
      </option>
    ))}
  </select>

  {/* NEW: 공개 범위 선택 */}
  <label className="mt-4">공개 범위</label>
  <div className="space-y-2">
    <label className="flex items-center">
      <input
        type="radio"
        name="assignment_scope"
        value="assigned"
        checked={scope === 'assigned'}
        onChange={(e) => setScope(e.target.value)}
      />
      <span className="ml-2">할당받은 사람만</span>
    </label>
    <label className="flex items-center">
      <input
        type="radio"
        name="assignment_scope"
        value="all_team"
        checked={scope === 'all_team'}
        onChange={(e) => setScope(e.target.value)}
      />
      <span className="ml-2">팀원 모두</span>
    </label>
    <label className="flex items-center">
      <input
        type="radio"
        name="assignment_scope"
        value="unassigned"
        checked={scope === 'unassigned'}
        onChange={(e) => setScope(e.target.value)}
      />
      <span className="ml-2">미할당</span>
    </label>
  </div>
</div>
```

### 2.2 ScheduleModal ([components/inspection/ScheduleModal.tsx](../../components/inspection/ScheduleModal.tsx))

**현재 상태**: assignment_scope 매개변수 전달 안 함

**필요 변경사항**:
```typescript
// BEFORE (line ~200, handleScheduleSubmit)
const response = await fetch('/api/inspections/assignments', {
  method: 'POST',
  body: JSON.stringify({
    equipment_id: equipment.id,
    assigned_to: selectedMemberId,
    scheduled_date: date,
    // assignment_scope 미포함
  }),
});

// AFTER
const response = await fetch('/api/inspections/assignments', {
  method: 'POST',
  body: JSON.stringify({
    equipment_id: equipment.id,
    assigned_to: selectedMemberId,
    scheduled_date: date,
    assignment_scope: scope, // ← NEW
  }),
});
```

**데이터 흐름**:
```
TeamMemberSelector (scope 선택)
  ↓
ScheduleModal (scope 저장)
  ↓
API POST /api/inspections/assignments
  ↓
DB inspection_assignments.assignment_scope 저장
```

### 2.3 AdminFullView ([components/inspection/AdminFullView.tsx](../../components/inspection/AdminFullView.tsx))

**현재 상태**: 모든 팀원의 점검을 표시 (all_team 필터링 없음)

**필요 변경사항**:
```typescript
// 데이터 조회 시 assignment_scope 확인
const visibleInspections = inspections.filter(inspection => {
  // 규칙:
  // 1. assigned: 본인이 할당받은 것만
  // 2. all_team: 같은 팀 모두
  // 3. unassigned: 미할당 (관리자만 볼 수 있음)

  if (inspection.assignment_scope === 'assigned') {
    return inspection.assigned_to === currentUserId;
  }
  if (inspection.assignment_scope === 'all_team') {
    return inspection.team_id === currentUserTeamId;
  }
  if (inspection.assignment_scope === 'unassigned') {
    return isAdmin; // 관리자만
  }
  return false;
});
```

---

## 3. 데이터베이스 스키마 (이미 완성됨)

**파일**: [prisma/schema.prisma](../../prisma/schema.prisma)

```prisma
model inspection_assignments {
  // ... existing fields ...

  /// 할당 공개 범위: assigned(본인만), all_team(팀원), unassigned(미할당)
  assignment_scope AssignmentScope @default(assigned)

  // ... rest of schema ...
}

enum AssignmentScope {
  assigned      // 할당받은 사람만
  all_team      // 팀원 모두
  unassigned    // 미할당
}
```

---

## 4. 구현 단계별 계획

### 단계 1: TeamMemberSelector 개선 (0.5일)

**파일**: [components/inspection/TeamMemberSelector.tsx](../../components/inspection/TeamMemberSelector.tsx)

**작업**:
1. State 추가: `const [scope, setScope] = useState('assigned')`
2. Radio button 추가 (assigned, all_team, unassigned)
3. Props 확장: `onScopeChange` 콜백 추가
4. 기본값 처리: props.defaultScope 또는 'assigned'

**체크리스트**:
- [ ] 라디오 버튼 렌더링 확인
- [ ] 초기값 설정 확인
- [ ] 부모 컴포넌트에 값 전달 확인

### 단계 2: ScheduleModal 수정 (0.5일)

**파일**: [components/inspection/ScheduleModal.tsx](../../components/inspection/ScheduleModal.tsx)

**작업**:
1. TeamMemberSelector에서 scope 수신
2. POST 요청에 assignment_scope 포함
3. API 응답 처리 (기존과 동일)

**체크리스트**:
- [ ] TeamMemberSelector의 scope 값 수신 확인
- [ ] API 요청에 assignment_scope 포함 확인
- [ ] 에러 처리 동일 (기존 코드 유지)

### 단계 3: AdminFullView 필터링 (1일)

**파일**: [components/inspection/AdminFullView.tsx](../../components/inspection/AdminFullView.tsx)

**작업**:
1. 점검 목록 조회 시 필터링 로직 추가
2. assigned: 본인 담당만
3. all_team: 팀 공유
4. unassigned: 관리자만 (또는 팀 리더)
5. UI에 scope 표시 (아이콘 또는 라벨)

**체크리스트**:
- [ ] 필터링 로직 동작 확인
- [ ] 서로 다른 scope의 점검이 올바르게 표시되는지 확인
- [ ] 미할당 점검의 관리자 전용 표시 확인

### 단계 4: 테스트 및 문서화 (1일)

**작업**:
1. 3가지 scope으로 점검 생성 및 조회 테스트
2. 권한별 표시 여부 확인
3. API 연동 테스트
4. UI/UX 피드백 반영

**체크리스트**:
- [ ] Scenario 1: assigned 점검 생성 → 본인만 볼 수 있음
- [ ] Scenario 2: all_team 점검 생성 → 팀원 모두 볼 수 있음
- [ ] Scenario 3: unassigned 점검 생성 → 관리자만 볼 수 있음
- [ ] 문서 업데이트 (사용자 가이드)

---

## 5. 주의사항

### 5.1 기존 데이터 처리

현재 DB의 `inspection_assignments` 레코드들:
- **assignment_scope = NULL**: 기본값 'assigned'로 처리
- Prisma 스키마의 `@default(assigned)` 자동 적용

**Action**: 마이그레이션 필요 없음 (Prisma 기본값 처리)

### 5.2 권한 검증

**중요**: 백엔드에서 scope별 조회 제한 구현 필수

```typescript
// API GET /api/inspections/assignments
// - assigned: assignment_scope='assigned' AND assigned_to=currentUser
// - all_team: assignment_scope='all_team' AND team_id=currentUserTeam
// - unassigned: assignment_scope='unassigned' AND role='admin'

// 현재 구현 상태: ?
// 필요시 별도 PR에서 구현
```

### 5.3 UI/UX 고려사항

- **기본값**: 'assigned' (기존 동작 유지)
- **표시 위치**: TeamMemberSelector 바로 아래
- **라벨**: 간단하고 명확하게 ("할당받은 사람만", "팀원 모두" 등)

---

## 6. 예상 테스트 케이스

### 6.1 기능 테스트

| 테스트 | 시나리오 | 기대 결과 |
|--------|----------|----------|
| Scope 선택 | assigned 라디오 선택 | 선택 상태 유지 |
| API 전송 | ScheduleModal 저장 | assignment_scope 포함 |
| 조회 필터링 | assigned 점검 확인 | 본인 점검만 표시 |
| 조회 필터링 | all_team 점검 확인 | 팀원 점검 모두 표시 |

### 6.2 통합 테스트

```bash
# 1. assigned 점검 생성
POST /api/inspections/assignments
Body: { assignment_scope: 'assigned', assigned_to: 'user1' }
Expected: 200 OK, assignment_scope='assigned'

# 2. user1 조회
GET /api/inspections/assignments?filter=assigned
Expected: 위에서 생성한 점검 포함

# 3. user2 조회
GET /api/inspections/assignments?filter=assigned
Expected: 위에서 생성한 점검 제외
```

---

## 7. Phase 2 완료 후 체크리스트

- [ ] TeamMemberSelector 라디오 버튼 추가
- [ ] ScheduleModal에서 assignment_scope 전송
- [ ] AdminFullView에서 필터링 적용
- [ ] 3가지 scope 모두 테스트 완료
- [ ] 문서 업데이트 완료
- [ ] 코드 리뷰 완료
- [ ] GitHub 커밋 및 푸시

---

## 8. 리스크 및 완화 전략

### 8.1 리스크: 기존 데이터와 호환성

**문제**: NULL 값이 있는 기존 레코드
**완화**: Prisma @default(assigned) + 마이그레이션 스크립트

```sql
UPDATE inspection_assignments
SET assignment_scope = 'assigned'
WHERE assignment_scope IS NULL;
```

### 8.2 리스크: 백엔드 필터링 미완성

**문제**: UI에서 선택했지만 API에서 필터링 안 함
**완화**: Phase 3에서 백엔드 API 확장 (별도 PR)

### 8.3 리스크: UI/UX 피드백

**문제**: 사용자가 scope 개념을 이해 못할 수 있음
**완화**: 명확한 라벨 + 설명 텍스트 + 기본값 설정

---

## 9. 참고: 현재 API 상태

### 현재 구현된 부분

```typescript
// POST /api/inspections/assignments (line ~450)
const assignmentData = {
  equipment_id,
  assigned_to,
  scheduled_date,
  assignment_scope: assignment_scope || 'assigned', // ← 저장됨
};

await prisma.inspection_assignments.create({
  data: assignmentData,
});
```

### 미완성 부분

```typescript
// GET /api/inspections/assignments
// 현재: 모든 점검 반환
// 필요: assignment_scope별 필터링
//   - assigned: 본인 점검만
//   - all_team: 팀 점검만
//   - unassigned: 관리자만
```

---

## 10. 다음 단계 (Phase 3)

Phase 2 UI 구현 완료 후, Phase 3에서는:

1. **백엔드 API 필터링** ([app/api/inspections/assignments/route.ts](../../app/api/inspections/assignments/route.ts))
   - GET 핸들러에 scope 기반 필터링 추가
   - 권한 검증 강화

2. **자동화 테스트**
   - E2E 테스트 (시나리오 테스트)
   - API 통합 테스트

3. **성능 최적화**
   - 데이터베이스 인덱싱 (assignment_scope, team_id)
   - 캐싱 전략

---

**작성**: 2025-11-10 08:20 KST
**상태**: PLANNING_COMPLETE
**예상 시작**: 2025-11-11
**예상 완료**: 2025-11-15
