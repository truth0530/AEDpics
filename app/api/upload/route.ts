/**
 * 파일 업로드 API
 *
 * POST /api/upload - 점검 사진 업로드
 * - 로컬 파일 시스템 저장 (개발 환경)
 * - Naver Object Storage 연동 (프로덕션, 향후 구현)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { prisma, createAuditLog } from '@/lib/db/prisma';
import { checkRateLimit, createRateLimitResponse, getIdentifier, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rate-limiter';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads');
const MAX_FILE_SIZE = parseInt(process.env.UPLOAD_MAX_SIZE || '10485760', 10); // 10MB
const ALLOWED_TYPES = (process.env.UPLOAD_ALLOWED_TYPES || 'image/jpeg,image/png,image/webp').split(',');

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = getIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, RATE_LIMIT_CONFIGS.upload);

    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult);
    }

    // JWT 인증
    const cookieToken = request.cookies.get('auth-token')?.value;
    const authHeader = request.headers.get('authorization');
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = cookieToken || headerToken;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // FormData 파싱
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const category = (formData.get('category') as string) || 'inspection-photos';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 파일 크기 검증
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds maximum allowed size (${MAX_FILE_SIZE} bytes)` },
        { status: 400 }
      );
    }

    // 파일 타입 검증
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type not allowed. Allowed types: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // 업로드 디렉토리 생성
    const categoryDir = join(UPLOAD_DIR, category);
    if (!existsSync(categoryDir)) {
      await mkdir(categoryDir, { recursive: true });
    }

    // 파일명 생성 (타임스탬프 + 랜덤 문자열)
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const ext = file.name.split('.').pop();
    const filename = `${timestamp}-${randomStr}.${ext}`;
    const filepath = join(categoryDir, filename);

    // 파일 저장
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // 데이터베이스에 파일 정보 저장
    const uploadedFile = await prisma.uploadedFile.create({
      data: {
        filename,
        filepath: `/uploads/${category}/${filename}`,
        category,
        size: file.size,
        mimeType: file.type,
        uploadedById: payload.userId,
      },
    });

    // 감사 로그 기록
    await createAuditLog({
      userId: payload.userId,
      action: 'UPLOAD',
      resource: 'UploadedFile',
      resourceId: uploadedFile.id,
      changes: { filename, category, size: file.size },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    console.log(`[Upload API] File uploaded: ${filename} (${file.size} bytes)`);

    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        id: uploadedFile.id,
        filename: uploadedFile.filename,
        filepath: uploadedFile.filepath,
        url: uploadedFile.filepath, // 클라이언트에서 사용할 URL
        size: uploadedFile.size,
        mimeType: uploadedFile.mimeType,
        createdAt: uploadedFile.createdAt,
      },
    });
  } catch (error) {
    console.error('[Upload API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 업로드된 파일 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    // JWT 인증
    const cookieToken = request.cookies.get('auth-token')?.value;
    const authHeader = request.headers.get('authorization');
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = cookieToken || headerToken;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // 쿼리 파라미터
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // 쿼리 조건
    const whereClause: any = {
      uploadedById: payload.userId,
    };

    if (category) {
      whereClause.category = category;
    }

    // 파일 목록 조회
    const files = await prisma.uploadedFile.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      data: files,
      count: files.length,
    });
  } catch (error) {
    console.error('[Upload API] List error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
