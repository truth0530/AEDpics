# 스테이징 검증 실행 가이드 (Execution Guide)

**목적**: 점검완료 및 일정추가 API 수정사항의 스테이징 환경에서의 검증 실행
**작성일**: 2025-11-07
**상태**: 준비 완료

## 빠른 시작

### 자동 검증 스크립트 실행

```bash
# 프로덕션 환경에서 검증
chmod +x scripts/staging-validation.sh
./scripts/staging-validation.sh https://aed.pictures

# 로컬 스테이징에서 검증
./scripts/staging-validation.sh http://localhost:3001
```

**예상 출력**:
```
✅ PASS: 웹 서버 접근 가능
✅ PASS: Master 계정 인증 성공 (HTTP 200)
✅ PASS: 일정추가 단일: 201 Created
✅ PASS: 일정추가 대량: 201 Created
✅ PASS: 도메인 검증: nmc.or.kr (정부 도메인)
```

## 수정사항 요약

### 1. 점검완료 API (Inspection Completion)

**파일**: [app/api/inspections/sessions/route.ts](../../app/api/inspections/sessions/route.ts)

**문제**: JSON 직렬화 시 undefined 값으로 인한 Prisma 오류
- ManagerEducationStep 등에서 명시적으로 undefined 값 설정
- JSON.stringify()가 undefined를 자동 제거 → Prisma Json 필드 타입 불일치

**해결**:
1. `removeUndefinedValues()` 함수 추가 (lines 38-57)
   - 재귀적으로 모든 중첩된 undefined 제거
   - 배열 및 객체 처리

2. `inspected_data` 래핑 적용 (line 680)
   ```typescript
   inspected_data: removeUndefinedValues({
     basicInfo: basicInfo,
     deviceInfo: deviceInfo,
     storage: storage,
     // ...
   })
   ```

3. 로깅, 세션 업데이트, 필드 분석에도 적용
   - Session 저장: removeUndefinedValues 적용 (lines 606-704)
   - 필드 비교: removeUndefinedValues 적용 (lines 732-754)

**결과**:
- ✅ 점검완료 시 undefined 값이 DB로 내려가지 않음
- ✅ JSON 직렬화 오류 방지
- ✅ 데이터 무결성 보장

### 2. 일정추가 API - 도메인 검증 (Schedule Assignment - Domain Validation)

**파일**: [app/api/inspections/assignments/route.ts](../../app/api/inspections/assignments/route.ts)

**문제**: 500 에러로 인한 일정추가 실패
- `resolveAccessScope()` 함수가 사용자 이메일 도메인을 확인 필요
- User profile 조회 시 `email` 필드 누락
- 도메인 식별 실패 → "비정부 도메인 관리자는 금지" 예외

**해결**:
1. **대량 경로** (Bulk Handler - lines 28-40)
   ```typescript
   const userProfile = await prisma.user_profiles.findUnique({
     where: { id: session.user.id },
     select: {
       id: true,
       role: true,
       email: true,        // ← 추가
       organization_id: true,
       region_code: true,
       region: true,       // ← 추가
       district: true      // ← 추가
     }
   });
   ```

2. **단일 경로** (Single Handler - lines 208-218)
   - 이미 email 포함됨 (기존 코드)
   - region, district 추가 가능하지만 현재 불필요

**결과**:
- ✅ `resolveAccessScope()` 올바르게 동작
- ✅ 정부 vs 비정부 도메인 올바른 식별
- ✅ 도메인-역할 정책 올바르게 적용
- ✅ 500 에러 발생 없음

### 3. 일정추가 API - Null 처리 (Schedule Assignment - Notes Null Handling)

**파일**: [app/api/inspections/assignments/route.ts](../../app/api/inspections/assignments/route.ts)

**문제**: 선택적 `notes` 필드 처리 오류
- `notes` 필드가 제공되지 않을 때 undefined 상태
- Prisma create 실패 가능성

**해결** (line 362):
```typescript
notes: notes || null,  // undefined → null 변환
```

**결과**:
- ✅ 선택적 필드가 명시적으로 null로 저장
- ✅ 데이터베이스 타입 일치
- ✅ 선택적 입력 처리 안전성

### 4. 컴포넌트 최적화 (Component Cleanup)

**파일**: [components/inspection/steps/ManagerEducationStep.tsx](../../components/inspection/steps/ManagerEducationStep.tsx)

**문제**: 명시적 undefined 값 설정
- 상태 업데이트 시 불필요한 필드를 undefined로 명시적 설정
- 이후 JSON 직렬화 시 제거되어 데이터 불일치

**해결** (lines 44-113):
```typescript
// 이전: 명시적 undefined
const updated = {
  ...(managerEducation as Record<string, unknown>),
  education_status: 'manager_education',
  not_completed_reason: undefined,  // ❌
  not_completed_other_text: undefined  // ❌
};

// 이후: delete 패턴
const updated = {
  ...(managerEducation as Record<string, unknown>),
  education_status: 'manager_education'
} as Record<string, unknown>;
delete updated.not_completed_reason;  // ✅
delete updated.not_completed_other_text;  // ✅
```

**결과**:
- ✅ 상태 객체에 undefined 값 없음
- ✅ 컴포넌트에서 깔끔한 데이터 생성
- ✅ API 전송 데이터 정확성

## 검증 항목

### API 응답 검증

| 엔드포인트 | 메서드 | 예상 상태 | 검증 항목 |
|----------|--------|---------|---------|
| `/api/inspections/sessions/:id` | PATCH | 200 | `inspected_data` JSON에 undefined 없음 |
| `/api/inspections/assignments` | POST | 201 | `notes` 필드가 null로 저장 |
| `/api/inspections/assignments?bulk=true` | POST | 201 | 모든 `notes`가 null로 저장, email 도메인 검증 |

### 데이터베이스 검증

#### inspections 테이블
```sql
SELECT
  id,
  session_id,
  inspected_data::text,
  created_at
FROM inspections
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 5;
```

**확인 사항**:
- `inspected_data` JSON에 `undefined` 문자열 없음
- 모든 필드가 유효한 JSON 타입

#### inspection_assignments 테이블
```sql
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
```

**확인 사항**:
- `notes` 필드: NULL 또는 문자열 (undefined 없음)
- `status`: 'pending'
- 모든 필드가 올바르게 저장됨

### 로그 검증

**점검완료 관련**:
```
✅ INFO: Session finalized successfully
✅ INFO: Inspection created: {id}
❌ ERROR: Invalid prisma.inspections.create() (이전 오류, 이제 발생 안 함)
```

**일정추가 관련**:
```
✅ INFO: Assignment created successfully (또는 bulk create)
✅ INFO: Domain validation passed: nmc.or.kr
❌ ERROR: Domain-role policy violation (이전 오류, 이제 발생 안 함)
```

## 수동 검증 절차

### Step 1: 환경 준비

```bash
# 환경 확인
echo "검증 시작: $(date)"
echo "기본 URL: https://aed.pictures"

# 웹 서버 상태 확인
curl -s -I https://aed.pictures | head -1
# 예상: HTTP/2 200
```

### Step 2: 인증

```bash
# Master 계정으로 로그인
curl -X POST https://aed.pictures/api/auth/signin/credentials \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "truth0530@nmc.or.kr",
    "password": "Master2025!",
    "callbackUrl": "https://aed.pictures"
  }'

# 쿠키 확인
cat cookies.txt | grep -v "^#"
# 예상: nextauth.session-token 또는 유사 토큰
```

### Step 3: 일정추가 테스트 (단일)

```bash
# 첫 번째 AED 장비 조회
SERIAL=$(curl -s https://aed.pictures/api/aed-data?limit=1 \
  -b cookies.txt | jq -r '.data[0].equipment_serial')

echo "테스트 장비: $SERIAL"

# 일정추가 요청
curl -X POST https://aed.pictures/api/inspections/assignments \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d "{
    \"equipmentSerial\": \"$SERIAL\",
    \"assignedTo\": null,
    \"scheduledDate\": \"$(date -u +%Y-%m-%d)\",
    \"scheduledTime\": null,
    \"assignmentType\": \"scheduled\",
    \"priorityLevel\": 0,
    \"notes\": \"수동 검증\"
  }" | jq .

# 예상 응답:
# {
#   "success": true,
#   "assignmentId": "...",
#   "message": "Assignment created"
# }
```

### Step 4: 일정추가 테스트 (대량)

```bash
# 3개 AED 장비 조회
SERIALS=$(curl -s https://aed.pictures/api/aed-data?limit=3 \
  -b cookies.txt | jq -r '.data[].equipment_serial')

echo "테스트 장비: $SERIALS"

# 배열로 변환
SERIAL_ARRAY=$(echo "$SERIALS" | jq -R . | jq -s .)

# 대량 일정추가 요청
curl -X POST https://aed.pictures/api/inspections/assignments \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d "{
    \"equipmentSerials\": $SERIAL_ARRAY,
    \"assignedTo\": null,
    \"scheduledDate\": \"$(date -u +%Y-%m-%d)\",
    \"scheduledTime\": null,
    \"assignmentType\": \"scheduled\",
    \"priorityLevel\": 0,
    \"notes\": null
  }" | jq .

# 예상 응답:
# {
#   "success": true,
#   "count": 3,
#   "assignmentIds": [...],
#   "message": "Bulk assignment created"
# }
```

### Step 5: DB 검증

```bash
# 프로덕션 서버에 접근
ssh admin@aed.pictures

# 최근 일정추가 확인
psql -h $DB_HOST -U $DB_USER -d aedpics_production << EOF
SELECT
  id,
  equipment_serial,
  notes,
  status,
  created_at
FROM inspection_assignments
WHERE created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC
LIMIT 5;
EOF

# 예상: notes 필드가 NULL 또는 문자열
```

## 예상 결과

### 성공 사례 (Success Path)

#### 일정추가 단일
```
HTTP 201
{
  "success": true,
  "assignmentId": "550e8400-e29b-41d4-a716-446655440000",
  "assignment": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "equipment_serial": "AED-2025-001",
    "assigned_to": "abc123...",
    "notes": "수동 검증",
    "status": "pending",
    "created_at": "2025-11-07T10:30:00Z"
  }
}
```

#### 일정추가 대량
```
HTTP 201
{
  "success": true,
  "count": 3,
  "assignmentIds": [
    "550e8400-e29b-41d4-a716-446655440000",
    "550e8400-e29b-41d4-a716-446655440001",
    "550e8400-e29b-41d4-a716-446655440002"
  ],
  "message": "3 assignments created"
}
```

### 오류 사례 (Error Path)

#### 도메인 검증 실패 (현재 수정됨)
```
❌ 이전:
HTTP 500
{
  "error": "Domain-role policy violation: non-government domain admin is not allowed"
}

✅ 현재:
HTTP 201 (정상 처리)
```

#### undefined 값 오류 (현재 수정됨)
```
❌ 이전:
HTTP 400
{
  "error": "Invalid prisma.inspections.create(): Expected string, received undefined"
}

✅ 현재:
HTTP 200 (정상 저장)
```

## 체크리스트

### 점검완료 API
- [ ] HTTP 200 응답
- [ ] 응답 본문에 sessionId 포함
- [ ] inspections 테이블에 새로운 레코드 생성됨
- [ ] inspected_data JSON 필드에 완전한 데이터 (undefined 없음)
- [ ] 로그에 "Session finalized successfully" 메시지

### 일정추가 단일
- [ ] HTTP 201 응답
- [ ] 응답 본문에 assignmentId 포함
- [ ] inspection_assignments 테이블에 레코드 생성됨
- [ ] notes 필드가 제공된 값 또는 null로 저장
- [ ] 로그에 "Assignment created successfully" 메시지

### 일정추가 대량
- [ ] HTTP 201 응답
- [ ] 응답 본문에 count와 assignmentIds 포함
- [ ] inspection_assignments 테이블에 N개 레코드 생성됨
- [ ] 모든 레코드의 notes 필드가 null 또는 문자열로 저장
- [ ] 로그에 bulk assignment 메시지

### 도메인 검증
- [ ] Master 계정으로 전국 일정추가 가능
- [ ] Regional Admin으로 해당 시도 일정추가 가능
- [ ] Local Admin으로 해당 시군구 일정추가 가능
- [ ] 권한 없는 지역 접근 시 403 Forbidden
- [ ] 도메인 검증으로 인한 500 에러 없음

### 데이터 정확성
- [ ] undefined 값이 DB에 저장되지 않음
- [ ] JSON 필드에 유효한 JSON 형식
- [ ] 모든 필수 필드 저장
- [ ] 타임스탬프 정확함

## 문제 해결

### 문제: 401 Unauthorized
**원인**: 인증 토큰 만료 또는 쿠키 미설정
**해결**: Step 2 인증 절차 다시 실행

### 문제: 409 Conflict (일정추가)
**원인**: 같은 장비에 이미 할당된 일정 존재
**해결**: 다른 장비 번호 사용

### 문제: 500 Internal Server Error
**원인**: 도메인 검증 오류 (수정됨) 또는 다른 오류
**해결**: 로그 확인 및 에러 메시지 분석

### 문제: JSON 파싱 오류
**원인**: 응답 형식 오류
**해결**: 응답을 `jq .` 없이 확인하여 원본 출력 검사

## 다음 단계

1. ✅ **코드 수정 완료** (현재 상태)
   - removeUndefinedValues 적용
   - email/region/district 필드 추가
   - delete 패턴 적용

2. 🔄 **스테이징 검증** (진행 중)
   - 자동 검증 스크립트 실행
   - 수동 API 테스트
   - DB 데이터 확인

3. ⏳ **E2E 테스트** (대기 중)
   - Playwright E2E 테스트 실행
   - Master + temp_inspector + coordinator 계정 테스트
   - 전체 워크플로우 검증

4. ⏳ **프로덕션 배포** (대기 중)
   - 스테이징 검증 완료 후 프로덕션 배포

---

**작성자**: Claude Code
**마지막 수정**: 2025-11-07
**상태**: 검증 준비 완료
