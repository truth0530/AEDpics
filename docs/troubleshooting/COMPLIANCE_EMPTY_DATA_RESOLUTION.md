# 매칭결과 탭 빈 데이터 문제 해결 가이드

**작성일**: 2025-11-17
**심각도**: Critical
**영향 범위**: 매칭결과 탭 전체 데이터 표시 불가

## 문제 요약

매칭결과 탭에서 "매칭완료: 3" 통계는 정상 표시되지만, 실제 테이블의 매칭된 기관명, 관리번호, 장비연번, 주소 칼럼이 모두 "-"로 표시되는 문제

## 핵심 교훈 (반드시 숙지)

> **API와 UI의 상태 값(status) 불일치가 근본 원인**
>
> 강력새로고침, 캐시 클리어, 서버 재시작은 해결책이 아니었음

## 상황 타임라인

### 초기 증상 (2025-11-17)
- 통계 뱃지: "매칭완료: 3" 정상 표시
- 필터링: 클릭 시 정상 작동
- 테이블 데이터: 모든 매칭 정보 칼럼이 "-" 표시

### 잘못된 진단 과정

#### 시도 1: 캐시 문제로 오인
```
판단: "강력새로고침하면 될 것"
결과: 실패
이유: 코드 로직 문제이므로 캐시와 무관
```

#### 시도 2: API 데이터 구조 문제로 오인
```
판단: "API가 matches 배열을 비워서 반환하는 것"
조치: check-optimized/route.ts 전면 수정 (lines 130-207)
결과: 실패 (하지만 이 수정은 올바른 개선이었음)
이유: API는 정상 작동 중이었음
```

#### 시도 3: 데이터베이스 문제로 오인
```
판단: "DB에 데이터가 없는 것"
조치: scripts/check-serials.mjs로 DB 확인
결과: DB에 3개 레코드 정상 존재 확인
이유: DB는 정상
```

### 올바른 진단 과정

#### 결정적 단서 발견
서버 로그에서 다음 메시지 확인:
```
[ComplianceAPI] Confirmed matches sample: {
  count: 3,
  sample: [
    {
      target_key: "2025-47290-18827",
      institution_name: "군위군보건소",
      matchesArray: [
        {
          management_number: "13-0136551",
          institution_name: "군위군보건소",
          address: "경상북도 군위군 ...",
          equipment_count: 3,
          confidence: 100
        }
      ],
      matchesCount: 1
    }
  ]
}
```

**중요**: API는 정상적으로 데이터를 생성하고 있었음!

#### 근본 원인 발견

API 코드 분석 (check-optimized/route.ts:202):
```typescript
return {
  targetInstitution: {...},
  matches: matchesArray,  // ✅ 데이터 있음
  status: targetMatches.length > 0 ? 'confirmed' : 'pending',  // ⚠️ 'confirmed' 반환
  ...
};
```

UI 코드 분석 (ComplianceCompletedList.tsx:466, 478, 485, 492, 500):
```typescript
{target.status === 'installed' && target.matches[0] ? (  // ❌ 'installed' 체크
  <span>{target.matches[0].institution_name}</span>
) : (
  <span className="text-muted-foreground">-</span>  // 항상 여기로 빠짐
)}
```

**결론**:
- API는 `status: 'confirmed'` 반환
- UI는 `status === 'installed'` 체크
- 조건 불일치로 데이터가 있어도 "-" 표시

## 최종 해결책

### ComplianceCompletedList.tsx 수정
5개 위치에서 status 체크를 변경:

```typescript
// BEFORE (5곳)
{target.status === 'installed' && target.matches[0] ? (

// AFTER (5곳)
{target.status === 'confirmed' && target.matches[0] ? (
```

수정 위치:
1. Line 466: 매칭된 기관명
2. Line 478: 매칭된 관리번호
3. Line 485: 매칭된 장비연번
4. Line 492: 주소 (두 번째 occurrence)
5. Line 500: 주소 (세 번째 occurrence)

## 시스템 이해

### 두 가지 API 공존

#### 1. 레거시 API (`/api/compliance/check`)
- 상태 값: `'installed'` | `'not_installed'` | `'pending'`
- 지원 연도: 2024, 2025
- 사용 컴포넌트: ComplianceTargetList, ComplianceCheckPanel

#### 2. 새 API (`/api/compliance/check-optimized`)
- 상태 값: `'confirmed'` | `'pending'`
- 지원 연도: 2025만
- 사용 컴포넌트: ComplianceCompletedList

### 각 컴포넌트별 사용 API 및 상태

| 컴포넌트 | 사용 API | 상태 값 | 비고 |
|---------|----------|---------|------|
| ComplianceCompletedList.tsx | check-optimized | `'confirmed'` | 수정 완료 ✅ |
| ComplianceTargetList.tsx | check | `'installed'` | 정상 (변경 불필요) |
| ComplianceCheckPanel.tsx | check | `'installed'` | 정상 (기본 연도만 2025로 변경) |

## Target List 2025 데이터 교체 시 체크리스트

### 1. 데이터 교체 전 준비

```bash
# 1. 현재 데이터 백업
npx prisma studio --port 5556
# target_list_2025 테이블 전체 Export

# 2. 현재 매칭 상태 백업
npx prisma studio --port 5556
# target_list_devices 테이블 Export (target_list_year = 2025)
# management_number_group_mapping 테이블 Export
```

### 2. 데이터 교체 작업

```bash
# 1. 기존 데이터 삭제 (트랜잭션 사용 권장)
DELETE FROM target_list_devices WHERE target_list_year = 2025;
DELETE FROM target_list_2025;

# 2. 새 데이터 Import
python scripts/upload_to_ncp.py

# 3. 레코드 수 확인
SELECT COUNT(*) FROM target_list_2025;
```

### 3. API 응답 구조 검증 (중요!)

#### 3-1. 브라우저 개발자 도구로 API 응답 확인

```javascript
// Network 탭에서 check-optimized API 응답 구조 확인
{
  matches: [
    {
      targetInstitution: {...},
      matches: [...],  // ⚠️ 이 배열에 데이터가 있는지 확인!
      status: "confirmed",  // ⚠️ 이 값이 무엇인지 확인!
      confirmedBy: "...",
      confirmedAt: "..."
    }
  ]
}
```

#### 3-2. 서버 로그로 API 내부 데이터 확인

check-optimized/route.ts에는 이미 디버그 로그가 있음:
```typescript
// Lines 209-221
const confirmedMatches = matches.filter(m => m.status === 'confirmed');
if (confirmedMatches.length > 0) {
  console.log('[ComplianceAPI] Confirmed matches sample:', JSON.stringify({
    count: confirmedMatches.length,
    sample: confirmedMatches.slice(0, 2).map(m => ({
      target_key: m.targetInstitution.target_key,
      institution_name: m.targetInstitution.institution_name,
      matchesArray: m.matches,  // ⚠️ 여기에 데이터가 있어야 함!
      matchesCount: m.matches.length
    }))
  }, null, 2));
}
```

### 4. UI 렌더링 조건 검증

#### 4-1. Status 값 일치 확인

ComplianceCompletedList.tsx에서 사용하는 status 값이 API 응답과 일치하는지 확인:

```typescript
// API 응답 예시
status: "confirmed"  // ⚠️ 이 값이 무엇인지 먼저 확인

// UI 체크 조건 (5개 위치)
{target.status === 'confirmed' && target.matches[0] ? (  // ⚠️ 동일해야 함!
```

만약 API가 다른 값을 반환한다면:
- `'installed'` 반환 → UI도 `'installed'` 체크
- `'confirmed'` 반환 → UI도 `'confirmed'` 체크
- `'matched'` 반환 → UI도 `'matched'` 체크

#### 4-2. 렌더링 조건 체크 위치 (5곳)

ComplianceCompletedList.tsx:
```typescript
// 1. 매칭된 기관명 (line ~466)
{target.status === 'confirmed' && target.matches[0] ? (
  <span>{target.matches[0].institution_name}</span>
) : (
  <span className="text-muted-foreground">매칭 없음</span>
)}

// 2. 매칭된 관리번호 (line ~478)
{target.status === 'confirmed' && target.matches[0] ? (
  <span>{target.matches[0].management_number}</span>
) : (
  <span className="text-muted-foreground">-</span>
)}

// 3. 매칭된 장비연번 (line ~485)
{target.status === 'confirmed' && target.matches[0] ? (
  <span>{target.matches[0].equipment_count}대</span>
) : (
  <span className="text-muted-foreground">-</span>
)}

// 4. 주소 (line ~492)
{target.status === 'confirmed' && target.matches[0] ? (
  <span>{target.matches[0].address}</span>
) : (
  <span className="text-muted-foreground">-</span>
)}

// 5. 상세보기 버튼 조건 (line ~500)
{target.status === 'confirmed' && target.matches[0] ? (
```

### 5. 문제 발생 시 진단 순서

#### Step 1: 통계와 필터 작동 확인
```
✅ "매칭완료: N" 숫자가 표시되는가?
✅ 뱃지 클릭 시 필터링이 작동하는가?

→ YES: API는 정상 작동 중. UI 렌더링 조건 문제 의심
→ NO: API 문제 또는 데이터베이스 문제
```

#### Step 2: 브라우저 개발자 도구 확인
```javascript
// Network 탭에서 API 응답 확인
1. check-optimized 요청 찾기
2. Response 탭 클릭
3. matches 배열 확인:
   - matches[0].matches 배열에 데이터가 있는가?
   - matches[0].status 값이 무엇인가?
```

#### Step 3: 서버 로그 확인
```bash
# 개발 서버 로그에서 다음 메시지 찾기
[ComplianceAPI] Confirmed matches sample:

# 로그가 출력되면:
- matchesArray에 데이터가 있는가? → YES: API 정상
- matchesCount가 0보다 큰가? → YES: 데이터 생성됨

# 로그가 없으면:
- 매칭된 데이터가 없거나
- 필터링으로 모두 제외되었거나
- API 에러 발생
```

#### Step 4: UI 코드 확인
```typescript
// ComplianceCompletedList.tsx에서 확인
1. Line 466, 478, 485, 492, 500에서 status 체크 값
2. API 응답의 status 값과 정확히 일치하는가?

예시:
- API: status: "confirmed" → UI: target.status === 'confirmed' ✅
- API: status: "confirmed" → UI: target.status === 'installed' ❌ 불일치!
```

#### Step 5: 데이터베이스 직접 확인 (최후 수단)
```sql
-- target_list_devices에 매칭 데이터가 있는지 확인
SELECT
  target_institution_id,
  equipment_serial,
  matched_at
FROM target_list_devices
WHERE target_list_year = 2025
LIMIT 10;

-- 특정 기관의 매칭 확인
SELECT * FROM target_list_devices
WHERE target_institution_id = '2025-47290-18827'
  AND target_list_year = 2025;
```

## 절대 하지 말아야 할 것

### 1. 캐시 문제로 성급하게 단정하지 말 것
- 강력새로고침을 10번 해도 코드 로직 문제는 해결되지 않음
- 먼저 API 응답과 UI 조건을 검증할 것

### 2. API 코드를 무분별하게 수정하지 말 것
- API가 정상 작동 중인데도 "데이터를 안 보내주는 것"으로 오인 가능
- 서버 로그로 API 응답 구조를 먼저 확인할 것

### 3. 여러 곳을 동시에 수정하지 말 것
- 한 번에 하나씩 수정하고 테스트
- 변경 사항을 추적 가능하게 유지

### 4. 타입 정의만 믿고 실제 값을 확인하지 않는 것
```typescript
// 타입 정의
status?: 'installed' | 'not_installed' | 'pending';

// 실제 값 (런타임)
status: 'confirmed'  // ⚠️ 타입 정의와 다를 수 있음!
```

## 재발 방지 자동화 제안

### 1. TypeScript 타입 강화
```typescript
// lib/types/compliance.ts
export type ComplianceStatus = 'confirmed' | 'pending';  // 명확한 타입
export type LegacyComplianceStatus = 'installed' | 'not_installed' | 'pending';

// API 응답 타입
export interface ComplianceMatch {
  targetInstitution: TargetInstitution;
  matches: AEDMatch[];
  status: ComplianceStatus;  // ⚠️ 타입으로 강제
  confirmedBy?: string;
  confirmedAt?: Date;
}
```

### 2. 컴포넌트 주석 추가
```typescript
// ComplianceCompletedList.tsx 상단에 주석 추가
/**
 * 매칭결과 탭 컴포넌트
 *
 * 사용 API: /api/compliance/check-optimized
 * 예상 status 값: 'confirmed' | 'pending'
 *
 * ⚠️ 주의: 이 컴포넌트는 레거시 'installed' 상태를 사용하지 않습니다.
 * API가 'confirmed'를 반환하므로 UI도 'confirmed'를 체크해야 합니다.
 */
```

### 3. E2E 테스트 추가 (선택사항)
```typescript
// tests/e2e/compliance-results.spec.ts
test('매칭결과 탭에서 매칭된 데이터가 표시되어야 함', async ({ page }) => {
  await page.goto('/admin/compliance');
  await page.click('text=매칭결과');

  // 통계 확인
  const badge = await page.textContent('text=매칭완료');
  expect(badge).toContain('3');

  // 실제 데이터 표시 확인
  await page.click('text=매칭완료: 3');
  const institutionName = await page.textContent('table tbody tr:first-child td:nth-child(3)');
  expect(institutionName).not.toBe('-');
  expect(institutionName).not.toBe('매칭 없음');
});
```

## 참고 파일

- 수정된 파일: `components/admin/compliance/ComplianceCompletedList.tsx`
- API 파일: `app/api/compliance/check-optimized/route.ts`
- 레거시 API: `app/api/compliance/check/route.ts`
- 타입 정의: `components/admin/compliance/ComplianceCompletedList.tsx` (interface 섹션)

## 관련 문서

- [점검이력 필터 개선 문서](../planning/INSPECTION_HISTORY_FILTER_IMPROVEMENT.md)
- [지역 코드 가이드라인](../reference/REGION_CODE_GUIDELINES.md)

---

**작성자**: Claude Code
**검토자**: 이광성
**최종 업데이트**: 2025-11-17
**문서 버전**: 1.0.0
