# AEDpics NCP 프로덕션 배포 가이드

## 목차
1. [배포 개요](#배포-개요)
2. [인프라 요구사항](#인프라-요구사항)
3. [배포 절차](#배포-절차)
4. [설정 파일](#설정-파일)
5. [환경변수 설정](#환경변수-설정)
6. [보안 설정](#보안-설정)
7. [유지보수](#유지보수)
8. [트러블슈팅](#트러블슈팅)

---

## 배포 개요

### 배포 정보
- **배포 일자**: 2025-10-28
- **배포 환경**: NCP (Naver Cloud Platform)
- **도메인**: https://aed.pics
- **서버 OS**: Ubuntu 24.04 LTS
- **배포 위치**: /var/www/aedpics

### 기술 스택
- **Runtime**: Node.js v20.18.1
- **Framework**: Next.js 15 (App Router)
- **Process Manager**: PM2
- **Web Server**: Nginx 1.24.0
- **SSL/TLS**: Let's Encrypt (Certbot)
- **Database**: NCP PostgreSQL
- **Security**: fail2ban (SSH 보호)

---

## 인프라 요구사항

### 서버 사양
- **CPU**: 2 vCPU 이상
- **RAM**: 4GB 이상
- **Storage**: 50GB 이상
- **Network**: 고정 IP 주소

### 필수 소프트웨어
- Ubuntu 24.04 LTS
- Node.js v20.18.1
- npm 10.x
- PM2 (글로벌 설치)
- Nginx
- Certbot (Let's Encrypt)
- Git
- fail2ban

### 방화벽 설정
```bash
# 필수 포트 개방
- 22 (SSH)
- 80 (HTTP)
- 443 (HTTPS)
- 3000 (Next.js, 내부 전용)
```

---

## 배포 절차

### 1. 서버 초기 설정

#### 1.1 시스템 업데이트
```bash
apt update && apt upgrade -y
apt install -y curl git build-essential
```

#### 1.2 Node.js 설치
```bash
# NodeSource 저장소 추가
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -

# Node.js 설치
apt install -y nodejs

# 버전 확인
node --version  # v20.18.1
npm --version   # 10.x
```

#### 1.3 PM2 설치
```bash
# PM2 글로벌 설치
npm install -g pm2

# PM2 시스템 시작 스크립트 등록
pm2 startup systemd -u root --hp /root

# 버전 확인
pm2 --version
```

### 2. 애플리케이션 배포

#### 2.1 저장소 클론
```bash
# 배포 디렉토리 생성
mkdir -p /var/www/aedpics
cd /var/www/aedpics

# GitHub 저장소 클론
git clone https://github.com/kwangsunglee/AEDpics.git .

# 브랜치 확인
git branch
```

#### 2.2 환경변수 설정
```bash
# .env 파일 생성
nano /var/www/aedpics/.env

# .env.example을 참고하여 필수 환경변수 입력
# 자세한 내용은 "환경변수 설정" 섹션 참조
```

#### 2.3 의존성 설치
```bash
cd /var/www/aedpics

# node_modules 설치 (약 5-10분 소요)
npm ci --production=false

# 942개 패키지 설치됨
```

#### 2.4 Prisma 설정
```bash
# Prisma 클라이언트 생성
npx prisma generate

# 데이터베이스 스키마 동기화
npx prisma db push
```

#### 2.5 프로덕션 빌드
```bash
# Next.js 프로덕션 빌드 (약 5-10분 소요)
npm run build

# 빌드 완료 확인
# Route (app)                              Size     First Load JS
# ├ ○ /                                    216 B          93.4 kB
# ├ ○ /about                               172 B           138 kB
# ... (총 115개 페이지)
```

#### 2.6 PM2로 애플리케이션 시작
```bash
# PM2 설정 파일 사용
pm2 start ecosystem.config.js

# 또는 직접 명령어 사용
pm2 start npm --name aedpics -- start

# PM2 상태 확인
pm2 status

# PM2 자동 시작 설정 저장
pm2 save
```

### 3. Nginx 설정

#### 3.1 Nginx 설치
```bash
apt-get install -y nginx

# Nginx 시작 및 자동 시작 설정
systemctl start nginx
systemctl enable nginx
```

#### 3.2 Nginx 리버스 프록시 설정
```bash
# Nginx 설정 파일 생성
nano /etc/nginx/sites-available/aedpics
```

설정 내용:
```nginx
server {
  listen 80;
  server_name aed.pics www.aed.pics;
  client_max_body_size 10M;

  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
  }
}
```

#### 3.3 Nginx 설정 활성화
```bash
# 심볼릭 링크 생성
ln -sf /etc/nginx/sites-available/aedpics /etc/nginx/sites-enabled/

# 기본 사이트 비활성화
rm -f /etc/nginx/sites-enabled/default

# 설정 테스트
nginx -t

# Nginx 재시작
systemctl restart nginx
```

### 4. SSL/TLS 설정 (Let's Encrypt)

#### 4.1 Certbot 설치
```bash
apt-get install -y certbot python3-certbot-nginx

# Certbot 버전 확인
certbot --version
```

#### 4.2 SSL 인증서 발급
```bash
# 자동으로 Nginx 설정 업데이트 및 HTTPS 리다이렉트 활성화
certbot --nginx \
  -d aed.pics \
  -d www.aed.pics \
  --non-interactive \
  --agree-tos \
  --email truth0530@nmc.or.kr \
  --redirect

# 인증서 상태 확인
certbot certificates
```

인증서 정보:
```
Certificate Name: aed.pics
  Domains: aed.pics www.aed.pics
  Expiry Date: 2026-01-25 (89 days)
  Certificate Path: /etc/letsencrypt/live/aed.pics/fullchain.pem
  Private Key Path: /etc/letsencrypt/live/aed.pics/privkey.pem
```

#### 4.3 자동 갱신 확인
```bash
# 자동 갱신 테스트 (실제로 갱신하지 않음)
certbot renew --dry-run

# certbot.timer 자동 시작 확인
systemctl status certbot.timer
```

### 5. 배포 검증

#### 5.1 PM2 상태 확인
```bash
pm2 status
# ┌────┬────────────┬─────────────┬─────────┬─────────┬──────────┐
# │ id │ name       │ mode        │ ↺       │ status  │ cpu      │
# ├────┼────────────┼─────────────┼─────────┼─────────┼──────────┤
# │ 0  │ aedpics    │ fork        │ 0       │ online  │ 0%       │
# └────┴────────────┴─────────────┴─────────┴─────────┴──────────┘
```

#### 5.2 애플리케이션 로그 확인
```bash
# 최근 로그 확인
pm2 logs aedpics --lines 50

# 실시간 로그 모니터링
pm2 logs aedpics
```

#### 5.3 웹사이트 접속 테스트
```bash
# HTTP 요청 테스트
curl -I http://aed.pics
# HTTP/1.1 301 Moved Permanently (HTTPS로 리다이렉트)

# HTTPS 요청 테스트
curl -I https://aed.pics
# HTTP/1.1 200 OK
# Server: nginx/1.24.0 (Ubuntu)
# X-Powered-By: Next.js
# x-nextjs-cache: HIT
```

#### 5.4 브라우저 접속
- https://aed.pics
- https://www.aed.pics

예상 응답:
- 정상적으로 홈페이지 로드
- HTTPS 인증서 유효
- 녹색 자물쇠 아이콘 표시

---

## 설정 파일

### ecosystem.config.js

PM2 프로세스 관리 설정 파일

**위치**: `/var/www/aedpics/ecosystem.config.js`

**주요 설정**:
```javascript
module.exports = {
  apps: [{
    name: 'aedpics',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/aedpics',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      // 모든 환경변수는 process.env에서 참조
      DATABASE_URL: process.env.DATABASE_URL,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'https://aed.pics',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
      JWT_SECRET: process.env.JWT_SECRET,
      MASTER_EMAIL: process.env.MASTER_EMAIL,
      NEXT_PUBLIC_KAKAO_MAP_APP_KEY: process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY,
      NCP_ACCESS_KEY: process.env.NCP_ACCESS_KEY,
      NCP_ACCESS_SECRET: process.env.NCP_ACCESS_SECRET,
      NCP_SENDER_EMAIL: process.env.NCP_SENDER_EMAIL,
      NCP_OBJECT_STORAGE_REGION: process.env.NCP_OBJECT_STORAGE_REGION || 'kr-standard',
      NCP_OBJECT_STORAGE_ENDPOINT: process.env.NCP_OBJECT_STORAGE_ENDPOINT || 'https://kr.object.ncloudstorage.com',
      NCP_OBJECT_STORAGE_ACCESS_KEY: process.env.NCP_OBJECT_STORAGE_ACCESS_KEY,
      NCP_OBJECT_STORAGE_SECRET_KEY: process.env.NCP_OBJECT_STORAGE_SECRET_KEY,
      NCP_OBJECT_STORAGE_BUCKET: process.env.NCP_OBJECT_STORAGE_BUCKET || 'aedpics-inspections',
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://aed.pics',
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
      CRON_SECRET: process.env.CRON_SECRET,
    },
    error_file: '/var/www/aedpics/logs/pm2-error.log',
    out_file: '/var/www/aedpics/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
  }]
};
```

**중요 사항**:
- 모든 민감한 정보는 `process.env`로 참조
- 실제 값은 `.env` 파일에 저장
- GitHub에 커밋할 때 시크릿 노출 방지

### .env 파일

환경변수 저장 파일 (보안 중요)

**위치**: `/var/www/aedpics/.env`

**파일 권한**:
```bash
chmod 600 /var/www/aedpics/.env
chown root:root /var/www/aedpics/.env
```

**필수 환경변수**:
```bash
# Database Connection
DATABASE_URL="postgresql://aedpics_admin:PASSWORD@pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com:5432/aedpics_production?schema=aedpics"

# NextAuth Configuration
NEXTAUTH_URL="https://aed.pics"
NEXTAUTH_SECRET="generate-random-32-chars"
JWT_SECRET="generate-random-secret"

# Master Account
MASTER_EMAIL="truth0530@nmc.or.kr"

# Kakao Maps API
NEXT_PUBLIC_KAKAO_MAP_APP_KEY="your_kakao_key"

# NCP Email Service (Cloud Outbound Mailer)
NCP_ACCESS_KEY="your_ncp_access_key"
NCP_ACCESS_SECRET="your_ncp_access_secret"
NCP_SENDER_EMAIL="noreply@aed.pics"

# NCP Object Storage
NCP_OBJECT_STORAGE_REGION="kr-standard"
NCP_OBJECT_STORAGE_ENDPOINT="https://kr.object.ncloudstorage.com"
NCP_OBJECT_STORAGE_ACCESS_KEY="your_storage_access_key"
NCP_OBJECT_STORAGE_SECRET_KEY="your_storage_secret_key"
NCP_OBJECT_STORAGE_BUCKET="aedpics-inspections"

# Application Configuration
NEXT_PUBLIC_SITE_URL="https://aed.pics"

# Security
ENCRYPTION_KEY="generate-random-32-chars"

# Cron Jobs
CRON_SECRET="generate-random-secret"
```

### Nginx 설정

**위치**: `/etc/nginx/sites-available/aedpics`

Certbot이 자동으로 SSL 설정을 추가한 최종 설정:
```nginx
server {
  server_name aed.pics www.aed.pics;
  client_max_body_size 10M;

  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
  }

  listen 443 ssl; # managed by Certbot
  ssl_certificate /etc/letsencrypt/live/aed.pics/fullchain.pem; # managed by Certbot
  ssl_certificate_key /etc/letsencrypt/live/aed.pics/privkey.pem; # managed by Certbot
  include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
  ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
  if ($host = www.aed.pics) {
    return 301 https://$host$request_uri;
  } # managed by Certbot

  if ($host = aed.pics) {
    return 301 https://$host$request_uri;
  } # managed by Certbot

  listen 80;
  server_name aed.pics www.aed.pics;
  return 404; # managed by Certbot
}
```

---

## 환경변수 설정

### 필수 환경변수

#### 1. Database Connection
```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=SCHEMA"
```
- NCP PostgreSQL 연결 문자열
- Prisma가 데이터베이스 연결에 사용

#### 2. NextAuth Configuration
```bash
NEXTAUTH_URL="https://aed.pics"
NEXTAUTH_SECRET="32자 이상의 랜덤 문자열"
JWT_SECRET="32자 이상의 랜덤 문자열"
```
- NextAuth.js 인증 시스템 설정
- SECRET 값은 반드시 랜덤하게 생성

시크릿 생성 방법:
```bash
# NEXTAUTH_SECRET 생성
openssl rand -base64 32

# JWT_SECRET 생성
openssl rand -base64 32
```

#### 3. Master Account
```bash
MASTER_EMAIL="admin@nmc.or.kr"
```
- 최고 관리자 계정 이메일
- 시스템 초기 설정 및 관리용

#### 4. Kakao Maps API
```bash
NEXT_PUBLIC_KAKAO_MAP_APP_KEY="your_kakao_app_key"
```
- Kakao Developers에서 발급
- AED 위치 지도 표시에 사용

#### 5. NCP Email Service
```bash
NCP_ACCESS_KEY="your_ncp_access_key"
NCP_ACCESS_SECRET="your_ncp_secret_key"
NCP_SENDER_EMAIL="noreply@aed.pics"
```
- NCP Cloud Outbound Mailer 설정
- 이메일 인증, 알림 발송에 사용
- HMAC SHA256 인증 방식

#### 6. NCP Object Storage
```bash
NCP_OBJECT_STORAGE_REGION="kr-standard"
NCP_OBJECT_STORAGE_ENDPOINT="https://kr.object.ncloudstorage.com"
NCP_OBJECT_STORAGE_ACCESS_KEY="your_storage_access_key"
NCP_OBJECT_STORAGE_SECRET_KEY="your_storage_secret_key"
NCP_OBJECT_STORAGE_BUCKET="aedpics-inspections"
```
- NCP Object Storage 설정
- AED 점검 사진 업로드에 사용
- S3 호환 API

#### 7. Security
```bash
ENCRYPTION_KEY="32자 이상의 랜덤 문자열"
```
- 민감한 데이터 암호화에 사용
- 휴대폰 번호 등 개인정보 보호

암호화 키 생성:
```bash
openssl rand -hex 32
```

#### 8. Cron Jobs
```bash
CRON_SECRET="random-secret-string"
```
- Cron Job API 엔드포인트 보호
- 무단 실행 방지

### 선택적 환경변수

```bash
# Application URL (기본값: https://aed.pics)
NEXT_PUBLIC_SITE_URL="https://aed.pics"

# NCP Object Storage (기본값 있음)
NCP_OBJECT_STORAGE_REGION="kr-standard"
NCP_OBJECT_STORAGE_ENDPOINT="https://kr.object.ncloudstorage.com"
NCP_OBJECT_STORAGE_BUCKET="aedpics-inspections"
```

### 환경변수 검증

배포 전 환경변수 확인:
```bash
# .env 파일 존재 확인
ls -la /var/www/aedpics/.env

# DATABASE_URL 확인 (일부 마스킹)
cat /var/www/aedpics/.env | grep DATABASE_URL

# PM2 환경변수 로드 확인
pm2 restart aedpics
pm2 logs aedpics --lines 20
```

---

## 보안 설정

### fail2ban 설정 (SSH 보호)

#### 설치
```bash
apt-get update
apt-get install -y fail2ban

# 버전 확인
fail2ban-client --version
# Fail2Ban v1.0.2
```

#### 수동 설정 (권장)

fail2ban 자동 설정 스크립트에 문제가 있어 수동 설정을 권장합니다.

**1. jail.local 파일 생성**
```bash
nano /etc/fail2ban/jail.local
```

**2. 설정 내용 입력**
```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
banaction = iptables-multiport

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
maxretry = 5
```

**설정 설명**:
- `bantime = 3600`: 차단 시간 1시간 (3600초)
- `findtime = 600`: 10분 내에
- `maxretry = 5`: 5회 이상 실패 시 차단
- `banaction = iptables-multiport`: iptables로 차단

**3. fail2ban 재시작**
```bash
systemctl restart fail2ban
systemctl enable fail2ban
```

**4. 상태 확인**
```bash
# fail2ban 서비스 상태
systemctl status fail2ban

# SSH jail 상태 확인
fail2ban-client status sshd

# 차단된 IP 목록
fail2ban-client status sshd | grep "Banned IP"
```

#### fail2ban 모니터링

```bash
# 실시간 로그 확인
tail -f /var/log/fail2ban.log

# 차단 이벤트 확인
grep "Ban " /var/log/fail2ban.log

# 차단 해제 이벤트 확인
grep "Unban " /var/log/fail2ban.log
```

#### IP 수동 차단 해제

실수로 차단된 경우:
```bash
# IP 차단 해제
fail2ban-client set sshd unbanip <IP_ADDRESS>

# 예시
fail2ban-client set sshd unbanip 192.168.1.100
```

### 방화벽 설정 (UFW)

```bash
# UFW 설치
apt-get install -y ufw

# 기본 정책 설정
ufw default deny incoming
ufw default allow outgoing

# 필수 포트 허용
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS

# UFW 활성화
ufw enable

# 상태 확인
ufw status verbose
```

### 파일 권한 설정

```bash
# .env 파일 권한
chmod 600 /var/www/aedpics/.env
chown root:root /var/www/aedpics/.env

# 애플리케이션 디렉토리 권한
chown -R root:root /var/www/aedpics
chmod -R 755 /var/www/aedpics

# 로그 디렉토리 권한
mkdir -p /var/www/aedpics/logs
chmod 755 /var/www/aedpics/logs
```

---

## 유지보수

### PM2 명령어

#### 애플리케이션 관리
```bash
# 상태 확인
pm2 status

# 재시작
pm2 restart aedpics

# 중지
pm2 stop aedpics

# 시작
pm2 start aedpics

# 삭제
pm2 delete aedpics

# 로그 확인
pm2 logs aedpics

# 모니터링
pm2 monit
```

#### 자동 시작 설정
```bash
# 현재 프로세스 목록 저장
pm2 save

# 부팅 시 자동 시작 활성화
pm2 startup systemd

# 자동 시작 비활성화
pm2 unstartup systemd
```

### 애플리케이션 업데이트

```bash
# 1. 최신 코드 가져오기
cd /var/www/aedpics
git pull origin main

# 2. 의존성 업데이트
npm ci --production=false

# 3. Prisma 클라이언트 재생성
npx prisma generate

# 4. 프로덕션 빌드
npm run build

# 5. PM2 재시작
pm2 restart aedpics

# 6. 로그 확인
pm2 logs aedpics --lines 50
```

### SSL 인증서 갱신

Let's Encrypt 인증서는 자동으로 갱신됩니다.

#### 자동 갱신 확인
```bash
# certbot.timer 상태 확인
systemctl status certbot.timer

# 자동 갱신 테스트 (실제로 갱신하지 않음)
certbot renew --dry-run
```

#### 수동 갱신
```bash
# 인증서 수동 갱신
certbot renew

# Nginx 재시작
systemctl restart nginx

# 인증서 상태 확인
certbot certificates
```

### 로그 관리

#### PM2 로그
```bash
# 로그 위치
/var/www/aedpics/logs/pm2-error.log
/var/www/aedpics/logs/pm2-out.log

# 로그 확인
tail -f /var/www/aedpics/logs/pm2-out.log

# 로그 정리
pm2 flush
```

#### Nginx 로그
```bash
# 로그 위치
/var/log/nginx/access.log
/var/log/nginx/error.log

# 로그 확인
tail -f /var/log/nginx/access.log

# 로그 로테이션 (자동 설정됨)
logrotate -f /etc/logrotate.d/nginx
```

### 데이터베이스 백업

```bash
# PostgreSQL 백업 스크립트 생성
cat > /root/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/postgresql"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/aedpics_$TIMESTAMP.sql"

mkdir -p $BACKUP_DIR

PGPASSWORD='PASSWORD' pg_dump \
  -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com \
  -U aedpics_admin \
  -d aedpics_production \
  -n aedpics \
  > $BACKUP_FILE

# 30일 이상 된 백업 파일 삭제
find $BACKUP_DIR -name "aedpics_*.sql" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE"
EOF

chmod +x /root/backup-db.sh
```

#### 자동 백업 Cron 설정
```bash
# Cron 편집
crontab -e

# 매일 새벽 2시에 백업
0 2 * * * /root/backup-db.sh >> /var/log/db-backup.log 2>&1
```

---

## 트러블슈팅

### 문제 1: PM2 애플리케이션이 시작되지 않음

**증상**:
```bash
pm2 status
# status: errored
```

**해결 방법**:
```bash
# 1. 로그 확인
pm2 logs aedpics --lines 50

# 2. 환경변수 확인
cat /var/www/aedpics/.env | grep -v "^#" | grep -v "^$"

# 3. 빌드 파일 확인
ls -la /var/www/aedpics/.next

# 4. 포트 충돌 확인
netstat -tlnp | grep :3000

# 5. 애플리케이션 재시작
pm2 delete aedpics
pm2 start ecosystem.config.js
```

### 문제 2: 502 Bad Gateway 오류

**증상**: Nginx가 502 Bad Gateway 반환

**원인**: Next.js 애플리케이션이 실행되지 않음

**해결 방법**:
```bash
# 1. PM2 상태 확인
pm2 status

# 2. PM2 애플리케이션 재시작
pm2 restart aedpics

# 3. Nginx 오류 로그 확인
tail -f /var/log/nginx/error.log

# 4. Nginx 재시작
systemctl restart nginx
```

### 문제 3: HTTPS 인증서 오류

**증상**: 브라우저에서 "안전하지 않음" 경고

**해결 방법**:
```bash
# 1. 인증서 상태 확인
certbot certificates

# 2. 인증서 갱신
certbot renew --force-renewal

# 3. Nginx 재시작
systemctl restart nginx

# 4. 인증서 테스트
curl -I https://aed.pics
```

### 문제 4: 데이터베이스 연결 오류

**증상**: "Database connection failed"

**해결 방법**:
```bash
# 1. DATABASE_URL 확인
cat /var/www/aedpics/.env | grep DATABASE_URL

# 2. PostgreSQL 연결 테스트
psql "postgresql://aedpics_admin:PASSWORD@pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com:5432/aedpics_production?schema=aedpics"

# 3. Prisma 클라이언트 재생성
cd /var/www/aedpics
npx prisma generate

# 4. 애플리케이션 재시작
pm2 restart aedpics
```

### 문제 5: NCP Email 발송 실패

**증상**: 이메일이 전송되지 않음

**해결 방법**:
```bash
# 1. NCP 환경변수 확인
cat /var/www/aedpics/.env | grep NCP_

# 2. PM2 로그에서 이메일 오류 확인
pm2 logs aedpics | grep -i "email\|ncp"

# 3. NCP Cloud Outbound Mailer 설정 확인
# - NCP Console에서 Access Key 확인
# - 발신자 이메일 인증 상태 확인
# - 월간 발송 한도 확인 (기본 1,000,000건)

# 4. 애플리케이션 재시작
pm2 restart aedpics
```

### 문제 6: 메모리 부족

**증상**: PM2 애플리케이션이 자동으로 재시작됨

**해결 방법**:
```bash
# 1. 메모리 사용량 확인
pm2 monit

# 2. ecosystem.config.js에서 메모리 제한 조정
nano /var/www/aedpics/ecosystem.config.js
# max_memory_restart: '1G' → '2G'

# 3. PM2 재시작
pm2 restart aedpics

# 4. 시스템 메모리 확인
free -h
```

### 문제 7: fail2ban이 작동하지 않음

**증상**: SSH 공격이 차단되지 않음

**해결 방법**:
```bash
# 1. fail2ban 상태 확인
systemctl status fail2ban

# 2. jail.local 설정 확인
cat /etc/fail2ban/jail.local

# 3. fail2ban 재시작
systemctl restart fail2ban

# 4. SSH jail 활성화 확인
fail2ban-client status sshd

# 5. 로그 확인
tail -f /var/log/fail2ban.log
```

---

## 체크리스트

### 배포 전 체크리스트
- [ ] 서버 사양 확인 (CPU, RAM, Storage)
- [ ] 도메인 DNS 설정 완료
- [ ] 방화벽 포트 개방 (22, 80, 443)
- [ ] .env 파일 준비 (모든 필수 환경변수)
- [ ] NCP PostgreSQL 접속 정보 확인
- [ ] NCP Object Storage 버킷 생성
- [ ] Kakao Maps API 키 발급

### 배포 중 체크리스트
- [ ] Node.js v20.18.1 설치 확인
- [ ] PM2 글로벌 설치 확인
- [ ] GitHub 저장소 클론 완료
- [ ] npm ci 성공
- [ ] Prisma generate 성공
- [ ] npm run build 성공
- [ ] PM2로 애플리케이션 시작
- [ ] Nginx 설치 및 설정
- [ ] SSL 인증서 발급 (Let's Encrypt)
- [ ] fail2ban 설치 및 설정

### 배포 후 체크리스트
- [ ] pm2 status: online 확인
- [ ] curl https://aed.pics: HTTP 200 확인
- [ ] 브라우저에서 HTTPS 접속 확인
- [ ] 로그인 기능 테스트
- [ ] 데이터베이스 연결 확인
- [ ] 이메일 발송 테스트
- [ ] fail2ban SSH jail 활성화 확인
- [ ] SSL 인증서 자동 갱신 확인
- [ ] PM2 자동 시작 설정 확인
- [ ] 데이터베이스 백업 Cron 설정

---

## 참고 문서

### 프로젝트 문서
- [README.md](../../README.md) - 프로젝트 개요
- [CLAUDE.md](../../CLAUDE.md) - AI 개발 가이드라인
- [NCP 마이그레이션 완전 가이드](../migration/NCP_마이그레이션_완전가이드.md)
- [.env.example](../../.env.example) - 환경변수 예시

### 외부 문서
- [Next.js 배포 가이드](https://nextjs.org/docs/deployment)
- [PM2 공식 문서](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Nginx 설정 가이드](https://nginx.org/en/docs/)
- [Let's Encrypt 문서](https://letsencrypt.org/docs/)
- [fail2ban 가이드](https://www.fail2ban.org/wiki/index.php/Main_Page)
- [NCP Cloud Outbound Mailer](https://guide.ncloud-docs.com/docs/cloudoutboundmailer-overview)

---

## 연락처

### 시스템 관리자
- **이름**: 이광성
- **이메일**: truth0530@nmc.or.kr
- **역할**: 시스템 총괄

### 기술 지원
- **이메일**: inhak@nmc.or.kr
- **담당**: 인프라 및 배포

### 프로젝트 매니저
- **이메일**: woo@nmc.or.kr
- **담당**: 프로젝트 관리

---

**문서 버전**: 1.0.0
**마지막 업데이트**: 2025-10-28
**배포 환경**: NCP Production (https://aed.pics)
**배포 상태**: 운영 중
