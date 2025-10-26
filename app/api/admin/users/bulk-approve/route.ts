import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { canApproveUsers } from '@/lib/auth/config';
import { generateApprovalSuggestion } from '@/lib/utils/approval-helpers';

export async function POST(request: NextRequest) {
  try {
    // 현재 사용자 확인
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }

    // 현재 사용자의 프로필 조회
    const currentUserProfile = await prisma.userProfile.findUnique({
      where: { id: session.user.id },
      select: { role: true, email: true, fullName: true }
    });

    if (!currentUserProfile) {
      return NextResponse.json(
        { error: '사용자 프로필을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 승인 권한 확인
    if (!canApproveUsers(currentUserProfile.role)) {
      return NextResponse.json(
        { error: '사용자 승인 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 요청 데이터 파싱
    const { userIds } = await request.json();

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: '사용자 ID 목록이 필요합니다.' },
        { status: 400 }
      );
    }

    // 벌크 승인 대상 사용자들 조회
    const targetUsers = await prisma.userProfile.findMany({
      where: {
        id: { in: userIds }
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        organizationName: true,
        role: true
      }
    });

    if (!targetUsers || targetUsers.length === 0) {
      return NextResponse.json(
        { error: '승인 대상 사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 승인 대기 상태가 아닌 사용자 필터링
    const pendingUsers = targetUsers.filter(u => u.role === 'pending_approval');

    if (pendingUsers.length === 0) {
      return NextResponse.json(
        { error: '승인 대기 중인 사용자가 없습니다.' },
        { status: 400 }
      );
    }

    const results = [];
    const errors = [];

    // 각 사용자에 대해 승인 처리
    for (const targetUser of pendingUsers) {
      try {
        // 스마트 추천 생성
        const suggestion = generateApprovalSuggestion(
          targetUser.email,
          targetUser.organizationName || ''
        );

        // 사용자 프로필 업데이트
        try {
          await prisma.userProfile.update({
            where: { id: targetUser.id },
            data: {
              role: suggestion.role,
              regionCode: suggestion.regionCode || null,
              isActive: true,
              updatedAt: new Date()
            }
          });
        } catch (updateError: any) {
          errors.push({
            userId: targetUser.id,
            email: targetUser.email,
            error: updateError.message
          });
          continue;
        }

        results.push({
          userId: targetUser.id,
          email: targetUser.email,
          fullName: targetUser.fullName,
          assignedRole: suggestion.role,
          regionCode: suggestion.regionCode
        });

        // 승인 이메일 발송 (비동기)
        try {
          const roleNames: Record<string, string> = {
            'master': 'Master 관리자',
            'emergency_center_admin': '중앙응급의료센터 관리자',
            'ministry_admin': '보건복지부 관리자',
            'regional_admin': '시도 관리자',
            'local_admin': '보건소 담당자',
            'temporary_inspector': '임시 점검원'
          };

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'noreply@aed.pics',
              to: targetUser.email,
              subject: '[AED 시스템] 회원가입이 승인되었습니다',
              html: `
                <h2>AED 점검 시스템 가입 승인 안내</h2>

                <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #2e7d32;">회원가입이 승인되었습니다!</h3>
                  <p style="color: #333; line-height: 1.6;">
                    축하합니다! AED 점검 시스템에 성공적으로 가입하셨습니다.
                  </p>
                </div>

                <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <h4>당신의 계정 정보</h4>
                  <ul style="line-height: 1.8;">
                    <li><strong>역할:</strong> ${roleNames[suggestion.role] || suggestion.role}</li>
                    ${suggestion.regionCode ? `<li><strong>지역:</strong> ${suggestion.regionCode}</li>` : ''}
                  </ul>
                  <p style="color: #666; margin-top: 10px; font-size: 14px;">
                    * 일괄 승인 처리로 자동 설정되었습니다.
                  </p>
                </div>

                <div style="margin-top: 30px; text-align: center;">
                  <a href="${process.env.NEXT_PUBLIC_SITE_URL}/auth/signin"
                     style="background: #22c55e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    로그인하기
                  </a>
                </div>

                <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">

                <p style="color: #666; font-size: 12px;">
                  문의사항: truth0530@nmc.or.kr<br>
                  이 이메일은 AED 점검 시스템에서 자동으로 발송되었습니다.
                </p>
              `
            })
          });
        } catch (emailError) {
          console.error('Bulk approval email send error:', emailError);
          // 이메일 발송 실패해도 승인은 완료
        }

        // 승인 결과 알림 발송 (비동기)
        try {
          await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/notifications/approval-result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: targetUser.id,
              approved: true,
              approverName: currentUserProfile.fullName || currentUserProfile.email,
              bulk: true
            })
          });
        } catch (notifyError) {
          console.error('Failed to send bulk approval notification:', notifyError);
        }

      } catch (userError) {
        console.error(`Error approving user ${targetUser.id}:`, userError);
        errors.push({
          userId: targetUser.id,
          email: targetUser.email,
          error: userError instanceof Error ? userError.message : '알 수 없는 오류'
        });
      }
    }

    // 감사 로그 기록
    for (const result of results) {
      try {
        await prisma.auditLog.create({
          data: {
            action: 'user_bulk_approved',
            actorId: session.user.id,
            actorEmail: currentUserProfile.email,
            targetId: result.userId,
            targetEmail: result.email,
            metadata: {
              assigned_role: result.assignedRole,
              region_code: result.regionCode,
              bulk_operation: true,
              total_processed: results.length
            },
            createdAt: new Date()
          }
        });
      } catch (auditError) {
        console.error('Audit log exception (non-critical):', auditError);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${results.length}명의 사용자가 승인되었습니다.`,
      results,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        total_requested: userIds.length,
        total_approved: results.length,
        total_errors: errors.length,
        pending_users_found: pendingUsers.length
      }
    });

  } catch (error) {
    console.error('Error in bulk user approval:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // 현재 사용자 확인
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }

    // 현재 사용자의 프로필 조회
    const currentUserProfile = await prisma.userProfile.findUnique({
      where: { id: session.user.id },
      select: { role: true, email: true, fullName: true }
    });

    if (!currentUserProfile) {
      return NextResponse.json(
        { error: '사용자 프로필을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 승인 권한 확인
    if (!canApproveUsers(currentUserProfile.role)) {
      return NextResponse.json(
        { error: '사용자 거부 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 요청 데이터 파싱
    const { userIds, rejectReason } = await request.json();

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: '사용자 ID 목록이 필요합니다.' },
        { status: 400 }
      );
    }

    // 벌크 거부 대상 사용자들 조회
    const targetUsers = await prisma.userProfile.findMany({
      where: {
        id: { in: userIds }
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true
      }
    });

    if (!targetUsers || targetUsers.length === 0) {
      return NextResponse.json(
        { error: '거부 대상 사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 승인 대기 상태인 사용자만 필터링
    const pendingUsers = targetUsers.filter(u => u.role === 'pending_approval');

    if (pendingUsers.length === 0) {
      return NextResponse.json(
        { error: '승인 대기 중인 사용자가 없습니다.' },
        { status: 400 }
      );
    }

    const results = [];
    const errors = [];

    // 각 사용자에 대해 거부 처리 (프로필 삭제)
    for (const targetUser of pendingUsers) {
      try {
        // 사용자 프로필 삭제
        try {
          await prisma.userProfile.delete({
            where: { id: targetUser.id }
          });
        } catch (deleteError: any) {
          errors.push({
            userId: targetUser.id,
            email: targetUser.email,
            error: deleteError.message
          });
          continue;
        }

        results.push({
          userId: targetUser.id,
          email: targetUser.email,
          fullName: targetUser.fullName
        });

        // 거부 이메일 발송 (비동기)
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'noreply@aed.pics',
              to: targetUser.email,
              subject: '[AED 시스템] 회원가입 검토 결과 안내',
              html: `
                <h2>AED 점검 시스템 가입 검토 결과</h2>

                <div style="background: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #c62828;">회원가입이 거부되었습니다</h3>
                  <p style="color: #333; line-height: 1.6;">
                    죄송합니다. 귀하의 회원가입 신청이 승인되지 않았습니다.
                  </p>
                </div>

                ${rejectReason ? `
                <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <h4>거부 사유</h4>
                  <p style="color: #666; line-height: 1.6;">${rejectReason}</p>
                </div>
                ` : ''}

                <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <h4>다시 신청하려면?</h4>
                  <ul style="line-height: 1.8; color: #666;">
                    <li>공공기관 이메일(@korea.kr, @nmc.or.kr)로 재가입을 권장합니다</li>
                    <li>소속기관 확인 후 정확한 정보로 가입해주세요</li>
                    <li>문의사항은 아래 연락처로 문의해주세요</li>
                  </ul>
                </div>

                <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">

                <p style="color: #666; font-size: 12px;">
                  문의사항: truth0530@nmc.or.kr<br>
                  이 이메일은 AED 점검 시스템에서 자동으로 발송되었습니다.
                </p>
              `
            })
          });
        } catch (emailError) {
          console.error('Bulk rejection email send error:', emailError);
          // 이메일 발송 실패해도 거부는 완료
        }

        // 거부 결과 알림 발송 (비동기)
        try {
          await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/notifications/approval-result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: targetUser.id,
              approved: false,
              reason: rejectReason || '관리자가 일괄 거부했습니다.',
              approverName: currentUserProfile.fullName || currentUserProfile.email,
              bulk: true
            })
          });
        } catch (notifyError) {
          console.error('Failed to send bulk rejection notification:', notifyError);
        }

      } catch (userError) {
        console.error(`Error rejecting user ${targetUser.id}:`, userError);
        errors.push({
          userId: targetUser.id,
          email: targetUser.email,
          error: userError instanceof Error ? userError.message : '알 수 없는 오류'
        });
      }
    }

    // 감사 로그 기록
    for (const result of results) {
      try {
        await prisma.auditLog.create({
          data: {
            action: 'user_bulk_rejected',
            actorId: session.user.id,
            actorEmail: currentUserProfile.email,
            targetId: result.userId,
            targetEmail: result.email,
            metadata: {
              rejection_reason: rejectReason,
              bulk_operation: true,
              total_processed: results.length
            },
            createdAt: new Date()
          }
        });
      } catch (auditError) {
        console.error('Audit log exception (non-critical):', auditError);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${results.length}명의 사용자 가입이 거부되었습니다.`,
      results,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        total_requested: userIds.length,
        total_rejected: results.length,
        total_errors: errors.length,
        pending_users_found: pendingUsers.length
      }
    });

  } catch (error) {
    console.error('Error in bulk user rejection:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
