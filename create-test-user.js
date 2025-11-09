import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const testEmail = 'test-inspection@korea.kr';
  const testPassword = 'TestPassword123!';
  
  // 비밀번호 해시
  const passwordHash = await bcrypt.hash(testPassword, 10);
  
  // 기존 계정 확인
  const existing = await prisma.user_profiles.findUnique({
    where: { email: testEmail }
  });
  
  if (existing) {
    console.log('이미 존재하는 계정:', testEmail);
    await prisma.$disconnect();
    return;
  }
  
  // 임시 조직 확인/생성
  let org = await prisma.organizations.findFirst({
    where: { region_code: 'DAE' }
  });
  
  if (!org) {
    // 조직이 없으면 생성
    org = await prisma.organizations.create({
      data: {
        id: randomUUID(),
        name: '대구광역시 중구 보건소',
        type: 'health_center',
        region_code: 'DAE',
        city_code: 'daegu_jung',
        created_at: new Date()
      }
    });
    console.log('조직 생성:', org.name);
  }
  
  // 테스트 사용자 생성
  const user = await prisma.user_profiles.create({
    data: {
      id: randomUUID(),
      email: testEmail,
      full_name: '테스트 점검자',
      password_hash: passwordHash,
      role: 'temporary_inspector',
      is_active: true,
      account_locked: false,
      organization_id: org.id,
      organization_name: org.name,
      created_at: new Date()
    }
  });
  
  console.log('테스트 계정 생성 완료:');
  console.log('  이메일:', testEmail);
  console.log('  비밀번호:', testPassword);
  console.log('  역할:', user.role);
  console.log('  소속:', org.name);
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
