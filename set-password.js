import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'nemcdg@korea.kr';
  const newPassword = 'TestPassword123!';
  
  const passwordHash = await bcrypt.hash(newPassword, 10);
  
  const updated = await prisma.user_profiles.update({
    where: { email },
    data: { password_hash: passwordHash }
  });
  
  console.log('비밀번호 설정 완료:');
  console.log('  이메일:', email);
  console.log('  비밀번호:', newPassword);
  console.log('  이름:', updated.full_name);
  console.log('  역할:', updated.role);
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
