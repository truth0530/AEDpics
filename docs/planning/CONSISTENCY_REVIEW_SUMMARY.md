# 일관성 검토 및 수정 완료 보고서

**작성일**: 2025-11-04
**요청**: 점검효과 페이지 다크모드 및 대시보드-점검효과 간 데이터 일관성 검토
**진행 방식**: 단계별 수정 및 잠재적 문제 재검토

## 요약

대시보드와 점검효과 페이지 간의 일관성 문제를 4단계로 나누어 검토 및 수정 완료.

### 완료된 작업
- ✅ **1단계**: KST 타임존 통일 (점검효과 API 6개 위치 수정)
- ✅ **2단계**: Performance 페이지 다크모드 수정 (4개 섹션)
- ✅ **3단계**: 캐시 전략 검토 및 문서화 (분석 문서 작성)
- ✅ **4단계**: 차트 API 구현 확인 (정상 작동 검증)

---

## 1단계: KST 타임존 통일

### 문제
점검효과 API에서 날짜 필터링 시 UTC 시간을 그대로 사용하여, 한국 시간대(KST) 기준으로 데이터를 조회할 때 시간 오차 발생

### 해결
KST (UTC+9) offset을 적용하여 날짜 범위 계산 방식 통일

### 수정 파일 및 위치

#### 1. [app/api/inspections/improvement-reports/route.ts](../../app/api/inspections/improvement-reports/route.ts)
**위치**: Lines 131-163
**내용**: 메인 리포트 API의 날짜 필터링

```typescript
// 날짜 범위 (KST 기준)
if (startDate || endDate) {
  where.inspection_time = {};
  const kstOffset = 9 * 60 * 60 * 1000; // 9시간을 밀리초로

  if (startDate) {
    try {
      // startDate의 KST 00:00:00을 UTC로 변환
      const [year, month, day] = startDate.split('-').map(Number);
      const startKST = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - kstOffset);
      where.inspection_time.gte = startKST;
    } catch (error) {
      logger.error('ImprovementReports:GET', 'startDate 파싱 실패', { startDate, error });
      where.inspection_time.gte = new Date(startDate);
    }
  }

  if (endDate) {
    try {
      // endDate의 KST 23:59:59을 UTC로 변환
      const [year, month, day] = endDate.split('-').map(Number);
      const endKST = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - kstOffset);
      where.inspection_time.lte = endKST;
    } catch (error) {
      logger.error('ImprovementReports:GET', 'endDate 파싱 실패', { endDate, error });
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.inspection_time.lte = end;
    }
  }
}
```

#### 2. [app/api/inspections/improvement-reports/charts/route.ts](../../app/api/inspections/improvement-reports/charts/route.ts)

**위치 1 (Trend)**: Lines 110-136
**내용**: 개선율 추이 차트 데이터의 날짜 필터링

```typescript
// 날짜 범위 (KST 기준)
if (startDate || endDate) {
  where.inspection_time = {};
  const kstOffset = 9 * 60 * 60 * 1000;

  if (startDate) {
    try {
      const [year, month, day] = startDate.split('-').map(Number);
      where.inspection_time.gte = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - kstOffset);
    } catch (error) {
      logger.error('ImprovementCharts:trend', 'startDate 파싱 실패', { startDate, error });
      where.inspection_time.gte = new Date(startDate);
    }
  }

  if (endDate) {
    try {
      const [year, month, day] = endDate.split('-').map(Number);
      where.inspection_time.lte = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - kstOffset);
    } catch (error) {
      logger.error('ImprovementCharts:trend', 'endDate 파싱 실패', { endDate, error });
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.inspection_time.lte = end;
    }
  }
}
```

**위치 2 (Distribution)**: Lines 214-240
**내용**: 필드별 분포도 차트 데이터의 날짜 필터링 (동일한 패턴)

#### 3. [app/api/inspections/improvement-reports/compare/route.ts](../../app/api/inspections/improvement-reports/compare/route.ts)

**위치 1 (Region Comparison)**: Lines 89-106
**내용**: 지역 간 비교 데이터의 날짜 필터링

```typescript
// 날짜 범위 (KST 기준)
if (period1Start && period1End) {
  const kstOffset = 9 * 60 * 60 * 1000; // 9시간을 밀리초로
  try {
    const [startYear, startMonth, startDay] = period1Start.split('-').map(Number);
    const [endYear, endMonth, endDay] = period1End.split('-').map(Number);
    where.inspection_time = {
      gte: new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0) - kstOffset),
      lte: new Date(Date.UTC(endYear, endMonth - 1, endDay, 23, 59, 59, 999) - kstOffset)
    };
  } catch (error) {
    logger.error('ImprovementCompare:region', '날짜 파싱 실패', { period1Start, period1End, error });
    where.inspection_time = {
      gte: new Date(period1Start),
      lte: new Date(period1End)
    };
  }
}
```

**위치 2 (Period1)**: Lines 169-192
**위치 3 (Period2)**: Lines 219-242
**내용**: 기간 간 비교 데이터의 두 기간 각각 날짜 필터링 (동일한 패턴)

### 검증
- TypeScript 컴파일: 통과
- 개발 서버: 정상 실행
- 날짜 파싱 실패 시 fallback 로직으로 안전하게 처리

---

## 2단계: Performance 페이지 다크모드 수정

### 문제
[app/(authenticated)/performance/PerformanceDashboard.tsx](../../app/(authenticated)/performance/PerformanceDashboard.tsx) 페이지에 하드코딩된 다크 컬러 사용으로 라이트 모드에서 가독성 저하

### 해결
모든 색상을 Tailwind CSS의 `dark:` prefix를 사용한 반응형 클래스로 변경

### 수정 내용

#### 1. 헤더 섹션 (Lines 82-85)
```typescript
// Before
<h1 className="text-3xl font-bold text-white mb-2">Performance Dashboard</h1>
<p className="text-gray-400">시스템 성능 및 Core Web Vitals 모니터링</p>

// After
<h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Performance Dashboard</h1>
<p className="text-gray-600 dark:text-gray-400">시스템 성능 및 Core Web Vitals 모니터링</p>
```

#### 2. Core Web Vitals 섹션 (Lines 87-128)
```typescript
// Before
<h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
<Card className="bg-gray-900 border-gray-800 p-6 animate-pulse">

// After
<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
<Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-6 animate-pulse">
```

#### 3. API Performance 섹션 (Lines 130-162)
```typescript
// Before
<p className="text-sm text-gray-400">Timestamp API</p>
<p className="text-2xl font-bold text-white">~10ms</p>
<div className="px-3 py-1 rounded bg-green-500/10 text-green-400 text-sm font-medium">

// After
<p className="text-sm text-gray-600 dark:text-gray-400">Timestamp API</p>
<p className="text-2xl font-bold text-gray-900 dark:text-gray-100">~10ms</p>
<div className="px-3 py-1 rounded bg-green-500/10 text-green-600 dark:text-green-400 text-sm font-medium">
```

#### 4. Active Optimizations 섹션 (Lines 164-202)
6개 카드 모두 동일한 패턴 적용:
```typescript
// Before
<Card className="bg-gray-900 border-gray-800 p-4">
  <h3 className="text-sm font-medium text-white mb-2">✅ Vercel Analytics</h3>
  <p className="text-xs text-gray-400">실시간 Core Web Vitals 모니터링</p>
</Card>

// After
<Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-4">
  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">✅ Vercel Analytics</h3>
  <p className="text-xs text-gray-600 dark:text-gray-400">실시간 Core Web Vitals 모니터링</p>
</Card>
```

### 색상 변환 규칙
| Before | After (Light) | After (Dark) |
|--------|---------------|--------------|
| `text-white` | `text-gray-900` | `dark:text-gray-100` |
| `text-gray-400` | `text-gray-600` | `dark:text-gray-400` |
| `bg-gray-900` | `bg-white` | `dark:bg-gray-800` |
| `border-gray-800` | `border-gray-200` | `dark:border-gray-700` |
| `text-green-400` | `text-green-600` | `dark:text-green-400` |
| `text-blue-400` | `text-blue-600` | `dark:text-blue-400` |

### 검증
- TypeScript 컴파일: 통과
- 라이트 모드: 정상 표시
- 다크 모드: 기존과 동일한 스타일 유지

---

## 3단계: 캐시 전략 검토 및 문서화

### 발견된 문제

#### 대시보드 캐싱
**파일**: [lib/aed/dashboard-queries.ts](../../lib/aed/dashboard-queries.ts)
- **방식**: React `cache()` 함수
- **지속시간**: 서버 재시작까지 (의도하지 않은 영구 캐시)
- **문제**: 새로운 점검 데이터가 반영되지 않음

#### 점검효과 캐싱
**파일**: [app/api/inspections/improvement-reports/route.ts](../../app/api/inspections/improvement-reports/route.ts)
- **방식**: LRUCache (5분 TTL)
- **지속시간**: 5분
- **장점**: 정기적으로 최신 데이터 반영

### 사용자 경험 불일치 시나리오
1. 대시보드에서 점검 현황 확인 → 10개 완료
2. 현장점검 5개 추가 수행
3. 점검효과 페이지 확인 → 15개 완료 (5분 내 갱신)
4. 대시보드로 돌아감 → 여전히 10개 (캐시 미갱신)

### 권장 해결 방안
**옵션 1 (권장)**: 대시보드도 LRUCache로 통일
- TTL: 1분 (대시보드), 5분 (점검효과)
- 일관된 사용자 경험
- 최신 데이터 보장

**옵션 2**: React cache() 유지 및 문서화
- 코드 변경 없음
- 근본적 문제 미해결

**옵션 3**: Next.js unstable_cache 사용
- Next.js 네이티브 솔루션
- unstable API 위험

### 상세 분석 문서
[CACHE_STRATEGY_ANALYSIS.md](./CACHE_STRATEGY_ANALYSIS.md) 참조

---

## 4단계: 차트 API 구현 확인

### 검증 결과: ✅ 정상 작동

#### API 엔드포인트
**파일**: [app/api/inspections/improvement-reports/charts/route.ts](../../app/api/inspections/improvement-reports/charts/route.ts)

**지원 기능**:
1. **Trend Chart** (개선율 추이)
   - 주간/월간 그룹화
   - KST 타임존 적용 (1단계에서 수정 완료)
   - ISO 8601 주 번호 계산

2. **Distribution Chart** (필드별 분포도)
   - 배터리, 패드, 관리자, 설치정보, 장비정보 카테고리별 집계
   - 개선/방치/대기 상태 구분
   - KST 타임존 적용 (1단계에서 수정 완료)

#### 프론트엔드 연동
**파일**: [components/inspections/ImprovementCharts.tsx](../../components/inspections/ImprovementCharts.tsx)

**확인 사항**:
- ✅ API 호출 정상
- ✅ 타입 정의 일치
- ✅ 다크모드 지원
- ✅ 에러 핸들링
- ✅ 로딩 상태 표시
- ✅ Recharts 차트 렌더링

---

## 전체 수정 요약

### 수정된 파일 (총 4개)
1. [app/api/inspections/improvement-reports/route.ts](../../app/api/inspections/improvement-reports/route.ts) - KST 적용
2. [app/api/inspections/improvement-reports/charts/route.ts](../../app/api/inspections/improvement-reports/charts/route.ts) - KST 적용 (2곳)
3. [app/api/inspections/improvement-reports/compare/route.ts](../../app/api/inspections/improvement-reports/compare/route.ts) - KST 적용 (3곳)
4. [app/(authenticated)/performance/PerformanceDashboard.tsx](../../app/(authenticated)/performance/PerformanceDashboard.tsx) - 다크모드 수정

### 생성된 문서 (총 2개)
1. [CACHE_STRATEGY_ANALYSIS.md](./CACHE_STRATEGY_ANALYSIS.md) - 캐시 전략 분석
2. [CONSISTENCY_REVIEW_SUMMARY.md](./CONSISTENCY_REVIEW_SUMMARY.md) - 본 문서

---

## 남은 권장 작업

### 즉시 권장
1. **대시보드 캐시 전략 변경**
   - React `cache()` → LRUCache (1분 TTL)로 변경
   - 파일: [lib/aed/dashboard-queries.ts](../../lib/aed/dashboard-queries.ts)
   - 예상 작업 시간: 1-2시간

### 장기 개선
1. **캐시 무효화 API 구축**
   - 점검 데이터 입력 시 자동 캐시 클리어
   - 관리자용 수동 클리어 버튼
   - 예상 작업 시간: 3-4시간

2. **실시간 데이터 업데이트**
   - WebSocket 또는 Server-Sent Events 활용
   - 예상 작업 시간: 1-2일

---

## 검증 내역

### TypeScript 검사
```bash
npx tsc --noEmit
```
- 결과: 통과 (수정한 파일에서 오류 없음)
- 기존 script 파일의 오류는 본 작업과 무관

### 개발 서버
```bash
npm run dev
```
- 결과: 정상 실행 (Port 3001)
- 런타임 오류 없음

### 페이지 확인
- [/performance](http://localhost:3001/performance) - 라이트/다크 모드 모두 정상
- [/inspection-effect](http://localhost:3001/inspection-effect) - 차트 데이터 로딩 정상

---

**작성자**: Claude Code
**검토 완료일**: 2025-11-04
**다음 단계**: 대시보드 캐시 전략 변경 검토 및 사용자 피드백 수집
