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
cat > .env.production << 'ENVEOF'
# Database
DATABASE_URL="postgresql://aedpics_admin:AEDpics2025*NCP@pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com:5432/aedpics_production?schema=aedpics"

# NextAuth
NEXTAUTH_URL="http://223.130.150.133:3000"
NEXTAUTH_SECRET="OZ3p3VGk5qKdPQc1GsFqqDC9E/BfVn0iwNWuSyG+KEE="

# JWT & Encryption
JWT_SECRET="I2ZaT40bBTxAWpnDeI8NEXQPgXp/zkGqWVgpgyggSig="
ENCRYPTION_KEY="qwh0HqmM66IEOVbZ6S5DQ6BBdsjwv/6W3yYGZF3kfTw="

# Application
MASTER_EMAIL="admin@nmc.or.kr"
NEXT_PUBLIC_SITE_URL="http://223.130.150.133:3000"

# External APIs
NEXT_PUBLIC_KAKAO_MAP_APP_KEY="6e3339a5cbd61f1f3b08e3a06071795b"
RESEND_API_KEY="re_Mpcv9mDn_2Pooy8YjcwZTDpnQsbotJ2Ur"
ENVEOF

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
