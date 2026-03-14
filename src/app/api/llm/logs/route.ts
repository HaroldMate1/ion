import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const portfolioId = searchParams.get('portfolioId');

    if (!portfolioId) {
      return NextResponse.json({ error: 'Portfolio ID required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify portfolio ownership
    const { data: portfolio, error: portfolioError } = await await (supabase
      .from('llm_portfolio') as any)
      .select('id')
      .eq('id', portfolioId)
      .eq('user_id', user.id)
      .single();

    if (portfolioError || !portfolio) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    // Fetch logs
    const { data: logs, error } = await (supabase
      .from('llm_daily_log') as any)
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error('Error fetching logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { portfolioId, content } = body;

    if (!portfolioId || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify portfolio ownership
    const { data: portfolio, error: portfolioError } = await (supabase
      .from('llm_portfolio') as any)
      .select('id')
      .eq('id', portfolioId)
      .eq('user_id', user.id)
      .single();

    if (portfolioError || !portfolio) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    // Create log
    const { data: log, error } = await (supabase
      .from('llm_daily_log') as any)
      .insert({
        portfolio_id: portfolioId,
        content,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, log });
  } catch (error: any) {
    console.error('Error creating log:', error);
    return NextResponse.json(
      { error: 'Failed to create log' },
      { status: 500 }
    );
  }
}
