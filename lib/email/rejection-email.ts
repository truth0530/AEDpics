/**
 * 관리자 거부 이메일 발송
 *
 * 사용자 가입 거부 시 자동으로 이메일 발송
 */

import { sendSimpleEmail } from './ncp-email';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

const NCP_CONFIG = {
  accessKey: env.NCP_ACCESS_KEY,
  accessSecret: env.NCP_ACCESS_SECRET,
  senderAddress: env.NCP_SENDER_EMAIL,
  senderName: 'AED관리시스템'
};

/**
 * 거부 이메일 발송
 *
 * @param userEmail 사용자 이메일
 * @param userName 사용자 이름
 * @param reason 거부 사유
 */
export async function sendRejectionEmail(
  userEmail: string,
  userName: string | null,
  reason: string
) {
  // userName이 null이거나 빈 문자열일 경우 기본값 사용
  const safeUserName = userName?.trim() || '사용자';

  const htmlBody = `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>가입 신청 반려</title>
    </head>
    <body style="font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
        <h1 style="color: #d9534f; margin-bottom: 20px; font-size: 24px;">가입 신청이 반려되었습니다</h1>

        <p style="font-size: 16px; margin-bottom: 20px;">안녕하세요 <strong>${safeUserName}</strong>님,</p>

        <p style="font-size: 16px; margin-bottom: 30px;">
          AED 관리 시스템 가입 신청이 반려되었습니다.
        </p>

        <div style="background-color: #f2dede; padding: 20px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid: #d9534f;">
          <h2 style="color: #a94442; font-size: 18px; margin-top: 0; margin-bottom: 15px;">반려 사유</h2>
          <p style="margin: 0; color: #a94442; font-size: 15px; line-height: 1.6;">
            ${reason.split('\n').map(line => `${line}<br>`).join('')}
          </p>
        </div>

        <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #5bc0de;">
          <h3 style="color: #31708f; font-size: 16px; margin-top: 0; margin-bottom: 10px;">추가 안내</h3>
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #31708f;">
            반려 사유에 대해 문의사항이 있거나 재신청을 원하시는 경우,<br>
            아래 연락처로 문의해 주시기 바랍니다.
          </p>
          <ul style="margin: 10px 0 0 0; padding-left: 20px; font-size: 14px; color: #31708f;">
            <li>반려 사유에 대한 추가 설명이 필요한 경우</li>
            <li>정보를 수정하여 재신청을 원하는 경우</li>
            <li>시스템 이용에 대한 문의사항이 있는 경우</li>
          </ul>
        </div>

        <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 30px; border-left: 4px solid #ffc107;">
          <h3 style="color: #856404; font-size: 14px; margin-top: 0; margin-bottom: 8px;">재신청 안내</h3>
          <p style="margin: 0; font-size: 14px; color: #856404;">
            반려 사유를 확인하신 후, 필요한 사항을 보완하여 재신청하실 수 있습니다.<br>
            재신청 시 반려 사유를 참고하여 정확한 정보를 입력해 주시기 바랍니다.
          </p>
        </div>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

        <div style="font-size: 14px; color: #666; text-align: center;">
          <p style="margin: 5px 0;">문의사항이 있으시면 아래 연락처로 문의해 주세요.</p>
          <div style="background-color: #e7f3ff; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p style="margin: 5px 0; font-size: 15px;">
              <strong>관리자</strong>: <a href="mailto:admin@nmc.or.kr" style="color: #0066cc; text-decoration: none;">admin@nmc.or.kr</a><br>
              <strong>기술지원</strong>: <a href="mailto:inhak@nmc.or.kr" style="color: #0066cc; text-decoration: none;">inhak@nmc.or.kr</a>
            </p>
          </div>
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
      '[AED관리시스템] 가입 신청이 반려되었습니다',
      htmlBody
    );

    logger.info('RejectionEmail', 'Email sent successfully', {
      recipient: userEmail
    });
  } catch (error) {
    logger.error('RejectionEmail', `Failed to send rejection email to ${userEmail}`, error instanceof Error ? error : { error });
    throw error;
  }
}
