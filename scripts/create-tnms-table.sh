#!/bin/bash

# 환경변수 로드
source .env

# 데이터베이스 연결 정보 파싱
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')

# PGPASSWORD 환경변수 설정
export PGPASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

echo "TNMS 매칭 테이블 생성 중..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f prisma/migrations/add_tnms_matching_table.sql

echo "완료!"