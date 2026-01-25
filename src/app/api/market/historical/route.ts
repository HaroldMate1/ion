/**
 * Historical Price Data API Route
 * Get historical prices for charts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getHistoricalPrices } from '@/lib/api/market-data';
import type { AssetType } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const assetType = searchParams.get('type') as AssetType;
    const daysParam = searchParams.get('days');
    const days = daysParam ? parseInt(daysParam) : 30;

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

    const data = await getHistoricalPrices(symbol, assetType, days);

    if (!data) {
      return NextResponse.json(
        { error: 'Failed to fetch historical data' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      symbol,
      asset_type: assetType,
      data,
    });
  } catch (error) {
    console.error('Historical data API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch historical data' },
      { status: 500 }
    );
  }
}
