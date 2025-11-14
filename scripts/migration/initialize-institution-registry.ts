/**
 * Phase 2: Institution Registry 초기화
 *
 * aed_data 테이블의 모든 고유한 보건소를 추출하여
 * institution_registry에 저장하는 마이그레이션 스크립트
 *
 * 실행: npx ts-node scripts/migration/initialize-institution-registry.ts
 */

import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

interface HealthCenter {
  jurisdiction_health_center: string;
  sido: string;
  gugun: string;
  aed_count: number;
  first_installation_date: Date | null;
  last_inspection_date: Date | null;
  latitude: number | null;
  longitude: number | null;
}

async function initializeInstitutionRegistry() {
  console.log('========================================');
  console.log('Phase 2: Institution Registry 초기화');
  console.log('========================================\n');

  try {
    // Step 1: aed_data에서 고유한 보건소 추출
    console.log('Step 1: aed_data에서 고유한 보건소 추출...');

    const healthCenters = await prisma.$queryRaw<HealthCenter[]>`
      SELECT
        jurisdiction_health_center,
        sido,
        gugun,
        COUNT(*) as aed_count,
        MIN(first_installation_date) as first_installation_date,
        MAX(last_inspection_date) as last_inspection_date,
        AVG(latitude::numeric)::numeric(10,7) as latitude,
        AVG(longitude::numeric)::numeric(10,7) as longitude
      FROM aedpics.aed_data
      WHERE jurisdiction_health_center IS NOT NULL
        AND jurisdiction_health_center != ''
      GROUP BY jurisdiction_health_center, sido, gugun
      ORDER BY aed_count DESC;
    `;

    console.log(`✓ ${healthCenters.length}개의 고유한 보건소 발견\n`);

    if (healthCenters.length === 0) {
      console.log('⚠️  aed_data에 jurisdiction_health_center 데이터가 없습니다.');
      console.log('먼저 aed_data를 정상적으로 import했는지 확인하세요.');
      process.exit(1);
    }

    // Step 2: Institution Registry에 저장
    console.log('Step 2: institution_registry에 저장 중...');

    let successCount = 0;
    let skipCount = 0;

    for (const healthCenter of healthCenters) {
      try {
        // standard_code 생성 (HEALTH_CENTER_{hash})
        const hashInput = [
          healthCenter.jurisdiction_health_center,
          healthCenter.sido,
          healthCenter.gugun,
        ]
          .filter(Boolean)
          .join('||');

        const hash = crypto
          .createHash('sha256')
          .update(hashInput)
          .digest('hex')
          .substring(0, 8)
          .toUpperCase();

        const standard_code = `HC_${hash}`;

        // region_code 매핑 (REGION_LONG_LABELS 참조)
        const regionCodeMap: Record<string, string> = {
          '서울특별시': 'SEO',
          '서울': 'SEO',
          '부산광역시': 'BUS',
          '부산': 'BUS',
          '대구광역시': 'DAE',
          '대구': 'DAE',
          '인천광역시': 'INC',
          '인천': 'INC',
          '광주광역시': 'GWA',
          '광주': 'GWA',
          '대전광역시': 'DAJ',
          '대전': 'DAJ',
          '울산광역시': 'ULS',
          '울산': 'ULS',
          '세종특별자치시': 'SEJ',
          '세종시': 'SEJ',
          '세종': 'SEJ',
          '경기도': 'GYE',
          '경기': 'GYE',
          '강원특별자치도': 'GAN',
          '강원': 'GAN',
          '충청북도': 'CHB',
          '충북': 'CHB',
          '충청남도': 'CHN',
          '충남': 'CHN',
          '전북특별자치도': 'JEB',
          '전북': 'JEB',
          '전라남도': 'JEN',
          '전남': 'JEN',
          '경상북도': 'GYB',
          '경북': 'GYB',
          '경상남도': 'GYN',
          '경남': 'GYN',
          '제주특별자치도': 'JEJ',
          '제주': 'JEJ',
        };

        const region_code = regionCodeMap[healthCenter.sido] || null;

        // 이미 존재하는지 확인
        const existing = await prisma.institution_registry.findUnique({
          where: { standard_code },
        });

        if (existing) {
          skipCount++;
          continue;
        }

        // institution_registry에 저장
        await prisma.institution_registry.create({
          data: {
            standard_code,
            canonical_name: healthCenter.jurisdiction_health_center,
            region_code,
            category: 'health_center',
            sub_category: healthCenter.gugun,
            road_address: null,
            lot_address: null,
            postal_code: null,
            latitude: healthCenter.latitude
              ? parseFloat(healthCenter.latitude.toString())
              : null,
            longitude: healthCenter.longitude
              ? parseFloat(healthCenter.longitude.toString())
              : null,
            address_hash: null,
            is_active: true,
            created_by: 'tnms_initialization',
            last_modified_reason: `Initialized from aed_data (${healthCenter.aed_count} AEDs)`,
          },
        });

        successCount++;

        // 진행 상황 표시
        if (successCount % 50 === 0) {
          console.log(`  ✓ ${successCount}개 저장 중...`);
        }
      } catch (error) {
        console.error(
          `  ❌ ${healthCenter.jurisdiction_health_center} 저장 실패:`,
          error
        );
      }
    }

    console.log(`\n✓ institution_registry 저장 완료`);
    console.log(`  - 새로 저장된 기관: ${successCount}개`);
    console.log(`  - 기존 기관 (스킵): ${skipCount}개\n`);

    // Step 3: Institution Aliases 저장 (각 AED의 보건소명)
    console.log('Step 3: institution_aliases 초기화 중...');

    // 샘플: 상위 100개 보건소만 처리 (전체는 시간이 오래 걸림)
    const topHealthCenters = healthCenters.slice(0, 100);

    let aliasCount = 0;

    for (const healthCenter of topHealthCenters) {
      try {
        // 해당 보건소의 institution_registry 찾기
        const hashInput = [
          healthCenter.jurisdiction_health_center,
          healthCenter.sido,
          healthCenter.gugun,
        ]
          .filter(Boolean)
          .join('||');

        const hash = crypto
          .createHash('sha256')
          .update(hashInput)
          .digest('hex')
          .substring(0, 8)
          .toUpperCase();

        const standard_code = `HC_${hash}`;

        const institution = await prisma.institution_registry.findUnique({
          where: { standard_code },
        });

        if (!institution) {
          continue;
        }

        // aed_data에서 이 보건소의 모든 AED 조회
        const aeds = await prisma.$queryRaw<
          Array<{ equipment_serial: string; installation_address: string | null }>
        >`
          SELECT
            equipment_serial,
            installation_address
          FROM aedpics.aed_data
          WHERE jurisdiction_health_center = ${healthCenter.jurisdiction_health_center}
          LIMIT 50;
        `;

        // 각 AED마다 별칭 생성
        for (const aed of aeds) {
          try {
            const existingAlias = await prisma.institution_aliases.findFirst({
              where: {
                standard_code,
                alias_name: aed.equipment_serial,
              },
            });

            if (existingAlias) {
              continue;
            }

            await prisma.institution_aliases.create({
              data: {
                standard_code,
                alias_name: aed.equipment_serial,
                alias_source: 'aed_data_import',
                source_road_address: aed.installation_address,
                normalization_applied: false,
                address_match: false,
                is_active: true,
              },
            });

            aliasCount++;
          } catch (error) {
            // 별칭 저장 실패는 무시
          }
        }
      } catch (error) {
        console.error(
          `  ❌ ${healthCenter.jurisdiction_health_center} 별칭 저장 실패:`,
          error
        );
      }
    }

    console.log(`✓ institution_aliases 초기화 완료`);
    console.log(`  - 저장된 별칭: ${aliasCount}개\n`);

    // Step 4: 메트릭 확인
    console.log('Step 4: 저장 결과 확인...');

    const registryCount = await prisma.institution_registry.count();
    const aliasCount2 = await prisma.institution_aliases.count();

    console.log(`institution_registry 총 개수: ${registryCount}개`);
    console.log(`institution_aliases 총 개수: ${aliasCount2}개\n`);

    console.log('========================================');
    console.log('Phase 2 초기화 완료!');
    console.log('========================================');
  } catch (error) {
    console.error('오류 발생:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

initializeInstitutionRegistry();
