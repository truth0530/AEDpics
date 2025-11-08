import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { canUserApproveInspection } from '@/lib/utils/inspection-approval';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: inspectionId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id as string;

    // Check if user can approve this inspection
    const canApprove = await canUserApproveInspection(userId, inspectionId);

    if (!canApprove) {
      return NextResponse.json(
        { error: 'You are not authorized to approve this inspection' },
        { status: 403 }
      );
    }

    // Get current inspection to verify status
    // Note: First-come-first-served approach - if another admin has already approved this
    // between when the user fetched the list and clicked approve, we'll get a 400 error here
    const inspection = await prisma.inspections.findUnique({
      where: { id: inspectionId }
    });

    if (!inspection) {
      return NextResponse.json(
        { error: 'Inspection not found' },
        { status: 404 }
      );
    }

    // Can only approve submitted or pending inspections
    // This enforces first-come-first-served: if status is already 'approved', 'rejected', etc.,
    // it means another admin approved it first
    if (inspection.approval_status !== 'submitted' && inspection.approval_status !== 'pending') {
      return NextResponse.json(
        {
          error: `Cannot approve inspection - already ${inspection.approval_status} by another admin. This is first-come-first-served approval.`,
          code: 'ALREADY_APPROVED'
        },
        { status: 400 }
      );
    }

    // Update inspection to approved
    const updatedInspection = await prisma.inspections.update({
      where: { id: inspectionId },
      data: {
        approval_status: 'approved',
        approved_by_id: userId,
        approved_at: new Date()
      },
      include: {
        user_profiles: {
          select: {
            id: true,
            email: true,
            full_name: true
          }
        },
        approved_by: {
          select: {
            id: true,
            email: true,
            full_name: true
          }
        }
      }
    });

    // Log approval action
    await prisma.audit_logs.create({
      data: {
        action: 'INSPECTION_APPROVED',
        user_id: userId,
        entity_id: inspectionId,
        entity_type: 'INSPECTION',
        metadata: {
          timestamp: new Date().toISOString(),
          approved_by_email: session.user.email,
          equipment_serial: inspection.equipment_serial
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Inspection approved successfully',
      inspection: updatedInspection
    });

  } catch (error) {
    console.error('Failed to approve inspection:', error);
    return NextResponse.json(
      { error: 'Failed to approve inspection' },
      { status: 500 }
    );
  }
}
