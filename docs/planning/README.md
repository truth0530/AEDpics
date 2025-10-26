# Planning 문서 디렉토리

이 폴더는 AEDpics의 **계획 및 설계 문서**를 포함합니다.

최종 업데이트: 2025-10-26

> **중요**: 2025-10-25~10-26에 NCP PostgreSQL + Prisma 마이그레이션이 완료되었습니다.
> 일부 계획 문서는 Supabase 기반으로 작성되었으므로 구현 세부사항이 변경되었을 수 있습니다.
> 마이그레이션 세부사항은 [docs/migration/](../migration/) 폴더를 참조하세요.

---

## 문서 구조

### 현재 활성 문서 (진행 중 또는 향후 계획)

#### 성능 최적화

1. **[PERFORMANCE_OPTIMIZATION_MASTER.md](./PERFORMANCE_OPTIMIZATION_MASTER.md)** 📍 **시작점**
   - 전체 성능 최적화 작업 통합 문서
   - 진행 상황, 완료된 작업, 향후 계획 포함
   - **새로운 작업자는 여기서 시작하세요**

2. **[LAYOUT_IMPROVEMENT_PLAN.md](./LAYOUT_IMPROVEMENT_PLAN.md)**
   - 레이아웃 개선 상세 계획 (Stage 1~3)
   - 사용자 워크플로우 분석
   - 충돌 및 퇴보 검토 완료

3. **[PAGINATION_OPTIMIZATION_2025.md](./PAGINATION_OPTIMIZATION_2025.md)**
   - 페이지네이션 최적화 상세 계획 (Phase 0~3)
   - Phase 0 완료, Phase 1~3 대기
   - 기술적 구현 세부사항

4. **[PAGINATION_OPTIMIZATION_RISKS.md](./PAGINATION_OPTIMIZATION_RISKS.md)**
   - Phase 2, 3의 잠재적 위험 요소 분석
   - 8가지 주요 문제점 및 해결 방안

#### 기타 계획 문서

5. **[ADVANCED_OPTIMIZATION_ROADMAP.md](./ADVANCED_OPTIMIZATION_ROADMAP.md)**
   - 고급 최적화 로드맵

6. **[INSPECTION_SYSTEM.md](./INSPECTION_SYSTEM.md)**
   - 점검 시스템 계획

7. **[MAPPING_2025_STRATEGY.md](./MAPPING_2025_STRATEGY.md)**
   - 2025 매핑 전략

8. **[MAPPING_SYSTEM.md](./MAPPING_SYSTEM.md)**
   - 매핑 시스템 설계

9. **[OPERATIONAL_POLICIES.md](./OPERATIONAL_POLICIES.md)**
   - 운영 정책

10. **[기타 개선 계획 문서들]**
    - MODEL_VALIDATION_IMPROVEMENT_PLAN.md
    - FIELD_VALIDATION_IMPROVEMENTS.md
    - PHOTO_STORAGE_OPTIMIZATION.md
    - TIER3_LONG_TERM_OPTIMIZATION.md
    - DOCUMENTATION_REDUCTION_PLAN.md

---

### 완료된 작업 (COMPLETE 폴더)

**위치**: [COMPLETE/](./COMPLETE/)

완료된 계획, 작업 보고서, 분석 문서가 보관되어 있습니다.

주요 완료 작업:
- Phase 0: 커서 페이지네이션 (2025-10-17)
- Layout Stage 1: 레이아웃 개선 (2025-10-17)
- 필터링 시스템 개선 (2025-10-18)
- 회원가입/승인 프로세스 개선 (2025-10-03)

자세한 내용은 [COMPLETE/README.md](./COMPLETE/README.md)를 참조하세요.

---

### 아카이브 (참고용)

**위치**: [archive/](./archive/)

초기 성능 분석 문서들이 보관되어 있습니다.
Phase 0 완료로 많은 내용이 통합 및 현행화되었습니다.

---

## 빠른 시작 가이드

### 새로운 작업자

1. **[PERFORMANCE_OPTIMIZATION_MASTER.md](./PERFORMANCE_OPTIMIZATION_MASTER.md)** 읽기
   - 현재 상태 파악
   - 완료된 작업 확인
   - 다음 단계 이해

2. **[COMPLETE/README.md](./COMPLETE/README.md)** 검토
   - 완료된 작업 이력 확인
   - Phase 0, Layout Stage 1 등 이해

3. **마이그레이션 현황 확인**
   - [docs/migration/MIGRATION_STATUS.md](../migration/MIGRATION_STATUS.md)
   - NCP PostgreSQL + Prisma 전환 완료 상태

4. **테스트 환경 확인**
   - 브라우저에서 레이아웃 테스트
   - 스크롤 작동 확인
   - 페이지네이션 작동 확인

### 향후 최적화 작업 시작 시

1. **[PAGINATION_OPTIMIZATION_2025.md](./PAGINATION_OPTIMIZATION_2025.md)** - Phase 1 섹션 읽기
2. Prisma 기반으로 구현 방법 재검토
3. 테스트 및 문서 업데이트

### 위험 요소 평가 시

1. **[PAGINATION_OPTIMIZATION_RISKS.md](./PAGINATION_OPTIMIZATION_RISKS.md)** 읽기
2. NCP 환경에서의 위험 요소 재평가
3. 투자 대비 효과 분석

---

## 현재 상태 (2025-10-26)

### 완료된 Phase

| Phase | 상태 | 완료일 | 문서 |
|-------|------|--------|------|
| **Phase 0** | ✅ 완료 | 2025-10-17 | [COMPLETE/PHASE_0_APPLIED.md](./COMPLETE/PHASE_0_APPLIED.md) |
| **Layout Stage 1** | ✅ 완료 | 2025-10-17 | [COMPLETE/LAYOUT_STAGE1_COMPLETE.md](./COMPLETE/LAYOUT_STAGE1_COMPLETE.md) |
| **Filtering Strategy** | ✅ 완료 | 2025-10-17 | [COMPLETE/FILTERING_STRATEGY_ANALYSIS.md](./COMPLETE/FILTERING_STRATEGY_ANALYSIS.md) |
| **Filter Bugs** | ✅ 완료 | 2025-10-18 | [COMPLETE/COMPLETE_FILTER_FIX_2025-10-18.md](./COMPLETE/COMPLETE_FILTER_FIX_2025-10-18.md) |
| **Signup/Approval** | ✅ 완료 | 2025-10-03 | [COMPLETE/signup-approval-improvements.md](./COMPLETE/signup-approval-improvements.md) |
| **NCP Migration** | ✅ 완료 | 2025-10-26 | [../migration/MIGRATION_STATUS.md](../migration/MIGRATION_STATUS.md) |

### 대기 중인 Phase

| Phase | 상태 | 우선순위 | 문서 |
|-------|------|---------|------|
| **Layout Stage 2** | ⏳ 대기 | 낮음 | [LAYOUT_IMPROVEMENT_PLAN.md](./LAYOUT_IMPROVEMENT_PLAN.md) |
| **Layout Stage 3** | ⏳ 대기 | 낮음 | [LAYOUT_IMPROVEMENT_PLAN.md](./LAYOUT_IMPROVEMENT_PLAN.md) |
| **Pagination Phase 1** | ⏳ 대기 | 낮음 | [PAGINATION_OPTIMIZATION_2025.md](./PAGINATION_OPTIMIZATION_2025.md) |
| **Pagination Phase 2-3** | ⚠️ 검토 필요 | 낮음 | [PAGINATION_OPTIMIZATION_RISKS.md](./PAGINATION_OPTIMIZATION_RISKS.md) |

### 주요 성과

#### 완료된 최적화 (Supabase 시절)
- 커서 페이지네이션 버그 수정
- 조회 가능 개수: 50 → 1,000개 (20배)
- 조건 변경 시간: 10초 → 2초 (80% 단축)
- 레이아웃 개선 완료
- 필터 버그 4가지 모두 수정

#### NCP 마이그레이션 (2025-10-25~10-26)
- Supabase → NCP PostgreSQL 전환 완료
- Supabase SDK → Prisma ORM 전환 완료
- 31개 API 엔드포인트 구현
- 117개 페이지 성공 빌드
- 국정원 인증 요구사항 100% 충족

#### 향후 최적화
- NCP 환경에서의 성능 재평가 필요
- Prisma 기반 최적화 전략 수립

---

## 🔄 문서 업데이트 규칙

### 언제 업데이트하나?

- ✅ Phase 완료 시
- ✅ 주요 버그 수정 시
- ✅ 아키텍처 변경 시
- ✅ 새로운 이슈 발견 시

### 어떻게 업데이트하나?

1. **마스터 문서 먼저 업데이트**
   - [PERFORMANCE_OPTIMIZATION_MASTER.md](./PERFORMANCE_OPTIMIZATION_MASTER.md)의 "현재 상태" 섹션
   - "변경 이력" 테이블에 항목 추가

2. **세부 문서 업데이트**
   - 해당 Phase 문서에 상세 내용 추가
   - 예: Phase 1 완료 시 → [PAGINATION_OPTIMIZATION_2025.md](./PAGINATION_OPTIMIZATION_2025.md) 업데이트

3. **완료 보고서 생성**
   - 예: `PHASE_1_APPLIED.md` 생성
   - 변경 파일, 테스트 결과, 효과 측정 포함

### 아카이브 규칙

- 통합되어 더 이상 사용되지 않는 문서는 `archive/` 폴더로 이동
- 아카이브된 문서 상단에 경고 메시지 추가
- 마스터 문서에서 아카이브 이유 명시

---

## 📞 문의 및 기여

### 문제 발견 시

1. [PERFORMANCE_OPTIMIZATION_MASTER.md](./PERFORMANCE_OPTIMIZATION_MASTER.md)의 "문의 및 이슈" 섹션 참조
2. GitHub Issues에 등록
3. 관련 문서 링크 포함

### 문서 개선 제안

- Pull Request 환영
- 명확성, 정확성, 완전성 개선
- 예제 및 다이어그램 추가

---

## 변경 이력

| 날짜 | 변경 사항 | 담당자 |
|------|----------|--------|
| 2025-10-03 | 회원가입/승인 프로세스 개선 완료 | 개발팀 |
| 2025-10-17 | planning 폴더 README 생성 | 개발팀 |
| 2025-10-17 | Phase 0 완료 (커서 페이지네이션) | 개발팀 |
| 2025-10-17 | Layout Stage 1 완료 | 개발팀 |
| 2025-10-17 | 필터링 전략 분석 완료 | 개발팀 |
| 2025-10-18 | 필터 버그 모두 수정 | 개발팀 |
| 2025-10-18 | DB 필터링 완전 전환 | 개발팀 |
| 2025-10-25~26 | NCP 마이그레이션 완료 | 개발팀 |
| 2025-10-26 | COMPLETE 폴더 생성 및 문서 분류 | Claude Code |
| 2025-10-26 | README 업데이트 (NCP 마이그레이션 반영) | Claude Code |

---

**최종 업데이트**: 2025년 10월 26일
**다음 리뷰**: NCP 환경 안정화 후 성능 재평가
