# AED 시스템 아키텍처 개요

## 📚 프로젝트 문서 목차

### 핵심 문서
- [README.md](../README.md) - 프로젝트 개요 및 시작 가이드
- [CLAUDE.md](../CLAUDE.md) - AI 개발 가이드라인
- [archive/2025-09/deprecated_plans/STAGE_EXECUTION_PLAN.md](../archive/2025-09/deprecated_plans/STAGE_EXECUTION_PLAN.md) - 5단계 실행 계획 (Stage 0-4)
- [archive/2025-09/deprecated_plans/OPTIMIZED_DEVELOPMENT_PLAN.md](../archive/2025-09/deprecated_plans/OPTIMIZED_DEVELOPMENT_PLAN.md) - 3주 집중 개발 계획
- [../current/CURRENT_STATUS.md](../current/CURRENT_STATUS.md) - 프로젝트 현재 상황

### 기술 문서
- [../reference/ARCHITECTURE_OVERVIEW.md](../reference/ARCHITECTURE_OVERVIEW.md) - 시스템 아키텍처 (현재 문서)
- [supabase/README.md](../supabase/README.md) - 데이터베이스 통합 관리
- [../reference/QUICK_START_GUIDE.md](../reference/QUICK_START_GUIDE.md) - 빠른 시작 가이드

## 시스템 구조

### Frontend (Next.js 15)
```
app/
├── dashboard/           # 관리자 대시보드 (완성)
├── admin/users/         # 사용자 관리 (완성)
├── tutorial2/           # 점검 시스템 (95% 완성)
├── inspection/          # 실제 점검 시스템 (신규)
├── devices/             # AED 목록 (신규)
└── auth/                # 인증 시스템 (90% 완성)
```

### Backend (Supabase)
```sql
-- 핵심 테이블 (완성) - 23개 테이블
-- 1. 기본 시스템
organizations         -- 17개 시도, 261개 보건소
user_profiles        -- 권한별 사용자 관리
aed_data             -- 81,331대 AED 정보 (Primary 테이블)
inspections          -- 점검 기록

-- 2. 점검 시스템 (2025-10 업데이트)
inspection_schedules         -- 점검 일정 관리
inspection_schedule_entries  -- 점검 일정 항목 (2025-10 추가)
inspection_sessions         -- 점검 세션 관리

-- inspection_status 컬럼으로 상태 관리:
-- - scheduled: 일정 추가됨
-- - in_progress: 점검 진행중
-- - completed: 점검 완료
-- - failed: 점검 실패

-- 3. 팀 관리 시스템 (완성)
team_members         -- 팀원 관리 (임시 점검원 포함)
team_permissions     -- 세분화된 권한 시스템
task_assignments     -- 업무 할당 및 추적
team_activity_logs   -- 팀 활동 기록

-- 4. 데이터 추적 시스템 (완성)
login_history              -- 로그인 이력 추적
organization_change_requests -- 소속 변경 워크플로우
profile_change_history     -- 프로필 변경 기록

-- 5. GPS 고급 분석 (완성)
gps_issues          -- GPS 이상 탐지 및 분류
gps_analysis_logs   -- 일일 자동 분석 로그

-- 6. 실시간 알림 시스템 (완성)
notifications          -- 실시간 알림
notification_templates  -- 알림 템플릿
```

### 권한 체계 (완성)
```typescript
const roles = {
  master: '시스템 최고 관리자',
  emergency_center_admin: '중앙응급의료센터 및 17개 시도 응급의료지원센터 (@nmc.or.kr)',
  ministry_admin: '보건복지부',
  regional_admin: '시도 담당자 (시청/도청)',
  local_admin: '보건소 담당자'
};

// 전국 권한 (@nmc.or.kr 도메인)
// - 중앙응급의료센터: 전국 데이터 조회, 기본 선택값 없음
// - 17개 시도 응급의료지원센터: 전국 데이터 조회, 해당 시도 기본 선택 (UI 편의)
```

## 데이터 구조 특징

### AED 지역 관리 이원화
```typescript
// 물리적 주소와 관할보건소 분리 관리
interface AEDLocation {
  // 물리적 위치
  region_code: string;      // 설치된 시도
  city_code: string;        // 설치된 시군구

  // 관리 주체
  jurisdiction_health_center: string;  // 관할보건소
}

// 조회 기준 선택
enum QueryCriteria {
  ADDRESS = 'address',           // 물리적 주소 기준
  JURISDICTION = 'jurisdiction'  // 관할보건소 기준
}
```

**특징**:
- AED 설치 위치와 관리 보건소가 다를 수 있음
- 보건소는 타 지역 AED도 관리 가능
- 사용자가 조회 기준을 선택하여 필터링

## 데이터 플로우

### 1. 점검 프로세스
```
사용자 로그인 → AED 선택 → 점검 수행 → 데이터 저장 → 동기화
```

### 2. 관리자 워크플로우
```
신규 가입 → 이메일 인증 → 승인 대기 → 관리자 승인 → 시스템 접근
```

### 3. 데이터 동기화
```
외부 e-gen 시스템 → Python 스크립트 → Supabase → 실시간 업데이트
```

## 기술 스택

### 검증된 기술 (유지)
- **Next.js 15**: App Router, SSR
- **TypeScript**: 타입 안전성
- **Tailwind CSS**: 반응형 디자인
- **Supabase**: DB, Auth, Realtime
- **PWA**: 모바일 최적화

### 새로 도입 (최소한)
- **React Query**: 서버 상태 관리
- **Zustand**: 클라이언트 상태 관리 (필요시)

## 성능 고려사항

### 대용량 데이터 처리
```typescript
// 페이지네이션 (81,331개 AED)
const PAGE_SIZE = 50;

// 가상화 스크롤 (대량 목록)
import { FixedSizeList } from 'react-window';

// 검색 최적화
const searchAEDs = debounce(searchTerm => {
  // 서버사이드 검색
}, 300);
```

### 캐싱 전략
```typescript
// React Query 캐싱
const staleTime = 5 * 60 * 1000; // 5분
const cacheTime = 30 * 60 * 1000; // 30분

// Supabase 캐싱
const { data } = useQuery(['aed-devices', filters],
  () => getAEDs(filters),
  { staleTime, cacheTime }
);
```

## 보안 구조

### 인증 (90% 완성)
- Supabase Auth
- 정부기관 이메일(@korea.kr, @nmc.or.kr) 우선, 개인 이메일은 임시 점검원
- 3단계 가입 프로세스

### 인가 (완성)
- Row Level Security (RLS)
- 권한별 데이터 접근 제어
- API 호출 로깅

### 데이터 보호
- HTTPS 강제
- 환경변수 암호화
- 민감정보 마스킹

## 배포 아키텍처

### 프로덕션 환경
```
Vercel (Frontend) → Supabase (Backend) → 외부 데이터 소스
```

### 모니터링
- Vercel Analytics
- Supabase Metrics
- Custom Error Tracking

### 백업 전략
- Supabase 자동 백업 (일일)
- 중요 설정 Git 백업
- 환경변수 안전 보관

## 확장성 고려

### 수평 확장
- Vercel Edge Functions
- Supabase Auto-scaling
- CDN 캐싱

### 수직 확장
- 데이터베이스 인덱스 최적화
- 쿼리 성능 튜닝
- 이미지 최적화

## 마이그레이션 전략

### 기존 시스템 → 새 시스템
1. **점진적 전환**: 기능별 단계적 마이그레이션
2. **데이터 일관성**: 실시간 동기화 유지
3. **사용자 교육**: 단계별 온보딩

### 장애 대응
- 서비스 중단 최소화
- 롤백 계획 수립
- 실시간 모니터링