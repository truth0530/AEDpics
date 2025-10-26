import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { decryptPhone } from '@/lib/utils/encryption';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  try {
    // NextAuth 세션 확인
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 프로필 조회 (Prisma)
    const profile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      include: {
        organization: true
      }
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // 전화번호 복호화 (하위 호환성 보장)
    const decryptedPhone = profile.phone ? decryptPhone(profile.phone) : null;

    return NextResponse.json({
      user: {
        id: profile.id,
        email: profile.email,
        profile: {
          ...profile,
          phone: decryptedPhone, // 복호화된 전화번호
        }
      }
    });
  } catch (error) {
    console.error('[API /auth/me Error]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
