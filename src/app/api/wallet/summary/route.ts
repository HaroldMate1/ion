import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUSDRates, toUSD } from '@/lib/wallet/currency';

function getRiskProfile(expenseRatio: number): { label: string; color: string; description: string } {
  if (expenseRatio > 0.30) return { label: 'Conservative', color: 'blue', description: 'High obligations relative to wealth. Focus on building an emergency fund before investing.' };
  if (expenseRatio > 0.20) return { label: 'Moderate', color: 'cyan', description: 'Good foundation. Low-risk diversified funds are appropriate.' };
  if (expenseRatio > 0.10) return { label: 'Balanced', color: 'green', description: 'Solid position. A mix of growth and income investments suits your profile.' };
  if (expenseRatio > 0.05) return { label: 'Growth', color: 'amber', description: 'Low obligations. You can afford higher-risk, higher-reward investments.' };
  return { label: 'Aggressive', color: 'purple', description: 'Excellent financial position. You can pursue concentrated, high-growth strategies.' };
}

function toMonthly(amount: number, cycle: string): number {
  switch (cycle) {
    case 'weekly':    return amount * 52 / 12;
    case 'yearly':    return amount / 12;
    case 'quarterly': return amount / 3;
    default:          return amount; // monthly
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [accountsRes, assetsRes, pensionsRes, subsRes, cryptoRes, dcaRes, ratesResult] = await Promise.all([
      (supabase.from('wallet_bank_account') as any).select('current_balance, currency').eq('user_id', user.id),
      (supabase.from('wallet_asset') as any).select('current_value, currency').eq('user_id', user.id),
      (supabase.from('wallet_pension') as any).select('current_value, currency').eq('user_id', user.id),
      (supabase.from('wallet_subscription') as any).select('amount, billing_cycle, currency').eq('user_id', user.id).eq('is_active', true),
      (supabase.from('wallet_crypto') as any).select('amount_held, current_price_usd').eq('user_id', user.id),
      (supabase.from('wallet_dca') as any).select('monthly_amount, currency, current_value').eq('user_id', user.id).eq('is_active', true),
      getUSDRates(),
    ]);

    const rates = ratesResult;

    const bankTotal    = (accountsRes.data ?? []).reduce((s: number, r: any) => s + toUSD(Number(r.current_balance), r.currency, rates), 0);
    const assetTotal   = (assetsRes.data ?? []).reduce((s: number, r: any) => s + toUSD(Number(r.current_value), r.currency, rates), 0);
    const pensionTotal = (pensionsRes.data ?? []).reduce((s: number, r: any) => s + toUSD(Number(r.current_value), r.currency, rates), 0);
    const cryptoTotal  = (cryptoRes.data ?? []).reduce((s: number, r: any) => s + Number(r.amount_held) * Number(r.current_price_usd), 0);
    const dcaWealthTotal = (dcaRes.data ?? []).reduce((s: number, r: any) => s + toUSD(Number(r.current_value ?? 0), r.currency, rates), 0);
    const totalWealth  = bankTotal + assetTotal + pensionTotal + cryptoTotal + dcaWealthTotal;

    const monthlyObligations = (subsRes.data ?? []).reduce(
      (s: number, r: any) => s + toUSD(toMonthly(Number(r.amount), r.billing_cycle), r.currency, rates), 0
    );

    const dcaMonthly = (dcaRes.data ?? []).reduce(
      (s: number, r: any) => s + toUSD(Number(r.monthly_amount), r.currency, rates), 0
    );

    // Expense ratio: monthly obligations vs monthly wealth-equivalent (total / 120 months = 10 yr)
    const expenseRatio = totalWealth > 0 ? monthlyObligations / (totalWealth / 120) : 1;
    const riskProfile  = getRiskProfile(expenseRatio);

    // Fetch model performance for investment suggestions
    let coachReturn = 0;
    let fineTuneReturn = 0;
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const [coachRes, ftRes] = await Promise.all([
        fetch(`${baseUrl}/api/coach/balance`, { headers: { cookie: '' } }),
        fetch(`${baseUrl}/api/fine-tune/balance`, { headers: { cookie: '' } }),
      ]);
      if (coachRes.ok) { const d = await coachRes.json(); coachReturn = Number(d.totalReturnPct ?? 0); }
      if (ftRes.ok)    { const d = await ftRes.json();   fineTuneReturn = Number(d.totalReturnPct ?? 0); }
    } catch (_) { /* non-critical */ }

    const bestModel = coachReturn >= fineTuneReturn ? 'Coach' : 'Fine-Tune';

    return NextResponse.json({
      totalWealth,
      bankTotal,
      assetTotal,
      pensionTotal,
      cryptoTotal,
      dcaWealthTotal,
      monthlyObligations,
      dcaMonthly,
      expenseRatio,
      riskProfile,
      models: { coachReturn, fineTuneReturn, bestModel },
    });
  } catch (err) {
    console.error('Wallet summary error:', err);
    return NextResponse.json({ error: 'Failed to compute summary' }, { status: 500 });
  }
}
