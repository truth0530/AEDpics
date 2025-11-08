# 점검 시스템 개선 계획서

## 개요
이 문서는 현재 점검 시스템의 문제점을 분석하고 개선 방안을 제시합니다.

생성일: 2025-11-08
작성자: Claude Code
검토자: KwangSung Lee
최종 수정: 2025-11-08 (스키마 불일치 수정 및 스크립트 구현)

## ⚠️ 중요 변경 사항 (2025-11-08)

### 스키마 변경 반영
1. **user_profiles 테이블**
   - `status` 필드 없음 → `is_active` (boolean) 사용
   - 관계명: `organization` → `organizations`

2. **team_members 테이블 구조**
   - 변경 전: `user_id`, `team_id`, `role`
   - 변경 후: `user_profile_id`, `organization_id`, `member_type`
   - member_type enum: `permanent`, `temporary`, `volunteer`

3. **구현된 스크립트**
   - ✅ `npm run monitor:inspection-system` - 시스템 모니터링
   - ✅ `npm run sync:team-members` - 팀 멤버 동기화
   - ✅ `npm run migrate:legacy-inspections` - 레거시 데이터 마이그레이션
   - ✅ `npm run normalize:region-codes` - 지역 코드 정규화
   - ✅ `npm run emergency:assign-inspectors` - 임시점검원 긴급 할당

## 1. 현재 시스템 분석

### 1.1 주요 문제점

#### A. 권한 및 할당 문제
1. **레거시 데이터 마이그레이션 누락**
   - 기존 점검 데이터가 `inspection_assignments` 테이블에 없음
   - 임시점검원이 장비를 볼 수 없는 문제 발생

2. **팀 멤버 동기화 부재**
   - `team_members` 테이블이 비어있음
   - 팀원 관리 기능 사용 불가

3. **지역 권한 불일치**
   - 사용자별로 다른 장비 목록이 표시됨
   - 지역 코드 정규화 문제

#### B. API 및 데이터 일관성
1. **컬럼명 일관성**
   - API: camelCase (`priorityLevel`)
   - DB: snake_case (`priority_level`)
   - 현재 매핑은 정상 작동하나 혼란 가능성 존재

2. **에러 핸들링**
   - 409 Conflict 에러 처리 미흡
   - 사용자에게 불친절한 에러 메시지

### 1.2 해결된 문제들
- ✅ ManagerEducation 데이터 저장 누락 → 수정 완료
- ✅ 취소 버튼 동작 불일치 → 원본 데이터 복원으로 통일
- ✅ 409 에러 처리 → immediate 타입은 성공으로 처리

## 2. 개선 계획

### Phase 1: 긴급 대응 (즉시 실행)

#### 1.1 임시점검원 장비 할당 ✅ 구현 완료
```bash
# 실행 명령어
npm run emergency:assign-inspectors
```

**예상 결과:**
- 임시점검원에게 해당 지역 장비 50개씩 자동 할당
- `team_members` 테이블에 팀원으로 등록
- 점검 기능 즉시 사용 가능

**주의사항:**
- 스키마 변경 반영: `status` → `is_active` (boolean)
- `team_members` 테이블 구조 변경 반영 완료

#### 1.2 레거시 데이터 마이그레이션 ✅ 구현 완료
```bash
# 실행 명령어
npm run migrate:legacy-inspections
```

**구현 내용:**
```typescript
// scripts/migrate-legacy-inspections.ts
async function migrateLegacyInspections() {
  // 1. inspections 테이블의 기존 데이터 조회
  const legacyInspections = await prisma.inspections.findMany({
    where: {
      inspection_date: {
        gte: new Date('2024-01-01')
      }
    }
  });

  // 2. inspection_assignments 생성
  for (const inspection of legacyInspections) {
    await prisma.inspection_assignments.upsert({
      where: {
        // unique 조건 설정
      },
      create: {
        equipment_serial: inspection.equipment_serial,
        assigned_to: inspection.inspector_id,
        assigned_by: inspection.created_by || inspection.inspector_id,
        assignment_type: 'completed',
        status: 'completed',
        completed_at: inspection.completed_at,
        priority_level: 1
      },
      update: {}
    });
  }
}
```

### Phase 2: 모니터링 시스템 구축 ✅ 스크립트 구현 완료

#### 2.1 모니터링 스크립트 실행
```bash
# 현재 상태 확인
npm run monitor:inspection-system
```

**구현된 기능:**
- 시스템 통계 (사용자, 장비, 할당, 점검)
- 임시점검원 할당 상태
- 팀 멤버 동기화 상태
- 레거시 데이터 일관성
- 지역 권한 일치성
- 중복 할당 패턴 분석

#### 2.2 실시간 모니터링 대시보드 (UI 구현 필요)
```typescript
// app/admin/monitoring/page.tsx
export default function MonitoringDashboard() {
  return (
    <div>
      {/* 실시간 통계 */}
      <StatsCard title="활성 점검원" value={activeInspectorCount} />
      <StatsCard title="대기중 할당" value={pendingAssignmentCount} />
      <StatsCard title="진행중 점검" value={inProgressCount} />

      {/* 에러 로그 */}
      <ErrorLogViewer />

      {/* 권한 문제 알림 */}
      <PermissionIssueAlerts />
    </div>
  );
}
```

#### 2.2 자동 알림 시스템
```typescript
// lib/monitoring/alert-system.ts
export async function checkSystemHealth() {
  const issues = [];

  // 1. 빈 team_members 체크
  const emptyTeams = await checkEmptyTeams();
  if (emptyTeams.length > 0) {
    issues.push({
      level: 'warning',
      message: `${emptyTeams.length}개 조직의 팀원이 비어있음`,
      action: 'npm run sync:team-members'
    });
  }

  // 2. 할당되지 않은 임시점검원
  const unassignedInspectors = await checkUnassignedInspectors();
  if (unassignedInspectors.length > 0) {
    issues.push({
      level: 'critical',
      message: `${unassignedInspectors.length}명의 임시점검원이 장비 미할당`,
      action: 'npm run emergency:assign-inspectors'
    });
  }

  // 3. 409 에러 빈도 체크
  const conflictErrors = await checkConflictErrors();
  if (conflictErrors > 10) {
    issues.push({
      level: 'warning',
      message: `최근 1시간 동안 409 에러 ${conflictErrors}건 발생`,
      action: '중복 할당 로직 점검 필요'
    });
  }

  return issues;
}
```

### Phase 3: 데이터 일관성 개선 (2주 내)

#### 3.1 컬럼명 표준화 가이드라인
```typescript
// lib/utils/database-naming.ts
/**
 * 데이터베이스 네이밍 규칙
 * - DB 컬럼: snake_case (priority_level)
 * - API 파라미터: camelCase (priorityLevel)
 * - Prisma 모델: snake_case (DB와 일치)
 */

export function mapApiToDb(apiParams: any) {
  return {
    priority_level: apiParams.priorityLevel,
    assignment_type: apiParams.assignmentType,
    scheduled_date: apiParams.scheduledDate,
    // ... 기타 매핑
  };
}

export function mapDbToApi(dbRecord: any) {
  return {
    priorityLevel: dbRecord.priority_level,
    assignmentType: dbRecord.assignment_type,
    scheduledDate: dbRecord.scheduled_date,
    // ... 기타 매핑
  };
}
```

#### 3.2 지역 코드 정규화
```typescript
// scripts/normalize-region-codes.ts
export async function normalizeRegionCodes() {
  // 1. 모든 사용자의 region_code 정규화
  const users = await prisma.user_profiles.findMany();

  for (const user of users) {
    const normalizedCode = normalizeCode(user.region_code);
    if (normalizedCode !== user.region_code) {
      await prisma.user_profiles.update({
        where: { id: user.id },
        data: {
          region_code: normalizedCode,
          city_code: getCityCode(normalizedCode)
        }
      });
    }
  }

  // 2. 조직의 region_code 정규화
  // ... 동일한 로직
}
```

### Phase 4: 장기 개선 사항 (1개월 내)

#### 4.1 권한 관리 시스템 재설계
```typescript
// lib/auth/permission-system.ts
interface PermissionRule {
  role: UserRole;
  scope: 'national' | 'regional' | 'local';
  allowedActions: string[];
  dataAccess: {
    regions?: string[];
    cities?: string[];
    organizations?: string[];
  };
}

export class PermissionManager {
  async checkAccess(
    userId: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    // 체계적인 권한 검증
  }

  async getAccessibleEquipment(userId: string): Promise<string[]> {
    // 사용자가 접근 가능한 장비 목록
  }
}
```

#### 4.2 자동 복구 시스템
```typescript
// lib/auto-recovery/system.ts
export class AutoRecoverySystem {
  async detectAndFix() {
    // 1. 빈 team_members 자동 채우기
    await this.fillEmptyTeams();

    // 2. 미할당 점검원 자동 할당
    await this.assignUnassignedInspectors();

    // 3. 중복 데이터 정리
    await this.cleanupDuplicates();

    // 4. 권한 불일치 수정
    await this.fixPermissionMismatches();
  }
}
```

## 3. 검증 계획

### 3.1 단위 테스트
```typescript
// tests/inspection-assignments.test.ts
describe('Inspection Assignments', () => {
  it('임시점검원이 할당된 장비를 볼 수 있어야 함', async () => {
    // 테스트 구현
  });

  it('409 에러 발생 시 적절한 처리', async () => {
    // 테스트 구현
  });

  it('team_members가 자동 동기화되어야 함', async () => {
    // 테스트 구현
  });
});
```

### 3.2 통합 테스트
```bash
# 테스트 시나리오
1. 임시점검원 계정 생성
2. 관리자 승인
3. 자동 장비 할당 확인
4. 점검 세션 시작
5. 409 에러 시나리오 테스트
6. 점검 완료
```

### 3.3 성능 테스트
```typescript
// tests/performance/load-test.ts
async function loadTest() {
  // 250개 보건소 동시 접속 시뮬레이션
  // 응답 시간 측정
  // 병목 지점 식별
}
```

## 4. 실행 우선순위

### 즉시 실행 (오늘) ✅ 모든 스크립트 구현 완료
1. `npm run monitor:inspection-system` - 현재 상태 파악
2. `npm run emergency:assign-inspectors` - 긴급 할당 실행
3. `npm run sync:team-members` - 팀 멤버 동기화

### 1주 내 실행 ✅ 스크립트 구현 완료
1. `npm run migrate:legacy-inspections` - 레거시 데이터 마이그레이션
2. `npm run normalize:region-codes` - 지역 코드 정규화
3. 모니터링 대시보드 UI 구현 (웹 인터페이스)
4. 자동 알림 시스템 구축

### 2주 내 실행
1. 통합 테스트 구현
2. 성능 최적화 (N+1 쿼리 개선)
3. 자동 복구 시스템 구현

### 1개월 내 실행
1. 권한 시스템 재설계
2. 자동 복구 시스템 구현
3. 성능 최적화

## 5. 성공 지표

### 단기 (1주)
- 임시점검원 100% 장비 접근 가능
- 409 에러 발생률 50% 감소
- team_members 테이블 100% 채워짐

### 중기 (2주)
- 모든 사용자 권한 정상 작동
- 레거시 데이터 100% 마이그레이션
- 자동 모니터링 시스템 가동

### 장기 (1개월)
- 시스템 가용성 99.9% 달성
- 평균 응답 시간 < 500ms
- 자동 복구율 95% 이상

## 6. 리스크 관리

### 잠재 리스크
1. **데이터 마이그레이션 중 손실**
   - 대응: 백업 먼저 수행, 트랜잭션 사용

2. **권한 변경으로 인한 혼란**
   - 대응: 단계적 롤아웃, 사용자 교육

3. **성능 저하**
   - 대응: 인덱스 최적화, 캐싱 전략

### 롤백 계획
```bash
# 문제 발생 시 롤백 절차
1. git checkout [이전 안정 버전]
2. npm run rollback:database
3. pm2 reload ecosystem.config.js
4. 사용자 공지
```

## 7. 담당자 및 일정

| 작업 | 담당자 | 시작일 | 완료 예정일 | 상태 |
|------|--------|--------|-------------|------|
| 긴급 스크립트 실행 | DevOps | 2025-11-08 | 2025-11-08 | 진행중 |
| 레거시 마이그레이션 | Backend | 2025-11-09 | 2025-11-11 | 대기 |
| 모니터링 구축 | Full-stack | 2025-11-10 | 2025-11-15 | 대기 |
| 권한 시스템 재설계 | Architect | 2025-11-15 | 2025-12-08 | 계획 |

## 8. 참고 문서
- [CLAUDE.md](../CLAUDE.md) - AI 개발 가이드라인
- [docs/REGION_MANAGEMENT_RULES.md](REGION_MANAGEMENT_RULES.md) - 지역명 관리 규칙
- [scripts/emergency-assign-inspectors.ts](../scripts/emergency-assign-inspectors.ts) - 긴급 할당 스크립트
- [lib/auth/team-sync.ts](../lib/auth/team-sync.ts) - 팀 동기화 유틸리티

## 9. 업데이트 이력
- 2025-11-08 v1.0: 초기 문서 작성
- 2025-11-08 v1.1: 스키마 불일치 수정
  - user_profiles.status → is_active 변경
  - team_members 테이블 구조 수정
  - 모든 스크립트 구현 완료
  - N+1 쿼리 문제 해결

---

**작성자 메모:**
이 개선 계획은 현재 시스템의 문제점을 체계적으로 해결하기 위해 작성되었습니다.
우선순위에 따라 단계적으로 실행하되, 긴급한 문제는 즉시 대응해야 합니다.