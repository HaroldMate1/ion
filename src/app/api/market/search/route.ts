/**
 * Market Search API Route
 * Search for stocks, ETFs, and cryptocurrencies
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchAssets } from '@/lib/api/market-data';
import type { Market } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const market = (searchParams.get('market') || 'us') as Market;

    if (!query || query.length < 1) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    if (!['us', 'europe', 'colombia'].includes(market)) {
      return NextResponse.json(
        { error: 'Invalid market' },
        { status: 400 }
      );
    }

    const results = await searchAssets(query, market);

    return NextResponse.json(results);
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Failed to search assets' },
      { status: 500 }
    );
  }
}
