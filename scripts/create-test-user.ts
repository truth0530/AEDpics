import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

async function createTestUser() {
  try {
    console.log('Creating test user: nemcdg@korea.kr');

    // 비밀번호 해시 생성
    const passwordHash = await bcrypt.hash('dpdlelvlrTm*25', 10);

    // 대구 중구 보건소 조직 찾기 또는 생성
    let organization = await prisma.organizations.findFirst({
      where: {
        name: {
          contains: '대구',
        },
        city_code: {
          contains: '중구',
        },
      },
    });

    if (!organization) {
      console.log('대구 중구 보건소 조직을 찾을 수 없어 새로 생성합니다.');
      organization = await prisma.organizations.create({
        data: {
          id: randomUUID(),
          name: '대구광역시 중구 보건소',
          type: 'health_center',
          region_code: 'DAE',
          city_code: '중구',
          address: '대구광역시 중구',
          contact: '053-000-0000',
        },
      });
    }

    console.log('조직 정보:', organization);

    // 기존 사용자 확인
    const existingUser = await prisma.user_profiles.findUnique({
      where: {
        email: 'nemcdg@korea.kr',
      },
    });

    if (existingUser) {
      console.log('이미 존재하는 사용자입니다. 비밀번호를 업데이트합니다.');
      await prisma.user_profiles.update({
        where: {
          email: 'nemcdg@korea.kr',
        },
        data: {
          password_hash: passwordHash,
          is_active: true,
          role: 'local_admin',
          region_code: 'DAE',
          district: '중구',
          organization_id: organization.id,
        },
      });
      console.log('사용자 비밀번호가 업데이트되었습니다.');
    } else {
      // 새 사용자 생성
      const newUser = await prisma.user_profiles.create({
        data: {
          id: randomUUID(),
          email: 'nemcdg@korea.kr',
          password_hash: passwordHash,
          full_name: '이광성중구보건소',
          phone: '053-427-0530',
          role: 'local_admin',
          is_active: true,
          region_code: 'DAE',
          region: '대구광역시',
          district: '중구',
          organization_id: organization.id,
          organization_name: '대구광역시 중구 보건소',
          department: '보건행정과',
          position: '담당자',
          can_approve_users: false,
          can_manage_devices: true,
          can_view_reports: true,
          can_export_data: true,
          account_type: 'health_center',
          approved_at: new Date(),
        },
      });

      console.log('새 사용자가 생성되었습니다:', {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        region: newUser.region,
        district: newUser.district,
      });
    }

    console.log('\n계정 정보:');
    console.log('이메일: nemcdg@korea.kr');
    console.log('비밀번호: dpdlelvlrTm*25');
    console.log('역할: 보건소 담당자 (local_admin)');
    console.log('지역: 대구광역시 중구');
  } catch (error) {
    console.error('사용자 생성 중 오류 발생:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
