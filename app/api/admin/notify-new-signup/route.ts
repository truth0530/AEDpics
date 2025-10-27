import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getMasterAdminEmails } from '@/lib/auth/config';
import { sendSimpleEmail } from '@/lib/email/ncp-email';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { email, fullName, organizationName, region, accountType } = await request.json();

    // Master 관리자 이메일 목록 가져오기
    const masterEmails = getMasterAdminEmails();

    // 추가로 중앙응급의료센터 관리자들 가져오기
    const adminProfiles = await prisma.user_profiles.findMany({
      where: {
        role: { in: ['master', 'emergency_center_admin', 'ministry_admin'] },
        is_active: true,
      },
      select: {
        email: true,
      },
    });

    const adminEmails = [
      ...masterEmails,
      ...(adminProfiles?.map(p => p.email) || [])
    ].filter((email, index, self) => self.indexOf(email) === index); // 중복 제거

    // 각 관리자에게 이메일 발송
    const emailPromises = adminEmails.map(async (adminEmail) => {
      try {
        await sendSimpleEmail(
          {
            accessKey: process.env.NCP_ACCESS_KEY!,
            accessSecret: process.env.NCP_ACCESS_SECRET!,
            senderAddress: process.env.NCP_SENDER_EMAIL!,
            senderName: 'AED 픽스'
          },
          adminEmail,
          '관리자',
          `[AED 시스템] 새로운 회원가입 승인 요청 - ${fullName}`,
          `
              <h2>새로운 회원가입 승인 요청</h2>
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #333;">가입자 정보</h3>
                <ul style="line-height: 1.8;">
                  <li><strong>이름:</strong> ${fullName}</li>
                  <li><strong>이메일:</strong> ${email}</li>
                  <li><strong>소속기관:</strong> ${organizationName}</li>
                  <li><strong>지역:</strong> ${region}</li>
                  <li><strong>계정 유형:</strong> ${accountType === 'public' ? '공공기관' : '일반(임시점검원)'}</li>
                </ul>
              </div>

              <div style="background: ${accountType === 'public' ? '#e8f5e9' : '#fff3e0'}; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="color: ${accountType === 'public' ? '#2e7d32' : '#e65100'};">
                  ${accountType === 'public'
                    ? '✓ 공공기관 이메일로 가입한 정식 담당자입니다.'
                    : '⚠️ 일반 이메일로 가입한 임시 점검원입니다.'}
                </p>
              </div>

              <div style="margin-top: 30px;">
                <a href="${process.env.NEXT_PUBLIC_SITE_URL}/admin/users"
                   style="background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  사용자 관리 페이지로 이동
                </a>
              </div>

              <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">

              <p style="color: #666; font-size: 12px;">
                이 이메일은 AED 점검 시스템에서 자동으로 발송되었습니다.<br>
                문의: truth0530@nmc.or.kr
              </p>
            `,
          { maxRetries: 3, initialDelay: 1000, exponentialBase: 2 }
        );
      } catch (error) {
        console.error('Error sending admin notification email:', error);
      }
    });

    await Promise.all(emailPromises);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending admin notifications:', error);
    return NextResponse.json(
      { error: '알림 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}