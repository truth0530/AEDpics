import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLatestOTP() {
  try {
    const latestCode = await prisma.email_verification_codes.findFirst({
      where: {
        email: 'test@example.com',
        used: false,
        expires_at: {
          gte: new Date()
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    if (latestCode) {
      console.log('Latest OTP for test@example.com:', latestCode.code);
      console.log('Expires at:', latestCode.expires_at);
    } else {
      console.log('No valid OTP found for test@example.com');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLatestOTP();