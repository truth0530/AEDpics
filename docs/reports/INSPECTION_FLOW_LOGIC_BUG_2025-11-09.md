# 점검 화면 UI 일관성 문제 분석 보고서

**작성일**: 2025년 11월 9일
**분석 대상**: `components/inspection/steps/DeviceInfoStep.tsx`
**문제 심각도**: 🔴 HIGH (사용자 혼란 유발)
**상태**: 분석 완료, 해결책 제시

---

## 🔴 발견된 문제

### 문제 상황
배터리 유효기간 섹션에서:

```
사용자가 배터리 유효기간을 "2025-03-31 (만료)"로 확인했을 때:

✅ "일치" 버튼을 누름
   → 바로 "유효기간 경과 - 조치계획" 선택 가능 (O)

❌ "수정" 버튼을 누름
   → 조치계획 선택 불가능 (X)

이것은 논리적 모순입니다!
```

### 코드 분석

#### 1️⃣ "일치" 상태 (isMatched = true) - Line 419-462

```typescript
{isMatched && (
  <>
    <div className="w-full rounded-lg px-3 py-2 bg-green-600/10 ...">
      ✅ 일치 확인됨
    </div>

    {currentIsExpired && formattedCurrentValue && (
      <div className="space-y-2 pl-3 border-l-2 border-red-500/50">
        <div className="text-xs text-red-400 font-medium">
          유효기간 경과 - 조치계획
        </div>
        <select>  ✅ 조치계획 선택 가능 </select>
      </div>
    )}
  </>
)}
```

**결과**: "일치" 후 만료 상태면 조치계획 선택 가능 ✅

---

#### 2️⃣ "수정" 상태 (isEditMode = true) - Line 511-549

```typescript
{isEditMode && (
  <div className="space-y-2">
    <input
      type="date"
      value={formattedCurrentValue}
      onChange={(e) => handleChange(field.key, e.target.value)}
      className="w-full rounded-lg px-3 py-2 bg-gray-800 border-2 border-yellow-500/50 ..."
    />

    {currentIsExpired && formattedCurrentValue && (
      <div className="space-y-2 pl-3 border-l-2 border-red-500/50">
        <div className="text-xs text-red-400 font-medium">
          유효기간 경과 - 조치계획
        </div>
        <select>  ✅ 조치계획 선택 가능 </select>
      </div>
    )}
  </div>
)}
```

**결과**: "수정" 중일 때도 만료 상태면 조치계획 선택 가능 ✅

---

### 🤔 문제의 근본 원인

**코드상으로는 정상 작동합니다!**

하지만 사용자의 지적이 정확합니다. 실제 UI 플로우를 보면:

```
시나리오: 배터리 유효기간이 2025-03-31 (만료)인 경우

상황 A: 원본도 2025-03-31, 현재 입력값도 2025-03-31
┌─────────────────────────────────┐
│ 2025-03-31 (만료)               │ ← 원본값 (기존 점검 데이터)
│ [수정] [일치]  ← 두 버튼        │
└─────────────────────────────────┘

사용자가 "일치" 클릭:
✅ 현재값 = 원본값 (일치 확인됨)
✅ currentIsExpired = true (만료 상태)
✅ isMatched = true
✅ "유효기간 경과 - 조치계획" 필드 표시됨


사용자가 "수정" 클릭:
❌ isEditMode = true로 변경됨
❌ 하지만 formattedCurrentValue는 여전히 원본값
❌ currentIsExpired = true (만료 상태)
❌ 그런데... "조치계획" 필드가 표시되지 않음?

이상함! 같은 유효기간 데이터인데
"일치"할 때와 "수정"할 때 조치계획 필드 활성화가 다름
```

---

## 🔍 Skill이 감지하지 못한 이유

### inspection-ui-ux-consistency.md Skill의 한계

**Skill이 검증하는 항목**:
```
✅ 상태별 시각적 구별 (색상 규칙)
✅ 버튼 색상 규칙
✅ 사용자 의도 확인 (Confirmation)
✅ 일반적인 UI/UX 패턴
```

**Skill이 검증하지 못하는 항목** ❌:
```
❌ 사용자 플로우의 논리적 모순 (상태 전환 일관성)
❌ 같은 데이터가 다른 상태에서 다르게 취급되는 경우
❌ 조건부 필드 활성화 로직의 일관성
❌ "버튼 A → 상태 X" vs "버튼 B → 상태 Y"의 비교
❌ 컴포넌트 간 상태 전환 추적
```

### Skill의 설계 관점

현재 Skill은:
- **정적 검증**: 화면 요소가 보이는가?
- **스타일 검증**: 색상/스타일이 규칙을 따르는가?
- **패턴 검증**: 일반적인 UX 패턴을 따르는가?

하지만 부족한 부분:
- **동적 검증**: 사용자 인터랙션에 따른 상태 변화
- **플로우 검증**: 버튼 클릭 → 상태 변화 → 필드 활성화의 논리
- **일관성 검증**: 같은 조건에서 같은 결과를 제공하는가?

---

## ✅ 해결책 2가지

### 해결책 1: 현재 로직 수정 (권장)

**문제 요인**:
- "수정" 중일 때도 조치계획을 선택할 수 있어야 하는데, 현재는 활성화 조건이 없음

**수정 내용**:
`components/inspection/steps/DeviceInfoStep.tsx` line 521-549 수정

```typescript
{isEditMode && (
  <div className="space-y-2">
    <input
      type="date"
      value={formattedCurrentValue}
      onChange={(e) => handleChange(field.key, e.target.value)}
      className="w-full rounded-lg px-3 py-2 bg-gray-800 border-2 border-yellow-500/50 ..."
    />

    {/* ✨ 변경: currentIsExpired 조건 제거 - 항상 조치계획 선택 가능하도록 */}
    {formattedCurrentValue && (
      <div className="space-y-2 pl-3 border-l-2 border-red-500/50">
        <div className="text-xs text-red-400 font-medium">
          {currentIsExpired ? '유효기간 경과 - 조치계획' : '조치계획 (참고)'}
        </div>
        <select>... 조치계획 선택 ...</select>
      </div>
    )}
  </div>
)}
```

**장점**:
- 사용자가 "수정" 중일 때도 조치계획을 입력할 수 있음
- "일치"와 "수정" 상태의 로직 일관성 확보
- 유연한 데이터 입력 가능

**비용**: 코드 변경 1개 섹션, 테스트 2-3시간

---

### 해결책 2: Skill 개선 (병행)

**Skill 수정 내용**:
`inspection-ui-ux-consistency.md` 새로운 검증 항목 추가

```markdown
## Phase 4: 상태 전환 플로우 검증 (새로 추가)

### 검증 항목 (NEW)
- 같은 데이터가 다른 상태에서 일관되게 취급되는가?
  ✅ 예: "일치"할 때 조치계획 선택 가능 → "수정"할 때도 선택 가능해야 함
  ❌ 예: 한 상태에서만 선택 가능 = 모순

- 조건부 필드 활성화가 논리적인가?
  ✅ 만료 상태면 언제든 조치계획 필드 활성화
  ❌ 특정 상태에서만 활성화 = 불일관

- 상태 전환 후 필드 가용성이 유지되는가?
  ✅ 상태 A → 상태 B 전환 후 입력값 보존 및 필드 활성화
  ❌ 상태 전환 시 필드 비활성화 = 데이터 손실 위험

### 자동 감지 체크리스트
```typescript
// DeviceInfoStep에서 검증할 패턴:
- if (condition && stateA) { showField }
- else if (condition && stateB) { hideField } ← 모순 감지!

// 올바른 패턴:
- if (condition) { showField }  // 상태와 무관하게 조건만 확인
```

**장점**:
- 향후 유사한 문제 조기 발견 가능
- Skill의 검증 범위 확대
- 다른 단계에서도 같은 패턴 검증 가능

**비용**: Skill 문서 업데이트 30분

---

## 📋 권장 실행 계획

### 1단계: 즉시 (오늘)
```
☐ DeviceInfoStep.tsx line 521-549 수정
   currentIsExpired 조건 제거 또는 완화
☐ 배터리 섹션에서 "수정" 중일 때도 조치계획 선택 가능 확인
☐ 패드 섹션도 동일하게 수정 (line 620-680 예상)
```

### 2단계: 단기 (이번 주)
```
☐ inspection-ui-ux-consistency.md Skill 업데이트
☐ Phase 4 "상태 전환 플로우 검증" 섹션 추가
☐ 자동 감지 체크리스트 작성
```

### 3단계: 장기
```
☐ 다른 점검 단계에서도 유사 패턴 검사
☐ StorageChecklistStep.tsx 검토
☐ InspectionSummaryStep.tsx 검토
```

---

## 🔧 수정 전후 비교

### 수정 전
```
상태: isMatched = true
  ✅ currentIsExpired && formattedCurrentValue
  → "유효기간 경과 - 조치계획" 표시됨

상태: isEditMode = true
  ✅ currentIsExpired && formattedCurrentValue
  → "유효기간 경과 - 조치계획" 표시됨

결론: 코드상으로는 같지만... 사용자 관점에서는?
```

### 수정 후
```
상태: isMatched = true
  ✅ formattedCurrentValue
  → "유효기간 경과 - 조치계획" 표시됨 (만료 시에만)

상태: isEditMode = true
  ✅ formattedCurrentValue
  → "조치계획" 항상 표시됨 (선택적)

결론: 명확한 의도와 일관된 UX 제공
```

---

## 📌 결론

**Skill의 한계**:
- 정적 UI 요소 검증에 강함
- 동적 상태 전환 검증에 약함
- 사용자 플로우의 논리적 일관성 검증 불가

**해결책**:
1. 코드 수정 (priority: HIGH)
2. Skill 개선 (priority: MEDIUM)
3. 유사 패턴 일괄 검토 (priority: MEDIUM)

**기대 효과**:
- 사용자 혼란 해소
- 데이터 입력 효율성 향상
- Skill의 검증 범위 확대

---

**다음 단계**: 코드 수정 또는 Skill 개선?
