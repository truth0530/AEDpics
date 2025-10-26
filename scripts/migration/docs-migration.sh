#!/bin/bash
# 문서 재구조화 마이그레이션 스크립트
# 실행 전에 반드시 git commit으로 현재 상태 백업할 것

set -e  # 오류 발생 시 즉시 중단

echo "=== AED Check System 문서 재구조화 시작 ==="

# 1. 새로운 폴더 구조 생성
echo "1단계: 새로운 폴더 구조 생성..."
mkdir -p docs/reports
mkdir -p docs/reference/aed-data
mkdir -p docs/guides/features
mkdir -p docs/guides/data-quality
mkdir -p docs/archive/2025-10/completed_plans
mkdir -p docs/archive/2025-10/inspection-planning

# 2. 루트에 산재한 보고서들을 reports/ 폴더로 이동
echo "2단계: 루트 보고서 파일 이동..."
if [ -f "docs/SCHEMA_CORRECTION_REPORT_20251004.md" ]; then
  git mv docs/SCHEMA_CORRECTION_REPORT_20251004.md docs/reports/2025-10-04-schema-correction.md
fi

if [ -f "docs/TARGET_MATCHING_COMPLETION.md" ]; then
  git mv docs/TARGET_MATCHING_COMPLETION.md docs/reports/2025-10-05-target-matching.md
fi

if [ -f "docs/MAP_INIT_POLICY_ANALYSIS.md" ]; then
  git mv docs/MAP_INIT_POLICY_ANALYSIS.md docs/reports/2025-10-06-map-init-policy.md
fi

if [ -f "docs/MAP_SYNC_UX_PROPOSAL.md" ]; then
  git mv docs/MAP_SYNC_UX_PROPOSAL.md docs/planning/map-sync-ux.md
fi

if [ -f "docs/SECURITY_UX_TRADEOFF_ANALYSIS.md" ]; then
  git mv docs/SECURITY_UX_TRADEOFF_ANALYSIS.md docs/security/ux-tradeoff-analysis.md
fi

# 3. 중복 점검 시스템 설계 문서 정리
echo "3단계: 중복 점검 설계 문서 정리..."
if [ -f "docs/planning/inspection-redesign-v2.md" ]; then
  git mv docs/planning/inspection-redesign-v2.md docs/archive/2025-10/inspection-planning/
fi

if [ -f "docs/planning/inspection-implementation-plan.md" ]; then
  git mv docs/planning/inspection-implementation-plan.md docs/archive/2025-10/inspection-planning/
fi

# 4. 완료된 계획서들 archive로 이동
echo "4단계: 완료된 계획서 이동..."
# (실제 구현 상태 확인 후 수동으로 이동 필요)

echo ""
echo "✅ 문서 재구조화 1단계 완료"
echo ""
echo "다음 단계:"
echo "1. git status로 변경사항 확인"
echo "2. 즉시 수정 필요 문서 5개 업데이트"
echo "3. Archive 폴더에 경고 README 추가"
echo "4. 문서 인덱스 업데이트"
