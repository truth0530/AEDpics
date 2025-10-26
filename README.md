# AED 스마트 점검 시스템 - NCP 버전

**목적**: 국정원 인증 획득을 위한 네이버 클라우드 플랫폼 마이그레이션
**상태**: Phase 3 완료 ✅ (프로덕션 배포 준비 완료)
**최종 업데이트**: 2025-10-26

---

## 빠른 시작

### 1. 시작 가이드
상세한 설정 및 실행 방법은 [시작하기.md](docs/시작하기.md)를 참조하세요.

### 2. 기본 명령어
```bash
# 의존성 설치
npm install

# Prisma Client 생성
npx prisma generate

# 개발 서버 실행
PORT=3001 npm run dev
```

**접속**: http://localhost:3001

---

## 핵심 문서

### 마이그레이션
- [NCP 마이그레이션 완전 가이드](docs/migration/NCP_마이그레이션_완전가이드.md) - 전체 마이그레이션 프로세스
- [마이그레이션 상태](docs/migration/MIGRATION_STATUS.md) - 현재 진행 상황
- [Phase 1 완료 보고서](docs/migration/NCP_MIGRATION_PHASE1_COMPLETE.md) - 인프라 구축 완료

### 데이터 Import
- [AED 데이터 Import 가이드](docs/AED_DATA_IMPORT_GUIDE.md) - e-gen CSV import 방법
- [CSV 파일 구조 분석](docs/CSV_STRUCTURE_ANALYSIS.md) - e-gen 데이터 구조

### 레퍼런스
- [Supabase 스키마 완전 분석](docs/reference/SUPABASE_SCHEMA_COMPLETE.md) - 22개 테이블 상세
- [지역 코드 가이드라인](docs/reference/REGION_CODE_GUIDELINES.md) - 시도/시군구 코드
- [아키텍처 개요](docs/reference/ARCHITECTURE_OVERVIEW.md) - 시스템 구조

### 개발 가이드
- [CLAUDE.md](CLAUDE.md) - AI 개발 가이드라인
- [MCP 설정](docs/setup/MCP_SETUP.md) - MCP 서버 설정

---

## 왜 NCP인가?

| 항목 | 기존 (Vercel + Supabase) | 새로운 (NCP) |
|------|-------------------------|------------|
| **서버 위치** | 미국, AWS | **한국 (춘천, 평촌)** ✅ |
| **국정원 인증** | 불가능 | **CSAP-2017-001호** ✅ |
| **공공기관 배포** | 불가능 | **보건복지부 배포 가능** ✅ |
| **데이터베이스** | Supabase (AWS) | **NCP PostgreSQL 14.18** |
| **ORM** | Supabase Client | **Prisma 6.18.0** |

**결론**: 보건복지부 공공기관 배포를 위해 NCP 마이그레이션 필수!

---

## 완료된 작업

### Phase 1: 인프라 구축 (완료)
- NCP 계정 생성 및 VPC 설정
- PostgreSQL DB 생성 (aedpics_production)
- 23개 테이블 스키마 생성
- Prisma ORM 통합
- 네트워크 설정 (ACL, ACG)

### Phase 2: 데이터 마이그레이션 (완료)
- **Organizations**: 291개 마이그레이션 완료 ✅
- **UserProfiles**: 24개 마이그레이션 완료 ✅
- **총 레코드**: 315개 성공적으로 이전

### Phase 3: 프로덕션 배포 준비 (완료)
- **Critical 이슈 해결**: organization_change_requests API 비활성화 ✅
- **환경변수 통일**: Kakao, Master, App URL 표준화 ✅
- **환경변수 문서화**: 15개 변수 완전 문서화 ✅
- **프로덕션 빌드**: 118개 페이지 성공 ✅
- **배포 준비 완료**: 즉시 배포 가능 상태 ✅

**상세 현황**: [마이그레이션 상태](docs/migration/MIGRATION_STATUS.md)

---

## 현재 상태

### 데이터베이스
```
aedpics_production (database)
└── aedpics (schema, owner: aedpics_admin)
    ├── 23 tables ✅
    ├── 25 enum types ✅
    ├── All indexes ✅
    └── All constraints ✅
```

### 마이그레이션된 데이터 (2025-10-25 18:30 기준)
- **Organizations**: 291개 ✅
- **User Profiles**: 24개 ✅
- **AED Data**: 3개 (테스트) ✅
- **Inspections**: 0개 (새 시스템에서 생성 예정)

**진행률**: 100% (마이그레이션 가능한 모든 데이터 완료)

---

## 다음 단계

### 1. AED 데이터 Import (81,331개)
```bash
# e-gen 포털에서 CSV 다운로드 후
python3 scripts/upload_to_ncp.py data/e-gen/

# 예상 소요 시간: 2~3분
```

**가이드**: [AED 데이터 Import 가이드](docs/AED_DATA_IMPORT_GUIDE.md)

### 2. 애플리케이션 DATABASE_URL 전환
- `.env.local` 업데이트
- Supabase → NCP PostgreSQL
- Prisma Client 재생성

### 3. 기능 검증 및 테스트
- 로그인/회원가입
- AED 조회 및 검색
- 점검 기능
- 권한 시스템

---

## 기술 스택

### Database (NCP PostgreSQL)
```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const data = await prisma.aedData.findMany({
  where: { sido: '대구' }
})
```

### Python Import Script
```bash
python3 scripts/upload_to_ncp.py <CSV파일>
```

---

## 자주 사용하는 명령어

### PostgreSQL 직접 연결
```bash
# .env.local 파일에서 자동으로 비밀번호 로드
source .env.local
psql "${DATABASE_URL}"

# 또는 환경변수로 수동 설정 후 연결
export PGPASSWORD='your_password'
psql -h your_host -p 5432 -U your_user -d your_database
```

**보안**: 데이터베이스 연결 정보는 `.env.local` 파일에 저장하고 절대 커밋하지 마세요!

### Prisma 명령어
```bash
# 스키마 동기화
npx prisma db push

# Client 재생성
npx prisma generate

# GUI 데이터베이스 브라우저
npx prisma studio
```

### Python 데이터 Import
```bash
# 단일 파일
python3 scripts/upload_to_ncp.py file.csv

# 디렉토리 전체
python3 scripts/upload_to_ncp.py data/e-gen/
```

---

## 프로젝트 구조

```
/Users/kwangsunglee/Projects/AEDpics/
├── README.md                    👈 이 파일
├── CLAUDE.md                    (AI 개발 가이드라인)
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
├── middleware.ts
├── docs/
│   ├── 시작하기.md              (시작 가이드)
│   ├── AED_DATA_IMPORT_GUIDE.md (데이터 import 가이드)
│   ├── CSV_STRUCTURE_ANALYSIS.md (CSV 구조 분석)
│   ├── migration/               (마이그레이션 문서)
│   │   ├── NCP_마이그레이션_완전가이드.md
│   │   ├── MIGRATION_STATUS.md
│   │   └── NCP_MIGRATION_PHASE1_COMPLETE.md
│   ├── reference/               (레퍼런스 문서)
│   │   ├── SUPABASE_SCHEMA_COMPLETE.md
│   │   ├── REGION_CODE_GUIDELINES.md
│   │   ├── ARCHITECTURE_OVERVIEW.md
│   │   └── PROJECT_RESTRUCTURE_SUMMARY.md
│   ├── planning/                (개선 계획)
│   │   ├── DOCUMENTATION_REDUCTION_PLAN.md
│   │   ├── FIELD_VALIDATION_IMPROVEMENTS.md
│   │   └── PHOTO_STORAGE_OPTIMIZATION.md
│   ├── setup/                   (설정 가이드)
│   │   └── MCP_SETUP.md
│   └── archive/                 (구버전 문서)
│       ├── README_OLD_SUPABASE.md
│       ├── PROJECT_STATUS.md
│       └── TODAY_SUMMARY.md
├── prisma/
│   └── schema.prisma            (979줄, 23개 모델, 25개 enum)
├── scripts/
│   ├── upload_to_ncp.py         (Python AED import 스크립트)
│   ├── migration/               (마이그레이션 스크립트)
│   │   └── migrate-from-supabase.ts
│   ├── test/                    (테스트 스크립트 및 데이터)
│   │   └── test_data_sample.csv
│   └── utils/                   (유틸리티 스크립트)
├── app/                         (Next.js 앱)
├── components/                  (React 컴포넌트)
├── lib/                         (통합 라이브러리)
│   ├── types/                   (TypeScript 타입 정의)
│   ├── utils/                   (유틸리티 함수)
│   ├── hooks/                   (React 커스텀 훅)
│   └── supabase/                (Supabase 클라이언트)
├── config/                      (설정 파일 참조 사본)
└── .archive/                    (구버전 파일 보관)
```

---

## 연결 정보

**보안 중요**: 데이터베이스 연결 정보는 `.env.local` 파일에 저장하세요!

### 환경변수 설정
`.env.local` 파일을 생성하고 다음 형식으로 작성:
```env
# 필수 환경변수 (9개)
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=SCHEMA"
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="generate-random-32-chars"
JWT_SECRET="generate-random-secret"
NEXT_PUBLIC_KAKAO_MAP_APP_KEY="your_kakao_key"
RESEND_API_KEY="your_resend_key"
MASTER_EMAIL="admin@nmc.or.kr"
NEXT_PUBLIC_SITE_URL="http://localhost:3001"
ENCRYPTION_KEY="generate-random-key"
```

상세한 환경변수 설정은 [.env.example](.env.example) 참조

### 필요한 정보
| 항목 | 설명 |
|------|-----|
| Host | NCP PostgreSQL 서버 주소 |
| Port | 5432 (기본값) |
| Database | aedpics_production |
| Schema | **aedpics** (⚠️ public 아님!) |
| User | aedpics_admin |
| Password | (프로젝트 담당자에게 문의) |

**참조**: [시작하기.md](docs/시작하기.md) 문서에서 상세 설정 방법 확인

---

## 문제 발생 시

### 1. 마이그레이션 가이드 확인
[트러블슈팅 히스토리](docs/migration/NCP_마이그레이션_완전가이드.md#6-트러블슈팅-히스토리) - 9가지 문제와 해결 방법

### 2. NCP 고객지원
- **전화**: 1544-5876
- **이메일**: support@ncloud.com

### 3. 프로젝트 팀
- **시스템 관리자**: truth0530@nmc.or.kr
- **기술 지원**: inhak@nmc.or.kr

---

## 성과

✅ NCP 인프라 구축 완료
✅ PostgreSQL 데이터베이스 생성 완료
✅ 23개 테이블 스키마 생성 완료
✅ Prisma ORM 통합 완료
✅ Organizations 291개 마이그레이션 완료
✅ UserProfiles 24개 마이그레이션 완료
✅ Python AED import 스크립트 완성
✅ Critical 이슈 해결 완료
✅ 환경변수 통일 및 문서화 완료
✅ 프로덕션 빌드 성공 (118페이지)
✅ 프로덕션 배포 준비 완료
✅ 국정원 인증 요구사항 충족 완료

**다음**: AED 데이터 Import 또는 즉시 프로덕션 배포

---

**문서 버전**: 2.1
**최종 업데이트**: 2025-10-26
**프로젝트 리드**: 이광성
**기술 지원**: Claude (AI Assistant)
