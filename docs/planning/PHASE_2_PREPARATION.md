# Phase 2 준비: API 리팩토링을 위한 기초 설계

**작성일**: 2025-11-07
**상태**: Phase 2 시작 전 최종 점검 문서
**목표**: Equipment-Centric Architecture로의 API 리팩토링을 위한 기초 구조 정의

---

## 1. 정규화 함수 통합 전략

### 1.1 현황 분석

#### 주요 발견사항
- **이미 구현된 정규화/매핑 함수**: 40개 이상
- **주요 구현 위치**:
  - lib/constants/regions.ts (23개 함수)
  - lib/constants/cities.ts (5개 함수)
  - lib/utils/area-code.ts (4개 함수)
  - lib/utils/aed-data-mapper.ts (7개 함수)
  - lib/utils/healthCenterMatcher.ts (8개 메서드)
  - 기타 (6개 함수)

**상세 참고**: [docs/REGION_NORMALIZATION_QUICK_REFERENCE.md](../REGION_NORMALIZATION_QUICK_REFERENCE.md) (TOP 10 함수)

#### 현재 사용 중인 정규화 함수
| 함수명 | 위치 | 용도 | 사용 파일 |
|--------|------|------|----------|
| `normalizeRegionName()` | lib/constants/regions.ts | 지역명(full name) → 약어 변환 | lib/aed/dashboard-queries.ts |
| `mapRegionCodesToDbLabels()` | lib/constants/regions.ts | 지역 코드 배열 → 한글명 변환 | app/api/aed-data/route.ts |
| `mapCityCodeToGugun()` | lib/constants/regions.ts (line 293) | city_code → 시군구명 | lib/auth/access-control.ts |

#### Phase 1에서 새로 추가된 함수
| 함수명 | 위치 | 용도 | 상태 |
|--------|------|------|------|
| `normalizeAedDataRegion()` | lib/constants/regions.ts (line 480) | e-gen raw data 모든 변형 → 정식명칭 | ✅ 추가됨 |
| `getNormalizedRegionLabel()` | lib/constants/regions.ts (line 565) | 지역 코드 → 정식명칭 | ✅ 추가됨 |

### 1.2 통합 구조

#### 단일 진실 소스 (Single Source of Truth)
모든 정규화 함수는 **lib/constants/regions.ts** 및 **lib/utils/area-code.ts**에 중앙화:

```
lib/
├── constants/
│   └── regions.ts          # 지역명 정규화 함수 (중앙화)
│       ├── normalizeRegionName()         # full name → abbr
│       ├── mapRegionCodesToDbLabels()    # codes → labels
│       ├── normalizeAedDataRegion()      # raw data → standard
│       └── getNormalizedRegionLabel()    # code → label
│
└── utils/
    └── area-code.ts        # 시군구 관련 유틸리티 (중앙화)
        ├── mapCityCodeToGugun()         # city_code → gugun
        └── (추가 헬퍼 함수들)
```

#### Phase 2 수정 대상 API들의 import 패턴
```typescript
// ✅ 모든 API에서 동일한 import
import {
  normalizeAedDataRegion,
  getNormalizedRegionLabel,
  mapCityCodeToGugun,
  // ... 필요한 함수들
} from '@/lib/constants/regions';
import { /* 추가 헬퍼 */ } from '@/lib/utils/area-code';
```

### 1.3 정규화 함수 사용 규칙

#### Rule 1: 대시보드/집계 쿼리
```typescript
// ✅ 옳은 방법: 쿼리 결과 이후 정규화
const results = await prisma.aed_data.findMany();
const normalized = results.map(r => ({
  ...r,
  sido: normalizeAedDataRegion(r.sido)
}));

// ❌ 틀린 방법: 원본 데이터 수정
// UPDATE aed_data SET sido = normalizeAedDataRegion(sido);
```

#### Rule 2: API 필터링
```typescript
// ✅ 옳은 방법: 사용자 입력값 정규화 후 쿼리
const userSido = req.body.sido; // 사용자가 "경기" 입력
const normalizedSido = normalizeAedDataRegion(userSido);
const equipment = await prisma.aed_data.findMany({
  where: { sido: normalizedSido }
});

// ❌ 틀린 방법: 정규화 없이 직접 쿼리
// const equipment = await prisma.aed_data.findMany({
//   where: { sido: userSido }  // "경기"로 검색 → "경기도" 데이터 누락
// });
```

#### Rule 3: 권한 검증
```typescript
// ✅ 옳은 방법: 사용자 권한과 equipment 메타데이터 정규화
const userRegion = userProfile.region_code; // "GYE"
const normalizedRegion = getNormalizedRegionLabel(userRegion); // "경기도"

const aedRegion = equipment.sido; // "경기" (raw data)
const normalizedAedRegion = normalizeAedDataRegion(aedRegion); // "경기도"

const hasAccess = normalizedRegion === normalizedAedRegion;
```

---

## 2. 권한 검증 헬퍼 설계

### 2.1 Equipment Access Filter Architecture

#### 개념
- 모든 데이터 접근은 **equipment metadata** (region, city, jurisdiction)을 기준으로 제어
- 사용자 role에 따라 다른 필터 적용

#### 구현 위치
```
lib/auth/
├── access-control.ts       # 기존 (수정 필요)
│   ├── resolveAccessScope()    # 기존 권한 범위 계산
│   └── buildEquipmentFilter()  # NEW: equipment 필터 빌드
│
└── equipment-access.ts     # NEW: 전용 헬퍼 모듈
    ├── canAccessEquipment()
    ├── buildEquipmentWhereClause()
    ├── getAccessibleRegions()
    └── getAccessibleCities()
```

### 2.2 권한 검증 모델

| Role | Region Scope | City Scope | Jurisdiction Scope | 필터 기준 |
|------|-------------|-----------|-------------------|----------|
| **master_admin** | 전국 (null) | 전국 (null) | 전국 (null) | 제한 없음 |
| **regional_admin** | 소속 시도 | 자유 선택 | 자유 선택 | `region_code IN (...)` |
| **local_admin** | 소속 시도 | 소속 시군구 | 두 가지 기준 선택 | `region_code = ? AND (gugun = ? OR jurisdiction = ?)` |

### 2.3 Equipment Access Helper 인터페이스

#### buildEquipmentFilter() - Core Helper
```typescript
interface AccessScope {
  userRole: 'master_admin' | 'regional_admin' | 'local_admin';
  regionCodes: string[] | null;      // null = 전국
  cityCodes: string[] | null;        // null = 전체 시군구
  jurisdictionCodes: string[] | null; // null = jurisdiction 기준 제외
}

interface EquipmentFilter {
  sido?: string | { in: string[] };
  gugun?: string | { in: string[] };
  jurisdiction_health_center?: string | { in: string[] };
}

function buildEquipmentFilter(scope: AccessScope): EquipmentFilter {
  // Role별 필터 구성 로직
}
```

#### canAccessEquipment() - Permission Check
```typescript
interface Equipment {
  equipment_serial: string;
  sido: string;
  gugun: string;
  jurisdiction_health_center?: string;
  // ... 기타 필드
}

function canAccessEquipment(
  equipment: Equipment,
  scope: AccessScope,
  basis: 'address' | 'jurisdiction' = 'address'
): boolean {
  // 사용자가 특정 equipment에 접근할 수 있는지 확인
}
```

#### getAccessibleRegions() - Scope 계산
```typescript
function getAccessibleRegions(scope: AccessScope): string[] {
  // scope.regionCodes를 정규화된 지역명으로 변환
  if (scope.regionCodes === null) {
    return REGION_LONG_LABELS; // 전국
  }
  return scope.regionCodes.map(getNormalizedRegionLabel);
}
```

### 2.4 Phase 2 수정 대상 API별 적용

| API Endpoint | 현재 상태 | Phase 2 변경사항 |
|-------------|----------|------------------|
| `/api/aed-data` | ✅ 정규화됨 | buildEquipmentFilter() 적용 |
| `/api/inspections` | ⏳ 미분석 | buildEquipmentFilter() 도입 |
| `/api/inspection-schedules` | ⏳ 미분석 | buildEquipmentFilter() 도입 |
| `/api/inspection-assignments` | ⏳ 미분석 | buildEquipmentFilter() 도입 |
| `/api/inspections/export` | ⏳ 신규 | buildEquipmentFilter() 설계 |
| `/api/dashboard/*` | ✅ 정규화됨 | 정규화 함수 통합만 필요 |

---

## 3. Phase 2.1 실행 계획

### 3.1 순서

1. **lib/auth/equipment-access.ts** 작성
   - buildEquipmentFilter() 구현
   - canAccessEquipment() 구현
   - 단위 테스트

2. **각 API 순차 리팩토링** (아래 순서대로)
   - `/api/inspections/list` (기본 목록)
   - `/api/inspections/[id]` (상세 조회)
   - `/api/inspection-schedules` (스케줄)
   - `/api/inspection-assignments` (할당)
   - `/api/inspections/export` (내보내기)

3. **통합 테스트**
   - 각 role별 접근 권한 검증
   - 정규화 함수 일관성 확인

### 3.2 테스트 체크리스트

```
Phase 2.1 Analysis & Design
├── Equipment Access Helper 테스트
│   ├── [ ] master_admin: 전국 데이터 접근
│   ├── [ ] regional_admin: 소속 시도만 접근
│   └── [ ] local_admin: 소속 시군구만 접근
│
├── 정규화 함수 일관성 테스트
│   ├── [ ] normalizeAedDataRegion("경기도") === normalizeAedDataRegion("경기")
│   ├── [ ] mapCityCodeToGugun("seogwipo") === "서귀포시"
│   └── [ ] 모든 API에서 동일한 함수 사용
│
└── FK 제약 검증
    ├── [ ] equipment_serial FK 작동
    ├── [ ] 고아 레코드 방지
    └── [ ] Cascade delete 동작
```

---

## 4. 문서 및 참고 자료

### 4.1 관련 문서
- [docs/implementation/EQUIPMENT_CENTRIC_ARCHITECTURE_MIGRATION.md](../implementation/EQUIPMENT_CENTRIC_ARCHITECTURE_MIGRATION.md)
- [docs/migration/MIGRATION_STATUS.md](../migration/MIGRATION_STATUS.md)
- [CLAUDE.md - 권한 체계](../../CLAUDE.md#3-핵심-권한-체계-절대-불변)

### 4.2 코드 참고
- [lib/constants/regions.ts](../../lib/constants/regions.ts) - 정규화 함수들
- [lib/auth/access-control.ts](../../lib/auth/access-control.ts) - 권한 검증 로직
- [lib/utils/area-code.ts](../../lib/utils/area-code.ts) - 시군구 매핑

---

## 5. 최종 체크리스트 (Phase 2 시작 전)

- [x] Phase 1 완료
  - [x] FK 마이그레이션 배포
  - [x] Access Control city_code 버그 수정
  - [x] 정규화 함수 생성

- [x] Phase 2 준비
  - [x] 정규화 함수 중앙화 계획 확정
  - [x] 권한 검증 헬퍼 인터페이스 설계
  - [x] API 리팩토링 순서 정의

- [ ] Phase 2.1 시작
  - [ ] equipment-access.ts 작성
  - [ ] 단위 테스트 작성
  - [ ] 현행 API 분석 시작

---

**다음 단계**: Phase 2.1 - 현행 API 분석 및 Equipment Access Helper 구현
