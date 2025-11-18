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

    // Can only approve submitted inspections (strict workflow)
    // Pending inspections must be submitted first
    if (inspection.approval_status !== 'submitted') {
      return NextResponse.json(
        {
          error: `Cannot approve inspection with status: ${inspection.approval_status}. Only submitted inspections can be approved.`,
          code: 'INVALID_STATUS_TRANSITION'
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
            full_name: true,
            notification_settings: true // Include settings for notification logic
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

    // TODO: Send notification to inspector (updatedInspection.user_profiles.email)
    // if (updatedInspection.user_profiles.notification_settings?.email_notifications) { ... }

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
