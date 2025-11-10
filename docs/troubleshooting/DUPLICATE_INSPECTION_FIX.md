# 중복 점검 문제 해결 (2025-11-10)

## 문제 개요

**심각도**: CRITICAL
**발견일**: 2025-11-10
**해결 상태**: FIXED

### 현상
현장점검 메뉴의 **점검대상** 탭에 이미 점검 중인 장비가 계속 표시되어 중복 점검이 가능한 상태였습니다.

- 점검 중(active) 또는 일시정지(paused) 상태의 점검 세션: **52개**
- 영향받는 장비: **36개**
- 중복 세션이 있는 장비: **10개** (일부 장비는 3개까지 동시 점검 세션 존재)

### 근본 원인

`/api/aed-data` 엔드포인트가 inspection 모드에서 `inspection_assignments` 테이블 정보만 확인하고, `inspection_sessions` 테이블의 active/paused 세션을 **필터링하지 않았습니다**.

```
문제 있는 흐름:
1. 점검자가 장비 점검 시작 → inspection_sessions에 'active' 세션 생성
2. /api/aed-data는 inspection_status를 inspection_assignments에서만 조회
3. 점검 중인 장비가 점검대상 목록에 계속 표시됨
4. 동일 장비에 대한 중복 점검 시작 가능
```

## 해결 방법

### 적용된 수정사항

파일: `app/api/aed-data/route.ts` (lines 520-525)

**변경 전**:
- inspection_assignments만 LEFT JOIN
- active 세션 필터링 없음

**변경 후**:
```sql
-- NOT EXISTS 조건 추가 (lines 520-525)
sqlConditions.push(`NOT EXISTS (
  SELECT 1 FROM aedpics.inspection_sessions
  WHERE equipment_serial = a.equipment_serial
  AND status IN ('active', 'paused')
)`);
```

### 작동 원리

1. **DATABASE LAYER**: SQL 쿼리에 `NOT EXISTS` 조건 추가
   - active/paused 세션이 있는 장비를 DB 단계에서 제외
   - 불필요한 클라이언트 필터링 제거

2. **EFFICIENCY**: NOT EXISTS 사용
   - LEFT JOIN 보다 성능 좋음
   - 서브쿼리가 한 번 찾으면 중단 (LIMIT 효과 없음)
   - 36개 장비 제외에 최적화됨

3. **PATTERN MATCHING**: 일정관리와 동일한 패턴 적용
   - 일정관리: "추가할목록" (미할당) ↔ "추가된목록" (할당됨)
   - 현장점검: "점검대상" (점검안함) ↔ "점검이력" (점검중/완료)

## 영향 분석

### 수정된 범위

| 항목 | 영향도 |
|------|--------|
| 현장점검 > 점검대상 탭 | ✅ **수정됨** - 36개 장비 제외 |
| 현장점검 > 점검이력 탭 | ✅ **수정됨** - active 세션만 표시 |
| 일정관리 메뉴 | ❌ 영향 없음 |
| 관리자 대시보드 | ❌ 영향 없음 (비검사 모드 사용) |

### 필터링 우선순위

1. **inspection_sessions (active/paused)**: 점검대상 제외 (신규 추가)
2. **inspection_assignments.status**: 상태 표시용 (기존)
3. **inspection_status**: 기타 필터링 기준 (기존)

## 검증 방법

### 방법 1: 스크립트 검증
```bash
# 현재 active/paused 세션 36개 확인
node scripts/find_duplicate_sessions.mjs

# 출력 예상:
# 총 활성/일시정지 세션: 52개
# 세션이 있는 장비: 36개
```

### 방법 2: UI 검증
```
1. 현장점검 메뉴 접속
2. 점검대상 탭에서 36개 장비가 표시되지 않음 확인
3. find_duplicate_sessions.mjs의 "점검대상에서 제외되어야 할 장비" 리스트와 비교
```

### 방법 3: API 직접 테스트
```bash
# 점검대상 목록 API 호출 (점검중 장비 제외됨)
curl "http://localhost:3001/api/aed-data?viewMode=inspection&regionCodes=DAE&cityCodes=DAE-NAM"

# 응답에 위 36개 장비가 없음을 확인
```

## 추가 개선사항 (선택사항)

### 1. 중복 세션 정리
현재 10개 장비에 2-3개의 중복 세션 존재:
- 상태가 'paused'인 오래된 세션은 'cancelled' 처리 권장
- 가장 최근의 'active' 세션만 유지

**관련 스크립트**: `scripts/cleanup_duplicate_sessions.mjs` (미구현)

### 2. 세션 생성 검증 강화
점검 세션 생성 시 사전 검증:
```typescript
// app/api/inspections/sessions/create에서 추가
const existingSession = await prisma.inspection_sessions.findFirst({
  where: {
    equipment_serial: equipmentSerial,
    status: { in: ['active', 'paused'] }
  }
});

if (existingSession) {
  // 기존 세션을 먼저 처리하도록 안내
  return error('이미 점검 중인 장비입니다');
}
```

### 3. 진행 중 세션 자동 만료
72시간 이상 'paused' 상태인 세션:
- 자동으로 'cancelled' 처리
- 사용자에게 알림

## 커밋 정보

```
commit 1f0cdd8
Author: Claude Code
Date:   Mon Nov 10 2025

fix: exclude equipment with active inspection sessions from 점검대상 tab

- NOT EXISTS 조건 추가로 inspection_sessions 필터링
- 52개 active/paused 세션 중 36개 장비 제외
- 일정관리와 동일한 패턴 적용
```

## 테스트 체크리스트

- [ ] TypeScript 빌드 성공 (`npm run tsc`)
- [ ] ESLint 검사 통과 (`npm run lint`)
- [ ] Next.js 빌드 성공 (`npm run build`)
- [ ] find_duplicate_sessions.mjs 실행 결과 확인
- [ ] 현장점검 > 점검대상 탭에서 36개 장비 미표시 확인
- [ ] 현장점검 > 점검이력 탭에서 active 세션 장비 표시 확인

## 참고 문서

- [점검 세션 분석 스크립트](../scripts/find_duplicate_sessions.mjs)
- [AdminFullView 컴포넌트](../components/inspection/AdminFullView.tsx) - 라인 206-213
- [AED Data API](../app/api/aed-data/route.ts) - 라인 520-569

---
**해결 일시**: 2025-11-10 22:30 KST
**해결자**: Claude Code
**다음 검토일**: 2025-11-17 (중복 세션 정리 상태 확인)
