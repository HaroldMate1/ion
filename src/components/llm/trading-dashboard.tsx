import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  History, 
  Send, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Wallet,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Zap,
} from 'lucide-react';
import { 
  useLLMDailyLogs, 
  useCreateLLMDailyLog, 
  useExecuteLLMTrade, 
  useParseAndTrade,
  type ParseAndTradeResult,
} from '@/hooks/use-llm-portfolios';

interface TradingDashboardProps {
  portfolio: any;
  isLoading: boolean;
  color: string;
}

export function TradingDashboard({ portfolio, isLoading, color }: TradingDashboardProps) {
  const [logContent, setLogContent] = useState('');
  const [lastResults, setLastResults] = useState<ParseAndTradeResult[] | null>(null);
  const [tradeForm, setTradeForm] = useState({
    symbol: '',
    action: 'buy',
    quantity: '',
    assetType: 'stock',
  });

  const { data: logsData, isLoading: logsLoading } = useLLMDailyLogs(portfolio?.id);
  const parseAndTrade = useParseAndTrade();
  const executeTrade = useExecuteLLMTrade();

  if (isLoading || !portfolio) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleSubmitLog = async () => {
    if (!logContent.trim()) return;
    try {
      const result = await parseAndTrade.mutateAsync({
        portfolioId: portfolio.id,
        content: logContent,
      });
      setLastResults(result.results);
      setLogContent('');

      if (result.tradesFound === 0) {
        toast.info('Log saved. No trade instructions detected in the text.');
      } else {
        const successful = result.results.filter(r => r.status === 'success').length;
        const failed = result.results.filter(r => r.status === 'failed').length;
        if (failed === 0) {
          toast.success(`Log saved & ${successful} trade${successful > 1 ? 's' : ''} executed!`);
        } else {
          toast.warning(`Log saved. ${successful} succeeded, ${failed} failed.`);
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to process');
    }
  };

  const handleManualTrade = async () => {
    try {
      await executeTrade.mutateAsync({
        portfolioId: portfolio.id,
        symbol: tradeForm.symbol.toUpperCase(),
        action: tradeForm.action as 'buy' | 'sell',
        quantity: Number(tradeForm.quantity),
        assetType: tradeForm.assetType,
      });
      setTradeForm(prev => ({ ...prev, symbol: '', quantity: '' }));
      toast.success('Trade executed successfully');
    } catch (error: any) {
      toast.error(error.message || 'Trade failed');
    }
  };

  const logs = logsData?.logs || [];
  const holdings = portfolio.holdings || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LEFT COLUMN: Daily Logs */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${color}`} />
              Daily Analysis Log
            </CardTitle>
            <CardDescription>
              Paste {portfolio.displayName}&apos;s response below — trades will be parsed and executed automatically
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder={`Paste ${portfolio.displayName}'s daily trading response here...\n\nExpected format:\nBUY | NVDA | 10 | Strong earnings\nSELL | TSLA | 5 | Taking profits`}
              value={logContent}
              onChange={(e) => setLogContent(e.target.value)}
              className="min-h-[150px] font-mono text-sm"
            />
            <Button 
              onClick={handleSubmitLog} 
              disabled={!logContent.trim() || parseAndTrade.isPending}
              className="w-full"
            >
              {parseAndTrade.isPending ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4" />
              )}
              {parseAndTrade.isPending ? 'Processing trades...' : 'Save & Execute Trades'}
            </Button>
          </CardContent>
        </Card>

        {/* Trade Execution Results */}
        {lastResults && lastResults.length > 0 && (
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Last Execution Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lastResults.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded border text-sm">
                    {r.status === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={r.action === 'buy' ? 'default' : 'destructive'} className="text-[10px]">
                          {r.action.toUpperCase()}
                        </Badge>
                        <span className="font-semibold">{r.symbol}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{r.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Log History */}
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4" />
              Log History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] w-full pr-4">
              <div className="space-y-4">
                {logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No logs yet</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="border rounded-lg p-3 space-y-2">
                      <div className="text-xs text-muted-foreground flex justify-between">
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{log.content}</p>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* RIGHT COLUMN: Portfolio & Trading */}
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-muted-foreground">Cash Balance</div>
              <div className="text-2xl font-bold">${portfolio.cashBalance.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm font-medium text-muted-foreground">Total Value</div>
              <div className="text-2xl font-bold">${portfolio.totalValue.toLocaleString()}</div>
              <div className={`text-sm ${portfolio.totalReturnPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {portfolio.totalReturnPct >= 0 ? '+' : ''}{portfolio.totalReturnPct.toFixed(2)}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Manual Trade Form (fallback) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Manual Trade
            </CardTitle>
            <CardDescription className="text-xs">
              Override or add trades manually if needed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Action</Label>
                <Select 
                  value={tradeForm.action} 
                  onValueChange={(v) => setTradeForm(prev => ({ ...prev, action: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy">Buy</SelectItem>
                    <SelectItem value="sell">Sell</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Asset Type</Label>
                <Select 
                  value={tradeForm.assetType} 
                  onValueChange={(v) => setTradeForm(prev => ({ ...prev, assetType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stock">Stock</SelectItem>
                    <SelectItem value="etf">ETF</SelectItem>
                    <SelectItem value="crypto">Crypto</SelectItem>
                    <SelectItem value="bond">Bond</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Symbol</Label>
                <Input 
                  placeholder="e.g. NVDA" 
                  value={tradeForm.symbol}
                  onChange={(e) => setTradeForm(prev => ({ ...prev, symbol: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  value={tradeForm.quantity}
                  onChange={(e) => setTradeForm(prev => ({ ...prev, quantity: e.target.value }))}
                />
              </div>
            </div>

            <Button 
              className="w-full" 
              onClick={handleManualTrade}
              disabled={executeTrade.isPending || !tradeForm.symbol || !tradeForm.quantity}
              variant="outline"
            >
              {executeTrade.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              {tradeForm.action === 'buy' ? 'Buy' : 'Sell'} {tradeForm.symbol || 'Asset'}
            </Button>
          </CardContent>
        </Card>

        {/* Current Holdings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Current Holdings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {holdings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No active positions</p>
            ) : (
              <div className="space-y-3">
                {holdings.map((h: any) => (
                  <div key={h.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {h.symbol}
                        <Badge variant="secondary" className="text-[10px]">{h.assetType}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {Number(h.quantity).toFixed(4)} shares
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        ${(h.currentValue || h.totalInvested).toLocaleString()}
                      </div>
                      <div className={`text-xs ${h.unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {h.unrealizedPnL >= 0 ? '+' : ''}{h.unrealizedPnL?.toFixed(2)} ({h.unrealizedPnLPct?.toFixed(2)}%)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
