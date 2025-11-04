# 점검 항목 추가 가이드

## 빠른 시작

### 1. 체크리스트 확인
```bash
# 체크리스트 문서 열기
cat docs/INSPECTION_FIELD_CHECKLIST.md
```

### 2. 필드 추가 작업 수행
체크리스트를 따라 필요한 파일들을 수정합니다.

### 3. 자동 검증
```bash
# 검증 스크립트 실행
npm run check:inspection-field <필드명>

# 예시
npm run check:inspection-field external_display
```

### 4. 빌드 및 테스트
```bash
# TypeScript 검증
npm run tsc

# Lint 검증
npm run lint

# 빌드 테스트
npm run build
```

## 단계별 가이드

### Step 1: Prisma Schema 확인
```bash
# schema.prisma에서 aed_data 모델 확인
cat prisma/schema.prisma | grep -A 200 "model aed_data"
```

필드가 없으면 추가 후 마이그레이션:
```bash
# 스키마 수정
vim prisma/schema.prisma

# 마이그레이션
npx prisma migrate dev --name add_field_name
```

### Step 2: BasicInfoStep.tsx 수정

**위치**: `components/inspection/steps/BasicInfoStep.tsx`

1. FIELDS 배열에 추가 (line 16):
```typescript
const FIELDS = [
  { key: 'manager', label: '관리책임자', dbKey: 'manager' },
  { key: 'contact_info', label: '담당자 연락처', dbKey: 'institution_contact' },
  { key: 'new_field', label: '새 필드', dbKey: 'new_field' }, // 추가
  // ...
];
```

2. UI 렌더링 추가 (line 567):
```typescript
<div className="space-y-1">
  <div className="text-[10px] font-medium text-gray-400">새 필드</div>
  <div className="text-xs font-medium text-gray-100">
    {deviceInfo.new_field || '데이터없음'}
  </div>
</div>
```

### Step 3: InspectionSummaryStep.tsx 수정

**위치**: `components/inspection/steps/InspectionSummaryStep.tsx`

1. 인터페이스 추가 (line 24):
```typescript
interface BasicInfoData {
  manager?: string;
  contact_info?: string;
  new_field?: string; // 추가
  // ...
}
```

2. 요약 로직 추가 (line 124):
```typescript
// 일치 상태
if ((basicInfo.all_matched as any) === true) {
  matched.push({
    label: '새 필드',
    corrected: basicInfo.new_field || deviceInfo.new_field || '-',
  });
}

// 수정 상태
else if ((basicInfo.all_matched as any) === 'edited') {
  const fields = [
    { key: 'manager', label: '관리책임자' },
    { key: 'new_field', label: '새 필드' }, // 추가
    // ...
  ];
}
```

### Step 4: ReadOnlyBasicInfoStep.tsx 수정

**위치**: `components/inspection/steps/ReadOnlyBasicInfoStep.tsx`

UI 렌더링 추가 (line 45):
```typescript
<div className="space-y-1">
  <div className="text-[10px] font-medium text-gray-400">새 필드</div>
  <div className="text-xs font-medium text-gray-100">
    {inspection.step_data?.['basicInfo']?.new_field || '-'}
  </div>
</div>
```

### Step 5: field-comparison.ts 수정 (선택)

**위치**: `lib/inspections/field-comparison.ts`

비교 분석이 필요한 경우만 추가 (line 102):
```typescript
// BasicInfo에서 비교할 필드들
if (basicInfo.new_field !== undefined) {
  comparisons.push({
    field_name: 'new_field',
    field_category: 'basic_info',
    inspection_value: normalizeValue(basicInfo.new_field),
    aed_data_value: normalizeValue(aedData.new_field),
  });
}
```

### Step 6: 점검효과 화면 수정

**위치**:
- `app/(authenticated)/inspections/improvement-reports/page.tsx`
- `app/(authenticated)/inspection-effect/page.tsx`

FIELD_NAME_LABELS 추가 (line 60):
```typescript
const FIELD_NAME_LABELS: Record<string, string> = {
  battery_expiry_date: '배터리 만료일',
  new_field: '새 필드', // 추가
  // ...
};
```

### Step 7: 검증

```bash
# 자동 검증
npm run check:inspection-field new_field

# 수동 검증
npm run tsc
npm run lint
npm run build

# 기능 테스트
npm run dev
# 브라우저에서 점검 화면 확인
```

## 검증 결과 해석

### 성공 예시
```
✅ BasicInfoStep.tsx
   ✓ FIELDS 또는 DEVICE_INFO_FIELDS 배열에 필드 정의
   ✓ UI 렌더링 (필드명 표시)

최종 요약
총 검사 항목: 9개
통과: 9개
실패: 0개
완료율: 100.0%

🎉 모든 검사를 통과했습니다!
```

### 실패 예시
```
❌ InspectionSummaryStep.tsx
   ✗ BasicInfoData 인터페이스에 필드 타입 정의 (24-38번 라인)
   ✗ basicInfoSummary 로직에 필드 처리 (118-202번 라인)

최종 요약
총 검사 항목: 9개
통과: 7개
실패: 2개
완료율: 77.8%

⚠️  일부 검사에 실패했습니다. 위 내용을 확인하여 수정해주세요.
```

실패한 항목의 위치를 확인하고 해당 파일을 수정하세요.

## 주의사항

### 1. 필드명 규칙
- snake_case 사용 (예: `external_display`)
- 명확하고 설명적인 이름
- 약어 지양

### 2. 타입 정의
- 가능한 구체적인 타입 사용
- `string | undefined` 보다는 `string?` 사용

### 3. 기본값 처리
- 빈 값 대신 의미 있는 기본값 제공
- 예: `'데이터없음'`, `'-'`, `'N'`

### 4. 검증 로직
- 필수 항목인 경우 validateStepData에 추가
- 선택 항목인 경우 검증 생략

## 문제 해결

### "필드가 저장되지 않습니다"
- BasicInfoStep의 FIELDS 배열 확인
- 초기화 로직 (useEffect) 확인
- API 저장 로직 확인

### "PDF에 필드가 표시되지 않습니다"
- InspectionSummaryStep의 basicInfoSummary 로직 확인
- 렌더링 부분 확인

### "점검효과에서 한글이 표시되지 않습니다"
- FIELD_NAME_LABELS에 필드 추가
- 두 파일 모두 수정했는지 확인

## 관련 문서

- [점검 항목 체크리스트](./INSPECTION_FIELD_CHECKLIST.md)
- [프로젝트 구조](../README.md)
- [개발 가이드라인](../CLAUDE.md)

---

**마지막 업데이트**: 2025-11-05
**문서 버전**: 1.0.0
