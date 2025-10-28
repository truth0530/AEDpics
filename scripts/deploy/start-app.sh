#!/bin/bash
# PM2로 애플리케이션 시작 스크립트

set -e

APP_DIR="/var/www/aedpics"

echo "========================================="
echo "애플리케이션 시작"
echo "========================================="

cd $APP_DIR

# PM2 ecosystem 파일 생성
echo "PM2 ecosystem 파일 생성..."
cat > ecosystem.config.js << 'ECOEOF'
module.exports = {
  apps: [{
    name: 'aedpics',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    cwd: '/var/www/aedpics',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
ECOEOF

# PM2로 애플리케이션 시작
echo "PM2로 애플리케이션 시작 중..."
pm2 start ecosystem.config.js

# PM2 프로세스 저장
pm2 save

# 상태 확인
echo "========================================="
echo "PM2 상태:"
pm2 status
echo "========================================="
echo "최근 로그:"
pm2 logs aedpics --lines 20 --nostream
echo "========================================="
