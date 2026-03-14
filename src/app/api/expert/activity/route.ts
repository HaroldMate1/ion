/**
 * Expert Investor Activity API
 * Returns detected trades/changes for Wood (daily) and Pelosi (periodic)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get('days') || '30', 10), 90);
    const investorSlug = searchParams.get('investorSlug');

    let query = (supabase.from('expert_investor_activity' as any) as any)
      .select('*')
      .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('event_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);

    if (investorSlug) {
      query = query.eq('investor_slug', investorSlug);
    }

    const { data, error } = await query;
    if (error) {
      // Table may not exist yet — return empty gracefully
      if (error.code === '42P01') {
        return NextResponse.json({ activities: [], lastUpdated: null });
      }
      throw error;
    }

    const activities = (data || []).map((row: any) => ({
      id: row.id,
      investorSlug: row.investor_slug,
      eventDate: row.event_date,
      symbol: row.symbol,
      assetName: row.asset_name,
      action: row.action,
      amountRange: row.amount_range,
      sharesChange: row.shares_change ? Number(row.shares_change) : null,
      previousPct: row.previous_pct ? Number(row.previous_pct) : null,
      newPct: row.new_pct ? Number(row.new_pct) : null,
      source: row.source,
      createdAt: row.created_at,
    }));

    return NextResponse.json({
      activities,
      lastUpdated: data?.[0]?.created_at || null,
    });
  } catch (error) {
    console.error('[Expert Activity API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}
