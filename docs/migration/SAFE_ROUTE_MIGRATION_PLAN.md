# 안전한 Inspection Sessions Route 마이그레이션 계획

## 개요
inspection sessions API의 안전한 개선을 위한 단계별 마이그레이션 계획입니다.

## 주요 개선 사항

### 1. 트랜잭션 범위 확대
- **문제**: assignment 업데이트가 트랜잭션 외부에서 실행 (데이터 불일치 위험)
- **해결**: 트랜잭션 내부로 이동하여 원자성 보장

### 2. 중복 세션 방지
- **문제**: 동시 요청 시 중복 세션 생성 가능
- **해결**: 활성 세션 체크 로직 추가

### 3. DELETE 트랜잭션 처리
- **문제**: 세션과 assignment 업데이트가 별도 실행
- **해결**: 트랜잭션으로 통합

## 마이그레이션 단계

### Phase 1: 백업 및 준비 (5분)
```bash
# 1. 현재 파일 백업
cp app/api/inspections/sessions/route.ts app/api/inspections/sessions/route.backup.ts

# 2. 개선된 파일 검증
npm run tsc -- --noEmit app/api/inspections/sessions/route-improved.ts

# 3. import 검증
grep -E "import.*from" app/api/inspections/sessions/route-improved.ts
```

### Phase 2: 로컬 테스트 (15분)
```bash
# 1. 로컬 환경 설정
cp .env.production .env.local

# 2. 개발 서버 시작
npm run dev

# 3. 테스트 실행
npm run test:sessions
```

### Phase 3: 단계적 적용 (10분)

#### Option A: Blue-Green 배포 (권장)
```bash
# 1. 개선된 라우트를 새 엔드포인트로 배포
cp app/api/inspections/sessions/route-improved.ts \
   app/api/inspections/sessions-v2/route.ts

# 2. 클라이언트에서 점진적 전환
# - 10% 트래픽 → sessions-v2
# - 모니터링 30분
# - 50% 트래픽 → sessions-v2
# - 모니터링 30분
# - 100% 트래픽 → sessions-v2

# 3. 안정화 후 기존 엔드포인트 교체
mv app/api/inspections/sessions/route.ts \
   app/api/inspections/sessions/route.old.ts

mv app/api/inspections/sessions/route-improved.ts \
   app/api/inspections/sessions/route.ts
```

#### Option B: 직접 교체 (빠른 적용)
```bash
# 1. 백업
cp app/api/inspections/sessions/route.ts \
   app/api/inspections/sessions/route.$(date +%Y%m%d_%H%M%S).backup

# 2. 교체
cp app/api/inspections/sessions/route-improved.ts \
   app/api/inspections/sessions/route.ts

# 3. 빌드 및 배포
npm run build
git add app/api/inspections/sessions/route.ts
git commit -m "fix: Apply transaction improvements to inspection sessions"
git push
```

### Phase 4: 검증 (10분)

#### 기능 테스트
1. **새 세션 생성**
   - 정상 생성 확인
   - 중복 생성 방지 확인

2. **세션 완료**
   - inspection 레코드 생성 확인
   - assignment 상태 변경 확인
   - 트랜잭션 롤백 시나리오 확인

3. **세션 취소**
   - 상태 변경 확인
   - assignment 복구 확인

#### 모니터링
```bash
# PM2 로그 모니터링
pm2 logs aedpics --lines 100

# 에러 로그 확인
grep -i error /var/log/aedpics/*.log

# 데이터베이스 확인
psql $DATABASE_URL -c "
SELECT
  COUNT(*) as total,
  status,
  COUNT(DISTINCT inspector_id) as unique_inspectors
FROM aedpics.inspection_sessions
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY status;
"
```

## 롤백 계획

### 즉시 롤백 (1분)
```bash
# 백업 파일로 복원
cp app/api/inspections/sessions/route.backup.ts \
   app/api/inspections/sessions/route.ts

# 재배포
npm run build
pm2 reload aedpics
```

### 데이터 복구
```sql
-- 트랜잭션 실패로 인한 불일치 데이터 확인
SELECT
  s.id,
  s.equipment_serial,
  s.status as session_status,
  a.status as assignment_status
FROM aedpics.inspection_sessions s
LEFT JOIN aedpics.inspection_assignments a
  ON s.equipment_serial = a.equipment_serial
  AND s.inspector_id = a.assigned_to
WHERE s.status = 'completed'
  AND a.status != 'completed'
  AND s.completed_at > NOW() - INTERVAL '1 hour';

-- 필요시 수동 정합성 복구
UPDATE aedpics.inspection_assignments
SET status = 'completed',
    completed_at = NOW()
WHERE equipment_serial IN (
  SELECT equipment_serial
  FROM aedpics.inspection_sessions
  WHERE status = 'completed'
    AND completed_at > NOW() - INTERVAL '1 hour'
);
```

## 위험 평가

### 낮은 위험
- 코드 변경이 주로 트랜잭션 범위 조정
- 기존 로직은 대부분 유지
- 추가된 로직은 방어적 프로그래밍

### 중간 위험
- 트랜잭션 타임아웃 가능성 (10초로 설정)
- 동시성 증가 시 락 경합 가능

### 완화 전략
- 트랜잭션 격리 수준을 ReadCommitted로 설정
- 타임아웃 및 재시도 로직 구현
- 상세한 로깅으로 문제 추적 가능

## 성공 지표

### 즉시 확인 (배포 후 10분)
- [ ] 에러율 증가 없음
- [ ] 응답 시간 변화 없음 (<500ms)
- [ ] 새 세션 생성 정상
- [ ] 세션 완료 처리 정상

### 단기 확인 (배포 후 1시간)
- [ ] 중복 세션 0건
- [ ] 트랜잭션 실패율 <1%
- [ ] assignment 정합성 100%

### 장기 확인 (배포 후 24시간)
- [ ] 데이터 불일치 보고 0건
- [ ] 성능 저하 없음
- [ ] 사용자 불만 없음

## 담당자 연락처
- 개발: truth0530@nmc.or.kr
- 모니터링: 24/7 Slack Alert Channel
- 긴급 연락: PM2 자동 알림 설정

## 참고 문서
- [원본 분석 문서](INSPECTION_DATA_FLOW_ANALYSIS_2025-11-05.md)
- [코드 개선 파일](../../app/api/inspections/sessions/route-improved.ts)
- [테스트 스크립트](../../scripts/test/test-inspection-sessions.ts)

---

**작성일**: 2025-11-05
**작성자**: 최고의 개발자
**검토**: 기존 개발자들의 의도를 존중하며 신중하게 작성됨