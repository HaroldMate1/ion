import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { coin_symbol, coin_name, amount_held, purchase_price_usd, purchase_date, current_price_usd, notes } = body;

    const updates: Record<string, unknown> = {};
    if (coin_symbol    != null) updates.coin_symbol         = coin_symbol.toUpperCase().trim();
    if (coin_name      != null) updates.coin_name           = coin_name.trim();
    if (amount_held    != null) updates.amount_held         = Number(amount_held);
    if (purchase_price_usd !== undefined) updates.purchase_price_usd = purchase_price_usd ? Number(purchase_price_usd) : null;
    if (purchase_date  !== undefined) updates.purchase_date = purchase_date || null;
    if (current_price_usd != null) updates.current_price_usd = Number(current_price_usd);
    if (notes          !== undefined) updates.notes          = notes || null;

    const { error } = await (supabase.from('wallet_crypto') as any)
      .update(updates)
      .eq('id', params.id)
      .eq('user_id', user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Crypto PUT error:', err);
    return NextResponse.json({ error: 'Failed to update holding' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { error } = await (supabase.from('wallet_crypto') as any)
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Crypto DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete holding' }, { status: 500 });
  }
}
