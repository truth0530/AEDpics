import { NextRequest, NextResponse } from 'next/server';
import { deletePhotoFromNCP } from '@/lib/storage/ncp-storage';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { filePath } = body;

    // 요청 데이터 검증
    if (!filePath) {
      return NextResponse.json(
        { error: 'Missing required field: filePath' },
        { status: 400 }
      );
    }

    // 파일 경로 형식 검증 (inspections/ 로 시작하는지 확인)
    if (!filePath.startsWith('inspections/')) {
      return NextResponse.json(
        { error: 'Invalid file path format' },
        { status: 400 }
      );
    }

    // NCP Object Storage에서 삭제
    const success = await deletePhotoFromNCP(filePath);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete photo from storage' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Photo deleted successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/storage/delete] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
