import { describe, it, expect } from 'vitest';
import { slugify } from '@/lib/slug';

describe('slugify', () => {
  it('basic title', () => {
    expect(slugify('Neural Drift')).toBe('neural-drift');
  });
  it('accents removed', () => {
    expect(slugify('Étoiles Éternelles')).toBe('etoiles-eternelles');
  });
  it('punctuation stripped', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
  });
  it('multiple spaces collapsed', () => {
    expect(slugify('A   B   C')).toBe('a-b-c');
  });
  it('leading/trailing dashes trimmed', () => {
    expect(slugify('-hello-')).toBe('hello');
  });
  it('max 100 chars', () => {
    const long = 'a'.repeat(200);
    expect(slugify(long).length).toBeLessThanOrEqual(100);
  });
  it('empty input → fallback', () => {
    expect(slugify('')).toBe('untitled');
  });
});
