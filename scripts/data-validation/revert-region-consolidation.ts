#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function revertConsolidation() {
  console.log('Reverting region consolidation to restore original abbreviations...\n');

  const updates = [
    { from: '경기도', to: '경기' },
    { from: '강원도', to: '강원' },
    { from: '충청북도', to: '충북' },
    { from: '충청남도', to: '충남' },
    { from: '전라북도', to: '전북' },
    { from: '전라남도', to: '전남' },
    { from: '경상북도', to: '경북' },
    { from: '경상남도', to: '경남' },
    { from: '제주특별자치도', to: '제주' },
  ];

  for (const { from, to } of updates) {
    const result = await prisma.$executeRaw`
      UPDATE aed_data
      SET sido = ${to}
      WHERE sido = ${from}
    `;
    console.log(`✅ ${from} → ${to}`);
  }

  console.log('\n✅ Revert completed');
  await prisma.$disconnect();
}

revertConsolidation().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
