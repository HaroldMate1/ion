/**
 * Dashboard Page
 * Main dashboard with portfolio overview
 */

'use client';

import { useAuth } from '@/hooks/use-auth';
import { useBalance, usePortfolio, usePortfolioSummary } from '@/hooks/use-portfolio';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, Activity, ArrowRight, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { MiniPriceChart } from '@/components/charts/mini-price-chart';
import { Badge } from '@/components/ui/badge';

export default function DashboardPage() {
  const { profile } = useAuth();
  const { data: balance } = useBalance();
  const { holdings } = usePortfolio();
  const summary = usePortfolioSummary();

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Welcome back, {profile?.display_name || 'Trader'}!</h1>
          <p className="text-muted-foreground mt-2">
            Here's your portfolio overview
          </p>
        </div>
        <Link href="/trade">
          <Button>
            Start Trading
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
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
      </div>

      {/* Holdings */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Your Holdings</h2>
            <p className="text-muted-foreground">Current positions in your portfolio</p>
          </div>
          <Link href="/portfolio">
            <Button variant="outline">View All</Button>
          </Link>
        </div>

        {holdings.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">You don't have any holdings yet</p>
                <Link href="/trade">
                  <Button>Start Trading</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {holdings.map((holding) => {
              const isPriceAvailable = holding.current_price && holding.current_price > 0;
              const isPositive = holding.unrealized_pl !== undefined && holding.unrealized_pl >= 0;

              return (
                <Card key={holding.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{holding.symbol}</CardTitle>
                          <Badge variant={holding.asset_type === 'crypto' ? 'default' : 'secondary'} className="text-xs">
                            {holding.asset_type.toUpperCase()}
                          </Badge>
                        </div>
                        <CardDescription className="mt-1">{holding.asset_name}</CardDescription>
                      </div>
                      {isPriceAvailable && holding.unrealized_pl !== undefined && (
                        <div className={`flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Mini Chart */}
                    {isPriceAvailable && (
                      <MiniPriceChart
                        symbol={holding.symbol}
                        assetType={holding.asset_type}
                        currentPrice={holding.current_price}
                        days={7}
                        height={60}
                        showPositive={isPositive}
                      />
                    )}

                    {/* Price Info */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Current Price</span>
                        {isPriceAvailable ? (
                          <span className="font-semibold">${holding.current_price.toFixed(2)}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Price unavailable</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Quantity</span>
                        <span className="font-semibold">{holding.quantity}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total Value</span>
                        {isPriceAvailable && holding.current_value ? (
                          <span className="font-semibold">${holding.current_value.toFixed(2)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-sm font-medium">Profit/Loss</span>
                        {isPriceAvailable && holding.unrealized_pl !== undefined ? (
                          <div className={`text-right ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                            <div className="font-bold">
                              {isPositive ? '+' : ''}${holding.unrealized_pl.toFixed(2)}
                            </div>
                            <div className="text-xs">
                              {holding.unrealized_pl_percentage !== undefined
                                ? `${isPositive ? '+' : ''}${holding.unrealized_pl_percentage.toFixed(2)}%`
                                : '—'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Price unavailable</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
