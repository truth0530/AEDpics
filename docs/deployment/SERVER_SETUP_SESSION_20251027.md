# NCP 서버 설정 세션 보고서

## 세션 정보
- 날짜: 2025-10-27
- 시작 시간: 약 17:12 KST
- 작업 서버: aedpics-web-server (223.130.150.133)
- 목적: NCP 웹 서버 초기 설정 및 배포 준비

## 완료된 작업

### 1. GitHub Secrets 등록 (100% 완료)

총 14개의 Secrets를 GitHub에 등록했습니다:

**NCP 서버 접속 정보 (4개)**
```
NCP_HOST=223.130.150.133
NCP_USERNAME=root
NCP_SSH_KEY=[SSH private key]
NCP_SSH_PORT=22
```

**데이터베이스 (1개)**
```
DATABASE_URL=postgresql://aedpics_admin:AEDpics2025*NCP@pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com:5432/aedpics_production?schema=aedpics
```

**인증 및 보안 (4개)**
```
NEXTAUTH_URL=http://223.130.150.133:3000
NEXTAUTH_SECRET=OZ3p3VGk5qKdPQc1GsFqqDC9E/BfVn0iwNWuSyG+KEE=
JWT_SECRET=I2ZaT40bBTxAWpnDeI8NEXQPgXp/zkGqWVgpgyggSig=
ENCRYPTION_KEY=qwh0HqmM66IEOVbZ6S5DQ6BBdsjwv/6W3yYGZF3kfTw=
```

**애플리케이션 설정 (2개)**
```
MASTER_EMAIL=admin@nmc.or.kr
NEXT_PUBLIC_SITE_URL=http://223.130.150.133:3000
```

**외부 API (2개)**
```
NEXT_PUBLIC_KAKAO_MAP_APP_KEY=6e3339a5cbd61f1f3b08e3a06071795b (기존 키 재사용)
RESEND_API_KEY=re_Mpcv9mDn_2Pooy8YjcwZTDpnQsbotJ2Ur (임시 사용, 향후 Cloud Outbound Mailer로 전환)
```

**알림 (1개)**
```
SLACK_WEBHOOK_URL=[기존 값]
```

### 2. 문서 작성

#### A. NCP 서버 설정 가이드
- 파일: [docs/deployment/NCP_SERVER_SETUP.md](NCP_SERVER_SETUP.md)
- 내용:
  - 서버 정보 및 스펙
  - 보안 설정 (ACG, SSH)
  - 초기 설정 10단계
  - 배포 후 검증 방법
  - 운영 관리 명령어
  - 트러블슈팅 가이드
  - 보안 강화 방법

#### B. 배포 스크립트 (5개)
자동화를 위한 Bash 스크립트 작성:

1. **scripts/deploy/install-nodejs.sh**
   - Node.js 20 설치 (NodeSource repository)
   - 자동 버전 확인

2. **scripts/deploy/install-pm2-nginx.sh**
   - PM2 글로벌 설치
   - PM2 startup 설정
   - Nginx 설치 및 활성화

3. **scripts/deploy/setup-app.sh**
   - GitHub 저장소 클론
   - 환경변수 파일 생성
   - npm 패키지 설치
   - Prisma 클라이언트 생성
   - Next.js 프로덕션 빌드

4. **scripts/deploy/start-app.sh**
   - PM2 ecosystem 파일 생성
   - PM2로 애플리케이션 시작
   - 프로세스 저장

5. **scripts/deploy/setup-nginx.sh**
   - Nginx 리버스 프록시 설정
   - 사이트 활성화
   - 설정 테스트 및 재시작

#### C. CLAUDE.md 업데이트
- 배포 및 운영 섹션 추가
- 4개 배포 관련 문서 링크 추가

### 3. 서버 시스템 업데이트 (진행 중)

#### 실행 명령어
```bash
apt update && apt upgrade -y && apt install -y curl git build-essential
```

#### 상태
- 시작 시간: 약 17:12 KST
- 현재 상태: 진행 중 (260개 패키지 업그레이드 + 6개 신규 설치)
- 예상 완료: 약 10-15분 소요

#### 업데이트 내용
- 228개 업데이트 (84개 보안 업데이트 포함)
- libc6, base-files 등 시스템 핵심 패키지
- linux-firmware (537 MB)

## 기술적 의사결정

### 1. 이메일 서비스 선택
**결정:** Resend 임시 사용 → Cloud Outbound Mailer 전환 예정

**이유:**
- Resend는 미국 기반 서비스로 국정원 인증 요구사항(국내 데이터 저장) 불충족
- Cloud Outbound Mailer는 NCP 국내 서비스로 인증 요구사항 충족
- 초기 테스트 단계에서는 Resend 사용, 프로덕션 배포 전 전환

### 2. Kakao Maps API 키 재사용
**결정:** 기존 AED_check2025 프로젝트의 API 키 재사용

**이유:**
- 플랫폼 설정에 새 서버 IP 추가 완료 (223.130.150.133)
- 새로 발급받을 필요 없음
- API 키: 6e3339a5cbd61f1f3b08e3a06071795b

### 3. 서버 과금 방식
**결정:** 시간당 과금 (115 KRW/시간)

**이유:**
- 초기 테스트 단계에서 유연성 제공
- 서버 중지 가능 (최대 90일/회, 연 180일)
- 안정화 후 월 정액 전환 고려

## 비용 추정

### 서버 운영 비용
- **DB 서버:** 약 100,000-120,000 KRW/월 (2vCPU, 8GB, 고정)
- **웹 서버:** 82,240 KRW/월 (2vCPU, 8GB) 또는 115 KRW/시간
- **스토리지:** 최소 10GB (비용 포함)

### 세션 비용 (참고)
- 현재까지 약 1시간 소요 = 약 115 KRW

## 다음 단계 (서버 업데이트 완료 후)

### 즉시 실행
1. Node.js 20 설치
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
   apt install -y nodejs
   ```

2. PM2 및 Nginx 설치
   ```bash
   npm install -g pm2
   pm2 startup systemd
   apt install -y nginx
   systemctl start nginx
   systemctl enable nginx
   ```

### 애플리케이션 배포
3. 애플리케이션 디렉토리 생성 및 클론
   ```bash
   mkdir -p /var/www/aedpics
   cd /var/www/aedpics
   git clone https://github.com/kwangsunglee/AEDpics.git .
   ```

4. 환경변수 설정
   ```bash
   # .env.production 파일 생성
   # DATABASE_URL, NEXTAUTH 등 14개 변수 설정
   ```

5. 빌드 및 실행
   ```bash
   npm ci --production=false
   npx prisma generate
   npm run build
   pm2 start ecosystem.config.js
   pm2 save
   ```

### 네트워크 설정
6. Nginx 리버스 프록시 설정
   ```bash
   # /etc/nginx/sites-available/aedpics 파일 생성
   # 80 포트 → 3000 포트 프록시
   nginx -t
   systemctl restart nginx
   ```

### 검증
7. 서비스 상태 확인
   ```bash
   pm2 status
   systemctl status nginx
   curl http://localhost
   ```

8. 외부 접속 테스트
   - 브라우저: http://223.130.150.133

### 프로덕션 준비 (추후)
9. 도메인 설정
   - aedpics.nmc.or.kr 연결
   - DNS A 레코드: 223.130.150.133

10. SSL/HTTPS 설정
    - Let's Encrypt 인증서
    - Nginx HTTPS 리스너 (443)

11. 보안 강화
    - UFW 방화벽 설정
    - Fail2Ban 설치
    - SSH 보안 강화 (비밀번호 인증 비활성화)

12. 이메일 서비스 전환
    - Resend → Cloud Outbound Mailer
    - RESEND_API_KEY 제거
    - NCP_MAILER_* 환경변수 추가

## 중요 참고사항

### SSH 접속
```bash
# SSH Key 위치: ~/.ssh/aedpics-server-key.pem
# 권한: 400
ssh -i ~/.ssh/aedpics-server-key.pem root@223.130.150.133
```

### 데이터베이스 접속
```bash
Host: pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com
Port: 5432
Database: aedpics_production
Schema: aedpics
User: aedpics_admin
Password: AEDpics2025*NCP
```

### 프로젝트 구조
```
/var/www/aedpics/          # 애플리케이션 루트
├── .env.production        # 환경변수 (권한: 600)
├── ecosystem.config.js    # PM2 설정
├── package.json
├── next.config.ts
├── prisma/
│   └── schema.prisma
└── ...
```

## 문제 해결 기록

### 1. SSH 접속 실패
**문제:** SSH key 인증 실패

**원인:** NCP는 초기 접속 시 password 인증 필요

**해결:** NCP 콘솔에서 .pem 파일 업로드하여 비밀번호 획득

### 2. SSH Key 위치
**문제:** 프로젝트 디렉토리 내 SSH key 저장

**위험:** Git에 실수로 커밋될 수 있음

**해결:** ~/.ssh/로 이동, chmod 400 설정, .gitignore 확인

### 3. GitHub Secrets 등록 혼동
**문제:** Secret Name vs Value 혼동

**해결:**
- Name 필드: 변수명 그대로 입력 (예: NCP_USERNAME)
- Value 필드: 실제 값 입력 (예: root)

## 참고 문서

- [NCP 서버 설정 가이드](NCP_SERVER_SETUP.md)
- [GitHub Secrets 설정 가이드](GITHUB_SECRETS_SETUP.md)
- [GitHub Actions 최적화](../GITHUB_ACTIONS_OPTIMIZATION.md)
- [Slack Webhook 설정](../SLACK_WEBHOOK_SETUP.md)

---

**작성:** Claude (AI Assistant)
**검토:** 시스템 관리자 (truth0530@nmc.or.kr)
**다음 작업자:** 서버 업데이트 완료 확인 후 Node.js 설치부터 진행
