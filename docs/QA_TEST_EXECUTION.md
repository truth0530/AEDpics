# Phase 4 QA 테스트 실행 가이드

**작성일**: 2025-11-06
**상태**: 구현 완료, QA 실행 준비
**목표**: 8개 시나리오 모두 통과 확인

---

## 준비 사항

### 0. 필터 전달 방법 안내

**2025-11-06 업데이트**: Export 엔드포인트는 두 가지 방식으로 필터를 전달할 수 있습니다.

#### 권장 방식: POST Body JSON (Primary)
```bash
# Content-Type: application/json 헤더와 함께 -d 플래그로 전달
curl -X POST "${BASE_URL}/api/inspections/export" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "regionCodes": ["JEJ"],
    "cityCodes": ["seogwipo"],
    "limit": 100
  }' \
  -o export.xlsx
```

#### 대체 방식: Query String (Fallback)
```bash
# JSON body를 파싱할 수 없을 때 자동으로 쿼리스트링으로 처리됨
# (특별한 경우가 아니면 위의 POST Body 방식 권장)
curl -X POST "${BASE_URL}/api/inspections/export?regionCodes=JEJ&cityCodes=seogwipo&limit=100" \
  -H "Authorization: Bearer <token>"

# 레거시 파라미터명도 지원됨 (하위 호환성)
curl -X POST "${BASE_URL}/api/inspections/export?region=JEJ&city=seogwipo&limit=100" \
  -H "Authorization: Bearer <token>"
```

**파라미터명 호환성**:
- `regionCodes` 또는 `region` (둘 다 지원, 현재/레거시)
- `cityCodes` 또는 `city` (둘 다 지원, 현재/레거시)
- 둘 다 사용된 경우 중복 제거 후 병합

**중요**:
- POST body 방식이 우선적으로 시도됨 → 실패 시에만 query string 사용
- 아래의 모든 테스트 시나리오는 POST body JSON 방식을 사용합니다

---

### 1. 테스트 계정 토큰 획득

```bash
# 각 역할별 테스트 계정에 대해 토큰 획득
# 로컬 환경에서는 session을 직접 생성하거나,
# 실제 환경에서는 로그인 API 호출

# 예시: Master 계정 로그인
curl -X POST "https://aed.pics/api/auth/signin" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@nmc.or.kr",
    "password": "your_password"
  }' \
  -s | jq -r '.session.user.id'
```

### 2. Base URL 설정

```bash
# 로컬 환경
BASE_URL="http://localhost:3000"

# 프로덕션
BASE_URL="https://aed.pics"

# 또는 환경변수로 설정
export BASE_URL="https://aed.pics"
```

---

## 테스트 시나리오 (8개)

### Group A: Permission Validation

#### A-1: Master 계정 (전국)

**목표**: Master는 제약 없이 전국 모든 점검 데이터 export 가능

```bash
curl -X POST "${BASE_URL}/api/inspections/export" \
  -H "Authorization: Bearer <master_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "regionCodes": [],
    "cityCodes": [],
    "limit": 100
  }' \
  -o A1_master_export.xlsx \
  -w "\nStatus: %{http_code}\n"
```

**검증**:
- [ ] HTTP Status: **200**
- [ ] Response header `Content-Type`: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
- [ ] Response header `X-Applied-Limit`: 100 (또는 더 작은 값)
- [ ] Excel 파일 유효성: `file A1_master_export.xlsx` → XLSX file
- [ ] 행 개수: <= 10,000 (maxResultLimit)

**성공 기준**:
```bash
# 1. 파일 유효성 확인
file A1_master_export.xlsx
# 예상: Microsoft Excel 2007+

# 2. 행 개수 확인
npx xlsx2csv A1_master_export.xlsx | wc -l
# 예상: 101 (헤더 1줄 + 데이터)

# 3. 데이터 샘플 확인
npx xlsx2csv A1_master_export.xlsx | head -2
```

---

#### A-2: Local_admin (자신의 지역)

**목표**: Local_admin은 자신의 시군구 내 점검만 export 가능

```bash
# 테스트 계정: 서귀포시 보건소 담당자
curl -X POST "${BASE_URL}/api/inspections/export" \
  -H "Authorization: Bearer <local_admin_seogwipo_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "regionCodes": ["JEJ"],
    "cityCodes": ["seogwipo"],
    "limit": 100
  }' \
  -o A2_local_own_region.xlsx \
  -w "\nStatus: %{http_code}\n"
```

**검증**:
- [ ] HTTP Status: **200**
- [ ] Excel 파일 유효성 확인
- [ ] 행 개수: <= 1,000 (local_admin maxResultLimit)
- [ ] 모든 행의 시군구: **'서귀포시'**만 포함
- [ ] Response header `X-Applied-Limit`: 100 또는 더 작은 값

**성공 기준**:
```bash
# 1. 파일 유효성
file A2_local_own_region.xlsx

# 2. 행 개수
npx xlsx2csv A2_local_own_region.xlsx | wc -l

# 3. 시군구 데이터 확인 (gugun 칼럼이 모두 '서귀포시')
npx xlsx2csv A2_local_own_region.xlsx | \
  awk -F',' '{print $5}' | \
  sort | uniq -c
# 예상: 모두 '서귀포시'
```

---

#### A-3: Local_admin (권한 없는 지역 요청)

**목표**: Local_admin이 다른 지역 데이터를 요청하면 **403 Forbidden**

```bash
# 테스트 계정: 서귀포시 보건소 (하지만 대구 중구 요청)
curl -X POST "${BASE_URL}/api/inspections/export" \
  -H "Authorization: Bearer <local_admin_seogwipo_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "regionCodes": ["DAE"],
    "cityCodes": ["jung"]
  }' \
  -w "\nStatus: %{http_code}\nBody:\n" \
  -s | jq .
```

**검증**:
- [ ] HTTP Status: **403**
- [ ] Response JSON:
  ```json
  {
    "error": "허용되지 않은 시도 코드가 포함되어 있습니다",
    "details": {
      "unauthorizedRegions": ["DAE"]
    }
  }
  ```

**성공 기준**:
```bash
# 상태 코드가 403인지 확인
curl -X POST "${BASE_URL}/api/inspections/export" \
  -H "Authorization: Bearer <local_admin_seogwipo_token>" \
  -d '{"regionCodes": ["DAE"]}' \
  -w "%{http_code}" \
  -o /dev/null \
  -s
# 예상: 403
```

---

#### A-4: Temporary_inspector (export 불가)

**목표**: Temporary_inspector는 **403 Forbidden** (export permission denied)

```bash
curl -X POST "${BASE_URL}/api/inspections/export" \
  -H "Authorization: Bearer <inspector_token>" \
  -d '{"regionCodes": [], "cityCodes": []}' \
  -w "\nStatus: %{http_code}\nBody:\n" \
  -s | jq .
```

**검증**:
- [ ] HTTP Status: **403**
- [ ] Response JSON:
  ```json
  {
    "error": "Role cannot export data"
  }
  ```

---

#### A-5: Ministry_admin (읽기 전용)

**목표**: Ministry_admin은 **403 Forbidden** (read-only role)

```bash
curl -X POST "${BASE_URL}/api/inspections/export" \
  -H "Authorization: Bearer <ministry_admin_token>" \
  -d '{"regionCodes": []}' \
  -w "\nStatus: %{http_code}\nBody:\n" \
  -s | jq .
```

**검증**:
- [ ] HTTP Status: **403**
- [ ] Error message: export 권한 없음 또는 role 관련

---

### Group B: Filter Auto-filling

#### B-1: Region 자동 채우기

**목표**: Local_admin이 region 없이 요청하면 자동으로 채워짐

```bash
curl -X POST "${BASE_URL}/api/inspections/export" \
  -H "Authorization: Bearer <local_admin_seogwipo_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "cityCodes": ["seogwipo"]
  }' \
  -w "\nStatus: %{http_code}\n" \
  -o B1_region_autofilled.xlsx
```

**검증**:
- [ ] HTTP Status: **200**
- [ ] Excel 파일 생성됨
- [ ] 로그 확인: `appliedDefaults: ['sido']` 기록

---

#### B-2: 필수 필터 누락

**목표**: Local_admin이 gugun 필터 없이 요청하면 **400 Bad Request**

```bash
curl -X POST "${BASE_URL}/api/inspections/export" \
  -H "Authorization: Bearer <local_admin_seogwipo_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "regionCodes": ["JEJ"]
  }' \
  -w "\nStatus: %{http_code}\nBody:\n" \
  -s | jq .
```

**검증**:
- [ ] HTTP Status: **400**
- [ ] Response JSON:
  ```json
  {
    "error": "필수 검색 조건을 충족하지 못했습니다",
    "details": {
      "missingFilters": ["gugun"]
    }
  }
  ```

---

### Group C: Data Limits

#### C-1: Master (limit 10,000)

**목표**: Master가 50,000 요청해도 10,000으로 제한됨

```bash
curl -X POST "${BASE_URL}/api/inspections/export" \
  -H "Authorization: Bearer <master_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "regionCodes": [],
    "cityCodes": [],
    "limit": 50000
  }' \
  -o C1_master_limit.xlsx \
  -w "\nStatus: %{http_code}\nApplied-Limit: %{header_x_applied_limit}\n"
```

**검증**:
- [ ] HTTP Status: **200**
- [ ] Response header `X-Applied-Limit`: **10000**
- [ ] Excel 행 개수: <= 10,000

---

#### C-2: Local_admin (limit 1,000)

**목표**: Local_admin이 5,000 요청해도 1,000으로 제한됨

```bash
curl -X POST "${BASE_URL}/api/inspections/export" \
  -H "Authorization: Bearer <local_admin_seogwipo_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "regionCodes": ["JEJ"],
    "cityCodes": ["seogwipo"],
    "limit": 5000
  }' \
  -o C2_local_limit.xlsx \
  -w "\nStatus: %{http_code}\nApplied-Limit: %{header_x_applied_limit}\n"
```

**검증**:
- [ ] HTTP Status: **200**
- [ ] Response header `X-Applied-Limit`: **1000**
- [ ] Excel 행 개수: <= 1,000

---

### Group D: Data Masking

#### D-1: Master (마스킹 없음)

**목표**: Master는 민감정보 노출 (contact_phone, contact_email, detailed_address)

```bash
curl -X POST "${BASE_URL}/api/inspections/export" \
  -H "Authorization: Bearer <master_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "limit": 1
  }' \
  -o D1_master_unmasked.xlsx

# Excel에서 수동 확인:
# - contact_phone: 02-1234-5678 (전체 표시)
# - contact_email: admin@example.com (전체 표시)
# - detailed_address: 상세 주소 전체 포함
```

**검증**:
- [ ] 민감정보 가려지지 않음 (완전히 표시됨)

---

#### D-2: Local_admin (마스킹 적용)

**목표**: Local_admin은 민감정보 마스킹됨

```bash
curl -X POST "${BASE_URL}/api/inspections/export" \
  -H "Authorization: Bearer <local_admin_seogwipo_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "regionCodes": ["JEJ"],
    "cityCodes": ["seogwipo"],
    "limit": 1
  }' \
  -o D2_local_masked.xlsx

# Excel에서 수동 확인:
# - contact_phone: 02-***-5678 (중간 부분 마스킹)
# - contact_email: adm***@example.com (대부분 마스킹)
# - detailed_address: 서울 강남구 강남대로 *** (끝 부분 마스킹)
```

**검증**:
- [ ] 민감정보 마스킹됨 (일부 또는 전체 가려짐)

---

### Group E: City_code Mapping

#### E-1: 유효한 영문 코드

**목표**: 'seogwipo'는 '서귀포시'로 매핑되어 정상 작동

```bash
curl -X POST "${BASE_URL}/api/inspections/export" \
  -H "Authorization: Bearer <local_admin_seogwipo_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "regionCodes": ["JEJ"],
    "cityCodes": ["seogwipo"]
  }' \
  -w "\nStatus: %{http_code}\n" \
  -o E1_english_code.xlsx
```

**검증**:
- [ ] HTTP Status: **200**
- [ ] 로그: "Unmapped city code" 경고 없음
- [ ] Excel 파일 정상 생성

---

#### E-2: 유효한 한글 코드

**목표**: '서귀포시'는 그대로 사용되어 정상 작동

```bash
curl -X POST "${BASE_URL}/api/inspections/export" \
  -H "Authorization: Bearer <local_admin_seogwipo_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "regionCodes": ["JEJ"],
    "cityCodes": ["서귀포시"]
  }' \
  -w "\nStatus: %{http_code}\n" \
  -o E2_korean_code.xlsx
```

**검증**:
- [ ] HTTP Status: **200**
- [ ] 로그: 경고 없음
- [ ] Excel 파일 정상 생성

---

#### E-3: 무효한 코드

**목표**: 'invalid_city_xyz'는 매핑 실패 → 403 또는 400

```bash
curl -X POST "${BASE_URL}/api/inspections/export" \
  -H "Authorization: Bearer <local_admin_seogwipo_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "regionCodes": ["JEJ"],
    "cityCodes": ["invalid_city_xyz"]
  }' \
  -w "\nStatus: %{http_code}\nBody:\n" \
  -s | jq .
```

**검증**:
- [ ] HTTP Status: **403** (허용되지 않은 시군구)
- [ ] 로그: "City code mapping" 경고 기록
- [ ] Error message: 명확함

---

## 최종 체크리스트

```markdown
### Permission Validation (Group A)
- [ ] A-1: Master 전국 export ✅
- [ ] A-2: Local_admin 자신의 지역 ✅
- [ ] A-3: Local_admin 권한 없는 지역 ❌
- [ ] A-4: Temporary_inspector ❌
- [ ] A-5: Ministry_admin ❌

### Filter Auto-filling (Group B)
- [ ] B-1: Region 자동 채우기 ✅
- [ ] B-2: 필수 필터 누락 ❌

### Data Limits (Group C)
- [ ] C-1: Master 10,000 제한 ✅
- [ ] C-2: Local_admin 1,000 제한 ✅

### Data Masking (Group D)
- [ ] D-1: Master 마스킹 없음 ✅
- [ ] D-2: Local_admin 마스킹 적용 ✅

### City_code Mapping (Group E)
- [ ] E-1: 영문 코드 ✅
- [ ] E-2: 한글 코드 ✅
- [ ] E-3: 무효한 코드 ❌

### 모든 시나리오 통과: ⬜️ → ✅
```

---

## 로그 검증

### Success 로그 확인

```bash
# PM2 로그 확인
pm2 logs --lines 100 | grep "Export:Success"

# 예상 로그:
# [Export:Success] Inspection data exported successfully
# - userId: user_xxx
# - recordCount: 123
# - appliedLimit: 1000
```

### Failure 로그 확인

```bash
# Permission 실패 로그
pm2 logs | grep "Export:Permission"

# Filter 실패 로그
pm2 logs | grep "Export:FilterPolicy"

# City_code 매핑 경고 로그
pm2 logs | grep "Export:CityCodeMapping"
```

---

## 테스트 완료 기준

✅ **Pass**: 모든 8개 시나리오 통과

❌ **Fail**:
- HTTP Status 불일치
- Excel 파일 생성 실패
- 데이터 마스킹 미적용
- 필터 검증 오작동
- City_code 매핑 실패 감지 미동작 (로그에 "Export:CityCodeMapping" 경고 없음)

---

## 추가 검증 사항 (2025-11-06 수정)

### POST Body 필터 전달 정상 작동 확인
- [ ] POST body JSON 방식으로 필터 전달 시 정상 작동
- [ ] Query string 방식으로 필터 전달 시 정상 작동 (fallback)
- [ ] 두 방식 모두 동일한 결과 반환

### Query String 파라미터명 호환성 확인
- [ ] `?cityCodes=seogwipo` 형식으로 요청 시 정상 작동
- [ ] `?city=seogwipo` 형식으로 요청 시 정상 작동 (레거시)
- [ ] `?regionCodes=JEJ` 형식으로 요청 시 정상 작동
- [ ] `?region=JEJ` 형식으로 요청 시 정상 작동 (레거시)

### City_code 매핑 실패 감지 확인
- [ ] E-3 시나리오 실행 후 로그 확인
- [ ] PM2 로그에 "Export:CityCodeMapping" 경고 메시지 기록됨
- [ ] 무효한 city_code는 자동으로 필터에서 제외됨
- [ ] 유효한 city_code만 매핑되어 데이터 조회에 사용됨

### 배열 요소 타입 검증 확인
- [ ] POST body `{"cityCodes": [123]}` 요청 시 400 반환 (숫자 거부)
- [ ] POST body `{"regionCodes": ["JEJ", null]}` 요청 시 400 반환 (null 거부)
- [ ] POST body `{"cityCodes": [{}]}` 요청 시 400 반환 (객체 거부)
- [ ] POST body `{"cityCodes": ["seogwipo"]}` 요청 시 200 반환 (문자열만 허용)

---

**상태**: 🟢 QA 실행 준비 완료 (2025-11-06 최종 수정)
**마지막 업데이트**:
- mapCityCodeToGugun 실패 감지 + POST body 필터 지원 추가
- Query string 파라미터명 호환성 추가 (cityCodes + city, regionCodes + region)
- 배열 요소 타입 검증 강화 (non-string 요소 거부)

**검증 완료**:
- ✅ TypeScript 컴파일
- ✅ ESLint 검사
- ✅ 전체 빌드 (118개 페이지)
- ✅ 모든 pre-commit 훅 통과

**다음**: 실제 테스트 환경에서 8개 시나리오 + 추가 검증 케이스 실행
