/**
 * Wallet Feature Hooks
 * Bank accounts, snapshots, assets, pensions, subscriptions, summary.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ─── DCA Plans ────────────────────────────────────────────────────────────────

export function useWalletDCA() {
  return useQuery({
    queryKey: ['wallet-dca'],
    queryFn: async () => {
      const res = await fetch('/api/wallet/dca');
      if (!res.ok) throw new Error('Failed to fetch DCA plans');
      return res.json();
    },
  });
}

export function useCreateDCA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/wallet/dca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet-dca'] });
      qc.invalidateQueries({ queryKey: ['wallet-summary'] });
    },
  });
}

export function useUpdateDCA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown>) => {
      const res = await fetch(`/api/wallet/dca/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet-dca'] });
      qc.invalidateQueries({ queryKey: ['wallet-summary'] });
    },
  });
}

export function useDeleteDCA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/wallet/dca/${id}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet-dca'] });
      qc.invalidateQueries({ queryKey: ['wallet-summary'] });
    },
  });
}

// ─── Exchange Rates ───────────────────────────────────────────────────────────

export function useExchangeRates() {
  return useQuery({
    queryKey: ['wallet-rates'],
    queryFn: async () => {
      const res = await fetch('/api/wallet/rates');
      if (!res.ok) return { rates: { USD: 1 } as Record<string, number> };
      return res.json() as Promise<{ rates: Record<string, number> }>;
    },
    staleTime: 3_600_000, // 1 hour
  });
}

/** Format amount in its native currency using the browser Intl API */
export function fmtNative(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency,
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

/** If currency is not USD, return "≈ $X" string for the USD equivalent */
export function fmtUSDEquiv(amount: number, currency: string, rates: Record<string, number>): string | null {
  if (!currency || currency === 'USD') return null;
  const rate = rates[currency];
  if (!rate) return null;
  const usd = amount / rate;
  return `≈ $${Math.round(usd).toLocaleString()}`;
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export function useWalletSummary() {
  return useQuery({
    queryKey: ['wallet-summary'],
    queryFn: async () => {
      const res = await fetch('/api/wallet/summary');
      if (!res.ok) throw new Error('Failed to fetch wallet summary');
      return res.json();
    },
    refetchInterval: 60_000,
  });
}

// ─── Bank Accounts ────────────────────────────────────────────────────────────

export function useWalletAccounts() {
  return useQuery({
    queryKey: ['wallet-accounts'],
    queryFn: async () => {
      const res = await fetch('/api/wallet/accounts');
      if (!res.ok) throw new Error('Failed to fetch accounts');
      return res.json();
    },
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/wallet/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet-accounts'] });
      qc.invalidateQueries({ queryKey: ['wallet-summary'] });
    },
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown>) => {
      const res = await fetch(`/api/wallet/accounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet-accounts'] });
      qc.invalidateQueries({ queryKey: ['wallet-summary'] });
    },
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/wallet/accounts/${id}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet-accounts'] });
      qc.invalidateQueries({ queryKey: ['wallet-snapshots'] });
      qc.invalidateQueries({ queryKey: ['wallet-summary'] });
    },
  });
}

// ─── Snapshots ────────────────────────────────────────────────────────────────

export function useWalletSnapshots() {
  return useQuery({
    queryKey: ['wallet-snapshots'],
    queryFn: async () => {
      const res = await fetch('/api/wallet/snapshots');
      if (!res.ok) throw new Error('Failed to fetch snapshots');
      return res.json();
    },
  });
}

export function useAddSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ accountId, formData }: { accountId: string; formData: FormData }) => {
      const res = await fetch(`/api/wallet/accounts/${accountId}/snapshot`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet-accounts'] });
      qc.invalidateQueries({ queryKey: ['wallet-snapshots'] });
      qc.invalidateQueries({ queryKey: ['wallet-summary'] });
    },
  });
}

// ─── Assets ───────────────────────────────────────────────────────────────────

export function useWalletAssets() {
  return useQuery({
    queryKey: ['wallet-assets'],
    queryFn: async () => {
      const res = await fetch('/api/wallet/assets');
      if (!res.ok) throw new Error('Failed to fetch assets');
      return res.json();
    },
  });
}

export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/wallet/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet-assets'] });
      qc.invalidateQueries({ queryKey: ['wallet-summary'] });
    },
  });
}

export function useUpdateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown>) => {
      const res = await fetch(`/api/wallet/assets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet-assets'] });
      qc.invalidateQueries({ queryKey: ['wallet-summary'] });
    },
  });
}

export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/wallet/assets/${id}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet-assets'] });
      qc.invalidateQueries({ queryKey: ['wallet-summary'] });
    },
  });
}

// ─── Pensions ─────────────────────────────────────────────────────────────────

export function useWalletPensions() {
  return useQuery({
    queryKey: ['wallet-pensions'],
    queryFn: async () => {
      const res = await fetch('/api/wallet/pensions');
      if (!res.ok) throw new Error('Failed to fetch pensions');
      return res.json();
    },
  });
}

export function useCreatePension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/wallet/pensions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet-pensions'] });
      qc.invalidateQueries({ queryKey: ['wallet-summary'] });
    },
  });
}

export function useUpdatePension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown>) => {
      const res = await fetch(`/api/wallet/pensions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet-pensions'] });
      qc.invalidateQueries({ queryKey: ['wallet-summary'] });
    },
  });
}

export function useDeletePension() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/wallet/pensions/${id}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet-pensions'] });
      qc.invalidateQueries({ queryKey: ['wallet-summary'] });
    },
  });
}

// ─── Crypto ───────────────────────────────────────────────────────────────────

export function useWalletCrypto() {
  return useQuery({
    queryKey: ['wallet-crypto'],
    queryFn: async () => {
      const res = await fetch('/api/wallet/crypto');
      if (!res.ok) throw new Error('Failed to fetch crypto holdings');
      return res.json();
    },
  });
}

export function useCreateCrypto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/wallet/crypto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet-crypto'] });
      qc.invalidateQueries({ queryKey: ['wallet-summary'] });
    },
  });
}

export function useUpdateCrypto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown>) => {
      const res = await fetch(`/api/wallet/crypto/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet-crypto'] });
      qc.invalidateQueries({ queryKey: ['wallet-summary'] });
    },
  });
}

export function useDeleteCrypto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/wallet/crypto/${id}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet-crypto'] });
      qc.invalidateQueries({ queryKey: ['wallet-summary'] });
    },
  });
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export function useWalletSubscriptions() {
  return useQuery({
    queryKey: ['wallet-subscriptions'],
    queryFn: async () => {
      const res = await fetch('/api/wallet/subscriptions');
      if (!res.ok) throw new Error('Failed to fetch subscriptions');
      return res.json();
    },
  });
}

export function useCreateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/wallet/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet-subscriptions'] });
      qc.invalidateQueries({ queryKey: ['wallet-summary'] });
    },
  });
}

export function useUpdateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown>) => {
      const res = await fetch(`/api/wallet/subscriptions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet-subscriptions'] });
      qc.invalidateQueries({ queryKey: ['wallet-summary'] });
    },
  });
}

export function useDeleteSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/wallet/subscriptions/${id}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet-subscriptions'] });
      qc.invalidateQueries({ queryKey: ['wallet-summary'] });
    },
  });
}
