// Stub for phase 2. Will wire @supabase/ssr createBrowserClient when backend is live.
// Foundation does NOT connect to Supabase; this export is a placeholder that throws if called.

export function getSupabaseBrowserClient(): never {
  throw new Error('Supabase browser client is a stub in Foundation. Wire in phase 2.');
}
