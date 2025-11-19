import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function addFireStationRules() {
  try {
    // TNMS 테이블 생성
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS aedpics.tnms_normalization_rules (
        id SERIAL PRIMARY KEY,
        pattern VARCHAR(255) NOT NULL,
        replacement VARCHAR(255) NOT NULL,
        priority INTEGER NOT NULL DEFAULT 100,
        rule_type VARCHAR(50) DEFAULT 'exact',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(pattern)
      )
    `;
    console.log('✓ TNMS 테이블 생성 완료');

    // 소방서 관련 규칙 데이터
    const rules = [
      // 대구중부소방서 관련
      ['대구중부소방서', '중부소방서', 10, 'exact'],
      ['중부소방서(본대구급대)', '중부소방서', 10, 'exact'],
      ['중부소방서(남산119안전센터)', '중부소방서', 10, 'exact'],
      ['중부소방서(대명119안전센터)', '중부소방서', 10, 'exact'],
      ['중부소방서(서문로119안전센터)', '중부소방서', 10, 'exact'],
      ['중부소방서(삼덕119안전센터)', '중부소방서', 10, 'exact'],
      ['중부소방서(봉덕119안전센터)', '중부소방서', 10, 'exact'],
      ['중부소방서(대신119안전센터)', '중부소방서', 10, 'exact'],
      ['중부소방서(성명119안전센터)', '중부소방서', 10, 'exact'],
      ['중부소방서(명덕119안전센터)', '중부소방서', 10, 'exact'],
      ['중부소방서(서문로구급대)', '중부소방서', 10, 'exact'],
      ['중부소방서(대명구급대)', '중부소방서', 10, 'exact'],
      ['중부소방서(삼덕구급대)', '중부소방서', 10, 'exact'],
      ['중부소방서(봉덕구급대)', '중부소방서', 10, 'exact'],
      ['중부소방서(성명구급대)', '중부소방서', 10, 'exact'],
      ['중부소방서(명덕구급대)', '중부소방서', 10, 'exact'],
      // 부산중부소방서
      ['부산중부소방서', '부산중부소방서', 10, 'exact'],
      // 인천중부소방서
      ['인천중부소방서', '인천중부소방서', 10, 'exact'],
      ['인천중부소방서(송림119안전센터)', '인천중부소방서', 10, 'exact'],
      ['인천중부소방서(만석119안전센터)', '인천중부소방서', 10, 'exact'],
      ['인천중부소방서(송현119안전센터)', '인천중부소방서', 10, 'exact'],
      // 울산중부소방서
      ['울산중부소방서', '울산중부소방서', 10, 'exact'],
      ['중부소방서병영119안전센터', '울산중부소방서', 10, 'exact'],
      ['중부소방서태화119안전센터', '울산중부소방서', 10, 'exact'],
      // 서울중부소방서
      ['중부소방서(현장대응단)', '서울중부소방서', 10, 'exact'],
      ['중부소방서(충무로119안전센터)', '서울중부소방서', 10, 'exact'],
      ['중부소방서(신당119안전센터)', '서울중부소방서', 10, 'exact'],
      ['중부소방서(을지로119안전센터)', '서울중부소방서', 10, 'exact'],
      ['중부소방서(회현119안전센터)', '서울중부소방서', 10, 'exact'],
    ];

    // 규칙 삽입
    for (const [pattern, replacement, priority, rule_type] of rules) {
      await prisma.$executeRaw`
        INSERT INTO aedpics.tnms_normalization_rules (pattern, replacement, priority, rule_type)
        VALUES (${pattern}, ${replacement}, ${priority}, ${rule_type})
        ON CONFLICT (pattern) DO UPDATE
        SET replacement = EXCLUDED.replacement,
            priority = EXCLUDED.priority,
            rule_type = EXCLUDED.rule_type
      `;
    }
    console.log(`✓ ${rules.length}개 소방서 규칙 추가 완료`);

    // TNMS 정규화 함수 생성
    await prisma.$executeRaw`
      CREATE OR REPLACE FUNCTION aedpics.tnms_normalize(text_input VARCHAR)
      RETURNS VARCHAR AS $$
      DECLARE
          result VARCHAR;
          rule RECORD;
      BEGIN
          result := text_input;

          -- 우선순위 순으로 규칙 적용
          FOR rule IN
              SELECT pattern, replacement
              FROM aedpics.tnms_normalization_rules
              ORDER BY priority ASC, id ASC
          LOOP
              result := REPLACE(result, rule.pattern, rule.replacement);
          END LOOP;

          -- 기본 정규화: 공백, 특수문자 제거
          result := LOWER(result);
          result := REGEXP_REPLACE(result, '[^가-힣a-z0-9]', '', 'g');

          RETURN result;
      END;
      $$ LANGUAGE plpgsql
    `;
    console.log('✓ TNMS 정규화 함수 생성 완료');

    // 테스트
    const tests = await prisma.$queryRaw`
      SELECT
        aedpics.tnms_normalize('대구중부소방서') as test1,
        aedpics.tnms_normalize('중부소방서(본대구급대)') as test2,
        aedpics.tnms_normalize('티웨이항공') as test3
    `;

    console.log('\n=== TNMS 정규화 테스트 ===');
    console.log('대구중부소방서 →', tests[0].test1);
    console.log('중부소방서(본대구급대) →', tests[0].test2);
    console.log('티웨이항공 →', tests[0].test3);

    if (tests[0].test1 === tests[0].test2) {
      console.log('\n✅ 성공! "대구중부소방서"와 "중부소방서(본대구급대)"가 동일하게 정규화됩니다.');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addFireStationRules();