/**
 * Cron Job: Autonomous Trading Coach
 * Runs every 15 minutes during US market hours (Mon-Fri 9AM-4PM UTC)
 *
 * For each user with automation enabled:
 * 1. Runs analysis on their watchlist symbols
 * 2. Auto-executes trades from signals
 * 3. Monitors open trades and auto-closes at stop loss / take profit
 *
 * Protected by CRON_SECRET header validation (set by Vercel automatically)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  runAnalysisForUser,
  autoCloseTradesForUser,
  generateDailyReportForUser,
  runFineTuneForUser,
  transformConfigRow,
} from '@/lib/coach/autonomousRunner';
import { fetchARKActivity } from '@/lib/expert-tracking/ark-fetcher';
import { fetchHouseDisclosureActivity } from '@/lib/expert-tracking/house-disclosure-fetcher';
import { fetchAll13FActivity } from '@/lib/expert-tracking/sec-13f-fetcher';

export const maxDuration = 300; // 5 minutes max for cron execution

export async function GET(request: NextRequest) {
  try {
    // Validate cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();
    const results: Array<{
      userId: string;
      analysis: any;
      autoClose: any;
      report?: any;
    }> = [];

    // Find all users with automation enabled (run_cadence_minutes > 0, kill_switch off)
    const { data: configs, error: configError } = await (supabase
      .from('coach_config') as any)
      .select('*')
      .gt('run_cadence_minutes', 0)
      .eq('kill_switch', false);

    if (configError) {
      console.error('Error fetching coach configs:', configError);
      return NextResponse.json({ error: 'Failed to fetch configs' }, { status: 500 });
    }

    if (!configs || configs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users with automation enabled',
        usersProcessed: 0,
      });
    }

    // Process each user
    for (const configRow of configs) {
      const userId = configRow.user_id;
      const config = transformConfigRow(configRow);

      try {
        // Check cadence: only run if enough time has elapsed since last analysis
        const { data: lastSignal } = await (supabase
          .from('coach_signal') as any)
          .select('created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastSignal) {
          const lastRunTime = new Date(lastSignal.created_at).getTime();
          const cadenceMs = config.runCadenceMinutes * 60 * 1000;
          const elapsed = Date.now() - lastRunTime;

          if (elapsed < cadenceMs) {
            console.log(`Skipping user ${userId}: cadence not met (${Math.round(elapsed / 60000)}m / ${config.runCadenceMinutes}m)`);
            continue;
          }
        }

        // Step 1: Auto-close existing trades at SL/TP
        const autoCloseResult = await autoCloseTradesForUser(supabase, userId);

        // Step 2: Run analysis and auto-execute new trades
        const analysisResult = await runAnalysisForUser(supabase, userId, configRow);

        // Step 3: Auto-generate daily report with summary
        const reportResult = await generateDailyReportForUser(supabase, userId);

        // Step 4: Run Fine-Tune portfolio (pharma) — non-blocking per user
        let fineTuneResult: any = { skipped: true, reason: 'not attempted' };
        try {
          fineTuneResult = await runFineTuneForUser(supabase, userId);
        } catch (ftErr) {
          console.error(`[Fine-Tune] Error for user ${userId}:`, ftErr);
          fineTuneResult = { error: String(ftErr) };
        }

        results.push({
          userId,
          analysis: analysisResult,
          autoClose: autoCloseResult,
          report: reportResult,
        });

        console.log(
          `Processed user ${userId}: ` +
          `${analysisResult.skipped ? 'skipped' : `${analysisResult.signalsGenerated || 0} signals, ${analysisResult.autoExecutedTrades?.length || 0} trades`}, ` +
          `${autoCloseResult.closed} trades closed, ` +
          `report: ${reportResult.skipped ? 'skipped' : 'generated'}, ` +
          `fine-tune: ${fineTuneResult.skipped ? 'skipped' : `${fineTuneResult.tradesExecuted || 0} trades`}`
        );
      } catch (userError) {
        console.error(`Error processing user ${userId}:`, userError);
        results.push({
          userId,
          analysis: { error: String(userError) },
          autoClose: { error: String(userError) },
        });
      }
    }

    // ── Expert Investor Activity Tracking ──────────────────────────────
    // Runs after coach processing — non-blocking, errors don't fail the cron
    try {
      // Build ARK baseline from DB: fetch yesterday's wood activity weights so the
      // ARK fetcher diffs against real previous state instead of static config.
      let arkPreviousWeights: Map<string, number> | undefined;
      try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const { data: prevArkRows } = await (supabase
          .from('expert_investor_activity' as any) as any)
          .select('symbol, new_pct')
          .eq('investor_slug', 'wood')
          .gte('event_date', yesterdayStr)
          .not('new_pct', 'is', null);

        if (prevArkRows && prevArkRows.length > 0) {
          arkPreviousWeights = new Map<string, number>();
          for (const row of prevArkRows) {
            if (row.symbol && row.new_pct != null) {
              arkPreviousWeights.set(row.symbol, Number(row.new_pct));
            }
          }
        }
      } catch {
        // Non-fatal — fall back to static config baseline
      }

      // Fetch activity from all sources in parallel
      const [arkEvents, pelosiEvents, sec13fEvents] = await Promise.all([
        fetchARKActivity(arkPreviousWeights),
        fetchHouseDisclosureActivity(),
        fetchAll13FActivity(),
      ]);

      const allEvents = [...arkEvents, ...pelosiEvents, ...sec13fEvents];
      if (allEvents.length > 0) {
        const rows = allEvents.map(e => ({
          investor_slug: e.investorSlug,
          event_date: e.eventDate,
          symbol: e.symbol,
          asset_name: e.assetName || null,
          action: e.action,
          amount_range: e.amountRange || null,
          shares_change: e.sharesChange ?? null,
          previous_pct: e.previousPct ?? null,
          new_pct: e.newPct ?? null,
          source: e.source,
          raw_data: e.rawData || null,
        }));

        const { error: upsertError } = await (supabase
          .from('expert_investor_activity' as any) as any)
          .upsert(rows, {
            onConflict: 'investor_slug,event_date,symbol,action,source',
            ignoreDuplicates: true,
          });

        if (upsertError) {
          if (upsertError.code === '42P01') {
            // Table does not exist yet — migration not yet applied
            console.warn('[Expert Tracking] Table not found — run migration 006_expert_investor_activity.sql');
          } else {
            console.error('[Expert Tracking] Upsert error:', upsertError);
          }
        } else {
          console.log(`[Expert Tracking] Saved ${rows.length} activity events`);
        }
      } else {
        console.log('[Expert Tracking] No new events detected');
      }
    } catch (trackingError) {
      // Non-blocking — log but don't fail the cron response
      console.error('[Expert Tracking] Error (non-fatal):', trackingError);
    }

    return NextResponse.json({
      success: true,
      usersProcessed: results.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron coach error:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
