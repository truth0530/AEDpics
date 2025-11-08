# 지역명 하드코딩 위반 파일 목록

## 🚨 즉시 수정이 필요한 파일들

### 1. components/layout/RegionFilter.tsx
**위반 내용**: GUGUN_MAP 하드코딩
```typescript
const GUGUN_MAP: Record<string, string[]> = {
  '서울': ['종로구', '중구', ...],  // ❌ 하드코딩
  '부산': ['중구', '서구', ...],     // ❌ 하드코딩
  // ... 17개 시도 모두 하드코딩
}
```
**해결책**: `lib/constants/regions.ts`의 CITY_CODE_TO_GUGUN_MAP 사용

### 2. scripts/create-test-user.ts
**위반 내용**: city_code 직접 지정
```typescript
city_code: '중구',  // ❌ 하드코딩
```
**해결책**: extractRegionFromOrgName() 사용

### 3. scripts/check-and-add-gimhae-health-centers.ts
**위반 내용**: city_code 직접 지정
```typescript
city_code: 'gimhae',  // ❌ 하드코딩
```
**해결책**: 통합 관리 함수 사용

### 4. scripts/add-missing-health-centers.ts
**위반 내용**: city_code 수동 지정
```typescript
city_code: hc.city_code,  // ❌ 검증 없이 사용
```
**해결책**: mapCityCodeToGugun()으로 검증 후 사용

### 5. scripts/check-and-add-cheongju-health-centers.ts
**위반 내용**: 청주시 구 하드코딩
```typescript
city_code: healthCenter.city_code,  // ❌ 하드코딩
```

## 📊 위반 통계

- **총 위반 파일**: 30개 이상
- **하드코딩된 지역명**: 500개 이상
- **중복된 로직**: 10개 이상

## 🔧 수정 우선순위

1. **긴급**: RegionFilter.tsx (사용자 UI에 직접 영향)
2. **높음**: API 라우트들 (데이터 조회에 영향)
3. **중간**: 스크립트 파일들 (일회성 작업)
4. **낮음**: 테스트 파일들

## ✅ 수정 체크리스트

- [ ] RegionFilter.tsx GUGUN_MAP 제거
- [ ] 모든 scripts/*.ts city_code 하드코딩 제거
- [ ] API 라우트 지역명 하드코딩 제거
- [ ] 테스트 파일 정리

## 🎯 목표

**2025년 11월 15일까지 모든 하드코딩 제거**

---
*작성일: 2025-11-08*
*작성자: Claude AI Assistant*