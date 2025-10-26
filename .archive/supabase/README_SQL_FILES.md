# Supabase SQL 스크립트 정리 안내

이 디렉터리에는 운영 중 필요한 SQL 스크립트만 남겨두었습니다. 모든 스크립트는 Supabase SQL Editor나 `supabase db execute` 명령으로 실행할 수 있습니다.

## 📌 현재 유지 중인 스크립트

| 파일 | 용도 | 실행 시점 |
| --- | --- | --- |
| `fix_rpc_type_mismatch.sql` | AED 조회 RPC 함수의 TEXT 캐스팅 문제 수정 | **필수** – 신규 배포 직후 한 번 실행하거나 함수와 타입을 다시 맞출 때 |
| `create_cursor_based_aed_functions.sql` | 커서 기반 페이지네이션 함수 생성 (`get_aed_data_*_cursor`) | 선택 – 대용량 환경에서 커서 방식이 필요할 때 |
| `check_current_functions.sql` | 현재 등록된 AED 관련 함수 목록 확인 | 점검 시 수동 실행 |
| `cleanup_duplicate_users.sql` | 중복 사용자 정리 보조 스크립트 | 운영 이슈 발생 시 |
| `create_error_logs_table.sql` | 커스텀 에러 로깅 테이블 생성 | 에러 로깅 도입 시 한 번 |
| `init-master-accounts.sql` | 초기 마스터 계정 및 권한 설정 | 초기 셋업 또는 재설정 시 |
| `seed_health_centers_complete.sql` | 보건소 기준 데이터 입력 | 초기 데이터 수동 입력 시 |
| `seed_organizations.sql` | 조직 트리 샘플 데이터 입력 | 테스트/개발 환경 구성 시 |

> 과거에 사용되던 다수의 `fix_*`/`*_functions.sql` 파일은 모두 제거되었습니다. 필요한 경우 Git 기록에서 복원할 수 있습니다.

## ✅ 실행 순서 권장안
1. **초기 구축**: `migrations/` 폴더의 번호 순서대로 실행
2. **데이터 시드** (선택): `seed_organizations.sql`, `seed_health_centers_complete.sql`
3. **함수/뷰 보정**: `fix_rpc_type_mismatch.sql` → 필요 시 `create_cursor_based_aed_functions.sql`
4. **점검 도구**: 상황에 맞춰 개별 스크립트 실행

## 🛠️ 실행 예시
```bash
# Supabase CLI를 이용해 함수 보정 스크립트 실행
SUPABASE_DB_URL="postgresql://user:pass@host:5432/db" \
  npx supabase db execute --db-url "$SUPABASE_DB_URL" \
  --file supabase/fix_rpc_type_mismatch.sql
```

## ❗️ 유의 사항
- 스크립트 실행 전 반드시 최신 백업을 확보하세요.
- 함수 정의를 수정하는 스크립트(`fix_rpc_type_mismatch.sql`, `create_cursor_based_aed_functions.sql`)는 동시에 적용하지 말고 적용 결과를 확인한 뒤 다음 단계로 진행하세요.
- 제거된 레거시 스크립트가 다시 필요할 경우 `git log -- supabase`로 기록을 확인한 뒤 복구하세요.

필요한 스크립트만 유지하여 혼란을 줄였으며, 이후 추가 스크립트가 생기면 위 표에 목적과 실행 시점을 함께 정리해 주세요.
