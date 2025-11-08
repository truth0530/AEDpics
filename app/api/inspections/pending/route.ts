import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { getPendingInspectionsForUser } from '@/lib/utils/inspection-approval';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id as string;

    // Get pending inspections for this user based on their role
    const pendingInspections = await getPendingInspectionsForUser(userId);

    return NextResponse.json({
      success: true,
      count: pendingInspections.length,
      inspections: pendingInspections,
      // First-come-first-served approval messaging
      approvalPolicy: {
        description: '점검 승인은 선착순입니다',
        details: '먼저 승인 버튼을 클릭한 관리자의 승인이 처리됩니다. 승인된 점검은 다른 관리자의 승인 목록에서 제외됩니다.'
      }
    });

  } catch (error) {
    console.error('Failed to fetch pending inspections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending inspections' },
      { status: 500 }
    );
  }
}
