import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (body.name           != null) updates.name           = body.name.trim();
    if (body.ticker         !== undefined) updates.ticker   = body.ticker ? body.ticker.toUpperCase().trim() : null;
    if (body.monthly_amount != null) updates.monthly_amount = Number(body.monthly_amount);
    if (body.currency       != null) updates.currency       = body.currency;
    if (body.start_date     !== undefined) updates.start_date = body.start_date || null;
    if (body.is_active      != null) updates.is_active      = body.is_active;
    if (body.notes          !== undefined) updates.notes         = body.notes || null;
    if (body.current_value  != null)      updates.current_value = Number(body.current_value);

    const { error } = await (supabase.from('wallet_dca') as any)
      .update(updates)
      .eq('id', params.id)
      .eq('user_id', user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DCA PUT error:', err);
    return NextResponse.json({ error: 'Failed to update DCA plan' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { error } = await (supabase.from('wallet_dca') as any)
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DCA DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete DCA plan' }, { status: 500 });
  }
}
