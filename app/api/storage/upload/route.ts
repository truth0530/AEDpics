import { NextRequest, NextResponse } from 'next/server';
import { uploadPhotoToNCP } from '@/lib/storage/ncp-storage';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { base64Data, sessionId, photoType } = body;

    // 요청 데이터 검증
    if (!base64Data || !sessionId || !photoType) {
      return NextResponse.json(
        { error: 'Missing required fields: base64Data, sessionId, photoType' },
        { status: 400 }
      );
    }

    // Base64 형식 검증
    if (!base64Data.startsWith('data:image/')) {
      return NextResponse.json(
        { error: 'Invalid base64 image format' },
        { status: 400 }
      );
    }

    // NCP Object Storage에 업로드
    const result = await uploadPhotoToNCP(base64Data, sessionId, photoType);

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to upload photo to storage' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[POST /api/storage/upload] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
