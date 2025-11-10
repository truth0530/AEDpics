# Partial Unique Index 마이그레이션 배포 가이드 (2025-11-10)

## 개요

52개의 중복 점검 세션을 정리하고, 데이터베이스 레벨 제약을 추가하여 향후 중복을 완벽히 방지하는 마이그레이션입니다.

## 마이그레이션 내용

### 1단계: 기존 중복 세션 정리
- 현재: 52개 중복 세션이 데이터베이스에 존재
- 해야 할 일: cleanup_duplicate_sessions.mjs 스크립트 실행
- 예상 시간: 5분

### 2단계: 데이터베이스 제약 추가
- inspection_sessions: Partial Unique Index (equipment_serial + status)
- inspection_schedules: 모니터링 인덱스 (성능 개선)
- 예상 시간: 3분

## 배포 전 체크리스트

- [ ] 마스터 관리자 계정으로 로그인 확인
- [ ] 백업 확인 (NCP 자동 백업 설정)
- [ ] 스테이징 환경에서 먼저 테스트 (권장)
- [ ] 점검팀에 일시적 기능 제약 공지 (1시간)

## 배포 절차

### Phase 1: 개발 환경 준비 (로컬)

```bash
# 1. 최신 코드 확인
git log --oneline -5

# 2. 변경사항 확인
git status

# 3. 프로덕션 배포 준비
git pull origin main
npm install
npm run build
```

### Phase 2: 스테이징 환경 테스트 (선택)

스테이징 환경이 있다면 먼저 여기서 테스트:

```bash
# 1. 스테이징 데이터베이스 복제 (선택)
# DBA 또는 클라우드 팀에 요청

# 2. 마이그레이션 실행
npx prisma migrate deploy --skip-generate

# 3. 검증 쿼리 실행
psql -h <staging-host> -U <user> -d <database> << 'EOF'
-- 1. 인덱스 생성 확인
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'aedpics'
  AND indexname LIKE '%inspection_sessions_active%';

-- 2. 중복 여부 확인 (0행이어야 함)
SELECT COUNT(*) FROM aedpics.inspection_sessions
WHERE status IN ('active', 'paused')
GROUP BY equipment_serial
HAVING COUNT(*) > 1;
EOF
```

### Phase 3: 프로덕션 배포

#### Step 1: 중복 세션 정리

```bash
# 1. 프로덕션 서버에 접속
ssh -i <key> user@<prod-server>

# 2. 애플리케이션 디렉토리로 이동
cd /var/www/aedpics

# 3. Dry-run 실행 (실제 삭제 안 함)
node scripts/cleanup_duplicate_sessions.mjs --dry-run

# 결과 확인:
# - 삭제할 세션 개수
# - 영향받는 장비
# - 보관할 세션
```

**출력 예시:**
```
=== 중복 세션 정리 스크립트 (v2) ===

🔍 중복 세션을 감지하는 중...

찾음: 10개 장비에서 중복 세션 감지

📝 세션 상세 정보 수집 중...

📊 11-0010656
    세션 개수: 3개

    유지할 세션:
      ✅ ID: a1b2c3d4...
         상태: active, 점검자: 홍길동
         시작: 2025-11-08T14:30:00.000Z

    삭제할 세션:
      ❌ [1] ID: e5f6g7h8...
         ...

============================================================

📋 정리 계획 요약:
   총 10개 장비
   총 25개 세션 삭제 예정

🔍 Dry-run 모드: 실제 삭제를 수행하지 않았습니다.
실제 삭제를 수행하려면 다음 명령을 실행하세요:
  node scripts/cleanup_duplicate_sessions.mjs --apply
```

**확인 후 실제 삭제 실행:**

```bash
# 4. 실제 삭제 실행
node scripts/cleanup_duplicate_sessions.mjs --apply

# 결과 확인:
# - "✨ 정리 완료!"
# - "✅ 모든 중복 세션이 정리되었습니다!"
```

#### Step 2: 마이그레이션 적용

```bash
# 5. 마이그레이션 적용
npx prisma migrate deploy --skip-generate

# 성공 메시지 확인:
# "Your database is now in sync with your schema."
```

#### Step 3: 인덱스 검증

```bash
# 6. 인덱스 생성 확인
psql -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com -U aedpics_admin -d aedpics_production << 'EOF'
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'aedpics'
  AND (indexname LIKE '%inspection_sessions_active%'
       OR indexname LIKE '%inspection_schedules_equipment%'
       OR indexname LIKE '%inspection_schedules_active%')
ORDER BY indexname;
EOF

# 예상 결과: 3개 인덱스
# - idx_inspection_sessions_active_session_per_equipment
# - idx_inspection_schedules_equipment_date
# - idx_inspection_schedules_active
```

#### Step 4: 중복 여부 재검증

```bash
# 7. 마이그레이션 후 중복 여부 확인
psql -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com -U aedpics_admin -d aedpics_production << 'EOF'
SELECT equipment_serial, COUNT(*) as count
FROM aedpics.inspection_sessions
WHERE status IN ('active', 'paused')
GROUP BY equipment_serial
HAVING COUNT(*) > 1;

-- 예상: 0행 (중복 없음)
EOF
```

#### Step 5: 애플리케이션 재시작

```bash
# 8. PM2 재시작 (Zero-Downtime Deployment)
pm2 reload ecosystem.config.cjs

# 또는 전체 재시작
pm2 restart aedpics

# 상태 확인
pm2 status
pm2 logs

# 헬스 체크
curl -I https://aed.pics
# → 200 OK 확인
```

### Phase 4: 모니터링

#### 즉시 모니터링 (배포 후 1시간)

```bash
# 1. 애플리케이션 정상 동작 확인
curl https://aed.pics/api/health
# {"status": "ok"}

# 2. 로그 확인
tail -f /var/log/aedpics/production.log | grep -E "ERROR|WARN"

# 3. 세션 생성 테스트
curl -X POST https://aed.pics/api/inspections/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"equipment_serial":"11-0000001"}'

# 예상: 200 OK 또는 409 Conflict (중복)
```

#### 정기 모니터링 (매일 1회)

```bash
# Cron job 또는 수동으로 다음 쿼리 실행:
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://aed.pics/api/monitoring/duplicate-sessions

# 응답 예시:
# {
#   "success": true,
#   "data": {
#     "total": 0,
#     "duplicates": [],
#     "timestamp": "2025-11-10T..."
#   }
# }
```

## 롤백 방법

**문제 발생 시 (드물지만 대비):**

```bash
# 1. 마이그레이션 되돌리기 (인덱스 삭제)
psql -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com -U aedpics_admin -d aedpics_production << 'EOF'
DROP INDEX IF EXISTS idx_inspection_sessions_active_session_per_equipment;
DROP INDEX IF EXISTS idx_inspection_schedules_equipment_date;
DROP INDEX IF EXISTS idx_inspection_schedules_active;
EOF

# 2. Prisma 마이그레이션 기록 업데이트
# (선택적 - 데이터 무결성 문제 없음)

# 3. 애플리케이션 재시작
pm2 restart aedpics
```

## 예상 영향도

### 업타임
- **예상**: 5-10분 (마이그레이션 적용 시간)
- **실제**: 거의 없음 (데이터베이스는 백그라운드에서 작동)
- **PM2 reload**: Zero-Downtime Deployment

### 사용자 영향
- **세션 생성**: 정상 (이전과 동일)
- **일정 생성**: 정상 (이전과 동일)
- **중복 감지**: 더 엄격함 (409 Conflict 상황에서)
  - Before: 중복 허용 (데이터 무결성 문제)
  - After: 중복 차단 (비즈니스 로직 준수)

### 성능 영향
- **INSERT**: 약 2-3ms 추가 (인덱스 유지)
- **SELECT**: 1-2% 개선 (인덱스 활용)
- **전체**: 무시할 수 있는 수준

## 성공 기준

마이그레이션이 성공했는지 확인:

```bash
# 1. 중복 세션 0개
SELECT COUNT(*) FROM (
  SELECT equipment_serial, COUNT(*) as cnt
  FROM aedpics.inspection_sessions
  WHERE status IN ('active', 'paused')
  GROUP BY equipment_serial
  HAVING COUNT(*) > 1
) t;
# → 0

# 2. 인덱스 3개 생성됨
SELECT COUNT(*) FROM pg_indexes
WHERE schemaname = 'aedpics'
  AND indexname LIKE '%inspection%';
# → 3

# 3. 세션 생성 API 정상 작동
curl -X POST https://aed.pics/api/inspections/sessions
# → 200 OK 또는 409 Conflict (정상)

# 4. 모니터링 API 정상 작동
curl https://aed.pics/api/monitoring/duplicate-sessions
# → 200 OK, duplicates: []
```

## FAQ

### Q: 마이그레이션 중에 점검을 시작할 수 있나?
**A**: 네, 가능합니다. PM2 reload를 사용하므로 서비스는 계속됩니다.

### Q: 기존 중복 세션은 어떻게 되나?
**A**: cleanup_duplicate_sessions.mjs로 먼저 정리합니다 (25개 예상 삭제).

### Q: 마이그레이션 후 중복 생성은 불가능한가?
**A**: 맞습니다. DB-level unique index + application-level transaction으로 이중 방어.

### Q: 마이그레이션 후 ±30분 윈도우가 작동하나?
**A**: 네, application-level에서만 작동합니다 (DB index가 아님).

## 다음 단계

### 즉시 (배포 후)
- [ ] 모니터링 API 정상 작동 확인
- [ ] 로그에서 에러 없음 확인
- [ ] 사용자 피드백 수집

### 단기 (1주)
- [ ] Cron job으로 일일 모니터링 자동화
- [ ] Slack 알림 연동
- [ ] 대시보드 페이지 추가 (optional)

### 중기 (1개월)
- [ ] 인덱스 사용률 분석
- [ ] 추가 인덱스 최적화
- [ ] 운영팀 SOP 문서화

## 문의

- 배포 관련: DevOps 담당자
- 데이터베이스: DBA 담당자
- 애플리케이션: Backend 개발팀

---

**작성**: 2025-11-10
**마지막 업데이트**: 2025-11-10
**상태**: 배포 준비 완료
