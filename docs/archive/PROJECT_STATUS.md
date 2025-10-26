# 🎯 AED Check 2025 - 프로젝트 현황

> **최종 업데이트**: 2025-10-09
> **프로젝트 상태**: ✅ 운영 중 (v2.1)
> **배포 환경**: Vercel + Supabase

---

## 📊 시스템 개요

**AED Check 2025**는 전국 자동심장충격기(AED) 점검 및 관리를 위한 웹 기반 시스템입니다.

### 핵심 기능
- ✅ 전국 AED 장비 등록 정보 관리 (80,900+ 대)
- ✅ 모바일 최적화된 현장 점검 시스템
- ✅ 구비의무기관 자동 매칭
- ✅ 역할 기반 접근 제어 (RBAC)
- ✅ 실시간 데이터 동기화
- ✅ 스냅샷 자동 갱신 시스템 (v2.1)

---

## 🚀 최근 구현 완료 (2025-10-09)

### ✅ 스냅샷 자동 갱신 시스템 v2.1
**목적**: 점검 세션의 데이터 신선도 보장

**구현 내용**:
1. **Week 1**: 데이터베이스 스키마 확장
   - `original_snapshot`, `current_snapshot` 컬럼 추가
   - 자동 갱신 상태 추적 컬럼 추가

2. **Week 2**: API 듀얼 모드
   - 읽기: `current_snapshot || device_info` (이중 읽기)
   - 쓰기: 양쪽 모두 저장 (하위 호환성)
   - 백그라운드 자동 갱신 (12h/24h 정책)

3. **Week 3**: 프론트엔드 전환
   - React Query 훅 구현
   - 타임스탬프 기반 폴링
   - 모든 점검 스텝 컴포넌트 업데이트

4. **3단계 데이터 저장**:
   - `original_data`: 시작 시점 등록 데이터 (감사 추적)
   - `registered_data`: 완료 시점 최신 데이터 (변경 감지)
   - `inspected_data`: 점검자 입력 데이터 (현장 확인)

**다음 단계**: Week 4 (2025-10-16) - `device_info` 컬럼 제거

**관련 문서**:
- [점검 데이터 흐름 최종 문서](./planning/inspection-data-flow-final.md)
- [스냅샷 갱신 구현 계획](./planning/snapshot-refresh-implementation.md) (구현 완료)

---

## 📚 문서 구조

### 📋 Planning (계획 문서)
| 문서 | 상태 | 설명 |
|-----|------|------|
| [inspection-data-flow-final.md](./planning/inspection-data-flow-final.md) | ✅ 최신 | 점검 시스템 전체 흐름 (v2.1) |
| [inspection-system-design.md](./planning/inspection-system-design.md) | ✅ 유효 | 점검 시스템 설계 문서 |
| [inspection-assignment-policy.md](./planning/inspection-assignment-policy.md) | ✅ 유효 | 점검 할당 정책 |
| [persistent-mapping-architecture.md](./planning/persistent-mapping-architecture.md) | ✅ 유효 | 구비의무기관 매칭 아키텍처 |
| [mandatory-institution-matching-plan.md](./planning/mandatory-institution-matching-plan.md) | ✅ 유효 | 매칭 알고리즘 계획 |
| [map-sync-ux.md](./planning/map-sync-ux.md) | ✅ 유효 | 지도 동기화 UX |
| [signup-approval-improvements.md](./planning/signup-approval-improvements.md) | ✅ 유효 | 회원가입 승인 개선 |
| [snapshot-refresh-implementation.md](./planning/snapshot-refresh-implementation.md) | ⚠️ 구현 완료 | v2.1로 통합됨 |

### 📖 Reference (참조 문서)
| 문서 | 설명 |
|-----|------|
| [architecture-overview.md](./reference/architecture-overview.md) | 전체 아키텍처 개요 |
| [aed-data-schema.md](./reference/aed-data-schema.md) | 데이터 스키마 정의 |
| [health-center-complete-guide.md](./reference/health-center-complete-guide.md) | 보건소 기능 가이드 |
| [quick-start-guide.md](./reference/quick-start-guide.md) | 빠른 시작 가이드 |

### 🔐 Security (보안)
| 문서 | 설명 |
|-----|------|
| [aed-data-access-rules.md](./security/aed-data-access-rules.md) | 데이터 접근 규칙 |
| [aed-data-security-plan.md](./security/aed-data-security-plan.md) | 보안 계획 |

### 🛠️ Setup (설정)
| 문서 | 설명 |
|-----|------|
| [vercel-deployment-guide.md](./setup/vercel-deployment-guide.md) | Vercel 배포 가이드 |
| [kakao-map-guide.md](./setup/kakao-map-guide.md) | 카카오 맵 설정 |
| [seed-instructions.md](./setup/seed-instructions.md) | 초기 데이터 설정 |

### 📊 Reports (보고서)
| 문서 | 날짜 | 설명 |
|-----|------|------|
| [2025-10-06-map-init-policy.md](./reports/2025-10-06-map-init-policy.md) | 2025-10-06 | 지도 초기화 정책 |
| [2025-10-05-target-matching.md](./reports/2025-10-05-target-matching.md) | 2025-10-05 | 타겟 매칭 보고서 |
| [2025-10-04-schema-correction.md](./reports/2025-10-04-schema-correction.md) | 2025-10-04 | 스키마 수정 보고서 |

---

## 🏗️ 기술 스택

### Frontend
- **Next.js 15.5.2** (App Router, React 18)
- **TypeScript** - 타입 안정성
- **Tailwind CSS** - 스타일링
- **Zustand** - 클라이언트 상태 관리
- **React Query** - 서버 상태 관리
- **Kakao Map API** - 지도 기능

### Backend
- **Supabase** (PostgreSQL + Auth + Storage)
- **Edge Functions** - 서버리스 함수
- **Row Level Security** - 데이터 보안

### Deployment
- **Vercel** - 프론트엔드 호스팅
- **GitHub Actions** - CI/CD
- **Supabase** - 데이터베이스 호스팅

---

## 📁 데이터베이스 구조

### 핵심 테이블

| 테이블 | 레코드 수 | 역할 |
|-------|----------|------|
| `aed_data` | 80,900+ | AED 등록 데이터 원본 |
| `inspection_sessions` | 3,047 | 점검 진행 세션 (임시) |
| `inspections` | 45+ | 완료된 점검 기록 (영구) |
| `inspection_assignments` | 18 | 점검 할당 |
| `user_profiles` | 1+ | 사용자 프로필 |
| `organizations` | 291 | 조직 (보건소 등) |
| `aed_target_mapping` | 80,900+ | AED-기관 매칭 (영속성) |
| `target_list_2024` | 26,724 | 2024년 구비의무기관 |

**상세 스키마**: [aed-data-schema.md](./reference/aed-data-schema.md)

---

## 🔑 권한 체계

### 사용자 역할
- **master**: 시스템 전체 관리
- **ministry_admin**: 소방청 관리자
- **regional_admin**: 광역시도 관리자
- **local_admin**: 보건소 관리자
- **emergency_center_admin**: 응급센터 관리자

### 접근 제어
```typescript
// 보건소 관리자 예시
{
  canViewAllRegions: false,
  requiresRegionFilter: true,
  requiresCityFilter: true,
  allowedRegionCodes: ['DAE'],  // 대구
  allowedCityCodes: ['22070']   // 달서구
}
```

---

## 🧪 테스트 전략

### 수동 테스트
- ✅ 점검 시작 → 완료 플로우
- ✅ 스냅샷 자동 갱신 (12h/24h)
- ✅ 3단계 데이터 저장
- ✅ 역할 기반 접근 제어
- ✅ 모바일 반응형

### 데이터 검증
```sql
-- 3단계 데이터 저장 확인
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN original_data IS NOT NULL THEN 1 END) as with_original,
  COUNT(CASE WHEN registered_data IS NOT NULL THEN 1 END) as with_registered,
  COUNT(CASE WHEN inspected_data IS NOT NULL THEN 1 END) as with_inspected
FROM inspections
WHERE created_at >= '2025-10-09';
```

---

## 📈 성능 지표

### API 응답 시간
- 세션 조회 (GET): **~50ms**
- 세션 생성 (POST): **~400ms**
- 백그라운드 갱신: **비차단** (응답 영향 없음)

### 데이터 신선도
- Draft 세션: **12시간** 이내 자동 갱신
- Active 세션: **24시간** 이내 자동 갱신
- 점검 진행 중: **갱신 차단** (혼란 방지)

---

## 🚧 알려진 제한사항

### 1. 타입 에러 (기존 코드)
일부 레거시 코드에 타입 에러 존재 (신규 기능과 무관):
- `AEDDataPageClient.tsx`: Set<unknown> 타입
- `dashboard/page.tsx`: region_code 오타
- 기타 컴포넌트 타입 불일치

**영향**: 없음 (빌드 성공, 런타임 정상)

### 2. device_info 컬럼 (임시)
- **현재**: 하위 호환성 유지 중
- **예정**: 2025-10-16 제거
- **이유**: Week 4 모니터링 기간

---

## 🔄 Week 4 체크리스트 (2025-10-16)

1주일 모니터링 후 확인:

```sql
-- 1. device_info 사용 현황
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN device_info IS NOT NULL THEN 1 END) as with_device_info,
  COUNT(CASE WHEN current_snapshot IS NOT NULL THEN 1 END) as with_snapshot
FROM inspection_sessions;

-- 2. 3단계 데이터 저장 확인
SELECT
  COUNT(*) as total_inspections,
  COUNT(CASE WHEN original_data IS NOT NULL THEN 1 END) as with_original,
  COUNT(CASE WHEN registered_data IS NOT NULL THEN 1 END) as with_registered,
  COUNT(CASE WHEN inspected_data IS NOT NULL THEN 1 END) as with_inspected
FROM inspections
WHERE created_at >= '2025-10-09';

-- 3. 문제없으면 device_info 제거
-- ALTER TABLE inspection_sessions DROP COLUMN device_info;
```

---

## 📞 문의 및 지원

### 개발팀
- **이메일**: shout530@naver.com
- **GitHub**: [truth0530/AED_check2025](https://github.com/truth0530/AED_check2025)

### 버그 리포트
1. GitHub Issues 사용
2. 재현 단계 상세히 기술
3. 스크린샷 첨부

---

## 📝 변경 이력

| 날짜 | 버전 | 변경 사항 |
|------|------|----------|
| 2025-10-09 | v2.1 | 스냅샷 자동 갱신 + 3단계 데이터 저장 |
| 2025-10-05 | v2.0 | 점검 시스템 재설계 |
| 2025-10-03 | v1.9 | 구비의무기관 매칭 |
| 2025-09-25 | v1.8 | 보건소 기능 추가 |
| 2025-09-06 | v1.0 | 프로젝트 시작 |

---

## 🎯 다음 마일스톤

### Q4 2025 목표
- [ ] Week 4: device_info 제거
- [ ] 점검 리포트 자동 생성
- [ ] 대시보드 통계 강화
- [ ] 모바일 앱 (React Native)

---

**최종 업데이트**: 2025-10-09
**작성자**: Claude Code
**버전**: 2.1
