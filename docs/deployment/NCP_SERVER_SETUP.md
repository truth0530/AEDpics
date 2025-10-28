# NCP 서버 설정 가이드

## 문서 정보
- 작성일: 2025-10-27
- 버전: 1.0.0
- 목적: NCP 웹 서버 초기 설정 및 애플리케이션 배포

## 서버 정보

### 기본 정보
- 서버 이름: aedpics-web-server
- Public IP: 223.130.150.133
- Private IP: 10.0.2.7
- OS: Ubuntu 24.04.1 LTS
- 커널: 6.8.0-60-generic
- 하이퍼바이저: KVM

### 서버 스펙
- vCPU: 2개
- 메모리: 8GB
- 스토리지: 10GB (최소)
- 네트워크: VPC (10.0.0.0/16)

### 비용 정보
- 월 정액: 82,240 KRW (OS 제외)
- 시간당: 115 KRW
- 과금 방식: 시간 단위 과금
- 서버 중지 가능: 최대 90일/회, 연 180일

## 보안 설정

### ACG (Access Control Group) 규칙

**인바운드 규칙**
```
Protocol  Port Range  Source           Description
SSH       22          0.0.0.0/0       SSH 접속
HTTP      80          0.0.0.0/0       웹 서비스
HTTPS     443         0.0.0.0/0       웹 서비스 (SSL)
Custom    3000        0.0.0.0/0       Next.js (개발/테스트용)
```

### SSH 접속 정보
- 사용자명: root
- 인증 방식: SSH Key + Password
- SSH Key: ~/.ssh/aedpics-server-key.pem
- 권한: 400 (읽기 전용)

**접속 명령어:**
```bash
ssh -i ~/.ssh/aedpics-server-key.pem root@223.130.150.133
```

## 초기 설정 단계

### 1. 시스템 업데이트
```bash
# 패키지 리스트 업데이트
apt update

# 시스템 전체 업그레이드 (228개 패키지, 84개 보안 업데이트)
apt upgrade -y

# 필수 패키지 설치
apt install -y curl git build-essential
```

**소요 시간:** 약 10-15분

### 2. Node.js 20 설치
```bash
# NodeSource repository 추가
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -

# Node.js 설치
apt install -y nodejs

# 설치 확인
node --version  # v20.x.x
npm --version   # 10.x.x
```

### 3. PM2 설치 (프로세스 관리자)
```bash
# PM2 글로벌 설치
npm install -g pm2

# 설치 확인
pm2 --version

# 부팅 시 자동 시작 설정
pm2 startup systemd
```

### 4. Nginx 설치 (리버스 프록시)
```bash
# Nginx 설치
apt install -y nginx

# 방화벽 설정
ufw allow 'Nginx Full'

# Nginx 시작 및 활성화
systemctl start nginx
systemctl enable nginx

# 상태 확인
systemctl status nginx
```

### 5. 애플리케이션 디렉토리 생성
```bash
# 웹 루트 디렉토리 생성
mkdir -p /var/www/aedpics

# 권한 설정
chown -R root:root /var/www/aedpics
chmod -R 755 /var/www/aedpics
```

### 6. Git 저장소 클론
```bash
# 작업 디렉토리로 이동
cd /var/www/aedpics

# GitHub 저장소 클론
git clone https://github.com/kwangsunglee/AEDpics.git .

# 브랜치 확인
git branch  # main
```

### 7. 환경변수 설정
```bash
# .env.production 파일 생성
cat > /var/www/aedpics/.env.production << 'EOF'
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
EOF

# 권한 설정 (보안)
chmod 600 /var/www/aedpics/.env.production
```

### 8. 의존성 설치 및 빌드
```bash
cd /var/www/aedpics

# npm 패키지 설치 (프로덕션 전용)
npm ci --production=false

# Prisma 클라이언트 생성
npx prisma generate

# Next.js 프로덕션 빌드
npm run build
```

**빌드 시간:** 약 3-5분 (캐시 없을 때)

### 9. PM2로 애플리케이션 시작
```bash
# PM2 ecosystem 파일 생성
cat > /var/www/aedpics/ecosystem.config.js << 'EOF'
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
EOF

# PM2로 애플리케이션 시작
pm2 start ecosystem.config.js

# PM2 프로세스 저장 (재부팅 시 복원)
pm2 save

# 상태 확인
pm2 status
pm2 logs aedpics --lines 50
```

### 10. Nginx 설정
```bash
# Nginx 사이트 설정 파일 생성
cat > /etc/nginx/sites-available/aedpics << 'EOF'
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
    }
}
EOF

# 심볼릭 링크 생성
ln -s /etc/nginx/sites-available/aedpics /etc/nginx/sites-enabled/

# 기본 사이트 비활성화
rm -f /etc/nginx/sites-enabled/default

# 설정 테스트
nginx -t

# Nginx 재시작
systemctl restart nginx
```

## 배포 후 검증

### 1. 서비스 상태 확인
```bash
# Nginx 상태
systemctl status nginx

# PM2 상태
pm2 status

# 애플리케이션 로그
pm2 logs aedpics --lines 100
```

### 2. 네트워크 확인
```bash
# 포트 리스닝 확인
netstat -tlnp | grep -E ':(80|443|3000)'

# 로컬 접속 테스트
curl http://localhost:3000
curl http://localhost
```

### 3. 외부 접속 테스트
```bash
# 로컬 머신에서
curl http://223.130.150.133
```

브라우저에서 접속:
- http://223.130.150.133

### 4. 데이터베이스 연결 확인
```bash
cd /var/www/aedpics

# Prisma Studio 실행 (테스트용)
npx prisma studio

# 또는 연결 테스트
npx prisma db execute --url="$DATABASE_URL" --stdin <<< "SELECT 1;"
```

## 운영 관리

### 일상적인 명령어

**PM2 관리:**
```bash
pm2 list                 # 프로세스 목록
pm2 restart aedpics     # 재시작
pm2 reload aedpics      # 무중단 재시작
pm2 stop aedpics        # 중지
pm2 start aedpics       # 시작
pm2 logs aedpics        # 로그 보기
pm2 monit               # 모니터링
```

**Nginx 관리:**
```bash
systemctl status nginx   # 상태 확인
systemctl restart nginx  # 재시작
systemctl reload nginx   # 설정 리로드
nginx -t                 # 설정 테스트
```

**로그 확인:**
```bash
# PM2 로그
pm2 logs aedpics --lines 100

# Nginx 접속 로그
tail -f /var/log/nginx/access.log

# Nginx 에러 로그
tail -f /var/log/nginx/error.log

# 시스템 로그
journalctl -u nginx -f
```

### 애플리케이션 업데이트
```bash
cd /var/www/aedpics

# 최신 코드 가져오기
git pull origin main

# 의존성 업데이트
npm ci --production=false

# Prisma 재생성
npx prisma generate

# 빌드
npm run build

# PM2 무중단 재시작
pm2 reload aedpics
```

### 서버 중지 (비용 절감)
```bash
# PM2 저장
pm2 save

# 서버 중지 (NCP 콘솔에서)
# Server > 서버 선택 > 서버 관리 > 서버 중지

# 주의사항:
# - 최대 90일/회 중지 가능
# - 연간 누적 180일 제한
# - 중지 중에도 스토리지 비용은 발생
```

### 서버 시작 (중지 후)
```bash
# 서버 시작 (NCP 콘솔에서)
# Server > 서버 선택 > 서버 관리 > 서버 시작

# SSH 접속 후 확인
pm2 list
systemctl status nginx
systemctl status aedpics
```

## 모니터링 및 알림

### PM2 모니터링
```bash
# PM2 Plus 연동 (선택사항)
pm2 link <secret> <public>

# 메트릭 확인
pm2 monit
```

### 리소스 모니터링
```bash
# CPU, 메모리 사용률
htop

# 디스크 사용량
df -h

# 네트워크 트래픽
iftop
```

### 로그 로테이션 (선택사항)
```bash
# PM2 로그 로테이션 설정
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

## 트러블슈팅

### PM2 프로세스가 시작되지 않을 때
```bash
# 로그 확인
pm2 logs aedpics --lines 100

# 환경변수 확인
pm2 env 0

# 수동으로 Next.js 실행 (디버깅)
cd /var/www/aedpics
NODE_ENV=production npm start
```

### Nginx 502 Bad Gateway
```bash
# PM2 프로세스 상태 확인
pm2 status

# Next.js가 3000 포트에서 리스닝 중인지 확인
netstat -tlnp | grep 3000

# Nginx 에러 로그 확인
tail -f /var/log/nginx/error.log
```

### 데이터베이스 연결 오류
```bash
# 환경변수 확인
cat /var/www/aedpics/.env.production | grep DATABASE_URL

# Prisma 연결 테스트
cd /var/www/aedpics
npx prisma db execute --url="$DATABASE_URL" --stdin <<< "SELECT 1;"

# 데이터베이스 서버 접근 가능 여부 확인
telnet pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com 5432
```

### 빌드 실패
```bash
# node_modules 삭제 후 재설치
rm -rf node_modules
npm ci --production=false

# 캐시 정리
npm cache clean --force

# Prisma 재생성
npx prisma generate

# 빌드 재시도
npm run build
```

## 보안 강화 (프로덕션 배포 전 필수)

### 1. 방화벽 설정
```bash
# UFW 활성화
ufw enable

# SSH, HTTP, HTTPS만 허용
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp

# 3000 포트는 내부 전용 (외부 차단)
ufw deny 3000/tcp

# 상태 확인
ufw status
```

### 2. SSH 보안 강화
```bash
# /etc/ssh/sshd_config 수정
sed -i 's/#PermitRootLogin yes/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config

# SSH 재시작
systemctl restart sshd
```

### 3. 자동 업데이트 설정
```bash
# unattended-upgrades 설치
apt install -y unattended-upgrades

# 활성화
dpkg-reconfigure -plow unattended-upgrades
```

### 4. Fail2Ban 설치 (무차별 대입 공격 방어)
```bash
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

## 참고 자료

### 관련 문서
- [GitHub Secrets 설정](GITHUB_SECRETS_SETUP.md)
- [GitHub Actions 최적화](GITHUB_ACTIONS_OPTIMIZATION.md)
- [Slack Webhook 설정](SLACK_WEBHOOK_SETUP.md)

### 외부 링크
- NCP 문서: https://guide.ncloud-docs.com/docs/ko/home
- Next.js 배포: https://nextjs.org/docs/deployment
- PM2 문서: https://pm2.keymetrics.io/docs/usage/quick-start/
- Nginx 문서: https://nginx.org/en/docs/

---

**마지막 업데이트**: 2025-10-27
**작성자**: Claude (AI Assistant)
**검토자**: 시스템 관리자 (truth0530@nmc.or.kr)
