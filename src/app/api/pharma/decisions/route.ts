/**
 * Pharma Regulatory Decisions API
 * GET /api/pharma/decisions
 *
 * Returns curated regulatory pipeline (FDA + EMA decisions) from the static
 * pharma-pipeline config, optionally enriched with live openFDA data.
 *
 * Query params:
 *   status   = 'pending' | 'decided' | 'all' (default: 'all')
 *   body     = 'FDA' | 'EMA' | 'all' (default: 'all')
 *   area     = TherapeuticArea | 'all' (default: 'all')
 *   signal   = InvestmentSignal | 'all' (default: 'all')
 *   live     = '1' → also fetch recent approvals from openFDA (default: '0')
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PHARMA_PIPELINE } from '@/config/pharma-pipeline';
import { fetchRecentFDAApprovals } from '@/lib/pharma/fda-api';
import type { RegulatoryDecision } from '@/types/pharma.types';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'all';
    const bodyFilter   = searchParams.get('body') || 'all';
    const areaFilter   = searchParams.get('area') || 'all';
    const signalFilter = searchParams.get('signal') || 'all';
    const fetchLive    = searchParams.get('live') === '1';

    // Start with static pipeline
    let decisions: RegulatoryDecision[] = [...PHARMA_PIPELINE];

    // Apply filters
    if (statusFilter === 'pending') {
      decisions = decisions.filter(d => d.isPending);
    } else if (statusFilter === 'decided') {
      decisions = decisions.filter(d => !d.isPending);
    }
    if (bodyFilter !== 'all') {
      decisions = decisions.filter(d => d.regulatoryBody === bodyFilter);
    }
    if (areaFilter !== 'all') {
      decisions = decisions.filter(d => d.therapeuticArea === areaFilter);
    }
    if (signalFilter !== 'all') {
      decisions = decisions.filter(d => d.investmentSignal === signalFilter);
    }

    // Sort: pending decisions by actionDate ascending (soonest first),
    // decided decisions by actionDate descending (most recent first)
    const pending = decisions
      .filter(d => d.isPending)
      .sort((a, b) => a.actionDate.localeCompare(b.actionDate));
    const decided = decisions
      .filter(d => !d.isPending)
      .sort((a, b) => b.actionDate.localeCompare(a.actionDate));

    const sorted = [...pending, ...decided];

    // Optionally enrich with live openFDA data
    let liveApprovals: any[] = [];
    if (fetchLive) {
      try {
        liveApprovals = await fetchRecentFDAApprovals('20240101');
      } catch {
        // Non-fatal — serve static data
      }
    }

    // Compute summary stats
    const totalPending    = PHARMA_PIPELINE.filter(d => d.isPending).length;
    const totalApproved   = PHARMA_PIPELINE.filter(d => d.status === 'approved').length;
    const totalRejected   = PHARMA_PIPELINE.filter(d => d.status === 'rejected' || d.status === 'crl').length;
    const strongBuyCount  = PHARMA_PIPELINE.filter(d => d.investmentSignal === 'strong_buy').length;
    const buyCount        = PHARMA_PIPELINE.filter(d => d.investmentSignal === 'buy').length;

    // Next upcoming decision
    const nextUp = PHARMA_PIPELINE
      .filter(d => d.isPending)
      .sort((a, b) => a.actionDate.localeCompare(b.actionDate))[0] || null;

    return NextResponse.json({
      decisions: sorted,
      liveApprovals,
      stats: {
        totalPending,
        totalApproved,
        totalRejected,
        strongBuyCount,
        buyCount,
      },
      nextUpcoming: nextUp,
      dataAsOf: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Pharma Decisions API] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch regulatory decisions' }, { status: 500 });
  }
}
