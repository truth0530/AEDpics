# 백업 및 복구 가이드

**작성일**: 2025-10-26
**버전**: 1.0.0

## 개요

AEDpics 데이터베이스 및 애플리케이션 파일의 백업과 복구 절차를 설명합니다.

## 1. 백업 전략

### 1.1 백업 유형

| 백업 유형 | 대상 | 주기 | 보관 기간 | 우선순위 |
|----------|------|------|-----------|----------|
| 데이터베이스 백업 | PostgreSQL | 매일 새벽 2시 | 7일 | 최우선 |
| 애플리케이션 백업 | 소스 코드 | 주 1회 | 30일 | 중간 |
| GitHub 백업 | Git 저장소 | 자동 (push 시) | 무제한 | 필수 |

### 1.2 백업 보관 위치

- **로컬 백업**: `/var/backups/aedpics/`
- **GitHub Artifacts**: 30일 (database-backup.yml)
- **외부 저장소** (권장): NCP Object Storage 또는 AWS S3

## 2. 데이터베이스 백업

### 2.1 수동 백업

```bash
# 백업 디렉토리로 이동
cd /var/www/aedpics

# 백업 실행
./scripts/backup/backup-database.sh
```

**출력 예시**:
```
[INFO] 데이터베이스 백업 시작...
[INFO] 대상: pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com:5432/aedpics_production (스키마: aedpics)
[INFO] 백업 완료: /var/backups/aedpics/aedpics_backup_20251026_020000.sql.gz (15M)
[INFO] 백업 파일 검증 완료
[INFO] 삭제된 백업 파일: 2개
[INFO] 백업 프로세스 완료!
```

### 2.2 자동 백업 설정 (Cron)

```bash
# Cron 작업 편집
crontab -e

# 매일 새벽 2시 백업
0 2 * * * /var/www/aedpics/scripts/backup/backup-database.sh >> /var/backups/aedpics/backup.log 2>&1
```

### 2.3 GitHub Actions 자동 백업

`.github/workflows/database-backup.yml` 파일이 이미 설정되어 있습니다.

- 매일 새벽 2시 (KST 11시) 자동 실행
- GitHub Artifacts에 30일간 보관
- Slack 알림 (설정 시)

## 3. 애플리케이션 파일 백업

### 3.1 수동 백업

```bash
# 백업 실행
./scripts/backup/backup-application.sh
```

**출력 예시**:
```
[INFO] 애플리케이션 백업 시작...
[INFO] 대상: /var/www/aedpics
[INFO] 백업 완료: /var/backups/aedpics/aedpics_app_20251026_020000.tar.gz (2.3M)
[INFO] 백업 파일 검증 완료
[INFO] 백업 프로세스 완료!
```

### 3.2 자동 백업 설정

```bash
# Cron 작업 추가
crontab -e

# 매주 일요일 새벽 3시 백업
0 3 * * 0 /var/www/aedpics/scripts/backup/backup-application.sh >> /var/backups/aedpics/app-backup.log 2>&1
```

## 4. 데이터베이스 복구

### 4.1 백업 파일 확인

```bash
# 백업 파일 목록
ls -lh /var/backups/aedpics/aedpics_backup_*.sql.gz

# 최신 5개 백업
ls -lt /var/backups/aedpics/aedpics_backup_*.sql.gz | head -5
```

### 4.2 복구 실행

**주의**: 복구 작업은 현재 데이터를 모두 삭제합니다. 반드시 백업을 확인한 후 실행하세요.

```bash
# 복구할 백업 파일 지정
./scripts/backup/restore-database.sh /var/backups/aedpics/aedpics_backup_20251026_020000.sql.gz
```

**출력 예시**:
```
[WARN] =====================================
[WARN] 경고: 데이터베이스 복구 작업
[WARN] =====================================
[WARN] 대상 DB: pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com:5432/aedpics_production
[WARN] 백업 파일: /var/backups/aedpics/aedpics_backup_20251026_020000.sql.gz
[WARN]
[WARN] 이 작업은 현재 데이터를 모두 삭제하고
[WARN] 백업 파일로 복원합니다.
[WARN]
계속하시겠습니까? (yes/no): yes
[INFO] 백업 파일 무결성 검증 완료
[INFO] 안전장치: 현재 데이터 임시 백업 중... (/tmp/aedpics_safety_backup_20251026_103000.sql.gz)
[INFO] 안전 백업 완료
[INFO] 기존 스키마 삭제 및 재생성 중...
[INFO] 스키마 재생성 완료
[INFO] 데이터베이스 복구 중...
[INFO] 데이터베이스 복구 완료
[INFO] 복구 검증 중...
[INFO] 복구된 테이블 수: 26
[INFO] 복구 검증 완료
[INFO] 안전 백업 파일 위치: /tmp/aedpics_safety_backup_20251026_103000.sql.gz
[WARN] 복구가 정상적으로 완료되면 안전 백업 파일을 삭제해주세요
[INFO] 복구 프로세스 완료!
```

### 4.3 복구 후 작업

```bash
# 1. Prisma 클라이언트 재생성
cd /var/www/aedpics
npx prisma generate

# 2. 애플리케이션 재시작
pm2 restart aedpics

# 3. Health Check 확인
curl https://aedpics.nmc.or.kr/api/health

# 4. 데이터 검증
PGPASSWORD='AEDpics2025*NCP' psql \
  -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com \
  -U aedpics_admin \
  -d aedpics_production \
  -p 5432 \
  -c "SELECT COUNT(*) FROM aedpics.aed_data;"

# 5. 안전 백업 파일 삭제 (정상 확인 후)
rm /tmp/aedpics_safety_backup_*.sql.gz
```

## 5. 애플리케이션 파일 복구

### 5.1 복구 실행

```bash
# 1. 현재 디렉토리 백업 (안전장치)
mv /var/www/aedpics /var/www/aedpics.old

# 2. 백업 파일 압축 해제
tar -xzf /var/backups/aedpics/aedpics_app_20251026_020000.tar.gz -C /var/www/

# 3. 의존성 재설치
cd /var/www/aedpics
npm ci

# 4. Prisma 클라이언트 생성
npx prisma generate

# 5. 빌드
npm run build

# 6. 환경변수 복사 (필요 시)
cp /var/www/aedpics.old/.env.production .env.production

# 7. PM2 재시작
pm2 restart aedpics

# 8. 정상 동작 확인 후 old 디렉토리 삭제
# rm -rf /var/www/aedpics.old
```

## 6. GitHub에서 복구

### 6.1 특정 커밋으로 복구

```bash
cd /var/www/aedpics

# 1. 현재 변경사항 확인
git status

# 2. 특정 커밋으로 롤백
git log --oneline  # 복구할 커밋 확인
git reset --hard <commit-hash>

# 3. 빌드 및 재시작
npm ci
npx prisma generate
npm run build
pm2 restart aedpics
```

### 6.2 특정 태그로 복구

```bash
cd /var/www/aedpics

# 1. 태그 목록 확인
git tag -l

# 2. 특정 태그로 체크아웃
git checkout v1.0.0

# 3. 빌드 및 재시작
npm ci
npx prisma generate
npm run build
pm2 restart aedpics
```

## 7. 재해 복구 (Disaster Recovery)

### 7.1 전체 시스템 복구 절차

**시나리오**: 서버 완전 손실

**필요한 것**:
- 최신 데이터베이스 백업
- GitHub 저장소 접근 권한
- NCP 계정 및 권한

**복구 단계**:

#### 1단계: 새 서버 생성
```bash
# NCP Console에서 새 서버 인스턴스 생성
# [NCP_PRODUCTION_SETUP.md](./NCP_PRODUCTION_SETUP.md) 참조
```

#### 2단계: 기본 환경 설정
```bash
# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# Node.js 설치
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# PM2 설치
npm install -g pm2

# PostgreSQL 클라이언트 설치
sudo apt install -y postgresql-client
```

#### 3단계: 애플리케이션 배포
```bash
# 프로젝트 클론
cd /var/www
git clone <repository-url> aedpics
cd aedpics

# 환경변수 설정
nano .env.production

# 의존성 설치
npm ci
npx prisma generate
npm run build

# PM2로 시작
pm2 start ecosystem.config.js
pm2 save
```

#### 4단계: 데이터베이스 복구
```bash
# 최신 백업 다운로드 (GitHub Artifacts 또는 외부 저장소)
# 복구 실행
./scripts/backup/restore-database.sh <백업파일>
```

#### 5단계: Nginx 설정
```bash
# [NCP_PRODUCTION_SETUP.md](./NCP_PRODUCTION_SETUP.md) 참조
```

#### 6단계: 검증
```bash
# Health Check
curl https://aedpics.nmc.or.kr/api/health

# 브라우저에서 확인
# https://aedpics.nmc.or.kr
```

### 7.2 복구 시간 목표 (RTO/RPO)

| 지표 | 목표 | 비고 |
|------|------|------|
| RTO (Recovery Time Objective) | 4시간 | 전체 시스템 복구 시간 |
| RPO (Recovery Point Objective) | 24시간 | 최대 데이터 손실 허용 범위 |

## 8. 백업 검증

### 8.1 정기 검증 (월 1회 권장)

```bash
# 1. 백업 파일 무결성 검증
gzip -t /var/backups/aedpics/aedpics_backup_*.sql.gz

# 2. 백업 파일 내용 확인 (압축 해제 없이)
gunzip -c /var/backups/aedpics/aedpics_backup_20251026_020000.sql.gz | head -100

# 3. 테스트 복구 (개발 환경에서)
# 프로덕션이 아닌 테스트 DB에 복구 테스트
```

### 8.2 백업 로그 확인

```bash
# 백업 로그 확인
tail -f /var/backups/aedpics/backup.log

# 최근 백업 성공 여부
grep "백업 프로세스 완료" /var/backups/aedpics/backup.log | tail -5
```

## 9. 외부 저장소 백업 (권장)

### 9.1 NCP Object Storage

```bash
# AWS CLI 설치 (S3 호환)
sudo apt install -y awscli

# NCP Object Storage 설정
aws configure --profile ncp
# Access Key: <NCP_ACCESS_KEY>
# Secret Key: <NCP_SECRET_KEY>
# Region: kr-standard
# Output: json

# 백업 업로드
aws s3 cp /var/backups/aedpics/aedpics_backup_20251026_020000.sql.gz \
  s3://aedpics-backups/ \
  --profile ncp

# 자동 동기화 (Cron)
# 0 4 * * * aws s3 sync /var/backups/aedpics s3://aedpics-backups/ --profile ncp
```

### 9.2 외부 저장소 복구

```bash
# Object Storage에서 백업 다운로드
aws s3 cp s3://aedpics-backups/aedpics_backup_20251026_020000.sql.gz \
  /tmp/ \
  --profile ncp

# 복구 실행
./scripts/backup/restore-database.sh /tmp/aedpics_backup_20251026_020000.sql.gz
```

## 10. 트러블슈팅

### 문제: 백업 파일 손상

**증상**: `gzip: invalid compressed data--crc error`

**해결**:
```bash
# 이전 백업 파일 사용
ls -lt /var/backups/aedpics/aedpics_backup_*.sql.gz | head -10

# GitHub Artifacts에서 다운로드
# GitHub → Actions → Database Backup → 최신 실행 → Artifacts 다운로드
```

### 문제: 디스크 공간 부족

**증상**: `No space left on device`

**해결**:
```bash
# 디스크 사용량 확인
df -h

# 오래된 백업 삭제
find /var/backups/aedpics -name "*.sql.gz" -mtime +7 -delete
find /var/backups/aedpics -name "*.tar.gz" -mtime +30 -delete

# 로그 파일 정리
find /var/www/aedpics/logs -name "*.log" -mtime +30 -delete
```

### 문제: 복구 후 Prisma 오류

**증상**: `PrismaClient is unable to be run in the browser`

**해결**:
```bash
# Prisma 클라이언트 재생성
cd /var/www/aedpics
rm -rf node_modules/.prisma
npx prisma generate

# PM2 재시작
pm2 restart aedpics
```

## 11. 체크리스트

### 백업 체크리스트
- [ ] 일일 데이터베이스 백업 자동 실행
- [ ] 주간 애플리케이션 백업 자동 실행
- [ ] GitHub에 코드 정기 푸시
- [ ] 백업 파일 무결성 월 1회 확인
- [ ] 외부 저장소 동기화 (권장)

### 복구 준비 체크리스트
- [ ] 백업 파일 위치 문서화
- [ ] 복구 스크립트 테스트 완료
- [ ] 환경변수 별도 보관
- [ ] NCP 계정 정보 안전 보관
- [ ] GitHub 접근 권한 확인

## 12. 참고 문서

- [PostgreSQL 백업 공식 문서](https://www.postgresql.org/docs/current/backup.html)
- [NCP 프로덕션 설정](./NCP_PRODUCTION_SETUP.md)
- [CI/CD 설정](./CICD_SETUP.md)

---

**최종 업데이트**: 2025-10-26
**문서 버전**: 1.0.0

**긴급 연락처**:
- 시스템 관리자: truth0530@nmc.or.kr
- 기술 지원: inhak@nmc.or.kr
