import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await (supabase.from('wallet_crypto') as any)
      .select('*')
      .eq('user_id', user.id)
      .order('coin_symbol');

    if (error) throw error;
    return NextResponse.json({ crypto: data ?? [] });
  } catch (err) {
    console.error('Crypto GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch crypto holdings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { coin_symbol, coin_name, amount_held, purchase_price_usd, purchase_date, current_price_usd, notes } = body;

    if (!coin_symbol || !coin_name || amount_held == null) {
      return NextResponse.json({ error: 'coin_symbol, coin_name, and amount_held are required' }, { status: 400 });
    }

    const { data, error } = await (supabase.from('wallet_crypto') as any)
      .insert({
        user_id: user.id,
        coin_symbol: coin_symbol.toUpperCase().trim(),
        coin_name: coin_name.trim(),
        amount_held: Number(amount_held),
        purchase_price_usd: purchase_price_usd ? Number(purchase_price_usd) : null,
        purchase_date: purchase_date || null,
        current_price_usd: current_price_usd ? Number(current_price_usd) : 0,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('Crypto POST error:', err);
    return NextResponse.json({ error: 'Failed to create holding' }, { status: 500 });
  }
}
