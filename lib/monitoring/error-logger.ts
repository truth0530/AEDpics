import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

// TODO: Supabase 서버 클라이언트 임시 비활성화
// import { createClient } from '@/lib/supabase/server';

// 임시: Supabase createClient stub
const createClient = async (): Promise<any> => {
  throw new Error('Supabase client not available. Please use Prisma instead.');
};

export interface ErrorLog {
  message: string;
  stack?: string;
  context?: any;
  url?: string;
  method?: string;
  userId?: string;
  timestamp: Date;
}

/**
 * 에러 로깅 유틸리티
 * Supabase 로그 테이블 또는 외부 서비스로 에러 전송
 */
export class ErrorLogger {
  private static instance: ErrorLogger;

  private constructor() {}

  static getInstance(): ErrorLogger {
    if (!this.instance) {
      this.instance = new ErrorLogger();
    }
    return this.instance;
  }

  /**
   * 에러를 로그에 기록
   */
  async log(error: Error | unknown, context?: any): Promise<void> {
    try {
      const errorData = this.formatError(error, context);

      // 콘솔에 출력 (개발 환경)
      if (env.NODE_ENV === 'development') {
        logger.error('ErrorLogger', 'Error logged', {
          message: errorData.message,
          stack: errorData.stack,
          context: errorData.context
        });
      }

      // Supabase에 저장 (옵션)
      if (env.ENABLE_ERROR_LOGGING) {
        await this.saveToSupabase(errorData);
      }

      // 프로덕션에서 크리티컬 에러는 알림 전송
      if (env.NODE_ENV === 'production' && this.isCritical(error)) {
        await this.sendAlert(errorData);
      }
    } catch (logError) {
      // 로깅 자체가 실패해도 앱이 중단되지 않도록
      logger.error('ErrorLogger', 'Failed to log error', logError instanceof Error ? logError : { logError });
    }
  }

  /**
   * API 에러 로깅
   */
  async logApiError(
    request: Request,
    error: Error | unknown,
    userId?: string
  ): Promise<void> {
    const context = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      userId,
    };

    await this.log(error, context);
  }

  /**
   * 에러 데이터 포맷팅
   */
  private formatError(error: Error | unknown, context?: any): ErrorLog {
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date(),
      };
    }

    return {
      message: String(error),
      context,
      timestamp: new Date(),
    };
  }

  /**
   * 크리티컬 에러 판별
   */
  private isCritical(error: Error | unknown): boolean {
    if (error instanceof Error) {
      // 데이터베이스 연결 실패, 인증 시스템 장애 등
      const criticalPatterns = [
        'ECONNREFUSED',
        'ETIMEDOUT',
        'Database',
        'Auth',
        'Fatal',
      ];

      return criticalPatterns.some(pattern =>
        error.message.includes(pattern) ||
        error.stack?.includes(pattern)
      );
    }
    return false;
  }

  /**
   * Supabase에 에러 저장
   */
  private async saveToSupabase(errorLog: ErrorLog): Promise<void> {
    try {
      const supabase = await createClient();

      // error_logs 테이블이 있다고 가정
      // 없으면 이 부분은 스킵됨
      const { error } = await supabase
        .from('error_logs')
        .insert({
          message: errorLog.message,
          stack: errorLog.stack,
          context: errorLog.context,
          url: errorLog.url,
          method: errorLog.method,
          user_id: errorLog.userId,
          created_at: errorLog.timestamp,
        });

      if (error) {
        logger.warn('ErrorLogger', 'Failed to save error to Supabase', error instanceof Error ? error : { error });
      }
    } catch (e) {
      // Supabase 저장 실패는 조용히 무시
      logger.warn('ErrorLogger', 'Supabase logging failed', e instanceof Error ? e : { e });
    }
  }

  /**
   * 크리티컬 에러 알림 전송
   */
  private async sendAlert(errorLog: ErrorLog): Promise<void> {
    // Slack, Discord, 이메일 등으로 알림 전송
    // 예시: Discord Webhook
    if (env.DISCORD_WEBHOOK_URL) {
      try {
        await fetch(env.DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `🚨 **Critical Error**\n\`\`\`${errorLog.message}\`\`\``,
            embeds: [{
              color: 0xff0000,
              fields: [
                { name: 'URL', value: errorLog.url || 'N/A', inline: true },
                { name: 'Method', value: errorLog.method || 'N/A', inline: true },
                { name: 'Time', value: errorLog.timestamp.toISOString(), inline: false },
              ],
            }],
          }),
        });
      } catch (e) {
        logger.error('ErrorLogger', 'Failed to send alert', e instanceof Error ? e : { e });
      }
    }
  }
}

// 싱글톤 인스턴스 export
export const errorLogger = ErrorLogger.getInstance();