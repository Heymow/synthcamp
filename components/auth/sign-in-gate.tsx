'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';
import { LogoS } from '@/components/branding/logo-s';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface SignInGateProps {
  heading?: string;
  subheading?: string;
  redirectTo?: string;
}

export function SignInGate({
  heading = 'SynthCamp',
  subheading = 'Welcome',
  redirectTo,
}: SignInGateProps) {
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
      setError(err.message);
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
            {heading}
          </h1>
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.3em] text-white/60">
            {subheading}
          </p>
        </div>

        <Button variant="ghost" size="lg" onClick={submitGoogle} className="w-full">
          Continue with Google
        </Button>

        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-white/50">
          <div className="h-[1px] flex-1 bg-white/10" />
          <span>or</span>
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
            placeholder="your@email.com"
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
              ? 'Sending...'
              : status === 'sent'
                ? 'Email sent ✓'
                : 'Send magic link'}
          </Button>
        </form>

        {status === 'sent' && (
          <p className="text-center text-xs italic text-white/70">
            Check your inbox and click the link to sign in.
          </p>
        )}

        {error && <p className="text-center text-xs italic text-red-400">{error}</p>}
      </GlassPanel>
    </main>
  );
}
