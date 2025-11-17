import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== Step 1: Find target_key values for matched institutions ===');
  const targets = await prisma.target_list_2025.findMany({
    where: {
      institution_name: {
        in: ['군위군보건소', '용대보건진료소']
      },
      data_year: 2025
    },
    select: {
      target_key: true,
      institution_name: true,
      sido: true,
      gugun: true
    }
  });
  
  console.log('Found targets:', JSON.stringify(targets, null, 2));
  
  if (targets.length === 0) {
    console.log('⚠️ No targets found! Check institution names.');
    return;
  }
  
  const targetKeys = targets.map(t => t.target_key);
  
  console.log('\n=== Step 2: Check mappings for these target_keys ===');
  const mappings = await prisma.management_number_group_mapping.findMany({
    where: {
      target_key_2025: {
        in: targetKeys
      }
    },
    select: {
      target_key_2025: true,
      management_number: true,
      confirmed_2025: true,
      confirmed_by_2025: true,
      confirmed_at_2025: true
    }
  });
  
  console.log('Found mappings:', JSON.stringify(mappings, null, 2));
  
  if (mappings.length === 0) {
    console.log('⚠️ No mappings found! These institutions have not been matched yet.');
  } else {
    console.log('\n=== Step 3: Check confirmed status ===');
    mappings.forEach(m => {
      console.log(`${m.target_key_2025}: confirmed_2025=${m.confirmed_2025}`);
    });
  }
  
  console.log('\n=== Step 4: Verify the exact query used in check-optimized/route.ts ===');
  const apiStyleMappings = await prisma.management_number_group_mapping.findMany({
    where: {
      target_key_2025: { in: targetKeys },
      confirmed_2025: true
    },
    select: {
      target_key_2025: true,
      management_number: true,
      confirmed_2025: true,
      confirmed_by_2025: true,
      confirmed_at_2025: true,
    }
  });
  
  console.log('API-style query results:', JSON.stringify(apiStyleMappings, null, 2));
  console.log(`\nConfirmed count: ${apiStyleMappings.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
