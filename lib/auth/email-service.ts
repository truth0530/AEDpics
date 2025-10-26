/**
 * 이메일 발송 서비스
 * Supabase Edge Functions를 사용한 이메일 발송
 */

// TODO: Supabase 클라이언트 임시 비활성화
// import { createClient } from '@/lib/supabase/client';

// 임시: Supabase createClient stub
const createClient = (): any => {
  return null;
};

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * OTP 이메일 템플릿 생성
 */
export function generateOTPEmailTemplate(code: string): { subject: string; html: string; text: string } {
  const subject = '[AED 점검 시스템] 이메일 인증번호';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #22c55e; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border: 1px solid #dee2e6; border-radius: 0 0 10px 10px; }
        .code-box { background: white; border: 2px solid #22c55e; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
        .code { font-size: 32px; font-weight: bold; color: #22c55e; letter-spacing: 8px; }
        .footer { margin-top: 20px; text-align: center; color: #6c757d; font-size: 12px; }
        .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 5px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>AED 스마트 점검 시스템</h1>
          <p>이메일 인증</p>
        </div>
        <div class="content">
          <h2>안녕하세요!</h2>
          <p>AED 스마트 점검 시스템 회원가입을 위한 인증번호입니다.</p>
          
          <div class="code-box">
            <p style="margin: 0 0 10px 0; color: #666;">인증번호</p>
            <div class="code">${code}</div>
            <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">10분간 유효합니다</p>
          </div>
          
          <p>회원가입 화면에서 위 인증번호 6자리를 입력해주세요.</p>
          
          <div class="warning">
            <strong>⚠️ 보안 안내</strong><br>
            이 인증번호를 타인과 공유하지 마세요. 중앙응급의료센터는 전화나 메시지로 인증번호를 요구하지 않습니다.
          </div>
        </div>
        <div class="footer">
          <p>이 메일은 중앙응급의료센터 AED 스마트 점검 시스템에서 자동 발송되었습니다.</p>
          <p>문의: truth0530@nmc.or.kr</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const text = `
AED 스마트 점검 시스템 이메일 인증

인증번호: ${code}
유효시간: 10분

회원가입 화면에서 위 인증번호를 입력해주세요.

이 메일은 자동 발송되었습니다.
문의: truth0530@nmc.or.kr
  `;
  
  return { subject, html, text };
}

/**
 * Supabase Edge Function을 통한 이메일 발송
 * 
 * 주의: Edge Function이 먼저 배포되어야 합니다.
 * 참고: https://supabase.com/docs/guides/functions/send-emails
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const supabase = createClient();
    
    // Edge Function 호출
    const { error } = await supabase.functions.invoke('send-email', {
      body: options
    });
    
    if (error) {
      console.error('이메일 발송 실패:', error);
      return false;
    }
    
    console.log('이메일 발송 성공:', options.to);
    return true;
    
  } catch (error) {
    console.error('이메일 발송 중 오류:', error);
    return false;
  }
}

/**
 * OTP 이메일 발송
 */
export async function sendOTPEmail(email: string, code: string): Promise<boolean> {
  const { subject, html, text } = generateOTPEmailTemplate(code);
  
  return sendEmail({
    to: email,
    subject,
    html,
    text
  });
}

/**
 * 환경에 따른 이메일 발송 처리
 */
export async function sendVerificationEmail(email: string, code: string): Promise<boolean> {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (isDevelopment) {
    // 개발 환경: 콘솔 출력
    console.log(`📧 [개발모드] 이메일 발송 시뮬레이션`);
    console.log(`받는 사람: ${email}`);
    console.log(`인증번호: ${code}`);
    console.log(`유효시간: 10분`);
    console.log('---');
    console.log('실제 운영 환경에서는 이메일이 발송됩니다.');
    return true;
  } else {
    // 운영 환경: 실제 이메일 발송
    return sendOTPEmail(email, code);
  }
}