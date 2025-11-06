/**
 * 관리자 승인 이메일 발송
 *
 * 사용자 가입 승인 시 자동으로 이메일 발송
 */

import { sendSimpleEmail } from './ncp-email';
import { user_role } from '@prisma/client';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

const NCP_CONFIG = {
  accessKey: env.NCP_ACCESS_KEY,
  accessSecret: env.NCP_ACCESS_SECRET,
  senderAddress: env.NCP_SENDER_EMAIL,
  senderName: 'AED관리시스템'
};

// 역할 한글 매핑
const ROLE_KOREAN: Record<string, string> = {
  'super_admin': '슈퍼 관리자',
  'local_admin': '지역 관리자',
  'inspector': '점검원',
  'temporary_inspector': '임시 점검원',
  'field_admin': '현장 관리자',
  'pending_approval': '승인 대기',
  'email_verified': '이메일 인증 완료',
  'rejected': '거부됨'
};

// 역할별 권한 설명
const ROLE_PERMISSIONS: Record<string, string> = {
  'super_admin': '시스템 전체 관리 및 모든 기능 사용 가능',
  'local_admin': '소속 지역 내 AED 데이터 조회 및 점검 관리, 사용자 관리',
  'inspector': '배정된 AED 점검 수행 및 보고서 작성',
  'temporary_inspector': '제한된 기간 동안 배정된 AED 점검 수행',
  'field_admin': '현장 점검 활동 관리 및 점검원 배정',
  'pending_approval': '승인 대기 중 - 관리자 승인 필요',
  'email_verified': '이메일 인증 완료 - 관리자 승인 대기',
  'rejected': '가입 거부됨'
};

/**
 * 승인 이메일 발송
 *
 * @param userEmail 사용자 이메일
 * @param userName 사용자 이름
 * @param role 승인된 역할
 * @param organizationName 소속 조직명
 * @param approvedAt 승인 일시
 */
export async function sendApprovalEmail(
  userEmail: string,
  userName: string | null,
  role: user_role,
  organizationName: string,
  approvedAt: Date
) {
  // userName이 null이거나 빈 문자열일 경우 기본값 사용
  const safeUserName = userName?.trim() || '사용자';

  const roleKorean = ROLE_KOREAN[role] || role;
  const rolePermissions = ROLE_PERMISSIONS[role] || '역할에 대한 설명이 없습니다.';

  const htmlBody = `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>계정 승인 완료</title>
    </head>
    <body style="font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
        <h1 style="color: #0066cc; margin-bottom: 20px; font-size: 24px;">계정이 승인되었습니다</h1>

        <p style="font-size: 16px; margin-bottom: 20px;">안녕하세요 <strong>${safeUserName}</strong>님,</p>

        <p style="font-size: 16px; margin-bottom: 30px;">
          AED 관리 시스템 가입 신청이 승인되었습니다.<br>
          이제 시스템에 로그인하여 서비스를 이용하실 수 있습니다.
        </p>

        <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #0066cc;">
          <h2 style="color: #333; font-size: 18px; margin-top: 0; margin-bottom: 15px;">승인 정보</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666; width: 120px;">이메일</td>
              <td style="padding: 8px 0; font-weight: bold;">${userEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">역할</td>
              <td style="padding: 8px 0; font-weight: bold; color: #0066cc;">${roleKorean}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">소속</td>
              <td style="padding: 8px 0; font-weight: bold;">${organizationName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">승인 일시</td>
              <td style="padding: 8px 0; font-weight: bold;">${approvedAt.toLocaleString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</td>
            </tr>
          </table>
        </div>

        <div style="background-color: #e7f3ff; padding: 15px; border-radius: 8px; margin-bottom: 30px;">
          <h3 style="color: #0066cc; font-size: 16px; margin-top: 0; margin-bottom: 10px;">부여된 권한</h3>
          <p style="margin: 0; font-size: 14px; color: #555;">${rolePermissions}</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://aed.pics/auth/login"
             style="display: inline-block;
                    background-color: #0066cc;
                    color: white;
                    padding: 15px 40px;
                    text-decoration: none;
                    border-radius: 5px;
                    font-size: 16px;
                    font-weight: bold;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            로그인하기
          </a>
        </div>

        <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 30px; border-left: 4px solid #ffc107;">
          <h3 style="color: #856404; font-size: 14px; margin-top: 0; margin-bottom: 8px;">주의사항</h3>
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #856404;">
            <li>초기 로그인 시 비밀번호를 변경하시기 바랍니다.</li>
            <li>계정 정보는 타인과 공유하지 마세요.</li>
            <li>의심스러운 활동이 발견되면 즉시 관리자에게 문의하세요.</li>
          </ul>
        </div>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

        <div style="font-size: 14px; color: #666; text-align: center;">
          <p style="margin: 5px 0;">문의사항이 있으시면 아래 연락처로 문의해 주세요.</p>
          <p style="margin: 5px 0;">
            <strong>관리자</strong>: admin@nmc.or.kr<br>
            <strong>기술지원</strong>: inhak@nmc.or.kr
          </p>
          <p style="margin: 20px 0 5px 0; color: #999; font-size: 12px;">
            이 이메일은 AED 관리 시스템에서 자동으로 발송되었습니다.<br>
            회신하지 마시기 바랍니다.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await sendSimpleEmail(
      NCP_CONFIG,
      userEmail,
      safeUserName,  // null 방지를 위해 안전한 이름 사용
      '[AED관리시스템] 계정이 승인되었습니다',
      htmlBody
    );

    logger.info('ApprovalEmail', 'Email sent successfully', {
      recipient: userEmail,
      role: roleKorean
    });
  } catch (error) {
    logger.error('ApprovalEmail', `Failed to send approval email to ${userEmail}`, error instanceof Error ? error : { error });
    throw error;
  }
}
