# AED 픽스 튜토리얼 가이드 제작 문서

## 목차
1. [개요](#개요)
2. [아키텍처](#아키텍처)
3. [주요 컴포넌트](#주요-컴포넌트)
4. [시행착오 및 해결 방법](#시행착오-및-해결-방법)
5. [모바일/PC 분리 전략](#모바일pc-분리-전략)
6. [Z-index 레이어 관리](#z-index-레이어-관리)

---

## 개요

AED 픽스 튜토리얼은 사용자가 시스템 사용법을 단계별로 학습할 수 있도록 안내하는 인터랙티브 가이드입니다.

### 주요 기능
- 10단계 스텝별 안내
- PC/모바일 반응형 디자인
- Spotlight 효과로 UI 요소 강조
- 실제 페이지와 동일한 Fake 페이지 제공

---

## 아키텍처

```
tutorial-guide/
├── page.tsx                      # 진입점
├── layout.tsx                    # 레이아웃 (헤더, 모바일 네비게이션)
└── components/
    ├── TutorialPageClient.tsx    # 메인 오케스트레이션
    ├── TutorialSpotlight.tsx     # Spotlight 모달
    ├── TutorialBottomNav.tsx     # 튜토리얼 내부 하단 네비게이션
    ├── TutorialMobileNav.tsx     # 전역 모바일 네비게이션 (layout.tsx)
    ├── FakeAEDDataPage.tsx       # 일정관리 페이지
    └── FakeInspectionPage.tsx    # 현장점검 페이지
```

---

## 주요 컴포넌트

### 1. TutorialPageClient.tsx
튜토리얼의 중심 컴포넌트로, 전체 흐름을 관리합니다.

**핵심 기능:**
- `TUTORIAL_STEPS`: 각 단계의 정의 (selector, message, position 등)
- `positionMobile`: 모바일 전용 위치 설정 옵션
- `selectorMobile`: 모바일 전용 셀렉터 옵션
- 페이지 전환 및 단계 진행 관리

**주요 State:**
```typescript
tutorialStep: number          // 현재 단계 (0=시작화면)
pageView: 'aed-data' | 'inspection'
isMobile: boolean            // 768px 기준
scheduledSerials: Set<string>
```

### 2. TutorialSpotlight.tsx
대상 요소를 강조하고 설명 모달을 표시합니다.

**구성 요소:**
1. **Dark Overlay** (z-100): 배경 어둡게
2. **Spotlight Cutout** (z-200): 연한 녹색 사각형
3. **Target Element Class** (z-201): 진한 녹색 테두리
4. **Tooltip Modal** (z-202): 설명 모달

**위치 계산:**
- `getTooltipPosition()`: 타겟 위치 기반 모달 위치 계산
- `getActivePosition()`: 모바일 여부에 따라 position/positionMobile 선택

### 3. TutorialBottomNav.tsx vs TutorialMobileNav.tsx

**차이점:**
- `TutorialBottomNav`: TutorialPageClient 내부에서 사용
- `TutorialMobileNav`: layout.tsx에서 전역적으로 사용 ⚠️ **실제로 화면에 표시되는 것**

---

## 시행착오 및 해결 방법

### 문제 1: 모바일 Step 10 완료 모달이 보이지 않음

**증상:**
- 모달이 화면에 렌더링되지만 보이지 않음
- 스크롤 시 잠깐 나타났다가 사라짐

**원인:**
- `position: 'center'` 계산이 하단 네비게이션 바(64px)를 고려하지 않음
- body selector의 rect가 부정확

**해결:**
```typescript
// Step 10 모바일에서만 특별 처리
step === 10 && isMobile ? "z-[9999] inset-0 m-auto h-fit" : "z-[202]"

// 하단 네비게이션 위로 배치
style={{ bottom: '80px' }}
```

**핵심 교훈:**
- `position: 'center'`는 모바일에서 하단 네비게이션 고려 필요
- Tailwind의 `inset-0 m-auto`가 계산보다 안정적

---

### 문제 2: 모바일 하단 네비게이션이 2개만 표시

**증상:**
- 코드에는 4개 버튼이 있는데 화면에는 2개만 표시

**원인:**
- `TutorialBottomNav.tsx`를 수정했지만, 실제로는 `TutorialMobileNav.tsx`가 표시됨
- `layout.tsx`에서 TutorialMobileNav를 전역으로 렌더링

**해결:**
```typescript
// TutorialMobileNav.tsx에 대시보드, 프로필 버튼 추가
// 총 4개 버튼: 일정관리, 현장점검, 대시보드, 프로필
```

**핵심 교훈:**
- 레이아웃 구조를 먼저 파악해야 함
- 같은 역할의 컴포넌트가 여러 개 있을 때 실제 사용처 확인 필요

---

### 문제 3: Step 1, 6 하단 네비게이션 Spotlight 타겟팅 실패

**증상:**
- Spotlight가 엉뚱한 위치를 가리킴
- 녹색 박스가 정확한 버튼을 타겟팅하지 못함

**원인:**
- 하단 네비게이션이 4개 버튼이어야 하는데 2개만 있었음
- Spotlight가 첫 번째 버튼 위치를 잘못 계산

**해결:**
- 문제 2 해결 후 자동으로 해결됨
- 4개 버튼 구조가 되자 spotlight가 정확히 타겟팅

**핵심 교훈:**
- 레이아웃이 실제 시스템과 동일해야 정확한 타겟팅 가능

---

### 문제 4: Spotlight 2겹이 네비게이션 바 아래로 숨음

**증상:**
- 진한 녹색 테두리: 네비게이션 바 **뒤**에 숨음
- 연한 녹색 box-shadow: 네비게이션 바 **위**에 표시

**원인:**
- `tutorial-spotlight-target` 클래스가 **버튼 요소 자체**에 적용됨
- 버튼은 네비게이션 바의 자식이므로 부모의 stacking context에 갇힘
- `z-index: 201`을 줘도 부모 `z-index: 50`을 벗어날 수 없음

**시도한 해결책 (실패):**
```typescript
// ❌ 실패: z-index를 아무리 높여도 부모 context를 벗어날 수 없음
.tutorial-spotlight-target {
  z-index: 201 !important;
}
```

**최종 해결:**
```typescript
// ✅ 성공: Step 1, 6에서는 tutorial-spotlight-target 클래스를 아예 추가하지 않음
const isBottomNav = isMobile && (step === 1 || step === 6);
const hideSpotlight = step === 10 || isBottomNav;

if (!hideSpotlight) {
  element.classList.add('tutorial-spotlight-target');
}
```

**핵심 교훈:**
- **CSS Stacking Context는 z-index로 해결 불가**
- 자식 요소는 아무리 높은 z-index를 줘도 부모의 context를 벗어날 수 없음
- 해결책: 독립적인 요소(spotlight cutout)만 사용하거나, 구조 자체를 변경

---

## 모바일/PC 분리 전략

### 1. positionMobile 옵션

```typescript
// TUTORIAL_STEPS 정의
{
  selector: '[data-tutorial="device-add-0"]',
  position: 'left' as const,        // PC용
  positionMobile: 'top' as const,   // 모바일용
}
```

### 2. selectorMobile 옵션

```typescript
// Step 1, 6: 모바일은 하단 네비게이션, PC는 사이드바
{
  selector: '[data-tutorial="sidebar-aed-data"]',
  selectorMobile: '[data-tutorial="bottom-nav-aed-data"]',
}
```

### 3. 위치 선택 로직

```typescript
const getActivePosition = () => {
  if (!currentStepConfig) return 'center' as const;

  // 모바일이고 모바일 전용 위치가 있으면 사용
  if (isMobile && currentStepConfig.positionMobile) {
    return currentStepConfig.positionMobile;
  }

  return currentStepConfig.position;
};
```

---

## Z-index 레이어 관리

### 레이어 구조 (하단 → 상단)

```
z-50    : 하단 네비게이션 바 (TutorialMobileNav)
z-100   : Dark Overlay
z-200   : Spotlight Cutout (연한 녹색 box-shadow)
z-201   : Spotlight Target (진한 녹색 테두리) - Step 1,6 모바일에서는 사용 안 함
z-202   : Tooltip Modal
z-9998  : Dark Overlay (Step 10 모바일)
z-9999  : Step 10 완료 모달 (모바일)
```

### 주의사항

1. **Stacking Context 이해 필수**
   - 자식 요소는 부모의 z-index를 벗어날 수 없음
   - 네비게이션 바(z-50) 안의 버튼에 z-201을 줘도 네비게이션 위로 올라오지 않음

2. **독립적인 요소 사용**
   - Spotlight Cutout은 고정 위치(fixed)의 독립적인 div
   - 따라서 z-200으로 네비게이션 바 위에 표시 가능

3. **Step 10 모바일 특수 처리**
   - 최상위 레이어(z-9999) 사용
   - 모든 요소 위에 표시되어야 하므로

---

## 디버깅 팁

### 1. 콘솔 디버그 로그 활용

```typescript
// TutorialPageClient.tsx:251
console.log('[Tutorial Debug]', {
  tutorialStep,
  pageView,
  isMobile,
  currentStepConfig,
  activeSelector,
});
```

### 2. DOM 검사

```javascript
// 브라우저 콘솔에서 실행
const nav = document.querySelector('.md\\:hidden.fixed.bottom-0');
const buttons = nav?.querySelectorAll('button');
console.log('버튼 개수:', buttons?.length);
```

### 3. 레이어 확인

개발자 도구 → Elements → Computed → z-index 확인

---

## 모범 사례

### 1. 위치 조정 시

```typescript
// ✅ Good: positionMobile 사용
{
  position: 'left',
  positionMobile: 'bottom',  // 모바일 전용
}

// ❌ Bad: 조건문으로 처리
const position = isMobile ? 'bottom' : 'left';  // 유지보수 어려움
```

### 2. Spotlight 숨김 처리

```typescript
// ✅ Good: 명확한 조건
const isBottomNav = isMobile && (step === 1 || step === 6);
const hideSpotlight = step === 10 || isBottomNav;

// ❌ Bad: 복잡한 조건
if ((isMobile && step === 1) || step === 6 || step === 10) { ... }
```

### 3. 모달 위치 계산

```typescript
// ✅ Good: Tailwind 유틸리티 사용
className="inset-0 m-auto h-fit"

// ❌ Bad: 복잡한 계산
style={{ top: window.innerHeight / 2 - height / 2 }}
```

---

## 향후 개선 사항

1. **Step별 완료 상태 저장**
   - localStorage 활용
   - 재방문 시 이어서 진행 가능

2. **다국어 지원**
   - i18n 적용
   - 영어, 중국어 지원

3. **애니메이션 개선**
   - Framer Motion 도입
   - 부드러운 전환 효과

4. **접근성 개선**
   - ARIA 속성 추가
   - 키보드 네비게이션 지원

---

## 문의

튜토리얼 관련 문의사항은 이슈 트래커에 등록해주세요.
