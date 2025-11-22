import { PrismaClient } from '@prisma/client';
import { isAmbulanceFromAED, validateMatching, validateBasket } from '../lib/utils/ambulance-detector';

const prisma = new PrismaClient();

async function testAmbulanceDetection() {
    console.log('=== 구급차 판별 로직 검증 ===\n');

    // 1. 전체 구급차 데이터 조회
    const allAmbulances = await prisma.aed_data.findMany({
        where: {
            OR: [
                { category_2: { contains: '구급차' } },
                { category_1: { contains: '구급차' } }
            ]
        },
        select: { category_1: true, category_2: true, equipment_serial: true }
    });

    console.log(`총 구급차 데이터: ${allAmbulances.length}건`);

    // 2. 패턴별 분포 확인
    const pattern119 = allAmbulances.filter(a => a.category_2?.includes('119구급대'));
    const patternMedical = allAmbulances.filter(a => a.category_2?.includes('의료기관'));
    const patternOther = allAmbulances.filter(a =>
        a.category_1 === '구비의무기관 외' && a.category_2 === '구급차'
    );

    console.log(`- 119구급대: ${pattern119.length}건`);
    console.log(`- 의료기관: ${patternMedical.length}건`);
    console.log(`- 구비의무기관 외: ${patternOther.length}건`);

    // 3. 감지율 테스트
    const detected = allAmbulances.filter(item => isAmbulanceFromAED(item));
    const missedItems = allAmbulances.filter(item => !isAmbulanceFromAED(item));

    console.log(`\n감지 결과:`);
    console.log(`✅ 감지: ${detected.length}건`);
    console.log(`❌ 누락: ${missedItems.length}건`);
    console.log(`감지율: ${(detected.length / allAmbulances.length * 100).toFixed(1)}%`);

    if (missedItems.length > 0) {
        console.log('\n누락된 패턴 샘플:');
        missedItems.slice(0, 5).forEach(item => {
            console.log(`- category_1: "${item.category_1}", category_2: "${item.category_2}"`);
        });
    }

    // 4. Validation Logic Test
    console.log('\n=== Validation Logic Test ===');

    // Strict Matching Rule
    console.log('\n[Strict Rule] Matching Validation:');
    const validMatch1 = validateMatching(true, true); // Ambulance <-> Ambulance
    const validMatch2 = validateMatching(false, false); // General <-> General
    const invalidMatch1 = validateMatching(true, false); // Ambulance <-> General
    const invalidMatch2 = validateMatching(false, true); // General <-> Ambulance

    console.log(`- Amb <-> Amb: ${validMatch1.valid ? '✅ Valid' : '❌ Invalid'}`);
    console.log(`- Gen <-> Gen: ${validMatch2.valid ? '✅ Valid' : '❌ Invalid'}`);
    console.log(`- Amb <-> Gen: ${!invalidMatch1.valid ? '✅ Blocked' : '❌ Allowed'} (${invalidMatch1.error})`);
    console.log(`- Gen <-> Amb: ${!invalidMatch2.valid ? '✅ Blocked' : '❌ Allowed'} (${invalidMatch2.error})`);

    // Soft Basket Rule
    console.log('\n[Soft Rule] Basket Validation:');
    const mixedBasket = [
        { category_2: '119구급대에서 운용 중인 구급차' },
        { category_2: '공공보건의료기관' }
    ];
    const pureBasket = [
        { category_2: '119구급대에서 운용 중인 구급차' },
        { category_2: '의료기관에서 운용 중인 구급차' }
    ];

    const mixedResult = validateBasket(mixedBasket);
    const pureResult = validateBasket(pureBasket);

    console.log(`- Mixed Basket: ${mixedResult.warning ? '✅ Warning' : '❌ No Warning'} (${mixedResult.warning})`);
    console.log(`- Pure Basket: ${!pureResult.warning ? '✅ Clean' : '❌ Warning'} (${pureResult.warning})`);
}

// 실행 방법: npx tsx scripts/test-ambulance-detector.ts
testAmbulanceDetection()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
