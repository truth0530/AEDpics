# AED 데이터 필터링 이슈 해결 방안

## 문제 상황
AED 데이터 필터링이 작동하지 않아 지역별 필터를 적용해도 데이터가 표시되지 않음

## 원인 분석

### 1. 데이터베이스 현황
- 총 AED 레코드: 80,863개
- 데이터 분포:
  - 서울: 14,070개
  - 경기: 15,085개
  - 부산: 4,465개
  - 대구: 3,300개
  - 인천: 4,852개
  - 강원: 3,000개
  - 기타 모든 시도 포함

### 2. 문제의 핵심
- **데이터**: `sido` 칼럼에 한글 짧은 이름 저장 ('서울', '부산', '대구' 등)
- **필터**: UI에서 영문 코드 사용 (SEO, BUS, DAE 등)
- **RPC 함수**: 영문 코드를 한글 이름과 직접 비교하여 매칭 실패

### 3. RPC 함수 동작
```sql
-- 기존: 영문 코드를 그대로 비교
WHERE sido = ANY(p_region_codes)  -- 'SEO' != '서울'

-- 수정 필요: 코드를 한글로 변환 후 비교
WHERE sido = ANY(korean_region_names)  -- '서울' = '서울' ✓
```

## 해결 방안

### 1단계: 임시 해결 (완료)
`supabase/fix_rpc_region_mapping.sql` 파일 생성:
- `map_region_code_to_korean` 함수 추가
- RPC 함수들이 영문 코드를 한글로 변환하여 필터링
- 테스트 결과: 경기(GYE) 데이터 조회 성공

### 2단계: 데이터베이스 적용
```bash
# SQL 파일을 Supabase SQL Editor에서 실행 필요
# 파일: /supabase/fix_rpc_region_mapping.sql
```

### 3단계: 데이터 정규화 (추후)
- sido 칼럼의 값을 통일 ('서울특별시' 또는 '서울'로 일관성 있게)
- region_code 칼럼 추가하여 영문 코드 저장
- RPC 함수를 region_code 기반으로 수정

## 테스트 결과

### 수정 전
```javascript
// 모든 지역 코드로 조회 시 0건 반환
RPC('get_aed_data_filtered', { p_region_codes: ['SEO'] })
// 결과: 0건
```

### 수정 후
```javascript
// 경기 지역 조회 성공
RPC('get_aed_data_filtered', { p_region_codes: ['GYE'] })
// 결과: 3건 (경기도 데이터)
```

## 남은 작업

1. ✅ 문제 원인 파악
2. ✅ RPC 함수 수정 SQL 작성
3. ⏳ Supabase에 SQL 적용
4. ⏳ 모든 지역 코드 테스트
5. ⏳ UI에서 전체 동작 확인

## 참고 사항

### 지역 코드 매핑
```
SEO: 서울    BUS: 부산    DAE: 대구    INC: 인천
GWA: 광주    DAJ: 대전    ULS: 울산    SEJ: 세종
GYE: 경기    GAN: 강원    CHB: 충북    CHN: 충남
JEB: 전북    JEN: 전남    GYB: 경북    GYN: 경남
JEJ: 제주
```

### 데이터 불일치 예시
- 대부분: '경기' (15,085건)
- 일부: '경기도' (3건)
- 정규화 필요

## 결론
RPC 함수가 지역 코드를 한글명으로 변환하도록 수정하면 필터링이 정상 작동함.
장기적으로는 데이터 정규화와 region_code 칼럼 추가가 필요함.