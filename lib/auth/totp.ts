/**
 * TOTP (Time-based One-Time Password) Implementation
 *
 * Features:
 * - TOTP secret generation
 * - QR code generation
 * - Token verification
 * - Backup codes generation
 *
 * NIS Certification Requirement: 2FA (Two-Factor Authentication)
 */

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { randomBytes } from 'crypto';
import prisma from '@/lib/db/prisma';

const APP_NAME = 'AED 점검 시스템';
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 8;

export interface TOTPSetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

/**
 * Generate TOTP secret and QR code for user
 */
export async function generateTOTPSecret(
  userId: number,
  userEmail: string
): Promise<TOTPSetupResult> {
  // Generate secret
  const secret = speakeasy.generateSecret({
    name: `${APP_NAME} (${userEmail})`,
    issuer: APP_NAME,
    length: 32,
  });

  if (!secret.otpauth_url) {
    throw new Error('Failed to generate TOTP secret');
  }

  // Generate QR code
  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

  // Generate backup codes
  const backupCodes = generateBackupCodes();

  // Hash backup codes before storing
  const bcrypt = await import('bcryptjs');
  const hashedBackupCodes = await Promise.all(
    backupCodes.map((code) => bcrypt.hash(code, 10))
  );

  // Store in database (do not enable yet)
  await prisma.userProfile.update({
    where: { userId },
    data: {
      totpSecret: secret.base32,
      totpEnabled: false,
      backupCodes: hashedBackupCodes,
    },
  });

  return {
    secret: secret.base32,
    qrCodeUrl,
    backupCodes,
  };
}

/**
 * Verify TOTP token and enable 2FA
 */
export async function verifyAndEnableTOTP(
  userId: number,
  token: string
): Promise<boolean> {
  const userProfile = await prisma.userProfile.findUnique({
    where: { userId },
  });

  if (!userProfile || !userProfile.totpSecret) {
    throw new Error('TOTP not configured');
  }

  // Verify token
  const verified = speakeasy.totp.verify({
    secret: userProfile.totpSecret,
    encoding: 'base32',
    token,
    window: 2, // Allow 2 time steps (60 seconds)
  });

  if (!verified) {
    return false;
  }

  // Enable TOTP
  await prisma.userProfile.update({
    where: { userId },
    data: { totpEnabled: true },
  });

  return true;
}

/**
 * Verify TOTP token for login
 */
export async function verifyTOTPToken(
  userId: number,
  token: string
): Promise<boolean> {
  const userProfile = await prisma.userProfile.findUnique({
    where: { userId },
  });

  if (!userProfile || !userProfile.totpSecret || !userProfile.totpEnabled) {
    return false;
  }

  // Verify token
  const verified = speakeasy.totp.verify({
    secret: userProfile.totpSecret,
    encoding: 'base32',
    token,
    window: 2,
  });

  return verified;
}

/**
 * Verify backup code
 */
export async function verifyBackupCode(
  userId: number,
  code: string
): Promise<boolean> {
  const userProfile = await prisma.userProfile.findUnique({
    where: { userId },
  });

  if (!userProfile || !userProfile.backupCodes || userProfile.backupCodes.length === 0) {
    return false;
  }

  const bcrypt = await import('bcryptjs');

  // Check each backup code
  for (let i = 0; i < userProfile.backupCodes.length; i++) {
    const hashedCode = userProfile.backupCodes[i];
    const isValid = await bcrypt.compare(code, hashedCode);

    if (isValid) {
      // Remove used backup code
      const updatedCodes = userProfile.backupCodes.filter((_, index) => index !== i);

      await prisma.userProfile.update({
        where: { userId },
        data: { backupCodes: updatedCodes },
      });

      return true;
    }
  }

  return false;
}

/**
 * Disable TOTP for user
 */
export async function disableTOTP(userId: number): Promise<void> {
  await prisma.userProfile.update({
    where: { userId },
    data: {
      totpSecret: null,
      totpEnabled: false,
      backupCodes: [],
    },
  });
}

/**
 * Check if user has TOTP enabled
 */
export async function isTOTPEnabled(userId: number): Promise<boolean> {
  const userProfile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { totpEnabled: true },
  });

  return userProfile?.totpEnabled || false;
}

/**
 * Generate backup codes
 */
function generateBackupCodes(): string[] {
  const codes: string[] = [];

  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    // Generate random 8-character alphanumeric code
    const code = randomBytes(BACKUP_CODE_LENGTH / 2)
      .toString('hex')
      .toUpperCase()
      .match(/.{1,4}/g)
      ?.join('-') || '';
    codes.push(code);
  }

  return codes;
}

/**
 * Regenerate backup codes
 */
export async function regenerateBackupCodes(userId: number): Promise<string[]> {
  const backupCodes = generateBackupCodes();

  const bcrypt = await import('bcryptjs');
  const hashedBackupCodes = await Promise.all(
    backupCodes.map((code) => bcrypt.hash(code, 10))
  );

  await prisma.userProfile.update({
    where: { userId },
    data: { backupCodes: hashedBackupCodes },
  });

  return backupCodes;
}
