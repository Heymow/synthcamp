import { describe, it, expect } from 'vitest';
import { generateAesKey, buildKeyInfoFile } from '../src/key';

describe('generateAesKey', () => {
  it('returns exactly 16 bytes', () => {
    expect(generateAesKey().length).toBe(16);
  });

  it('returns different keys on each call', () => {
    const a = generateAesKey().toString('hex');
    const b = generateAesKey().toString('hex');
    expect(a).not.toBe(b);
  });
});

describe('buildKeyInfoFile', () => {
  it('produces the 2-line format with placeholder URI', () => {
    const out = buildKeyInfoFile({ trackId: 'abc', localKeyPath: '/tmp/key.bin' });
    expect(out).toBe('https://synthcamp.net/api/tracks/abc/key\n/tmp/key.bin\n');
  });

  it('appends IV when provided', () => {
    const out = buildKeyInfoFile({
      trackId: 'abc',
      localKeyPath: '/tmp/key.bin',
      iv: '0123456789abcdef0123456789abcdef',
    });
    expect(out.split('\n')).toHaveLength(4);
    expect(out.split('\n')[2]).toBe('0123456789abcdef0123456789abcdef');
  });
});
