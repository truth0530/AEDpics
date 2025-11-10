# Role-Based UI Architecture 문서

**작성일**: 2025-11-11
**목적**: 계정별로 다른 레이아웃이 결정되는 모든 위치 파악

## 요약

AEDpics 시스템은 사용자 역할(role)에 따라 다른 UI를 제공합니다. 이 문서는 역할 기반 레이아웃 분기가 발생하는 모든 위치를 정리합니다.

## 1. 중앙 설정 파일

### `/lib/auth/role-matrix.ts`
**역할**: 모든 역할별 권한 및 UI 모드 정의

#### UI 모드 정의 (Lines 17-128)
```typescript
export const ROLE_ACCESS_MATRIX = {
  master: {
    inspectionUIMode: 'admin-full',
    dashboardUIMode: 'admin-full',
  },
  emergency_center_admin: {
    inspectionUIMode: 'admin-full',
    dashboardUIMode: 'admin-full',
  },
  regional_emergency_center_admin: {
    inspectionUIMode: 'admin-full',
    dashboardUIMode: 'admin-full',
  },
  ministry_admin: {
    inspectionUIMode: 'read-only',
    dashboardUIMode: 'read-only',
  },
  regional_admin: {
    inspectionUIMode: 'read-only',
    dashboardUIMode: 'read-only',
  },
  local_admin: {
    inspectionUIMode: 'local-full',
    dashboardUIMode: 'local-full',
  },
  temporary_inspector: {
    inspectionUIMode: 'assigned-only',
    dashboardUIMode: 'inspector-only',
  },
} as const satisfies Record<UserRole, RoleAccessConfig>;
```

#### UI 권한 헬퍼 함수 (Lines 185-244)
```typescript
export function getUIPermissions(role: UserRole, isMobile: boolean = false): UIFeaturePermissions {
  const mode = getInspectionUIMode(role);

  switch (mode) {
    case 'admin-full':
      return {
        showFilters: !isMobile,
        showBulkActions: true,
        showExport: true,
        showScheduling: true,
        showStatistics: true,
        canEditData: true,
        canStartInspection: true
      };
    case 'local-full':
      return {
        showFilters: !isMobile,
        showBulkActions: !isMobile,
        showExport: true,
        showScheduling: true,
        showStatistics: false,
        canEditData: true,
        canStartInspection: true
      };
    case 'read-only':
      return {
        showFilters: !isMobile,
        showBulkActions: false,
        showExport: true,
        showScheduling: false,
        showStatistics: false,
        canEditData: false,
        canStartInspection: false
      };
    case 'assigned-only':
      return {
        showFilters: false,
        showBulkActions: false,
        showExport: false,
        showScheduling: false,
        showStatistics: false,
        canEditData: false,
        canStartInspection: true
      };
  }
}
```

## 2. 페이지 레벨 라우팅

### `/app/(authenticated)/inspection/InspectionPageClient.tsx`
**역할**: 점검 페이지 진입 시 역할별 뷰 컴포넌트 결정

#### 라우팅 로직 (Lines 74-100)
```typescript
const accessRights = ROLE_ACCESS_MATRIX[profile.role];

switch (accessRights.inspectionUIMode) {
  case 'admin-full':
    return <AdminFullView user={profile} isMobile={isMobile} pageType="inspection" />;

  case 'local-full':
    return isMobile ?
      <LocalMobileView user={profile} /> :
      <LocalDesktopView user={profile} />;

  case 'read-only':
    return <ReadOnlyView user={profile} role={profile.role} />;

  case 'assigned-only':
    return <AssignedOnlyView user={profile} />;

  default:
    return <AccessDeniedView role={profile.role} />;
}
```

**렌더링되는 컴포넌트**:
- `admin-full` → AdminFullView
  - master
  - emergency_center_admin
  - regional_emergency_center_admin

- `local-full` → LocalDesktopView / LocalMobileView
  - local_admin

- `read-only` → ReadOnlyView
  - ministry_admin
  - regional_admin

- `assigned-only` → AssignedOnlyView
  - temporary_inspector

- `default` → AccessDeniedView
  - pending_approval
  - email_verified
  - rejected

### `/app/(authenticated)/dashboard/DashboardPageClient.tsx`
**역할**: 대시보드 페이지 진입 시 역할별 대시보드 컴포넌트 결정

#### 라우팅 로직 (Lines 74-100)
```typescript
const dashboardMode = getDashboardUIMode(profile.role);

switch (dashboardMode) {
  case 'admin-full':
    return <AdminFullDashboard user={profile} />;

  case 'local-full':
    return <LocalFullDashboard user={profile} />;

  case 'read-only':
    return <ReadOnlyDashboard user={profile} />;

  case 'inspector-only':
    return <InspectorOnlyDashboard user={profile} />;

  default:
    return <AccessDeniedView role={profile.role} />;
}
```

## 3. 뷰 컴포넌트별 특징

### AdminFullView (관리자 전체 뷰)
**위치**: `/components/inspection/AdminFullView.tsx`
**역할**: master, emergency_center_admin, regional_emergency_center_admin

**특징**:
- 4개 탭: 점검대상, 점검진행중, 점검완료, **임시저장**
- InspectionFilterBar 사용 ("통합검색...", 초기화 버튼 없음)
- 전체 통계 표시
- 일괄 작업 가능
- 데이터 수정 가능

**임시저장 탭** (Lines 530-547):
```typescript
<button
  onClick={() => setViewMode('drafts')}
  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
    viewMode === 'drafts'
      ? 'border-blue-500 text-blue-400'
      : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
  }`}
>
  <div className="flex items-center gap-2">
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2" />
    </svg>
    <span>임시저장</span>
    {draftSessions.length > 0 && (
      <span className="bg-yellow-600 text-white text-xs px-1.5 py-0.5 rounded-full">
        {draftSessions.length}
      </span>
    )}
  </div>
</button>
```

### LocalDesktopView (보건소 데스크톱 뷰)
**위치**: `/components/inspection/LocalDesktopView.tsx` → LocalFullView
**역할**: local_admin

**특징**:
- 3개 탭: 점검대상, 점검진행중, 점검완료 (임시저장 없음)
- InspectionFilterBar 사용 ("통합검색...", 초기화 버튼 없음) ✅ **2025-11-11 수정 완료**
- 소속 지역 데이터만 표시
- 데이터 수정 가능
- 점검 시작 가능

**이전 버전** (수정 전):
```typescript
// ❌ AEDFilterBar 사용 ("검색...", 초기화 버튼 있음)
import { AEDFilterBar } from '@/app/aed-data/components/AEDFilterBar';
```

**현재 버전** (수정 후):
```typescript
// ✅ InspectionFilterBar 사용 (AdminFullView와 동일)
import { InspectionFilterBar } from './InspectionFilterBar';
```

### LocalMobileView (보건소 모바일 뷰)
**위치**: `/components/inspection/LocalMobileView.tsx`
**역할**: local_admin (모바일)

**특징**:
- 단순화된 UI
- 필터 숨김
- 모바일 최적화

### ReadOnlyView (읽기 전용 뷰)
**위치**: 미확인 (추후 조사 필요)
**역할**: ministry_admin, regional_admin

**특징**:
- 데이터 조회만 가능
- 수정/삭제 불가
- 점검 시작 불가

### AssignedOnlyView (배정된 항목만 보기)
**위치**: 미확인 (추후 조사 필요)
**역할**: temporary_inspector

**특징**:
- 자신에게 배정된 항목만 표시
- 필터 숨김
- 점검 시작만 가능

## 4. 필터 바 컴포넌트 차이

### InspectionFilterBar (점검 페이지용)
**위치**: `/components/inspection/InspectionFilterBar.tsx`
**사용처**: AdminFullView, LocalFullView (점검 페이지)

**특징**:
- 검색창 placeholder: "통합검색..."
- 조회 버튼만 존재
- 초기화 버튼 없음
- 단순화된 UI

### AEDFilterBar (일정관리 페이지용)
**위치**: `/app/aed-data/components/AEDFilterBar.tsx`
**사용처**: AED 데이터 관리, 일정관리 페이지

**특징**:
- 검색창 placeholder: "검색..."
- 조회 + 초기화 버튼
- 더 많은 필터 옵션
- 복잡한 UI

## 5. API 레벨 권한 제어

### `/app/api/aed-data/route.ts`
**역할**: 데이터 조회 시 역할별 접근 제어

#### 지역 필터링 (Lines 180-210)
```typescript
// 관리자가 아닌 경우 자신의 지역만 조회 가능
if (!isAdminRole(profile.role)) {
  // local_admin, temporary_inspector는 소속 지역 제한
  sqlConditions.push(`d.region_code = '${profile.region_code}'`);
  if (profile.city_code) {
    sqlConditions.push(`d.city_code = '${profile.city_code}'`);
  }
}
```

#### 점검 상태 필터링 (Lines 380-390)
```typescript
// viewMode에 따른 필터링
if (viewMode === 'inspection') {
  if (tabMode === 'pending') {
    sqlConditions.push(`ia.status = 'pending'`);
  } else if (tabMode === 'in_progress') {
    sqlConditions.push(`ia.status = 'in_progress'`);
  } else if (tabMode === 'completed') {
    sqlConditions.push(`ia.status = 'completed'`);
  }
}
```

## 6. 역할별 UI 차이 요약표

| 역할 | inspectionUIMode | 컴포넌트 | 탭 수 | 필터 바 | 임시저장 | 수정 | 통계 |
|------|------------------|----------|-------|---------|----------|------|------|
| master | admin-full | AdminFullView | 4 | InspectionFilterBar | ✅ | ✅ | ✅ |
| emergency_center_admin | admin-full | AdminFullView | 4 | InspectionFilterBar | ✅ | ✅ | ✅ |
| regional_emergency_center_admin | admin-full | AdminFullView | 4 | InspectionFilterBar | ✅ | ✅ | ✅ |
| ministry_admin | read-only | ReadOnlyView | ? | ? | ❌ | ❌ | ❌ |
| regional_admin | read-only | ReadOnlyView | ? | ? | ❌ | ❌ | ❌ |
| local_admin | local-full | LocalFullView | 3 | InspectionFilterBar | ❌ | ✅ | ❌ |
| temporary_inspector | assigned-only | AssignedOnlyView | ? | 없음 | ❌ | ❌ | ❌ |

## 7. 중요한 발견 사항

### 2025-11-11 UI 통일 작업
**문제**: local_admin과 admin 계정이 다른 필터 바를 사용하여 UI 불일치 발생
- AdminFullView: InspectionFilterBar ("통합검색...")
- LocalFullView: AEDFilterBar ("검색...", 초기화 버튼)

**해결**: LocalFullView를 InspectionFilterBar로 변경
- 검색창 placeholder 통일: "통합검색..."
- 초기화 버튼 제거 (일관성)
- 권한 차이만 유지 (임시저장 탭은 관리자만)

**원칙**:
- **권한에 따른 기능 차이는 당연함** (예: 임시저장 탭)
- **같은 기능은 같은 UI로 제공** (예: 검색, 필터)
- **역할별 차이는 role-matrix.ts에서만 관리**

## 8. 향후 개선 방향

1. **ReadOnlyView, AssignedOnlyView 컴포넌트 문서화**
   - 현재 위치 확인 필요
   - 실제 렌더링 내용 파악 필요

2. **모바일 뷰 통일성 검토**
   - LocalMobileView와 AdminFullView (모바일) 비교 필요

3. **필터 바 컴포넌트 리팩토링 검토**
   - InspectionFilterBar와 AEDFilterBar의 공통 로직 추출 가능성

4. **역할 기반 테스트 케이스 작성**
   - 각 역할별 접근 가능 경로 자동 테스트

## 9. 관련 문서

- [CLAUDE.md - 핵심 권한 체계](../../CLAUDE.md#3-핵심-권한-체계-절대-불변)
- [role-matrix.ts](../../lib/auth/role-matrix.ts) - 중앙 권한 설정
- [REGION_CODE_GUIDELINES.md](REGION_CODE_GUIDELINES.md) - 지역 코드 가이드라인

---

**마지막 업데이트**: 2025-11-11
**작성자**: AI Assistant (Claude)
**검토자**: 이광성 (truth0530@nmc.or.kr)
