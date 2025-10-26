# Supabase/Vercel 정리 작업 보고서

**작성일**: 2025-10-25
**버전**: 1.0

## 현재 상태 분석

### 핵심 발견사항

**데이터베이스**: NCP PostgreSQL로 완전 전환 완료 ✅
**인증 시스템**: Supabase Auth 사용 중 ⚠️
**배포 플랫폼**: 설정 파일 제거됨 (NCP 전환 준비)

## 상세 분석

### 1. 완료된 항목 ✅

#### 데이터베이스
- Prisma를 통해 NCP PostgreSQL 사용
- 23개 테이블 모두 NCP로 마이그레이션 완료
- 315개 레코드 이전 완료

#### 설정 파일
- config/vercel.json → .archive/로 이동 완료
- DATABASE_URL이 NCP PostgreSQL을 가리킴

### 2. 아직 Supabase를 사용하는 부분 ⚠️

#### 인증 시스템 (Supabase Auth)

**사용 중인 파일**:
- lib/supabase/client.ts - 브라우저 클라이언트
- lib/supabase/server.ts - 서버 클라이언트
- lib/supabase/admin.ts - Admin 클라이언트
- lib/supabase/middleware.ts - 인증 미들웨어

**의존하는 컴포넌트** (30개 이상):
- 모든 인증 페이지 (/auth/*)
- 관리자 페이지 (/admin/*)
- 프로필 페이지 (/profile/*)
- 대시보드 및 보호된 페이지

**사용 중인 Supabase 기능**:
1. 이메일/비밀번호 인증
2. OTP 인증
3. 세션 관리
4. 자동 토큰 갱신
5. 실시간 구독 (realtime)

### 3. package.json 정리 필요 항목

#### 즉시 제거 가능
```json
"vercel-build": "next build",  // 불필요
"@vercel/analytics": "^1.5.0",  // NCP에서 불필요
"@vercel/kv": "^3.0.0",         // NCP에서 불필요
"@vercel/speed-insights": "^1.2.0"  // NCP에서 불필요
```

#### 조건부 유지 (인증 시스템 때문)
```json
"@supabase/ssr": "^0.7.0",       // 인증 사용 중
"@supabase/supabase-js": "^2.57.4"  // 인증 사용 중
```

#### 레거시 스크립트
```json
"validate:data": "node scripts/validate-supabase-data.js",  // 삭제 가능
"validate:data:daily": "node scripts/validate-supabase-data.js",  // 삭제 가능
"supabase:apply": "bash ./scripts/apply-aed-sql.sh"  // 삭제 가능
```

## NCP 완전 전환 옵션

### 옵션 1: 점진적 전환 (권장)
**현재 상태 유지하면서 기능 개발 계속**

장점:
- 즉시 개발 계속 가능
- 인증 시스템 안정성 유지
- 위험 최소화

단점:
- Supabase 의존성 계속 유지
- 월 비용 발생

### 옵션 2: NextAuth.js로 전환
**Next.js 표준 인증 라이브러리 사용**

장점:
- Next.js와 완벽 통합
- NCP PostgreSQL 직접 사용
- Prisma Adapter 지원

단점:
- 전면적인 코드 수정 필요 (30+ 파일)
- 2-3주 추가 작업
- 테스트 필요

예상 작업:
1. NextAuth.js 설치 및 설정
2. Prisma Adapter 설정
3. 인증 페이지 전면 수정
4. 세션 관리 로직 변경
5. 미들웨어 재작성

### 옵션 3: 자체 인증 시스템 구축
**완전 맞춤형 솔루션**

장점:
- 완전한 제어권
- NCP 환경에 최적화

단점:
- 개발 시간 가장 많이 소요 (4-6주)
- 보안 검증 필요
- 유지보수 부담

## 권장 사항

### 단기 (현재)
1. ✅ Vercel 관련 설정/의존성 제거
2. ✅ 문서에서 Vercel 참조 제거
3. ⏸️ Supabase Auth는 당분간 유지
4. 📝 lib/supabase/ 폴더에 "레거시" 표시 추가

### 중기 (MVP 완료 후)
1. NextAuth.js로 전환 계획 수립
2. 인증 시스템 리팩토링
3. Supabase 의존성 완전 제거

### 장기
1. NCP 환경 최적화
2. 자체 인증 시스템 검토
3. 국정원 인증 준비

## 즉시 실행 가능한 정리 작업

### 1. package.json 정리
```bash
# Vercel 관련 제거
npm uninstall @vercel/analytics @vercel/kv @vercel/speed-insights

# 불필요한 스크립트 제거
# - vercel-build
# - validate:data
# - supabase:apply
```

### 2. 문서 업데이트
- [x] README.md - Vercel 참조 제거
- [ ] docs/ 폴더 - Supabase/Vercel 참조 업데이트
- [ ] CLAUDE.md - 현재 상태 반영

### 3. lib/supabase/ 폴더 처리
```typescript
// 각 파일 상단에 주석 추가
/**
 * LEGACY: Supabase Auth Client
 * 
 * 현재 인증 시스템에 사용 중
 * TODO: NextAuth.js로 전환 예정
 * 
 * @deprecated 향후 제거 예정
 */
```

### 4. 환경변수 정리
`.env.example` 업데이트:
```env
# 레거시 (인증용)
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"

# NCP PostgreSQL (데이터베이스)
DATABASE_URL="postgresql://..."
```

## 결론

**현재 상태**: 데이터베이스는 NCP로 완전 전환, 인증은 Supabase 사용 중

**권장 접근**:
1. 즉시: Vercel 관련 제거 (설정, 의존성, 문서)
2. MVP 완료 후: NextAuth.js로 인증 시스템 전환
3. Supabase는 인증 전환 전까지 유지

**예상 타임라인**:
- Vercel 정리: 즉시 (30분)
- 문서 업데이트: 1시간
- NextAuth.js 전환: 2-3주 (별도 작업)

---

**작성자**: Claude AI Assistant
**최종 업데이트**: 2025-10-25
