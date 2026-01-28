/**
 * Seed Price Cache Script
 * Run this locally to populate the price_cache table for European/Colombian stocks
 *
 * Usage: npx tsx scripts/seed-price-cache.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// These should match your .env.local
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Make sure you have a .env.local file with these values');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Symbols to seed (add your European/Colombian stocks here)
const SYMBOLS_TO_SEED = [
  { symbol: 'ECOPETROL.CL', assetType: 'stock' },
  { symbol: 'EQQQ.MI', assetType: 'etf' },
  { symbol: 'VVSM.DE', assetType: 'etf' },
  { symbol: 'SXR8.DE', assetType: 'etf' },
];

import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

async function fetchYahooQuote(symbol: string): Promise<{ price: number; change: number } | null> {
  try {
    const quote = await yahooFinance.quote(symbol);

    if (quote && quote.regularMarketPrice) {
      return {
        price: quote.regularMarketPrice,
        change: quote.regularMarketChangePercent || 0,
      };
    }

    return null;
  } catch (error) {
    console.error(`Failed to fetch ${symbol}:`, error);
    return null;
  }
}

async function seedPriceCache() {
  console.log('Seeding price cache...\n');

  for (const { symbol, assetType } of SYMBOLS_TO_SEED) {
    console.log(`Fetching ${symbol}...`);

    const quote = await fetchYahooQuote(symbol);

    if (quote) {
      const { error } = await supabase
        .from('price_cache')
        .upsert(
          {
            symbol: symbol.toUpperCase(),
            asset_type: assetType,
            price: quote.price,
            change_24h: quote.change,
            cached_at: new Date().toISOString(),
          },
          {
            onConflict: 'symbol,asset_type',
          }
        );

      if (error) {
        console.error(`  ❌ Failed to save ${symbol}:`, error.message);
      } else {
        console.log(`  ✅ ${symbol}: $${quote.price.toFixed(2)} (${quote.change >= 0 ? '+' : ''}${quote.change.toFixed(2)}%)`);
      }
    } else {
      console.log(`  ⚠️  ${symbol}: Could not fetch price`);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\nDone!');
}

seedPriceCache();
