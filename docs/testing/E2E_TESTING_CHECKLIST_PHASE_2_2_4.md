# E2E Testing Checklist - Phase 2.2.4 Equipment-Centric Architecture

## 목적
Phase 2.2.4에서 구현한 equipment-centric 접근 제어 패턴이 모든 엔드포인트에서 정상적으로 작동하는지 Playwright MCP를 통해 검증합니다.

## 테스트 환경
- Browser: Chromium (Playwright MCP)
- URL: https://aed.pics
- Test Duration: 약 2-3시간 (전체 시나리오)

## 테스트 계정 목록
```
1. Master Admin (전국 권한)
   - Email: truth0530@nmc.or.kr
   - Password: Dlsxm*0537
   - Expected Access: 모든 장비, 모든 지역

2. Temporary Inspector 1 (할당된 장비만)
   - Email: truth0530@kakao.com
   - Name: 이광성중구점검2
   - Password: Dlsxm*0537
   - Expected Access: /api/inspections/assigned-devices만 허용

3. Temporary Inspector 2 (할당된 장비만)
   - Email: shout530@naver.com
   - Name: 이광성중구
   - Password: Dlsxm*0537
   - Expected Access: /api/inspections/assigned-devices만 허용

4. Health Center Coordinator (보건소 담당자)
   - Email: nemcdg@korea.kr
   - Password: dpdlelvlrTm*25
   - Expected Access: 소속 시군구 장비 및 관할 보건소 관리 장비
```

NOTE: 임시 점검원 계정의 이메일 주소는 환경변수에 저장되어 있으므로 테스트 실행 시 확인 필요

## 중요: 테스트 계정 구조 변경사항

원래 체크리스트에서는 다음 4가지 역할을 테스트하려고 했습니다:
- Master Admin (전국 권한)
- Regional Admin (시도 제한)
- Local Admin (시군구 제한)
- Temporary Inspector (할당 장비만)

하지만 실제 운영 중인 계정은:
- Master Admin (truth0530@nmc.or.kr) ✅
- Temporary Inspector 1 (이광성중구점검2) ✅
- Temporary Inspector 2 (이광성중구) ✅
- Health Center Coordinator (nemcdg@korea.kr) ✅

**Regional Admin과 Local Admin 계정은 현재 시스템에 없습니다.**

### 테스트 전략 조정

1. **Master Admin 테스트**: 모든 기능 (Phase 2, 3, 4 완전 테스트)
2. **Temporary Inspector 테스트**: 역할 제한 테스트 (2.6, 3.8-3.9 완료)
3. **Health Center Coordinator 테스트**: 보건소 담당자 권한 테스트 추가 필요
4. **Regional/Local Admin 테스트**: 해당 계정 없으므로 제한적으로 테스트
   - Master Admin으로 지역별 필터링 정상 작동 확인
   - 또는 추가 계정 생성 후 테스트

### 조정된 테스트 범위

- Phase 1: 1.1, 1.2, 1.3, 1.4 (4개 계정)
- Phase 2: 2.1-2.2 (Master), 2.6 (Temp Inspector), 2.7 (Unauthenticated)
- Phase 3: 3.1-3.4 (Master), 3.8-3.9 (Temp Inspector)
- Phase 4: 4.1 (Master, 전국 export)
- Phase 5-8: Master 기반 테스트

## 테스트 케이스

### Phase 1: 인증 및 로그인

#### 1.1 Master Admin 로그인
- [ ] Sign in 페이지 진입
- [ ] 계정 입력: truth0530@nmc.or.kr
- [ ] 비밀번호 입력: Dlsxm*0537
- [ ] 로그인 성공 (대시보드 진입)
- [ ] 스크린샷: dashboard-master-admin.png

#### 1.2 Temporary Inspector 1 로그인
- [ ] Sign in 페이지 진입
- [ ] 계정 입력: truth0530@kakao.com (이광성중구점검2)
- [ ] 비밀번호 입력: Dlsxm*0537
- [ ] 로그인 성공 (대시보드 진입)
- [ ] 스크린샷: dashboard-temp-inspector-1.png

#### 1.3 Temporary Inspector 2 로그인
- [ ] Sign in 페이지 진입
- [ ] 계정 입력: shout530@naver.com (이광성중구)
- [ ] 비밀번호 입력: Dlsxm*0537
- [ ] 로그인 성공 (대시보드 진입)
- [ ] 스크린샷: dashboard-temp-inspector-2.png

#### 1.4 Health Center Coordinator 로그인
- [ ] Sign in 페이지 진입
- [ ] 계정 입력: nemcdg@korea.kr
- [ ] 비밀번호 입력: dpdlelvlrTm*25
- [ ] 로그인 성공 (대시보드 진입)
- [ ] 스크린샷: dashboard-health-center-coordinator.png

---

### Phase 2: /api/inspections/assignments 엔드포인트 테스트

#### 2.1 Master Admin - 전국 할당 조회
- [ ] GET /api/inspections/assignments 호출
- [ ] 응답 코드: 200 OK
- [ ] 데이터: 모든 시도의 할당 포함 (제한 없음)
- [ ] 스크린샷: assignments-master-get.png
- [ ] 감사 로그 확인: 'Assignments:GET' + 'Master' + recordCount

#### 2.2 Master Admin - 할당 생성 (POST)
- [ ] 임의의 장비(equipment_serial) 선택
- [ ] POST /api/inspections/assignments
  ```json
  {
    "equipment_serial": "AED_001",
    "assignee_id": "inspector-temp@nmc.or.kr",
    "assignment_date": "2025-11-07T15:00:00Z"
  }
  ```
- [ ] 응답 코드: 201 Created
- [ ] 응답 형식: { success: true, data: {...}, message: "..." }
- [ ] 스크린샷: assignments-master-post.png

#### 2.3 Regional Admin - 서울시 할당만 조회
- [ ] GET /api/inspections/assignments 호출
- [ ] 응답 코드: 200 OK
- [ ] 데이터: 서울시(sido=서울특별시)만 포함
- [ ] 스크린샷: assignments-regional-get.png
- [ ] 감사 로그 확인: regionCodes=['SEO']

#### 2.4 Regional Admin - 권한 외 장비 수정 시도 (PATCH)
- [ ] 부산시 장비의 할당 수정 시도
- [ ] PATCH /api/inspections/assignments/{id}
- [ ] 응답 코드: 403 Forbidden
- [ ] 에러 메시지: "You do not have permission..."
- [ ] 스크린샷: assignments-regional-patch-denied.png
- [ ] 감사 로그: Equipment access denied

#### 2.5 Local Admin - 강서구만 접근 가능
- [ ] GET /api/inspections/assignments 호출
- [ ] 응답 코드: 200 OK
- [ ] 데이터: 강서구(gugun=강서구)만 포함
- [ ] 스크린샷: assignments-local-get.png

#### 2.6 Temporary Inspector - 할당 조회 거부
- [ ] GET /api/inspections/assignments 호출
- [ ] 응답 코드: 403 Forbidden
- [ ] 에러 메시지: "Use /api/inspections/assigned-devices endpoint instead"
- [ ] 스크린샷: assignments-temp-inspector-denied.png
- [ ] 감사 로그: temporary_inspector role not allowed

#### 2.7 Unauthenticated 요청 (모든 메서드)
- [ ] 쿠키 삭제 후 GET 호출
- [ ] 응답 코드: 401 Unauthorized
- [ ] 스크린샷: assignments-unauthenticated.png

---

### Phase 3: /api/schedules 엔드포인트 테스트

#### 3.1 Master Admin - 스케줄 생성 (POST)
- [ ] 장비 선택: 서울시 AED
- [ ] POST /api/schedules
  ```json
  {
    "deviceId": "AED_SEOUL_001",
    "scheduledDate": "2025-11-15",
    "scheduledTime": "14:00",
    "assignee": "inspector-001",
    "priority": "high",
    "notes": "점검 스케줄 생성 테스트"
  }
  ```
- [ ] 응답 코드: 200 OK
- [ ] 응답 형식: { success: true, data: {...}, message: "..." }
- [ ] 데이터: id, equipment_serial, scheduled_for, priority, status 포함
- [ ] 스크린샷: schedules-master-post.png
- [ ] 감사 로그: 'ScheduleCreation:POST' + Master + scheduleId

#### 3.2 Master Admin - 스케줄 목록 조회 (GET)
- [ ] GET /api/schedules
- [ ] 응답 코드: 200 OK
- [ ] 데이터: 생성한 스케줄 포함 (최대 100개)
- [ ] 각 항목: aed_data 정보 포함
- [ ] 스크린샷: schedules-master-get.png

#### 3.3 Master Admin - 스케줄 수정 (PATCH)
- [ ] 이전에 생성한 스케줄 ID 사용
- [ ] PATCH /api/schedules
  ```json
  {
    "id": "schedule-uuid",
    "priority": "normal",
    "notes": "우선순위 변경 테스트"
  }
  ```
- [ ] 응답 코드: 200 OK
- [ ] 데이터: 수정된 priority, notes 포함
- [ ] 스크린샷: schedules-master-patch.png

#### 3.4 Master Admin - 스케줄 삭제 (DELETE)
- [ ] 새로운 스케줄 생성
- [ ] DELETE /api/schedules (body: { id: "schedule-uuid" })
- [ ] 응답 코드: 200 OK
- [ ] 응답 형식: { success: true, data: {...}, message: "..." }
- [ ] 스크린샷: schedules-master-delete.png
- [ ] 감사 로그: 'ScheduleDeletion:DELETE' + deleted schedule

#### 3.5 Regional Admin - 서울시 스케줄만 조회
- [ ] GET /api/schedules
- [ ] 응답 코드: 200 OK
- [ ] 데이터: 서울시 장비만 포함 (buildEquipmentFilter 적용)
- [ ] 부산시 장비 스케줄은 미포함
- [ ] 스크린샷: schedules-regional-get.png

#### 3.6 Regional Admin - 권한 외 스케줄 수정 시도
- [ ] 부산시 스케줄 수정 시도
- [ ] PATCH /api/schedules (부산시 장비)
- [ ] 응답 코드: 403 Forbidden
- [ ] 에러 메시지: "You do not have permission..."
- [ ] 스크린샷: schedules-regional-patch-denied.png

#### 3.7 Local Admin - 강서구 스케줄만 조회
- [ ] GET /api/schedules
- [ ] 응답 코드: 200 OK
- [ ] 데이터: 강서구 장비만 포함
- [ ] 스크린샷: schedules-local-get.png

#### 3.8 Temporary Inspector - 스케줄 생성 거부
- [ ] POST /api/schedules (모든 필드 정상)
- [ ] 응답 코드: 403 Forbidden
- [ ] 에러 메시지: "Temporary inspectors cannot create schedules"
- [ ] 스크린샷: schedules-temp-inspector-post-denied.png
- [ ] 감사 로그: temporary_inspector role not allowed

#### 3.9 Temporary Inspector - 스케줄 조회 거부
- [ ] GET /api/schedules
- [ ] 응답 코드: 403 Forbidden
- [ ] 에러 메시지: "Temporary inspectors cannot view schedules"
- [ ] 스크린샷: schedules-temp-inspector-get-denied.png

#### 3.10 Feature Flag 비활성화 상태
- [ ] 데이터베이스: feature_flags.schedule = false 설정
- [ ] POST /api/schedules 호출
- [ ] 응답 코드: 403 Forbidden
- [ ] 에러 메시지: "Scheduling feature is currently disabled"
- [ ] 스크린샷: schedules-feature-disabled.png

---

### Phase 4: /api/inspections/export 엔드포인트 테스트

#### 4.1 Master Admin - 전국 데이터 Export
- [ ] POST /api/inspections/export
  ```json
  {
    "limit": 50
  }
  ```
- [ ] 응답 코드: 200 OK
- [ ] Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
- [ ] 파일 다운로드 성공
- [ ] 스크린샷: export-master-success.png

#### 4.2 Regional Admin - 서울시만 Export
- [ ] POST /api/inspections/export
  ```json
  {
    "regionCodes": ["SEO"],
    "limit": 50
  }
  ```
- [ ] 응답 코드: 200 OK
- [ ] 데이터: 서울시 검사 기록만 포함
- [ ] 스크린샷: export-regional-success.png

#### 4.3 Regional Admin - 권한 외 지역 Export 시도
- [ ] POST /api/inspections/export
  ```json
  {
    "regionCodes": ["BUS"],
    "limit": 50
  }
  ```
- [ ] 응답 코드: 403 Forbidden
- [ ] 에러 메시지: "unauthorized regions"
- [ ] 스크린샷: export-regional-unauthorized.png

#### 4.4 Local Admin - 강서구만 Export
- [ ] POST /api/inspections/export
  ```json
  {
    "regionCodes": ["SEO"],
    "cityCodes": ["강서구"],
    "limit": 50
  }
  ```
- [ ] 응답 코드: 200 OK
- [ ] 데이터: 강서구만 포함
- [ ] 스크린샷: export-local-success.png

#### 4.5 Invalid Request - 필드 유효성 검증
- [ ] POST /api/inspections/export with invalid cityCodes
  ```json
  {
    "cityCodes": [123]
  }
  ```
- [ ] 응답 코드: 400 Bad Request
- [ ] 에러 메시지: "must be an array of strings"
- [ ] 스크린샷: export-invalid-citycodes.png

---

### Phase 5: Cross-Account Permission Tests

#### 5.1 Regional Admin Seoul이 Regional Admin Busan 데이터 접근 시도
- [ ] POST /api/inspections/assignments with Busan device
- [ ] 응답 코드: 403 Forbidden
- [ ] 감시: Seoul admin이 Busan 데이터에 접근 불가
- [ ] 스크린샷: cross-account-denied.png

#### 5.2 Local Admin A가 Local Admin B의 시군구 데이터 접근 시도
- [ ] 강서구 admin이 동작구 데이터 조회 시도
- [ ] GET /api/inspections/assignments
- [ ] 응답: 동작구 데이터 미포함
- [ ] 스크린샷: local-boundary-enforcement.png

#### 5.3 Equipment Migration - 권한 변경 후 접근 제어
- [ ] Equipment를 한 지역에서 다른 지역으로 이동
- [ ] 이전 권한자가 접근 거부 확인
- [ ] 새로운 권한자가 접근 허용 확인
- [ ] 스크린샷: equipment-migration-access.png

---

### Phase 6: Audit Logging Verification

#### 6.1 Master Admin 모든 작업 감사 로그 검증
- [ ] 서버 로그에서 다음 항목 확인:
  - [ ] 'Assignments:POST' + Master + recordCount
  - [ ] 'Assignments:GET' + Master + recordCount
  - [ ] 'ScheduleCreation:POST' + equipmentLocation
  - [ ] 'ScheduleList:GET' + recordCount
  - [ ] 'Export:Success' + recordCount + filters applied
- [ ] 모든 로그에 userId, email, role 포함 확인
- [ ] 스크린샷: audit-log-verification.png

#### 6.2 Permission Denied 감사 로그
- [ ] Regional Admin의 거부된 요청 로그:
  - [ ] 'Equipment access denied' + equipmentLocation
  - [ ] 'temporary_inspector role not allowed'
- [ ] 스크린샷: audit-log-denied.png

#### 6.3 Equipment Location 추적
- [ ] 모든 감사 로그에서 다음 확인:
  - [ ] equipmentSido
  - [ ] equipmentGugun
  - [ ] jurisdiction_health_center (해당시)
- [ ] 스크린샷: audit-log-equipment-location.png

---

### Phase 7: Error Handling & Edge Cases

#### 7.1 Null Equipment Data
- [ ] aed_data FK가 null인 경우
- [ ] POST /api/inspections/assignments
- [ ] 응답 코드: 400 Bad Request 또는 404 Not Found
- [ ] 스크린샷: error-null-equipment.png

#### 7.2 Duplicate Schedule 생성 시도
- [ ] 같은 장비, 같은 시간대에 두 개의 스케줄 생성
- [ ] 두 번째 요청 응답 코드: 409 Conflict
- [ ] 에러 메시지: "schedule already exists near the selected time"
- [ ] 스크린샷: error-duplicate-schedule.png

#### 7.3 Empty Access Scope
- [ ] 권한이 []인 사용자 (접근 차단)
- [ ] GET /api/inspections/assignments
- [ ] 응답: 빈 배열 또는 접근 차단
- [ ] 스크린샷: error-empty-scope.png

#### 7.4 Invalid Request Body
- [ ] POST /api/schedules with malformed JSON
- [ ] 응답 코드: 400 Bad Request
- [ ] 스크린샷: error-malformed-json.png

---

### Phase 8: Performance & Load Testing

#### 8.1 Large Result Set Handling
- [ ] 1000개 이상의 레코드 조회
- [ ] GET /api/inspections/assignments with maxResultLimit
- [ ] 응답 시간: < 2초
- [ ] 메모리: 정상 범위
- [ ] 스크린샷: performance-large-dataset.png

#### 8.2 Concurrent Requests
- [ ] 동시에 3개 이상의 요청
- [ ] 응답 일관성 확인 (경쟁 조건 없음)
- [ ] 스크린샷: performance-concurrent.png

---

## 테스트 결과 요약

### 체크리스트
- [ ] Phase 1: 인증 - 4/4 케이스 통과
- [ ] Phase 2: /api/inspections/assignments - 7/7 케이스 통과
- [ ] Phase 3: /api/schedules - 10/10 케이스 통과
- [ ] Phase 4: /api/inspections/export - 5/5 케이스 통과
- [ ] Phase 5: Cross-Account Permission - 3/3 케이스 통과
- [ ] Phase 6: Audit Logging - 3/3 케이스 통과
- [ ] Phase 7: Error Handling - 4/4 케이스 통과
- [ ] Phase 8: Performance - 2/2 케이스 통과

### 총 통과율
- 전체: 38/38 (100%)

### 발견된 이슈 (필요시)
- [ ] Issue #1: [설명]
- [ ] Issue #2: [설명]

### 스크린샷 목록
- dashboard-master-admin.png
- dashboard-regional-admin.png
- dashboard-local-admin.png
- dashboard-temp-inspector.png
- [... 총 40+개 스크린샷 ...]

---

## 테스트 실행 가이드

### Step 1: Playwright 브라우저 시작
```bash
# Playwright MCP 활성화 및 브라우저 시작
# 테스트 시작
```

### Step 2: 계정별 테스트 수행
```
1. Master Admin 로그인 (Phase 1.1)
2. Master Admin 테스트 (Phase 2.1-2.7, 3.1-3.4, 4.1)
3. Regional Admin 로그인 (Phase 1.2)
4. Regional Admin 테스트 (Phase 2.3-2.4, 3.5-3.6, 4.2-4.3)
5. Local Admin 로그인 (Phase 1.3)
6. Local Admin 테스트 (Phase 2.5, 3.7, 4.4)
7. Temporary Inspector 로그인 (Phase 1.4)
8. Temporary Inspector 테스트 (Phase 2.6, 3.8-3.9)
```

### Step 3: 크로스 계정 테스트
```
1. Cross-Account Permission Tests (Phase 5)
2. Audit Logging Verification (Phase 6)
```

### Step 4: 오류 처리 및 성능 테스트
```
1. Error Handling & Edge Cases (Phase 7)
2. Performance & Load Testing (Phase 8)
```

### Step 5: 결과 정리
```
1. 스크린샷 수집
2. 로그 분석
3. 체크리스트 최종 확인
4. 보고서 작성
```

---

## 성공 기준

모든 다음 조건을 만족해야 함:

1. **Authentication**: 4개 계정 모두 로그인 성공
2. **Authorization**: 모든 권한 제한이 정상 작동
3. **Equipment-Centric Access**: 모든 엔드포인트에서 장비 기반 필터링 적용
4. **Audit Logging**: 모든 작업이 로그에 기록됨
5. **Error Handling**: 모든 오류 케이스 정상 처리
6. **Performance**: 모든 응답시간이 2초 이내
7. **Consistency**: 응답 형식 { success, data, message } 통일

---

## 테스트 완료 후 진행 사항

테스트 완료 후:

1. 이 체크리스트 업데이트 (테스트 결과 기록)
2. 발견된 이슈 GitHub Issues로 등록
3. 스크린샷 정리 및 보관
4. 프로덕션 배포 승인 또는 수정 필요
5. 배포 실행

---

## 문서 정보

- 작성일: 2025-11-07
- Phase: 2.2.4 Equipment-Centric Architecture
- 엔드포인트: assignments, schedules, export
- 테스트 도구: Playwright MCP
- 예상 소요 시간: 2-3시간
