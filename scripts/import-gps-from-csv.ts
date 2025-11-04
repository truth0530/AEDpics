/**
 * CSV 파일에서 GPS 좌표를 읽어서 DB에 업데이트
 *
 * 실행 방법:
 * npx tsx scripts/import-gps-from-csv.ts
 */

import { prisma } from '../lib/prisma';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface GPSData {
  name: string;
  latitude: number;
  longitude: number;
}

async function importGPSFromCSV() {
  try {
    console.log('📄 CSV 파일 읽기 중...\n');

    const csvPath = path.join(__dirname, 'health_centers_missing_gps.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').slice(1); // 헤더 제외

    const gpsData: GPSData[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      const [name, , , , , lat, lng] = line.split(',');

      if (name && lat && lng) {
        gpsData.push({
          name: name.trim(),
          latitude: parseFloat(lat.trim()),
          longitude: parseFloat(lng.trim())
        });
      }
    }

    console.log(`📋 총 ${gpsData.length}개의 보건소 GPS 좌표 발견\n`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < gpsData.length; i++) {
      const data = gpsData[i];
      const progress = `[${i + 1}/${gpsData.length}]`;

      console.log(`${progress} ${data.name}`);

      try {
        // 보건소 찾기
        const healthCenter = await prisma.organizations.findFirst({
          where: {
            name: data.name,
            type: 'health_center'
          }
        });

        if (!healthCenter) {
          console.log(`  ⚠️  보건소를 찾을 수 없습니다.\n`);
          failCount++;
          continue;
        }

        // GPS 좌표 업데이트
        await prisma.organizations.update({
          where: { id: healthCenter.id },
          data: {
            latitude: data.latitude,
            longitude: data.longitude
          }
        });

        console.log(`  ✅ GPS 좌표 업데이트 완료: ${data.latitude}, ${data.longitude}\n`);
        successCount++;

      } catch (error) {
        console.log(`  ❌ 업데이트 실패:`, error);
        failCount++;
      }
    }

    console.log('\n========================================');
    console.log('📊 업데이트 결과');
    console.log('========================================');
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${failCount}개`);
    console.log(`📋 전체: ${gpsData.length}개`);
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ CSV 파일 읽기 또는 업데이트 중 오류 발생:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 스크립트 실행
importGPSFromCSV()
  .then(() => {
    console.log('✅ 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 스크립트 실행 실패:', error);
    process.exit(1);
  });
