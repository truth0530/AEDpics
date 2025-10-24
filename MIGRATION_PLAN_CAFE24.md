# AEDpics 프로젝트 - 카페24 마이그레이션 계획

## 📋 프로젝트 개요

**목표:** AED_check2025 → AEDpics 재구성
- 기존 개발 중단
- 새로운 스택으로 완전 재개발
- 국정원 인증 통과 가능한 구조
- 카페24 + 국내 PostgreSQL 기반

**작업 폴더:** `/Users/kwangsunglee/Projects/AEDpics`

---

## 🏗️ 기술 스택 변경

### 기존 스택 (AED_check2025)
```
Frontend:  Next.js 15 (Vercel 배포)
Backend:   Next.js API Routes
Database:  Supabase (PostgreSQL)
Auth:      Supabase Auth
Storage:   Supabase Storage
CDN:       Vercel CDN
```

### 새 스택 (AEDpics)
```
Frontend:  Next.js 15 (카페24 Node.js 호스팅)
Backend:   Next.js API Routes + Express (선택)
Database:  카페24 PostgreSQL 관리형 DB
Auth:      국내 서비스 (Auth0 또는 자체 구현)
Storage:   카페24 파일 스토리지 또는 로컬 스토리지
CDN:       스마트 CDN (국내)
Domain:    카페24 도메인 또는 별도 구매
```

---

## 🔄 마이그레이션 단계별 계획

### **Phase 0: 준비 (2-3일)**

#### 0-1. 카페24 가입 및 환경 구성 (1일)
```
할일:
□ 카페24 회원가입
□ Node.js 호스팅 신청 (또는 Hosting Pro)
□ PostgreSQL 데이터베이스 신청
□ 파일 스토리지 준비 (NAS 또는 클라우드 스토리지)
□ 도메인 결정 및 구매
  - 신규 도메인 또는 기존 도메인 이전
```

**예상 비용:**
- 카페24 가입: 무료
- Node.js 호스팅: 월 30,000~50,000원
- PostgreSQL DB: 월 20,000~30,000원
- 도메인: 연 12,000~30,000원
- **총 월비용: ~60,000~80,000원**

#### 0-2. 현재 AED_check2025 코드 분석 (1일)
```
조사 항목:
□ Supabase 의존도 파악
  - 인증 로직 위치
  - DB 쿼리 패턴
  - Storage 사용 위치

□ Vercel 특화 기능 확인
  - Edge Functions 사용 여부
  - Middleware 사용 여부
  - Environment 설정 확인

□ 데이터 구조 파악
  - 테이블 스키마
  - 관계도
  - 인덱스 전략

□ 파일 구조 정리
  - 재사용 가능한 컴포넌트
  - 유틸리티 함수
  - 상수 정의
```

#### 0-3. 새 프로젝트 초기화 (0.5일)
```bash
# AEDpics 폴더 내에서
npx create-next-app@latest aed-check-system \
  --typescript \
  --tailwind \
  --eslint

# 또는 기존 프로젝트 구조 복사
cd /Users/kwangsunglee/Projects/AEDpics
# aed-check-system 폴더 복사 (node_modules 제외)
```

---

### **Phase 1: 기초 인프라 구축 (5-7일)**

#### 1-1. 카페24 PostgreSQL 연결 (1-2일)
```
할일:
□ 카페24 PostgreSQL 접근 정보 수집
  - Host
  - Port
  - Database 이름
  - Username
  - Password

□ 로컬 환경에서 연결 테스트
  ```bash
  psql -h [host] -U [user] -d [database]
  ```

□ 스키마 생성
  - 기본 테이블 구조 설계
  - 초기 마이그레이션 스크립트 준비

□ .env.local 설정
  ```
  DATABASE_URL=postgresql://user:password@host:port/database
  ```
```

#### 1-2. Next.js 프로젝트 카페24 호스팅 준비 (2-3일)
```
할일:
□ package.json 수정
  - 카페24 지원 버전 확인
  - 필요한 의존성 검토

□ next.config.ts 수정
  ```typescript
  const nextConfig: NextConfig = {
    // Vercel 특화 기능 제거
    // 국내 호스팅에 맞는 설정
    output: 'standalone', // 중요: 독립형 빌드
  };
  ```

□ 빌드 및 배포 파일 생성
  - Dockerfile (필요시)
  - docker-compose.yml (필요시)
  - 배포 스크립트

□ 환경변수 관리
  - 개발 환경 (.env.local)
  - 프로덕션 환경 (카페24 관리자 패널)
```

#### 1-3. 인증 시스템 초기 구축 (2-3일)
```
선택지:
A) Auth0 (추천)
   장점: 국정원 인증 문제 없음, 통합 용이
   단점: 유료 (월 $0~50)
   소요시간: 2-3일

B) Firebase Auth (대안)
   장점: 무료, 사용 중일 수 있음
   단점: 글로벌 서비스 (국정원 인증 재검토 필요)
   소요시간: 2-3일

C) 자체 구현 (위험)
   장점: 완전 통제, 국내 서비스
   단점: 보안 복잡도 높음, 개발 시간 많음
   소요시간: 7-10일

추천: Auth0 선택

할일:
□ Auth0 가입
□ 애플리케이션 생성
□ 권한(Permission) 설정
□ Callback URL 설정
□ NextAuth.js 통합 (또는 Auth0 SDK)
```

---

### **Phase 2: 핵심 기능 개발 (10-15일)**

#### 2-1. API 레이어 재구축 (3-5일)
```
변경 사항:

기존 (Supabase):
  const { data } = await supabase
    .from('aed_devices')
    .select('*')

변경 (PostgreSQL):
  // 방법 1: Raw SQL (node-postgres)
  const result = await pool.query('SELECT * FROM aed_devices');

  // 방법 2: ORM (Prisma - 추천)
  const devices = await prisma.aedDevice.findMany();

할일:
□ Prisma 또는 TypeORM 설정
  ```bash
  npm install @prisma/client prisma
  npx prisma init
  ```

□ 데이터베이스 스키마 정의 (schema.prisma)
  - aed_devices
  - inspections
  - users
  - schedules
  - 등등

□ 마이그레이션 파일 생성
  ```bash
  npx prisma migrate dev --name init
  ```

□ API Routes 수정
  - /api/aed-data/route.ts
  - /api/inspections/route.ts
  - 등등
```

#### 2-2. 파일 스토리지 구현 (2-3일)
```
옵션:

A) 로컬 스토리지 (간단)
   - 카페24 웹 스페이스 활용
   - /public/uploads 활용

B) NCP Object Storage (추천)
   - AWS S3 호환
   - 별도 비용: 월 10,000원~

C) NAS (기존 보유 시)
   - 기존 인프라 활용
   - 별도 비용: 0원

추천: A) 로컬 스토리지 먼저 구현 (간단)

할일:
□ multer 설정
  ```bash
  npm install multer
  ```

□ 파일 업로드 API 생성
  /api/upload

□ 파일 관리 로직
  - 파일 검증
  - 크기 제한
  - 삭제 처리
```

#### 2-3. 주요 페이지 개발 (5-7일)
```
우선순위 순서:

1순위 (필수 - 3-4일):
  □ 로그인 / 회원가입 페이지
  □ AED 데이터 목록 페이지
  □ 점검 일정 관리 페이지

2순위 (필요 - 2-3일):
  □ 현장 점검 페이지
  □ 점검 보고서 페이지
  □ 지도 (선택사항)

3순위 (부가 - 나중):
  □ 통계/분석
  □ 사용자 관리
  □ 시스템 설정
```

---

### **Phase 3: 통합 및 테스트 (5-7일)**

#### 3-1. 데이터 마이그레이션 (1-2일)
```
현재 상황:
- 기존 데이터는 중요하지 않음 (매일 업로드)
- Python 스크립트가 있음

할일:
□ Python 스크립트 분석
  - 데이터 소스 (내부 시스템)
  - 업로드 로직
  - 스케줄 (매일?)

□ 새 PostgreSQL에 맞춰 수정
  ```python
  # 기존: Supabase 업로드
  supabase.table('aed_data').insert(records)

  # 변경: PostgreSQL 업로드
  pg_connection.execute(
    "INSERT INTO aed_data (...) VALUES (...)",
    records
  )
  ```

□ 첫 데이터 로드 테스트
```

#### 3-2. 통합 테스트 (2-3일)
```
테스트 항목:

□ 인증 플로우
  - 회원가입
  - 로그인
  - 로그아웃
  - 권한 확인

□ 주요 기능
  - AED 데이터 조회
  - 점검 일정 추가
  - 점검 보고서 생성
  - 파일 업로드/다운로드

□ 성능 테스트
  - 응답 시간 (목표: < 2초)
  - 동시 사용자 (목표: 100명 이상)
  - 데이터베이스 쿼리 최적화

□ 보안 테스트
  - SQL Injection 방지 (Prisma 사용)
  - XSS 방지
  - CSRF 방지
  - RLS (필요시 구현)
```

#### 3-3. 카페24 배포 준비 (2-3일)
```
할일:
□ 프로덕션 환경 설정
  - 환경변수 설정
  - 데이터베이스 백업 정책
  - 모니터링 설정

□ 성능 최적화
  - 이미지 최적화 (next/image)
  - 코드 스플리팅
  - 캐시 전략

□ 배포 스크립트
  ```bash
  # 빌드
  npm run build

  # 카페24에 배포
  # (카페24 FTP 또는 Git 연동)
  ```

□ DNS 설정
  - 도메인 → 카페24 서버 연결
```

---

### **Phase 4: 국정원 인증 (3-5일)**

#### 4-1. 인증 준비 (1-2일)
```
할일:
□ 필요 서류 준비
  - 신청서
  - 사이트 소개서
  - 이용약관, 개인정보처리방침
  - 보안 점검 결과

□ 사이트 심사 준비
  - 보안 점검 실시
  - 취약점 제거
  - 로그 기록 설정

□ 카페24 기술 지원팀 상담
  - 국정원 인증 프로세스 확인
  - 필요한 요구사항 정리
```

#### 4-2. 인증 신청 (3-5일)
```
프로세스:
1. 국정원에 신청서 제출
2. 초기 검토 (1-2일)
3. 현장 점검 (1-2일) - 필요시
4. 최종 인증 (1-2일)
5. 인증서 발급

주의사항:
- 인증 중에는 사이트 변경 금지
- 인증 담당자와 지속 소통
- 지연 시 연락 (5영업일 이상)
```

---

### **Phase 5: 프로덕션 운영 (지속)**

#### 5-1. 모니터링 (지속)
```
할일:
□ 로그 모니터링
  - 에러 로그 확인
  - 접근 로그 분석

□ 성능 모니터링
  - 응답 시간 추적
  - 데이터베이스 쿼리 분석
  - 서버 리소스 사용량

□ 백업 관리
  - 일일 자동 백업
  - 백업 검증
  - 복구 테스트
```

#### 5-2. 지속적 개선 (지속)
```
할일:
□ 사용자 피드백 수집
□ 버그 수정
□ 성능 최적화
□ 기능 추가
```

---

## 📊 예상 일정 및 마일스톤

```
Week 1 (5-7일): Phase 0-1
├─ 카페24 환경 구성
├─ 코드 분석
└─ 새 프로젝트 초기화

Week 2 (5-7일): Phase 1-2 전반
├─ PostgreSQL 연결
├─ 호스팅 환경 준비
└─ 인증 시스템 초기 구축

Week 3 (5-7일): Phase 2-3 전반
├─ API 레이어 재구축
├─ 파일 스토리지 구현
└─ 주요 페이지 개발

Week 4 (5-7일): Phase 3 후반
├─ 데이터 마이그레이션
├─ 통합 테스트
└─ 배포 준비

Week 5 (3-5일): Phase 4
├─ 카페24 배포
├─ 인증 준비
└─ 국정원 인증 신청

예상 총 기간: **4-5주**

---

## ⚠️ 주의사항

### 1. Supabase 의존도 제거
```
현재 문제가 될 부분:
□ Supabase RLS (행 단위 보안)
   → 애플리케이션 레벨에서 구현 필요

□ Supabase Realtime (실시간)
   → WebSocket 또는 Socket.io 구현 필요
   → 또는 폴링(Polling) 구현

□ Supabase 벡터 검색 (pgvector)
   → 필요 시 PostgreSQL에 pgvector 확장 설치

□ Supabase Storage
   → 로컬 또는 S3 호환 스토리지로 전환
```

### 2. 카페24 제약사항
```
확인 필요:
□ Node.js 버전 (현재 Next.js 15 지원하는가?)
□ PostgreSQL 버전 (14 이상 권장)
□ 스토리지 용량 (파일 업로드량 고려)
□ 대역폭 (사용자 수 고려)
□ 백업 정책 (자동 백업 여부)
□ SSL 인증서 (무료 Let's Encrypt 지원?)
□ 기술 지원 (24/7 인가?)
```

### 3. 데이터 무결성
```
유의사항:
- Python 스크립트가 매일 업로드하므로
- 스크립트 수정 후 충분한 테스트 필요
- 업로드 중 서버 다운 시 재시도 로직 필요
- 중복 데이터 처리 로직 필요
```

### 4. 성능 고려사항
```
현재:
- Vercel: 자동 CDN, 글로벌 최적화
- Supabase: 관리형 DB, 자동 최적화

변경 후:
- 카페24: 단일 서버 (스케일링 제한)
- PostgreSQL: 수동 최적화 필요

대응 방안:
□ 인덱스 전략 수립
□ 쿼리 최적화
□ 캐싱 전략 (Redis 고려)
□ 이미지 최적화
□ 코드 스플리팅
```

---

## 📝 현재 AED_check2025에서 가져올 파일들

```
src/components/
  ├─ ui/ (기본 UI 컴포넌트)
  ├─ inspection/ (점검 관련 컴포넌트)
  ├─ aed/ (AED 관련 컴포넌트)
  └─ 기타 공통 컴포넌트

src/lib/
  ├─ utils/ (유틸리티 함수들)
  ├─ constants/ (상수들)
  ├─ hooks/ (Custom hooks)
  └─ 기타 헬퍼 함수들

src/styles/ (스타일시트)
  └─ globals.css, tailwind 설정 등

package.json (의존성)
  - 필요한 라이브러리만 선택

tsconfig.json (TypeScript 설정)
타일윈드 설정
ESLint 설정

제외할 것:
✗ Supabase 관련 코드
✗ Vercel 특화 설정
✗ 환경변수 (.env 파일들)
✗ node_modules
✗ .next (빌드 결과)
```

---

## 🚀 시작하기

1. **폴더 생성**
   ```bash
   mkdir -p /Users/kwangsunglee/Projects/AEDpics
   ```

2. **프로젝트 초기화**
   ```bash
   cd /Users/kwangsunglee/Projects/AEDpics
   npx create-next-app@latest aed-check-system
   ```

3. **Git 저장소 초기화**
   ```bash
   cd aed-check-system
   git init
   git add .
   git commit -m "Initial commit: AEDpics project setup"
   ```

4. **카페24 가입 및 준비**
   - https://www.cafe24.com/ 방문
   - 기술 지원팀에 다음 확인:
     - Node.js 최신 버전 지원 여부
     - PostgreSQL 연동 방법
     - 배포 프로세스

5. **Phase 0 완료 후 다음 단계 진행**

---

## 📞 주요 연락처

- 카페24 고객센터: 1644-2100
- 카페24 기술 지원: 이메일 또는 채팅
- 국정원 인증: 국정원 정보보호과

---

**마지막 업데이트:** 2025-01-23
**상태:** 계획 수립 완료, 즉시 Phase 0 시작 가능
