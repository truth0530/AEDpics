#!/bin/bash

# Supabase 타입 자동 생성 스크립트
# 프로젝트 ID와 익명 키를 사용하여 타입 생성

PROJECT_ID="aieltmidsagiobpuebvv"
SUPABASE_URL="https://aieltmidsagiobpuebvv.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpZWx0bWlkc2FnaW9icHVlYnZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNzkzNTIsImV4cCI6MjA3NTY1NTM1Mn0.wUmjCxKdMGu9ZEPWd8VlcuuFD9WfZdl7yEJTKkW4Y_Y"

echo "Generating TypeScript types from Supabase..."

npx supabase gen types typescript \
  --project-id "$PROJECT_ID" \
  --schema public \
  > lib/database.types.ts

echo "Types generated successfully at lib/database.types.ts"