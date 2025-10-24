/**
 * Email Sending Utilities
 *
 * nodemailer를 사용한 이메일 발송
 * - OTP 인증 코드
 * - 비밀번호 재설정
 * - 알림 이메일
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

/**
 * Nodemailer Transporter 초기화
 */
function getTransporter(): Transporter {
  if (transporter) {
    return transporter;
  }

  // SMTP 설정
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  return transporter;
}

/**
 * OTP 인증 코드 생성
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * OTP 인증 이메일 발송
 */
export async function sendOTPEmail(
  email: string,
  code: string,
  expiresInMinutes: number = 10
): Promise<boolean> {
  try {
    const mailer = getTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'AED 점검 시스템 <noreply@aedpics.com>',
      to: email,
      subject: '[AED 점검 시스템] 이메일 인증 코드',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
            .code-box { background: white; border: 2px dashed #2563eb; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
            .code { font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 8px; }
            .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
            .warning { color: #dc2626; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚑 AED 점검 시스템</h1>
              <p>이메일 인증 코드</p>
            </div>
            <div class="content">
              <p>안녕하세요,</p>
              <p>AED 점검 시스템에 가입해 주셔서 감사합니다.</p>
              <p>아래의 인증 코드를 입력하여 이메일 인증을 완료해주세요.</p>

              <div class="code-box">
                <div class="code">${code}</div>
              </div>

              <p><strong>유효 시간:</strong> ${expiresInMinutes}분</p>
              <p class="warning">⚠️ 이 코드는 타인에게 절대 공유하지 마세요.</p>
              <p>만약 본인이 요청하지 않았다면 이 이메일을 무시하셔도 됩니다.</p>
            </div>
            <div class="footer">
              <p>© 2025 AED 점검 시스템. All rights reserved.</p>
              <p>이 이메일은 자동으로 발송되었습니다. 회신하지 마세요.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    await mailer.sendMail(mailOptions);
    console.log(`[Email] OTP sent to ${email}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send OTP:', error);
    return false;
  }
}

/**
 * 비밀번호 재설정 이메일 발송
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string
): Promise<boolean> {
  try {
    const mailer = getTransporter();
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'AED 점검 시스템 <noreply@aedpics.com>',
      to: email,
      subject: '[AED 점검 시스템] 비밀번호 재설정',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
            .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
            .warning { color: #dc2626; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚑 AED 점검 시스템</h1>
              <p>비밀번호 재설정</p>
            </div>
            <div class="content">
              <p>안녕하세요,</p>
              <p>비밀번호 재설정을 요청하셨습니다.</p>
              <p>아래 버튼을 클릭하여 새로운 비밀번호를 설정해주세요.</p>

              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">비밀번호 재설정하기</a>
              </div>

              <p><strong>유효 시간:</strong> 1시간</p>
              <p class="warning">⚠️ 만약 본인이 요청하지 않았다면 이 이메일을 무시하세요.</p>
              <p>링크가 작동하지 않으면 아래 URL을 복사하여 브라우저에 붙여넣으세요:</p>
              <p style="word-break: break-all; font-size: 12px; color: #6b7280;">${resetUrl}</p>
            </div>
            <div class="footer">
              <p>© 2025 AED 점검 시스템. All rights reserved.</p>
              <p>이 이메일은 자동으로 발송되었습니다. 회신하지 마세요.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    await mailer.sendMail(mailOptions);
    console.log(`[Email] Password reset email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send password reset email:', error);
    return false;
  }
}

/**
 * 일정 할당 알림 이메일 발송
 */
export async function sendAssignmentNotificationEmail(
  email: string,
  data: {
    inspectorName: string;
    equipmentSerial: string;
    scheduledDate: string;
    location: string;
  }
): Promise<boolean> {
  try {
    const mailer = getTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'AED 점검 시스템 <noreply@aedpics.com>',
      to: email,
      subject: '[AED 점검 시스템] 새로운 점검 일정 할당',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
            .info-box { background: white; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; }
            .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚑 AED 점검 시스템</h1>
              <p>새로운 점검 일정 할당</p>
            </div>
            <div class="content">
              <p>안녕하세요, <strong>${data.inspectorName}</strong>님</p>
              <p>새로운 AED 점검 일정이 할당되었습니다.</p>

              <div class="info-box">
                <p><strong>📍 설치 위치:</strong> ${data.location}</p>
                <p><strong>🔖 기기 번호:</strong> ${data.equipmentSerial}</p>
                <p><strong>📅 점검 예정일:</strong> ${data.scheduledDate}</p>
              </div>

              <p>시스템에 로그인하여 자세한 내용을 확인해주세요.</p>
              <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="color: #2563eb;">대시보드로 이동 →</a></p>
            </div>
            <div class="footer">
              <p>© 2025 AED 점검 시스템. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    await mailer.sendMail(mailOptions);
    console.log(`[Email] Assignment notification sent to ${email}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send assignment notification:', error);
    return false;
  }
}

/**
 * 이메일 발송 테스트
 */
export async function testEmailConnection(): Promise<boolean> {
  try {
    const mailer = getTransporter();
    await mailer.verify();
    console.log('[Email] SMTP connection verified');
    return true;
  } catch (error) {
    console.error('[Email] SMTP connection failed:', error);
    return false;
  }
}
