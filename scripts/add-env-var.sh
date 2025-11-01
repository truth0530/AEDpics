#!/bin/bash
# 새 환경변수를 lib/env.ts에 자동으로 추가하는 스크립트
# 사용법: ./scripts/add-env-var.sh MY_NEW_VAR string required

VAR_NAME=$1
VAR_TYPE=${2:-"string"}  # string, number, boolean, url, email
REQUIRED=${3:-"optional"}  # required, optional

if [ -z "$VAR_NAME" ]; then
  echo "사용법: ./scripts/add-env-var.sh VAR_NAME [type] [required|optional]"
  echo "예시: ./scripts/add-env-var.sh MY_API_KEY string required"
  exit 1
fi

# Zod 스키마 생성
case $VAR_TYPE in
  url)
    SCHEMA="z.string().url('$VAR_NAME must be a valid URL')"
    ;;
  email)
    SCHEMA="z.string().email('$VAR_NAME must be a valid email')"
    ;;
  number)
    SCHEMA="z.string().regex(/^\d+\$/, '$VAR_NAME must be a number')"
    ;;
  boolean)
    SCHEMA="z.enum(['true', 'false']).optional().transform(val => val === 'true')"
    ;;
  *)
    SCHEMA="z.string().min(1, '$VAR_NAME is required')"
    ;;
esac

if [ "$REQUIRED" = "optional" ]; then
  SCHEMA="$SCHEMA.optional()"
fi

echo "✅ 아래 코드를 lib/env.ts에 추가하세요:"
echo ""
echo "  $VAR_NAME: $SCHEMA,"
echo ""
echo "그리고 .env.example에도 추가하세요:"
echo "$VAR_NAME=your_value_here"
