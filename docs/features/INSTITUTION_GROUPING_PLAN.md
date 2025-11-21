# 의무기관 중복 통합 기능 구현 계획

## 1. 개요

### 1.1 배경
- 29,000여개의 의무기관 중 동일 기관이 여러 개로 분리되어 있음
- 현재는 각 기관을 개별적으로 매칭해야 하는 비효율적인 프로세스
- 중복된 기관을 먼저 그룹핑한 후 일괄 매칭하면 작업 효율성 대폭 향상

### 1.2 목표
- 섹션 1 내에서 중복 기관을 자동으로 그룹핑
- 그룹 단위로 일괄 매칭 처리
- 기존 개별 매칭 기능 유지
- 직관적이고 효율적인 UI/UX 제공

## 2. 기능 상세 설계

### 2.1 그룹핑 알고리즘

#### 유사도 계산 기준
```typescript
interface SimilarityFactors {
  // 1. 기관명 유사도 (가중치 40%)
  nameDistance: number;  // Levenshtein distance

  // 2. 주소 일치도 (가중치 30%)
  sidoMatch: boolean;    // 시도 일치
  gugunMatch: boolean;   // 구군 일치

  // 3. 관리번호 패턴 (가중치 20%)
  prefixMatch: boolean;  // 관리번호 앞 3자리

  // 4. 장비 수 유사도 (가중치 10%)
  equipmentCountRatio: number;  // 장비 수 비율
}

// 그룹핑 임계값
const GROUPING_THRESHOLD = 0.85; // 85% 이상 유사도
```

#### 기관명 정규화
```typescript
function normalizeInstitutionName(name: string): string {
  return name
    .replace(/\s+/g, '')           // 공백 제거
    .replace(/[\(\)]/g, '')        // 괄호 제거
    .replace(/대학교병원|대병원|병원/g, '병원')  // 통일
    .replace(/센터|센타/g, '센터')   // 표기 통일
    .toLowerCase();
}
```

### 2.2 UI 컴포넌트 구조

#### 그룹 표시 컴포넌트
```tsx
interface InstitutionGroup {
  groupId: string;
  masterInstitution: TargetInstitution;  // 대표 기관
  members: TargetInstitution[];           // 그룹 멤버
  similarity: number;                     // 평균 유사도
  totalEquipment: number;                 // 총 장비 수
}

// 그룹 헤더 컴포넌트
<GroupHeader
  group={group}
  isExpanded={isExpanded}
  isSelected={isSelected}
  onToggle={handleToggle}
  onSelect={handleSelect}
/>

// 그룹 멤버 리스트
<GroupMemberList
  members={group.members}
  selectedMembers={selectedMembers}
  onSelectMember={handleSelectMember}
/>
```

### 2.3 상태 관리

```typescript
// 그룹핑 관련 상태
interface GroupingState {
  isGroupingEnabled: boolean;
  groups: Map<string, InstitutionGroup>;
  selectedGroups: Set<string>;
  selectedIndividuals: Set<string>;
  groupingProgress: number;  // 0-100
}

// Redux/Zustand Store
const useGroupingStore = create((set) => ({
  // 상태
  isGroupingEnabled: false,
  groups: new Map(),

  // 액션
  enableGrouping: () => set({ isGroupingEnabled: true }),
  disableGrouping: () => set({ isGroupingEnabled: false }),
  setGroups: (groups) => set({ groups }),
  selectGroup: (groupId) => set((state) => ({
    selectedGroups: new Set([...state.selectedGroups, groupId])
  })),
}));
```

## 3. 사용자 워크플로우

### 3.1 그룹핑 모드 활성화
1. 섹션 1 상단의 "중복 기관 그룹핑" 토글 ON
2. 자동으로 유사 기관 분석 시작 (프로그레스바 표시)
3. 그룹핑 완료 후 그룹별로 재정렬된 리스트 표시

### 3.2 그룹 단위 매칭
```
Step 1: 그룹 선택
  - 그룹 헤더 체크박스 클릭
  - 또는 "유사 그룹 전체 선택" 버튼

Step 2: 매칭 후보 검색
  - "그룹 매칭 검색" 버튼 클릭
  - 섹션 2에 그룹 전체에 대한 최적 매칭 표시

Step 3: 바스켓 추가
  - "그룹 전체 담기" 또는 개별 선택
  - 바스켓에서 최종 검토

Step 4: 일괄 매칭 실행
  - "선택 항목 일괄 매칭" 버튼
  - 진행 상황 모달 표시
```

### 3.3 개별 처리 (기존 방식 유지)
- 그룹핑 모드 OFF 시 기존 워크플로우 그대로 사용
- 그룹 내에서도 개별 기관 선택 가능

## 4. API 설계

### 4.1 그룹핑 분석 API
```typescript
// POST /api/compliance/analyze-groups
interface AnalyzeGroupsRequest {
  year: string;
  sido?: string;
  gugun?: string;
  threshold?: number;  // 기본값 0.85
}

interface AnalyzeGroupsResponse {
  groups: InstitutionGroup[];
  ungrouped: TargetInstitution[];
  stats: {
    totalInstitutions: number;
    groupedInstitutions: number;
    groupCount: number;
    averageGroupSize: number;
  };
}
```

### 4.2 일괄 매칭 API
```typescript
// POST /api/compliance/batch-match
interface BatchMatchRequest {
  groupId?: string;
  institutionKeys: string[];
  managementNumbers: string[];
  year: string;
}

interface BatchMatchResponse {
  success: boolean;
  matched: number;
  failed: number;
  details: MatchResult[];
}
```

## 5. 성능 최적화

### 5.1 그룹핑 처리
- 백그라운드 워커에서 처리
- 청크 단위로 나누어 처리 (1,000개씩)
- 결과 캐싱 (5분 유효)

### 5.2 UI 최적화
- Virtual scrolling for large lists
- Lazy loading for group members
- Debounced search and filter

## 6. 구현 일정

### Phase 1: 백엔드 (3일)
- [ ] Day 1: 유사도 계산 알고리즘 구현
- [ ] Day 2: 그룹핑 API 개발
- [ ] Day 3: 일괄 매칭 API 개발

### Phase 2: 프론트엔드 (4일)
- [ ] Day 1: 그룹 표시 UI 컴포넌트
- [ ] Day 2: 그룹 선택/해제 인터랙션
- [ ] Day 3: 상태 관리 및 API 연동
- [ ] Day 4: 기존 워크플로우 통합

### Phase 3: 테스트 및 배포 (2일)
- [ ] Day 1: 통합 테스트 및 버그 수정
- [ ] Day 2: 성능 최적화 및 배포

## 7. 기대 효과

### 정량적 효과
- 중복 기관 매칭 시간: 70% 감소
- 클릭 수: 평균 50% 감소
- 처리 가능 기관 수: 시간당 3배 증가

### 정성적 효과
- 사용자 피로도 감소
- 실수 가능성 감소
- 작업 만족도 향상

## 8. 향후 발전 방향

### 8.1 AI 기반 자동 그룹핑
- 머신러닝 모델로 그룹핑 정확도 향상
- 과거 매칭 이력 학습

### 8.2 스마트 추천
- 그룹별 최적 매칭 자동 제안
- 신뢰도 기반 자동 매칭

### 8.3 협업 기능
- 그룹별 담당자 지정
- 매칭 이력 및 코멘트 공유

## 9. 위험 요소 및 대응

### 9.1 잘못된 그룹핑
- 리스크: 서로 다른 기관이 같은 그룹으로 묶임
- 대응: 수동 그룹 해제 기능, 그룹핑 이력 추적

### 9.2 성능 저하
- 리스크: 29,000개 데이터 처리 시 브라우저 멈춤
- 대응: 페이지네이션, 가상 스크롤, 웹 워커 활용

### 9.3 사용자 혼란
- 리스크: 복잡한 UI로 인한 사용성 저하
- 대응: 단계별 가이드, 툴팁, 비디오 튜토리얼

## 10. 참고 자료

- 기존 컴포넌트 위치:
  - `/components/admin/compliance/InstitutionListPanel.tsx`
  - `/components/admin/compliance/ComplianceMatchingWorkflow.tsx`
- Levenshtein Distance 구현: `fuse.js` 라이브러리 활용
- Virtual Scrolling: `react-window` 라이브러리 활용