import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  getUserMock,
  fromMock,
  upsertMock,
  accountSessionsCreateMock,
  createExpressAccountMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
  upsertMock: vi.fn(),
  accountSessionsCreateMock: vi.fn(),
  createExpressAccountMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServerClient: () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));
vi.mock('@/lib/stripe', () => ({
  getStripeClient: () => ({
    accountSessions: { create: accountSessionsCreateMock },
  }),
  createExpressAccount: createExpressAccountMock,
  isStripeConfigured: () => true,
}));
vi.mock('@/lib/api/require-active', () => ({
  requireActiveAccount: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/api/limit', () => ({
  enforceLimit: vi.fn().mockReturnValue(null),
}));

import { POST } from '@/app/api/stripe/account-sessions/route';

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest() {
  return new Request('http://localhost/api/stripe/account-sessions', {
    method: 'POST',
  });
}

describe('POST /api/stripe/account-sessions', () => {
  it('rejects unauthenticated callers with 401', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeRequest() as any);
    expect(res.status).toBe(401);
  });

  it('rejects non-artist profiles with 403', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.c' } } });
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { is_artist: false } }),
        }),
      }),
    });
    const res = await POST(makeRequest() as any);
    expect(res.status).toBe(403);
  });

  it('creates a Stripe account when artist has none, then issues client_secret', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.c' } } });
    let call = 0;
    fromMock.mockImplementation((table: string) => {
      call += 1;
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { is_artist: true } }),
            }),
          }),
        };
      }
      if (call === 2) {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null }),
            }),
          }),
        };
      }
      return {
        upsert: upsertMock.mockResolvedValue({ error: null }),
      };
    });
    createExpressAccountMock.mockResolvedValue('acct_new');
    accountSessionsCreateMock.mockResolvedValue({ client_secret: 'secret_xyz' });

    const res = await POST(makeRequest() as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.client_secret).toBe('secret_xyz');
    expect(createExpressAccountMock).toHaveBeenCalledWith('a@b.c');
    expect(accountSessionsCreateMock).toHaveBeenCalledWith({
      account: 'acct_new',
      components: {
        account_onboarding: { enabled: true },
        account_management: { enabled: true },
      },
    });
  });

  it('reuses an existing stripe_account_id when present', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.c' } } });
    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { is_artist: true } }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: { stripe_account_id: 'acct_existing' } }),
          }),
        }),
      };
    });
    accountSessionsCreateMock.mockResolvedValue({ client_secret: 'secret_existing' });

    const res = await POST(makeRequest() as any);
    expect(res.status).toBe(200);
    expect(createExpressAccountMock).not.toHaveBeenCalled();
    expect(accountSessionsCreateMock).toHaveBeenCalledWith({
      account: 'acct_existing',
      components: {
        account_onboarding: { enabled: true },
        account_management: { enabled: true },
      },
    });
  });
});
