/**
 * SEC EDGAR 13F Quarterly Filing Fetcher
 * Fetches the TWO most recent 13F-HR filings for each investor and diffs them
 * to detect real quarter-over-quarter position changes.
 *
 * KEY DESIGN DECISION: We compare the latest filing against the PREVIOUS filing
 * (both fetched from SEC EDGAR) — not against a hardcoded config. This eliminates
 * false-positive "new_position" events for holdings that simply weren't in our
 * curated top-10 list.
 *
 * DATA FRESHNESS:
 * The SEC mandates a 45-day filing window after each quarter end.
 *   Q1 (Mar 31) → published by ~May 15
 *   Q2 (Jun 30) → published by ~Aug 14
 *   Q3 (Sep 30) → published by ~Nov 14
 *   Q4 (Dec 31) → published by ~Feb 14
 * Holdings shown may be up to ~135 days old (45-day delay + up to 90 days into next quarter).
 */

import axios from 'axios';
import type { ActivityEvent } from './ark-fetcher';

const EDGAR_BASE = 'https://data.sec.gov';

// SEC requires a User-Agent header
const SEC_HEADERS = {
  'User-Agent': 'investment-tracker-app admin@localhost',
  'Accept-Encoding': 'gzip, deflate',
};

// Minimum portfolio % change to record as an increase/decrease
const MIN_CHANGE_PCT = 2.0;

/**
 * Investor slug → SEC CIK (Central Index Key)
 * Verified from https://www.sec.gov/cgi-bin/browse-edgar
 */
export const INVESTOR_CIKS: Partial<Record<string, string>> = {
  buffett:       '0000102909', // Berkshire Hathaway Inc
  druckenmiller: '0001536411', // Duquesne Family Office LLC
  asness:        '0001327895', // AQR Capital Management LLC
  burry:         '0001649339', // Scion Asset Management LLC
  pabrai:        '0001173334', // Pabrai Investment Funds
  marks:         '0001411579', // Oaktree Capital Management LP
  greenblatt:    '0001326828', // Gotham Asset Management LLC
  dalio:         '0001350694', // Bridgewater Associates LP
  smith:         '0001569205', // Fundsmith LLP
  hempton:       '0001471085', // Bronte Capital Management Pty Ltd
};

interface Holding13F {
  nameOfIssuer: string;
  cusip: string;
  value: number; // thousands USD
  shares: number;
}

/** Extract text content of a single XML tag (first match, case-insensitive) */
function xmlTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : '';
}

/** Parse the informationTable XML from a 13F-HR filing */
function parse13FXML(xml: string): Holding13F[] {
  const holdings: Holding13F[] = [];
  const rowRe = /<infoTable>([\s\S]*?)<\/infoTable>/gi;
  let m;
  while ((m = rowRe.exec(xml)) !== null) {
    const block = m[1];
    const nameOfIssuer = xmlTag(block, 'nameOfIssuer');
    const cusip        = xmlTag(block, 'cusip');
    const value        = parseFloat(xmlTag(block, 'value').replace(/,/g, '')) || 0;
    const shares       = parseFloat(xmlTag(block, 'sshPrnamt').replace(/,/g, '')) || 0;
    if (nameOfIssuer && value > 0) {
      holdings.push({ nameOfIssuer, cusip, value, shares });
    }
  }
  return holdings;
}

/**
 * Build a portfolio weight map: symbol/name-key → percentage of total value
 */
function buildWeightMap(holdings: Holding13F[]): Map<string, { pct: number; name: string }> {
  const totalValue = holdings.reduce((s, h) => s + h.value, 0);
  if (totalValue === 0) return new Map();

  const map = new Map<string, { pct: number; name: string }>();
  for (const h of holdings) {
    // Use CUSIP as the stable key to avoid name variation issues
    const key = h.cusip || normalizeName(h.nameOfIssuer);
    const pct = (h.value / totalValue) * 100;
    const existing = map.get(key);
    if (!existing || pct > existing.pct) {
      map.set(key, { pct, name: h.nameOfIssuer });
    }
  }
  return map;
}

/** Normalize company name for display (strip legal suffixes) */
function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/\b(INC|CORP|CORPORATION|CO|LLC|LTD|PLC|LP|NV|SA|AG|SE)\b\.?/g, '')
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetch the XML holdings for a specific filing by index into the EDGAR submissions array.
 * Tries the primary document first, then infotable.xml fallback.
 */
async function fetchFilingHoldings(
  cikNum: number,
  accession: string,
  primaryDoc: string,
): Promise<Holding13F[]> {
  const accNoDashes = accession.replace(/-/g, '');

  const docUrl = `${EDGAR_BASE}/Archives/edgar/data/${cikNum}/${accNoDashes}/${primaryDoc}`;
  let xml: string;

  try {
    const resp = await axios.get(docUrl, {
      headers: SEC_HEADERS,
      timeout: 20000,
      responseType: 'text',
    });
    xml = resp.data;
  } catch {
    return [];
  }

  // If primary doc is the cover page (no holdings), fetch infotable.xml
  if (!xml.toLowerCase().includes('<infotable>')) {
    try {
      const infoUrl = `${EDGAR_BASE}/Archives/edgar/data/${cikNum}/${accNoDashes}/infotable.xml`;
      const infoResp = await axios.get(infoUrl, {
        headers: SEC_HEADERS,
        timeout: 20000,
        responseType: 'text',
      });
      xml = infoResp.data;
    } catch {
      return [];
    }
  }

  return parse13FXML(xml);
}

/** Fetch and diff the latest two 13F-HR filings for one investor */
async function fetchInvestor13F(
  investorSlug: string,
  cik: string,
): Promise<ActivityEvent[]> {
  try {
    // 1. Fetch submission history
    const paddedCik = cik.replace(/^0+/, '').padStart(10, '0');
    const subUrl = `${EDGAR_BASE}/submissions/CIK${paddedCik}.json`;
    const subResp = await axios.get(subUrl, { headers: SEC_HEADERS, timeout: 15000 });
    const recent = subResp.data?.filings?.recent;
    if (!recent?.form) return [];

    const forms: string[]       = recent.form;
    const accessions: string[]  = recent.accessionNumber;
    const filingDates: string[] = recent.filingDate;
    const primaryDocs: string[] = recent.primaryDocument;

    // 2. Find the TWO most recent 13F-HR or 13F-HR/A filings
    const is13F = (f: string) => f === '13F-HR' || f === '13F-HR/A';
    const idx1 = forms.findIndex(is13F);
    if (idx1 === -1) {
      console.warn(`[13F Fetcher] No 13F-HR for ${investorSlug}`);
      return [];
    }

    let idx2 = -1;
    for (let i = idx1 + 1; i < forms.length; i++) {
      if (is13F(forms[i])) { idx2 = i; break; }
    }

    const cikNum = parseInt(cik, 10);

    // 3. Fetch both filings in parallel
    const [currentHoldings, previousHoldings] = await Promise.all([
      fetchFilingHoldings(cikNum, accessions[idx1], primaryDocs[idx1]),
      idx2 >= 0
        ? fetchFilingHoldings(cikNum, accessions[idx2], primaryDocs[idx2])
        : Promise.resolve([] as Holding13F[]),
    ]);

    if (currentHoldings.length === 0) return [];

    // 4. Build weight maps (keyed by CUSIP for stability)
    const currentMap  = buildWeightMap(currentHoldings);
    const previousMap = buildWeightMap(previousHoldings);

    const filingDate = filingDates[idx1];
    const events: ActivityEvent[] = [];

    // 5. Diff: current vs previous
    for (const [key, { pct, name }] of currentMap) {
      const prev = previousMap.get(key);

      if (!prev) {
        // New position added this quarter
        if (pct >= 0.5) { // Skip tiny/fractional positions
          events.push({
            investorSlug,
            eventDate: filingDate,
            symbol: key.length <= 6 ? key : name.split(' ')[0].toUpperCase(),
            assetName: name,
            action: 'new_position',
            amountRange: null,
            sharesChange: null,
            previousPct: null,
            newPct: +pct.toFixed(2),
            source: 'sec_13f',
            rawData: { filingDate, cik, accession: accessions[idx1] },
          });
        }
      } else {
        const diff = pct - prev.pct;
        if (Math.abs(diff) >= MIN_CHANGE_PCT) {
          events.push({
            investorSlug,
            eventDate: filingDate,
            symbol: key.length <= 6 ? key : name.split(' ')[0].toUpperCase(),
            assetName: name,
            action: diff > 0 ? 'increase' : 'decrease',
            amountRange: null,
            sharesChange: null,
            previousPct: +prev.pct.toFixed(2),
            newPct: +pct.toFixed(2),
            source: 'sec_13f',
            rawData: { filingDate, cik, accession: accessions[idx1] },
          });
        }
      }
    }

    // Detect fully closed positions
    for (const [key, { pct, name }] of previousMap) {
      if (!currentMap.has(key) && pct >= 1.0) {
        events.push({
          investorSlug,
          eventDate: filingDate,
          symbol: key.length <= 6 ? key : name.split(' ')[0].toUpperCase(),
          assetName: name,
          action: 'closed_position',
          amountRange: null,
          sharesChange: null,
          previousPct: +pct.toFixed(2),
          newPct: null,
          source: 'sec_13f',
          rawData: { filingDate, cik, accession: accessions[idx1] },
        });
      }
    }

    const comparisonLabel = idx2 >= 0
      ? `vs prev filing (${filingDates[idx2]})`
      : 'no previous filing found';
    console.log(
      `[13F Fetcher] ${investorSlug}: ${events.length} events — ${filingDate} ${comparisonLabel}`,
    );
    return events;
  } catch (err: any) {
    console.error(`[13F Fetcher] Error for ${investorSlug}:`, err.message);
    return [];
  }
}

/** Fetch 13F activity for all SEC-tracked investors in parallel */
export async function fetchAll13FActivity(): Promise<ActivityEvent[]> {
  const entries = Object.entries(INVESTOR_CIKS) as [string, string][];
  const results = await Promise.allSettled(
    entries.map(([slug, cik]) => fetchInvestor13F(slug, cik)),
  );
  const allEvents: ActivityEvent[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') allEvents.push(...r.value);
  }
  console.log(`[13F Fetcher] Total: ${allEvents.length} events across ${entries.length} investors`);
  return allEvents;
}
