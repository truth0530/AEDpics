# Inspection Data Propagation Consistency Skill (REWRITTEN)

## 목적

점검(Inspection) 단계에서 사용자가 **25가지 실제 점검 항목** 중 어느 하나를 수정할 때, 그 변경사항이 **모든 화면과 보고서에 일관되게 반영**되는지 검증합니다.

**핵심 원칙**: 한 곳에서 수정된 데이터는 다음 모든 곳에서 최신 상태로 표시되어야 합니다:
1. 현재 Step의 UI (버튼 색상 변경)
2. 미리보기 화면 (Summary Step)
3. PDF 보고서
4. 관리자 대시보드 (AdminFullView)
5. 점검효과/통계 메뉴

---

## 검증 대상: 28가지 실제 점검 항목

### 그룹 1: 기본 정보 (BasicInfoStep)
1. **관리책임자** (Manager Name) - 텍스트
2. **담당자 연락처** (Contact Phone) - 전화번호
3. **외부표출** (External Display) - 선택
4. **대분류** (Main Category) - 드롭다운 (동적 필터)
5. **중분류** (Sub Category) - 드롭다운 (대분류에 따라 필터됨)
6. **소분류** (Detailed Category) - 드롭다운 (중분류에 따라 필터됨)
7. **GPS 위도** (Latitude) - 숫자 (지도에서 드래그로 변경)
8. **GPS 경도** (Longitude) - 숫자 (지도에서 드래그로 변경)
9. **주소** (Address) - 텍스트
10. **설치위치** (Installation Location) - 텍스트
11. **설치 위치 접근 허용 범위** (Access Range) - 선택
12. **사용 가능 시간** (Operating Hours) - 시간 범위

### 그룹 2: 장비 정보 (DeviceInfoStep)
13. **제조사** (Manufacturer) - 텍스트
14. **모델명** (Model Name) - 텍스트
15. **제조번호/시리얼번호** (Serial Number) - 텍스트
16. **배터리 유효기간** (Battery Expiry) - 날짜
17. **패드 유효기간** (Pad Expiry) - 날짜
18. **제조일자 본체** (Manufacturing Date) - 날짜
19. **장비정상 작동 여부** (Equipment Operation) - 선택/체크
20. **사진 업로드** (Photo Capture) - 파일 (추가 여부만 검증, 변경 불필요)

### 그룹 3: 보관함 체크리스트 (StorageChecklistStep)
21. **보관함 형태** (Storage Type) - 선택
22. **도난경보장치 작동 여부** (Theft Alarm) - 선택/체크
23. **보관함 각종 안내문구 표시** (Signage in Storage) - 체크리스트
24. **비상연락망 표시 여부** (Emergency Contact Display) - 선택/체크
25. **심폐소생술 방법 안내책자/그림 여부** (CPR Guide) - 선택/체크
26. **패드 및 배터리 유효기간 표시 여부** (Expiry Display) - 선택/체크
27. **안내표지 설치** (Information Signs) - 다중선택

### 그룹 4: 관리자 교육 및 보고 (ManagerEducationStep)
28. **관리책임자 교육 이수 현황** (Manager Training Status) - 선택
    - 이수: 표시만 필요
    - 미이수 선택 시: 확장되어 **미이수 사유** (Reason for Non-completion) - 텍스트 입력 필드 활성화
29. **보건복지부 재난의료정책과로 전달할 사항** (Report Items) - 텍스트

---

## 검증 범위

### Phase 1: 필드 수정 감지 및 상태 변화

#### 1.1 수정 감지 메커니즘 - 모든 25개 항목

```
Step 입력 → 필드 변경 감지 → isChanged 플래그 활성화 → 버튼 색상 변경
```

**검증 항목 (각 필드별로 반복)**:
- [ ] 각 Step에서 필드 수정 시 `isChanged` 플래그 정상 작동
- [ ] 필드 값 변경 감지 (debounce 없이 즉시 감지)
- [ ] 원본값으로 복구 시 `isChanged` 플래그 해제

**검증 매트릭스 (28개 항목 + 미이수 사유 조건부 필드)**:

#### BasicInfoStep (12개 필드)
```
[ ] 1. 관리책임자: "김철수" → "이영희"
  ✅ isChanged = true
  ✅ 버튼 색상 노란색

[ ] 2. 담당자 연락처: "010-1234-5678" → "010-9876-5432"
  ✅ isChanged = true
  ✅ 형식 검증 (휴대폰 형식)

[ ] 3. 외부표출: "예" → "아니오"
  ✅ isChanged = true
  ✅ 선택값 변경 감지

[ ] 4. 대분류: "구비의무기관" → "응급실 구비기관"
  ✅ isChanged = true
  ✅ 드롭다운 선택
  ✅ 중분류 필터 업데이트 (대분류 변경에 따라)

[ ] 5. 중분류: "병원" → "보건소"
  ✅ isChanged = true
  ✅ 드롭다운 선택 (대분류로 필터됨)
  ✅ 소분류 필터 업데이트 (중분류 변경에 따라)

[ ] 6. 소분류: "종합병원" → "지역보건소"
  ✅ isChanged = true
  ✅ 드롭다운 선택 (중분류로 필터됨)

[ ] 7. GPS 위도: "37.4979" → "37.5000" (지도에서 드래그)
  ✅ isChanged = true
  ✅ 숫자 형식 검증
  ✅ 지도 마커 이동 감지

[ ] 8. GPS 경도: "127.0276" → "127.0300" (지도에서 드래그)
  ✅ isChanged = true
  ✅ 숫자 형식 검증
  ✅ 지도 마커 이동 감지

[ ] 9. 주소: "서울 강서구 공항대로" → "부산 중구 중앙대로"
  ✅ isChanged = true
  ✅ 텍스트 변경 감지

[ ] 10. 설치위치: "로비" → "1층 입구"
  ✅ isChanged = true
  ✅ 위치 설명 변경

[ ] 11. 접근 허용 범위: "도보 가능" → "차량만 가능"
  ✅ isChanged = true
  ✅ 접근성 옵션 변경

[ ] 12. 사용 가능 시간: "09:00-18:00" → "24시간"
  ✅ isChanged = true
  ✅ 시간 범위 변경
```

#### DeviceInfoStep (8개 필드)
```
[ ] 13. 제조사: "필립스" → "존슨앤존슨"
  ✅ isChanged = true

[ ] 14. 모델명: "HeartStart OnSite" → "Powerheart G5"
  ✅ isChanged = true

[ ] 15. 시리얼번호: "SN-2020-001" → "SN-2020-002"
  ✅ isChanged = true

[ ] 16. 배터리 유효기간: "2025-03-31" → "2025-06-30"
  ✅ isChanged = true
  ✅ 만료 여부 자동 판정
  ✅ 조치계획 필드 활성화/비활성화

[ ] 17. 패드 유효기간: "2024-12-31" → "2025-12-31"
  ✅ isChanged = true
  ✅ 패드 상태 변경

[ ] 18. 제조일자: "2020-06-15" → "2020-08-20"
  ✅ isChanged = true

[ ] 19. 장비 작동 여부: "정상" → "불량"
  ✅ isChanged = true
  ✅ 상태 옵션 변경

[ ] 20. 사진 업로드: 없음 → 3장 추가
  ✅ isChanged = true (추가 여부만 검증)
  ✅ 파일 개수 변경 감지
  ✅ 이미지 프리뷰 업데이트
  ℹ️ 사진 변경/삭제는 검증 불필요 (추가만 검증)
```

#### StorageChecklistStep (7개 필드)
```
[ ] 21. 보관함 형태: "고정식" → "이동식"
  ✅ isChanged = true

[ ] 22. 도난경보장치 작동 여부: 미설치 → 설치됨
  ✅ isChanged = true

[ ] 23. 보관함 각종 안내문구 표시: 3/5 체크 → 5/5 체크
  ✅ isChanged = true (체크 개수 변경)
  ✅ 점수 자동 계산
  ✅ 체크리스트 점수 변경

[ ] 24. 비상연락망 표시 여부: 미표시 → 표시됨
  ✅ isChanged = true

[ ] 25. 심폐소생술 방법 안내책자/그림 여부: 없음 → 책자 보유
  ✅ isChanged = true

[ ] 26. 패드 및 배터리 유효기간 표시 여부: 미표시 → 표시됨
  ✅ isChanged = true

[ ] 27. 안내표지 설치: 미설치 → 2가지 설치됨 (다중선택)
  ✅ isChanged = true
  ✅ 다중선택 변경 감지
```

#### ManagerEducationStep (2개 필드)
```
[ ] 28. 관리책임자 교육 이수 현황: "이수" → "미이수"
  ✅ isChanged = true (선택값 변경)
  ✅ "미이수" 선택 시: 확장되어 "미이수 사유" 텍스트 필드 활성화

  ┕→ 미이수 사유: "" → "담당자 부재 중"
    ✅ isChanged = true (조건부 필드)
    ✅ 교육 이수 상태에 따라 활성화/비활성화

[ ] 29. 보건복지부 재난의료대응과로 전달할 사항: "" → "배터리 교체 예정"
  ✅ isChanged = true
  ✅ 텍스트 입력 변경
```

---

### Phase 2: 미리보기 화면 동기화 (InspectionSummaryStep)

#### 2.1 각 필드의 Summary 동기화 검증

```
Step 필드 수정 → Zustand store 업데이트 → Summary 화면 리렌더링
```

**검증 항목**:
- [ ] BasicInfoStep 수정 → Summary 섹션 1 업데이트
- [ ] DeviceInfoStep 수정 → Summary 섹션 2 업데이트
- [ ] StorageChecklistStep 수정 → Summary 섹션 3 업데이트
- [ ] ManagerEducationStep 수정 → Summary 섹션 4 업데이트

#### 2.2 25개 항목 Summary 동기화 상세 체크

```
BasicInfoStep 수정 시나리오:
1. 관리책임자 "김철수" → "이영희"
   → Summary: "담당자: 이영희" 표시 ✅

2. 대분류 "구비의무기관" → "응급실 구비기관" 변경
   → 중분류 자동 필터링 (새로운 대분류에 맞게)
   → Summary: 분류 정보 업데이트 ✅

3. GPS 좌표 변경: (37.4979, 127.0276) → (37.5000, 127.0300)
   → Summary: 지도 마커 위치 업데이트 ✅
   → Summary: 로드뷰 업데이트 ✅

4. 주소 변경: "서울 강서구" → "부산 중구"
   → Summary: 새 주소 표시 ✅
   → Summary: 지도 이동 ✅

DeviceInfoStep 수정 시나리오:
5. 배터리 유효기간 "2025-03-31" → "2025-06-30"
   → Summary: 배터리 정보 "2025-06-30 (유효)" 표시 ✅
   → Summary: 조치계획 필드 숨김 ✅

6. 배터리 "2025-06-30" → "2025-02-28"
   → Summary: "2025-02-28 (만료)" 표시 ✅
   → Summary: 조치계획 필드 표시 ✅

7. 패드 유효기간 변경
   → Summary: 패드 정보 업데이트 ✅

8. 사진 3장 추가
   → Summary: 사진 썸네일 3개 표시 ✅
   → 각 사진 미리보기 정상 ✅
   ℹ️ 사진 추가 여부만 동기화 (변경/삭제는 추적 불필요)

StorageChecklistStep 수정 시나리오:
9. 보관함 체크리스트 3/5 → 5/5 체크
   → Summary: 점수 "60%" → "100%" 변경 ✅
   → Summary: 체크리스트 상태 업데이트 ✅

10. 안내표지 설치: 미설치 → "옥외표지", "실내표지" 다중선택
    → Summary: 선택된 항목들 표시 ✅

ManagerEducationStep 수정 시나리오:
11. 관리자 교육 "이수" → "미이수"
    → Summary: 교육 상태 "미이수" 표시 ✅
    → Summary: "미이수 사유" 필드 확장 표시 ✅

12. 미이수 사유 입력 (미이수 선택 후 확장됨)
    → Summary: 사유 텍스트 표시 ✅

13. 보건복지부 전달 사항 추가
    → Summary: 전달 사항 텍스트 표시 ✅
```

#### 2.3 계산 필드 자동 업데이트

```
수정된 필드 → 의존성 필드 자동 계산 → Summary 업데이트
```

**검증 항목**:
- [ ] 대분류 변경 → 중분류 드롭다운 자동 필터링 (새 대분류에 맞는 항목만 표시)
- [ ] 중분류 변경 → 소분류 드롭다운 자동 필터링 (새 중분류에 맞는 항목만 표시)
- [ ] 배터리 유효기간 변경 → 만료 여부 자동 판정 → 조치계획 필드 활성화/비활성화
- [ ] 패드 유효기간 변경 → 패드 상태 자동 판정
- [ ] 보관함 체크리스트 체크 개수 변경 → 점수 자동 계산 (체크리스트 점수 백분율 계산)
- [ ] 관리책임자 교육 "미이수" 선택 → 미이수 사유 텍스트 필드 자동 확장

---

### Phase 3: PDF 보고서 데이터 반영

#### 3.1 PDF 생성 시 25개 항목 모두 최신 데이터 포함 검증

```
점검 완료 → PDF 생성 요청 → 최신 필드값 → PDF 다운로드
```

**검증 항목** (각 섹션별):

#### PDF 섹션 1: 기본 정보
```
[ ] 관리책임자: 최신값 포함
[ ] 담당자 연락처: 최신값 포함
[ ] 외부표출: 최신값 포함
[ ] 지역 분류: 최신값 포함 (시도/구군/상세)
[ ] GPS 좌표: 최신값 포함 (지도 이미지 생성 시 올바른 좌표)
[ ] 주소: 최신값 포함
[ ] 설치위치: 최신값 포함
[ ] 접근 범위: 최신값 포함
[ ] 사용 가능 시간: 최신값 포함
```

#### PDF 섹션 2: 장비 정보
```
[ ] 제조사: 최신값 포함
[ ] 모델명: 최신값 포함
[ ] 시리얼번호: 최신값 포함
[ ] 배터리 유효기간: 최신값 포함
[ ] 배터리 상태: 최신 계산값 포함 (유효/만료)
[ ] 패드 유효기간: 최신값 포함
[ ] 패드 상태: 최신 계산값 포함
[ ] 제조일자: 최신값 포함
[ ] 장비 상태: 최신값 포함
[ ] 사진: 모든 업로드된 사진 포함
```

#### PDF 섹션 3: 보관함 및 안내
```
[ ] 보관함 형태: 최신값 포함
[ ] 도난경보 설치: 최신값 포함
[ ] 보관함 안내문: 최신 체크리스트 결과
[ ] 체크리스트 점수: 최신 계산값 포함
[ ] 비상연락망 표시: 최신값 포함
[ ] CPR 안내: 최신값 포함
[ ] 유효기간 표시: 최신값 포함
[ ] 안내표지: 최신값 포함
```

#### PDF 섹션 4: 교육 및 조치
```
[ ] 관리자 교육 이수: 최신값 포함
[ ] 보건복지부 전달 사항: 최신값 포함
[ ] 조치계획: 배터리/패드 만료 시만 포함
```

#### 3.2 PDF 생성 API 검증

```
PATCH /api/inspections/[id] 저장 후
POST /api/inspections/[id]/report/pdf 호출
```

**검증 항목**:
- [ ] API가 최신 데이터베이스 값 조회 (캐시 아님)
- [ ] 응답 시간 < 3초
- [ ] PDF 파일 형식 정상
- [ ] 한글 문자 정상 인코딩
- [ ] 이미지 삽입 정상 (사진, 지도)

---

### Phase 4: 관리자 대시보드 동기화 (AdminFullView)

#### 4.1 점검 이력 목록 업데이트 검증

```
점검 저장 → DB 반영 → AdminFullView 자동 갱신 (30초 주기)
```

**검증 항목** (AdminFullView 목록 화면):
- [ ] 점검 목록에 최신 수정 데이터 표시
- [ ] 관리책임자: 최신값
- [ ] 담당자 연락처: 최신값
- [ ] 지역: 최신값 (GPS 기반 자동 추출 또는 수동 입력)
- [ ] 주소: 최신값
- [ ] 장비: 제조사/모델명 최신값
- [ ] 배터리 상태: "유효" / "만료" 최신값
- [ ] 패드 상태: "유효" / "만료" 최신값
- [ ] 장비 상태: "정상" / "불량" 최신값
- [ ] 보관함 안내 점수: 최신 계산값
- [ ] 마지막 수정 시간: 현재 시간으로 업데이트
- [ ] 점검 상태: "수정중" → "완료" (저장 후)

#### 4.2 상세 보기 모달 동기화 검증

```
AdminFullView에서 상세 보기 클릭 → InspectionHistoryModal
```

**검증 항목** (InspectionHistoryModal의 4단계 탭):

##### 탭 1: 기본정보
```
[ ] 관리책임자: 최신값
[ ] 담당자 연락처: 최신값
[ ] 외부표출: 최신값
[ ] 지역 분류: 최신값
[ ] GPS 좌표: 최신값 (지도 표시)
[ ] 주소: 최신값
[ ] 설치위치: 최신값
[ ] 접근 범위: 최신값
[ ] 사용 가능 시간: 최신값
```

##### 탭 2: 장비정보
```
[ ] 제조사: 최신값
[ ] 모델명: 최신값
[ ] 시리얼번호: 최신값
[ ] 배터리 유효기간: 최신값
[ ] 배터리 상태: 최신값
[ ] 패드 유효기간: 최신값
[ ] 패드 상태: 최신값
[ ] 제조일자: 최신값
[ ] 장비 상태: 최신값
[ ] 사진: 모든 업로드된 사진
```

##### 탭 3: 보관함
```
[ ] 보관함 형태: 최신값
[ ] 보관함 안내 점수: 최신값
[ ] 모든 체크리스트 항목: 최신 체크 상태
```

##### 탭 4: 점검요약
```
[ ] 전체 점검 결과: 최신 계산값
[ ] 조치계획: 만료 상태에 따라 표시/숨김
[ ] 보건복지부 전달 사항: 최신값
```

#### 4.3 모달 닫고 다시 열기 시 데이터 재조회

**검증 항목**:
- [ ] 모달 닫기 후 재오픈 시 DB에서 최신 데이터 재조회
- [ ] 동시에 여러 장비의 모달 열어도 각각 최신 데이터 표시
- [ ] 조회 중 새로운 수정이 발생해도 모달 데이터 최신 유지

---

### Phase 5: 점검효과/통계 메뉴 동기화

#### 5.1 통계 데이터 최신화 검증

```
점검 완료 → 통계 자동 계산 → 대시보드/그래프 업데이트
```

**검증 대상 통계 지표**:

##### 5.1.1 점검 건수 통계
```
[ ] 총 점검: 새 점검 추가 시 +1
[ ] 완료된 점검: 점검 저장 시 +1
[ ] 진행 중: 미완료 점검
[ ] 지역별 점검: 각 지역별 분류 정확성
```

##### 5.1.2 장비 상태 통계
```
[ ] 배터리 유효 장비: 배터리 만료 변경 시 실시간 업데이트
[ ] 배터리 만료 장비: 배터리 유효기간이 과거 날짜면 포함
[ ] 패드 유효 장비: 패드 만료 변경 시 실시간 업데이트
[ ] 패드 만료 장비: 패드 유효기간이 과거 날짜면 포함
[ ] 장비 정상: 장비 상태 "정상"인 개수
[ ] 장비 불량: 장비 상태 "불량"인 개수
```

##### 5.1.3 안내 현황 통계
```
[ ] 보관함 체크 점수 평균: 최신 점검 데이터 기반 재계산
[ ] 안내표지 설치율: 설치됨 장비 / 전체 × 100
[ ] 비상연락망 표시율: 표시된 장비 / 전체 × 100
[ ] CPR 안내 보유율: 보유 장비 / 전체 × 100
```

##### 5.1.4 교육 현황 통계
```
[ ] 관리자 교육 이수율: 이수 / (이수+미이수) × 100
[ ] 미이수 사유별 통계: 미이수 장비의 사유 분류
```

#### 5.2 통계 페이지 데이터 일관성 검증

**검증 파일**:
- `app/performance/page.tsx` 또는 `app/admin/statistics/page.tsx`

**검증 항목**:
- [ ] 주간 점검 건수 그래프: 최신 점검 데이터 포함
- [ ] 월간 점검 추이: 과거 데이터 정확성
- [ ] 장비별 점검 이력: 최신 상태 반영
- [ ] 미처리 점검 목록: 만료된 배터리/패드 포함
- [ ] 응급의료센터별 성과: 지역별 정확한 집계

#### 5.3 통계 업데이트 타이밍

```
실시간 (< 1초):
- 점검 저장 후 AdminFullView 데이터 업데이트

준실시간 (< 30초):
- AdminFullView 자동 갱신 (30초 주기)

배경 갱신 (5분):
- 통계 페이지 캐시 업데이트

일일 통계 (00:00):
- 일일 성과 데이터 생성
```

---

## 자동 검증 체크리스트

### 위험도 높음 (Priority 1 - 반드시 검증)

#### 1. 배터리/패드 유효기간 → 조치계획 필드 동기화
```
시나리오 1: 배터리 만료 → 만료 아님
- 원본: 2025-02-28 (만료) → 조치계획 필드 보임 + "배터리 교체" 선택 가능
- 변경: 2025-06-30 (유효)
- 검증:
  [ ] UI: 조치계획 필드 숨김 ✅
  [ ] Summary: 조치계획 필드 숨김 ✅
  [ ] PDF: 조치계획 섹션 없음 ✅
  [ ] AdminFullView: "배터리 만료" 라벨 제거 ✅

시나리오 2: 배터리 유효 → 만료
- 원본: 2025-06-30 (유효) → 조치계획 필드 숨김
- 변경: 2025-02-28 (만료)
- 검증:
  [ ] UI: 조치계획 필드 표시 + "배터리 교체" 필수 선택
  [ ] Summary: 조치계획 필드 표시 ✅
  [ ] PDF: 조치계획 섹션 포함 ✅
  [ ] AdminFullView: "배터리 만료" 라벨 추가 ✅
```

#### 2. GPS 좌표 변경 → 지도/주소 동기화
```
시나리오: GPS 변경 시
- 원본: 37.4979, 127.0276 (강서구)
- 변경: 35.1595, 129.0356 (부산)
- 검증:
  [ ] UI: 지도 마커 위치 이동 ✅
  [ ] Summary: 지도 위치 업데이트 ✅
  [ ] AdminFullView: 지역 분류 변경 (서울→부산) ✅
  [ ] PDF: 지도 이미지 올바른 좌표 사용 ✅
```

#### 3. 보관함 체크리스트 변경 → 점수 계산 동기화
```
시나리오: 보관함 안내 3/5체크 → 5/5체크
- 검증:
  [ ] UI: 점수 "60%" → "100%" 변경 ✅
  [ ] Summary: 점수 "60%" → "100%" 표시 ✅
  [ ] PDF: "100%" 포함 ✅
  [ ] 통계: 평균 점수 재계산 ✅
```

### 중간 위험도 (Priority 2 - 권장 검증)

#### 4. 사진 업로드 → 모든 화면 동기화
```
시나리오: 사진 3장 업로드
- 검증:
  [ ] UI: 이미지 프리뷰 3개 표시 ✅
  [ ] Summary: 썸네일 3개 표시 ✅
  [ ] PDF: 3장 모두 포함 ✅
  [ ] Storage: 이미지 파일 NCP Object Storage에 저장 ✅
```

#### 5. 관리자/담당자 정보 변경 → 모든 화면 동기화
```
시나리오: 관리책임자 "김철수" → "이영희"
- 검증:
  [ ] UI: 새 이름 표시 ✅
  [ ] Summary: "이영희" 표시 ✅
  [ ] AdminFullView 목록: "이영희" 표시 ✅
  [ ] AdminFullView 모달: "이영희" 표시 ✅
  [ ] PDF: "이영희" 포함 ✅
```

### 낮은 위험도 (Priority 3 - 정기 점검)

#### 6. 설명 텍스트 필드 변경
```
시나리오: 설치위치 "로비" → "1층 입구 우측"
- 검증:
  [ ] Summary: "1층 입구 우측" 표시 ✅
  [ ] PDF: 변경된 위치 포함 ✅
  [ ] AdminFullView: 업데이트됨 표시 ✅
```

---

## 검증 자동화 스크립트 (Pseudocode)

### 검증 순서

```
각 25개 항목에 대해 반복:

1️⃣ Phase 1 검증: 필드 수정 감지
   - Step에서 필드 값 변경
   - isChanged 플래그 확인
   - 버튼 색상 변경 확인

2️⃣ Phase 2 검증: Summary 동기화
   - 다른 Step으로 이동
   - Summary 탭 확인
   - 변경된 값 표시 확인

3️⃣ Phase 3 검증: PDF 생성
   - "점검 완료" 버튼 클릭
   - PDF 다운로드
   - PDF 내용에 변경된 값 포함 확인

4️⃣ Phase 4 검증: AdminFullView 동기화
   - AdminFullView 새로고침 (30초 대기)
   - 점검 목록에 변경된 값 표시 확인
   - 상세 모달에서 4단계 탭 모두 확인

5️⃣ Phase 5 검증: 통계 업데이트
   - 통계 페이지 방문
   - 해당 지표 변경 확인
   - (필요시) 브라우저 캐시 무효화 후 재확인
```

### 각 항목별 검증 결과 기록

```typescript
interface ValidationResult {
  itemName: string;        // 예: "배터리 유효기간"
  itemGroup: string;       // 예: "DeviceInfoStep"
  originalValue: any;      // 원본값
  changedValue: any;       // 변경값

  phase1: {
    isChangedFlag: boolean;
    buttonColorChanged: boolean;
    passed: boolean;
  };

  phase2: {
    summaryUpdated: boolean;
    calculatedFieldsUpdated: boolean;
    passed: boolean;
  };

  phase3: {
    pdfGenerated: boolean;
    pdfContainsNewValue: boolean;
    passed: boolean;
  };

  phase4: {
    adminListUpdated: boolean;
    adminModalUpdated: boolean;
    passed: boolean;
  };

  phase5: {
    statisticsUpdated: boolean;
    statisticsAccurate: boolean;
    passed: boolean;
  };

  overallPassed: boolean;  // 5개 Phase 모두 통과
}
```

---

## 자주 하는 실수 (실제 발생했던 버그들)

### ❌ 실수 1: 배터리 만료 여부 조건 누락
**문제**: "수정" 중일 때 조치계획 필드 비활성화
```typescript
// ❌ 잘못된 코드 (2025-11-09 발견)
if (isMatched && currentIsExpired) {
  showField();  // 일치할 때만 표시
}

// ✅ 올바른 코드 (수정됨)
if (currentIsExpired) {
  showField();  // 상태와 무관하게 만료 여부만 확인
}
```

### ❌ 실수 2: Zustand Store 업데이트 누락
**문제**: Summary에서 변경된 필드값 미반영
```typescript
// ❌ 필드 변경만 하고 store 업데이트 안 함
inputElement.value = newValue;

// ✅ 필드 변경 후 store 업데이트
inputElement.value = newValue;
store.updateField(fieldName, newValue);
```

### ❌ 실수 3: 계산 필드 의존성 배열 누락
**문제**: 배터리 유효기간 변경 후 조치계획 필드 상태 미변경
```typescript
// ❌ 의존성 누락
useEffect(() => {
  recalculateExpiredStatus();
}, []); // ← 배터리 필드 의존성 없음

// ✅ 올바른 의존성
useEffect(() => {
  recalculateExpiredStatus();
}, [batteryExpiry, padExpiry]); // ← 모든 의존 필드 포함
```

### ❌ 실수 4: PDF 캐시 사용
**문제**: 최신 데이터가 PDF에 미반영
```typescript
// ❌ 캐시된 데이터 사용
const cachedData = cache.get(`inspection-${id}`);
generatePDF(cachedData);  // 구 버전 데이터

// ✅ DB에서 직접 조회
const latestData = await db.inspection.findUnique({
  where: { id }
});
generatePDF(latestData);
```

### ❌ 실수 5: AdminFullView 갱신 타이밍
**문제**: 30초 이상 지나도 AdminFullView 미업데이트
```typescript
// ❌ 갱신 로직 없음
const [data, setData] = useState(initialData);

// ✅ 30초마다 갱신
useEffect(() => {
  const interval = setInterval(() => {
    fetchLatestData();
  }, 30000);

  return () => clearInterval(interval);
}, []);
```

---

## 관련 파일 및 코드 위치

### 상태 관리
- **`lib/state/inspection-session-store.ts`**: Zustand store (필드 변경 감지)

### Step 컴포넌트 (필드 입력)
- **`components/inspection/steps/BasicInfoStep.tsx`**: 10개 필드
- **`components/inspection/steps/DeviceInfoStep.tsx`**: 8개 필드 (배터리/패드 포함)
- **`components/inspection/steps/StorageChecklistStep.tsx`**: 7개 필드
- **`components/inspection/steps/ManagerEducationStep.tsx`**: 2개 필드

### Summary (미리보기)
- **`components/inspection/steps/InspectionSummaryStep.tsx`**: 모든 필드 표시

### API 저장
- **`app/api/inspections/[id]/route.ts`**: PATCH 엔드포인트

### PDF 생성
- **`lib/pdf/generate-report.ts`**: PDF 생성 로직

### 관리자 대시보드
- **`components/inspection/AdminFullView.tsx`**: 점검 목록 + 모달
- **`components/inspection/InspectionHistoryModal.tsx`**: 상세 정보 모달

### 통계
- **`app/performance/page.tsx`** 또는 **`app/admin/statistics/page.tsx`**: 통계 대시보드

---

## 검증 결과 해석

### ✅ 성공 상태 (Green)
```
PASS: Data Propagation Consistency

각 25개 항목에 대해:
Phase 1 ✅ → Phase 2 ✅ → Phase 3 ✅ → Phase 4 ✅ → Phase 5 ✅

예시:
- 배터리 유효기간 변경
  ✅ isChanged = true (Phase 1)
  ✅ Summary에 "2025-06-30" 표시 (Phase 2)
  ✅ PDF에 "2025-06-30" 포함 (Phase 3)
  ✅ AdminFullView에 업데이트됨 표시 (Phase 4)
  ✅ 통계의 "배터리 만료 장비" 업데이트됨 (Phase 5)
```

### ⚠️ 경고 상태 (Yellow)
```
WARNING: Data Propagation Delay

예시:
- Summary 업데이트 지연: 3초 이상
  원인: 계산 작업 과중 또는 렌더링 최적화 부족
  해결: useMemo, useCallback, React.memo 검토

- 통계 업데이트 지연: 5분 이상
  원인: 캐시 만료 시간 과도 또는 백그라운드 작업 대기
  해결: 캐시 무효화 메커니즘 추가
```

### ❌ 실패 상태 (Red)
```
FAIL: Data Not Propagating

예시:
- Summary에서 변경된 필드값 미반영
  원인: Zustand store 업데이트 누락
  해결: handleChange 함수 검토, 의존성 배열 확인

- PDF에서 최신 데이터 미포함
  원인: PDF 생성 시 캐시된 데이터 사용
  해결: PDF 생성 전 DB 재조회 강제

- 통계 메뉴에서 오래된 데이터 표시
  원인: 캐시 만료 시간 과도 또는 업데이트 로직 없음
  해결: 캐시 무효화 메커니즘 추가

- 25개 중 일부 항목만 동기화됨
  원인: 특정 필드의 의존성 배열 누락
  해결: 모든 필드의 useEffect 의존성 배열 검토
```

---

## 실행 방법

### 1️⃣ 수동 검증 (추천)

각 25개 항목에 대해 다음 절차를 반복:

```
1. Step에서 해당 필드 수정
   예: 배터리 유효기간 "2025-03-31" → "2025-06-30"

2. 버튼 색상 변경 확인
   ✅ 노란색 테두리 나타남

3. Summary 탭으로 이동
   ✅ "2025-06-30" 표시 확인

4. 다른 Step 방문 후 돌아오기
   ✅ 입력값 "2025-06-30" 유지

5. "점검 완료" → "PDF 생성" 클릭
   ✅ PDF에 "2025-06-30" 포함

6. AdminFullView에서 해당 점검 클릭
   ✅ 모달에서 "2025-06-30" 표시

7. 통계 페이지 방문
   ✅ 관련 통계 업데이트됨
```

### 2️⃣ 자동 검증 (테스트 자동화)

```typescript
// 예시: Cypress 테스트 (framework agnostic pseudocode)

describe('Data Propagation: All 25 Items', () => {

  // Phase 1: 필드 수정 감지
  test('Phase 1: Battery Expiry Change Detection', () => {
    // 1. 원본값 확인
    const originalValue = getFieldValue('battery_expiry');
    expect(isChanged).toBe(false);

    // 2. 필드 수정
    setFieldValue('battery_expiry', '2025-06-30');

    // 3. isChanged 플래그 확인
    expect(isChanged).toBe(true);
    expect(buttonColor).toContain('yellow');
  });

  // Phase 2: Summary 동기화
  test('Phase 2: Battery Expiry Summary Sync', () => {
    // 1. Summary 탭으로 이동
    clickTab('summary');

    // 2. 변경된 값 확인
    expect(getSummaryText('battery_expiry')).toBe('2025-06-30');
    expect(getSummaryText('battery_status')).toBe('유효');
    expect(getSummaryField('action_plan')).not.toBeVisible();
  });

  // Phase 3: PDF 생성
  test('Phase 3: Battery Expiry in PDF', async () => {
    // 1. PDF 생성
    const pdf = await generatePDF();

    // 2. PDF 내용 확인
    const pdfText = await extractText(pdf);
    expect(pdfText).toContain('2025-06-30');
    expect(pdfText).toContain('유효');
  });

  // Phase 4: AdminFullView 동기화
  test('Phase 4: AdminFullView Update', async () => {
    // 1. AdminFullView에서 데이터 재조회
    await waitFor(30000); // 30초 대기

    // 2. 목록에서 업데이트 확인
    expect(getListItem('battery_expiry')).toBe('2025-06-30');

    // 3. 모달에서 확인
    openModal('inspection_detail');
    expect(getModalText('battery_expiry')).toBe('2025-06-30');
  });

  // Phase 5: 통계 업데이트
  test('Phase 5: Statistics Update', async () => {
    // 1. 통계 페이지 방문
    navigate('/admin/statistics');

    // 2. 해당 지표 확인
    const batteryStats = getStatistic('battery_valid_devices');
    expect(batteryStats).toBe(expectedValue);
  });
});
```

---

## 마지막 체크리스트

배포 전 반드시 확인:

- [ ] 25개 항목 모두에 대해 Phase 1-5 검증 완료
- [ ] Priority 1 (배터리, GPS, 체크리스트) 항목 특히 주의
- [ ] 각 Phase에서 데이터 일관성 확인
- [ ] PDF, AdminFullView, 통계 메뉴 모두 최신 데이터 반영 확인
- [ ] 성능 (응답시간, 갱신 지연) 기준 충족 확인
- [ ] 한글 문자 인코딩 정상 확인
- [ ] 브라우저 캐시 무효화 후 재검증

---

**마지막 업데이트**: 2025년 11월 9일 (전체 재작성)
**버전**: 2.0 (모든 25개 항목 포함)
**상태**: ✅ 실제 검증 항목만 포함 (상상의 항목 제거)
**관련 Skills**: inspection-ui-ux-consistency, inspection-flow-testing, pre-deployment-validation
