# Inspection Data Propagation Consistency Skill

## 목적

점검(Inspection) 단계에서 사용자가 필드를 수정할 때, 그 변경사항이 **모든 화면과 보고서에 일관되게 반영**되는지 검증합니다.

**핵심 원칙**: 한 곳에서 수정된 데이터는 다음 모든 곳에서 최신 상태로 표시되어야 합니다:
1. 현재 Step의 UI (버튼 색상 변경)
2. 미리보기 화면 (Summary Step)
3. PDF 보고서
4. 관리자 대시보드 (AdminFullView)
5. 점검효과/통계 메뉴
6. API 응답

---

## 검증 범위

### Phase 1: 필드 수정 감지 및 상태 변화

#### 1.1 수정 감지 메커니즘
```
Step 입력 → 필드 변경 감지 → isChanged 플래그 활성화 → 버튼 색상 변경
```

**검증 항목**:
- [ ] 각 Step에서 필드 수정 시 `isChanged` 플래그 정상 작동
- [ ] 필드 값 변경 감지 (debounce 없이 즉시 감지)
- [ ] 원본값으로 복구 시 `isChanged` 플래그 해제

**예시: DeviceInfoStep에서 배터리 유효기간 수정**
```typescript
// 검증 항목
originalBatteryExpiry: "2025-03-31"  // 원본값
currentBatteryExpiry: "2025-06-30"   // 수정된 값

isChanged: false  // ❌ (변경되었으므로 true여야 함)
isChanged: true   // ✅ (정상)

// 원본값으로 복구
currentBatteryExpiry: "2025-03-31"
isChanged: false  // ✅ (정상: 원본값 복구 시 플래그 해제)
```

#### 1.2 버튼 색상 상태 변화
```
기본 상태 (회색) → 수정 중 (노란색) → 저장/일치 (초록색/파란색)
```

**검증 항목**:
- [ ] 기본 상태: 회색 배경 + "저장" 또는 "일치" 버튼
- [ ] 수정 중: 노란색 테두리 + "변경사항 저장" 버튼
- [ ] 저장 후: 초록색 배경 + "저장됨" 표시
- [ ] 불일치 상태: 회색 배경 + "내용 수정" 버튼

**색상 규칙**:
```
회색 (기본)        → bg-gray-600, border-gray-500
노란색 (수정중)    → border-yellow-500, bg-yellow-600/10
초록색 (일치)      → bg-green-600/10, border-green-600/50
빨간색 (만료)      → border-red-500/50, bg-red-500/10
```

**검증 코드 예시**:
```typescript
// DeviceInfoStep.tsx line 467-471
{isEdited && (
  <div className="w-full rounded-lg px-3 py-2
    bg-yellow-600/10 border border-yellow-600/50">
    수정 중
  </div>
)}
```

---

### Phase 2: 미리보기 화면 동기화 (InspectionSummaryStep)

#### 2.1 요약 데이터 실시간 업데이트
```
Step 필드 수정 → Zustand store 업데이트 → Summary 화면 리렌더링
```

**검증 항목**:
- [ ] BasicInfoStep에서 주소 수정 → Summary에서 변경된 주소 표시
- [ ] DeviceInfoStep에서 배터리 변경 → Summary에서 변경된 배터리 정보 표시
- [ ] StorageChecklistStep에서 체크리스트 수정 → Summary에서 변경된 체크리스트 표시
- [ ] ManagerEducationStep에서 교육 정보 수정 → Summary에서 변경된 정보 표시

**예시: 배터리 유효기간 수정 흐름**
```
1. Step 2 (DeviceInfoStep)에서 배터리 유효기간 "2025-03-31" → "2025-06-30"
   ✅ 필드 변경 감지
   ✅ 노란색 테두리로 변경
   ✅ "변경사항 저장" 버튼 활성화

2. Step 5 (InspectionSummaryStep) 미리보기 탭
   ✅ 배터리 유효기간 "2025-03-31" → "2025-06-30" 표시
   ✅ 조치계획 필드 자동 업데이트 (만료 여부 확인)

3. 뒤로 가서 Step 2로 돌아가기
   ✅ 입력값 보존 "2025-06-30" 유지
```

#### 2.2 계산 필드 자동 업데이트
```
수정된 필드 → 의존성 필드 자동 계산 → Summary 업데이트
```

**검증 항목**:
- [ ] 배터리 유효기간 변경 → 만료 여부 자동 판정
- [ ] 배터리 만료 여부 변경 → 조치계획 필드 활성화/비활성화
- [ ] 포장지 외관 변경 → 체크리스트 자동 점수 계산
- [ ] 설치 위치 변경 → 지도 마커 자동 업데이트

---

### Phase 3: PDF 보고서 데이터 반영

#### 3.1 PDF 생성 시 최신 데이터 포함
```
점검 완료 → PDF 생성 요청 → 최신 필드값 → PDF 다운로드
```

**검증 항목**:
- [ ] PDF에 포함될 모든 필드가 최신 데이터 반영
- [ ] 수정되지 않은 필드는 원본값 표시
- [ ] 수정된 필드는 변경된 값 표시
- [ ] 계산 필드(점검 결과 등)는 최신 계산값 표시

**예시: 배터리 관련 필드**
```
원본 보고서:
- 배터리 유효기간: 2025-03-31
- 상태: 만료
- 조치계획: 기타 (수동 입력: "배터리 교체 필요")

수정 후 보고서:
- 배터리 유효기간: 2025-06-30  ✅ 변경된 값
- 상태: 유효  ✅ 자동 재계산
- 조치계획: (비움) ✅ 만료 아니므로 필드 숨김
```

#### 3.2 PDF 생성 API 검증
```
PATCH /api/inspections/[id]/pdf-report
또는
GET /api/inspections/[id]/report/pdf
```

**검증 항목**:
- [ ] API가 최신 데이터베이스 값 조회
- [ ] 응답 시간 < 2초 (대용량 데이터 주의)
- [ ] 특수문자 인코딩 정상 (한글 등)

---

### Phase 4: 관리자 대시보드 동기화 (AdminFullView)

#### 4.1 점검 이력 목록 업데이트
```
점검 저장 → DB 반영 → AdminFullView 자동 갱신 (30초 주기)
```

**검증 항목**:
- [ ] 점검 목록에서 최신 상태 표시
- [ ] 장비 정보 최신화
- [ ] 마지막 수정 시간 업데이트
- [ ] 점검 상태 아이콘 업데이트 (완료/진행중 등)

**예시**:
```
AdminFullView 목록에서:
- Equipment: "성서동서화성타운"
- 배터리: "2025-03-31 (만료)" → "2025-06-30 (유효)" ✅
- 마지막 수정: "2025-11-09 14:23:15" (현재 시간)
- 점검 상태: "수정중" → "완료" (저장 시)
```

#### 4.2 상세 보기 모달 동기화
```
AdminFullView에서 상세 보기 클릭 → InspectionHistoryModal
```

**검증 항목**:
- [ ] 모달 표시 시 최신 데이터 조회
- [ ] 4단계 탭 모두에서 최신 데이터 표시
- [ ] 닫고 다시 열 때 최신 데이터 재조회

---

### Phase 5: 점검효과/통계 메뉴 동기화

#### 5.1 통계 데이터 최신화
```
점검 완료 → 통계 계산 → 대시보드/그래프 업데이트
```

**검증 항목**:
- [ ] 완료된 점검 수 자동 증가
- [ ] 지역별 점검률 업데이트
- [ ] 장비 상태별 통계 업데이트
- [ ] 최근 30일 추이 그래프 업데이트

**예시 통계 필드**:
```
변경 전:
- 총 점검: 100건
- 완료: 95건
- 진행중: 5건

변경 후 (새 점검 완료):
- 총 점검: 101건  ✅
- 완료: 96건  ✅
- 진행중: 4건 (또는 5건, 상태에 따라)
```

#### 5.2 성과 메뉴 데이터 일관성
```
app/performance 또는 app/admin/statistics
```

**검증 항목**:
- [ ] 주간/월간 점검 건수 정확성
- [ ] 장비별 점검 이력 포함
- [ ] 미처리 점검 카운트 정확성
- [ ] 응급의료센터별 성과 집계 정확성

---

## 자동 검증 체크리스트

### 각 Step별 필드 수정 테스트

#### Step 1: BasicInfoStep
```
필드 변경 시나리오:
1. 주소 변경: "서울 강서구" → "부산 중구"
   ✅ isChanged = true
   ✅ 버튼 색상 노란색
   ✅ Summary에 반영
   ✅ PDF에 반영

2. 접근성 변경: "도보 가능" → "차량만 가능"
   ✅ Summary의 접근성 정보 업데이트
   ✅ 지도 마커 설명 업데이트

3. 위치 좌표 변경 (지도에서 드래그)
   ✅ 로드뷰 업데이트
   ✅ GPS 좌표 저장
   ✅ Summary의 지도 마커 위치 업데이트
```

#### Step 2: DeviceInfoStep
```
필드 변경 시나리오:
1. 배터리 유효기간 변경
   ✅ isChanged = true
   ✅ 만료 여부 자동 판정
   ✅ 조치계획 필드 활성화/비활성화
   ✅ Summary의 배터리 정보 업데이트

2. 사진 업로드
   ✅ 이미지 프리뷰 표시
   ✅ Summary의 사진 섬네일 업데이트
   ✅ PDF의 사진 포함

3. 문제 사항 입력
   ✅ isChanged 감지
   ✅ Summary의 문제 목록 업데이트
```

#### Step 3: StorageChecklistStep
```
필드 변경 시나리오:
1. 보관함 체크리스트 체크/언체크
   ✅ 점수 자동 계산
   ✅ Summary의 체크리스트 통계 업데이트
   ✅ PDF의 체크리스트 반영

2. 안내표지 확인
   ✅ isChanged 감지
   ✅ 색상 변경 (회색→노란색)
```

#### Step 4: ManagerEducationStep
```
필드 변경 시나리오:
1. 교육 이수 여부 변경
   ✅ isChanged 감지
   ✅ Summary의 교육 정보 업데이트

2. 미이수 사유 입력
   ✅ isChanged 감지
   ✅ 사유 텍스트 Summary에 표시
```

---

## 검증 도구 및 자동화

### 1. 데이터 흐름 추적 (Data Flow Tracing)
```bash
# Step에서 필드 수정 → Zustand store → UI 컴포넌트까지의 흐름 추적
# 검증 포인트:
# 1. 필드 값 변경 감지
# 2. Store 업데이트
# 3. Summary 컴포넌트 리렌더링
# 4. API 저장 요청
# 5. DB 저장 확인
```

### 2. API 응답 검증
```bash
# PATCH /api/inspections/[id]의 응답 값이
# 다음 GET /api/inspections/[id] 요청과 일치하는지 확인

1. 저장 API 호출 → 응답값 저장
2. 조회 API 호출 → 반환값과 비교
3. 불일치 시 데이터 일관성 문제 감지
```

### 3. PDF 생성 검증
```bash
# PDF 생성 직후 포함된 데이터가 DB의 최신값과 일치하는지 확인

1. 점검 완료 → PDF 생성 요청
2. PDF 다운로드
3. PDF 내용 파싱 (텍스트 추출)
4. DB 값과 비교
5. 불일치 시 보고서 오류 감지
```

### 4. 통계 계산 검증
```bash
# 점검 데이터 변경 후 통계가 정확히 업데이트되는지 확인

1. 변경 전 통계 스냅샷
2. 점검 저장
3. 변경 후 통계 재계산
4. 이론적 값과 비교
```

---

## 검증 결과 해석

### 성공 상태 (Green)
```
PASS: Data Propagation Consistency
- BasicInfoStep: 모든 필드 수정 시 Summary 동기화 ✅
- DeviceInfoStep: 배터리/사진 변경 시 전체 반영 ✅
- StorageChecklistStep: 체크리스트 점수 계산 정확 ✅
- ManagerEducationStep: 교육 정보 동기화 ✅
- PDF 보고서: 최신 데이터 포함 ✅
- AdminFullView: 30초 이내 데이터 갱신 ✅
- 통계 메뉴: 실시간 계산 정확 ✅
```

### 경고 상태 (Yellow)
```
WARNING: Data Propagation Delay
- Summary 업데이트 지연: 3초 이상 (권장: 500ms 이내)
  → 원인: 계산 작업 과중 또는 렌더링 최적화 부족
  → 해결: useMemo, useCallback, React.memo 검토

- PDF 생성 시간: 5초 이상
  → 원인: 이미지 처리 또는 PDF 라이브러리 성능
  → 해결: 이미지 크기 최적화, 비동기 처리 검토

- AdminFullView 갱신: 30초 초과
  → 원인: API 응답 느림 또는 데이터 과다
  → 해결: 페이지네이션, 캐싱 강화
```

### 실패 상태 (Red)
```
FAIL: Data Not Propagating
- Summary에서 변경된 필드값 미반영
  → 원인: Zustand store 업데이트 누락
  → 해결: handleChange 함수 검토, 의존성 배열 확인

- PDF에서 최신 데이터 미포함
  → 원인: PDF 생성 시 캐시된 데이터 사용
  → 해결: PDF 생성 전 DB 재조회 강제

- 통계 메뉴에서 오래된 데이터 표시
  → 원인: 캐시 만료 시간 과도 또는 업데이트 로직 없음
  → 해결: 캐시 무효화 메커니즘 추가, 실시간 계산

- 버튼 색상이 변경되지 않음
  → 원인: isChanged 플래그 업데이트 실패
  → 해결: 필드 비교 로직 검토
```

---

## 실행 방법

### 1. 수동 검증 (Testing Checklist)
```
각 Step별로 다음을 반복:
1. 특정 필드 수정
2. 버튼 색상 변경 확인
3. Summary 화면으로 전환
4. 변경된 데이터 표시 확인
5. 저장 버튼 클릭
6. AdminFullView에서 업데이트 확인
7. PDF 다운로드 후 내용 확인
```

### 2. 자동 검증 (Automated Testing)
```typescript
// 예시: Cypress 테스트
describe('Data Propagation', () => {
  it('should update battery expiry in summary when changed', () => {
    // 1. Step 2 (DeviceInfoStep)에서 배터리 변경
    cy.get('[data-testid=battery-expiry-input]').clear().type('2025-06-30');

    // 2. 버튼 색상 확인
    cy.get('[data-testid=save-button]').should('have.class', 'border-yellow-500');

    // 3. Summary 탭으로 이동
    cy.get('[data-testid=summary-tab]').click();

    // 4. Summary에 변경된 값 표시 확인
    cy.get('[data-testid=battery-display]').should('contain', '2025-06-30');

    // 5. 저장
    cy.get('[data-testid=save-button]').click();
    cy.wait('@patchInspection');

    // 6. AdminFullView에서 확인
    cy.visit('/admin/dashboard');
    cy.get('[data-testid=equipment-battery]').should('contain', '2025-06-30');
  });
});
```

---

## 주요 검증 지점

### 1. 필드 변경 감지
**파일**: `lib/state/inspection-session-store.ts`

```typescript
// 검증 포인트
const isChanged = compareObjects(
  lastSavedStepData[currentStep],
  currentStepData[currentStep]
);
```

### 2. UI 상태 변화
**파일**: `components/inspection/steps/*.tsx`

```typescript
// 검증 포인트
{isChanged && (
  <button className="border-yellow-500 ...">
    변경사항 저장
  </button>
)}
```

### 3. Summary 동기화
**파일**: `components/inspection/steps/InspectionSummaryStep.tsx`

```typescript
// 검증 포인트
{sessionData?.currentStepData[2]?.batteryExpiry && (
  <div>{sessionData.currentStepData[2].batteryExpiry}</div>
)}
```

### 4. API 저장
**파일**: `app/api/inspections/[id]/route.ts`

```typescript
// 검증 포인트
await db.inspection.update({
  where: { id: inspectionId },
  data: updatedData
});
```

### 5. PDF 생성
**파일**: `lib/pdf/generate-report.ts`

```typescript
// 검증 포인트
const latestData = await db.inspection.findUnique({
  where: { id: inspectionId }
});

// latestData를 PDF에 포함
```

---

## 자주 하는 실수

### 1. 캐시 만료 시간 과도
**문제**: 통계 메뉴에서 오래된 데이터 표시
```typescript
// ❌ 캐시 시간 과도 (12시간)
const data = useMemoCache(
  () => fetchStatistics(),
  { ttl: 12 * 60 * 60 * 1000 }
);

// ✅ 적절한 캐시 시간 (5분)
const data = useMemoCache(
  () => fetchStatistics(),
  { ttl: 5 * 60 * 1000 }
);
```

### 2. 필드 비교 로직 오류
**문제**: isChanged 플래그가 정확하지 않음
```typescript
// ❌ 얕은 비교 (객체는 항상 다름)
if (currentData !== originalData) {
  setIsChanged(true);
}

// ✅ 깊은 비교
if (!deepEqual(currentData, originalData)) {
  setIsChanged(true);
}
```

### 3. Summary 컴포넌트 리렌더링 실패
**문제**: Summary에서 변경된 데이터 미표시
```typescript
// ❌ 의존성 배열 누락
useEffect(() => {
  setDisplayData(sessionData);
}, []); // ← 의존성 누락

// ✅ 올바른 의존성
useEffect(() => {
  setDisplayData(sessionData);
}, [sessionData]);
```

### 4. PDF 생성 시 캐시된 데이터 사용
**문제**: PDF에서 구 버전 데이터 표시
```typescript
// ❌ 캐시에서 조회
const data = cache.get(`inspection-${id}`);
generatePdf(data);

// ✅ DB에서 직접 조회
const data = await db.inspection.findUnique({ where: { id } });
generatePdf(data);
```

---

## 관련 파일

- **상태 관리**: `lib/state/inspection-session-store.ts`
- **Step 컴포넌트**: `components/inspection/steps/*.tsx`
- **Summary**: `components/inspection/steps/InspectionSummaryStep.tsx`
- **API 저장**: `app/api/inspections/[id]/route.ts`
- **PDF 생성**: `lib/pdf/generate-report.ts`
- **관리자 대시보드**: `components/inspection/AdminFullView.tsx`
- **통계**: `app/performance/page.tsx` 또는 `app/admin/statistics/page.tsx`

---

**마지막 업데이트**: 2025년 11월 9일
**버전**: 1.0
**관련 Skills**: inspection-ui-ux-consistency, inspection-flow-testing, pre-deployment-validation
