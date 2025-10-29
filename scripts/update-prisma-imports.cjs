#!/usr/bin/env node

/**
 * PrismaClient 싱글톤 패턴 일괄 적용 스크립트
 * 모든 API 라우트에서 직접 PrismaClient 생성하는 코드를
 * 싱글톤 인스턴스 사용하도록 변경
 *
 * 수정 내역:
 * - 빈 줄/세미콜론 제거 로직 개선
 * - finally 블록 제거 로직 개선
 * - import 삽입 위치 개선
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// API 파일들 찾기
const apiFiles = glob.sync('app/api/**/*.ts', {
  cwd: path.resolve(__dirname, '..'),
  absolute: true
});

let updatedCount = 0;
let skippedCount = 0;
const updatedFiles = [];

apiFiles.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let hasChanges = false;

  // 이미 싱글톤 사용 중인지 확인
  if (content.includes("from '@/lib/prisma'")) {
    console.log(`✓ Already using singleton: ${path.basename(filePath)}`);
    skippedCount++;
    return;
  }

  // PrismaClient import 패턴 체크
  const hasPrismaImport = /import\s*{\s*PrismaClient\s*}\s*from\s*['"]@prisma\/client['"];?/g.test(content);
  const hasNewInstance = /const\s+prisma\s*=\s*new\s+PrismaClient\(\);?/g.test(content);

  if (!hasPrismaImport && !hasNewInstance) {
    skippedCount++;
    return;
  }

  // 1. PrismaClient import 제거 (세미콜론과 개행 포함)
  content = content.replace(
    /import\s*{\s*PrismaClient\s*}\s*from\s*['"]@prisma\/client['"];?\n?/g,
    ''
  );

  // 2. new PrismaClient() 선언 제거 (세미콜론과 개행 포함)
  content = content.replace(
    /const\s+prisma\s*=\s*new\s+PrismaClient\(\);?\n?/g,
    ''
  );

  // 3. $disconnect() 호출 제거
  // 3a. finally 블록 내의 $disconnect() 제거
  content = content.replace(
    /\s*}\s*finally\s*{\s*await\s+prisma\.\$disconnect\(\);?\s*}\n?/g,
    '\n  }\n'
  );

  // 3b. 단독 $disconnect() 호출 제거
  content = content.replace(
    /\s*await\s+prisma\.\$disconnect\(\);?\n?/g,
    ''
  );

  // 4. 연속된 빈 줄 정리 (3개 이상 → 2개)
  content = content.replace(/\n{3,}/g, '\n\n');

  // 5. import 문 다음에 prisma 싱글톤 import 추가
  // 모든 import 문을 찾기
  const importMatches = content.match(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm);

  if (importMatches && importMatches.length > 0) {
    // 마지막 import 문 찾기
    const lastImport = importMatches[importMatches.length - 1];
    const lastImportIndex = content.lastIndexOf(lastImport);
    const insertPosition = lastImportIndex + lastImport.length;

    // 새 import 삽입
    content =
      content.slice(0, insertPosition) +
      "\nimport { prisma } from '@/lib/prisma';" +
      content.slice(insertPosition);
  } else {
    // import 문이 없으면 파일 맨 앞에 추가
    content = "import { prisma } from '@/lib/prisma';\n\n" + content;
  }

  // 6. 최종 빈 줄 정리
  content = content.replace(/\n{3,}/g, '\n\n');

  // 7. 파일 시작 부분 빈 줄 제거
  content = content.replace(/^\n+/, '');

  // 변경사항이 있는지 확인
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Updated: ${path.relative(process.cwd(), filePath)}`);
    updatedFiles.push(path.relative(process.cwd(), filePath));
    updatedCount++;
    hasChanges = true;
  }
});

console.log('\n========================================');
console.log('📊 PrismaClient 싱글톤 마이그레이션 완료');
console.log('========================================');
console.log(`✅ 업데이트된 파일: ${updatedCount}개`);
console.log(`⏭️  건너뛴 파일: ${skippedCount}개`);
console.log(`📁 전체 파일: ${apiFiles.length}개`);
console.log('========================================\n');

if (updatedCount > 0) {
  console.log('✅ 업데이트된 파일 목록:');
  updatedFiles.forEach((file, index) => {
    console.log(`   ${index + 1}. ${file}`);
  });
  console.log('\n⚠️  다음 단계를 실행하세요:');
  console.log('   1. npm run tsc      # TypeScript 타입 체크');
  console.log('   2. npm run build    # 프로덕션 빌드');
  console.log('   3. git add -A && git commit -m "refactor: Apply PrismaClient singleton pattern"');
  console.log('\n');
}
