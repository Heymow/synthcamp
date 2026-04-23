'use client';

import { useEffect, useState } from 'react';

interface LocalDateTimeProps {
  iso: string;
  /** Passed through to Intl.DateTimeFormat. Defaults to short date + short time. */
  options?: Intl.DateTimeFormatOptions;
  /** Append the timezone name (e.g. "Europe/Paris"). Default true. */
  showTimezone?: boolean;
}

const DEFAULT_OPTIONS: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeStyle: 'short',
};

// Renders a timestamp formatted in the viewer's local timezone. Server-side
// renders a stable ISO fallback so we avoid hydration mismatch, then client
// swaps in the proper localized string once mounted.
export function LocalDateTime({ iso, options, showTimezone = true }: LocalDateTimeProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <span suppressHydrationWarning className="font-mono">
        {iso.slice(0, 16).replace('T', ' ')}
      </span>
    );
  }

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const formatted = new Date(iso).toLocaleString('en-US', {
    timeZone: tz,
    ...(options ?? DEFAULT_OPTIONS),
  });

  return (
    <span className="font-mono">
      {formatted}
      {showTimezone && <span className="ml-1 text-white/40">· {tz}</span>}
    </span>
  );
}
