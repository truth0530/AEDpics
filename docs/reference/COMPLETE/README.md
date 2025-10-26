# 완료된 참조 문서 아카이브

이 폴더에는 완료되었거나 레거시가 된 참조 문서들이 보관되어 있습니다.

최종 업데이트: 2025-10-26

---

## 폴더 구조

### 상위 폴더 (docs/reference/)
**현재 활성 참조 문서들**

- 아키텍처 및 시스템 설계
- 가이드라인 및 정책
- 현재 사용 중인 스키마 및 분석

### 이 폴더 (docs/reference/COMPLETE/)
**완료되었거나 레거시가 된 참조 문서들**

---

## 완료된 문서 목록

### Supabase 레거시 (2025-10-25~10-26 마이그레이션 완료)

**SUPABASE_SCHEMA_COMPLETE.md**
- Supabase 데이터베이스 스키마 완전 참조
- Migration 69 기반
- 23개 테이블 구조 상세
- 상태: 레거시 (NCP PostgreSQL + Prisma로 전환 완료)
- 용도: 과거 구조 참조용

**MIGRATION_GUIDE.md**
- Supabase 마이그레이션 가이드
- 43개 활성 마이그레이션 설명
- 실행 순서 및 주의사항
- 상태: 레거시 (NCP 전환 완료)
- 용도: Supabase 시절 참조용

**NCP_VS_SUPABASE_AUTH.md**
- NCP 자체 인증 vs Supabase Auth 비교
- 기능 비교표 및 구현 난이도 분석
- NextAuth.js 도입 근거
- 작성일: 2025-10-25
- 상태: 완료 (NextAuth.js 도입 완료)
- 용도: 의사결정 과정 참조

---

### 프로젝트 관리 (완료된 작업 보고서)

**PROJECT_RESTRUCTURE_SUMMARY.md**
- 프로젝트 구조 재정리 완료 보고서
- 문서, 스크립트, 설정 파일 정리
- 작업일: 2025-10-25
- 상태: 완료
- 용도: 재구조화 히스토리 참조

**NCP_PRIORITY_REVIEW.md**
- NCP 전환 프로젝트 우선순위 재검토
- 국정원 인증 획득을 위한 최적 경로 수립
- 검토일: 2025-10-25
- 상태: 완료 (마이그레이션 완료)
- 용도: 우선순위 결정 과정 참조

**SUPABASE_VERCEL_CLEANUP_REPORT.md**
- Supabase/Vercel 정리 작업 보고서
- 데이터베이스, 인증 시스템 전환 현황
- 작성일: 2025-10-25
- 상태: 완료
- 용도: 정리 작업 히스토리

---

## 주요 정보

### Supabase → NCP 마이그레이션

**완료 시기**: 2025-10-25~10-26

**주요 변경사항**:
- 데이터베이스: Supabase PostgreSQL → NCP PostgreSQL
- ORM: Supabase SDK → Prisma
- 인증: Supabase Auth → NextAuth.js
- 배포: Vercel → NCP (예정)

**결과**:
- 31개 API 엔드포인트 Prisma 전환
- 117개 페이지 성공 빌드
- 국정원 인증 요구사항 100% 충족

---

## 문서 활용 가이드

### Supabase 레거시 문서
**언제 참조?**
- 과거 데이터베이스 구조 확인 필요 시
- Supabase 마이그레이션 히스토리 확인 시
- 의사결정 과정 검토 시

**현재 참조 문서**:
- Prisma 스키마: `/prisma/schema.prisma`
- 마이그레이션 현황: `/docs/migration/MIGRATION_STATUS.md`
- NCP 가이드: `/docs/migration/NCP_마이그레이션_완전가이드.md`

### 프로젝트 관리 문서
**언제 참조?**
- 프로젝트 구조 변경 이력 확인 시
- 우선순위 결정 근거 확인 시
- 과거 작업 내용 검토 시

**현재 참조 문서**:
- 프로젝트 개요: `/README.md`
- 아키텍처: `/docs/reference/architecture-overview.md`
- 현재 상태: `/docs/migration/MIGRATION_STATUS.md`

---

## NCP 마이그레이션 영향

**주의**: 이 문서들은 Supabase 기반 시스템을 전제로 작성되었습니다.

### 변경된 부분
- 데이터베이스 연결 방법
- 인증 메커니즘
- API 구조
- 배포 플랫폼

### 여전히 유효한 부분
- 비즈니스 로직 개념
- 데이터 모델 구조 (대부분)
- 권한 체계
- 시스템 요구사항

---

## 참고사항

이 문서들은 히스토리 및 참조 목적으로 보관됩니다.
현재 시스템 참조는 상위 폴더의 활성 문서들을 참조하세요.

**현재 활성 참조 문서**:
- [REGION_CODE_GUIDELINES.md](../REGION_CODE_GUIDELINES.md) - 지역 코드 가이드라인
- [SECURITY_GUIDELINES.md](../SECURITY_GUIDELINES.md) - 보안 가이드라인
- [QUICK_START.md](../QUICK_START.md) - 빠른 시작 가이드
- [NCP_AUTH_STRATEGY.md](../NCP_AUTH_STRATEGY.md) - NCP 인증 전략
- [architecture-overview.md](../architecture-overview.md) - 아키텍처 개요
- [aed-data-*.md](../) - AED 데이터 관련 문서

---

작성자: Claude Code
문서 버전: 1.0
최종 업데이트: 2025-10-26
