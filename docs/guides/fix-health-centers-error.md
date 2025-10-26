# health_centers 테이블 오류 해결 가이드

## 문제 설명
`/inspection` 페이지 접속 시 다음 오류가 발생:
```
Query failed: relation 'health_centers' does not exist
```

## 원인
`get_aed_data_by_jurisdiction` 및 `get_aed_data_filtered` 함수가 존재하지 않는 `health_centers` 테이블을 참조하고 있음. 실제로는 `organizations` 테이블을 사용해야 함.

## 해결 방법

### 1. Supabase Dashboard에서 SQL 실행

1. [Supabase Dashboard](https://supabase.com/dashboard/project/aieltmidsagiobpuebvv) 접속
2. 왼쪽 메뉴에서 "SQL Editor" 클릭
3. "New query" 버튼 클릭
4. 아래 SQL 전체를 복사하여 붙여넣기
5. "Run" 버튼 클릭

### 2. 실행할 SQL

파일 위치: `/supabase/fix_all_aed_functions.sql`

이 파일을 SQL Editor에서 실행하면:
- `get_aed_data_by_jurisdiction` 함수 수정
- `get_aed_data_filtered` 함수 수정
- 두 함수 모두 `health_centers` 대신 `organizations` 테이블 사용하도록 변경

### 3. 실행 확인

SQL 실행 후 마지막에 다음과 같은 결과가 표시되어야 함:
```
function_name                 | arg_count | arguments
------------------------------|-----------|----------
get_aed_data_by_jurisdiction | 12        | ...
get_aed_data_filtered        | 11        | ...
```

### 4. 테스트

1. 브라우저에서 http://localhost:3000/inspection 접속
2. 오류 없이 페이지가 로드되는지 확인
3. AED 데이터가 정상적으로 표시되는지 확인

## 추가 정보

- 이 문제는 데이터베이스 마이그레이션 과정에서 함수가 잘못 생성되어 발생
- `organizations` 테이블이 `type = 'health_center'`인 레코드를 보건소로 관리
- 수정된 함수는 올바른 테이블을 참조하도록 변경됨