#!/bin/bash
# 애플리케이션 설정 및 배포 스크립트

set -e

APP_DIR="/var/www/aedpics"
REPO_URL="https://github.com/kwangsunglee/AEDpics.git"

echo "========================================="
echo "애플리케이션 설정 시작"
echo "========================================="

# 디렉토리 생성
echo "애플리케이션 디렉토리 생성..."
mkdir -p $APP_DIR
cd $APP_DIR

# Git 저장소 클론
echo "GitHub 저장소 클론 중..."
if [ -d ".git" ]; then
    echo "기존 저장소 업데이트..."
    git pull origin main
else
    echo "새로 클론 중..."
    git clone $REPO_URL .
fi

# 환경변수 파일 생성
echo "환경변수 파일 생성..."
echo "ERROR: This script contains placeholder values only."
echo "Please create .env.production manually with actual credentials:"
echo ""
echo "Required environment variables:"
echo "  - DATABASE_URL (from NCP PostgreSQL)"
echo "  - NEXTAUTH_SECRET (generate with: openssl rand -base64 32)"
echo "  - JWT_SECRET (generate with: openssl rand -base64 32)"
echo "  - ENCRYPTION_KEY (generate with: openssl rand -base64 32)"
echo "  - NCP_ACCESS_KEY (from NCP Console)"
echo "  - NCP_ACCESS_SECRET (from NCP Console)"
echo "  - NEXT_PUBLIC_KAKAO_MAP_APP_KEY (from Kakao Developers)"
echo ""
echo "Refer to .env.example for complete configuration."
exit 1

# Placeholder for manual .env.production creation:
# cat > .env.production << 'ENVEOF'
# DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB?schema=SCHEMA"
# NEXTAUTH_URL="https://your-domain.com"
# NEXTAUTH_SECRET="generate-with-openssl-rand"
# JWT_SECRET="generate-with-openssl-rand"
# ENCRYPTION_KEY="generate-with-openssl-rand"
# MASTER_EMAIL="admin@nmc.or.kr"
# NEXT_PUBLIC_SITE_URL="https://your-domain.com"
# NEXT_PUBLIC_KAKAO_MAP_APP_KEY="your-kakao-key"
# NCP_ACCESS_KEY="your-ncp-access-key"
# NCP_ACCESS_SECRET="your-ncp-secret-key"
# NCP_SENDER_EMAIL="noreply@nmc.or.kr"
# ENVEOF

chmod 600 .env.production

# 의존성 설치
echo "npm 패키지 설치 중..."
npm ci --production=false

# Prisma 클라이언트 생성
echo "Prisma 클라이언트 생성 중..."
npx prisma generate

# 프로덕션 빌드
echo "Next.js 빌드 중..."
npm run build

echo "========================================="
echo "애플리케이션 설정 완료"
echo "========================================="
