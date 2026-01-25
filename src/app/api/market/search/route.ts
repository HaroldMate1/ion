/**
 * Market Search API Route
 * Search for stocks, ETFs, and cryptocurrencies
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchAssets } from '@/lib/api/market-data';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.length < 1) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    const results = await searchAssets(query);

    return NextResponse.json(results);
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Failed to search assets' },
      { status: 500 }
    );
  }
}
