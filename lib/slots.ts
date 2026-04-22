export interface TimeRange {
  start: Date;
  end: Date;
}

export function isValid15MinSlot(date: Date): boolean {
  const epoch = Math.floor(date.getTime() / 1000);
  return epoch % 900 === 0;
}

export function computeEndsAt(start: Date, durationSeconds: number): Date {
  return new Date(start.getTime() + durationSeconds * 1000);
}

export function overlaps(a: TimeRange, b: TimeRange): boolean {
  // Exclusive on endpoints: [start, end)
  return a.start < b.end && b.start < a.end;
}
