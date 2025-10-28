import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// NCP Object Storage 설정
const NCP_REGION = process.env.NCP_OBJECT_STORAGE_REGION || 'kr-standard';
const NCP_ENDPOINT = process.env.NCP_OBJECT_STORAGE_ENDPOINT || 'https://kr.object.ncloudstorage.com';
const NCP_ACCESS_KEY = process.env.NCP_OBJECT_STORAGE_ACCESS_KEY;
const NCP_SECRET_KEY = process.env.NCP_OBJECT_STORAGE_SECRET_KEY;
const NCP_BUCKET_NAME = process.env.NCP_OBJECT_STORAGE_BUCKET || 'aedpics-inspections';

if (!NCP_ACCESS_KEY || !NCP_SECRET_KEY) {
  console.warn('[NCP Storage] Object Storage credentials not configured');
}

// S3 클라이언트 생성 (NCP Object Storage는 S3 호환 API 사용)
const s3Client = new S3Client({
  region: NCP_REGION,
  endpoint: NCP_ENDPOINT,
  credentials: {
    accessKeyId: NCP_ACCESS_KEY || '',
    secretAccessKey: NCP_SECRET_KEY || '',
  },
  forcePathStyle: true, // NCP Object Storage에 필요
});

/**
 * Base64 이미지를 Buffer로 변환
 */
function base64ToBuffer(base64Data: string): Buffer {
  // data:image/jpeg;base64, 부분 제거
  const base64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64, 'base64');
}

/**
 * 파일명 생성 (타임스탬프 + 랜덤)
 */
function generateFileName(sessionId: string, photoType: string, extension: string = 'jpg'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `inspections/${sessionId}/${photoType}-${timestamp}-${random}.${extension}`;
}

/**
 * Base64로 인코딩된 이미지 추출
 */
function getImageExtension(base64Data: string): string {
  if (base64Data.startsWith('data:image/png')) return 'png';
  if (base64Data.startsWith('data:image/jpeg')) return 'jpg';
  if (base64Data.startsWith('data:image/jpg')) return 'jpg';
  if (base64Data.startsWith('data:image/webp')) return 'webp';
  return 'jpg'; // 기본값
}

/**
 * Content-Type 결정
 */
function getContentType(extension: string): string {
  const types: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  };
  return types[extension] || 'image/jpeg';
}

/**
 * NCP Object Storage에 사진 업로드
 */
export async function uploadPhotoToNCP(
  base64Data: string,
  sessionId: string,
  photoType: string
): Promise<{ url: string; path: string } | null> {
  if (!NCP_ACCESS_KEY || !NCP_SECRET_KEY) {
    console.error('[uploadPhotoToNCP] NCP Object Storage credentials not configured');
    return null;
  }

  try {
    // Base64 → Buffer
    const buffer = base64ToBuffer(base64Data);

    // 파일명 생성
    const extension = getImageExtension(base64Data);
    const fileName = generateFileName(sessionId, photoType, extension);

    // S3 업로드
    const command = new PutObjectCommand({
      Bucket: NCP_BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: getContentType(extension),
      ACL: 'public-read', // 공개 읽기 권한
    });

    await s3Client.send(command);

    // 공개 URL 생성
    const publicUrl = `${NCP_ENDPOINT}/${NCP_BUCKET_NAME}/${fileName}`;

    console.log('[uploadPhotoToNCP] Upload success:', { fileName, url: publicUrl });

    return {
      url: publicUrl,
      path: fileName,
    };
  } catch (error) {
    console.error('[uploadPhotoToNCP] Error:', error);
    return null;
  }
}

/**
 * 여러 사진 일괄 업로드
 */
export async function uploadPhotosToNCP(
  photos: Array<{ base64: string; type: string }>,
  sessionId: string
): Promise<Array<{ url: string; path: string; type: string }>> {
  const results = await Promise.allSettled(
    photos.map(photo => uploadPhotoToNCP(photo.base64, sessionId, photo.type))
  );

  return results
    .map((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        return {
          ...result.value,
          type: photos[index].type,
        };
      }
      return null;
    })
    .filter((item): item is { url: string; path: string; type: string } => item !== null);
}

/**
 * NCP Object Storage에서 사진 삭제
 */
export async function deletePhotoFromNCP(filePath: string): Promise<boolean> {
  if (!NCP_ACCESS_KEY || !NCP_SECRET_KEY) {
    console.error('[deletePhotoFromNCP] NCP Object Storage credentials not configured');
    return false;
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: NCP_BUCKET_NAME,
      Key: filePath,
    });

    await s3Client.send(command);
    console.log('[deletePhotoFromNCP] Delete success:', filePath);
    return true;
  } catch (error) {
    console.error('[deletePhotoFromNCP] Error:', error);
    return false;
  }
}

/**
 * Presigned URL 생성 (임시 접근 URL, 보안이 필요한 경우)
 */
export async function getPresignedUrl(filePath: string, expiresIn: number = 3600): Promise<string | null> {
  if (!NCP_ACCESS_KEY || !NCP_SECRET_KEY) {
    console.error('[getPresignedUrl] NCP Object Storage credentials not configured');
    return null;
  }

  try {
    const command = new GetObjectCommand({
      Bucket: NCP_BUCKET_NAME,
      Key: filePath,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error('[getPresignedUrl] Error:', error);
    return null;
  }
}

/**
 * 공개 URL 생성
 */
export function getPublicUrl(filePath: string): string {
  return `${NCP_ENDPOINT}/${NCP_BUCKET_NAME}/${filePath}`;
}
