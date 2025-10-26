# 보안 가이드라인

**작성일**: 2025-10-25
**버전**: 1.0

## 절대 준수 사항

### 1. 민감정보 커밋 금지

다음 정보는 **절대** Git에 커밋하지 마세요:

- 데이터베이스 비밀번호
- API 키 및 토큰
- 암호화 키
- 서버 접속 정보
- 개인정보

### 2. 환경변수 관리

#### 올바른 방법
```bash
# .env.local 파일 사용 (gitignore에 포함됨)
DATABASE_URL="postgresql://user:password@host:5432/db"
RESEND_API_KEY="re_xxxxxxxxxxxxx"
```

#### 잘못된 방법
```bash
# README.md에 직접 작성 (절대 금지!)
PGPASSWORD='AEDpics2025*NCP' psql -h ...
```

### 3. .gitignore 설정

다음 파일들이 포함되어 있는지 확인:

```gitignore
# 환경변수
.env*.local
.env
.env.production

# 민감정보 파일
**/credentials.json
**/secrets.json
**/*password*
**/*secret*
**/*private*
```

### 4. .env.example 사용

실제 값 대신 플레이스홀더 사용:

```env
# Good
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"

# Bad
DATABASE_URL="postgresql://admin:RealPassword123@real-server.com:5432/production"
```

## 이미 푸시된 민감정보 처리

### 1. 즉시 비밀번호 변경
```bash
# NCP 콘솔에서 데이터베이스 비밀번호 변경
```

### 2. Git 히스토리에서 제거
```bash
# BFG Repo-Cleaner 사용
java -jar bfg.jar --replace-text passwords.txt

# 또는 git filter-branch 사용
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch README.md' \
  --prune-empty --tag-name-filter cat -- --all

# 강제 푸시
git push origin --force --all
```

### 3. 팀원들에게 알림
```bash
# 모든 팀원이 로컬 저장소 재클론 필요
git clone <repository-url>
```

## 현재 프로젝트 상태

현재 이 프로젝트는 Git 저장소가 초기화되지 않았습니다 (안전).

앞으로 Git 저장소를 초기화할 때:

1. `.gitignore` 먼저 커밋
2. `.env.example` 커밋
3. `.env.local` 파일은 절대 커밋하지 않음
4. 첫 커밋 전 민감정보 이중 확인

## 점검 체크리스트

Git 커밋 전 반드시 확인:

- [ ] `.env.local` 파일이 `.gitignore`에 포함되어 있는가?
- [ ] README.md에 실제 비밀번호가 없는가?
- [ ] 문서에 실제 서버 주소와 비밀번호가 함께 있지 않은가?
- [ ] API 키가 하드코딩되어 있지 않은가?
- [ ] `git status`로 커밋될 파일 확인했는가?

## 참고 자료

- [GitHub: Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [OWASP: Sensitive Data Exposure](https://owasp.org/www-project-top-ten/2017/A3_2017-Sensitive_Data_Exposure)

---

**중요**: 보안은 한 번의 실수로도 큰 문제가 될 수 있습니다. 항상 주의하세요!
