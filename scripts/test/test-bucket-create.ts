/**
 * NCP Object Storage 버킷 생성 및 CORS 설정 스크립트
 */

import {
  S3Client,
  CreateBucketCommand,
  PutBucketCorsCommand,
  ListBucketsCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

// 환경변수 로드
const NCP_ACCESS_KEY = process.env.NCP_ACCESS_KEY;
const NCP_ACCESS_SECRET = process.env.NCP_ACCESS_SECRET;
const NCP_REGION = process.env.NCP_OBJECT_STORAGE_REGION || 'kr-standard';
const NCP_ENDPOINT = process.env.NCP_OBJECT_STORAGE_ENDPOINT || 'https://kr.object.ncloudstorage.com';
const BUCKET_NAME = process.env.NCP_OBJECT_STORAGE_BUCKET || 'aedpics-inspections';

async function main() {
  console.log('=== NCP Object Storage 버킷 생성 ===\n');

  // 1. 환경변수 확인
  console.log('1. 환경변수 확인:');
  console.log(`   Region: ${NCP_REGION}`);
  console.log(`   Endpoint: ${NCP_ENDPOINT}`);
  console.log(`   Bucket: ${BUCKET_NAME}`);
  console.log(`   Access Key: ${NCP_ACCESS_KEY?.substring(0, 10)}...`);
  console.log(`   Secret Key: ${NCP_ACCESS_SECRET ? 'SET (' + NCP_ACCESS_SECRET.length + ' chars)' : 'NOT SET'}\n`);

  if (!NCP_ACCESS_KEY || !NCP_ACCESS_SECRET) {
    console.error('❌ 오류: NCP_ACCESS_KEY 또는 NCP_ACCESS_SECRET이 설정되지 않았습니다.');
    console.error('   .env.local 파일을 확인해주세요.');
    process.exit(1);
  }

  // S3 클라이언트 생성
  const s3Client = new S3Client({
    region: NCP_REGION,
    endpoint: NCP_ENDPOINT,
    credentials: {
      accessKeyId: NCP_ACCESS_KEY,
      secretAccessKey: NCP_ACCESS_SECRET,
    },
    forcePathStyle: true, // NCP Object Storage 필수
  });

  try {
    // 2. 연결 테스트 (버킷 목록 조회)
    console.log('2. 연결 테스트 (버킷 목록 조회):');
    const listCommand = new ListBucketsCommand({});
    const listResponse = await s3Client.send(listCommand);

    console.log(`   ✅ 연결 성공! 버킷 개수: ${listResponse.Buckets?.length || 0}\n`);

    if (listResponse.Buckets && listResponse.Buckets.length > 0) {
      console.log('   발견된 버킷:');
      listResponse.Buckets.forEach(bucket => {
        console.log(`    - ${bucket.Name} (생성일: ${bucket.CreationDate?.toISOString()})`);
      });
      console.log('');
    }

    // 3. 버킷이 이미 존재하는지 확인
    console.log('3. 버킷 존재 여부 확인:');
    const bucketExists = listResponse.Buckets?.some(b => b.Name === BUCKET_NAME);

    if (bucketExists) {
      console.log(`   ℹ️  버킷 '${BUCKET_NAME}'이 이미 존재합니다.`);
      console.log('   버킷 생성을 건너뛰고 CORS 설정만 진행합니다.\n');
    } else {
      console.log(`   버킷 '${BUCKET_NAME}'이 존재하지 않습니다.`);
      console.log('   새 버킷을 생성합니다...\n');

      // 4. 버킷 생성
      console.log('4. 버킷 생성:');
      try {
        // NCP Object Storage는 리전을 엔드포인트에서 자동으로 결정
        const createCommand = new CreateBucketCommand({
          Bucket: BUCKET_NAME,
          // ACL 제거 - CORS로 공개 접근 제어
        });
        await s3Client.send(createCommand);
        console.log(`   ✅ 버킷 '${BUCKET_NAME}' 생성 완료!\n`);
      } catch (createError: any) {
        if (createError.name === 'BucketAlreadyExists' || createError.name === 'BucketAlreadyOwnedByYou') {
          console.log(`   ℹ️  버킷 '${BUCKET_NAME}'이 이미 존재합니다.\n`);
        } else {
          throw createError;
        }
      }
    }

    // 5. CORS 설정
    console.log('5. CORS 설정:');
    const corsCommand = new PutBucketCorsCommand({
      Bucket: BUCKET_NAME,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ['https://aed.pics', 'http://localhost:3001'],
            AllowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'],
            AllowedHeaders: ['*'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    });

    await s3Client.send(corsCommand);
    console.log(`   ✅ CORS 설정 완료!\n`);

    // 6. 버킷 접근 확인
    console.log('6. 버킷 접근 확인:');
    const headCommand = new HeadBucketCommand({ Bucket: BUCKET_NAME });
    await s3Client.send(headCommand);
    console.log(`   ✅ 버킷 '${BUCKET_NAME}' 접근 가능!\n`);

    console.log('=== 모든 작업 완료! ===\n');
    console.log('다음 단계:');
    console.log('1. .env.local에 Object Storage 환경변수 추가:');
    console.log(`   NCP_OBJECT_STORAGE_REGION="${NCP_REGION}"`);
    console.log(`   NCP_OBJECT_STORAGE_ENDPOINT="${NCP_ENDPOINT}"`);
    console.log(`   NCP_OBJECT_STORAGE_ACCESS_KEY="${NCP_ACCESS_KEY}"`);
    console.log(`   NCP_OBJECT_STORAGE_SECRET_KEY="${NCP_ACCESS_SECRET?.substring(0, 10)}..."`);
    console.log(`   NCP_OBJECT_STORAGE_BUCKET="${BUCKET_NAME}"`);
    console.log('\n2. npm run test:storage 실행하여 업로드 테스트');

  } catch (error: any) {
    console.error('\n❌ 오류 발생:', error.message);

    if (error.name === 'InvalidAccessKeyId') {
      console.error('\n💡 해결 방법:');
      console.error('   - NCP 콘솔에서 Access Key ID를 확인해주세요.');
      console.error('   - Object Storage용 API 키가 별도로 필요할 수 있습니다.');
    } else if (error.name === 'SignatureDoesNotMatch') {
      console.error('\n💡 해결 방법:');
      console.error('   - NCP 콘솔에서 Secret Key를 확인해주세요.');
      console.error('   - Object Storage용 API 키가 별도로 필요할 수 있습니다.');
    } else if (error.name === 'AccessDenied') {
      console.error('\n💡 해결 방법:');
      console.error('   - 현재 API 키에 Object Storage 권한이 없을 수 있습니다.');
      console.error('   - NCP 콘솔에서 Object Storage용 API 키를 별도로 생성해주세요.');
    }

    process.exit(1);
  }
}

main();
