'use client';

/**
 * Wallet — Subscriptions & Recurring Payments Page
 * Calendar view of upcoming payments + full list with add/edit/delete.
 */

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { format, addDays, differenceInDays, startOfToday } from 'date-fns';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft, CreditCard, Plus, Pencil, Trash2, RefreshCw, Calendar, AlertTriangle,
} from 'lucide-react';
import {
  useWalletSubscriptions, useCreateSubscription, useUpdateSubscription, useDeleteSubscription,
  useExchangeRates, fmtNative,
} from '@/hooks/use-wallet';

const CATEGORIES = ['entertainment','utilities','insurance','software','health','food','transport','other'];
const CAT_LABELS: Record<string, string> = {
  entertainment: 'Entertainment', utilities: 'Utilities', insurance: 'Insurance',
  software: 'Software', health: 'Health', food: 'Food', transport: 'Transport', other: 'Other',
};
const CAT_COLORS: Record<string, string> = {
  entertainment: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  utilities:     'bg-blue-500/15 text-blue-400 border-blue-500/30',
  insurance:     'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  software:      'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  health:        'bg-green-500/15 text-green-400 border-green-500/30',
  food:          'bg-amber-500/15 text-amber-400 border-amber-500/30',
  transport:     'bg-orange-500/15 text-orange-400 border-orange-500/30',
  other:         'bg-muted text-muted-foreground',
};
const CYCLE_LABELS: Record<string, string> = { monthly: '/mo', yearly: '/yr', weekly: '/wk', quarterly: '/qtr' };

function toMonthly(amount: number, cycle: string): number {
  switch (cycle) {
    case 'weekly':    return amount * 52 / 12;
    case 'yearly':    return amount / 12;
    case 'quarterly': return amount / 3;
    default:          return amount;
  }
}

type SubForm = {
  name: string; provider: string; category: string; amount: string;
  currency: string; billing_cycle: string; next_payment_date: string; notes: string;
};
const emptyForm: SubForm = {
  name: '', provider: '', category: 'entertainment', amount: '',
  currency: 'USD', billing_cycle: 'monthly',
  next_payment_date: format(addDays(new Date(), 30), 'yyyy-MM-dd'), notes: '',
};

// ── Calendar Component ────────────────────────────────────────────────────────
function FullCalendar({ subscriptions }: { subscriptions: any[] }) {
  const today = startOfToday();
  const days  = Array.from({ length: 42 }, (_, i) => addDays(today, i - today.getDay())); // full 6-week grid

  const paymentsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const sub of subscriptions.filter(s => s.is_active)) {
      const key = sub.next_payment_date;
      if (!map[key]) map[key] = [];
      map[key].push(sub);
    }
    return map;
  }, [subscriptions]);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1 text-center">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="text-[9px] text-muted-foreground/60 font-medium pb-1">{d}</div>
        ))}
        {days.map((day) => {
          const key  = format(day, 'yyyy-MM-dd');
          const subs = paymentsByDate[key] ?? [];
          const isToday = key === format(today, 'yyyy-MM-dd');
          const isPast  = day < today;
          const diff    = differenceInDays(day, today);
          const isUrgent = diff >= 0 && diff <= 3;
          return (
            <div
              key={key}
              title={subs.map(s => `${s.name} — ${s.currency} ${s.amount}`).join('\n')}
              className={`
                relative flex flex-col items-center py-1.5 rounded-lg text-[10px] cursor-default
                ${isToday ? 'bg-primary/20 text-primary font-bold ring-1 ring-primary/30' : ''}
                ${isPast && !isToday ? 'opacity-30' : ''}
                ${!isToday && !isPast ? 'text-foreground/70' : ''}
                ${subs.length > 0 && isUrgent ? 'bg-amber-500/10 ring-1 ring-amber-500/30' : ''}
              `}
            >
              {format(day, 'd')}
              {subs.length > 0 && (
                <div className="mt-0.5 flex gap-0.5 flex-wrap justify-center">
                  {subs.slice(0, 3).map((s, i) => (
                    <div key={i} className={`h-1.5 w-1.5 rounded-full ${isUrgent ? 'bg-amber-400' : 'bg-primary/60'}`} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function WalletSubscriptionsPage() {
  const { data, isLoading }     = useWalletSubscriptions();
  const { data: ratesData }     = useExchangeRates();
  const rates = ratesData?.rates ?? { USD: 1 };
  const createSub = useCreateSubscription();
  const updateSub = useUpdateSubscription();
  const deleteSub = useDeleteSubscription();

  const subs = data?.subscriptions ?? [];

  const [showAdd, setShowAdd]     = useState(false);
  const [editSub, setEditSub]     = useState<any | null>(null);
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [form, setForm]           = useState<SubForm>(emptyForm);

  const today = startOfToday();

  // Monthly total in USD
  const monthlyTotal = subs
    .filter((s: any) => s.is_active)
    .reduce((sum: number, s: any) => sum + toMonthly(Number(s.amount), s.billing_cycle) / (rates[s.currency] ?? 1), 0);

  // Urgent (due within 7 days)
  const urgent = subs.filter((s: any) => {
    if (!s.is_active) return false;
    const diff = differenceInDays(new Date(s.next_payment_date), today);
    return diff >= 0 && diff <= 7;
  });

  const setF = (k: keyof SubForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const openAdd  = () => { setForm(emptyForm); setShowAdd(true); };
  const openEdit = (s: any) => {
    setForm({
      name: s.name, provider: s.provider ?? '', category: s.category, amount: String(s.amount),
      currency: s.currency, billing_cycle: s.billing_cycle,
      next_payment_date: s.next_payment_date, notes: s.notes ?? '',
    });
    setEditSub(s);
  };

  const handleSave = async () => {
    try {
      const payload = {
        name: form.name, provider: form.provider || null, category: form.category,
        amount: Number(form.amount), currency: form.currency, billing_cycle: form.billing_cycle,
        next_payment_date: form.next_payment_date, notes: form.notes || null,
      };
      if (editSub) {
        await updateSub.mutateAsync({ id: editSub.id, ...payload });
        toast.success('Subscription updated');
        setEditSub(null);
      } else {
        await createSub.mutateAsync(payload);
        toast.success('Subscription added');
        setShowAdd(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    }
  };

  const handleToggleActive = async (sub: any) => {
    try {
      await updateSub.mutateAsync({ id: sub.id, is_active: !sub.is_active });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteSub.mutateAsync(deleteId);
      toast.success('Subscription deleted');
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
            <CreditCard className="h-5 w-5 text-purple-400" />
            <h1 className="text-2xl font-bold">Subscriptions</h1>
          </div>
          <p className="text-sm text-muted-foreground">Recurring payments & payment calendar</p>
        </div>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="h-4 w-4" />Add
        </Button>
      </div>

      {/* Summary */}
      {subs.length > 0 && (
        <Card className="bg-purple-500/5 border-purple-500/20">
          <CardContent className="pt-3 pb-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Active Monthly Cost (USD)</p>
              <p className="text-2xl font-bold text-purple-400">${monthlyTotal.toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Annual (USD)</p>
              <p className="text-lg font-semibold">${(monthlyTotal * 12).toFixed(0)}/yr</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Urgent alert */}
      {urgent.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <div className="text-sm text-amber-400">
            <strong>Payment due soon:</strong>{' '}
            {urgent.map((s: any, i: number) => (
              <span key={s.id}>
                {s.name} on {format(new Date(s.next_payment_date), 'MMM d')} ({fmtNative(Number(s.amount), s.currency)}){i < urgent.length - 1 ? ' · ' : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Calendar */}
      {subs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-400" />
              Payment Calendar
            </CardTitle>
            <CardDescription>6-week view — dots indicate payment dates</CardDescription>
          </CardHeader>
          <CardContent>
            <FullCalendar subscriptions={subs} />
          </CardContent>
        </Card>
      )}

      {/* List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-purple-400" />
            All Subscriptions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : subs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No subscriptions yet. Add streaming, utilities, or any recurring payment.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {subs.map((s: any) => {
                const diff = differenceInDays(new Date(s.next_payment_date), today);
                const isUrgent = diff >= 0 && diff <= 7;
                return (
                  <div key={s.id} className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${isUrgent && s.is_active ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/[0.06]'} ${!s.is_active ? 'opacity-50' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{s.name}</span>
                        <Badge variant="outline" className={`text-[10px] ${CAT_COLORS[s.category] ?? ''}`}>
                          {CAT_LABELS[s.category] ?? s.category}
                        </Badge>
                        {isUrgent && s.is_active && (
                          <Badge variant="outline" className="text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/30">
                            Due {diff === 0 ? 'today' : `in ${diff}d`}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {s.provider && `${s.provider} · `}
                        Next: {format(new Date(s.next_payment_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-sm">{fmtNative(Number(s.amount), s.currency)}{CYCLE_LABELS[s.billing_cycle] ?? ''}</p>
                      {s.currency !== 'USD' && (
                        <p className="text-[10px] text-muted-foreground">≈ ${(toMonthly(Number(s.amount), s.billing_cycle) / (rates[s.currency] ?? 1)).toFixed(0)}/mo USD</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      <Switch
                        checked={s.is_active}
                        onCheckedChange={() => handleToggleActive(s)}
                        className="scale-75"
                        title="Toggle active"
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(s)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(s.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showAdd || !!editSub} onOpenChange={v => { if (!v) { setShowAdd(false); setEditSub(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editSub ? 'Edit Subscription' : 'Add Subscription'}</DialogTitle>
            <DialogDescription>Streaming, utility, insurance, or any recurring payment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input placeholder="Netflix, Spotify…" value={form.name} onChange={e => setF('name', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Provider (optional)</Label>
                <Input placeholder="Netflix" value={form.provider} onChange={e => setF('provider', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={form.category} onValueChange={v => setF('category', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{CAT_LABELS[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Billing Cycle</Label>
                <Select value={form.billing_cycle} onValueChange={v => setF('billing_cycle', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['monthly','yearly','weekly','quarterly'].map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Amount</Label>
                <Input type="number" step="0.01" placeholder="9.99" value={form.amount} onChange={e => setF('amount', e.target.value)} />
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
              <div className="space-y-1">
                <Label className="text-xs">Next Payment</Label>
                <Input type="date" value={form.next_payment_date} onChange={e => setF('next_payment_date', e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditSub(null); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={createSub.isPending || updateSub.isPending}>
              {(createSub.isPending || updateSub.isPending) ? <RefreshCw className="h-4 w-4 animate-spin" /> : editSub ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Subscription</DialogTitle>
            <DialogDescription>This will permanently delete this subscription. Are you sure?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteSub.isPending}>
              {deleteSub.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
