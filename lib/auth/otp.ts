import { logger } from '@/lib/logger';
import { env } from '@/lib/env';

// TODO: Supabase 클라이언트 임시 비활성화
// import { createClient } from '@/lib/supabase/client';

// 임시: Supabase createClient stub
const createClient = (): any => {
  return null;
};

export interface OTPResponse {
  success: boolean;
  message: string;
  remainingAttempts?: number;
}

/**
 * 6자리 인증번호 생성
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 인증번호 발송
 */
export async function sendOTP(email: string): Promise<OTPResponse> {
  const supabase = createClient();
  
  try {
    // 1. 기존 미사용 인증번호 무효화
    await supabase
      .from('email_verification_codes')
      .update({ used: true })
      .eq('email', email)
      .eq('used', false);

    // 2. 새 인증번호 생성
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10분 후 만료

    // 3. 데이터베이스에 저장
    const { error: dbError } = await supabase
      .from('email_verification_codes')
      .insert({
        email,
        code,
        expires_at: expiresAt.toISOString(),
        used: false,
        attempts: 0
      });

    if (dbError) {
      logger.error('OTP:sendOTP', 'Failed to save OTP', { error: dbError, email });
      return { success: false, message: '인증번호 생성 중 오류가 발생했습니다.' };
    }

    // 4. 이메일 발송
    if (env.NODE_ENV === 'development') {
      // 개발 환경: 콘솔 출력
      logger.info('OTP:sendOTP', 'Development mode - OTP generated', {
        email,
        code,
        expiresIn: '10분'
      });
    } else {
      // TODO: 운영 환경에서는 실제 이메일 발송
      // import { sendVerificationEmail } from './email-service';
      // await sendVerificationEmail(email, code);
      logger.info('OTP:sendOTP', 'Production mode - email sending pending', { email });
    }

    return {
      success: true,
      message: '인증번호가 발송되었습니다. 메일함을 확인해주세요.'
    };

  } catch (error) {
    logger.error('OTP:sendOTP', 'Failed to send OTP', error instanceof Error ? error : { error });
    return { success: false, message: '인증번호 발송 중 오류가 발생했습니다.' };
  }
}

/**
 * 인증번호 검증
 */
export async function verifyOTP(email: string, inputCode: string): Promise<OTPResponse> {
  const supabase = createClient();

  try {
    // 1. 유효한 인증번호 조회
    const { data: otpData, error } = await supabase
      .from('email_verification_codes')
      .select('*')
      .eq('email', email)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !otpData) {
      return { 
        success: false, 
        message: '유효한 인증번호가 없습니다. 새로운 인증번호를 요청해주세요.' 
      };
    }

    // 2. 시도 횟수 체크
    if (otpData.attempts >= otpData.max_attempts) {
      // 인증번호 무효화
      await supabase
        .from('email_verification_codes')
        .update({ used: true })
        .eq('id', otpData.id);

      return { 
        success: false, 
        message: '인증 시도 횟수를 초과했습니다. 새로운 인증번호를 요청해주세요.' 
      };
    }

    // 3. 인증번호 비교
    if (inputCode.trim() !== otpData.code) {
      // 시도 횟수 증가
      const newAttempts = otpData.attempts + 1;
      await supabase
        .from('email_verification_codes')
        .update({ attempts: newAttempts })
        .eq('id', otpData.id);

      const remainingAttempts = otpData.max_attempts - newAttempts;
      return { 
        success: false, 
        message: `인증번호가 일치하지 않습니다.`,
        remainingAttempts
      };
    }

    // 4. 인증 성공 - 인증번호 사용 처리
    await supabase
      .from('email_verification_codes')
      .update({ used: true })
      .eq('id', otpData.id);

    return {
      success: true,
      message: '이메일 인증이 완료되었습니다.'
    };

  } catch (error) {
    logger.error('OTP:verifyOTP', 'Failed to verify OTP', error instanceof Error ? error : { error });
    return { success: false, message: '인증번호 검증 중 오류가 발생했습니다.' };
  }
}

/**
 * 실제 이메일 발송 함수 (추후 구현)
 * TODO: 실제 이메일 서비스 구현
 * - Supabase Edge Functions
 * - SendGrid, AWS SES 등
 * - 또는 SMTP 직접 연동
 */