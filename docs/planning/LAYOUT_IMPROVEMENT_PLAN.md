# 레이아웃 개선 및 사용자 경험 최적화 계획

**작성일**: 2025년 10월 17일
**우선순위**: 🔴 P0 - 즉시 적용
**관련 문서**: [PERFORMANCE_OPTIMIZATION_MASTER.md](./PERFORMANCE_OPTIMIZATION_MASTER.md)
**상태**: 계획 수립 완료

---

## 📋 목차

1. [문제 상황](#-문제-상황)
2. [사용자 워크플로우 분석](#-사용자-워크플로우-분석)
3. [기술적 원인 분석](#-기술적-원인-분석)
4. [개선 방안 (3단계)](#-개선-방안-3단계)
5. [충돌 및 퇴보 검토](#-충돌-및-퇴보-검토)
6. [구현 계획](#-구현-계획)

---

## 🔍 문제 상황

### 증상

1. **페이지네이션이 화면 밖에 위치**
   - 세로 스크롤이 작동하지 않음
   - "다음 페이지" 버튼을 볼 수 없음
   - 사용자가 리스트 끝을 확인할 수 없음

2. **검색 결과 총 개수 확인 불가**
   - 페이지네이션에 표시되는 총 개수를 볼 수 없음
   - 필터 조건이 적절한지 판단 어려움

### 배경

**이전 문제**: 해상도에 따라 데이터 테이블 내용이 따로 움직여 정렬이 틀어짐

**이전 해결책**: 타이틀, 검색조건, 데이터테이블을 하나의 프레임으로 통합
- ✅ 정렬 문제 해결
- ❌ 새로운 문제 발생: 스크롤 불가, 페이지네이션 숨김

---

## 🎯 사용자 워크플로우 분석

### 실제 사용 패턴

```
반복 사이클 (5~10회):

1. 조건 입력
   예: 지역: 서울, 카테고리: 지하철
   ↓
2. 검색 실행
   ↓
3. 📍 결과 개수 즉시 확인 필요
   "총 3,247건" ← 너무 많음!
   ↓
4. 조건 수정
   예: 지역: 서울 + 강남구 추가
   ↓
5. 재검색
   ↓
6. 📍 결과 개수 재확인
   "총 127건" ← 적당함!
   ↓
7. 상위 10~20개 빠르게 스캔
   ↓
8. 판단:
   - 적절함 → 상세 정보 확인
   - 부적절함 → 4번으로 돌아가기
```

### 핵심 요구사항

1. ⚡ **즉각적인 총 개수 확인**
   - 스크롤 없이 첫 화면에서 "3,247건" 확인
   - 조건이 적절한지 즉시 판단

2. 🔄 **빠른 조건 변경**
   - 필터바를 다시 펼칠 필요 없이
   - 버튼 한 번으로 조건 수정

3. 👀 **상위 10~20개 빠른 스캔**
   - 전체를 볼 필요 없음
   - 상위 데이터로 전체 패턴 파악

4. 📊 **스크롤 없이 결과 파악**
   - 첫 화면에서 핵심 정보 모두 표시

---

## 🔧 기술적 원인 분석

### 현재 레이아웃 구조

**파일**: `app/(authenticated)/aed-data/AEDDataPageClient.tsx`

```typescript
// Line 478, 619
<div className="flex h-full flex-col overflow-x-auto bg-gray-950">
  {/* 탭 영역 */}
  <div className="flex items-center ...">...</div>

  {/* 필터바 */}
  <AEDFilterBar />

  {/* Content Area */}
  <div ref={contentRef}
       className="flex-1 overflow-hidden relative">  // ❌ 문제
    <DataTable ... />
  </div>
</div>
```

**파일**: `app/aed-data/components/DataTable.tsx`

```typescript
// Line 994
<div className="flex flex-col h-full relative">
  {/* 선택 바 */}
  <div className="bg-blue-900/20 ...">...</div>

  {/* 데이터 목록 스크롤 컨테이너 */}
  <div className="flex-1 flex flex-col lg:block"     // ❌ 스크롤 없음
       data-scrollable="true">
    {/* 헤더 */}
    <div className="hidden lg:block ...">...</div>

    {/* 데이터 행들 */}
    <div className="hidden lg:block pr-4">           // ❌ 스크롤 없음
      {devices.map(...)}  // 100개 행 모두 렌더링
    </div>
  </div>

  {/* 페이지네이션 */}
  <Pagination ... />  // ❌ 화면 밖
</div>
```

### 근본 원인

#### 1. **`overflow-hidden`이 중첩**
```
AEDDataPageClient (Line 619)
  └─ contentRef: overflow-hidden  ← 부모가 스크롤 차단
      └─ DataTable (Line 1047)
          └─ 스크롤 컨테이너 없음  ← 자식도 스크롤 없음
```

**결과**: 세로 스크롤 불가능

#### 2. **`h-full`이 전파되지만 높이 제한 없음**
```
DataTable: h-full (부모 높이 가득 채움)
  └─ 내부에 overflow-y-auto 없음
  └─ 100개 행이 모두 렌더링
  └─ 페이지네이션이 화면 밖으로 밀림
```

**결과**: 페이지네이션이 보이지 않음

#### 3. **총 개수 정보가 하단에만 존재**
```
현재 구조:
  탭 영역
  필터바
  데이터 행들 (100개)
  페이지네이션 ← "총 3,247건" 표시
               ← 화면 밖에 위치
```

**결과**: 총 개수 확인 불가

---

## 💡 개선 방안 (3단계)

### Stage 1: 즉시 적용 (30~45분) - 필수 ✅

#### 개선 사항

1. **Flexbox 스크롤 영역 분리**
2. **결과 요약 배너 추가** ⭐ 핵심
3. **빠른 조건 수정 버튼 추가**

#### 1.1 Flexbox 스크롤 적용

**파일**: `app/aed-data/components/DataTable.tsx` (Line 1047)

**Before (현재)**:
```typescript
<div className="flex-1 flex flex-col lg:block" data-scrollable="true">
  <div className="hidden lg:block bg-gray-800 ...">헤더</div>
  <div className="hidden lg:block pr-4">
    {devices.map(...)}
  </div>
</div>
```

**After (수정)**:
```typescript
<div className="flex-1 flex flex-col overflow-hidden">
  {/* 헤더 - 고정 */}
  <div className="flex-shrink-0 hidden lg:block bg-gray-800 ...">
    헤더
  </div>

  {/* 바디 - 스크롤 */}
  <div className="flex-1 overflow-y-auto overflow-x-hidden">
    <div className="hidden lg:block pr-4">
      {devices.map(...)}
    </div>
  </div>
</div>

{/* 페이지네이션 - 고정 */}
<div className="flex-shrink-0">
  <Pagination ... />
</div>
```

**효과**:
- ✅ 세로 스크롤 작동
- ✅ 페이지네이션 하단 고정
- ✅ 헤더 정렬 유지

---

#### 1.2 결과 요약 배너 추가 ⭐ **핵심**

**파일**: `app/aed-data/components/DataTable.tsx` (Line 1008 이전)

**새로 추가**:
```typescript
{/* 결과 요약 배너 */}
<div className="bg-gray-800/80 border-b border-gray-700 px-4 py-2.5
                flex items-center justify-between flex-shrink-0">
  <div className="flex items-center gap-4 flex-wrap">
    {/* 총 개수 - 크게 강조 */}
    <div className="flex items-center gap-2">
      <span className="text-gray-400 text-sm">검색 결과:</span>
      <span className="text-2xl font-bold text-green-400">
        {totalCount.toLocaleString()}
      </span>
      <span className="text-gray-400 text-sm">건</span>
    </div>

    {/* 현재 페이지 정보 */}
    <div className="text-sm text-gray-500">
      ({rangeFrom.toLocaleString()}~{rangeTo.toLocaleString()}번째 표시 중)
    </div>

    {/* 페이지 크기 정보 (모바일에서 숨김) */}
    <div className="hidden md:flex items-center gap-2 text-xs text-gray-500">
      <span>페이지당:</span>
      <span className="font-medium text-gray-400">{limit}개</span>
    </div>
  </div>

  {/* 빠른 작업 버튼 */}
  <div className="flex items-center gap-2">
    <button
      onClick={() => {/* 필터바로 포커스 */}}
      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600
                 text-gray-300 text-xs rounded transition-colors
                 flex items-center gap-1.5"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
      <span className="hidden sm:inline">조건 수정</span>
    </button>
  </div>
</div>
```

**효과**:
- ✅ **"총 3,247건"을 크게 강조** → 즉시 인지
- ✅ 현재 페이지 정보 표시 → "1~100번째 표시 중"
- ✅ 빠른 조건 수정 버튼 → 필터바 다시 펼칠 필요 없음

---

#### 1.3 개선된 레이아웃 구조

```
┌──────────────────────────────────────────┐
│ 탭: [추가할목록] [지도] [추가된목록]    │ ← 고정
├──────────────────────────────────────────┤
│ 검색 조건: 서울 > 강남구, 지하철        │ ← 고정 (접기/펼치기)
├──────────────────────────────────────────┤
│ 📊 검색 결과: 127 건                    │ ← ⭐ 새로 추가
│    (1~100번째 표시 중) [조건 수정]     │
├──────────────────────────────────────────┤
│ [선택된 항목: 3개] [일정 추가]          │ ← 고정
├──────────────────────────────────────────┤
│ ┌─ 헤더 (고정) ────────────────────┐   │
│ │ ☐ | 분류 | 설치기관 | 관리번호   │   │
│ ├────────────────────────────────┤   │
│ │ ↕ 데이터 행들 (스크롤 가능)      │   │
│ │   ☐ 강남역 지하철 ...           │   │
│ │   ☐ 역삼역 지하철 ...           │   │
│ │   ☐ 선릉역 지하철 ...           │   │
│ │   ...                            │   │
│ │   (100개 행)                     │   │
│ └────────────────────────────────┘   │
├──────────────────────────────────────────┤
│ « 이전 | 1 2 3 ... 13 | 다음 »         │ ← 항상 보임
│ 총 127건 중 1-100 표시                  │
└──────────────────────────────────────────┘
```

---

### Stage 2: Phase 0 테스트 후 (1주일 뒤) - 선택적 ⚠️

#### 2.1 미리보기 모드 (선택적)

**조건**: 사용자가 "상위 20개만 보고 싶다"는 피드백

**구현**:
```typescript
const [previewMode, setPreviewMode] = useState(true);
const displayDevices = previewMode ? devices.slice(0, 20) : devices;

// 배너에 토글 추가
<button onClick={() => setPreviewMode(!previewMode)}>
  {previewMode ? '미리보기 (20개)' : `전체 보기 (${devices.length}개)`}
</button>
```

**예상 작업 시간**: 1시간
**우선순위**: 낮음 (사용자 피드백 후 결정)

---

### Stage 3: 성능 최적화 필요 시 (1개월 뒤) - 선택적 🚀

#### 3.1 하이브리드 가상 스크롤

**조건**: 100개 이상 렌더링 시 성능 병목 확인

**전략**:
- **상위 50개**: 일반 렌더링 (빠른 스캔)
- **나머지**: react-window 가상 스크롤 (성능)

**예상 작업 시간**: 3~4시간
**우선순위**: 매우 낮음 (Phase 2 재검토 시)

**상세**: [PAGINATION_OPTIMIZATION_2025.md](./PAGINATION_OPTIMIZATION_2025.md) - Phase 3 참조

---

## 🔍 충돌 및 퇴보 검토

### ✅ 1. Phase 0 (커서 페이지네이션)과의 호환성

#### 검토 사항
- Phase 0에서 수정한 `.range()` → `.limit()` 변경
- `totalCount`, `pagination.hasMore` 값 사용

#### 결론: **충돌 없음** ✅

**이유**:
1. **DataTable은 데이터 표시만 담당**
   - API 응답의 `totalCount`를 받아 표시
   - 페이지네이션 로직에 개입하지 않음

2. **결과 요약 배너도 표시만 담당**
   ```typescript
   // DataTable.tsx - Line 841-847
   const totalCount = summary?.totalCount ?? devices.length;
   const currentPage = pagination?.page ?? (filters.page ?? 1);
   const limit = pagination?.limit ?? (filters.limit ?? 50);
   ```
   - Phase 0의 cursor 기반 페이지네이션과 **독립적**
   - `summary.totalCount`는 API에서 제공 (변경 없음)

3. **Flexbox 스크롤은 CSS 변경**
   - 기능 로직에 영향 없음
   - 단순히 `overflow-y-auto` 추가

---

### ✅ 2. 기존 선택(체크박스) 로직과의 호환성

#### 검토 사항
- `selectedIds` 상태 관리
- `deviceMap` 기반 필터링
- 스크롤 시 체크박스 상태 유지

#### 결론: **충돌 없음** ✅

**이유**:
1. **Stage 1은 가상 스크롤 없음**
   - 100개 행이 모두 DOM에 렌더링
   - 기존 `deviceMap` 로직 그대로 작동

2. **기존 useEffect 유지** (Line 814-829)
   ```typescript
   useEffect(() => {
     setSelectedIds((prev) => {
       const filtered = [...prev].filter((id) => deviceMap.has(id));
       return new Set(filtered);
     });
   }, [devices, deviceMap]);
   ```
   - 모든 장비가 `deviceMap`에 존재
   - 필터링 로직 정상 작동

3. **Stage 3 (가상 스크롤) 적용 시에만 주의**
   - 하지만 Stage 3는 선택적 (1개월 뒤 재검토)
   - 적용 시 별도 수정 필요 (문서화됨)

---

### ✅ 3. 모바일 레이아웃과의 호환성

#### 검토 사항
- 모바일 카드 뷰 (Line 1078-1106)
- 반응형 디자인

#### 결론: **충돌 없음** ✅

**이유**:
1. **결과 요약 배너는 반응형**
   ```typescript
   <div className="flex items-center gap-4 flex-wrap">  // flex-wrap
     {/* 모바일에서 줄바꿈 */}
   </div>
   ```

2. **Flexbox 스크롤은 데스크톱만 적용**
   ```typescript
   <div className="flex-1 overflow-y-auto overflow-x-hidden">
     <div className="hidden lg:block pr-4">  // lg:block (데스크톱)
       {devices.map(...)}
     </div>
   </div>
   ```

3. **모바일 카드 뷰는 독립적**
   ```typescript
   <div className="lg:hidden p-1.5 space-y-1">  // lg:hidden (모바일)
     {devices.map(...)}
   </div>
   ```
   - 데스크톱과 모바일이 완전히 분리된 렌더링

---

### ⚠️ 4. 잠재적 이슈 및 주의사항

#### 4.1 스크롤 컨테이너 중첩

**현재 구조**:
```
AEDDataPageClient
  └─ contentRef: overflow-hidden
      └─ DataTable
          └─ 새로운 스크롤 컨테이너: overflow-y-auto  ← 추가
```

**잠재적 문제**: 스크롤 이벤트 전파

**해결 방법**:
```typescript
// contentRef의 overflow-hidden 유지 (다른 요소 보호)
// DataTable 내부에서만 스크롤 허용
// 이벤트 전파 문제 없음 (검증 필요)
```

**검증 항목**:
- [ ] 마우스 휠 스크롤 작동
- [ ] 터치 스크롤 작동 (모바일)
- [ ] 스크롤바 표시 확인

---

#### 4.2 페이지네이션 중복 정보

**현재**:
- 결과 요약 배너: "총 127건 (1~100번째)"
- 페이지네이션: "총 127건 중 1-100 표시"

**잠재적 문제**: 정보 중복

**해결 방법**:
```typescript
// 페이지네이션에서 중복 정보 제거 (선택적)
// 또는 배너를 간략화:
// "검색 결과: 127건" (페이지 정보 제거)
```

**권장**: 배너는 **총 개수만**, 페이지네이션은 **상세 정보**

---

## 📝 구현 계획

### Phase 0 (즉시 - 30~45분)

#### 작업 순서

1. **DataTable.tsx 수정** (20분)
   ```bash
   파일: app/aed-data/components/DataTable.tsx

   수정 1: Line 1047 - Flexbox 스크롤 컨테이너
   수정 2: Line 1008 이전 - 결과 요약 배너 추가
   수정 3: Line 1049 - 헤더에 flex-shrink-0 추가
   ```

2. **테스트** (15분)
   - [ ] 데스크톱: 세로 스크롤 작동
   - [ ] 데스크톱: 페이지네이션 하단 고정
   - [ ] 데스크톱: 헤더 정렬 유지
   - [ ] 모바일: 기존 동작 유지
   - [ ] 총 개수 표시 확인
   - [ ] "조건 수정" 버튼 작동

3. **문서 업데이트** (10분)
   - [x] LAYOUT_IMPROVEMENT_PLAN.md 생성
   - [ ] PERFORMANCE_OPTIMIZATION_MASTER.md 업데이트
   - [ ] PHASE_0_APPLIED.md에 레이아웃 개선 추가

---

### 테스트 시나리오

#### 시나리오 1: 3,247건 검색 후 조건 수정

```
1. 필터 설정: 서울 + 지하철
2. 검색 실행
3. ✅ 배너 확인: "검색 결과: 3,247건"
4. 판단: 너무 많음
5. [조건 수정] 버튼 클릭
6. 필터 수정: 서울 + 강남구 + 지하철
7. 재검색
8. ✅ 배너 확인: "검색 결과: 127건"
9. 판단: 적당함
10. ✅ 상위 20개 스캔 (스크롤)
11. ✅ 페이지네이션 확인 (하단 고정)
```

**예상 결과**:
- 총 개수를 즉시 확인 가능
- 조건 수정이 빠름
- 스크롤 및 페이지 이동 정상 작동

---

#### 시나리오 2: 100개 조회 후 다음 페이지

```
1. 필터 설정: 서울 + 강남구
2. 검색 실행
3. ✅ 배너: "검색 결과: 237건 (1~100번째)"
4. 상위 20개 스캔 (스크롤)
5. ✅ 하단으로 스크롤
6. ✅ 페이지네이션 확인: [« 이전 | 1 2 3 | 다음 »]
7. [다음 »] 클릭
8. ✅ 배너 업데이트: "검색 결과: 237건 (101~200번째)"
9. Phase 0 cursor 페이지네이션 작동 확인
```

**예상 결과**:
- 페이지네이션이 항상 보임
- 다음 페이지 이동 작동 (Phase 0)
- 배너 정보 자동 업데이트

---

## 📊 예상 효과

| 항목 | Before | After (Stage 1) | 개선율 |
|------|--------|----------------|--------|
| **총 개수 확인** | ❌ 스크롤 필요 | ✅ **즉시** | ∞ |
| **조건 수정 시간** | ~10초 (필터 다시 펼침) | **~2초** (버튼) | 80% |
| **상위 20개 스캔** | ⚠️ 스크롤 필요 | ✅ 스크롤 | 동일 |
| **페이지네이션 접근** | ❌ 불가능 | ✅ **항상 보임** | ∞ |
| **조건 변경 사이클** | ~30초 | **~10초** | 67% |

---

## 🔄 기존 문서와의 관계

### PAGINATION_OPTIMIZATION_2025.md
- **관계**: 레이아웃 개선은 Phase 0과 **독립적**
- **통합**: Phase 0 완료 보고서에 레이아웃 개선 포함
- **우선순위**: Phase 0 (커서 수정) + Layout Stage 1 (스크롤) 동시 적용

### PERFORMANCE_OPTIMIZATION_MASTER.md
- **업데이트 필요**: "완료된 최적화" 섹션에 추가
- **내용**: Stage 1 완료 후 효과 측정 추가

---

## ✅ 체크리스트

### 구현 전
- [x] 사용자 워크플로우 분석
- [x] 기술적 원인 파악
- [x] 충돌 검토 완료
- [x] 개선 방안 문서화

### 구현 중
- [ ] DataTable.tsx - Flexbox 스크롤 적용
- [ ] DataTable.tsx - 결과 요약 배너 추가
- [ ] 데스크톱 테스트
- [ ] 모바일 테스트

### 구현 후
- [ ] 시나리오 1 검증 (조건 변경)
- [ ] 시나리오 2 검증 (페이지 이동)
- [ ] Phase 0와 통합 테스트
- [ ] 문서 업데이트 (마스터 문서)

---

## 📞 문의 및 피드백

### 문제 발생 시
1. Chrome DevTools에서 레이아웃 확인
2. 스크롤 컨테이너의 `overflow` 속성 확인
3. 필요시 롤백:
   ```bash
   git checkout HEAD -- app/aed-data/components/DataTable.tsx
   ```

---

**작성자**: AEDpics 개발팀
**다음 단계**: Stage 1 즉시 구현
**예상 완료**: 오늘 (45분 이내)
