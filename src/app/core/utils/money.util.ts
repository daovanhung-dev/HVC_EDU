export function formatMoney(value: number | string | null | undefined): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value ?? 0));
}
export function parseMoney(value: string): number {
  const normalized = value.replace(/[^0-9-]/g, '');
  return Number(normalized || 0);
}
