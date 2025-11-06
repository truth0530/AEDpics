# Phase 4 Export 엔드포인트 QA 실행 계획

**작성일**: 2025-11-06
**상태**: QA 실행 준비 완료
**담당**: QA Team
**예상 소요 시간**: 2-3시간

---

## 1. 사전 준비

### 1.1 테스트 환경 확인
```bash
# 배포 전 로컬/스테이징 환경에서 검증
BASE_URL="http://localhost:3000"  # 로컬
# BASE_URL="https://staging.aed.pics"  # 스테이징

# 환경변수 확인
echo $BASE_URL
```

### 1.2 테스트 계정 준비
필요한 역할별 계정:
- [ ] Master: admin@nmc.or.kr (전국 조회 권한)
- [ ] Local_admin: 서귀포시 보건소 담당자 (시군구 제한)
- [ ] Local_admin: 대구 중구 보건소 담당자 (권한 외 거부 테스트용)
- [ ] Temporary_inspector: 검사자 계정 (export 불가)
- [ ] Ministry_admin: 보건복지부 계정 (read-only)

### 1.3 필수 도구
```bash
# Excel 확인 도구
npm install -g xlsx2csv

# jq 설치 (JSON 파싱)
# macOS: brew install jq
# Linux: apt-get install jq
```

---

## 2. QA 실행 순서

### Phase 1: 기본 8개 시나리오 (docs/QA_TEST_EXECUTION.md 참조)

**예상 시간**: 1시간

#### 2.1 Permission Validation (5개 시나리오)
- [ ] **A-1**: Master - 전국 export (200 OK)
- [ ] **A-2**: Local_admin - 자신의 지역 (200 OK)
- [ ] **A-3**: Local_admin - 권한 없는 지역 (403 Forbidden)
- [ ] **A-4**: Temporary_inspector - export 불가 (403 Forbidden)
- [ ] **A-5**: Ministry_admin - read-only (403 Forbidden)

**검증 항목**:
- HTTP Status 코드 일치
- 응답 헤더: Content-Type, X-Applied-Limit, X-Role-Max-Limit, X-Record-Count
- 응답 바디: error/details 필드 정확성

#### 2.2 Filter Auto-filling (2개 시나리오)
- [ ] **B-1**: 지역 자동 채우기 (200 OK)
- [ ] **B-2**: 필수 필터 누락 (400 Bad Request)

**검증 항목**:
- 필터 값 자동 채우기 동작
- 누락된 필터 필드 명확한 오류 메시지

#### 2.3 Data Limits (2개 시나리오)
- [ ] **C-1**: Master 10,000 제한 (200 OK)
- [ ] **C-2**: Local_admin 1,000 제한 (200 OK)

**검증 항목**:
- X-Applied-Limit 헤더 값이 역할별 상한 준수
- Excel 행 개수가 제한값 이하

#### 2.4 Data Masking (2개 시나리오)
- [ ] **D-1**: Master - 민감정보 노출 (200 OK)
- [ ] **D-2**: Local_admin - 민감정보 마스킹 (200 OK)

**검증 항목**:
- contact_phone 마스킹: 02-***-5678
- contact_email 마스킹: adm***@example.com
- detailed_address 마스킹: 일부 생략

#### 2.5 City_code Mapping (3개 시나리오)
- [ ] **E-1**: 영문 코드 매핑 (200 OK + 로그 검증)
- [ ] **E-2**: 한글 코드 사용 (200 OK)
- [ ] **E-3**: 무효한 코드 감지 (로그 검증)

**검증 항목**:
- 영문/한글 코드 모두 인식
- PM2 로그: Export:CityCodeMapping 경고 기록

---

### Phase 2: 추가 검증 케이스 (심화)

**예상 시간**: 1시간

#### 2.6 Query String 파라미터명 호환성
```bash
# 현재 파라미터명
curl -X POST "${BASE_URL}/api/inspections/export?regionCodes=JEJ&cityCodes=seogwipo&limit=100" \
  -H "Authorization: Bearer <token>" \
  -w "\nStatus: %{http_code}\n" \
  -o result_current.xlsx

# 레거시 파라미터명
curl -X POST "${BASE_URL}/api/inspections/export?region=JEJ&city=seogwipo&limit=100" \
  -H "Authorization: Bearer <token>" \
  -w "\nStatus: %{http_code}\n" \
  -o result_legacy.xlsx
```

- [ ] 현재 파라미터명 작동 (200 OK)
- [ ] 레거시 파라미터명 작동 (200 OK)
- [ ] 두 파일 데이터 동일 (비교 검증)

#### 2.7 배열 요소 타입 검증
```bash
# 잘못된 입력: 숫자
curl -X POST "${BASE_URL}/api/inspections/export" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"cityCodes": [123]}' \
  -w "\nStatus: %{http_code}\n" \
  -s | jq .

# 잘못된 입력: null
curl -X POST "${BASE_URL}/api/inspections/export" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"regionCodes": ["JEJ", null]}' \
  -w "\nStatus: %{http_code}\n" \
  -s | jq .

# 잘못된 입력: 객체
curl -X POST "${BASE_URL}/api/inspections/export" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"cityCodes": [{}]}' \
  -w "\nStatus: %{http_code}\n" \
  -s | jq .

# 올바른 입력: 문자열만
curl -X POST "${BASE_URL}/api/inspections/export" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"cityCodes": ["seogwipo"]}' \
  -w "\nStatus: %{http_code}\n" \
  -o result_valid.xlsx
```

- [ ] 숫자 입력: 400 Bad Request
- [ ] null 입력: 400 Bad Request
- [ ] 객체 입력: 400 Bad Request
- [ ] 문자열 입력: 200 OK

---

## 3. Excel 파일 검수

### 3.1 파일 구조 검증
```bash
# 파일 유효성 확인
file A1_master_export.xlsx
# 예상: Microsoft Excel 2007+

# 행 개수 확인
npx xlsx2csv A1_master_export.xlsx | wc -l
# 예상: 헤더 1줄 + 데이터 N줄

# 칼럼 확인
npx xlsx2csv A1_master_export.xlsx | head -1
```

- [ ] 파일이 XLSX 형식 (Excel 2007+)
- [ ] 행 개수가 제한 이내
- [ ] 필수 칼럼 모두 포함 (점검ID, 장비번호, 시도, 시군구, 점검자 등)

### 3.2 데이터 내용 검증 (A-2 시나리오)
```bash
# 서귀포시 데이터만 포함되는지 확인
npx xlsx2csv A2_local_own_region.xlsx | awk -F',' '{print $5}' | sort | uniq -c
# 예상: 모두 '서귀포시'
```

- [ ] 모든 행의 시군구 칼럼이 '서귀포시'만 포함
- [ ] 타 지역 데이터 없음

### 3.3 마스킹 검증 (D-1 vs D-2)
```bash
# Master 데이터 샘플 (마스킹 안 함)
npx xlsx2csv D1_master_unmasked.xlsx | grep -i "phone\|email" | head -3

# Local_admin 데이터 샘플 (마스킹 함)
npx xlsx2csv D2_local_masked.xlsx | grep -i "phone\|email" | head -3
```

- [ ] Master: contact_phone 전체 표시 (02-1234-5678)
- [ ] Master: contact_email 전체 표시 (admin@example.com)
- [ ] Local_admin: contact_phone 마스킹 (02-***-5678)
- [ ] Local_admin: contact_email 마스킹 (adm***@example.com)

---

## 4. 로그 검증

### 4.1 PM2 로그 모니터링 설정
```bash
# 실시간 로그 확인
pm2 logs aedpics --lines 100

# 특정 로그 타입만 필터링
pm2 logs aedpics | grep "Export:"
```

### 4.2 각 시나리오별 로그 확인

#### A-1 (Master 전국)
```bash
pm2 logs | grep "Export:Success"
# 예상: recordCount: 100 (또는 더 작은 값)
# 예상: maxResultLimit: 10000
```

#### E-3 (무효한 city_code)
```bash
pm2 logs | grep "Export:CityCodeMapping"
# 예상: originalCode: invalid_city_xyz
# 예상: source: body (또는 query)
```

#### Query String 테스트
```bash
pm2 logs | grep "Export:Request"
# 예상: source: query (Q2 테스트)
# 예상: source: body (POST body 테스트)
```

### 4.3 로그 레벨별 모니터링
| 로그 타입 | 예상 상황 | 검색 명령어 |
|----------|---------|-----------|
| Export:Success | 정상 export 완료 | `pm2 logs \| grep "Export:Success"` |
| Export:Permission | 권한 거부 | `pm2 logs \| grep "Export:Permission"` |
| Export:FilterPolicy | 필터 검증 실패 | `pm2 logs \| grep "Export:FilterPolicy"` |
| Export:CityCodeMapping | City_code 매핑 실패 | `pm2 logs \| grep "Export:CityCodeMapping"` |
| Export:Request | 필터 파싱 로그 | `pm2 logs \| grep "Export:Request"` |

---

## 5. 결과 기록

### 5.1 체크리스트
```markdown
## Phase 1: 기본 시나리오 (8개)
- [ ] A-1: Master (200) - HTTP Status, 파일 유효성, 행 개수
- [ ] A-2: Local_admin own (200) - 시군구 필터링 확인
- [ ] A-3: Local_admin unauthorized (403) - 에러 메시지
- [ ] A-4: Temporary_inspector (403) - 역할 검증
- [ ] A-5: Ministry_admin (403) - read-only 검증
- [ ] B-1: Region auto-fill (200) - 자동 채우기 동작
- [ ] B-2: Missing filter (400) - 에러 메시지
- [ ] C-1: Master 10k limit (200) - X-Applied-Limit 헤더
- [ ] C-2: Local_admin 1k limit (200) - X-Applied-Limit 헤더
- [ ] D-1: Master unmasked (200) - 민감정보 노출 확인
- [ ] D-2: Local_admin masked (200) - 마스킹 확인
- [ ] E-1: English code (200) - 매핑 동작
- [ ] E-2: Korean code (200) - 매핑 동작
- [ ] E-3: Invalid code (로그) - CityCodeMapping 경고

## Phase 2: 추가 검증 (4개)
- [ ] Query param: cityCodes 현재명 (200)
- [ ] Query param: city 레거시명 (200)
- [ ] Array element: 숫자 입력 (400)
- [ ] Array element: 문자열 입력 (200)

## Excel 검수
- [ ] 파일 유효성 (XLSX 형식)
- [ ] 칼럼 구조 (필수 필드 모두)
- [ ] 행 개수 제한 (maxResultLimit 준수)
- [ ] 데이터 필터링 (시군구 정확성)
- [ ] 마스킹 적용 (민감정보)

## 로그 검증
- [ ] Export:Success 기록
- [ ] Export:Permission 거부 로그
- [ ] Export:CityCodeMapping 경고 로그
- [ ] Export:Request source 필드 (body/query)
```

### 5.2 이슈 발견 시 대응
| 이슈 | 검사 항목 | 대응 |
|------|---------|------|
| 마스킹 미적용 | D-1 vs D-2 비교 | lib/data/masking.ts 확인, role 권한 확인 |
| 필터 미작동 | A-2 시군구 필터 | enforceFilterPolicy 동작 확인 |
| 로그 미기록 | PM2 로그 | logger 설정 확인, 로그 레벨 확인 |
| Query string 미작동 | Query param 테스트 | parseQueryParams 동작 확인 |

---

## 6. 배포 전 체크리스트

모든 QA 시나리오 통과 후:

```bash
# 1. 최신 코드 풀
git pull origin main

# 2. 빌드 검증
npm run tsc
npm run lint
npm run build

# 3. 배포
git push origin main  # GitHub Actions 자동 배포 또는
# pm2 reload ecosystem.config.js  # 수동 배포

# 4. 배포 후 검증
curl -X POST "https://aed.pics/api/inspections/export" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}' \
  -w "\nStatus: %{http_code}\n" \
  -o smoke_test.xlsx

# 예상: 200 OK + 유효한 XLSX 파일
```

---

## 7. 예상 소요 시간

| 단계 | 시간 |
|------|------|
| 사전 준비 | 15분 |
| 기본 8개 시나리오 | 1시간 |
| 추가 검증 | 30분 |
| Excel 검수 | 30분 |
| 로그 검증 | 15분 |
| **총계** | **2시간 30분** |

---

## 8. 최종 승인

QA 완료 후 다음 항목 확인:

- [ ] 8개 기본 시나리오 모두 통과
- [ ] 추가 검증 케이스 모두 통과
- [ ] Excel 파일 검수 완료
- [ ] 로그 검증 완료
- [ ] 이슈 없음 또는 모두 해결됨
- [ ] 배포 승인

---

**상태**: 🟢 QA 실행 준비 완료
**다음 단계**: QA Team이 위 계획에 따라 실행
**완료 후**: 배포 진행
