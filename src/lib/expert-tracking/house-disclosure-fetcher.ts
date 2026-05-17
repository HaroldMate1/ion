/**
 * House Financial Disclosures Fetcher (Congressional Traders)
 *
 * Primary source: House Stock Watcher public API (housestockwatcher.com)
 *   — Aggregates all House member PTR filings, no key required.
 *
 * Fallback: House eFD direct search (disclosures.house.gov)
 *   — Fetches Pelosi's PTR XML directly from the House eFD system.
 *
 * Both sources cover Periodic Transaction Reports (PTRs) — the 30/45-day
 * disclosures Congress members must file for personal trades.
 */

import axios from 'axios';

export interface ActivityEvent {
  investorSlug: string;
  eventDate: string; // YYYY-MM-DD
  symbol: string;
  assetName: string;
  action: 'buy' | 'sell' | 'increase' | 'decrease' | 'new_position' | 'closed_position';
  amountRange: string | null;
  sharesChange: number | null;
  previousPct: number | null;
  newPct: number | null;
  source: 'ark_csv' | 'house_disclosure' | 'sec_13f';
  rawData: object;
}

// ── House Stock Watcher API ───────────────────────────────────────────────────
const HOUSE_STOCK_WATCHER_URL = 'https://housestockwatcher.com/api';

// ── Fallback: House eFD ───────────────────────────────────────────────────────
const HOUSE_EFD_BASE = 'https://disclosures.house.gov';
// Member ID for Nancy Pelosi in the House eFD system
const PELOSI_MEMBER_ID = 'P000197';
// Correct DocType for Periodic Transaction Reports
const PTR_DOC_TYPE = 'P';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HouseStockWatcherTx {
  transaction_date: string;
  ticker: string;
  representative: string;
  transaction_type: string;
  amount: string;
  asset_description: string;
  disclosure_date: string;
  disclosure_year: number;
  district: string;
  state: string;
  party: string;
  name?: string;
  comment?: string;
}

interface EFDFilingMeta {
  DocID: string;
  FilingDate: string;
  FilingType: string;
}

interface ParsedEFDTransaction {
  assetName: string;
  symbol: string;
  transactionType: string;
  transactionDate: string;
  amount: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeDate(raw: string): string {
  if (!raw) return new Date().toISOString().split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // MM/DD/YYYY
  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  return raw.slice(0, 10);
}

function mapTransactionType(type: string): ActivityEvent['action'] {
  const t = (type || '').toLowerCase();
  if (t.includes('purchase') || t.includes('buy')) return 'buy';
  if (t.includes('sale (partial)')) return 'decrease';
  if (t.includes('sale') || t.includes('sell')) return 'sell';
  if (t.includes('exchange')) return 'buy';
  return 'buy';
}

function extractTickerFromName(name: string): string {
  const match = name.match(/\(([A-Z]{1,5})\)/);
  return match ? match[1] : name.split(/\s+/)[0].toUpperCase().replace(/[^A-Z]/g, '');
}

// ── Primary: House Stock Watcher ──────────────────────────────────────────────

async function fetchViaHouseStockWatcher(
  cutoff: string,
): Promise<ActivityEvent[] | null> {
  try {
    const response = await axios.get(HOUSE_STOCK_WATCHER_URL, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; investment-tracker/1.0)',
        Accept: 'application/json',
      },
    });

    const raw = response.data;
    const transactions: HouseStockWatcherTx[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data)
        ? raw.data
        : [];

    if (transactions.length === 0) return null;

    // Filter for Pelosi
    const pelosiTxns = transactions.filter(tx => {
      const rep = (tx.representative || tx.name || '').toLowerCase();
      return rep.includes('pelosi');
    });

    const events: ActivityEvent[] = [];
    for (const tx of pelosiTxns) {
      const eventDate = normalizeDate(tx.transaction_date || tx.disclosure_date);
      if (eventDate < cutoff) continue;

      const rawTicker = (tx.ticker || '').toUpperCase().replace(/[^A-Z.]/g, '');
      if (!rawTicker || rawTicker === '-' || rawTicker.length > 6) continue;

      events.push({
        investorSlug: 'pelosi',
        eventDate,
        symbol: rawTicker,
        assetName: tx.asset_description || rawTicker,
        action: mapTransactionType(tx.transaction_type),
        amountRange: tx.amount || null,
        sharesChange: null,
        previousPct: null,
        newPct: null,
        source: 'house_disclosure',
        rawData: tx as object,
      });
    }

    console.log(
      `[House Disclosure] ${events.length} Pelosi transactions via House Stock Watcher`,
    );
    return events;
  } catch (err: any) {
    console.warn('[House Disclosure] House Stock Watcher failed:', err.message);
    return null;
  }
}

// ── Fallback: House eFD XML ───────────────────────────────────────────────────

function extractXmlTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
}

function extractAllXmlBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const blocks: string[] = [];
  let m;
  while ((m = re.exec(xml)) !== null) blocks.push(m[1]);
  return blocks;
}

function parseTxBlock(block: string): ParsedEFDTransaction {
  const assetName =
    extractXmlTag(block, 'AssetName') || extractXmlTag(block, 'Asset');
  const symbol =
    extractXmlTag(block, 'Ticker') ||
    extractXmlTag(block, 'Symbol') ||
    extractTickerFromName(assetName);
  const transactionType =
    extractXmlTag(block, 'TransactionType') ||
    extractXmlTag(block, 'Type') ||
    '';
  const transactionDate =
    extractXmlTag(block, 'TransactionDate') ||
    extractXmlTag(block, 'Date') ||
    '';
  const amount = extractXmlTag(block, 'Amount') || '';
  return { assetName, symbol, transactionType, transactionDate, amount };
}

function parseEFDXml(xml: string): ParsedEFDTransaction[] {
  const txBlocks = extractAllXmlBlocks(xml, 'Transaction');
  if (txBlocks.length > 0) return txBlocks.map(parseTxBlock);
  const newBlocks = extractAllXmlBlocks(xml, 'New');
  return newBlocks.map(parseTxBlock);
}

async function fetchEFDFilingList(year: number): Promise<EFDFilingMeta[]> {
  // Try multiple DocType values used by the House eFD system for PTRs
  const docTypes = [PTR_DOC_TYPE, 'PTR', 'PTRVL'];
  for (const docType of docTypes) {
    try {
      const url = `${HOUSE_EFD_BASE}/House/Search/ByMember?MemberId=${PELOSI_MEMBER_ID}&FilingYear=${year}&DocType=${docType}`;
      const resp = await axios.get(url, {
        timeout: 10000,
        headers: {
          Accept: 'application/json, text/html, */*',
          'User-Agent': 'Mozilla/5.0 (compatible; investment-tracker/1.0)',
        },
      });
      const data = resp.data;
      if (Array.isArray(data) && data.length > 0) return data;
      if (data?.results?.length) return data.results;
      if (data?.FilingSearchResult?.length) return data.FilingSearchResult;
    } catch {
      // Try next DocType
    }
  }
  return [];
}

async function fetchEFDXml(year: number, docId: string): Promise<string | null> {
  // Try multiple URL patterns for PTR XML documents
  const patterns = [
    `${HOUSE_EFD_BASE}/public_disc/ptr-pdfs/${year}/${docId}.xml`,
    `${HOUSE_EFD_BASE}/HouseDisclosures/MBXml/FD/${year}/${docId}.xml`,
    `${HOUSE_EFD_BASE}/HouseDisclosures/MBXml/FD/${year}FD/${docId}.xml`,
    `${HOUSE_EFD_BASE}/public_disc/financial-pdfs/${year}/${docId}.xml`,
  ];
  for (const url of patterns) {
    try {
      const r = await axios.get(url, {
        timeout: 10000,
        responseType: 'text',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; investment-tracker/1.0)' },
      });
      const xml: string = r.data;
      if (xml.includes('<') && xml.length > 100) return xml;
    } catch {
      // Try next pattern
    }
  }
  return null;
}

async function fetchViaHouseEFD(cutoff: string): Promise<ActivityEvent[]> {
  const currentYear = new Date().getFullYear();
  const years = [currentYear];
  if (new Date().getMonth() < 2) years.push(currentYear - 1);

  const allFilings: EFDFilingMeta[] = [];
  for (const year of years) {
    const filings = await fetchEFDFilingList(year);
    allFilings.push(...filings);
  }

  if (allFilings.length === 0) {
    console.log('[House Disclosure] No PTR filings found via eFD fallback');
    return [];
  }

  const sorted = allFilings
    .filter(f => f.DocID && f.FilingDate)
    .sort((a, b) => normalizeDate(b.FilingDate).localeCompare(normalizeDate(a.FilingDate)))
    .slice(0, 5);

  const events: ActivityEvent[] = [];
  for (const filing of sorted) {
    const filingDate = normalizeDate(filing.FilingDate);
    if (filingDate < cutoff) continue;

    const year = new Date(filingDate).getFullYear();
    const xml = await fetchEFDXml(year, filing.DocID);
    if (!xml) continue;

    const txns = parseEFDXml(xml);
    for (const tx of txns) {
      const eventDate = normalizeDate(tx.transactionDate) || filingDate;
      const symbol = tx.symbol || extractTickerFromName(tx.assetName);
      if (!symbol || symbol.length > 6) continue;

      events.push({
        investorSlug: 'pelosi',
        eventDate,
        symbol: symbol.toUpperCase(),
        assetName: tx.assetName || symbol,
        action: mapTransactionType(tx.transactionType),
        amountRange: tx.amount || null,
        sharesChange: null,
        previousPct: null,
        newPct: null,
        source: 'house_disclosure',
        rawData: { ...tx, filingDate, docId: filing.DocID },
      });
    }
  }

  console.log(`[House Disclosure] ${events.length} Pelosi transactions via eFD fallback`);
  return events;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Fetch Pelosi's recent congressional stock disclosures.
 * Uses House Stock Watcher API (primary) → House eFD XML (fallback).
 * Only returns transactions on or after `lastKnownDate` (default: last 90 days).
 */
export async function fetchHouseDisclosureActivity(
  lastKnownDate?: string,
): Promise<ActivityEvent[]> {
  const cutoff =
    lastKnownDate ??
    (() => {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      return d.toISOString().split('T')[0];
    })();

  // Try primary source first
  const primary = await fetchViaHouseStockWatcher(cutoff);
  if (primary !== null) return primary;

  // Fallback to House eFD direct API
  try {
    return await fetchViaHouseEFD(cutoff);
  } catch (err: any) {
    console.error('[House Disclosure] All sources failed:', err.message);
    return [];
  }
}
