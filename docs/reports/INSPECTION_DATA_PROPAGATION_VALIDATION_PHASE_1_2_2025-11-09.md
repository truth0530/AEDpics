# 점검 데이터 전파 검증 보고서 - Phase 1 & 2
**작성일**: 2025년 11월 9일
**검증 기준**: `.claude/skills/inspection-data-propagation-consistency.md` Skill
**상태**: Phase 1, 2 검증 완료 - **심각한 데이터 손실 발견**

---

## 📊 검증 범위

| 항목 | 파일 | 라인 | 상태 |
|------|------|------|------|
| Phase 1 기본정보 필드 | BasicInfoStep.tsx | 22-835 | 검증 완료 |
| Phase 1 장비정보 필드 | DeviceInfoStep.tsx | 27-553 | 검증 완료 |
| Phase 2 Summary 생성 | InspectionSummaryStep.tsx | 128-301 | 검증 완료 |

---

## 🟢 정상 작동 필드

### 1. GPS 좌표 데이터 (Priority 1)
**Phase 1 저장** [BasicInfoStep.tsx:139-161]
```typescript
// dragend 이벤트에서 GPS 좌표 저장
setCurrentLat(lat);
setCurrentLng(lng);
updateStepData('basicInfo', {
  ...currentBasicInfo,
  gps_latitude: lat,
  gps_longitude: lng,
  gps_verified: false,  // ✅ 위치 변경 시 확인 상태 리셋
});
```

**Phase 2 표시** [InspectionSummaryStep.tsx:192-213]
```typescript
if (basicInfo.gps_verified && basicInfo.gps_latitude !== undefined && basicInfo.gps_longitude !== undefined) {
  if (Math.abs(lat - origLat) > 0.0001 || Math.abs(lng - origLng) > 0.0001) {
    // ✅ 변경된 좌표 표시
    modified.push({
      label: 'GPS 좌표',
      original: `${origLat.toFixed(6)}, ${origLng.toFixed(6)}`,
      corrected: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    });
  } else {
    // ✅ 일치한 좌표 표시
    matched.push({
      label: 'GPS 좌표',
      corrected: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    });
  }
}
```
**결과**: ✅ **GPS 데이터는 정상적으로 Phase 1 → Phase 2 전파됨**

---

### 2. 분류체계 (대분류/중분류/소분류) 데이터 (Priority 1)

**Phase 1 수집 및 동적 필터링** [BasicInfoStep.tsx:640-731]
```typescript
// 대분류 선택 시 중분류 필터링
if (field.key === 'category_1') {
  updatedInfo.category_2 = '';  // ✅ 하위 초기화
  updatedInfo.category_3 = '';
}

// 중분류 선택 시 소분류 필터링
else if (field.key === 'category_2') {
  updatedInfo.category_3 = '';  // ✅ 소분류 초기화
}
```

**Phase 2 표시** [InspectionSummaryStep.tsx:134-172]
```typescript
if ((basicInfo.all_matched as any) === true) {
  // ✅ 분류체계 통합 표시
  matched.push({
    label: '분류체계',
    corrected: `${basicInfo.category_1 || deviceInfo.category_1 || '-'} > ${basicInfo.category_2 || deviceInfo.category_2 || '-'} > ${basicInfo.category_3 || deviceInfo.category_3 || '-'}`,
  });
} else if ((basicInfo.all_matched as any) === 'edited') {
  // ✅ 각 카테고리별로 개별 표시
  fields.forEach(field => {
    const original = deviceInfo[field.key] || '';
    const corrected = basicInfo[field.key] || '';
    if (corrected && original !== corrected) {
      modified.push({
        label: field.label,
        original: original || '(비어있음)',
        corrected,
      });
    }
  });
}
```
**결과**: ✅ **분류 데이터는 정상적으로 Phase 1 → Phase 2 전파됨**

---

## 🔴 **CRITICAL: 데이터 손실 발견**

### 1. 배터리/패드 조치계획 필드 누락 (Priority 1 - 심각)

**문제 설명**:
- 사용자가 배터리/패드 유효기간 만료 시 조치계획(action_plan)을 선택하여 저장함
- Phase 1 (DeviceInfoStep)에서 조치계획 데이터가 저장됨 **확인됨**
- Phase 2 (InspectionSummaryStep)에서 조치계획 필드가 **완전히 누락됨**
- 결과: **조치계획 데이터가 최종 보고서에 반영되지 않음** (데이터 손실)

**Phase 1에서 수집** [DeviceInfoStep.tsx:511-553]
```typescript
{isEditMode && (
  <div className="space-y-2">
    <input type="date" ... />

    {currentIsExpired && formattedCurrentValue && (
      <div className="space-y-2 pl-3 border-l-2 border-red-500/50">
        <div className="text-xs text-red-400 font-medium">
          유효기간 경과 - 조치계획  // ✅ 사용자가 여기서 선택
        </div>
        <select>  // ✅ 조치계획 선택 가능
          {/* 조치계획 옵션 */}
        </select>
      </div>
    )}
  </div>
)}
```

**Phase 2에서 누락** [InspectionSummaryStep.tsx:275-294]
```typescript
else if (devInfo.supplies_matched === 'edited') {
  const supplyFields = [
    { key: 'battery_expiry_date', label: '배터리 유효기간', dbKey: 'battery_expiry_date' },
    { key: 'pad_expiry_date', label: '패드 유효기간', dbKey: 'patch_expiry_date' },
    { key: 'manufacturing_date', label: '제조일자', dbKey: 'manufacturing_date' },
    { key: 'operation_status', label: '작동상태', dbKey: 'operation_status' },
    // ❌ battery_action_plan 필드 없음
    // ❌ pad_action_plan 필드 없음
  ];

  supplyFields.forEach(field => {
    // 조치계획 필드가 처리되지 않음
  });
}
```

**영향 범위**:
- ❌ Phase 2 (Summary): 조치계획 미표시
- ❌ Phase 3 (PDF): 조치계획 미포함
- ❌ Phase 4 (AdminFullView): 조치계획 미표시
- ❌ Phase 5 (Statistics): 조치계획 통계 불가

**심각도**: 🔴 **HIGH** - 사용자가 선택한 필수 조치 정보가 손실됨

**해결 방법**:
InspectionSummaryStep.tsx의 `deviceInfoSummary` 계산에 다음 필드 추가 필요:
```typescript
// lines 275-294 수정
const supplyFields = [
  { key: 'battery_expiry_date', label: '배터리 유효기간', dbKey: 'battery_expiry_date' },
  { key: 'pad_expiry_date', label: '패드 유효기간', dbKey: 'patch_expiry_date' },
  { key: 'battery_action_plan', label: '배터리 조치계획', dbKey: 'battery_action_plan' },  // 추가
  { key: 'pad_action_plan', label: '패드 조치계획', dbKey: 'pad_action_plan' },  // 추가
  { key: 'manufacturing_date', label: '제조일자', dbKey: 'manufacturing_date' },
  { key: 'operation_status', label: '작동상태', dbKey: 'operation_status' },
];
```

---

### 2. 배터리/패드 상태별 조치계획 표시 불일치 (Priority 1)

**문제 설명**:
DeviceInfoStep.tsx에서 isEditMode 상태에 따라 조치계획 필드 표시가 불일치

**Issue A: 'edited' 상태에서 조치계획 미표시** [DeviceInfoStep.tsx:465-508]
```typescript
{matchedState === 'edited' && (
  // ❌ 조치계획 필드가 이 섹션에 없음
  // 사용자가 배터리 유효기간을 수정 중이면서
  // 조치계획을 선택하려고 하면 선택할 수 없음
)}
```

**Issue B: 상태 전환 시 데이터 일관성 부족**
- isMatched 상태: 조치계획 표시됨 ✅
- isEditMode 상태: 조치계획 표시됨 ✅
- matchedState === 'edited': 조치계획 표시 **안 됨** ❌

**심각도**: 🟡 **MEDIUM** - UI 일관성 문제로 사용자 혼란 유발

---

## 📋 검증 결과 요약

### Phase 1 (필드 수정 감지)
| 필드 | BasicInfoStep | DeviceInfoStep | StorageChecklistStep | Status |
|------|---|---|---|---|
| GPS 좌표 | ✅ | - | - | 정상 |
| 분류체계 (3개) | ✅ | - | - | 정상 |
| 배터리 유효기간 | - | ✅ | - | 정상 |
| **배터리 조치계획** | - | ⚠️ | - | **미표시 (edited)** |
| 패드 유효기간 | - | ✅ | - | 정상 |
| **패드 조치계획** | - | ⚠️ | - | **미표시 (edited)** |

### Phase 2 (Summary 동기화)
| 필드 | 표시 | 데이터 손실 | Status |
|------|------|---|---|
| GPS 좌표 | ✅ | 없음 | ✅ 정상 |
| 분류체계 | ✅ | 없음 | ✅ 정상 |
| 배터리 유효기간 | ✅ | 없음 | ✅ 정상 |
| **배터리 조치계획** | ❌ | **있음** | 🔴 **CRITICAL** |
| 패드 유효기간 | ✅ | 없음 | ✅ 정상 |
| **패드 조치계획** | ❌ | **있음** | 🔴 **CRITICAL** |

---

## 🔧 권장 조치 (우선순위)

### 1단계: 즉시 (CRITICAL)
- [ ] InspectionSummaryStep.tsx lines 275-294 수정
  - battery_action_plan 필드 추가
  - pad_action_plan 필드 추가
- [ ] Phase 2에서 수정된 데이터 확인

### 2단계: 단기 (MEDIUM)
- [ ] DeviceInfoStep.tsx 'edited' 상태 검토
  - matchedState === 'edited'일 때 조치계획 필드 표시 여부 결정
  - 필요시 UI 개선

### 3단계: 검증
- [ ] Phase 3 (PDF 보고서) 데이터 포함 확인
- [ ] Phase 4 (AdminFullView) 대시보드 표시 확인
- [ ] Phase 5 (Statistics) 통계 계산 확인

---

## 🎯 다음 검증 항목

**Priority 1 (다음 검증 예정)**:
- [ ] 주소/설치위치 동기화 (BasicInfoStep location_matched)
- [ ] 제조번호/제조일자/작동상태 동기화 (DeviceInfoStep)
- [ ] 보관함 점검 항목 동기화 (StorageChecklistStep 7개)

**Priority 2**:
- [ ] 관리책임자 교육 상태 + 미이수 사유 (조건부 필드)
- [ ] 사진 업로드 상태 추적

---

## 📌 결론

**검증 결과**:
- ✅ GPS 좌표: 정상 전파
- ✅ 분류체계: 정상 전파
- 🔴 **배터리/패드 조치계획: 심각한 데이터 손실 발견**
  - Phase 1에서 수집 → Phase 2에서 누락 → Phase 3-5에서 미포함
  - 최종 보고서에 조치계획이 반영되지 않음

**다음 단계**: InspectionSummaryStep.tsx 즉시 수정 후 Phase 3-5 재검증

