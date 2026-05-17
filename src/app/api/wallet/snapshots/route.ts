import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await (supabase.from('wallet_monthly_snapshot') as any)
      .select('*, wallet_bank_account(name, currency)')
      .eq('user_id', user.id)
      .order('snapshot_month', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ snapshots: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 });
  }
}
