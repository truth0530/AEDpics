import { NextRequest, NextResponse } from 'next/server';
import { uploadPhotosToNCP } from '@/lib/storage/ncp-storage';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { photos, sessionId } = body;

    // 요청 데이터 검증
    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid photos array' },
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing required field: sessionId' },
        { status: 400 }
      );
    }

    // 각 사진의 형식 검증
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      if (!photo.base64 || !photo.type) {
        return NextResponse.json(
          { error: `Invalid photo at index ${i}: missing base64 or type` },
          { status: 400 }
        );
      }
      if (!photo.base64.startsWith('data:image/')) {
        return NextResponse.json(
          { error: `Invalid photo at index ${i}: invalid base64 format` },
          { status: 400 }
        );
      }
    }

    // NCP Object Storage에 일괄 업로드
    const results = await uploadPhotosToNCP(photos, sessionId);

    return NextResponse.json({
      success: true,
      data: results,
      uploaded: results.length,
      total: photos.length,
    });
  } catch (error) {
    console.error('[POST /api/storage/upload-batch] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
