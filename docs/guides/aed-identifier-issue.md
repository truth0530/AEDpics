# AED 식별자 체계 정리 및 데이터베이스 설계 개선안

## 📚 프로젝트 문서 목차

### 핵심 문서
- [README.md](../README.md) - 프로젝트 개요
- [docs/AED_IDENTIFIER_ISSUE.md](AED_IDENTIFIER_ISSUE.md) - AED 식별자 이슈 (현재 문서)
- [docs/AED_DATA_QUERY_ARCHITECTURE.md](archive/2025-09/deprecated_plans/AED_DATA_QUERY_ARCHITECTURE.md) - AED 데이터 조회 구조
- [supabase/migrations/04_aed_tables.sql](../supabase/migrations/04_aed_tables.sql) - 현재 테이블 구조

## 🚨 핵심 이슈: 관리번호는 고유 식별자가 아님

### 현재 잘못된 이해
```sql
-- ❌ 잘못된 스키마
CREATE TABLE aed_devices (
    management_number TEXT UNIQUE NOT NULL,  -- 이것이 고유 ID라고 잘못 이해
    equipment_number TEXT,                   -- 부수적 정보로 오해
    ...
);
```

### 실제 관계 구조
```
관리번호(1) ─────┬──── 장비연번(N)
                 │
예시:            ├──── AED-001-A (장비 1)
MNG-2025-001     ├──── AED-001-B (장비 2)
                 └──── AED-001-C (장비 3)
```

## 1. 식별자 체계 재정의

### 1.1 식별자 구분

| 구분 | 필드명 | 역할 | 특성 |
|------|--------|------|------|
| **Primary Key** | equipment_number | 개별 AED 장비 고유 식별 | UNIQUE, NOT NULL |
| **Group Key** | management_number | 여러 장비를 묶는 관리 단위 | NOT NULL, 중복 가능 |
| **System ID** | id (UUID) | 시스템 내부 고유 ID | AUTO GENERATED |

### 1.2 실제 사용 예시

```typescript
// 단일 장비 조회
SELECT * FROM aed_devices WHERE equipment_number = 'AED-2025-001A';

// 관리번호로 그룹 조회 (여러 장비)
SELECT * FROM aed_devices WHERE management_number = 'MNG-2025-001';

// 결과: 동일 관리번호에 여러 장비
[
  { equipment_number: 'AED-001-A', management_number: 'MNG-2025-001', ... },
  { equipment_number: 'AED-001-B', management_number: 'MNG-2025-001', ... },
  { equipment_number: 'AED-001-C', management_number: 'MNG-2025-001', ... }
]
```

## 2. 데이터베이스 스키마 개선안

### 2.1 Option A: 단일 테이블 (현재 구조 수정)

```sql
-- 기존 테이블 수정
ALTER TABLE aed_devices
  DROP CONSTRAINT IF EXISTS aed_devices_management_number_key;

ALTER TABLE aed_devices
  ADD CONSTRAINT aed_devices_equipment_number_unique
  UNIQUE (equipment_number);

-- 인덱스 재구성
DROP INDEX IF EXISTS idx_aed_management;
CREATE UNIQUE INDEX idx_aed_equipment ON aed_devices(equipment_number);
CREATE INDEX idx_aed_management_group ON aed_devices(management_number);
```

### 2.2 Option B: 정규화된 구조 (권장)

```sql
-- 1. 관리단위 테이블
CREATE TABLE aed_management_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    management_number TEXT UNIQUE NOT NULL,
    group_name TEXT,
    managing_organization_id UUID REFERENCES organizations(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 개별 장비 테이블
CREATE TABLE aed_devices_normalized (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_number TEXT UNIQUE NOT NULL,  -- 실제 PK
    management_group_id UUID REFERENCES aed_management_groups(id),

    -- 장비 고유 정보
    model_name TEXT,
    manufacturer TEXT,
    serial_number TEXT,
    manufacturing_date DATE,

    -- 설치 정보
    installation_date DATE,
    installation_location TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),

    -- 상태 정보
    battery_expiry_date DATE,
    pad_expiry_date DATE,
    operation_status TEXT,
    last_inspection_date DATE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 뷰로 호환성 유지
CREATE VIEW aed_devices_view AS
SELECT
    d.*,
    g.management_number,
    g.group_name
FROM aed_devices_normalized d
LEFT JOIN aed_management_groups g ON d.management_group_id = g.id;
```

## 3. 영향 분석 및 마이그레이션 전략

### 3.1 영향받는 컴포넌트

| 컴포넌트 | 파일 경로 | 수정 필요 사항 |
|----------|-----------|----------------|
| API Route | `/app/api/aed-data/route.ts` | equipment_number 기반 조회 |
| Data Table | `/app/aed-data/components/DataTable.tsx` | 키 값 변경 |
| Types | `/packages/types/aed.ts` | 타입 정의 수정 |
| RPC Functions | Supabase Functions | 조회 로직 변경 |

### 3.2 단계별 마이그레이션

#### Phase 1: 데이터 검증 (1일)
```sql
-- 현재 데이터 상태 확인
SELECT
    management_number,
    COUNT(*) as equipment_count,
    STRING_AGG(equipment_number, ', ') as equipment_list
FROM aed_devices
GROUP BY management_number
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;
```

#### Phase 2: 스키마 수정 (1일)
1. 백업 생성
2. 인덱스 재구성
3. 제약조건 변경
4. 뷰 생성

#### Phase 3: 애플리케이션 수정 (2일)
1. 타입 정의 수정
2. API 엔드포인트 수정
3. UI 컴포넌트 수정
4. 테스트 코드 수정

#### Phase 4: 데이터 정합성 검증 (1일)
1. 조회 테스트
2. 성능 측정
3. 롤백 계획 준비

## 4. UI/UX 개선 제안

### 4.1 테이블 표시 개선

```typescript
interface AEDTableRow {
  // 주 식별자
  equipment_number: string;      // 고유 ID로 표시

  // 그룹 정보
  management_number: string;      // 관리 그룹
  sibling_count?: number;        // 같은 관리번호 장비 수

  // 기존 정보
  installation_institution: string;
  location: string;
  // ...
}

// UI 표현 예시
<TableCell>
  <div className="flex flex-col">
    <span className="font-mono text-sm">{equipment_number}</span>
    <span className="text-xs text-gray-500">
      관리: {management_number}
      {sibling_count > 1 && `(+${sibling_count - 1}대)`}
    </span>
  </div>
</TableCell>
```

### 4.2 그룹 뷰 추가

```typescript
// 관리번호 기준 그룹 뷰
interface GroupViewMode {
  mode: 'individual' | 'grouped';

  // 그룹 모드일 때
  groupedData: {
    management_number: string;
    equipment_list: AEDDevice[];
    total_count: number;
    summary: {
      all_normal: boolean;
      expired_count: number;
      needs_inspection: number;
    };
  }[];
}
```

## 5. API 개선안

### 5.1 RESTful 엔드포인트 재설계

```typescript
// 개별 장비 조회
GET /api/aed-devices/:equipment_number

// 관리번호로 그룹 조회
GET /api/aed-groups/:management_number

// 리스트 조회 (뷰 모드 지원)
GET /api/aed-data?view=individual|grouped
```

### 5.2 GraphQL 스키마 (장기 계획)

```graphql
type AEDDevice {
  id: ID!
  equipmentNumber: String!  # 고유 식별자
  managementGroup: ManagementGroup
  # ...
}

type ManagementGroup {
  id: ID!
  managementNumber: String!
  devices: [AEDDevice!]!
  deviceCount: Int!
}

query GetAEDByEquipment($equipmentNumber: String!) {
  aedDevice(equipmentNumber: $equipmentNumber) {
    id
    equipmentNumber
    managementGroup {
      managementNumber
      deviceCount
    }
  }
}
```

## 6. 리스크 관리

### 6.1 잠재적 문제

| 리스크 | 영향도 | 완화 방안 |
|--------|--------|-----------|
| 기존 코드 의존성 | 높음 | 점진적 마이그레이션 |
| 데이터 정합성 | 높음 | 트랜잭션 사용, 백업 |
| 성능 저하 | 중간 | 인덱스 최적화 |
| 사용자 혼란 | 낮음 | UI 안내 추가 |

### 6.2 롤백 계획

```sql
-- 롤백 스크립트 준비
BEGIN;
  -- 1. 뷰 제거
  DROP VIEW IF EXISTS aed_devices_view;

  -- 2. 원래 제약조건 복원
  ALTER TABLE aed_devices
    ADD CONSTRAINT aed_devices_management_number_key
    UNIQUE (management_number);

  -- 3. 인덱스 복원
  DROP INDEX idx_aed_equipment;
  CREATE INDEX idx_aed_management ON aed_devices(management_number);
ROLLBACK; -- or COMMIT if confirmed
```

## 7. 실행 계획

### 즉시 조치 (Day 1)
1. [ ] 데이터베이스에서 실제 중복 관리번호 확인
2. [ ] 영향도 분석 보고서 작성
3. [ ] 이해관계자 동의 획득

### 단기 조치 (Week 1)
1. [ ] Option A 또는 B 선택
2. [ ] 마이그레이션 스크립트 작성
3. [ ] 테스트 환경에서 검증
4. [ ] 애플리케이션 코드 수정

### 중기 개선 (Month 1)
1. [ ] 프로덕션 마이그레이션
2. [ ] 모니터링 강화
3. [ ] 성능 최적화
4. [ ] 문서화 완료

## 8. 결론 및 권장사항

### 핵심 포인트
1. **장비연번(equipment_number)**이 실제 고유 식별자
2. **관리번호(management_number)**는 그룹 식별자 (1:N 관계)
3. 현재 스키마는 이 관계를 잘못 반영하고 있음

### 권장 조치
1. **즉시**: 문서와 주석에 이 관계를 명확히 표시
2. **단기**: Option A로 빠른 수정 (제약조건 변경)
3. **장기**: Option B로 정규화된 구조 구축

### 예상 효과
- 데이터 무결성 향상
- 조회 성능 개선
- 유지보수성 증대
- 확장성 확보

---

**작성일**: 2025-09-20
**최종 업데이트**: 2025-10-03
**작성자**: AED 점검 시스템 개발팀
**상태**: ⚠️ 미해결 (현재 스키마에 여전히 문제 존재)
**우선순위**: 🔴 높음 (데이터 무결성 직접 영향)
**예상 소요시간**: 5일 (분석 1일 + 개발 3일 + 테스트 1일)

> **현재 상태**: 이 이슈는 아직 해결되지 않았습니다. `aed_data` 테이블은 여전히 `management_number`를 UNIQUE로 설정하고 있어, 1:N 관계를 올바르게 표현하지 못하고 있습니다.