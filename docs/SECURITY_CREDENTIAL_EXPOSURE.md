# 보안 경고: 인증 정보 노출 및 대응 가이드

**작성일**: 2025-11-01
**심각도**: Critical
**상태**: 조치 진행 중

---

## 요약

GitGuardian 보안 스캔을 통해 GitHub 공개 저장소에 다음 인증 정보가 노출된 것이 확인되었습니다:

1. **데이터베이스 비밀번호** (PostgreSQL)
2. **JWT_SECRET** (JWT 토큰 서명 키)
3. **ENCRYPTION_KEY** (데이터 암호화 키)
4. **NEXTAUTH_SECRET** (NextAuth.js 세션 키)
5. **RESEND_API_KEY** (이메일 API 키)
6. **NEXT_PUBLIC_KAKAO_MAP_APP_KEY** (카카오맵 API 키)

---

## 노출된 파일 목록

### 활성 파일 (수정 완료)
- `scripts/backup/backup-database.sh`
- `scripts/backup/restore-database.sh`
- `scripts/deploy/setup-app.sh`

### 아카이브 파일 (수정 완료)
- `docs/archive/NCP_PRODUCTION_SETUP.md`
- `docs/archive/SERVER_SETUP_SESSION_20251027.md`
- `docs/archive/TODAY_SUMMARY.md`
- `docs/archive/migration/COMPLETE/NCP_MIGRATION_PHASE1_COMPLETE.md`
- `docs/archive/migration/NCP_DEPLOYMENT_GUIDE.md`

---

## 즉시 조치 필요 사항

### 1. 데이터베이스 비밀번호 변경 (최우선)

**NCP 콘솔에서 PostgreSQL 비밀번호 변경**:

```bash
# NCP 콘솔 > Database > Cloud DB for PostgreSQL
# pg-3aqmb1 인스턴스 선택 > 사용자 관리
# aedpics_admin 사용자 비밀번호 변경
```

**서버 환경변수 업데이트**:
```bash
# 프로덕션 서버에 SSH 접속
ssh aedpics@223.130.150.133

# .env.production 파일 수정
cd /var/www/aedpics
nano .env.production

# DATABASE_URL 업데이트
DATABASE_URL="postgresql://aedpics_admin:NEW_PASSWORD@pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com:5432/aedpics_production?schema=aedpics"

# PM2 재시작
pm2 reload all
```

### 2. JWT 및 암호화 키 재생성

**새로운 키 생성**:
```bash
# 각 키마다 실행
openssl rand -base64 32
```

**서버 환경변수 업데이트**:
```bash
# .env.production 파일에서 다음 값들을 새로 생성한 값으로 교체
NEXTAUTH_SECRET="[새로_생성한_값]"
JWT_SECRET="[새로_생성한_값]"
ENCRYPTION_KEY="[새로_생성한_값]"
```

**영향**:
- 기존 로그인 세션이 모두 무효화됨
- 사용자들이 재로그인 필요
- 암호화된 기존 데이터는 복호화 불가 (현재 암호화된 데이터가 있다면 마이그레이션 필요)

### 3. API 키 재발급 (선택적)

#### Resend API Key (이메일)
**현재**: NCP Cloud Outbound Mailer로 이미 전환됨
**조치**: Resend는 더 이상 사용하지 않으므로 해당 키 삭제만 하면 됨

#### Kakao Maps API Key
**조치 여부 판단**:
- 카카오 API 키는 프론트엔드에서 공개적으로 사용되므로 노출 자체는 큰 문제가 아님
- 하지만 악의적 사용 방지를 위해 **도메인 제한** 설정 확인 필요

**카카오 개발자 콘솔**:
```
https://developers.kakao.com/console/app
1. 애플리케이션 선택
2. 플랫폼 > Web 플랫폼 > 사이트 도메인 확인
3. aed.pics, localhost만 허용되어 있는지 확인
4. 필요시 키 재발급
```

---

## 완료된 조치

### 1. 저장소에서 인증 정보 제거 (2025-11-01)

모든 활성 및 아카이브 파일에서 하드코딩된 인증 정보를 제거하고 다음으로 교체:

- 데이터베이스 비밀번호 → 환경변수 필수 요구 (`${DB_PASSWORD:?ERROR...}`)
- JWT/암호화 키 → `[REDACTED_*]` 플레이스홀더
- API 키 → `[REDACTED_*]` 플레이스홀더

### 2. 스크립트 보안 강화

**backup-database.sh & restore-database.sh**:
```bash
# 이전 (취약):
DB_PASSWORD="${DB_PASSWORD:-AEDpics2025*NCP}"

# 이후 (안전):
DB_PASSWORD="${DB_PASSWORD:?ERROR: DB_PASSWORD environment variable is required}"
```

**setup-app.sh**:
- 하드코딩된 .env.production 생성 코드 제거
- 환경변수 수동 설정 가이드로 교체
- 실수로 인한 재노출 방지

---

## Git History 주의사항

### 문제점
이미 노출된 인증 정보는 **Git History에 영구적으로 남아있습니다**.
현재 커밋에서 제거해도 과거 커밋을 통해 여전히 접근 가능합니다.

### Git History 정리 (선택적, 고급)

**경고**: 이 작업은 Git History를 재작성하므로 협업 중인 경우 팀원과 협의 필요

```bash
# BFG Repo-Cleaner 사용 (권장)
brew install bfg  # macOS

# 패턴 파일 생성
cat > patterns.txt << 'EOF'
AEDpics2025*NCP
I2ZaT40bBTxAWpnDeI8NEXQPgXp/zkGqWVgpgyggSig=
qwh0HqmM66IEOVbZ6S5DQ6BBdsjwv/6W3yYGZF3kfTw=
OZ3p3VGk5qKdPQc1GsFqqDC9E/BfVn0iwNWuSyG+KEE=
re_Mpcv9mDn_2Pooy8YjcwZTDpnQsbotJ2Ur
EOF

# History에서 패턴 제거
bfg --replace-text patterns.txt .git

# 변경사항 적용
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (주의!)
git push --force
```

**권장사항**: 이미 인증 정보를 교체할 예정이므로 Git History 정리는 선택사항입니다.

---

## 보안 체크리스트

### 즉시 (1시간 내)
- [ ] NCP PostgreSQL 비밀번호 변경
- [ ] 서버 .env.production DATABASE_URL 업데이트
- [ ] PM2 프로세스 재시작
- [ ] 데이터베이스 연결 확인

### 단기 (24시간 내)
- [ ] NEXTAUTH_SECRET 재생성 및 업데이트
- [ ] JWT_SECRET 재생성 및 업데이트
- [ ] ENCRYPTION_KEY 재생성 및 업데이트
- [ ] 사용자에게 재로그인 안내
- [ ] Resend API 키 삭제
- [ ] Kakao Maps API 도메인 제한 확인

### 중기 (1주일 내)
- [ ] 데이터베이스 접근 로그 검토 (비정상 접근 여부 확인)
- [ ] 애플리케이션 로그 검토 (비정상 활동 여부 확인)
- [ ] 보안 정책 문서화

### 장기 (지속적)
- [ ] GitHub Actions Secrets 사용 강화
- [ ] 환경변수 검증 시스템 구축 (zod 스키마)
- [ ] Git pre-commit hook에 비밀 검증 추가
- [ ] 정기 보안 감사 실시

---

## 예방 조치

### 1. .gitignore 강화

`.gitignore`에 다음 추가 확인:
```gitignore
# Environment variables
.env
.env.local
.env.production
.env.*.local

# Backup files
*.backup
*.bak
*.old

# Scripts with credentials
*-with-creds.sh
```

### 2. Git Pre-commit Hook

[docs/guides/GITHUB_PUSH_CHECKLIST.md](docs/guides/GITHUB_PUSH_CHECKLIST.md)의 pre-commit hook에 비밀 검증 추가 검토

### 3. GitHub Actions Secrets 사용

모든 민감 정보는 GitHub Actions Secrets으로 관리:
```yaml
# .github/workflows/deploy.yml
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

### 4. 환경변수 검증 시스템

[docs/CODE_REVIEW_CRITICAL_ISSUES.md](docs/CODE_REVIEW_CRITICAL_ISSUES.md)의 Medium Priority #7 참조

---

## 관련 문서

- [CODE_REVIEW_CRITICAL_ISSUES.md](docs/CODE_REVIEW_CRITICAL_ISSUES.md) - 코드 보안 검토
- [.env.example](.env.example) - 환경변수 템플릿
- [CLAUDE.md](CLAUDE.md) - 개발 가이드라인

---

## 문의

- 보안 담당자: truth0530@nmc.or.kr
- 시스템 관리자: inhak@nmc.or.kr

---

**최종 업데이트**: 2025-11-01
**다음 검토 예정**: 인증 정보 교체 완료 후
