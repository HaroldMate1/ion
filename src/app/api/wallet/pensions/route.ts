import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await (supabase.from('wallet_pension') as any)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ pensions: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch pensions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { name, provider, account_number, current_value, monthly_contribution, employer_contribution, expected_retirement_age, currency, notes } = body;

    const { data, error } = await (supabase.from('wallet_pension') as any)
      .insert({
        user_id: user.id,
        name,
        provider,
        account_number: account_number ?? null,
        current_value: current_value ?? 0,
        monthly_contribution: monthly_contribution ?? 0,
        employer_contribution: employer_contribution ?? 0,
        expected_retirement_age: expected_retirement_age ?? null,
        currency: currency ?? 'USD',
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ pension: data });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create pension' }, { status: 500 });
  }
}
