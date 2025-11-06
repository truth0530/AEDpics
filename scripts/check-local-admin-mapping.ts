import { prisma } from '@/lib/prisma';

const cityCodeMap: Record<string, string> = {
  'jeju': '제주시',
  'seogwipo': '서귀포시',
  'jung': '중구',
  'dalseo': '달서구',
  'buk': '북구',
  'suseong': '수성구',
  'seo': '서구',
  'namdong': '남동구',
  'ganghwa': '강화군',
  'gyeyang': '계양구',
  'michuhol': '미추홀구',
  'bupyeong': '부평구',
  'yeonsu': '연수구',
  'ongjin': '옹진군',
  'jung_yeongjong': '영종',
  'gimhae': '김해시',
  'goesan': '괴산군',
  'danyang': '단양군',
  'boeun': '보은군',
  'yeongdong': '영동군',
  'okcheon': '옥천군',
  'eumseong': '음성군',
  'jecheon': '제천시',
  'jeungpyeong': '증평군',
  'jincheon': '진천군',
  'cheongju': '청주시',
  'chungju': '충주시',
  'seju': '세종특별자치시',
};

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
    const mapped = code ? cityCodeMap[code] : null;

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
