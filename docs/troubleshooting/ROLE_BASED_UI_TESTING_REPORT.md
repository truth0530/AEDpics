# 역할별 UI 테스트 보고서

**작성일**: 2025-11-11
**테스트 수행**: Claude Code + Playwright MCP
**목적**: 2개 계정의 권한별 컴포넌트 차이 및 정책 위반 사항 검증

---

## 1. 테스트 개요

### 테스트 계정

| 계정 | 역할 | 소속 | 권한 레벨 |
|------|------|------|----------|
| kha115@korea.kr | local_admin | 제주 서귀포시 보건소 | 시군구 권한 |
| nemcdg@nmc.or.kr | regional_emergency_center_admin | 대구광역시 응급의료센터 | 시도 권한 |

### 테스트 시나리오

1. 서귀포 보건소 계정으로 로그인 → 점검이력 확인
2. 로그아웃
3. 대구센터 계정으로 로그인 → 제주 서귀포시로 지역 변경 → 점검이력 확인
4. 두 계정의 UI, 기능, 데이터 비교

---

## 2. 테스트 결과

### 2.1 컴포넌트 사용 차이

| 항목 | local_admin | regional_emergency_center_admin |
|------|-------------|--------------------------------|
| **컴포넌트** | LocalFullView | AdminFullView |
| **파일 위치** | components/inspection/LocalFullView.tsx | components/inspection/AdminFullView.tsx |
| **콘솔 로그** | `[LocalFullView] 점검이력 조회 완료: 4개` | `[AdminFullView Debug] 필터링 후 최종 레코드 수: 4` |

### 2.2 UI 차이 비교

#### 탭 메뉴

**local_admin (3개 탭)**:
- 점검대상
- 지도
- 점검이력

**regional_emergency_center_admin (4개 탭)**:
- 점검대상
- 지도
- 점검이력
- **임시저장** ← 추가 탭!

#### 점검이력 UI 디자인

**local_admin - 카드 형태**:
```
┌─────────────────────────────────┐
│ 장비번호: 29-0001225            │
│ 점검일시: 2025. 11. 10. 오후 2:27:10 │
│ 위치: 제주 서귀포시              │
│ 상태:                           │
└─────────────────────────────────┘
```

**regional_emergency_center_admin - 테이블 형태**:
```
┌──────────┬────────────┬──────┬──────────┬──────┬────────┐
│ 장비번호 │ 점검일시   │ 점검자│ 시도/구군│ 상태 │ 작업   │
├──────────┼────────────┼──────┼──────────┼──────┼────────┤
│29-0001469│25.11.10 09:00│고현아│제주 서귀포시│합격│👁️ 🗑️  │
└──────────┴────────────┴──────┴──────────┴──────┴────────┘
```

#### 추가 기능

**local_admin**: 없음

**regional_emergency_center_admin**:
- 엑셀다운로드 버튼
- 상세 정보 보기 버튼
- 삭제 버튼 (disabled: "마스터만 가능")

### 2.3 표시된 데이터 (동일)

두 계정 모두 같은 4건의 점검이력 표시:

| 장비번호 | 점검일시 | 점검자 | 위치 | 상태 |
|---------|---------|--------|------|------|
| 29-0001469 | 2025. 11. 10. 오전 09:00 | 고현아 | 제주 서귀포시 | 합격 |
| 29-0000945 | 2025. 11. 10. 오전 09:00 | 고현아 | 제주 서귀포시 | 합격 |
| 29-0001225 | 2025. 11. 10. 오전 09:00 | 고현아 | 제주 서귀포시 | 합격 |
| 29-0001388 | 2025. 11. 10. 오전 09:00 | 고현아 | 제주 서귀포시 | 합격 |

### 2.4 권한 제어 차이

| 기능 | local_admin | regional_emergency_center_admin |
|------|-------------|--------------------------------|
| **지역 선택** | 고정 (제주-서귀포시, disabled) | 자유 선택 가능 ← 문제! |
| **데이터 삭제** | 가능 (자신이 점검한 데이터) | 불가 (마스터만 가능) |
| **엑셀 다운로드** | 없음 | 있음 |
| **임시저장** | 탭 없음 | 탭 있음 |

---

## 3. 발견된 문제점

### 3.1 정책 위반: 시도 권한 범위 초과

**문제 상황**:
- regional_emergency_center_admin (대구센터) 계정이 제주 데이터 조회 가능
- 지역 선택 드롭다운에서 17개 시도 모두 선택 가능

**CLAUDE.md 정책**:
```
시도 권한 (소속 시도 고정, 시군구 선택 가능)
- @korea.kr 중 시청/도청: 소속 시도 고정 표시, 해당 시도 내 시군구 자유 선택 또는 "전체"
```

**예상 동작**:
- 대구센터는 **대구광역시 데이터만** 볼 수 있어야 함
- 제주 선택 자체가 불가능해야 함

**실제 동작**:
- 17개 시도 모두 선택 가능
- 제주 서귀포시 데이터 조회 가능

**심각도**: 🔴 Critical (권한 정책 위반)

### 3.2 컴포넌트 이원화로 인한 유지보수 문제

**문제**:
- 같은 "점검이력 조회" 기능이 두 개의 다른 컴포넌트에 중복 구현됨
- LocalFullView와 AdminFullView가 완전히 다른 UI와 로직 사용

**영향**:
- 버그 수정 시 두 곳 모두 수정 필요
- 한 곳만 수정하면 다른 역할 사용자는 버그 지속
- 실제 사례: 2025-11-11 점검이력 조회 버그 (AdminFullView만 수정 → LocalFullView 누락)

**심각도**: 🟡 High (유지보수 리스크)

### 3.3 UI 일관성 부재

**문제**:
- 같은 데이터를 보는데 역할에 따라 완전히 다른 UI
- 카드 vs 테이블 디자인
- 3개 탭 vs 4개 탭

**영향**:
- 사용자 경험 혼란
- 교육 비용 증가
- QA 테스트 범위 증가

**심각도**: 🟢 Medium (UX 문제)

---

## 4. 근본 원인 분석

### 4.1 아키텍처 설계 문제

**현재 패턴**: 역할별 컴포넌트 분리
```typescript
// InspectionPageClient.tsx
switch (accessRights.inspectionUIMode) {
  case 'admin-full':
    return <AdminFullView />;      // 전체 관리자용
  case 'local-full':
    return <LocalFullView />;      // 보건소 담당자용
  case 'read-only':
    return <ReadOnlyView />;       // 조회 전용
  case 'assigned-only':
    return <AssignedOnlyView />;   // 임시 점검자용
}
```

**문제점**:
- 공통 로직이 각 컴포넌트 내부에 중복 구현
- 권한 체크 로직 분산
- UI 일관성 유지 어려움

### 4.2 권한 매트릭스 구현 불완전

**lib/auth/role-matrix.ts**:
```typescript
regional_emergency_center_admin: {
  inspectionUIMode: 'admin-full',  // ← AdminFullView 사용
  scopeLevel: 'regional',           // ← 시도 레벨
  // ...하지만 실제 지역 제한은 구현되지 않음!
}
```

**문제**:
- scopeLevel은 정의되어 있지만 실제 UI에서 강제되지 않음
- AdminFullView가 전국 데이터 조회 가능하도록 구현됨
- 권한 체크가 API 레벨에서만 일부 수행됨

---

## 5. 권장 해결 방안

### 5.1 즉시 조치 (Critical)

**권한 정책 위반 수정**:

```typescript
// components/inspection/AdminFullView.tsx
function AdminFullView({ user }: { user: UserProfile }) {
  const accessRights = ROLE_ACCESS_MATRIX[user.role];

  // 시도 권한 제한 적용
  const allowedRegions = accessRights.scopeLevel === 'regional'
    ? [user.region_code]  // 소속 시도만 허용
    : undefined;          // 전국 허용 (master, emergency_center_admin)

  return (
    <InspectionFilterBar
      allowedRegions={allowedRegions}  // 드롭다운 옵션 제한
      // ...
    />
  );
}
```

**검증 방법**:
1. 대구센터 계정 로그인
2. 지역 선택 드롭다운 확인
3. "대구광역시"만 표시되어야 함
4. 제주, 서울 등 다른 시도 선택 불가 확인

### 5.2 단기 조치 (1-2주)

**공통 로직 추출**:

```typescript
// lib/hooks/useInspectionHistory.ts (신규 생성)
export function useInspectionHistory(
  mode: 'address' | 'jurisdiction',
  hours: number = 720
) {
  return useQuery({
    queryKey: ['inspection-history', mode, hours],
    queryFn: () => getInspectionHistory(undefined, hours, mode),
    refetchInterval: 30000,
  });
}

// AdminFullView.tsx에서 사용
const { data: historyData } = useInspectionHistory('address', 720);

// LocalFullView.tsx에서 사용
const { data: historyData } = useInspectionHistory('jurisdiction', 720);
```

### 5.3 중장기 조치 (1-3개월)

**컴포넌트 통합**:

1. 조건부 렌더링 방식으로 통합
2. 공통 InspectionView 컴포넌트 생성
3. 역할별 기능 차이는 props로 제어
4. UI는 동일하게 유지 (테이블 형태로 통일)

---

## 6. 테스트 증거 자료

### 스크린샷

1. **local_admin_inspection_history.png**
   - 카드 형태 UI
   - 3개 탭
   - 4건 점검이력 표시

2. **regional_admin_inspection_history.png**
   - 테이블 형태 UI
   - 4개 탭 (임시저장 추가)
   - 엑셀다운로드 버튼
   - 4건 점검이력 표시 (동일 데이터)

### 콘솔 로그 증거

**local_admin**:
```
[LocalFullView] 점검이력 조회 완료: 4개
[LocalFullView] getInspectionHistory API 호출 시작: jurisdiction 모드, 720시간
```

**regional_emergency_center_admin**:
```
[AdminFullView Debug] === 점검이력 로드 시작 ===
[AdminFullView Debug] user.role: regional_emergency_center_admin
[AdminFullView Debug] filterMode: address
[AdminFullView Debug] filters.regionCodes: [JEJ]
[AdminFullView Debug] filters.cityCodes: [서귀포시]
[AdminFullView Debug] API 응답 레코드 수: 31
[AdminFullView Debug] 필터링 후 최종 레코드 수: 4
```

---

## 7. 결론

### 7.1 핵심 발견

1. **정책 위반 확인**: 시도 권한이 전국 데이터 조회 가능 (Critical)
2. **컴포넌트 이원화 확인**: 같은 기능을 두 곳에서 다르게 구현 (High)
3. **UI 불일치 확인**: 역할별로 완전히 다른 사용자 경험 (Medium)

### 7.2 우선순위

1. **P0 (즉시)**: 권한 정책 위반 수정 - 시도 권한 제한 구현
2. **P1 (1주)**: 공통 로직 hooks로 추출
3. **P2 (1개월)**: 컴포넌트 통합 계획 수립
4. **P3 (3개월)**: 완전한 컴포넌트 통합 완료

### 7.3 교훈

**"역할이 다르다고 컴포넌트를 분리하는 것은 안티패턴이다"**

올바른 접근:
- 하나의 컴포넌트 + 역할별 권한으로 기능 제어
- 공통 로직은 재사용 가능한 모듈로 추출
- 조건부 렌더링으로 UI 차별화
- 권한은 props와 context로 전달

---

**다음 액션**:
1. 권한 정책 위반 수정 PR 생성
2. 공통 hooks 추출 작업 시작
3. 컴포넌트 통합 로드맵 작성

**관련 문서**:
- [COMPONENT_FRAGMENTATION_ANALYSIS.md](COMPONENT_FRAGMENTATION_ANALYSIS.md)
- [CLAUDE.md - 권한 체계](../../CLAUDE.md#3-핵심-권한-체계-절대-불변)
- [role-matrix.ts](../../lib/auth/role-matrix.ts)
