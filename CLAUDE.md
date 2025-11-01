# CLAUDE.md - AI 개발 가이드라인

## 프로젝트 문서 목차

### 핵심 문서
- [README.md](README.md) - 프로젝트 개요 및 시작 가이드
- [CLAUDE.md](CLAUDE.md) - AI 개발 가이드라인 (현재 문서)
- [docs/시작하기.md](docs/시작하기.md) - 상세 시작 가이드

### 마이그레이션 문서
- [docs/migration/NCP_마이그레이션_완전가이드.md](docs/migration/NCP_마이그레이션_완전가이드.md) - NCP 마이그레이션 전체 과정
- [docs/migration/MIGRATION_STATUS.md](docs/migration/MIGRATION_STATUS.md) - 현재 마이그레이션 상태
- [docs/migration/NCP_MIGRATION_PHASE1_COMPLETE.md](docs/migration/NCP_MIGRATION_PHASE1_COMPLETE.md) - Phase 1 완료 보고서

### 배포 및 운영
- [docs/deployment/NCP_SERVER_SETUP.md](docs/deployment/NCP_SERVER_SETUP.md) - NCP 서버 설정 및 배포 가이드
- [docs/deployment/GITHUB_SECRETS_SETUP.md](docs/deployment/GITHUB_SECRETS_SETUP.md) - GitHub Secrets 설정 가이드
- [docs/GITHUB_ACTIONS_OPTIMIZATION.md](docs/GITHUB_ACTIONS_OPTIMIZATION.md) - GitHub Actions 최적화 가이드
- [docs/SLACK_WEBHOOK_SETUP.md](docs/SLACK_WEBHOOK_SETUP.md) - Slack Webhook 연동 가이드

### 데이터 Import
- [docs/AED_DATA_IMPORT_GUIDE.md](docs/AED_DATA_IMPORT_GUIDE.md) - AED 데이터 import 가이드
- [docs/CSV_STRUCTURE_ANALYSIS.md](docs/CSV_STRUCTURE_ANALYSIS.md) - e-gen CSV 파일 구조 분석

### 레퍼런스
- [docs/reference/ARCHITECTURE_OVERVIEW.md](docs/reference/ARCHITECTURE_OVERVIEW.md) - 시스템 아키텍처
- [docs/reference/SUPABASE_SCHEMA_COMPLETE.md](docs/reference/SUPABASE_SCHEMA_COMPLETE.md) - 레거시 Supabase 스키마 분석 (참조용)
- [docs/reference/REGION_CODE_GUIDELINES.md](docs/reference/REGION_CODE_GUIDELINES.md) - 지역 코드 가이드라인
- [docs/reference/PROJECT_RESTRUCTURE_SUMMARY.md](docs/reference/PROJECT_RESTRUCTURE_SUMMARY.md) - 프로젝트 구조 재정리 보고서

### 문제 해결 (Troubleshooting)
- [docs/troubleshooting/EMAIL_SENDING_ISSUE_RESOLUTION.md](docs/troubleshooting/EMAIL_SENDING_ISSUE_RESOLUTION.md) - NCP 이메일 발송 문제 해결 전체 문서
- [docs/troubleshooting/EMAIL_DEBUGGING_CHECKLIST.md](docs/troubleshooting/EMAIL_DEBUGGING_CHECKLIST.md) - 이메일 발송 실패 디버깅 체크리스트

## 절대 준수 사항

### 1. 이모지 사용 절대 금지
- 모든 문서, 코드, 커밋 메시지에서 이모지 사용 금지
- 프로페셔널한 텍스트 기반 커뮤니케이션만 사용

### 1-1. 핵심 권한 체계 (절대 불변)
**AED 데이터 조회 권한 규칙 - 이 프로젝트의 핵심**

#### 전국 권한 (17개 시도 + 전체 선택 가능)
- **@nmc.or.kr** (중앙응급의료센터 및 17개 시도 응급의료지원센터):
  - 17개 시도 자유 선택, "전체" 선택 가능, 시군구 자유 선택
  - 중앙응급의료센터: 기본 선택값 없음
  - 시도 응급의료지원센터: 해당 시도가 기본 선택됨 (변경 가능)
- **@korea.kr 중 보건복지부**: 17개 시도 자유 선택, "전체" 선택 가능, 시군구 자유 선택

#### 시도 권한 (소속 시도 고정, 시군구 선택 가능)
- **@korea.kr 중 시청/도청**: 소속 시도 고정 표시, 해당 시도 내 시군구 자유 선택 또는 "전체"

#### 시군구 권한 (소속 시도 및 시군구 고정)
- **@korea.kr 중 보건소**: 소속 시도 고정 표시, 소속 시군구 고정 표시, 변경 불가
- **두 가지 조회 기준 선택 가능**:
  - 주소 기준: 해당 시군구에 물리적으로 설치된 AED
  - 관할보건소 기준: 해당 보건소가 관리하는 AED (타 지역 포함 가능)

**중요**: KR(중앙)은 조직 구분용 코드로 실제 AED 데이터가 없음. 데이터 조회 선택지에서 제외

### 1-2. AED 데이터 지역 구분 체계
**이원화된 지역 관리 시스템**

#### 물리적 주소 기준
- **시도/시군구 칼럼**: AED가 실제 설치된 위치
- 예: 서울특별시 강서구에 설치된 AED

#### 관할보건소 기준 (jurisdiction_health_center)
- **관할보건소 칼럼**: AED를 관리하는 보건소
- 물리적 위치와 다를 수 있음
- 예: 서울 강서구에 있지만 대구 중구 보건소가 관리

**조회 기준 선택**: 사용자는 라디오 버튼으로 두 기준 중 선택
- 주소 기준: 선택한 지역에 설치된 모든 AED
- 관할보건소 기준: 소속 보건소가 관리하는 모든 AED (타 지역 포함)

### 2. 임의 추정 및 단정 금지
- 확인되지 않은 수치를 추정하여 사실처럼 사용 금지
- 예시: "한국의 AED가 30,000대"라고 임의로 추정하여 문서 작성 금지
- 불확실한 정보는 반드시 사용자에게 확인 요청
- 추정이 필요한 경우 "약", "추정" 등을 명시하고 근거 제시
- 현재 확정된 수치:
  - AED 총 대수: 81,331대 (2025년 9월 인트라넷 집계)
  - 보건소 수: 261개 (2024년 12월 보건복지부 공식 통계)
  - 시도: 17개 (대한민국 행정구역)

### 3. 임의 작업 금지
- 사용자가 명시적으로 요청하지 않은 기능 추가 금지
- 창의적 해석이나 확장 금지
- 요청사항만 정확히 구현

### 4. 단계적 진행 원칙
- 한 번에 하나의 작업만 수행
- 이전 단계 완료 확인 후 다음 단계 진행
- 건너뛰기나 병렬 작업 금지 (명시적 요청 제외)

## 개발 패턴 및 핵심 교훈

### 1. 단일 진실 소스 (Single Source of Truth) 원칙

**문제**: 역할 명칭, 지역 코드 변환 등이 여러 파일에 하드코딩되어 불일치 발생
```typescript
// 잘못된 예 - 각 파일마다 하드코딩
const getRoleLabel = (role: string) => {
  if (role === 'local_admin') return '로컬 관리자';  // ❌ 파일마다 다른 명칭
  // ...
}
```

**해결**: 중앙 집중식 유틸리티 파일 생성
```typescript
// lib/utils/user-roles.ts - 단일 진실 소스
export const ROLE_INFO: Record<UserRole, RoleInfo> = {
  local_admin: {
    label: '보건소 담당자',  // ✅ 한 곳에서만 정의
    description: '시군구 보건소 AED 관리 권한',
    // ...
  }
};
```

**교훈**:
- 역할, 권한, 코드 변환 등은 반드시 `lib/utils/` 에 유틸리티로 생성
- 하드코딩된 매핑이 2곳 이상 필요하면 즉시 유틸리티 파일로 추출
- CLAUDE.md 권한 체계와 코드 간 일관성 유지 필수

**적용 위치**:
- `lib/utils/user-roles.ts` - 역할 관리 (2025-10-31 생성)
- `lib/utils/area-code.ts` - 지역번호 매핑 (2025-10-31 생성)

### 2. shadcn/ui 컴포넌트 사용 시 확인 절차

**문제**: 존재하지 않는 컴포넌트 import로 빌드 실패
```typescript
import { Table } from '@/components/ui/table';  // ❌ 파일이 없음
```

**해결 절차**:
1. 컴포넌트 사용 전 파일 존재 여부 확인
```bash
ls components/ui/table.tsx
# 또는
find components/ui -name "*.tsx" | grep table
```

2. 없으면 shadcn/ui 표준 패턴으로 생성
```typescript
// components/ui/table.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const Table = React.forwardRef<...>(({ className, ...props }, ref) => (
  // shadcn 표준 패턴 따르기
));
```

**교훈**:
- 기존 프로젝트에 없는 shadcn 컴포넌트는 직접 생성 필요
- 공식 shadcn/ui 코드 복사하여 일관성 유지
- Card, Button, Dialog 등 기본 컴포넌트 확인 후 재사용

### 3. 기술 코드 노출 금지

**문제**: UI에 프로그래머틱한 코드 노출로 사용자 혼란
```typescript
<div>{user.id}</div>  // ❌ V4a8RzwvCqEzY... 노출
<div>{user.region_code}</div>  // ❌ DAE, INC 노출
```

**해결**: 변환 함수를 통한 표시
```typescript
<div>{getRegionDisplay(user.region_code)}</div>  // ✅ 대구광역시
<div>{user.email}</div>  // ✅ 이메일로 식별
```

**교훈**:
- 사용자 ID, 시스템 코드는 UI에 표시 금지
- 모든 코드는 한글 명칭으로 변환하여 표시
- 디버깅 필요 시 개발자 도구 활용, UI는 깔끔하게 유지

### 4. PM2 Zero-Downtime Deployment

**문제**: 메모리 사용량 2배 증가 우려
```yaml
pm2 stop && pm2 start  # ❌ 서비스 다운타임 발생
```

**해결**: PM2 reload 사용
```yaml
pm2 reload ecosystem.config.js  # ✅ Rolling restart
```

**실제 동작**:
- Instance 1 재시작 → Instance 2가 요청 처리
- Instance 1 준비 완료 → Instance 2 재시작
- 일시적 메모리 증가(600MB-1GB) → 완료 후 정상 복귀
- **다운타임 0초**

**교훈**:
- PM2 cluster 모드 필수 (최소 2 instances)
- `pm2 restart` 대신 `pm2 reload` 사용
- `wait_ready: true` 설정으로 준비 대기

### 5. 환경변수 표준화

**문제**: 같은 용도의 환경변수가 여러 이름으로 존재
```bash
NEXT_PUBLIC_KAKAO_MAP_KEY="..."  # ❌ 파일 A
NEXT_PUBLIC_KAKAO_MAP_APP_KEY="..."  # ❌ 파일 B
MASTER_ADMIN_EMAILS="..."  # ❌ 배열 형태
MASTER_EMAIL="..."  # ✅ 단일 값
```

**해결**:
1. `.env.example` 에 공식 변수명 문서화
2. 코드베이스 전체 검색 및 통일
```bash
grep -r "KAKAO_MAP" --include="*.ts" --include="*.tsx"
```

**교훈**:
- 환경변수 추가 시 `.env.example` 먼저 확인
- 신규 변수는 명확한 네이밍 (목적_서비스_타입)
- deprecated 변수는 주석으로 표시 후 제거

### 6. NCP API 키 통합 관리

**문제**: 서비스마다 별도 API 키 생성 시도
```bash
NCP_STORAGE_KEY="..."  # ❌ Object Storage용
NCP_EMAIL_KEY="..."    # ❌ Email용
NCP_ACCESS_KEY="..."   # ✅ 통합 사용
```

**해결**: NCP는 하나의 API 키로 모든 서비스 사용
```bash
# 2025년 11월 생성 키로 통일 (최신 권한 포함)
NCP_ACCESS_KEY="ncp_iam_BPAMKR***********"
NCP_ACCESS_SECRET="ncp_iam_BPKMKRSH***********"
```

**NCP 서비스별 API 키 사용**:
- Cloud Outbound Mailer (이메일): 동일 키 사용
- Object Storage (파일): 동일 키 사용
- Server (VM 관리): 동일 키 사용

**교훈**:
- NCP는 통합 API 키 체계 (AWS IAM과 유사)
- 서비스별 권한은 NCP 콘솔에서 IAM 역할로 관리
- 키 재발급 시 모든 서비스 영향 → 신중히 결정
- **절대 금지**: 여러 키 중복 생성하여 혼란 야기

### 7. DMARC 정책과 발신자 이메일

**문제**: 임의로 다른 도메인 발신자 사용 시도
```typescript
NCP_SENDER_EMAIL="noreply@aed.pics"  // ❌ DMARC 정책 위반 가능
NCP_SENDER_EMAIL="truth0530@nmc.or.kr"  // ❌ 개인 계정 사용 금지
```

**해결**: 공식 도메인의 인증된 계정만 사용
```typescript
NCP_SENDER_EMAIL="noreply@nmc.or.kr"  // ✅ IT 관리자 인증 완료
```

**DMARC 정책 이해**:
- `@nmc.or.kr` 도메인은 IT 관리자가 SPF/DKIM/DMARC 설정 완료
- 인증되지 않은 계정에서 발송 시 수신 서버가 거부/스팸 처리
- `noreply@aed.pics` 사용하려면 별도 DMARC 설정 필요

**교훈**:
- 발신자 이메일 변경 전 IT 관리자와 협의 필수
- 공식 도메인 정책 준수
- 테스트 시에도 인증된 계정만 사용

### 8. 서버 디스크 용량 관리

**문제**: 빌드 캐시 누적으로 디스크 풀 (10GB 중 95% 사용)
```bash
df -h  # ❌ Filesystem: 9.5G / 10G (95%)
```

**긴급 대응**:
```bash
# 1. Next.js 캐시 삭제 (안전)
rm -rf .next/cache
rm -rf .next/static

# 2. Node modules 재설치 (필요시)
rm -rf node_modules
npm ci

# 3. PM2 로그 정리
pm2 flush
```

**근본 해결**: Object Storage 활용
- 정적 파일 (이미지, PDF) → NCP Object Storage로 이동
- 빌드 결과물 경량화
- 로그 로테이션 설정

**예방 조치**:
```bash
# 주간 디스크 모니터링
df -h
du -sh .next/
du -sh node_modules/
```

**교훈**:
- 10GB 서버는 지속적 용량 관리 필수
- 빌드 전 캐시 정리 습관화
- 대용량 파일은 Object Storage 사용
- 프로덕션 서버에서 불필요한 devDependencies 설치 금지

### 9. 무중단 서비스 유지보수 전략

**문제**: 서비스 중단 없이 배포 및 유지보수 방법
```bash
# ❌ 잘못된 방법
ssh server
pm2 stop all  # 서비스 중단!
git pull
npm install
npm run build
pm2 start
```

**올바른 방법**: GitHub Actions + PM2 Reload
```yaml
# .github/workflows/deploy-production.yml
- name: Deploy with Zero Downtime
  run: |
    # 빌드는 로컬에서 완료
    npm run build

    # 서버에 배포만 수행
    ssh server << 'EOF'
      cd /path/to/app
      git pull
      npm ci --production
      pm2 reload ecosystem.config.js  # Zero-Downtime!
    EOF
```

**배포 전 로컬 검증 필수**:
```bash
# 1. 타입 검사
npm run tsc

# 2. 린트 검사
npm run lint

# 3. 로컬 빌드
npm run build

# 4. 모두 통과 시에만 푸시
git push origin main  # GitHub Actions 자동 배포
```

**유지보수 시간대 권장**:
- **일반 업데이트**: 언제든지 (PM2 reload는 무중단)
- **DB 스키마 변경**: 새벽 2-4시 (사용량 최소)
- **긴급 핫픽스**: 즉시 (테스트 후 배포)

**교훈**:
- 프로덕션 서버에서 직접 작업 금지
- GitHub을 통한 배포 자동화 필수
- 로컬 검증 없이 푸시 절대 금지
- PM2 reload로 사용자 경험 보호

### 10. 이미지 최적화 원칙

**목표**: Object Storage 비용 최소화

**핵심 원칙**:
1. **압축률 극대화 최우선** (품질보다 용량 절감)
2. 식별 가능한 범위 내 최대 압축
3. WebP 포맷 + quality 55-60 권장

**최적화 전략**:
```typescript
// Sharp를 사용한 WebP 초압축
await sharp(buffer)
  .rotate()  // EXIF 적용 후 제거
  .resize(1280, 1280, { fit: 'inside' })  // 해상도 제한
  .webp({
    quality: 55,          // 식별 가능 + 최대 압축
    effort: 6,            // 최대 압축 노력
    smartSubsample: true  // Chroma subsampling
  })
  .toBuffer();
```

**예상 효과**:
- 점검 1건 (사진 3장): 9MB → 210KB (97.7% 감소)
- 연간 (81,464대 × 연 1회): 733GB → 17.1GB (97.7% 감소)
- **연간 비용: 약 6,000원** (월 500원)

**상세**: [docs/IMAGE_OPTIMIZATION_STRATEGY.md](docs/IMAGE_OPTIMIZATION_STRATEGY.md)

## 필수: NCP 이메일 발송 문제 해결

### 이메일 발송 실패 시 최우선 체크

**중요**: 과거 정상 작동했던 `noreply@nmc.or.kr`가 갑자기 실패하면 **인증 문제가 아닙니다!**

#### 빠른 진단 (30초)
```bash
# 1. 환경변수 확인
cat .env.local | grep NCP

# 2. 로컬 테스트
npm run test:email

# 3. 최근 변경사항 확인
git log --oneline -5
```

#### 올바른 환경변수 (2025-10-31 기준)
```bash
NCP_ACCESS_KEY="ncp_iam_BPAMKR***********"  # NCP 콘솔에서 확인
NCP_ACCESS_SECRET="ncp_iam_BPKMKRF***********"  # NCP 콘솔에서 확인
NCP_SENDER_EMAIL="noreply@nmc.or.kr"  # 개인 이메일 사용 금지
```

**참고**: 실제 API 키는 NCP 콘솔 > 마이페이지 > 인증키 관리에서 확인하거나 GitHub Secrets에서 복사

#### 자주 하는 실수 (절대 금지)
1. 인증 문제로 오인: `noreply@nmc.or.kr`는 이미 인증된 계정
2. 개인 이메일 사용: `truth0530@nmc.or.kr` 사용 금지
3. DMARC/SPF 설정 변경: 이미 IT 관리자가 설정 완료
4. API 키 임의 재발급: 다른 시스템 영향 가능

#### 상세 문서
- 전체 해결 과정: [docs/troubleshooting/EMAIL_SENDING_ISSUE_RESOLUTION.md](docs/troubleshooting/EMAIL_SENDING_ISSUE_RESOLUTION.md)
- 디버깅 체크리스트: [docs/troubleshooting/EMAIL_DEBUGGING_CHECKLIST.md](docs/troubleshooting/EMAIL_DEBUGGING_CHECKLIST.md)

## 필수: GitHub 푸시 전 검사 절차

### 반드시 실행해야 할 명령어 (순서대로)

#### 1. TypeScript 타입 검사
```bash
npm run tsc
# 또는
npx tsc --noEmit
```
- **목적**: TypeScript 컴파일 오류 사전 방지
- **실패 시**: 모든 타입 오류를 수정할 때까지 푸시 금지

#### 2. ESLint 검사
```bash
npm run lint
# 또는
npx next lint
```
- **목적**: 코드 스타일 및 품질 검사
- **실패 시**: 모든 lint 오류를 수정할 때까지 푸시 금지

#### 3. 로컬 빌드 테스트
```bash
npm run build
```
- **목적**: Next.js 프로덕션 빌드 가능 여부 확인
- **실패 시**: 빌드 오류를 모두 해결할 때까지 푸시 금지

#### 4. 자동 수정 가능한 오류 처리
```bash
# ESLint 자동 수정
npm run lint -- --fix

# Prettier 포매팅 (설치된 경우)
npx prettier --write .
```

### 푸시 전 체크리스트
- [ ] `npm run tsc` 통과
- [ ] `npm run lint` 통과
- [ ] `npm run build` 통과
- [ ] 불필요한 console.log 제거
- [ ] 주석 처리된 코드 정리
- [ ] import 정리 (사용하지 않는 import 제거)

### 일반적인 오류 해결 방법

#### TypeScript 오류
- `any` 타입 사용 금지 → 적절한 타입 정의
- `@ts-ignore` 사용 금지 → 타입 문제 근본 해결
- undefined/null 체크 → optional chaining (?.) 사용

#### ESLint 오류
- `no-explicit-any`: interface나 type 정의
- `no-unused-vars`: 사용하지 않는 변수 제거
- `react-hooks/exhaustive-deps`: 의존성 배열 수정

### 커밋 및 푸시 순서
```bash
# 1. 모든 검사 통과 확인
npm run tsc && npm run lint && npm run build

# 2. 성공 시에만 커밋
git add .
git commit -m "커밋 메시지"

# 3. 푸시
git push origin main
```

## NCP 마이그레이션 프로젝트 개요

### 프로젝트 목적
- 국정원 인증 획득을 위한 네이버 클라우드 플랫폼(NCP) 전환
- Supabase에서 NCP PostgreSQL로 데이터베이스 마이그레이션
- 자체 호스팅 환경 구축

### 현재 상태 (2025-10-28)
- Phase 1: 인프라 구축 완료
- Phase 2: 데이터 마이그레이션 완료 (315개 레코드)
- Phase 3: 프로덕션 배포 준비 완료
  - Critical 이슈 해결 (organization_change_requests API 비활성화)
  - 환경변수명 통일 완료
  - 프로덕션 빌드 성공
- Phase 4: AED 데이터 Import 완료 (81,464개 레코드)
- Phase 5: 점검 기능 현황 파악 완료
  - 점검 이력 조회 API 버그 수정 완료
  - 점검 관리 UI 이미 구현됨 확인
  - 사진 업로드 UI 완성 (스토리지 레이어만 마이그레이션 필요)
- NCP Cloud Outbound Mailer 이메일 서비스 연동 완료
- 프로덕션 서버 배포 완료

### 기술 스택
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Database**: NCP PostgreSQL (pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com)
- **ORM**: Prisma (23개 모델, 25개 enum)
- **Map**: Kakao Maps API
- **Email**: NCP Cloud Outbound Mailer

### 데이터베이스 연결 정보
```bash
# NCP PostgreSQL
Host: pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com
Port: 5432
Database: aedpics_production
Schema: aedpics
User: aedpics_admin
```

### 환경변수 구성
```bash
# .env.local - 필수 환경변수
DATABASE_URL="postgresql://aedpics_admin:PASSWORD@pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com:5432/aedpics_production?schema=aedpics"
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="generate-random-32-chars"
JWT_SECRET="generate-random-secret"
NEXT_PUBLIC_KAKAO_MAP_APP_KEY="your_kakao_key"
NCP_ACCESS_KEY="your_ncp_access_key"
NCP_ACCESS_SECRET="your_ncp_access_secret"
NCP_SENDER_EMAIL="noreply@nmc.or.kr"
MASTER_EMAIL="admin@nmc.or.kr"
NEXT_PUBLIC_SITE_URL="http://localhost:3001"
ENCRYPTION_KEY="generate-random-key"
```

상세한 환경변수 설정은 [.env.example](.env.example) 참조

## 개발 체크리스트

### Phase 1: 인프라 구축 (완료)
- [x] Next.js 프로젝트 초기화
- [x] TypeScript 설정
- [x] Tailwind CSS 설정
- [x] NCP PostgreSQL 연결
- [x] Prisma 스키마 구축 (979줄)
- [x] 환경변수 구성
- [x] Git 저장소 설정

### Phase 2: 데이터 마이그레이션 (완료)
- [x] Prisma 스키마 정의 (23개 모델)
- [x] 마이그레이션 스크립트 작성
- [x] Organizations 마이그레이션 (291개)
- [x] UserProfiles 마이그레이션 (24개)
- [x] 필드 매핑 및 Enum 변환
- [x] 중복 제거 로직 구현
- [x] 프로젝트 구조 재정리

### Phase 3: 프로덕션 배포 준비 (완료 - 2025-10-26)
#### Critical 이슈 해결
- [x] organization_change_requests API 비활성화 (6개 파일)
  - 존재하지 않는 테이블 참조 방지
  - 501 Not Implemented 응답으로 안전하게 처리
- [x] NextAuth Prisma 모델명 수정
  - login_history 모델명 통일
  - organizations 관계명 수정
- [x] 환경변수 문서화 완료 (.env.example)
  - 15개 필수/선택 변수 문서화
  - Supabase 레거시 변수 DEPRECATED 표시

#### 환경변수명 통일
- [x] Kakao Maps API 키 통일 (3개 파일)
  - NEXT_PUBLIC_KAKAO_MAP_KEY → NEXT_PUBLIC_KAKAO_MAP_APP_KEY
- [x] Master 계정 변수 통일 (1개 파일)
  - MASTER_ADMIN_EMAILS → MASTER_EMAIL
- [x] Application URL 통일 (1개 파일)
  - NEXT_PUBLIC_APP_URL 제거, NEXT_PUBLIC_SITE_URL 표준화

#### 빌드 및 배포 준비
- [x] TypeScript 타입 검사 통과
- [x] 프로덕션 빌드 성공 (118개 페이지)
- [x] 배포 준비 완료

### Phase 4: AED 데이터 Import (완료 - 2025-10-28)
- [x] e-gen CSV 파일 준비 (81,331개 레코드)
- [x] upload_to_ncp.py 실행
- [x] 데이터 Import 완료 (81,464개 레코드)
- [x] 프로덕션 DB 검증 완료
- [x] GPS 좌표 포함 확인

### Phase 5: 기능 구현
#### 인증 체계
- [x] 3단계 가입 프로세스 UI
- [x] 이메일 도메인 검증 (클라이언트)
- [x] Master 계정 환경변수 설정
- [x] 프로필 설정 페이지 구현
- [x] 승인 대기 페이지 구현
- [x] 약관 동의 UX 개선
- [x] NCP Cloud Outbound Mailer 이메일 연동 (Resend 대체)
- [x] 서버사이드 도메인 검증 (2025-10-28 완료)
- [x] 이메일 인증 플로우 테스트 계획 문서화 (2025-10-28)
- [x] 관리자 승인/거부 이메일 발송 기능 (approval-email.ts, rejection-email.ts) (2025-10-28 완료)
- [x] API 엔드포인트 이메일 연동 (approve/reject routes) (2025-10-28 완료)
- [x] 관리자 승인 페이지 UI 구현 (app/(authenticated)/admin/users/page.tsx) (2025-10-28 완료)

#### 데이터 관리
- [ ] 조직 관리 CRUD
- [ ] 사용자 관리 인터페이스
- [ ] AED 장치 등록 기능
- [ ] e-gen 데이터 동기화
- [ ] 데이터 정규화 로직
- [ ] 중복 제거 알고리즘

#### 점검 기능 (2025-10-28 현황 파악 완료)
- [x] 즉시 점검 기능 (QuickInspectPanel 구현)
- [x] 점검 스케줄링 (ScheduleModal 구현)
- [x] 역할 기반 액션 버튼 (ActionButtons.tsx)
- [x] 점검 API 엔드포인트 (/api/inspections/quick)
- [x] 스케줄 API 엔드포인트 (/api/schedules)
- [x] inspection_schedule_entries 테이블 구축
- [x] 점검 이력 조회 화면 (AdminFullView 완전 구현됨)
- [x] 점검 이력 조회 API (field naming 버그 수정 완료)
- [x] 점검 이력 상세 모달 (InspectionHistoryModal - 4단계 탭)
- [x] 점검 결과 CRUD (조회/수정/삭제 모두 구현됨)
- [x] 사진 업로드 UI (PhotoCaptureInput 완성)
- [ ] 사진 스토리지 마이그레이션 (Supabase → NCP Object Storage)
- [ ] 점검 통계 대시보드 구현

#### PWA 모바일 앱
- [x] PWA 설정 (@ducanh2912/next-pwa) (2025-10-28 완료)
- [x] Service Worker 자동 구현 (next-pwa workbox) (2025-10-28 완료)
- [x] manifest.json 생성 (2025-10-28 완료)
- [ ] 오프라인 모드 지원
- [ ] IndexedDB 동기화
- [ ] 모바일 최적화 UI
- [ ] 카메라 API 연동
- [ ] PWA 아이콘 생성 (192x192, 512x512)

#### 시스템 테스트
- [ ] 단위 테스트 작성
- [ ] 통합 테스트 구현
- [ ] 부하 테스트 (250개 보건소)
- [ ] 보안 취약점 점검
- [ ] 성능 최적화
- [ ] 버그 수정

#### 프로덕션 배포 (완료 - 2025-10-28)
- [x] NCP 서버 구축 (223.130.150.133)
- [x] Node.js 20.x 설치
- [x] PM2 프로세스 관리 설정
- [x] Nginx 역방향 프록시 설정
- [x] SSL/TLS 인증서 설정 (Let's Encrypt)
- [x] HTTPS 활성화 (https://aed.pics)
- [x] fail2ban 보안 설정
- [x] 환경변수 통일 및 문서화
- [x] 프로덕션 빌드 및 배포
- [ ] CI/CD 파이프라인 구축
- [ ] 모니터링 시스템 구축
- [ ] 백업 체계 구축
- [ ] 사용자 매뉴얼 작성
- [ ] 교육 자료 제작

### Phase 6: 확장 기능 (MVP 이후)
- [ ] e-gen API 직접 연동
- [ ] 실시간 동기화
- [ ] AI 패턴 분석
- [ ] 고급 리포트
- [ ] 자동 알림
- [ ] 빅데이터 플랫폼

## 프로젝트 구조

```
AEDpics/
├── README.md                   # 프로젝트 README
├── CLAUDE.md                   # AI 개발 가이드라인 (현재 문서)
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
├── middleware.ts
├── prisma/
│   └── schema.prisma           # 979줄, 23개 모델, 25개 enum
├── app/                        # Next.js 앱 디렉토리
├── components/                 # React 컴포넌트
├── lib/                        # 통합 라이브러리
│   ├── types/                  # TypeScript 타입 정의
│   ├── utils/                  # 유틸리티 함수
│   ├── hooks/                  # React 커스텀 훅
│   └── supabase/               # 레거시 Supabase 클라이언트 (참조용)
├── scripts/                    # 스크립트
│   ├── upload_to_ncp.py        # AED 데이터 Import
│   ├── migration/              # 마이그레이션 스크립트
│   ├── test/                   # 테스트 스크립트
│   └── utils/                  # 유틸리티 스크립트
├── docs/                       # 문서
│   ├── migration/              # 마이그레이션 문서
│   ├── reference/              # 레퍼런스 문서
│   ├── planning/               # 개선 계획 문서
│   └── archive/                # 구버전 문서
├── config/                     # 설정 파일 참조 사본
└── .archive/                   # 구버전 파일 보관
```

## 코드 작성 규칙

### 명명 규칙
- 컴포넌트: PascalCase
- 함수/변수: camelCase
- 상수: UPPER_SNAKE_CASE
- 파일명: kebab-case

### 타입 정의
- 모든 타입은 `lib/types/`에 정의
- interface 우선 사용
- any 타입 사용 금지

### 주석 규칙
- 한글 주석 사용 가능
- 복잡한 로직에만 주석 추가
- TODO 주석은 이슈로 전환

## 보안 체크리스트

- [ ] 환경변수 노출 방지
- [ ] SQL Injection 방지 (Prisma 사용)
- [ ] XSS 방지
- [ ] CSRF 토큰 구현
- [ ] Rate Limiting
- [ ] 로깅 시스템
- [ ] 민감정보 암호화

## 성능 최적화 주의사항

### 서버 컴포넌트 사용 시 주의
- 서버 컴포넌트에서 무거운 연산 피하기
- 데이터베이스 쿼리 최적화 필수
- 불필요한 서버 요청 최소화
- 캐싱 전략 적극 활용

### 미들웨어 최적화
- 미들웨어는 Edge Runtime에서 실행됨을 인지
- 무거운 라이브러리 import 금지
- 조건부 실행으로 불필요한 처리 방지
- matcher 패턴으로 특정 경로만 처리

### API 라우트 최적화
- Response 스트리밍 활용
- 대용량 데이터는 페이지네이션 필수
- 동시 요청 수 제한 (Rate Limiting)
- 에러 핸들링으로 빠른 실패 처리

## 성능 목표

- 페이지 로드: < 3초
- API 응답: < 500ms
- 동시 접속: 250개 보건소
- 가용성: 99.9%

## 커밋 메시지 규칙

```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 코드 포맷팅
refactor: 코드 리팩토링
test: 테스트 추가
chore: 빌드 작업 수정
migrate: 마이그레이션 관련
```

## 작업 전 체크리스트

작업 시작 전 반드시 확인:
1. [ ] 마이그레이션 상태 확인 (docs/migration/MIGRATION_STATUS.md)
2. [ ] 사용자 요청사항 명확히 파악
3. [ ] 관련 문서 모두 참조
4. [ ] 이전 작업 완료 상태 확인
5. [ ] 테스트 계획 수립

## 작업 후 체크리스트

작업 완료 후 반드시 확인:
1. [ ] 요청사항 모두 구현됨
2. [ ] 테스트 통과
3. [ ] 문서 업데이트
4. [ ] 코드 리뷰 체크
5. [ ] 다음 단계 준비

## 점검 기능 상세 현황 (2025-10-28)

### 구현 완료 기능

#### 1. 점검 이력 조회 및 관리
**위치**: [components/inspection/AdminFullView.tsx](components/inspection/AdminFullView.tsx)
- 3가지 뷰 모드: 목록, 지도, 점검완료
- 자동 갱신 (30초마다)
- 완전한 CRUD 작업 지원:
  - 조회: `handleViewInspectionHistory` (lines 199-213)
  - 수정: `handleUpdateInspection` (lines 216-235)
  - 삭제: `handleDeleteInspection`, `handleConfirmDelete` (lines 237-268)

#### 2. 점검 이력 조회 API
**위치**: [app/api/inspections/history/route.ts](app/api/inspections/history/route.ts)
- 버그 수정 완료 (2025-10-28): snake_case 필드명 일치화
- equipment_serial 기반 이력 조회
- 최근 N개 레코드 제한 기능

#### 3. 점검 상세 모달
**위치**: [components/inspection/InspectionHistoryModal.tsx](components/inspection/InspectionHistoryModal.tsx)
- 4단계 탭 인터페이스:
  - 1단계: 기본정보 (ReadOnlyBasicInfoStep)
  - 2단계: 장비정보 (ReadOnlyDeviceInfoStep)
  - 3단계: 보관함 (ReadOnlyStorageChecklistStep)
  - 4단계: 점검요약 (ReadOnlyInspectionSummaryStep)

#### 4. 사진 촬영 UI
**위치**: [components/inspection/PhotoCaptureInput.tsx](components/inspection/PhotoCaptureInput.tsx)
- 카메라 API 통합 완료
- MediaStream 처리 완료
- Base64 인코딩 지원

### 미완성 기능

#### 1. 사진 스토리지 레이어
**위치**: [lib/utils/photo-upload.ts](lib/utils/photo-upload.ts)
- 현재 상태: Supabase Storage 함수 비활성화 (lines 3-37)
- 필요 작업: NCP Object Storage로 마이그레이션
- 영향받는 함수:
  - `uploadPhotoToStorage`
  - `deletePhotoFromStorage`
  - `getPhotoPublicUrl`

#### 2. 점검 통계 대시보드
**위치**:
- [app/admin/statistics/page.tsx](app/admin/statistics/page.tsx) - 기본 구조 존재
- [app/dashboard/page.tsx](app/dashboard/page.tsx) - 기본 구조 존재
- [app/performance/page.tsx](app/performance/page.tsx) - 기본 구조 존재
- 필요 작업: 실제 통계 데이터 집계 및 시각화 구현

### 데이터베이스 스키마
**위치**: [prisma/schema.prisma](prisma/schema.prisma)
- inspections 테이블 (lines 254-283):
  - photos 필드: String[] (사진 URL 배열)
  - issues_found: String[] (발견된 문제 목록)
  - 모든 상태 필드: visual_status, battery_status, pad_status, operation_status, overall_status
  - GPS 좌표: inspection_latitude, inspection_longitude

### 다음 구현 우선순위
1. NCP Object Storage 마이그레이션 (photo-upload.ts)
2. 점검 통계 대시보드 구현
3. 실시간 점검 현황 모니터링

## 연락처 정보

- 시스템 관리자: truth0530@nmc.or.kr
- 기술 지원: inhak@nmc.or.kr
- 프로젝트 매니저: woo@nmc.or.kr

---

**마지막 업데이트**: 2025-11-01
**문서 버전**: 2.5.0

---

**관련 문서**:
- 프로젝트 개요: [README.md](README.md)
- 마이그레이션 가이드: [docs/migration/NCP_마이그레이션_완전가이드.md](docs/migration/NCP_마이그레이션_완전가이드.md)
- 마이그레이션 상태: [docs/migration/MIGRATION_STATUS.md](docs/migration/MIGRATION_STATUS.md)
- AED 데이터 Import: [docs/AED_DATA_IMPORT_GUIDE.md](docs/AED_DATA_IMPORT_GUIDE.md)
- 시스템 아키텍처: [docs/reference/ARCHITECTURE_OVERVIEW.md](docs/reference/ARCHITECTURE_OVERVIEW.md)
- 프로젝트 구조 재정리: [docs/reference/PROJECT_RESTRUCTURE_SUMMARY.md](docs/reference/PROJECT_RESTRUCTURE_SUMMARY.md)
