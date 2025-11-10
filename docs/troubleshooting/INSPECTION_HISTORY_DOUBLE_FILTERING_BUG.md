# 점검이력 이중 필터링 버그 분석 및 해결

**날짜**: 2025-11-11 04:10+
**증상**: 서귀포보건소 계정에서 점검이력 탭에 완료된 점검 3개가 표시되지 않음
**장비**: 29-0001469 (테스트 장비)

---

## 1. 데이터베이스 상태 확인 (2025-11-11 04:15)

### 29-0001469의 현재 상태 ✅ 모두 정상

```sql
-- INSPECTIONS 테이블
id: 96e642fa-05d6-46c1-a475-240446ea467a
equipment_serial: 29-0001469
inspection_date: 2025-11-10
overall_status: pass
inspector_id: 3b655771-647f-4c5c-8215-5f34999595c7

-- SESSIONS 테이블
id: ae8fa109-d10f-4c37-a4dc-ac154d1a1944
equipment_serial: 29-0001469
status: completed
started_at: 2025-11-11 03:34:45
completed_at: 2025-11-11 03:35:47

-- ASSIGNMENTS 테이블
id: 40eb5b36-0cf0-47e2-8c28-3db4867ead0e
equipment_serial: 29-0001469
status: completed
created_at: 2025-11-11 03:34:41
completed_at: 2025-11-11 03:52:56

-- AED_DATA 테이블
equipment_serial: 29-0001469
sido: 제주
gugun: 서귀포시
jurisdiction_health_center: 서귀포시서귀포보건소
```

**결론**: 29-0001469는 점검이력에 **반드시 보여져야 합니다**!

---

## 2. API 쿼리 시뮬레이션 ✅ 정상 반환

```sql
-- 서귀포보건소 권한으로 점검이력 API 쿼리
SELECT i.id, i.equipment_serial, i.inspection_date, i.overall_status, a.sido, a.gugun
FROM aedpics.inspections i
LEFT JOIN aedpics.aed_data a ON i.equipment_serial = a.equipment_serial
WHERE i.inspection_date >= NOW() - INTERVAL '720 hours'
  AND i.overall_status IN ('pass', 'fail', 'normal', 'needs_improvement', 'malfunction')
  AND (a.sido IN ('제주', '제주특별자치도') AND a.gugun = '서귀포시')
ORDER BY i.inspection_date DESC;

-- 결과: 3개 레코드 반환
-- 29-0000945 (pass, 제주, 서귀포시)
-- 29-0001225 (pass, 제주, 서귀포시)
-- 29-0001469 (pass, 제주, 서귀포시) ← 우리의 테스트 장비!
```

**결론**: API는 정상적으로 3개의 점검 완료 데이터를 반환합니다!

---

## 3. 문제 원인: 이중 필터링 버그 🔴

### 증상 타임라인
1. **이전**: 점검이력 4개가 "진행중" 상태로 표시됨
2. **수정 후**: 점검이력 0개 → "완료된 점검이 없습니다" 메시지

### 근본 원인: 클라이언트 사이드 이중 필터링

**파일**: `components/inspection/AdminFullView.tsx` Line 143-166

```typescript
// 🔴 버그: API가 이미 권한 기반 필터링을 완료했는데
// 클라이언트가 또 다시 filters.regionCodes/cityCodes로 필터링

async function loadInspectionHistory() {
  if (viewMode === 'completed') {
    const mode = user?.role === 'local_admin' ? filterMode : 'address';
    let history = await getInspectionHistory(undefined, 720, mode);

    // ❌ 문제 1: regionCodes 이중 필터링
    if (filters.regionCodes && filters.regionCodes.length > 0) {
      const regionLabels = filters.regionCodes
        .flatMap(code => REGION_CODE_TO_DB_LABELS[code] || [])
        .filter(Boolean);

      history = history.filter(item => {
        const itemSido = (item as any).aed_data?.sido;
        return regionLabels.includes(itemSido);
      });
    }

    // ❌ 문제 2: cityCodes 이중 필터링
    if (filters.cityCodes && filters.cityCodes.length > 0) {
      history = history.filter(item => {
        const itemGugun = (item as any).aed_data?.gugun;
        return filters.cityCodes!.includes(itemGugun);
      });
    }

    setInspectionHistoryList(history);
  }
}
```

### 왜 이중 필터링이 문제인가?

1. **API 레벨 (서버)**:
   - `/api/inspections/history`
   - `userProfile.role === 'local_admin'` 감지
   - `aedFilter.sido = { in: ['제주', '제주특별자치도'] }`
   - `aedFilter.gugun = '서귀포시'`
   - **결과**: 서귀포시 3개만 반환 ✅

2. **Client 레벨 (브라우저)**:
   - `filters.regionCodes` 확인
   - `filters.cityCodes` 확인
   - **만약 filters에 올바른 값이 없으면**: 3개 모두 제거! ❌

3. **실제 시나리오**:
   ```javascript
   // API 반환: [29-0000945, 29-0001225, 29-0001469]

   // filters 상태 (zustand)
   filters.regionCodes = ['JEJ']  // 또는 undefined
   filters.cityCodes = []         // 또는 undefined

   // cityCodes 필터링
   if (filters.cityCodes.length > 0) {  // false → 건너뜀
     // 하지만 cityCodes가 비어있거나 '서귀포시'가 아닌 값이면?
   }

   // 결과: history.filter(...) → 0개!
   ```

---

## 4. 해결 시도 #1: local_admin 제외 (2025-11-11 04:18)

### 수정 내용

**파일**: `components/inspection/AdminFullView.tsx`

```typescript
// Line 143: regionCodes 필터링 수정
if (user?.role !== 'local_admin' && filters.regionCodes && filters.regionCodes.length > 0) {
  const regionLabels = filters.regionCodes
    .flatMap(code => REGION_CODE_TO_DB_LABELS[code] || [])
    .filter(Boolean);

  history = history.filter(item => {
    const itemSido = (item as any).aed_data?.sido;
    if (!itemSido) return true;
    return regionLabels.includes(itemSido);
  });
}

// Line 160: cityCodes 필터링 수정
if (user?.role !== 'local_admin' && filters.cityCodes && filters.cityCodes.length > 0) {
  history = history.filter(item => {
    const itemGugun = (item as any).aed_data?.gugun;
    if (!itemGugun) return true;
    return filters.cityCodes!.includes(itemGugun);
  });
}
```

### 근거
- **local_admin**은 API가 이미 권한 기반 필터링 완료
- 클라이언트 필터링은 **전국 권한 사용자만** 필요
- 이중 필터링 방지

### 결과
- **실패**: 강력새로고침 후에도 여전히 0개 표시

---

## 5. 추가 조사 필요 사항

### 체크리스트

- [x] 데이터베이스 상태 확인 (29-0001469 정상)
- [x] API 쿼리 시뮬레이션 (3개 반환 정상)
- [x] 클라이언트 필터링 로직 분석 (이중 필터링 발견)
- [x] AdminFullView.tsx 수정 (local_admin 제외)
- [ ] **Playwright로 실제 브라우저 상태 확인**
- [ ] **filters 상태값 실시간 확인**
- [ ] **API 응답 실시간 확인**
- [ ] **다른 이중 필터링 버그 탐색**

### 추가 의심 지점

1. **filters 초기값 문제**
   - `useAEDFiltersStore` 상태가 잘못 초기화되었을 가능성
   - localStorage에 잘못된 값 저장되었을 가능성

2. **useEffect 의존성 문제**
   - Line 175: `[viewMode, filterMode, user?.role, filters.regionCodes, filters.cityCodes]`
   - filters 변경 시 재실행되는데, 무한 루프 가능성?

3. **다른 컴포넌트의 이중 필터링**
   - DataTable의 filterData prop
   - AEDDataProvider의 필터링 로직
   - InspectionFilterBar의 필터 적용

---

## 6. 코드 분석 결과 (2025-11-11 04:25+)

### API 응답 구조 확인 ✅
**파일**: `app/api/inspections/history/route.ts:371-391`

```typescript
{
  success: true,
  count: formattedInspections.length,
  inspections: [
    {
      equipment_serial: "29-0001469",
      aed_data: {
        sido: "제주",           // ← 한글
        gugun: "서귀포시",      // ← 한글
        // ... other fields
      }
    }
  ]
}
```

**확인사항**:
- API는 `inspections.aed_data.sido`와 `inspections.aed_data.gugun`를 한글로 반환
- AdminFullView의 필터링 로직 `(item as any).aed_data?.sido`는 올바른 접근 방식

### 이중 필터링 패턴 검색 결과 ✅

다음 6개 파일에서 `filters.regionCodes` 또는 `filters.cityCodes` 사용:
1. **components/inspection/AdminFullView.tsx** - ✅ 수정 완료 (local_admin 건너뛰기)
2. **app/aed-data/components/AEDFilterBar.tsx** - ⚠️ UI 컴포넌트 (필터 입력용)
3. **app/api/aed-data/route.ts** - ✅ AED 데이터 API (점검이력과 무관)
4. **app/api/inspections/export/route.ts** - ✅ Export API (문제 없음)
5. **lib/utils/query-parser.ts** - ✅ 유틸리티 (파싱만 수행)
6. **app/aed-data/components/AEDDataProvider.tsx** - ✅ AED 데이터 Provider (점검이력과 무관)

**결론**: 이중 필터링 버그는 AdminFullView.tsx에만 존재, 이미 수정 완료.

### inspectionHistoryList 사용처 확인 ✅

```typescript
// Line 703-825: inspectionHistoryList를 직접 렌더링 (추가 필터링 없음)
{inspectionHistoryList.length === 0 ? (
  <p>완료된 점검이 없습니다.</p>
) : (
  inspectionHistoryList.map((inspection) => (...))
)}
```

**확인사항**:
- useEffect에서 설정된 `inspectionHistoryList`가 그대로 렌더링됨
- 추가 필터링 레이어 없음
- 문제는 useEffect의 필터링 로직에만 존재

## 7. 수정이 작동하지 않는 이유 분석

### 가설 1: Next.js Dev Server 미반영
**증상**: 코드 수정 후 강력새로고침해도 여전히 0개 표시
**가능성**: ⭐⭐⭐⭐ (매우 높음)
**확인 방법**:
```bash
# .next 캐시 삭제 후 재시작
rm -rf .next
npm run dev
```

### 가설 2: user.role 값 불일치
**증상**: `user?.role !== 'local_admin'` 체크가 실패
**가능성**: ⭐⭐⭐ (중간)
**확인 방법**:
```typescript
// AdminFullView.tsx Line 138에 디버깅 로그 추가
console.log('[AdminFullView] user.role:', user?.role);
console.log('[AdminFullView] filters:', filters);
```

### 가설 3: filters 상태값 오염
**증상**: `filters.cityCodes`가 잘못된 값 포함 (예: 'seogwipo' vs '서귀포시')
**가능성**: ⭐⭐ (낮음)
**확인 방법**:
```javascript
// 브라우저 콘솔에서 실행
localStorage.getItem('aedpics-filters')
```

### 가설 4: API가 0개 반환 중
**증상**: 서버 권한 필터링 자체가 실패하여 API가 빈 배열 반환
**가능성**: ⭐ (매우 낮음, DB 쿼리로 3개 확인됨)
**확인 방법**:
```bash
# API 응답 직접 조회
curl -H "Cookie: ..." http://localhost:3000/api/inspections/history?hours=720&mode=address
```

## 8. 다음 단계 (우선순위 순)

### Step 1: Next.js 캐시 클리어 및 재시작 🔥 최우선
```bash
rm -rf .next
npm run dev
```
**이유**: 가장 흔한 원인, 가장 빠른 해결책

### Step 2: 디버깅 로그 추가
**파일**: `components/inspection/AdminFullView.tsx`
```typescript
// Line 135 이후에 추가
if (viewMode === 'completed') {
  console.log('[AdminFullView Debug] user.role:', user?.role);
  console.log('[AdminFullView Debug] filters.regionCodes:', filters.regionCodes);
  console.log('[AdminFullView Debug] filters.cityCodes:', filters.cityCodes);

  const mode = user?.role === 'local_admin' ? filterMode : 'address';
  let history = await getInspectionHistory(undefined, 720, mode);

  console.log('[AdminFullView Debug] API returned count:', history.length);
  console.log('[AdminFullView Debug] First 3 records:', history.slice(0, 3));

  // ... existing filter logic

  console.log('[AdminFullView Debug] After filtering count:', history.length);
  setInspectionHistoryList(history);
}
```

### Step 3: 브라우저 상태 직접 확인
```javascript
// 브라우저 개발자 도구 Console에서 실행
console.log('Filters:', localStorage.getItem('aedpics-filters'));
console.log('User:', JSON.parse(localStorage.getItem('user') || '{}'));
```

### Step 4: Playwright MCP로 실시간 API 모니터링 (최후의 수단)
- Network 탭에서 API 호출 캡처
- 실제 응답 body 확인
- JavaScript 변수값 직접 조회

---

## 9. 실제 근본 원인 발견! (2025-11-11 04:35+) 🎯

### 진짜 문제: mode=jurisdiction일 때 보건소 이름 불일치

**왜 이전 단계에서 발견 못했나?**
- DB 조사와 SQL 시뮬레이션은 모두 **주소 기준 (mode=address)** 으로 했음
- 실제 UI는 **관할보건소 기준 (mode=jurisdiction)** 을 사용 중이었음
- localStorage에 `inspectionFilterMode: "jurisdiction"`이 저장되어 있었음

### 근본 원인

**파일**: `app/api/inspections/history/route.ts:102` (수정 전)

```typescript
// ❌ 문제: 원본 이름만 사용
aedFilter.jurisdiction_health_center = userProfile.organizations.name;
// "서귀포시 보건소" (공백 O)
```

**데이터베이스 실제 값**:
- organizations 테이블: `name = "서귀포시 보건소"` (공백 있음)
- aed_data 테이블: `jurisdiction_health_center = "서귀포시서귀포보건소"` (공백 없음, 구군명 중복)

**결과**: 문자열이 정확히 일치하지 않아 → API가 0개 반환 → UI에 "완료된 점검이 없습니다"

### 해결 방법

**파일**: `app/api/inspections/history/route.ts:99-115` (수정 후)

```typescript
if (filterMode === 'jurisdiction') {
  if (userProfile.organizations.name) {
    const originalName = userProfile.organizations.name;
    const normalizedName = normalizeJurisdictionName(originalName);

    // ✅ 원본 이름과 정규화된 이름 모두 검색
    aedFilter.OR = [
      { jurisdiction_health_center: originalName },     // "서귀포시 보건소"
      { jurisdiction_health_center: normalizedName }    // "서귀포시서귀포보건소"
    ];
  }
}
```

**normalizeJurisdictionName 함수** (`lib/constants/regions.ts:651`):
- 공백 제거
- 구군명 중복 패턴 정규화
- 예: "서귀포시 보건소" → "서귀포시서귀포보건소"

### 즉시 확인 방법

브라우저 Console에서:
```javascript
localStorage.getItem('inspectionFilterMode')
// "jurisdiction" → 이게 원인!
```

### 임시 해결 (사용자)

Console에서:
```javascript
localStorage.setItem('inspectionFilterMode', 'address')
location.reload()
```

### 완전 해결 (개발자)

1. ✅ API에 normalizeJurisdictionName 적용 (완료)
2. ✅ OR 조건으로 원본/정규화 이름 모두 검색 (완료)
3. 서버 재시작 후 관할보건소 기준 모드 테스트

### 교훈

1. **디버깅은 실제 실행 경로를 따라가야 함**
   - 가정하지 말고 확인: localStorage, API 파라미터, 실제 쿼리
   - UI가 사용하는 모드를 정확히 파악

2. **데이터 정규화는 양방향으로**
   - 입력 데이터만 정규화하면 안됨
   - 저장된 데이터도 정규화 또는 OR 조건 사용

3. **문자열 비교는 항상 의심**
   - 공백, 대소문자, 특수문자 차이
   - 정규화 함수를 미리 만들고 일관되게 사용

---

## 10. 관련 파일

- `components/inspection/AdminFullView.tsx` - 클라이언트 필터링 로직
- `app/api/inspections/history/route.ts` - 서버 권한 필터링
- `lib/state/aed-filters-store.ts` - filters 상태 관리
- `lib/inspections/session-utils.ts` - getInspectionHistory 함수

---

## 8. 교훈

### 이중 필터링은 권한 시스템의 적

**안티패턴**:
```typescript
// 서버에서 권한 필터링
const data = applyPermissionFilter(user);

// 클라이언트에서 또 필터링
const filtered = data.filter(item => matchesClientFilter(item));
```

**올바른 패턴**:
```typescript
// 서버에서 권한 필터링
const data = applyPermissionFilter(user);

// 클라이언트는 표시만
return <List items={data} />;

// 또는 권한 사용자는 클라이언트 필터링 건너뛰기
if (hasGlobalPermission(user)) {
  filtered = data.filter(item => matchesClientFilter(item));
} else {
  filtered = data; // 서버 필터링 신뢰
}
```

### 디버깅 원칙

1. **데이터베이스부터 역추적**
   - DB 상태 확인
   - API 쿼리 시뮬레이션
   - 클라이언트 렌더링 확인

2. **가정하지 말고 확인**
   - "API가 정상이겠지" ❌
   - "filters가 올바르겠지" ❌
   - **직접 확인** ✅

3. **문서로 기록**
   - 시도한 모든 것
   - 데이터베이스 상태
   - 다시 같은 실수 반복 방지

---

**최종 수정**: 2025-11-11 04:20
**상태**: 진행 중 (Playwright 조사 대기)
