/**
 * Currency conversion utility for the Wallet feature.
 * Fetches live rates from open.er-api.com (free, no API key, 160+ currencies incl. COP).
 * All amounts are converted TO USD for aggregation.
 */

// Rates cache: 1-hour TTL, server-side only
let cache: { rates: Record<string, number>; ts: number } | null = null;

// Fallback rates (1 USD = X currency) used if API is unreachable
const FALLBACK_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, COP: 4200, MXN: 17.1, BRL: 5.1,
  ARS: 870, CAD: 1.36, AUD: 1.56, CHF: 0.89, JPY: 149,
};

/**
 * Returns exchange rates relative to USD (1 USD = X foreign currency).
 * To convert FROM a foreign currency TO USD: amount / rates[currency]
 */
export async function getUSDRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cache && now - cache.ts < 3_600_000) return cache.rates;

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error('Rate fetch failed');
    const data = await res.json();
    if (data.result !== 'success') throw new Error('Bad response');
    // Merge fallbacks first so any unsupported currency still gets a rate
    const rates: Record<string, number> = { ...FALLBACK_RATES, ...data.rates };
    cache = { rates, ts: now };
    return rates;
  } catch {
    return FALLBACK_RATES;
  }
}

/** Convert an amount from a given currency to USD */
export function toUSD(amount: number, currency: string, rates: Record<string, number>): number {
  if (!currency || currency === 'USD') return amount;
  const rate = rates[currency];
  if (!rate) return amount; // unknown currency — return as-is
  return amount / rate;
}
