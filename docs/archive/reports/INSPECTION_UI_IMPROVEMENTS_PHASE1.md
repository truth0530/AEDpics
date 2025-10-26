# 점검 화면 개선 작업 - Phase 1

**날짜**: 2025-10-15
**상태**: Phase 1 완료, Phase 2 준비 중
**작성자**: AI Assistant

---

## 📋 개요

현장 점검 화면의 사용성을 개선하기 위한 대규모 UI/UX 개선 작업입니다.
Phase 1에서는 즉시 개선 가능한 항목들을 완료했으며, Phase 2에서는 대규모 기능 추가가 예정되어 있습니다.

---

## ✅ Phase 1: 완료된 작업

### 1. 제조번호 중복 표현 개선

**문제점**: "제조번호 중복(243개)" - 어느 지역/기관인지 불명확

**해결 방법**:
- API 개선: 중복 장비의 지역 또는 기관명 정보 추가 반환
- UI 개선: "제조번호 중복(서울 등 243개)" 형태로 표시

**변경 파일**:
1. [app/api/aed-data/check-duplicate-serial/route.ts](../../app/api/aed-data/check-duplicate-serial/route.ts)
   ```typescript
   // 변경 전
   return NextResponse.json({
     serial_number: serialNumber,
     count: count ?? 0,
     is_duplicate: isDuplicate,
   });

   // 변경 후
   const locationInfo = isDuplicate && data?.[0]
     ? (data[0].region || data[0].installation_institution || '')
     : '';

   return NextResponse.json({
     serial_number: serialNumber,
     count: count,
     is_duplicate: isDuplicate,
     location_info: locationInfo, // 🆕 지역 또는 기관명
   });
   ```

2. [components/inspection/ValidationSummary.tsx](../../components/inspection/ValidationSummary.tsx)
   ```typescript
   // 변경 전
   ⚠️ 제조번호 중복 ({duplicateInfo.count}개)

   // 변경 후
   const locationLabel = duplicateInfo.locationInfo
     ? `${duplicateInfo.locationInfo} 등 `
     : '';
   ⚠️ 제조번호 중복({locationLabel}{duplicateInfo.count}개)
   ```

**효과**:
- ✅ 점검자가 중복 장비의 위치를 즉시 파악 가능
- ✅ 현장에서 빠른 의사결정 지원

---

### 2. 주소/설치위치 수정 버튼 오류 수정

**문제점**: "수정" 버튼 클릭 시 중분류/소분류가 표시되는 버그

**원인 분석**:
- FIELDS 배열 인덱스 오류
- 주소: FIELDS[2], 설치위치: FIELDS[3]
- 하지만 코드에서는 FIELDS[5], FIELDS[6] 사용 (중분류/소분류)

**FIELDS 배열 구조** (라인 15-23):
```typescript
const FIELDS = [
  { key: 'manager', label: '관리책임자' },              // [0]
  { key: 'contact_info', label: '담당자 연락처' },      // [1]
  { key: 'address', label: '주소' },                    // [2] ⬅ 주소
  { key: 'installation_position', label: '설치위치' },  // [3] ⬅ 설치위치
  { key: 'category_1', label: '대분류' },               // [4]
  { key: 'category_2', label: '중분류' },               // [5] ❌ 잘못 사용됨
  { key: 'category_3', label: '소분류' },               // [6] ❌ 잘못 사용됨
];
```

**변경 파일**: [components/inspection/steps/BasicInfoStep.tsx](../../components/inspection/steps/BasicInfoStep.tsx)

**수정 내용**:
- 라인 293-294: 필드 인덱스 수정
  ```typescript
  // 변경 전
  const addressField = FIELDS[5]; // ❌ 중분류
  const positionField = FIELDS[6]; // ❌ 소분류

  // 변경 후
  const addressField = FIELDS[2]; // ✅ 주소
  const positionField = FIELDS[3]; // ✅ 설치위치
  ```

- 라인 631-634: 렌더링 부분 수정
  ```typescript
  // 변경 전
  {renderField(FIELDS[5], true)} {/* ❌ 중분류 */}
  {renderField(FIELDS[6], true)} {/* ❌ 소분류 */}

  // 변경 후
  {renderField(FIELDS[2], true)} {/* ✅ 주소 */}
  {renderField(FIELDS[3], true)} {/* ✅ 설치위치 */}
  ```

**효과**:
- ✅ 수정 모드에서 주소와 설치위치만 정확히 표시
- ✅ 중분류/소분류가 잘못 표시되는 버그 해결

---

### 3. 사진 촬영/업로드 공통 컴포넌트 생성

**목적**: 재사용 가능한 사진 기능 컴포넌트 개발

**파일**: [components/inspection/PhotoCaptureInput.tsx](../../components/inspection/PhotoCaptureInput.tsx)

**기능**:
- ✅ 카메라 촬영 (모바일 후면 카메라 우선)
- ✅ 파일 업로드 (이미지 파일만)
- ✅ 사진 미리보기
- ✅ 사진 삭제
- ✅ Base64 인코딩으로 데이터 반환

**사용 예시**:
```typescript
import { PhotoCaptureInput } from '@/components/inspection/PhotoCaptureInput';

<PhotoCaptureInput
  label="제조번호 사진"
  value={deviceInfo.serial_number_photo}
  onChange={(photo) => handleChange('serial_number_photo', photo)}
  placeholder="제조번호를 촬영하거나 업로드하세요"
/>
```

**Props**:
- `label`: 필드 라벨
- `value`: 현재 사진 데이터 (Base64 string)
- `onChange`: 사진 변경 핸들러
- `placeholder`: 안내 텍스트

**UI 구성**:
1. **초기 상태**: 카메라 촬영 / 파일 선택 버튼
2. **촬영 모드**: 비디오 프리뷰 + 촬영/취소 버튼
3. **사진 있음**: 미리보기 + 삭제 버튼

---

## 🔄 Phase 2: 예정된 작업

### 대규모 기능 추가 (예상 1000+ 라인)

#### 1. 2단계: 장비 정보에 사진 기능 추가
**파일**: [components/inspection/steps/DeviceInfoStep.tsx](../../components/inspection/steps/DeviceInfoStep.tsx) (695줄)

**추가 항목**:
- 제조번호 사진
- 배터리 유효기간 사진

**작업 내용**:
- PhotoCaptureInput 컴포넌트 통합
- stepData에 사진 필드 추가
- 초기화 로직 업데이트
- 저장/복원 로직 수정

---

#### 2. 3단계: 보관함 점검에 사진 기능 추가
**파일**: [components/inspection/steps/StorageChecklistStep.tsx](../../components/inspection/steps/StorageChecklistStep.tsx)

**추가 항목**:
- 보관함 사진
- 안내표지 사진

**작업 내용**:
- PhotoCaptureInput 컴포넌트 통합
- 체크리스트 아래에 사진 섹션 배치
- stepData 구조 확장

---

#### 3. 4단계: 데이터 검증 → 점검 요약으로 변경
**파일**: [components/inspection/steps/DataValidationStep.tsx](../../components/inspection/steps/DataValidationStep.tsx)
**새 파일**: `components/inspection/steps/InspectionSummaryStep.tsx`

**목적**:
- 1-3단계의 모든 데이터를 자동 수집 및 분석
- 점검자가 현장 권고/사무실 조치를 판단할 수 있도록 요약

**기능 설계**:

1. **일치 항목 요약**
   - 전체 일치 확인된 필드 목록
   - 예: "기본 정보 5개 항목 일치 확인"

2. **수정 항목 요약**
   - 수정된 필드 목록 (원본 → 수정값)
   - 수정 사유 표시
   - 예: "주소 수정: 서울시 중구... → 서울시 종로구..."

3. **첨부 사진 요약**
   - 제조번호 사진 ✅
   - 배터리 유효기간 사진 ✅
   - 보관함 사진 ✅
   - 안내표지 사진 ✅

4. **판단 지원 UI**
   ```
   ┌─────────────────────────────────────┐
   │ 📊 점검 요약                         │
   ├─────────────────────────────────────┤
   │ ✅ 일치 항목: 12개                   │
   │ ✏️ 수정 항목: 2개                    │
   │ 📸 첨부 사진: 4개                    │
   ├─────────────────────────────────────┤
   │ 💡 권장 조치                         │
   │ □ 현장에서 즉시 처리 가능            │
   │ ☑ 사무실에서 데이터 검토 필요        │
   └─────────────────────────────────────┘
   ```

**데이터 수집 로직**:
```typescript
// 1-3단계 stepData에서 수집
const basicInfo = stepData.basicInfo;
const deviceInfo = stepData.deviceInfo;
const storageInfo = stepData.storageChecklist;

// 분류
const matchedItems = [];
const modifiedItems = [];
const attachedPhotos = [];

// 분석 및 카테고리 분류
// ...
```

---

#### 4. 5단계 제거: PhotoDocumentationStep 삭제
**파일**:
- `components/inspection/steps/PhotoDocumentationStep.tsx` (삭제)
- [components/inspection/InspectionWorkflow.tsx](../../components/inspection/InspectionWorkflow.tsx) (수정)

**변경 내용**:
```typescript
// 변경 전 (5단계)
const STEP_COMPONENTS = [
  BasicInfoStep,        // 1단계
  DeviceInfoStep,       // 2단계
  StorageChecklistStep, // 3단계
  DataValidationStep,   // 4단계
  PhotoDocumentationStep, // 5단계 ❌
];

// 변경 후 (4단계)
const STEP_COMPONENTS = [
  BasicInfoStep,           // 1단계
  DeviceInfoStep,          // 2단계 (사진 통합)
  StorageChecklistStep,    // 3단계 (사진 통합)
  InspectionSummaryStep,   // 4단계 (요약 기능)
];
```

**단계 타이틀 변경**:
```typescript
// 변경 전
const STEP_TITLES = [
  '기본 정보 확인',
  '장비 및 소모품 점검',
  '보관함 점검',
  '데이터 검증',    // ❌
  '사진 및 문서화',  // ❌
];

// 변경 후
const STEP_TITLES = [
  '기본 정보 확인',
  '장비 및 소모품 점검',
  '보관함 점검',
  '점검 요약',      // ✅ 새로운 4단계
];
```

---

## 📊 데이터 구조 변경 (Phase 2)

### stepData 확장

```typescript
interface InspectionStepData {
  basicInfo: {
    // 기존 필드들...
    // (변경 없음)
  };

  deviceInfo: {
    // 기존 필드들...
    serial_number_photo?: string;        // 🆕 제조번호 사진
    battery_expiry_photo?: string;       // 🆕 배터리 사진
  };

  storageChecklist: {
    // 기존 체크리스트...
    storage_box_photo?: string;          // 🆕 보관함 사진
    signage_photo?: string;              // 🆕 안내표지 사진
  };

  // 4단계는 자동 생성되므로 별도 저장 불필요
}
```

---

## 🔧 기술적 고려사항

### 1. 사진 저장 방식
- **임시 저장**: Base64 인코딩하여 세션 데이터에 저장
- **최종 저장**: 점검 완료 시 Supabase Storage에 업로드
- **파일명 규칙**: `{session_id}_{field_name}_{timestamp}.jpg`

### 2. 성능 최적화
- 사진 압축: JPEG quality 0.8
- 최대 해상도: 1920x1080
- 프리뷰 최적화: CSS max-width 사용

### 3. 모바일 대응
- `facingMode: 'environment'` - 후면 카메라 우선
- `playsInline` - iOS Safari 인라인 재생
- 터치 친화적 버튼 크기

---

## 📝 API 변경 사항 (Phase 2 예정)

### 점검 완료 API 확장

**Endpoint**: `POST /api/inspections/sessions/{id}/complete`

**요청 본문 확장**:
```typescript
{
  // 기존 필드들...
  photos: {
    serial_number?: string,      // Base64 or Storage URL
    battery_expiry?: string,
    storage_box?: string,
    signage?: string,
  }
}
```

**처리 로직**:
1. Base64 사진 데이터 수신
2. Supabase Storage 업로드
3. Public URL 생성
4. `inspection_results` 테이블에 URL 저장

---

## 🧪 테스트 계획 (Phase 2)

### 단위 테스트
- [ ] PhotoCaptureInput 컴포넌트
  - [ ] 카메라 접근 권한 거부 시나리오
  - [ ] 파일 타입 검증
  - [ ] Base64 인코딩 정확성

### 통합 테스트
- [ ] 전체 점검 플로우
  - [ ] 사진 촬영 → 저장 → 복원
  - [ ] 여러 단계에서 사진 첨부
  - [ ] 점검 요약에서 사진 표시

### 모바일 테스트
- [ ] iOS Safari
- [ ] Android Chrome
- [ ] 카메라 전환 (전면/후면)
- [ ] 파일 선택 동작

---

## 📈 예상 작업량

| 작업 | 파일 수 | 예상 라인 수 | 소요 시간 |
|------|---------|--------------|-----------|
| Phase 1 완료 | 3 | ~100 | ✅ 완료 |
| 2단계 (DeviceInfoStep) | 1 | ~200 | 2-3시간 |
| 3단계 (StorageChecklistStep) | 1 | ~150 | 1-2시간 |
| 4단계 (InspectionSummaryStep) | 1 (신규) | ~300 | 3-4시간 |
| 5단계 제거 및 정리 | 2 | ~50 | 1시간 |
| 테스트 및 버그 수정 | - | - | 2-3시간 |
| **총계** | **8** | **~800** | **9-15시간** |

---

## 🚀 배포 전 체크리스트

### Phase 1 (현재)
- [x] API 업데이트 (중복 체크)
- [x] UI 개선 (중복 표현)
- [x] 버그 수정 (주소/설치위치)
- [x] 공통 컴포넌트 생성
- [x] 문서 작성
- [ ] Git 커밋 및 푸시

### Phase 2 (예정)
- [ ] 2-3단계 사진 기능 통합
- [ ] 4단계 점검 요약 구현
- [ ] 5단계 제거
- [ ] API 사진 저장 로직
- [ ] 모바일 테스트
- [ ] 사용자 가이드 작성

---

## 🔗 관련 문서

- [점검 세션 Priority 1, 2 구현](./IMPLEMENTATION_SUMMARY.md)
- [점검 워크플로우 분석](./INSPECTION_WORKFLOW_REVIEW.md)
- [점검 워크플로우 구현](./INSPECTION_WORKFLOW_IMPLEMENTATION.md)

---

## 📞 문의 및 피드백

Phase 2 작업 진행 전에:
1. Phase 1 작업 검토 필요
2. Phase 2 우선순위 확인 필요
3. 추가 요구사항 확인 필요

---

**작성일**: 2025-10-15
**최종 수정**: 2025-10-15
**다음 업데이트**: Phase 2 완료 후
