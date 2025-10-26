# Organizations 데이터 Seed 방법

## 문제
- organizations 테이블이 비어있어서 승인할 소속기관을 선택할 수 없습니다.
- 콘솔 로그: `📋 [DEBUG] 로드된 조직 수: 0`

## 해결 방법

### 옵션 1: Supabase Studio (추천)

1. 브라우저에서 Supabase Studio 열기:
   ```
   http://localhost:54323
   ```

2. 좌측 메뉴에서 **SQL Editor** 클릭

3. `supabase/seed_organizations.sql` 파일 내용을 복사해서 붙여넣기

4. **Run** 버튼 클릭

5. 페이지 새로고침 후 승인 대기자 선택


### 옵션 2: 명령줄 (psql 설치 필요)

```bash
cd /Users/kwangsunglee/Projects/AED_check2025/aed-check-system

# psql로 직접 실행
PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres -f supabase/seed_organizations.sql
```

### 옵션 3: API를 통한 업로드 (개발용)

간단한 스크립트를 만들어 브라우저에서 실행:

```javascript
// 브라우저 콘솔에서 실행
// 이 방법은 임시 테스트용입니다
```

## 확인 방법

승인 페이지를 다시 로드하고 콘솔에서 확인:
```
📋 [DEBUG] 로드된 조직 수: 40  <- 0이 아닌 숫자가 나와야 함
📋 [DEBUG] 대구 조직: ["대구광역시 중구보건소", "대구광역시 수성구보건소", ...]
```

## 추가 문제 해결

region_code 불일치 문제는 코드로 해결했습니다:
- 사용자의 region_code가 "대구광역시" (한글)로 저장되어 있어도
- 자동으로 "DAE" (코드)로 변환합니다
