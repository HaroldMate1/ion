'use client';

/**
 * Wizard Hub Page
 * Entry point for Joel Greenblatt's Magic Formula strategies
 */

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wand2, ArrowRight, Star, Zap, CheckCircle2 } from 'lucide-react';
import { WIZARD_CONFIGS } from '@/config/wizard-strategies';

const WIZARD_CARDS = [
  {
    href: '/wizard/merlin',
    icon: Star,
    key: 'merlin' as const,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    badge: 'Magic Formula',
    badgeColor: 'text-amber-700 bg-amber-100',
  },
  {
    href: '/wizard/houdini',
    icon: Zap,
    key: 'houdini' as const,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    badge: 'Enhanced',
    badgeColor: 'text-violet-700 bg-violet-100',
  },
];

export default function WizardHubPage() {
  return (
    <div className="container mx-auto py-4 md:py-6 space-y-6 px-2 md:px-0">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Wand2 className="h-6 w-6 md:h-8 md:w-8" />
          Wizard
        </h1>
        <p className="text-muted-foreground mt-1">
          Quantitative stock-picking strategies inspired by Joel Greenblatt&apos;s{' '}
          <span className="italic">The Little Book That Still Beats the Market</span>.
          Each strategy screens ~120 large-cap US stocks and invests $100,000 equally across the top 30.
        </p>
      </div>

      {/* Strategy Cards */}
      <div className="grid gap-5 md:grid-cols-2">
        {WIZARD_CARDS.map(({ href, icon: Icon, key, color, bg, badge, badgeColor }) => {
          const cfg = WIZARD_CONFIGS[key];
          return (
            <Card key={href} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-xl ${bg}`}>
                    <Icon className={`h-7 w-7 ${color}`} />
                  </div>
                  <Badge className={`text-xs font-medium ${badgeColor} border-0`}>
                    {badge}
                  </Badge>
                </div>
                <CardTitle className="text-xl mt-3">{cfg.displayName}</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  {cfg.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters list */}
                <ul className="space-y-1.5">
                  {cfg.filters.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className={`h-4 w-4 shrink-0 ${color}`} />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link href={href}>
                  <Button className="w-full" variant="outline">
                    Open {cfg.displayName}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Methodology note */}
      <Card className="bg-muted/40">
        <CardContent className="pt-4 pb-4 text-sm text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">How the Magic Formula works</p>
          <p>
            Joel Greenblatt&apos;s Magic Formula ranks companies by two metrics simultaneously:
            <strong> Earnings Yield</strong> (cheap companies) and{' '}
            <strong>Return on Capital</strong> (quality companies). By combining both ranks and
            buying the top 30, the strategy finds businesses that are both undervalued and
            efficiently run.
          </p>
          <p>
            <strong>Houdini</strong> adds a consistency layer — it filters out companies that may
            have looked good only in a single snapshot, checking revenue growth, earnings
            consistency, leverage, free cash flow, and a simplified Discounted Cash Flow (DCF)
            valuation before applying the same ranking.
          </p>
          <p className="text-xs">
            Each portfolio starts with $100,000 divided equally across the 30 selected companies
            (~$3,333 per position). Prices are fetched live via Yahoo Finance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
