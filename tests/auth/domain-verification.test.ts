/**
 * 도메인 검증 로직 단위 테스트
 *
 * 목적: 역할별 이메일 도메인 제한 검증
 * 보안 정책:
 * - @nmc.or.kr: emergency_center_admin, regional_emergency_center_admin
 * - @korea.kr: ministry_admin, regional_admin, local_admin
 * - 기타 도메인: temporary_inspector만 허용
 *
 * 작성일: 2025-10-18
 * 참조: docs/analysis/region-code-policy-comparison.md
 */

import { describe, it, expect } from 'vitest';
import { resolveAccessScope } from '@/lib/auth/access-control';
import { UserProfile, UserRole } from '@/packages/types';

// 테스트용 사용자 프로필 생성 헬퍼
function createUserProfile(
  role: UserRole,
  email: string,
  regionCode?: string,
  cityCode?: string
): UserProfile {
  return {
    id: 'test-user-id',
    email,
    role,
    region_code: regionCode,
    organization: cityCode ? {
      id: 'test-org-id',
      name: 'Test Organization',
      region_code: regionCode || '',
      city_code: cityCode,
    } : undefined,
  } as UserProfile;
}

describe('Domain Verification - @nmc.or.kr', () => {
  describe('emergency_center_admin', () => {
    it('should allow @nmc.or.kr domain', () => {
      const user = createUserProfile('emergency_center_admin', 'test@nmc.or.kr');
      expect(() => resolveAccessScope(user)).not.toThrow();
    });

    it('should reject @korea.kr domain', () => {
      const user = createUserProfile('emergency_center_admin', 'test@korea.kr');
      expect(() => resolveAccessScope(user)).toThrow('[ACCESS_DENIED]');
      expect(() => resolveAccessScope(user)).toThrow('can only have roles');
    });

    it('should reject @gmail.com domain', () => {
      const user = createUserProfile('emergency_center_admin', 'test@gmail.com');
      expect(() => resolveAccessScope(user)).toThrow('[ACCESS_DENIED]');
      expect(() => resolveAccessScope(user)).toThrow('can only have role: temporary_inspector');
    });

    it('should reject @naver.com domain', () => {
      const user = createUserProfile('emergency_center_admin', 'test@naver.com');
      expect(() => resolveAccessScope(user)).toThrow('[ACCESS_DENIED]');
    });
  });

  describe('regional_emergency_center_admin', () => {
    it('should allow @nmc.or.kr domain', () => {
      const user = createUserProfile('regional_emergency_center_admin', 'test@nmc.or.kr');
      expect(() => resolveAccessScope(user)).not.toThrow();
    });

    it('should reject @korea.kr domain', () => {
      const user = createUserProfile('regional_emergency_center_admin', 'test@korea.kr');
      expect(() => resolveAccessScope(user)).toThrow('[ACCESS_DENIED]');
      expect(() => resolveAccessScope(user)).toThrow('can only have roles');
    });

    it('should reject other domains', () => {
      const user = createUserProfile('regional_emergency_center_admin', 'test@example.com');
      expect(() => resolveAccessScope(user)).toThrow('[ACCESS_DENIED]');
      expect(() => resolveAccessScope(user)).toThrow('can only have role: temporary_inspector');
    });
  });
});

describe('Domain Verification - @korea.kr', () => {
  describe('ministry_admin', () => {
    it('should allow @korea.kr domain', () => {
      const user = createUserProfile('ministry_admin', 'test@korea.kr');
      expect(() => resolveAccessScope(user)).not.toThrow();
    });

    it('should reject @nmc.or.kr domain', () => {
      const user = createUserProfile('ministry_admin', 'test@nmc.or.kr');
      expect(() => resolveAccessScope(user)).toThrow('[ACCESS_DENIED]');
      expect(() => resolveAccessScope(user)).toThrow('can only have roles');
    });

    it('should reject @gmail.com domain', () => {
      const user = createUserProfile('ministry_admin', 'test@gmail.com');
      expect(() => resolveAccessScope(user)).toThrow('[ACCESS_DENIED]');
      expect(() => resolveAccessScope(user)).toThrow('can only have role: temporary_inspector');
    });
  });

  describe('regional_admin', () => {
    it('should allow @korea.kr domain with region_code', () => {
      const user = createUserProfile('regional_admin', 'test@korea.kr', 'SEO');
      expect(() => resolveAccessScope(user)).not.toThrow();

      const scope = resolveAccessScope(user);
      expect(scope.allowedRegionCodes).toEqual(['SEO']);
      expect(scope.allowedCityCodes).toBeNull(); // 시군구 선택 가능
    });

    it('should reject @nmc.or.kr domain', () => {
      const user = createUserProfile('regional_admin', 'test@nmc.or.kr', 'SEO');
      expect(() => resolveAccessScope(user)).toThrow('[ACCESS_DENIED]');
      expect(() => resolveAccessScope(user)).toThrow('can only have roles');
    });

    it('should reject @gmail.com domain', () => {
      const user = createUserProfile('regional_admin', 'test@gmail.com', 'SEO');
      expect(() => resolveAccessScope(user)).toThrow('[ACCESS_DENIED]');
      expect(() => resolveAccessScope(user)).toThrow('can only have role: temporary_inspector');
    });

    it('should reject @naver.com domain', () => {
      const user = createUserProfile('regional_admin', 'test@naver.com', 'SEO');
      expect(() => resolveAccessScope(user)).toThrow('[ACCESS_DENIED]');
      expect(() => resolveAccessScope(user)).toThrow('can only have role: temporary_inspector');
    });
  });

  describe('local_admin', () => {
    it('should allow @korea.kr domain with region_code and city_code', () => {
      const user = createUserProfile('local_admin', 'test@korea.kr', 'SEO', '강남구');
      expect(() => resolveAccessScope(user)).not.toThrow();

      const scope = resolveAccessScope(user);
      expect(scope.allowedRegionCodes).toEqual(['SEO']);
      expect(scope.allowedCityCodes).toEqual(['강남구']);
    });

    it('should reject @nmc.or.kr domain', () => {
      const user = createUserProfile('local_admin', 'test@nmc.or.kr', 'SEO', '강남구');
      expect(() => resolveAccessScope(user)).toThrow('[ACCESS_DENIED]');
      expect(() => resolveAccessScope(user)).toThrow('can only have roles');
    });

    it('should reject @gmail.com domain', () => {
      const user = createUserProfile('local_admin', 'test@gmail.com', 'SEO', '강남구');
      expect(() => resolveAccessScope(user)).toThrow('[ACCESS_DENIED]');
      expect(() => resolveAccessScope(user)).toThrow('can only have role: temporary_inspector');
    });

    it('should reject @naver.com domain', () => {
      const user = createUserProfile('local_admin', 'test@naver.com', 'SEO', '강남구');
      expect(() => resolveAccessScope(user)).toThrow('[ACCESS_DENIED]');
      expect(() => resolveAccessScope(user)).toThrow('can only have role: temporary_inspector');
    });
  });
});

describe('Domain Verification - Non-Government Domains', () => {
  describe('temporary_inspector with non-government domain', () => {
    it('should allow @gmail.com domain for temporary_inspector', () => {
      const user = createUserProfile('temporary_inspector', 'test@gmail.com');
      // temporary_inspector는 AED 데이터 접근 불가이므로 region_code 없어도 OK
      // resolveAccessScope는 도메인 검증만 통과하면 됨 (AED 접근은 별도 체크)
      expect(() => resolveAccessScope(user)).not.toThrow('[ACCESS_DENIED]');
    });

    it('should allow @naver.com domain for temporary_inspector', () => {
      const user = createUserProfile('temporary_inspector', 'test@naver.com');
      expect(() => resolveAccessScope(user)).not.toThrow('[ACCESS_DENIED]');
    });

    it('should allow @example.com domain for temporary_inspector', () => {
      const user = createUserProfile('temporary_inspector', 'test@example.com');
      expect(() => resolveAccessScope(user)).not.toThrow('[ACCESS_DENIED]');
    });
  });

  describe('admin roles with non-government domain (should reject)', () => {
    it('should reject regional_admin with @gmail.com', () => {
      const user = createUserProfile('regional_admin', 'test@gmail.com', 'SEO');
      expect(() => resolveAccessScope(user)).toThrow('[ACCESS_DENIED]');
      expect(() => resolveAccessScope(user)).toThrow('can only have role: temporary_inspector');
    });

    it('should reject local_admin with @naver.com', () => {
      const user = createUserProfile('local_admin', 'test@naver.com', 'SEO', '강남구');
      expect(() => resolveAccessScope(user)).toThrow('[ACCESS_DENIED]');
      expect(() => resolveAccessScope(user)).toThrow('can only have role: temporary_inspector');
    });

    it('should reject emergency_center_admin with @company.com', () => {
      const user = createUserProfile('emergency_center_admin', 'test@company.com');
      expect(() => resolveAccessScope(user)).toThrow('[ACCESS_DENIED]');
      expect(() => resolveAccessScope(user)).toThrow('can only have role: temporary_inspector');
    });

    it('should reject ministry_admin with @example.org', () => {
      const user = createUserProfile('ministry_admin', 'test@example.org');
      expect(() => resolveAccessScope(user)).toThrow('[ACCESS_DENIED]');
      expect(() => resolveAccessScope(user)).toThrow('can only have role: temporary_inspector');
    });
  });
});

describe('Domain Verification - master', () => {
  it('should allow any domain for master role', () => {
    const domains = ['@korea.kr', '@nmc.or.kr', '@gmail.com', '@naver.com', '@example.com'];

    domains.forEach(domain => {
      const user = createUserProfile('master', `test${domain}`);
      expect(() => resolveAccessScope(user)).not.toThrow();

      const scope = resolveAccessScope(user);
      expect(scope.allowedRegionCodes).toBeNull(); // 전국 접근
      expect(scope.allowedCityCodes).toBeNull(); // 전체 시군구 접근
    });
  });
});

describe('Domain Verification - Case Sensitivity', () => {
  it('should handle uppercase domains (should convert to lowercase)', () => {
    const user = createUserProfile('regional_admin', 'test@KOREA.KR', 'SEO');
    // emailDomain은 toLowerCase() 처리되므로 통과해야 함
    expect(() => resolveAccessScope(user)).not.toThrow();
  });

  it('should handle mixed case domains', () => {
    const user = createUserProfile('emergency_center_admin', 'test@Nmc.Or.Kr');
    expect(() => resolveAccessScope(user)).not.toThrow();
  });
});

describe('Domain Verification - Error Messages', () => {
  it('should include role name in error message', () => {
    const user = createUserProfile('regional_admin', 'test@gmail.com', 'SEO');

    try {
      resolveAccessScope(user);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect((error as Error).message).toContain('regional_admin');
    }
  });

  it('should include temporary_inspector suggestion for non-government domain', () => {
    const user = createUserProfile('local_admin', 'test@naver.com', 'SEO', '강남구');

    try {
      resolveAccessScope(user);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect((error as Error).message).toContain('temporary_inspector');
    }
  });

  it('should include actual domain in error message', () => {
    const user = createUserProfile('emergency_center_admin', 'test@wrong.com');

    try {
      resolveAccessScope(user);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect((error as Error).message).toContain('@wrong.com');
    }
  });

  it('should include [ACCESS_DENIED] tag for logging', () => {
    const user = createUserProfile('ministry_admin', 'test@example.com');

    try {
      resolveAccessScope(user);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect((error as Error).message).toContain('[ACCESS_DENIED]');
    }
  });
});

describe('Domain Verification - Edge Cases', () => {
  it('should handle missing email', () => {
    const user = {
      id: 'test-user-id',
      email: undefined,
      role: 'regional_admin' as UserRole,
      region_code: 'SEO',
    } as UserProfile;

    expect(() => resolveAccessScope(user)).toThrow('[ACCESS_DENIED]');
  });

  it('should handle email without domain', () => {
    const user = createUserProfile('local_admin', 'testuser', 'SEO', '강남구');
    expect(() => resolveAccessScope(user)).toThrow('[ACCESS_DENIED]');
  });

  it('should handle empty email', () => {
    const user = createUserProfile('regional_admin', '', 'SEO');
    expect(() => resolveAccessScope(user)).toThrow('[ACCESS_DENIED]');
  });
});

describe('Domain Verification - Integration with Region Code', () => {
  it('should pass both domain and region validation for valid regional_admin', () => {
    const user = createUserProfile('regional_admin', 'test@korea.kr', 'DAE');

    const scope = resolveAccessScope(user);
    expect(scope.allowedRegionCodes).toEqual(['DAE']);
    expect(scope.allowedCityCodes).toBeNull();
  });

  it('should pass both domain and region/city validation for valid local_admin', () => {
    const user = createUserProfile('local_admin', 'test@korea.kr', 'BUS', '해운대구');

    const scope = resolveAccessScope(user);
    expect(scope.allowedRegionCodes).toEqual(['BUS']);
    expect(scope.allowedCityCodes).toEqual(['해운대구']);
  });

  it('should fail domain validation before region validation', () => {
    const user = createUserProfile('regional_admin', 'test@gmail.com', 'SEO');

    // 도메인 검증이 먼저 실패해야 함 (region_code 검증 전)
    expect(() => resolveAccessScope(user)).toThrow('[ACCESS_DENIED]');
    expect(() => resolveAccessScope(user)).toThrow('can only have role: temporary_inspector');
  });
});
