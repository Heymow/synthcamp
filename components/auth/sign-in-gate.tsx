'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';
import { LogoS } from '@/components/branding/logo-s';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface SignInGateProps {
  heading?: string;
  subheading?: string;
  redirectTo?: string;
}

// Map known callback/auth failure codes (set by app/(main)/auth/callback/route.ts
// and possible future OAuth flows) to friendly copy. Unknown codes fall
// through to a generic message so we never surface raw provider strings.
const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  callback_failed: "We couldn't finish signing you in. Please try again.",
  magic_link_expired: 'That magic link has expired. Request a new one below.',
  oauth_denied: 'Google sign-in was cancelled. You can try again below.',
  oauth_failed: "Google sign-in didn't complete. Please try again.",
  session_expired: 'Your session expired. Please sign in again.',
};

function callbackErrorMessage(code: string | null): string | null {
  if (!code) return null;
  return CALLBACK_ERROR_MESSAGES[code] ?? 'Sign-in failed. Please try again.';
}

// Translate GoTrue / network errors into copy we're OK showing users. Raw
// provider messages leak internals ("User signups disabled", rate-limit
// details) so we bucket by substring/code into a small set of friendly
// strings and default to a generic retry prompt.
function friendlyAuthError(err: { message?: string; code?: string } | null | undefined): string {
  const raw = `${err?.code ?? ''} ${err?.message ?? ''}`.toLowerCase();
  if (!raw.trim()) return "Couldn't send the magic link. Please try again.";
  if (raw.includes('rate') || raw.includes('too many') || raw.includes('429')) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  if (raw.includes('invalid') && raw.includes('email')) {
    return 'That email address looks invalid. Please check and try again.';
  }
  if (raw.includes('signup') && raw.includes('disabled')) {
    return 'New sign-ups are temporarily paused. Please try again later.';
  }
  if (raw.includes('network') || raw.includes('fetch') || raw.includes('failed to fetch')) {
    return 'Network error. Check your connection and try again.';
  }
  if (raw.includes('not confirmed') || raw.includes('not_confirmed')) {
    return 'Please check your inbox for the confirmation email we already sent.';
  }
  return "Couldn't send the magic link. Please try again.";
}

export function SignInGate({ heading, subheading, redirectTo }: SignInGateProps) {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const callbackError = callbackErrorMessage(searchParams.get('error'));
  const resolvedHeading = heading ?? t('signInHeading');
  const resolvedSubheading = subheading ?? t('welcome');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const callbackUrl = () => {
    if (typeof window === 'undefined') return '';
    const next = redirectTo ?? window.location.pathname + window.location.search;
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  };

  const submitMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl() },
    });
    if (err) {
      setStatus('error');
      setError(friendlyAuthError(err));
    } else {
      setStatus('sent');
    }
  };

  const submitGoogle = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl() },
    });
  };

  return (
    <main className="view-enter mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-6 pb-32">
      <GlassPanel className="w-full space-y-6 p-8">
        <div className="flex flex-col items-center gap-3">
          <LogoS size={48} />
          <h1 className="text-2xl font-black italic uppercase leading-none tracking-tighter text-white">
            {resolvedHeading}
          </h1>
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.3em] text-white/60">
            {resolvedSubheading}
          </p>
        </div>

        <Button variant="ghost" size="lg" onClick={submitGoogle} className="w-full">
          {t('continueWithGoogle')}
        </Button>

        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-white/50">
          <div className="h-[1px] flex-1 bg-white/10" />
          <span>{t('or')}</span>
          <div className="h-[1px] flex-1 bg-white/10" />
        </div>

        <form onSubmit={submitMagicLink} className="space-y-4">
          <input
            type="email"
            required
            autoFocus
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('emailPlaceholder')}
            aria-label="Email address"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-indigo-500 focus:outline-none"
            disabled={status === 'sending' || status === 'sent'}
          />
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={status === 'sending' || status === 'sent'}
          >
            {status === 'sending'
              ? t('sending')
              : status === 'sent'
                ? t('emailSent')
                : t('sendMagicLink')}
          </Button>
        </form>

        {status === 'sent' && (
          <p className="text-center text-xs italic text-white/70">{t('checkInbox')}</p>
        )}

        {error && <p className="text-center text-xs italic text-red-400">{error}</p>}

        {!error && callbackError && (
          <p className="text-center text-xs italic text-red-400">{callbackError}</p>
        )}
      </GlassPanel>
    </main>
  );
}
