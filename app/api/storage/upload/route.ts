import { NextRequest, NextResponse } from 'next/server';
import { uploadPhotoToNCP } from '@/lib/storage/ncp-storage';
import { requireAuthWithProfile, isErrorResponse } from '@/lib/auth/session-helpers';
import { checkRateLimitWithMessage } from '@/lib/security/rate-limit-middleware';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// 파일 크기 제한: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// 허용된 이미지 타입
const ALLOWED_MIME_TYPES = [
  'data:image/jpeg',
  'data:image/jpg',
  'data:image/png',
  'data:image/webp',
];

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting 체크 (분당 10회)
    const rateLimitResult = await checkRateLimitWithMessage(request, 'UPLOAD');
    if (rateLimitResult) {
      return rateLimitResult;
    }

    // 2. 인증 체크
    const authResult = await requireAuthWithProfile();
    if (isErrorResponse(authResult)) {
      return authResult;
    }

    const { profile: userProfile } = authResult;

    // 3. 요청 데이터 파싱
    const body = await request.json();
    const { base64Data, sessionId, photoType } = body;

    // 4. 필수 필드 검증
    if (!base64Data || !sessionId || !photoType) {
      return NextResponse.json(
        { error: 'Missing required fields: base64Data, sessionId, photoType' },
        { status: 400 }
      );
    }

    // 5. Base64 형식 및 MIME 타입 검증
    const isValidMimeType = ALLOWED_MIME_TYPES.some(type =>
      base64Data.startsWith(type)
    );

    if (!isValidMimeType) {
      return NextResponse.json(
        {
          error: 'Invalid image format',
          allowedFormats: ['JPEG', 'PNG', 'WebP'],
        },
        { status: 400 }
      );
    }

    // 6. 파일 크기 검증 (Base64 디코딩 후 예상 크기)
    // Base64는 원본보다 약 33% 더 큼
    const estimatedSize = (base64Data.length * 3) / 4;
    if (estimatedSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: 'File too large',
          maxSize: '5MB',
          currentSize: `${(estimatedSize / 1024 / 1024).toFixed(2)}MB`,
        },
        { status: 413 }
      );
    }

    // 7. 세션 검증 (사용자가 세션 소유자인지 확인)
    const session = await prisma.inspection_sessions.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        inspector_id: true,
        status: true,
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Invalid session ID' },
        { status: 404 }
      );
    }

    // 8. 권한 검증 (세션 소유자만 업로드 가능)
    if (session.inspector_id !== userProfile.id) {
      return NextResponse.json(
        { error: 'You are not authorized to upload to this session' },
        { status: 403 }
      );
    }

    // 9. 세션 상태 검증 (진행 중인 세션만)
    if (session.status !== 'in_progress') {
      return NextResponse.json(
        {
          error: 'Cannot upload to inactive session',
          sessionStatus: session.status,
        },
        { status: 400 }
      );
    }

    // 10. photoType 검증
    const validPhotoTypes = [
      'front',
      'back',
      'serial',
      'battery',
      'pad',
      'storage',
      'location',
      'other',
    ];

    if (!validPhotoTypes.includes(photoType)) {
      return NextResponse.json(
        {
          error: 'Invalid photo type',
          allowedTypes: validPhotoTypes,
        },
        { status: 400 }
      );
    }

    // 11. NCP Object Storage에 업로드
    const result = await uploadPhotoToNCP(base64Data, sessionId, photoType);

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to upload photo to storage' },
        { status: 500 }
      );
    }

    // 12. 성공 응답
    return NextResponse.json({
      success: true,
      data: {
        ...result,
        uploadedBy: userProfile.id,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[POST /api/storage/upload] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
