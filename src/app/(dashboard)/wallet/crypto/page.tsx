'use client';

/**
 * Wallet — Crypto Holdings Page
 * Track BTC, ETH, and other crypto assets with manual price updates.
 * All values are stored and displayed in USD.
 */

import Link from 'next/link';
import { useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, Plus, Pencil, Trash2, RefreshCw, TrendingUp, TrendingDown, Bitcoin } from 'lucide-react';
import { useWalletCrypto, useCreateCrypto, useUpdateCrypto, useDeleteCrypto } from '@/hooks/use-wallet';

// Popular coins list for quick-fill suggestions
const POPULAR_COINS: Array<{ symbol: string; name: string }> = [
  { symbol: 'BTC',  name: 'Bitcoin' },
  { symbol: 'ETH',  name: 'Ethereum' },
  { symbol: 'SOL',  name: 'Solana' },
  { symbol: 'BNB',  name: 'BNB' },
  { symbol: 'XRP',  name: 'XRP' },
  { symbol: 'ADA',  name: 'Cardano' },
  { symbol: 'AVAX', name: 'Avalanche' },
  { symbol: 'DOT',  name: 'Polkadot' },
  { symbol: 'MATIC',name: 'Polygon' },
  { symbol: 'LINK', name: 'Chainlink' },
  { symbol: 'DOGE', name: 'Dogecoin' },
  { symbol: 'UNI',  name: 'Uniswap' },
  { symbol: 'USDT', name: 'Tether' },
  { symbol: 'USDC', name: 'USD Coin' },
];

type CryptoForm = {
  coin_symbol: string;
  coin_name: string;
  amount_held: string;
  purchase_price_usd: string;
  purchase_date: string;
  current_price_usd: string;
  notes: string;
};

const emptyForm: CryptoForm = {
  coin_symbol: '', coin_name: '', amount_held: '',
  purchase_price_usd: '', purchase_date: '',
  current_price_usd: '', notes: '',
};

function pnlColor(pct: number) {
  if (pct > 0)  return 'text-green-400';
  if (pct < 0)  return 'text-red-400';
  return 'text-muted-foreground';
}

export default function WalletCryptoPage() {
  const { data, isLoading }   = useWalletCrypto();
  const createCrypto          = useCreateCrypto();
  const updateCrypto          = useUpdateCrypto();
  const deleteCrypto          = useDeleteCrypto();

  const holdings = data?.crypto ?? [];

  const [showAdd, setShowAdd]     = useState(false);
  const [editItem, setEditItem]   = useState<any | null>(null);
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [form, setForm]           = useState<CryptoForm>(emptyForm);

  const totalValue = holdings.reduce((s: number, h: any) => s + Number(h.amount_held) * Number(h.current_price_usd), 0);
  const totalCost  = holdings.reduce((s: number, h: any) => {
    if (!h.purchase_price_usd) return s;
    return s + Number(h.amount_held) * Number(h.purchase_price_usd);
  }, 0);
  const totalPnL   = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  const openAdd  = () => { setForm(emptyForm); setShowAdd(true); };
  const openEdit = (h: any) => {
    setForm({
      coin_symbol: h.coin_symbol,
      coin_name: h.coin_name,
      amount_held: String(h.amount_held),
      purchase_price_usd: h.purchase_price_usd != null ? String(h.purchase_price_usd) : '',
      purchase_date: h.purchase_date ?? '',
      current_price_usd: h.current_price_usd != null ? String(h.current_price_usd) : '',
      notes: h.notes ?? '',
    });
    setEditItem(h);
  };

  const setF = (k: keyof CryptoForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const quickFill = (symbol: string, name: string) => {
    setF('coin_symbol', symbol);
    setF('coin_name', name);
  };

  const handleSave = async () => {
    if (!form.coin_symbol || !form.coin_name || !form.amount_held) {
      toast.error('Symbol, name and amount are required');
      return;
    }
    try {
      const payload = {
        coin_symbol: form.coin_symbol,
        coin_name: form.coin_name,
        amount_held: Number(form.amount_held),
        purchase_price_usd: form.purchase_price_usd ? Number(form.purchase_price_usd) : null,
        purchase_date: form.purchase_date || null,
        current_price_usd: form.current_price_usd ? Number(form.current_price_usd) : 0,
        notes: form.notes || null,
      };
      if (editItem) {
        await updateCrypto.mutateAsync({ id: editItem.id, ...payload });
        toast.success('Holding updated');
        setEditItem(null);
      } else {
        await createCrypto.mutateAsync(payload);
        toast.success('Holding added');
        setShowAdd(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteCrypto.mutateAsync(deleteId);
      toast.success('Holding deleted');
      setDeleteId(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtAmount = (n: number) => {
    if (n < 0.001) return n.toFixed(8);
    if (n < 1)     return n.toFixed(4);
    return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  };

  return (
    <div className="container mx-auto py-4 md:py-6 space-y-4 px-2 md:px-0">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/wallet">
          <Button variant="ghost" size="icon" className="shrink-0"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Bitcoin className="h-5 w-5 text-orange-400" />
            <h1 className="text-2xl font-bold">Crypto</h1>
          </div>
          <p className="text-sm text-muted-foreground">Bitcoin, Ethereum & other digital assets · all values in USD</p>
        </div>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="h-4 w-4" />Add
        </Button>
      </div>

      {/* Summary */}
      {holdings.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-orange-500/5 border-orange-500/20 col-span-3 sm:col-span-1">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Portfolio Value</p>
              <p className="text-2xl font-bold text-orange-400">${fmt(totalValue)}</p>
            </CardContent>
          </Card>
          {totalCost > 0 && (
            <>
              <Card className="col-span-3 sm:col-span-1">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-muted-foreground">Total Cost Basis</p>
                  <p className="text-xl font-bold">${fmt(totalCost)}</p>
                </CardContent>
              </Card>
              <Card className="col-span-3 sm:col-span-1">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-muted-foreground">Unrealized P&amp;L</p>
                  <div className="flex items-center gap-1.5">
                    {totalPnL >= 0
                      ? <TrendingUp className="h-4 w-4 text-green-400 shrink-0" />
                      : <TrendingDown className="h-4 w-4 text-red-400 shrink-0" />}
                    <p className={`text-xl font-bold ${pnlColor(totalPnL)}`}>
                      {totalPnL >= 0 ? '+' : ''}${fmt(Math.abs(totalPnL))}
                    </p>
                    <span className={`text-xs ${pnlColor(totalPnLPct)}`}>
                      ({totalPnLPct >= 0 ? '+' : ''}{totalPnLPct.toFixed(1)}%)
                    </span>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : holdings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Bitcoin className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No crypto holdings yet. Add Bitcoin, Ethereum, or any other coin.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {holdings.map((h: any) => {
            const currentValue = Number(h.amount_held) * Number(h.current_price_usd);
            const costBasis    = h.purchase_price_usd ? Number(h.amount_held) * Number(h.purchase_price_usd) : null;
            const pnl          = costBasis != null ? currentValue - costBasis : null;
            const pnlPct       = costBasis && costBasis > 0 ? ((currentValue - costBasis) / costBasis) * 100 : null;

            return (
              <Card key={h.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-semibold">{h.coin_name}</span>
                        <Badge variant="outline" className="text-[10px] bg-orange-500/15 text-orange-400 border-orange-500/30 font-mono">
                          {h.coin_symbol}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {fmtAmount(Number(h.amount_held))} {h.coin_symbol}
                        {h.current_price_usd > 0 && ` · $${Number(h.current_price_usd).toLocaleString()} / coin`}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
                        {costBasis != null && (
                          <span className="text-muted-foreground">Cost: ${fmt(costBasis)}</span>
                        )}
                        {pnl != null && pnlPct != null && (
                          <span className={pnlColor(pnl)}>
                            {pnl >= 0 ? '+' : ''}${fmt(Math.abs(pnl))} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
                          </span>
                        )}
                        {h.purchase_date && (
                          <span className="text-muted-foreground">Bought {format(new Date(h.purchase_date), 'MMM d, yyyy')}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold">${fmt(currentValue)}</p>
                      {h.current_price_usd > 0 && (
                        <p className="text-[10px] text-muted-foreground">@ ${Number(h.current_price_usd).toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => openEdit(h)}>
                      <Pencil className="h-3 w-3" />Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => setDeleteId(h.id)}>
                      <Trash2 className="h-3 w-3" />Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showAdd || !!editItem} onOpenChange={v => { if (!v) { setShowAdd(false); setEditItem(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit Holding' : 'Add Crypto Holding'}</DialogTitle>
            <DialogDescription>All prices in USD. Update the current price to track P&L.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Quick-fill popular coins */}
            {!editItem && (
              <div className="space-y-1.5">
                <Label className="text-xs">Quick-fill</Label>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_COINS.slice(0, 8).map(c => (
                    <button
                      key={c.symbol}
                      type="button"
                      onClick={() => quickFill(c.symbol, c.name)}
                      className={`px-2 py-0.5 rounded text-[11px] border transition-colors
                        ${form.coin_symbol === c.symbol
                          ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                          : 'border-white/10 text-muted-foreground hover:border-white/20'}`}
                    >
                      {c.symbol}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Symbol</Label>
                <Input
                  placeholder="BTC"
                  value={form.coin_symbol}
                  onChange={e => setF('coin_symbol', e.target.value.toUpperCase())}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Coin Name</Label>
                <Input placeholder="Bitcoin" value={form.coin_name} onChange={e => setF('coin_name', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Amount Held</Label>
                <Input type="number" step="any" placeholder="0.5" value={form.amount_held} onChange={e => setF('amount_held', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Current Price (USD)</Label>
                <Input type="number" step="any" placeholder="98000" value={form.current_price_usd} onChange={e => setF('current_price_usd', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Avg Purchase Price (USD)</Label>
                <Input type="number" step="any" placeholder="Optional" value={form.purchase_price_usd} onChange={e => setF('purchase_price_usd', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Purchase Date</Label>
                <Input type="date" value={form.purchase_date} onChange={e => setF('purchase_date', e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea placeholder="Optional notes…" rows={2} value={form.notes} onChange={e => setF('notes', e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditItem(null); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={createCrypto.isPending || updateCrypto.isPending}>
              {(createCrypto.isPending || updateCrypto.isPending)
                ? <RefreshCw className="h-4 w-4 animate-spin" />
                : editItem ? 'Save' : 'Add Holding'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Holding</DialogTitle>
            <DialogDescription>This will permanently delete this crypto holding. Are you sure?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteCrypto.isPending}>
              {deleteCrypto.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
