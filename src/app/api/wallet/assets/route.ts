import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await (supabase.from('wallet_asset') as any)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ assets: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { name, asset_type, institution, current_value, initial_investment, expected_return_pct, maturity_date, currency, notes } = body;

    const { data, error } = await (supabase.from('wallet_asset') as any)
      .insert({
        user_id: user.id,
        name,
        asset_type: asset_type ?? 'savings',
        institution: institution ?? null,
        current_value,
        initial_investment: initial_investment ?? null,
        expected_return_pct: expected_return_pct ?? null,
        maturity_date: maturity_date ?? null,
        currency: currency ?? 'USD',
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ asset: data });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create asset' }, { status: 500 });
  }
}
