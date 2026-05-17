import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await (supabase.from('wallet_dca') as any)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at');

    if (error) throw error;
    return NextResponse.json({ plans: data ?? [] });
  } catch (err) {
    console.error('DCA GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch DCA plans' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { name, ticker, monthly_amount, currency, start_date, notes, current_value } = body;

    if (!name || monthly_amount == null) {
      return NextResponse.json({ error: 'name and monthly_amount are required' }, { status: 400 });
    }

    const { data, error } = await (supabase.from('wallet_dca') as any)
      .insert({
        user_id: user.id,
        name: name.trim(),
        ticker: ticker ? ticker.toUpperCase().trim() : null,
        monthly_amount: Number(monthly_amount),
        currency: currency ?? 'USD',
        start_date: start_date || null,
        notes: notes || null,
        current_value: current_value ? Number(current_value) : 0,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('DCA POST error:', err);
    return NextResponse.json({ error: 'Failed to create DCA plan' }, { status: 500 });
  }
}
