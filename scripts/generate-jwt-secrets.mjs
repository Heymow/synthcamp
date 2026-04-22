#!/usr/bin/env node
/**
 * Generate JWT secrets and tokens for Supabase self-host.
 *
 * Outputs (copy-paste into supabase-selfhost/.env):
 *   JWT_SECRET        — 64-char hex string (used to sign all JWTs)
 *   ANON_KEY          — JWT signed with JWT_SECRET, role=anon, 10-year expiry
 *   SERVICE_ROLE_KEY  — JWT signed with JWT_SECRET, role=service_role, 10-year expiry
 *
 * Usage: node scripts/generate-jwt-secrets.mjs
 *
 * Requires Node 22+ (uses native crypto, no npm deps).
 */

import { createHmac, randomBytes } from 'node:crypto';

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', secret).update(data).digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${data}.${signature}`;
}

// 1. Generate JWT_SECRET (32 bytes → 64 hex chars)
const jwtSecret = randomBytes(32).toString('hex');

// 2. Generate ANON_KEY and SERVICE_ROLE_KEY (10-year expiry)
const now = Math.floor(Date.now() / 1000);
const tenYears = 60 * 60 * 24 * 365 * 10;
const iss = 'supabase-selfhost';

const anonPayload = {
  role: 'anon',
  iss,
  iat: now,
  exp: now + tenYears,
};

const serviceRolePayload = {
  role: 'service_role',
  iss,
  iat: now,
  exp: now + tenYears,
};

const anonKey = signJwt(anonPayload, jwtSecret);
const serviceRoleKey = signJwt(serviceRolePayload, jwtSecret);

// 3. Generate strong POSTGRES_PASSWORD
const postgresPassword = randomBytes(24).toString('base64')
  .replace(/[+/]/g, '')
  .slice(0, 32);

// 4. Generate DASHBOARD_PASSWORD
const dashboardPassword = randomBytes(18).toString('base64')
  .replace(/[+/]/g, '')
  .slice(0, 24);

// Output
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(' Supabase self-host secrets (copy into supabase-selfhost/.env)   ');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log(`POSTGRES_PASSWORD=${postgresPassword}`);
console.log('');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log('');
console.log(`ANON_KEY=${anonKey}`);
console.log('');
console.log(`SERVICE_ROLE_KEY=${serviceRoleKey}`);
console.log('');
console.log(`DASHBOARD_USERNAME=admin`);
console.log(`DASHBOARD_PASSWORD=${dashboardPassword}`);
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(' ⚠  Save these in your password manager NOW. JWT_SECRET and keys   ');
console.log('    cannot be regenerated — new ones would invalidate all sessions.');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
