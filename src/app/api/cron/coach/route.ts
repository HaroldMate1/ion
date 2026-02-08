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
  transformConfigRow,
} from '@/lib/coach/autonomousRunner';

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

        results.push({
          userId,
          analysis: analysisResult,
          autoClose: autoCloseResult,
        });

        console.log(
          `Processed user ${userId}: ` +
          `${analysisResult.skipped ? 'skipped' : `${analysisResult.signalsGenerated || 0} signals, ${analysisResult.autoExecutedTrades?.length || 0} trades`}, ` +
          `${autoCloseResult.closed} trades closed`
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
