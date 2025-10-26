# 모니터링 가이드

**작성일**: 2025-10-26
**버전**: 1.0.0

## 개요

AEDpics 프로덕션 환경의 모니터링 및 알림 시스템 설정 가이드입니다.

## 1. Health Check API

### 엔드포인트

`GET /api/health`

### 응답 예시 (정상)

```json
{
  "status": "healthy",
  "timestamp": "2025-10-26T10:30:00.000Z",
  "uptime": 86400,
  "responseTime": "25ms",
  "database": {
    "status": "connected",
    "organizations": 291,
    "users": 24,
    "aedDevices": 81443
  },
  "environment": "production",
  "version": "1.0.0"
}
```

### 응답 예시 (비정상)

```json
{
  "status": "unhealthy",
  "timestamp": "2025-10-26T10:30:00.000Z",
  "uptime": 86400,
  "responseTime": "5000ms",
  "database": {
    "status": "disconnected",
    "error": "Connection timeout"
  },
  "environment": "production"
}
```

HTTP Status: 503 Service Unavailable

### 사용 방법

```bash
# 로컬 테스트
curl http://localhost:3000/api/health

# 프로덕션 테스트
curl https://aedpics.nmc.or.kr/api/health
```

## 2. PM2 모니터링

### 2.1 실시간 모니터링

```bash
# PM2 대시보드
pm2 monit

# 프로세스 상태
pm2 status

# 실시간 로그
pm2 logs aedpics

# 최근 100줄 로그
pm2 logs aedpics --lines 100

# 에러 로그만 보기
pm2 logs aedpics --err
```

### 2.2 메트릭 확인

```bash
# CPU, 메모리 사용량
pm2 status

# 상세 정보
pm2 show aedpics

# 프로세스 목록
pm2 list
```

### 2.3 로그 로테이션

```bash
# pm2-logrotate 설치
npm install -g pm2-logrotate

# 설정
pm2 set pm2-logrotate:max_size 10M      # 최대 로그 파일 크기
pm2 set pm2-logrotate:retain 30         # 보관 기간 (일)
pm2 set pm2-logrotate:compress true     # 압축 사용
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss

# 설정 확인
pm2 conf pm2-logrotate
```

## 3. Nginx 모니터링

### 3.1 접근 로그

```bash
# 실시간 접근 로그
sudo tail -f /var/log/nginx/aedpics_access.log

# 최근 100줄
sudo tail -n 100 /var/log/nginx/aedpics_access.log

# 특정 IP 필터링
sudo grep "192.168.1.1" /var/log/nginx/aedpics_access.log
```

### 3.2 에러 로그

```bash
# 실시간 에러 로그
sudo tail -f /var/log/nginx/aedpics_error.log

# 최근 에러 50개
sudo tail -n 50 /var/log/nginx/aedpics_error.log
```

### 3.3 접속 통계

```bash
# 가장 많이 접속한 IP Top 10
awk '{print $1}' /var/log/nginx/aedpics_access.log | sort | uniq -c | sort -nr | head -10

# 가장 많이 요청된 URL Top 10
awk '{print $7}' /var/log/nginx/aedpics_access.log | sort | uniq -c | sort -nr | head -10

# HTTP 상태 코드 통계
awk '{print $9}' /var/log/nginx/aedpics_access.log | sort | uniq -c | sort -nr
```

## 4. 시스템 리소스 모니터링

### 4.1 CPU 사용률

```bash
# htop (대화형)
htop

# top (기본)
top

# CPU 정보
lscpu

# 현재 CPU 사용률
mpstat 1 5  # 1초 간격, 5회
```

### 4.2 메모리 사용률

```bash
# 메모리 상태
free -h

# 메모리 상세 정보
cat /proc/meminfo

# 프로세스별 메모리 사용
ps aux --sort=-%mem | head -10
```

### 4.3 디스크 사용률

```bash
# 디스크 사용량
df -h

# 디렉토리별 용량
du -sh /var/www/aedpics/*
du -sh /var/backups/aedpics/*

# 큰 파일 찾기
find /var -type f -size +100M -exec ls -lh {} \;
```

### 4.4 네트워크 모니터링

```bash
# 네트워크 연결 상태
netstat -tuln

# 특정 포트 확인
sudo netstat -tuln | grep :3000
sudo netstat -tuln | grep :443

# 네트워크 트래픽
iftop  # 설치 필요: sudo apt install iftop
```

## 5. 데이터베이스 모니터링

### 5.1 연결 확인

```bash
PGPASSWORD='AEDpics2025*NCP' psql \
  -h pg-3aqmb1.vpc-pub-cdb-kr.ntruss.com \
  -U aedpics_admin \
  -d aedpics_production \
  -p 5432 \
  -c "SELECT 1;"
```

### 5.2 활성 연결 수

```sql
SELECT
  count(*) as active_connections
FROM pg_stat_activity
WHERE datname = 'aedpics_production';
```

### 5.3 테이블 크기

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'aedpics'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 5.4 느린 쿼리 확인

```sql
-- 실행 시간이 긴 쿼리
SELECT
  pid,
  now() - query_start as duration,
  query
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - query_start > interval '1 second'
ORDER BY duration DESC;
```

## 6. 애플리케이션 메트릭

### 6.1 사용자 통계

```sql
-- 전체 사용자 수
SELECT COUNT(*) FROM aedpics.user_profiles;

-- 역할별 사용자 수
SELECT role, COUNT(*)
FROM aedpics.user_profiles
GROUP BY role;

-- 최근 7일 가입자
SELECT COUNT(*)
FROM aedpics.user_profiles
WHERE created_at >= NOW() - INTERVAL '7 days';
```

### 6.2 AED 장치 통계

```sql
-- 전체 AED 수
SELECT COUNT(*) FROM aedpics.aed_data;

-- 시도별 AED 수
SELECT sido, COUNT(*)
FROM aedpics.aed_data
GROUP BY sido
ORDER BY COUNT(*) DESC;

-- GPS 좌표 보유율
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN longitude IS NOT NULL AND latitude IS NOT NULL THEN 1 END) as with_gps,
  ROUND(COUNT(CASE WHEN longitude IS NOT NULL AND latitude IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2) as gps_coverage_percent
FROM aedpics.aed_data;
```

### 6.3 점검 통계

```sql
-- 최근 30일 점검 수
SELECT COUNT(*)
FROM aedpics.inspections
WHERE inspection_date >= NOW() - INTERVAL '30 days';

-- 점검 결과별 통계
SELECT result, COUNT(*)
FROM aedpics.inspections
GROUP BY result;
```

## 7. 알림 설정

### 7.1 Uptime Monitoring (UptimeRobot 권장)

**서비스**: https://uptimerobot.com (무료)

**설정**:
1. 계정 생성
2. New Monitor 추가
   - Monitor Type: HTTP(s)
   - Friendly Name: AEDpics Production
   - URL: https://aedpics.nmc.or.kr/api/health
   - Monitoring Interval: 5 minutes
3. Alert Contacts 설정
   - Email: truth0530@nmc.or.kr
   - Slack (선택)

### 7.2 Slack 알림 (CI/CD에서 설정)

GitHub Actions에서 자동으로 알림:
- 배포 성공/실패
- 백업 성공/실패

### 7.3 이메일 알림

**서버 다운 시 알림 스크립트**:

```bash
cat > /usr/local/bin/check-health.sh << 'EOF'
#!/bin/bash

HEALTH_URL="https://aedpics.nmc.or.kr/api/health"
EMAIL="truth0530@nmc.or.kr"

if ! curl -f -s $HEALTH_URL > /dev/null; then
  echo "AEDpics Health Check Failed at $(date)" | mail -s "ALERT: AEDpics Down" $EMAIL
fi
EOF

chmod +x /usr/local/bin/check-health.sh

# Cron 작업 추가 (5분마다 체크)
crontab -e
# */5 * * * * /usr/local/bin/check-health.sh
```

## 8. 대시보드 (선택)

### 8.1 PM2 Plus (무료/유료)

https://pm2.io

**기능**:
- 실시간 메트릭
- 에러 추적
- 로그 관리
- 알림

**설정**:
```bash
pm2 link <secret-key> <public-key>
```

### 8.2 Grafana + Prometheus (고급)

프로메테우스로 메트릭 수집, Grafana로 시각화

## 9. 모니터링 체크리스트

### 일일 점검
- [ ] Health Check API 응답 확인
- [ ] PM2 프로세스 상태 확인
- [ ] 에러 로그 확인
- [ ] 디스크 사용량 확인 (80% 이상 시 정리)

### 주간 점검
- [ ] 백업 파일 확인
- [ ] 로그 파일 크기 확인
- [ ] 데이터베이스 연결 수 확인
- [ ] SSL 인증서 만료일 확인

### 월간 점검
- [ ] 시스템 업데이트 검토
- [ ] 의존성 업데이트 검토
- [ ] 성능 메트릭 분석
- [ ] 디스크 정리 (오래된 로그/백업)

## 10. 알림 임계값

### Critical (즉시 대응 필요)
- Health Check 실패 (5분 이상)
- PM2 프로세스 다운
- 디스크 사용량 95% 이상
- 데이터베이스 연결 실패

### Warning (24시간 내 대응)
- 응답 시간 2초 이상
- 메모리 사용량 80% 이상
- 디스크 사용량 80% 이상
- 에러 로그 급증 (시간당 100개 이상)

### Info (모니터링만)
- 일일 백업 성공
- 배포 완료
- 정기 점검 완료

## 11. 대응 절차

### 시스템 다운 시

1. Health Check 실패 확인
2. SSH 접속 가능 여부 확인
3. PM2 프로세스 상태 확인
   ```bash
   pm2 status
   ```
4. 로그 확인
   ```bash
   pm2 logs aedpics --err --lines 100
   ```
5. 필요 시 재시작
   ```bash
   pm2 restart aedpics
   ```
6. Health Check 재확인

### 성능 저하 시

1. 리소스 사용률 확인
   ```bash
   htop
   free -h
   df -h
   ```
2. PM2 메트릭 확인
   ```bash
   pm2 monit
   ```
3. 느린 쿼리 확인 (위 SQL 참조)
4. 필요 시 인스턴스 재시작

### 디스크 부족 시

1. 용량 확인
   ```bash
   df -h
   du -sh /var/www/aedpics/*
   ```
2. 오래된 로그 삭제
   ```bash
   find /var/www/aedpics/logs -name "*.log" -mtime +30 -delete
   ```
3. 오래된 백업 삭제
   ```bash
   find /var/backups/aedpics -name "*.gz" -mtime +30 -delete
   ```

## 12. 참고 자료

- [PM2 모니터링 문서](https://pm2.keymetrics.io/docs/usage/monitoring/)
- [Nginx 로그 분석](https://www.nginx.com/blog/using-nginx-logging-for-application-performance-monitoring/)
- [PostgreSQL 모니터링](https://www.postgresql.org/docs/current/monitoring.html)

---

**최종 업데이트**: 2025-10-26
**문서 버전**: 1.0.0
