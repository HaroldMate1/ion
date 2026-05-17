import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await (supabase.from('wallet_subscription') as any)
      .select('*')
      .eq('user_id', user.id)
      .order('next_payment_date', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ subscriptions: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { name, provider, category, amount, currency, billing_cycle, next_payment_date, notes } = body;

    const { data, error } = await (supabase.from('wallet_subscription') as any)
      .insert({
        user_id: user.id,
        name,
        provider: provider ?? null,
        category: category ?? 'entertainment',
        amount,
        currency: currency ?? 'USD',
        billing_cycle: billing_cycle ?? 'monthly',
        next_payment_date,
        is_active: true,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ subscription: data });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
  }
}
