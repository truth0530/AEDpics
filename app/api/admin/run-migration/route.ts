import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST() {
  try {
    // Check if user is authenticated and is a master admin
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is master
    const profile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    // 마이그레이션 실행 권한 확인
    const { checkPermission, getPermissionError } = await import('@/lib/auth/permissions');
    if (!profile || !checkPermission(profile.role, 'RUN_MIGRATION')) {
      return NextResponse.json({ error: getPermissionError('RUN_MIGRATION') }, { status: 403 });
    }

    // Migration statements
    const migrations = [
      {
        name: 'Add account_type column',
        sql: `ALTER TABLE user_profiles 
              ADD COLUMN IF NOT EXISTS account_type VARCHAR(20) DEFAULT 'public'
              CHECK (account_type IN ('public', 'temporary'))`
      },
      {
        name: 'Add account_type comment',
        sql: `COMMENT ON COLUMN user_profiles.account_type IS 'Type of account: public (공공기관) or temporary (임시 점검원)'`
      },
      {
        name: 'Add assigned_devices column',
        sql: `ALTER TABLE user_profiles
              ADD COLUMN IF NOT EXISTS assigned_devices TEXT[]`
      },
      {
        name: 'Add assigned_devices comment',
        sql: `COMMENT ON COLUMN user_profiles.assigned_devices IS 'Array of AED device IDs assigned to temporary inspectors'`
      },
      {
        name: 'Update existing records',
        sql: `UPDATE user_profiles 
              SET account_type = 
                CASE 
                  WHEN email LIKE '%@korea.kr' OR email LIKE '%@nmc.or.kr' THEN 'public'
                  ELSE 'temporary'
                END
              WHERE account_type IS NULL`
      },
      {
        name: 'Create index',
        sql: `CREATE INDEX IF NOT EXISTS idx_user_profiles_account_type 
              ON user_profiles(account_type)`
      }
    ];

    const results = [];

    for (const migration of migrations) {
      try {
        // Execute raw SQL using Prisma
        await prisma.$executeRawUnsafe(migration.sql);

        results.push({
          name: migration.name,
          status: 'success'
        });
      } catch (err) {
        results.push({
          name: migration.name,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      message: 'Migration completed',
      results
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Failed to run migration' },
      { status: 500 }
    );
  }
}