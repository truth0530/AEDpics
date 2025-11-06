import { prisma } from '@/lib/prisma';

async function checkSeojaYoung() {
  const user = await prisma.user_profiles.findFirst({
    where: { full_name: '서자영', role: 'local_admin' },
    include: { organizations: true }
  });

  if (!user || !user.organizations) {
    console.log('사용자를 찾을 수 없습니다');
    return;
  }

  const org = user.organizations;
  console.log('=== 서자영 상세 정보 ===\n');
  console.log(`이름: ${user.full_name}`);
  console.log(`이메일: ${user.email}`);
  console.log(`\n조직 정보:`);
  console.log(`  ID: ${org.id}`);
  console.log(`  이름: ${org.name}`);
  console.log(`  type: ${org.type}`);
  console.log(`  region_code: ${org.region_code}`);
  console.log(`  city_code: ${org.city_code || '(null)'}`);
  console.log(`  parent_id: ${org.parent_id || '(null)'}`);

  console.log('\n해결책: city_code를 "seju"로 설정해야 함');
  console.log('UPDATE organizations SET city_code = "seju" WHERE id = ?');
}

checkSeojaYoung().catch(console.error).finally(() => process.exit(0));
