# 레이아웃 및 UI 개선사항 검토 보고서

## 1. 레이아웃 개선 (깨짐, 겹침, 공간활용)

### 현재 문제점
1. **DataTable 그리드 레이아웃 문제**
   - 고정된 픽셀 값 사용으로 인한 반응형 문제
   - `gridTemplateColumns`에 하드코딩된 픽셀 값 사용
   - 작은 화면에서 컨텐츠가 잘리거나 겹침

2. **필터바 공간 활용 문제**
   - AEDFilterBar에서 많은 필터들이 가로로 나열되어 공간 부족
   - 작은 화면에서 필터 컨트롤이 2-3줄로 늘어남

3. **중첩 스크롤 문제**
   - 테이블 영역과 전체 페이지의 이중 스크롤 발생 가능성

### 개선 방안
```tsx
// DataTable.tsx 그리드 템플릿 개선
const getColumnTemplate = (enableSelection: boolean) =>
  enableSelection
    ? 'minmax(48px, auto) minmax(140px, 1fr) minmax(200px, 2fr) minmax(220px, 2fr) minmax(220px, 2fr) minmax(160px, 1fr) minmax(120px, auto) minmax(120px, auto)'
    : 'minmax(140px, 1fr) minmax(220px, 2fr) minmax(240px, 2fr) minmax(220px, 2fr) minmax(160px, 1fr) minmax(120px, auto) minmax(120px, auto)';
```

## 2. 모바일 최적화

### 현재 문제점
1. **브레이크포인트 처리 미흡**
   - 태블릿 크기(768px-1024px)에서 레이아웃 깨짐
   - 모바일 뷰와 데스크톱 뷰의 중간 상태 처리 부족

2. **터치 타겟 크기**
   - 버튼과 체크박스가 모바일에서 너무 작음 (최소 44x44px 권장)

3. **스와이프 제스처 미지원**
   - 모바일에서 좌우 스와이프로 추가 액션 접근 불가

### 개선 방안
```tsx
// 반응형 브레이크포인트 추가
const useResponsive = () => {
  const [windowSize, setWindowSize] = useState({
    isMobile: false,
    isTablet: false,
    isDesktop: false
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        isMobile: window.innerWidth < 768,
        isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
        isDesktop: window.innerWidth >= 1024
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
};

// 모바일 터치 타겟 크기 개선
<Button
  size="sm"
  className="text-xs bg-emerald-600 hover:bg-emerald-700 min-h-[44px] min-w-[44px] md:min-h-[32px] md:min-w-auto"
>
  점검 시작
</Button>
```

## 3. AED 데이터 조회 및 점검하기 메뉴 검색 조건 문제

### 현재 문제점

#### AED 데이터 조회 메뉴
1. **조회 기준 선택 UI 불명확**
   - 주소 기준 vs 관할보건소 기준 선택이 직관적이지 않음
   - 현재 라디오 버튼이 필터바 안에 숨어있음

2. **필터 적용 상태 표시 부족**
   - 현재 적용된 필터가 무엇인지 한눈에 보기 어려움
   - FilterBadges 컴포넌트가 있지만 가시성 낮음

3. **필터 초기화 기능 위치**
   - 전체 초기화 버튼이 명확하지 않음

#### 점검하기 메뉴
1. **기본 조회 기준 설정**
   - 점검하기에서는 기본적으로 '관할보건소 기준'이 되어야 하는데 'address'가 기본값
   - inspection 페이지에서 criteria 기본값 설정 필요

2. **필수 필터 강제**
   - 보건소 사용자의 경우 시도/시군구 필터가 자동 적용되어야 함

### 개선 방안

#### 1. 조회 기준 선택 UI 개선
```tsx
// AEDFilterBar.tsx 상단에 명확한 조회 기준 선택 추가
<div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg mb-4">
  <span className="font-medium">조회 기준:</span>
  <RadioGroup value={queryCriteria} onValueChange={setQueryCriteria} className="flex gap-4">
    <div className="flex items-center gap-2">
      <RadioGroupItem value="address" id="address" />
      <Label htmlFor="address" className="cursor-pointer">
        설치 주소 기준
      </Label>
    </div>
    <div className="flex items-center gap-2">
      <RadioGroupItem value="jurisdiction" id="jurisdiction" />
      <Label htmlFor="jurisdiction" className="cursor-pointer">
        관할보건소 기준
      </Label>
    </div>
  </RadioGroup>
</div>
```

#### 2. 점검하기 페이지 기본값 수정
```tsx
// app/(authenticated)/inspection/page.tsx
const normalizedParams: Record<string, string | string[] | undefined> = { ...resolvedSearchParams };
if (!normalizedParams.criteria) {
  normalizedParams.criteria = 'jurisdiction'; // 점검하기는 관할보건소 기준이 기본
}
```

#### 3. 필터 상태 가시성 개선
```tsx
// 적용된 필터 수를 배지로 표시
<Button variant="outline" className="relative">
  필터
  {activeFilterCount > 0 && (
    <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
      {activeFilterCount}
    </span>
  )}
</Button>
```

## 구현 우선순위

1. **긴급 (당장 수정 필요)**
   - 점검하기 메뉴 기본 조회 기준을 'jurisdiction'으로 변경
   - DataTable 그리드 템플릿을 반응형으로 수정
   - 모바일 터치 타겟 크기 증가

2. **중요 (1-2일 내 수정)**
   - 조회 기준 선택 UI를 필터바 상단으로 이동
   - 태블릿 브레이크포인트 추가
   - 필터 상태 가시성 개선

3. **개선 (추후 진행)**
   - 스와이프 제스처 추가
   - 가상 스크롤링 구현 (대량 데이터 처리)
   - 필터 프리셋 저장 기능

## 테스트 체크리스트

- [ ] 320px (최소 모바일) 에서 레이아웃 확인
- [ ] 768px (태블릿) 에서 레이아웃 확인
- [ ] 1024px (작은 데스크톱) 에서 레이아웃 확인
- [ ] 1920px (일반 데스크톱) 에서 레이아웃 확인
- [ ] 점검하기 메뉴에서 관할보건소 기준이 기본인지 확인
- [ ] 필터 적용 후 상태가 명확히 표시되는지 확인
- [ ] 모바일에서 터치 타겟이 충분히 큰지 확인