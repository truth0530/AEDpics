# 컴포넌트 이원화 문제 분석 보고서

## 1. 요약

**문제**: 사용자 역할별로 다른 컴포넌트를 사용하는 구조로 인해, 공통 기능 버그 수정 시 일부 컴포넌트에서만 수정되고 다른 컴포넌트에서 누락되는 문제 발생

**영향 범위**: local_admin 사용자가 점검이력을 조회할 수 없었던 버그 (2025-11-11 발견 및 수정)

**근본 원인**: 역할 기반 UI 분리 설계 (Role-Based UI Fragmentation)

---

## 2. 현재 아키텍처

### 2.1 역할별 UI 모드 매핑 (lib/auth/role-matrix.ts)

```typescript
inspectionUIMode 구분:
- 'admin-full'     → AdminFullView (master, emergency_center_admin, regional_emergency_center_admin)
- 'local-full'     → LocalFullView (local_admin - 보건소 담당자)
- 'read-only'      → ReadOnlyView (ministry_admin, regional_admin)
- 'assigned-only'  → AssignedOnlyView (temporary_inspector)
```

### 2.2 컴포넌트 렌더링 로직 (InspectionPageClient.tsx)

```typescript
switch (accessRights.inspectionUIMode) {
  case 'admin-full':
    return <AdminFullView />;      // 전체 관리자용

  case 'local-full':
    return isMobile
      ? <LocalMobileView />         // 보건소 담당자용 (모바일)
      : <LocalDesktopView />;       // 보건소 담당자용 (데스크톱)

  case 'read-only':
    return <ReadOnlyView />;        // 조회 전용

  case 'assigned-only':
    return <AssignedOnlyView />;    // 임시 점검자용
}
```

### 2.3 파일 구조

```
components/inspection/
├── AdminFullView.tsx          # 전체 관리자용 (완전 기능)
├── LocalFullView.tsx          # 보건소 담당자용 (제한된 기능)
│   ├── LocalMobileView        # 모바일 버전
│   └── LocalDesktopView       # 데스크톱 버전
├── ReadOnlyView.tsx           # 조회 전용
└── AssignedOnlyView.tsx       # 임시 점검자용
```

---

## 3. 문제 발생 과정 (2025-11-11)

### 3.1 초기 상황
- **버그**: local_admin 사용자가 "점검이력" 탭에서 완료된 점검을 볼 수 없음
- **데이터**: 서귀포시 보건소 관할 4건의 pass 점검이 DB에 존재

### 3.2 수정 과정
1. `AdminFullView.tsx`에 점검이력 조회 기능 추가 시도
2. local_admin이 AdminFullView가 아닌 **LocalFullView**를 사용한다는 것을 뒤늦게 발견
3. 결국 LocalFullView.tsx에 동일한 수정 작업 수행

### 3.3 문제점
- 같은 기능을 두 곳에 구현해야 함 (AdminFullView, LocalFullView)
- 한 곳만 수정하면 다른 컴포넌트 사용자는 여전히 버그 발생
- 코드 중복 및 유지보수 비용 증가

---

## 4. 설계 의도 및 배경

### 4.1 왜 이렇게 설계되었는가?

**장점**:
1. **역할별 완전히 다른 UX 제공**
   - master: 전국 데이터 조회, 통계, 관리자 기능 모두 접근
   - local_admin: 소속 지역만 조회, 제한된 관리 기능
   - temporary_inspector: 배정받은 AED만 점검 가능

2. **권한 분리 명확화**
   - 각 컴포넌트가 독립적으로 권한 체크 수행
   - 역할별로 표시되는 정보와 버튼이 완전히 다름

3. **보안 강화**
   - 권한 없는 사용자는 해당 컴포넌트 자체를 로드하지 않음

### 4.2 초기 개발 시점의 합리성

- 역할이 적고 기능이 단순할 때는 관리 가능
- 각 역할의 요구사항이 명확히 구분될 때 효과적
- 빠른 프로토타이핑에 유리

---

## 5. 현재 문제점

### 5.1 코드 중복 (DRY 원칙 위반)

**점검이력 조회 기능이 중복 구현됨**:
- `AdminFullView.tsx` Lines 199-213: handleViewInspectionHistory
- `LocalFullView.tsx` Lines 67-84: useQuery for inspection history

### 5.2 버그 전파 위험

**시나리오**:
1. AdminFullView에서 새 기능 추가
2. LocalFullView에 동일 기능 추가를 누락
3. local_admin 사용자만 기능 사용 불가
4. 버그 리포트 및 재수정 필요

### 5.3 테스트 부담

- 동일한 기능을 4개 컴포넌트에서 각각 테스트해야 함
- 회귀 테스트 범위 증가
- QA 비용 증가

### 5.4 신규 개발자 혼란

- "왜 여러 컴포넌트에 같은 코드가 있지?"
- "어느 컴포넌트를 수정해야 하지?"
- 역할 매핑을 이해해야만 올바른 수정 가능

---

## 6. 근본 원인 분석

### 6.1 아키텍처 패턴 선택 실수

**현재 패턴**: 컴포넌트 분리 (Component-Based Separation)
- 역할마다 완전히 다른 컴포넌트 사용
- 공통 로직도 각 컴포넌트 내부에 중복 구현

**올바른 패턴**: 기능 기반 조합 (Feature-Based Composition)
- 하나의 기본 컴포넌트 + 역할별 권한으로 기능 제어
- 공통 로직은 shared hooks/utils로 추출

### 6.2 역할과 기능의 혼동

**잘못된 사고방식**:
- "역할이 다르다 = 컴포넌트가 달라야 한다"

**올바른 사고방식**:
- "역할이 다르다 = 같은 컴포넌트에서 보이는 기능이 달라야 한다"

---

## 7. 개선 방안

### 7.1 단기 해결책 (현재 구조 유지)

**공통 로직 추출**:
```typescript
// lib/hooks/useInspectionHistory.ts (신규)
export function useInspectionHistory(mode: 'address' | 'jurisdiction', hours: number = 720) {
  return useQuery({
    queryKey: ['inspection-history', mode, hours],
    queryFn: () => getInspectionHistory(undefined, hours, mode),
    // ... 공통 설정
  });
}
```

**각 컴포넌트에서 사용**:
```typescript
// AdminFullView.tsx
const { data: historyData } = useInspectionHistory('address', 720);

// LocalFullView.tsx
const { data: historyData } = useInspectionHistory('jurisdiction', 720);
```

**장점**:
- 기존 컴포넌트 구조 유지
- 로직 중복 제거
- 버그 수정이 한 곳에서만 필요

**단점**:
- 근본적인 구조 문제는 해결되지 않음
- 새 기능 추가 시 여전히 여러 곳 수정 필요

### 7.2 중기 해결책 (조건부 렌더링)

**하나의 컴포넌트로 통합**:
```typescript
// InspectionView.tsx (통합)
export function InspectionView({ user }: { user: UserProfile }) {
  const accessRights = ROLE_ACCESS_MATRIX[user.role];
  const uiMode = accessRights.inspectionUIMode;

  // 공통 데이터 로딩
  const { data: historyData } = useInspectionHistory(
    uiMode === 'local-full' ? 'jurisdiction' : 'address',
    720
  );

  return (
    <>
      {/* 공통 헤더 */}
      <InspectionHeader user={user} />

      {/* 역할별 조건부 렌더링 */}
      {uiMode === 'admin-full' && <AdminControls />}
      {uiMode === 'local-full' && <LocalControls />}

      {/* 공통 데이터 테이블 */}
      <DataTable
        data={historyData}
        showActions={uiMode !== 'read-only'}
      />
    </>
  );
}
```

**장점**:
- 로직 완전 통합
- 새 기능 추가 시 한 곳에서만 수정
- 테스트 범위 축소

**단점**:
- 대규모 리팩토링 필요
- 기존 컴포넌트 완전 교체 필요
- 회귀 테스트 전체 수행 필요

### 7.3 장기 해결책 (컴포넌트 조합 패턴)

**컴포저블 컴포넌트 구조**:
```typescript
// components/inspection/
├── InspectionLayout.tsx           # 공통 레이아웃
├── features/
│   ├── InspectionHistory.tsx      # 점검이력 (공통)
│   ├── InspectionScheduling.tsx   # 스케줄링 (공통)
│   ├── AdminStatistics.tsx        # 통계 (admin-full only)
│   └── BulkActions.tsx            # 일괄작업 (admin-full, local-full)
└── InspectionPage.tsx             # 역할별 조합

// InspectionPage.tsx
export function InspectionPage({ user }: { user: UserProfile }) {
  const permissions = getUIPermissions(user.role);

  return (
    <InspectionLayout user={user}>
      <InspectionHistory mode={permissions.dataMode} />

      {permissions.showStatistics && <AdminStatistics />}
      {permissions.showBulkActions && <BulkActions />}
      {permissions.showScheduling && <InspectionScheduling />}
    </InspectionLayout>
  );
}
```

**장점**:
- 완전한 재사용성
- 새 역할 추가 시 조합만 변경
- 각 feature 독립적 테스트 가능
- 유지보수 비용 최소화

**단점**:
- 대규모 아키텍처 변경 필요
- 개발 시간 상당히 소요
- 전체 시스템 영향 범위 큼

---

## 8. 권장 실행 계획

### Phase 1: 즉시 실행 (1-2주)
1. 공통 로직을 custom hooks로 추출
   - `useInspectionHistory.ts`
   - `useInspectionActions.ts`
   - `useFilterState.ts`

2. 각 컴포넌트에서 hooks 사용하도록 수정

3. 단위 테스트 작성

### Phase 2: 단기 목표 (1-2개월)
1. 조건부 렌더링 방식으로 통합 시작
   - AdminFullView + LocalFullView 먼저 통합
   - 점검이력 기능부터 시작

2. 통합 테스트 및 회귀 테스트

3. 프로덕션 배포 및 모니터링

### Phase 3: 중장기 목표 (3-6개월)
1. 컴포저블 컴포넌트 구조로 완전 전환

2. 모든 역할에 대한 통합 완료

3. 레거시 컴포넌트 제거

---

## 9. 중앙시스템 준수 현황

### 9.1 검증 결과 (✅ 양호)

**지역명 관리**:
- ✅ `lib/constants/regions.ts`를 중앙 관리 파일로 사용
- ✅ 하드코딩된 지역명 검색 결과: 0건
- ✅ 모든 파일에서 REGION_LABELS import하여 사용

**도시/시군구 관리**:
- ✅ `lib/constants/cities.ts`를 중앙 관리 파일로 사용
- ✅ `getCitiesByRegion()` 함수로 동적 조회
- ✅ city_code 하드코딩 없음

**관할보건소명 관리**:
- ✅ `normalizeJurisdictionName()` 함수 중앙 정의
- ✅ 구군명 중복 패턴 처리 로직 통합
- ✅ 모든 API에서 동일한 정규화 함수 사용

### 9.2 발견된 예외 (🟡 허용 가능)

**AEDFilterBar.tsx Line 279**:
```typescript
if (gugun === '구군')  // UI placeholder 비교
```

**평가**: 허용 가능
- 이유: UI 플레이스홀더 값 비교 (데이터가 아님)
- 영향: 없음 (사용자 경험 관련)
- 권장사항: 상수로 추출하면 더 명확 (`const GUGUN_PLACEHOLDER = '구군'`)

---

## 10. 결론

### 10.1 중앙시스템 준수
- **평가**: 양호 (Good)
- **위반 사항**: 0건
- **권장 개선**: 1건 (UI placeholder 상수화)

### 10.2 컴포넌트 이원화 문제
- **평가**: 심각 (Critical)
- **우선순위**: 높음 (High Priority)
- **권장 조치**: Phase 1 즉시 실행 (공통 로직 hooks 추출)

### 10.3 교훈

**"역할이 다르다고 컴포넌트를 분리하는 것은 안티패턴이다"**

올바른 접근:
- 하나의 컴포넌트 + 역할별 권한으로 기능 제어
- 공통 로직은 재사용 가능한 모듈로 추출
- 조건부 렌더링으로 UI 차별화

---

## 부록 A: 영향받는 파일 목록

```
lib/auth/role-matrix.ts                    # 역할별 UI 모드 정의
app/(authenticated)/inspection/
  └── InspectionPageClient.tsx             # 역할별 컴포넌트 라우팅
components/inspection/
  ├── AdminFullView.tsx                    # 전체 관리자용
  ├── LocalFullView.tsx                    # 보건소 담당자용
  ├── ReadOnlyView.tsx                     # 조회 전용
  └── AssignedOnlyView.tsx                 # 임시 점검자용
lib/inspections/session-utils.ts          # 공통 로직 (추출 대상)
app/api/inspections/history/route.ts      # API (중앙시스템 준수)
```

---

**작성일**: 2025-11-11
**작성자**: Claude Code
**버전**: 1.0.0
**다음 검토 예정**: Phase 1 완료 후
