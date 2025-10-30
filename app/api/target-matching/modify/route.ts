import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { managementNumber, newTargetKey, note } = body;

    if (!managementNumber || !newTargetKey) {
      return NextResponse.json(
        { error: 'Management number and new target key are required' },
        { status: 400 }
      );
    }

    // Get current user from NextAuth
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Update the mapping with new target key
    const updatedMapping = await prisma.management_number_group_mapping.update({
      where: {
        management_number: managementNumber,
      },
      data: {
        target_key_2024: newTargetKey,
        modified_by_2024: session.user.id,
        modified_at_2024: new Date(),
        modification_note_2024: note || `Modified by ${session.user.email || session.user.id}`,
        confirmed_2024: true, // Set as confirmed when manually modified
        confirmed_by_2024: session.user.id,
        confirmed_at_2024: new Date(),
        updated_at: new Date(),
      },
    });

    if (!updatedMapping) {
      return NextResponse.json(
        { error: 'Mapping not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedMapping
    });
  } catch (error) {
    console.error('Failed to modify matching:', error);
    return NextResponse.json(
      { error: 'Failed to modify matching' },
      { status: 500 }
    );
  }
}
