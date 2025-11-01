/**
 * NCP Object Storage 연결 테스트
 *
 * 실행 방법:
 * npx tsx scripts/test/test-ncp-storage.ts
 */

import { S3Client, ListBucketsCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
import * as path from 'path';

// .env.local 로드
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const NCP_REGION = process.env.NCP_OBJECT_STORAGE_REGION || 'kr-standard';
const NCP_ENDPOINT = process.env.NCP_OBJECT_STORAGE_ENDPOINT || 'https://kr.object.ncloudstorage.com';
const NCP_ACCESS_KEY = process.env.NCP_OBJECT_STORAGE_ACCESS_KEY;
const NCP_SECRET_KEY = process.env.NCP_OBJECT_STORAGE_SECRET_KEY;
const NCP_BUCKET_NAME = process.env.NCP_OBJECT_STORAGE_BUCKET || 'aedpics-inspections';

console.log('=== NCP Object Storage Test ===\n');

// 환경변수 확인
console.log('1. 환경변수 확인:');
console.log(`   Region: ${NCP_REGION}`);
console.log(`   Endpoint: ${NCP_ENDPOINT}`);
console.log(`   Bucket: ${NCP_BUCKET_NAME}`);
console.log(`   Access Key: ${NCP_ACCESS_KEY ? NCP_ACCESS_KEY.substring(0, 10) + '...' : '❌ NOT SET'}`);
console.log(`   Secret Key: ${NCP_SECRET_KEY ? '✅ SET (' + NCP_SECRET_KEY.length + ' chars)' : '❌ NOT SET'}`);
console.log('');

if (!NCP_ACCESS_KEY || !NCP_SECRET_KEY) {
  console.error('❌ Error: NCP Object Storage credentials not configured');
  console.error('\n다음 환경변수를 .env.local에 설정하세요:');
  console.error('  NCP_OBJECT_STORAGE_ACCESS_KEY');
  console.error('  NCP_OBJECT_STORAGE_SECRET_KEY');
  console.error('  NCP_OBJECT_STORAGE_BUCKET (optional, default: aedpics-inspections)');
  process.exit(1);
}

// S3 클라이언트 생성
const s3Client = new S3Client({
  region: NCP_REGION,
  endpoint: NCP_ENDPOINT,
  credentials: {
    accessKeyId: NCP_ACCESS_KEY,
    secretAccessKey: NCP_SECRET_KEY,
  },
  forcePathStyle: true,
});

async function testConnection() {
  try {
    console.log('2. 연결 테스트 (버킷 목록 조회):');
    const command = new ListBucketsCommand({});
    const response = await s3Client.send(command);

    console.log(`   ✅ 연결 성공! 버킷 개수: ${response.Buckets?.length || 0}`);

    if (response.Buckets && response.Buckets.length > 0) {
      console.log('\n   발견된 버킷:');
      response.Buckets.forEach(bucket => {
        const isTarget = bucket.Name === NCP_BUCKET_NAME;
        console.log(`   ${isTarget ? '👉' : '  '} ${bucket.Name} (생성일: ${bucket.CreationDate?.toISOString() || 'N/A'})`);
      });
    }

    // 타겟 버킷 존재 확인
    const bucketExists = response.Buckets?.some(b => b.Name === NCP_BUCKET_NAME);
    if (!bucketExists) {
      console.log(`\n   ⚠️  경고: 타겟 버킷 '${NCP_BUCKET_NAME}'이 존재하지 않습니다.`);
      console.log('   NCP 콘솔에서 버킷을 생성하세요: https://console.ncloud.com/objectStorage/bucket');
    }

    return bucketExists;
  } catch (error: any) {
    console.error(`   ❌ 연결 실패:`, error.message);
    if (error.Code === 'InvalidAccessKeyId') {
      console.error('   → Access Key가 잘못되었습니다.');
    } else if (error.Code === 'SignatureDoesNotMatch') {
      console.error('   → Secret Key가 잘못되었습니다.');
    }
    return false;
  }
}

async function testUpload() {
  try {
    console.log('\n3. 업로드 테스트:');

    // 테스트 이미지 (1x1 빨간색 픽셀 PNG)
    const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    const base64 = testImageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');

    const testFileName = `test-uploads/test-${Date.now()}.png`;

    const command = new PutObjectCommand({
      Bucket: NCP_BUCKET_NAME,
      Key: testFileName,
      Body: buffer,
      ContentType: 'image/png',
      ACL: 'public-read',
    });

    await s3Client.send(command);

    const publicUrl = `${NCP_ENDPOINT}/${NCP_BUCKET_NAME}/${testFileName}`;
    console.log(`   ✅ 업로드 성공!`);
    console.log(`   파일명: ${testFileName}`);
    console.log(`   공개 URL: ${publicUrl}`);

    return testFileName;
  } catch (error: any) {
    console.error(`   ❌ 업로드 실패:`, error.message);
    if (error.Code === 'NoSuchBucket') {
      console.error(`   → 버킷 '${NCP_BUCKET_NAME}'이 존재하지 않습니다.`);
    } else if (error.Code === 'AccessDenied') {
      console.error('   → 권한이 없습니다. 버킷 정책을 확인하세요.');
    }
    return null;
  }
}

async function testDelete(fileName: string) {
  try {
    console.log('\n4. 삭제 테스트:');

    const command = new DeleteObjectCommand({
      Bucket: NCP_BUCKET_NAME,
      Key: fileName,
    });

    await s3Client.send(command);
    console.log(`   ✅ 삭제 성공! (${fileName})`);
    return true;
  } catch (error: any) {
    console.error(`   ❌ 삭제 실패:`, error.message);
    return false;
  }
}

// 메인 테스트 실행
async function main() {
  console.log('테스트 시작...\n');

  // 1. 연결 테스트
  const bucketExists = await testConnection();

  if (!bucketExists) {
    console.log('\n⚠️  버킷이 존재하지 않아 업로드/삭제 테스트를 건너뜁니다.');
    console.log('\nNCP 콘솔에서 다음 작업을 수행하세요:');
    console.log(`1. 버킷 생성: ${NCP_BUCKET_NAME}`);
    console.log('2. 버킷 정책: public-read 설정');
    console.log('3. CORS 설정 (웹에서 업로드하려면 필요)');
    process.exit(1);
  }

  // 2. 업로드 테스트
  const uploadedFile = await testUpload();

  if (!uploadedFile) {
    console.log('\n❌ 업로드 테스트 실패');
    process.exit(1);
  }

  // 3. 삭제 테스트
  await testDelete(uploadedFile);

  console.log('\n=== 모든 테스트 완료! ===');
  console.log('✅ NCP Object Storage가 정상적으로 작동합니다.');
  console.log('\n다음 단계:');
  console.log('1. GitHub Secrets에 환경변수 추가');
  console.log('2. 프로덕션 배포');
  console.log('3. 실제 점검에서 사진 업로드 테스트');
}

main().catch(error => {
  console.error('\n❌ 테스트 중 오류 발생:', error);
  process.exit(1);
});
