# Database Relation Naming Policy

## 개요

Prisma 스키마에서 relation 명명에 대한 일관된 정책을 정의합니다.
명확하고 의미있는 relation 이름을 통해 스키마 가독성과 유지보수성을 향상시킵니다.

**작성일**: 2025-11-05
**대상 ORM**: Prisma
**스키마**: aedpics

---

## 현황 분석 (2025-11-05)

### Relation 통계

| 분류 | 개수 | 설명 | 조치 필요 |
|------|------|------|-----------|
| Explicit Named | 44 | @relation("name") 있음 | 검토 필요 (일부 이름 너무 김) |
| Implicit Named | 23 | @relation 없음 | **필요** |
| Self-Relations | 4 | 자기 참조 (필수) | 이미 명시적 이름 있음 |
| Multiple Relations | 38 | 같은 모델 쌍에 여러 relation | 이미 명시적 이름 있음 |

**총 Relation**: 67개
**개선 필요**: 23개 (implicit) + 일부 explicit (이름 개선)

### 현재 좋은 예시

```prisma
// 명확하고 간결한 이름
aed_data.inspections -> inspections @relation("InspectionToAedData")
aed_data.inspection_sessions -> inspection_sessions @relation("SessionToAedData")

// 의미있는 역할 표현
organization_change_requests.user -> user_profiles @relation("change_request_user")
organization_change_requests.reviewer -> user_profiles @relation("change_request_reviewer")

// 간결한 다중 relation
approval_notifications.recipient -> user_profiles @relation("approval_notifications_recipient")
approval_notifications.sender -> user_profiles @relation("approval_notifications_sender")
```

### 개선 필요 예시

```prisma
// 너무 긴 이름
inspection_assignments.user_profiles_inspection_assignments_assigned_byTouser_profiles
  -> user_profiles
  @relation("inspection_assignments_assigned_byTouser_profiles")

// 제안: "assignment_assigner" 또는 "AssignmentAssigner"

// 너무 긴 이름
team_members.user_profiles_team_members_added_byTouser_profiles
  -> user_profiles
  @relation("team_members_added_byTouser_profiles")

// 제안: "team_member_adder" 또는 "TeamMemberAdder"

// 명시적 이름 없음
accounts.user_profiles -> user_profiles  (no @relation name)

// 제안: @relation("AccountOwner")
```

---

## Relation 명명 정책

### 1. 기본 원칙

1. **필수 명시적 이름**:
   - Self-relation (자기 참조)
   - Multiple relation (같은 모델 쌍에 2개 이상)

2. **권장 명시적 이름**:
   - 모든 relation (가독성 향상)

3. **명확성**:
   - 관계의 의미를 명확히 표현
   - 도메인 용어 사용 (technical jargon 회피)

4. **간결성**:
   - 30자 이내 권장
   - 불필요한 반복 피하기

### 2. 명명 패턴

#### Pattern A: PascalCase (권장)

**장점**:
- 가독성 높음
- TypeScript/JavaScript 컨벤션과 일치
- Prisma 공식 문서 스타일

**사용 예시**:
```prisma
inspections.inspector_id -> user_profiles
  @relation("InspectionInspector")

aed_data.inspections -> inspections[]
  @relation("AedInspections")

user_profiles.approved_by -> user_profiles
  @relation("ProfileApprover")
```

#### Pattern B: snake_case

**장점**:
- 데이터베이스 컨벤션과 일치
- 소문자로 통일

**사용 예시**:
```prisma
inspections.inspector_id -> user_profiles
  @relation("inspection_inspector")

aed_data.inspections -> inspections[]
  @relation("aed_inspections")

user_profiles.approved_by -> user_profiles
  @relation("profile_approver")
```

#### Pattern C: 역할 기반 (Multiple Relations)

같은 모델 쌍에 여러 relation이 있을 때는 역할을 강조:

```prisma
// PascalCase
approval_notifications.recipient -> user_profiles @relation("NotificationRecipient")
approval_notifications.sender -> user_profiles @relation("NotificationSender")

// snake_case
approval_notifications.recipient -> user_profiles @relation("notification_recipient")
approval_notifications.sender -> user_profiles @relation("notification_sender")
```

### 3. Self-Relation 명명

Self-relation은 관계의 방향과 의미를 명확히:

```prisma
model organizations {
  id                   String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  parent_id            String?         @db.Uuid

  // 현재 (기능하지만 개선 가능)
  organizations        organizations?  @relation("organizationsToorganizations", fields: [parent_id], references: [id])
  other_organizations  organizations[] @relation("organizationsToorganizations")

  // 제안 (더 명확함)
  parent_organization  organizations?  @relation("ParentChild", fields: [parent_id], references: [id])
  child_organizations  organizations[] @relation("ParentChild")
}

model user_profiles {
  id                  String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  approved_by         String?         @db.Uuid

  // 현재 (기능하지만 개선 가능)
  user_profiles           user_profiles?  @relation("user_profilesTouser_profiles", fields: [approved_by], references: [id])
  other_user_profiles     user_profiles[] @relation("user_profilesTouser_profiles")

  // 제안 (더 명확함)
  approver                user_profiles?  @relation("ProfileApproval", fields: [approved_by], references: [id])
  approved_user_profiles  user_profiles[] @relation("ProfileApproval")
}
```

### 4. 명명 규칙 선택 가이드

#### 언제 PascalCase를 사용할까?

1. 엔티티 간 관계 (Entity-to-Entity):
   ```prisma
   @relation("InspectionToAedData")
   @relation("SessionToAedData")
   ```

2. 새로운 relation 추가 시 (일관성 유지)

3. 프론트엔드 중심 프로젝트

#### 언제 snake_case를 사용할까?

1. 역할 기반 relation:
   ```prisma
   @relation("notification_recipient")
   @relation("assignment_assigner")
   ```

2. 데이터베이스 중심 프로젝트

3. 기존 snake_case relation이 많을 때 (일관성)

#### AEDpics 프로젝트 권장사항

**현재 프로젝트는 혼용 상태이므로, 다음 규칙 적용**:

1. **새로운 relation**: PascalCase 사용
   - 예: `@relation("InspectionAssigner")`

2. **기존 relation 수정 시**:
   - 너무 긴 이름 → 간결하게 변경
   - 의미 불명확 → 역할 기반으로 변경
   - 기존 스타일 유지 (snake_case면 snake_case)

3. **Multiple relation**: 역할 강조
   - PascalCase: `@relation("NotificationSender")`
   - snake_case: `@relation("notification_sender")`

---

## 우선순위별 개선 대상

### Priority 1: Implicit Relations (명시적 이름 추가)

23개의 relation에 명시적 이름 추가 필요:

| 모델 | 필드 | 타겟 | 제안 이름 |
|------|------|------|-----------|
| accounts | user_profiles | user_profiles | `@relation("AccountOwner")` |
| gps_issues | aed_data | aed_data | `@relation("GpsIssueAed")` |
| inspection_field_comparisons | inspection | inspections | `@relation("FieldComparison")` |
| inspection_field_comparisons | aed_device | aed_data | `@relation("ComparisonDevice")` |
| inspection_schedule_entries | user_profiles | user_profiles | `@relation("ScheduleCreator")` |
| inspection_schedules | aed_data | aed_data | `@relation("ScheduledAed")` |
| inspection_schedules | user_profiles | user_profiles | `@relation("ScheduleCreator")` |
| inspection_sessions | user_profiles | user_profiles | `@relation("SessionInspector")` |
| login_history | user_profiles | user_profiles | `@relation("LoginUser")` |
| notification_templates | notifications | notifications[] | `@relation("TemplateNotifications")` |
| notifications | user_profiles (recipient) | user_profiles | `@relation("NotificationRecipient")` |
| notifications | user_profiles (sender) | user_profiles | `@relation("NotificationSender")` |
| organizations | user_profiles | user_profiles[] | `@relation("OrganizationMembers")` |
| push_subscriptions | user_profiles | user_profiles | `@relation("SubscriptionOwner")` |
| schedule_instances | team_members | team_members | `@relation("AssignedInspector")` |
| sessions | user_profiles | user_profiles | `@relation("SessionUser")` |
| task_assignments | user_profiles | user_profiles | `@relation("TaskAssigner")` |
| task_assignments | organizations | organizations | `@relation("TaskOrganization")` |
| team_activity_logs | organizations | organizations | `@relation("ActivityOrganization")` |
| team_activity_logs | user_profiles | user_profiles | `@relation("ActivityPerformer")` |
| team_activity_logs | team_members | team_members | `@relation("ActivityMember")` |
| team_activity_logs | task_assignments | task_assignments | `@relation("ActivityTask")` |
| team_permissions | user_profiles | user_profiles | `@relation("PermissionGranter")` |

### Priority 2: 긴 이름 개선

너무 긴 relation 이름을 간결하게:

| 현재 이름 | 제안 이름 |
|-----------|-----------|
| `inspection_assignments_assigned_byTouser_profiles` | `AssignmentAssigner` |
| `inspection_assignments_assigned_toTouser_profiles` | `AssignmentAssignee` |
| `management_number_group_mapping_confirmed_by_2024Touser_profiles` | `MappingConfirmer2024` |
| `management_number_group_mapping_modified_by_2024Touser_profiles` | `MappingModifier2024` |
| `target_list_devices_matched_byTouser_profiles` | `DeviceMatcher` |
| `target_list_devices_verified_byTouser_profiles` | `DeviceVerifier` |
| `team_members_added_byTouser_profiles` | `MemberAdder` |
| `team_members_user_profile_idTouser_profiles` | `MemberProfile` |

### Priority 3: Self-Relation 개선

더 명확한 이름으로:

| 현재 이름 | 제안 이름 |
|-----------|-----------|
| `organizationsToorganizations` | `ParentChildOrg` |
| `user_profilesTouser_profiles` | `ProfileApproval` |

---

## 마이그레이션 주의사항

### 1. Relation 이름 변경의 영향

**주의**: Relation 이름 변경은 **Schema-only 변경**입니다.
- 데이터베이스 마이그레이션 불필요
- Prisma Client 재생성만 필요
- Foreign Key 제약조건 이름은 자동 생성됨

### 2. 변경 절차

```bash
# 1. schema.prisma 수정
# 2. Prisma Client 재생성
npx prisma generate

# 3. TypeScript 타입 검사
npm run tsc

# 4. 빌드 테스트
npm run build

# 5. 배포
git commit -m "refactor: improve relation naming"
git push
```

### 3. 코드 영향 없음

Relation 이름은 Prisma의 메타데이터이며, 생성된 Prisma Client API에는 영향 없음:

```typescript
// Relation 이름 변경 전
const user = await prisma.user_profiles.findUnique({
  where: { id: userId },
  include: {
    approved_user_profiles: true,  // 필드명은 그대로
  },
});

// Relation 이름 변경 후 (코드 변경 불필요)
const user = await prisma.user_profiles.findUnique({
  where: { id: userId },
  include: {
    approved_user_profiles: true,  // 동일
  },
});
```

---

## 참조

- Prisma Relation 문서: https://www.prisma.io/docs/concepts/components/prisma-schema/relations
- Prisma Naming Conventions: https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#naming-conventions

---

**다음 단계**: 이 정책을 바탕으로 단계적 relation 이름 개선 적용
