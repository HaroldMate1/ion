/**
 * Fine-Tune Portfolio Trades API
 * GET – list trades (most recent first)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: trades, error } = await (supabase.from('fine_tune_trade') as any)
      .select('*')
      .eq('user_id', user.id)
      .order('opened_at', { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ trades: trades || [] });
  } catch (err) {
    console.error('Fine-tune trades error:', err);
    return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
  }
}
