import { describe, expect, it } from 'vitest';
import { canQuickInspect, canSchedule } from '@/app/aed-data/components/ActionButtons';

describe('Action permission helpers', () => {
  it('allows core inspection roles to perform quick inspections', () => {
    expect(canQuickInspect('master')).toBe(true);
    expect(canQuickInspect('local_admin')).toBe(true);
    expect(canQuickInspect('temporary_inspector')).toBe(false);
  });

  it('allows only admin roles to schedule inspections', () => {
    expect(canSchedule('master')).toBe(true);
    expect(canSchedule('regional_admin')).toBe(true);
    expect(canSchedule('temporary_inspector')).toBe(false);
    expect(canSchedule('email_verified' as never)).toBe(false);
  });
});
