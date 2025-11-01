'use client';

import { logger } from '@/lib/logger';

/**
 * 사진을 NCP Object Storage에 업로드하고 공개 URL 반환
 * Base64를 직접 stepData에 저장하지 않음 → 413 오류 방지
 *
 * 서버사이드 API를 통해 업로드
 */
export async function uploadPhotoToStorage(
  base64Data: string,
  sessionId: string,
  photoType: string
): Promise<{ url: string; path: string } | null> {
  try {
    const response = await fetch('/api/storage/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64Data,
        sessionId,
        photoType,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      logger.error('PhotoUpload:uploadSingle', 'Upload failed', { error, sessionId, photoType });
      return null;
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    logger.error('PhotoUpload:uploadSingle', 'Upload error', error instanceof Error ? error : { error });
    return null;
  }
}

/**
 * 여러 사진을 일괄 업로드
 */
export async function uploadPhotosToStorage(
  photos: Array<{ base64: string; type: string }>,
  sessionId: string
): Promise<Array<{ url: string; path: string; type: string }>> {
  try {
    const response = await fetch('/api/storage/upload-batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        photos,
        sessionId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      logger.error('PhotoUpload:uploadBatch', 'Batch upload failed', { error, sessionId, photoCount: photos.length });
      return [];
    }

    const result = await response.json();
    return result.data || [];
  } catch (error) {
    logger.error('PhotoUpload:uploadBatch', 'Batch upload error', error instanceof Error ? error : { error });
    return [];
  }
}

/**
 * 스토리지에서 사진 삭제
 */
export async function deletePhotoFromStorage(filePath: string): Promise<boolean> {
  try {
    const response = await fetch('/api/storage/delete', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filePath,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      logger.error('PhotoUpload:delete', 'Delete failed', { error, filePath });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('PhotoUpload:delete', 'Delete error', error instanceof Error ? error : { error });
    return false;
  }
}
