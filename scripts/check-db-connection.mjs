import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

console.log('=== Database Connection Test ===\n');

try {
  // Test basic connection
  console.log('1. Testing basic connection...');
  await prisma.$connect();
  console.log('   ✓ Connection successful\n');

  // Test query performance
  console.log('2. Testing query performance...');
  const start = Date.now();
  const count = await prisma.user_profiles.count();
  const elapsed = Date.now() - start;
  console.log(`   ✓ Found ${count} user profiles (${elapsed}ms)\n`);

  // Test concurrent queries (simulate multiple requests)
  console.log('3. Testing concurrent queries (10 parallel)...');
  const startConcurrent = Date.now();
  const promises = Array.from({ length: 10 }, (_, i) =>
    prisma.aed_data.count().then(count => ({ query: i + 1, count, success: true }))
  );
  const results = await Promise.all(promises);
  const elapsedConcurrent = Date.now() - startConcurrent;
  const successCount = results.filter(r => r.success).length;
  console.log(`   ✓ ${successCount}/${results.length} queries completed (${elapsedConcurrent}ms)`);
  console.log(`   Average: ${(elapsedConcurrent / 10).toFixed(1)}ms per query\n`);

  // Check active connections
  console.log('4. Checking active connections...');
  const connections = await prisma.$queryRaw`
    SELECT count(*) as active_connections
    FROM pg_stat_activity
    WHERE datname = current_database()
  `;
  console.log('   Active connections:', connections[0].active_connections.toString());

  console.log('\n=== All Tests Passed ===');

} catch (error) {
  console.error('\n❌ Error:', error.message);
  if (error.code === 'P2024') {
    console.error('\n💡 Connection pool timeout - server may need restart');
  }
} finally {
  await prisma.$disconnect();
}
