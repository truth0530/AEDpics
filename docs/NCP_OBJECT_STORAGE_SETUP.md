# NCP Object Storage 설정 가이드

## 개요

점검 사진을 서버 디스크가 아닌 NCP Object Storage에 저장하여:
- 서버 디스크 용량 절약 (사진은 무제한 확장 가능)
- 안정적인 파일 관리 (자동 백업, 고가용성)
- 저렴한 비용 (약 $0.02/GB/월)

## 전제 조건

- NCP 계정 (이미 생성됨)
- 코드는 이미 완성되어 있음 (수정 불필요)
- AWS SDK 이미 설치됨 (`@aws-sdk/client-s3@3.918.0`)

## 1단계: NCP 콘솔에서 Object Storage 설정

### 1-1. Object Storage 버킷 생성

1. NCP 콘솔 접속: https://console.ncloud.com
2. Services > Storage > Object Storage 선택
3. "버킷 생성" 클릭
4. 버킷 설정:
   - 버킷명: `aedpics-inspections`
   - 리전: `kr-standard` (한국)
   - ACL: `public-read` (공개 읽기 허용)
5. "생성" 클릭

### 1-2. CORS 설정 (웹 업로드용)

1. 생성한 버킷 클릭
2. "CORS 설정" 탭 선택
3. 다음 CORS 정책 추가:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration>
    <CORSRule>
        <AllowedOrigin>https://aed.pics</AllowedOrigin>
        <AllowedOrigin>http://localhost:3001</AllowedOrigin>
        <AllowedMethod>GET</AllowedMethod>
        <AllowedMethod>POST</AllowedMethod>
        <AllowedMethod>PUT</AllowedMethod>
        <AllowedMethod>DELETE</AllowedMethod>
        <AllowedMethod>HEAD</AllowedMethod>
        <AllowedHeader>*</AllowedHeader>
        <MaxAgeSeconds>3600</MaxAgeSeconds>
    </CORSRule>
</CORSConfiguration>
```

4. "저장" 클릭

### 1-3. API 인증키 생성

**중요**: Object Storage API 키는 Cloud Outbound Mailer API 키와 다릅니다!

1. NCP 콘솔 > 마이페이지 > 인증키 관리
2. "API 인증키 관리" 선택
3. Object Storage용 새 키 생성:
   - "신규 API 인증키 생성" 클릭
   - 용도: `AEDpics Object Storage`
   - Access Key ID와 Secret Key 복사 (다시 볼 수 없음!)

**생성된 키 예시**:
```
Access Key ID: ncp_iam_BPA************
Secret Key: ncp_iam_BPK*****************
```

## 2단계: 로컬 환경 설정

### 2-1. `.env.local` 파일에 추가

프로젝트 루트의 `.env.local` 파일에 다음 추가:

```bash
# NCP Object Storage (점검 사진 저장용)
NCP_OBJECT_STORAGE_REGION="kr-standard"
NCP_OBJECT_STORAGE_ENDPOINT="https://kr.object.ncloudstorage.com"
NCP_OBJECT_STORAGE_ACCESS_KEY="ncp_iam_BPA************"  # 1-3에서 생성한 키
NCP_OBJECT_STORAGE_SECRET_KEY="ncp_iam_BPK*****************"  # 1-3에서 생성한 키
NCP_OBJECT_STORAGE_BUCKET="aedpics-inspections"
```

**주의사항**:
- `.env.local`은 절대 Git에 커밋하지 않음 (이미 `.gitignore`에 포함)
- Access Key와 Secret Key는 안전하게 보관

### 2-2. 로컬 연결 테스트

터미널에서 실행:

```bash
npm run test:storage
```

**예상 출력 (성공 시)**:
```
=== NCP Object Storage Test ===

1. 환경변수 확인:
   Region: kr-standard
   Endpoint: https://kr.object.ncloudstorage.com
   Bucket: aedpics-inspections
   Access Key: ncp_iam_BP...
   Secret Key: SET (50 chars)

2. 연결 테스트 (버킷 목록 조회):
   연결 성공! 버킷 개수: 2

   발견된 버킷:
    aedpics-inspections (생성일: 2025-10-31T...)
     other-bucket (생성일: 2025-10-01T...)

3. 업로드 테스트:
   업로드 성공!
   파일명: test-uploads/test-1730380000000.png
   공개 URL: https://kr.object.ncloudstorage.com/aedpics-inspections/test-uploads/test-1730380000000.png

4. 삭제 테스트:
   삭제 성공! (test-uploads/test-1730380000000.png)

=== 모든 테스트 완료! ===
NCP Object Storage가 정상적으로 작동합니다.
```

**실패 시 트러블슈팅**:

| 오류 메시지 | 원인 | 해결 방법 |
|-----------|------|----------|
| `InvalidAccessKeyId` | Access Key 잘못됨 | NCP 콘솔에서 키 재확인 |
| `SignatureDoesNotMatch` | Secret Key 잘못됨 | NCP 콘솔에서 키 재확인 |
| `NoSuchBucket` | 버킷이 없음 | 1-1 단계에서 버킷 생성 |
| `AccessDenied` | 권한 부족 | 버킷 ACL을 `public-read`로 설정 |
| `NOT SET` | 환경변수 없음 | `.env.local` 파일 확인 |

## 3단계: GitHub Secrets 설정 (프로덕션 배포용)

### 3-1. GitHub Secrets 추가

1. GitHub 저장소 페이지 이동
2. Settings > Secrets and variables > Actions
3. "New repository secret" 클릭
4. 다음 5개 Secret 추가:

| Secret 이름 | 값 | 설명 |
|------------|-----|------|
| `NCP_OBJECT_STORAGE_REGION` | `kr-standard` | 리전 |
| `NCP_OBJECT_STORAGE_ENDPOINT` | `https://kr.object.ncloudstorage.com` | 엔드포인트 |
| `NCP_OBJECT_STORAGE_ACCESS_KEY` | `ncp_iam_BPA...` | Access Key ID |
| `NCP_OBJECT_STORAGE_SECRET_KEY` | `ncp_iam_BPK...` | Secret Key |
| `NCP_OBJECT_STORAGE_BUCKET` | `aedpics-inspections` | 버킷명 |

### 3-2. GitHub Actions 워크플로우 확인

`.github/workflows/deploy-production.yml` 파일에서 환경변수가 전달되는지 확인:

```yaml
- name: Create .env file
  run: |
    echo "NCP_OBJECT_STORAGE_REGION=${{ secrets.NCP_OBJECT_STORAGE_REGION }}" >> .env
    echo "NCP_OBJECT_STORAGE_ENDPOINT=${{ secrets.NCP_OBJECT_STORAGE_ENDPOINT }}" >> .env
    echo "NCP_OBJECT_STORAGE_ACCESS_KEY=${{ secrets.NCP_OBJECT_STORAGE_ACCESS_KEY }}" >> .env
    echo "NCP_OBJECT_STORAGE_SECRET_KEY=${{ secrets.NCP_OBJECT_STORAGE_SECRET_KEY }}" >> .env
    echo "NCP_OBJECT_STORAGE_BUCKET=${{ secrets.NCP_OBJECT_STORAGE_BUCKET }}" >> .env
```

## 4단계: 프로덕션 배포 및 테스트

### 4-1. 배포 실행

```bash
git add .
git commit -m "feat: Add NCP Object Storage for inspection photos"
git push origin main
```

GitHub Actions가 자동으로 프로덕션 서버에 배포합니다.

### 4-2. 프로덕션 서버 환경변수 확인

SSH로 프로덕션 서버 접속 후:

```bash
cd /var/www/aedpics
cat .env | grep NCP_OBJECT_STORAGE
```

**예상 출력**:
```
NCP_OBJECT_STORAGE_REGION=kr-standard
NCP_OBJECT_STORAGE_ENDPOINT=https://kr.object.ncloudstorage.com
NCP_OBJECT_STORAGE_ACCESS_KEY=ncp_iam_BPA...
NCP_OBJECT_STORAGE_SECRET_KEY=ncp_iam_BPK...
NCP_OBJECT_STORAGE_BUCKET=aedpics-inspections
```

### 4-3. 프로덕션 테스트 (실제 점검)

1. https://aed.pics 접속
2. 로그인 (보건소 계정)
3. AED 장비 선택
4. "즉시 점검 시작" 클릭
5. 사진 촬영:
   - 전체 사진
   - 배터리 사진
   - 패드 사진
6. 점검 완료 후 "제출" 클릭

**확인사항**:
- 사진 업로드 성공
- 점검 이력에서 사진 표시됨
- NCP 콘솔 > Object Storage > 버킷에서 파일 확인 가능

### 4-4. NCP 콘솔에서 업로드된 파일 확인

1. NCP 콘솔 > Object Storage > `aedpics-inspections` 버킷
2. `inspections/` 폴더 확인
3. 파일 구조 예시:
```
inspections/
  └── {sessionId}/
      ├── overall-1730380123456-abc123.jpg
      ├── battery-1730380234567-def456.jpg
      └── pad-1730380345678-ghi789.jpg
```

## 5단계: 모니터링 및 관리

### 5-1. 디스크 용량 모니터링

**기대 효과**: 사진 업로드 후에도 서버 디스크 사용량 증가하지 않음

```bash
# 프로덕션 서버에서 실행
df -h /

# 예상 출력 (점검 후에도 동일):
# /dev/vda2  9.8G  6.9G  2.4G  75% /
```

### 5-2. Object Storage 용량 및 비용 확인

NCP 콘솔 > Object Storage > 버킷 > "통계" 탭:
- 저장 용량 (GB)
- 요청 횟수
- 예상 비용

**비용 계산**:
- 저장 비용: 약 $0.02/GB/월 (약 30원/GB/월)
- 3개월 예상: 18GB × 30원 = 540원/월
- 1년 예상: 72GB × 30원 = 2,160원/월

### 5-3. 정기 점검 체크리스트

**주간 점검**:
- 점검 사진이 정상적으로 업로드되는지 확인
- 서버 디스크 용량 확인 (증가하지 않아야 함)
- NCP Object Storage 용량 확인

**월간 점검**:
- Object Storage 비용 확인
- 불필요한 파일 정리 (테스트 파일 등)
- 백업 정책 확인

## 6단계: 트러블슈팅

### 문제 1: 사진 업로드 실패

**증상**: 점검 페이지에서 사진 업로드 시 오류 발생

**확인 순서**:

1. 브라우저 콘솔 확인 (F12 > Console)
```javascript
// 오류 메시지 확인
// 예: "Failed to upload photo: 403 Forbidden"
```

2. 네트워크 탭 확인 (F12 > Network)
```
POST /api/storage/upload
Status: 403 Forbidden
```

3. 서버 로그 확인
```bash
ssh aedpics@223.130.150.133
pm2 logs aedpics --lines 50
```

**해결 방법**:

| 오류 코드 | 원인 | 해결 |
|----------|------|------|
| 403 Forbidden | CORS 설정 잘못됨 | 1-2 단계 CORS 재설정 |
| 401 Unauthorized | API 키 잘못됨 | GitHub Secrets 재확인 |
| 413 Payload Too Large | 파일 너무 큼 | 5MB 이하로 압축 |
| 500 Internal Server Error | 서버 환경변수 없음 | `.env` 파일 확인 |

### 문제 2: 사진이 표시되지 않음

**증상**: 점검 이력에서 사진 URL은 있지만 이미지가 로드되지 않음

**확인**:
1. 사진 URL 직접 접속
```
https://kr.object.ncloudstorage.com/aedpics-inspections/inspections/...
```

2. 브라우저 응답 확인:
   - 200 OK: 이미지 정상 (다른 문제)
   - 403 Forbidden: 버킷 ACL 문제
   - 404 Not Found: 파일이 실제로 없음

**해결**:
- 403 Forbidden: 버킷 ACL을 `public-read`로 설정
- 404 Not Found: 업로드가 실제로 실패했는지 서버 로그 확인

### 문제 3: 환경변수 인식 안 됨

**증상**: `npm run test:storage` 실행 시 "NOT SET" 오류

**확인**:
```bash
# .env.local 파일 존재 여부
ls -la .env.local

# 환경변수 내용 확인
cat .env.local | grep NCP_OBJECT_STORAGE
```

**해결**:
1. `.env.local` 파일이 없으면 생성
2. 환경변수 누락되었으면 추가
3. 값에 공백이나 따옴표 잘못되었는지 확인
4. Next.js 개발 서버 재시작

## 7단계: 백업 및 복구

### 백업 정책

**자동 백업**: NCP Object Storage는 기본적으로 고가용성 제공
- 데이터 3중 복제
- 99.999999999% (11 nines) 내구성

**수동 백업** (선택사항):
```bash
# AWS CLI로 전체 버킷 다운로드
aws s3 sync s3://aedpics-inspections ./backup/ \
  --endpoint-url https://kr.object.ncloudstorage.com
```

### 복구 절차

**파일 삭제 시**:
1. NCP 콘솔에서 버전 관리 활성화 (권장)
2. 삭제된 파일 복구 가능

**버킷 전체 손실 시** (거의 발생하지 않음):
1. 새 버킷 생성
2. 백업에서 복구
3. 환경변수 업데이트

## 코드 구조 (참조용)

### 구현 완료된 파일

1. **백엔드 스토리지 로직**: [lib/storage/ncp-storage.ts](../lib/storage/ncp-storage.ts)
   - `uploadPhotoToNCP()`: 사진 업로드
   - `deletePhotoFromNCP()`: 사진 삭제
   - `getPresignedUrl()`: 임시 URL 생성

2. **API 엔드포인트**:
   - [app/api/storage/upload/route.ts](../app/api/storage/upload/route.ts): 단일 사진 업로드
   - [app/api/storage/upload-batch/route.ts](../app/api/storage/upload-batch/route.ts): 다중 사진 업로드
   - [app/api/storage/delete/route.ts](../app/api/storage/delete/route.ts): 사진 삭제

3. **클라이언트 유틸리티**: [lib/utils/photo-upload.ts](../lib/utils/photo-upload.ts)
   - `uploadPhotoToStorage()`: 클라이언트에서 사진 업로드
   - `uploadPhotosToStorage()`: 다중 사진 업로드
   - `deletePhotoFromStorage()`: 사진 삭제

4. **테스트 스크립트**: [scripts/test/test-ncp-storage.ts](../scripts/test/test-ncp-storage.ts)
   - 연결 테스트
   - 업로드 테스트
   - 삭제 테스트

### 파일 경로 구조

```
inspections/{sessionId}/{photoType}-{timestamp}-{random}.{extension}

예시:
inspections/session_abc123/overall-1730380123456-xyz789.jpg
inspections/session_abc123/battery-1730380234567-abc123.jpg
inspections/session_abc123/pad-1730380345678-def456.jpg
```

## 보안 고려사항

1. **API 키 관리**:
   - 절대 코드에 하드코딩 금지
   - 환경변수로만 관리
   - GitHub Secrets 사용

2. **버킷 ACL**:
   - `public-read`: 누구나 읽기 가능 (사진 공개용)
   - 쓰기는 API 키가 있는 서버만 가능

3. **Rate Limiting**:
   - API 엔드포인트에 이미 구현됨 (10 uploads/minute)

4. **파일 검증**:
   - MIME type 체크: JPEG, PNG, WebP만 허용
   - 파일 크기 제한: 5MB
   - 악성 파일 차단

## 참고 문서

- NCP Object Storage 공식 문서: https://guide.ncloud-docs.com/docs/storage-objectstorage-overview
- AWS SDK for JavaScript v3 문서: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/
- 프로젝트 아키텍처: [reference/ARCHITECTURE_OVERVIEW.md](reference/ARCHITECTURE_OVERVIEW.md)

## 마이그레이션 완료 체크리스트

- [ ] 1단계: NCP 콘솔에서 버킷 생성
- [ ] 1단계: CORS 설정
- [ ] 1단계: API 키 생성
- [ ] 2단계: `.env.local` 설정
- [ ] 2단계: 로컬 테스트 성공 (`npm run test:storage`)
- [ ] 3단계: GitHub Secrets 설정 (5개)
- [ ] 3단계: GitHub Actions 워크플로우 확인
- [ ] 4단계: 프로덕션 배포
- [ ] 4단계: 프로덕션 환경변수 확인
- [ ] 4단계: 실제 점검으로 사진 업로드 테스트
- [ ] 4단계: NCP 콘솔에서 파일 확인
- [ ] 5단계: 디스크 용량 모니터링 (증가하지 않음)
- [ ] 5단계: Object Storage 통계 확인
- [ ] 문서화 완료
- [ ] 팀원에게 사용법 전달

마지막 업데이트: 2025-10-31
