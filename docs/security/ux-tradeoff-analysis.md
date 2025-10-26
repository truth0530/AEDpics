# 보건소/임시점검원 보안 vs UX 트레이드오프 분석

**작성일**: 2025-01-05
**목적**: GPS 기반 초기화 시 권한 제어 및 UX 영향 분석
**핵심 질문**: 관할 외 위치 감지 시 어떻게 처리할 것인가?

---

## 🔐 현재 권한 정책 분석

### 1. **역할별 접근 권한**

#### local_admin (보건소 담당자)

**코드**: `access-control.ts:317-322`

```typescript
if (userProfile.role === 'local_admin') {
  const cityCode = userProfile.organization?.city_code;
  if (!cityCode) {
    throw new Error(`Local admin requires city_code`);
  }
  // 시도 고정
  allowedRegionCodes = [normalizedRegionCode]; // 예: ["충남"]
  // 시군구 고정
  allowedCityCodes = [cityCode]; // 예: ["천안시"]
}
```

**권한**:
- ✅ 본인 시도 + 시군구만 조회 가능
- ❌ 다른 지역 데이터 **절대 접근 불가** (API 레벨에서 차단)
- ❌ 필터 UI 자체가 표시 안 됨 (`RegionFilter.tsx:49`)

---

#### temporary_inspector (임시 점검원)

**코드**: `access-control.ts:307-309, 340-342`

```typescript
// 1. AED 데이터 조회 자체가 차단됨
if (userProfile.role === 'temporary_inspector') {
  throw new Error('Temporary inspector cannot access AED data without assigned region');
}

// 2. canAccessAEDData도 false 반환
if (role === 'temporary_inspector') {
  return false; // Line 340-342
}
```

**권한**:
- ❌ **AED 데이터 조회 완전 차단**
- ✅ 할당된 장비만 점검 가능 (assignment 시스템)
- ❌ 필터 UI 표시 안 됨

---

### 2. **현재 필터 표시 정책**

**코드**: `RegionFilter.tsx:48-50`

```typescript
// 보건소 담당자와 임시점검원은 필터를 표시하지 않음
const shouldShowFilter = user.role !== 'health_center' && user.role !== 'temp_inspector';
```

**결과**:
- 보건소/임시점검원 → **필터 없음**
- 지도 기능 사용 불가 (필터가 없으면 조회 안 됨)

---

## 🚨 문제 시나리오 분석

### Scenario 1: 보건소 담당자 출장 중

```
┌─────────────────────────────────────────────────┐
│ 사용자: 충남 천안시 보건소 담당자                 │
├─────────────────────────────────────────────────┤
│ 1. 현재 위치: 대구 (출장 중)                     │
│ 2. GPS 감지: 대구 수성구                         │
│ 3. 필터 자동 설정 시도: "대구, 수성구"           │
│    ↓                                            │
│ 4. API 호출: allowedRegionCodes = ["충남"]      │
│             allowedCityCodes = ["천안시"]       │
│    ↓                                            │
│ 5. 결과: ❌ 403 Forbidden (권한 없음)            │
│    ↓                                            │
│ 6. 사용자 화면: 빈 목록, "데이터 없음"           │
│                                                 │
│ ❓ 사용자 혼란:                                  │
│   "왜 아무것도 안 보이지?"                       │
│   "앱이 고장났나?"                               │
│   "출장 중에는 못 쓰는 건가?"                     │
└─────────────────────────────────────────────────┘
```

---

### Scenario 2: GPS 오인식

```
┌─────────────────────────────────────────────────┐
│ 사용자: 충남 천안시 보건소 담당자                 │
├─────────────────────────────────────────────────┤
│ 1. 현재 위치: 충남 천안시 (실제)                 │
│ 2. GPS 오인식: 충남 아산시 (1km 차이)            │
│ 3. 필터 자동 설정: "충남, 아산시"                │
│    ↓                                            │
│ 4. API 호출: allowedRegionCodes = ["충남"] ✅   │
│             allowedCityCodes = ["천안시"] ❌     │
│    → 필터 요청: cityCodes = ["아산시"]           │
│    ↓                                            │
│ 5. 결과: ❌ 403 Forbidden 또는 빈 결과           │
│                                                 │
│ ❓ 사용자 혼란:                                  │
│   "분명 천안인데 왜 안 보이지?"                   │
│   "GPS가 이상한가?"                              │
└─────────────────────────────────────────────────┘
```

---

### Scenario 3: 임시 점검원

```
┌─────────────────────────────────────────────────┐
│ 사용자: 임시 점검원 (할당된 장비: 5개)            │
├─────────────────────────────────────────────────┤
│ 1. 현재 상황: AED 목록 조회 자체가 불가           │
│ 2. GPS 위치: 어디든                              │
│ 3. 필터: 없음 (표시 안 됨)                       │
│    ↓                                            │
│ 4. API: canAccessAEDData = false                │
│    ↓                                            │
│ 5. 결과: 점검 메뉴만 접근 가능                   │
│         할당된 5개 장비만 점검                    │
│                                                 │
│ ✅ 이 경우는 정상 (지도 기능 필요 없음)           │
└─────────────────────────────────────────────────┘
```

---

## ⚖️ 보안 vs UX 트레이드오프

### Option 1: GPS 기반 초기화 (현재 제안)

```typescript
// 내 위치 감지 → 자동 필터 설정
const detectedRegion = "대구";
const detectedCity = "수성구";

// 보건소 담당자의 경우
if (user.role === 'local_admin') {
  // ❌ 문제: 관할 외 지역으로 설정됨
  setFilter({ region: "대구", city: "수성구" });
  // → API 호출 시 403 Forbidden
}
```

**장점**:
- ✅ 일반 사용자: 직관적
- ✅ 관할 내 이동: 자동 조정

**단점**:
- ❌ 관할 외 위치: 데이터 없음 (혼란)
- ❌ GPS 오인식: 잘못된 지역 설정
- ❌ 출장 중: 사용 불가능

---

### Option 2: 관할 지역 우선 (✅ 권장)

```typescript
// 역할별 우선순위
if (user.role === 'local_admin') {
  // 1순위: 본인 관할 (DB에 저장된 값)
  const myRegion = user.organization.region_code; // "충남"
  const myCity = user.organization.city_code; // "천안시"
  setFilter({ region: myRegion, city: myCity });

  // GPS는 무시 (보안 우선)
} else if (user.role === 'temporary_inspector') {
  // 필터 자체가 없음 (현재대로 유지)
} else {
  // 기타: GPS 기반 초기화
  setFilter({ region: detectedRegion, city: detectedCity });
}
```

**장점**:
- ✅ 보안: 관할 외 데이터 접근 차단
- ✅ UX: 항상 본인 데이터 표시
- ✅ GPS 무관: 출장 중에도 사용 가능
- ✅ 단순: 코드 복잡도 낮음

**단점**:
- ⚠️ 보건소 담당자: GPS 위치와 무관 (But, 이게 정상!)

---

### Option 3: 하이브리드 (복잡함, 비권장)

```typescript
// GPS 감지 → 관할 확인 → 조건부 설정
if (user.role === 'local_admin') {
  const detectedRegion = await detectGPS();
  const myRegion = user.organization.region_code;

  // 관할 내에 있으면 GPS 사용, 아니면 본인 관할
  if (detectedRegion === myRegion) {
    setFilter({ region: detectedRegion, city: detectedCity });
  } else {
    // 경고 메시지 표시
    showWarning("관할 외 지역입니다. 본인 관할로 설정합니다.");
    setFilter({ region: myRegion, city: myCity });
  }
}
```

**장점**:
- ✅ 관할 내: GPS 활용
- ✅ 관할 외: 안전하게 폴백

**단점**:
- ❌ 복잡도 높음
- ❌ GPS 오인식 시 불필요한 경고
- ❌ 유지보수 어려움

---

## 🎯 권장 정책: 역할별 차등 적용

### 최종 권장안

```typescript
// MapView.tsx 또는 RegionFilter.tsx 초기화 로직

function getInitialRegion(user: UserProfile, geoLocation?: GeolocationResult) {
  // 1. 보건소 담당자 (local_admin)
  if (user.role === 'local_admin') {
    return {
      sido: user.organization.region_code, // 예: "충남"
      gugun: user.organization.city_code,  // 예: "천안시"
      reason: 'jurisdiction' // 관할 우선
    };
  }

  // 2. 임시 점검원 (temporary_inspector)
  if (user.role === 'temporary_inspector') {
    return null; // 필터 없음 (현재대로)
  }

  // 3. 시도청 담당자 (regional_admin)
  if (user.role === 'regional_admin') {
    if (user.region) {
      return {
        sido: user.region, // 본인 시도
        gugun: null, // 시군구는 선택 가능
        reason: 'jurisdiction'
      };
    }
  }

  // 4. 중앙응급/master 등 (GPS 활용)
  if (geoLocation) {
    return {
      sido: normalizeRegionName(geoLocation.sido),
      gugun: geoLocation.gugun,
      reason: 'gps'
    };
  }

  // 5. 폴백 (GPS 실패 시)
  return {
    sido: '서울',
    gugun: '중구',
    reason: 'default'
  };
}
```

---

## 📊 역할별 정책 비교표

| 역할 | 필터 표시 | 초기값 | GPS 사용 | 이유 |
|------|-----------|--------|----------|------|
| **중앙응급** | ✅ | GPS 위치 | ✅ | 전국 조회 가능, 직관성 우선 |
| **master** | ✅ | GPS 위치 | ✅ | 전국 조회 가능, 직관성 우선 |
| **시도청** | ✅ | 본인 시도 | ❌ | 시도 고정, 보안 우선 |
| **보건소** | ❌ | 본인 관할 | ❌ | **보안 우선, 관할 외 차단** |
| **임시점검원** | ❌ | 없음 | ❌ | 할당 장비만, 필터 불필요 |

---

## 🔒 보안 vs UX 우선순위 결정

### 보건소 담당자 (local_admin)

#### ❌ GPS 기반 초기화를 하면 안 되는 이유

1. **법적 책임**
   - 관할 외 데이터 접근 시 개인정보 침해 가능
   - 보건소는 관할 구역만 관리 권한 있음

2. **보안 원칙**
   - Principle of Least Privilege (최소 권한 원칙)
   - 필요한 데이터만 접근

3. **실무 불필요**
   - 출장 중에도 본인 관할 데이터만 필요
   - 다른 지역 데이터는 해당 보건소 업무

4. **UX 혼란 방지**
   - GPS → "대구" 설정 → 데이터 없음 → 혼란
   - 본인 관할 고정 → 항상 데이터 있음 → 명확

#### ✅ 관할 지역 고정이 더 나은 이유

```
┌─────────────────────────────────────────────┐
│ 천안시 보건소 담당자 출장 중                  │
├─────────────────────────────────────────────┤
│ GPS 위치: 대구 (출장)                        │
│ 필터: "충남 천안시" (고정) ✅                 │
│ 데이터: 천안시 AED 목록 표시 ✅               │
│                                             │
│ 사용자 경험:                                 │
│ "출장 중에도 우리 관할 데이터 확인 가능" ✅    │
│ "명확하고 예측 가능" ✅                       │
└─────────────────────────────────────────────┘
```

---

## 💻 구현 방안

### 수정 필요한 부분

#### 1. RegionFilter.tsx (목록 필터)

```typescript
// 현재: Line 38-39
const [selectedSido, setSelectedSido] = useState('서울');
const [selectedGugun, setSelectedGugun] = useState('중구');

// 개선:
const [selectedSido, setSelectedSido] = useState(() => {
  // 보건소: 본인 관할
  if (user.role === 'local_admin' && user.organization) {
    return user.organization.region_code; // "충남"
  }
  // 시도청: 본인 시도
  if (user.role === 'regional_admin' && user.region) {
    return user.region;
  }
  // 기타: 서울 (또는 GPS)
  return '서울';
});

const [selectedGugun, setSelectedGugun] = useState(() => {
  // 보건소: 본인 시군구
  if (user.role === 'local_admin' && user.organization) {
    return user.organization.city_code; // "천안시"
  }
  // 기타: 첫 번째 구군
  return '중구';
});
```

---

#### 2. MapView.tsx (지도 초기화)

```typescript
useEffect(() => {
  if (!map || !isInitialLoadRef.current) return;

  // ✅ 보건소/시도청: 본인 관할 우선
  if (user.role === 'local_admin' && user.organization) {
    const myRegion = user.organization.region_code;
    const myCity = user.organization.city_code;

    // 필터 설정
    window.sessionStorage.setItem('selectedSido', myRegion);
    window.sessionStorage.setItem('selectedGugun', myCity);

    // 지도 중심 이동 (본인 관할 중심)
    const region = REGIONS.find(r => r.label === myRegion);
    if (region) {
      const center = new kakao.maps.LatLng(region.latitude, region.longitude);
      map.setCenter(center);
    }

    // 이벤트 발생
    window.dispatchEvent(new CustomEvent('mapRegionChanged', {
      detail: { sido: myRegion, gugun: myCity, autoLoad: true }
    }));

    isInitialLoadRef.current = false;
    return;
  }

  // ✅ 시도청: 본인 시도 우선
  if (user.role === 'regional_admin' && user.region) {
    // 시도만 설정, 시군구는 첫 번째
    // ...
    return;
  }

  // ✅ 기타: GPS 기반 초기화
  navigator.geolocation.getCurrentPosition((position) => {
    // 기존 제안대로
  });
}, [map, user]);
```

---

## 🎬 최종 결론

### Q1: GPS 기반 초기화 → 보건소 담당자에게 적용하면?

**A: ❌ 하면 안 됩니다.**

**이유**:
1. 보안 위반: 관할 외 데이터 접근 시도
2. UX 혼란: 데이터 없는 화면 표시
3. 법적 문제: 개인정보 접근 권한 위반 가능

---

### Q2: 본인 관할 디폴트 vs "서울 중구" 디폴트?

**A: ✅ 본인 관할 디폴트가 훨씬 낫습니다.**

**비교**:

| 측면 | 서울 중구 디폴트 | 본인 관할 디폴트 |
|------|------------------|------------------|
| **보안** | ⚠️ 관할 외 시도 가능 | ✅ 관할만 접근 |
| **UX** | ❌ 매번 변경 필요 | ✅ 즉시 사용 가능 |
| **복잡도** | 🟢 단순 (하드코딩) | 🟢 단순 (DB 값) |
| **일관성** | ❌ 모든 역할 동일 | ✅ 역할별 최적화 |

---

### Q3: 코드 복잡도가 증가하나?

**A: ❌ 오히려 단순해집니다.**

**before** (서울 중구 디폴트):
```typescript
const [selectedSido] = useState('서울'); // 하드코딩
const [selectedGugun] = useState('중구'); // 하드코딩

useEffect(() => {
  // 시도청 예외 처리
  if (user.role === 'province' && user.region) {
    setSelectedSido(user.region); // 추가 로직
  }
}, [user]);
```

**after** (역할별 디폴트):
```typescript
const [selectedSido] = useState(() => {
  // 단일 로직으로 모든 케이스 처리
  if (user.role === 'local_admin') return user.organization.region_code;
  if (user.role === 'regional_admin') return user.region;
  return '서울'; // 폴백
});
```

**결과**: 코드 줄 수 감소, 로직 명확

---

## 📝 최종 권장 정책

### ✅ 역할별 차등 적용

```
┌─────────────────────────────────────────────────┐
│ 역할별 초기화 정책                               │
├─────────────────────────────────────────────────┤
│ 1. 보건소 (local_admin)                         │
│    → 본인 관할 고정 (GPS 무시)                   │
│                                                 │
│ 2. 시도청 (regional_admin)                      │
│    → 본인 시도 고정 (GPS 무시)                   │
│                                                 │
│ 3. 임시점검원 (temporary_inspector)             │
│    → 필터 없음 (현재대로 유지)                   │
│                                                 │
│ 4. 중앙응급/master                              │
│    → GPS 기반 초기화 (직관성 우선)               │
│                                                 │
│ 5. 기타                                         │
│    → GPS 기반 또는 서울 (폴백)                   │
└─────────────────────────────────────────────────┘
```

### 장점

- ✅ **보안**: 관할 외 접근 차단
- ✅ **UX**: 각 역할에 최적화
- ✅ **단순**: 단일 초기화 로직
- ✅ **일관성**: 데이터 항상 표시
- ✅ **법적 안전**: 권한 위반 방지

---

**작성자**: Claude (AED 픽스 개발팀)
**검토 요청**: 사용자 승인
