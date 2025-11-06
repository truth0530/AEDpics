import { prisma } from '@/lib/prisma';

async function checkDaeguUsers() {
  console.log('=== 대구 지역 사용자 확인 ===\n');

  try {
    // 최근 가입한 대구 지역 사용자 조회
    const daeguUsers = await prisma.user_profiles.findMany({
      where: {
        OR: [
          { region: { contains: '대구' } },
          { region_code: { in: ['DAE', 'TAE'] } },
          { email: { contains: '@daegu' } }
        ]
      },
      include: {
        organizations: {
          select: {
            id: true,
            name: true,
            city_code: true,
            region_code: true,
            type: true,
            address: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      },
      take: 10
    });

    console.log(`대구 지역 사용자 ${daeguUsers.length}명 발견:\n`);

    for (const user of daeguUsers) {
      console.log('─'.repeat(60));
      console.log(`이름: ${user.full_name || '미입력'}`);
      console.log(`이메일: ${user.email}`);
      console.log(`역할: ${user.role}`);
      console.log(`지역: ${user.region || '미설정'} (코드: ${user.region_code || '없음'})`);
      console.log(`가입일: ${user.created_at.toLocaleDateString('ko-KR')}`);

      if (user.organizations) {
        console.log(`\n조직 정보:`);
        console.log(`  - 이름: ${user.organizations.name}`);
        console.log(`  - 타입: ${user.organizations.type}`);
        console.log(`  - 시군구 코드: ${user.organizations.city_code || '❌ 없음'}`);
        console.log(`  - 지역 코드: ${user.organizations.region_code || '없음'}`);
        console.log(`  - 주소: ${user.organizations.address || '없음'}`);

        // city_code 문제 진단
        if (user.role === 'local_admin') {
          if (!user.organizations.city_code) {
            console.log(`  ⚠️  경고: 보건소 계정인데 city_code가 없습니다!`);
          } else if (user.organizations.name.includes('수성구') && user.organizations.city_code !== 'suseong') {
            console.log(`  ❌ 문제: 수성구 보건소인데 city_code가 ${user.organizations.city_code}입니다!`);
          }
        }
      } else {
        console.log('조직: 연결되지 않음');
      }
      console.log();
    }

    // 특별히 수성구 보건소 확인
    console.log('\n=== 수성구 보건소 조직 확인 ===\n');
    const suseongOrgs = await prisma.organizations.findMany({
      where: {
        OR: [
          { name: { contains: '수성구' } },
          { address: { contains: '수성구' } }
        ]
      },
      select: {
        id: true,
        name: true,
        city_code: true,
        region_code: true,
        address: true,
        type: true
      }
    });

    for (const org of suseongOrgs) {
      console.log(`조직: ${org.name}`);
      console.log(`  - ID: ${org.id}`);
      console.log(`  - 타입: ${org.type}`);
      console.log(`  - city_code: ${org.city_code || '❌ 없음'}`);
      console.log(`  - region_code: ${org.region_code || '없음'}`);
      console.log(`  - 주소: ${org.address}`);
      console.log();
    }

    // 중구 조직도 확인
    console.log('\n=== 중구 관련 조직 확인 ===\n');
    const jungguOrgs = await prisma.organizations.findMany({
      where: {
        OR: [
          { name: { contains: '중구' } },
          { city_code: 'jung' },
          { address: { contains: '중구' } }
        ],
        region_code: { in: ['DAE', 'TAE'] }
      },
      select: {
        id: true,
        name: true,
        city_code: true,
        region_code: true,
        address: true,
        type: true
      }
    });

    for (const org of jungguOrgs) {
      console.log(`조직: ${org.name}`);
      console.log(`  - city_code: ${org.city_code}`);
      console.log(`  - 주소: ${org.address}`);
      console.log();
    }

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDaeguUsers().catch(console.error);