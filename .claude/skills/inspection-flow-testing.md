# Inspection Flow Testing Skill

## Purpose
점검 기능의 전체 워크플로우를 자동으로 검증하여 기능 완성도와 데이터 무결성을 보장합니다.

## 테스트 대상

### 점검 세션 생성 흐름
1. POST /api/inspections/sessions - 새 점검 세션 생성
2. GET /api/inspections/sessions - 세션 목록 조회
3. PATCH /api/inspections/sessions - 세션 업데이트 (점검 상태 변경)

### 점검 결과 저장 흐름
1. POST /api/inspections - 점검 결과 저장
2. GET /api/inspections/history - 점검 이력 조회
3. PUT /api/inspections - 점검 결과 수정
4. DELETE /api/inspections - 점검 결과 삭제

### 점검 UI 검증
1. QuickInspectPanel 렌더링
2. ScheduleModal 렌더링
3. InspectionHistoryModal 렌더링
4. PhotoCaptureInput 렌더링

## 테스트 체크리스트

### 단계 1: 점검 세션 API 검증

#### 1-1. 세션 생성
```bash
POST /api/inspections/sessions
Content-Type: application/json

{
  "equipment_id": "EQU-001",
  "equipment_serial": "SN12345678",
  "location_id": "LOC-001",
  "inspector_id": "<USER_ID>",
  "inspection_type": "quick"
}
```

**검증 항목:**
- [ ] 상태코드: 201 Created
- [ ] Response body에 session_id 포함
- [ ] inspection_sessions 테이블에 레코드 생성됨
- [ ] session_status = 'in_progress'
- [ ] created_at 타임스탬프 포함

**예상 응답:**
```json
{
  "success": true,
  "message": "점검 세션이 생성되었습니다.",
  "session_id": "sess_abc123def456",
  "data": {
    "id": "sess_abc123def456",
    "equipment_id": "EQU-001",
    "equipment_serial": "SN12345678",
    "inspector_id": "<USER_ID>",
    "session_status": "in_progress",
    "created_at": "2025-11-09T10:30:00Z"
  }
}
```

#### 1-2. 세션 목록 조회
```bash
GET /api/inspections/sessions?equipment_id=EQU-001
```

**검증 항목:**
- [ ] 상태코드: 200 OK
- [ ] sessions 배열 포함
- [ ] 각 세션이 올바른 필드 포함 (id, equipment_id, inspector_id, session_status, created_at)
- [ ] 정렬: 최근 순서 (created_at DESC)

#### 1-3. 세션 업데이트 (점검 완료)
```bash
PATCH /api/inspections/sessions/<SESSION_ID>
Content-Type: application/json

{
  "session_status": "completed",
  "visual_status": "good",
  "battery_status": "good",
  "pad_status": "good",
  "operation_status": "normal",
  "overall_status": "normal",
  "issues_found": [],
  "notes": "정상 작동합니다."
}
```

**검증 항목:**
- [ ] 상태코드: 200 OK
- [ ] session_status = 'completed'로 변경됨
- [ ] 모든 status 필드가 저장됨
- [ ] 프로필 관계 설정 (user_profiles { connect })
- [ ] inspection_assignments 레코드 생성됨

**에러 감지:**
```
❌ PrismaClientValidationError
"Unknown field `inspector_id` on model `inspection_sessions`"

원인: inspector_id를 직접 할당하려고 함
해결: user_profiles: { connect: { id: userId } } 사용
```

### 단계 2: 점검 결과 API 검증

#### 2-1. 점검 결과 저장
```bash
POST /api/inspections
Content-Type: application/json

{
  "equipment_serial": "SN12345678",
  "inspector_id": "<USER_ID>",
  "inspection_date": "2025-11-09",
  "location_name": "강남역 지하철역",
  "visual_status": "good",
  "battery_status": "good",
  "pad_status": "good",
  "operation_status": "normal",
  "overall_status": "normal",
  "issues_found": [],
  "photos": []
}
```

**검증 항목:**
- [ ] 상태코드: 201 Created
- [ ] inspection_id 반환됨
- [ ] inspections 테이블에 레코드 생성됨
- [ ] 모든 필드가 올바르게 저장됨
- [ ] equipment_serial 기반 조회 가능

#### 2-2. 점검 이력 조회
```bash
GET /api/inspections/history?equipment_serial=SN12345678
```

**검증 항목:**
- [ ] 상태코드: 200 OK
- [ ] inspections 배열 포함
- [ ] snake_case 필드명 일치 (field naming bug 수정 확인)
- [ ] 최근 순서 정렬
- [ ] 총 레코드 수 포함

**필드명 검증 (2025-10-28 버그 수정):**
```json
{
  "id": "INS-001",
  "equipment_serial": "SN12345678",  // ✅ snake_case 일치
  "visual_status": "good",
  "battery_status": "good",
  "inspection_date": "2025-11-09"
}
```

#### 2-3. 점검 결과 수정
```bash
PUT /api/inspections/<INSPECTION_ID>
Content-Type: application/json

{
  "visual_status": "poor",
  "notes": "수리 필요함"
}
```

**검증 항목:**
- [ ] 상태코드: 200 OK
- [ ] 변경된 필드만 업데이트됨
- [ ] 다른 필드는 변경 안 됨
- [ ] updated_at 타임스탬프 갱신됨

#### 2-4. 점검 결과 삭제
```bash
DELETE /api/inspections/<INSPECTION_ID>
```

**검증 항목:**
- [ ] 상태코드: 200 OK 또는 204 No Content
- [ ] inspections 테이블에서 레코드 삭제됨
- [ ] 관련 attachment 레코드도 함께 삭제됨

### 단계 3: UI 컴포넌트 렌더링 검증

#### 3-1. QuickInspectPanel
**위치:** components/inspection/QuickInspectPanel.tsx

- [ ] 컴포넌트 렌더링됨
- [ ] "즉시 점검" 버튼 표시됨
- [ ] 클릭 시 점검 세션 생성 API 호출
- [ ] 로딩 상태 표시됨
- [ ] 성공/실패 메시지 표시됨

#### 3-2. ScheduleModal
**위치:** components/inspection/ScheduleModal.tsx

- [ ] 모달 오픈/클로즈됨
- [ ] 날짜 선택 가능
- [ ] 시간 선택 가능
- [ ] "예약" 버튼으로 스케줄 API 호출
- [ ] 예약 확인 메시지 표시됨

#### 3-3. InspectionHistoryModal
**위치:** components/inspection/InspectionHistoryModal.tsx

- [ ] 4가지 탭 렌더링:
  - [ ] 1단계: 기본정보 (ReadOnlyBasicInfoStep)
  - [ ] 2단계: 장비정보 (ReadOnlyDeviceInfoStep)
  - [ ] 3단계: 보관함 (ReadOnlyStorageChecklistStep)
  - [ ] 4단계: 점검요약 (ReadOnlyInspectionSummaryStep)
- [ ] 각 탭에서 데이터 올바르게 표시됨
- [ ] 수정/삭제 버튼 표시됨 (권한에 따라)
- [ ] 수정 클릭 시 PUT API 호출
- [ ] 삭제 클릭 시 DELETE API 호출

#### 3-4. PhotoCaptureInput
**위치:** components/inspection/PhotoCaptureInput.tsx

- [ ] 카메라 입력 요청 가능
- [ ] MediaStream 획득됨
- [ ] Base64 인코딩 완료
- [ ] 사진 미리보기 표시됨
- [ ] 사진 제거 버튼 작동

### 단계 4: 데이터 흐름 검증

#### 4-1. End-to-End 점검 흐름
```
1. QuickInspectPanel 클릭
   ↓
2. POST /api/inspections/sessions (세션 생성)
   ↓
3. 점검 폼 입력 (상태, 문제, 사진)
   ↓
4. "완료" 버튼 클릭
   ↓
5. PATCH /api/inspections/sessions (세션 상태 변경)
   ↓
6. POST /api/inspections (점검 결과 저장)
   ↓
7. GET /api/inspections/history (이력 조회)
   ↓
8. InspectionHistoryModal 표시 (최신 데이터 포함)
```

**검증:**
- [ ] 각 단계 성공 (상태코드 200-201)
- [ ] 데이터 일관성 (세션 ID → 점검 결과)
- [ ] 타임스탬프 순서 정확
- [ ] 사용자 ID 일치

#### 4-2. 점검 수정 흐름
```
1. InspectionHistoryModal에서 수정 클릭
   ↓
2. PUT /api/inspections/<ID> (점검 결과 수정)
   ↓
3. GET /api/inspections/history (갱신된 데이터 조회)
   ↓
4. 모달 업데이트 (최신 데이터 반영)
```

## 테스트 실행 명령어

### 로컬 테스트 환경 구성
```bash
# 1. 개발 서버 시작
npm run dev

# 2. 별도 터미널에서 테스트 실행
# (직접 curl 또는 Postman 사용)

# 3. 데이터베이스 상태 확인
npm run test:db:status
```

### 수동 테스트 체크리스트
```bash
# 1. 세션 생성 테스트
curl -X POST http://localhost:3001/api/inspections/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "equipment_id": "EQU-TEST-001",
    "equipment_serial": "TEST12345",
    "location_id": "LOC-TEST",
    "inspector_id": "test_user_id",
    "inspection_type": "quick"
  }'

# 2. 세션 목록 조회
curl http://localhost:3001/api/inspections/sessions?equipment_id=EQU-TEST-001

# 3. 점검 결과 저장
curl -X POST http://localhost:3001/api/inspections \
  -H "Content-Type: application/json" \
  -d '{
    "equipment_serial": "TEST12345",
    "inspector_id": "test_user_id",
    "inspection_date": "2025-11-09",
    "overall_status": "good"
  }'
```

## 예상 오류와 해결법

### 에러 1: PrismaClientValidationError (inspector_id)
```
Error: Unknown field `inspector_id` on model `inspection_sessions`
```

해결:
- 파일: app/api/inspections/sessions/route.ts
- 수정: user_profiles: { connect: { id: userId } } 사용

### 에러 2: Field Naming Mismatch
```
Error: Field name mismatch in response
Expected: inspection_date
Got: inspectionDate
```

해결:
- 파일: app/api/inspections/history/route.ts
- 검증: 모든 응답 필드가 snake_case 일치하는지 확인

### 에러 3: 세션 데이터 인식 실패
```
Error: Cannot read property 'session' of undefined
```

해결:
- 파일: hooks/useInspectionSession.ts
- 수정: `const session = (payload.session ?? payload.sessions?.[0])`로 fallback 추가

## 결과 보고서 양식

### 모든 테스트 통과
```
INSPECTION FLOW TESTING REPORT
Generated: 2025-11-09 14:30:00

✅ Session API Tests
   - POST /api/inspections/sessions: PASSED
   - GET /api/inspections/sessions: PASSED
   - PATCH /api/inspections/sessions: PASSED

✅ Inspection Result API Tests
   - POST /api/inspections: PASSED
   - GET /api/inspections/history: PASSED
   - PUT /api/inspections: PASSED
   - DELETE /api/inspections: PASSED

✅ UI Component Tests
   - QuickInspectPanel: PASSED
   - ScheduleModal: PASSED
   - InspectionHistoryModal: PASSED
   - PhotoCaptureInput: PASSED

✅ End-to-End Flow Tests
   - Complete inspection flow: PASSED
   - Inspection edit flow: PASSED

FINAL RESULT: ALL TESTS PASSED
Inspection functionality is production-ready.
```

### 테스트 실패
```
INSPECTION FLOW TESTING REPORT
Generated: 2025-11-09 14:30:00

❌ Session API Tests
   - PATCH /api/inspections/sessions: FAILED

Error Details:
POST /api/inspections/sessions/sess_001
Status Code: 500
Error Message: PrismaClientValidationError
Details: Unknown field `inspector_id`

Root Cause Analysis:
The route attempts to assign inspector_id directly
instead of using relation: user_profiles { connect }

Fix Required:
File: app/api/inspections/sessions/route.ts
Line: 42
Change: inspector_id: userId
To: user_profiles: { connect: { id: userId } }

Next Steps:
1. Apply fix
2. Test PATCH endpoint again
3. Re-run full test suite
```

## 참고 문서
- [점검 기능 상세 현황](CLAUDE.md#점검-기능-상세-현황) - CLAUDE.md 참조
- [components/inspection/](components/inspection/) - 점검 컴포넌트 목록
- [app/api/inspections/](app/api/inspections/) - 점검 API 엔드포인트
- [prisma/schema.prisma](prisma/schema.prisma) - 데이터베이스 스키마
