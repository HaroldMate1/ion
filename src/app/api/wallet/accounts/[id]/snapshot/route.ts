import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/wallet/accounts/[id]/snapshot
 * Add (or replace) a monthly balance snapshot.
 * Accepts multipart/form-data with:
 *   - balance: number (required, user-confirmed value)
 *   - month: string "YYYY-MM" (required)
 *   - file?: File (optional CSV/PDF — stored as filename only)
 *   - notes?: string
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    // Verify account belongs to user
    const { data: account } = await (supabase.from('wallet_bank_account') as any)
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const formData = await request.formData();
    const balance = Number(formData.get('balance'));
    const month = formData.get('month') as string; // "YYYY-MM"
    const file = formData.get('file') as File | null;
    const notes = formData.get('notes') as string | null;

    if (!month || isNaN(balance)) {
      return NextResponse.json({ error: 'balance and month are required' }, { status: 400 });
    }

    const snapshotMonth = `${month}-01`; // first day of month
    const source = file ? (file.name.endsWith('.pdf') ? 'pdf_upload' : 'csv_upload') : 'manual';

    // Try to parse CSV if provided
    let parsedBalance: number | null = null;
    if (file && source === 'csv_upload') {
      const text = await file.text();
      parsedBalance = parseBalanceFromCSV(text);
    }

    // Upsert snapshot
    const { error } = await (supabase.from('wallet_monthly_snapshot') as any)
      .upsert({
        user_id: user.id,
        account_id: id,
        snapshot_month: snapshotMonth,
        balance,
        source,
        raw_filename: file?.name ?? null,
        notes: notes ?? null,
      }, { onConflict: 'account_id,snapshot_month' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update account's current_balance if this is the latest month
    await (supabase.from('wallet_bank_account') as any)
      .update({ current_balance: balance, last_updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);

    return NextResponse.json({ success: true, parsedBalance });
  } catch (err) {
    console.error('Snapshot POST error:', err);
    return NextResponse.json({ error: 'Failed to add snapshot' }, { status: 500 });
  }
}

/** Attempt to extract a balance figure from a CSV bank export */
function parseBalanceFromCSV(csv: string): number | null {
  const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
  // Look for lines containing "balance" keyword
  for (const line of lines.reverse()) {
    const lower = line.toLowerCase();
    if (lower.includes('balance') || lower.includes('saldo')) {
      const match = line.match(/[-]?\d[\d,]*\.?\d*/);
      if (match) {
        const val = parseFloat(match[0].replace(/,/g, ''));
        if (!isNaN(val)) return val;
      }
    }
  }
  // Fallback: last numeric value in file
  for (const line of lines.reverse()) {
    const match = line.match(/[-]?\d[\d,]*\.\d{2}/);
    if (match) {
      const val = parseFloat(match[0].replace(/,/g, ''));
      if (!isNaN(val)) return val;
    }
  }
  return null;
}
