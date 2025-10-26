# 긴급 데이터베이스 수정 필요

## 현재 발생하는 에러들

1. **audit_logs 테이블 없음** - 404 에러
2. **login_history 테이블 없음** - 404 에러
3. **record_user_login 함수 없음** - 함수를 찾을 수 없음 에러
4. **user_profiles.status 컬럼** - 이미 코드에서 제거 완료

## 해결 방법

### 방법 1: Supabase Dashboard에서 직접 실행 (권장)

1. [Supabase Dashboard](https://supabase.com/dashboard/project/aieltmidsagiobpuebvv) 접속
2. SQL Editor 탭으로 이동
3. 다음 파일의 내용을 복사하여 붙여넣기:
   ```
   /supabase/migrations/20250127_create_missing_tables.sql
   ```
4. "Run" 버튼 클릭하여 실행

### 방법 2: Supabase CLI 사용

```bash
# Supabase CLI가 설치되어 있다면
# 참고: 현재 프로젝트는 aieltmidsagiobpuebvv (aed.pics)를 사용합니다
npx supabase db push --db-url "postgresql://postgres:[PASSWORD]@db.aieltmidsagiobpuebvv.supabase.co:6543/postgres"
```

### 방법 3: npm 스크립트 사용

```bash
# package.json에 이미 정의된 스크립트 사용
npm run db:push
```

## 생성되는 것들

- `login_history` 테이블 - 사용자 로그인 기록 저장
- `record_user_login` 함수 - 로그인 기록 함수
- `audit_logs` 테이블 - 감사 로그 저장
- 필요한 인덱스와 RLS 정책들

## 확인 방법

SQL 실행 후 브라우저 개발자 콘솔에서:
- `record_user_login` 관련 에러 사라짐
- `login_history` 관련 에러 사라짐
- `audit_logs` 404 에러 사라짐

## 주의사항

- 이미 테이블이 존재하는 경우 안전하게 스킵됨 (IF NOT EXISTS 사용)
- RLS 정책이 자동으로 설정되어 보안 유지됨