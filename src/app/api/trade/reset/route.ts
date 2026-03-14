/**
 * Portfolio Reset API
 * DELETE – clear all holdings and transactions, restore balance to $100,000
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const INITIAL_BALANCE = 100_000;

export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Delete all holdings and transaction history for this user
    await supabase.from('portfolios').delete().eq('user_id', user.id);
    await supabase.from('transactions').delete().eq('user_id', user.id);

    // Reset balance to initial $100,000
    await (supabase.from('balances').update as any)({
      available_cash: INITIAL_BALANCE,
      reserved_cash: 0,
      total_invested: 0,
    }).eq('user_id', user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Portfolio reset error:', err);
    return NextResponse.json({ error: 'Failed to reset portfolio' }, { status: 500 });
  }
}
