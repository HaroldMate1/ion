/**
 * Trade Page
 * Search and trade assets
 */

'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, TrendingUp, TrendingDown, ArrowLeftRight, Sparkles } from 'lucide-react';
import { useAssetSearch, useMarketQuote } from '@/hooks/use-market-data';
import { useBalance, useBuyTrade, useSellTrade } from '@/hooks/use-portfolio';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { AssetType, Market } from '@/types';

const MARKET_OPTIONS: {
  value: Market; label: string; short: string; desc: string;
  badge: string; activeBorder: string; activeBg: string; accent: string;
}[] = [
  {
    value: 'us',     label: 'US Market',     short: 'US',   desc: 'NYSE · NASDAQ',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/20',
    activeBorder: 'border-blue-500/35', activeBg: 'bg-blue-500/8',
    accent: 'bg-blue-400',
  },
  {
    value: 'europe', label: 'Europe',         short: 'EU',   desc: 'XETRA · LSE',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/20',
    activeBorder: 'border-amber-500/35', activeBg: 'bg-amber-500/8',
    accent: 'bg-amber-400',
  },
  {
    value: 'latam',  label: 'Latin America',  short: '🌎',  desc: 'B3 · BMV',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/20',
    activeBorder: 'border-emerald-500/35', activeBg: 'bg-emerald-500/8',
    accent: 'bg-emerald-400',
  },
];

export default function TradePage() {
  const [searchQuery, setSearchQuery]     = useState('');
  const [selectedMarket, setSelectedMarket] = useState<Market>('us');
  const [selectedAsset, setSelectedAsset] = useState<{
    symbol: string; name: string; type: AssetType; market: Market;
  } | null>(null);

  const { data: searchResults, isLoading: searchLoading } = useAssetSearch(
    searchQuery, selectedMarket, searchQuery.length >= 2
  );
  const { data: balance } = useBalance();

  return (
    <div className="space-y-6 px-1 md:px-0">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-2 mb-1">
          <div className="icon-glow-blue p-2 rounded-xl">
            <ArrowLeftRight className="h-5 w-5 text-blue-300" />
          </div>
          <Sparkles className="h-3.5 w-3.5 text-primary/60" />
          <span className="text-xs font-medium text-muted-foreground tracking-widest uppercase">
            Live Markets
          </span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold gradient-text">Trade</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search for stocks, ETFs, or cryptocurrencies to trade
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">

        {/* ── Search Panel ─────────────────────────────────────────────── */}
        <div className="glass-card card-gradient-border rounded-2xl p-5 animate-fade-in-up delay-100 space-y-4">
          <div>
            <h2 className="text-base font-bold text-foreground">Search Assets</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Find stocks, ETFs, and cryptocurrencies</p>
          </div>

          {/* Market Selector */}
          <div className="grid grid-cols-3 gap-2">
            {MARKET_OPTIONS.map((opt) => {
              const active = selectedMarket === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => { setSelectedMarket(opt.value); setSearchQuery(''); setSelectedAsset(null); }}
                  className={`relative p-3 rounded-xl border text-left transition-all duration-200 overflow-hidden
                    ${active
                      ? `${opt.activeBorder} ${opt.activeBg}`
                      : 'border-white/[0.07] hover:border-white/[0.12] hover:bg-white/[0.03]'
                    }
                  `}
                >
                  {/* Top accent bar when active */}
                  {active && <div className={`absolute top-0 inset-x-0 h-0.5 ${opt.accent}`} />}
                  {/* Short badge */}
                  <span className={`inline-flex items-center justify-center rounded-lg px-2 py-0.5 mb-2 text-[10px] font-bold border
                    ${active ? opt.badge : 'bg-white/[0.04] text-muted-foreground/70 border-white/[0.08]'}`}>
                    {opt.short}
                  </span>
                  <p className={`text-xs font-semibold leading-tight ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {opt.label}
                  </p>
                  <p className="text-[9px] text-muted-foreground/55 mt-0.5 leading-tight">{opt.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${MARKET_OPTIONS.find(m => m.value === selectedMarket)?.label}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/[0.04] border-white/[0.08] focus:border-primary/40 focus:bg-white/[0.06] transition-all rounded-xl"
            />
          </div>

          {/* Results */}
          {searchLoading && (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
              <div className="h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              Searching...
            </div>
          )}

          {searchResults && searchQuery.length >= 2 && !searchLoading && (
            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {searchResults.all.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No results found</div>
              ) : (
                searchResults.all.map((asset: any, index: number) => (
                  <button
                    key={index}
                    onClick={() => setSelectedAsset({
                      symbol: asset.symbol,
                      name: asset.name,
                      type: asset.asset_type,
                      market: selectedMarket,
                    })}
                    className={`
                      w-full text-left p-3 rounded-xl transition-all duration-200
                      holding-row
                      ${selectedAsset?.symbol === asset.symbol ? 'border-primary/40 bg-primary/10' : ''}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-sm">{asset.symbol}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[180px]">{asset.name}</div>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        asset.asset_type === 'crypto'
                          ? 'badge-glow-amber'
                          : asset.asset_type === 'etf'
                          ? 'badge-glow-emerald'
                          : 'badge-glow-blue'
                      }`}>
                        {asset.asset_type.toUpperCase()}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {!searchQuery && (
            <div className="text-center py-8">
              <div className="icon-glow-blue inline-flex p-3 rounded-2xl mb-3 animate-float">
                <Search className="h-5 w-5 text-blue-300" />
              </div>
              <p className="text-sm text-muted-foreground">Type at least 2 characters to search</p>
            </div>
          )}
        </div>

        {/* ── Trade Panel ───────────────────────────────────────────────── */}
        <div className="glass-card card-gradient-border rounded-2xl p-5 animate-fade-in-up delay-200">
          <div className="mb-4">
            <h2 className="text-base font-bold text-foreground">Execute Trade</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {balance
                ? `Available: $${balance.available_cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : 'Loading balance...'}
            </p>
          </div>

          {selectedAsset ? (
            <TradeForm asset={selectedAsset} />
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="icon-glow-purple inline-flex p-4 rounded-2xl mb-4 animate-float delay-100">
                <ArrowLeftRight className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">Select an asset</p>
              <p className="text-xs text-muted-foreground mt-1">Search and click an asset on the left to start trading</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TradeForm({
  asset,
}: {
  asset: { symbol: string; name: string; type: AssetType; market: Market };
}) {
  const [quantity, setQuantity] = useState('');
  const [action, setAction]     = useState<'buy' | 'sell'>('buy');

  const { data: quote, isLoading: quoteLoading } = useMarketQuote(asset.symbol, asset.type, asset.market);
  const { data: balance } = useBalance();
  const buyTrade  = useBuyTrade();
  const sellTrade = useSellTrade();

  const handleTrade = async () => {
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) { toast.error('Please enter a valid quantity'); return; }
    if (!quote)           { toast.error('Price data not available'); return; }

    const totalCost = qty * quote.price * (action === 'buy' ? 1.001 : 0.999);

    try {
      if (action === 'buy') {
        if (balance && totalCost > balance.available_cash) { toast.error('Insufficient funds'); return; }
        await buyTrade.mutateAsync({ symbol: asset.symbol, assetType: asset.type, assetName: asset.name, quantity: qty, market: asset.market });
        toast.success(`Successfully bought ${qty} ${asset.symbol}`);
      } else {
        await sellTrade.mutateAsync({ symbol: asset.symbol, assetType: asset.type, assetName: asset.name, quantity: qty, market: asset.market });
        toast.success(`Successfully sold ${qty} ${asset.symbol}`);
      }
      setQuantity('');
    } catch (error: any) {
      toast.error(error.message || 'Trade failed');
    }
  };

  const totalAmount = quote && quantity ? parseFloat(quantity) * quote.price : 0;
  const fee         = totalAmount * 0.001;
  const total       = action === 'buy' ? totalAmount + fee : totalAmount - fee;

  return (
    <div className="space-y-4">

      {/* Asset name */}
      <div className="flex items-center gap-3">
        <div className="icon-glow-purple px-3 py-1.5 rounded-xl">
          <span className="text-sm font-bold text-primary">{asset.symbol}</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{asset.name}</p>
        </div>
      </div>

      {quoteLoading ? (
        <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground text-sm">
          <div className="h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          Loading price...
        </div>
      ) : quote ? (
        <div className="space-y-4">

          {/* Price card */}
          <div className={`rounded-xl p-4 flex items-center justify-between ${
            quote.change_24h !== undefined && quote.change_24h >= 0 ? 'stat-card-emerald' : 'stat-card-amber'
          }`}>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Current Price</p>
              <p className="text-2xl font-bold">${quote.price.toFixed(2)}</p>
            </div>
            {quote.change_24h !== undefined && (
              <div className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-xl ${
                quote.change_24h >= 0
                  ? 'text-emerald-400 bg-emerald-500/10'
                  : 'text-red-400 bg-red-500/10'
              }`}>
                {quote.change_24h >= 0
                  ? <TrendingUp className="h-4 w-4" />
                  : <TrendingDown className="h-4 w-4" />}
                {quote.change_24h.toFixed(2)}%
              </div>
            )}
          </div>

          {/* Buy / Sell tabs */}
          <Tabs value={action} onValueChange={(v) => setAction(v as 'buy' | 'sell')}>
            <TabsList className="grid w-full grid-cols-2 bg-white/[0.04] rounded-xl p-1">
              <TabsTrigger value="buy"  className="rounded-lg data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">Buy</TabsTrigger>
              <TabsTrigger value="sell" className="rounded-lg data-[state=active]:bg-red-500/20    data-[state=active]:text-red-400">Sell</TabsTrigger>
            </TabsList>
            <TabsContent value={action} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="quantity" className="text-xs text-muted-foreground uppercase tracking-wide">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="mt-1.5 bg-white/[0.04] border-white/[0.08] focus:border-primary/40 rounded-xl"
                />
              </div>

              {quantity && parseFloat(quantity) > 0 && (
                <div className="space-y-2 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="text-foreground font-medium">${totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Fee (0.1%)</span>
                    <span>${fee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base pt-2 border-t border-white/[0.06]">
                    <span>Total</span>
                    <span className={action === 'buy' ? 'text-emerald-400' : 'text-red-400'}>${total.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <Button
                onClick={handleTrade}
                disabled={!quantity || parseFloat(quantity) <= 0 || buyTrade.isPending || sellTrade.isPending}
                className={`w-full font-semibold border-0 ${
                  action === 'buy'
                    ? 'btn-shimmer text-white'
                    : 'bg-red-500/80 hover:bg-red-500 text-white'
                }`}
              >
                {buyTrade.isPending || sellTrade.isPending
                  ? 'Processing...'
                  : action === 'buy'
                  ? `Buy ${asset.symbol}`
                  : `Sell ${asset.symbol}`}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <div className="text-center py-6 text-destructive text-sm">Failed to load price</div>
      )}
    </div>
  );
}
