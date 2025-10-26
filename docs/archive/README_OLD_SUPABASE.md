# AED 스마트 점검 시스템

전국 자동심장충격기(AED) 통합 점검 관리 시스템

## 🔒 보안 정책: 도메인 기반 역할 검증 (중요)

**CRITICAL**: 이메일 도메인과 역할이 반드시 일치해야 합니다.

| Email Domain | Allowed Roles | Organization | Access Scope |
|--------------|---------------|--------------|--------------|
| **@nmc.or.kr** | `emergency_center_admin`<br>`regional_emergency_center_admin` | 중앙응급의료센터<br>17개 시도 응급의료지원센터 | 전국 |
| **@korea.kr** | `ministry_admin`<br>`regional_admin`<br>`local_admin` | 보건복지부<br>17개 시도청<br>보건소 | 전국<br>소속 시도<br>소속 시군구 |
| **Other domains** | `temporary_inspector` | 임시 점검원 | 할당된 장비만 |

### 접근 거부 시나리오

다음의 경우 즉시 `[ACCESS_DENIED]` 에러가 발생하며 접근이 차단됩니다:

- ❌ `regional_admin@gmail.com` - @korea.kr 도메인만 regional_admin 가능
- ❌ `local_admin@naver.com` - @korea.kr 도메인만 local_admin 가능
- ❌ `emergency_center_admin@korea.kr` - @korea.kr 도메인은 ministry/regional/local_admin만 가능
- ❌ `temporary_inspector@korea.kr` - 정부 도메인 사용자는 관리자 역할 필수

**구현**: [lib/auth/access-control.ts](lib/auth/access-control.ts) - `resolveAccessScope()` 함수
**테스트**: [tests/auth/domain-verification.test.ts](tests/auth/domain-verification.test.ts) - 38개 테스트 통과
**감사**: [scripts/audit-user-domain-mismatch.sql](scripts/audit-user-domain-mismatch.sql) - 기존 계정 검사

**보안 논리**:
- 이메일 도메인이 사용 가능한 역할을 **결정**합니다
- @nmc.or.kr → 응급센터 관리자만
- @korea.kr → 정부기관 관리자만
- 기타 도메인 → temporary_inspector만
- master 역할은 모든 도메인 허용 (시스템 최고 관리자)

**상세 문서**:
- [region-code-policy-comparison.md](docs/analysis/region-code-policy-comparison.md) - 도메인 검증 계획 및 분석
- [aed-data-access-rules.md](docs/security/aed-data-access-rules.md) - 운영 매뉴얼

## 📚 프로젝트 문서 목차

### 핵심 문서
- [README.md](README.md) - 프로젝트 개요 및 시작 가이드 (현재 문서)
- [CLAUDE.md](CLAUDE.md) - AI 개발 가이드라인 및 체크리스트
- [REGION_CODE_GUIDELINES.md](REGION_CODE_GUIDELINES.md) - ⭐ **지역 코드 관리 가이드라인 (필독!)**
- [docs/AED_COMPREHENSIVE_IMPLEMENTATION_PLAN.md](docs/AED_COMPREHENSIVE_IMPLEMENTATION_PLAN.md) - 통합 구현 계획
- [docs/current/CURRENT_STATUS.md](docs/current/CURRENT_STATUS.md) - 프로젝트 현재 상황

### 기술 문서
- [docs/reference/ARCHITECTURE_OVERVIEW.md](docs/reference/ARCHITECTURE_OVERVIEW.md) - 시스템 아키텍처
- [supabase/README.md](supabase/README.md) - 데이터베이스 통합 관리
- [docs/reference/QUICK_START_GUIDE.md](docs/reference/QUICK_START_GUIDE.md) - 빠른 시작 가이드

## 프로젝트 현황 (2025-10-08) - Inspection 시스템 개선 완료

### ⚠️ 중요 공지: 임시 기술 부채
**Vercel 배포를 위해 일시적으로 코드 검증을 비활성화한 상태입니다.**
- 📄 상세 설명: [docs/current/TECHNICAL_DEBT.md](docs/current/TECHNICAL_DEBT.md)
- 이유: Stage 2 실시간 기능 개발 중 타입 정의 미완성
- 계획: Stage 2 완료 후 즉시 정상화 (2주 내)

### 현재 완성도: Stage 2 (85% 완료)
- ✅ **Stage 1 MVP**: 즉시 점검, 일정 추가, 역할 기반 UI (100%)
- ✅ **Stage 2 Sprint 1**: 팀 대시보드 UI 구현 완료 (100%)
- ✅ **Stage 2 Sprint 2**: Realtime 동기화, 오프라인 큐, Service Worker (100%)
- ✅ **Stage 2 Sprint 3**: Inspection 페이지 3개 탭 구조 완료 (100%)
  - 점검 예정/점검 완료/모든 점검 탭 분리
  - inspection_status 기반 상태 관리 (scheduled/in_progress/completed/failed)
  - 일정추가 데이터만 표시 필터링
  - 모드 필터링 및 UX 개선
- 🔄 **Stage 2 Sprint 4**: 알림 시스템 및 데이터 분석 (진행중 - 30%)
- ⏳ **Stage 3**: 고급 기능 (대량 작업, 보고서, 검색)
- ⏳ **Stage 4**: 전국 배포 준비



→ **통합 계획**: [AED 통합 계획](docs/AED_COMPREHENSIVE_IMPLEMENTATION_PLAN.md)
→ **현재 상황**: [프로젝트 현황](docs/current/CURRENT_STATUS.md)
→ **빠른 시작**: [Quick Start Guide](docs/reference/QUICK_START_GUIDE.md)

## 빠른 시작

### 로컬 개발
```bash
# 의존성 설치
npm install

# 개발 서버 시작
npm run dev

# 빌드 테스트
npm run build
```

### 접속 URL
- **프로덕션**: https://aed-check-system.vercel.app
- **프레젠테이션**: https://aed-check-system.vercel.app/presentation.html
- **로컬**: http://localhost:3000

## 프로젝트 문서 체계

### 핵심 문서
- [개발 가이드라인](CLAUDE.md) - AI 개발 지침 및 체크리스트
- [시스템 구축 계획](docs/build.md) - 12주 MVP 마스터 플랜
- [인증 시스템 설계](docs/auth-plan.md) - 권한 체계 상세 설계
- [마스터 TODO](docs/archive/INDEX.md) - 전체 작업 진행 현황

### 설정 가이드
- [통합 설정 가이드](docs/setup-instructions.md) - 프로젝트 설정 통합 문서
- [데이터베이스 관리](supabase/README.md) - Supabase DB 통합 관리
- [데이터베이스 분석](docs/database-schema-analysis.md) - 스키마 상세 분석

### 기타 문서
- [회원가입 개선](docs/signup-improvement-plan.md) - UX 개선 계획
- [카카오맵 설정](docs/kakao-map-setup.md) - 지도 API 설정
- [프레젠테이션](https://aed-check-system.vercel.app/presentation.html) - 시스템 소개

## 시스템 개요

- **목적**: 전국 260여개 보건소의 AED 점검 업무 효율화 및 관리 체계화
- **대상**: 보건복지부, 중앙응급의료센터, 시도 및 보건소 담당자
- **규모**: 전국 81,331대 AED 관리 (2025년 9월 기준)

## 주요 기능

### 1. 2단계 검증 체계
- **1차 점검**: 관리책임자의 월간 정기 점검
- **2차 검증**: 보건소 담당자의 현장 검증
- **자동화**: 점검 데이터 자동 수집 및 이상 패턴 탐지

### 2. 3단계 가입 프로세스
1. 이메일 인증 (정부기관 @korea.kr, NMC @nmc.or.kr 또는 개인 이메일)
2. 프로필 설정 및 소속 정보 입력
3. 관리자 승인

### 3. 권한 체계
- `master`: 시스템 최고 관리자
- `emergency_center_admin`: 중앙응급의료센터 및 17개 시도 응급의료지원센터 (@nmc.or.kr)
- `ministry_admin`: 보건복지부
- `regional_admin`: 시도 담당자 (시청/도청)
- `local_admin`: 보건소 담당자
  - 주소 기준 조회: 소속 지역에 설치된 AED
  - 관할보건소 기준 조회: 관리하는 모든 AED (타 지역 포함)

### 4. 튜토리얼 시스템
- 대화형 점검 시뮤레이션
- 모바일/데스크톱 뷰 전환
- 실시간 점검 항목 검증
- GPS 위치 확인 및 수정
- **GPS 좌표 이상 자동 탐지 및 경고**

### 5. 시각화 및 대시보드
- 전국 시도별 점검 현황
- 실시간 통계 표시
- 우선순위 기반 알림
- KakaoMap 통합 지도 기능
- **GPS 이상 데이터 필터링 및 표시**

### 6. GPS 좌표 이상 탐지 시스템
- 디폴트 좌표 자동 감지
- 주소-좌표 불일치 검사
- 이상치 및 클러스터 분석
- 매일 새벽 2시 자동 분석 (Vercel Cron)
- 우선순위 관리에 '좌표값 이상' 필터
- 점검 시작 전 GPS 경고 표시

## 기술 스택

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **PWA**: Service Worker, IndexedDB (예정)
- **Map**: Kakao Map API (Mapbox 대체)
- **State**: Zustand, TanStack Query
- **Email**: Resend API

## 프로젝트 구조

```
aed-check-system/
├── apps/
│   ├── web/          # 관리자 대시보드
│   ├── mobile/       # PWA 점검 앱
│   └── api/          # Edge Functions
├── packages/
│   ├── ui/           # 공통 컴포넌트
│   ├── types/        # TypeScript 타입
│   ├── utils/        # 유틸리티
│   └── database/     # DB 스키마
└── docs/             # 문서
```

## 시작하기

### 환경 설정

1. 환경 변수 설정
```bash
cp .env.example .env.local
```

**⚠️ 필수 기능 플래그 (Stage 2 기능 사용 시)**:
```bash
# 실시간 동기화 - 필수 활성화
NEXT_PUBLIC_FEATURE_REALTIME_SYNC=true

# 팀 대시보드
NEXT_PUBLIC_FEATURE_TEAM_DASHBOARD=true
```

- Stage 1 기능: `NEXT_PUBLIC_FEATURE_QUICK_INSPECT`, `NEXT_PUBLIC_FEATURE_SCHEDULE`
- Stage 2 기능: 실시간 동기화, Presence, 충돌 감지, 오프라인 큐 (REALTIME_SYNC 플래그로 제어)

2. Supabase 프로젝트 생성 및 키 설정
   - [Supabase Dashboard](https://app.supabase.com)에서 프로젝트 생성
   - `.env.local`에 URL과 Anon Key 입력

3. 데이터베이스 초기화
```bash
# Supabase SQL Editor에서 실행
packages/database/schema.sql
```

4. Supabase 함수 재생성 (필요 시)
```bash
# 환경 변수에 SUPABASE_DB_URL 설정 후 실행
npm run supabase:apply

# 또는 Supabase SQL Editor에서 다음 파일 실행
supabase/clean_and_recreate_functions.sql
```

### 개발 서버 실행

```bash
npm install
npm run dev
```

http://localhost:3000 에서 확인

### 빌드 및 배포

```bash
npm run build
npm start
```

## 개발 일정

### Phase 1: Stage 기반 개발 (5단계)
- [x] Stage 0: 환경 준비 및 기본 설정 (100%)
- [x] Stage 1: MVP - 즉시 점검 및 일정 추가 (100%)
- [🔄] Stage 2: 팀 협업 - 실시간 동기화 (33% - Sprint 1 완료)
- [ ] Stage 3: 고급 기능 - 보고서 및 분석 (0%)
- [ ] Stage 4: 전국 배포 준비 (0%)

### Phase 2: 고도화 (3-12개월)
- [ ] e-gen API 직접 연계
- [ ] AI 기반 예측 분석
- [ ] 실시간 대시보드
- [ ] 빅데이터 분석 플랫폼

## 보안 고려사항

- 정부기관 이메일(@korea.kr, @nmc.or.kr) 우선, 개인 이메일은 임시 점검원으로 제한
- Master 계정 하드코딩 방지 (환경변수 사용)
- Row Level Security (RLS) 적용
- 모든 API 호출 로깅

## 성능 최적화 주의사항

- **서버 컴포넌트**: 무거운 연산 피하고 데이터 페칭 최적화
- **미들웨어**: Edge Runtime 제약 고려, 무거운 라이브러리 import 금지
- **API 라우트**: Response 스트리밍 활용, 대용량 데이터는 페이지네이션 필수
- **데이터베이스**: 쿼리 최적화 및 인덱싱, 캐싱 전략 적극 활용
- **주의**: 서버 컴포넌트, 미들웨어, API 라우트 사용 시 속도 저하 방지 필수

## 다음 단계 (Next Steps)

### 1. Supabase 프로젝트 설정
1. [Supabase Dashboard](https://app.supabase.com) 접속
2. 새 프로젝트 생성 (Seoul Region 권장)
3. Project Settings > API에서 다음 정보 복사:
   - `Project URL` → `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `.env.local`의 `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2. 데이터베이스 초기화
1. Supabase Dashboard > SQL Editor 접속
2. `/supabase/migrations/` 폴더의 SQL 파일 순차 실행:
   - `01_initial_schema.sql` - 기본 테이블
   - `02_initial_data.sql` - 초기 데이터
   - `03_rls_policies.sql` - RLS 정책
   - `04_aed_tables.sql` - AED 관련 테이블

→ 상세 가이드: [Supabase README](supabase/README.md)
4. 초기 조직 데이터 입력:
```sql
-- 중앙응급의료센터 조직 생성
INSERT INTO organizations (name, type, region_code) 
VALUES ('중앙응급의료센터', 'emergency_center', 'KR');

-- 시도 조직 생성 예시
INSERT INTO organizations (name, type, region_code) 
VALUES 
  ('서울특별시', 'province', 'SEO'),
  ('경기도', 'province', 'GYE');
```

### 3. Master 계정 설정
1. 첫 번째 Master 관리자 계정 생성:
   - 이메일: truth0530@nmc.or.kr
   - 회원가입 후 자동으로 master 권한 부여됨
2. 추가 Master 계정도 동일하게 생성 (inhak@nmc.or.kr, woo@nmc.or.kr)

### 4. 개발 서버 실행
```bash
# 의존성 설치
npm install

# 개발 서버 시작
npm run dev

# 브라우저에서 접속
http://localhost:3000
```

### 5. 초기 테스트
1. `/auth/signup` 에서 회원가입 테스트
2. `/auth/signin` 에서 로그인 테스트
3. `/dashboard` 대시보드 접근 확인

### 6. PWA 모바일 앱 개발
```bash
# PWA 패키지 설치
npm install next-pwa workbox-webpack-plugin

# Service Worker 설정
# next.config.ts 수정 필요
```

### 7. 지도 기능 설정
1. [Mapbox](https://www.mapbox.com) 계정 생성
2. Access Token 발급
3. `.env.local`의 `NEXT_PUBLIC_MAPBOX_TOKEN` 업데이트

### 8. 프로덕션 배포 준비
- [ ] Vercel 또는 AWS 배포 환경 설정
- [ ] 도메인 설정 (예: aed.nmc.or.kr)
- [ ] SSL 인증서 설정
- [ ] 환경변수 프로덕션 값으로 업데이트
- [ ] 성능 최적화 및 보안 점검

### 9. 운영 준비
- [ ] 사용자 매뉴얼 작성
- [ ] 관리자 교육 자료 준비
- [ ] 시범 운영 (5개 보건소)
- [ ] 피드백 수집 및 개선
- [ ] 전국 배포

## 문제 해결

### Supabase 연결 오류
- `.env.local` 파일의 URL과 Key 확인
- Supabase 프로젝트가 활성화 상태인지 확인

### 빌드 오류
```bash
# 캐시 삭제 후 재시도
rm -rf .next node_modules
npm install
npm run dev
```

## Service Worker 배포 주의사항

### HTTPS 요구사항
Service Worker는 보안상의 이유로 **HTTPS** 환경에서만 동작합니다.
- ✅ localhost (개발 환경)
- ✅ HTTPS 프로토콜 사용 도메인
- ❌ HTTP 프로토콜 도메인 (localhost 제외)

### 브라우저 호환성
- Chrome/Edge: 완벽 지원
- Safari: 제한적 지원 (Push API 미지원)
- Firefox: 완벽 지원

### Safari Private 모드 대응
Safari 개인정보 보호 모드에서는 IndexedDB가 제한됩니다.
시스템이 자동으로 메모리 기반 폴백 모드로 동작하지만, 페이지 새로고침 시 오프라인 데이터가 손실될 수 있습니다.

### 환경변수 설정
Service Worker는 빌드 시 환경변수를 직접 사용할 수 없습니다.
시스템이 자동으로 클라이언트에서 설정을 전달하므로 별도 설정이 필요 없습니다.

## 라이선스

Copyright © 2025 중앙응급의료센터. All rights reserved.

---

**마지막 업데이트**: 2025-09-20
**프로젝트 상태**: Stage 2 Sprint 3 진행중 (75% 완료)
**문서 버전**: 2.2
