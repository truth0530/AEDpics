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
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const { id: inspectionId } = await params;

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
  const inspection = await prisma.inspections.findUnique({
    where: { id: inspectionId },
    select: {
      id: true,
      inspector_id: true,
      equipment_serial: true,
      inspection_date: true
    }
  });

  if (!inspection) {
    return NextResponse.json({ error: 'Inspection record not found' }, { status: 404 });
  }

  // 권한 확인: 본인만 삭제 가능 (또는 관리자)
  const profile = await prisma.user_profiles.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  });

  const isAdmin = profile?.role && ['master', 'emergency_center_admin', 'ministry_admin'].includes(profile.role);
  const isOwner = inspection.inspector_id === session.user.id;

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'You do not have permission to delete this inspection' }, { status: 403 });
  }

  // 실제 DELETE 수행 (Prisma는 RLS가 없으므로 직접 삭제)
  try {
    await prisma.inspections.delete({
      where: { id: inspectionId }
    });
  } catch (deleteError) {
    console.error('[Delete Inspection] Delete error:', deleteError);
    return NextResponse.json({ error: 'Failed to delete inspection record' }, { status: 500 });
  }

  // 삭제 로그 기록
  try {
    await prisma.audit_logs.create({
      data: {
        id: require('crypto').randomUUID(),
        user_id: session.user.id,
        action: 'delete_inspection',
        entity_type: 'inspections',
        entity_id: inspectionId,
        metadata: {
          equipment_serial: inspection.equipment_serial,
          inspection_date: inspection.inspection_date?.toISOString(),
          reason: reason || 'No reason provided',
        },
        created_at: new Date()
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
