import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * POST /api/inspections/[id]/delete
 * 점검 이력 삭제 (Hard Delete)
 *
 * Prisma를 사용하므로 RLS가 없어 Service Role 불필요
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
  const inspectionId = params.id;

  // 인증 확인
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 요청 본문 파싱
  const body = await request.json();
  const { reason, confirmed } = body;

  if (!confirmed) {
    return NextResponse.json({ error: 'Deletion not confirmed' }, { status: 400 });
  }

  // 점검 이력 조회
  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    select: {
      id: true,
      inspectorId: true,
      equipmentSerial: true,
      inspectionDate: true
    }
  });

  if (!inspection) {
    return NextResponse.json({ error: 'Inspection record not found' }, { status: 404 });
  }

  // 권한 확인: 본인만 삭제 가능 (또는 관리자)
  const profile = await prisma.userProfile.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  });

  const isAdmin = profile?.role && ['master', 'emergency_center_admin', 'ministry_admin'].includes(profile.role);
  const isOwner = inspection.inspectorId === session.user.id;

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'You do not have permission to delete this inspection' }, { status: 403 });
  }

  // 실제 DELETE 수행 (Prisma는 RLS가 없으므로 직접 삭제)
  try {
    await prisma.inspection.delete({
      where: { id: inspectionId }
    });
  } catch (deleteError) {
    console.error('[Delete Inspection] Delete error:', deleteError);
    return NextResponse.json({ error: 'Failed to delete inspection record' }, { status: 500 });
  }

  // 삭제 로그 기록
  try {
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'delete_inspection',
        entityType: 'inspections',
        entityId: inspectionId,
        metadata: {
          equipment_serial: inspection.equipmentSerial,
          inspection_date: inspection.inspectionDate.toISOString(),
          reason: reason || 'No reason provided',
        },
        createdAt: new Date()
      }
    });
  } catch (err) {
    // 로그 실패해도 삭제는 성공
    console.warn('[Delete Inspection] Audit log failed:', err);
  }

  return NextResponse.json({
    success: true,
    message: '점검 이력이 삭제되었습니다.',
  });
  } catch (error) {
    console.error('[Delete Inspection] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete inspection' },
      { status: 500 }
    );
  }
}
