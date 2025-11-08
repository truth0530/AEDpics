import { prisma } from '@/lib/prisma';
import { mapCityCodeToGugun } from '@/lib/constants/regions';

async function main() {
  const users = await prisma.user_profiles.findMany({
    where: { role: 'local_admin', is_active: true },
    include: {
      organizations: true
    },
    orderBy: { full_name: 'asc' }
  });

  console.log('=== Local Admin 매핑 상태 검토 ===\n');

  const problems: string[] = [];

  for (const user of users) {
    const code = user.organizations?.city_code;
    const mapped = code ? mapCityCodeToGugun(code) : null;

    const status = mapped ? '✓' : (code ? '⚠️' : '❌');
    console.log(`${status} ${user.full_name.padEnd(20)} (${user.email})`);
    console.log(`   → ${user.organizations?.name || 'N/A'}`);
    console.log(`   → city_code: ${code || 'null'}${mapped ? ` → ${mapped}` : ''}`);

    if (!mapped && code) {
      problems.push(`  • ${user.full_name}: city_code="${code}" (미매핑)`);
    } else if (!code) {
      problems.push(`  • ${user.full_name}: city_code가 null (미설정)`);
    }
    console.log();
  }

  if (problems.length > 0) {
    console.log('\n❌ 여전히 문제가 되는 사용자:\n');
    problems.forEach(p => console.log(p));
  } else {
    console.log('\n✓ 모든 local_admin 사용자가 정상적으로 매핑됨');
  }
}

main().catch(console.error).finally(() => process.exit(0));
