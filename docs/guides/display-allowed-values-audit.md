# display_allowed 값 처리 감사 보고서

## 현재 수정 상태

### 1. is_public_visible 계산 로직 (수정 완료 ✅)
```sql
CASE
  WHEN a.display_allowed = '표출허용' THEN true
  WHEN a.display_allowed IN ('미표출', '표출불가', '외부표출차단') THEN false
  WHEN UPPER(a.display_allowed) IN ('Y', 'YES', 'TRUE', '1') THEN true
  WHEN UPPER(a.display_allowed) IN ('N', 'NO', 'FALSE', '0') THEN false
  WHEN a.display_allowed IS NULL OR a.display_allowed = '' THEN true
  ELSE false  -- 기본값을 false로 변경 (안전한 접근)
END
```

### 2. hidden_count 계산 로직 (수정 완료 ✅)
```sql
COUNT(*) FILTER (
  WHERE display_allowed IN ('미표출', '표출불가', '외부표출차단') OR
        UPPER(display_allowed) IN ('N', 'NO', 'FALSE', '0') OR
        (display_allowed IS NOT NULL AND display_allowed != '' AND
         display_allowed != '표출허용' AND
         UPPER(display_allowed) NOT IN ('Y', 'YES', 'TRUE', '1'))
)
```

## 추가 검토 필요 사항

### 3. p_user_role 파라미터 사용 여부 ❓
- 현재 함수들이 p_user_role을 받지만 실제로 사용하지 않음
- 권한에 따른 데이터 필터링이 필요한지 확인 필요
- 예: sensitive data 마스킹, 특정 role만 비공개 데이터 조회 가능 등

### 4. 공개/비공개 데이터 필터링 ❓
- 현재 is_public_visible 계산만 하고 실제 WHERE 절에서 필터링하지 않음
- 비공개 데이터를 특정 권한만 볼 수 있어야 하는지 확인 필요

### 5. 권한별 접근 제어 가능성
```sql
-- 예시: 권한에 따른 필터링 추가 가능
AND (
  a.display_allowed = '표출허용' OR
  p_user_role IN ('master', 'emergency_center_admin', 'ministry_admin')
)
```

## 일관성 체크 결과

### ✅ 수정 완료
- get_aed_data_filtered: is_public_visible 로직 통일
- get_aed_data_by_jurisdiction: is_public_visible 로직 통일
- get_aed_data_summary: hidden_count 로직 일치

### ⚠️ 잠재적 이슈
1. **기본값 정책**: 알 수 없는 값을 false로 처리 (안전)
2. **NULL 처리**: NULL은 true로 처리 (기존 데이터 호환)
3. **대소문자**: UPPER() 함수로 일관성 확보

## 권장사항

1. **display_allowed 값 정규화**
   - 데이터베이스 레벨에서 CHECK 제약 추가
   - 또는 UPDATE 트리거로 값 정규화

2. **권한 기반 필터링 구현**
   - p_user_role 활용하여 실제 필터링 적용
   - 민감 데이터 마스킹 로직 추가

3. **성능 최적화**
   - display_allowed 컬럼에 인덱스 추가 고려
   - 함수 인덱스로 UPPER(display_allowed) 인덱싱