# AEDpics Inspection (점검) 메뉴 구조 분석

## 1. 프로젝트 구조 개요

### 디렉토리 구조
```
components/inspection/
├── InspectionWorkflow.tsx              # 5단계 점검 워크플로우 메인 컴포넌트
├── AdminFullView.tsx                   # 관리자용 점검 현황 대시보드 (목록/지도/점검완료/임시저장)
├── InspectionHistoryModal.tsx          # 점검 이력 상세 조회 모달 (4단계 탭)
├── LocalFullView.tsx                   # 보건소 담당자용 뷰
├── ReadOnlyView.tsx                    # 읽기 전용 뷰
├── steps/
│   ├── BasicInfoStep.tsx               # Step 1: 기본 정보 확인 (담당자, 주소, 위치, 접근성)
│   ├── DeviceInfoStep.tsx              # Step 2: 장비 및 소모품 점검
│   ├── StorageChecklistStep.tsx        # Step 3: 보관함 점검
│   ├── ManagerEducationStep.tsx        # Step 4: 관리책임자 교육
│   ├── InspectionSummaryStep.tsx       # Step 5: 점검 요약 및 완료
│   ├── ReadOnlyBasicInfoStep.tsx       # (이력용) Step 1 읽기 전용
│   ├── ReadOnlyDeviceInfoStep.tsx      # (이력용) Step 2 읽기 전용
│   ├── ReadOnlyStorageChecklistStep.tsx # (이력용) Step 3 읽기 전용
│   └── ReadOnlyInspectionSummaryStep.tsx # (이력용) Step 4 읽기 전용
├── InspectionFilterBar.tsx             # 필터링 UI (지역, 상태 등)
├── MapView.tsx                         # 지도 표시
├── PhotoCaptureInput.tsx               # 사진 촬영 UI
├── BatteryLifespanModal.tsx           # 배터리 수명 가이드
├── IssueNoteModal.tsx                 # 문제 기록 모달
├── ValidationWarning.tsx               # 필수 항목 경고
├── InspectionPageSkeleton.tsx         # 로딩 스켈레톤
└── ... (기타 보조 컴포넌트)

app/api/inspections/
├── sessions/                           # 세션 관리
│   ├── route.ts                        # POST: 세션 시작, GET: 세션 조회
│   ├── [id]/
│   │   ├── cancel/route.ts            # POST: 세션 취소
│   │   └── refresh/route.ts           # POST: 세션 갱신
├── history/route.ts                    # GET: 점검 이력 조회
├── [id]/
│   ├── route.ts                        # GET: 점검 상세, PATCH: 수정, DELETE: 삭제
│   ├── approve/route.ts               # POST: 점검 승인
│   └── reject/route.ts                # POST: 점검 거부
├── quick/route.ts                      # POST: 즉시 점검
├── draft/route.ts                      # GET: 임시저장 목록
├── stats/route.ts                      # GET: 통계
└── ... (기타 API)

lib/state/
└── inspection-session-store.ts         # Zustand 상태 관리 (세션, 단계, 데이터)
```

---

## 2. 점검 단계(Step) 구조 및 입력 필드

### 단계별 개요
| Step | 제목 | 주요 기능 | 상태 플래그 |
|------|------|----------|-----------|
| 0 | 기본 정보 확인 | 담당자/주소/위치 검증, 지도/로드뷰, 접근성 정보 | `all_matched`, `location_matched`, `gps_verified` |
| 1 | 장비 및 소모품 점검 | 제조사/모델/시리얼, 배터리/패드 유효기간, 사진 | `all_matched`, `battery_matched`, `pad_matched`, `mfg_date_matched` |
| 2 | 보관함 점검 | 보관함 형태 선택, 체크리스트, 안내표지 | `storage_type`, `checklist_items`, `signage_selected` |
| 3 | 관리책임자 교육 | 교육 이수 여부, 미이수 사유, 보건복지부 전달사항 | `education_status`, `not_completed_reason` |
| 4 | 점검 요약 | 전체 데이터 검토, 사진 미리보기, 완료 처리 | (검증 단계, 필수 항목 확인) |

### Step 1: BasicInfoStep - 기본 정보 확인

#### 입력 필드
1. **기본 정보 섹션**
   - `manager` (관리책임자): 등록데이터와 비교, 수정 가능
   - `contact_info` (담당자 연락처): 등록데이터와 비교, 수정 가능
   - `external_display` (외부표출): Y/N 선택
   - `category_1/2/3` (분류체계): 대분류/중분류/소분류 드롭다운
   - `all_matched` 상태: `true` | `'edited'` | `false`

2. **위치 정보 섹션** (카카오맵 통합)
   - `address` (주소): 수정 가능
   - `installation_position` (설치위치): 수정 가능
   - `gps_latitude` / `gps_longitude`: 마커 드래그로 수정
   - `gps_verified`: GPS 확인 여부
   - `location_matched` 상태: `true` | `'edited'` | `false`

3. **접근성 정보 섹션**
   - `accessibility_level`: 'public' | 'restricted' | 'private'
   - `accessibility_reason`: 접근 제한 사유 (제한 시 필수)
   - `improved_schedule` (사용 가능 시간)
     - `is24hours`: 24시간 여부
     - `monday~sunday`: 각 요일의 `timeRange` (시간대)
     - `holiday`: 휴일 시간대

#### 상태 변화 메커니즘
```typescript
// 초기: 등록데이터로 필드 채움
// "전체 일치" 버튼 → all_matched = true (원본과 동일한 경우만 활성화)
// "수정" 버튼 클릭 → 수정 모드 진입
//   - 필드 수정 → all_matched = false
//   - "확인" 클릭 → all_matched = 'edited' (field_changes 기록)
// 버튼 색상 변화:
//   - 미확인: 회색 (disabled)
//   - 수정모드: 노란색 (확인 필요)
//   - 완료: 초록색 (checked mark)
```

### Step 2: DeviceInfoStep - 장비 및 소모품 점검

#### 입력 필드
1. **장비 정보 섹션**
   - `manufacturer` (제조사): 등록데이터와 비교, 수정 가능
   - `model_name` (모델명): 등록데이터와 비교, 수정 가능
   - `serial_number` (제조번호): 등록데이터와 비교, 수정 가능
   - `all_matched` 상태: `true` | `'edited'` | `false`
   - 내장 검증: KNOWN_MANUFACTURER_MODELS 매핑 확인

2. **소모품 정보 섹션** (각각 독립적인 matched 플래그)
   - `battery_expiry_date` (배터리 유효기간): 날짜 입력, `battery_expiry_date_matched`
   - `pad_expiry_date` (패드 유효기간): 날짜 입력, `pad_expiry_date_matched`
   - `manufacturing_date` (제조일자): 날짜 입력, `manufacturing_date_matched`
   - 각 필드의 `_matched`: `true` | `'edited'` | `false`

3. **사진 섹션** (PhotoCaptureInput)
   - 카메라로 실시간 사진 촬영
   - Base64 인코딩 저장
   - 여러 장 업로드 가능

#### 상태 변화
```typescript
// 각 소모품 필드는 독립적으로 all_matched 확인
// 하나라도 미확인 → 다음 단계 불가
// 수정 시 field_changes에 {original, corrected, reason} 기록
```

### Step 3: StorageChecklistStep - 보관함 점검

#### 입력 필드
1. **보관함 형태 선택** (라디오 버튼)
   - `storage_type`: 'none' | 'wall_mounted' | 'standalone'
   - 선택하지 않으면 이하 항목 비활성화

2. **보관함 체크리스트** (보관함 있을 때만)
   - `checklist_items`: Record<itemId, status>
     - alarm_functional: 도난경보장치 작동 → 'normal' | 'needs_improvement'
     - instructions_status: 안내문구 표시 → 'normal' | 'needs_improvement'
     - emergency_contact: 비상연락망 표시 → 'normal' | 'needs_improvement'
     - cpr_manual: 심폐소생술 안내 → 'booklet' | 'poster' | 'other' | 'needs_improvement'
     - expiry_display: 유효기간 표시 → 'displayed' | 'needs_improvement'
   - `improvement_notes`: Record<itemId, note> (needs_improvement 선택 시)

3. **안내표지 선택** (체크박스)
   - `signage_selected`: string[] (다중 선택)
   - 옵션: 'none' | 'entrance' | 'interior' | 'elevator' | 'map' | 'booklet'
   - 'none' 선택 시 다른 옵션 자동 해제

#### 상태 변화
```typescript
// 보관함 형태 선택 전: 회색 (disabled)
// 선택 후: 체크리스트와 안내표지 활성화
// "개선필요" 선택 시: 추가 텍스트 입력 필드 활성화
```

### Step 4: ManagerEducationStep - 관리책임자 교육

#### 입력 필드
1. **교육 이수 현황** (라디오 버튼)
   - `education_status`: 
     - 'manager_education': 관리책임자 교육 이수
     - 'legal_mandatory_education': 법정필수 교육 이수
     - 'not_completed': 미이수
     - 'other': 기타

2. **미이수 사유** (education_status = 'not_completed' 시)
   - `not_completed_reason`:
     - 'new_manager': 신임 관리책임자
     - 'recent_installation': 최근 설치
     - 'other': 기타
   - `not_completed_other_text`: 기타 사유 입력 (reason = 'other' 시 필수)

3. **기타 내용** (education_status = 'other' 시)
   - `education_other_text`: 기타 교육 현황 입력 (필수)

4. **보건복지부 전달사항** (선택)
   - `message_to_mohw`: 텍스트 입력 (선택사항)

### Step 5: InspectionSummaryStep - 점검 요약

#### 기능
- **전체 데이터 검토**: 모든 단계의 입력 데이터 표시
- **사진 미리보기**: DeviceInfoStep에서 업로드한 사진 목록
- **필수 항목 확인**: 완료 전 모든 단계의 필수 필드 재검증
- **완료 처리**: 
  - 확인 모달: "점검을 완료하시겠습니까? 완료 후에는 수정할 수 없습니다."
  - 성공 시: '/inspection/complete?serial=XXX' 리다이렉트

---

## 3. 데이터 흐름 (State Management)

### 상태 저장소: `useInspectionSessionStore`

#### 주요 상태
```typescript
interface InspectionSessionState {
  session: InspectionSession | null;           // 현재 세션
  currentStep: number;                          // 현재 단계 (0-4)
  stepData: Record<string, unknown>;           // 단계별 데이터
  lastSavedStepData: Record<string, unknown>; // 마지막 저장 상태 (변경감지용)
  isLoading: boolean;
  pendingChanges: PendingChange[];
  issues: InspectionIssue[];
}
```

#### 주요 메서드
1. **세션 관리**
   - `startSession(equipmentSerial)`: 새 점검 세션 시작
   - `loadSession(sessionId)`: 기존 세션 불러오기
   - `hydrateSession(session)`: 세션 데이터 로드

2. **데이터 수정**
   - `updateStepData(stepKey, data)`: 단계 데이터 업데이트 (로컬)
   - `updateFieldChange(field, change)`: 필드 변경 기록
   - `setCurrentStep(step)`: 현재 단계 변경

3. **저장/완료**
   - `persistProgress()`: 현재까지의 진행상황 저장
     - 로컬 `stepData` → 서버 저장
     - `lastSavedStepData` 동기화
   - `completeSession(finalData)`: 점검 완료 처리
     - 모든 단계 필수 항목 재검증
     - 서버에 최종 데이터 전송
     - 상태 = 'completed'로 변경

4. **세션 취소**
   - `cancelSessionSafely()`: 점검 취소 (데이터 보존, 상태 = 'cancelled')
   - `cancelSession(reason)`: 점검 취소 (기존)

5. **재개/재점검**
   - `reopenCompletedSession()`: 완료된 세션 재개
     - 상태 = 'completed' → 'active'로 변경
     - 기존 데이터 유지

#### 변경 감지 메커니즘
```typescript
// InspectionWorkflow.tsx의 handleNext()에서
const checkStepHasChanges = (step: number): boolean => {
  const currentData = stepData[stepKey];
  const savedData = lastSavedStepData[stepKey];
  
  // 저장된 적 없으면: 데이터 존재 여부로 판단
  if (!savedData) {
    return currentData && Object.keys(currentData).length > 0;
  }
  
  // 저장된 데이터 있으면: lodash isEqual로 깊은 비교
  return !isEqual(currentData, savedData);
};
```

---

## 4. API 엔드포인트 구조

### 세션 관리 API

#### POST /api/inspections/sessions - 점검 세션 시작
**요청:**
```json
{
  "equipment_serial": "AED_SERIAL_001"
}
```

**응답:**
```json
{
  "session": {
    "id": "uuid",
    "equipment_serial": "AED_SERIAL_001",
    "inspector_id": "user_id",
    "status": "active",
    "current_step": 0,
    "current_snapshot": {...},        // 현재 AED 데이터 스냅샷
    "device_info": {...},             // 호환성 필드
    "step_data": {...},               // 기존 진행상황 (재개 시)
    "started_at": "ISO8601",
    "updated_at": "ISO8601"
  }
}
```

**역할별 권한:**
- local_admin, temporary_inspector, master 등

#### GET /api/inspections/sessions - 세션 조회
**쿼리:**
- `sessionId`: 특정 세션 ID 조회
- `status`: 'active', 'completed', 'cancelled' 등 필터링
- `all`: 모든 상태 조회

#### PATCH /api/inspections/sessions - 세션 데이터 저장
**요청:**
```json
{
  "sessionId": "uuid",
  "currentStep": 1,
  "stepData": {
    "basicInfo": {...},
    "deviceInfo": {...}
  },
  "fieldChanges": {...},
  "status": "active"
}
```

**동작:**
- 현재까지 입력된 데이터 저장
- `step_data` 필드에 누적 저장
- 세션 상태: 'active' | 'paused' | 'completed' | 'cancelled'

#### POST /api/inspections/sessions/[id]/cancel - 세션 취소
**요청:**
```json
{
  "reason": "사용자 요청"
}
```

**응답:**
- 세션 상태 = 'cancelled'
- 입력된 데이터 보존

### 점검 이력 API

#### GET /api/inspections/history - 점검 이력 조회
**쿼리:**
- `equipment_serial`: 특정 장비의 이력만
- `hours`: 조회 범위 (기본값: 24)
- `mode`: 'address' (물리적 위치) | 'jurisdiction' (관할보건소)

**응답:**
```json
{
  "success": true,
  "count": 10,
  "inspections": [
    {
      "id": "uuid",
      "equipment_serial": "AED_SERIAL_001",
      "inspection_date": "2025-11-09",
      "last_inspection_date_egen": "2025-10-15",  // e-gen 참고용
      "data_source": "aedpics" | "egen",
      "inspector_name": "홍길동",
      "overall_status": "pass" | "fail" | "normal",
      "step_data": {...},
      "photos": [...],
      "created_at": "ISO8601"
    }
  ]
}
```

**권한별 조회 범위:**
- `local_admin`: 소속 지역 + filterMode 기준
- `regional_admin` / `master`: 전국
- `temporary_inspector`: 자신이 점검한 이력만

#### GET /api/inspections/[id] - 점검 상세 조회
**응답:** 특정 점검의 모든 데이터

#### PATCH /api/inspections/[id] - 점검 데이터 수정
**요청:**
```json
{
  "overall_status": "normal",
  "notes": "점검 완료",
  "step_data": {...}
}
```

**제약:** 관리자(local_admin 이상)만 가능

#### DELETE /api/inspections/[id] - 점검 이력 삭제
**제약:** 관리자(local_admin 이상)만 가능

#### POST /api/inspections/[id]/approve - 점검 승인
**요청:**
```json
{
  "approval_status": "approved",
  "notes": "검토 완료"
}
```

**역할:** 보건소 부장/본부장 이상

#### POST /api/inspections/[id]/reject - 점검 거부
**요청:**
```json
{
  "rejection_reason": "부정확한 입력",
  "notes": "재점검 필요"
}
```

---

## 5. UI 컴포넌트 상태 변화

### InspectionWorkflow.tsx - 5단계 점검 흐름

#### 프로그레스 인디케이터
```
[1] → [2] → [3] → [4] → [5]
 ✓     현재  미완  미완  미완  (현재 단계 = 2)
 초록  초록  회색  회색  회색
```

#### 버튼 상태 변화
| 상황 | 이전 | 중간저장 | 다음/완료 | 닫기 |
|------|------|--------|---------|------|
| Step 0 | disabled | enabled | 필수항목↓ | enabled |
| Step 1-4 | enabled | enabled | 필수항목↓ | 수정불가 |
| Step 5 | enabled | enabled | **완료** | 수정불가 |

#### 필수 항목 검증 (checkRequiredFields)
```typescript
// Step 0 (BasicInfoStep)
- all_matched: true OR 'edited'
- location_matched: true OR 'edited'
- accessibility_level: 선택됨
- improved_schedule.is24hours: 선택됨
- 각 요일 시간대 (24시간 아닐 때): 최소 1개 입력

// Step 1 (DeviceInfoStep)
- all_matched: true OR 'edited'
- battery_expiry_date_matched: true OR 'edited'
- pad_expiry_date_matched: true OR 'edited'
- manufacturing_date_matched: true OR 'edited'

// Step 2 (StorageChecklistStep)
- storage_type: 선택됨
- 보관함 있을 때:
  - checklist_items: 모든 항목 응답
  - signage_selected: 최소 1개 선택

// Step 3 (ManagerEducationStep)
- education_status: 선택됨
- 미이수 시: not_completed_reason 필수
- 기타 시: education_other_text 필수

// Step 4 (InspectionSummaryStep)
- (검증 단계, 필수 항목 없음)
```

### AdminFullView.tsx - 관리자 대시보드

#### 4가지 뷰 모드
1. **목록 (list)**: 점검 중인 장비 목록
2. **지도 (map)**: 점검 위치 시각화
3. **점검완료 (completed)**: 최근 24시간 완료된 점검
4. **임시저장 (drafts)**: 저장된 점검 세션

#### 갱신 메커니즘
```typescript
// 30초마다 자동 갱신
const interval = setInterval(loadInspectionData, 30000);

// 로드하는 데이터:
- getActiveInspectionSessions()     // 진행 중인 세션
- getCompletedInspections(24)       // 완료된 점검 (최근 24시간)
- getUnavailableAssignments(720)    // 점검 불가 (최근 30일)
```

#### 필터링 모드 (localStorage 저장)
```typescript
// local_admin인 경우만 유효
filterMode = 'address' (기본값) | 'jurisdiction'

// localStorage 키: 'inspectionFilterMode'
// 모드 변경 시 자동 저장 & 이력 재조회
```

### InspectionHistoryModal.tsx - 점검 이력 상세

#### 4단계 탭 인터페이스
```
[1단계: 기본정보] [2단계: 장비정보] [3단계: 보관함] [4단계: 점검요약]
    ReadOnlyXXXStep 컴포넌트들로 구성
```

#### 탭 네비게이션
```typescript
// 버튼: 이전 / 다음 (첫/마지막 단계에서 disabled)
// 진행률 표시: "2 / 4"
```

#### 액션 버튼
- **수정** (canEdit = true 시): 별도 수정 모달 → PATCH /api/inspections/[id]
- **삭제** (canDelete = true 시): 확인 후 → DELETE /api/inspections/[id]

---

## 6. 필드 변경 추적 (Field Changes)

### field_changes 구조
```typescript
{
  "manager": {
    "original": "홍길동",
    "corrected": "김철수",
    "reason": "현장 확인 후 수정"
  },
  "battery_expiry_date": {
    "original": "2027-10-15",
    "corrected": "2027-11-20",
    "reason": "제조사 교체 완료"
  }
}
```

### 기록 시점
1. **BasicInfoStep**: 기본정보/위치정보 수정 시
2. **DeviceInfoStep**: 장비/소모품 정보 수정 시
3. 최종적으로 `step_data`와 함께 DB에 저장

### 용도
- 데이터 감사(audit) 추적
- 수정 이력 조회
- inspection_field_comparisons 테이블 생성 (향후 개선 추적)

---

## 7. 점검 상태 변화 흐름

### 세션 상태 (inspection_sessions.status)
```
pending
  ↓
[사용자가 "점검 시작" 클릭]
  ↓
active (점검 진행 중)
  ↓
┌─────────────────────────────────────┐
│ (3가지 경로)                        │
├─────────────────────────────────────┤
│ 경로 1: "완료" 버튼 클릭            │
│ → Step 5에서 모든 필수항목 재검증   │
│ → persistProgress(status='completed')│
│ → state = 'completed'                │
│                                      │
│ 경로 2: "취소하기" 버튼 클릭        │
│ → cancelSessionSafely()              │
│ → state = 'cancelled'                │
│ → 입력 데이터 보존                   │
│                                      │
│ 경로 3: "중간저장후 닫기"           │
│ → persistProgress()                  │
│ → 상태 유지 ('active')              │
│ → 데이터 저장만 수행                │
└─────────────────────────────────────┘
```

### 점검 레코드 상태 (inspections.overall_status)
```
pending (초기)
  ↓
[세션 완료]
  ↓
pass / fail / normal / needs_improvement / malfunction
  ↓
[관리자 검토]
  ↓
approval_status: submitted → approved / rejected
```

---

## 8. 점검 완료 후 데이터 흐름

### 1단계: 세션 완료
```typescript
// InspectionSummaryStep에서 "완료" 버튼 클릭
await completeSession();

// 수행 작업:
// 1. 모든 단계 필수 항목 재검증
// 2. POST /api/inspections/sessions/complete
//    → inspections 레코드 생성
//    → inspection_sessions.status = 'completed'
// 3. step_data → inspections.inspected_data로 저장
// 4. field_changes → inspections에 저장
```

### 2단계: 데이터 반영
```typescript
// 쿼리 캐시 무효화 (React Query)
queryClient.invalidateQueries({
  queryKey: ['aed-inspections']
});
queryClient.invalidateQueries({
  queryKey: ['inspection-sessions']
});

// 리다이렉트
router.push(`/inspection/complete?serial=${equipmentSerial}`);
```

### 3단계: 대시보드 업데이트
```typescript
// AdminFullView에서 30초 갱신 주기로 탐지
// "점검완료" 탭에 표시 (viewMode = 'completed')
// 목록에서 상태 변경: '진행 중' → '완료'
```

### 4단계: 관리자 검토
```typescript
// 보건소 부장/본부장 계정에서
// AdminFullView → "점검진행목록" 탭 → 점검 이력 클릭
// → InspectionHistoryModal 열기
// → "승인" 또는 "거부" 버튼
//    - 승인: approval_status = 'approved'
//    - 거부: approval_status = 'rejected' + rejection_reason 기록

// API 호출:
POST /api/inspections/[id]/approve
POST /api/inspections/[id]/reject
```

---

## 9. 캐시 및 동기화 메커니즘

### localStorage 활용
```typescript
// 필터 모드 저장 (local_admin만)
localStorage.setItem('inspectionFilterMode', mode);
// 복원: loadInspectionData 호출 시

// Zustand store (메모리)
- session: 현재 세션 정보
- stepData: 현재 입력 데이터
- lastSavedStepData: 마지막 저장 상태
```

### 자동 갱신
```typescript
// AdminFullView: 30초마다
setInterval(() => {
  loadInspectionData();  // 세션, 완료, 불가 재조회
}, 30000);

// InspectionWorkflow: 필요시
- Step 전환: 변경사항 저장 여부 확인
- 완료: 최종 검증 후 저장
```

### 충돌 해결
```typescript
// 중복 갱신 방지 (LRUCache)
const refreshingSessionsCache = new LRUCache({
  max: 1000,
  ttl: 1000 * 60 * 5,  // 5분
});

// API 요청 중복 방지
if (refreshingSessionsCache.has(sessionId)) {
  return;  // 이미 진행 중
}
refreshingSessionsCache.set(sessionId, true);
```

---

## 10. 주요 UI 상태 변화 요약

### BasicInfoStep의 버튼 색상 변화
```
┌─────────────────────────────────────────────────────────────┐
│ "수정" 버튼 색상 상태                                        │
├─────────────────────────────────────────────────────────────┤
│ 초기 (all_matched 없음)                                      │
│ └─ 회색, 클릭 불가                                          │
│                                                              │
│ 데이터 불일치 (원본 ≠ 현재)                                 │
│ └─ 회색, 커서: 기본 (클릭하면 수정모드)                     │
│                                                              │
│ 데이터 일치 (원본 = 현재) & 비활성화됨                       │
│ └─ 회색 + disabled                                           │
│                                                              │
│ 수정 중 (isEditMode = true) & 변경됨                         │
│ └─ 노란색 (border-yellow-500) with 체크마크 아이콘          │
│                                                              │
│ 수정 완료 (all_matched = 'edited') & 차이 있음             │
│ └─ 초록색 (border-green-500) with 수정 아이콘              │
│                                                              │
│ 완료됨 (all_matched = true)                                 │
│ └─ 초록색 + disabled + 체크마크                             │
└─────────────────────────────────────────────────────────────┘
```

### "일치" 버튼 색상 변화
```
초기 상태:
└─ "전체 일치" (disabled if 불일치, 클릭 시 all_matched = true)

수정 완료 후:
└─ "일치로 변경" (disabled if 이미 일치)
```

### 지도 마커 상태
```
드래그 불가: 하신색
마커 이동 중: 애니메이션
마커 이동 완료: 
  └─ GPS 확인 버튼이 노란색으로 변경
  └─ "변경된 위치로 저장" 텍스트 표시
GPS 확인됨:
  └─ GPS 확인 버튼이 초록색으로 변경
  └─ "위치 확인됨" 텍스트
```

---

## 11. 성능 최적화

### 메모리 캐싱
- **세션 갱신**: LRUCache (5분 TTL, 최대 1000개)
- **Zustand Store**: 모든 상태 메모리 관리
- **로컬스토리지**: 필터 모드만 지속

### 쿼리 최적화
- **Prisma include**: 필요한 관계만 로드 (user_profiles, aed_data)
- **인덱스**: inspection_sessions, inspections에 다중 인덱스 구성
- **페이지네이션**: 가능하면 limit 적용

### UI 렌더링
- **lazy loading**: 마커 드래그 이벤트에서 로깅만 (drag 이벤트는 콘솔만)
- **isMapLoaded**: 지도 완전 로드 후 상호작용 활성화
- **modal**: Dialog 컴포넌트로 렌더링 최소화

---

## 12. 트러블슈팅

### 자주 발생하는 문제

#### 문제 1: "이전 단계로 돌아가도 데이터가 초기화된다"
**원인:** stepData와 lastSavedStepData 불일치
**해결:** 저장하지 않은 데이터는 메모리에만 존재 → "중간저장" 필수

#### 문제 2: "같은 세션을 여러 탭에서 열면 충돌"
**원인:** 상태 중복 갱신
**해결:** refreshingSessionsCache로 5분 내 중복 갱신 방지

#### 문제 3: "점검 완료 후에도 편집 가능"
**원인:** 권한 확인 누락
**해결:** canEdit/canDelete 플래그 확인 (AdminFullView)

#### 문제 4: "지도가 로드되지 않음"
**원인:** Kakao Maps API 키 만료 또는 지역 제한
**해결:** waitForKakaoMaps() 호출 후 에러 처리

#### 문제 5: "필터 모드 저장이 안 됨"
**원인:** local_admin 권한 확인 누락
**해결:** `user?.role === 'local_admin'` 조건 확인

---

## 13. 데이터베이스 스키마 관련 필드

### inspection_sessions 테이블
```sql
id (UUID, PK)
equipment_serial (FK)
inspector_id (FK)
status: 'active' | 'paused' | 'completed' | 'cancelled'
current_step: 0-4
current_snapshot: JSON (현재 AED 데이터)
original_snapshot: JSON (초기 AED 데이터)
step_data: JSON (점검 입력 데이터)
field_changes: JSON (수정 이력)
started_at
completed_at
updated_at
```

### inspections 테이블
```sql
id (UUID, PK)
equipment_serial
inspector_id (FK)
inspection_date
overall_status: 'pass' | 'fail' | 'normal' | ...
approval_status: 'submitted' | 'approved' | 'rejected'
approved_by_id
approved_at
rejection_reason
inspected_data: JSON (step_data 저장본)
photos: String[]
issues_found: String[]
created_at
updated_at
```

---

## 14. 향후 개선 사항 (TODO)

1. **사진 스토리지 마이그레이션**
   - Supabase → NCP Object Storage
   - photo-upload.ts 업데이트 필요

2. **점검 통계 대시보드**
   - statistics/page.tsx 구현
   - 월별/분기별 점검 현황

3. **e-gen 실시간 동기화**
   - 점검 완료 후 e-gen으로 자동 전송
   - 양방향 데이터 동기화

4. **PDF 리포트 생성**
   - 점검 결과 PDF 다운로드
   - 이메일 발송

5. **오프라인 모드 (PWA)**
   - IndexedDB에 로컬 저장
   - 네트워크 복구 시 동기화

---

## 부록: 파일 경로 참조

### 핵심 파일
- `/components/inspection/InspectionWorkflow.tsx` - 메인 워크플로우
- `/components/inspection/steps/BasicInfoStep.tsx` - Step 1
- `/components/inspection/steps/DeviceInfoStep.tsx` - Step 2
- `/components/inspection/steps/StorageChecklistStep.tsx` - Step 3
- `/components/inspection/AdminFullView.tsx` - 관리자 대시보드
- `/lib/state/inspection-session-store.ts` - 상태 관리
- `/app/api/inspections/sessions/route.ts` - 세션 API
- `/app/api/inspections/history/route.ts` - 이력 API
- `/prisma/schema.prisma` - 데이터베이스 스키마

### 페이지
- `/app/(authenticated)/inspection/page.tsx` - 점검 메인 페이지
- `/app/inspection/[serial]/page.tsx` - 점검 시작 페이지

---

**작성일**: 2025-11-09
**마지막 수정**: 2025-11-09
**담당자**: AEDpics 개발팀

