# NCP 배포 가이드 (국정원 인증 대비)

**목표**: Vercel/Supabase 제거, 완전한 NCP 전환

---

## 🎯 배포 목표

### 제거 대상 (미국 서비스)
- ❌ Supabase Auth (미국)
- ❌ Supabase Database (미국)
- ❌ Vercel Hosting (미국)

### 전환 대상 (한국 서비스)
- ✅ NCP PostgreSQL (한국)
- ✅ NCP Server (한국)
- ✅ NextAuth.js (NCP 서버에서 실행)

---

## 🏗️ NCP 인프라 구성

### 필요한 NCP 서비스

1. **Cloud DB for PostgreSQL**
   - ✅ 이미 설정 완료
   - 연결 정보: `pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com:5432`
   - 데이터베이스: `aedpics_production`

2. **Server (Compute)**
   - Ubuntu 22.04 LTS 권장
   - 최소 사양: 2 vCPU, 4GB RAM
   - Node.js 18 이상

3. **Object Storage (선택)**
   - 이미지/파일 저장용
   - S3 호환 API

4. **Load Balancer (선택)**
   - SSL/TLS 인증서
   - HTTPS 설정

---

## 📋 배포 단계

### 1. NCP 서버 생성

```bash
# NCP 콘솔에서 서버 생성
# - Region: 한국
# - OS: Ubuntu 22.04 LTS
# - Spec: 2 vCPU, 4GB RAM 이상
```

### 2. 서버 환경 설정

```bash
# SSH 접속 후
ssh root@<NCP_SERVER_IP>

# Node.js 18 설치
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 설치 (프로세스 관리)
sudo npm install -g pm2

# Git 설치
sudo apt-get install -y git
```

### 3. 프로젝트 배포

```bash
# 프로젝트 클론
git clone <YOUR_REPO_URL> /var/www/aedpics
cd /var/www/aedpics

# 의존성 설치
npm install

# 환경변수 설정
nano .env.production
```

### 4. 환경변수 설정 (.env.production)

```env
# Database (NCP PostgreSQL)
DATABASE_URL="postgresql://aedpics_admin:AEDpics2025*NCP@pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com:5432/aedpics_production?schema=aedpics"

# NextAuth (NCP 서버 URL)
NEXTAUTH_URL="https://aed.nmc.or.kr"  # 실제 도메인
NEXTAUTH_SECRET="6AE9vV/EAvnhHBERaNHq2P53tzdSquU+sQXfVM7oHEk="
JWT_SECRET="zMfGfYTUrbkDFRPEQax4B/nylEaFEPFk8kR0fMPMgqo="

# Email (Resend)
RESEND_API_KEY="your-resend-api-key"

# Master Account
MASTER_ADMIN_ID="<master-uuid>"
MASTER_ADMIN_EMAIL="truth0530@nmc.or.kr"

# Environment
NODE_ENV="production"
```

### 5. 데이터베이스 마이그레이션

```bash
# Prisma 마이그레이션 실행
npx prisma migrate deploy

# 데이터베이스 연결 확인
npx prisma db pull
```

### 6. 프로덕션 빌드

```bash
# Next.js 빌드
npm run build

# 빌드 결과 확인
ls -la .next/
```

### 7. PM2로 서비스 시작

```bash
# PM2 설정 파일 생성
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'aedpics',
    script: 'npm',
    args: 'start',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
EOF

# PM2로 시작
pm2 start ecosystem.config.js

# PM2 부팅 시 자동 시작 설정
pm2 save
pm2 startup
```

### 8. Nginx 설정 (리버스 프록시)

```bash
# Nginx 설치
sudo apt-get install -y nginx

# Nginx 설정
sudo nano /etc/nginx/sites-available/aedpics
```

```nginx
server {
    listen 80;
    server_name aed.nmc.or.kr;

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
    }
}
```

```bash
# 설정 활성화
sudo ln -s /etc/nginx/sites-available/aedpics /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 9. SSL 인증서 설정

```bash
# Let's Encrypt 설치
sudo apt-get install -y certbot python3-certbot-nginx

# SSL 인증서 발급
sudo certbot --nginx -d aed.nmc.or.kr

# 자동 갱신 설정
sudo certbot renew --dry-run
```

---

## 🔒 보안 설정

### 방화벽

```bash
# UFW 방화벽 설정
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### 환경변수 보호

```bash
# .env.production 권한 설정
chmod 600 .env.production
chown www-data:www-data .env.production
```

---

## 📊 모니터링

### PM2 모니터링

```bash
# 실시간 로그
pm2 logs

# 상태 확인
pm2 status

# 모니터링 대시보드
pm2 monit
```

### 로그 관리

```bash
# 로그 디렉토리 생성
mkdir -p /var/www/aedpics/logs

# 로그 로테이션 설정
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

---

## 🔄 배포 프로세스

### Git 기반 배포

```bash
# 배포 스크립트 작성
cat > deploy.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Git pull
git pull origin main

# Install dependencies
npm install

# Run database migrations
npx prisma migrate deploy

# Build
npm run build

# Restart PM2
pm2 restart aedpics

echo "✅ Deployment completed!"
EOF

chmod +x deploy.sh
```

### 배포 실행

```bash
# 배포 스크립트 실행
./deploy.sh
```

---

## ✅ 체크리스트

### 배포 전

- [ ] NCP 서버 생성 완료
- [ ] NCP PostgreSQL 연결 확인
- [ ] 환경변수 설정 완료
- [ ] SSL 인증서 발급 완료
- [ ] 도메인 DNS 설정 완료

### 배포 후

- [ ] 웹사이트 접속 확인 (https://aed.nmc.or.kr)
- [ ] 로그인/회원가입 테스트
- [ ] 데이터베이스 연결 확인
- [ ] API 엔드포인트 테스트
- [ ] PM2 상태 확인
- [ ] Nginx 로그 확인
- [ ] SSL 인증서 확인

### 국정원 인증 준비

- [ ] 모든 데이터가 한국 서버에 저장됨
- [ ] 미국 서비스 의존성 0%
- [ ] 로그 시스템 구축
- [ ] 백업 시스템 구축
- [ ] 보안 감사 로그

---

## 🆘 트러블슈팅

### 데이터베이스 연결 실패

```bash
# PostgreSQL 연결 테스트
psql "postgresql://aedpics_admin:AEDpics2025*NCP@pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com:5432/aedpics_production"

# Prisma 연결 확인
npx prisma db pull
```

### PM2 프로세스 재시작

```bash
# 모든 프로세스 재시작
pm2 restart all

# 특정 프로세스 재시작
pm2 restart aedpics

# 프로세스 삭제 후 재시작
pm2 delete aedpics
pm2 start ecosystem.config.js
```

### 메모리 부족

```bash
# 스왑 메모리 추가
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 📞 참고

### NCP 문서

- [NCP Server 가이드](https://guide.ncloud-docs.com/docs/server-server-1-1)
- [NCP DB 가이드](https://guide.ncloud-docs.com/docs/database-database-1-1)
- [NCP Object Storage](https://guide.ncloud-docs.com/docs/storage-storage-1-1)

### Next.js 배포

- [Next.js Production Deployment](https://nextjs.org/docs/deployment)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)

---

**작성일**: 2025-10-25
**목표**: 국정원 인증 (완전한 한국 인프라)
**상태**: NCP 배포 준비 완료
