# AED 중복 장비연번 처리 전략

## 📚 프로젝트 문서 목차

### 핵심 문서
- [README.md](../README.md) - 프로젝트 개요
- [docs/AED_IDENTIFIER_ISSUE.md](AED_IDENTIFIER_ISSUE.md) - AED 식별자 이슈
- [docs/AED_DUPLICATE_EQUIPMENT_STRATEGY.md](AED_DUPLICATE_EQUIPMENT_STRATEGY.md) - 중복 처리 전략 (현재 문서)
- [docs/AED_DATA_QUERY_ARCHITECTURE.md](archive/2025-09/deprecated_plans/AED_DATA_QUERY_ARCHITECTURE.md) - AED 데이터 조회 구조

## 🚨 현황: 81,331대 중 약 100여대 중복 장비연번 존재

### 문제점
1. **장비연번(equipment_number)**이 실제 고유 식별자여야 하나 약 0.12% 중복
2. 강제 UNIQUE 제약 추가 시 데이터 손실 위험
3. 중복 원인 불명확 (입력 오류, 시스템 오류, 실제 중복 장비)

### 핵심 원칙
- ❌ 무조건적인 중복 제거 금지
- ✅ 사용자에게 중복 상황 명확히 알림
- ✅ 데이터 정제는 사용자 확인 후 진행

## 1. 단계별 접근 전략

### Phase 1: 중복 현황 분석 및 가시화 (즉시)

#### 1.1 중복 검사 뷰 생성
```sql
-- 중복 장비연번 검사 뷰
CREATE OR REPLACE VIEW duplicate_equipment_analysis AS
WITH duplicate_counts AS (
  SELECT
    equipment_number,
    COUNT(*) as duplicate_count,
    STRING_AGG(DISTINCT management_number, ', ') as management_numbers,
    STRING_AGG(DISTINCT installation_institution, ' | ') as institutions,
    STRING_AGG(id::text, ', ') as device_ids,
    MIN(created_at) as first_created,
    MAX(updated_at) as last_updated
  FROM aed_devices
  WHERE equipment_number IS NOT NULL
    AND equipment_number != ''
  GROUP BY equipment_number
  HAVING COUNT(*) > 1
)
SELECT
  equipment_number,
  duplicate_count,
  management_numbers,
  institutions,
  device_ids,
  first_created,
  last_updated,
  CASE
    WHEN duplicate_count = 2 THEN '중복 (2개)'
    WHEN duplicate_count <= 5 THEN '다중 중복 (3-5개)'
    ELSE '심각 (6개 이상)'
  END as severity_level
FROM duplicate_counts
ORDER BY duplicate_count DESC, equipment_number;

-- 중복률 통계
CREATE OR REPLACE VIEW duplicate_statistics AS
SELECT
  COUNT(DISTINCT equipment_number) as unique_equipment_with_duplicates,
  SUM(duplicate_count) as total_duplicate_records,
  ROUND(
    (SUM(duplicate_count)::numeric /
    (SELECT COUNT(*) FROM aed_devices WHERE equipment_number IS NOT NULL))::numeric * 100,
    2
  ) as duplicate_percentage,
  MAX(duplicate_count) as max_duplicates_per_equipment,
  AVG(duplicate_count)::numeric(10,2) as avg_duplicates_per_equipment
FROM duplicate_equipment_analysis;
```

#### 1.2 시스템 ID 도입 (UUID 기반)
```sql
-- 기존 테이블은 유지하되, 시스템 고유 ID 활용
ALTER TABLE aed_devices
  ADD COLUMN IF NOT EXISTS system_unique_id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS duplicate_flag BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicate_group_id TEXT,
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';

-- 중복 플래그 업데이트
UPDATE aed_devices a
SET
  duplicate_flag = true,
  duplicate_group_id = equipment_number
WHERE equipment_number IN (
  SELECT equipment_number
  FROM aed_devices
  GROUP BY equipment_number
  HAVING COUNT(*) > 1
);
```

### Phase 2: UI/UX 개선 - 중복 가시화 (1-2일)

#### 2.1 테이블 표시 개선
```typescript
// components/DuplicateIndicator.tsx
interface DuplicateIndicatorProps {
  equipmentNumber: string;
  duplicateCount: number;
  verificationStatus: 'pending' | 'verified' | 'resolved';
}

export function DuplicateIndicator({
  equipmentNumber,
  duplicateCount,
  verificationStatus
}: DuplicateIndicatorProps) {
  if (duplicateCount <= 1) return null;

  const getSeverityColor = () => {
    if (duplicateCount === 2) return 'text-yellow-500 bg-yellow-500/10';
    if (duplicateCount <= 5) return 'text-orange-500 bg-orange-500/10';
    return 'text-red-500 bg-red-500/10';
  };

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ${getSeverityColor()}`}>
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" />
      </svg>
      <span className="text-xs font-medium">
        중복 {duplicateCount}개
      </span>
      {verificationStatus === 'pending' && (
        <span className="text-xs">확인필요</span>
      )}
    </div>
  );
}
```

#### 2.2 중복 관리 대시보드
```typescript
// app/(authenticated)/aed-duplicates/page.tsx
interface DuplicateManagementPageProps {
  // 중복 장비 전용 관리 페이지
}

export default function DuplicateManagementPage() {
  return (
    <div className="space-y-6">
      {/* 통계 위젯 */}
      <DuplicateStatsWidget />

      {/* 중복 그룹 리스트 */}
      <DuplicateGroupsList />

      {/* 액션 버튼 */}
      <DuplicateActions />
    </div>
  );
}
```

### Phase 3: 데이터 정제 프로세스 (2-3일)

#### 3.1 중복 원인 분류
```typescript
enum DuplicateReason {
  INPUT_ERROR = 'input_error',           // 입력 실수
  SYSTEM_MIGRATION = 'system_migration', // 시스템 이관 중 중복
  MANUFACTURER_ISSUE = 'manufacturer',   // 제조사 번호 중복
  LEGITIMATE_DUPLICATE = 'legitimate',   // 정당한 중복 (교체 등)
  UNKNOWN = 'unknown'                    // 원인 불명
}

interface DuplicateResolution {
  group_id: string;
  equipment_number: string;
  devices: AEDDevice[];
  reason: DuplicateReason;
  resolution_action: 'merge' | 'keep_all' | 'mark_primary' | 'delete_duplicates';
  primary_device_id?: string;
  resolver_id: string;
  resolved_at: Date;
  notes: string;
}
```

#### 3.2 해결 워크플로우
```sql
-- 중복 해결 로그 테이블
CREATE TABLE duplicate_resolution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_number TEXT NOT NULL,
  duplicate_group_id TEXT NOT NULL,
  affected_device_ids UUID[],
  reason TEXT,
  action_taken TEXT,
  primary_device_id UUID,
  resolver_user_id UUID REFERENCES user_profiles(id),
  resolved_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  before_snapshot JSONB,
  after_snapshot JSONB
);

-- 해결 프로시저
CREATE OR REPLACE FUNCTION resolve_duplicate_equipment(
  p_equipment_number TEXT,
  p_primary_device_id UUID,
  p_action TEXT,
  p_resolver_id UUID,
  p_notes TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_affected_ids UUID[];
BEGIN
  -- 트랜잭션으로 처리
  -- 1. 영향받는 장비 ID 수집
  SELECT ARRAY_AGG(id) INTO v_affected_ids
  FROM aed_devices
  WHERE equipment_number = p_equipment_number;

  -- 2. 로그 기록
  INSERT INTO duplicate_resolution_log (
    equipment_number,
    duplicate_group_id,
    affected_device_ids,
    action_taken,
    primary_device_id,
    resolver_user_id,
    notes,
    before_snapshot
  ) VALUES (
    p_equipment_number,
    p_equipment_number,
    v_affected_ids,
    p_action,
    p_primary_device_id,
    p_resolver_id,
    p_notes,
    (SELECT jsonb_agg(row_to_json(d.*))
     FROM aed_devices d
     WHERE equipment_number = p_equipment_number)
  );

  -- 3. 액션 수행
  CASE p_action
    WHEN 'mark_primary' THEN
      UPDATE aed_devices
      SET verification_status = 'verified_primary'
      WHERE id = p_primary_device_id;

      UPDATE aed_devices
      SET verification_status = 'verified_duplicate'
      WHERE equipment_number = p_equipment_number
        AND id != p_primary_device_id;

    WHEN 'merge' THEN
      -- 병합 로직 (주의 필요)
      -- 최신 데이터로 통합
      NULL;

    WHEN 'keep_all' THEN
      -- 모두 유지하되 플래그만 업데이트
      UPDATE aed_devices
      SET verification_status = 'verified_legitimate'
      WHERE equipment_number = p_equipment_number;
  END CASE;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

### Phase 4: 모니터링 및 예방 (지속)

#### 4.1 실시간 중복 감지
```typescript
// lib/validation/equipment-validator.ts
export async function validateEquipmentNumber(
  equipmentNumber: string,
  excludeId?: string
): Promise<ValidationResult> {
  // 실시간 중복 체크
  const { data, error } = await supabase
    .from('aed_devices')
    .select('id, management_number, installation_institution')
    .eq('equipment_number', equipmentNumber)
    .neq('id', excludeId || '00000000-0000-0000-0000-000000000000');

  if (data && data.length > 0) {
    return {
      valid: false,
      warning: true,
      message: `경고: 장비연번 ${equipmentNumber}가 이미 ${data.length}개 존재합니다`,
      existingDevices: data,
      suggestedAction: 'review_existing'
    };
  }

  return { valid: true };
}
```

#### 4.2 입력 시점 경고
```typescript
// components/EquipmentNumberInput.tsx
export function EquipmentNumberInput({
  value,
  onChange,
  onValidation
}: Props) {
  const [validation, setValidation] = useState<ValidationResult>();
  const [isChecking, setIsChecking] = useState(false);

  const checkDuplicate = useDebouncedCallback(async (num: string) => {
    setIsChecking(true);
    const result = await validateEquipmentNumber(num);
    setValidation(result);
    onValidation?.(result);
    setIsChecking(false);
  }, 500);

  return (
    <div>
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          checkDuplicate(e.target.value);
        }}
        className={validation?.warning ? 'border-yellow-500' : ''}
      />

      {isChecking && <span>확인 중...</span>}

      {validation?.warning && (
        <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800">{validation.message}</p>
          {validation.existingDevices?.map(device => (
            <div key={device.id} className="mt-1 text-xs text-yellow-600">
              - {device.installation_institution} ({device.management_number})
            </div>
          ))}
          <button
            className="mt-2 text-sm text-yellow-700 underline"
            onClick={() => window.open('/aed-duplicates', '_blank')}
          >
            중복 관리 페이지로 이동
          </button>
        </div>
      )}
    </div>
  );
}
```

## 2. 보고서 및 통계

### 2.1 중복 현황 대시보드
```sql
-- 일별 중복 추이
CREATE OR REPLACE VIEW duplicate_trends AS
SELECT
  DATE(created_at) as date,
  COUNT(CASE WHEN duplicate_flag THEN 1 END) as duplicate_count,
  COUNT(*) as total_count,
  ROUND(
    COUNT(CASE WHEN duplicate_flag THEN 1 END)::numeric /
    COUNT(*)::numeric * 100, 2
  ) as duplicate_rate
FROM aed_devices
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 기관별 중복 현황
CREATE OR REPLACE VIEW duplicate_by_organization AS
SELECT
  o.name as organization_name,
  COUNT(DISTINCT a.equipment_number) as unique_duplicates,
  COUNT(a.id) as total_duplicate_records,
  STRING_AGG(DISTINCT a.equipment_number, ', ' ORDER BY a.equipment_number) as equipment_numbers
FROM aed_devices a
JOIN organizations o ON a.health_center_id = o.id
WHERE a.duplicate_flag = true
GROUP BY o.name
ORDER BY COUNT(a.id) DESC;
```

### 2.2 정기 보고서
```typescript
// lib/reports/duplicate-report.ts
export async function generateDuplicateReport(): Promise<Report> {
  return {
    generatedAt: new Date(),
    summary: {
      totalDevices: 81331,
      duplicateGroups: 95,  // 예상치
      affectedDevices: 195,  // 예상치
      duplicateRate: 0.24,   // %
      resolvedThisMonth: 12,
      pendingResolution: 83
    },
    criticalCases: [
      // 6개 이상 중복된 케이스
    ],
    recentResolutions: [
      // 최근 해결된 케이스
    ],
    recommendations: [
      '입력 시스템 개선 필요',
      '제조사별 번호 체계 표준화',
      '정기적인 데이터 정제 프로세스 수립'
    ]
  };
}
```

## 3. 실행 계획

### 즉시 조치 (Day 1)
1. [ ] 중복 현황 분석 쿼리 실행
2. [ ] duplicate_equipment_analysis 뷰 생성
3. [ ] 현황 보고서 작성

### 단기 조치 (Week 1)
1. [ ] UI에 중복 표시기 추가
2. [ ] 중복 관리 페이지 개발
3. [ ] 검증 API 구현

### 중기 조치 (Month 1)
1. [ ] 데이터 정제 워크플로우 구축
2. [ ] 해결 로그 시스템
3. [ ] 자동 알림 시스템

### 장기 개선 (Quarter)
1. [ ] 입력 시점 검증 강화
2. [ ] AI 기반 중복 패턴 분석
3. [ ] 제조사 연동 API

## 4. 기대 효과

### 정량적 효과
- 중복률 0.24% → 0.1% 이하 감소
- 데이터 정확도 99.76% → 99.9% 향상
- 정제 시간 50% 단축

### 정성적 효과
- 데이터 신뢰성 향상
- 관리자 인식 개선
- 시스템 안정성 증대

## 5. 주의사항

### ⚠️ 절대 하지 말아야 할 것
1. 무작정 중복 제거
2. 사용자 확인 없이 데이터 병합
3. 백업 없이 대량 수정

### ✅ 반드시 해야 할 것
1. 모든 변경사항 로그 기록
2. 사용자에게 명확한 설명
3. 단계적 접근
4. 정기적인 백업

---

**작성일**: 2025-09-20
**최종 업데이트**: 2025-10-03
**작성자**: AED 점검 시스템 개발팀
**상태**: ⏳ 부분 구현 (중복 검사 로직 존재, UI 미구현)
**우선순위**: 🟡 중간 (데이터 품질 영향)
**소요시간**: 초기 설정 2-3일, 지속적 관리 필요

> **현재 상태**: 중복 검사 로직은 일부 구현되어 있으나, 사용자에게 중복을 명확히 표시하는 UI와 관리 대시보드는 아직 구현되지 않았습니다.