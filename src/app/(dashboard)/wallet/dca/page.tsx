'use client';

/**
 * Wallet — DCA (Dollar-Cost Averaging) Plans
 * Set a fixed monthly investment amount per asset and project growth.
 */

import Link from 'next/link';
import { useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Plus, Pencil, Trash2, RefreshCw, TrendingUp, Repeat2 } from 'lucide-react';
import {
  useWalletDCA, useCreateDCA, useUpdateDCA, useDeleteDCA,
  useExchangeRates, fmtNative,
} from '@/hooks/use-wallet';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'COP', 'MXN', 'BRL'];

/** Future value of regular monthly contributions compounded annually at a given rate */
function dcaProjection(monthlyUSD: number, years: number, annualRate: number): number {
  const monthlyRate = annualRate / 12;
  const months = years * 12;
  return monthlyUSD * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
}

type DCAForm = {
  name: string; ticker: string; monthly_amount: string; current_value: string;
  currency: string; start_date: string; notes: string;
};
const emptyForm: DCAForm = {
  name: '', ticker: '', monthly_amount: '', current_value: '', currency: 'USD', start_date: '', notes: '',
};

const POPULAR_TARGETS = [
  { name: 'S&P 500', ticker: 'SPY' },
  { name: 'NASDAQ 100', ticker: 'QQQ' },
  { name: 'Total Market', ticker: 'VTI' },
  { name: 'Bitcoin', ticker: 'BTC' },
  { name: 'Ethereum', ticker: 'ETH' },
  { name: 'Gold ETF', ticker: 'GLD' },
];

export default function WalletDCAPage() {
  const { data, isLoading }  = useWalletDCA();
  const { data: ratesData }  = useExchangeRates();
  const rates = ratesData?.rates ?? { USD: 1 };

  const createDCA = useCreateDCA();
  const updateDCA = useUpdateDCA();
  const deleteDCA = useDeleteDCA();

  const plans = data?.plans ?? [];
  const activePlans = plans.filter((p: any) => p.is_active);

  const [showAdd, setShowAdd]   = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm]         = useState<DCAForm>(emptyForm);

  // Total active monthly in USD
  const totalMonthlyUSD = activePlans.reduce((s: number, p: any) => {
    return s + Number(p.monthly_amount) / (rates[p.currency] ?? 1);
  }, 0);

  // Total current portfolio value of all DCA plans in USD
  const totalDCAPortfolioUSD = plans.reduce((s: number, p: any) => {
    return s + Number(p.current_value ?? 0) / (rates[p.currency] ?? 1);
  }, 0);

  const openAdd  = () => { setForm(emptyForm); setShowAdd(true); };
  const openEdit = (p: any) => {
    setForm({
      name: p.name, ticker: p.ticker ?? '', monthly_amount: String(p.monthly_amount),
      current_value: p.current_value ? String(p.current_value) : '',
      currency: p.currency, start_date: p.start_date ?? '', notes: p.notes ?? '',
    });
    setEditItem(p);
  };

  const setF = (k: keyof DCAForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const quickFill = (name: string, ticker: string) => {
    setF('name', name);
    setF('ticker', ticker);
  };

  const handleSave = async () => {
    if (!form.name || !form.monthly_amount) {
      toast.error('Name and monthly amount are required');
      return;
    }
    try {
      const payload = {
        name: form.name,
        ticker: form.ticker || null,
        monthly_amount: Number(form.monthly_amount),
        current_value: form.current_value ? Number(form.current_value) : 0,
        currency: form.currency,
        start_date: form.start_date || null,
        notes: form.notes || null,
      };
      if (editItem) {
        await updateDCA.mutateAsync({ id: editItem.id, ...payload });
        toast.success('Plan updated');
        setEditItem(null);
      } else {
        await createDCA.mutateAsync(payload);
        toast.success('DCA plan added');
        setShowAdd(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    }
  };

  const handleToggle = async (plan: any) => {
    try {
      await updateDCA.mutateAsync({ id: plan.id, is_active: !plan.is_active });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDCA.mutateAsync(deleteId);
      toast.success('Plan deleted');
      setDeleteId(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="container mx-auto py-4 md:py-6 space-y-4 px-2 md:px-0">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/wallet">
          <Button variant="ghost" size="icon" className="shrink-0"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Repeat2 className="h-5 w-5 text-indigo-400" />
            <h1 className="text-2xl font-bold">DCA Plans</h1>
          </div>
          <p className="text-sm text-muted-foreground">Dollar-Cost Averaging — invest a fixed amount every month</p>
        </div>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="h-4 w-4" />Add
        </Button>
      </div>

      {/* Summary */}
      {plans.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-indigo-500/5 border-indigo-500/20">
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground">Monthly (USD)</p>
              <p className="text-xl font-bold text-indigo-400">${fmt(totalMonthlyUSD)}</p>
            </CardContent>
          </Card>
          <Card className="bg-green-500/5 border-green-500/20">
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground">Portfolio Value</p>
              <p className="text-xl font-bold text-green-400">${fmt(totalDCAPortfolioUSD)}</p>
              <p className="text-[10px] text-muted-foreground">Current market value</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground">10yr @ 8% p.a.</p>
              <p className="text-xl font-bold text-amber-400">${fmt(dcaProjection(totalMonthlyUSD, 10, 0.08))}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground">Annual (USD)</p>
              <p className="text-xl font-bold">${fmt(totalMonthlyUSD * 12)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Repeat2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No DCA plans yet.</p>
            <p className="text-xs mt-1">Add a plan like "$200/month into S&P 500" to start building wealth systematically.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {plans.map((p: any) => {
            const monthlyUSD    = Number(p.monthly_amount) / (rates[p.currency] ?? 1);
            const proj10yr      = dcaProjection(monthlyUSD, 10, 0.08);
            const currentVal    = Number(p.current_value ?? 0);
            const currentValUSD = currentVal / (rates[p.currency] ?? 1);

            // Estimate total invested: months since start × monthly_amount (in native currency)
            let totalInvested = 0;
            if (p.start_date) {
              const startMs = new Date(p.start_date).getTime();
              const nowMs   = Date.now();
              const months  = Math.max(0, Math.floor((nowMs - startMs) / (1000 * 60 * 60 * 24 * 30.44)));
              totalInvested = months * Number(p.monthly_amount);
            }
            const gainLoss    = currentVal > 0 && totalInvested > 0 ? currentVal - totalInvested : null;
            const gainLossPct = gainLoss != null && totalInvested > 0 ? (gainLoss / totalInvested) * 100 : null;
            const isGain      = gainLoss != null && gainLoss >= 0;

            return (
              <Card key={p.id} className={!p.is_active ? 'opacity-50' : ''}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-semibold">{p.name}</span>
                        {p.ticker && (
                          <Badge variant="outline" className="text-[10px] bg-indigo-500/15 text-indigo-400 border-indigo-500/30 font-mono">
                            {p.ticker}
                          </Badge>
                        )}
                        {!p.is_active && <Badge variant="outline" className="text-[10px]">Paused</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {p.currency}{p.currency !== 'USD' && ` · ≈ $${fmt(monthlyUSD)}/mo USD`}
                        {p.start_date && ` · Since ${format(new Date(p.start_date), 'MMM yyyy')}`}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-4 text-xs">
                        {currentVal > 0 && (
                          <span>
                            Portfolio:{' '}
                            <span className="font-semibold text-green-400">{fmtNative(currentVal, p.currency)}</span>
                            {p.currency !== 'USD' && <span className="text-muted-foreground"> ≈ ${fmt(currentValUSD)}</span>}
                          </span>
                        )}
                        {gainLoss != null && (
                          <span className={isGain ? 'text-green-400' : 'text-red-400'}>
                            {isGain ? '+' : ''}{fmtNative(gainLoss, p.currency)}
                            {gainLossPct != null && ` (${gainLossPct >= 0 ? '+' : ''}${gainLossPct.toFixed(1)}%)`}
                          </span>
                        )}
                        {p.is_active && (
                          <>
                            <span className="text-muted-foreground">Annual: <span className="text-foreground font-medium">${fmt(monthlyUSD * 12)}</span></span>
                            <span className="text-amber-400 font-medium">10yr @ 8%: ${fmt(proj10yr)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold">{fmtNative(Number(p.monthly_amount), p.currency)}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Switch checked={p.is_active} onCheckedChange={() => handleToggle(p)} className="scale-75" title="Pause / resume" />
                    <span className="text-xs text-muted-foreground">{p.is_active ? 'Active' : 'Paused'}</span>
                    <div className="ml-auto flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => openEdit(p)}>
                        <Pencil className="h-3 w-3" />Edit
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => setDeleteId(p.id)}>
                        <Trash2 className="h-3 w-3" />Delete
                      </Button>
                    </div>
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
            <DialogTitle>{editItem ? 'Edit DCA Plan' : 'New DCA Plan'}</DialogTitle>
            <DialogDescription>Set a fixed monthly investment amount for any asset or index.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Quick-fill */}
            {!editItem && (
              <div className="space-y-1.5">
                <Label className="text-xs">Quick-fill</Label>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_TARGETS.map(t => (
                    <button
                      key={t.ticker}
                      type="button"
                      onClick={() => quickFill(t.name, t.ticker)}
                      className={`px-2 py-0.5 rounded text-[11px] border transition-colors
                        ${form.ticker === t.ticker
                          ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                          : 'border-white/10 text-muted-foreground hover:border-white/20'}`}
                    >
                      {t.ticker}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Asset Name</Label>
                <Input placeholder="S&P 500 Index" value={form.name} onChange={e => setF('name', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ticker (optional)</Label>
                <Input placeholder="SPY" value={form.ticker} onChange={e => setF('ticker', e.target.value.toUpperCase())} className="font-mono" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Monthly Amount</Label>
                <Input type="number" step="any" placeholder="200" value={form.monthly_amount} onChange={e => setF('monthly_amount', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Currency</Label>
                <Select value={form.currency} onValueChange={v => setF('currency', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Live projection preview */}
            {form.monthly_amount && Number(form.monthly_amount) > 0 && (
              <div className="rounded-lg bg-indigo-500/5 border border-indigo-500/20 p-3 text-xs space-y-1">
                <p className="text-muted-foreground font-medium">Projection preview</p>
                {[5, 10, 20].map(y => {
                  const monthlyUSD = Number(form.monthly_amount) / (rates[form.currency] ?? 1);
                  return (
                    <div key={y} className="flex justify-between">
                      <span className="text-muted-foreground">{y} years @ 8% p.a.</span>
                      <span className="font-semibold text-green-400">${fmt(dcaProjection(monthlyUSD, y, 0.08))}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Current Portfolio Value (optional)</Label>
                <Input type="number" step="any" placeholder="0" value={form.current_value} onChange={e => setF('current_value', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Start Date (optional)</Label>
                <Input type="date" value={form.start_date} onChange={e => setF('start_date', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea placeholder="Optional notes…" rows={2} value={form.notes} onChange={e => setF('notes', e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditItem(null); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={createDCA.isPending || updateDCA.isPending}>
              {(createDCA.isPending || updateDCA.isPending)
                ? <RefreshCw className="h-4 w-4 animate-spin" />
                : editItem ? 'Save' : 'Add Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete DCA Plan</DialogTitle>
            <DialogDescription>This will permanently delete this plan. Are you sure?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteDCA.isPending}>
              {deleteDCA.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
