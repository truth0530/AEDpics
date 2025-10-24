# AEDpics - Cafe24 기반 자동심장충격기(AED) 관리 시스템

## 📋 개요

AEDpics는 자동심장충격기(AED)의 위치, 상태, 점검 이력을 효과적으로 관리하는 웹 기반 시스템입니다.
**Cafe24 + PostgreSQL** 기반으로 구축되어 국정원 인증을 목표로 하고 있습니다.

## 🎯 프로젝트 목표

- ✅ **국내 서버 기반**: Cafe24 호스팅 (해외 서버 제약 극복)
- ✅ **국정원 인증**: 정보보안 기준 준수
- ✅ **완전한 기능성**: AED 위치, 점검, 할당 관리
- ✅ **확장 가능성**: JWT 기반 인증, Prisma ORM

## 📁 프로젝트 구조

```
AEDpics/
├── aed-check-system/          # 메인 Next.js 애플리케이션
│   ├── app/                   # Next.js App Router
│   │   ├── api/               # 44개 API 엔드포인트
│   │   │   ├── auth/          # 인증 관련
│   │   │   ├── aed-data/      # AED 데이터 조회
│   │   │   ├── cron/          # 정기 작업 (GPS 분석)
│   │   │   └── ...
│   │   └── (authenticated)/   # 인증된 페이지
│   ├── components/            # React 컴포넌트
│   ├── lib/                   # 유틸리티, 인증, 타입
│   ├── prisma/                # Prisma ORM 스키마
│   ├── public/                # 정적 자산
│   └── package.json
├── MIGRATION_PLAN_CAFE24.md   # Cafe24 마이그레이션 계획
├── CAFE24_SIGNUP_GUIDE.md     # Cafe24 가입 및 설정 가이드
└── README.md                  # 이 파일
```

## 🚀 기술 스택

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **UI**: React + TypeScript
- **스타일**: Tailwind CSS
- **UI 컴포넌트**: shadcn/ui

### Backend
- **런타임**: Node.js (Vercel Edge Runtime)
- **API**: Next.js API Routes
- **ORM**: Prisma
- **인증**: JWT (HttpOnly Cookies)
- **데이터베이스**: PostgreSQL (Cafe24)

### DevOps
- **호스팅**: Cafe24 (또는 Vercel - 임시)
- **배포**: Git Push → 자동 배포
- **환경 변수**: .env.local

## 🔐 보안 아키텍처

### 인증 & 인가
```
Request (Cookie with JWT)
  → verifyToken()
    → UserProfile 조회
      → 역할 기반 접근 제어 (RBAC)
        → 조직 기반 접근 제어 (OBAC)
          → API 실행
```

### 감시 & 감사
- 모든 데이터 접근 로그 기록 (audit_log 테이블)
- 사용자 행동 추적
- IP 주소, 타임스탬프 저장

## 📊 API 현황

**총 44개 API - 100% 마이그레이션 완료** ✅

### 카테고리별
| 카테고리 | 개수 | 상태 |
|---------|------|------|
| 인증 | 8개 | ✅ 완료 |
| AED 데이터 | 12개 | ✅ 완료 |
| 점검 & 할당 | 6개 | ✅ 완료 |
| 외부 시스템 | 3개 | ✅ 완료 |
| Cron Jobs | 4개 | ✅ 완료 |
| 관리자 | 6개 | ✅ 완료 |
| 기타 | 5개 | ✅ 완료 |

## 🛠️ 설정 및 실행

### 사전 요구사항
- Node.js 18+
- PostgreSQL 13+
- npm 또는 yarn

### 설치

```bash
# 저장소 복제
git clone https://github.com/YourOrg/AEDpics.git
cd AEDpics/aed-check-system

# 의존성 설치
npm install

# 데이터베이스 마이그레이션
npx prisma migrate deploy

# 개발 서버 시작
npm run dev
```

### 환경 변수 설정

```bash
# .env.local 생성
cat > .env.local << 'EOF'
# 데이터베이스
DATABASE_URL="postgresql://user:password@localhost:5432/aedpics"

# JWT
JWT_SECRET="your-secret-key-here"
JWT_EXPIRATION="7d"

# Cafe24
NEXT_PUBLIC_SITE_URL="https://your-domain.com"

# 외부 API
CRON_SECRET="your-cron-secret"

# 선택사항
NEXT_PUBLIC_ANALYTICS_ID=""
EOF
```

## 🔄 마이그레이션 진행 상황

### Phase 1-2: 완료 ✅
- JWT 인증 구현
- Prisma 스키마 정의
- 기본 사용자 관리

### Phase 3: 완료 ✅
- **44개 모든 API Supabase → Prisma 변환**
- 디버그 API 4개
- 중간 복잡도 API 5개
- 높은 복잡도 API 3개 (aed-data, external-mapping, gps-analysis)
- 기타 32개

### Phase 4: 진행 중 ⏳
- 통합 테스트
- 성능 벤치마킹
- Cafe24 환경 구성

### Phase 5: 계획 중 📅
- 국정원 인증 신청
- 프로덕션 배포
- 모니터링 & 운영

## 📖 주요 API

### 인증
```bash
POST /api/auth/signup          # 회원가입
POST /api/auth/login           # 로그인
POST /api/auth/logout          # 로그아웃
GET  /api/auth/me              # 현재 사용자 정보
```

### AED 데이터
```bash
GET  /api/aed-data             # AED 목록 (필터, 페이지네이션)
GET  /api/aed-data/priority    # 우선순위 목록
GET  /api/public/aed-locations # 공개 AED 위치 (지도용)
```

### 점검
```bash
GET  /api/inspections          # 점검 이력
POST /api/inspections          # 점검 시작
PUT  /api/inspections/:id      # 점검 완료
```

### 관리
```bash
GET  /api/admin/users          # 사용자 목록
PATCH /api/admin/users/:id     # 사용자 승인/거절
```

## 🧪 테스트

```bash
# 단위 테스트
npm run test

# 통합 테스트
npm run test:integration

# E2E 테스트 (Playwright)
npm run test:e2e

# 커버리지
npm run test:coverage
```

## 📈 성능 최적화

### 데이터베이스
- Prisma 쿼리 최적화 (선택적 필드 조회)
- 인덱스 추가 (자주 검색되는 필드)
- 연결 풀링 (PgBouncer)

### 캐싱
- CDN 캐싱 (s-maxage, stale-while-revalidate)
- Redis 캐싱 (세션, API 응답)
- 브라우저 캐싱

### API
- 페이지네이션 (커서 기반)
- 선택적 필드 로딩
- 병렬 쿼리 (Promise.all)

## 🔍 모니터링

### 로그
- 접근 로그 (access_log)
- 감사 로그 (audit_log)
- 오류 로그 (error_log)

### 메트릭
- 응답 시간
- 에러율
- QPS (초당 쿼리 수)

## 📚 문서

- [Cafe24 마이그레이션 계획](./MIGRATION_PLAN_CAFE24.md) - 상세 로드맵
- [Cafe24 가입 가이드](./CAFE24_SIGNUP_GUIDE.md) - 단계별 설정
- [API 문서](./aed-check-system/docs/API.md) - API 상세 문서
- [데이터베이스](./aed-check-system/docs/DATABASE.md) - 스키마 설명

## 🤝 기여

1. 이 저장소를 Fork합니다
2. Feature 브랜치를 생성합니다 (`git checkout -b feature/amazing-feature`)
3. 변경사항을 커밋합니다 (`git commit -m 'Add amazing feature'`)
4. 브랜치를 Push합니다 (`git push origin feature/amazing-feature`)
5. Pull Request를 생성합니다

## 📝 라이센스

본 프로젝트는 MIT 라이센스를 따릅니다.

## ❓ 문의

- 문제 리포팅: [GitHub Issues](https://github.com/YourOrg/AEDpics/issues)
- 이메일: support@aedpics.com

## 🙏 감사의 말

이 프로젝트는 다음의 오픈소스 프로젝트를 기반으로 합니다:
- [Next.js](https://nextjs.org/)
- [Prisma](https://www.prisma.io/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)

---

**마지막 업데이트**: 2025년 10월 24일
**버전**: 1.0.0 (Phase 3 완료)
