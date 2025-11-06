# Phase 4 구현 전 필수 결정사항

**작성일**: 2025-11-06
**상태**: 결정 대기
**목적**: Phase 4 구현 시작 전 명확한 방향 수립

---

## 1. City_code 매핑 형식 (필수 결정)

### 현재 상황

**DB 저장 형식**:
- aed_data.gugun: 한글 ('서귀포시', '중구', ...)
- organizations.city_code: 영문 ('seogwipo', 'jung', ...)

**매핑 테이블**:
- lib/constants/regions.ts의 CITY_CODE_TO_GUGUN_MAP
- 영문 → 한글 일방향 매핑

**enforceFilterPolicy 입력**:
- cityCodes 파라미터가 어떤 형식?

### 의사결정 필요 사항

#### 옵션 A: 클라이언트가 영문만 보냄
```typescript
// 클라이언트 요청
POST /api/inspections/export
Body: { cityCodes: ['seogwipo'] }

// 엔드포인트에서 처리
const mappedCityCodes = requestedFilters.cityCodes?.map(code =>
  mapCityCodeToGugun(code)
) || [];

const filterResult = enforceFilterPolicy({
  userProfile,
  accessScope,
  requestedFilters: {
    ...requestedFilters,
    cityCodes: mappedCityCodes  // ['서귀포시']로 변환
  }
});
```

**장점**: 한글 매핑 단계 명확
**단점**: 클라이언트가 영문만 사용

#### 옵션 B: 클라이언트가 한글만 보냄
```typescript
// 클라이언트 요청
POST /api/inspections/export
Body: { cityCodes: ['서귀포시'] }

// 엔드포인트에서 처리 (매핑 불필요)
const filterResult = enforceFilterPolicy({
  userProfile,
  accessScope,
  requestedFilters  // 그대로 전달
});
```

**장점**: 사용자 친화적 (한글)
**단점**: 클라이언트에서 한글 입력 필요

#### 옵션 C: 둘 다 받음
```typescript
// 클라이언트 요청 (형식 유연함)
POST /api/inspections/export
Body: { cityCodes: ['seogwipo'] } 또는 { cityCodes: ['서귀포시'] }

// 엔드포인트에서 정규화
const normalizedCityCodes = requestedFilters.cityCodes?.map(code => {
  // 한글인지 확인
  if (/[가-힣]/.test(code)) return code;  // 한글이면 그대로
  return mapCityCodeToGugun(code) || code;  // 영문이면 변환
}) || [];

const filterResult = enforceFilterPolicy({
  userProfile,
  accessScope,
  requestedFilters: {
    ...requestedFilters,
    cityCodes: normalizedCityCodes
  }
});
```

**장점**: 형식에 관계없이 작동
**단점**: 코드 복잡성 증가

### 권장사항

**현재 시스템 관점**:
- enforceFilterPolicy는 입력값이 accessScope.allowedCityCodes와 정확히 일치해야 함
- accessScope.allowedCityCodes는 mapCityCodeToGugun의 결과 (한글)
- 따라서 **옵션 A 추천**: 엔드포인트에서 매핑하여 영문 → 한글 변환

**구현**:
```typescript
const mappedCityCodes = requestedFilters.cityCodes?.map(code =>
  mapCityCodeToGugun(code)
).filter(Boolean) || [];

// enforceFilterPolicy에 전달하기 전에 cityCodes를 매핑된 값으로 교체
const enforcementFilters = {
  ...requestedFilters,
  cityCodes: mappedCityCodes
};
```

### 최종 결정

**선택**: 옵션 A (영문 → 한글 매핑)

---

## 2. Excel 생성 라이브러리 (필수 결정)

### 현재 상황

**기존 코드 검색 결과**:
- ExcelJS 사용 여부: ?
- 기존 inspection 데이터 export 로직: ?
- 다른 Excel 생성 라이브러리: ?

### 의사결정 필요 사항

#### 옵션 A: 기존 로직 재사용
```typescript
// 혹시 이미 export 로직이 있을 경우
import { generateInspectionExcel } from '@/lib/inspections/excel-generator';

const excelBuffer = await generateInspectionExcel(inspections, filters);
```

**장점**: 코드 중복 제거, 포맷 일관성
**단점**: 기존 로직 찾아야 함

#### 옵션 B: ExcelJS 신규 구현
```typescript
import ExcelJS from 'exceljs';

const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('Inspections');

// 헤더 추가
worksheet.columns = [
  { header: '점검ID', key: 'id' },
  { header: '기기 serial', key: 'equipment_serial' },
  { header: '점검 날짜', key: 'inspection_date' },
  // ...
];

// 데이터 행 추가
inspections.forEach(inspection => {
  worksheet.addRow(inspection);
});

const excelBuffer = await workbook.xlsx.writeBuffer();
```

**장점**: 유연한 포맷팅, 새로운 요구사항 대응 가능
**단점**: ExcelJS 설치 확인 필요, 코드 작성 필요

#### 옵션 C: CSV 등 다른 형식
```typescript
// CSV로 반환 (더 간단)
const csv = inspections.map(i => `${i.id},${i.equipment_serial},...`).join('\n');
const buffer = Buffer.from(csv, 'utf-8');
```

**장점**: 매우 간단
**단점**: 사용자가 원하는 형식이 XLSX일 수 있음

### 권장사항

**현재 상황 파악 필요**:
1. 기존 inspection data export 로직이 있는지 검색
   ```bash
   grep -r "excel\|xlsx\|export" app/api/ lib/ --include="*.ts"
   ```
2. package.json에서 관련 라이브러리 확인
   ```bash
   grep -E "exceljs|xlsx|sheetjs" package.json
   ```

**결정 후**:
- 기존 로직 있음: 옵션 A (재사용)
- 기존 로직 없고 ExcelJS 설치됨: 옵션 B (ExcelJS)
- ExcelJS 미설치: 옵션 B (설치) 또는 옵션 C (CSV)

### 최종 결정 대기

**다음 확인 사항**:
- [ ] 기존 inspection export 로직 유무
- [ ] package.json의 exceljs/xlsx 라이브러리 설치 상태
- [ ] 사용자가 원하는 Excel 형식 (범위, 헤더, 병합 등)

---

## 3. Regional_admin 계정 처리 (참고 사항)

### 현황

**테스트 계정 부재**:
- regional_admin 역할의 실제 사용자 없음
- 코드는 이미 지원하도록 설계됨

### 구현 상태

**ROLE_FILTER_POLICY에서**:
```typescript
regional_admin: {
  required: ['sido'],  // gugun 선택 가능
}
```

**enforceFilterPolicy 로직**:
- regionCodes: 필수 (자동 채워짐)
- cityCodes: 선택 (없으면 null = 그 시도의 모든 gugun 접근 가능)

**export 권한**:
- can_export_data: true (기본값 또는 수동 설정 필요)
- canExportData permission: true

### 필요한 조치

```typescript
// Export 엔드포인트에서 이미 지원됨 (특별 코드 불필요)
const exportableRoles = ['master', 'emergency_center_admin', 'regional_emergency_center_admin', 'regional_admin', 'local_admin'];

if (!exportableRoles.includes(userProfile.role)) {
  return NextResponse.json({ error: '권한 없음' }, { status: 403 });
}
```

### 결론

**조치**: 코드 수준에서는 이미 regional_admin 지원
**향후**: regional_admin 계정이 생기면 자동으로 export 가능

---

## 4. Performance & Limits (설계 확인)

### maxResultLimit 적용

**각 역할별 제한**:

| 역할 | Limit | 용도 |
|------|-------|------|
| master | 10,000 | 전국 데이터 |
| regional_admin | 5,000 | 시도 단위 |
| local_admin | 1,000 | 시군구 단위 |
| temporary_inspector | 500 | AED 직접 접근 불가 |

**구현**:
```typescript
const finalLimit = Math.min(
  requestedFilters.limit || 1000,  // 클라이언트 요청
  accessScope.permissions.maxResultLimit  // 역할별 제한
);

const inspections = await prisma.inspections.findMany({
  // ...
  take: finalLimit
});
```

### Timeout 고려

**문제**: Master의 10,000개 데이터를 Excel로 변환 시 시간 소요
**솔루션**:
- Nginx timeout: proxy_read_timeout 120s (기본값보다 크게)
- API timeout: 60초 (적절한 값)
- 메모리 효율: Stream 응답 사용

### 확인 사항

- [ ] Nginx timeout 설정 확인
- [ ] Excel 생성 성능 테스트 (10,000개 행)
- [ ] 메모리 사용량 모니터링

---

## 5. 데이터 마스킹 고려

### 현황

**기존 마스킹 함수**: maskSensitiveData (lib/data/masking.ts 존재)

**접근 권한에 따른 마스킹**:
```typescript
const RolePermissions {
  // ...
  canViewSensitiveData: boolean;
}
```

**각 역할별 마스킹**:
- master, emergency_center_admin: 마스킹 없음
- ministry_admin: 마스킹 적용
- local_admin: 마스킹 적용 (일부)
- temporary_inspector: 마스킹 적용

### 결정 사항

**Export에서 마스킹 적용 여부**:

#### 옵션 A: 마스킹 적용
```typescript
const maskedInspections = inspections.map(i =>
  maskSensitiveData(i, accessScope.permissions.canViewSensitiveData)
);

const excelBuffer = await generateExcel(maskedInspections);
```

**장점**: 보안 강화
**단점**: 데이터 값이 변경됨

#### 옵션 B: 마스킹 미적용
```typescript
const excelBuffer = await generateExcel(inspections);
```

**장점**: 원본 데이터 제공
**단점**: 보안 위험

### 권장사항

**선택**: 옵션 A (마스킹 적용)
- Export도 데이터 조회와 동일한 보안 정책 적용
- canViewSensitiveData = true인 역할만 민감정보 포함

---

## 6. 감사 로그 (Audit Logging)

### 필수 기록 사항

```typescript
logDataAccess({
  userId: userProfile.id,
  action: 'export',
  resource: 'inspections',
  recordCount: inspections.length,
  filters: filterResult.filters,
  timestamp: new Date(),
  success: true,
  details: {
    regionCodes: filterResult.filters.regionCodes,
    cityCodes: filterResult.filters.cityCodes,
    maxResultLimit: accessScope.permissions.maxResultLimit,
    appliedLimit: finalLimit
  }
});
```

### 실패 로그

```typescript
logAccessRejection({
  userId: userProfile.id,
  action: 'export',
  reason: filterResult.reason,  // enforceFilterPolicy 실패 사유
  requestedFilters: requestedFilters,
  timestamp: new Date()
});
```

### 확인 사항

- [ ] logDataAccess 함수 존재 여부 확인
- [ ] logAccessRejection 함수 존재 여부 확인
- [ ] 감사 로그 저장소 확인 (DB, 파일, 로깅 서비스)

---

## 7. 최종 체크리스트

### 결정 완료

- [x] enforceFilterPolicy 호출 방식 (filterResult 기반)
- [x] Permission 검증 로직 (2-Layer: flag + role)
- [x] City_code 매핑 전략 (영문 → 한글)
- [ ] Excel 생성 방식 (기존 재사용 vs ExcelJS)
- [x] maxResultLimit 적용 방식
- [x] 데이터 마스킹 정책 (적용)
- [x] 감사 로그 기록

### 구현 준비 확인

- [ ] 기존 inspection export 로직 검색
- [ ] ExcelJS 설치 상태 확인
- [ ] logDataAccess, logAccessRejection 함수 위치 확인
- [ ] 감사 로그 저장소 확인

### 시작 전 필수

- [ ] 이 문서 검토 및 피드백
- [ ] 결정 사항 승인
- [ ] PHASE4_EXPORT_PREPARATION.md 검토

---

## 8. 다음 액션

### 즉시 (1-2분)

1. 결정 사항 피드백 제공
   - City_code 매핑: 옵션 A 확정?
   - Excel 라이브러리: 기존 vs ExcelJS?

2. 확인 필요 사항 검색
   ```bash
   grep -r "export\|excel" app/api/ lib/ --include="*.ts"
   grep exceljs package.json
   ```

### 진행 (30분)

1. 결정 사항 최종 확정
2. 필요한 라이브러리 설치 (미설치 시)
3. Phase 4 구현 시작

### 구현 (2-3시간)

1. /api/inspections/export/route.ts 작성
2. enforceFilterPolicy 통합
3. QA 테스트 수행

---

**상태**: 구현 시작 준비 완료, 결정 대기
**참고 문서**: PHASE4_EXPORT_PREPARATION.md
**다음 단계**: City_code 매핑 및 Excel 라이브러리 선택 확정
