# 🚨 긴급 수정 필요 - Supabase 함수 패치

## 문제
`relation "health_centers" does not exist` 오류로 인해 AED 데이터 조회 불가

## 해결 방법

### 1. Supabase Dashboard 접속
https://supabase.com/dashboard/project/aieltmidsagiobpuebvv/sql/new

### 2. SQL 실행
아래 파일의 전체 내용을 복사하여 실행:
```
/supabase/fix_all_aed_functions.sql
```

### 3. 실행할 SQL 내용
```sql
-- health_centers 테이블 참조를 organizations 테이블로 변경
-- get_aed_data_by_jurisdiction 함수 수정
-- get_aed_data_filtered 함수 수정
```

### 4. 테스트
SQL 실행 후 브라우저에서 확인:
- http://localhost:3000/inspection 페이지 새로고침
- 오류 없이 데이터 로드되는지 확인

## 중요도: ⭐⭐⭐⭐⭐
**이 작업을 완료하지 않으면 시스템 사용 불가**