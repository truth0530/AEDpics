# Phase 4 Export 엔드포인트 배포 전 체크리스트

**작성일**: 2025-11-06
**담당**: DevOps Team, Tech Lead
**목표**: 배포 전 모든 항목 확인

---

## 1. 코드 검증 (개발팀)

### 1.1 변경 사항 확인
- [ ] `git log --oneline -5` 최근 커밋 확인
  - ✅ feat: Phase 4 export endpoint implementation
  - ✅ fix: Phase 4 export endpoint - enhanced validation and filter source tracking
  - ✅ fix: Phase 4 export endpoint - query param key compatibility
  - ✅ docs: Update QA_TEST_EXECUTION.md

### 1.2 소스 코드 검증
```bash
# 타입 검사
npm run tsc
# 결과: ✅ No errors
```
- [ ] TypeScript 컴파일 성공

```bash
# 린트 검사
npm run lint
# 결과: ✅ No errors
```
- [ ] ESLint 검사 성공

```bash
# 빌드 검사
npm run build
# 결과: ✅ Successfully compiled (118 pages)
```
- [ ] 프로덕션 빌드 성공

### 1.3 코드 리뷰 항목
- [ ] Export endpoint 13-step 로직 검증
  - Step 1-5: 인증 & 권한 (3-layer)
  - Step 6: 필터 파싱 + 유효성 검증
  - Step 7: City_code 정규화
  - Step 8-13: 데이터 처리 & 응답
- [ ] Query string 파라미터 호환성 확인
  - 현재명 (cityCodes, regionCodes) ✅
  - 레거시명 (city, region) ✅
- [ ] 배열 요소 타입 검증 확인
  - regionCodes 문자열만 ✅
  - cityCodes 문자열만 ✅
- [ ] mapCityCodeToGugun 실패 감지 확인
  - 매핑 실패 시 null 반환 ✅
  - 로그에 source 필드 포함 ✅

---

## 2. 문서 검증 (문서팀 / Tech Lead)

### 2.1 QA 문서
- [ ] [docs/QA_TEST_EXECUTION.md](../QA_TEST_EXECUTION.md)
  - 8개 기본 시나리오 ✅
  - 추가 검증 케이스 ✅
  - 파라미터명 호환성 ✅
  - 배열 요소 타입 검증 ✅

### 2.2 실행 계획
- [ ] [docs/PHASE4_QA_EXECUTION_PLAN.md](../PHASE4_QA_EXECUTION_PLAN.md)
  - 사전 준비 체크리스트 ✅
  - 8개 시나리오 검증 항목 ✅
  - Excel 검수 절차 ✅
  - 로그 검증 가이드 ✅

### 2.3 모니터링 설정
- [ ] [docs/PHASE4_MONITORING_SETUP.md](../PHASE4_MONITORING_SETUP.md)
  - Smoke test 명령어 ✅
  - PM2 로그 필터 ✅
  - 핵심 메트릭 정의 ✅
  - 장애 대응 프로세스 ✅

---

## 3. QA 검증 (QA Team)

### 3.1 기본 시나리오 (8개)
- [ ] A-1: Master (200 OK)
- [ ] A-2: Local_admin own region (200 OK)
- [ ] A-3: Local_admin unauthorized (403 Forbidden)
- [ ] A-4: Temporary_inspector (403 Forbidden)
- [ ] A-5: Ministry_admin (403 Forbidden)
- [ ] B-1: Region auto-fill (200 OK)
- [ ] B-2: Missing filter (400 Bad Request)
- [ ] C-1: Master 10k limit (200 OK)
- [ ] C-2: Local_admin 1k limit (200 OK)

### 3.2 추가 검증 (4개)
- [ ] Query param: cityCodes (200 OK)
- [ ] Query param: city (200 OK)
- [ ] Array element: 숫자 거부 (400)
- [ ] Array element: null 거부 (400)

### 3.3 데이터 검증
- [ ] Excel 파일 생성 (XLSX 형식)
- [ ] 행 개수 제한 준수
- [ ] 칼럼 구조 정확성
- [ ] 마스킹 적용 확인

### 3.4 로그 검증
- [ ] Export:Success 기록
- [ ] Export:Permission 거부 로그
- [ ] Export:CityCodeMapping 경고 로그
- [ ] source 필드 (body/query) 추적

### 3.5 QA 최종 결과
```
시작일: ____년 __월 __일
종료일: ____년 __월 __일
총 테스트 케이스: 12개
통과: __개 / 12개
실패: __개 / 12개
이슈: 없음 / 있음 (상세: __________________)

QA 승인: ___________  (서명)
```

---

## 4. 환경 검증 (DevOps)

### 4.1 프로덕션 환경 상태
```bash
# 서버 상태 확인
ssh server
```
- [ ] 서버 응답 정상 (ping OK)
- [ ] 디스크 사용률 < 80%
  ```bash
  df -h / | tail -1 | awk '{print $(NF-1)}'
  # 예상: 60% 이상 50GB 여유
  ```
- [ ] PM2 프로세스 상태
  ```bash
  pm2 status
  # 예상: aedpics status: online
  ```
- [ ] 최근 에러 로그 없음
  ```bash
  pm2 logs --err --lines 20
  # 예상: Export 관련 에러 없음
  ```

### 4.2 데이터베이스 상태
- [ ] NCP PostgreSQL 연결 정상
  ```bash
  psql -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com -U aedpics_admin -d aedpics_production -c "SELECT COUNT(*) FROM inspections;"
  # 예상: 성공 응답
  ```
- [ ] 인덱스 상태 확인
  ```sql
  -- city_code 인덱스 확인
  SELECT * FROM pg_indexes WHERE tablename='inspections' AND indexname LIKE '%city%';
  ```
- [ ] 테이블 권한 확인
  ```sql
  SELECT grantee, privilege_type FROM information_schema.role_table_grants
  WHERE table_name='inspections';
  ```

### 4.3 네트워크 및 보안
- [ ] HTTPS 인증서 유효성
  ```bash
  curl -I https://aed.pics/api/inspections/export
  # 예상: HTTP 401 (인증 필요) 또는 400 (필터 오류)
  ```
- [ ] API Rate Limit 설정 확인
- [ ] WAF/보안 규칙 확인 (새 엔드포인트 추가됨)
- [ ] CORS 정책 확인

---

## 5. 배포 실행

### 5.1 배포 전 최종 확인
```bash
# 최신 코드 상태 확인
git status
# 예상: On branch main, clean working tree

# 최신 커밋 확인
git log --oneline -1
# 예상: 최근 Phase 4 관련 커밋
```

- [ ] Working tree clean (staged 파일 없음)
- [ ] 배포 대상 브랜치: main ✅
- [ ] 최근 빌드 성공 확인

### 5.2 배포 방법 선택

**Option A: GitHub Actions 자동 배포** (권장)
```bash
# main 브랜치에 푸시 (이미 완료됨)
git push origin main

# GitHub Actions 워크플로우 자동 실행
# .github/workflows/deploy-production.yml
```
- [ ] GitHub Actions 워크플로우 완료 확인
- [ ] Deployment 체크 통과
- [ ] Production 상태 green

**Option B: 수동 배포**
```bash
# PM2 reload (무중단 배포)
ssh server
cd /var/www/aedpics
git pull origin main
npm ci --production
npm run build
pm2 reload ecosystem.config.js
```
- [ ] 각 단계 성공 확인
- [ ] PM2 프로세스 online 상태 확인

### 5.3 배포 후 검증 (Smoke Test)

```bash
# 1. 엔드포인트 응답 확인
curl -X POST "https://aed.pics/api/inspections/export" \
  -H "Authorization: Bearer ${MASTER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -o /tmp/smoke_test.xlsx

# 예상: HTTP 200 + 유효한 XLSX 파일
```
- [ ] HTTP 200 응답 확인
- [ ] XLSX 파일 생성 확인
- [ ] 헤더 필드 포함 확인 (X-Applied-Limit 등)

```bash
# 2. PM2 상태 확인
pm2 status | grep aedpics
# 예상: status: online, restarts: 0 또는 작은 수
```
- [ ] PM2 상태 online
- [ ] 재시작 횟수 정상 범위 (< 5)

```bash
# 3. 로그 확인
pm2 logs aedpics --lines 20 | grep "Export:"
# 예상: Export:Request, Export:Success 로그 보임
```
- [ ] Export 관련 로그 정상 기록
- [ ] 에러 로그 없음

---

## 6. 배포 후 모니터링 (1시간)

### 6.1 실시간 모니터링 (5분마다 확인)
```bash
# 로그 모니터링
pm2 logs aedpics --lines 50 | tail -20

# PM2 상태
pm2 status
```
- [ ] 프로세스 상태 유지 (online)
- [ ] 재시작 없음
- [ ] 에러 로그 없음

### 6.2 사용자 피드백 모니터링
- [ ] Slack/이메일 오류 신고 없음
- [ ] 권한 관련 이슈 신고 없음
- [ ] 데이터 누락 신고 없음

### 6.3 성능 모니터링
```bash
# 응답 시간 확인
for i in {1..5}; do
  curl -X POST "https://aed.pics/api/inspections/export" \
    -H "Authorization: Bearer ${MASTER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"limit": 100}' \
    -w "Response time: %{time_total}s\n" \
    -o /dev/null -s
done
```
- [ ] 응답 시간 < 3초 (모든 요청)
- [ ] 일관된 응답 시간

---

## 7. 배포 완료 후 (다음 날)

### 7.1 일일 통계 확인
```bash
# 어제 Export 요청 통계
pm2 logs aedpics | grep "Export:Success\|Export:Permission" | wc -l
```
- [ ] Success 요청 정상 범위
- [ ] Permission 거부 정상 범위 (< 10%)
- [ ] 에러 요청 없음

### 7.2 데이터 무결성 확인
```sql
-- 점검 데이터 정상성 확인
SELECT COUNT(*) as total, COUNT(DISTINCT equipment_serial) as unique_devices
FROM inspections;
```
- [ ] 점검 기록 수 정상
- [ ] 데이터 중복 없음

### 7.3 배포 이슈 정리
| 이슈 | 심각도 | 상태 | 대응 |
|------|--------|------|------|
| (예: ) | - | Resolved | - |

---

## 8. 최종 승인

### 8.1 배포 승인 사인오프
```
배포 일시: 2025년 __월 __일 __시 __분
배포자: ______________ (DevOps)
검증자: ______________ (Tech Lead)
최종 승인: ______________ (PM)

배포 결과: ✅ 성공 / ❌ 실패

이슈 및 대응:
- (없음 또는 상세 기록)

다음 점검 일정:
- 배포 후 1일: 2025년 __월 __일
- 배포 후 1주: 2025년 __월 __일
- 배포 후 1월: 2025년 __월 __일
```

---

## 9. 롤백 계획

**롤백 필요 조건**:
- [ ] 502/503 에러 지속 (> 30분)
- [ ] 데이터 누락/손상 발견
- [ ] 권한 검증 오작동
- [ ] 성능 심각한 저하 (응답시간 > 10초)

**롤백 절차**:
```bash
# 1. 이전 배포 확인
git log --oneline -5
# 마지막 정상 커밋 찾기

# 2. 이전 버전으로 되돌리기
git revert HEAD
git push origin main
# 또는
git reset --hard <previous-commit-hash>

# 3. 재배포
pm2 reload ecosystem.config.js
# 또는 GitHub Actions 재실행

# 4. 검증
curl -X POST "https://aed.pics/api/inspections/export" ...
pm2 status
```

**롤백 승인권**: Tech Lead 이상

---

## 10. 배포 체크리스트 요약

### 필수 항목 (모두 ✅ 필수)
- [ ] TypeScript 컴파일 성공
- [ ] ESLint 검사 성공
- [ ] 프로덕션 빌드 성공
- [ ] QA 8개 기본 시나리오 통과
- [ ] 추가 검증 4개 케이스 통과
- [ ] 환경 상태 정상 (디스크, DB, 네트워크)
- [ ] Smoke test 200 OK
- [ ] PM2 프로세스 online
- [ ] 로그 정상 기록

### 선택 항목 (권장)
- [ ] GitHub Actions 자동 배포 사용
- [ ] 배포 후 1시간 실시간 모니터링
- [ ] 배포 후 1일 통계 확인
- [ ] 배포 후 1주 성능 분석

---

**배포 상태**: 🟢 준비 완료
**다음 단계**: 위 체크리스트 항목 모두 확인 후 배포 실행
**배포 후**: PHASE4_MONITORING_SETUP.md 가이드 따라 운영

