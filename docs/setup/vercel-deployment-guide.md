# Vercel 배포 완전 가이드

> **최종 업데이트**: 2025-10-03
> **작성자**: AED 점검 시스템 팀

---

## 📋 목차

1. [초기 설정](#초기-설정)
2. [Root Directory 설정](#root-directory-설정)
3. [환경변수 설정](#환경변수-설정)
4. [배포 및 확인](#배포-및-확인)
5. [문제 해결](#문제-해결)

---

## 초기 설정

### 1. Vercel Dashboard 접속

1. https://vercel.com 로그인
2. 프로젝트 선택: `aed-check-system`
3. Settings 메뉴 이동

---

## Root Directory 설정

### 현재 문제 (해결 완료)

**증상**:
- Vercel이 프로젝트 루트를 잘못 인식
- `AED_check2025` 폴더를 루트로 인식 (잘못됨)
- 실제 프로젝트는 `aed-check-system` 폴더에 있음

### 해결 방법

#### 1. Settings > General 이동

#### 2. Root Directory 설정 변경

**변경 전**:
```
Root Directory: ./ (또는 비어있음)
```

**변경 후**:
```
Root Directory: aed-check-system
```

#### 3. 프로젝트 구조 확인

```
AED_check2025/                 # GitHub 저장소 루트
├── aed-check-system/          # ← Vercel Root Directory로 설정
│   ├── package.json           # Next.js 의존성 포함
│   ├── next.config.mjs
│   ├── app/
│   ├── components/
│   └── ...
└── (기타 파일들)
```

#### 4. 설정 저장

1. **Save** 버튼 클릭
2. 자동으로 재배포 시작됨

### Build & Development Settings

- **Framework Preset**: Next.js (자동 감지)
- **Build Command**: `npm run build` (또는 비워두기)
- **Output Directory**: `.next` (또는 비워두기)
- **Install Command**: `npm install` (또는 비워두기)

---

## 환경변수 설정

### Vercel에서 환경변수 추가 방법

1. **Environment Variables** 페이지에서 **Add New** 클릭
2. **Key** 입력 (예: `NEXT_PUBLIC_KAKAO_MAP_KEY`)
3. **Value** 입력 (예: `6e3339a5cbd61f1f3b08e3a06071795b`)
4. **Environment** 선택:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
5. **Save** 클릭

### 필수 환경변수 목록

#### Supabase 설정
```bash
# 현재 프로젝트: aed.pics (aieltmidsagiobpuebvv)
NEXT_PUBLIC_SUPABASE_URL=https://aieltmidsagiobpuebvv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpZWx0bWlkc2FnaW9icHVlYnZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNzkzNTIsImV4cCI6MjA3NTY1NTM1Mn0.wUmjCxKdMGu9ZEPWd8VlcuuFD9WfZdl7yEJTKkW4Y_Y
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpZWx0bWlkc2FnaW9icHVlYnZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDA3OTM1MiwiZXhwIjoyMDc1NjU1MzUyfQ.E3nUcWmkG0LBeWBhcaYnShqVa3jsLJQKfwPqlBtwURE
```

#### 카카오맵 API 설정 (중요!)
```bash
NEXT_PUBLIC_KAKAO_MAP_KEY=6e3339a5cbd61f1f3b08e3a06071795b
KAKAO_REST_API_KEY=0088cb06bf9ce78d8876390e087669dd
KAKAO_NATIVE_APP_KEY=f4c374734b4c2f0bccb145565c2872a8
KAKAO_ADMIN_KEY=977de9bd361c7022b3f91bfc787d0733
```

#### 이메일 설정 (Resend)
```bash
RESEND_API_KEY=re_Mpcv9mDn_2Pooy8YjcwZTDpnQsbotJ2Ur
```

#### 애플리케이션 설정
```bash
NEXT_PUBLIC_APP_URL=https://aed-check-system.vercel.app
NEXT_PUBLIC_APP_NAME=AED 스마트 점검 시스템
```

#### Master 관리자 이메일
```bash
MASTER_ADMIN_EMAILS=truth0530@nmc.or.kr,inhak@nmc.or.kr,woo@nmc.or.kr
```

#### 기능 플래그
```bash
NEXT_PUBLIC_ENABLE_INSPECTION_MENU=true
ENABLE_OFFLINE_MODE=true
ENABLE_DEBUG_MODE=false
```

---

## 배포 및 확인

### 재배포 방법

환경변수 추가/수정 후:

1. Vercel Dashboard > **Deployments** 탭
2. 최신 deployment 옆 **...** 메뉴 클릭
3. **Redeploy** 선택
4. **Use existing Build Cache** 체크 해제
5. **Redeploy** 클릭

### 배포 후 확인

배포 완료 후 다음 페이지에서 환경변수 적용 확인:

- **카카오맵 확인**: https://aed-check-system.vercel.app/map
- **Supabase 연결 확인**: https://aed-check-system.vercel.app/auth/login
- **메인 페이지**: https://aed-check-system.vercel.app

---

## 문제 해결

### 1. 카카오맵이 로드되지 않는 경우

**증상**: 지도가 표시되지 않음

**확인 사항**:
1. 브라우저 콘솔에서 에러 메시지 확인
2. Vercel 환경변수에 `NEXT_PUBLIC_KAKAO_MAP_KEY` 설정 확인
3. 카카오 개발자 콘솔에서 도메인 등록 확인

**해결 방법**:
```bash
# 카카오 개발자 콘솔에서 다음 도메인 등록:
https://aed-check-system.vercel.app
https://*.vercel.app  # Preview 환경용
```

### 2. Supabase 연결 오류

**증상**: "Failed to connect to Supabase" 에러

**확인 사항**:
1. Supabase Dashboard에서 프로젝트 상태 확인
2. API 키가 올바른지 확인
3. RLS 정책 설정 확인

**해결 방법**:
- Vercel 환경변수에서 `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 재확인
- Supabase Studio에서 RLS 정책 활성화 확인

### 3. 빌드 실패

**증상**: Deployment failed

**확인 사항**:
1. Build logs에서 에러 메시지 확인
2. Root Directory 설정이 `aed-check-system`인지 확인
3. `package.json`이 올바른 위치에 있는지 확인

**해결 방법**:
```bash
# Root Directory 설정 확인
Settings > General > Root Directory: aed-check-system
```

### 4. 환경변수가 로드되지 않음

**증상**: `process.env.NEXT_PUBLIC_XXX`가 undefined

**확인 사항**:
1. 환경변수명이 정확한지 확인 (대소문자 구분)
2. `NEXT_PUBLIC_` 접두사 확인 (클라이언트 변수)
3. 재배포 여부 확인

**해결 방법**:
1. Environment Variables에서 변수명 재확인
2. Build Cache 없이 재배포

### 5. Preview 환경에서 작동하지 않음

**증상**: Production은 정상, Preview는 오류

**확인 사항**:
- 환경변수가 Production, Preview, Development 모두 체크되었는지 확인

**해결 방법**:
```bash
# 각 환경변수의 Environment 설정 확인
✅ Production
✅ Preview
✅ Development
```

---

## 보안 주의사항

### 클라이언트 노출 방지

1. **`SUPABASE_SERVICE_ROLE_KEY`는 절대 클라이언트에 노출 금지**
   - `NEXT_PUBLIC_` 접두사 사용 금지
   - 서버사이드 API 라우트에서만 사용

2. **`NEXT_PUBLIC_`로 시작하는 변수만 클라이언트 접근 가능**
   - 브라우저 번들에 포함됨
   - 민감한 정보 포함 금지

3. **API 키는 정기적으로 재발급 권장**
   - 카카오 API: 3-6개월마다
   - Supabase: 필요 시

---

## 체크리스트

### Root Directory 설정
- [ ] Settings > General > Root Directory: `aed-check-system`
- [ ] 저장 후 자동 재배포 확인

### 환경변수 설정
- [ ] Supabase URL, Anon Key, Service Role Key
- [ ] 카카오맵 4개 API 키
- [ ] Resend API 키
- [ ] Master 관리자 이메일
- [ ] 모든 환경변수에 Production/Preview/Development 체크

### 카카오맵 도메인 등록
- [ ] https://developers.kakao.com 접속
- [ ] 앱 설정 > 플랫폼 > Web
- [ ] `https://aed-check-system.vercel.app` 추가
- [ ] `https://*.vercel.app` 추가 (Preview용)
- [ ] 저장

### 배포 확인
- [ ] Build logs에 에러 없음
- [ ] Production 배포 성공
- [ ] 메인 페이지 정상 작동
- [ ] 로그인 기능 정상
- [ ] 카카오맵 표시 정상

---

## 참고 자료

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Root Directory Configuration](https://vercel.com/docs/concepts/projects/overview#root-directory)

---

**마지막 업데이트**: 2025-10-03
**작성자**: AED 점검 시스템 개발팀
