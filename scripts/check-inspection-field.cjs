#!/usr/bin/env node

/**
 * 점검 항목 필드 검증 스크립트
 *
 * 사용법: node scripts/check-inspection-field.js <필드명>
 * 예시: node scripts/check-inspection-field.js external_display
 */

const fs = require('fs');
const path = require('path');

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const BOLD = '\x1b[1m';

// 체크 결과
const results = [];

function log(message, color = RESET) {
  console.log(`${color}${message}${RESET}`);
}

function checkFile(filePath, checks) {
  if (!fs.existsSync(filePath)) {
    results.push({
      file: filePath,
      status: 'error',
      message: '파일이 존재하지 않습니다'
    });
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const fileResults = [];

  checks.forEach(check => {
    const found = check.test(content);
    fileResults.push({
      name: check.name,
      found,
      location: check.location
    });
  });

  const allPassed = fileResults.every(r => r.found);

  results.push({
    file: path.basename(filePath),
    fullPath: filePath,
    status: allPassed ? 'pass' : 'fail',
    checks: fileResults
  });

  return allPassed;
}

function main() {
  const fieldName = process.argv[2];

  if (!fieldName) {
    log('사용법: node scripts/check-inspection-field.js <필드명>', RED);
    log('예시: node scripts/check-inspection-field.js external_display', YELLOW);
    process.exit(1);
  }

  log(`\n${'='.repeat(80)}`, BLUE);
  log(`점검 항목 필드 검증: ${fieldName}`, BOLD + BLUE);
  log(`${'='.repeat(80)}\n`, BLUE);

  const projectRoot = path.join(__dirname, '..');

  // 1. BasicInfoStep.tsx
  log('1️⃣  BasicInfoStep.tsx 검사 중...', BLUE);
  checkFile(
    path.join(projectRoot, 'components/inspection/steps/BasicInfoStep.tsx'),
    [
      {
        name: 'FIELDS 또는 DEVICE_INFO_FIELDS 배열에 필드 정의',
        test: (content) => {
          const fieldsRegex = new RegExp(`{\\s*key:\\s*['"\`]${fieldName}['"\`]`);
          return fieldsRegex.test(content);
        },
        location: '16-28번 라인'
      },
      {
        name: 'UI 렌더링 (필드명 표시)',
        test: (content) => {
          // 필드명이 deviceInfo 또는 basicInfo에서 참조되는지 확인
          const regex = new RegExp(`(deviceInfo|basicInfo)\\.${fieldName}`);
          return regex.test(content);
        },
        location: '567-598번 라인'
      }
    ]
  );

  // 2. InspectionSummaryStep.tsx
  log('\n2️⃣  InspectionSummaryStep.tsx 검사 중...', BLUE);
  checkFile(
    path.join(projectRoot, 'components/inspection/steps/InspectionSummaryStep.tsx'),
    [
      {
        name: 'BasicInfoData 인터페이스에 필드 타입 정의',
        test: (content) => {
          const regex = new RegExp(`${fieldName}\\??:\\s*(string|number|boolean)`);
          return regex.test(content);
        },
        location: '24-38번 라인'
      },
      {
        name: 'basicInfoSummary 로직에 필드 처리',
        test: (content) => {
          // matched 또는 modified 로직에 필드가 있는지 확인
          const regex = new RegExp(`(label|key):\\s*['"\`][^'"\`]*${fieldName}`);
          return regex.test(content) || content.includes(`basicInfo.${fieldName}`);
        },
        location: '118-202번 라인'
      }
    ]
  );

  // 3. ReadOnlyBasicInfoStep.tsx
  log('\n3️⃣  ReadOnlyBasicInfoStep.tsx 검사 중...', BLUE);
  checkFile(
    path.join(projectRoot, 'components/inspection/steps/ReadOnlyBasicInfoStep.tsx'),
    [
      {
        name: 'UI 렌더링 (필드 표시)',
        test: (content) => {
          // inspection.step_data?.['basicInfo']?.field_name 또는 basicInfo.field_name 패턴 찾기
          const regex = new RegExp(`(inspection\\.step_data.*basicInfo.*${fieldName}|basicInfo\\.${fieldName})`);
          return regex.test(content);
        },
        location: '45-70번 라인'
      }
    ]
  );

  // 4. field-comparison.ts
  log('\n4️⃣  field-comparison.ts 검사 중...', BLUE);
  checkFile(
    path.join(projectRoot, 'lib/inspections/field-comparison.ts'),
    [
      {
        name: 'analyzeInspectionFields 함수에 비교 로직',
        test: (content) => {
          // comparisons.push 안에 field_name이 있는지 확인
          const regex = new RegExp(`field_name:\\s*['"\`]${fieldName}['"\`]`);
          return regex.test(content);
        },
        location: '102-200번 라인'
      }
    ]
  );

  // 5. improvement-reports/page.tsx
  log('\n5️⃣  improvement-reports/page.tsx 검사 중...', BLUE);
  checkFile(
    path.join(projectRoot, 'app/(authenticated)/inspections/improvement-reports/page.tsx'),
    [
      {
        name: 'FIELD_NAME_LABELS에 한글 레이블',
        test: (content) => {
          const regex = new RegExp(`${fieldName}:\\s*['"\`][^'"\`]+['"\`]`);
          return regex.test(content);
        },
        location: '60-70번 라인'
      }
    ]
  );

  // 6. inspection-effect/page.tsx
  log('\n6️⃣  inspection-effect/page.tsx 검사 중...', BLUE);
  checkFile(
    path.join(projectRoot, 'app/(authenticated)/inspection-effect/page.tsx'),
    [
      {
        name: 'FIELD_NAME_LABELS에 한글 레이블',
        test: (content) => {
          const regex = new RegExp(`${fieldName}:\\s*['"\`][^'"\`]+['"\`]`);
          return regex.test(content);
        },
        location: '60-70번 라인'
      }
    ]
  );

  // 7. Prisma Schema
  log('\n7️⃣  Prisma Schema 검사 중...', BLUE);
  checkFile(
    path.join(projectRoot, 'prisma/schema.prisma'),
    [
      {
        name: 'aed_data 모델에 필드 정의',
        test: (content) => {
          // aed_data 모델 내에서 필드 찾기
          const aedDataMatch = content.match(/model aed_data \{[\s\S]*?\n\}/);
          if (!aedDataMatch) return false;
          const regex = new RegExp(`\\s${fieldName}\\s+`);
          return regex.test(aedDataMatch[0]);
        },
        location: 'aed_data 모델'
      }
    ]
  );

  // 8. send-improvement-alerts/route.ts
  log('\n8️⃣  send-improvement-alerts 검사 중...', BLUE);
  checkFile(
    path.join(projectRoot, 'app/api/cron/send-improvement-alerts/route.ts'),
    [
      {
        name: 'fieldLabels 매핑에 한글 레이블',
        test: (content) => {
          // fieldLabels 객체 안에서 필드 찾기
          const fieldLabelsMatch = content.match(/const fieldLabels[:\s]*Record<string,\s*string>\s*=\s*\{[\s\S]*?\};/);
          if (!fieldLabelsMatch) return false;
          const regex = new RegExp(`${fieldName}:\\s*['"\`][^'"\`]+['"\`]`);
          return regex.test(fieldLabelsMatch[0]);
        },
        location: '140-146번 라인'
      }
    ]
  );

  // 9. FieldComparisonDetailModal.tsx
  log('\n9️⃣  FieldComparisonDetailModal.tsx 검사 중...', BLUE);
  checkFile(
    path.join(projectRoot, 'components/inspections/FieldComparisonDetailModal.tsx'),
    [
      {
        name: 'FIELD_NAME_LABELS에 한글 레이블',
        test: (content) => {
          // FIELD_NAME_LABELS 객체 안에서 필드 찾기
          const labelsMatch = content.match(/const FIELD_NAME_LABELS[:\s]*Record<string,\s*string>\s*=\s*\{[\s\S]*?\};/);
          if (!labelsMatch) return false;
          const regex = new RegExp(`${fieldName}:\\s*['"\`][^'"\`]+['"\`]`);
          return regex.test(labelsMatch[0]);
        },
        location: '40-50번 라인'
      }
    ]
  );

  // 결과 출력
  log(`\n${'='.repeat(80)}`, BLUE);
  log('검증 결과', BOLD + BLUE);
  log(`${'='.repeat(80)}\n`, BLUE);

  let totalChecks = 0;
  let passedChecks = 0;

  results.forEach(result => {
    const icon = result.status === 'pass' ? '✅' :
                 result.status === 'fail' ? '❌' : '⚠️';

    log(`${icon} ${result.file}`, result.status === 'pass' ? GREEN : RED);

    if (result.checks) {
      result.checks.forEach(check => {
        totalChecks++;
        if (check.found) {
          passedChecks++;
          log(`   ✓ ${check.name}`, GREEN);
        } else {
          log(`   ✗ ${check.name} (${check.location})`, RED);
        }
      });
    } else if (result.message) {
      log(`   ${result.message}`, YELLOW);
    }
    log('');
  });

  // 최종 요약
  log(`${'='.repeat(80)}`, BLUE);
  log('최종 요약', BOLD + BLUE);
  log(`${'='.repeat(80)}`, BLUE);
  log(`총 검사 항목: ${totalChecks}개`, BLUE);
  log(`통과: ${passedChecks}개`, GREEN);
  log(`실패: ${totalChecks - passedChecks}개`, totalChecks - passedChecks > 0 ? RED : GREEN);

  const percentage = totalChecks > 0 ? ((passedChecks / totalChecks) * 100).toFixed(1) : 0;
  log(`완료율: ${percentage}%`, percentage === '100.0' ? GREEN : YELLOW);
  log('');

  if (passedChecks === totalChecks) {
    log('🎉 모든 검사를 통과했습니다!', GREEN + BOLD);
  } else {
    log('⚠️  일부 검사에 실패했습니다. 위 내용을 확인하여 수정해주세요.', YELLOW);
    log('', RESET);
    log('자세한 내용은 docs/INSPECTION_FIELD_CHECKLIST.md를 참고하세요.', BLUE);
  }

  log('');

  // 실패 시 exit code 1
  process.exit(passedChecks === totalChecks ? 0 : 1);
}

main();
