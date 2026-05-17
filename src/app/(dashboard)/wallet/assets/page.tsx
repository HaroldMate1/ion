'use client';

/**
 * Wallet — Savings & Investment Assets Page
 */

import Link from 'next/link';
import { useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, PiggyBank, Plus, Pencil, Trash2, RefreshCw, TrendingUp } from 'lucide-react';
import { useWalletAssets, useCreateAsset, useUpdateAsset, useDeleteAsset, useExchangeRates, fmtNative, fmtUSDEquiv } from '@/hooks/use-wallet';

const ASSET_TYPES = ['savings', 'investment', 'fixed_deposit', 'bond', 'crypto', 'other'];
const ASSET_LABELS: Record<string, string> = {
  savings: 'Savings', investment: 'Investment', fixed_deposit: 'Fixed Deposit',
  bond: 'Bond', crypto: 'Crypto', other: 'Other',
};
const ASSET_COLORS: Record<string, string> = {
  savings:       'bg-blue-500/15 text-blue-400 border-blue-500/30',
  investment:    'bg-purple-500/15 text-purple-400 border-purple-500/30',
  fixed_deposit: 'bg-green-500/15 text-green-400 border-green-500/30',
  bond:          'bg-amber-500/15 text-amber-400 border-amber-500/30',
  crypto:        'bg-orange-500/15 text-orange-400 border-orange-500/30',
  other:         'bg-muted text-muted-foreground',
};

type AssetForm = {
  name: string; asset_type: string; institution: string; current_value: string;
  initial_investment: string; expected_return_pct: string; maturity_date: string;
  currency: string; notes: string;
};
const emptyForm: AssetForm = {
  name: '', asset_type: 'savings', institution: '', current_value: '', initial_investment: '',
  expected_return_pct: '', maturity_date: '', currency: 'USD', notes: '',
};

/** Compute expected value at maturity using compound interest */
function expectedAtMaturity(currentValue: number, annualReturn: number, maturityDate: string): number | null {
  if (!maturityDate || annualReturn <= 0 || currentValue <= 0) return null;
  const days  = differenceInDays(new Date(maturityDate), new Date());
  if (days <= 0) return null;
  const years = days / 365;
  return currentValue * Math.pow(1 + annualReturn / 100, years);
}

export default function WalletAssetsPage() {
  const { data, isLoading } = useWalletAssets();
  const { data: ratesData } = useExchangeRates();
  const rates = ratesData?.rates ?? { USD: 1 };
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();
  const deleteAsset = useDeleteAsset();

  const assets = data?.assets ?? [];

  const [showAdd, setShowAdd]         = useState(false);
  const [editAsset, setEditAsset]     = useState<any | null>(null);
  const [deleteId, setDeleteId]       = useState<string | null>(null);
  const [form, setForm]               = useState<AssetForm>(emptyForm);

  // Total in USD for the summary card
  const totalValue = assets.reduce((s: number, a: any) => {
    const usdRate = rates[a.currency] ?? 1;
    return s + Number(a.current_value) / usdRate;
  }, 0);

  const openAdd  = () => { setForm(emptyForm); setShowAdd(true); };
  const openEdit = (a: any) => {
    setForm({
      name: a.name, asset_type: a.asset_type, institution: a.institution ?? '',
      current_value: String(a.current_value), initial_investment: String(a.initial_investment ?? ''),
      expected_return_pct: String(a.expected_return_pct ?? ''), maturity_date: a.maturity_date ?? '',
      currency: a.currency, notes: a.notes ?? '',
    });
    setEditAsset(a);
  };

  const setF = (k: keyof AssetForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    try {
      const payload = {
        name: form.name, asset_type: form.asset_type, institution: form.institution || null,
        current_value: Number(form.current_value),
        initial_investment: form.initial_investment ? Number(form.initial_investment) : null,
        expected_return_pct: form.expected_return_pct ? Number(form.expected_return_pct) : null,
        maturity_date: form.maturity_date || null,
        currency: form.currency, notes: form.notes || null,
      };
      if (editAsset) {
        await updateAsset.mutateAsync({ id: editAsset.id, ...payload });
        toast.success('Asset updated');
        setEditAsset(null);
      } else {
        await createAsset.mutateAsync(payload);
        toast.success('Asset added');
        setShowAdd(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteAsset.mutateAsync(deleteId);
      toast.success('Asset deleted');
      setDeleteId(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
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
            <PiggyBank className="h-5 w-5 text-green-400" />
            <h1 className="text-2xl font-bold">Savings & Assets</h1>
          </div>
          <p className="text-sm text-muted-foreground">Savings products, investments, and deposits</p>
        </div>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="h-4 w-4" />Add
        </Button>
      </div>

      {/* Total */}
      {assets.length > 0 && (
        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Total Assets (USD)</p>
            <p className="text-2xl font-bold text-green-400">${Math.round(totalValue).toLocaleString()}</p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : assets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <PiggyBank className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No assets yet. Add savings products, investments, or deposits.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {assets.map((a: any) => {
            const ret = Number(a.expected_return_pct ?? 0);
            const mat = expectedAtMaturity(Number(a.current_value), ret, a.maturity_date);
            const gain = mat != null ? mat - Number(a.current_value) : null;
            return (
              <Card key={a.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-semibold">{a.name}</span>
                        <Badge variant="outline" className={`text-[10px] ${ASSET_COLORS[a.asset_type] ?? ''}`}>
                          {ASSET_LABELS[a.asset_type] ?? a.asset_type}
                        </Badge>
                      </div>
                      {a.institution && <p className="text-xs text-muted-foreground">{a.institution} · {a.currency}</p>}
                      <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {ret > 0 && <span className="text-green-400">+{ret}% p.a.</span>}
                        {a.maturity_date && <span>Matures {format(new Date(a.maturity_date), 'MMM d, yyyy')}</span>}
                        {mat != null && gain != null && (
                          <span className="text-green-400">
                            Expected at maturity: ${mat.toLocaleString(undefined, { maximumFractionDigits: 0 })} (+${gain.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold">{fmtNative(Number(a.current_value), a.currency)}</p>
                      {a.currency !== 'USD' && (
                        <p className="text-[10px] text-muted-foreground">{fmtUSDEquiv(Number(a.current_value), a.currency, rates)}</p>
                      )}
                      {a.initial_investment && Number(a.initial_investment) > 0 && (
                        <p className="text-[10px] text-muted-foreground">Initial: {fmtNative(Number(a.initial_investment), a.currency)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => openEdit(a)}>
                      <Pencil className="h-3 w-3" />Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => setDeleteId(a.id)}>
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
      <Dialog open={showAdd || !!editAsset} onOpenChange={v => { if (!v) { setShowAdd(false); setEditAsset(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editAsset ? 'Edit Asset' : 'Add Asset'}</DialogTitle>
            <DialogDescription>Savings product, investment, deposit, or other asset.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input placeholder="High-Yield Savings" value={form.name} onChange={e => setF('name', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={form.asset_type} onValueChange={v => setF('asset_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPES.map(t => <SelectItem key={t} value={t}>{ASSET_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Institution</Label>
                <Input placeholder="Optional" value={form.institution} onChange={e => setF('institution', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Currency</Label>
                <Select value={form.currency} onValueChange={v => setF('currency', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['USD','EUR','GBP','COP','MXN','BRL'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Current Value</Label>
                <Input type="number" placeholder="0" value={form.current_value} onChange={e => setF('current_value', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Initial Investment</Label>
                <Input type="number" placeholder="Optional" value={form.initial_investment} onChange={e => setF('initial_investment', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Expected Return (% p.a.)</Label>
                <Input type="number" step="0.01" placeholder="e.g. 5.5" value={form.expected_return_pct} onChange={e => setF('expected_return_pct', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Maturity Date</Label>
                <Input type="date" value={form.maturity_date} onChange={e => setF('maturity_date', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea placeholder="Optional notes…" rows={2} value={form.notes} onChange={e => setF('notes', e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditAsset(null); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={createAsset.isPending || updateAsset.isPending}>
              {(createAsset.isPending || updateAsset.isPending) ? <RefreshCw className="h-4 w-4 animate-spin" /> : editAsset ? 'Save' : 'Add Asset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Asset</DialogTitle>
            <DialogDescription>This will permanently delete this asset. Are you sure?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteAsset.isPending}>
              {deleteAsset.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
