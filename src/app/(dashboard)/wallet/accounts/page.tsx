'use client';

/**
 * Wallet — Bank Accounts Page
 * List accounts, add/edit/delete, upload monthly extracts (CSV/PDF) or manual entry.
 */

import Link from 'next/link';
import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft, Building2, Plus, Pencil, Trash2, RefreshCw, Upload, Calendar,
} from 'lucide-react';
import {
  useWalletAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount, useAddSnapshot,
  useExchangeRates, fmtNative, fmtUSDEquiv,
} from '@/hooks/use-wallet';

type AccountForm = {
  name: string; institution: string; account_type: string; currency: string; current_balance: string;
};
const emptyForm: AccountForm = { name: '', institution: '', account_type: 'checking', currency: 'USD', current_balance: '0' };

type SnapshotForm = { month: string; balance: string; notes: string };

export default function WalletAccountsPage() {
  const { data, isLoading } = useWalletAccounts();
  const { data: ratesData } = useExchangeRates();
  const rates = ratesData?.rates ?? { USD: 1 };
  const createAccount   = useCreateAccount();
  const updateAccount   = useUpdateAccount();
  const deleteAccount   = useDeleteAccount();
  const addSnapshot     = useAddSnapshot();

  const accounts = data?.accounts ?? [];

  const [showAdd, setShowAdd]         = useState(false);
  const [editAccount, setEditAccount] = useState<any | null>(null);
  const [deleteId, setDeleteId]       = useState<string | null>(null);
  const [snapshotFor, setSnapshotFor] = useState<any | null>(null);

  const [form, setForm]         = useState<AccountForm>(emptyForm);
  const [snapForm, setSnapForm] = useState<SnapshotForm>({ month: format(new Date(), 'yyyy-MM'), balance: '', notes: '' });
  const [snapFile, setSnapFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const openAdd  = () => { setForm(emptyForm); setShowAdd(true); };
  const openEdit = (acc: any) => {
    setForm({ name: acc.name, institution: acc.institution, account_type: acc.account_type, currency: acc.currency, current_balance: String(acc.current_balance) });
    setEditAccount(acc);
  };

  const handleSave = async () => {
    try {
      const payload = { ...form, current_balance: Number(form.current_balance) };
      if (editAccount) {
        await updateAccount.mutateAsync({ id: editAccount.id, ...payload });
        toast.success('Account updated');
        setEditAccount(null);
      } else {
        await createAccount.mutateAsync(payload);
        toast.success('Account added');
        setShowAdd(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save account');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteAccount.mutateAsync(deleteId);
      toast.success('Account deleted');
      setDeleteId(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const handleAddSnapshot = async () => {
    if (!snapshotFor || !snapForm.balance) return;
    try {
      const fd = new FormData();
      fd.append('balance', snapForm.balance);
      fd.append('month',   snapForm.month);
      if (snapForm.notes)  fd.append('notes', snapForm.notes);
      if (snapFile)        fd.append('file', snapFile);

      const res = await addSnapshot.mutateAsync({ accountId: snapshotFor.id, formData: fd });
      toast.success('Snapshot saved' + (res.parsedBalance != null ? ` — parsed balance: $${res.parsedBalance}` : ''));
      setSnapshotFor(null);
      setSnapFile(null);
      setSnapForm({ month: format(new Date(), 'yyyy-MM'), balance: '', notes: '' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to add snapshot');
    }
  };

  const accountTypeLabel: Record<string, string> = { checking: 'Checking', savings: 'Savings', credit: 'Credit', investment: 'Investment' };

  return (
    <div className="container mx-auto py-4 md:py-6 space-y-4 px-2 md:px-0">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/wallet">
          <Button variant="ghost" size="icon" className="shrink-0"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-400" />
            <h1 className="text-2xl font-bold">Bank Accounts</h1>
          </div>
          <p className="text-sm text-muted-foreground">Track your bank balances and upload monthly extracts</p>
        </div>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="h-4 w-4" />Add
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No bank accounts yet. Add your first account to start tracking.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {accounts.map((acc: any) => (
            <Card key={acc.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{acc.name}</span>
                      <Badge variant="outline" className="text-[10px]">{accountTypeLabel[acc.account_type] ?? acc.account_type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{acc.institution} · {acc.currency}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{fmtNative(Number(acc.current_balance), acc.currency)}</p>
                    {acc.currency !== 'USD' && (
                      <p className="text-[10px] text-muted-foreground">{fmtUSDEquiv(Number(acc.current_balance), acc.currency, rates)}</p>
                    )}
                    {acc.last_updated_at && (
                      <p className="text-[10px] text-muted-foreground">Updated {format(new Date(acc.last_updated_at), 'MMM d')}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setSnapshotFor(acc); setSnapForm({ month: format(new Date(), 'yyyy-MM'), balance: String(acc.current_balance), notes: '' }); }}>
                    <Upload className="h-3 w-3" />Add Extract
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => openEdit(acc)}>
                    <Pencil className="h-3 w-3" />Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => setDeleteId(acc.id)}>
                    <Trash2 className="h-3 w-3" />Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Account Dialog */}
      <Dialog open={showAdd || !!editAccount} onOpenChange={v => { if (!v) { setShowAdd(false); setEditAccount(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editAccount ? 'Edit Account' : 'Add Bank Account'}</DialogTitle>
            <DialogDescription>Enter your account details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Account Name</Label>
                <Input placeholder="Main Checking" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Institution</Label>
                <Input placeholder="Chase, BBVA…" value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={form.account_type} onValueChange={v => setForm(f => ({ ...f, account_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['checking','savings','credit','investment'].map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Currency</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['USD','EUR','GBP','COP','MXN','BRL'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Current Balance</Label>
                <Input type="number" placeholder="0" value={form.current_balance} onChange={e => setForm(f => ({ ...f, current_balance: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditAccount(null); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={createAccount.isPending || updateAccount.isPending}>
              {(createAccount.isPending || updateAccount.isPending) ? <RefreshCw className="h-4 w-4 animate-spin" /> : editAccount ? 'Save' : 'Add Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>This will delete the account and all its snapshots. Are you sure?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteAccount.isPending}>
              {deleteAccount.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Snapshot Dialog */}
      <Dialog open={!!snapshotFor} onOpenChange={v => !v && setSnapshotFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Monthly Extract — {snapshotFor?.name}</DialogTitle>
            <DialogDescription>Upload a CSV or PDF bank extract, or enter the balance manually.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Month</Label>
                <Input type="month" value={snapForm.month} onChange={e => setSnapForm(f => ({ ...f, month: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Balance (confirmed)</Label>
                <Input type="number" placeholder="0.00" value={snapForm.balance} onChange={e => setSnapForm(f => ({ ...f, balance: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Upload Extract (optional — CSV or PDF)</Label>
              <div
                className="border border-dashed border-white/20 rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                {snapFile ? (
                  <p className="text-sm text-primary">{snapFile.name}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Click to upload CSV or PDF</p>
                )}
                <input ref={fileRef} type="file" accept=".csv,.pdf" className="hidden"
                  onChange={e => setSnapFile(e.target.files?.[0] ?? null)} />
              </div>
              {snapFile?.name.endsWith('.pdf') && (
                <p className="text-[10px] text-muted-foreground">PDF uploaded for record-keeping. Please confirm the balance manually above.</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes (optional)</Label>
              <Input placeholder="e.g. End of month balance" value={snapForm.notes} onChange={e => setSnapForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSnapshotFor(null)}>Cancel</Button>
            <Button onClick={handleAddSnapshot} disabled={addSnapshot.isPending || !snapForm.balance}>
              {addSnapshot.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Save Snapshot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
