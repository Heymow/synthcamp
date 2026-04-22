import { describe, it, expect } from 'vitest';
import { getPrice, getReleaseLabel } from '@/lib/pricing';

describe('getPrice (formula: ceil(tracks * 0.60) - 0.01)', () => {
  it('3 tracks → $1.99 (ceil(1.8)=2)', () => {
    expect(getPrice(3)).toBe('1.99');
  });
  it('4 tracks → $2.39 (ceil(2.4)=3, 3-0.01=2.99 — wait, recalc)', () => {
    // ceil(4 * 0.6) = ceil(2.4) = 3; 3 - 0.01 = 2.99
    expect(getPrice(4)).toBe('2.99');
  });
  it('5 tracks → $2.99 (ceil(3.0)=3)', () => {
    expect(getPrice(5)).toBe('2.99');
  });
  it('6 tracks → $3.99 (ceil(3.6)=4)', () => {
    expect(getPrice(6)).toBe('3.99');
  });
  it('12 tracks → $7.99 (ceil(7.2)=8)', () => {
    expect(getPrice(12)).toBe('7.99');
  });
  it('100 tracks → $59.99 (ceil(60)=60)', () => {
    expect(getPrice(100)).toBe('59.99');
  });
});

describe('getReleaseLabel', () => {
  it('3 tracks → EP', () => {
    expect(getReleaseLabel(3)).toBe('3 tracks • EP');
  });
  it('5 tracks → EP', () => {
    expect(getReleaseLabel(5)).toBe('5 tracks • EP');
  });
  it('6 tracks → Album', () => {
    expect(getReleaseLabel(6)).toBe('6 tracks • Album');
  });
  it('12 tracks → Album', () => {
    expect(getReleaseLabel(12)).toBe('12 tracks • Album');
  });
});
