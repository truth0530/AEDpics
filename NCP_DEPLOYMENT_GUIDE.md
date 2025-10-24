# Naver Cloud Platform 배포 가이드

## 목차
1. [사전 준비](#사전-준비)
2. [NCP 인프라 구성](#ncp-인프라-구성)
3. [서버 초기 설정](#서버-초기-설정)
4. [데이터베이스 마이그레이션](#데이터베이스-마이그레이션)
5. [애플리케이션 배포](#애플리케이션-배포)
6. [Nginx 리버스 프록시](#nginx-리버스-프록시)
7. [SSL 인증서 설정](#ssl-인증서-설정)
8. [모니터링 설정](#모니터링-설정)
9. [백업 및 복구](#백업-및-복구)

---

## 사전 준비

### 1. NCP 계정 생성
1. [Naver Cloud Platform](https://www.ncloud.com/) 접속
2. 회원가입 (사업자 등록증 필요)
3. 신용카드 등록 (₩1,000 인증)
4. 본인 인증 완료

### 2. 필요한 정보
```
도메인: aedpics.kr (또는 원하는 도메인)
리전: Korea (KR)
예상 비용: ₩95,000/월
```

---

## NCP 인프라 구성

### 1. Server 생성

**경로**: Console > Compute > Server

**설정**:
```yaml
서버 이미지: Ubuntu Server 22.04 LTS
서버 타입: Standard
서버 스펙:
  - vCPU: 4 Core
  - Memory: 16GB
  - Storage: 50GB SSD
리전: Korea (KR)
네트워크: Default VPC
```

**예상 비용**: ₩50,000/월

**생성 후**:
```bash
# 접속 키 다운로드 (ncp-key.pem)
chmod 400 ncp-key.pem

# 서버 접속
ssh -i ncp-key.pem root@{PUBLIC_IP}
```

---

### 2. Cloud DB for PostgreSQL 생성

**경로**: Console > Database > Cloud DB for PostgreSQL

**설정**:
```yaml
DB 버전: PostgreSQL 14
DB 서버 타입: High Memory
서버 스펙:
  - vCPU: 2 Core
  - Memory: 8GB
  - Storage: 100GB SSD
백업: 자동 백업 활성화 (7일 보관)
고가용성: 활성화 (Master-Slave)
```

**예상 비용**: ₩30,000/월

**접속 정보**:
```bash
호스트: {DB_HOST}.ncloud.com
포트: 5432
데이터베이스: aedpics
사용자명: aedpics_admin
비밀번호: {SECURE_PASSWORD}
```

**환경 변수 설정**:
```env
DATABASE_URL="postgresql://aedpics_admin:{SECURE_PASSWORD}@{DB_HOST}.ncloud.com:5432/aedpics?schema=public"
```

---

### 3. Object Storage 생성

**경로**: Console > Storage > Object Storage

**설정**:
```yaml
버킷 이름: aedpics-uploads
리전: Korea (KR)
접근 제어: Private
```

**예상 비용**: ₩5,000/월 (100GB)

**환경 변수 설정**:
```env
OBJECT_STORAGE_ENDPOINT=https://kr.object.ncloudstorage.com
OBJECT_STORAGE_BUCKET=aedpics-uploads
OBJECT_STORAGE_ACCESS_KEY={ACCESS_KEY}
OBJECT_STORAGE_SECRET_KEY={SECRET_KEY}
```

---

### 4. Load Balancer 생성

**경로**: Console > Networking > Load Balancer

**설정**:
```yaml
타입: Application Load Balancer
프로토콜: HTTPS (443)
대상: Server (위에서 생성한 서버)
헬스 체크: /api/health
```

**예상 비용**: ₩10,000/월

---

## 서버 초기 설정

### 1. 필수 패키지 설치

```bash
# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# Node.js 20 LTS 설치
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2 설치
sudo npm install -g pm2

# Nginx 설치
sudo apt install -y nginx

# Redis 설치
sudo apt install -y redis-server

# PostgreSQL 클라이언트 설치
sudo apt install -y postgresql-client

# Git 설치
sudo apt install -y git

# 버전 확인
node --version  # v20.x.x
npm --version   # 10.x.x
pm2 --version   # 5.x.x
nginx -v        # 1.x.x
redis-server --version  # 7.x.x
```

---

### 2. 방화벽 설정

**NCP 콘솔에서 ACG (Access Control Group) 설정**:

```yaml
인바운드 규칙:
  - 프로토콜: TCP, 포트: 22, 소스: My IP (SSH)
  - 프로토콜: TCP, 포트: 80, 소스: 0.0.0.0/0 (HTTP)
  - 프로토콜: TCP, 포트: 443, 소스: 0.0.0.0/0 (HTTPS)
  - 프로토콜: TCP, 포트: 3000, 소스: 127.0.0.1/32 (Next.js, localhost만)
  - 프로토콜: TCP, 포트: 6379, 소스: 127.0.0.1/32 (Redis, localhost만)
```

**서버 UFW 설정**:
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

### 3. 사용자 계정 생성

```bash
# 배포 전용 사용자 생성
sudo adduser aedpics
sudo usermod -aG sudo aedpics

# SSH 키 복사 (선택사항)
sudo cp -r /root/.ssh /home/aedpics/
sudo chown -R aedpics:aedpics /home/aedpics/.ssh

# 사용자 전환
su - aedpics
```

---

## 데이터베이스 마이그레이션

### 1. Supabase 백업

**로컬에서 실행**:
```bash
# Supabase 데이터베이스 백업
pg_dump "$SUPABASE_DB_URL" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  -f supabase_backup_$(date +%Y%m%d_%H%M%S).sql

# 백업 파일 NCP 서버로 전송
scp -i ncp-key.pem supabase_backup_*.sql aedpics@{PUBLIC_IP}:/home/aedpics/
```

---

### 2. NCP PostgreSQL 복원

**NCP 서버에서 실행**:
```bash
# 백업 파일 복원
psql "$DATABASE_URL" -f supabase_backup_*.sql

# 데이터 확인
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM users;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM aed_devices;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM inspection_records;"
```

---

### 3. Prisma 마이그레이션

**프로젝트 디렉토리에서 실행**:
```bash
# Prisma 마이그레이션 적용
npx prisma migrate deploy

# Prisma Client 생성
npx prisma generate

# 데이터베이스 상태 확인
npx prisma migrate status
```

---

## 애플리케이션 배포

### 1. 프로젝트 클론

```bash
# 프로젝트 디렉토리 생성
cd /home/aedpics
mkdir -p apps
cd apps

# Git 클론
git clone https://github.com/truth0530/AEDpics.git
cd AEDpics

# Node.js 의존성 설치
npm install

# Prisma Client 생성
npx prisma generate
```

---

### 2. 환경 변수 설정

**파일 생성**: `/home/aedpics/apps/AEDpics/.env.production`

```env
# Database
DATABASE_URL="postgresql://aedpics_admin:{PASSWORD}@{DB_HOST}.ncloud.com:5432/aedpics?schema=public"

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET={RANDOM_64_CHAR_STRING}
JWT_EXPIRES_IN=7d

# Email (SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER={EMAIL_ADDRESS}
EMAIL_PASSWORD={APP_PASSWORD}
EMAIL_FROM="AED 점검 시스템 <noreply@aedpics.kr>"

# App
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://aedpics.kr
PORT=3000

# Object Storage
OBJECT_STORAGE_ENDPOINT=https://kr.object.ncloudstorage.com
OBJECT_STORAGE_BUCKET=aedpics-uploads
OBJECT_STORAGE_ACCESS_KEY={ACCESS_KEY}
OBJECT_STORAGE_SECRET_KEY={SECRET_KEY}

# IP Whitelist (관리자 접근)
ADMIN_IP_WHITELIST=203.xxx.xxx.xxx,10.0.0.0/8

# Session
SESSION_TIMEOUT=1800

# File Upload
UPLOAD_MAX_SIZE=10485760
```

---

### 3. 프로덕션 빌드

```bash
# Next.js 빌드
npm run build

# 빌드 결과 확인
ls -lh .next/
```

---

### 4. PM2 배포

**PM2 Ecosystem 파일 확인**: `ecosystem.config.js` (이미 생성됨)

```bash
# PM2로 앱 시작
pm2 start ecosystem.config.js --env production

# PM2 상태 확인
pm2 status
pm2 logs aedpics

# 부팅 시 자동 시작 설정
pm2 startup
pm2 save
```

---

## Nginx 리버스 프록시

### 1. Nginx 설정 파일 생성

**파일**: `/etc/nginx/sites-available/aedpics`

```nginx
# HTTP (80) → HTTPS (443) 리디렉션
server {
    listen 80;
    listen [::]:80;
    server_name aedpics.kr www.aedpics.kr;

    # Let's Encrypt ACME Challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # 모든 HTTP 요청을 HTTPS로 리디렉션
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS (443) 메인 서버
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name aedpics.kr www.aedpics.kr;

    # SSL 인증서 (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/aedpics.kr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/aedpics.kr/privkey.pem;

    # SSL 설정 (Mozilla Intermediate)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # 클라이언트 최대 업로드 크기
    client_max_body_size 10M;

    # Next.js 애플리케이션 프록시
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
        proxy_buffering off;
    }

    # Socket.IO WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 정적 파일 캐싱
    location /_next/static/ {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }

    # 로그
    access_log /var/log/nginx/aedpics_access.log;
    error_log /var/log/nginx/aedpics_error.log;
}
```

---

### 2. Nginx 활성화

```bash
# 심볼릭 링크 생성
sudo ln -s /etc/nginx/sites-available/aedpics /etc/nginx/sites-enabled/

# 기본 사이트 비활성화
sudo rm /etc/nginx/sites-enabled/default

# 설정 테스트
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx
```

---

## SSL 인증서 설정

### 1. Certbot 설치

```bash
# Certbot 설치
sudo apt install -y certbot python3-certbot-nginx

# 인증서 발급
sudo certbot certonly --nginx -d aedpics.kr -d www.aedpics.kr

# 이메일 입력: admin@aedpics.kr
# 약관 동의: Y
# 이메일 공유: N (선택)
```

---

### 2. 자동 갱신 설정

```bash
# Cron 작업 추가 (매일 자정 갱신 시도)
sudo crontab -e

# 다음 줄 추가:
0 0 * * * certbot renew --quiet && systemctl reload nginx
```

---

### 3. 인증서 확인

```bash
# 인증서 상태 확인
sudo certbot certificates

# 인증서 파일 위치
ls -l /etc/letsencrypt/live/aedpics.kr/

# 만료일 확인
openssl x509 -in /etc/letsencrypt/live/aedpics.kr/fullchain.pem -noout -dates
```

---

## 모니터링 설정

### 1. PM2 모니터링

```bash
# PM2 모니터링 대시보드
pm2 monit

# CPU/Memory 사용량
pm2 status

# 로그 확인
pm2 logs aedpics --lines 100
```

---

### 2. 시스템 모니터링

**htop 설치**:
```bash
sudo apt install -y htop
htop
```

**disk 사용량**:
```bash
df -h
```

**메모리 사용량**:
```bash
free -h
```

---

## 백업 및 복구

### 1. 데이터베이스 백업 스크립트

**파일**: `/home/aedpics/scripts/backup-db.sh`

```bash
#!/bin/bash

# 설정
BACKUP_DIR="/home/aedpics/backups"
DB_URL="$DATABASE_URL"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db_backup_$DATE.sql"

# 백업 디렉토리 생성
mkdir -p $BACKUP_DIR

# PostgreSQL 백업
pg_dump "$DB_URL" --no-owner --no-acl -f "$BACKUP_FILE"

# 압축
gzip "$BACKUP_FILE"

# 7일 이전 백업 삭제
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
```

**실행 권한 부여**:
```bash
chmod +x /home/aedpics/scripts/backup-db.sh
```

**Cron 작업 (매일 새벽 2시)**:
```bash
crontab -e

# 추가:
0 2 * * * /home/aedpics/scripts/backup-db.sh >> /home/aedpics/logs/backup.log 2>&1
```

---

### 2. 복구 절차

```bash
# 백업 파일 압축 해제
gunzip db_backup_20250124_020000.sql.gz

# 데이터베이스 복원
psql "$DATABASE_URL" -f db_backup_20250124_020000.sql
```

---

## 배포 체크리스트

### 사전 준비
- [ ] NCP 계정 생성 완료
- [ ] 도메인 구매 완료 (aedpics.kr)
- [ ] 신용카드 등록 완료

### 인프라 구성
- [ ] Server 생성 (4 Core, 16GB RAM)
- [ ] Cloud DB for PostgreSQL 생성
- [ ] Object Storage 생성
- [ ] Load Balancer 생성 (선택)
- [ ] ACG (방화벽) 설정

### 서버 설정
- [ ] Node.js 20 설치
- [ ] PM2 설치
- [ ] Nginx 설치
- [ ] Redis 설치
- [ ] 사용자 계정 생성

### 데이터베이스
- [ ] Supabase 백업 완료
- [ ] NCP PostgreSQL 복원 완료
- [ ] Prisma 마이그레이션 완료
- [ ] 데이터 검증 완료

### 애플리케이션
- [ ] Git 클론 완료
- [ ] npm install 완료
- [ ] .env.production 설정 완료
- [ ] npm run build 완료
- [ ] PM2 시작 완료

### Nginx & SSL
- [ ] Nginx 설정 파일 작성
- [ ] Certbot SSL 인증서 발급
- [ ] HTTPS 리디렉션 확인
- [ ] 보안 헤더 확인

### 모니터링
- [ ] PM2 모니터링 활성화
- [ ] 로그 확인
- [ ] 백업 스크립트 설정

### 최종 검증
- [ ] https://aedpics.kr 접속 확인
- [ ] 로그인/회원가입 테스트
- [ ] 2FA 테스트
- [ ] AED 데이터 조회 테스트
- [ ] 점검 기록 생성 테스트
- [ ] 파일 업로드 테스트

---

**작성일**: 2025-10-24
**Phase**: 7 - Production Deployment
**예상 소요 시간**: 5일
**월간 비용**: ₩95,000
