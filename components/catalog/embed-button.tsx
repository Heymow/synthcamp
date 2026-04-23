'use client';

import { useState } from 'react';
import { Check, Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmbedButtonProps {
  slug: string;
}

export function EmbedButton({ slug }: EmbedButtonProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const base = window.location.origin;
    const snippet = `<iframe src="${base}/embed/r/${slug}" width="100%" height="280" style="border:0;border-radius:16px" loading="lazy" title="SynthCamp release"></iframe>`;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Silent failure; clipboard permissions can be denied.
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={copy}
      className="flex w-full items-center justify-center gap-2"
    >
      {copied ? <Check size={14} className="text-emerald-400" /> : <Code2 size={14} />}
      {copied ? 'Embed copied' : 'Copy embed'}
    </Button>
  );
}
