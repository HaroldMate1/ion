'use client';

/**
 * Prometheus — Pharma Regulatory Intelligence
 * Tracks FDA and EMA decisions on drug approvals/rejections in real time,
 * anticipates investor reactions, and surfaces investment signals.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FlaskConical, TrendingUp, TrendingDown, Clock, AlertTriangle,
  CheckCircle2, XCircle, ArrowLeft, BarChart3, Zap, Info, ExternalLink,
  ChevronDown, ChevronUp, Filter,
} from 'lucide-react';
import Link from 'next/link';
import type { RegulatoryDecision, InvestmentSignal, DecisionStatus } from '@/types/pharma.types';

// ── Data fetching ─────────────────────────────────────────────────────────────

interface PharmaApiResponse {
  decisions: RegulatoryDecision[];
  stats: {
    totalPending: number;
    totalApproved: number;
    totalRejected: number;
    strongBuyCount: number;
    buyCount: number;
  };
  nextUpcoming: RegulatoryDecision | null;
  dataAsOf: string;
}

async function fetchDecisions(params: Record<string, string>): Promise<PharmaApiResponse> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/pharma/decisions?${qs}`);
  if (!res.ok) throw new Error('Failed to fetch regulatory decisions');
  return res.json();
}

// ── Signal helpers ─────────────────────────────────────────────────────────────

const SIGNAL_CONFIG: Record<InvestmentSignal, {
  label: string; color: string; bg: string; border: string; icon: typeof TrendingUp;
}> = {
  strong_buy:  { label: 'Strong Buy',  color: 'text-emerald-300', bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', icon: TrendingUp },
  buy:         { label: 'Buy',         color: 'text-green-300',   bg: 'bg-green-500/15',   border: 'border-green-500/35',   icon: TrendingUp },
  hold:        { label: 'Hold',        color: 'text-amber-300',   bg: 'bg-amber-500/15',   border: 'border-amber-500/35',   icon: BarChart3 },
  watch:       { label: 'Watch',       color: 'text-blue-300',    bg: 'bg-blue-500/15',    border: 'border-blue-500/35',    icon: Clock },
  sell:        { label: 'Sell',        color: 'text-orange-300',  bg: 'bg-orange-500/15',  border: 'border-orange-500/35',  icon: TrendingDown },
  strong_sell: { label: 'Strong Sell', color: 'text-rose-300',    bg: 'bg-rose-500/20',    border: 'border-rose-500/40',    icon: TrendingDown },
};

const STATUS_CONFIG: Record<DecisionStatus, {
  label: string; color: string; bg: string; icon: typeof CheckCircle2;
}> = {
  approved:    { label: 'Approved',    color: 'text-emerald-300', bg: 'bg-emerald-500/20', icon: CheckCircle2 },
  rejected:    { label: 'Rejected',    color: 'text-rose-300',    bg: 'bg-rose-500/20',    icon: XCircle },
  crl:         { label: 'CRL',         color: 'text-orange-300',  bg: 'bg-orange-500/20',  icon: AlertTriangle },
  withdrawn:   { label: 'Withdrawn',   color: 'text-gray-400',    bg: 'bg-gray-500/15',    icon: XCircle },
  deferred:    { label: 'Deferred',    color: 'text-yellow-300',  bg: 'bg-yellow-500/15',  icon: Clock },
  adcom_held:  { label: 'AdCom Held',  color: 'text-blue-300',    bg: 'bg-blue-500/15',    icon: Info },
  pending:     { label: 'Pending',     color: 'text-violet-300',  bg: 'bg-violet-500/15',  icon: Clock },
};

// ── Countdown helper ──────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr).getTime();
  const now = new Date().getTime();
  return Math.max(0, Math.ceil((target - now) / (1000 * 60 * 60 * 24)));
}

function formatCountdown(dateStr: string): string {
  const days = daysUntil(dateStr);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 30) return `${days}d away`;
  if (days < 365) return `${Math.round(days / 30)}mo away`;
  return `${Math.round(days / 365)}yr away`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SignalBadge({ signal }: { signal: InvestmentSignal }) {
  const cfg = SIGNAL_CONFIG[signal];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: DecisionStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function RegulatoryBodyBadge({ body }: { body: 'FDA' | 'EMA' }) {
  return (
    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
      body === 'FDA'
        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
        : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
    }`}>
      {body}
    </span>
  );
}

function RiskBadge({ risk }: { risk: 'high' | 'medium' | 'low' }) {
  const cfg = {
    high:   { label: 'High Risk',   color: 'text-rose-400',   bg: 'bg-rose-500/10' },
    medium: { label: 'Medium Risk', color: 'text-amber-400',  bg: 'bg-amber-500/10' },
    low:    { label: 'Low Risk',    color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  }[risk];
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function DesignationTags({ d }: { d: RegulatoryDecision }) {
  const tags = [
    d.breakthroughTherapy && { label: 'BTD', title: 'Breakthrough Therapy Designation', color: 'text-violet-300 border-violet-500/30' },
    d.priorityReview      && { label: 'PR',  title: 'Priority Review',                  color: 'text-blue-300   border-blue-500/30' },
    d.fastTrack           && { label: 'FT',  title: 'Fast Track Designation',            color: 'text-cyan-300   border-cyan-500/30' },
    d.orphanDrug          && { label: 'OD',  title: 'Orphan Drug Designation',           color: 'text-amber-300  border-amber-500/30' },
  ].filter(Boolean) as Array<{ label: string; title: string; color: string }>;

  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map(t => (
        <span
          key={t.label}
          title={t.title}
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${t.color} bg-white/5`}
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}

function StockReaction({ pct }: { pct: number }) {
  const isPos = pct >= 0;
  return (
    <span className={`flex items-center gap-0.5 text-sm font-bold ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
      {isPos ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {isPos ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

// ── Main Card ─────────────────────────────────────────────────────────────────

function DecisionCard({ d }: { d: RegulatoryDecision }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass-card card-gradient-border rounded-2xl overflow-hidden">
      {/* Header row */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <RegulatoryBodyBadge body={d.regulatoryBody} />
              <StatusBadge status={d.status} />
              <RiskBadge risk={d.riskLevel} />
            </div>
            <h3 className="text-base font-bold text-foreground leading-tight">
              {d.brandName !== 'TBD' && d.brandName !== 'N/A (CRL received)' ? d.brandName : d.genericName}
              {d.brandName !== 'TBD' && d.brandName !== 'N/A (CRL received)' && (
                <span className="text-muted-foreground text-sm font-normal ml-1.5">({d.genericName})</span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{d.drugClass}</p>
          </div>
          <div className="text-right shrink-0">
            {d.ticker && (
              <div className="text-sm font-bold text-foreground">{d.ticker}</div>
            )}
            <div className="text-xs text-muted-foreground">{d.company}</div>
          </div>
        </div>

        {/* Indication */}
        <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-2">
          {d.indication}
        </p>

        {/* Date + countdown / stock reaction */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="text-xs text-muted-foreground mb-0.5">
              {d.isPending ? 'PDUFA / Decision Date' : 'Decision Date'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{formatDate(d.actionDate)}</span>
              {d.isPending && (
                <span className="text-xs font-medium text-violet-300 bg-violet-500/15 px-2 py-0.5 rounded-full border border-violet-500/25">
                  {formatCountdown(d.actionDate)}
                </span>
              )}
            </div>
          </div>
          {d.stockReactionPercent !== undefined && !d.isPending && (
            <div className="text-right">
              <div className="text-xs text-muted-foreground mb-0.5">Stock Reaction</div>
              <StockReaction pct={d.stockReactionPercent} />
            </div>
          )}
          {d.peakSalesBillion && (
            <div className="text-right">
              <div className="text-xs text-muted-foreground mb-0.5">Peak Sales Est.</div>
              <span className="text-sm font-semibold text-foreground">${d.peakSalesBillion}B</span>
            </div>
          )}
        </div>

        {/* Designations */}
        <DesignationTags d={d} />

        {/* AdCom */}
        {d.adcom && !d.isPending && (
          <div className="mt-2 text-xs bg-white/5 rounded-lg px-2.5 py-1.5 border border-white/8">
            <span className="text-muted-foreground">AdCom {formatDate(d.adcom.date)}:</span>{' '}
            <span className={`font-semibold ${
              d.adcom.outcome === 'positive' ? 'text-emerald-300' :
              d.adcom.outcome === 'negative' ? 'text-rose-300' : 'text-amber-300'
            }`}>{d.adcom.vote}</span>
          </div>
        )}
        {d.adcom && d.isPending && (
          <div className="mt-2 text-xs bg-violet-500/10 rounded-lg px-2.5 py-1.5 border border-violet-500/20">
            <span className="text-muted-foreground">AdCom Scheduled:</span>{' '}
            <span className="text-violet-300 font-semibold">{formatDate(d.adcom.date)}</span>
          </div>
        )}
      </div>

      {/* Investment signal bar */}
      <div className={`px-4 py-2.5 border-t border-white/6 flex items-center justify-between gap-3 ${
        SIGNAL_CONFIG[d.investmentSignal].bg
      }`}>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {d.signalRationale}
          </p>
        </div>
        <div className="shrink-0">
          <SignalBadge signal={d.investmentSignal} />
        </div>
      </div>

      {/* Expand/collapse detail */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors border-t border-white/6"
      >
        {expanded ? (
          <><ChevronUp className="h-3 w-3" /> Less detail</>
        ) : (
          <><ChevronDown className="h-3 w-3" /> More detail</>
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/6 space-y-4 pt-4">
          {/* Patient population */}
          {d.patientPopulation && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Patient Population
              </h4>
              <p className="text-sm text-foreground">{d.patientPopulation}</p>
            </div>
          )}

          {/* Key drivers */}
          <div>
            <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
              Tailwinds
            </h4>
            <ul className="space-y-1">
              {d.keyDrivers.map((k, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="text-emerald-400 mt-0.5 shrink-0">+</span>
                  {k}
                </li>
              ))}
            </ul>
          </div>

          {/* Risk factors */}
          <div>
            <h4 className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-2">
              Risk Factors
            </h4>
            <ul className="space-y-1">
              {d.riskFactors.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="text-rose-400 mt-0.5 shrink-0">−</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>

          {/* Competitive landscape */}
          {d.competitiveLandscape && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Competitive Landscape
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{d.competitiveLandscape}</p>
            </div>
          )}

          {/* Analyst consensus */}
          {d.analystConsensus && (
            <div className="text-xs bg-white/5 rounded-lg px-3 py-2 border border-white/8">
              <span className="text-muted-foreground">Analyst View: </span>
              <span className="text-foreground">{d.analystConsensus}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="glass-card rounded-xl p-4 border border-white/8">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs font-medium text-foreground mt-0.5">{label}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Filters ───────────────────────────────────────────────────────────────────

const AREA_OPTIONS = [
  { value: 'all', label: 'All Areas' },
  { value: 'oncology', label: 'Oncology' },
  { value: 'cardiology', label: 'Cardiology' },
  { value: 'neurology', label: 'Neurology' },
  { value: 'metabolic', label: 'Metabolic' },
  { value: 'hematology', label: 'Hematology' },
  { value: 'immunology', label: 'Immunology' },
  { value: 'rare_disease', label: 'Rare Disease' },
  { value: 'other', label: 'Other' },
];

const SIGNAL_OPTIONS = [
  { value: 'all', label: 'All Signals' },
  { value: 'strong_buy', label: 'Strong Buy' },
  { value: 'buy', label: 'Buy' },
  { value: 'hold', label: 'Hold' },
  { value: 'watch', label: 'Watch' },
  { value: 'sell', label: 'Sell' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Upcoming' },
  { value: 'decided', label: 'Decided' },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PharmaIntelPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [bodyFilter, setBodyFilter]     = useState('all');
  const [areaFilter, setAreaFilter]     = useState('all');
  const [signalFilter, setSignalFilter] = useState('all');

  const queryParams = useMemo(() => ({
    status: statusFilter,
    body: bodyFilter,
    area: areaFilter,
    signal: signalFilter,
  }), [statusFilter, bodyFilter, areaFilter, signalFilter]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['pharma-decisions', queryParams],
    queryFn: () => fetchDecisions(queryParams),
    staleTime: 5 * 60 * 1000, // 5 min
  });

  const decisions = data?.decisions || [];
  const stats = data?.stats;
  const nextUp = data?.nextUpcoming;

  return (
    <div className="py-4 md:py-6 space-y-8 px-1 md:px-0 max-w-5xl">

      {/* ── Back link + Header ───────────────────────────────────────── */}
      <div>
        <Link
          href="/ai"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to AI Hub
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <div className="icon-glow-rose p-2.5 rounded-xl">
            <FlaskConical className="h-5 w-5 text-rose-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground tracking-widest uppercase">
                Regulatory Intelligence
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold gradient-text">Prometheus</h1>
          </div>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
          Real-time tracking of FDA and EMA drug approval decisions. Anticipate investor reactions
          before PDUFA dates and committee meetings. Investment signals generated from regulatory
          data, market positioning, and competitive dynamics.
        </p>
      </div>

      {/* ── Next upcoming catalyst ───────────────────────────────────── */}
      {nextUp && (
        <div className="rounded-2xl border border-violet-500/25 bg-gradient-to-r from-violet-500/10 to-rose-500/5 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-3.5 w-3.5 text-violet-400" />
                <span className="text-xs font-semibold text-violet-300 uppercase tracking-wider">
                  Next Catalyst
                </span>
              </div>
              <h3 className="text-base font-bold text-foreground">
                {nextUp.brandName !== 'TBD' ? nextUp.brandName : nextUp.genericName}
                <span className="text-muted-foreground text-sm font-normal ml-1.5">
                  ({nextUp.ticker || nextUp.company})
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-lg">{nextUp.indication}</p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-bold text-violet-300">{formatCountdown(nextUp.actionDate)}</div>
              <div className="text-xs text-muted-foreground">{formatDate(nextUp.actionDate)}</div>
              <div className="mt-1">
                <SignalBadge signal={nextUp.investmentSignal} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Stats row ───────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Upcoming Decisions"  value={stats.totalPending}   color="text-violet-400" sub="On pipeline" />
          <StatCard label="Approved (pipeline)" value={stats.totalApproved}  color="text-emerald-400" sub="2024–2026" />
          <StatCard label="Rejected / CRL"      value={stats.totalRejected}  color="text-rose-400"    sub="CRL or rejected" />
          <StatCard label="Strong Buy Signals"  value={stats.strongBuyCount} color="text-emerald-300" sub="Pre-decision" />
          <StatCard label="Buy Signals"         value={stats.buyCount}       color="text-green-300"   sub="Risk-adjusted" />
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

        {/* Status filter */}
        <div className="flex gap-1">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-white/5 text-muted-foreground hover:bg-white/10'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <select
          value={bodyFilter}
          onChange={e => setBodyFilter(e.target.value)}
          className="text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-muted-foreground focus:outline-none focus:border-primary/40"
        >
          <option value="all">FDA + EMA</option>
          <option value="FDA">FDA only</option>
          <option value="EMA">EMA only</option>
        </select>

        <select
          value={areaFilter}
          onChange={e => setAreaFilter(e.target.value)}
          className="text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-muted-foreground focus:outline-none focus:border-primary/40"
        >
          {AREA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select
          value={signalFilter}
          onChange={e => setSignalFilter(e.target.value)}
          className="text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-muted-foreground focus:outline-none focus:border-primary/40"
        >
          {SIGNAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* ── Decision cards ───────────────────────────────────────────── */}
      {isLoading && (
        <div className="text-center py-16 text-muted-foreground">
          Loading regulatory pipeline…
        </div>
      )}

      {error && (
        <div className="text-center py-16 text-rose-400">
          Failed to load decisions. Please try again.
        </div>
      )}

      {!isLoading && !error && decisions.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          No decisions match the current filters.
        </div>
      )}

      {!isLoading && decisions.length > 0 && (
        <>
          {/* Upcoming (pending) */}
          {decisions.some(d => d.isPending) && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-r from-violet-500/30 to-transparent" />
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-violet-400" />
                  Upcoming Catalysts
                </h2>
                <div className="h-px flex-1 bg-gradient-to-l from-violet-500/30 to-transparent" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {decisions.filter(d => d.isPending).map(d => (
                  <DecisionCard key={d.id} d={d} />
                ))}
              </div>
            </div>
          )}

          {/* Decided (historical) */}
          {decisions.some(d => !d.isPending) && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-r from-rose-500/30 to-transparent" />
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-rose-400" />
                  Recent Decisions
                </h2>
                <div className="h-px flex-1 bg-gradient-to-l from-rose-500/30 to-transparent" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {decisions.filter(d => !d.isPending).map(d => (
                  <DecisionCard key={d.id} d={d} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Disclaimer ──────────────────────────────────────────────── */}
      <div className="text-xs text-muted-foreground/60 border-t border-white/6 pt-4 leading-relaxed">
        <Info className="h-3 w-3 inline mr-1" />
        Investment signals are for educational purposes only and do not constitute financial advice.
        Regulatory decisions involve significant binary event risk. Always consult a qualified financial
        advisor before trading around drug approval events. PDUFA dates are FDA action deadlines and
        may change. Data sourced from FDA, EMA public disclosures, and curated analyst research.
        <span className="ml-2">
          <a
            href="https://www.fda.gov/patients/drug-development-process/step-4-fda-drug-review"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary/60 hover:text-primary transition-colors"
          >
            FDA Drug Review Process <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </span>
      </div>
    </div>
  );
}
