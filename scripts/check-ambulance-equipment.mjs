import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkEquipment() {
  // 27-0078822 장비연번 확인
  const equipment = await prisma.aed_data.findUnique({
    where: { equipment_serial: '27-0078822' },
    select: {
      equipment_serial: true,
      installation_institution: true,
      category_1: true,
      category_2: true,
      management_number: true
    }
  });

  console.log('=== 군위군보건소 구급차 장비 정보 ===');
  console.log(JSON.stringify(equipment, null, 2));
  
  // 특수구급차도 확인
  const specialAmbulance = await prisma.aed_data.findUnique({
    where: { equipment_serial: '27-0075539' },
    select: {
      equipment_serial: true,
      installation_institution: true,
      category_1: true,
      category_2: true,
      management_number: true
    }
  });
  
  console.log('\n=== 군위군보건소 특수구급차 장비 정보 ===');
  console.log(JSON.stringify(specialAmbulance, null, 2));
  
  await prisma.$disconnect();
}

checkEquipment().catch(console.error);
