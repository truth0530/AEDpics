# AED 점검 기능 구현 상태 종합 검토 보고서

## 1. 용어 통일 검토 (지역응급의료센터 vs 응급의료지원센터)

### 현황
공식 사용자 역할 정의 (`lib/utils/user-roles.ts`):
```
regional_emergency_center_admin: '시도응급의료지원센터'
emergency_center_admin: '중앙응급의료센터'
```

### 사용 위치
- `lib/utils/user-roles.ts` (단일 진실 소스): **시도응급의료지원센터** (권장)
- 대부분의 UI 컴포넌트: 일관되게 위 정의를 따르고 있음

### 상태: 구현됨
- 권한 체계 파일에서 명확하게 정의됨
- 다른 파일들이 이를 참조하여 일관성 유지
- "응급의료지원센터"로 통일됨

---

## 2. 점검 기능 구현 현황

### 2.1 점검불가(Unable to Inspect) 기능

**위치**: `app/api/inspections/mark-unavailable/route.ts`

**상태: 부분 구현** (구현되었으나 UI 통합 미완성)

**구현 내용**:
- POST: 장비를 '점검불가'로 표시 (status='unavailable')
- DELETE: '점검불가' 상태 취소 (status='pending' 복귀)
- 사유 입력: 'disposed' | 'broken' | 'lost' | 'other'
- 기타 선택 시 상세 내용 필수

**데이터 저장소**: `inspection_assignments` 테이블
```
status: 'unavailable'
notes: '${reason}: ${note}'
```

**조회 기능**: `app/api/inspections/unavailable/route.ts`
- GET: 최근 N시간의 '점검불가' 장비 목록 조회
- `getUnavailableAssignments()` (lib/inspections/session-utils.ts)로 래핑됨

**UI 통합 현황**:
- AdminFullView에서 `unavailableAssignments` Set으로 추적 중
- 하지만 '점검불가' 상태로 변경하는 UI 버튼 없음
- 상태 표시는 있지만 사용자가 이 상태를 입력할 방법 없음

---

### 2.2 임시저장(Draft/Pending) 점검 저장 기능

**위치**: `app/api/inspections/drafts/route.ts`

**상태: 구현됨** (API + UI 모두 완성)

**구현 내용**:
- 점검 세션을 paused/draft 상태로 저장
- `inspection_sessions` 테이블의 status='paused'로 저장
- 데이터: `step_data` (JSON)에 모든 점검 항목 저장

**조회 기능**:
- `getDraftSessions()` (lib/inspections/session-utils.ts)
- AdminFullView에서 '임시저장 탭' 표시 및 관리

**UI 통합**: 완전함
- AdminFullView의 'drafts' 탭에서 임시저장 세션 표시
- 삭제 기능 있음
- 재개 기능 있음

---

### 2.3 점검 권한 검증 로직

**위치**: `lib/inspections/permissions.ts`

**상태: 구현됨** (완전한 권한 기반 접근 제어)

**권한 체계**:
| 역할 | 조회 | 수정 | 삭제 | 비고 |
|------|------|------|------|------|
| master | O | O | O | 모든 권한 |
| emergency_center_admin | O | O | X | 전국 수정 가능 |
| regional_emergency_center_admin | O | O | X | 전국 수정 가능 |
| ministry_admin | O | X | X | 읽기 전용 |
| regional_admin | O | X | X | 읽기 전용 |
| local_admin | O | O(관할지역) | X | 관할 지역만 수정 가능 |
| temporary_inspector | O | O(본인) | X | 본인 점검만 수정 가능 |

**구현 함수**:
- `checkInspectionPermission()`: 권한 체크
- `canEditInspection()`: 수정 가능 여부
- `canDeleteInspection()`: 삭제 가능 여부 (master만)
- `getInspectionActionButtons()`: 버튼 표시 여부 결정

---

### 2.4 점검 이력 표시 및 관리

**위치**: `components/inspection/AdminFullView.tsx`, `components/inspection/InspectionHistoryModal.tsx`

**상태: 구현됨** (완전 구현)

**조회 기능**:
- `getInspectionHistory(equipmentSerial, hoursAgo)`: 특정 장비의 최근 점검 이력
- AdminFullView의 '점검진행목록' 탭에서 표시
- 최근 30일 이력 조회

**상세 보기**:
- InspectionHistoryModal: 4단계 탭 구조
  1. 기본정보 (BasicInfoStep)
  2. 장비정보 (DeviceInfoStep)
  3. 보관함 (StorageChecklistStep)
  4. 점검요약 (InspectionSummaryStep)

**수정 기능**:
- `updateInspectionRecord()`: PATCH 요청
- 하지만 현재 UI에서 수정 불가능 (readonly 모드)

**삭제 기능**:
- `deleteInspectionRecord()`: POST 요청 with reason
- AdminFullView에서 DeleteInspectionModal 표시
- master 권한만 삭제 가능

---

## 3. 점검 폼 필드 검토

### 3.1 소모품(Consumable) 유효기간 관련 필드

**위치**: `components/inspection/steps/DeviceInfoStep.tsx`

**상태: 구현됨**

**필드 정의**:
```typescript
const SUPPLY_FIELDS = [
  { key: 'battery_expiry_date', label: '배터리 유효기간', dbKey: 'battery_expiry_date', type: 'date' },
  { key: 'pad_expiry_date', label: '패드 유효기간', dbKey: 'patch_expiry_date', type: 'date' },
  { key: 'manufacturing_date', label: '제조일자', dbKey: 'manufacturing_date', type: 'date' },
];
```

**입력 타입**: HTML date input (`<input type="date">`)

**데이터 저장**: 
- 점검 시점에서 `aed_data` 테이블과 비교
- 변경사항은 `inspection_field_comparisons` 테이블에 기록
- 수정 사유: '현장 확인 후 수정'

---

### 3.2 장비 만료기간 수정사유 필드

**위치**: `components/inspection/steps/DeviceInfoStep.tsx` (lines 137-150)

**상태: 구현됨**

**구현 내용**:
- 사용자가 배터리/패드 유효기간을 수정하면:
  ```
  updateFieldChange(field.key, {
    original: originalValue,
    corrected: currentValue,
    reason: '현장 확인 후 수정',  // 고정된 사유
  })
  ```

**문제점**:
- 사유가 '현장 확인 후 수정'으로 고정됨 (사용자 입력 불가)
- 더 상세한 사유를 입력할 수 없음

---

### 3.3 심폐소생술 안내책자(CPR Manual) 필드

**위치**: `components/inspection/steps/StorageChecklistStep.tsx` (lines 50-58)

**상태: 구현됨** (부분 완성)

**필드 구조**:
```typescript
{
  id: 'cpr_manual',
  label: '심폐소생술 방법 안내책자, 그림 여부',
  options: [
    { value: 'needs_improvement', label: '개선필요' },
    { value: 'booklet', label: '책자 비치' },
    { value: 'poster', label: '포스터형태' },
    { value: 'other', label: '기타' }
  ]
}
```

**입력 타입**: 라디오 버튼/드롭다운

**저장 데이터**:
- `inspection_sessions.step_data.storage.checklist_items.cpr_manual`
- 값: 'needs_improvement' | 'booklet' | 'poster' | 'other'

**엑셀 내보내기 표시**:
```
'심폐소생술 안내': storageInfo.cpr_manual === true ? '있음' : 
                  storageInfo.cpr_manual === false ? '없음' : '-'
```

**문제점**:
- 엑셀에서 boolean으로 변환하려고 하나, 실제 저장 데이터는 string 타입
- 표시 로직과 저장 로직 불일치

---

### 3.4 개선필요(Improvement Needed) 필드

**위치**: `components/inspection/steps/StorageChecklistStep.tsx` (lines 25-68)

**상태: 구현됨**

**구현 내용**:
- 모든 보관함 체크리스트 항목에 '개선필요' 옵션 포함
- '개선필요' 선택 시 상세 내용 입력 가능
  ```
  handleImprovementNoteChange(itemId: string, note: string)
  ```

**저장 구조**:
```
storage.checklist_items: {
  'alarm_functional': 'needs_improvement',
  'instructions_status': 'normal',
  ...
}
storage.improvement_notes: {
  'alarm_functional': '도난경보장치 작동 안 함 - 전지 교체 필요'
}
```

**엑셀 내보내기**:
- 기본 필드만 포함 (상세 내용은 '발견 문제'에 합산 필요)

---

## 4. 출력/내보내기 기능

### 4.1 엑셀 다운로드

**위치**: `components/inspection/AdminFullView.tsx` (lines 309-455)

**상태: 구현됨** (완전 구현)

**기능**:
- 점검 이력 목록을 XLSX 형식으로 변환
- 파일명: `AED_점검기록_YYYY-MM-DD.xlsx`

**포함된 필드** (37개 컬럼):
1. 번호
2. 장비연번
3. 점검일시
4. 점검자
5. 점검자 이메일
6. 설치기관명, 시도, 시군구, 상세주소 (위치 정보)
7. 제조사, 모델명, 시리얼번호 (장비 정보)
8. 배터리/패드 유효기간, 제조일자 (소모품)
9. 장비/표시등/외관 상태 (장치 상태)
10. 배터리/패드/작동 상태 (점검 결과)
11. 보관함 형태, 도난경보장치, 안내문구, 비상연락망, CPR 안내, 유효기간 표시 (보관함 정보)
12. 비고, 발견 문제, 사진 수, GPS 좌표

**열 너비**: 자동 조정 설정 포함

**권한**: 특정 역할만 다운로드 가능 (현재는 제한 없음)

---

### 4.2 PDF 생성/보고서

**현황**: 미구현

**관련 검색 결과**:
- 별도의 PDF 생성 라이브러리 미설치
- HTML to PDF 변환 기능 없음
- 보고서 템플릿 미정의

---

## 5. 데이터베이스 스키마

### 5.1 inspections 테이블 필드

**위치**: `prisma/schema.prisma` (lines 256-286)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | 점검 기록 ID |
| equipment_serial | String | AED 장비 일련번호 (FK) |
| inspector_id | UUID | 점검자 ID |
| inspection_date | Date | 점검 날짜 |
| inspection_type | String | 점검 유형 (월간, 긴급, 정기 등) |
| visual_status | String | 외관 상태 |
| battery_status | String | 배터리 상태 |
| pad_status | String | 패드 상태 |
| operation_status | String | 작동 상태 |
| overall_status | String | 종합 상태 (pass/fail/pending) |
| notes | String | 비고 |
| issues_found | String[] | 발견된 문제 목록 |
| photos | String[] | 사진 URL 배열 |
| inspection_latitude | Decimal | 점검 위도 |
| inspection_longitude | Decimal | 점검 경도 |
| issues | JSON | 이슈 상세 (구조화) |
| original_data | JSON | 원본 데이터 스냅샷 |
| registered_data | JSON | 등록된 데이터 |
| inspected_data | JSON | 점검 시 데이터 |

**indices**: equipment_serial, inspector_id

---

### 5.2 inspection_sessions 테이블

**위치**: `prisma/schema.prisma` (lines 224-254)

| 필드 | 타입 | 설명 |
|------|------|------|
| status | session_status | 'active' \| 'in_progress' \| 'completed' \| 'cancelled' \| 'paused' |
| step_data | JSON | 현재 단계 데이터 (4단계 정보 모두 포함) |
| current_step | Int | 현재 진행 단계 (1-4) |
| started_at | Timestamptz | 시작 시간 |
| paused_at | Timestamptz | 일시정지 시간 |
| completed_at | Timestamptz | 완료 시간 |

---

## 6. 미구현 항목

### 6.1 점검불가 기능의 UI 통합
- API는 완성되었으나 사용자가 이를 선택할 방법 없음
- 필요한 작업:
  - 점검 목록에서 "점검불가" 버튼 추가
  - 모달에서 사유 입력 받기
  - 상태 변경 확인 메시지

### 6.2 점검 기록 수정 UI
- API는 완성되었으나 UI가 readonly 모드만 제공
- InspectionHistoryModal에서 수정 가능하게 하려면:
  - 편집 모드 추가
  - 각 단계별 수정 UI 추가
  - 저장 핸들러 연결

### 6.3 PDF 내보내기
- 완전히 미구현
- 필요 라이브러리: pdfkit, jspdf, puppeteer 등
- 필요한 작업:
  - 레이아웃 템플릿 정의
  - 데이터 매핑
  - API 엔드포인트 생성

### 6.4 사진 스토리지 마이그레이션
- PhotoCaptureInput은 완성됨
- 하지만 NCP Object Storage로의 업로드 미구현
- `lib/utils/photo-upload.ts` 함수 구현 필요

---

## 7. 권한 필터링 검토

### 엑셀 다운로드 권한
**현황**: 제한 없음 (모든 인증된 사용자 가능)

**권장 정책**:
- master, emergency_center_admin, regional_emergency_center_admin: 전체 다운로드 가능
- local_admin: 관할 지역만 다운로드 가능
- ministry_admin, regional_admin: 다운로드 불가 (읽기 전용)
- temporary_inspector: 자신의 점검 기록만 다운로드 가능

**구현 필요**:
```typescript
// AdminFullView.tsx에 권한 체크 추가
const canExportExcel = checkInspectionPermission(
  user.role,
  user.id,
  inspectorId,
  user.region_code,
  aedRegionCode
).canView;
```

---

## 8. 종합 평가

| 항목 | 상태 | 진행도 | 비고 |
|------|------|--------|------|
| 용어 통일 | 구현됨 | 100% | 시도응급의료지원센터로 통일 |
| 점검불가 기능 | 부분 구현 | 60% | API O, UI X |
| 임시저장 기능 | 구현됨 | 100% | API + UI 모두 완성 |
| 점검 권한 검증 | 구현됨 | 100% | 완전한 권한 기반 제어 |
| 점검 이력 관리 | 구현됨 | 95% | 조회/삭제 O, 수정 UI X |
| 폼 필드 (소모품) | 구현됨 | 100% | 유효기간 필드 완성 |
| 폼 필드 (수정사유) | 구현됨 | 50% | 사유 고정값, 사용자 입력 불가 |
| 폼 필드 (CPR 안내) | 구현됨 | 90% | 필드 O, 엑셀 표시 로직 오류 |
| 폼 필드 (개선필요) | 구현됨 | 100% | 상세 내용 입력 가능 |
| 엑셀 내보내기 | 구현됨 | 100% | 37개 컬럼, 권한 필터링 없음 |
| PDF 내보내기 | 미구현 | 0% | 완전히 미구현 |
| 사진 스토리지 | 부분 구현 | 30% | UI O, 업로드 로직 미완성 |

---

## 9. 우선순위별 구현 목록

### 즉시 필요 (높음)
1. 점검불가 UI 통합 (30분)
2. 점검 기록 수정 UI 추가 (2시간)
3. 엑셀 다운로드 권한 필터링 (1시간)
4. CPR 안내 필드 엑셀 표시 로직 수정 (30분)

### 필요 (중간)
1. 수정사유 사용자 입력 받기 (1시간)
2. 사진 스토리지 마이그레이션 (3시간)
3. PDF 내보내기 기본 구현 (4시간)

### 선택 (낮음)
1. 고급 필터링 추가
2. 통계 대시보드 고도화
3. 실시간 점검 모니터링

