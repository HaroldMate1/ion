import { NextResponse } from 'next/server';
import { getUSDRates } from '@/lib/wallet/currency';

export async function GET() {
  const rates = await getUSDRates();
  return NextResponse.json({ rates });
}
