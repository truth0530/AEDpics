# Region/Organization Data Validation Skill

## Purpose
orgFactory에서 생성되는 지역/조직 데이터의 정확성과 일관성을 검증하여 중앙 관리 시스템의 무결성을 보장합니다.

## 검증 대상

### 중앙 관리 시스템 파일
- `lib/constants/regions.ts` - 지역 메타데이터 및 구군명 정의
- `lib/services/orgFactory.ts` - 동적 데이터 생성 팩토리
- `lib/data/organizations.ts` - 조직 데이터 (orgFactory 활용)
- `lib/data/health-centers-master.ts` - 보건소 데이터 (fallback)

## 검증 항목

### 단계 1: 지역 데이터 구조 검증

#### 1-1. REGIONS 상수 검증
**파일:** lib/constants/regions.ts

```typescript
export const REGIONS: Region[] = [
  { code: 'KR', label: '중앙', type: 'central', order: 0 },
  { code: 'SEO', label: '서울', type: 'metro', order: 1 },
  // ... 총 18개 지역
]
```

**검증:**
- [ ] 총 18개 지역 (KR + 17 시도)
- [ ] 각 지역 코드 (code) 고유함
- [ ] 각 지역명 (label) 고유함
- [ ] order 값이 0-17로 순차적
- [ ] type이 'central', 'metro', 'province', 'special' 중 하나
- [ ] 필수 필드: code, label, type, order

**검사 체크리스트:**
```bash
# 1. 지역 개수 확인
grep -c "code:" lib/constants/regions.ts  # 18개 라인

# 2. 지역 코드 고유성 확인
grep "code:" lib/constants/regions.ts | wc -l  # 18
grep "code:" lib/constants/regions.ts | sort -u | wc -l  # 18 (동일)

# 3. 지역명 고유성 확인
grep "label:" lib/constants/regions.ts | sort -u | wc -l  # 18
```

#### 1-2. REGION_CODE_TO_GUGUNS 검증
**파일:** lib/constants/regions.ts

```typescript
export const REGION_CODE_TO_GUGUNS: Record<string, string[]> = {
  'KR': ['대한민국'],
  'SEO': ['강남구', '강동구', '강북구', ..., '중구'],  // 25개 구
  // ...
}
```

**검증:**
- [ ] 모든 지역 코드에 guguns 배열 존재
- [ ] 각 guguns 배열이 비어있지 않음 (KR 제외 1개 이상)
- [ ] 구군명이 중복되지 않음 (동일 지역 내)
- [ ] 특수 구군명 처리:
  - [ ] 세종: '세종시' (시 단위)
  - [ ] 제주: '제주시', '서귀포시' (시 단위)
  - [ ] 대구: '달성군', '군위군' (군 단위)

**지역별 구군 개수 확인:**
```
'KR': 1개 (특수)
'SEO' (서울): 25개
'BUS' (부산): 16개
'DAE' (대구): 5개
'INC' (인천): 8개
'GWJ' (광주): 5개
'DAJ' (대전): 5개
'ULS' (울산): 5개
'SJJ' (세종): 1개 (특수)
'GGD' (경기): 31개
'GWN' (강원): 18개
'CB' (충북): 11개
'CN' (충남): 15개
'JB' (전북): 14개
'JN' (전남): 22개
'GB' (경북): 23개
'GN' (경남): 18개
'JJ' (제주): 2개 (특수)
```

총: 18개 지역, 225개+ 구군

#### 1-3. 지역명 패턴 검증
**파일:** lib/constants/regions.ts

```typescript
export function getRegionNamePatterns() {
  return {
    fullNames: ['서울특별시', '부산광역시', ...],  // 정식명
    shortNames: ['서울', '부산', ...]  // 단축명
  }
}
```

**검증:**
- [ ] fullNames 개수 = shortNames 개수 (1:1 대응)
- [ ] 각 fullName이 고유함
- [ ] 각 shortName이 고유함
- [ ] 특수 지역명:
  - [ ] '서울특별시' ↔ '서울'
  - [ ] '부산광역시' ↔ '부산'
  - [ ] '세종특별자치시' ↔ '세종'
  - [ ] '제주특별자치도' ↔ '제주'

### 단계 2: orgFactory 검증

#### 2-1. orgFactory 출력 구조
**파일:** lib/services/orgFactory.ts

```typescript
interface RegionOrgData {
  region: string;        // 단축명 ('서울')
  regionCode: string;    // 코드 ('SEO')
  fullRegionName: string;  // 정식명 ('서울특별시')
  organizations: string[];  // 조직명 배열
  guguns: string[];      // 구군명 배열
}

export function generateRegionOrganizations(): RegionOrgData[] {
  // 반환: 18개 지역 데이터 배열
}
```

**검증:**
- [ ] 함수 호출 성공 (에러 없음)
- [ ] 반환값이 배열
- [ ] 배열 길이 = 18
- [ ] 각 요소가 RegionOrgData 타입 준수

#### 2-2. 각 지역 데이터 검증
**테스트 코드:**
```typescript
const regionOrgData = generateRegionOrganizations();

regionOrgData.forEach((data, idx) => {
  // 1. 필수 필드 존재 여부
  assert(data.region, `지역 ${idx}: region 필드 필수`);
  assert(data.regionCode, `지역 ${idx}: regionCode 필드 필수`);
  assert(data.fullRegionName, `지역 ${idx}: fullRegionName 필드 필수`);
  assert(Array.isArray(data.organizations), `지역 ${idx}: organizations는 배열`);
  assert(Array.isArray(data.guguns), `지역 ${idx}: guguns는 배열`);

  // 2. 데이터 일관성
  const expectedGugun = REGION_CODE_TO_GUGUNS[data.regionCode];
  assert.deepEqual(data.guguns, expectedGugun,
    `지역 ${data.region}: guguns 불일치`);

  // 3. 조직명 검증
  assert(data.organizations.length > 0,
    `지역 ${data.region}: organizations는 비어있을 수 없음`);

  data.organizations.forEach(org => {
    assert(typeof org === 'string', `지역 ${data.region}: 조직명이 문자열`);
    assert(org.length > 0, `지역 ${data.region}: 조직명이 비어있음`);
  });
});
```

### 단계 3: 조직 데이터 검증

#### 3-1. organizations.ts 검증
**파일:** lib/data/organizations.ts

```typescript
export function getOrganizationsByRegion(region: string): string[] {
  // 주어진 지역의 조직명 배열 반환
}

export function getAvailableRegions(email: string): string[] {
  // 이메일 도메인에 따른 접근 가능 지역 반환
}
```

**검증:**
- [ ] `getOrganizationsByRegion('서울')` 결과:
  - [ ] 배열 반환 (빈 배열 제외)
  - [ ] 첫 항목: '기타 (직접 입력)'
  - [ ] 그 다음: '서울응급의료지원센터'
  - [ ] 나머지: 구군별 보건소 (25개)

- [ ] `getAvailableRegions('user@nmc.or.kr')`:
  - [ ] 모든 18개 지역 포함 (중앙 포함)

- [ ] `getAvailableRegions('user@korea.kr')`:
  - [ ] 17개 지역 포함 (중앙 제외)

#### 3-2. health-centers-master.ts 검증 (Fallback)
**파일:** lib/data/health-centers-master.ts

```typescript
export function getAvailableCenters(region: string): string[] {
  // 지역의 보건소 목록 반환 (organizations.ts와 동일)
}
```

**검증:**
- [ ] `getAvailableCenters('서울')` === `getOrganizationsByRegion('서울')`
- [ ] 출력 형식 일치
- [ ] 중앙(KR) 제외

### 단계 4: 데이터 일관성 교차 검증

#### 4-1. 지역 코드 일관성
```typescript
// regions.ts의 지역과 orgFactory 출력이 일치하는가?
const regions = REGIONS.map(r => r.code);
const factoryRegions = generateRegionOrganizations().map(d => d.regionCode);

assert.deepEqual(
  regions.sort(),
  factoryRegions.sort(),
  '지역 코드 불일치'
);
```

#### 4-2. 구군 데이터 일관성
```typescript
// REGION_CODE_TO_GUGUNS와 orgFactory guguns이 일치하는가?
generateRegionOrganizations().forEach(data => {
  const expected = REGION_CODE_TO_GUGUNS[data.regionCode];
  assert.deepEqual(
    data.guguns,
    expected,
    `${data.region}: guguns 불일치`
  );
});
```

#### 4-3. 조직명 일관성
```typescript
// getOrganizationsByRegion과 orgFactory organizations이 일치하는가?
generateRegionOrganizations().forEach(data => {
  const expected = getOrganizationsByRegion(data.region);
  assert.deepEqual(
    data.organizations,
    expected,
    `${data.region}: organizations 불일치`
  );
});
```

### 단계 5: 건강한 상태 확인

#### 5-1. 성능 검증
```typescript
const start = Date.now();
const data = generateRegionOrganizations();
const duration = Date.now() - start;

assert(duration < 100, `생성 시간이 너무 김: ${duration}ms`);
console.log(`orgFactory 실행 시간: ${duration}ms`);
```

#### 5-2. 메모리 사용량
```typescript
const before = process.memoryUsage().heapUsed;
const data = generateRegionOrganizations();
const after = process.memoryUsage().heapUsed;
const delta = (after - before) / 1024 / 1024;

console.log(`메모리 사용량: ${delta.toFixed(2)}MB (허용: < 50MB)`);
assert(delta < 50, '메모리 사용량이 초과됨');
```

#### 5-3. 데이터 크기
```typescript
const regionOrgData = generateRegionOrganizations();
const totalOrgs = regionOrgData.reduce((sum, d) => sum + d.organizations.length, 0);
const totalGugun = regionOrgData.reduce((sum, d) => sum + d.guguns.length, 0);

console.log(`총 조직 수: ${totalOrgs}개 (예상: 425개+)`);
console.log(`총 구군 수: ${totalGugun}개 (예상: 225개+)`);

assert(totalOrgs > 400, '조직 데이터가 부족함');
assert(totalGugun > 200, '구군 데이터가 부족함');
```

## 검사 실행 명령어

### 수동 검증 (콘솔)
```bash
# 1. regions.ts 데이터 확인
node -e "
const regions = require('./lib/constants/regions.ts');
console.log('REGIONS 개수:', regions.REGIONS.length);
console.log('guguns 개수:', Object.keys(regions.REGION_CODE_TO_GUGUNS).length);
"

# 2. orgFactory 출력 확인
node -e "
const { generateRegionOrganizations } = require('./lib/services/orgFactory');
const data = generateRegionOrganizations();
console.log('생성된 지역 수:', data.length);
data.forEach(d => {
  console.log(\`\${d.region}: \${d.organizations.length}개 조직, \${d.guguns.length}개 구군\`);
});
"

# 3. 조직 데이터 확인
node -e "
const { getOrganizationsByRegion } = require('./lib/data/organizations');
const orgs = getOrganizationsByRegion('서울');
console.log('서울 조직 수:', orgs.length);
console.log('첫 5개:', orgs.slice(0, 5));
"
```

### TypeScript 테스트 파일 작성
**파일:** scripts/test/validate-region-data.ts

```typescript
import { REGIONS, REGION_CODE_TO_GUGUNS } from '@/lib/constants/regions';
import { generateRegionOrganizations } from '@/lib/services/orgFactory';
import { getOrganizationsByRegion, getAvailableRegions } from '@/lib/data/organizations';

async function validateRegionData() {
  console.log('Starting region data validation...\n');

  // 1. REGIONS 검증
  console.log('1. REGIONS Validation');
  const regions = REGIONS;
  assert(regions.length === 18, `REGIONS count: ${regions.length} (expected 18)`);
  console.log(`✅ REGIONS: ${regions.length}개 지역\n`);

  // 2. orgFactory 검증
  console.log('2. orgFactory Validation');
  const factoryData = generateRegionOrganizations();
  assert(factoryData.length === 18, `Factory regions: ${factoryData.length} (expected 18)`);

  let totalOrgs = 0;
  factoryData.forEach(d => {
    totalOrgs += d.organizations.length;
  });
  console.log(`✅ orgFactory: ${factoryData.length}개 지역, 총 ${totalOrgs}개 조직\n`);

  // 3. 일관성 검증
  console.log('3. Consistency Check');
  factoryData.forEach(data => {
    const expected = REGION_CODE_TO_GUGUNS[data.regionCode];
    assert.deepEqual(data.guguns, expected, `Guguns mismatch for ${data.region}`);
  });
  console.log('✅ 모든 guguns 데이터 일치\n');

  console.log('All validations passed!');
}

validateRegionData().catch(console.error);
```

## 결과 보고서 양식

### 모든 검증 통과
```
REGION DATA VALIDATION REPORT
Generated: 2025-11-09 15:45:00

1. REGIONS Structure Validation
   Status: PASSED
   - Total regions: 18 ✅
   - Region codes unique: ✅ 18/18
   - Region labels unique: ✅ 18/18
   - Order values sequential: ✅ 0-17
   - Type values valid: ✅ central, metro, province, special

2. REGION_CODE_TO_GUGUNS Validation
   Status: PASSED
   - Total regions: 18 ✅
   - Total districts: 225 ✅
   - KR districts: 1 (special)
   - SEO districts: 25
   - BUS districts: 16
   - ... (all checked)

3. orgFactory Output Validation
   Status: PASSED
   - Regions returned: 18 ✅
   - Total organizations: 450+ ✅
   - Data structure: RegionOrgData[] ✅
   - Performance: 12ms ✅
   - Memory usage: 2.3MB ✅

4. Organization Data Validation
   Status: PASSED
   - getOrganizationsByRegion('서울'): 27개 ✅
   - getAvailableRegions('user@nmc.or.kr'): 18개 (중앙 포함) ✅
   - getAvailableRegions('user@korea.kr'): 17개 (중앙 제외) ✅

5. Consistency Cross-Check
   Status: PASSED
   - Region codes: 일치 ✅
   - Guguns data: 일치 ✅
   - Organizations: 일치 ✅

FINAL RESULT: ALL VALIDATIONS PASSED
Central region management system is healthy and consistent.

Summary:
- 18 regions properly configured
- 225+ districts defined and accessible
- 450+ organizations available
- Zero data inconsistencies detected
- Performance metrics within acceptable range
```

### 검증 실패
```
REGION DATA VALIDATION REPORT
Generated: 2025-11-09 15:45:00

1. REGIONS Structure Validation
   Status: PASSED ✅

2. REGION_CODE_TO_GUGUNS Validation
   Status: FAILED ❌

   Error Details:
   Missing guguns for region code: SJJ (세종)

   Expected: guguns array with at least 1 element
   Actual: undefined

   Impact:
   - generateHealthCenterName() will fail for 세종 region
   - Signup form dropdown will not show 세종
   - Admin seed-organizations API will skip 세종

   Fix Required:
   In lib/constants/regions.ts, add:
   'SJJ': ['세종시']

   Priority: CRITICAL (blocks 세종 region usage)
```

## 참고 문서
- [REGION_MANAGEMENT_RULES.md](docs/REGION_MANAGEMENT_RULES.md) - 지역 관리 규칙
- [lib/constants/regions.ts](lib/constants/regions.ts) - 중앙 관리 시스템
- [lib/services/orgFactory.ts](lib/services/orgFactory.ts) - 팩토리 구현
- [Hardcoding Detection Skill](hardcoding-detection.md) - 하드코딩 감지 스킬
