/**
 * Error Logger - NCP Migration Complete
 *
 * Supabase 의존성 제거, lib/logger.ts 사용
 */

import { logger } from '@/lib/logger';

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
 *
 * 기존 Supabase 기반에서 logger.ts 기반으로 전환 완료
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

      // logger.ts를 사용한 일관된 로깅
      logger.error('ErrorLogger', errorData.message, {
        stack: errorData.stack,
        context: errorData.context,
        timestamp: errorData.timestamp,
      });

      // 프로덕션에서 크리티컬 에러는 알림 전송
      if (process.env.NODE_ENV === 'production' && this.isCritical(error)) {
        await this.sendAlert(errorData);
      }
    } catch (logError) {
      // 로깅 자체가 실패해도 앱이 중단되지 않도록
      logger.error(
        'ErrorLogger',
        'Failed to log error',
        logError instanceof Error ? logError : { logError }
      );
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

      return criticalPatterns.some(
        (pattern) =>
          error.message.includes(pattern) || error.stack?.includes(pattern)
      );
    }
    return false;
  }

  /**
   * 크리티컬 에러 알림 전송
   *
   * 향후 Slack, Discord, 이메일 등으로 알림 전송 가능
   */
  private async sendAlert(errorLog: ErrorLog): Promise<void> {
    // 예시: Discord Webhook (환경변수가 설정된 경우)
    if (process.env.DISCORD_WEBHOOK_URL) {
      try {
        await fetch(process.env.DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `🚨 **Critical Error**\n\`\`\`${errorLog.message}\`\`\``,
            embeds: [
              {
                color: 0xff0000,
                fields: [
                  {
                    name: 'URL',
                    value: errorLog.url || 'N/A',
                    inline: true,
                  },
                  {
                    name: 'Method',
                    value: errorLog.method || 'N/A',
                    inline: true,
                  },
                  {
                    name: 'Time',
                    value: errorLog.timestamp.toISOString(),
                    inline: false,
                  },
                ],
              },
            ],
          }),
        });
      } catch (e) {
        logger.error(
          'ErrorLogger',
          'Failed to send alert',
          e instanceof Error ? e : { e }
        );
      }
    }
  }
}

// 싱글톤 인스턴스 export
export const errorLogger = ErrorLogger.getInstance();
