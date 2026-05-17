'use client';

/**
 * AI Hub Page
 * Entry point for all AI-powered features: Coach, Fine-Tune, LLM Portfolios
 */

import Link from 'next/link';
import { Brain, FlaskConical, Bot, ArrowRight, Cpu, Star, Zap, Wand2, Sparkles, Pill } from 'lucide-react';

const AI_SECTIONS = [
  {
    href: '/coach',
    icon: Brain,
    cardClass: 'ai-card-brain',
    title: 'Trading Coach',
    description:
      'An autonomous AI agent that monitors markets, generates trading signals, and executes paper trades based on technical indicators, price action, and news sentiment.',
    iconClass: 'icon-glow-blue',
    iconColor: 'text-blue-300',
    badgeClass: 'badge-glow-blue',
    badge: 'Autonomous',
    delay: 'delay-100',
  },
  {
    href: '/coach/fine-tune',
    icon: FlaskConical,
    cardClass: 'ai-card-flask',
    title: 'Fine-Tune Model',
    description:
      'Optimize your trading coach by backtesting different agent weight combinations on historical data. Find the configuration with the best Sharpe ratio for your watchlist.',
    iconClass: 'icon-glow-purple',
    iconColor: 'text-primary',
    badgeClass: 'badge-glow-purple',
    badge: 'Experimental',
    delay: 'delay-200',
  },
  {
    href: '/llm-portfolios',
    icon: Bot,
    cardClass: 'ai-card-bot',
    title: 'LLM Portfolios',
    description:
      'Compare investment strategies from 5 leading AI models — Gemini, Claude, Perplexity, ChatGPT and Grok — each managing a $100,000 virtual portfolio over a 4-year horizon.',
    iconClass: 'icon-glow-emerald',
    iconColor: 'text-emerald-400',
    badgeClass: 'badge-glow-emerald',
    badge: '5 Models',
    delay: 'delay-300',
  },
  {
    href: '/ai/pharma-intel',
    icon: Pill,
    cardClass: 'ai-card-prometheus',
    title: 'Prometheus',
    description:
      'Regulatory intelligence engine tracking FDA and EMA drug approval decisions in real time. Anticipate investor reactions before PDUFA dates, with AI-generated buy/sell signals and competitive landscape analysis.',
    iconClass: 'icon-glow-rose',
    iconColor: 'text-rose-300',
    badgeClass: 'badge-glow-rose',
    badge: 'Pharma Intel',
    delay: 'delay-400',
  },
];

const WIZARD_SECTIONS = [
  {
    href: '/wizard/merlin',
    icon: Star,
    cardClass: 'ai-card-merlin',
    title: 'Merlin',
    description:
      "Joel Greenblatt's Magic Formula: rank ~120 large-cap US stocks by Earnings Yield + Return on Equity, then invest $100,000 equally across the top 30.",
    iconClass: 'icon-glow-amber',
    iconColor: 'text-amber-400',
    badgeClass: 'badge-glow-amber',
    badge: 'Magic Formula',
    delay: 'delay-100',
  },
  {
    href: '/wizard/houdini',
    icon: Zap,
    cardClass: 'ai-card-houdini',
    title: 'Houdini',
    description:
      'Magic Formula applied only to stocks that clear 19 institutional-grade quality gates across profitability, debt, consistency, valuation, and Piotroski/Altman scores.',
    iconClass: 'icon-glow-violet',
    iconColor: 'text-violet-400',
    badgeClass: 'badge-glow-violet',
    badge: 'Elite Filter',
    delay: 'delay-200',
  },
];

function AICard({
  href,
  icon: Icon,
  cardClass,
  title,
  description,
  iconClass,
  iconColor,
  badgeClass,
  badge,
  delay,
}: (typeof AI_SECTIONS)[0]) {
  return (
    <Link href={href} className="block group">
      <div className={`
        ${cardClass} glass-card card-gradient-border card-hover-glow rounded-2xl p-5
        animate-fade-in-up ${delay} h-full flex flex-col
      `}>
        {/* Icon + Badge row */}
        <div className="flex items-start justify-between mb-4">
          <div className={`${iconClass} p-3 rounded-xl transition-transform duration-300 group-hover:scale-110`}>
            <Icon className={`h-6 w-6 ${iconColor}`} />
          </div>
          <span className={`${badgeClass} text-xs font-semibold px-2.5 py-1 rounded-full`}>
            {badge}
          </span>
        </div>

        {/* Text */}
        <div className="flex-1 space-y-2 mb-5">
          <h3 className="text-base font-bold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>

        {/* CTA */}
        <div className={`
          flex items-center gap-2 text-sm font-semibold
          ${iconColor} opacity-80 group-hover:opacity-100 transition-opacity
        `}>
          <span>Open {title}</span>
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}

export default function AIHubPage() {
  return (
    <div className="py-4 md:py-6 space-y-10 px-1 md:px-0">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-2 mb-2">
          <div className="icon-glow-purple p-2 rounded-xl">
            <Cpu className="h-5 w-5 text-primary" />
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary/60" />
            <span className="text-xs font-medium text-muted-foreground tracking-widest uppercase">
              AI-Powered Tools
            </span>
          </div>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold gradient-text">AI Hub</h1>
        <p className="text-muted-foreground mt-1.5 max-w-xl text-sm leading-relaxed">
          AI-powered tools for trading signals, model optimization, LLM-driven portfolios, and quantitative screening.
        </p>
      </div>

      {/* ── AI Tools ─────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-primary/30 to-transparent" />
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
            AI Tools
          </h2>
          <div className="h-px flex-1 bg-gradient-to-l from-primary/30 to-transparent" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {AI_SECTIONS.map((section) => (
            <AICard key={section.href} {...section} />
          ))}
        </div>
      </div>

      {/* ── Wizard Strategies ────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-amber-500/30 to-transparent" />
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap flex items-center gap-1.5">
            <Wand2 className="h-3.5 w-3.5" />
            Wizard — Quantitative Screening
          </h2>
          <div className="h-px flex-1 bg-gradient-to-l from-amber-500/30 to-transparent" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {WIZARD_SECTIONS.map((section) => (
            <AICard key={section.href} {...section} />
          ))}
        </div>
      </div>
    </div>
  );
}
