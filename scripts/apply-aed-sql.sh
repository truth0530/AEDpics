#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "[error] SUPABASE_DB_URL 환경 변수를 설정해 주세요." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

SQL_FILE="${1:-supabase/fix_rpc_type_mismatch.sql}"

if [[ ! -f "$SQL_FILE" ]]; then
  echo "[error] SQL 파일을 찾을 수 없습니다: $SQL_FILE" >&2
  exit 1
fi

echo "[info] Supabase SQL 스크립트를 실행합니다... ($SQL_FILE)"
npx supabase db execute --db-url "$SUPABASE_DB_URL" --file "$SQL_FILE"

echo "[done] Supabase SQL 스크립트 실행이 완료되었습니다."
