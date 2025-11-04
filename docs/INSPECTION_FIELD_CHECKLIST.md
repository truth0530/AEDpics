# 점검 항목 추가 체크리스트

## 개요
새로운 점검 항목을 추가할 때 반드시 확인해야 할 모든 파일과 위치를 정리한 문서입니다.

## 체크리스트 실행 방법
```bash
# 자동 검증 스크립트 실행
npm run check:inspection-field <필드명>

# 예시
npm run check:inspection-field external_display
```

## 필수 수정 영역 (9곳)

### 1. BasicInfoStep.tsx - 점검 화면 (편집 가능)
**파일**: `components/inspection/steps/BasicInfoStep.tsx`

#### 1-1. FIELDS 또는 DEVICE_INFO_FIELDS 배열에 추가
```typescript
// 기본 정보 필드인 경우
const FIELDS = [
  // ...
  { key: 'new_field', label: '새 필드', dbKey: 'new_field' },
];

// 또는 장비 정보 필드인 경우
const DEVICE_INFO_FIELDS = [
  { key: 'new_field', label: '새 필드', dbKey: 'new_field' },
];
```
**위치**: 약 16-28번 라인

#### 1-2. 초기화 로직 확인
- `FIELDS` 배열에 추가했다면 자동으로 초기화됨 (67-88번 라인)
- `DEVICE_INFO_FIELDS`에 추가했다면 자동으로 초기화됨 (80-82번 라인)

#### 1-3. UI 렌더링 추가
```typescript
// 읽기 전용으로만 표시하는 경우
<div className="space-y-1">
  <div className="text-[10px] font-medium text-gray-400">새 필드</div>
  <div className="text-xs font-medium text-gray-100">
    {deviceInfo.new_field || '데이터없음'}
  </div>
</div>

// 수정 가능하게 하는 경우 (외부표출 예시 참고)
{!isEditMode ? (
  <div className="text-xs font-medium text-gray-100">
    {(basicInfo.all_matched === 'edited' && basicInfo.new_field)
      ? basicInfo.new_field
      : (deviceInfo.new_field || '데이터없음')}
  </div>
) : (
  <select
    value={basicInfo.new_field || deviceInfo.new_field || '기본값'}
    onChange={(e) => {
      updateStepData('basicInfo', {
        ...basicInfo,
        new_field: e.target.value,
        all_matched: false,
      });
    }}
  >
    <option value="옵션1">옵션1</option>
    <option value="옵션2">옵션2</option>
  </select>
)}
```
**위치**: 약 567-598번 라인

### 2. InspectionSummaryStep.tsx - 점검 요약 & PDF 보고서
**파일**: `components/inspection/steps/InspectionSummaryStep.tsx`

#### 2-1. BasicInfoData 인터페이스에 추가
```typescript
interface BasicInfoData {
  // ...
  new_field?: string;
}
```
**위치**: 24-38번 라인

#### 2-2. basicInfoSummary 로직에 추가
```typescript
// 일치 상태 (matched)
if ((basicInfo.all_matched as any) === true) {
  matched.push({
    label: '새 필드',
    corrected: basicInfo.new_field || deviceInfo.new_field || '-',
  });
}

// 수정 상태 (modified)
else if ((basicInfo.all_matched as any) === 'edited') {
  const fields = [
    // ...
    { key: 'new_field', label: '새 필드' },
  ];
}
```
**위치**: 124-163번 라인

### 3. ReadOnlyBasicInfoStep.tsx - 점검 이력 조회
**파일**: `components/inspection/steps/ReadOnlyBasicInfoStep.tsx`

#### 3-1. FIELDS 배열에 추가 (선택사항)
```typescript
const FIELDS = [
  // ...
  { key: 'new_field', label: '새 필드', dbKey: 'new_field' },
];
```
**위치**: 18-26번 라인

#### 3-2. UI 렌더링 추가
```typescript
<div className="space-y-1">
  <div className="text-[10px] font-medium text-gray-400">새 필드</div>
  <div className="text-xs font-medium text-gray-100">
    {inspection.step_data?.['basicInfo']?.new_field || '-'}
  </div>
</div>
```
**위치**: 약 45-70번 라인

### 4. field-comparison.ts - 필드 비교 분석 로직
**파일**: `lib/inspections/field-comparison.ts`

#### 4-1. FieldComparison 인터페이스 field_category 타입 확인
```typescript
export interface FieldComparison {
  field_category: 'battery' | 'pad' | 'manager' | 'installation' | 'device' | 'basic_info';
  // 필요시 카테고리 추가
}
```
**위치**: 4-11번 라인

#### 4-2. analyzeInspectionFields 함수에 비교 로직 추가
```typescript
// BasicInfo에서 비교할 필드들 (103번 라인 이후)
if (basicInfo.new_field !== undefined) {
  comparisons.push({
    field_name: 'new_field',
    field_category: 'basic_info', // 또는 적절한 카테고리
    inspection_value: normalizeValue(basicInfo.new_field),
    aed_data_value: normalizeValue(aedData.new_field),
  });
}
```
**위치**: 약 102-143번 라인

#### 4-3. determineSeverity 함수 업데이트 (필요시)
```typescript
function determineSeverity(fieldName: string, ...): 'critical' | 'major' | 'minor' {
  // 새 필드의 심각도 정의
  if (fieldName.includes('new_field')) {
    return 'major'; // 또는 critical, minor
  }
}
```
**위치**: 61-78번 라인

### 5. improvement-reports/page.tsx - 점검효과 화면
**파일**: `app/(authenticated)/inspections/improvement-reports/page.tsx`

#### 5-1. FIELD_CATEGORY_LABELS 업데이트 (필요시)
```typescript
const FIELD_CATEGORY_LABELS: Record<string, string> = {
  // ...
  basic_info: '기본정보', // 새 카테고리 추가
};
```
**위치**: 51-58번 라인

#### 5-2. FIELD_NAME_LABELS 업데이트
```typescript
const FIELD_NAME_LABELS: Record<string, string> = {
  // ...
  new_field: '새 필드',
};
```
**위치**: 60-70번 라인

### 6. inspection-effect/page.tsx - 점검효과 화면 (중복)
**파일**: `app/(authenticated)/inspection-effect/page.tsx`

위 5번과 동일한 작업 수행 (51-70번 라인)

### 7. Prisma Schema - 데이터베이스 스키마 확인
**파일**: `prisma/schema.prisma`

#### 7-1. aed_data 모델에 필드 존재 확인
```prisma
model aed_data {
  // ...
  new_field    String?  // 필드가 있는지 확인
}
```

#### 7-2. 필드가 없으면 마이그레이션 필요
```bash
# 스키마 수정 후
npx prisma migrate dev --name add_new_field
```

### 8. send-improvement-alerts - CRON 알림 이메일
**파일**: `app/api/cron/send-improvement-alerts/route.ts`

#### 8-1. fieldLabels 매핑 추가
```typescript
const fieldLabels: Record<string, string> = {
  battery_expiry_date: '배터리 만료일',
  pad_expiry_date: '패드 만료일',
  manager: '관리자명',
  institution_contact: '연락처',
  installation_institution: '설치기관',
  new_field: '새 필드', // 추가
};
```
**위치**: 140-146번 라인

**참고**: 이 파일은 30일 이상 방치된 문제에 대한 자동 알림 이메일을 발송합니다.

### 9. FieldComparisonDetailModal - 필드 비교 상세 모달
**파일**: `components/inspections/FieldComparisonDetailModal.tsx`

#### 9-1. FIELD_NAME_LABELS 추가
```typescript
const FIELD_NAME_LABELS: Record<string, string> = {
  battery_expiry_date: '배터리 만료일',
  pad_expiry_date: '패드 만료일',
  manager: '관리자명',
  // ...
  new_field: '새 필드', // 추가
};
```
**위치**: 40-50번 라인

#### 9-2. FIELD_CATEGORY_LABELS 확인 (필요시)
```typescript
const FIELD_CATEGORY_LABELS: Record<string, string> = {
  battery: '배터리',
  pad: '패드',
  manager: '관리자',
  installation: '설치정보',
  device: '장비정보',
  basic_info: '기본정보', // 새 카테고리 추가 시
};
```
**위치**: 52-58번 라인

**참고**: 이 모달은 점검효과 화면에서 개별 필드의 변화 이력을 상세히 보여줍니다.

## 선택적 수정 영역

### 10. API 라우트 검증 로직 (선택)
**파일**: `app/api/inspections/sessions/route.ts`

validateStepData 함수에 검증 로직 추가 (필요시)
```typescript
function validateStepData(step_data: Record<string, unknown>): { valid: boolean; errors: string[] } {
  if (step_data.basicInfo) {
    const basicInfo = step_data.basicInfo as Record<string, any>;

    // 새 필드 검증
    if (basicInfo.all_matched === 'edited') {
      if (basicInfo.new_field && basicInfo.new_field.trim().length === 0) {
        errors.push('기본정보: 새 필드 값이 비어있음');
      }
    }
  }
}
```
**위치**: 419-510번 라인

### 11. TypeScript 타입 정의 (선택)
**파일**: `lib/types/inspection.ts` (없으면 생성)

공통 타입 정의 파일에 추가
```typescript
export interface BasicInfo {
  manager?: string;
  contact_info?: string;
  external_display?: string;
  new_field?: string; // 추가
  // ...
}
```

## 검증 방법

### 자동 검증
```bash
npm run check:inspection-field <필드명>
```

### 수동 검증
1. **TypeScript 컴파일 확인**
   ```bash
   npm run tsc
   ```

2. **Lint 확인**
   ```bash
   npm run lint
   ```

3. **로컬 빌드 테스트**
   ```bash
   npm run build
   ```

4. **기능 테스트**
   - 점검 화면에서 필드 편집 가능 여부 확인
   - 점검 완료 시 데이터 저장 확인
   - 점검 이력에서 필드 표시 확인
   - 점검 요약에서 필드 표시 확인
   - PDF 출력에 필드 포함 확인
   - 점검효과 화면에서 필드명 한글 표시 확인

## 체크리스트 요약

- [ ] 1. BasicInfoStep - FIELDS 또는 DEVICE_INFO_FIELDS 배열 추가
- [ ] 2. BasicInfoStep - UI 렌더링 추가
- [ ] 3. InspectionSummaryStep - BasicInfoData 인터페이스 추가
- [ ] 4. InspectionSummaryStep - basicInfoSummary 로직 추가
- [ ] 5. ReadOnlyBasicInfoStep - UI 렌더링 추가
- [ ] 6. field-comparison.ts - analyzeInspectionFields 함수에 비교 로직 추가
- [ ] 7. improvement-reports/page.tsx - FIELD_NAME_LABELS 추가
- [ ] 8. inspection-effect/page.tsx - FIELD_NAME_LABELS 추가
- [ ] 9. Prisma Schema - 필드 존재 확인 (없으면 마이그레이션)
- [ ] 10. send-improvement-alerts - fieldLabels 매핑 추가
- [ ] 11. FieldComparisonDetailModal - FIELD_NAME_LABELS 추가
- [ ] 12. TypeScript 컴파일 통과
- [ ] 13. Lint 통과
- [ ] 14. 로컬 빌드 통과
- [ ] 15. 기능 테스트 완료

## 예시: external_display 필드 추가 과정

### 1. BasicInfoStep.tsx
```typescript
// DEVICE_INFO_FIELDS에 추가
const DEVICE_INFO_FIELDS = [
  { key: 'external_display', label: '외부표출', dbKey: 'external_display' },
];

// UI 렌더링
{!isEditMode ? (
  <div className="text-xs font-medium text-gray-100">
    {basicInfo.external_display || deviceInfo.external_display || 'N'}
  </div>
) : (
  <select value={basicInfo.external_display || deviceInfo.external_display || 'N'}>
    <option value="Y">Y</option>
    <option value="N">N</option>
  </select>
)}
```

### 2. InspectionSummaryStep.tsx
```typescript
interface BasicInfoData {
  external_display?: string;
}

// matched
matched.push({
  label: '외부표출',
  corrected: basicInfo.external_display || deviceInfo.external_display || '-',
});

// modified
{ key: 'external_display', label: '외부표출' },
```

### 3-7. 나머지 파일들도 동일하게 추가

---

**마지막 업데이트**: 2025-11-05
**문서 버전**: 1.0.0
