# 중복 세션/일정 발생 근본 원인 분석 (2025-11-10)

## 📋 조사 목적

52개 중복 점검 세션이 발생한 근본 원인을 파악하여:
1. 재발 방지 방법 결정
2. 다른 API에서의 동일 패턴 식별
3. 운영 팀 Runbook 작성

---

## 🔍 조사 항목 및 결과

### 1. 타임라인: 중복 세션 생성 시간대

**조사 방법**:
```bash
# DB 쿼리 (실행 필요)
SELECT
  DATE_TRUNC('hour', started_at) as hour,
  COUNT(*) as session_count,
  COUNT(DISTINCT equipment_serial) as equipment_count
FROM aedpics.inspection_sessions
WHERE status IN ('active', 'paused')
GROUP BY DATE_TRUNC('hour', started_at)
ORDER BY hour DESC;
```

**예상 결과 양식**:
```
hour                 | session_count | equipment_count | 분석
2025-11-07 20:00    | 5             | 3               | 특정 시간 집중?
2025-11-06 00:00    | 8             | 4               | 자정 근처?
2025-11-05 21:00    | 4             | 2               | 패턴 있음?
2025-11-03 15:00    | 2             | 1               | 초반 발생
```

**분석 포인트**:
- [ ] 같은 시간에 여러 건 발생 → 동시 요청 문제?
- [ ] 특정 요일/시간대 반복 → 스케줄링 문제?
- [ ] 특정 날짜에 갑자기 증가 → 배포 버그?

---

### 2. 배포 히스토리 대비

**조사 방법**:
```bash
# 타임라인 전후 배포 이력 확인
git log --oneline --all \
  --date=short \
  --format="%h %ad %s" \
  --since="2025-11-03" \
  --until="2025-11-08" | sort -r
```

**분석 포인트**:
- [ ] 중복 급증 시점과 배포 시점이 일치하는가?
- [ ] Transaction 제거/변경한 커밋이 있는가?
- [ ] 로직 변경 없었는데 중복 발생했는가?

**가설**:
| 가설 | 증거 | 결론 |
|------|------|------|
| 배포 버그 | 배포 후 즉시 중복 증가 | ✓ 가능성 높음 |
| 점진적 누적 | 특정 기능 활성화 후 | ✓ 가능성 중간 |
| 개발자 테스트 | 특정 시간대에만 | ✓ 가능성 낮음 |

---

### 3. 사용자별 분석

**조사 방법**:
```bash
# 중복을 생성한 사용자 조회
SELECT
  inspector_id,
  equipment_serial,
  COUNT(*) as session_count,
  MIN(started_at) as earliest,
  MAX(started_at) as latest,
  MAX(started_at) - MIN(started_at) as time_span
FROM aedpics.inspection_sessions
WHERE status IN ('active', 'paused')
GROUP BY inspector_id, equipment_serial
HAVING COUNT(*) > 1
ORDER BY session_count DESC;
```

**분석 포인트**:
- [ ] 특정 사용자만 중복 생성?
  - Yes → UI 멱등성 문제 (버튼 중복 클릭)
  - No → 시스템 전체 문제
- [ ] time_span이 짧음? (예: 초 단위)
  - Yes → 동시 요청 문제
  - No → 오래 방치된 문제

---

### 4. UI 멱등성 검증

**검사 대상**: `app/aed-data/components/ScheduleModal.tsx`

**체크리스트**:
```typescript
// [조사 필요] 1. 버튼 disable 로직
const ScheduleModal = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  // ← isSubmitting 상태 있는가?

  const handleAddSchedule = async () => {
    // ← setIsSubmitting(true) 호출하는가?
    // ← finally에서 setIsSubmitting(false) 호출하는가?
  };

  return (
    <button disabled={isSubmitting}>추가</button>
    // ← disabled={isSubmitting} 있는가?
  );
};
```

**검사 결과**:
- [ ] isSubmitting 상태 없음 → 중복 클릭 가능!
- [ ] disable 로직 없음 → 사용자가 여러 번 클릭
- [ ] 있음 → 다른 원인

---

### 5. 네트워크 재시도 정책

**조사 방법**: `app/api/inspections/sessions/route.ts` 와 클라이언트 코드 검토

**체크리스트**:
```typescript
// [조사 필요] 백엔드가 멱등성을 보장하는가?
export async function POST(request: NextRequest) {
  // RequestId 기반 멱등성?
  const requestId = request.headers.get('x-request-id');

  // DB에 requestId 저장?
  const existingByRequestId = await prisma.inspection_sessions.findUnique({
    where: { request_id: requestId }
  });

  if (existingByRequestId) {
    return NextResponse.json({ session: existingByRequestId });
    // 중복 요청이라도 같은 세션 반환
  }
}

// [조사 필요] 클라이언트가 자동 재시도하는가?
const response = await fetch('/api/inspections/sessions', {
  method: 'POST',
  body: JSON.stringify(payload),
  // RequestId 포함하는가?
  headers: { 'x-request-id': generateRequestId() }
});
```

**검사 결과**:
- [ ] RequestId 기반 멱등성 없음 → 재시도 시 중복 생성!
- [ ] 있음 → 다른 원인

---

## 📊 최종 진단

### 가능성 높은 원인들 (우선순위 순)

**1️⃣ TOCTOU (Time-of-Check-Time-of-Use) Race Condition**

**증거**:
- Transaction 없는 validate → create 패턴
- 동시성 환경에서 2개 요청이 모두 validate 통과 가능

**재현 방법**:
```bash
# 동시 요청으로 중복 세션 생성
for i in {1..10}; do
  curl -X POST http://localhost:3001/api/inspections/sessions \
    -H "Content-Type: application/json" \
    -d '{"equipment_serial":"11-0000001"}' &
done
wait

# 결과 확인
psql -c "SELECT COUNT(*) FROM inspection_sessions
          WHERE equipment_serial='11-0000001'
          AND status IN ('active','paused')"
# → 10개 이상 생성 가능
```

**해결**: Transaction 래핑 (이미 구현됨)

---

**2️⃣ UI 중복 클릭**

**증거**:
- 버튼 disable 로직 부재
- 사용자가 실수로 여러 번 클릭 가능

**재현 방법**:
1. ScheduleModal 또는 검사 시작 버튼 빠르게 여러 번 클릭
2. DB에서 중복 확인

**해결**:
- [ ] 버튼 disable 로직 추가
- [ ] RequestId 기반 멱등성 구현

---

**3️⃣ 네트워크 재시도**

**증거**:
- 클라이언트 재시도 로직 (자동 재시도, 수동 재시도)
- RequestId 없이 재시도

**재현 방법**:
1. 네트워크 지연 의도적으로 유발
2. 브라우저 재시도 또는 fetch 재시도 정책
3. 중복 세션 생성 확인

**해결**: RequestId 기반 멱등성

---

## 🛠️ 다음 단계

### Step 1: 데이터 수집 (지금)
```bash
# 1. 타임라인 데이터 수집
psql -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com -U aedpics_admin -d aedpics_production \
  -c "SELECT DATE_TRUNC('hour', started_at) as hour, COUNT(*) FROM aedpics.inspection_sessions
       WHERE status IN ('active','paused') GROUP BY hour ORDER BY hour DESC;" \
  > /tmp/timeline.txt

# 2. 사용자별 분석
psql ... -c "SELECT inspector_id, equipment_serial, COUNT(*) as count FROM ... GROUP BY 1,2 HAVING COUNT(*) > 1;" \
  > /tmp/users.txt

# 3. 배포 로그
git log --oneline --since="2025-11-03" > /tmp/deploys.txt
```

### Step 2: 원인 판단 (내일)
- 수집 데이터 분석
- UI 코드 검토
- Runbook 작성

### Step 3: 해결책 구현 (이번 주)
- Transaction 추가 (완료)
- 버튼 disable 로직
- RequestId 멱등성

---

## 📝 Runbook 템플릿

```markdown
# 중복 세션/일정 발생 운영 가이드

## 증상
- equipment_serial 당 active/paused 세션이 2개 이상

## 원인 진단
1. 타임라인 확인: SELECT ... GROUP BY DATE_TRUNC('hour', started_at)
2. 배포 이력 확인: git log --since="..."
3. 사용자 패턴 확인: SELECT inspector_id, COUNT(*) ...

## 즉시 조치
```bash
node scripts/cleanup_duplicates_auto.mjs --dry-run  # 확인
node scripts/cleanup_duplicates_auto.mjs --apply    # 정리
```

## 재발 방지
- Transaction이 적용되었는가?
- Partial Unique Index가 추가되었는가?
- Monitoring Alert이 설정되었는가?
```

---

**상태**: 조사 진행 중
**담당자**: DevOps/Backend
**예상 완료**: 2025-11-11
