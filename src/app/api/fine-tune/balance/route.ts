/**
 * Fine-Tune Portfolio Balance API
 * GET – compute balance from fine_tune_trade records
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const INITIAL_BALANCE = 100_000;

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: trades } = await (supabase.from('fine_tune_trade') as any)
      .select('size_usd, pnl_usd, status, closed_at, opened_at')
      .eq('user_id', user.id);

    const all = trades || [];
    const open = all.filter((t: any) => t.status === 'open');
    const closed = all.filter((t: any) => t.status !== 'open');

    const realizedPnL = closed.reduce((s: number, t: any) => s + (Number(t.pnl_usd) || 0), 0);
    const capitalInUse = open.reduce((s: number, t: any) => s + Number(t.size_usd), 0);
    const totalValue = INITIAL_BALANCE + realizedPnL;
    const availableCash = Math.max(0, totalValue - capitalInUse);

    const today = new Date().toISOString().split('T')[0];
    const todayPnL = closed
      .filter((t: any) => t.closed_at?.startsWith(today))
      .reduce((s: number, t: any) => s + (Number(t.pnl_usd) || 0), 0);

    return NextResponse.json({
      initialBalance: INITIAL_BALANCE,
      totalValue,
      availableCash,
      capitalInUse,
      totalReturnPct: ((totalValue - INITIAL_BALANCE) / INITIAL_BALANCE) * 100,
      todayPnL,
      openPositions: open.length,
      totalTrades: all.length,
    });
  } catch (err) {
    console.error('Fine-tune balance error:', err);
    return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 500 });
  }
}
