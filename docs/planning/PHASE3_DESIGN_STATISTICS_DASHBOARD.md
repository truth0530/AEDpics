# Phase 3: 점검 통계 대시보드 설계

**상태**: 설계 중 (운영팀 협의 진행 중)
**시작일**: 2025-11-07
**완료 예상일**: 2025-11-10
**담당**: 개발팀 (Frontend/Backend) + 운영팀 (요구사항 정의)

---

## 1. 목표

AED 점검 현황을 실시간으로 시각화하여:
- 전국 보건소(250개)의 점검 진행률 파악
- 지역별/장비별 점검 통계 분석
- 경영진 의사결정 지원 (대시보드)
- 점검 성과 모니터링

---

## 2. 요구사항 정의 (운영팀 협의 예정)

### 2.1 핵심 지표 (Key Metrics)

**현재 예상** (확정 대기):

#### 상위 레벨 지표
```
전국 현황 (Master 계정):
├── 전체 AED 개수: 81,464대
├── 점검 완료: 32건 (0.04%) ← 현재 상태
├── 점검 미실시: 81,432건 (99.96%)
├── 평균 점검율: 0.04%
└── 점검 필요 장비: 81,464대 (모두)

지역별 현황:
├── 서울특별시: 9,500대 (점검 8건)
├── 부산광역시: 6,200대 (점검 3건)
├── 대구광역시: 4,800대 (점검 5건)
├── ... (17개 시도)
└── 미분류: 0대
```

#### 세부 지표
```
점검 현황:
├── 점검 완료: 32건
├── 진행 중: 0건
├── 예정: N건
└── 지연: 0건

장비 상태 분포:
├── 정상: N대
├── 이상: N대
├── 미점검: 81,432대
└── 폐기: 0대

점검 품질:
├── 문제 발견율: X%
├── 평균 점검 시간: Xmin
├── 평균 사진 수: 3.0장
└── 점검 일치율: (검증 예정)
```

### 2.2 사용자별 권한 (Permission-based Access)

```
Master (중앙응급의료센터):
├── 전체 시도 선택 가능
├── 전국 통계 조회
├── 시도별 상세 분석
├── 다운로드: CSV/PDF 모두 가능
└── 비교 분석: 연도별, 월별, 지역별

Regional (시도 응급의료지원센터):
├── 자신의 시도만 조회
├── 하위 시군구 상세 분석
├── 다운로드: CSV 만 가능
└── 비교 분석: 월별, 시군구별

Local (보건소):
├── 자신의 시군구만 조회
├── 장비 목록 (점검 이력 포함)
├── 다운로드: 불가능
└── 비교 분석: 없음 (자신의 데이터만)
```

---

## 3. UI/UX 설계

### 3.1 대시보드 레이아웃

```
┌─────────────────────────────────────────────────────────┐
│ 점검 통계 대시보드 (2025-11-07)                         │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ [필터] 시도: [전체▼] 기간: [이번달▼] 새로고침[↻]       │
│                                                           │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ ┌─────────────────┬─────────────────┬─────────────────┐ │
│ │ 전국 현황       │ 점검 완료       │ 평균 점검율     │ │
│ │ 81,464대        │ 32건            │ 0.04%           │ │
│ └─────────────────┴─────────────────┴─────────────────┘ │
│                                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 지역별 점검 현황 (막대 그래프)                        │ │
│ │                                                       │ │
│ │ 서울  ████████░░░░ 45/500 (9%)                      │ │
│ │ 부산  █████░░░░░░░ 23/400 (5%)                      │ │
│ │ 대구  ██████░░░░░░ 28/350 (8%)                      │ │
│ │ ... (17개 시도)                                      │ │
│ │                                                       │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                           │
│ ┌──────────────────┬──────────────────────────────────┐ │
│ │ 월별 점검 추이    │ 장비 상태 분포                   │ │
│ │ (꺾은선 그래프)   │ (원형 그래프)                    │ │
│ │                  │                                  │ │
│ │ 10월: 25건       │ 정상: 50%  ◐                    │ │
│ │ 11월: 7건        │ 이상: 10%  ◑                    │ │
│ │                  │ 미점검: 40% ◑                   │ │
│ └──────────────────┴──────────────────────────────────┘ │
│                                                           │
│ [CSV] [PDF] [공유]                                      │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 3.2 상세 보기 (Drill-down)

```
사용자: Master 계정
선택: 서울특별시

┌─────────────────────────────────────────────────────────┐
│ 서울특별시 상세 현황 (2025-11-07)                       │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ 전체: 9,500대 | 점검 완료: 45건 | 점검율: 0.48%        │
│                                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 시군구별 점검 현황                                   │ │
│ │                                                       │ │
│ │ 강남구    [█████░░░░░░░░░░░░░] 50/500 (10%)        │ │
│ │ 강동구    [███░░░░░░░░░░░░░░░░] 30/400 (7%)        │ │
│ │ 강북구    [██░░░░░░░░░░░░░░░░░] 15/350 (4%)        │ │
│ │ 강서구    [████░░░░░░░░░░░░░░░] 35/450 (7%)        │ │
│ │ 관악구    [█░░░░░░░░░░░░░░░░░░] 10/380 (2%)        │ │
│ │ ... (25개 구)                                       │ │
│ │                                                       │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                           │
│ [뒤로가기]                                               │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## 4. 데이터 모델 및 계산

### 4.1 기본 통계 쿼리

```sql
-- 1. 전국 현황 (Master)
SELECT
  COUNT(DISTINCT id) as total_aed,
  COUNT(DISTINCT CASE WHEN inspections.id IS NOT NULL THEN aed_data.id END) as inspected_aed,
  COUNT(inspections.id) as total_inspections,
  ROUND(
    COUNT(DISTINCT CASE WHEN inspections.id IS NOT NULL THEN aed_data.id END)::numeric /
    COUNT(DISTINCT id) * 100, 2
  ) as inspection_percentage
FROM aed_data
LEFT JOIN inspections ON aed_data.id = inspections.aed_data_id;

-- 결과: 81,464 | 32 | 32 | 0.04%

-- 2. 시도별 현황
SELECT
  aed_data.sido,
  COUNT(DISTINCT aed_data.id) as total_aed,
  COUNT(DISTINCT CASE WHEN inspections.id IS NOT NULL THEN aed_data.id END) as inspected_aed,
  COUNT(inspections.id) as total_inspections,
  ROUND(
    COUNT(DISTINCT CASE WHEN inspections.id IS NOT NULL THEN aed_data.id END)::numeric /
    COUNT(DISTINCT aed_data.id) * 100, 2
  ) as inspection_percentage
FROM aed_data
LEFT JOIN inspections ON aed_data.id = inspections.aed_data_id
GROUP BY aed_data.sido
ORDER BY inspection_percentage DESC;

-- 3. 시군구별 현황
SELECT
  aed_data.sido,
  aed_data.gugun,
  COUNT(DISTINCT aed_data.id) as total_aed,
  COUNT(DISTINCT CASE WHEN inspections.id IS NOT NULL THEN aed_data.id END) as inspected_aed,
  COUNT(inspections.id) as total_inspections,
  ROUND(
    COUNT(DISTINCT CASE WHEN inspections.id IS NOT NULL THEN aed_data.id END)::numeric /
    COUNT(DISTINCT aed_data.id) * 100, 2
  ) as inspection_percentage
FROM aed_data
LEFT JOIN inspections ON aed_data.id = inspections.aed_data_id
GROUP BY aed_data.sido, aed_data.gugun
ORDER BY aed_data.sido, inspection_percentage DESC;

-- 4. 월별 점검 추이 (최근 12개월)
SELECT
  DATE_TRUNC('month', inspections.created_at) as month,
  COUNT(DISTINCT inspections.id) as inspection_count,
  COUNT(DISTINCT aed_data.id) as aed_count,
  ROUND(
    COUNT(DISTINCT aed_data.id)::numeric /
    (SELECT COUNT(DISTINCT id) FROM aed_data) * 100, 2
  ) as percentage
FROM inspections
LEFT JOIN aed_data ON inspections.aed_data_id = aed_data.id
WHERE inspections.created_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', inspections.created_at)
ORDER BY month DESC;

-- 5. 장비 상태 분포
SELECT
  CASE
    WHEN inspections.overall_status = 'PASS' THEN '정상'
    WHEN inspections.overall_status = 'FAIL' THEN '이상'
    ELSE '미점검'
  END as status,
  COUNT(DISTINCT aed_data.id) as aed_count,
  ROUND(COUNT(DISTINCT aed_data.id)::numeric / 81464 * 100, 2) as percentage
FROM aed_data
LEFT JOIN inspections ON aed_data.id = inspections.aed_data_id
GROUP BY status;
```

### 4.2 계산 복잡도 분석

```
쿼리 성능 (81,464 AED + 32 Inspection 기준):

1. 전국 현황: O(n) = ~10ms
2. 시도별 현황: O(n) GROUP BY = ~50ms
3. 시군구별 현황: O(n) GROUP BY = ~100ms
4. 월별 추이: O(n) GROUP BY + ORDER = ~30ms
5. 장비 상태: O(n) GROUP BY = ~20ms

캐싱 전략:
- 실시간 (새로고침): 각 쿼리 <100ms, 총 <300ms
- 캐시 (1시간): Redis에 JSON 저장, 즉시 반환
- 백그라운드 갱신: 1시간마다 자동 계산

목표 응답 시간: <1초 (캐시), <3초 (실시간 계산)
```

---

## 5. 기술 구현 전략

### 5.1 Frontend 구성

```typescript
// components/statistics/StatisticsDashboard.tsx
interface DashboardProps {
  userRole: UserRole;  // Master, Regional, Local
  selectedRegion?: RegionCode;
  period?: DateRange;
}

export function StatisticsDashboard({ userRole, selectedRegion, period }: DashboardProps) {
  // 1. 데이터 로딩
  const statistics = useStatistics({
    role: userRole,
    region: selectedRegion,
    period
  });

  // 2. 권한 기반 필터링
  const availableRegions = getAvailableRegions(userRole);
  const canDownload = userRole !== 'local_admin';

  // 3. UI 렌더링
  return (
    <DashboardLayout>
      <FilterBar
        availableRegions={availableRegions}
        onFilterChange={handleFilterChange}
      />
      <MetricsCards statistics={statistics} />
      <Charts data={statistics} />
      <DetailTable data={statistics.details} />
      {canDownload && <ExportButtons statistics={statistics} />}
    </DashboardLayout>
  );
}
```

**컴포넌트 구조**:
```
StatisticsDashboard
├── FilterBar (필터 선택)
├── MetricsCards (핵심 수치)
│   ├── TotalAEDCard
│   ├── InspectionCompleteCard
│   ├── InspectionRateCard
│   └── StatusDistributionCard
├── Charts (시각화)
│   ├── RegionalBarChart (지역별 막대)
│   ├── TrendLineChart (월별 추이)
│   └── StatusPieChart (상태 원형)
├── DetailTable (상세 데이터)
└── ExportButtons (내보내기)
```

### 5.2 Backend API 설계

```typescript
// app/api/statistics/dashboard/route.ts
export async function GET(request: Request) {
  const session = await getServerSession();
  const { role, regionCode, period } = parseQuery(request);

  // 권한 검증
  if (!canAccessRegion(session.user, regionCode)) {
    return new Response('Unauthorized', { status: 403 });
  }

  // 캐시 확인
  const cached = await cache.get(`stats:${regionCode}:${period}`);
  if (cached) return Response.json(cached);

  // 데이터 계산
  const statistics = await calculateStatistics({
    regionCode,
    period,
    role
  });

  // 캐시 저장 (1시간)
  await cache.set(
    `stats:${regionCode}:${period}`,
    statistics,
    { ttl: 3600 }
  );

  return Response.json(statistics);
}

interface StatisticsResponse {
  overview: {
    totalAED: number;
    inspectedAED: number;
    totalInspections: number;
    inspectionRate: number;
  };
  regional: RegionalStatistic[];
  monthly: MonthlyStatistic[];
  statusDistribution: StatusDistribution[];
  lastUpdated: Date;
}
```

### 5.3 캐싱 전략

```typescript
// lib/utils/cache-strategy.ts
export class StatisticsCache {
  private readonly CACHE_TTL = 3600;  // 1시간

  async getOrCompute(
    key: string,
    computeFn: () => Promise<any>
  ): Promise<any> {
    // 1. Redis에서 조회
    const cached = await redis.get(key);
    if (cached) {
      logger.info(`Cache hit: ${key}`);
      return JSON.parse(cached);
    }

    // 2. 캐시 미스: 계산
    logger.info(`Cache miss: ${key}, computing...`);
    const result = await computeFn();

    // 3. 캐시 저장
    await redis.set(
      key,
      JSON.stringify(result),
      { EX: this.CACHE_TTL }
    );

    return result;
  }

  // 백그라운드 갱신 (1시간마다)
  async startBackgroundRefresh() {
    setInterval(async () => {
      try {
        // 주요 캐시 키 갱신
        const keys = [
          'stats:ALL:current_month',
          'stats:ALL:current_year',
          ...this.getRegionalKeys()
        ];

        for (const key of keys) {
          await this.getOrCompute(key, () => calculateStatistics(key));
        }

        logger.info('Background cache refresh completed');
      } catch (error) {
        logger.error('Background cache refresh failed:', error);
      }
    }, 3600000);  // 1시간
  }
}
```

---

## 6. 시각화 라이브러리 선택

### 6.1 후보 검토

| 라이브러리 | 장점 | 단점 | 추천 |
|-----------|------|------|------|
| **recharts** | React 친화적, 간단함 | 커스터마이징 제한 | ★★★★★ |
| **chart.js** | 가볍고, 빠름 | React 바인딩 필요 | ★★★★☆ |
| **D3.js** | 강력한 커스터마이징 | 학습곡선 높음 | ★★☆☆☆ |
| **visx** | 고급 그래프 | 설정 복잡 | ★★★☆☆ |

**결론**: **recharts** 사용 (shadcn/ui와 호환성 우수)

### 6.2 그래프 구현 예제

```typescript
// components/statistics/RegionalBarChart.tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

export function RegionalBarChart({ data }: { data: RegionalStatistic[] }) {
  return (
    <div className="w-full h-96">
      <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
        <XAxis
          dataKey="regionName"
          angle={-45}
          textAnchor="end"
          height={100}
        />
        <YAxis />
        <Tooltip
          content={({ active, payload }) => (
            active && payload ? (
              <div className="bg-white p-3 border rounded shadow">
                <p className="font-semibold">{payload[0].payload.regionName}</p>
                <p className="text-sm">점검완료: {payload[0].value}건</p>
                <p className="text-sm">점검율: {payload[0].payload.rate}%</p>
              </div>
            ) : null
          )}
        />
        <Legend />
        <Bar dataKey="inspectedCount" fill="#3b82f6" name="점검완료" />
        <Bar dataKey="totalCount" fill="#e5e7eb" name="전체" />
      </BarChart>
    </div>
  );
}
```

---

## 7. 내보내기 기능 (Export)

### 7.1 CSV 내보내기

```typescript
// lib/utils/export-statistics.ts
export async function exportToCSV(
  statistics: StatisticsResponse,
  fileName: string
): Promise<Blob> {
  const rows = [
    // 헤더
    ['지역', '전체 AED', '점검완료', '점검율(%)', '점검 현황'],
    '',

    // 시도별 데이터
    ...statistics.regional.map(r => [
      r.regionName,
      r.totalAED,
      r.inspectedAED,
      r.inspectionRate,
      r.status
    ]),

    // 요약
    '',
    ['합계', statistics.overview.totalAED, statistics.overview.inspectedAED, statistics.overview.inspectionRate, 'SUMMARY']
  ];

  // CSV 변환
  const csv = rows
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  // UTF-8 BOM 추가 (Excel 한글 호환)
  const BOM = '\uFEFF';
  return new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
}

export async function exportToPDF(
  statistics: StatisticsResponse,
  fileName: string
): Promise<Blob> {
  // 라이브러리: html2pdf, pdfkit
  // 구현: 대시보드 HTML을 PDF로 변환
  // (상세 구현은 추후)
}
```

### 7.2 내보내기 UI

```typescript
export function ExportButtons({ statistics }: { statistics: StatisticsResponse }) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const blob = await exportToCSV(statistics, 'statistics.csv');
      downloadBlob(blob, 'statistics.csv');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const blob = await exportToPDF(statistics, 'statistics.pdf');
      downloadBlob(blob, 'statistics.pdf');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        onClick={handleExportCSV}
        disabled={isExporting}
        variant="outline"
      >
        CSV 다운로드
      </Button>
      <Button
        onClick={handleExportPDF}
        disabled={isExporting}
        variant="outline"
      >
        PDF 다운로드
      </Button>
    </div>
  );
}
```

---

## 8. 성능 목표

### 8.1 로딩 속도

```
초기 로드 (First Contentful Paint):
- 캐시 히트: <500ms
- 캐시 미스 (실시간 계산): <3초

상호작용 (Interactive):
- 필터 변경: <500ms (캐시)
- 지역 드릴다운: <1초

그래프 렌더링:
- recharts 렌더링: <200ms
- 애니메이션: <300ms
```

### 8.2 메모리 사용

```
데이터 크기:
- 전국 통계: ~50KB (JSON)
- 지역별 통계: ~500KB (17개 시도 × 30KB)
- 월별 추이 (12개월): ~20KB
- 총 예상: ~1MB (메모리)

캐시 메모리:
- Redis: 5-10MB (모든 지역 × 기간 조합)
```

---

## 9. 구현 일정 (2주)

### 9.1 Week 1 (11-10 ~ 11-14)

```
Mon 11-10:
  □ 운영팀 요구사항 확정 (협의)
  □ 필터 & 지표 정의 완료
  □ UI 목업 완성

Tue 11-11:
  □ Backend 쿼리 작성 및 테스트
  □ API 엔드포인트 구현
  □ 캐싱 로직 구현

Wed 11-12:
  □ Frontend 컴포넌트 구현
  □ 그래프 렌더링 (recharts)
  □ 필터 기능 구현

Thu 11-13:
  □ 내보내기 기능 (CSV)
  □ 권한 검증 통합
  □ 스타일링 & 반응형 설계

Fri 11-14:
  □ 통합 테스트
  □ 성능 최적화
  □ 운영팀 검수
```

### 9.2 Week 2 (11-17 ~ 11-21)

```
Mon 11-17:
  □ PDF 내보내기 구현
  □ 부가 기능 (비교, 트렌드)

Tue 11-18:
  □ 모바일 반응형 최적화
  □ 접근성 개선

Wed 11-19:
  □ 최종 QA
  □ 버그 수정

Thu 11-20:
  □ 성능 벤치마크
  □ 부하 테스트 (250개 보건소)

Fri 11-21:
  □ 배포 준비
  □ 운영 매뉴얼 작성
```

---

## 10. 필요한 리소스

| 리소스 | 담당 | 예상 시간 |
|--------|------|---------|
| 요구사항 정의 | 운영팀 | 2시간 |
| Backend 개발 | Backend | 8시간 |
| Frontend 개발 | Frontend | 12시간 |
| 테스트 & QA | QA | 4시간 |
| 성능 최적화 | DevOps | 2시간 |
| 문서화 | 모든 팀 | 2시간 |

**총 예상**: 약 30시간 개발 + 2주 병렬 운영

---

## 11. 위험 분석

| # | 위험 | 확률 | 영향 | 완화 방안 |
|---|------|------|------|---------|
| 1 | 운영팀 요구사항 변경 | 중간 | 높음 | 조기 협의, 프로토타입 검증 |
| 2 | 대용량 데이터 성능 저하 | 낮음 | 높음 | 캐싱, 페이지네이션, 인덱스 |
| 3 | 그래프 렌더링 성능 | 중간 | 낮음 | 데이터 샘플링, 가상화 |
| 4 | 권한 검증 누락 | 낮음 | 높음 | 철저한 테스트, 코드 리뷰 |
| 5 | 내보내기 기능 실패 | 낮음 | 중간 | 비동기 처리, 에러 핸들링 |
| 6 | 모바일 UI 깨짐 | 중간 | 중간 | 반응형 테스트, 기기별 검증 |
| 7 | 캐시 불일치 문제 | 낮음 | 중간 | 캐시 무효화 전략, 모니터링 |
| 8 | 데이터 동기화 지연 | 낮음 | 낮음 | 백그라운드 갱신, 알림 |

---

## 12. 마이그레이션 후 검토

### 12.1 성공 기준

- [ ] 모든 지표 정확성 검증 (수동 샘플 검증)
- [ ] 응답 시간 <1초 (캐시), <3초 (실시간)
- [ ] 캐시 히트율 >95%
- [ ] 모바일 UI 반응 양호
- [ ] 사용자 만족도 >80% (피드백)
- [ ] 버그 0건 (1주 모니터링)

### 12.2 개선 기회

```
향후 개선 계획:
- [ ] AI 기반 이상 감지
- [ ] 예측 분석 (미래 점검율 예측)
- [ ] 공유 기능 (URL 기반)
- [ ] 커스텀 리포트 (필터 저장)
- [ ] 실시간 알림 (목표 미달시)
- [ ] 벤치마킹 (타 지역 비교)
```

---

## 13. 진행 상황 추적

### 13.1 현재 상태 (2025-11-07)

```
[━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━] 5% - 설계 중
```

### 13.2 다음 단계

- [ ] 운영팀 협의 (Thu 11-10 또는 Fri 11-11)
  - 핵심 지표 확정
  - 권한 정책 확인
  - UI 목업 검증
- [ ] Backend 개발 시작 (Mon 11-11)
- [ ] Frontend 개발 시작 (Tue 11-12)
- [ ] 통합 테스트 (Fri 11-15)

---

## 14. TBD (협의 필요)

```
[ ] 운영팀이 원하는 핵심 지표는 무엇인가?
    - 현재 예상: 점검율, 지역별 분석, 월별 추이
    - 추가 필요: 비용 분석, ROI 계산?

[ ] 권한 정책 최종 확인
    - Master: 전체 조회
    - Regional: 자신의 시도만
    - Local: 자신의 지역만 (조회만, 내보내기 불가)

[ ] 데이터 갱신 주기
    - 실시간 (매 요청마다)
    - 캐시 (1시간마다)
    - 일일 배치 (자정마다)

[ ] 비교 분석 필요 여부
    - Master/Regional: 지난달 대비, 전년동기 대비?
    - 알고리즘: 전월 대비, YoY (Year-over-Year)?

[ ] 알림 기능 필요 여부
    - 미션 미달시 알림?
    - 이상 감지시 알림?

[ ] 프린트/내보내기 형식
    - CSV만? PDF도?
    - 이메일 자동 발송?
```

---

**문서 버전**: 1.0.0
**상태**: Draft (운영팀 협의 대기)
**다음 검토**: 2025-11-10 (운영팀 협의 후)
**담당자**: 개발팀 (Frontend/Backend) + 운영팀

