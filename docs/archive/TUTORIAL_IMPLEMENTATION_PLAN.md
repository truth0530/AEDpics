# 인터랙티브 튜토리얼 가이드 구현 계획

## 📋 개요
사용자가 실제 시스템 사용법을 단계별로 학습할 수 있도록 인터랙티브 튜토리얼 구현

## 🎯 핵심 기능
- 화면 전체 어두운 오버레이 (backdrop)
- 현재 단계에서 클릭해야 할 요소만 spotlight (밝게 강조)
- 해당 요소를 클릭해야만 다음 단계로 진행
- 각 단계마다 안내 말풍선/툴팁 표시

## 📝 튜토리얼 단계 시나리오

### 일정관리 페이지 (Step 1-6)

| Step | 강조 요소 | 안내 메시지 | 액션 |
|------|----------|------------|------|
| 1 | 사이드바 "일정관리" 버튼 | "먼저 일정관리 메뉴를 클릭하세요" | 클릭 → Step 2 |
| 2 | 구군 드롭다운 필터 | "구군 필터를 클릭하여 지역을 선택하세요" | 클릭 → Step 3 |
| 3 | 첫 번째 장비 체크박스 | "장비를 선택하려면 체크박스를 클릭하세요" | 클릭 → Step 4 |
| 4 | "추가" 버튼 | "추가 버튼을 클릭하여 일정에 추가하세요" | 클릭 → Step 5 |
| 5 | "추가된 목록" 탭 | "추가된 목록 탭을 클릭하여 확인하세요" | 클릭 → Step 6 |
| 6 | 사이드바 "현장점검" 버튼 | "현장점검 메뉴로 이동하세요" | 클릭 → 현장점검 페이지 |

### 현장점검 페이지 (Step 7-11)

| Step | 강조 요소 | 안내 메시지 | 액션 |
|------|----------|------------|------|
| 7 | "점검대상목록" 탭 | "일정에 추가된 장비 목록입니다" | 자동 → Step 8 |
| 8 | 첫 번째 장비 "점검" 버튼 | "점검 버튼을 클릭하여 점검을 시작하세요" | 클릭 → Step 8.5 |
| **8.5** | **점검 화면** | **"실제 점검 화면입니다. (추후 구현)"** | **모달 확인 → Step 9** |
| 9 | "점검진행목록" 탭 | "점검 진행 상황을 확인하세요" | 클릭 → Step 10 |
| 10 | "점검 완료 처리" 버튼 | "점검을 완료하세요" | 클릭 → Step 11 |
| 11 | 완료 메시지 | "튜토리얼을 완료했습니다!" | 처음부터 다시 또는 종료 |

## 🛠 기술적 구현

### 1. 상태 관리
```typescript
interface TutorialState {
  step: number;
  isActive: boolean;
  currentPage: 'aed-data' | 'inspection';
}

const [tutorialState, setTutorialState] = useState<TutorialState>({
  step: 1,
  isActive: true,
  currentPage: 'aed-data'
});
```

### 2. 컴포넌트 구조
```
app/tutorial-guide/
├── components/
│   ├── TutorialSpotlight.tsx (NEW)
│   │   ├── DarkOverlay
│   │   ├── SpotlightCutout
│   │   └── TooltipMessage
│   ├── TutorialPageClient.tsx (MODIFY)
│   ├── FakeAEDDataPage.tsx (MODIFY)
│   └── FakeInspectionPage.tsx (MODIFY)
```

### 3. Spotlight 컴포넌트 Props
```typescript
interface SpotlightProps {
  step: number;
  targetSelector: string;
  message: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  onNext: () => void;
  showSkip?: boolean;
}
```

### 4. CSS 구현
- **Dark Overlay**: `fixed inset-0 bg-black/80 z-[100]`
- **Spotlight**: `box-shadow: 0 0 0 9999px rgba(0,0,0,0.8)`
- **강조 요소**: `position: relative; z-index: 101`
- **말풍선**: Tailwind + `::before` arrow

### 5. 요소 타겟팅 전략
```typescript
const TUTORIAL_STEPS = {
  1: { selector: '[data-tutorial="sidebar-aed-data"]', message: '...' },
  2: { selector: '[data-tutorial="filter-gugun"]', message: '...' },
  3: { selector: '[data-tutorial="device-checkbox-0"]', message: '...' },
  // ...
};
```

## 🎨 UI/UX 고려사항

### 진행 상태 표시
- 상단에 "Step 3/11" 진행바
- 또는 하단에 점(dot) 형태 인디케이터

### 건너뛰기 옵션
- 우측 상단 "건너뛰기" 또는 "X" 버튼
- 확인 모달: "튜토리얼을 종료하시겠습니까?"

### 애니메이션
- Spotlight 이동: `transition-all duration-300`
- 말풍선 등장: `animate-fade-in`
- 버튼 펄스: `animate-pulse` 또는 custom keyframe

### 반응형 대응
- 모바일: 말풍선을 화면 하단 고정
- 태블릿: 요소 옆에 배치
- 데스크톱: 자유로운 배치

## ⚠️ 주의사항

### 동적 요소 위치 추적
- `useEffect` + `ResizeObserver`로 요소 위치 변화 감지
- 스크롤 시 spotlight 위치 재계산

### 페이지 전환 시 상태 유지
- TutorialPageClient에서 전역 상태 관리
- 페이지 전환 시에도 tutorialStep 유지

### 클릭 차단
- 현재 step의 타겟 요소 외 모든 요소 `pointer-events-none`
- Overlay에 `pointer-events: auto`로 클릭 차단

## 🚀 구현 우선순위

### Phase 1: 기본 구조 (현재)
- [x] TutorialSpotlight 컴포넌트 생성
- [x] 기본 오버레이 + spotlight 효과
- [x] 말풍선 UI
- [x] Step 1-3 구현 (일정관리 페이지)

### Phase 2: 전체 플로우
- [ ] Step 4-6 구현 (일정관리 완료)
- [ ] Step 7-11 구현 (현장점검 페이지)
- [ ] 페이지 전환 로직

### Phase 3: 점검 화면 (추후)
- [ ] Step 8.5 실제 점검 화면 구현
- [ ] 점검 항목 입력 시뮬레이션
- [ ] 점검 완료 처리 플로우

### Phase 4: 개선
- [ ] 애니메이션 추가
- [ ] 진행 상태 표시
- [ ] 건너뛰기 기능
- [ ] 모바일 최적화

## 📌 참고 사항
- 튜토리얼은 `/tutorial-guide` 라우트에서만 작동
- 실제 데이터는 사용하지 않음 (샘플 데이터만 사용)
- 로그인 불필요
