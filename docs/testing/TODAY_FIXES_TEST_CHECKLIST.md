# 오늘 수정 항목 테스트 체크리스트 (2025-11-15)

## 테스트 준비
- **URL**: http://localhost:3000
- **로그인**: nemcdg@nmc.or.kr / Dlsxm*0537
- **테스트 소요 시간**: 약 15분
- **필수 도구**: 브라우저 개발자 도구 (F12 → Console, Network)

---

## 🎯 오늘 수정한 핵심 기능

### 1. installation_location_address 검색 추가 (2개 API)
- `/api/aed-data` - AED 데이터 검색
- `/api/public/aed-locations` - 지도용 AED 검색

### 2. 주소 표시 로직 표준화 (3개 API, 11개 위치)
- `/api/compliance/check-optimized` - 최적화된 준수도 점검
- `/api/compliance/check` - 일반 준수도 점검
- `/api/compliance/management-number-candidates` - 관리번호 후보

### 3. 버그 수정 (방금 추가)
- `/api/compliance/match-basket` - 2025년 매칭 실패 버그

---

## 테스트 1: installation_location_address 검색 (5분)

### 1.1 AED 데이터 페이지
**목표**: installation_location_address로도 검색되는지 확인

1. **페이지 접속**
   - [ ] 로그인 후 "AED 데이터" 메뉴 클릭
   - [ ] `/aed-data` 페이지 로드 확인

2. **검색 테스트 - Case 1: installation_location_address 포함 주소**
   - [ ] 검색창에 **"동덕로"** 입력 후 검색
   - [ ] 검색 결과가 표시됨
   - [ ] 결과에 "동덕로"가 포함된 주소 확인
   - [ ] 개발자 도구 Console에 에러 없음 확인

3. **검색 테스트 - Case 2: installation_address 포함 주소**
   - [ ] 검색창 초기화 (X 버튼)
   - [ ] 검색창에 **"동산동"** 입력 후 검색
   - [ ] 검색 결과가 표시됨
   - [ ] 결과에 "동산동"이 포함된 주소 확인

4. **Network 탭 확인**
   - [ ] F12 → Network 탭
   - [ ] `/api/aed-data?search=...` 요청 확인
   - [ ] 응답 상태 200 OK 확인
   - [ ] 응답 시간 < 2초 확인

**예상 결과**:
- installation_location_address와 installation_address 모두 검색됨
- 이전에는 installation_location_address가 검색되지 않았음

---

## 테스트 2: 준수도 점검 - 주소 표시 확인 (5분)

### 2.1 준수도 점검 페이지 기본 조회
**목표**: 주소가 일관되게 표시되는지 확인

1. **페이지 접속**
   - [ ] "준수도 점검" 또는 "Compliance" 메뉴 클릭
   - [ ] `/compliance` 페이지 로드 확인

2. **필터 및 조회**
   - [ ] 연도: **2025** 선택
   - [ ] 시도: **대구광역시** 선택
   - [ ] "조회" 버튼 클릭
   - [ ] 의무설치기관 목록 로드 확인

3. **주소 표시 확인**
   - [ ] 각 기관의 매칭된 AED 주소 확인
   - [ ] 주소가 비어있지 않음 (빈 값 없음)
   - [ ] 주소 형식이 일관됨
   - [ ] "주소 미등록"이 적절하게 표시됨 (주소 없을 때만)

4. **Console 에러 확인**
   - [ ] F12 → Console 탭
   - [ ] 에러 메시지 없음 확인
   - [ ] Warning 확인 (있다면 기록)

**예상 결과**:
- 모든 주소가 installation_location_address 우선으로 표시됨
- Fallback (installation_address) 정상 작동

---

## 테스트 3: 관리번호 후보 조회 (3분)

### 3.1 자동 추천 및 검색
**목표**: 7개 위치의 COALESCE 로직이 정상 작동하는지 확인

1. **의무설치기관 선택**
   - [ ] 준수도 점검 페이지에서 기관 1개 선택
   - [ ] 우측 패널에 관리번호 후보 표시 확인

2. **자동 추천 확인**
   - [ ] "자동 추천" 섹션 확인
   - [ ] 추천된 관리번호 그룹의 주소 확인
   - [ ] 주소가 모두 표시됨 (빈 값 없음)

3. **검색 기능 확인**
   - [ ] 검색창에 **"병원"** 입력
   - [ ] 검색 결과의 주소 확인
   - [ ] 주소 형식이 일관됨

4. **Network 탭 확인**
   - [ ] `/api/compliance/management-number-candidates` 요청 확인
   - [ ] 응답 상태 200 OK
   - [ ] 응답의 `address` 필드가 모두 채워져 있음 확인

**예상 결과**:
- 7개 SQL 쿼리 모두 getSqlAddressCoalesce() 사용
- 주소 표시 일관성 유지

---

## 테스트 4: 담기 박스 매칭 (방금 수정한 버그) (2분)

### 4.1 2025년 데이터 매칭
**목표**: 2025년 선택 시 매칭이 정상 작동하는지 확인

1. **담기 박스 사용**
   - [ ] 준수도 점검 페이지 (연도: 2025)
   - [ ] 의무설치기관 선택
   - [ ] 관리번호 후보 중 1개를 "담기 박스"에 추가
   - [ ] "매칭" 버튼 클릭

2. **매칭 성공 확인**
   - [ ] **"매칭 실패" 에러가 발생하지 않음** ✅
   - [ ] 매칭 성공 메시지 확인
   - [ ] 해당 기관의 매칭 상태 업데이트 확인

3. **Console 에러 확인**
   - [ ] F12 → Console
   - [ ] "매칭 실패" 에러 없음 확인

**수정 전 증상**:
- ❌ 2025년 선택 시 "매칭 실패" 에러 발생
- ❌ Console에 "매칭 실패" 에러 로그

**수정 후 예상**:
- ✅ 2025년에도 정상 매칭됨
- ✅ 에러 없음

---

## 테스트 5: 통합 검증 (선택사항, 추가 5분)

### 5.1 여러 시나리오 조합

1. **시도별 테스트**
   - [ ] 대구광역시 외 다른 시도 선택 (예: 서울특별시)
   - [ ] 주소 표시 일관성 확인
   - [ ] 검색 기능 정상 작동 확인

2. **연도별 테스트**
   - [ ] 2024년 선택하여 동일 테스트
   - [ ] 2025년 선택하여 동일 테스트
   - [ ] 두 연도 모두 정상 작동 확인

3. **페이지 전환 테스트**
   - [ ] 여러 페이지를 탐색하며 주소 일관성 확인
   - [ ] AED 데이터 → 준수도 점검 → 관리번호 후보
   - [ ] 모든 곳에서 동일한 주소 형식 사용 확인

---

## 🔍 개발자 도구 체크포인트

### Console 에러 확인 (필수)
```
예상: 에러 없음
확인: F12 → Console 탭에서 빨간색 에러 메시지 확인
```

### Network 요청 확인 (필수)
```
주요 API:
1. /api/aed-data → 200 OK
2. /api/compliance/check-optimized → 200 OK
3. /api/compliance/management-number-candidates → 200 OK
4. /api/compliance/match-basket → 200 OK (이전: 404 또는 500)
```

### 응답 데이터 확인 (선택)
```
Network → 요청 클릭 → Response 탭
address 필드가 null이나 빈 값 없이 정상 표시되는지 확인
```

---

## 📊 테스트 결과 기록

### 발견된 이슈
```
이슈 번호 | 페이지 | 증상 | 재현 단계
--------|--------|------|----------
1       |        |      |
2       |        |      |
```

### 통과 여부
- [ ] 테스트 1: installation_location_address 검색 ✅/❌
- [ ] 테스트 2: 준수도 점검 주소 표시 ✅/❌
- [ ] 테스트 3: 관리번호 후보 조회 ✅/❌
- [ ] 테스트 4: 담기 박스 매칭 (2025년) ✅/❌
- [ ] 테스트 5: 통합 검증 ✅/❌ (선택)

### 최종 평가
- **전체 통과율**: ____%
- **심각한 이슈**: 0개
- **경미한 이슈**: 0개
- **배포 준비**: ✅ 준비됨 / ❌ 추가 수정 필요

---

## 🎯 핵심 확인 사항 요약

### 반드시 확인해야 할 3가지

1. **검색 기능**
   - ✅ AED 데이터에서 "동덕로" 검색 시 결과 표시됨
   - ✅ installation_location_address가 검색에 포함됨

2. **주소 표시**
   - ✅ 모든 페이지에서 주소가 비어있지 않음
   - ✅ installation_location_address 우선 표시됨
   - ✅ installation_address로 fallback됨

3. **매칭 기능**
   - ✅ 2025년 선택 시 "매칭 실패" 에러 없음
   - ✅ 담기 박스 매칭이 정상 작동함

---

## 📝 참고 정보

### 오늘 수정한 파일 목록
```
1. app/api/aed-data/route.ts
2. app/api/public/aed-locations/route.ts
3. app/api/compliance/check-optimized/route.ts
4. app/api/compliance/check/route.ts
5. app/api/compliance/management-number-candidates/route.ts
6. app/api/compliance/match-basket/route.ts (방금 수정)
7. lib/utils/null-helpers.ts (신규 생성)
8. lib/utils/aed-address-helpers.ts (신규 생성)
```

### 주소 우선순위
```
1순위: installation_location_address
2순위: installation_address
기본값: "주소 미등록"
```

### 자동 테스트 결과
```
✅ 23/23 통과 (100%)
- 유틸리티 함수: 11개 통과
- API 검색 기능: 4개 통과
- Prisma.raw() 패턴: 4개 통과
- 파일 구조: 4개 통과
```

---

**테스트 작성일**: 2025-11-15
**테스트 담당자**: _____________
**테스트 시작**: ___:___
**테스트 종료**: ___:___
**소요 시간**: _____분
