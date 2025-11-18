import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

async function analyzeDistrictCorrection() {
  try {
    console.log('\n=== district null인 15명 보정 분석 ===\n');

    const nullDistrictUsers = await prisma.user_profiles.findMany({
      where: {
        district: null,
        is_active: true,
        approved_at: { not: null },
      },
      select: {
        id: true,
        full_name: true,
        email: true,
        role: true,
        region_code: true,
        district: true,
        organization_id: true,
        organizations: {
          select: {
            id: true,
            name: true,
            type: true,
            region_code: true,
            city_code: true,
            address: true,
          }
        }
      },
      orderBy: [
        { region_code: 'asc' },
        { role: 'asc' },
        { full_name: 'asc' },
      ]
    });

    console.log(`총 ${nullDistrictUsers.length}명\n`);
    console.log('='.repeat(80));

    let autoFixableCount = 0;
    let manualReviewCount = 0;

    const corrections = [];

    nullDistrictUsers.forEach((user, idx) => {
      console.log(`\n${idx + 1}. ${user.full_name} (${user.email})`);
      console.log(`   현재: ${user.region_code} / district: NULL`);
      console.log(`   역할: ${user.role}`);

      if (user.organizations) {
        console.log(`   조직: ${user.organizations.name}`);
        console.log(`   조직 타입: ${user.organizations.type}`);
        console.log(`   조직 region_code: ${user.organizations.region_code || 'NULL'}`);
        console.log(`   조직 city_code: ${user.organizations.city_code || 'NULL'}`);
        console.log(`   조직 주소: ${user.organizations.address || 'N/A'}`);

        // 자동 보정 가능 여부 판단
        let suggestedDistrict = null;
        let confidence = 'LOW';
        let reason = '';

        // 1. 조직명에서 구군 추출 시도
        const orgName = user.organizations.name;
        const districtMatch = orgName.match(/([\w가-힣]+[시군구])\s*(보건소|응급의료지원센터)/);
        if (districtMatch) {
          suggestedDistrict = districtMatch[1];
          confidence = 'HIGH';
          reason = '조직명에서 추출';
        }

        // 2. city_code 활용
        if (!suggestedDistrict && user.organizations.city_code) {
          // city_code는 시군구를 나타냄
          suggestedDistrict = user.organizations.city_code;
          confidence = 'MEDIUM';
          reason = 'city_code 기반';
        }

        // 3. 주소에서 추출
        if (!suggestedDistrict && user.organizations.address) {
          const addressMatch = user.organizations.address.match(/([가-힣]+[시군구])/);
          if (addressMatch) {
            suggestedDistrict = addressMatch[1];
            confidence = 'MEDIUM';
            reason = '주소에서 추출';
          }
        }

        // 4. 역할 기반 판단
        if (user.role === 'master' || user.role === 'ministry_admin') {
          suggestedDistrict = 'N/A';
          confidence = 'HIGH';
          reason = '중앙 관리자 - district 불필요';
        } else if (user.role === 'regional_admin' || user.role === 'regional_emergency_center_admin') {
          suggestedDistrict = 'N/A';
          confidence = 'HIGH';
          reason = '시도 관리자 - district 불필요';
        } else if (user.role === 'emergency_center_admin') {
          // 응급의료센터는 시도 단위
          suggestedDistrict = 'N/A';
          confidence = 'MEDIUM';
          reason = '응급의료센터 - district 불필요 가능성';
        }

        if (suggestedDistrict && suggestedDistrict !== 'N/A') {
          console.log(`   >>> 제안: district = "${suggestedDistrict}" (신뢰도: ${confidence}, ${reason})`);
          autoFixableCount++;
        } else if (suggestedDistrict === 'N/A') {
          console.log(`   >>> 제안: district 설정 불필요 (${reason})`);
          autoFixableCount++;
        } else {
          console.log(`   >>> 제안: 수동 확인 필요 (자동 추출 실패)`);
          manualReviewCount++;
        }

        corrections.push({
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          current_region_code: user.region_code,
          current_district: user.district,
          org_name: user.organizations.name,
          org_type: user.organizations.type,
          suggested_district: suggestedDistrict,
          confidence: confidence,
          reason: reason,
        });

      } else {
        console.log(`   조직: 없음 (organization_id: ${user.organization_id})`);
        console.log(`   >>> 제안: 조직 정보 먼저 설정 필요`);
        manualReviewCount++;

        corrections.push({
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          current_region_code: user.region_code,
          current_district: user.district,
          org_name: 'N/A',
          org_type: 'N/A',
          suggested_district: null,
          confidence: 'LOW',
          reason: '조직 정보 없음',
        });
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log('\n=== 보정 가능성 요약 ===\n');
    console.log(`자동 보정 가능 (HIGH/MEDIUM 신뢰도): ${autoFixableCount}명`);
    console.log(`수동 확인 필요 (LOW 신뢰도): ${manualReviewCount}명`);

    // 자동 보정 SQL 생성
    console.log('\n\n=== 자동 보정 SQL (HIGH 신뢰도만) ===\n');
    const highConfidence = corrections.filter(c => c.confidence === 'HIGH');

    if (highConfidence.length > 0) {
      console.log('-- 다음 SQL을 검토 후 실행:');
      console.log('BEGIN;');
      highConfidence.forEach(c => {
        if (c.suggested_district && c.suggested_district !== 'N/A') {
          console.log(`UPDATE aedpics.user_profiles SET district = '${c.suggested_district}' WHERE id = '${c.id}'; -- ${c.full_name} (${c.reason})`);
        }
      });
      console.log('COMMIT;');
    } else {
      console.log('HIGH 신뢰도 보정 대상 없음');
    }

    // MEDIUM 신뢰도
    console.log('\n\n=== 검토 필요 SQL (MEDIUM 신뢰도) ===\n');
    const mediumConfidence = corrections.filter(c => c.confidence === 'MEDIUM');

    if (mediumConfidence.length > 0) {
      console.log('-- 수동 검토 후 실행:');
      console.log('BEGIN;');
      mediumConfidence.forEach(c => {
        if (c.suggested_district && c.suggested_district !== 'N/A') {
          console.log(`UPDATE aedpics.user_profiles SET district = '${c.suggested_district}' WHERE id = '${c.id}'; -- ${c.full_name} (${c.reason}) - 검토 필요`);
        }
      });
      console.log('COMMIT;');
    } else {
      console.log('MEDIUM 신뢰도 보정 대상 없음');
    }

    // 수동 확인 필요 목록
    console.log('\n\n=== 수동 확인 필요 (LOW 신뢰도) ===\n');
    const lowConfidence = corrections.filter(c => c.confidence === 'LOW');

    if (lowConfidence.length > 0) {
      lowConfidence.forEach(c => {
        console.log(`- ${c.full_name} (${c.email}): ${c.org_name} - ${c.reason}`);
      });
    } else {
      console.log('수동 확인 대상 없음');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeDistrictCorrection();
