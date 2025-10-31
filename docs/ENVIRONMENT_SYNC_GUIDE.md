# 환경변수 동기화 가이드

## 긴급 작업 필요!

### 1. GitHub Secrets 추가 (즉시 필요)

GitHub 저장소 설정에서 다음 Secrets를 추가해야 합니다:
https://github.com/truth0530/AEDpics/settings/secrets/actions/new

#### NCP 이메일 서비스 (긴급!)
```
NCP_ACCESS_KEY: dVUNBJ8cxWfrSYyGmOY7
NCP_ACCESS_SECRET: RxWnGpU8OD1kkSe9j1RQOHGHiSBAXSIpAo8FCnNm
NCP_SENDER_EMAIL: noreply@nmc.or.kr
```

#### NCP Object Storage (점검 사진 업로드)
NCP 콘솔에서 Object Storage 인증키를 확인하여 추가:
```
NCP_OBJECT_STORAGE_ACCESS_KEY: (NCP 콘솔에서 확인)
NCP_OBJECT_STORAGE_SECRET_KEY: (NCP 콘솔에서 확인)
NCP_OBJECT_STORAGE_BUCKET: aedpics-inspections
NCP_OBJECT_STORAGE_ENDPOINT: https://kr.object.ncloudstorage.com
NCP_OBJECT_STORAGE_REGION: kr-standard
```

#### 보안
```
CRON_SECRET: (32자 이상 랜덤 문자열 생성)
```

랜덤 문자열 생성 방법:
```bash
openssl rand -base64 32
```

### 2. 프로덕션 서버 환경변수 확인

SSH로 프로덕션 서버 접속 후 확인:
```bash
ssh aedpics@223.130.150.133
cd /var/www/aedpics
cat .env.production
```

다음 환경변수가 있는지 확인:
- NCP_ACCESS_KEY
- NCP_ACCESS_SECRET
- NCP_SENDER_EMAIL
- NCP_OBJECT_STORAGE 관련 5개

### 3. 로컬 환경 정리 완료

#### 추가된 환경변수:
- NODE_ENV=development
- NEXT_PUBLIC_SITE_URL=http://localhost:3001

#### 주석 처리된 레거시 변수:
- Supabase 관련 (실제로는 아직 코드에서 참조하므로 완전 삭제 불가)
- 미사용 Kakao API 키들
- E-gen API
- Resend API

### 4. 다음 배포 시 주의사항

**현재 상태**: GitHub Secrets에 NCP 환경변수가 없어서 다음 배포 시 실패 예상

**해결 방법**:
1. 위의 GitHub Secrets를 모두 추가
2. 또는 deploy-production.yml에서 해당 부분 임시 제거

### 5. Object Storage 설정 방법

1. NCP 콘솔 로그인: https://console.ncloud.com
2. Object Storage 메뉴 이동
3. 버킷 생성: `aedpics-inspections`
4. 인증키 생성: 마이페이지 > 인증키 관리 > API 인증키 관리
5. Object Storage 전용 Access Key/Secret Key 생성
6. GitHub Secrets에 추가

### 6. 환경변수 체크리스트

#### 프로덕션 필수:
- [x] DATABASE_URL
- [x] NEXTAUTH_URL
- [x] NEXTAUTH_SECRET
- [x] JWT_SECRET
- [x] NEXT_PUBLIC_KAKAO_MAP_APP_KEY
- [x] NEXT_PUBLIC_SITE_URL
- [x] MASTER_EMAIL
- [x] ENCRYPTION_KEY
- [ ] NCP_ACCESS_KEY ⚠️
- [ ] NCP_ACCESS_SECRET ⚠️
- [ ] NCP_SENDER_EMAIL ⚠️
- [ ] NCP_OBJECT_STORAGE_ACCESS_KEY ⚠️
- [ ] NCP_OBJECT_STORAGE_SECRET_KEY ⚠️
- [ ] NCP_OBJECT_STORAGE_BUCKET ⚠️
- [ ] NCP_OBJECT_STORAGE_ENDPOINT ⚠️
- [ ] NCP_OBJECT_STORAGE_REGION ⚠️
- [ ] CRON_SECRET ⚠️

#### 로컬 개발:
모든 환경변수가 .env.local에 설정됨

### 7. 테스트 방법

환경변수 설정 후 테스트:
```bash
# 로컬에서 테스트
npm run dev

# 회원가입 테스트
1. /auth/signup 접속
2. 이메일 인증 테스트

# 비밀번호 재설정 테스트
1. /auth/forgot-password 접속
2. 이메일 발송 테스트
```

---

작성일: 2025-10-31
작성자: Claude