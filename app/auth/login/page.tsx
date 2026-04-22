'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';
import { LogoS } from '@/components/branding/logo-s';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submitMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
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
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-6 pb-32">
      <GlassPanel className="w-full space-y-6 p-8">
        <div className="flex flex-col items-center gap-3">
          <LogoS size={48} />
          <h1 className="text-2xl font-black italic uppercase leading-none tracking-tighter text-white">
            SynthCamp
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/60">
            Bienvenue
          </p>
        </div>

        <Button variant="ghost" size="lg" onClick={submitGoogle} className="w-full">
          Continuer avec Google
        </Button>

        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-white/50">
          <div className="h-[1px] flex-1 bg-white/10" />
          <span>ou</span>
          <div className="h-[1px] flex-1 bg-white/10" />
        </div>

        <form onSubmit={submitMagicLink} className="space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ton@email.com"
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
              ? 'Envoi...'
              : status === 'sent'
                ? 'Email envoyé ✓'
                : 'Recevoir le lien magique'}
          </Button>
        </form>

        {status === 'sent' && (
          <p className="text-center text-xs italic text-white/70">
            Check ta boîte mail, click sur le lien pour te connecter.
          </p>
        )}

        {error && <p className="text-center text-xs italic text-red-400">{error}</p>}
      </GlassPanel>
    </main>
  );
}
