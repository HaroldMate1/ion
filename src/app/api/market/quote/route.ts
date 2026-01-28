/**
 * Market Quote API Route
 * Get current price for a stock, ETF, or cryptocurrency with caching
 * Returns cached prices when API fails (with stale indicator)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMarketQuote } from '@/lib/api/market-data';
import type { AssetType, Market } from '@/types';

const CACHE_TTL_MINUTES = {
  stock: 5,
  etf: 5,
  crypto: 1,
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const assetType = searchParams.get('type') as AssetType;
    const market = (searchParams.get('market') || 'us') as Market;

    if (!symbol || !assetType) {
      return NextResponse.json(
        { error: 'Symbol and type parameters are required' },
        { status: 400 }
      );
    }

    if (!['stock', 'etf', 'crypto'].includes(assetType)) {
      return NextResponse.json(
        { error: 'Invalid asset type' },
        { status: 400 }
      );
    }

    if (!['us', 'europe', 'colombia'].includes(market)) {
      return NextResponse.json(
        { error: 'Invalid market' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check cache first
    const { data: cachedPrice, error: cacheError } = await supabase
      .from('price_cache')
      .select('*')
      .eq('symbol', symbol.toUpperCase())
      .eq('asset_type', assetType)
      .maybeSingle();

    const ttlMs = CACHE_TTL_MINUTES[assetType] * 60 * 1000;
    let isCacheValid = false;
    let cacheAgeMinutes = 0;

    if (!cacheError && cachedPrice) {
      const cached = cachedPrice as any;
      if (cached.cached_at) {
        const cacheAge = new Date().getTime() - new Date(cached.cached_at).getTime();
        cacheAgeMinutes = Math.floor(cacheAge / 60000);
        isCacheValid = cacheAge < ttlMs;
      }
    }

    // Return valid cache
    if (isCacheValid && cachedPrice) {
      const cached = cachedPrice as any;
      return NextResponse.json({
        symbol: cached.symbol,
        asset_type: cached.asset_type,
        market: market,
        price: Number(cached.price),
        change_24h: cached.change_24h ? Number(cached.change_24h) : null,
        volume_24h: cached.volume_24h ? Number(cached.volume_24h) : null,
        market_cap: cached.market_cap ? Number(cached.market_cap) : null,
        cached: true,
        stale: false,
      });
    }

    // Try to fetch fresh data from market APIs
    const quote = await getMarketQuote(symbol, assetType, market);

    if (quote) {
      // Update cache with fresh data
      await supabase
        .from('price_cache')
        .upsert(
          {
            symbol: quote.symbol.toUpperCase(),
            asset_type: quote.asset_type,
            price: quote.price,
            change_24h: quote.change_24h,
            volume_24h: quote.volume_24h,
            market_cap: quote.market_cap,
            cached_at: new Date().toISOString(),
          } as any,
          {
            onConflict: 'symbol,asset_type',
          }
        );

      return NextResponse.json({
        ...quote,
        cached: false,
        stale: false,
      });
    }

    // API failed - return stale cache if available
    if (cachedPrice) {
      const cached = cachedPrice as any;
      console.log(`Returning stale cache for ${symbol} (${cacheAgeMinutes} minutes old)`);
      return NextResponse.json({
        symbol: cached.symbol,
        asset_type: cached.asset_type,
        market: market,
        price: Number(cached.price),
        change_24h: cached.change_24h ? Number(cached.change_24h) : null,
        volume_24h: cached.volume_24h ? Number(cached.volume_24h) : null,
        market_cap: cached.market_cap ? Number(cached.market_cap) : null,
        cached: true,
        stale: true,
        cacheAgeMinutes: cacheAgeMinutes,
      });
    }

    // No cache and API failed
    return NextResponse.json(
      { error: 'Asset not found or API error' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Quote API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quote' },
      { status: 500 }
    );
  }
}
