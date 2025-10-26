import { describe, expect, it } from 'vitest';
import { buildScheduledTimestamp, isValidAssigneeIdentifier } from '@/lib/utils/schedule';

describe('buildScheduledTimestamp', () => {
  it('returns ISO string for valid date and time', () => {
    const iso = buildScheduledTimestamp('2025-09-20', '13:30');
    expect(iso).toMatch(/^2025-09-20T/);
    const date = iso ? new Date(iso) : null;
    expect(date?.getHours()).toBe(13);
    expect(date?.getMinutes()).toBe(30);
  });

  it('uses default time when none provided', () => {
    const iso = buildScheduledTimestamp('2025-09-20', undefined);
    expect(iso).toMatch(/^2025-09-20T/);
    const date = iso ? new Date(iso) : null;
    expect(date?.getHours()).toBe(9);
    expect(date?.getMinutes()).toBe(0);
  });

  it('returns null for invalid inputs', () => {
    expect(buildScheduledTimestamp('invalid', '10:00')).toBeNull();
    expect(buildScheduledTimestamp('2025-09-20', '25:61')).toBeNull();
    expect(buildScheduledTimestamp('', '10:00')).toBeNull();
  });
});

describe('isValidAssigneeIdentifier', () => {
  it('accepts valid emails and identifiers', () => {
    expect(isValidAssigneeIdentifier('inspector@example.com')).toBe(true);
    expect(isValidAssigneeIdentifier('device-owner')).toBe(true);
  });

  it('rejects invalid or short values', () => {
    expect(isValidAssigneeIdentifier('')).toBe(false);
    expect(isValidAssigneeIdentifier('a@b')).toBe(false);
    expect(isValidAssigneeIdentifier('ab')).toBe(false);
  });
});
