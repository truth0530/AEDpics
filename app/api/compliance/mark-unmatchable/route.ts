import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

/**
 * POST /api/compliance/mark-unmatchable
 * 의무설치기관을 매칭 불가로 표시
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { target_key, year, reason } = body;

    if (!target_key || !year || !reason || reason.trim() === '') {
      return NextResponse.json(
        { error: 'target_key, year, and reason are required' },
        { status: 400 }
      );
    }

    // 이미 매칭 불가로 표시되었는지 확인
    const existingLog = await prisma.target_list_match_logs.findFirst({
      where: {
        target_key,
        target_list_year: parseInt(year),
        action: 'mark_unmatchable',
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // 이미 표시되어 있으면 중복 방지
    if (existingLog) {
      return NextResponse.json(
        { error: 'This institution is already marked as unmatchable' },
        { status: 400 }
      );
    }

    // 매칭 불가 로그 생성
    const log = await prisma.target_list_match_logs.create({
      data: {
        action: 'mark_unmatchable',
        target_list_year: parseInt(year),
        target_key,
        management_numbers: [], // 매칭 없음
        user_id: session.user.id,
        reason: reason.trim(),
      },
    });

    return NextResponse.json({
      success: true,
      log_id: log.id,
      message: 'Institution marked as unmatchable',
    });

  } catch (error) {
    console.error('Failed to mark as unmatchable:', error);
    return NextResponse.json(
      { error: 'Failed to mark as unmatchable', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/compliance/mark-unmatchable
 * 매칭 불가 표시 취소
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { target_key, year } = body;

    if (!target_key || !year) {
      return NextResponse.json(
        { error: 'target_key and year are required' },
        { status: 400 }
      );
    }

    // 가장 최근의 매칭 불가 로그 찾기
    const existingLog = await prisma.target_list_match_logs.findFirst({
      where: {
        target_key,
        target_list_year: parseInt(year),
        action: 'mark_unmatchable',
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    if (!existingLog) {
      return NextResponse.json(
        { error: 'No unmatchable mark found for this institution' },
        { status: 404 }
      );
    }

    // 매칭 불가 표시 취소 로그 생성
    const cancelLog = await prisma.target_list_match_logs.create({
      data: {
        action: 'cancel_unmatchable',
        target_list_year: parseInt(year),
        target_key,
        management_numbers: [],
        user_id: session.user.id,
        reason: `Cancelled unmatchable status (original reason: ${existingLog.reason})`,
      },
    });

    return NextResponse.json({
      success: true,
      log_id: cancelLog.id,
      message: 'Unmatchable status cancelled',
    });

  } catch (error) {
    console.error('Failed to cancel unmatchable status:', error);
    return NextResponse.json(
      { error: 'Failed to cancel unmatchable status', details: String(error) },
      { status: 500 }
    );
  }
}
