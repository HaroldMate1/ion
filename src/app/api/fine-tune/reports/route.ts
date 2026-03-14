/**
 * Fine-Tune Reports API
 * GET  – List daily reports for the Fine-Tune portfolio
 * POST – Generate report for today
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateFineTuneReportForUser } from '@/lib/coach/autonomousRunner';
import type { DailyReportMetrics } from '@/lib/coach/types';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '30', 10);

    const { data: reports, error } = await (supabase.from('fine_tune_report') as any)
      .select('*')
      .eq('user_id', user.id)
      .order('report_date', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
    }

    return NextResponse.json({
      reports: (reports || []).map((r: any) => ({
        id: r.id,
        reportDate: r.report_date,
        metricsJson: r.metrics_json as DailyReportMetrics,
        createdAt: r.created_at,
      })),
      total: reports?.length || 0,
    });
  } catch (err) {
    console.error('Fine-tune reports GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await generateFineTuneReportForUser(supabase, user.id);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Fine-tune reports POST error:', err);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
