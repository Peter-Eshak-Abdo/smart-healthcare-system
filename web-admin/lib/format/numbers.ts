export function formatWesternNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { useGrouping: false }).format(value);
}
