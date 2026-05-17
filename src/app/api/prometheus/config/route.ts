import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await (supabase.from('prometheus_config') as any)
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json({ config: data });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { kill_switch, is_active } = body;

  const { data: existing } = await (supabase.from('prometheus_config') as any)
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  const updates: any = {};
  if (kill_switch !== undefined) updates.kill_switch = kill_switch;
  if (is_active   !== undefined) updates.is_active   = is_active;

  if (existing) {
    await (supabase.from('prometheus_config') as any)
      .update(updates)
      .eq('user_id', user.id);
  } else {
    await (supabase.from('prometheus_config') as any)
      .insert({ user_id: user.id, ...updates });
  }

  const { data: config } = await (supabase.from('prometheus_config') as any)
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json({ config });
}

// DELETE: reset portfolio (wipe all trades)
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await (supabase.from('prometheus_trade') as any)
    .delete()
    .eq('user_id', user.id);

  await (supabase.from('prometheus_config') as any)
    .update({ is_active: false, kill_switch: false })
    .eq('user_id', user.id);

  return NextResponse.json({ success: true });
}
