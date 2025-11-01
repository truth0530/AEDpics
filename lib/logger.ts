/**
 * Centralized Logging Utility
 *
 * 일관된 로그 포맷 제공:
 * - [CONTEXT] message meta
 * - 프로덕션 환경에서는 중요 로그만 출력
 * - 타임스탬프 포함 (옵션)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogMeta = Record<string, unknown> | Error | string | number | boolean | null | undefined;

interface LoggerOptions {
  enableDebug?: boolean;
  enableTimestamps?: boolean;
  minLevel?: LogLevel;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private options: Required<LoggerOptions>;

  constructor(options: LoggerOptions = {}) {
    this.options = {
      enableDebug: process.env.NODE_ENV === 'development',
      enableTimestamps: process.env.NODE_ENV === 'production',
      minLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      ...options,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.options.minLevel];
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(level: LogLevel, context: string, message: string): string {
    const timestamp = this.options.enableTimestamps ? `${this.formatTimestamp()} ` : '';
    const levelTag = level.toUpperCase().padEnd(5);
    return `${timestamp}[${levelTag}] [${context}] ${message}`;
  }

  private formatMeta(meta?: LogMeta): string {
    if (!meta) return '';

    if (meta instanceof Error) {
      return `\n  Error: ${meta.message}\n  Stack: ${meta.stack}`;
    }

    if (typeof meta === 'object' && meta !== null) {
      try {
        return `\n  ${JSON.stringify(meta, null, 2)}`;
      } catch {
        return `\n  ${String(meta)}`;
      }
    }

    return `\n  ${String(meta)}`;
  }

  /**
   * Debug 로그 (개발 환경에서만)
   */
  debug(context: string, message: string, meta?: LogMeta): void {
    if (!this.shouldLog('debug') || !this.options.enableDebug) return;

    const formatted = this.formatMessage('debug', context, message);
    const metaStr = this.formatMeta(meta);
    console.log(formatted + metaStr);
  }

  /**
   * 정보 로그
   */
  info(context: string, message: string, meta?: LogMeta): void {
    if (!this.shouldLog('info')) return;

    const formatted = this.formatMessage('info', context, message);
    const metaStr = this.formatMeta(meta);
    console.log(formatted + metaStr);
  }

  /**
   * 경고 로그
   */
  warn(context: string, message: string, meta?: LogMeta): void {
    if (!this.shouldLog('warn')) return;

    const formatted = this.formatMessage('warn', context, message);
    const metaStr = this.formatMeta(meta);
    console.warn(formatted + metaStr);
  }

  /**
   * 에러 로그
   */
  error(context: string, message: string, error?: Error | LogMeta): void {
    if (!this.shouldLog('error')) return;

    const formatted = this.formatMessage('error', context, message);
    const metaStr = this.formatMeta(error);
    console.error(formatted + metaStr);
  }

  /**
   * API 요청 로그 (특수 포맷)
   */
  request(context: string, method: string, path: string, meta?: LogMeta): void {
    this.info(context, `${method} ${path}`, meta);
  }

  /**
   * API 응답 로그 (특수 포맷)
   */
  response(context: string, method: string, path: string, status: number, duration?: number): void {
    const durationStr = duration ? ` (${duration}ms)` : '';
    const message = `${method} ${path} ${status}${durationStr}`;

    if (status >= 500) {
      this.error(context, message);
    } else if (status >= 400) {
      this.warn(context, message);
    } else {
      this.info(context, message);
    }
  }

  /**
   * 성능 측정 시작
   */
  time(label: string): () => number {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.debug('PERF', `${label}: ${duration}ms`);
      return duration;
    };
  }
}

// 싱글톤 인스턴스
export const logger = new Logger();

// 컨텍스트별 로거 생성 헬퍼
export function createLogger(defaultContext: string) {
  return {
    debug: (message: string, meta?: LogMeta) => logger.debug(defaultContext, message, meta),
    info: (message: string, meta?: LogMeta) => logger.info(defaultContext, message, meta),
    warn: (message: string, meta?: LogMeta) => logger.warn(defaultContext, message, meta),
    error: (message: string, error?: Error | LogMeta) => logger.error(defaultContext, message, error),
    request: (method: string, path: string, meta?: LogMeta) =>
      logger.request(defaultContext, method, path, meta),
    response: (method: string, path: string, status: number, duration?: number) =>
      logger.response(defaultContext, method, path, status, duration),
    time: (label: string) => logger.time(label),
  };
}

// 기본 export
export default logger;
