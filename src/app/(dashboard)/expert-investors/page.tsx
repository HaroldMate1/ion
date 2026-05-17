'use client';

/**
 * Expert Investors Page
 * Track and compare portfolios of the world's top investors
 */

import { useState } from 'react';
import { toast } from 'sonner';
import {
  useExpertPortfolios,
  useExpertPortfolio,
  useInitializeExpertPortfolio,
  useResetExpertPortfolio,
  useExpertActivity,
  type ExpertActivityItem,
} from '@/hooks/use-expert-portfolios';
import { type InvestorSlug } from '@/config/expert-investors';
import { Button } from '@/components/ui/button';
import {
  Crown, TrendingUp, TrendingDown, RefreshCw, Wallet, PieChart, Play,
  DollarSign, Percent, Calendar, Database, User, Users,
  ArrowUpRight, ArrowDownRight, Zap, Clock, Activity, RotateCcw, Sparkles,
} from 'lucide-react';

const INVESTOR_COLORS: Record<InvestorSlug, string> = {
  buffett:       'bg-blue-600',
  marks:         'bg-slate-600',
  smith:         'bg-teal-600',
  druckenmiller: 'bg-violet-600',
  greenblatt:    'bg-indigo-600',
  dalio:         'bg-emerald-600',
  hempton:       'bg-cyan-600',
  asness:        'bg-rose-600',
  burry:         'bg-amber-600',
  pabrai:        'bg-orange-600',
  pelosi:        'bg-pink-600',
  wood:          'bg-fuchsia-600',
};

const INVESTOR_INITIALS: Record<InvestorSlug, string> = {
  buffett: 'WB', marks: 'HM', smith: 'TS', druckenmiller: 'SD',
  greenblatt: 'JG', dalio: 'RD', hempton: 'JH', asness: 'CA',
  burry: 'MB', pabrai: 'MP', pelosi: 'NP', wood: 'CW',
};

const SEC_TRACKED: ReadonlySet<InvestorSlug> = new Set([
  'buffett', 'druckenmiller', 'asness', 'burry', 'pabrai', 'marks', 'greenblatt',
  'dalio', 'hempton', 'smith',
]);

const UPDATE_FREQUENCY: Record<InvestorSlug, { label: string; className: string; icon: 'zap' | 'clock' | 'calendar' }> = {
  wood:          { label: 'Daily',     className: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30', icon: 'zap' },
  pelosi:        { label: '~Weekly',   className: 'text-blue-400 bg-blue-500/15 border-blue-500/30',         icon: 'clock' },
  buffett:       { label: 'Quarterly', className: 'text-amber-400 bg-amber-500/15 border-amber-500/30',      icon: 'calendar' },
  marks:         { label: 'Quarterly', className: 'text-amber-400 bg-amber-500/15 border-amber-500/30',      icon: 'calendar' },
  druckenmiller: { label: 'Quarterly', className: 'text-amber-400 bg-amber-500/15 border-amber-500/30',      icon: 'calendar' },
  greenblatt:    { label: 'Quarterly', className: 'text-amber-400 bg-amber-500/15 border-amber-500/30',      icon: 'calendar' },
  asness:        { label: 'Quarterly', className: 'text-amber-400 bg-amber-500/15 border-amber-500/30',      icon: 'calendar' },
  burry:         { label: 'Quarterly', className: 'text-amber-400 bg-amber-500/15 border-amber-500/30',      icon: 'calendar' },
  pabrai:        { label: 'Quarterly', className: 'text-amber-400 bg-amber-500/15 border-amber-500/30',      icon: 'calendar' },
  dalio:         { label: 'Quarterly', className: 'text-amber-400 bg-amber-500/15 border-amber-500/30',      icon: 'calendar' },
  hempton:       { label: 'Quarterly', className: 'text-amber-400 bg-amber-500/15 border-amber-500/30',      icon: 'calendar' },
  smith:         { label: 'Quarterly', className: 'text-amber-400 bg-amber-500/15 border-amber-500/30',      icon: 'calendar' },
};

function FreqIcon({ icon }: { icon: 'zap' | 'clock' | 'calendar' }) {
  if (icon === 'zap')    return <Zap      className="h-2.5 w-2.5" />;
  if (icon === 'clock')  return <Clock    className="h-2.5 w-2.5" />;
  return                        <Calendar className="h-2.5 w-2.5" />;
}

function relativeDate(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)  return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getNextExpectedUpdate(investorSlug: InvestorSlug): { label: string; date: string | null } {
  if (investorSlug === 'wood')   return { label: 'Next trading day', date: null };
  if (investorSlug === 'pelosi') return { label: 'When next PTR is filed (~45 day lag)', date: null };
  const now = new Date();
  const year = now.getFullYear();
  const deadlines = [
    { q: 'Q4 ' + (year - 1), date: new Date(year, 1, 14) },
    { q: 'Q1 ' + year,       date: new Date(year, 4, 15) },
    { q: 'Q2 ' + year,       date: new Date(year, 7, 14) },
    { q: 'Q3 ' + year,       date: new Date(year, 10, 14) },
    { q: 'Q4 ' + year,       date: new Date(year + 1, 1, 14) },
  ];
  for (const dl of deadlines) {
    if (dl.date > now) return {
      label: `~${dl.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (${dl.q} filing)`,
      date: dl.date.toISOString().split('T')[0],
    };
  }
  return { label: `~May 15, ${year + 1}`, date: null };
}

export default function ExpertInvestorsPage() {
  const [activeTab, setActiveTab]           = useState<InvestorSlug>('buffett');
  const [confirmResetId, setConfirmResetId] = useState<string | null>(null);
  const { data: portfoliosData, isLoading: listLoading } = useExpertPortfolios();
  const initializePortfolio = useInitializeExpertPortfolio();
  const resetPortfolio      = useResetExpertPortfolio();

  const portfolios     = portfoliosData?.portfolios || [];
  const crossHoldings: Record<string, Array<{ investorSlug: string; displayName: string; allocationPct: number }>> =
    (portfoliosData as any)?.crossHoldings || {};
  const selectedPortfolio   = portfolios.find(p => p.investorSlug === activeTab);
  const selectedPortfolioId = selectedPortfolio?.id || null;

  const { data: detailData, isLoading: detailLoading } = useExpertPortfolio(
    selectedPortfolio?.isInitialized ? selectedPortfolioId : null
  );
  const { data: activityData } = useExpertActivity(undefined, 90);

  const handleInitialize = async (slug: InvestorSlug) => {
    try {
      const result = await initializePortfolio.mutateAsync(slug);
      if (result.success) {
        toast.success(`Portfolio initialized with ${result.holdingsCreated} holdings`);
        if (result.errors?.length > 0) result.errors.forEach((err: string) => toast.warning(err));
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to initialize portfolio');
    }
  };

  const handleReset = async (id: string) => {
    try {
      await resetPortfolio.mutateAsync(id);
      toast.success('Portfolio reset — you can now re-initialize it');
      setConfirmResetId(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset portfolio');
    }
  };

  if (listLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
          <div className="absolute inset-2 rounded-full border border-primary/30 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="py-4 md:py-6 space-y-6 px-1 md:px-0">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-2 mb-1">
          <div className="icon-glow-amber p-2 rounded-xl">
            <Crown className="h-5 w-5 text-amber-400" />
          </div>
          <Sparkles className="h-3.5 w-3.5 text-primary/60" />
          <span className="text-xs font-medium text-muted-foreground tracking-widest uppercase">Live Portfolios</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold gradient-text">Expert Investors</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track portfolios of the world&apos;s top investors with $100,000 simulated portfolios. Prices update live.
        </p>
      </div>

      {/* ── Investor Selector Cards ──────────────────────────────────────── */}
      <div className="animate-fade-in-up delay-100 grid gap-2.5 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
        {portfolios.map((portfolio, i) => (
          <button
            key={portfolio.investorSlug}
            onClick={() => setActiveTab(portfolio.investorSlug)}
            className={`
              text-left rounded-2xl p-3 transition-all duration-250 animate-fade-in-up
              ${activeTab === portfolio.investorSlug
                ? 'glass-card border-primary/30 shadow-[0_0_20px_oklch(0.68_0.26_265/15%)]'
                : 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.10]'
              }
            `}
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-full ${INVESTOR_COLORS[portfolio.investorSlug]} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-lg`}>
                {INVESTOR_INITIALS[portfolio.investorSlug]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{portfolio.displayName}</p>
                <p className="text-[9px] text-muted-foreground leading-tight truncate">{portfolio.title}</p>
              </div>
            </div>
            {portfolio.isInitialized ? (
              <>
                <p className="text-sm font-bold">
                  ${portfolio.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className={`text-xs font-semibold ${portfolio.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {portfolio.totalReturnPct >= 0 ? '+' : ''}{portfolio.totalReturnPct.toFixed(2)}%
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Not initialized</p>
            )}
            {(() => {
              const freq = UPDATE_FREQUENCY[portfolio.investorSlug];
              return (
                <span className={`inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded border mt-1.5 ${freq.className}`}>
                  <FreqIcon icon={freq.icon} />
                  {freq.label}
                </span>
              );
            })()}
          </button>
        ))}
      </div>

      {/* ── Selected Investor Detail ──────────────────────────────────────── */}
      {(() => {
        const portfolio = portfolios.find(p => p.investorSlug === activeTab);
        if (!portfolio) return null;

        return !portfolio.isInitialized ? (
          <UninitializedCard
            portfolio={portfolio}
            slug={activeTab}
            onInitialize={handleInitialize}
            isPending={initializePortfolio.isPending}
          />
        ) : (
          <>
            <div className="flex justify-end">
              {confirmResetId === portfolio.id ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground text-xs">Reset all data and start fresh?</span>
                  <Button size="sm" variant="destructive" onClick={() => handleReset(portfolio.id)} disabled={resetPortfolio.isPending}>
                    {resetPortfolio.isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Yes, reset'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirmResetId(null)} disabled={resetPortfolio.isPending}>Cancel</Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => setConfirmResetId(portfolio.id)}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Restart Portfolio
                </Button>
              )}
            </div>
            <InvestorPortfolioDetail
              portfolio={detailData?.portfolio}
              isLoading={detailLoading}
              color={INVESTOR_COLORS[activeTab]}
              crossHoldings={crossHoldings}
              investorSlug={activeTab}
            />
          </>
        );
      })()}

      {/* ── Recent Activity Feed ─────────────────────────────────────────── */}
      <div className="glass-card card-gradient-border rounded-2xl p-5 animate-fade-in-up delay-300">
        <div className="flex items-center gap-2 mb-1">
          <div className="icon-glow-blue p-1.5 rounded-lg">
            <Activity className="h-4 w-4 text-blue-300" />
          </div>
          <h2 className="text-base font-bold">Recent Activity</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Wood (daily ARK CSV) · Pelosi (House disclosures) · All others (SEC EDGAR 13F, quarterly)
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            Last sync: {activityData?.lastUpdated ? formatDate(activityData.lastUpdated) : 'Never'}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
            Cron runs daily at 2 PM UTC
          </span>
        </div>
        <div className="text-xs text-muted-foreground bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 mb-3 leading-relaxed">
          <span className="font-medium text-foreground/70">Data freshness notice:</span>{' '}
          SEC 13F filings have a mandatory 45-day publication window after each quarter ends — holdings shown for quarterly investors may be up to ~135 days old.
        </div>
        {!activityData || activityData.activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>No recent activity detected yet.</p>
            <p className="text-xs mt-1">ARK and 13F holdings are checked daily at 2 PM UTC.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {activityData.activities.slice(0, 20).map((item: ExpertActivityItem) => {
              const isBuy = item.action === 'buy' || item.action === 'new_position' || item.action === 'increase';
              const slug = item.investorSlug as InvestorSlug;
              return (
                <div key={item.id} className="holding-row rounded-xl flex items-start gap-3 p-2.5">
                  <div className={`w-7 h-7 rounded-full ${INVESTOR_COLORS[slug] || 'bg-gray-500'} flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5`}>
                    {INVESTOR_INITIALS[slug] || '?'}
                  </div>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-1 ${isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                    {isBuy ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-semibold">{INVESTOR_INITIALS[item.investorSlug as InvestorSlug] || item.investorSlug}</span>
                      {' '}
                      <span className={isBuy ? 'text-emerald-400' : 'text-red-400'}>
                        {item.action === 'new_position' ? 'opened' : item.action === 'closed_position' ? 'closed' :
                         item.action === 'increase' ? 'increased' : item.action === 'decrease' ? 'reduced' : item.action}
                      </span>
                      {' '}
                      <span className="font-bold">{item.symbol}</span>
                      {item.newPct !== null && item.previousPct !== null && (
                        <span className="text-muted-foreground text-xs ml-1">({item.previousPct.toFixed(1)}% → {item.newPct.toFixed(1)}%)</span>
                      )}
                      {item.newPct !== null && item.previousPct === null && (
                        <span className="text-muted-foreground text-xs ml-1">({item.newPct.toFixed(1)}% of fund)</span>
                      )}
                      {item.amountRange && <span className="text-muted-foreground text-xs ml-1">{item.amountRange}</span>}
                    </p>
                    {item.assetName && item.assetName !== item.symbol && (
                      <p className="text-xs text-muted-foreground truncate">{item.assetName}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{relativeDate(item.eventDate)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Cross-Investor Holdings ───────────────────────────────────────── */}
      {Object.keys(crossHoldings).length > 0 && (
        <div className="glass-card card-gradient-border rounded-2xl p-5 animate-fade-in-up delay-400">
          <div className="flex items-center gap-2 mb-1">
            <div className="icon-glow-purple p-1.5 rounded-lg">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-base font-bold">Shared Holdings</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Stocks held by multiple investors — sorted by number of holders</p>
          <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
            {Object.entries(crossHoldings)
              .sort((a, b) => b[1].length - a[1].length)
              .map(([symbol, investors]) => (
                <div key={symbol} className="holding-row rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="icon-glow-purple px-2.5 py-1 rounded-lg">
                      <span className="text-xs font-bold text-primary">{symbol}</span>
                    </div>
                    <span className="badge-glow-purple text-xs font-semibold px-2 py-0.5 rounded-full">
                      {investors.length} investors
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {investors.map((inv) => (
                      <div key={inv.investorSlug} className="flex items-center gap-2 text-sm">
                        <div className={`w-5 h-5 rounded-full ${INVESTOR_COLORS[inv.investorSlug as InvestorSlug] || 'bg-gray-500'} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>
                          {INVESTOR_INITIALS[inv.investorSlug as InvestorSlug] || '?'}
                        </div>
                        <span className="text-muted-foreground flex-1 truncate text-xs">{inv.displayName}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="w-12 h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(inv.allocationPct, 100)}%`, background: 'linear-gradient(90deg, oklch(0.58 0.26 265), oklch(0.66 0.20 245))' }} />
                          </div>
                          <span className="text-xs font-medium w-10 text-right">{inv.allocationPct.toFixed(1)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UninitializedCard({ portfolio, slug, onInitialize, isPending }: {
  portfolio: any; slug: InvestorSlug; onInitialize: (slug: InvestorSlug) => void; isPending: boolean;
}) {
  return (
    <div className="glass-card card-gradient-border rounded-2xl p-5 animate-scale-in">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-full ${INVESTOR_COLORS[slug]} flex items-center justify-center text-white font-bold shadow-lg`}>
          {INVESTOR_INITIALS[slug]}
        </div>
        <div>
          <h2 className="text-base font-bold">{portfolio?.fullName}</h2>
          <p className="text-xs text-muted-foreground">{portfolio?.title}</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{portfolio?.description}</p>
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-2.5 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <PieChart className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium text-xs">Strategy:</span>
          <span className="text-muted-foreground text-xs">{portfolio?.strategy}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Database className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium text-xs">Data Source:</span>
          <span className="text-muted-foreground text-xs">{portfolio?.dataSource}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium text-xs">Last Filing:</span>
          <span className="text-muted-foreground text-xs">{portfolio?.lastUpdated}</span>
        </div>
        <p className="text-xs text-muted-foreground pt-1 border-t border-white/[0.05]">
          Initialize to simulate a $100,000 portfolio matching {portfolio?.displayName}&apos;s latest disclosed positions.
        </p>
      </div>
      <Button onClick={() => onInitialize(slug)} disabled={isPending} className="btn-shimmer text-white border-0">
        {isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
        Initialize Portfolio
      </Button>
    </div>
  );
}

function InvestorPortfolioDetail({ portfolio, isLoading, color, crossHoldings, investorSlug }: {
  portfolio: any; isLoading: boolean; color: string;
  crossHoldings: Record<string, Array<{ investorSlug: string; displayName: string; allocationPct: number }>>;
  investorSlug: InvestorSlug;
}) {
  const isAutoTracked = investorSlug === 'wood' || investorSlug === 'pelosi' || SEC_TRACKED.has(investorSlug);
  const is13F = SEC_TRACKED.has(investorSlug);
  const { data: investorActivity } = useExpertActivity(isAutoTracked ? investorSlug : undefined, is13F ? 90 : 30);

  if (isLoading || !portfolio) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
        </div>
      </div>
    );
  }

  const holdings    = portfolio.holdings || [];
  const totalInvested = holdings.reduce((s: number, h: any) => s + h.totalInvested, 0);
  const totalValue    = holdings.reduce((s: number, h: any) => s + (h.currentValue || h.totalInvested), 0);
  const totalPnL      = totalValue - totalInvested;
  const totalPnLPct   = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  return (
    <div className="space-y-4 animate-fade-in-up">

      {/* Investor info card */}
      <div className="glass-card card-gradient-border rounded-2xl p-4 md:p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full ${color} flex items-center justify-center text-white font-bold shrink-0 shadow-lg`}>
            <User className="h-5 w-5 md:h-6 md:w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base md:text-xl font-bold truncate">{portfolio.fullName}</h2>
            <p className="text-xs text-muted-foreground truncate">{portfolio.title}</p>
          </div>
          <span className="badge-glow-purple text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
            <RefreshCw className="h-2.5 w-2.5" /> Live prices
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">{portfolio.description}</p>
        <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1"><Database className="h-3 w-3 shrink-0" />{portfolio.dataSource}</div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 shrink-0" />Last:{' '}
            <span className="font-medium ml-1">{investorActivity?.lastUpdated ? formatDate(investorActivity.lastUpdated) : portfolio.lastUpdated}</span>
          </div>
          <div className="flex items-center gap-1 col-span-2">
            <Clock className="h-3 w-3 shrink-0" />Next:{' '}
            <span className="font-medium ml-1">{getNextExpectedUpdate(investorSlug).label}</span>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <div className="stat-card-purple rounded-2xl p-4 card-lift">
          <div className="icon-glow-purple p-2 rounded-xl w-fit mb-3"><Wallet className="h-4 w-4 text-primary" /></div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Value</p>
          <p className="text-xl font-bold mt-0.5">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-muted-foreground">Cash: ${portfolio.cashBalance.toFixed(2)}</p>
        </div>
        <div className="stat-card-blue rounded-2xl p-4 card-lift">
          <div className="icon-glow-blue p-2 rounded-xl w-fit mb-3"><DollarSign className="h-4 w-4 text-blue-300" /></div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Invested</p>
          <p className="text-xl font-bold mt-0.5">${totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="stat-card-emerald rounded-2xl p-4 card-lift">
          <div className="icon-glow-emerald p-2 rounded-xl w-fit mb-3">
            {totalPnL >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
          </div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Unrealized P&L</p>
          <p className={`text-xl font-bold mt-0.5 ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
          </p>
          <p className={`text-xs font-medium ${totalPnLPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalPnLPct >= 0 ? '+' : ''}{totalPnLPct.toFixed(2)}%
          </p>
        </div>
        <div className="stat-card-amber rounded-2xl p-4 card-lift">
          <div className="icon-glow-amber p-2 rounded-xl w-fit mb-3"><Percent className="h-4 w-4 text-amber-400" /></div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Return</p>
          <p className={`text-xl font-bold mt-0.5 ${portfolio.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {portfolio.totalReturnPct >= 0 ? '+' : ''}{portfolio.totalReturnPct.toFixed(2)}%
          </p>
          <p className="text-xs text-muted-foreground">Since inception</p>
        </div>
      </div>

      {/* Holdings */}
      <div className="glass-card card-gradient-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="icon-glow-purple p-1.5 rounded-lg"><PieChart className="h-4 w-4 text-primary" /></div>
          <div>
            <h3 className="text-sm font-bold">Portfolio Distribution ({holdings.length} holdings)</h3>
            <p className="text-xs text-muted-foreground">{portfolio.strategy}</p>
          </div>
        </div>
        <div className="space-y-2">
          {holdings.map((holding: any) => (
            <InvestorHoldingRow
              key={holding.id}
              holding={holding}
              totalValue={totalValue}
              otherInvestors={crossHoldings[holding.symbol]?.filter((inv: any) => inv.investorSlug !== portfolio.investorSlug) || []}
            />
          ))}
        </div>
      </div>

      {/* Per-investor recent trades */}
      {isAutoTracked && (
        <div className="glass-card card-gradient-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <div className="icon-glow-blue p-1.5 rounded-lg"><Activity className="h-4 w-4 text-blue-300" /></div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              Recent Trades
              <span className={`inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded border ${UPDATE_FREQUENCY[investorSlug].className}`}>
                <FreqIcon icon={UPDATE_FREQUENCY[investorSlug].icon} />{UPDATE_FREQUENCY[investorSlug].label}
              </span>
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            {investorSlug === 'wood' ? 'Detected changes from daily ARK Innovation ETF (ARKK) CSV'
             : investorSlug === 'pelosi' ? 'Detected from House periodic transaction reports (PTRs)'
             : 'Detected from SEC EDGAR 13F quarterly filing · 45-day publication delay applies'}
          </p>
          {is13F && (
            <div className="text-xs bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 mb-3">
              <span className="font-medium text-amber-400">45-day filing delay:</span>{' '}
              Holdings reflect what was reported — not necessarily current positions.
            </div>
          )}
          {!investorActivity || investorActivity.activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No changes detected yet — runs daily at 2 PM UTC.</p>
          ) : (
            <div className="space-y-1.5">
              {investorActivity.activities.slice(0, 10).map((item: ExpertActivityItem) => {
                const isBuy = item.action === 'buy' || item.action === 'new_position' || item.action === 'increase';
                return (
                  <div key={item.id} className="holding-row rounded-xl flex items-center gap-3 p-2.5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isBuy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                      {isBuy ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-semibold ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}>
                        {item.action === 'new_position' ? 'Opened' : item.action === 'closed_position' ? 'Closed' :
                         item.action === 'increase' ? 'Increased' : item.action === 'decrease' ? 'Reduced' :
                         item.action.charAt(0).toUpperCase() + item.action.slice(1)}
                      </span>
                      {' '}<span className="text-sm font-bold">{item.symbol}</span>
                      {item.newPct !== null && item.previousPct !== null && (
                        <span className="text-muted-foreground text-xs ml-1">{item.previousPct.toFixed(1)}% → {item.newPct.toFixed(1)}%</span>
                      )}
                      {item.amountRange && <span className="text-muted-foreground text-xs ml-1">{item.amountRange}</span>}
                      {item.assetName && item.assetName !== item.symbol && (
                        <p className="text-xs text-muted-foreground truncate">{item.assetName}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{relativeDate(item.eventDate)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InvestorHoldingRow({ holding, totalValue, otherInvestors }: {
  holding: any;
  totalValue: number;
  otherInvestors: Array<{ investorSlug: string; displayName: string; allocationPct: number }>;
}) {
  const value      = holding.currentValue || holding.totalInvested;
  const pnl        = holding.unrealizedPnL || 0;
  const pnlPct     = holding.unrealizedPnLPct || 0;
  const actualAlloc = totalValue > 0 ? (value / totalValue) * 100 : 0;

  return (
    <div className="holding-row rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="icon-glow-purple px-2.5 py-1 rounded-lg shrink-0">
            <span className="text-xs font-bold text-primary">{holding.symbol}</span>
          </div>
          <span className="badge-glow-blue text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0">{holding.assetType}</span>
        </div>
        <p className="font-semibold text-sm shrink-0">
          ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground truncate mr-2 text-xs">{holding.assetName}</p>
        <div className="shrink-0">
          <span className={`font-medium text-sm ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
          </span>
          <span className={`text-xs ml-1 ${pnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground w-20 shrink-0">{actualAlloc.toFixed(1)}% alloc</span>
        <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(actualAlloc, 100)}%`, background: 'linear-gradient(90deg, oklch(0.58 0.26 265), oklch(0.66 0.20 245))', boxShadow: '0 0 8px oklch(0.68 0.26 265 / 40%)' }} />
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">Target: {holding.targetAllocationPct.toFixed(1)}%</span>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{holding.quantity.toFixed(4)} shares @ ${holding.currentPrice?.toFixed(2) || holding.averageBuyPrice.toFixed(2)}</span>
        {otherInvestors.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground mr-0.5">Also:</span>
            {otherInvestors.map((inv) => (
              <div key={inv.investorSlug} title={`${inv.displayName}: ${inv.allocationPct.toFixed(1)}%`}
                className={`w-5 h-5 rounded-full ${INVESTOR_COLORS[inv.investorSlug as InvestorSlug] || 'bg-gray-500'} flex items-center justify-center text-white text-[8px] font-bold`}>
                {INVESTOR_INITIALS[inv.investorSlug as InvestorSlug] || '?'}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
