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
      inspections: pendingInspections
    });

  } catch (error) {
    console.error('Failed to fetch pending inspections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending inspections' },
      { status: 500 }
    );
  }
}
