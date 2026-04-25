export function getPrice(trackCount: number): string {
  const calculated = Math.ceil(trackCount * 0.6);
  return (calculated - 0.01).toFixed(2);
}

export function getReleaseLabel(trackCount: number): string {
  const type = trackCount <= 5 ? 'EP' : 'Album';
  return `${trackCount} tracks • ${type}`;
}

/**
 * Effective minimum price for a release, applying the party-live discount
 * when the caller hands us `isPartyLive=true`. Returns dollars (string with
 * 2 decimals, matching getPrice's contract).
 *
 * Server callers must compute `isPartyLive` from the DB (an active party
 * with status='live' for the release). Client-rendered prices are
 * informational; the authoritative price is enforced server-side at
 * Checkout Session creation time (see Phase 3 Lot 3).
 */
export function effectiveMinPrice(
  trackCount: number,
  partyLiveDiscountPct: number,
  isPartyLive: boolean,
): string {
  const base = parseFloat(getPrice(trackCount));
  if (!isPartyLive || partyLiveDiscountPct === 0) return base.toFixed(2);
  const discounted = base * (1 - partyLiveDiscountPct / 100);
  return discounted.toFixed(2);
}
