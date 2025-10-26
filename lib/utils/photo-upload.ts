'use client';

// TODO: Supabase Storage 기능 임시 비활성화
// 이 파일의 모든 함수는 Supabase Storage를 사용하던 기능입니다.
// NCP Object Storage 또는 다른 스토리지 솔루션으로 전환 필요

/**
 * 사진을 스토리지에 업로드하고 공개 URL 반환
 * Base64를 직접 stepData에 저장하지 않음 → 413 오류 방지
 */
export async function uploadPhotoToStorage(
  base64Data: string,
  sessionId: string,
  photoType: string
): Promise<{ url: string; path: string } | null> {
  console.warn('[uploadPhotoToStorage] Temporarily disabled - needs storage migration');
  return null;
}

/**
 * 여러 사진을 일괄 업로드
 */
export async function uploadPhotosToStorage(
  photos: Array<{ base64: string; type: string }>,
  sessionId: string
): Promise<Array<{ url: string; path: string; type: string }>> {
  console.warn('[uploadPhotosToStorage] Temporarily disabled - needs storage migration');
  return [];
}

/**
 * 스토리지에서 사진 삭제
 */
export async function deletePhotoFromStorage(filePath: string): Promise<boolean> {
  console.warn('[deletePhotoFromStorage] Temporarily disabled - needs storage migration');
  return false;
}
