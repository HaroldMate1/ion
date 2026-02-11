/**
 * Dashboard Page
 * Main dashboard with portfolio overview
 */

'use client';

import { useAuth } from '@/hooks/use-auth';
import { useBalance, usePortfolio, usePortfolioSummary } from '@/hooks/use-portfolio';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, Activity, ArrowRight, Brain } from 'lucide-react';
import { useCoachSummary } from '@/hooks/use-coach';
import Link from 'next/link';

export default function DashboardPage() {
  const { profile } = useAuth();
  const { data: balance } = useBalance();
  const { holdings } = usePortfolio();
  const summary = usePortfolioSummary();
  const coachSummary = useCoachSummary();

  return (
    <div className="space-y-6 px-1 md:px-0">
      {/* Welcome Section */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Welcome back, {profile?.display_name || 'Trader'}!</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here's your portfolio overview
          </p>
        </div>
        <Link href="/trade">
          <Button className="w-full sm:w-auto">
            Start Trading
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Cash</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {balance ? (
              <>
                <div className="text-2xl font-bold">
                  ${balance.available_cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground">Ready to invest</p>
              </>
            ) : (
              <div className="text-2xl font-bold">Loading...</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summary ? (
              <>
                <div className="text-2xl font-bold">
                  ${summary.portfolio_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {holdings.length} {holdings.length === 1 ? 'holding' : 'holdings'}
                </p>
              </>
            ) : (
              <div className="text-2xl font-bold">Loading...</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Profit/Loss</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summary ? (
              <>
                <div
                  className={`text-2xl font-bold ${
                    summary.total_profit_loss >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {summary.total_profit_loss >= 0 ? '+' : ''}
                  ${summary.total_profit_loss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p
                  className={`text-xs ${
                    summary.total_profit_loss_percentage >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {summary.total_profit_loss_percentage >= 0 ? '+' : ''}
                  {summary.total_profit_loss_percentage.toFixed(2)}%
                </p>
              </>
            ) : (
              <div className="text-2xl font-bold">Loading...</div>
            )}
          </CardContent>
        </Card>

        <Link href="/coach">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trading Coach</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {!coachSummary.isLoading ? (
                <>
                  <div className="text-2xl font-bold">
                    {coachSummary.actionableSignals}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {coachSummary.actionableSignals === 1 ? 'Signal' : 'Signals'} ready • {coachSummary.openTrades} open trades
                  </p>
                  {coachSummary.killSwitchActive && (
                    <p className="text-xs text-destructive mt-1">Kill switch active</p>
                  )}
                </>
              ) : (
                <div className="text-2xl font-bold">Loading...</div>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Holdings */}
      <Card>
        <CardHeader>
          <CardTitle>Your Holdings</CardTitle>
          <CardDescription>Current positions in your portfolio</CardDescription>
        </CardHeader>
        <CardContent>
          {holdings.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">You don't have any holdings yet</p>
              <Link href="/trade">
                <Button>Start Trading</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {holdings.map((holding) => {
                const isPriceAvailable = holding.current_price && holding.current_price > 0;

                return (
                  <div key={holding.id} className="p-3 border rounded-lg space-y-1.5">
                    {/* Row 1: Symbol + P&L */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{holding.symbol}</span>
                        <span className="text-sm text-muted-foreground ml-2 hidden sm:inline">{holding.asset_name}</span>
                      </div>
                      {isPriceAvailable && holding.unrealized_pl !== undefined ? (
                        <div className={`text-right ${holding.unrealized_pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          <span className="font-medium">
                            {holding.unrealized_pl >= 0 ? '+' : ''}${holding.unrealized_pl.toFixed(2)}
                          </span>
                          <span className="text-xs ml-1">
                            ({holding.unrealized_pl_percentage !== undefined
                              ? `${holding.unrealized_pl_percentage >= 0 ? '+' : ''}${holding.unrealized_pl_percentage.toFixed(2)}%`
                              : '—'})
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">Price unavailable</span>
                      )}
                    </div>
                    {/* Row 2: Name (mobile only) + details */}
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span className="truncate mr-2 sm:hidden">{holding.asset_name}</span>
                      <div className="flex gap-3 text-xs shrink-0 ml-auto">
                        <span>Qty: {holding.quantity}</span>
                        <span>Avg: ${holding.average_buy_price.toFixed(2)}</span>
                        {isPriceAvailable && (
                          <span>Now: ${holding.current_price!.toFixed(2)}</span>
                        )}
                        {isPriceAvailable && holding.current_value && (
                          <span className="font-medium text-foreground">${holding.current_value.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
