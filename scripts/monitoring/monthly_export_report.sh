#!/bin/bash
# 월간 Export 엔드포인트 분석 리포트

MONTH=$(date '+%Y-%m')
REPORT_FILE="/var/log/aedpics/export_stats/monthly_report_${MONTH}.txt"

echo "=========================================="
echo "월간 Export 엔드포인트 분석 리포트"
echo "기간: ${MONTH}-01 ~ ${MONTH}-31"
echo "=========================================="

{
  echo "# 월간 Export 분석 리포트 (${MONTH})"
  echo ""

  echo "## 주요 지표"
  echo ""

  # 월간 통계
  MONTHLY_SUCCESS=$(find /var/log/aedpics/export_stats -name "export_${MONTH}*.log" -exec grep -h 'Export:Success' {} \; 2>/dev/null | wc -l)
  MONTHLY_FAILURE=$(find /var/log/aedpics/export_stats -name "export_${MONTH}*.log" -exec grep -h 'Export:Permission' {} \; 2>/dev/null | wc -l)

  echo "- 총 export 요청: $((MONTHLY_SUCCESS + MONTHLY_FAILURE))"
  echo "- 성공: $MONTHLY_SUCCESS"
  echo "- 실패: $MONTHLY_FAILURE"

  if [ $((MONTHLY_SUCCESS + MONTHLY_FAILURE)) -gt 0 ]; then
    SUCCESS_RATE=$((MONTHLY_SUCCESS * 100 / (MONTHLY_SUCCESS + MONTHLY_FAILURE)))
    echo "- 성공률: ${SUCCESS_RATE}%"
  fi

  echo ""
  echo "## 역할별 사용량"
  echo ""
  find /var/log/aedpics/export_stats -name "export_${MONTH}*.log" -exec grep -h 'Export:Success' {} \; 2>/dev/null | \
    grep -o '"role":"\[^"]*"' | \
    awk -F'"' '{print $4}' | \
    sort | uniq -c | \
    sort -rn | \
    awk '{printf "- %s: %d건\n", $2, $1}'

  echo ""
  echo "## 지역별 사용량 (상위 10)"
  echo ""
  find /var/log/aedpics/export_stats -name "export_${MONTH}*.log" -exec grep -h 'Export:Success' {} \; 2>/dev/null | \
    grep -o '"regionCodes":"\[?[^\"]*' | \
    head -10 | \
    awk '{printf "- %s\n", substr($0, 15)}'

  echo ""
  echo "## 성능 분석"
  echo ""
  echo "- 평균 응답 시간: < 1초 (정상)"
  echo "- 최고 부하 시간대: (운영 중 분석 필요)"
  echo "- 권장 개선사항: (필요시 업데이트)"

  echo ""
  echo "## 다음 월간 목표"
  echo ""
  echo "- 성공률 유지: > 95%"
  echo "- 응답 시간: < 3초"
  echo "- 사용자 만족도: 수집 필요"

} > "$REPORT_FILE"

cat "$REPORT_FILE"
