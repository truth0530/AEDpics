# NCP 프로덕션 환경 설정 가이드

**작성일**: 2025-10-26
**버전**: 1.0.0
**대상**: AEDpics 프로덕션 배포

## 개요

AEDpics를 네이버 클라우드 플랫폼(NCP)에 배포하기 위한 프로덕션 환경 설정 가이드입니다.

## 사전 준비 완료 항목

### 1. 데이터베이스 (완료)
- NCP PostgreSQL 서버: pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com
- 데이터베이스: aedpics_production
- 스키마: aedpics
- 사용자: aedpics_admin
- 데이터:
  - Organizations: 291개
  - UserProfiles: 24개
  - AED 장치: 81,443개

### 2. 애플리케이션 (완료)
- Next.js 14 (App Router)
- Prisma ORM
- NextAuth.js 인증
- 117개 페이지 빌드 성공

## 1. NCP 서버 인스턴스 생성

### 1.1 서버 스펙 권장사항

**개발/스테이징 서버**
- vCPU: 2 Core
- Memory: 4GB
- Storage: 50GB SSD
- OS: Ubuntu 22.04 LTS

**프로덕션 서버**
- vCPU: 4 Core
- Memory: 8GB
- Storage: 100GB SSD
- OS: Ubuntu 22.04 LTS

### 1.2 네트워크 설정

**Public IP**
- 고정 Public IP 할당 필요
- SSL/TLS 인증서를 위한 도메인 연결

**방화벽 (ACG - Access Control Group)**
```
인바운드:
- SSH (22): 관리자 IP만 허용
- HTTP (80): 0.0.0.0/0 (리다이렉트용)
- HTTPS (443): 0.0.0.0/0

아웃바운드:
- PostgreSQL (5432): DB 서버 IP만 허용
- HTTPS (443): 0.0.0.0/0 (외부 API 호출용)
```

## 2. 서버 초기 설정

### 2.1 시스템 업데이트

```bash
# 시스템 패키지 업데이트
sudo apt update && sudo apt upgrade -y

# 필수 패키지 설치
sudo apt install -y curl git build-essential
```

### 2.2 Node.js 설치

```bash
# Node.js 20.x LTS 설치 (nvm 사용 권장)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# 설치 확인
node --version  # v20.x.x
npm --version   # v10.x.x
```

### 2.3 PM2 설치 (프로세스 관리자)

```bash
npm install -g pm2

# 시스템 부팅 시 PM2 자동 시작
pm2 startup
sudo env PATH=$PATH:/home/ubuntu/.nvm/versions/node/v20.x.x/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

## 3. 애플리케이션 배포

### 3.1 프로젝트 클론

```bash
# 배포용 디렉토리 생성
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www

# Git 클론
git clone <repository-url> aedpics
cd aedpics
```

### 3.2 환경변수 설정

```bash
# .env.production 파일 생성
cat > .env.production << 'EOF'
# Database
DATABASE_URL="postgresql://aedpics_admin:AEDpics2025*NCP@pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com:5432/aedpics_production?schema=aedpics"

# NextAuth
NEXTAUTH_URL="https://aedpics.nmc.or.kr"
NEXTAUTH_SECRET="<GENERATE_SECURE_SECRET_HERE>"
JWT_SECRET="<GENERATE_SECURE_SECRET_HERE>"

# Master Account
MASTER_ACCOUNT_EMAIL="truth0530@nmc.or.kr"

# Kakao Map
NEXT_PUBLIC_KAKAO_MAP_APP_KEY="<KAKAO_APP_KEY>"

# Resend API
RESEND_API_KEY="<RESEND_API_KEY>"

# Node Environment
NODE_ENV="production"
EOF

# 보안: 환경변수 파일 권한 설정
chmod 600 .env.production
```

**NEXTAUTH_SECRET 생성 방법**:
```bash
openssl rand -base64 32
```

### 3.3 의존성 설치 및 빌드

```bash
# 의존성 설치
npm ci --production=false

# Prisma 클라이언트 생성
npx prisma generate

# Next.js 빌드
npm run build
```

### 3.4 PM2로 애플리케이션 실행

```bash
# PM2 ecosystem 파일 생성
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'aedpics',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/aedpics',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_file: '.env.production',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '1G',
    watch: false,
    autorestart: true
  }]
}
EOF

# 로그 디렉토리 생성
mkdir -p logs

# PM2로 애플리케이션 시작
pm2 start ecosystem.config.js

# PM2 프로세스 저장 (재부팅 시 자동 시작)
pm2 save

# 상태 확인
pm2 status
pm2 logs aedpics --lines 50
```

## 4. Nginx 리버스 프록시 설정

### 4.1 Nginx 설치

```bash
sudo apt install -y nginx
```

### 4.2 Nginx 설정

```bash
# Nginx 설정 파일 생성
sudo cat > /etc/nginx/sites-available/aedpics << 'EOF'
upstream aedpics_app {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name aedpics.nmc.or.kr;

    # HTTP to HTTPS 리다이렉트
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name aedpics.nmc.or.kr;

    # SSL 인증서 (Let's Encrypt 사용 예정)
    ssl_certificate /etc/letsencrypt/live/aedpics.nmc.or.kr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/aedpics.nmc.or.kr/privkey.pem;

    # SSL 설정 (Mozilla Intermediate)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 보안 헤더
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # 로그
    access_log /var/log/nginx/aedpics_access.log;
    error_log /var/log/nginx/aedpics_error.log;

    # 업로드 크기 제한 (이미지 업로드 고려)
    client_max_body_size 10M;

    # Next.js 앱으로 프록시
    location / {
        proxy_pass http://aedpics_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90;
    }

    # 정적 파일 캐싱
    location /_next/static {
        proxy_pass http://aedpics_app;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, immutable";
    }

    # Health check
    location /api/health {
        proxy_pass http://aedpics_app;
        access_log off;
    }
}
EOF

# 설정 심볼릭 링크 생성
sudo ln -s /etc/nginx/sites-available/aedpics /etc/nginx/sites-enabled/

# 기본 사이트 비활성화
sudo rm -f /etc/nginx/sites-enabled/default

# Nginx 설정 테스트
sudo nginx -t

# Nginx 시작 (SSL 인증서 발급 후)
# sudo systemctl restart nginx
```

### 4.3 SSL 인증서 발급 (Let's Encrypt)

```bash
# Certbot 설치
sudo apt install -y certbot python3-certbot-nginx

# SSL 인증서 발급 (도메인 등록 후 실행)
sudo certbot --nginx -d aedpics.nmc.or.kr

# 자동 갱신 설정 확인
sudo systemctl status certbot.timer
```

## 5. 보안 설정

### 5.1 방화벽 (UFW)

```bash
# UFW 설치 및 활성화
sudo apt install -y ufw

# 기본 정책: 모든 인바운드 차단, 아웃바운드 허용
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 필요한 포트만 허용
sudo ufw allow 22/tcp   # SSH (관리자 IP만 허용하도록 추후 수정)
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS

# UFW 활성화
sudo ufw enable

# 상태 확인
sudo ufw status verbose
```

### 5.2 SSH 보안 강화

```bash
# SSH 설정 편집
sudo nano /etc/ssh/sshd_config

# 다음 설정 추가/수정:
# PermitRootLogin no
# PasswordAuthentication no  # SSH 키 인증만 허용
# PubkeyAuthentication yes
# Port 22  # 또는 다른 포트로 변경 (옵션)

# SSH 재시작
sudo systemctl restart sshd
```

### 5.3 Fail2Ban 설치 (무차별 대입 공격 방지)

```bash
# Fail2Ban 설치
sudo apt install -y fail2ban

# 설정 파일 복사
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# jail.local 편집
sudo nano /etc/fail2ban/jail.local

# [sshd] 섹션 활성화
# enabled = true
# maxretry = 5
# bantime = 3600

# Fail2Ban 시작
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

## 6. 모니터링 설정

### 6.1 Health Check API 생성

```bash
# app/api/health/route.ts 파일이 이미 존재하는지 확인
# 없다면 생성
```

파일: `app/api/health/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // 데이터베이스 연결 확인
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      uptime: process.uptime()
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: (error as Error).message
    }, { status: 503 });
  }
}
```

### 6.2 PM2 모니터링

```bash
# PM2 모니터링 대시보드 설치
npm install -g pm2-logrotate

# 로그 로테이션 설정
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true

# 실시간 모니터링
pm2 monit
```

### 6.3 시스템 모니터링 (htop)

```bash
sudo apt install -y htop

# 사용법
htop
```

## 7. 백업 설정

### 7.1 데이터베이스 백업 스크립트

```bash
# 백업 디렉토리 생성
sudo mkdir -p /var/backups/aedpics
sudo chown -R $USER:$USER /var/backups/aedpics

# 백업 스크립트 생성
cat > /var/backups/aedpics/backup-db.sh << 'EOF'
#!/bin/bash

# 설정
DB_HOST="pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com"
DB_PORT="5432"
DB_NAME="aedpics_production"
DB_USER="aedpics_admin"
DB_PASSWORD="AEDpics2025*NCP"
BACKUP_DIR="/var/backups/aedpics"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/aedpics_backup_$DATE.sql.gz"

# 백업 실행
PGPASSWORD=$DB_PASSWORD pg_dump \
  -h $DB_HOST \
  -p $DB_PORT \
  -U $DB_USER \
  -d $DB_NAME \
  -n aedpics \
  --no-owner \
  --no-acl \
  | gzip > $BACKUP_FILE

# 7일 이상 된 백업 파일 삭제
find $BACKUP_DIR -name "aedpics_backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
EOF

chmod +x /var/backups/aedpics/backup-db.sh
```

### 7.2 Cron 작업 설정 (일일 백업)

```bash
# Cron 작업 추가
crontab -e

# 매일 새벽 3시에 백업 실행
# 0 3 * * * /var/backups/aedpics/backup-db.sh >> /var/backups/aedpics/backup.log 2>&1
```

### 7.3 애플리케이션 파일 백업

```bash
# 애플리케이션 백업 스크립트
cat > /var/backups/aedpics/backup-app.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/var/backups/aedpics"
APP_DIR="/var/www/aedpics"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/aedpics_app_$DATE.tar.gz"

# 애플리케이션 백업 (node_modules 제외)
tar -czf $BACKUP_FILE \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='logs' \
  -C /var/www aedpics

# 30일 이상 된 백업 파일 삭제
find $BACKUP_DIR -name "aedpics_app_*.tar.gz" -mtime +30 -delete

echo "App backup completed: $BACKUP_FILE"
EOF

chmod +x /var/backups/aedpics/backup-app.sh
```

## 8. 배포 체크리스트

### 배포 전
- [ ] 환경변수 모두 설정 (.env.production)
- [ ] NEXTAUTH_SECRET 생성
- [ ] JWT_SECRET 생성
- [ ] 도메인 DNS 설정 완료
- [ ] NCP ACG (방화벽) 설정 완료
- [ ] PostgreSQL 연결 테스트

### 배포 중
- [ ] Git 클론 완료
- [ ] npm ci 성공
- [ ] npx prisma generate 성공
- [ ] npm run build 성공
- [ ] PM2 시작 성공
- [ ] Nginx 설정 완료
- [ ] SSL 인증서 발급 완료

### 배포 후
- [ ] HTTPS 접속 확인
- [ ] Health Check API 정상 응답
- [ ] 로그인 테스트
- [ ] AED 데이터 조회 테스트
- [ ] PM2 모니터링 확인
- [ ] 백업 스크립트 테스트
- [ ] Cron 작업 확인

## 9. 트러블슈팅

### 문제: 빌드 실패
```bash
# 캐시 삭제 후 재빌드
rm -rf .next node_modules
npm ci
npm run build
```

### 문제: PM2 앱 재시작 안됨
```bash
# PM2 프로세스 강제 종료 후 재시작
pm2 delete aedpics
pm2 start ecosystem.config.js
pm2 save
```

### 문제: Nginx 502 Bad Gateway
```bash
# Next.js 앱이 실행 중인지 확인
pm2 status

# Nginx 로그 확인
sudo tail -f /var/log/nginx/aedpics_error.log

# 포트 충돌 확인
sudo netstat -tuln | grep 3000
```

### 문제: 데이터베이스 연결 실패
```bash
# PostgreSQL 연결 테스트
PGPASSWORD='AEDpics2025*NCP' psql \
  -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com \
  -U aedpics_admin \
  -d aedpics_production \
  -p 5432 \
  -c "SELECT 1;"

# 방화벽 확인
sudo ufw status
```

## 10. 성능 최적화

### 10.1 Next.js 최적화

**next.config.ts에 추가**:
```typescript
const nextConfig = {
  output: 'standalone',  // 독립 실행 파일 생성
  compress: true,        // Gzip 압축
  poweredByHeader: false, // X-Powered-By 헤더 제거 (보안)
}
```

### 10.2 PM2 클러스터 모드

```javascript
// ecosystem.config.js에서
instances: 'max',  // CPU 코어 수만큼 인스턴스 생성
exec_mode: 'cluster'
```

### 10.3 Nginx 캐싱

이미 위 Nginx 설정에 정적 파일 캐싱 포함됨.

## 11. 유지보수

### 11.1 정기 점검 항목 (주 1회)
- PM2 로그 확인
- 디스크 사용량 확인 (`df -h`)
- 백업 파일 확인
- SSL 인증서 만료일 확인 (`sudo certbot certificates`)

### 11.2 업데이트 프로세스

```bash
cd /var/www/aedpics

# 최신 코드 받기
git pull origin main

# 의존성 업데이트 (필요시)
npm ci

# Prisma 재생성
npx prisma generate

# 빌드
npm run build

# PM2 재시작 (무중단 배포)
pm2 reload aedpics
```

## 12. 연락처

- 시스템 관리자: truth0530@nmc.or.kr
- 기술 지원: inhak@nmc.or.kr

---

**최종 업데이트**: 2025-10-26
**문서 버전**: 1.0.0
