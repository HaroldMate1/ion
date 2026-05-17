import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const status = request.nextUrl.searchParams.get('status'); // 'open' | 'closed' | null (all)

  let query = (supabase.from('prometheus_trade') as any)
    .select('*')
    .eq('user_id', user.id)
    .order('opened_at', { ascending: false });

  if (status === 'open')   query = query.eq('status', 'open');
  if (status === 'closed') query = query.neq('status', 'open');

  const { data: trades, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ trades: trades || [] });
}
