# Planning 문서 인덱스

AEDpics 계획 및 설계 문서의 전체 인덱스입니다.

최종 업데이트: 2025-10-26

---

## 문서 구조

```
docs/planning/
├── INDEX.md (이 문서)
├── README.md (폴더 안내)
├── PERFORMANCE_OPTIMIZATION_MASTER.md (마스터 문서)
├── [15개 활성 계획 문서]
├── COMPLETE/ (완료된 작업)
│   ├── README.md
│   └── [10개 완료 보고서]
└── archive/ (초기 문서)
    └── [3개 아카이브]
```

---

## 활성 문서 (현재 사용 중)

### 성능 최적화

**[PERFORMANCE_OPTIMIZATION_MASTER.md](./PERFORMANCE_OPTIMIZATION_MASTER.md)** - 시작점
- 전체 성능 최적화 통합 문서
- 완료된 작업 및 향후 계획
- 우선순위: 최우선

**[LAYOUT_IMPROVEMENT_PLAN.md](./LAYOUT_IMPROVEMENT_PLAN.md)**
- 레이아웃 개선 계획 (Stage 1~3)
- Stage 1 완료, Stage 2-3 대기
- 사용자 워크플로우 분석
- 우선순위: 낮음

**[PAGINATION_OPTIMIZATION_2025.md](./PAGINATION_OPTIMIZATION_2025.md)**
- 페이지네이션 최적화 (Phase 0~3)
- Phase 0 완료, Phase 1-3 대기
- 커서 페이지네이션 세부사항
- 우선순위: 낮음

**[PAGINATION_OPTIMIZATION_RISKS.md](./PAGINATION_OPTIMIZATION_RISKS.md)**
- Phase 2-3 위험 요소 분석
- 8가지 문제점 및 해결 방안
- 투자 대비 효과 분석
- 우선순위: 참고용

---

### 시스템 설계

**[INSPECTION_SYSTEM.md](./INSPECTION_SYSTEM.md)**
- 점검 시스템 계획
- 점검 프로세스 설계
- 우선순위: 중간

**[MAPPING_SYSTEM.md](./MAPPING_SYSTEM.md)**
- 매핑 시스템 설계
- 외부 시스템 연동
- 우선순위: 중간

**[MAPPING_2025_STRATEGY.md](./MAPPING_2025_STRATEGY.md)**
- 2025 매핑 전략
- 연간 계획
- 우선순위: 중간

---

### 개선 계획

**[MODEL_VALIDATION_IMPROVEMENT_PLAN.md](./MODEL_VALIDATION_IMPROVEMENT_PLAN.md)**
- 모델 검증 개선 계획
- 데이터 정합성 강화
- 우선순위: 중간

**[FIELD_VALIDATION_IMPROVEMENTS.md](./FIELD_VALIDATION_IMPROVEMENTS.md)**
- 필드 검증 개선
- 입력 유효성 검사
- 우선순위: 중간

**[PHOTO_STORAGE_OPTIMIZATION.md](./PHOTO_STORAGE_OPTIMIZATION.md)**
- 사진 저장소 최적화
- 스토리지 비용 절감
- 우선순위: 낮음

**[TIER3_LONG_TERM_OPTIMIZATION.md](./TIER3_LONG_TERM_OPTIMIZATION.md)**
- Tier 3 장기 최적화
- 대규모 확장 계획
- 우선순위: 낮음

---

### 운영 및 정책

**[OPERATIONAL_POLICIES.md](./OPERATIONAL_POLICIES.md)**
- 시스템 운영 정책
- 관리 지침
- 우선순위: 중간

**[DOCUMENTATION_REDUCTION_PLAN.md](./DOCUMENTATION_REDUCTION_PLAN.md)**
- 문서화 간소화 계획
- 중복 제거 전략
- 우선순위: 낮음

**[ADVANCED_OPTIMIZATION_ROADMAP.md](./ADVANCED_OPTIMIZATION_ROADMAP.md)**
- 고급 최적화 로드맵
- 장기 비전
- 우선순위: 참고용

---

## 완료된 문서 (COMPLETE 폴더)

### Phase 0: 커서 페이지네이션 (2025-10-17)

**[COMPLETE/PHASE_0_APPLIED.md](./COMPLETE/PHASE_0_APPLIED.md)**
- 커서 페이지네이션 버그 수정
- 조회 가능 개수: 50 → 100
- 성능 50% 개선
- 작업 시간: 1시간

---

### Layout Stage 1 (2025-10-17)

**[COMPLETE/LAYOUT_STAGE1_READY.md](./COMPLETE/LAYOUT_STAGE1_READY.md)**
- 문서화 및 준비 완료

**[COMPLETE/LAYOUT_STAGE1_COMPLETE.md](./COMPLETE/LAYOUT_STAGE1_COMPLETE.md)**
- 레이아웃 개선 완료
- 스크롤 영역 분리
- 조건 변경 시간: 10초 → 2초
- 작업 시간: 1시간

---

### 필터링 시스템 (2025-10-17~18)

**[COMPLETE/FILTERING_STRATEGY_ANALYSIS.md](./COMPLETE/FILTERING_STRATEGY_ANALYSIS.md)**
- 메모리 vs DB 필터링 분석 (600+ 라인)
- 최종 결정: 메모리 필터링 유지
- 분석 완료: 2025-10-17

**[COMPLETE/DB_FILTERING_MIGRATION_PLAN.md](./COMPLETE/DB_FILTERING_MIGRATION_PLAN.md)**
- DB 필터링 전환 계획
- 복합 필터 집계 오류 해결
- 우선순위: P0

**[COMPLETE/DB_FILTERING_COMPLETE.md](./COMPLETE/DB_FILTERING_COMPLETE.md)**
- DB 필터링 전환 완료
- totalCount 일관성 확보
- 작업 시간: 2시간

**[COMPLETE/FILTER_BUG_FIX_2025-10-18.md](./COMPLETE/FILTER_BUG_FIX_2025-10-18.md)**
- 필터 버그 긴급 수정
- 4가지 필터 문제 해결

**[COMPLETE/COMPLETE_FILTER_FIX_2025-10-18.md](./COMPLETE/COMPLETE_FILTER_FIX_2025-10-18.md)**
- 모든 필터 버그 완전 수정
- 브라우저 테스트 완료

---

### 관할보건소 쿼리 (2025-10-18)

**[COMPLETE/JURISDICTION_QUERY_IMPLEMENTATION_2025-10-18.md](./COMPLETE/JURISDICTION_QUERY_IMPLEMENTATION_2025-10-18.md)**
- queryCriteria='jurisdiction' 구현
- 공백 불일치 해결
- RPC Summary 개선

---

### 회원가입/승인 (2025-10-03)

**[COMPLETE/signup-approval-improvements.md](./COMPLETE/signup-approval-improvements.md)**
- 회원가입/승인 프로세스 개선
- Phase 1-3 완료 (12/13 항목, 92.3%)
- 안정성, 보안성, 사용성 개선

---

## 아카이브 (참고용)

**[archive/speedup_25.10.16.md](./archive/speedup_25.10.16.md)**
- 초기 성능 분석 (64KB)
- 구현률: 16%
- Phase 0로 통합됨

**[archive/SPEEDUP_QUICK_FIX.md](./archive/SPEEDUP_QUICK_FIX.md)**
- 캐싱 긴급 수정
- 일부 적용됨

**[archive/SPEEDUP_IMPLEMENTATION_AUDIT.md](./archive/SPEEDUP_IMPLEMENTATION_AUDIT.md)**
- 구현 감사 보고서
- Phase 0로 해결됨

---

## 빠른 참조

### 현재 상태 확인
→ [README.md](./README.md) - 전체 현황

### 성능 최적화 시작
→ [PERFORMANCE_OPTIMIZATION_MASTER.md](./PERFORMANCE_OPTIMIZATION_MASTER.md)

### 완료된 작업 확인
→ [COMPLETE/README.md](./COMPLETE/README.md)

### 마이그레이션 현황
→ [../migration/MIGRATION_STATUS.md](../migration/MIGRATION_STATUS.md)

---

## 현황 요약 (2025-10-26)

### 완료된 최적화
- Phase 0: 커서 페이지네이션 ✅
- Layout Stage 1: 레이아웃 개선 ✅
- 필터링 시스템 개선 ✅
- 회원가입/승인 개선 ✅

### NCP 마이그레이션
- Supabase → NCP PostgreSQL ✅
- Supabase SDK → Prisma ORM ✅
- 31개 API 구현 ✅
- 117개 페이지 빌드 ✅
- 국정원 인증 요구사항 충족 ✅

### 대기 중인 계획
- Layout Stage 2-3 (낮은 우선순위)
- Pagination Phase 1-3 (낮은 우선순위)
- 각종 시스템 개선 계획 (중간 우선순위)

### 권장 사항
- NCP 환경 안정화 우선
- 성능 재평가 후 최적화 계획 수립
- Prisma 기반 최적화 전략 검토

---

## NCP 마이그레이션 영향

**주의**: 대부분의 계획 문서는 Supabase 기반 시스템을 전제로 작성되었습니다.

### 변경 사항
- 데이터베이스: Supabase PostgreSQL → NCP PostgreSQL
- ORM: Supabase SDK → Prisma
- 성능 특성: 변경될 수 있음
- API 구조: 재설계됨

### 영향 받는 문서
- PAGINATION_OPTIMIZATION_2025.md - Prisma 기반 재검토 필요
- PERFORMANCE_OPTIMIZATION_MASTER.md - 업데이트 필요
- 기타 성능 관련 문서 - 재평가 필요

### 유효한 계획
- 레이아웃 개선 계획 (프론트엔드)
- 운영 정책 (시스템 중립적)
- 시스템 설계 (개념적)

---

## 우선순위 가이드

### 최우선 (즉시 참조)
- PERFORMANCE_OPTIMIZATION_MASTER.md
- README.md
- COMPLETE/README.md

### 높은 우선순위 (구현 예정)
- (현재 없음 - NCP 안정화 우선)

### 중간 우선순위 (향후 검토)
- INSPECTION_SYSTEM.md
- MAPPING_SYSTEM.md
- OPERATIONAL_POLICIES.md
- MODEL_VALIDATION_IMPROVEMENT_PLAN.md

### 낮은 우선순위 (선택적)
- LAYOUT_IMPROVEMENT_PLAN.md (Stage 2-3)
- PAGINATION_OPTIMIZATION_2025.md (Phase 1-3)
- PHOTO_STORAGE_OPTIMIZATION.md
- TIER3_LONG_TERM_OPTIMIZATION.md

### 참고용
- PAGINATION_OPTIMIZATION_RISKS.md
- ADVANCED_OPTIMIZATION_ROADMAP.md
- DOCUMENTATION_REDUCTION_PLAN.md
- archive/* (아카이브)

---

작성자: Claude Code
문서 버전: 1.0
최종 업데이트: 2025-10-26
