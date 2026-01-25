/**
 * Dashboard Page
 * Main dashboard with portfolio overview
 */

'use client';

import { useAuth } from '@/hooks/use-auth';
import { useBalance, usePortfolio, usePortfolioSummary } from '@/hooks/use-portfolio';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, TrendingUp, Activity, ArrowRight } from 'lucide-react';
import Link from 'next/link';

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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Avg Buy Price</TableHead>
                  <TableHead className="text-right">Current Price</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead className="text-right">P&L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holdings.map((holding) => {
                  const isPriceAvailable = holding.current_price && holding.current_price > 0;

                  return (
                    <TableRow key={holding.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{holding.symbol}</div>
                          <div className="text-sm text-muted-foreground">{holding.asset_name}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{holding.quantity}</TableCell>
                      <TableCell className="text-right">${holding.average_buy_price.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        {isPriceAvailable ? (
                          `$${holding.current_price.toFixed(2)}`
                        ) : (
                          <span className="text-muted-foreground text-xs">Price unavailable</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isPriceAvailable && holding.current_value ? (
                          `$${holding.current_value.toFixed(2)}`
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isPriceAvailable && holding.unrealized_pl !== undefined ? (
                          <div className={holding.unrealized_pl >= 0 ? 'text-green-600' : 'text-red-600'}>
                            <div>
                              {holding.unrealized_pl >= 0 ? '+' : ''}${holding.unrealized_pl.toFixed(2)}
                            </div>
                            <div className="text-xs">
                              {holding.unrealized_pl_percentage !== undefined
                                ? `${holding.unrealized_pl_percentage >= 0 ? '+' : ''}${holding.unrealized_pl_percentage.toFixed(2)}%`
                                : '—'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">Price unavailable</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
