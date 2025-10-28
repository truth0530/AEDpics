#!/bin/bash
# Nginx 리버스 프록시 설정 스크립트

set -e

echo "========================================="
echo "Nginx 설정 시작"
echo "========================================="

# Nginx 사이트 설정 파일 생성
echo "Nginx 사이트 설정 파일 생성..."
cat > /etc/nginx/sites-available/aedpics << 'NGINXEOF'
server {
    listen 80;
    server_name 223.130.150.133;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 타임아웃 설정
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
NGINXEOF

# 심볼릭 링크 생성
echo "사이트 활성화..."
ln -sf /etc/nginx/sites-available/aedpics /etc/nginx/sites-enabled/

# 기본 사이트 비활성화
echo "기본 사이트 비활성화..."
rm -f /etc/nginx/sites-enabled/default

# 설정 테스트
echo "Nginx 설정 테스트..."
nginx -t

# Nginx 재시작
echo "Nginx 재시작..."
systemctl restart nginx

echo "========================================="
echo "Nginx 설정 완료"
echo "Nginx 상태:"
systemctl status nginx --no-pager
echo "========================================="
