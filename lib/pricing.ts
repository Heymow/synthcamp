export function getPrice(trackCount: number): string {
  return (trackCount * 0.6 - 0.01).toFixed(2);
}

export function getReleaseLabel(trackCount: number): string {
  const type = trackCount <= 5 ? 'EP' : 'Album';
  return `${trackCount} tracks • ${type}`;
}
