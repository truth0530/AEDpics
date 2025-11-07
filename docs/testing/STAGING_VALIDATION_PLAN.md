# 스테이징 검증 계획 (Staging Validation Plan)

**목적**: 점검완료 및 일정추가 API 엔드포인트의 수정사항 검증
**작성일**: 2025-11-07
**상태**: 실행 중

## 검증 대상

### 1. 점검완료 (Inspection Completion)
- **엔드포인트**: PATCH `/api/inspections/sessions/:sessionId`
- **수정사항**:
  - `removeUndefinedValues()` 래퍼 적용
  - ManagerEducationStep undefined 값 정리
- **예상 결과**: 200 OK, inspections 테이블에 완전한 데이터 저장

### 2. 일정추가 단일 (Schedule Addition - Single)
- **엔드포인트**: POST `/api/inspections/assignments`
- **수정사항**:
  - `notes: notes || null` 변환
  - User profile 쿼리에 email, region, district 포함
- **예상 결과**: 201 Created, inspection_assignments 테이블에 저장

### 3. 일정추가 대량 (Schedule Addition - Bulk)
- **엔드포인트**: POST `/api/inspections/assignments` (bulk handler)
- **수정사항**:
  - User profile 쿼리에 email, region, district 추가
  - resolveAccessScope() 올바른 동작
- **예상 결과**: 201 Created, 다중 레코드 일괄 저장

## 검증 환경 설정

### 테스트 계정
- **Master**: truth0530@nmc.or.kr (전국 권한)
- **Regional Admin**: regional@nmc.or.kr (시도 권한)
- **Local Admin**: local@nmc.or.kr (시군구 권한)

### 테스트 데이터
- Equipment Serial: 프로덕션 DB의 실제 AED 장비 번호 사용
- 점검 세션: 이미 '진행 중' 상태인 세션 사용

## 검증 시나리오

### 시나리오 1: 점검완료 API (200 OK)

**요청 정보**:
```bash
Method: PATCH
URL: https://aed.pics/api/inspections/sessions/{sessionId}
Headers:
  Authorization: Bearer {token}
  Content-Type: application/json
Body: {
  "inspected_data": {
    "basicInfo": {...},
    "deviceInfo": {...},
    "storage": {...}
  },
  "status": "completed"
}
```

**검증 항목**:
1. HTTP 상태 코드: 200 OK
2. 응답 본문: `{ success: true, sessionId: "..." }`
3. DB 확인:
   - `inspections` 테이블에 레코드 생성 ✅
   - `inspected_data` JSON 필드에 완전한 데이터 저장 ✅
   - undefined 값 없음 ✅

### 시나리오 2: 일정추가 단일 (201 Created)

**요청 정보**:
```bash
Method: POST
URL: https://aed.pics/api/inspections/assignments
Headers:
  Authorization: Bearer {token}
  Content-Type: application/json
Body: {
  "equipmentSerial": "AED-2025-001",
  "assignedTo": null,
  "scheduledDate": "2025-11-08",
  "scheduledTime": null,
  "assignmentType": "scheduled",
  "priorityLevel": 0,
  "notes": "테스트 일정추가"
}
```

**검증 항목**:
1. HTTP 상태 코드: 201 Created
2. 응답 본문: `{ success: true, assignmentId: "..." }`
3. DB 확인:
   - `inspection_assignments` 테이블에 레코드 생성 ✅
   - `notes` 필드가 null로 저장됨 ✅
   - `status`: 'pending' ✅

### 시나리오 3: 일정추가 대량 (201 Created)

**요청 정보**:
```bash
Method: POST
URL: https://aed.pics/api/inspections/assignments?bulk=true
Headers:
  Authorization: Bearer {token}
  Content-Type: application/json
Body: {
  "equipmentSerials": ["AED-2025-001", "AED-2025-002", "AED-2025-003"],
  "assignedTo": null,
  "scheduledDate": "2025-11-08",
  "scheduledTime": null,
  "assignmentType": "scheduled",
  "priorityLevel": 0,
  "notes": null
}
```

**검증 항목**:
1. HTTP 상태 코드: 201 Created
2. 응답 본문: `{ success: true, count: 3, assignmentIds: [...] }`
3. DB 확인:
   - 3개 레코드가 `inspection_assignments` 테이블에 생성 ✅
   - 모든 레코드의 `notes`: null ✅
   - `status`: 'pending' ✅

### 시나리오 4: 도메인 검증 (500 에러 방지)

**목표**: 도메인 검증이 올바르게 작동하는지 확인

**검증 항목**:
1. Regional Admin이 자신의 시도에 할당 가능 ✅
2. Local Admin이 자신의 시군구에 할당 가능 ✅
3. 권한 없는 지역 접근 시 403 ✅
4. 도메인 검증 오류로 500 발생하지 않음 ✅

## 수동 검증 절차

### Step 1: 환경 확인
```bash
# 프로덕션 환경 배포 상태 확인
curl -I https://aed.pics
# 예상: 200 OK

# 환경변수 확인 (서버에서)
ssh admin@aed.pics
echo $NCP_ACCESS_KEY | head -c 10  # 키가 설정되었는지 확인
```

### Step 2: 인증 토큰 획득
```bash
curl -X POST https://aed.pics/api/auth/signin/credentials \
  -H "Content-Type: application/json" \
  -d '{
    "email": "truth0530@nmc.or.kr",
    "password": "Master2025!",
    "callbackUrl": "https://aed.pics"
  }' \
  -c cookies.txt
```

### Step 3: 점검완료 테스트
```bash
# 진행 중인 점검 세션 조회
curl -X GET https://aed.pics/api/inspections/sessions \
  -b cookies.txt

# 세션 ID 기록: SESSION_ID="..."

# 점검완료 요청
curl -X PATCH https://aed.pics/api/inspections/sessions/{SESSION_ID} \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "inspected_data": {
      "basicInfo": {
        "address": "서울시 강서구",
        "manager_name": "김관리",
        "manager_phone": "010-1234-5678"
      },
      "deviceInfo": {
        "manufacturer": "Philips",
        "model_name": "FR3",
        "serial_number": "AED-2025-001"
      },
      "storage": {
        "visual_status": "normal"
      }
    },
    "status": "completed"
  }' \
  -w "\nHTTP Status: %{http_code}\n"
```

### Step 4: 일정추가 단일 테스트
```bash
curl -X POST https://aed.pics/api/inspections/assignments \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "equipmentSerial": "AED-2025-001",
    "assignedTo": null,
    "scheduledDate": "2025-11-08",
    "scheduledTime": null,
    "assignmentType": "scheduled",
    "priorityLevel": 0,
    "notes": "테스트 일정추가"
  }' \
  -w "\nHTTP Status: %{http_code}\n"
```

### Step 5: 일정추가 대량 테스트
```bash
curl -X POST "https://aed.pics/api/inspections/assignments?bulk=true" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "equipmentSerials": ["AED-2025-001", "AED-2025-002", "AED-2025-003"],
    "assignedTo": null,
    "scheduledDate": "2025-11-09",
    "scheduledTime": null,
    "assignmentType": "scheduled",
    "priorityLevel": 0,
    "notes": null
  }' \
  -w "\nHTTP Status: %{http_code}\n"
```

## DB 검증 쿼리

### 점검 완료 확인
```sql
-- inspections 테이블 확인
SELECT
  id,
  session_id,
  status,
  inspected_data::text,
  created_at
FROM inspections
ORDER BY created_at DESC
LIMIT 5;

-- 예상: inspected_data에 undefined 없음
```

### 일정추가 확인
```sql
-- inspection_assignments 테이블 확인
SELECT
  id,
  equipment_serial,
  assigned_to,
  assigned_by,
  notes,
  status,
  created_at
FROM inspection_assignments
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;

-- 예상: notes가 null 또는 문자열, undefined 없음
```

## 검증 체크리스트

### 점검완료 API
- [ ] HTTP 200 응답
- [ ] inspections 테이블에 레코드 생성됨
- [ ] inspected_data JSON 필드에 완전한 데이터
- [ ] undefined 값 없음
- [ ] 로그에 오류 없음

### 일정추가 단일
- [ ] HTTP 201 응답
- [ ] inspection_assignments 테이블에 레코드 생성됨
- [ ] notes 필드가 null로 변환됨
- [ ] 도메인 검증 성공
- [ ] 로그에 "Assignment created successfully" 메시지

### 일정추가 대량
- [ ] HTTP 201 응답
- [ ] inspection_assignments 테이블에 N개 레코드 생성됨
- [ ] 모든 notes 필드가 null로 변환됨
- [ ] 도메인 검증 성공
- [ ] 로그에 bulk assignment 메시지

### 도메인 검증
- [ ] resolveAccessScope() 올바르게 동작
- [ ] email 필드를 사용하여 도메인 식별
- [ ] region, district 필드를 사용하여 접근 범위 결정
- [ ] 권한 없는 지역 접근 시 403 반환
- [ ] 도메인 정책 위반으로 500 에러 없음

## 예상 오류 및 대응

### 오류 1: 500 Internal Server Error (도메인 검증)
**원인**: email, region, district 필드가 null
**확인**: User profile 쿼리의 select 문 검증
**해결**: 필드를 select 문에 추가

### 오류 2: 400 Bad Request (undefined 값)
**원인**: inspected_data에 undefined 값 포함
**확인**: JSON 직렬화 시 undefined 제거 확인
**해결**: removeUndefinedValues() 함수 적용 확인

### 오류 3: 409 Conflict (중복 할당)
**원인**: 같은 장비에 이미 할당된 일정이 존재
**확인**: inspection_assignments 테이블의 기존 레코드
**해결**: 다른 장비 번호 사용

## 검증 완료 기준

모든 시나리오가 다음을 만족할 때:
1. ✅ HTTP 상태 코드 올바름 (200, 201)
2. ✅ DB에 완전한 데이터 저장
3. ✅ undefined 값 없음
4. ✅ 도메인 검증 오류 없음
5. ✅ 500 에러 발생 안 함
6. ✅ 로그에 오류 메시지 없음

## 다음 단계

검증 완료 후:
1. E2E 테스트 (Playwright) 실행
2. 성능 테스트 (250개 보건소 동시 접근)
3. 보안 테스트 (권한 체계)
4. 프로덕션 배포

---

**작성자**: Claude Code
**최종 수정**: 2025-11-07
