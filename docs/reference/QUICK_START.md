# AED 시스템 빠른 시작 및 보건소 관리 가이드

**최종 업데이트**: 2025-10-09
**상태**: ✅ 운영 중
**통합 문서**: quick-start-guide.md, health-center-complete-guide.md

---

## 📋 목차

1. [빠른 시작](#빠른-시작)
2. [보건소 관리 시스템](#보건소-관리-시스템)
3. [개발 가이드](#개발-가이드)
4. [문제 해결](#문제-해결)

---

## 빠른 시작

### 즉시 실행 체크리스트

#### 1. 환경 확인
```bash
# Node.js 및 npm 버전 확인
node --version  # v18 이상
npm --version   # v9 이상

# 프로젝트 의존성 설치
npm install

# 빌드 테스트
npm run build
```

#### 2. Supabase 설정
```bash
# Supabase Dashboard 접속
# https://supabase.com/dashboard/project/aieltmidsagiobpuebvv

# 주요 마이그레이션 실행 (순서대로):
# 1. 01_initial_schema.sql        - 기본 테이블
# 2. 02_initial_data.sql          - 초기 데이터
# 3. 03_rls_policies.sql          - 보안 정책
# 4. 04_aed_tables.sql            - AED 테이블
# 5. 05_team_management.sql       - 팀 관리 시스템

# 총 22개 테이블이 생성됩니다
```

#### 3. 환경변수 설정
```bash
# .env.local 파일 확인
NEXT_PUBLIC_SUPABASE_URL=https://aieltmidsagiobpuebvv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[기존 키 유지]
RESEND_API_KEY=[기존 키 유지]

# 기능 플래그
NEXT_PUBLIC_FEATURE_QUICK_INSPECT=true
NEXT_PUBLIC_FEATURE_SCHEDULE=true
```

#### 4. 개발 서버 시작
```bash
npm run dev
# http://localhost:3000 접속
```

#### 5. 첫 번째 테스트
1. `/auth/signup` - Master 계정 회원가입
2. `/admin/users` - 사용자 관리 확인
3. `/inspection/priority` - 우선순위 메뉴 확인
4. `/inspection/field` - 현장점검 메뉴 확인

### 주요 기능

- ✅ AED 데이터 조회 및 필터링 (80,900+ 레코드)
- ✅ 8단계 점검 시스템
- ✅ 스냅샷 자동 갱신 (v2.1)
- ✅ 구비의무기관 매핑 (80,900+ 매핑)
- ✅ 점검 할당 시스템 (18개 할당)
- ✅ 지도 기반 탐색 (Kakao Maps)
- ✅ 역할별 권한 관리 (6개 역할)

---

## 보건소 관리 시스템

### 현황 (2025년 9월 기준)

| 데이터 소스 | 보건소 수 | AED 수 | 비고 |
|------------|----------|---------|------|
| **Supabase aed_data** | 341개 | 81,331개 | 실제 운영 중 |
| **회원가입 페이지** | 261개 | - | organizations.ts |
| **인트라넷 데이터** | 247개 | - | 시도명 포함 48개 |
| **공공데이터** | 244개 | - | 2022년 기준 |

### 시도별 보건소 분포

```
경기도: 51개 (최다)
서울특별시: 28개
전라남도: 26개
경상남도: 25개
경상북도: 25개
제주특별자치도: 6개
```

### 보건소 ID 기반 시스템

#### 핵심 개념
- 각 보건소에 고유 UUID 부여
- 명칭 변경과 무관하게 ID로 연결
- 다양한 명칭 변형을 별칭으로 관리

#### 데이터베이스 구조

```sql
-- 1. 보건소 마스터 테이블
CREATE TABLE health_centers (
    id UUID PRIMARY KEY,
    code VARCHAR(20) UNIQUE,     -- HC_SEOUL_GANGNAM
    canonical_name TEXT,          -- 표준 명칭
    sido VARCHAR(50),
    gugun VARCHAR(50),
    is_active BOOLEAN DEFAULT true
);

-- 2. 별칭 관리 테이블
CREATE TABLE health_center_aliases (
    health_center_id UUID REFERENCES health_centers(id),
    alias_name TEXT,
    alias_type VARCHAR(50)        -- original, variation, legacy
);

-- 3. 변경 이력 테이블
CREATE TABLE health_center_name_history (
    health_center_id UUID,
    old_name TEXT,
    new_name TEXT,
    changed_at TIMESTAMPTZ,
    reason TEXT
);
```

### 명칭 정규화

#### 현재 정규화 함수

```typescript
function normalizeHealthCenterName(name: string): string {
  return name
    .replace(/\s+/g, '')              // 공백 제거
    .replace(/특별시|광역시|특별자치시|특별자치도|도/g, '') // 시도 제거
    .replace(/보건소$/g, '')           // '보건소' 제거
    .toLowerCase();
}
```

**검증 결과**: 충돌 없음 ✅

#### Fuzzy Matching 알고리즘

```sql
CREATE FUNCTION find_health_center_id(input_name TEXT)
RETURNS UUID AS $$
BEGIN
    -- 1. 정확한 표준명 매칭
    SELECT id INTO result FROM health_centers
    WHERE canonical_name = input_name;
    IF FOUND THEN RETURN result; END IF;

    -- 2. 별칭 테이블 검색
    SELECT health_center_id INTO result FROM health_center_aliases
    WHERE alias_name = input_name;
    IF FOUND THEN RETURN result; END IF;

    -- 3. 정규화 후 매칭
    -- 4. 부분 매칭 (ILIKE)

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

### API 엔드포인트

#### 보건소 ID 동기화
```typescript
// POST /api/health-centers/sync
{
  "healthCenterName": "달성군보건소",
  "userId": "user-uuid"
}

// 응답
{
  "success": true,
  "healthCenter": {
    "id": "uuid-456",
    "canonicalName": "대구광역시 달성군 보건소"
  }
}
```

#### 보건소 목록 조회
```typescript
// 지역별 보건소 목록
GET /api/health-centers?region=서울특별시

// 모든 지역 목록
POST /api/health-centers
```

### 회원가입 프로세스 개선

```typescript
// 1. 동적 로딩
const { data } = await fetch('/api/health-centers?region=' + region);

// 2. health_center_id 저장
const profile = {
  ...formData,
  health_center_id: selectedCenter.id,
  organization_text: selectedCenter.name // fallback
};
```

### 데이터 조회

```typescript
// ID 기반 조회 (권장)
const { data } = await supabase
  .from('aed_data')
  .select('*')
  .eq('health_center_id', user.health_center_id);

// Fallback: 텍스트 기반
if (!user.health_center_id) {
  const centerId = await findHealthCenterId(user.organization_text);
  // ...
}
```

### 특수 케이스 처리 (분소/지소)

```typescript
const BRANCH_OFFICE_MAPPINGS = {
  '화성시동부보건소': '화성시 보건소',
  '화성시서부보건소': '화성시 보건소',
  '화성시동탄보건소': '화성시 보건소',
  '평택시송탄보건소': '평택시 보건소',
  '평택시안중보건소': '평택시 보건소',
  // ... 18개 분소/지소 매핑
};
```

---

## 개발 가이드

### 프로젝트 구조

```
aed-check-system/
├── app/                          # Next.js 15 App Router
│   ├── (authenticated)/          # 인증된 사용자 영역
│   │   ├── inspection/           # 점검 시스템
│   │   │   ├── priority/         # 우선순위 메뉴
│   │   │   └── field/            # 현장점검 메뉴
│   │   ├── admin/                # 관리자 페이지
│   │   └── dashboard/            # 대시보드
│   ├── api/                      # API Routes
│   └── auth/                     # 인증 페이지
├── components/                   # 재사용 가능 컴포넌트
├── lib/                          # 유틸리티 및 서비스
│   ├── services/                 # 비즈니스 로직
│   └── supabase/                 # Supabase 클라이언트
├── docs/                         # 문서
│   ├── planning/                 # 계획 문서
│   ├── reference/                # 참고 문서
│   └── reports/                  # 보고서
└── supabase/                     # DB 마이그레이션
```

### 핵심 작업 순서

1. **Day 1**: AED 목록 화면 구현
2. **Day 2**: 점검 수행 화면 구현
3. **Day 3**: 대시보드 데이터 연결
4. **Day 4-5**: 모바일 최적화 및 PWA

### 기술 스택

| 카테고리 | 기술 | 버전 |
|---------|------|------|
| **프레임워크** | Next.js | 15.5.2 |
| **언어** | TypeScript | 5.x |
| **스타일링** | Tailwind CSS | 3.x |
| **데이터베이스** | Supabase (PostgreSQL) | Latest |
| **인증** | Supabase Auth | Latest |
| **지도** | Kakao Maps API | Latest |
| **상태관리** | React Query | 5.x |

---

## 문제 해결

### 빌드 오류

```bash
# TypeScript 오류 체크
npx tsc --noEmit

# ESLint 오류 수정
npm run lint -- --fix

# 캐시 삭제
rm -rf .next node_modules package-lock.json
npm install
```

### Supabase 연결 오류

1. Supabase Dashboard에서 프로젝트 상태 확인
2. 환경변수 값 재확인 (.env.local)
3. Network 탭에서 API 호출 상태 확인
4. RLS 정책 확인 (Row Level Security)

### 보건소 매칭 오류

**문제**: 회원 프로필의 보건소명과 AED 데이터의 보건소명 불일치

**해결**:
1. `/api/health-centers/sync` 호출하여 보건소 ID 동기화
2. `user_profiles.health_center_id` 업데이트
3. 이후 ID 기반 조회 사용

```typescript
// 동기화 API 호출
const response = await fetch('/api/health-centers/sync', {
  method: 'POST',
  body: JSON.stringify({
    healthCenterName: user.organization_text,
    userId: user.id
  })
});

// 이후 조회
const { data } = await supabase
  .from('aed_data')
  .select('*')
  .eq('health_center_id', user.health_center_id);
```

### 데이터 갱신 오류

**문제**: aed_data가 매일 새벽 3시에 완전 교체되어 매핑 정보 소실

**해결**: `aed_target_mapping` 테이블 사용
- 영속성 보장: 매일 데이터 교체 후에도 매핑 정보 유지
- 자동 복원 트리거: 새 데이터 INSERT 시 자동으로 매핑 복원
- 80,900+ 매핑 레코드 운영 중

---

## 참고 문서

### 핵심 문서
- [README.md](../../README.md) - 프로젝트 개요
- [CLAUDE.md](../../CLAUDE.md) - AI 개발 가이드라인
- [PROJECT_STATUS.md](../PROJECT_STATUS.md) - 프로젝트 현황

### 시스템 문서
- [INSPECTION_SYSTEM.md](../planning/INSPECTION_SYSTEM.md) - 점검 시스템 통합
- [MAPPING_SYSTEM.md](../planning/MAPPING_SYSTEM.md) - 매핑 시스템 통합
- [OPERATIONAL_POLICIES.md](../planning/OPERATIONAL_POLICIES.md) - 운영 정책

### 기술 문서
- [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md) - 시스템 아키텍처
- [AED_DATA_SCHEMA.md](./AED_DATA_SCHEMA.md) - 데이터 스키마
- [AED_DATA_ACCESS_RULES.md](./AED_DATA_ACCESS_RULES.md) - 접근 규칙

### 데이터베이스
- [supabase/README.md](../../supabase/README.md) - DB 통합 관리

---

## 마이그레이션 상태

### ✅ 완료 (Phase 1-2)
- [x] 데이터베이스 구축 (341개 보건소)
- [x] 초기 데이터 마이그레이션
- [x] `/api/health-centers/sync` API
- [x] 보건소 ID 기반 시스템

### 🔶 진행중 (Phase 3)
- [ ] 회원가입 페이지 수정
- [ ] 프로필 페이지 업데이트
- [ ] 데이터 조회 로직 변경

### ⏳ 대기 (Phase 4)
- [ ] 기존 회원 마이그레이션
- [ ] 매핑 실패 케이스 처리
- [ ] 데이터 정합성 검증

---

## 품질 지표

### 보건소 매칭
- 매칭 성공률: 95% 이상 목표
- API 응답시간: 500ms 이내
- Fallback 비율: 5% 이하

### 시스템 성능
- 세션 조회: ~60ms (평균)
- 스냅샷 갱신: 2-3초 (비차단)
- API 응답: < 200ms (p95)

---

**작성**: AED Smart Check 개발팀
**최종 업데이트**: 2025-10-09
**상태**: ✅ 운영 중
**보건소**: 341개, AED: 80,900+
