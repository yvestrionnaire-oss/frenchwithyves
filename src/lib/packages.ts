// Single source of truth for lesson package pricing.
// Both the public landing page and the student dashboard read from here so prices/discounts can never drift.

export const BASE_PRICE_PER_HOUR = 20; // USD, full retail per hour

export type PackageDef = {
  slug: "single" | "pack5" | "pack10" | "pack20";
  lessons: number;
  priceUsd: number; // total price in USD
  highlight?: boolean;
};

export const PACKAGES: PackageDef[] = [
  { slug: "single", lessons: 1, priceUsd: 20 },
  { slug: "pack5", lessons: 5, priceUsd: 95 },
  { slug: "pack10", lessons: 10, priceUsd: 188, highlight: true },
  { slug: "pack20", lessons: 20, priceUsd: 364 },
];

export function packageMath(pkg: PackageDef) {
  const subtotal = pkg.lessons * BASE_PRICE_PER_HOUR;
  const savings = subtotal - pkg.priceUsd;
  const discountPct = Math.round((savings / subtotal) * 100);
  const pricePerHour = pkg.priceUsd / pkg.lessons;
  return { subtotal, savings, discountPct, pricePerHour };
}
