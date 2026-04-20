export function getPrice(trackCount: number): string {
  const calculated = Math.ceil(trackCount * 0.6);
  return `${calculated - 0.01}`;
}

export function getReleaseLabel(trackCount: number): string {
  let type = 'Album';
  if (trackCount === 1) type = 'Single';
  else if (trackCount <= 5) type = 'EP';
  return `${trackCount} ${trackCount > 1 ? 'tracks' : 'track'} • ${type}`;
}
