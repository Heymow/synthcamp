import { describe, it, expect } from 'vitest';
import { getPrice, getReleaseLabel } from '@/lib/pricing';

describe('getPrice', () => {
  it('3 tracks → $1.79', () => {
    expect(getPrice(3)).toBe('1.79');
  });
  it('5 tracks → $2.99', () => {
    expect(getPrice(5)).toBe('2.99');
  });
  it('6 tracks → $3.59', () => {
    expect(getPrice(6)).toBe('3.59');
  });
  it('12 tracks → $7.19', () => {
    expect(getPrice(12)).toBe('7.19');
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
