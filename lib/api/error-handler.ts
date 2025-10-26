import { NextRequest, NextResponse } from 'next/server';
import { errorLogger } from '@/lib/monitoring/error-logger';

/**
 * API 라우트용 공통 에러 핸들러
 */
export async function withErrorHandler<T = any>(
  request: NextRequest,
  handler: () => Promise<NextResponse<T>>
): Promise<NextResponse<T | { error: string }>> {
  try {
    return await handler();
  } catch (error) {
    // 에러 로깅
    const userId = request.headers.get('x-user-id') || undefined;
    await errorLogger.logApiError(request, error, userId);

    // 에러 타입별 응답 처리
    if (error instanceof Error) {
      // 인증 에러
      if (error.message.includes('Unauthorized') || error.message.includes('auth')) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      // 권한 에러
      if (error.message.includes('Forbidden') || error.message.includes('permission')) {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }

      // 검증 에러
      if (error.message.includes('Invalid') || error.message.includes('validation')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }

      // 데이터베이스 에러
      if (error.message.includes('database') || error.message.includes('supabase')) {
        return NextResponse.json(
          { error: 'Database error' },
          { status: 503 }
        );
      }
    }

    // 기본 에러 응답
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 간단한 래퍼 함수
 *
 * 사용 예:
 * export const GET = apiHandler(async (request) => {
 *   // API 로직
 *   return NextResponse.json({ data });
 * });
 */
export function apiHandler<T = any>(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest, context?: any) => {
    return withErrorHandler(request, () => handler(request, context));
  };
}