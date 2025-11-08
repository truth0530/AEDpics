#!/usr/bin/env npx tsx
/**
 * 전국 담당자 있는 조직 목록
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function listAllOrgsWithAdmin() {
  try {
    console.log('🏥 전국 담당자(local_admin) 있는 조직 목록\n');

    const orgsWithAdmin = await prisma.organizations.findMany({
      where: {
        type: 'health_center',
        user_profiles: {
          some: {
            role: 'local_admin',
            is_active: true
          }
        }
      },
      include: {
        user_profiles: {
          where: {
            role: 'local_admin',
            is_active: true
          },
          select: {
            id: true,
            full_name: true,
            email: true
          }
        }
      },
      orderBy: {
        region_code: 'asc'
      }
    });

    console.log(`총 ${orgsWithAdmin.length}개 조직\n`);

    // 지역별로 그룹화
    const byRegion: Record<string, typeof orgsWithAdmin> = {};
    orgsWithAdmin.forEach(org => {
      const region = org.region_code || '기타';
      if (!byRegion[region]) byRegion[region] = [];
      byRegion[region].push(org);
    });

    Object.entries(byRegion).forEach(([region, orgs]) => {
      console.log(`📍 ${region || '지역 미지정'} (${orgs.length}개)`);
      orgs.forEach(org => {
        console.log(`   - ${org.name}`);
        org.user_profiles.forEach(admin => {
          console.log(`     담당자: ${admin.full_name} (${admin.email})`);
        });
      });
      console.log('');
    });

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
listAllOrgsWithAdmin()
  .catch(console.error)
  .finally(() => process.exit());