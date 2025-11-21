import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTableStructure() {
  try {
    // Check table structure
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'target_list_2025'
      AND table_schema = 'aedpics'
      ORDER BY ordinal_position
    `;

    console.log('target_list_2025 table columns:');
    console.log('================================');
    result.forEach(col => {
      console.log(`${col.column_name}: ${col.data_type}`);
    });

    // Check sample data
    const sampleData = await prisma.$queryRaw`
      SELECT * FROM target_list_2025 LIMIT 1
    `;

    console.log('\nSample data:');
    console.log('============');
    console.log(sampleData[0]);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTableStructure();