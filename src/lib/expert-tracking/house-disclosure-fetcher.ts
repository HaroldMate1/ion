/**
 * House Financial Disclosures Fetcher (Pelosi)
 * Fetches periodic transaction reports (PTRs) from House eFD system
 * No API key required — public government data
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
  source: 'ark_csv' | 'house_disclosure';
  rawData: object;
}

// Pelosi's Member ID in the House eFD system
const PELOSI_MEMBER_ID = 'P000197';
const HOUSE_EFD_BASE = 'https://disclosures.house.gov';

interface FilingMeta {
  DocID: string;
  FilingDate: string; // e.g. "01/15/2026"
  FilingType: string;
}

interface ParsedTransaction {
  assetName: string;
  symbol: string;
  transactionType: string; // "Purchase", "Sale (Full)", "Sale (Partial)", "Exchange"
  transactionDate: string;
  amount: string; // "$15,001 - $50,000"
}

/**
 * Fetch list of PTR filings for Pelosi from the House eFD API
 */
async function fetchFilingList(year: number): Promise<FilingMeta[]> {
  const url = `${HOUSE_EFD_BASE}/House/Search/ByMember?MemberId=${PELOSI_MEMBER_ID}&FilingYear=${year}&DocType=PTRVL`;
  const response = await axios.get(url, {
    timeout: 10000,
    headers: {
      'Accept': 'application/json, text/html, */*',
      'User-Agent': 'Mozilla/5.0 (compatible; investment-tracker/1.0)',
    },
  });

  // Response is JSON array or wrapped in an object
  const data = response.data;
  if (Array.isArray(data)) return data;
  if (data?.results && Array.isArray(data.results)) return data.results;
  if (data?.FilingSearchResult && Array.isArray(data.FilingSearchResult)) {
    return data.FilingSearchResult;
  }
  return [];
}

/**
 * Parse XML text to extract transactions using regex
 * Handles the House eFD XML format without a library
 */
function extractXmlTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
}

function extractAllXmlBlocks(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const blocks: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

function parseTransactions(xml: string): ParsedTransaction[] {
  // Try to find transaction blocks — PTR XML uses <Transaction> or <New> elements
  const txBlocks = extractAllXmlBlocks(xml, 'Transaction');
  if (txBlocks.length === 0) {
    // Some PTR formats use different tag names
    const newBlocks = extractAllXmlBlocks(xml, 'New');
    if (newBlocks.length > 0) {
      return newBlocks.map(block => parseTxBlock(block));
    }
    return [];
  }
  return txBlocks.map(block => parseTxBlock(block));
}

function parseTxBlock(block: string): ParsedTransaction {
  const assetName = extractXmlTag(block, 'AssetName') || extractXmlTag(block, 'Asset');
  const symbol = extractXmlTag(block, 'Ticker') ||
    extractXmlTag(block, 'Symbol') ||
    extractTickerFromName(assetName);
  const transactionType = extractXmlTag(block, 'TransactionType') ||
    extractXmlTag(block, 'Type') || '';
  const transactionDate = extractXmlTag(block, 'TransactionDate') ||
    extractXmlTag(block, 'Date') || '';
  const amount = extractXmlTag(block, 'Amount') || '';

  return { assetName, symbol, transactionType, transactionDate, amount };
}

/**
 * Try to extract a ticker from asset name like "Microsoft Corp (MSFT) Call"
 */
function extractTickerFromName(name: string): string {
  const match = name.match(/\(([A-Z]{1,5})\)/);
  return match ? match[1] : name.split(/\s+/)[0].toUpperCase().replace(/[^A-Z]/g, '');
}

/**
 * Normalize transaction date from various formats to YYYY-MM-DD
 */
function normalizeDate(raw: string): string {
  if (!raw) return new Date().toISOString().split('T')[0];
  // MM/DD/YYYY
  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return raw.slice(0, 10);
}

/**
 * Map House disclosure transaction type to our action type
 */
function mapAction(txType: string): ActivityEvent['action'] {
  const t = txType.toLowerCase();
  if (t.includes('purchase') || t.includes('buy')) return 'buy';
  if (t.includes('sale (partial)')) return 'decrease';
  if (t.includes('sale') || t.includes('sell')) return 'sell';
  if (t.includes('exchange')) return 'buy';
  return 'buy';
}

/**
 * Fetch and parse a single PTR XML document
 */
async function fetchAndParseXml(year: number, docId: string): Promise<ParsedTransaction[]> {
  // Try the XML document URL
  const xmlUrl = `${HOUSE_EFD_BASE}/HouseDisclosures/MBXml/FD/${year}/${docId}.xml`;
  try {
    const response = await axios.get(xmlUrl, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; investment-tracker/1.0)' },
      responseType: 'text',
    });
    return parseTransactions(response.data as string);
  } catch {
    // Some filings are only available as HTML — try alternate URL pattern
    try {
      const htmlUrl = `${HOUSE_EFD_BASE}/HouseDisclosures/MBXml/FD/${year}FD/${docId}.xml`;
      const r2 = await axios.get(htmlUrl, { timeout: 10000, responseType: 'text' });
      return parseTransactions(r2.data as string);
    } catch {
      return [];
    }
  }
}

/**
 * Main export: fetch Pelosi's recent House disclosure trades
 * Only fetches filings from the last 90 days to avoid re-processing old data
 */
export async function fetchHouseDisclosureActivity(
  lastKnownDate?: string
): Promise<ActivityEvent[]> {
  try {
    const currentYear = new Date().getFullYear();
    const years = [currentYear];
    // Also check previous year in Jan/Feb since PTRs can lag
    if (new Date().getMonth() < 2) years.push(currentYear - 1);

    const allFilings: FilingMeta[] = [];
    for (const year of years) {
      try {
        const filings = await fetchFilingList(year);
        allFilings.push(...filings);
      } catch {
        // Year may have no filings yet
      }
    }

    if (allFilings.length === 0) {
      console.log('[House Disclosure] No PTR filings found for Pelosi');
      return [];
    }

    // Sort by date descending, take 5 most recent
    const sorted = allFilings
      .filter(f => f.DocID && f.FilingDate)
      .sort((a, b) => {
        const da = normalizeDate(a.FilingDate);
        const db = normalizeDate(b.FilingDate);
        return db.localeCompare(da);
      })
      .slice(0, 5);

    const cutoff = lastKnownDate || (() => {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      return d.toISOString().split('T')[0];
    })();

    const events: ActivityEvent[] = [];

    for (const filing of sorted) {
      const filingDate = normalizeDate(filing.FilingDate);
      if (filingDate < cutoff) continue;

      const year = new Date(filingDate).getFullYear();
      const transactions = await fetchAndParseXml(year, filing.DocID);

      for (const tx of transactions) {
        const eventDate = normalizeDate(tx.transactionDate) || filingDate;
        const symbol = tx.symbol || extractTickerFromName(tx.assetName);
        if (!symbol || symbol.length > 6) continue;

        events.push({
          investorSlug: 'pelosi',
          eventDate,
          symbol: symbol.toUpperCase(),
          assetName: tx.assetName || symbol,
          action: mapAction(tx.transactionType),
          amountRange: tx.amount || null,
          sharesChange: null,
          previousPct: null,
          newPct: null,
          source: 'house_disclosure',
          rawData: { ...tx, filingDate, docId: filing.DocID },
        });
      }
    }

    console.log(`[House Disclosure] Detected ${events.length} Pelosi transactions`);
    return events;
  } catch (err: any) {
    console.error('[House Disclosure] Error:', err.message);
    return [];
  }
}
