# 현재 위치 기반 초기화 구현 완료

## 📋 작업 개요

AED 데이터 페이지에서 **현재 위치 기반 자동 초기화** 기능을 구현했습니다.
기존 "서울 종로구" 강제 초기화를 제거하고, 사용자의 현재 위치를 기반으로 지도와 필터를 자동 설정합니다.

## ✅ 구현 완료 사항

### 1. 현재 위치 기반 초기화
- **Geolocation API** 사용하여 사용자의 현재 위치 감지
- **Kakao Maps Geocoder**로 좌표를 주소로 역변환
- 감지된 위치를 필터에 자동 적용
- 로딩 UI 표시로 사용자 경험 개선

### 2. 지역 코드 정규화
- `normalizeRegionName` 함수 개선
  - 긴 형태("대구광역시") → 짧은 형태("대구") 변환
  - 짧은 형태도 처리 가능하도록 이중 검증

### 3. viewMode 설정 문제 해결
- `AEDDataPageClient`에서 `viewMode="admin"` prop 명시적 추가
- 드롭다운 UI가 숨겨지는 문제 해결

### 4. MapView JSX 구조 수정
- 잘못된 JSX 구조 수정 (조건부 렌더링 위치 조정)

## 📂 수정된 파일

### 1. [AEDDataPageClient.tsx](aed-check-system/app/(authenticated)/aed-data/AEDDataPageClient.tsx)

**변경 내용**:
- 페이지 로드 시 geolocation 초기화 로직 추가
- sessionStorage에 위치 저장 (중복 감지 방지)
- Kakao Maps SDK 사용하여 역지오코딩
- 로딩 오버레이 UI 추가
- **중요**: `viewMode="admin"` prop 추가 (드롭다운 표시용)

```typescript
// 주요 코드
useEffect(() => {
  const initializeLocationFilter = async () => {
    // sessionStorage 확인 - 이미 있으면 스킵
    const existingSido = window.sessionStorage.getItem('selectedSido');
    const existingGugun = window.sessionStorage.getItem('selectedGugun');

    if (existingSido && existingGugun) {
      return;
    }

    // Geolocation 요청
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        // Kakao Geocoder로 주소 변환
        await waitForKakaoMaps();
        const geocoder = new window.kakao.maps.services.Geocoder();

        geocoder.coord2RegionCode(lng, lat, function(result, status) {
          if (status === window.kakao.maps.services.Status.OK) {
            const region = result.find(r => r.region_type === 'H');
            const sidoFull = region.region_1depth_name; // "대구광역시"
            const gugun = region.region_2depth_name;     // "중구"

            // normalizeRegionName: "대구광역시" → "대구"
            const sidoShort = normalizeRegionName(sidoFull);

            // sessionStorage 저장
            window.sessionStorage.setItem('selectedSido', sidoShort);
            window.sessionStorage.setItem('selectedGugun', gugun);

            // 필터 적용
            setFilters({
              regionCodes: [sidoShort],
              cityCodes: [gugun],
              queryCriteria: 'address',
              category_1: ['구비의무기관']
            });

            // 드롭다운 업데이트 이벤트 발생
            window.dispatchEvent(new CustomEvent('mapRegionChanged', {
              detail: { sido: sidoShort, gugun }
            }));
          }
        });
      }
    );
  };

  initializeLocationFilter();
}, [setFilters]);
```

### 2. [regions.ts](aed-check-system/lib/constants/regions.ts)

**변경 내용**:
- `normalizeRegionName` 함수 개선
- 긴 형태, 짧은 형태 모두 처리

```typescript
export function normalizeRegionName(fullName: string): string {
  // 긴 형태 먼저 확인 ("대구광역시")
  let code = REGION_LONG_LABELS[fullName];

  // 없으면 짧은 형태 확인 ("대구")
  if (!code) {
    code = REGION_LABEL_TO_CODE[fullName];
  }

  if (!code) {
    return fullName;
  }

  // 코드로 짧은 이름 찾기
  const region = REGIONS.find(r => r.code === code);
  return region?.label || fullName;
}
```

### 3. [MapView.tsx](aed-check-system/components/inspection/MapView.tsx)

**변경 내용**:
- JSX 구조 수정 (조건부 렌더링 들여쓰기 수정)
- 파싱 에러 해결

### 4. [AEDFilterBar.tsx](aed-check-system/app/aed-data/components/AEDFilterBar.tsx)

**변경 내용**:
- `mapRegionChanged` 이벤트 핸들러에서 label→code 변환 로직 추가
- 메인 useEffect에서도 label→code 변환 적용

### 5. [route.ts](aed-check-system/app/api/aed-data/route.ts)

**변경 내용**:
- `mapRegionCodesToDbLabels` 사용하여 DB 쿼리에 올바른 형식 전달

## 🔍 동작 흐름

1. **페이지 로드**
   - sessionStorage 확인 → 있으면 그대로 사용
   - 없으면 geolocation 요청

2. **위치 감지 성공**
   - Kakao Geocoder로 좌표 → 주소 변환
   - "대구광역시" → "대구" 정규화
   - sessionStorage 저장
   - 필터 적용
   - `mapRegionChanged` 이벤트 발생 → 드롭다운 업데이트

3. **위치 권한 거부**
   - 기본 필터 유지 (아무 지역도 선택 안 됨)

## 🎯 주요 기능

- ✅ 현재 위치 기반 자동 초기화
- ✅ 로딩 UI 표시
- ✅ 중복 요청 방지 (sessionStorage)
- ✅ 지역 코드 정규화 (긴/짧은 형태 처리)
- ✅ 드롭다운 자동 업데이트
- ✅ 지도 <-> 드롭다운 양방향 동기화

## 📝 참고 문서

- [REGION_FILTER_FIX_SUMMARY.md](REGION_FILTER_FIX_SUMMARY.md) - 지역 필터 수정 요약
- [lib/constants/regions.ts](lib/constants/regions.ts) - 지역 코드 관리 (Single Source of Truth)

---

**작성일**: 2025-10-05
**작성자**: Claude Code
