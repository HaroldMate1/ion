'use client';

/**
 * Wallet Overview Page
 * Total wealth, risk profile, upcoming payments calendar, earnings projection chart,
 * investment suggestions, and quick links to sub-sections.
 */

import Link from 'next/link';
import { useMemo } from 'react';
import { addDays, format, differenceInDays, startOfToday } from 'date-fns';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Wallet, Building2, TrendingUp, RefreshCw, AlertTriangle,
  CreditCard, PiggyBank, Landmark, Calendar, ChevronRight, Brain, FlaskConical, Star, Bitcoin, Repeat2,
} from 'lucide-react';
import { useWalletSummary, useWalletSubscriptions, useWalletSnapshots } from '@/hooks/use-wallet';

// ── Risk profile badge color mapping ─────────────────────────────────────────
const riskColors: Record<string, string> = {
  Conservative: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Moderate:     'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  Balanced:     'bg-green-500/15 text-green-400 border-green-500/30',
  Growth:       'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Aggressive:   'bg-purple-500/15 text-purple-400 border-purple-500/30',
};

// ── Wealth projection data builder ───────────────────────────────────────────
function buildProjection(totalWealth: number, monthlyObligations: number, dcaMonthly: number) {
  const now = new Date();
  const YEARS = 10;
  const CONSERVATIVE_RETURN = 0.04; // 4% p.a.
  const OPTIMISTIC_RETURN   = 0.08; // 8% p.a.
  const annualExpenses = monthlyObligations * 12;
  const annualDCA      = dcaMonthly * 12;

  const points: { year: string; conservative: number; optimistic: number }[] = [];
  let cons = totalWealth;
  let opti = totalWealth;

  for (let y = 0; y <= YEARS; y++) {
    points.push({
      year: String(now.getFullYear() + y),
      conservative: Math.round(cons),
      optimistic:   Math.round(opti),
    });
    cons = cons * (1 + CONSERVATIVE_RETURN) + annualDCA - annualExpenses;
    opti = opti * (1 + OPTIMISTIC_RETURN)   + annualDCA - annualExpenses;
    if (cons < 0) cons = 0;
    if (opti < 0) opti = 0;
  }
  return points;
}

// ── Payment calendar (next 30 days) ──────────────────────────────────────────
function PaymentCalendar({ subscriptions }: { subscriptions: any[] }) {
  const today = startOfToday();
  const days  = Array.from({ length: 30 }, (_, i) => addDays(today, i));

  const paymentsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const sub of subscriptions.filter(s => s.is_active)) {
      const dateStr = sub.next_payment_date;
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(sub);
    }
    return map;
  }, [subscriptions]);

  // Upcoming within 7 days alerts
  const urgent = subscriptions.filter(s => {
    if (!s.is_active) return false;
    const diff = differenceInDays(new Date(s.next_payment_date), today);
    return diff >= 0 && diff <= 7;
  });

  return (
    <div className="space-y-3">
      {urgent.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <strong>Upcoming payments:</strong>{' '}
            {urgent.map(s => (
              <span key={s.id}>
                {s.name} ({format(new Date(s.next_payment_date), 'MMM d')})
                {' — '}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 30-day strip (7-column weeks) */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="text-[9px] text-muted-foreground/50 font-medium pb-1">{d}</div>
        ))}
        {/* Offset first day */}
        {Array.from({ length: today.getDay() }).map((_, i) => <div key={`pad-${i}`} />)}
        {days.map((day) => {
          const key  = format(day, 'yyyy-MM-dd');
          const subs = paymentsByDate[key] ?? [];
          const isToday = differenceInDays(day, today) === 0;
          return (
            <div key={key} className={`relative flex flex-col items-center py-1 rounded-lg text-[10px]
              ${isToday ? 'bg-primary/20 text-primary font-bold' : 'text-muted-foreground'}`}
            >
              {format(day, 'd')}
              {subs.length > 0 && (
                <div className="mt-0.5 flex gap-0.5 flex-wrap justify-center">
                  {subs.slice(0, 3).map((_, idx) => (
                    <div key={idx} className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {subscriptions.filter(s => s.is_active).length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-400 mr-1 align-middle" />
          Dots indicate payment due dates
        </p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WalletPage() {
  const { data: summary, isLoading: summaryLoading } = useWalletSummary();
  const { data: subsData }                           = useWalletSubscriptions();
  const { data: snapshotsData }                      = useWalletSnapshots();

  const subs      = subsData?.subscriptions ?? [];
  const snapshots = snapshotsData?.snapshots ?? [];

  const totalWealth        = summary?.totalWealth        ?? 0;
  const bankTotal          = summary?.bankTotal          ?? 0;
  const assetTotal         = summary?.assetTotal         ?? 0;
  const pensionTotal       = summary?.pensionTotal       ?? 0;
  const cryptoTotal        = summary?.cryptoTotal        ?? 0;
  const dcaWealthTotal     = summary?.dcaWealthTotal     ?? 0;
  const monthlyObligations = summary?.monthlyObligations ?? 0;
  const dcaMonthly         = summary?.dcaMonthly         ?? 0;
  const riskProfile       = summary?.riskProfile       ?? { label: '—', description: '—' };
  const models            = summary?.models            ?? { coachReturn: 0, fineTuneReturn: 0, bestModel: '—' };

  const projection = useMemo(() => buildProjection(totalWealth, monthlyObligations, dcaMonthly), [totalWealth, monthlyObligations, dcaMonthly]);

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="space-y-5 pb-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl icon-glow-purple">
          <Wallet className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold gradient-text-primary">Wallet</h1>
          <p className="text-sm text-muted-foreground">Total wealth, risk profile & investment outlook</p>
        </div>
      </div>

      {summaryLoading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* ── Total Wealth Hero ──────────────────────────────────────── */}
          <Card className="wallet-card-hero border-white/[0.06]">
            <CardContent className="pt-6">
              <div className="text-center space-y-1 mb-5">
                <p className="text-sm text-muted-foreground">Total Net Wealth</p>
                <p className="text-5xl font-bold gradient-text-primary">${fmt(totalWealth)}</p>
                <p className="text-[10px] text-muted-foreground/60">All amounts converted to USD</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center sm:grid-cols-5">
                <div className="space-y-0.5">
                  <div className="flex items-center justify-center gap-1 text-blue-400">
                    <Building2 className="h-3.5 w-3.5" /><span className="text-xs">Bank</span>
                  </div>
                  <p className="font-semibold">${fmt(bankTotal)}</p>
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center justify-center gap-1 text-green-400">
                    <PiggyBank className="h-3.5 w-3.5" /><span className="text-xs">Assets</span>
                  </div>
                  <p className="font-semibold">${fmt(assetTotal)}</p>
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center justify-center gap-1 text-amber-400">
                    <Landmark className="h-3.5 w-3.5" /><span className="text-xs">Pension</span>
                  </div>
                  <p className="font-semibold">${fmt(pensionTotal)}</p>
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center justify-center gap-1 text-orange-400">
                    <Bitcoin className="h-3.5 w-3.5" /><span className="text-xs">Crypto</span>
                  </div>
                  <p className="font-semibold">${fmt(cryptoTotal)}</p>
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center justify-center gap-1 text-indigo-400">
                    <Repeat2 className="h-3.5 w-3.5" /><span className="text-xs">DCA</span>
                  </div>
                  <p className="font-semibold">${fmt(dcaWealthTotal)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Risk Profile ───────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Risk Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={`text-sm px-3 py-1 ${riskColors[riskProfile.label] ?? ''}`}>
                  {riskProfile.label}
                </Badge>
                <p className="text-xs text-muted-foreground flex-1">{riskProfile.description}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Monthly obligations: <span className="font-medium text-foreground">${monthlyObligations.toFixed(0)}</span>
              </p>
            </CardContent>
          </Card>

          {/* ── Upcoming Payments Calendar ─────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-amber-400" />
                  Upcoming Payments
                </CardTitle>
                <Link href="/wallet/subscriptions">
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                    Manage <ChevronRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
              <CardDescription>Next 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              {subs.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No subscriptions added yet.
                </div>
              ) : (
                <PaymentCalendar subscriptions={subs} />
              )}
            </CardContent>
          </Card>

          {/* ── Expected Earnings Chart ────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-400" />
                Wealth Projection (10 Years)
              </CardTitle>
              <CardDescription>
                Conservative (4%) vs Optimistic (8%), net of expenses{dcaMonthly > 0 && ` + $${Math.round(dcaMonthly).toLocaleString()}/mo DCA`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {totalWealth === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Add your bank accounts, assets, and pension to see your projection.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={projection} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                    <defs>
                      <linearGradient id="gradCons" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#60A5FA" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#60A5FA" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradOpti" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#8B5CF6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#888' }} />
                    <YAxis
                      tickFormatter={v => `$${v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`}
                      tick={{ fontSize: 9, fill: '#888' }}
                      width={55}
                    />
                    <Tooltip
                      formatter={(v: number) => [`$${v.toLocaleString()}`, undefined]}
                      contentStyle={{ background: 'oklch(0.13 0.03 270)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Area type="monotone" dataKey="conservative" name="Conservative" stroke="#60A5FA" fill="url(#gradCons)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="optimistic"   name="Optimistic"   stroke="#8B5CF6" fill="url(#gradOpti)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* ── Investment Suggestions ─────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-400" />
                Investment Suggestions
              </CardTitle>
              <CardDescription>Based on your {riskProfile.label} risk profile and app model performance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  label: 'Trading Coach',
                  icon: Brain,
                  href: '/coach',
                  badge: models.coachReturn !== 0 ? `${models.coachReturn >= 0 ? '+' : ''}${models.coachReturn.toFixed(1)}%` : null,
                  badgeColor: models.coachReturn >= 0 ? 'text-green-400' : 'text-red-400',
                  color: 'text-blue-400',
                  desc: models.coachReturn > 0
                    ? `Up ${models.coachReturn.toFixed(1)}% overall. ${riskProfile.label === 'Conservative' || riskProfile.label === 'Moderate' ? 'Consider allocating a small portion (5–10%).' : 'Well-suited for your growth profile.'}`
                    : 'Run Coach analysis to see performance.',
                },
                {
                  label: 'Fine-Tune Model',
                  icon: FlaskConical,
                  href: '/coach/fine-tune',
                  badge: models.fineTuneReturn !== 0 ? `${models.fineTuneReturn >= 0 ? '+' : ''}${models.fineTuneReturn.toFixed(1)}%` : null,
                  badgeColor: models.fineTuneReturn >= 0 ? 'text-green-400' : 'text-red-400',
                  color: 'text-pink-400',
                  desc: models.fineTuneReturn > 0
                    ? `Up ${models.fineTuneReturn.toFixed(1)}% overall. Pharma-sector specialist — diversifies industry exposure.`
                    : 'Run Fine-Tune analysis to see performance.',
                },
                {
                  label: 'DCA Plans',
                  icon: Repeat2,
                  href: '/wallet/dca',
                  badge: dcaMonthly > 0 ? `$${Math.round(dcaMonthly).toLocaleString()}/mo` : null,
                  badgeColor: 'text-indigo-400',
                  color: 'text-indigo-400',
                  desc: dcaMonthly > 0
                    ? `Investing $${Math.round(dcaMonthly).toLocaleString()}/mo via DCA. Projected to grow significantly over 10 years.`
                    : 'Set up Dollar-Cost Averaging plans to invest a fixed amount every month.',
                },
              ].map(({ label, icon: Icon, href, badge, badgeColor, color, desc }) => (
                <Link key={href} href={href}>
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-white/[0.06] hover:bg-white/[0.03] transition-colors cursor-pointer">
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{label}</span>
                        {badge && <span className={`text-xs font-mono ${badgeColor}`}>{badge}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  </div>
                </Link>
              ))}
              {models.bestModel !== '—' && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  Best model: <span className="text-foreground font-medium">{models.bestModel}</span>
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── Quick Links ────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: '/wallet/accounts',     icon: Building2,  label: 'Bank Accounts',    sub: 'Accounts & extracts',      color: 'text-blue-400' },
              { href: '/wallet/assets',       icon: PiggyBank,  label: 'Savings & Assets', sub: 'Investments & deposits',  color: 'text-green-400' },
              { href: '/wallet/pensions',     icon: Landmark,   label: 'Pensions',          sub: 'Retirement accounts',     color: 'text-amber-400' },
              { href: '/wallet/subscriptions',icon: CreditCard, label: 'Subscriptions',     sub: 'Recurring payments',      color: 'text-purple-400' },
              { href: '/wallet/crypto',       icon: Bitcoin,    label: 'Crypto',             sub: 'Digital asset holdings', color: 'text-orange-400' },
              { href: '/wallet/dca',          icon: Repeat2,    label: 'DCA Plans',          sub: 'Monthly investing',      color: 'text-indigo-400' },
            ].map(({ href, icon: Icon, label, sub, color }) => (
              <Link key={href} href={href}>
                <Card className="hover:bg-white/[0.03] transition-colors cursor-pointer h-full">
                  <CardContent className="pt-4 pb-4 flex items-center gap-3">
                    <Icon className={`h-5 w-5 shrink-0 ${color}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">{label}</p>
                      <p className="text-xs text-muted-foreground truncate">{sub}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
