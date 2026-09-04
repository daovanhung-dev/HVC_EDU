export function formatPercent(value: number | string | null | undefined, fractionDigits = 1): string {
  return `${(Number(value ?? 0) * 100).toFixed(fractionDigits)}%`;
}
