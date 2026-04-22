import { describe, it, expect } from 'vitest';
import { isValid15MinSlot, computeEndsAt, overlaps } from '@/lib/slots';

describe('isValid15MinSlot', () => {
  it('00:00 valid', () => {
    expect(isValid15MinSlot(new Date('2026-05-01T00:00:00Z'))).toBe(true);
  });
  it('00:15 valid', () => {
    expect(isValid15MinSlot(new Date('2026-05-01T00:15:00Z'))).toBe(true);
  });
  it('00:07 invalid', () => {
    expect(isValid15MinSlot(new Date('2026-05-01T00:07:00Z'))).toBe(false);
  });
  it('00:30:15 invalid (has seconds)', () => {
    expect(isValid15MinSlot(new Date('2026-05-01T00:30:15Z'))).toBe(false);
  });
});

describe('computeEndsAt', () => {
  it('adds duration in seconds', () => {
    const start = new Date('2026-05-01T15:00:00Z');
    const end = computeEndsAt(start, 1800); // 30 min
    expect(end.toISOString()).toBe('2026-05-01T15:30:00.000Z');
  });
});

describe('overlaps', () => {
  it('identical ranges overlap', () => {
    const a = { start: new Date('2026-05-01T15:00:00Z'), end: new Date('2026-05-01T16:00:00Z') };
    const b = { start: new Date('2026-05-01T15:00:00Z'), end: new Date('2026-05-01T16:00:00Z') };
    expect(overlaps(a, b)).toBe(true);
  });
  it('adjacent ranges (touching endpoints) do NOT overlap', () => {
    const a = { start: new Date('2026-05-01T15:00:00Z'), end: new Date('2026-05-01T16:00:00Z') };
    const b = { start: new Date('2026-05-01T16:00:00Z'), end: new Date('2026-05-01T17:00:00Z') };
    expect(overlaps(a, b)).toBe(false);
  });
  it('partial overlap detected', () => {
    const a = { start: new Date('2026-05-01T15:00:00Z'), end: new Date('2026-05-01T16:00:00Z') };
    const b = { start: new Date('2026-05-01T15:30:00Z'), end: new Date('2026-05-01T16:30:00Z') };
    expect(overlaps(a, b)).toBe(true);
  });
});
