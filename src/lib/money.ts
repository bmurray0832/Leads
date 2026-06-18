// Helpers for Prisma Decimal deal values. Prisma returns Decimal-like objects;
// we keep them as numbers in the UI layer.

export function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  // Prisma.Decimal and similar expose toString()/toNumber()
  const anyV = v as { toNumber?: () => number; toString?: () => string };
  if (typeof anyV.toNumber === "function") return anyV.toNumber();
  const n = Number(anyV.toString ? anyV.toString() : v);
  return Number.isNaN(n) ? 0 : n;
}

export function formatMoney(v: unknown): string {
  const n = toNumber(v);
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
