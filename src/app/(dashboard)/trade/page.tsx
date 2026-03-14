/**
 * Trade Page
 * Search and trade assets
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, TrendingUp, TrendingDown } from 'lucide-react';
import { useAssetSearch, useMarketQuote } from '@/hooks/use-market-data';
import { useBalance, useBuyTrade, useSellTrade } from '@/hooks/use-portfolio';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { AssetType, Market } from '@/types';

const MARKET_OPTIONS: { value: Market; label: string; flag: string }[] = [
  { value: 'us', label: 'US Market', flag: '🇺🇸' },
  { value: 'europe', label: 'Europe', flag: '🇪🇺' },
  { value: 'latam', label: 'Latin America', flag: '🌎' },
];

export default function TradePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarket, setSelectedMarket] = useState<Market>('us');
  const [selectedAsset, setSelectedAsset] = useState<{
    symbol: string;
    name: string;
    type: AssetType;
    market: Market;
  } | null>(null);

  const { data: searchResults, isLoading: searchLoading } = useAssetSearch(
    searchQuery,
    selectedMarket,
    searchQuery.length >= 2
  );

  const { data: balance } = useBalance();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Trade</h1>
        <p className="text-muted-foreground mt-2">
          Search for stocks, ETFs, or cryptocurrencies to trade
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Search Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Search Assets</CardTitle>
            <CardDescription>Find stocks, ETFs, and cryptocurrencies</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Market Selector */}
            <div className="flex gap-2">
              {MARKET_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setSelectedMarket(option.value);
                    setSearchQuery('');
                    setSelectedAsset(null);
                  }}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    selectedMarket === option.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'hover:bg-accent border-border'
                  }`}
                >
                  <span className="mr-1">{option.flag}</span>
                  {option.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${MARKET_OPTIONS.find(m => m.value === selectedMarket)?.label} assets...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {searchLoading && (
              <div className="text-center py-8 text-muted-foreground">Searching...</div>
            )}

            {searchResults && searchQuery.length >= 2 && !searchLoading && (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {searchResults.all.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No results found
                  </div>
                ) : (
                  searchResults.all.map((asset: any, index: number) => (
                    <button
                      key={index}
                      onClick={() =>
                        setSelectedAsset({
                          symbol: asset.symbol,
                          name: asset.name,
                          type: asset.asset_type,
                          market: selectedMarket,
                        })
                      }
                      className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{asset.symbol}</div>
                          <div className="text-sm text-muted-foreground">{asset.name}</div>
                        </div>
                        <Badge variant={asset.asset_type === 'crypto' ? 'default' : 'secondary'}>
                          {asset.asset_type.toUpperCase()}
                        </Badge>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trade Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Trade</CardTitle>
            <CardDescription>
              {balance
                ? `Available Cash: $${balance.available_cash.toFixed(2)}`
                : 'Loading balance...'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedAsset ? (
              <TradeForm asset={selectedAsset} />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                Search and select an asset to start trading
              </div>
            )}
          </CardContent>
        </Card>
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
  const [action, setAction] = useState<'buy' | 'sell'>('buy');

  const { data: quote, isLoading: quoteLoading } = useMarketQuote(asset.symbol, asset.type, asset.market);
  const { data: balance } = useBalance();
  const buyTrade = useBuyTrade();
  const sellTrade = useSellTrade();

  const handleTrade = async () => {
    const qty = parseFloat(quantity);

    if (!qty || qty <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    if (!quote) {
      toast.error('Price data not available');
      return;
    }

    const totalCost = qty * quote.price * (action === 'buy' ? 1.001 : 0.999); // Include fee

    try {
      if (action === 'buy') {
        if (balance && totalCost > balance.available_cash) {
          toast.error('Insufficient funds');
          return;
        }

        await buyTrade.mutateAsync({
          symbol: asset.symbol,
          assetType: asset.type,
          assetName: asset.name,
          quantity: qty,
          market: asset.market,
        });

        toast.success(`Successfully bought ${qty} ${asset.symbol}`);
      } else {
        await sellTrade.mutateAsync({
          symbol: asset.symbol,
          assetType: asset.type,
          assetName: asset.name,
          quantity: qty,
          market: asset.market,
        });

        toast.success(`Successfully sold ${qty} ${asset.symbol}`);
      }

      setQuantity('');
    } catch (error: any) {
      toast.error(error.message || 'Trade failed');
    }
  };

  const totalAmount = quote && quantity ? parseFloat(quantity) * quote.price : 0;
  const fee = totalAmount * 0.001;
  const total = action === 'buy' ? totalAmount + fee : totalAmount - fee;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg">{asset.name}</h3>
        <p className="text-sm text-muted-foreground">{asset.symbol}</p>
      </div>

      {quoteLoading ? (
        <div className="text-center py-4">Loading price...</div>
      ) : quote ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <div className="text-sm text-muted-foreground">Current Price</div>
              <div className="text-2xl font-bold">${quote.price.toFixed(2)}</div>
            </div>
            {quote.change_24h !== undefined && (
              <div
                className={`flex items-center gap-1 ${
                  quote.change_24h >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {quote.change_24h >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span className="font-semibold">{quote.change_24h.toFixed(2)}%</span>
              </div>
            )}
          </div>

          <Tabs value={action} onValueChange={(v) => setAction(v as 'buy' | 'sell')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="buy">Buy</TabsTrigger>
              <TabsTrigger value="sell">Sell</TabsTrigger>
            </TabsList>
            <TabsContent value={action} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>

              {quantity && parseFloat(quantity) > 0 && (
                <div className="space-y-2 p-4 bg-muted rounded-lg text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>${totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Fee (0.1%):</span>
                    <span>${fee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-base pt-2 border-t">
                    <span>Total:</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <Button
                onClick={handleTrade}
                disabled={!quantity || parseFloat(quantity) <= 0 || buyTrade.isPending || sellTrade.isPending}
                className="w-full"
                variant={action === 'buy' ? 'default' : 'destructive'}
              >
                {buyTrade.isPending || sellTrade.isPending
                  ? 'Processing...'
                  : action === 'buy'
                    ? 'Buy'
                    : 'Sell'}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <div className="text-center py-4 text-destructive">Failed to load price</div>
      )}
    </div>
  );
}
