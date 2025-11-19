#!/usr/bin/env node

/**
 * normalization_rules 테이블 업데이트 스크립트
 * 실제 데이터 분석 결과를 기반으로 TNMS 규칙 적용
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function applyNormalizationRules() {
  console.log('=== TNMS 정규화 규칙 적용 시작 ===\n');

  try {
    // 1. 기존 규칙 확인
    console.log('1. 현재 활성 규칙 확인');
    console.log('------------------------');
    const currentRules = await prisma.normalization_rules.findMany({
      where: { is_active: true },
      orderBy: { priority: 'desc' }
    });

    console.log(`현재 활성 규칙: ${currentRules.length}개`);
    currentRules.forEach(rule => {
      console.log(`  - [${rule.priority}] ${rule.rule_name} (${rule.rule_type})`);
    });

    // 2. 기존 규칙 비활성화
    console.log('\n2. 기존 규칙 비활성화');
    console.log('---------------------');
    await prisma.normalization_rules.updateMany({
      where: {
        rule_type: {
          in: ['suffix_removal', 'pattern_removal', 'region_prefix_removal']
        }
      },
      data: { is_active: false }
    });
    console.log('기존 suffix_removal, pattern_removal, region_prefix_removal 규칙 비활성화 완료');

    // 3. 새 규칙 추가
    console.log('\n3. 새 규칙 추가/업데이트');
    console.log('------------------------');

    const newRules = [
      {
        rule_name: '법인표기 정규화',
        rule_type: 'pattern_removal',
        rule_spec: {
          pattern: "(주식회사|\\(주\\)|\\(유\\)|유한회사|\\(사\\)|사단법인|\\(재\\)|재단법인)",
          replacement: ""
        },
        priority: 150,
        is_active: true,
        description: '법인 표기를 제거하여 기관명 매칭 정확도 향상'
      },
      {
        rule_name: '괄호 내용 제거',
        rule_type: 'pattern_removal',
        rule_spec: {
          pattern: "\\([^)]*\\)",
          replacement: ""
        },
        priority: 140,
        is_active: true,
        description: '괄호와 그 내용을 제거 (target_list 7.35%, aed_data 14.60% 영향)'
      },
      {
        rule_name: '기관 접미사 제거',
        rule_type: 'suffix_removal',
        rule_spec: {
          patterns: [
            "병원", "소방서", "보건지소", "보건소", "공사",
            "센터", "의원", "경찰서", "의료원", "학교",
            "파출소", "공단", "면사무소", "읍사무소", "동사무소",
            "지구대", "대학", "주민센터", "행정복지센터"
          ]
        },
        priority: 130,
        is_active: true,
        description: '빈도 높은 기관 접미사 제거 (실제 데이터 분석 기반)'
      },
      {
        rule_name: '공백 정규화',
        rule_type: 'whitespace_normalize',
        rule_spec: {},
        priority: 120,
        is_active: true,
        description: '연속된 공백을 단일 공백으로 정규화'
      },
      {
        rule_name: '특수문자 제거',
        rule_type: 'special_char_removal',
        rule_spec: {
          exclude_chars: ["-", "_", "/", "·"]
        },
        priority: 110,
        is_active: true,
        description: '하이픈, 언더스코어, 슬래시, 가운뎃점은 유지하면서 기타 특수문자 제거'
      },
      {
        rule_name: '지역 접두어 제거 (선택적)',
        rule_type: 'region_prefix_removal',
        rule_spec: {
          prefixes: [
            "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
            "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
            "서울특별시", "부산광역시", "대구광역시", "인천광역시",
            "광주광역시", "대전광역시", "울산광역시", "세종특별자치시",
            "경기도", "강원도", "충청북도", "충청남도",
            "전라북도", "전라남도", "경상북도", "경상남도", "제주특별자치도"
          ]
        },
        priority: 100,
        is_active: false, // 기본적으로 비활성화
        description: '지역명 접두어 제거 - 소방서 매칭 등 특수 케이스에만 사용 (target_list 6.3%, aed_data 8.6% 영향)'
      },
      {
        rule_name: '한글 숫자 정규화',
        rule_type: 'korean_numeral_normalize',
        rule_spec: {},
        priority: 90,
        is_active: true,
        description: '한글 숫자를 아라비아 숫자로 변환'
      }
    ];

    for (const rule of newRules) {
      const existingRule = await prisma.normalization_rules.findUnique({
        where: { rule_name: rule.rule_name }
      });

      if (existingRule) {
        // 업데이트
        await prisma.normalization_rules.update({
          where: { rule_name: rule.rule_name },
          data: {
            rule_type: rule.rule_type,
            rule_spec: rule.rule_spec,
            priority: rule.priority,
            is_active: rule.is_active,
            description: rule.description,
            updated_by: 'TNMS_INTEGRATION_2025-11-19'
          }
        });
        console.log(`  ✓ 업데이트: ${rule.rule_name}`);
      } else {
        // 신규 추가
        await prisma.normalization_rules.create({
          data: {
            ...rule,
            updated_by: 'TNMS_INTEGRATION_2025-11-19'
          }
        });
        console.log(`  ✓ 추가: ${rule.rule_name}`);
      }
    }

    // 4. 최종 확인
    console.log('\n4. 최종 활성 규칙 확인');
    console.log('----------------------');
    const finalRules = await prisma.normalization_rules.findMany({
      where: { is_active: true },
      orderBy: { priority: 'desc' }
    });

    console.log(`\n활성 규칙 ${finalRules.length}개 (우선순위 순):`);
    finalRules.forEach(rule => {
      console.log(`  ${rule.priority}: ${rule.rule_name} [${rule.rule_type}]`);
      if (rule.description) {
        console.log(`     → ${rule.description}`);
      }
    });

    // 5. 통계 정보
    console.log('\n5. 규칙 적용 예상 영향');
    console.log('----------------------');
    console.log('  - 법인표기: 대기업 중심 데이터 (한국철도공사, LG디스플레이 등)');
    console.log('  - 괄호제거: target_list 2,153건(7.35%), aed_data 11,989건(14.60%)');
    console.log('  - 접미사제거: 약 30% 데이터 영향');
    console.log('  - 지역접두어: 8,874건(8%) - 기본 비활성, 필요시 활성화');

    console.log('\n=== 정규화 규칙 적용 완료 ===');

  } catch (error) {
    console.error('오류 발생:', error);
    process.exit(1);
  }
}

applyNormalizationRules()
  .catch(console.error)
  .finally(() => prisma.$disconnect());