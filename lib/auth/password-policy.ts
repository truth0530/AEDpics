/**
 * Password Policy Enforcement
 *
 * NIS Certification Requirements:
 * - Minimum 12 characters
 * - Must contain: uppercase, lowercase, number, special character
 * - Cannot reuse last 5 passwords
 * - Must change every 90 days
 *
 * Phase 6: Enhanced Security Controls
 */

import prisma from '@/lib/db/prisma';
import bcrypt from 'bcryptjs';

const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_HISTORY_COUNT = 5;
const PASSWORD_EXPIRY_DAYS = 90;

export interface PasswordStrength {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
}

/**
 * Validate password against policy
 */
export function validatePassword(password: string): PasswordStrength {
  const errors: string[] = [];

  // Check minimum length
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`비밀번호는 최소 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`);
  }

  // Check for uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('비밀번호에 대문자가 포함되어야 합니다.');
  }

  // Check for lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('비밀번호에 소문자가 포함되어야 합니다.');
  }

  // Check for number
  if (!/\d/.test(password)) {
    errors.push('비밀번호에 숫자가 포함되어야 합니다.');
  }

  // Check for special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('비밀번호에 특수문자가 포함되어야 합니다.');
  }

  // Check for common patterns
  if (/(.)\1{2,}/.test(password)) {
    errors.push('비밀번호에 같은 문자가 3번 이상 연속될 수 없습니다.');
  }

  // Check for sequential characters
  if (hasSequentialChars(password)) {
    errors.push('비밀번호에 연속된 문자(예: abc, 123)가 포함될 수 없습니다.');
  }

  // Calculate strength
  let strength: PasswordStrength['strength'] = 'weak';

  if (errors.length === 0) {
    if (password.length >= 16) {
      strength = 'very-strong';
    } else if (password.length >= 14) {
      strength = 'strong';
    } else {
      strength = 'medium';
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength,
  };
}

/**
 * Check for sequential characters
 */
function hasSequentialChars(password: string): boolean {
  const sequences = [
    'abc', 'bcd', 'cde', 'def', 'efg', 'fgh', 'ghi', 'hij', 'ijk', 'jkl', 'klm', 'lmn',
    'mno', 'nop', 'opq', 'pqr', 'qrs', 'rst', 'stu', 'tuv', 'uvw', 'vwx', 'wxy', 'xyz',
    '123', '234', '345', '456', '567', '678', '789',
  ];

  const lowerPassword = password.toLowerCase();

  return sequences.some((seq) => lowerPassword.includes(seq));
}

/**
 * Check if password was used before (password history)
 */
export async function isPasswordReused(
  userId: number,
  newPassword: string
): Promise<boolean> {
  // Get user with password history
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      password: true,
      passwordHistory: true,
    },
  });

  if (!user) {
    return false;
  }

  // Check current password
  if (user.password && await bcrypt.compare(newPassword, user.password)) {
    return true;
  }

  // Check password history
  if (user.passwordHistory && user.passwordHistory.length > 0) {
    for (const oldHash of user.passwordHistory) {
      if (await bcrypt.compare(newPassword, oldHash)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Update password and maintain history
 */
export async function updatePassword(
  userId: number,
  newPassword: string
): Promise<void> {
  // Validate password
  const validation = validatePassword(newPassword);

  if (!validation.isValid) {
    throw new Error(validation.errors.join(' '));
  }

  // Check password reuse
  const isReused = await isPasswordReused(userId, newPassword);

  if (isReused) {
    throw new Error(`최근 ${PASSWORD_HISTORY_COUNT}개의 비밀번호는 재사용할 수 없습니다.`);
  }

  // Get current password
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      password: true,
      passwordHistory: true,
    },
  });

  if (!user) {
    throw new Error('사용자를 찾을 수 없습니다.');
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password history
  const passwordHistory = user.passwordHistory || [];

  if (user.password) {
    passwordHistory.unshift(user.password);
  }

  // Keep only last N passwords
  const trimmedHistory = passwordHistory.slice(0, PASSWORD_HISTORY_COUNT);

  // Update user
  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      passwordHistory: trimmedHistory,
      passwordChangedAt: new Date(),
    },
  });
}

/**
 * Check if password has expired
 */
export async function isPasswordExpired(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordChangedAt: true },
  });

  if (!user || !user.passwordChangedAt) {
    // No password change date, assume expired
    return true;
  }

  const daysSinceChange =
    (Date.now() - user.passwordChangedAt.getTime()) / (1000 * 60 * 60 * 24);

  return daysSinceChange >= PASSWORD_EXPIRY_DAYS;
}

/**
 * Get days until password expires
 */
export async function getDaysUntilPasswordExpiry(userId: number): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordChangedAt: true },
  });

  if (!user || !user.passwordChangedAt) {
    return 0;
  }

  const daysSinceChange =
    (Date.now() - user.passwordChangedAt.getTime()) / (1000 * 60 * 60 * 24);

  const daysRemaining = PASSWORD_EXPIRY_DAYS - daysSinceChange;

  return Math.max(0, Math.floor(daysRemaining));
}
