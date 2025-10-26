import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * POST /api/inspections/mark-unavailable
 * 점검불가 상태로 변경 (inspection_assignments의 status를 'unavailable'로 변경)
 */
export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 요청 본문 파싱
    const body = await request.json();
    const {
      equipmentSerial,
      reason,
      note
    } = body;

    // 필수 파라미터 확인
    if (!equipmentSerial) {
      return NextResponse.json(
        { error: 'equipmentSerial은 필수입니다.' },
        { status: 400 }
      );
    }

    if (!reason || !['disposed', 'broken', 'other'].includes(reason)) {
      return NextResponse.json(
        { error: 'reason은 disposed, broken, other 중 하나여야 합니다.' },
        { status: 400 }
      );
    }

    // 기타 사유일 경우 note 필수
    if (reason === 'other' && !note) {
      return NextResponse.json(
        { error: '기타 사유를 선택한 경우 상세 사유(note)를 입력해야 합니다.' },
        { status: 400 }
      );
    }

    // 해당 장비에 대한 할당 레코드 조회 (본인이 할당한 것만)
    try {
      const existingAssignment = await prisma.inspectionsAssignment.findFirst({
        where: {
          equipmentSerial: equipmentSerial,
          assignedBy: session.user.id,
          OR: [
            { status: 'pending' },
            { status: 'in_progress' }
          ]
        }
      });

      if (!existingAssignment) {
        // 새 할당 레코드 생성
        try {
          const newAssignment = await prisma.inspectionsAssignment.create({
            data: {
              equipmentSerial: equipmentSerial,
              assignedTo: session.user.id,
              assignedBy: session.user.id,
              assignmentType: 'scheduled',
              status: 'unavailable',
              unavailableReason: reason as any,
              unavailableNote: note,
              unavailableAt: new Date()
            }
          });

          return NextResponse.json({
            success: true,
            assignment: newAssignment,
            message: '점검불가 상태로 등록되었습니다.'
          });
        } catch (insertError: any) {
          console.error('[mark-unavailable] Error creating assignment:', insertError);
          return NextResponse.json(
            { error: '점검불가 상태 등록 중 오류가 발생했습니다.', detail: insertError.message },
            { status: 500 }
          );
        }
      }

      // 기존 할당이 있으면 업데이트
      try {
        const updatedAssignment = await prisma.inspectionsAssignment.update({
          where: { id: existingAssignment.id },
          data: {
            status: 'unavailable',
            unavailableReason: reason as any,
            unavailableNote: note,
            unavailableAt: new Date(),
            updatedAt: new Date()
          }
        });

        return NextResponse.json({
          success: true,
          assignment: updatedAssignment,
          message: '점검불가 상태로 변경되었습니다.'
        });
      } catch (updateError: any) {
        console.error('[mark-unavailable] Error updating assignment:', updateError);
        return NextResponse.json(
          { error: '점검불가 상태 변경 중 오류가 발생했습니다.', detail: updateError.message },
          { status: 500 }
        );
      }
    } catch (fetchError: any) {
      console.error('[mark-unavailable] Error fetching assignment:', fetchError);
      return NextResponse.json(
        { error: '할당 정보 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[mark-unavailable] Unexpected error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/inspections/mark-unavailable?equipmentSerial=xxx
 * 점검불가 상태 취소 (status를 다시 'pending'으로 변경)
 */
export async function DELETE(request: NextRequest) {
  try {
    // 인증 확인
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // URL 파라미터에서 equipmentSerial 가져오기
    const { searchParams } = new URL(request.url);
    const equipmentSerial = searchParams.get('equipmentSerial');

    if (!equipmentSerial) {
      return NextResponse.json(
        { error: 'equipmentSerial 파라미터가 필요합니다.' },
        { status: 400 }
      );
    }

    // 점검불가 상태인 할당 레코드 조회
    try {
      const assignment = await prisma.inspectionsAssignment.findFirst({
        where: {
          equipmentSerial: equipmentSerial,
          assignedBy: session.user.id,
          status: 'unavailable'
        }
      });

      if (!assignment) {
        return NextResponse.json(
          { error: '점검불가 상태인 장비를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      // 상태를 pending으로 변경하고 unavailable 필드 초기화
      try {
        const updatedAssignment = await prisma.inspectionsAssignment.update({
          where: { id: assignment.id },
          data: {
            status: 'pending',
            unavailableReason: null,
            unavailableNote: null,
            unavailableAt: null,
            updatedAt: new Date()
          }
        });

        return NextResponse.json({
          success: true,
          assignment: updatedAssignment,
          message: '점검불가 상태가 취소되었습니다.'
        });
      } catch (updateError: any) {
        console.error('[mark-unavailable DELETE] Error updating assignment:', updateError);
        return NextResponse.json(
          { error: '점검불가 상태 취소 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }
    } catch (fetchError: any) {
      console.error('[mark-unavailable DELETE] Error fetching assignment:', fetchError);
      return NextResponse.json(
        { error: '할당 정보 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[mark-unavailable DELETE] Unexpected error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
