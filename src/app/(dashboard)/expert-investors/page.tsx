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
import { INVESTOR_SLUGS, type InvestorSlug } from '@/config/expert-investors';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Crown,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Wallet,
  PieChart,
  Play,
  DollarSign,
  Percent,
  Calendar,
  Database,
  User,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Clock,
  Activity,
  RotateCcw,
} from 'lucide-react';

const INVESTOR_COLORS: Record<InvestorSlug, string> = {
  buffett: 'bg-blue-600',
  marks: 'bg-slate-600',
  smith: 'bg-teal-600',
  druckenmiller: 'bg-violet-600',
  greenblatt: 'bg-indigo-600',
  dalio: 'bg-emerald-600',
  hempton: 'bg-cyan-600',
  asness: 'bg-rose-600',
  burry: 'bg-amber-600',
  pabrai: 'bg-orange-600',
  pelosi: 'bg-pink-600',
  wood: 'bg-fuchsia-600',
};

const INVESTOR_INITIALS: Record<InvestorSlug, string> = {
  buffett: 'WB',
  marks: 'HM',
  smith: 'TS',
  druckenmiller: 'SD',
  greenblatt: 'JG',
  dalio: 'RD',
  hempton: 'JH',
  asness: 'CA',
  burry: 'MB',
  pabrai: 'MP',
  pelosi: 'NP',
  wood: 'CW',
};

// Investors tracked automatically via SEC EDGAR 13F filings
const SEC_TRACKED: ReadonlySet<InvestorSlug> = new Set([
  'buffett', 'druckenmiller', 'asness', 'burry', 'pabrai', 'marks', 'greenblatt',
  'dalio', 'hempton', 'smith',
]);

const UPDATE_FREQUENCY: Record<InvestorSlug, { label: string; className: string; icon: 'zap' | 'clock' | 'calendar' }> = {
  wood:          { label: 'Daily',      className: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',  icon: 'zap' },
  pelosi:        { label: '~Weekly',    className: 'text-blue-400 bg-blue-500/15 border-blue-500/30',     icon: 'clock' },
  // Auto-quarterly: tracked via SEC EDGAR 13F (amber)
  buffett:       { label: 'Quarterly',  className: 'text-amber-400 bg-amber-500/15 border-amber-500/30',  icon: 'calendar' },
  marks:         { label: 'Quarterly',  className: 'text-amber-400 bg-amber-500/15 border-amber-500/30',  icon: 'calendar' },
  druckenmiller: { label: 'Quarterly',  className: 'text-amber-400 bg-amber-500/15 border-amber-500/30',  icon: 'calendar' },
  greenblatt:    { label: 'Quarterly',  className: 'text-amber-400 bg-amber-500/15 border-amber-500/30',  icon: 'calendar' },
  asness:        { label: 'Quarterly',  className: 'text-amber-400 bg-amber-500/15 border-amber-500/30',  icon: 'calendar' },
  burry:         { label: 'Quarterly',  className: 'text-amber-400 bg-amber-500/15 border-amber-500/30',  icon: 'calendar' },
  pabrai:        { label: 'Quarterly',  className: 'text-amber-400 bg-amber-500/15 border-amber-500/30',  icon: 'calendar' },
  dalio:         { label: 'Quarterly',  className: 'text-amber-400 bg-amber-500/15 border-amber-500/30',  icon: 'calendar' },
  hempton:       { label: 'Quarterly',  className: 'text-amber-400 bg-amber-500/15 border-amber-500/30',  icon: 'calendar' },
  smith:         { label: 'Quarterly',  className: 'text-amber-400 bg-amber-500/15 border-amber-500/30',  icon: 'calendar' },
};

function FreqIcon({ icon }: { icon: 'zap' | 'clock' | 'calendar' }) {
  if (icon === 'zap') return <Zap className="h-2.5 w-2.5" />;
  if (icon === 'clock') return <Clock className="h-2.5 w-2.5" />;
  return <Calendar className="h-2.5 w-2.5" />;
}

function relativeDate(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Compute the next expected data update for an investor based on their source type.
 * - ARK (wood): daily CSV → next trading day
 * - Pelosi: filed within 45 days of trade → unpredictable
 * - SEC 13F: quarter-end + 45 days deadline
 */
function getNextExpectedUpdate(investorSlug: InvestorSlug): { label: string; date: string | null } {
  if (investorSlug === 'wood') {
    return { label: 'Next trading day', date: null };
  }
  if (investorSlug === 'pelosi') {
    return { label: 'When next PTR is filed (~45 day lag)', date: null };
  }
  // SEC 13F: find the next quarter-end + 45 days that's in the future
  const now = new Date();
  const year = now.getFullYear();
  const deadlines = [
    { q: 'Q4 ' + (year - 1), date: new Date(year, 1, 14) },   // Q4 prev → ~Feb 14
    { q: 'Q1 ' + year,       date: new Date(year, 4, 15) },   // Q1 → ~May 15
    { q: 'Q2 ' + year,       date: new Date(year, 7, 14) },   // Q2 → ~Aug 14
    { q: 'Q3 ' + year,       date: new Date(year, 10, 14) },  // Q3 → ~Nov 14
    { q: 'Q4 ' + year,       date: new Date(year + 1, 1, 14) }, // Q4 → ~Feb 14 next year
  ];
  for (const dl of deadlines) {
    if (dl.date > now) {
      return {
        label: `~${dl.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (${dl.q} filing)`,
        date: dl.date.toISOString().split('T')[0],
      };
    }
  }
  return { label: `~May 15, ${year + 1}`, date: null };
}

export default function ExpertInvestorsPage() {
  const [activeTab, setActiveTab] = useState<InvestorSlug>('buffett');
  const [confirmResetId, setConfirmResetId] = useState<string | null>(null);
  const { data: portfoliosData, isLoading: listLoading } = useExpertPortfolios();
  const initializePortfolio = useInitializeExpertPortfolio();
  const resetPortfolio = useResetExpertPortfolio();

  const portfolios = portfoliosData?.portfolios || [];
  const crossHoldings: Record<string, Array<{ investorSlug: string; displayName: string; allocationPct: number }>> =
    (portfoliosData as any)?.crossHoldings || {};
  const selectedPortfolio = portfolios.find(p => p.investorSlug === activeTab);
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
        if (result.errors && result.errors.length > 0) {
          result.errors.forEach((err: string) => toast.warning(err));
        }
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
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 md:py-6 space-y-4 md:space-y-6 px-2 md:px-0">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Crown className="h-6 w-6 md:h-8 md:w-8" />
          Expert Investors
        </h1>
        <p className="text-muted-foreground">
          Track portfolios of the world&apos;s top investors with $100,000 simulated portfolios. Prices update live.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        {portfolios.map((portfolio) => (
          <Card
            key={portfolio.investorSlug}
            className={`cursor-pointer transition-all ${
              activeTab === portfolio.investorSlug ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setActiveTab(portfolio.investorSlug)}
          >
            <CardHeader className="p-3 pb-1">
              <div className="flex items-center gap-2">
                <div className={`w-10 h-10 rounded-full ${INVESTOR_COLORS[portfolio.investorSlug]} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                  {INVESTOR_INITIALS[portfolio.investorSlug]}
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-sm">{portfolio.displayName}</CardTitle>
                  <p className="text-[10px] text-muted-foreground leading-tight">{portfolio.title}</p>
                  {(() => {
                    const freq = UPDATE_FREQUENCY[portfolio.investorSlug];
                    return (
                      <span className={`inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded border mt-1 ${freq.className}`}>
                        <FreqIcon icon={freq.icon} />
                        {freq.label}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-1">
              {portfolio.isInitialized ? (
                <>
                  <div className="text-xl font-bold">
                    ${portfolio.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className={`text-sm ${portfolio.totalReturnPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {portfolio.totalReturnPct >= 0 ? '+' : ''}{portfolio.totalReturnPct.toFixed(2)}%
                  </p>
                </>
              ) : (
                <>
                  <div className="text-xl font-bold text-muted-foreground">$100,000</div>
                  <p className="text-sm text-muted-foreground">Not initialized</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Selected Investor Detail */}
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
            {/* Restart bar */}
            <div className="flex justify-end">
              {confirmResetId === portfolio.id ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Reset all data and start fresh?</span>
                  <Button size="sm" variant="destructive" onClick={() => handleReset(portfolio.id)} disabled={resetPortfolio.isPending}>
                    {resetPortfolio.isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Yes, reset'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirmResetId(null)} disabled={resetPortfolio.isPending}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setConfirmResetId(portfolio.id)}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Restart Portfolio
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

      {/* Recent Activity Feed */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>
            Wood (daily ARK CSV) · Pelosi (House disclosures) · All others (SEC EDGAR 13F, quarterly)
          </CardDescription>
          {/* Sync timing info */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              Last sync: {activityData?.lastUpdated ? formatDate(activityData.lastUpdated) : 'Never'}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <RefreshCw className="h-3 w-3" />
              Cron runs daily at 2 PM UTC
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {/* Data freshness disclaimer */}
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 mb-3 leading-relaxed">
            <span className="font-medium">Data freshness notice:</span>{' '}
            SEC 13F filings have a mandatory 45-day publication window after each quarter ends — holdings shown for quarterly investors may be up to ~135 days old and may not reflect current positions.
            ARK and congressional disclosures are tracked more frequently.
          </div>
          {!activityData || activityData.activities.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No recent activity detected yet.</p>
              <p className="text-xs mt-1">ARK and 13F holdings are checked daily at 2 PM UTC. First run will populate this feed.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activityData.activities.slice(0, 20).map((item: ExpertActivityItem) => {
                const isBuy = item.action === 'buy' || item.action === 'new_position' || item.action === 'increase';
                const slug = item.investorSlug as InvestorSlug;
                return (
                  <div key={item.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors">
                    {/* Investor avatar */}
                    <div className={`w-7 h-7 rounded-full ${INVESTOR_COLORS[slug] || 'bg-gray-400'} flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5`}>
                      {INVESTOR_INITIALS[slug] || '?'}
                    </div>
                    {/* Action icon */}
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-1 ${isBuy ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                      {isBuy
                        ? <ArrowUpRight className="h-3 w-3" />
                        : <ArrowDownRight className="h-3 w-3" />}
                    </div>
                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-semibold">{INVESTOR_INITIALS[item.investorSlug as InvestorSlug] || item.investorSlug}</span>
                        {' '}
                        <span className={isBuy ? 'text-green-600' : 'text-red-600'}>
                          {item.action === 'new_position' ? 'opened' :
                           item.action === 'closed_position' ? 'closed' :
                           item.action === 'increase' ? 'increased' :
                           item.action === 'decrease' ? 'reduced' :
                           item.action}
                        </span>
                        {' '}
                        <span className="font-bold">{item.symbol}</span>
                        {item.newPct !== null && item.previousPct !== null && (
                          <span className="text-muted-foreground text-xs ml-1">
                            ({item.previousPct.toFixed(1)}% → {item.newPct.toFixed(1)}%)
                          </span>
                        )}
                        {item.newPct !== null && item.previousPct === null && (
                          <span className="text-muted-foreground text-xs ml-1">
                            ({item.newPct.toFixed(1)}% of fund)
                          </span>
                        )}
                        {item.amountRange && (
                          <span className="text-muted-foreground text-xs ml-1">{item.amountRange}</span>
                        )}
                      </p>
                      {item.assetName && item.assetName !== item.symbol && (
                        <p className="text-xs text-muted-foreground truncate">{item.assetName}</p>
                      )}
                    </div>
                    {/* Date */}
                    <span className="text-xs text-muted-foreground shrink-0">{relativeDate(item.eventDate)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cross-Investor Holdings */}
      {Object.keys(crossHoldings).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5" />
              Shared Holdings
            </CardTitle>
            <CardDescription>
              Stocks held by multiple investors &mdash; sorted by number of holders
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
              {Object.entries(crossHoldings)
                .sort((a, b) => b[1].length - a[1].length)
                .map(([symbol, investors]) => (
                  <div key={symbol} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">{symbol}</span>
                      <Badge variant="secondary" className="text-xs">
                        {investors.length} investors
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {investors.map((inv) => (
                        <div key={inv.investorSlug} className="flex items-center gap-2 text-sm">
                          <div className={`w-5 h-5 rounded-full ${INVESTOR_COLORS[inv.investorSlug as InvestorSlug] || 'bg-gray-400'} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>
                            {INVESTOR_INITIALS[inv.investorSlug as InvestorSlug] || '?'}
                          </div>
                          <span className="text-muted-foreground flex-1 truncate">{inv.displayName}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <Progress value={inv.allocationPct} className="h-1.5 w-12" />
                            <span className="font-medium w-12 text-right">{inv.allocationPct.toFixed(1)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UninitializedCard({
  portfolio,
  slug,
  onInitialize,
  isPending,
}: {
  portfolio: any;
  slug: InvestorSlug;
  onInitialize: (slug: InvestorSlug) => void;
  isPending: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full ${INVESTOR_COLORS[slug]} flex items-center justify-center text-white text-xs font-bold`}>
            {INVESTOR_INITIALS[slug]}
          </div>
          {portfolio?.fullName}
        </CardTitle>
        <CardDescription>{portfolio?.title}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">{portfolio?.description}</p>
        <div className="bg-muted p-4 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <PieChart className="h-4 w-4" />
            <span className="font-medium">Strategy:</span> {portfolio?.strategy}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Database className="h-4 w-4" />
            <span className="font-medium">Data Source:</span> {portfolio?.dataSource}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4" />
            <span className="font-medium">Last Filing:</span> {portfolio?.lastUpdated}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Initialize to simulate a $100,000 portfolio matching {portfolio?.displayName}&apos;s latest disclosed positions.
            Prices update in real-time.
          </p>
        </div>
        <Button onClick={() => onInitialize(slug)} disabled={isPending}>
          {isPending ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Initialize Portfolio
        </Button>
      </CardContent>
    </Card>
  );
}

function InvestorPortfolioDetail({
  portfolio,
  isLoading,
  color,
  crossHoldings,
  investorSlug,
}: {
  portfolio: any;
  isLoading: boolean;
  color: string;
  crossHoldings: Record<string, Array<{ investorSlug: string; displayName: string; allocationPct: number }>>;
  investorSlug: InvestorSlug;
}) {
  const isAutoTracked = investorSlug === 'wood' || investorSlug === 'pelosi' || SEC_TRACKED.has(investorSlug);
  const is13F = SEC_TRACKED.has(investorSlug);
  const { data: investorActivity } = useExpertActivity(isAutoTracked ? investorSlug : undefined, is13F ? 90 : 30);
  if (isLoading || !portfolio) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const holdings = portfolio.holdings || [];
  const totalInvested = holdings.reduce((sum: number, h: any) => sum + h.totalInvested, 0);
  const totalValue = holdings.reduce((sum: number, h: any) => sum + (h.currentValue || h.totalInvested), 0);
  const totalPnL = totalValue - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Investor Info */}
      <Card>
        <CardContent className="p-3 md:pt-4 md:px-6">
          <div className="flex flex-col gap-3">
            {/* Name + title row */}
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full ${color} flex items-center justify-center text-white font-bold shrink-0`}>
                <User className="h-5 w-5 md:h-6 md:w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base md:text-xl font-bold truncate">{portfolio.fullName}</h2>
                <p className="text-xs md:text-sm text-muted-foreground truncate">{portfolio.title}</p>
              </div>
            </div>
            {/* Description */}
            <p className="text-xs md:text-sm text-muted-foreground">{portfolio.description}</p>
            {/* Data source info - grid on mobile */}
            <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:gap-3">
              <div className="flex items-center gap-1 text-[11px] md:text-xs text-muted-foreground">
                <Database className="h-3 w-3 shrink-0" />
                <span className="truncate">{portfolio.dataSource}</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] md:text-xs">
                <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Last:</span>{' '}
                <span className="font-medium truncate">
                  {investorActivity?.lastUpdated
                    ? formatDate(investorActivity.lastUpdated)
                    : portfolio.lastUpdated}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] md:text-xs col-span-2">
                <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Next:</span>{' '}
                <span className="font-medium truncate">{getNextExpectedUpdate(investorSlug).label}</span>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] md:text-xs w-fit">
              <RefreshCw className="h-3 w-3 mr-1" />
              Prices refresh every 60s
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Total Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Cash: ${portfolio.cashBalance.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Invested
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {totalPnL >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              Unrealized P&L
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
            </div>
            <p className={`text-sm ${totalPnLPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {totalPnLPct >= 0 ? '+' : ''}{totalPnLPct.toFixed(2)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Total Return
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${portfolio.totalReturnPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {portfolio.totalReturnPct >= 0 ? '+' : ''}{portfolio.totalReturnPct.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">Since inception</p>
          </CardContent>
        </Card>
      </div>

      {/* Holdings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Portfolio Distribution ({holdings.length} holdings)
          </CardTitle>
          <CardDescription>
            {portfolio.strategy}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {holdings.map((holding: any) => (
              <InvestorHoldingRow
                key={holding.id}
                holding={holding}
                totalValue={totalValue}
                otherInvestors={crossHoldings[holding.symbol]?.filter(
                  (inv: any) => inv.investorSlug !== portfolio.investorSlug
                ) || []}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Per-investor recent trades (auto-tracked investors only) */}
      {isAutoTracked && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5" />
              Recent Trades
              <span className={`inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded border ml-1 ${UPDATE_FREQUENCY[investorSlug].className}`}>
                <FreqIcon icon={UPDATE_FREQUENCY[investorSlug].icon} />
                {UPDATE_FREQUENCY[investorSlug].label}
              </span>
            </CardTitle>
            <CardDescription>
              {investorSlug === 'wood'
                ? 'Detected changes from daily ARK Innovation ETF (ARKK) CSV'
                : investorSlug === 'pelosi'
                ? 'Detected from House periodic transaction reports (PTRs)'
                : 'Detected from SEC EDGAR 13F quarterly filing · 45-day publication delay applies'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {is13F && (
              <div className="text-xs text-muted-foreground bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2 mb-3">
                <span className="font-medium text-amber-400">45-day filing delay:</span>{' '}
                SEC rules require 13F filings within 45 days of quarter-end. These holdings reflect what was reported — not necessarily current positions.
              </div>
            )}
            {!investorActivity || investorActivity.activities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No changes detected yet — runs daily at 2 PM UTC.
              </p>
            ) : (
              <div className="space-y-2">
                {investorActivity.activities.slice(0, 10).map((item: ExpertActivityItem) => {
                  const isBuy = item.action === 'buy' || item.action === 'new_position' || item.action === 'increase';
                  return (
                    <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isBuy ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                        {isBuy ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-semibold ${isBuy ? 'text-green-600' : 'text-red-600'}`}>
                          {item.action === 'new_position' ? 'Opened' :
                           item.action === 'closed_position' ? 'Closed' :
                           item.action === 'increase' ? 'Increased' :
                           item.action === 'decrease' ? 'Reduced' :
                           item.action.charAt(0).toUpperCase() + item.action.slice(1)}
                        </span>
                        {' '}
                        <span className="text-sm font-bold">{item.symbol}</span>
                        {item.newPct !== null && item.previousPct !== null && (
                          <span className="text-muted-foreground text-xs ml-1">
                            {item.previousPct.toFixed(1)}% → {item.newPct.toFixed(1)}%
                          </span>
                        )}
                        {item.amountRange && (
                          <span className="text-muted-foreground text-xs ml-1">{item.amountRange}</span>
                        )}
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InvestorHoldingRow({
  holding,
  totalValue,
  otherInvestors,
}: {
  holding: any;
  totalValue: number;
  otherInvestors: Array<{ investorSlug: string; displayName: string; allocationPct: number }>;
}) {
  const value = holding.currentValue || holding.totalInvested;
  const pnl = holding.unrealizedPnL || 0;
  const pnlPct = holding.unrealizedPnLPct || 0;
  const actualAlloc = totalValue > 0 ? (value / totalValue) * 100 : 0;

  return (
    <div className="p-3 border rounded-lg space-y-2">
      {/* Row 1: Symbol + allocation bar | Value + P&L */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-base">{holding.symbol}</span>
          <Badge variant="outline" className="text-xs shrink-0">{holding.assetType}</Badge>
        </div>
        <div className="text-right shrink-0">
          <p className="font-semibold">
            ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Row 2: Name | P&L */}
      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground truncate mr-2">{holding.assetName}</p>
        <div className="shrink-0">
          <span className={`font-medium ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
          </span>
          <span className={`text-xs ml-1 ${pnlPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
          </span>
        </div>
      </div>

      {/* Row 3: Allocation bar - prominent */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-24 shrink-0">
          {actualAlloc.toFixed(1)}% of portfolio
        </span>
        <Progress value={actualAlloc} className="h-2 flex-1" />
        <span className="text-xs text-muted-foreground shrink-0">
          Target: {holding.targetAllocationPct.toFixed(1)}%
        </span>
      </div>

      {/* Row 4: Quantity + price */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {holding.quantity.toFixed(4)} shares @ ${holding.currentPrice?.toFixed(2) || holding.averageBuyPrice.toFixed(2)}
        </span>
        {/* Other investors holding the same stock */}
        {otherInvestors.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Also held by:</span>
            {otherInvestors.map((inv) => (
              <div
                key={inv.investorSlug}
                title={`${inv.displayName}: ${inv.allocationPct.toFixed(1)}%`}
                className={`w-5 h-5 rounded-full ${INVESTOR_COLORS[inv.investorSlug as InvestorSlug] || 'bg-gray-400'} flex items-center justify-center text-white text-[8px] font-bold`}
              >
                {INVESTOR_INITIALS[inv.investorSlug as InvestorSlug] || '?'}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
