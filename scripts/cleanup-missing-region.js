/**
 * region_code가 누락된 사용자 데이터 정리 스크립트
 *
 * 실행 방법:
 * node scripts/cleanup-missing-region.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 환경변수 로드
dotenv.config({ path: '.env.local' });

// 지역 매핑 상수
const REGION_LABEL_TO_CODE = {
  '중앙': 'KR',
  '서울특별시': 'SEO',
  '부산광역시': 'BUS',
  '대구광역시': 'DAE',
  '인천광역시': 'INC',
  '광주광역시': 'GWA',
  '대전광역시': 'DAJ',
  '울산광역시': 'ULS',
  '세종특별자치시': 'SEJ',
  '경기도': 'GYE',
  '강원특별자치도': 'GAN',
  '충청북도': 'CHU',
  '충청남도': 'CHN',
  '전북특별자치도': 'JEO',
  '전라남도': 'JEN',
  '경상북도': 'GYB',
  '경상남도': 'GYN',
  '제주특별자치도': 'JEJ'
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경변수가 설정되지 않았습니다.');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 이메일 도메인 기반 지역 추천
function getRecommendedRegionFromEmail(email) {
  const domain = email.split('@')[1];

  // NMC 도메인
  if (domain === 'nmc.or.kr') {
    return 'KR'; // 중앙
  }

  // 공공기관 도메인은 기본적으로 korea.kr을 사용하므로
  // 이메일만으로는 지역 판단이 어려움
  // 수동 검토가 필요한 경우
  return null;
}

// 조직명 기반 지역 추천
function getRecommendedRegionFromOrganization(orgName) {
  if (!orgName) return null;

  const regionMappings = {
    '서울': 'SEO',
    '부산': 'BUS',
    '대구': 'DAE',
    '인천': 'INC',
    '광주': 'GWA',
    '대전': 'DAJ',
    '울산': 'ULS',
    '세종': 'SEJ',
    '경기': 'GYE',
    '강원': 'GAN',
    '충북': 'CHU',
    '충남': 'CHN',
    '전북': 'JEO',
    '전남': 'JEN',
    '경북': 'GYB',
    '경남': 'GYN',
    '제주': 'JEJ',
    '중앙': 'KR',
    '보건복지부': 'KR',
    '응급의료센터': 'KR'
  };

  for (const [keyword, code] of Object.entries(regionMappings)) {
    if (orgName.includes(keyword)) {
      return code;
    }
  }

  return null;
}

async function analyzeData() {
  console.log('🔍 region_code 누락 사용자 분석 시작...\n');

  try {
    // region_code가 없는 사용자 조회
    const { data: usersWithoutRegion, error } = await supabase
      .from('user_profiles')
      .select('id, email, organization_name, department, role, created_at')
      .or('region_code.is.null,region_code.eq.')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    console.log(`📊 총 ${usersWithoutRegion.length}명의 사용자가 region_code 누락`);

    if (usersWithoutRegion.length === 0) {
      console.log('✅ 모든 사용자가 region_code를 가지고 있습니다!');
      return;
    }

    console.log('\n📋 누락 사용자 상세:');
    console.log('=' .repeat(80));

    const recommendations = [];

    usersWithoutRegion.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.email}`);
      console.log(`   역할: ${user.role}`);
      console.log(`   조직: ${user.organization_name || '미입력'}`);
      console.log(`   부서: ${user.department || '미입력'}`);
      console.log(`   가입일: ${new Date(user.created_at).toLocaleDateString('ko-KR')}`);

      // 추천 지역 계산
      let recommendedRegion = getRecommendedRegionFromEmail(user.email);
      if (!recommendedRegion) {
        recommendedRegion = getRecommendedRegionFromOrganization(
          user.organization_name || ''
        );
      }

      if (recommendedRegion) {
        console.log(`   🎯 추천 지역: ${recommendedRegion}`);
        recommendations.push({
          user_id: user.id,
          email: user.email,
          recommended_region: recommendedRegion
        });
      } else {
        console.log(`   ⚠️  수동 검토 필요`);
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log(`\n📈 분석 결과:`);
    console.log(`- 총 누락 사용자: ${usersWithoutRegion.length}명`);
    console.log(`- 자동 추천 가능: ${recommendations.length}명`);
    console.log(`- 수동 검토 필요: ${usersWithoutRegion.length - recommendations.length}명`);

    if (recommendations.length > 0) {
      console.log('\n🔧 자동 수정 가능한 사용자들:');
      recommendations.forEach(rec => {
        console.log(`- ${rec.email} → ${rec.recommended_region}`);
      });
    }

    return recommendations;

  } catch (error) {
    console.error('❌ 데이터 분석 중 오류:', error.message);
    process.exit(1);
  }
}

async function applyRecommendations(recommendations, dryRun = true) {
  if (recommendations.length === 0) {
    console.log('\n✅ 적용할 추천사항이 없습니다.');
    return;
  }

  console.log(`\n${dryRun ? '🧪 테스트 모드' : '🚀 실제 적용 모드'}`);
  console.log(`${recommendations.length}개의 region_code 업데이트 ${dryRun ? '시뮬레이션' : '실행'}...`);

  try {
    for (const rec of recommendations) {
      if (dryRun) {
        console.log(`[DRY RUN] ${rec.email} → region_code: ${rec.recommended_region}`);
      } else {
        const { error } = await supabase
          .from('user_profiles')
          .update({
            region_code: rec.recommended_region,
            updated_at: new Date().toISOString()
          })
          .eq('id', rec.user_id);

        if (error) {
          console.error(`❌ ${rec.email} 업데이트 실패:`, error.message);
        } else {
          console.log(`✅ ${rec.email} → region_code: ${rec.recommended_region}`);
        }
      }
    }

    if (dryRun) {
      console.log('\n💡 실제 적용하려면: node scripts/cleanup-missing-region.js --apply');
    } else {
      console.log('\n✅ region_code 업데이트 완료!');
    }

  } catch (error) {
    console.error('❌ 업데이트 중 오류:', error.message);
  }
}

async function main() {
  const isApplyMode = process.argv.includes('--apply');

  console.log('🔧 사용자 region_code 정리 도구');
  console.log('=====================================\n');

  const recommendations = await analyzeData();

  if (recommendations && recommendations.length > 0) {
    await applyRecommendations(recommendations, !isApplyMode);
  }

  console.log('\n🏁 작업 완료!');
}

// 스크립트 실행
main().catch(console.error);