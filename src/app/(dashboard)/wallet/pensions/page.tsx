'use client';

/**
 * Wallet — Pension Accounts Page
 */

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Landmark, Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { useWalletPensions, useCreatePension, useUpdatePension, useDeletePension, useExchangeRates, fmtNative, fmtUSDEquiv } from '@/hooks/use-wallet';

type PensionForm = {
  name: string; provider: string; account_number: string; current_value: string;
  monthly_contribution: string; employer_contribution: string;
  expected_retirement_age: string; currency: string; notes: string;
};
const emptyForm: PensionForm = {
  name: '', provider: '', account_number: '', current_value: '0',
  monthly_contribution: '0', employer_contribution: '0',
  expected_retirement_age: '65', currency: 'USD', notes: '',
};

/** Project pension value at retirement age assuming a 6% annual growth */
function projectAtRetirement(current: number, monthly: number, employer: number, retirementAge: number): { years: number; total: number } | null {
  const today = new Date();
  const yearsLeft = retirementAge - (today.getFullYear() - 1990); // rough; not using user DOB
  if (yearsLeft <= 0 || retirementAge <= 0) return null;
  const annualRate  = 0.06;
  const monthlyRate = annualRate / 12;
  const months = yearsLeft * 12;
  const monthlyTotal = monthly + employer;
  // Future value of current lump sum + annuity
  const fvLump    = current * Math.pow(1 + annualRate, yearsLeft);
  const fvAnnuity = monthlyTotal > 0 ? monthlyTotal * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) : 0;
  return { years: yearsLeft, total: fvLump + fvAnnuity };
}

export default function WalletPensionsPage() {
  const { data, isLoading } = useWalletPensions();
  const { data: ratesData } = useExchangeRates();
  const rates = ratesData?.rates ?? { USD: 1 };
  const createPension = useCreatePension();
  const updatePension = useUpdatePension();
  const deletePension = useDeletePension();

  const pensions = data?.pensions ?? [];
  const [showAdd, setShowAdd]         = useState(false);
  const [editPension, setEditPension] = useState<any | null>(null);
  const [deleteId, setDeleteId]       = useState<string | null>(null);
  const [form, setForm]               = useState<PensionForm>(emptyForm);

  const totalValue = pensions.reduce((s: number, p: any) => s + Number(p.current_value) / (rates[p.currency] ?? 1), 0);
  const totalMonthly = pensions.reduce((s: number, p: any) => s + (Number(p.monthly_contribution) + Number(p.employer_contribution)) / (rates[p.currency] ?? 1), 0);

  const setF = (k: keyof PensionForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const openAdd  = () => { setForm(emptyForm); setShowAdd(true); };
  const openEdit = (p: any) => {
    setForm({
      name: p.name, provider: p.provider, account_number: p.account_number ?? '',
      current_value: String(p.current_value), monthly_contribution: String(p.monthly_contribution),
      employer_contribution: String(p.employer_contribution),
      expected_retirement_age: String(p.expected_retirement_age ?? 65),
      currency: p.currency, notes: p.notes ?? '',
    });
    setEditPension(p);
  };

  const handleSave = async () => {
    try {
      const payload = {
        name: form.name, provider: form.provider,
        account_number: form.account_number || null,
        current_value: Number(form.current_value),
        monthly_contribution: Number(form.monthly_contribution),
        employer_contribution: Number(form.employer_contribution),
        expected_retirement_age: Number(form.expected_retirement_age) || null,
        currency: form.currency, notes: form.notes || null,
      };
      if (editPension) {
        await updatePension.mutateAsync({ id: editPension.id, ...payload });
        toast.success('Pension updated');
        setEditPension(null);
      } else {
        await createPension.mutateAsync(payload);
        toast.success('Pension added');
        setShowAdd(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deletePension.mutateAsync(deleteId);
      toast.success('Pension deleted');
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
            <Landmark className="h-5 w-5 text-amber-400" />
            <h1 className="text-2xl font-bold">Pensions</h1>
          </div>
          <p className="text-sm text-muted-foreground">Retirement and pension accounts</p>
        </div>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="h-4 w-4" />Add
        </Button>
      </div>

      {/* Totals */}
      {pensions.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-amber-500/5 border-amber-500/20">
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground">Total Value (USD)</p>
              <p className="text-xl font-bold text-amber-400">${Math.round(totalValue).toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground">Monthly Contributions (USD)</p>
              <p className="text-xl font-bold">${Math.round(totalMonthly).toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : pensions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Landmark className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No pension accounts yet. Add your retirement accounts here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pensions.map((p: any) => {
            const proj = projectAtRetirement(
              Number(p.current_value), Number(p.monthly_contribution),
              Number(p.employer_contribution), Number(p.expected_retirement_age ?? 65),
            );
            return (
              <Card key={p.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.provider} · {p.currency}</p>
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                        <span className="text-muted-foreground">Your contribution</span>
                        <span className="font-medium">{fmtNative(Number(p.monthly_contribution), p.currency)}/mo</span>
                        {Number(p.employer_contribution) > 0 && (
                          <>
                            <span className="text-muted-foreground">Employer</span>
                            <span className="font-medium">{fmtNative(Number(p.employer_contribution), p.currency)}/mo</span>
                          </>
                        )}
                        {p.expected_retirement_age && (
                          <>
                            <span className="text-muted-foreground">Retirement age</span>
                            <span className="font-medium">{p.expected_retirement_age}</span>
                          </>
                        )}
                        {proj && (
                          <>
                            <span className="text-muted-foreground">Projected total</span>
                            <span className="text-amber-400 font-medium">${proj.total.toLocaleString(undefined, { maximumFractionDigits: 0 })} in {proj.years}y</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold">{fmtNative(Number(p.current_value), p.currency)}</p>
                      {p.currency !== 'USD' && (
                        <p className="text-[10px] text-muted-foreground">{fmtUSDEquiv(Number(p.current_value), p.currency, rates)}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground">current value</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => openEdit(p)}>
                      <Pencil className="h-3 w-3" />Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => setDeleteId(p.id)}>
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
      <Dialog open={showAdd || !!editPension} onOpenChange={v => { if (!v) { setShowAdd(false); setEditPension(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editPension ? 'Edit Pension' : 'Add Pension'}</DialogTitle>
            <DialogDescription>Track your pension or retirement account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input placeholder="My Pension Plan" value={form.name} onChange={e => setF('name', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Provider</Label>
                <Input placeholder="Fidelity, Nest…" value={form.provider} onChange={e => setF('provider', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Account Number (optional)</Label>
                <Input value={form.account_number} onChange={e => setF('account_number', e.target.value)} />
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
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Current Value</Label>
                <Input type="number" value={form.current_value} onChange={e => setF('current_value', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Your Monthly</Label>
                <Input type="number" value={form.monthly_contribution} onChange={e => setF('monthly_contribution', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Employer Monthly</Label>
                <Input type="number" value={form.employer_contribution} onChange={e => setF('employer_contribution', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Expected Retirement Age</Label>
              <Input type="number" value={form.expected_retirement_age} onChange={e => setF('expected_retirement_age', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={e => setF('notes', e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditPension(null); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={createPension.isPending || updatePension.isPending}>
              {(createPension.isPending || updatePension.isPending) ? <RefreshCw className="h-4 w-4 animate-spin" /> : editPension ? 'Save' : 'Add Pension'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Pension</DialogTitle>
            <DialogDescription>This will permanently delete this pension account. Are you sure?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deletePension.isPending}>
              {deletePension.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
