/**
 * Environment Variable Validation
 *
 * 환경변수 검증 및 타입 안전성 보장
 * 애플리케이션 시작 시 필수 환경변수가 모두 설정되었는지 확인
 */

import { z } from 'zod';

// 환경변수 스키마 정의
const envSchema = z.object({
  // ========================================
  // Database (필수)
  // ========================================
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .regex(/^postgresql:\/\//, 'DATABASE_URL must be a valid PostgreSQL connection string'),

  DIRECT_URL: z
    .string()
    .regex(/^postgresql:\/\//, 'DIRECT_URL must be a valid PostgreSQL connection string')
    .optional(),

  // ========================================
  // Authentication (필수)
  // ========================================
  NEXTAUTH_URL: z
    .string()
    .url('NEXTAUTH_URL must be a valid URL'),

  NEXTAUTH_SECRET: z
    .string()
    .min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),

  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET must be at least 16 characters'),

  ENCRYPTION_KEY: z
    .string()
    .min(16, 'ENCRYPTION_KEY must be at least 16 characters'),

  // ========================================
  // Application (필수)
  // ========================================
  MASTER_EMAIL: z
    .string()
    .email('MASTER_EMAIL must be a valid email address')
    .or(z.string().regex(/^[^@]+@[^@]+\.[^@]+(,[^@]+@[^@]+\.[^@]+)*$/, 'MASTER_EMAIL must be valid email(s)')),

  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url('NEXT_PUBLIC_SITE_URL must be a valid URL'),

  // ========================================
  // Kakao Maps (필수)
  // ========================================
  NEXT_PUBLIC_KAKAO_MAP_APP_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_KAKAO_MAP_APP_KEY is required'),

  // ========================================
  // NCP Email Service (필수)
  // ========================================
  NCP_ACCESS_KEY: z
    .string()
    .min(1, 'NCP_ACCESS_KEY is required'),

  NCP_ACCESS_SECRET: z
    .string()
    .min(1, 'NCP_ACCESS_SECRET is required'),

  NCP_SENDER_EMAIL: z
    .string()
    .email('NCP_SENDER_EMAIL must be a valid email address'),

  // ========================================
  // NCP Object Storage (선택적)
  // ========================================
  NCP_OBJECT_STORAGE_REGION: z
    .string()
    .optional()
    .default('kr-standard'),

  NCP_OBJECT_STORAGE_ENDPOINT: z
    .string()
    .url('NCP_OBJECT_STORAGE_ENDPOINT must be a valid URL')
    .optional()
    .default('https://kr.object.ncloudstorage.com'),

  NCP_OBJECT_STORAGE_ACCESS_KEY: z
    .string()
    .optional(),

  NCP_OBJECT_STORAGE_SECRET_KEY: z
    .string()
    .optional(),

  NCP_OBJECT_STORAGE_BUCKET: z
    .string()
    .optional()
    .default('aedpics-inspections'),

  // ========================================
  // Optional Services
  // ========================================
  CRON_SECRET: z
    .string()
    .optional(),

  DISCORD_WEBHOOK_URL: z
    .string()
    .url()
    .optional(),

  ENABLE_ERROR_LOGGING: z
    .enum(['true', 'false'])
    .optional()
    .transform(val => val === 'true'),

  // ========================================
  // Development
  // ========================================
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .optional()
    .default('development'),

  PORT: z
    .string()
    .regex(/^\d+$/, 'PORT must be a number')
    .optional()
    .default('3001'),

  NEXT_PUBLIC_DEBUG: z
    .enum(['true', 'false'])
    .optional()
    .transform(val => val === 'true'),

  // ========================================
  // Feature Flags (선택적)
  // ========================================
  NEXT_PUBLIC_FEATURE_QUICK_INSPECT: z
    .enum(['true', 'false'])
    .optional()
    .transform(val => val !== 'false'),

  NEXT_PUBLIC_FEATURE_SCHEDULE: z
    .enum(['true', 'false'])
    .optional()
    .transform(val => val !== 'false'),

  NEXT_PUBLIC_FEATURE_TEAM_DASHBOARD: z
    .enum(['true', 'false'])
    .optional()
    .transform(val => val === 'true'),

  NEXT_PUBLIC_FEATURE_REALTIME_SYNC: z
    .enum(['true', 'false'])
    .optional()
    .transform(val => val === 'true'),

  NEXT_PUBLIC_FEATURE_NOTIFICATIONS: z
    .enum(['true', 'false'])
    .optional()
    .transform(val => val === 'true'),

  // ========================================
  // Deprecated (Supabase)
  // ========================================
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url()
    .optional(),

  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .optional(),

  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .optional(),
});

// 타입 추출
export type Env = z.infer<typeof envSchema>;

// 환경변수 검증 및 파싱
function validateEnv(): Env {
  try {
    // 환경변수 파싱
    const parsed = envSchema.parse(process.env);

    // 검증 성공 로그 (개발 환경에서만)
    if (process.env.NODE_ENV === 'development') {
      console.log('[ENV] Environment variables validated successfully');
    }

    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      // 검증 실패 시 자세한 오류 메시지 출력
      console.error('[ENV] Environment variable validation failed:');
      console.error('');

      error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        console.error(`  - ${path}: ${issue.message}`);
      });

      console.error('');
      console.error('[ENV] Please check your .env.local file');
      console.error('[ENV] Refer to .env.example for required variables');
      console.error('');

      // 프로세스 종료
      process.exit(1);
    }

    // 예상치 못한 오류
    console.error('[ENV] Unexpected error during environment validation:', error);
    process.exit(1);
  }
}

// 검증된 환경변수 export
export const env = validateEnv();

// 타입 안전 헬퍼 함수
export function getEnv<K extends keyof Env>(key: K): Env[K] {
  return env[key];
}

// 환경별 체크
export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

// Object Storage 사용 가능 여부
export const isObjectStorageEnabled = Boolean(
  env.NCP_OBJECT_STORAGE_ACCESS_KEY &&
  env.NCP_OBJECT_STORAGE_SECRET_KEY
);

// Feature Flag 헬퍼
export const features = {
  quickInspect: env.NEXT_PUBLIC_FEATURE_QUICK_INSPECT ?? true,
  schedule: env.NEXT_PUBLIC_FEATURE_SCHEDULE ?? true,
  teamDashboard: env.NEXT_PUBLIC_FEATURE_TEAM_DASHBOARD ?? false,
  realtimeSync: env.NEXT_PUBLIC_FEATURE_REALTIME_SYNC ?? false,
  notifications: env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS ?? false,
} as const;
