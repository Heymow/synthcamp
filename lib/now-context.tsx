'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * Single shared 1-second tick. Multiple `<StatusTimer>` instances all consume
 * the same interval instead of each spinning their own `setInterval(1000)`.
 *
 * Falls back to `Date.now()` outside a provider, so consumers used in stories
 * or tests still get a sensible value (just no live updates).
 */
const NowContext = createContext<number>(Date.now());

export function NowProvider({ children }: { children: ReactNode }) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return <NowContext.Provider value={now}>{children}</NowContext.Provider>;
}

export function useNow(): number {
  return useContext(NowContext);
}
