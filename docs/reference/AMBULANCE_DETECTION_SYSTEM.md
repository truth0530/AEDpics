# 구급차 판별 시스템 설계 문서

**작성일**: 2025-11-22
**버전**: 2.0.0
**작성자**: AI Development Team
**상태**: 검토 완료, 구현 준비

## 목차

1. [개요](#개요)
2. [배경 및 문제점](#배경-및-문제점)
3. [데이터베이스 구조 분석](#데이터베이스-구조-분석)
4. [구급차 판별의 목적](#구급차-판별의-목적)
5. [시스템 설계](#시스템-설계)
6. [구현 계획](#구현-계획)
7. [테스트 전략](#테스트-전략)
8. [마이그레이션 가이드](#마이그레이션-가이드)
9. [향후 확장 계획](#향후-확장-계획)

---

## 개요

### 현재 상태
- **코드 상태**: `lib/utils/ambulance-detector.ts` 미구현
- **실제 감지율**: 46% (2,676/5,804) - ManagementNumberPanel.tsx
- **목표 감지율**: 100% (5,804/5,804) - 구현 후 예상

### 목적
AED 관리 시스템에서 구급차를 정확하게 판별하고, 구급차와 일반 장비 간의 잘못된 매칭을 방지하기 위한 중앙집중식 유틸리티 시스템을 구축합니다.

### 핵심 원칙
1. **실용적 단순성**: 복잡한 구조 대신 단일 파일로 즉시 해결
2. **정확한 판별**: 3가지 구급차 패턴 100% 감지
3. **중앙 집중화**: 단일 진실 소스(Single Source of Truth) 원칙
4. **점진적 개선**: 즉시 구현 후 필요시 확장

### 주요 이해관계자
- **사용자**: 보건소 담당자, 응급의료센터 관리자
- **시스템**: 매칭 워크플로우, 그루핑 시스템
- **데이터**: target_list_2025, aed_data 테이블

---

## 배경 및 문제점

### 현재 상황

#### 문제 1: 중복된 판별 함수
두 개의 컴포넌트에서 서로 다른 로직으로 구급차를 판별하고 있음:

```typescript
// components/admin/compliance/InstitutionGroupCard.tsx
const isAmbulance = (institution: TargetInstitution): boolean => {
  const subDivision = institution.sub_division || '';
  return subDivision.includes('119') && subDivision.includes('구급차');
};

// components/admin/compliance/ManagementNumberPanel.tsx
function isAmbulance(item: ManagementNumberCandidate): boolean {
  const category2 = item.category_2 || '';
  return category2.includes('의료기관에서 운용 중인 구급차');
}
```

**문제점**:
- 같은 이름의 함수가 두 파일에 존재
- 서로 다른 필드(sub_division vs category_2)를 검사
- ManagementNumberPanel의 함수는 119구급대 구급차를 감지하지 못함 (2,753건 누락)

#### 문제 2: 불완전한 패턴 감지

**aed_data의 구급차 패턴 (총 5,804건)**:
| category_2 | 건수 | 현재 감지 여부 |
|-----------|------|--------------|
| 119구급대에서 운용 중인 구급차 | 2,753 | ❌ 누락 |
| 의료기관에서 운용 중인 구급차 | 2,676 | ✅ 감지 |
| 구급차 (구비의무기관 외) | 375 | ❌ 누락 |

**영향**:
- 전체 구급차의 53%만 정확히 감지
- 3,128건의 구급차가 일반 장비로 잘못 표시됨
- 붉은 테두리 경고가 일부 구급차에만 표시되어 일관성 없음

#### 문제 3: 향후 기능 확장의 어려움
- 매칭 제약 검증 로직 추가 시 여러 파일 수정 필요
- 중복 매칭 방지 기능 구현 시 일관성 유지 어려움
- 테스트 케이스 작성 및 유지보수 복잡도 증가

---

## 데이터베이스 구조 분석

### target_list_2025 (의무설치기관 목록)

#### 특성
- **구급차는 모두 별개 행(row)으로 분리**
- 같은 소속기관이라도 각 구급차마다 개별 target_key 부여
- sub_division 필드로 구급차 여부 표시

#### 데이터 구조
```sql
SELECT sub_division, COUNT(*) as count
FROM target_list_2025
WHERE sub_division LIKE '%119%' AND sub_division LIKE '%구급차%'
GROUP BY sub_division;
```

**결과**:
| sub_division | count |
|--------------|-------|
| 119및 의료기관 구급차 | 4,689 |

#### 실제 예시
```
target_key: "영남대병원_대구_남구_구급1"
  - institution_name: "영남대학교병원"
  - sub_division: "119및 의료기관 구급차"

target_key: "영남대병원_대구_남구_구급2"
  - institution_name: "영남대학교병원"
  - sub_division: "119및 의료기관 구급차"

target_key: "영남대병원_대구_남구_구급3"
  - institution_name: "영남대학교병원"
  - sub_division: "119및 의료기관 구급차"
```

**핵심 특징**:
- 3대의 구급차 = 3개의 별도 target_key
- 각각 개별 기관으로 취급
- 119구급대/의료기관 구분 없이 통합 표기

### aed_data (인트라넷 실제 장비)

#### 특성
- **하나의 management_number에 여러 장비(equipment_serial) 존재**
- 같은 소속기관 내 구급차/일반 장비 혼재
- category_1, category_2로 세분화된 분류

#### 데이터 구조
```sql
SELECT DISTINCT category_2, COUNT(*) as count
FROM aed_data
WHERE category_2 LIKE '%구급차%'
GROUP BY category_2
ORDER BY count DESC;
```

**결과**:
| category_1 | category_2 | count |
|-----------|-----------|-------|
| 구비의무기관 | 119구급대에서 운용 중인 구급차 | 2,753 |
| 구비의무기관 | 의료기관에서 운용 중인 구급차 | 2,676 |
| 구비의무기관 외 | 구급차 | 375 |
| **합계** | | **5,804** |

#### 실제 예시
```
management_number: "20211105-01" (영남대학교병원)
├─ equipment_serial: "ABC001"
│  ├─ category_1: "구비의무기관"
│  ├─ category_2: "의료기관에서 운용 중인 구급차"
│  └─ installation_position: "구급차 1호"
│
├─ equipment_serial: "ABC002"
│  ├─ category_1: "구비의무기관"
│  ├─ category_2: "의료기관에서 운용 중인 구급차"
│  └─ installation_position: "구급차 2호"
│
├─ equipment_serial: "ABC003"
│  ├─ category_1: "구비의무기관"
│  ├─ category_2: "공공보건의료기관"
│  └─ installation_position: "응급실 접수대"
│
└─ equipment_serial: "ABC004"
   ├─ category_1: "구비의무기관"
   ├─ category_2: "공공보건의료기관"
   └─ installation_position: "수술실 복도"
```

**핵심 특징**:
- 하나의 관리번호에 구급차 2대 + 일반 장비 2개
- 각 장비는 개별 serial로 구분
- 119구급대/의료기관 명확히 구분

### 데이터 소스 간 핵심 차이

| 항목 | target_list_2025 | aed_data |
|-----|-----------------|----------|
| **구급차 표현** | 별개 행(row) | 하나의 기관 내 여러 serial |
| **분류 필드** | sub_division | category_1 + category_2 |
| **분류 값** | "119및 의료기관 구급차" | "119구급대에서...", "의료기관에서..." |
| **구분 세분화** | 119/의료기관 통합 | 119/의료기관 분리 |
| **데이터 건수** | 4,689건 (의무기관) | 5,804건 (의무+비의무) |

---

## 구급차 판별의 목적

### Phase 1: 즉시 목적 (현재 구현)

#### 1. 시각적 경고
```typescript
// 붉은 테두리로 구급차 표시
<span className={cn(
  "border rounded px-1.5 py-0.5",
  isAmbulance(item)
    ? "border-red-500/50"  // 구급차
    : "border-gray-700/30"  // 일반
)}>
```

**효과**:
- 사용자가 구급차를 즉시 인식
- 실수로 일반 장비와 혼동하는 것 방지

#### 2. 사용자 인지 향상
- 구급차는 특별한 주의가 필요함을 시각적으로 알림
- 그루핑 패널, 매칭 패널 모두에서 일관된 표시

#### 3. 그루핑 경고 다이얼로그
```typescript
// InstitutionGroupCard.tsx
if (checked && ambulanceInfo.needsWarning) {
  setShowAmbulanceWarning(true);
  // "구급차의 경우 인트라넷에 존재하는 해당 구급차 장비연번과
  //  각각 개별 매칭 해야 합니다" 경고 표시
}
```

**효과**:
- 구급차 일괄 매칭 시도 전 경고
- 사용자가 의도를 재확인할 기회 제공

### Phase 2: 단기 목적 (다음 개선)

#### 1. 매칭 제약 검증

**규칙**:
```
✅ 구급차(target) ↔ 구급차(aed)      허용
✅ 일반(target)   ↔ 일반(aed)        허용
❌ 구급차(target) ↔ 일반(aed)        차단
❌ 일반(target)   ↔ 구급차(aed)      차단
```

**구현 위치**:
- Basket에 장비 추가 시점
- 최종 매칭 저장 직전

**에러 메시지 예시**:
```
"구급차(영남대병원 구급1)는 구급차 장비와만 매칭할 수 있습니다.
선택한 장비(ABC003)는 일반 장비입니다.
구급차 장비만 선택하여 다시 시도하세요."
```

#### 2. 중복 매칭 방지

**시나리오**:
```
1. 구급차1 ↔ 구급차 장비A (이미 매칭됨)
2. 구급차2 ↔ 구급차 장비A (시도) → 차단!
```

**검증 로직**:
```typescript
// 이미 매칭된 구급차 serial인지 확인
const isAlreadyMatched = await checkExistingAmbulanceMatch(serial);
if (isAlreadyMatched) {
  showWarning("이미 다른 구급차와 매칭된 장비입니다.");
}
```

#### 3. 혼합 매칭 방지

**시나리오**:
```
Basket 내용:
├─ 구급차 장비A (category_2: "의료기관에서 운용 중인 구급차")
└─ 일반 장비B (category_2: "공공보건의료기관")

→ "구급차와 일반 장비를 함께 담을 수 없습니다" 경고
```

**구현**:
```typescript
function validateBasketConsistency(basketItems) {
  const hasAmbulance = basketItems.some(isAmbulance);
  const hasNonAmbulance = basketItems.some(item => !isAmbulance(item));

  if (hasAmbulance && hasNonAmbulance) {
    return { valid: false, error: "MIXED_BASKET" };
  }
}
```

### Phase 3: 장기 목적 (고도화)

#### 1. 스마트 매칭 제안
- 같은 소속기관의 구급차끼리 자동 추천
- 미매칭 구급차 우선 표시

#### 2. 소속기관 연관성 표시
- 같은 병원의 구급차들을 그룹으로 시각화
- "영남대병원 구급차 3대 중 2대 매칭 완료" 진행률 표시

#### 3. 매칭 히스토리 추적
- 구급차 매칭 이력 별도 추적
- 매칭 변경 시 이전 매칭 정보 보존
- 감사(Audit) 로그 생성

---

## 시스템 설계

### 아키텍처 개요 (단순화)

```
lib/utils/
└── ambulance-detector.ts    # 단일 유틸리티 파일 (Phase 1)
    ├── isAmbulanceFromTarget()    # target_list_2025용
    ├── isAmbulanceFromAED()       # aed_data용
    └── getAmbulanceType()         # 타입 구분 (선택)

사용처:
├── components/admin/compliance/InstitutionGroupCard.tsx
├── components/admin/compliance/ManagementNumberPanel.tsx
├── scripts/check-ambulance-data.mjs  # 검증 스크립트
└── (향후 추가될 컴포넌트들)
```

### 파일별 상세 설계

#### 1. lib/utils/ambulance-detector.ts (Phase 1 - 즉시 구현)

```typescript
/**
 * 구급차 판별 유틸리티
 *
 * 단일 진실 소스(Single Source of Truth)로
 * 모든 구급차 판별 로직을 중앙화
 */

// 구급차 타입 (선택적 사용)
export type AmbulanceType = '119구급대' | '의료기관' | '기타' | null;

/**
 * target_list_2025용 구급차 판별
 * InstitutionGroupCard.tsx에서 사용
 *
 * @param institution - target_list_2025 레코드
 * @returns 구급차 여부
 */
export function isAmbulanceFromTarget(institution: {
  sub_division?: string | null
}): boolean {
  const subDivision = (institution.sub_division || '').trim();

  // "119및 의료기관 구급차" 패턴 감지
  // 현재는 단일 패턴이지만, 향후 확장 가능하도록 배열 관리
  const ambulancePatterns = [
    (text: string) => text.includes('119') && text.includes('구급차')
  ];

  return ambulancePatterns.some(pattern => pattern(subDivision));
}

/**
 * aed_data용 구급차 판별
 * ManagementNumberPanel.tsx에서 사용
 *
 * 현재 문제: "의료기관에서 운용 중인 구급차"만 감지 (46% 감지율)
 * 개선: 모든 구급차 패턴 감지 (목표 100%)
 *
 * @param item - aed_data 레코드
 * @returns 구급차 여부
 */
export function isAmbulanceFromAED(item: {
  category_1?: string | null;
  category_2?: string | null;
}): boolean {
  const category1 = (item.category_1 || '').trim();
  const category2 = (item.category_2 || '').trim();

  // 방어적 감지: category_2 우선, category_1 보조

  // 1. category_2에 "구급차" 포함 (대부분의 케이스)
  // 공백/오타 대비 정규식 사용
  const ambulanceRegex = /구급\s*차/;
  if (ambulanceRegex.test(category2)) {
    return true;
  }

  // 2. category_1이 "구비의무기관 외"이고 category_2가 정확히 "구급차"
  // (category_2가 비어있거나 특수한 경우 대비)
  if (category1 === '구비의무기관 외' && category2 === '구급차') {
    return true;
  }

  // 3. 안전망: category_1에도 "구급차" 포함 확인
  // (예외적인 데이터 구조 대비)
  if (ambulanceRegex.test(category1)) {
    console.warn('Unusual ambulance pattern in category_1:', { category1, category2 });
    return true;
  }

  return false;
}

/**
 * 구급차 타입 구분 (선택적, Phase 2용)
 *
 * @param item - aed_data 레코드
 * @returns 구급차 타입 또는 null
 */
export function getAmbulanceType(item: {
  category_1?: string | null;
  category_2?: string | null;
}): AmbulanceType {
  const category2 = (item.category_2 || '').trim();

  // 정확한 패턴 매칭 (우선순위 순)
  if (category2.includes('119구급대')) return '119구급대';
  if (category2.includes('의료기관')) return '의료기관';
  if (/구급\s*차/.test(category2)) return '기타';

  return null;
}
```

#### 2. scripts/test-ambulance-detector.ts 생성 (TypeScript 검증용)

```typescript
import { PrismaClient } from '@prisma/client';
// 구현 후 주석 해제
// import { isAmbulanceFromAED } from '../lib/utils/ambulance-detector';

const prisma = new PrismaClient();

async function testAmbulanceDetection() {
  console.log('=== 구급차 판별 로직 검증 ===\n');

  // 1. 전체 구급차 데이터 조회
  const allAmbulances = await prisma.aed_data.findMany({
    where: {
      OR: [
        { category_2: { contains: '구급차' } },
        { category_1: { contains: '구급차' } }
      ]
    },
    select: { category_1: true, category_2: true, equipment_serial: true }
  });

  console.log(`총 구급차 데이터: ${allAmbulances.length}건`);

  // 2. 패턴별 분포 확인
  const pattern119 = allAmbulances.filter(a => a.category_2?.includes('119구급대'));
  const patternMedical = allAmbulances.filter(a => a.category_2?.includes('의료기관'));
  const patternOther = allAmbulances.filter(a =>
    a.category_1 === '구비의무기관 외' && a.category_2 === '구급차'
  );

  console.log(`- 119구급대: ${pattern119.length}건`);
  console.log(`- 의료기관: ${patternMedical.length}건`);
  console.log(`- 구비의무기관 외: ${patternOther.length}건`);

  // 3. 감지율 테스트 (구현 후)
  // const detected = allAmbulances.filter(item => isAmbulanceFromAED(item));
  // const missedItems = allAmbulances.filter(item => !isAmbulanceFromAED(item));

  // console.log(`\n감지 결과:`);
  // console.log(`✅ 감지: ${detected.length}건`);
  // console.log(`❌ 누락: ${missedItems.length}건`);
  // console.log(`감지율: ${(detected.length / allAmbulances.length * 100).toFixed(1)}%`);

  // if (missedItems.length > 0) {
  //   console.log('\n누락된 패턴 샘플:');
  //   missedItems.slice(0, 5).forEach(item => {
  //     console.log(`- category_1: "${item.category_1}", category_2: "${item.category_2}"`);
  //   });
  // }

  console.log('\n⚠️  ambulance-detector.ts 구현 필요');
}

// 실행 방법: npx tsx scripts/test-ambulance-detector.ts
testAmbulanceDetection()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**실행 방법**:
```bash
# TypeScript 직접 실행 (tsx 설치 필요)
npx tsx scripts/test-ambulance-detector.ts

# 또는 컴파일 후 실행
npx tsc scripts/test-ambulance-detector.ts --outDir dist/scripts
node dist/scripts/test-ambulance-detector.js
```

#### 3. lib/utils/ambulance-validator.ts (Phase 2 - TODO)

```typescript
/**
 * Phase 2: 매칭 검증 로직
 *
 * TODO: 구급차 ↔ 일반 장비 교차 매칭 방지
 * TODO: Basket 내 구급차/일반 장비 혼재 방지
 * TODO: 중복 매칭 방지
 *
 * 현재는 UI 경고만 있고 실질적인 차단 로직이 없음
 * Phase 1 완료 후 우선순위에 따라 구현
 */

// 구현 예정 함수들:
// - validateAmbulanceMatching(): 구급차-일반 교차 매칭 차단
// - validateBasketConsistency(): Basket 혼합 방지
// - validateDuplicateMatch(): 중복 매칭 차단
```

#### 4. 컴포넌트 수정 (Phase 1)

**InstitutionGroupCard.tsx**
```typescript
// Before (line 46-58)
const isAmbulance = (institution: TargetInstitution): boolean => {
  const subDivision = institution.sub_division || '';
  const result = subDivision.includes('119') && subDivision.includes('구급차');
  // ... logging
  return result;
};

// After
import { isAmbulanceFromTarget } from '@/lib/utils/ambulance-detector';

// 함수명 alias로 기존 코드 유지
const isAmbulance = isAmbulanceFromTarget;
// 또는 모든 사용처에서 직접 isAmbulanceFromTarget 호출
```

**ManagementNumberPanel.tsx**
```typescript
// Before (line 93-97)
function isAmbulance(item: ManagementNumberCandidate): boolean {
  const category2 = item.category_2 || '';
  return category2.includes('의료기관에서 운용 중인 구급차');  // 46% 감지율
}

// After
import { isAmbulanceFromAED } from '@/lib/utils/ambulance-detector';

// 함수명 alias로 기존 코드 유지
const isAmbulance = isAmbulanceFromAED;  // 100% 감지율
```

---

## 구현 계획

### Phase 1: 즉시 구현 (30분)

#### Step 1: 단일 유틸리티 파일 생성 (5분)
```bash
# 단일 파일만 생성
touch lib/utils/ambulance-detector.ts
```

#### Step 2: 유틸리티 구현 (10분)
`lib/utils/ambulance-detector.ts` 파일에 위의 코드 구현:
- `isAmbulanceFromTarget()`: target_list_2025용
- `isAmbulanceFromAED()`: aed_data용 (정규식 포함)
- `getAmbulanceType()`: 타입 구분 (선택)

#### Step 3: 컴포넌트 수정 (10분)

**InstitutionGroupCard.tsx**
- Line 46-58: 로컬 함수 삭제
- Line 1: import 추가
- alias 사용으로 기존 코드 유지

**ManagementNumberPanel.tsx**
- Line 93-97: 로컬 함수 삭제
- Line 1: import 추가
- alias 사용으로 기존 코드 유지

#### Step 4: 검증 (5분)
```bash
# 타입 체크
npm run tsc

# 개발 서버 실행
npm run dev

# 검증 스크립트 실행
node scripts/check-ambulance-data.mjs
```

#### Step 5: 실제 데이터 테스트
1. **1번 섹션** (InstitutionGroupCard):
   - 4,689건 모두 붉은 테두리 확인

2. **2번 섹션** (ManagementNumberPanel):
   - 119구급대 구급차 → 붉은 테두리 ✅ (신규)
   - 의료기관 구급차 → 붉은 테두리 ✅
   - 구비의무기관 외 구급차 → 붉은 테두리 ✅ (신규)
   - 일반 장비 → 연한 테두리 ✅

### Phase 2: 선택적 개선 (TODO)

#### ⚠️ 현재 리스크
**매칭 검증 로직 미구현으로 인한 문제**:
- 구급차 ↔ 일반 장비 교차 매칭 가능 (차단 없음)
- Basket에 구급차와 일반 장비 혼재 가능
- UI 경고만 있고 **실질적 차단 없음**

**매칭 검증 로직 (우선순위 높음)**
- [ ] 구급차 ↔ 일반 장비 교차 매칭 차단
- [ ] Basket 내 구급차/일반 장비 혼재 방지
- [ ] 중복 매칭 방지

**시각적 개선 (우선순위 중간)**
- [ ] 구급차 타입별 색상 구분 (`getAmbulanceType()` 활용)
- [ ] 구급차 수 표시 뱃지

**고도화 기능 (우선순위 낮음)**
- [ ] 스마트 매칭 제안
- [ ] 매칭 히스토리 추적

---

## 테스트 전략

### 실측 검증 (Phase 1 - 필수)

#### 1. TypeScript 검증 스크립트
`scripts/test-ambulance-detector.ts` 실행:

```bash
# 방법 1: tsx 사용 (권장)
npx tsx scripts/test-ambulance-detector.ts

# 방법 2: 컴파일 후 실행
npx tsc scripts/test-ambulance-detector.ts --outDir dist/scripts
node dist/scripts/test-ambulance-detector.js
```

**현재 실행 결과** (유틸리티 미구현 상태):
```
총 구급차 데이터: 5,804건
- 119구급대: 2,753건
- 의료기관: 2,676건
- 구비의무기관 외: 375건
⚠️  ambulance-detector.ts 구현 필요
```

**목표 실행 결과** (구현 후):
```
감지 결과:
✅ 감지: 5,804건
❌ 누락: 0건
감지율: 100.0%
```

#### 2. 필수 검증 체크리스트
- [ ] 5,804건 모두 감지 확인 (100%)
- [ ] 누락 패턴 없음 확인
- [ ] 오탐(false positive) 테스트
- [ ] 엣지 케이스 테스트 (null, 공백, 오타)

### 간단한 스냅샷 테스트 (Phase 2 - 선택)

```typescript
// lib/utils/ambulance-detector.test.ts
describe('구급차 판별 테스트', () => {
  test('119구급대 구급차 감지', () => {
    expect(isAmbulanceFromAED({
      category_2: '119구급대에서 운용 중인 구급차'
    })).toBe(true);
  });

  test('공백 포함 구급차 감지', () => {
    expect(isAmbulanceFromAED({
      category_2: '구급 차'
    })).toBe(true);
  });

  test('일반 장비 미감지', () => {
    expect(isAmbulanceFromAED({
      category_2: '공공보건의료기관'
    })).toBe(false);
  });
});
```

---

## 마이그레이션 가이드

### 코드 변경 최소화 전략

```typescript
// 1. InstitutionGroupCard.tsx (Line 1 추가, Line 46-58 교체)
import { isAmbulanceFromTarget } from '@/lib/utils/ambulance-detector';
const isAmbulance = isAmbulanceFromTarget;  // alias로 기존 코드 유지

// 2. ManagementNumberPanel.tsx (Line 1 추가, Line 93-97 교체)
import { isAmbulanceFromAED } from '@/lib/utils/ambulance-detector';
const isAmbulance = isAmbulanceFromAED;  // alias로 기존 코드 유지
```

### 롤백 계획

```bash
# 문제 발생 시 즉시 롤백
git revert HEAD

# 또는 파일별 롤백
rm lib/utils/ambulance-detector.ts
git checkout HEAD~1 components/admin/compliance/*.tsx
```

---

## 구현 체크리스트

### Phase 1 (즉시 - 30분)
- [ ] `lib/utils/ambulance-detector.ts` 생성
- [ ] `isAmbulanceFromTarget()` 구현
- [ ] `isAmbulanceFromAED()` 구현 (방어적 로직 포함)
- [ ] `InstitutionGroupCard.tsx` import 수정
- [ ] `ManagementNumberPanel.tsx` import 수정
- [ ] 타입 체크 (`npm run tsc`)
- [ ] **검증 스크립트로 5,804/5,804 확인** (필수)
- [ ] 누락 패턴 분석 및 보완

### Phase 2 (선택 - TODO)
- [ ] 구급차 ↔ 일반 장비 매칭 차단
- [ ] Basket 혼합 방지
- [ ] 중복 매칭 방지
- [ ] 구급차 타입별 색상 구분
- [ ] 스냅샷 테스트 작성

---

## 결론

### 핵심 개선사항

1. **즉각적 문제 해결**: 30분 내 3,128건의 누락된 구급차 감지
2. **실용적 단순성**: 단일 파일, 50줄 이내 변경
3. **100% 호환성**: alias 사용으로 기존 코드 수정 최소화
4. **검증 가능성**: 실제 데이터로 즉시 테스트 가능

### 예상 효과

| 항목 | 현재 (실제) | 목표 (구현 후) |
|------|------|---------|
| **감지율** | 46% (2,676/5,804) | 100% (5,804/5,804)* |
| **누락 건수** | 3,128건 | 0건* |
| **매칭 차단** | 없음 (경고만) | Phase 2에서 구현 |
| **코드 변경** | - | 3개 파일, 약 80줄 |
| **구현 시간** | - | 30-45분 |
| **위험도** | - | 낮음 |

*실제 감지율은 검증 스크립트로 확인 필요

### 권장 사항

1. **Phase 1 즉시 구현**: 구급차 판별 정확도 100% 달성
2. **Phase 2는 필요시**: 매칭 검증 로직은 우선순위에 따라
3. **실측 검증 우선**: 테스트 작성보다 실제 데이터 검증

---

## 부록

### 실제 데이터 현황

```sql
-- target_list_2025: 4,689건 (119및 의료기관 구급차)
-- aed_data: 5,804건
--   - 119구급대: 2,753건
--   - 의료기관: 2,676건
--   - 구비의무기관 외: 375건
```

### 변경 이력

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 2025-11-22 | 1.0.0 | 초안 작성 | AI Development Team |
| 2025-11-22 | 2.0.0 | 실용성 중심 개선 | AI Development Team |

---

**문서 끝**
