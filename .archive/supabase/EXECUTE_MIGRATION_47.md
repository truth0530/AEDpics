# Migration 47 실행 가이드

## 개요
Migration 47은 구비의무기관 매칭 관리 UI를 지원하는 PostgreSQL 함수를 생성합니다.

## 포함 내용
- `get_target_matching_list_2024()`: UI에서 매칭 목록을 조회하는 함수
  - 신뢰도별 필터링 (high/medium/low/all)
  - 지역별 필터링 (sido)
  - 검색 기능 (기관명, 관리번호)
  - 확정 여부 필터링

## 실행 방법

### 1. Supabase Dashboard SQL Editor 사용 (권장)

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 프로젝트 선택
3. SQL Editor 메뉴 선택
4. New Query 클릭
5. `/supabase/migrations/47_target_matching_ui_functions.sql` 파일 내용 복사
6. 붙여넣기 후 Run 클릭

### 2. psql 명령어 사용 (로컬 개발)

로컬 Supabase가 실행 중인 경우:
```bash
PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres \
  -f supabase/migrations/47_target_matching_ui_functions.sql
```

### 3. Supabase CLI 사용

프로젝트가 연결된 경우:
```bash
npx supabase db push
```

## 실행 결과 확인

### 함수 생성 확인
```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'get_target_matching_list_2024';
```

### 함수 테스트
```sql
-- 고신뢰도 매칭 10건 조회
SELECT * FROM get_target_matching_list_2024('high', NULL, NULL, FALSE)
LIMIT 10;

-- 서울 지역 매칭 조회
SELECT * FROM get_target_matching_list_2024('all', '서울특별시', NULL, FALSE)
LIMIT 10;

-- 검색 테스트
SELECT * FROM get_target_matching_list_2024('all', NULL, '한국철도', FALSE)
LIMIT 10;
```

## UI 페이지

Migration 47 실행 후 다음 페이지에서 사용 가능:
- `/admin/target-matching` - 구비의무기관 매칭 관리 페이지

## 관련 API 엔드포인트

- `GET /api/target-matching/stats` - 통계 조회
- `GET /api/target-matching?confidence_level=high&sido=서울특별시` - 매칭 목록 조회
- `POST /api/target-matching/confirm` - 매칭 확정
- `POST /api/target-matching/modify` - 매칭 수정
- `POST /api/target-matching/bulk-confirm` - 고신뢰도 일괄 확정

## 주의사항

1. **실행 순서**: Migration 46 이후에 실행해야 함
2. **권한**: authenticated 사용자만 함수 실행 가능
3. **타입 캐스팅**: VARCHAR → TEXT 명시적 캐스팅 적용됨
4. **성능**: 대용량 데이터에서는 필터링 필수 권장

## 트러블슈팅

### 에러: function does not exist
→ Migration 46 먼저 실행 확인
→ management_number_group_mapping 테이블 존재 확인

### 에러: permission denied
→ 로그인 상태 확인
→ RLS 정책 확인

### 결과가 없음
→ auto_match_management_numbers_batch() 실행 확인
→ 50,010건 매칭 데이터 존재 확인

## 작성일
2025-10-04
