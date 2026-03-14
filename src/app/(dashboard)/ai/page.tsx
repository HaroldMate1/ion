'use client';

/**
 * AI Hub Page
 * Entry point for all AI-powered features: Coach, Fine-Tune, LLM Portfolios
 */

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, FlaskConical, Bot, ArrowRight, Cpu, Star, Zap, Wand2 } from 'lucide-react';

const AI_SECTIONS = [
  {
    href: '/coach',
    icon: Brain,
    title: 'Trading Coach',
    description:
      'An autonomous AI agent that monitors markets, generates trading signals, and executes paper trades based on technical indicators, price action, and news sentiment.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/15',
    badge: 'Autonomous',
  },
  {
    href: '/coach/fine-tune',
    icon: FlaskConical,
    title: 'Fine-Tune Model',
    description:
      'Optimize your trading coach by backtesting different agent weight combinations on historical data. Find the configuration with the best Sharpe ratio for your watchlist.',
    color: 'text-purple-400',
    bg: 'bg-purple-500/15',
    badge: 'Experimental',
  },
  {
    href: '/llm-portfolios',
    icon: Bot,
    title: 'LLM Portfolios',
    description:
      'Compare investment strategies from 5 leading AI models — Gemini, Claude, Perplexity, ChatGPT and Grok — each managing a $100,000 virtual portfolio over a 4-year horizon.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
    badge: '5 Models',
  },
];

const WIZARD_SECTIONS = [
  {
    href: '/wizard/merlin',
    icon: Star,
    title: 'Merlin',
    description:
      "Joel Greenblatt's Magic Formula: rank ~120 large-cap US stocks by Earnings Yield + Return on Equity, then invest $100,000 equally across the top 30.",
    color: 'text-amber-400',
    bg: 'bg-amber-500/15',
    badge: 'Magic Formula',
  },
  {
    href: '/wizard/houdini',
    icon: Zap,
    title: 'Houdini',
    description:
      'Magic Formula applied only to stocks that clear 19 institutional-grade quality gates across profitability, debt, consistency, valuation, and Piotroski/Altman scores.',
    color: 'text-violet-400',
    bg: 'bg-violet-500/15',
    badge: 'Elite Filter',
  },
];

export default function AIHubPage() {
  return (
    <div className="container mx-auto py-4 md:py-6 space-y-8 px-2 md:px-0">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Cpu className="h-6 w-6 md:h-8 md:w-8" />
          AI
        </h1>
        <p className="text-muted-foreground mt-1">
          AI-powered tools for trading signals, model optimization, LLM-driven portfolios, and quantitative screening.
        </p>
      </div>

      {/* AI Tools */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">AI Tools</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {AI_SECTIONS.map(({ href, icon: Icon, title, description, color, bg, badge }) => (
            <Card key={href} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-xl ${bg}`}>
                    <Icon className={`h-7 w-7 ${color}`} />
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${bg} ${color}`}>
                    {badge}
                  </span>
                </div>
                <CardTitle className="text-lg mt-3">{title}</CardTitle>
                <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={href}>
                  <Button className="w-full" variant="outline">
                    Open {title}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Wizard Strategies */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Wand2 className="h-4 w-4" />
          Wizard — Quantitative Screening
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {WIZARD_SECTIONS.map(({ href, icon: Icon, title, description, color, bg, badge }) => (
            <Card key={href} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-xl ${bg}`}>
                    <Icon className={`h-7 w-7 ${color}`} />
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${bg} ${color}`}>
                    {badge}
                  </span>
                </div>
                <CardTitle className="text-lg mt-3">{title}</CardTitle>
                <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={href}>
                  <Button className="w-full" variant="outline">
                    Open {title}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
