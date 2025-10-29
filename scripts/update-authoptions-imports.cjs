#!/usr/bin/env node

/**
 * authOptions import 경로 일괄 업데이트
 * @/app/api/auth/[...nextauth]/route -> @/lib/auth/auth-options
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 모든 TS/TSX 파일 찾기
const files = glob.sync('{app,components,lib}/**/*.{ts,tsx}', {
  cwd: path.resolve(__dirname, '..'),
  absolute: true,
  ignore: ['**/node_modules/**', '**/.next/**']
});

let updatedCount = 0;
const updatedFiles = [];

// 교체할 패턴들
const patterns = [
  /from\s+['"]@\/app\/api\/auth\/\[\.\.\.nextauth\]\/route['"]/g,
  /from\s+["']@\/app\/api\/auth\/\[\.\.\.nextauth\]\/route["']/g
];

files.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // 패턴 교체
  patterns.forEach(pattern => {
    content = content.replace(pattern, "from '@/lib/auth/auth-options'");
  });

  // 변경사항이 있는지 확인
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Updated: ${path.relative(process.cwd(), filePath)}`);
    updatedFiles.push(path.relative(process.cwd(), filePath));
    updatedCount++;
  }
});

console.log('\n========================================');
console.log('📊 authOptions import 경로 업데이트 완료');
console.log('========================================');
console.log(`✅ 업데이트된 파일: ${updatedCount}개`);
console.log(`📁 전체 파일: ${files.length}개`);
console.log('========================================\n');

if (updatedCount > 0) {
  console.log('✅ 업데이트된 파일 목록:');
  updatedFiles.forEach((file, index) => {
    console.log(`   ${index + 1}. ${file}`);
  });
  console.log('\n');
}
