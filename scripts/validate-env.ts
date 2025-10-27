/**
 * 빌드 시 환경변수 검증 스크립트
 *
 * 빌드에 필요한 환경변수가 없으면 경고를 출력하고,
 * 런타임에만 필요한 환경변수는 체크하지 않습니다.
 */

// 빌드 시 필수 환경변수 (없으면 빌드 실패)
const REQUIRED_BUILD_VARS: string[] = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'JWT_SECRET',
];

// 빌드 시 권장 환경변수 (없어도 기본값 사용)
const RECOMMENDED_BUILD_VARS: Record<string, string> = {
  'NEXTAUTH_URL': 'http://localhost:3000',
  'NEXT_PUBLIC_SITE_URL': 'http://localhost:3000',
  'NEXT_PUBLIC_KAKAO_MAP_APP_KEY': 'test-key',
};

// 런타임에만 필요한 환경변수 (빌드 시 체크하지 않음)
const RUNTIME_ONLY_VARS: string[] = [
  'RESEND_API_KEY',
  'MASTER_EMAIL',
  'ENCRYPTION_KEY',
];

let hasError = false;
let hasWarning = false;

console.log('\n🔍 환경변수 검증 시작...\n');

// 1. 필수 환경변수 체크
console.log('✅ 필수 환경변수 체크:');
REQUIRED_BUILD_VARS.forEach(key => {
  if (!process.env[key]) {
    console.error(`  ❌ ${key}: 누락 (빌드 실패 가능)`);
    hasError = true;
  } else {
    const value = process.env[key]!;
    const masked = value.length > 20
      ? value.substring(0, 10) + '...' + value.substring(value.length - 5)
      : '***';
    console.log(`  ✓ ${key}: ${masked}`);
  }
});

// 2. 권장 환경변수 체크 (기본값 사용)
console.log('\n💡 권장 환경변수 체크:');
Object.entries(RECOMMENDED_BUILD_VARS).forEach(([key, defaultValue]) => {
  if (!process.env[key]) {
    console.warn(`  ⚠️  ${key}: 누락 → 기본값 사용 (${defaultValue})`);
    process.env[key] = defaultValue;
    hasWarning = true;
  } else {
    console.log(`  ✓ ${key}: ${process.env[key]}`);
  }
});

// 3. 런타임 전용 환경변수 안내
console.log('\n🔄 런타임 전용 환경변수 (빌드 시 선택):');
RUNTIME_ONLY_VARS.forEach(key => {
  if (process.env[key]) {
    console.log(`  ✓ ${key}: 설정됨`);
  } else {
    console.log(`  - ${key}: 미설정 (런타임에 필요)`);
  }
});

// 4. 결과 출력
console.log('\n' + '='.repeat(50));
if (hasError) {
  console.error('❌ 환경변수 검증 실패: 필수 변수가 누락되었습니다.');
  console.error('   .env.local 파일을 확인하거나 환경변수를 설정하세요.\n');
  process.exit(1);
} else if (hasWarning) {
  console.warn('⚠️  환경변수 검증 완료: 일부 권장 변수가 기본값으로 설정되었습니다.\n');
} else {
  console.log('✅ 환경변수 검증 완료: 모든 변수가 올바르게 설정되었습니다.\n');
}
