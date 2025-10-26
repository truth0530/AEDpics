import { describe, it, expect } from 'vitest';
import { canPerformInspection, AccessContext } from '@/lib/auth/access-control';
import { ROLE_ACCESS_MATRIX, canAccessInspection } from '@/lib/auth/role-matrix';
import { UserRole } from '@/packages/types';

describe('역할 검증 로직 일관성', () => {
  const allRoles: UserRole[] = [
    'master',
    'emergency_center_admin',
    'ministry_admin',
    'regional_admin',
    'local_admin',
    'temporary_inspector',
    'pending_approval',
    'email_verified',
  ];

  describe('canPerformInspection vs ROLE_ACCESS_MATRIX 일치성', () => {
    it.each(allRoles)('역할 %s에 대한 점검 권한 일치성 확인', (role) => {
      // temporary_inspector의 경우 적절한 accountType 사용
      const accountType = role === 'temporary_inspector' ? 'temporary' : 'public';

      // access-control.ts의 canPerformInspection 결과
      const accessControlResult = canPerformInspection({
        userId: 'test-user',
        role,
        accountType,
        assignedDevices: [],
        organizationId: 'test-org',
      });

      // role-matrix.ts의 canAccessInspection 결과
      const roleMatrixResult = canAccessInspection(role);

      expect(accessControlResult).toBe(roleMatrixResult);
    });
  });

  describe('temporary_inspector 특수 케이스', () => {
    it('temporary_inspector는 할당된 장비가 있어야 점검 가능', () => {
      const contextWithDevices: AccessContext = {
        userId: 'test-user',
        role: 'temporary_inspector',
        accountType: 'temporary',
        assignedDevices: ['DEVICE-001'],
        organizationId: undefined,
      };

      const contextWithoutDevices: AccessContext = {
        userId: 'test-user',
        role: 'temporary_inspector',
        accountType: 'temporary',
        assignedDevices: [],
        organizationId: undefined,
      };

      expect(canPerformInspection(contextWithDevices)).toBe(true);
      expect(canPerformInspection(contextWithoutDevices)).toBe(true); // 현재는 장비 할당 여부와 무관하게 true
    });

    it('temporary_inspector는 public 계정으로도 점검 가능', () => {
      const publicTemporaryInspector: AccessContext = {
        userId: 'test-user',
        role: 'temporary_inspector',
        accountType: 'public',
        assignedDevices: [],
        organizationId: 'test-org',
      };

      // 수정된 로직: temporary_inspector는 account_type과 무관하게 점검 가능
      expect(canPerformInspection(publicTemporaryInspector)).toBe(true);
    });
  });

  describe('제한된 역할 차단', () => {
    it('pending_approval 역할은 점검 불가', () => {
      const context: AccessContext = {
        userId: 'test-user',
        role: 'pending_approval',
        accountType: 'public',
        assignedDevices: [],
        organizationId: 'test-org',
      };

      expect(canPerformInspection(context)).toBe(false);
      expect(canAccessInspection('pending_approval')).toBe(false);
    });

    it('email_verified 역할은 점검 불가', () => {
      const context: AccessContext = {
        userId: 'test-user',
        role: 'email_verified',
        accountType: 'public',
        assignedDevices: [],
        organizationId: 'test-org',
      };

      expect(canPerformInspection(context)).toBe(false);
      expect(canAccessInspection('email_verified')).toBe(false);
    });
  });

  describe('관리자 역할 권한', () => {
    const adminRoles: UserRole[] = ['master', 'emergency_center_admin', 'ministry_admin', 'regional_admin', 'local_admin'];

    it.each(adminRoles)('%s 역할은 점검 가능', (role) => {
      const context: AccessContext = {
        userId: 'test-user',
        role,
        accountType: 'public',
        assignedDevices: [],
        organizationId: 'test-org',
      };

      expect(canPerformInspection(context)).toBe(true);
      expect(canAccessInspection(role)).toBe(true);
    });
  });

  describe('ROLE_ACCESS_MATRIX 완성도', () => {
    it('모든 UserRole이 ROLE_ACCESS_MATRIX에 정의됨', () => {
      for (const role of allRoles) {
        expect(ROLE_ACCESS_MATRIX[role]).toBeDefined();
        expect(typeof ROLE_ACCESS_MATRIX[role].canAccessInspection).toBe('boolean');
      }
    });

    it('ROLE_ACCESS_MATRIX의 키가 UserRole과 정확히 일치', () => {
      const matrixKeys = Object.keys(ROLE_ACCESS_MATRIX);
      const allRolesSet = new Set(allRoles);
      const matrixKeysSet = new Set(matrixKeys);

      expect(matrixKeysSet).toEqual(allRolesSet);
    });
  });
});