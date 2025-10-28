#!/bin/bash
# PM2 및 Nginx 설치 스크립트

set -e

echo "========================================="
echo "PM2 및 Nginx 설치 시작"
echo "========================================="

# PM2 설치 (글로벌)
echo "PM2 설치 중..."
npm install -g pm2

echo "PM2 버전:"
pm2 --version

# PM2 부팅 시 자동 시작 설정
echo "PM2 startup 설정..."
pm2 startup systemd -u root --hp /root

# Nginx 설치
echo "Nginx 설치 중..."
apt install -y nginx

# Nginx 시작 및 활성화
echo "Nginx 시작 및 활성화..."
systemctl start nginx
systemctl enable nginx

echo "========================================="
echo "설치 완료"
echo "PM2 버전: $(pm2 --version)"
echo "Nginx 상태:"
systemctl status nginx --no-pager
echo "========================================="
