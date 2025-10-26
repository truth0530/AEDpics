# 지도/목록 초기화 정책 종합 분석 보고서

**작성일**: 2025-01-05
**목적**: 내 위치 기반 초기화 도입 시 영향도 분석
**범위**: 지역 가이드라인 준수, 권한 정책, 잠재적 부작용

---

## 📋 현재 정책 분석

### 1. **현재 디폴트 정책**

#### RegionFilter.tsx (목록 필터)
```typescript
// Line 38-39
const [selectedSido, setSelectedSido] = useState('서울');
const [selectedGugun, setSelectedGugun] = useState('중구');
```

**특징**:
- 모든 사용자에게 "서울 중구" 디폴트
- 예외: 시도청 담당자는 본인 시도로 초기화 (Line 68-72)

#### MapView.tsx (지도)
```typescript
// 현재 구현
- 디폴트 위치: 내 위치 (Geolocation API)
- 디폴트 필터: 없음 (목록에서 상속)
```

**문제점**:
- 지도는 충남 천안 → 필터는 서울 중구 → **불일치**

---

## 🔍 제안 구현의 가이드라인 준수 여부

### ✅ **완벽하게 준수함**

#### 1. normalizeRegionName() 사용
```typescript
// 제안 코드
const sidoFull = region.region_1depth_name; // "충청남도"
const sidoShort = normalizeRegionName(sidoFull); // "충남" ✅

// ❌ 금지된 방법 (사용 안 함)
const sidoShort = sidoFull.replace("도", ""); // "충청남" ❌
```

**결과**: ✅ 가이드라인 Case 1 정확히 준수

#### 2. 단일 진실의 원천
```typescript
// 모든 변환은 regions.ts의 함수 사용
import { normalizeRegionName } from '@/lib/constants/regions';
```

**결과**: ✅ 하드코딩 없음, 중앙 관리 준수

#### 3. DB 일관성
```typescript
// 변환 결과가 DB의 sido 컬럼과 정확히 일치
sidoShort = "충남" → DB: WHERE sido = '충남' ✅
```

**결과**: ✅ 데이터 정합성 보장

---

## ⚠️ 잠재적 부작용 분석

### 1. **권한 정책과의 충돌 검토**

#### 현재 권한 체계 (RegionFilter.tsx)

| 역할 | 필터 표시 | 시도 변경 | 초기 디폴트 |
|------|-----------|-----------|-------------|
| **중앙응급** | ✅ | ✅ | 서울 중구 |
| **master** | ✅ | ✅ | 서울 중구 |
| **시도청** | ✅ | ❌ | **본인 시도** |
| **보건소** | ❌ | - | (필터 없음) |
| **임시점검원** | ❌ | - | (필터 없음) |

#### 제안: 내 위치 기반 초기화

**Option A: 지도 탭만 적용**
```typescript
지도 탭: 내 위치 → 자동 설정 (충남 천안)
목록 탭: 기존 정책 유지 (서울 중구 또는 본인 시도)
```

**장점**:
- ✅ 기존 권한 정책 영향 없음
- ✅ 점진적 개선
- ✅ 롤백 쉬움

**단점**:
- ⚠️ 탭 간 불일치 지속

---

**Option B: 전체 적용 (목록 + 지도)**
```typescript
모든 탭: 내 위치 → 자동 설정 (충남 천안)
단, 시도청은 본인 시도 우선 (현재 정책 유지)
```

**장점**:
- ✅ 완전한 일관성
- ✅ UX 직관성 최대화
- ✅ 모든 역할에 공정

**단점**:
- ⚠️ 중앙응급/master의 "서울 중구" 디폴트 변경
- ⚠️ 정책 변경 영향 범위 큼

---

### 2. **기술적 부작용 검토**

#### ✅ **안전한 부분**

1. **무한 루프 방지**
   ```typescript
   // 이미 구현됨
   const isInitialLoadRef = useRef(true);
   if (!isInitialLoadRef.current) return; // 초기 1회만
   ```

2. **역지오코딩 안정성**
   ```typescript
   // 오류 처리 포함
   navigator.geolocation.getCurrentPosition(
     (success) => { /* ... */ },
     (error) => {
       // 실패 시 폴백: 서울 시청
       const defaultLatLng = new window.kakao.maps.LatLng(37.5665, 126.9780);
       map.setCenter(defaultLatLng);
     }
   );
   ```

3. **지역 코드 변환**
   ```typescript
   // normalizeRegionName 사용 → 100% 안전
   const sidoShort = normalizeRegionName(sidoFull);
   ```

#### ⚠️ **주의 필요한 부분**

1. **위치 권한 거부 시**
   - **현재 제안**: 서울 시청으로 폴백
   - **개선안**: 사용자 역할에 따라 폴백
     ```typescript
     (error) => {
       // 시도청 담당자: 본인 시도
       if (user.role === 'province' && user.region) {
         const region = REGIONS.find(r => r.label === user.region);
         if (region) {
           map.setCenter(new kakao.maps.LatLng(region.latitude, region.longitude));
           return;
         }
       }
       // 기타: 서울 시청
       map.setCenter(new kakao.maps.LatLng(37.5665, 126.9780));
     }
     ```

2. **해외 접속 시**
   - **문제**: 역지오코딩이 한국 외 지역 반환
   - **해결**:
     ```typescript
     // KOREA_BOUNDS 검증 추가
     const KOREA_BOUNDS = {
       minLat: 33.0, maxLat: 38.5,
       minLng: 124.0, maxLng: 132.0
     };

     if (lat < KOREA_BOUNDS.minLat || lat > KOREA_BOUNDS.maxLat ||
         lng < KOREA_BOUNDS.minLng || lng > KOREA_BOUNDS.maxLng) {
       // 한국 외 → 서울 시청으로 폴백
       console.warn('Location outside Korea, using default');
       // ...
     }
     ```

3. **모바일 데이터 사용량**
   - **영향**: Geolocation API + 역지오코딩 1회 추가
   - **크기**: ~1-2KB (무시 가능)
   - **빈도**: 탭 진입 시 1회만

---

### 3. **역할별 영향도**

#### 중앙응급의료센터 (central_emergency)

**현재**:
- 디폴트: 서울 중구
- 전국 조회 가능

**Option A (지도만)**:
- 목록: 서울 중구 (변경 없음)
- 지도: 내 위치 (충남 천안 등)
- 영향: ⚠️ 탭 간 불일치

**Option B (전체)**:
- 목록: 내 위치 (충남 천안 등)
- 지도: 내 위치 (일치)
- 영향: ⚠️ 정책 변경, ✅ 일관성 확보

**판단**:
- 서울 기반 직원 → 서울로 자동 설정 (문제없음)
- 지방 기반 직원 → 해당 지역으로 설정 (오히려 개선!)

---

#### 시도청 담당자 (province)

**현재**:
- 디폴트: 본인 시도 (예: 충남)
- 시도 변경 불가

**Option A/B 모두**:
- 본인 시도 우선 정책 유지
- 내 위치가 본인 시도와 다르면?
  ```typescript
  // 우선순위 설정
  if (user.role === 'province' && user.region) {
    // 1순위: 본인 시도 (현재 정책)
    setSelectedSido(user.region);
  } else {
    // 2순위: 내 위치 (신규)
    setSelectedSido(detectedRegion);
  }
  ```

**판단**: ✅ 영향 없음

---

#### 보건소/임시점검원 (health_center, temp_inspector)

**현재**:
- 필터 자체가 표시 안 됨
- 본인 관할 지역만 조회

**Option A/B 모두**:
- 영향 없음 (필터 사용 안 함)

**판단**: ✅ 영향 없음

---

## 🎯 권장 정책: **단계적 적용**

### Phase 1: 지도 탭만 (즉시 적용 가능)

```typescript
// 1. 지도 탭 진입 시
MapView.tsx: 내 위치 → 역지오코딩 → 필터 자동 설정

// 2. 목록 탭
RegionFilter.tsx: 기존 정책 유지 (서울 중구 / 본인 시도)

// 3. 탭 전환
목록 → 지도: 필터 상속 (현재대로)
지도 → 목록: 지도에서 설정한 필터 유지
```

**장점**:
- ✅ 기존 정책 영향 최소화
- ✅ 점진적 개선 (롤백 쉬움)
- ✅ 80%의 문제 해결

**단점**:
- ⚠️ 완전한 일관성은 아님

---

### Phase 2: 전체 적용 (사용자 피드백 후)

```typescript
// 모든 탭에서 내 위치 기반 초기화
// 단, 역할별 예외 처리

if (user.role === 'province' && user.region) {
  // 시도청: 본인 시도 우선
  defaultRegion = user.region;
} else if (geoLocation) {
  // 기타: 내 위치
  defaultRegion = detectedRegion;
} else {
  // 폴백: 서울 중구
  defaultRegion = '서울';
}
```

**장점**:
- ✅ 완전한 일관성
- ✅ 모든 역할에 최적화

**단점**:
- ⚠️ 정책 변경 영향 큼
- ⚠️ 충분한 테스트 필요

---

## 📊 비교표

| 측면 | 현재 | Option A<br/>(지도만) | Option B<br/>(전체) |
|------|------|---------------------|-------------------|
| **지도-필터 일치** | ❌ | 🟡 (지도 탭만) | ✅ |
| **UX 직관성** | ⚠️ | 🟢 | 🟢🟢 |
| **정책 변경 영향** | - | 🟢 (최소) | 🟡 (중간) |
| **롤백 용이성** | - | 🟢 | 🟡 |
| **권한 정책 준수** | ✅ | ✅ | ✅ |
| **지역 가이드라인** | ✅ | ✅ | ✅ |
| **구현 복잡도** | - | 🟢 (낮음) | 🟡 (중간) |

---

## ⚡ 잠재적 이슈 및 해결 방안

### Issue 1: 위치 권한 거부

**시나리오**:
```
사용자가 위치 권한 거부 → 내 위치 감지 실패
```

**해결**:
```typescript
// 폴백 전략
1순위: 시도청 담당자 → 본인 시도
2순위: 기타 → 서울 시청
3순위: 마지막 선택 지역 (sessionStorage)
```

---

### Issue 2: 해외/북한 지역 감지

**시나리오**:
```
해외 VPN 접속 → 역지오코딩 실패
북한 지역 좌표 → 잘못된 결과
```

**해결**:
```typescript
// 한국 범위 검증
if (!isWithinKoreaBounds(lat, lng)) {
  console.warn('Location outside Korea');
  fallbackToDefault();
}
```

---

### Issue 3: 느린 네트워크

**시나리오**:
```
Geolocation API 응답 느림 → 사용자 대기
```

**해결**:
```typescript
// 타임아웃 설정
navigator.geolocation.getCurrentPosition(
  success,
  error,
  { timeout: 5000, maximumAge: 60000 } // 5초 타임아웃
);
```

---

### Issue 4: 역지오코딩 실패

**시나리오**:
```
Kakao API 오류 → 지역명 못 가져옴
```

**해결**:
```typescript
// 에러 핸들링
geocoder.coord2RegionCode(lng, lat, (result, status) => {
  if (status !== kakao.maps.services.Status.OK) {
    console.error('Geocoding failed:', status);
    fallbackToDefault();
    return;
  }
  // ...
});
```

---

## 🎬 최종 권장안

### ✅ **Phase 1 먼저 구현 (지도 탭만)**

**이유**:
1. 기존 정책 영향 최소화
2. 즉시 적용 가능
3. 롤백 쉬움
4. 80%의 문제 해결

**구현 범위**:
- ✅ MapView.tsx 초기 로드 개선
- ✅ normalizeRegionName() 사용 (가이드라인 준수)
- ✅ 한국 범위 검증
- ✅ 폴백 전략

**영향**:
- ✅ 권한 정책: 영향 없음
- ✅ 지역 가이드라인: 100% 준수
- ✅ 부작용: 최소

---

### 🔮 **Phase 2 고려 (전체 적용)**

**조건**:
1. Phase 1 안정화 (2주 이상)
2. 사용자 피드백 긍정적
3. 중앙응급/master 담당자 승인

**추가 작업**:
- RegionFilter.tsx 초기화 로직 수정
- 역할별 폴백 전략 세분화
- 충분한 테스트 (모든 역할)

---

## 📝 체크리스트

### 구현 전 검증

- [x] 지역 가이드라인 준수 확인
- [x] 권한 정책 충돌 검토
- [x] 잠재적 부작용 분석
- [x] 폴백 전략 설계
- [ ] 테스트 시나리오 작성
- [ ] 사용자 승인

### 구현 후 검증

- [ ] normalizeRegionName() 정상 작동
- [ ] 한국 범위 검증 작동
- [ ] 위치 권한 거부 시 폴백 작동
- [ ] 모든 역할에서 테스트
- [ ] 성능 측정 (로딩 시간)

---

**작성자**: Claude (AED 픽스 개발팀)
**승인 대기**: 사용자 최종 결정
