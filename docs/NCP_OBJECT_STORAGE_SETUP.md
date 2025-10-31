# NCP Object Storage 설정 가이드

## 🔴 아직 등록하지 못한 환경변수

### 1. CRON_SECRET (즉시 생성 가능!)

**생성된 랜덤 문자열:**
```
CoETCZe1Q6Ro1ZITG+x/AfhfJyj/uCPOckAH8Y3Sj44=
```

**GitHub Secrets 추가:**
```
Secret name: CRON_SECRET
Value: CoETCZe1Q6Ro1ZITG+x/AfhfJyj/uCPOckAH8Y3Sj44=
```

### 2. NCP Object Storage 인증키 확인 방법

#### 방법 1: 기존 인증키가 있는 경우

1. **NCP 콘솔 접속**: https://console.ncloud.com
2. **마이페이지 > 계정관리 > 인증키 관리** 이동
3. **API 인증키 관리** 클릭
4. 기존에 생성된 Object Storage 인증키 확인
   - Access Key ID 복사
   - Secret Key 확인 (보안 상 별도 보관하셨을 것임)

#### 방법 2: 새 인증키 생성이 필요한 경우

1. **NCP 콘솔 접속**: https://console.ncloud.com
2. **마이페이지 > 계정관리 > 인증키 관리** 이동
3. **API 인증키 관리** 클릭
4. **신규 API 인증키 생성** 버튼 클릭
5. 생성된 인증키 정보 안전하게 보관:
   - Access Key ID
   - Secret Key (한 번만 표시되므로 반드시 보관!)

#### 방법 3: Object Storage 버킷 생성 확인

1. **Object Storage** 메뉴 이동
2. **Bucket Management** 선택
3. `aedpics-inspections` 버킷이 있는지 확인
4. 없다면 **버킷 생성** 클릭:
   - 버킷명: `aedpics-inspections`
   - 리전: `KR`
   - 공개 설정: `공개` (사진 URL 접근용)

### 3. GitHub Secrets 추가 예시

인증키를 확인했다면:
```
Secret name: NCP_OBJECT_STORAGE_ACCESS_KEY
Value: (예: ncp_iam_BPASKPJ...)

Secret name: NCP_OBJECT_STORAGE_SECRET_KEY
Value: (예: ncp_iam_BPKSKPJGw...)
```

⚠️ **주의**: Object Storage 인증키는 일반 API 인증키(NCP_ACCESS_KEY)와 다릅니다!

## 🟢 이미 등록된 환경변수 (검증 완료)

### ✅ NCP 이메일 서비스
- NCP_ACCESS_KEY ✅
- NCP_ACCESS_SECRET ✅
- NCP_SENDER_EMAIL ✅

### ✅ NCP Object Storage (일부)
- NCP_OBJECT_STORAGE_BUCKET ✅ (aedpics-inspections)
- NCP_OBJECT_STORAGE_ENDPOINT ✅ (https://kr.object.ncloudstorage.com)
- NCP_OBJECT_STORAGE_REGION ✅ (kr-standard)
- NCP_OBJECT_STORAGE_ACCESS_KEY ❌ (추가 필요)
- NCP_OBJECT_STORAGE_SECRET_KEY ❌ (추가 필요)

## 📊 현재 배포 상태

- **최신 배포**: 진행 중 (환경변수 정리 커밋)
- **이전 배포**: 성공 (일정관리 버그 수정)
- **NCP 이메일**: 환경변수 추가로 정상 작동 예상
- **Object Storage**: 인증키 누락으로 사진 업로드 미작동

## 🚨 긴급도 평가

1. **높음**: NCP 이메일 (이미 해결 ✅)
2. **중간**: CRON_SECRET (위의 값으로 즉시 추가 가능)
3. **낮음**: Object Storage (사진 업로드 기능, 당장 필수는 아님)

## 테스트 방법

### 이메일 기능 테스트
```bash
# 프로덕션에서 확인
https://aed.pics/auth/signup
# 회원가입 시 이메일 인증 테스트

https://aed.pics/auth/forgot-password
# 비밀번호 재설정 이메일 테스트
```

### Object Storage 테스트
```bash
# 점검 페이지에서 사진 촬영
https://aed.pics/inspection
# 사진 업로드 시도 (현재는 실패 예상)
```

## 다음 단계

1. **즉시**: CRON_SECRET을 위 값으로 GitHub Secrets에 추가
2. **NCP 콘솔 확인 후**: Object Storage 인증키 추가
3. **테스트**: 프로덕션에서 회원가입/비밀번호 재설정 테스트

---

작성일: 2025-10-31 14:03
업데이트: 실시간 모니터링 중