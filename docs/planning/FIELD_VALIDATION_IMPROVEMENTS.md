# 필드 검증 오류 메시지 개선 (Commit: dba321d)

## 개요
Step 2→3 전환 시 발생하는 "The string did not match the expected pattern" 오류를 해결하기 위해 **필드별 검증 시스템**을 구현했습니다.

## 문제점 분석

### 이전 동작
1. API가 stepData를 받음
2. 일반적인 오류만 반환 ("필드 검증 실패")
3. 사용자는 **어느 필드가 문제인지 알 수 없음**
4. 콘솔에만 로그가 남음

### 사용자 경험
- "진행사항 저장에 실패했습니다" 메시지만 표시
- 문제가 어디인지 불명확함
- 재시도 방법을 알 수 없음

## 해결책

### 1️⃣ API 필드 검증 강화 (`app/api/inspections/sessions/route.ts`)

#### 새로 추가된 함수
```typescript
function validateStepData(stepData: Record<string, unknown>): { 
  valid: boolean; 
  errors: string[] 
}
```

#### 검증 로직
- **basicInfo**: manager, contact_info, address 필드 검증
- **deviceInfo**: manufacturer, model_name, serial_number, 배터리/패드/제조일자 검증
- **storage**: storage_type, checklist_items, signage_selected 검증

#### 오류 응답 포맷
```json
{
  "error": "필드 검증 실패",
  "code": "VALIDATION_ERROR",
  "details": [
    "기본정보: 관리책임자 값이 비어있음",
    "장비정보: 제조사 값이 비어있음"
  ],
  "message": "입력 데이터 오류: 기본정보: 관리책임자 값이 비어있음 | 장비정보: 제조사 값이 비어있음"
}
```

### 2️⃣ 클라이언트 오류 처리 (`lib/state/inspection-session-store.ts`)

#### parseResponse() 함수 개선
```typescript
// VALIDATION_ERROR 감지
if (payload?.code === 'VALIDATION_ERROR' && payload?.message) {
  message = payload.message;
} else if (payload?.details && Array.isArray(payload.details)) {
  message = payload.details.join(' | ');
}
```

**효과**: API로부터 받은 상세 메시지가 그대로 사용자에게 전달됨

### 3️⃣ UI 오류 표시 개선 (`components/inspection/InspectionWorkflow.tsx`)

#### 변경 사항
- `saveProgressMutation.onError`: 상세 메시지 추출 및 상태 설정
- `handleNextWithSave()`: 오류 메시지 표시
- `handleSave()`: 오류 메시지 표시
- `handleCloseWithSave()`: 오류 메시지 표시

#### 화면 표시
```
┌─────────────────────────────────┐
│ ⚠️ 오류                          │
├─────────────────────────────────┤
│ 입력 데이터 오류: 기본정보:      │
│ 관리책임자 값이 비어있음         │
└─────────────────────────────────┘
```

## 검증 규칙

### Step 0: BasicInfoStep
| 필드 | 조건 | 검증 |
|------|------|------|
| manager | all_matched === 'edited' | ✓ 필수 |
| contact_info | all_matched === 'edited' | ✓ 필수 |
| address | location_matched === 'edited' | ✓ 필수 |

### Step 1: DeviceInfoStep
| 필드 | 조건 | 검증 |
|------|------|------|
| manufacturer | all_matched === true/edited | ✓ 필수 |
| model_name | all_matched === true/edited | ✓ 필수 |
| serial_number | all_matched === true/edited | ✓ 필수 |
| battery_expiry_date | battery_matched === 'edited' | ✓ 필수 |
| pad_expiry_date | pad_matched === 'edited' | ✓ 필수 |
| manufacturing_date | mfg_matched === 'edited' | ✓ 필수 |

### Step 2: StorageChecklistStep
| 필드 | 조건 | 검증 |
|------|------|------|
| storage_type | always | ✓ 필수 |
| checklist_items | storage_type !== 'none' | ✓ 필수 (모든 항목) |
| signage_selected | storage_type !== 'none' | ✓ 필수 (1개 이상) |

## 예시 시나리오

### 시나리오 1: 기본정보 수정 후 다음 단계로
**사용자 동작**:
1. BasicInfoStep에서 "수정" 클릭
2. manager 필드를 비운 채 "다음" 클릭

**이전**: "진행사항 저장에 실패했습니다" (불명확)

**지금**: "입력 데이터 오류: 기본정보: 관리책임자 값이 비어있음" (명확)

### 시나리오 2: 배터리 수정 후 다음 단계로
**사용자 동작**:
1. DeviceInfoStep에서 battery_expiry_date "수정" 클릭
2. 값을 입력하지 않고 "다음" 클릭

**이전**: "진행사항 저장에 실패했습니다"

**지금**: "입력 데이터 오류: 소모품: 배터리 유효기간 값이 비어있음"

## 기술 상세

### 에러 흐름
```
1. Client: PATCH /api/inspections/sessions
   payload: { stepData: {...} }

2. Server: validateStepData(stepData)
   → 필드별 검증
   → errors 배열 생성

3. Server: errors.length > 0 → HTTP 400
   {
     "code": "VALIDATION_ERROR",
     "details": ["..."],
     "message": "..."
   }

4. Client: parseResponse()
   → VALIDATION_ERROR 감지
   → message 추출
   → throw ApiError

5. Client: saveProgressMutation.onError()
   → error.message 표시
   → error state 업데이트

6. UI: error state 변경 감지
   → 오류 메시지 렌더링
```

### 콘솔 로그
```
[Validation Error] Step data validation failed: {
  sessionId: "...",
  currentStep: 0,
  errors: ["기본정보: 관리책임자 값이 비어있음"]
}
```

## 테스트 방법

### 테스트 1: 기본정보 필드 검증
1. Step 1에서 "수정" 클릭
2. manager 필드를 비운 채로 "다음" 클릭
3. ✅ "기본정보: 관리책임자 값이 비어있음" 메시지 확인

### 테스트 2: 장비정보 필드 검증
1. Step 2에서 serial_number "수정" 클릭
2. 값을 입력하지 않고 "다음" 클릭
3. ✅ "장비정보: 제조번호 값이 비어있음" 메시지 확인

### 테스트 3: 보관함 필드 검증
1. Step 3에서 storage_type 선택 후 체크리스트 미입력으로 "다음" 클릭
2. ✅ "보관함: X개의 미응답 체크리스트 항목" 메시지 확인

## 향후 개선 (P2)

- [ ] 필드별 하이라이트: 오류가 있는 필드를 빨간색으로 표시
- [ ] 인라인 오류: 각 필드 아래 오류 메시지 표시
- [ ] 오류 모달: 모든 오류를 리스트로 표시하는 모달
- [ ] 자동 수정 제안: 가능한 경우 수정 방법 제안
- [ ] 로컬 검증: API 호출 전 클라이언트에서 미리 검증

## 관련 파일

- ✅ `app/api/inspections/sessions/route.ts` (L467-558): validateStepData() 함수
- ✅ `app/api/inspections/sessions/route.ts` (L606-626): 검증 로직 추가
- ✅ `lib/state/inspection-session-store.ts` (L103-118): parseResponse() 개선
- ✅ `components/inspection/InspectionWorkflow.tsx` (L78-81, 320-326, 339-345, 413-420): 오류 처리 개선

## 커밋 정보
- **Commit**: dba321d
- **날짜**: 2025-10-20
- **파일 변경**: 3 files changed, +164 insertions, -7 deletions
