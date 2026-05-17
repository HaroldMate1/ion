/**
 * openFDA API Integration
 * Fetches recent FDA drug approval actions from the public openFDA API.
 * No API key required for basic usage (rate-limited to 240 req/min).
 *
 * Docs: https://open.fda.gov/apis/drug/drugsfda/
 */

import axios from 'axios';

const FDA_API_BASE = 'https://api.fda.gov/drug/drugsfda.json';

export interface FDAApprovalRecord {
  applicationNumber: string;       // e.g., "NDA213952"
  sponsorName: string;             // Manufacturer
  brandName: string;
  genericName: string;
  approvalDate: string;            // YYYY-MM-DD
  applicationType: string;         // "NDA", "BLA", "ANDA"
  submissionType: string;          // "ORIG", "SUPPL" (supplement)
  submissionStatus: string;        // "AP" = Approved
  reviewDesignation?: string;      // e.g., "STANDARD", "PRIORITY"
}

interface FDAApiResponse {
  meta: {
    disclaimer: string;
    terms: string;
    license: string;
    results: { skip: number; limit: number; total: number };
  };
  results: FDAApiResult[];
}

interface FDAApiResult {
  application_number: string;
  sponsor_name: string;
  openfda?: {
    brand_name?: string[];
    generic_name?: string[];
  };
  products?: Array<{
    brand_name: string;
    generic_name: string;
    marketing_status: string;
  }>;
  submissions?: Array<{
    submission_type: string;
    submission_number: string;
    submission_status: string;
    submission_status_date: string; // "YYYYMMDD"
    submission_class_code?: string;
    review_priority?: string;
  }>;
}

function formatFDADate(raw: string): string {
  // "20240314" → "2024-03-14"
  if (!raw || raw.length !== 8) return raw || '';
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

/**
 * Fetch recent FDA drug approvals within the given date range.
 * Returns original NDA/BLA approvals (not supplements or generics).
 */
export async function fetchRecentFDAApprovals(
  startDate: string = '20240101',
  endDate?: string,
): Promise<FDAApprovalRecord[]> {
  const end = endDate || new Date().toISOString().split('T')[0].replace(/-/g, '');

  try {
    const response = await axios.get<FDAApiResponse>(FDA_API_BASE, {
      params: {
        search: `submissions.submission_status:"AP" AND submissions.submission_type:"ORIG" AND submissions.submission_status_date:[${startDate}+TO+${end}]`,
        sort: 'submissions.submission_status_date:desc',
        limit: 25,
      },
      timeout: 12000,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'investment-tracker-app/1.0',
      },
    });

    const results = response.data?.results || [];
    const approvals: FDAApprovalRecord[] = [];

    for (const result of results) {
      // Find the most recent AP (approved) ORIG submission
      const approvedSub = result.submissions
        ?.filter(s => s.submission_status === 'AP' && s.submission_type === 'ORIG')
        .sort((a, b) =>
          (b.submission_status_date || '').localeCompare(a.submission_status_date || ''),
        )[0];

      if (!approvedSub) continue;

      const approvalDate = formatFDADate(approvedSub.submission_status_date);
      if (approvalDate < startDate.slice(0, 4) + '-' + startDate.slice(4, 6) + '-' + startDate.slice(6, 8)) continue;

      const brandName =
        result.openfda?.brand_name?.[0] ||
        result.products?.[0]?.brand_name ||
        'Unknown';
      const genericName =
        result.openfda?.generic_name?.[0] ||
        result.products?.[0]?.generic_name ||
        'Unknown';

      approvals.push({
        applicationNumber: result.application_number,
        sponsorName: result.sponsor_name,
        brandName,
        genericName,
        approvalDate,
        applicationType: result.application_number?.startsWith('BLA') ? 'BLA' : 'NDA',
        submissionType: approvedSub.submission_type,
        submissionStatus: approvedSub.submission_status,
        reviewDesignation: approvedSub.review_priority,
      });
    }

    return approvals;
  } catch (err: any) {
    console.error('[FDA API] Error fetching approvals:', err.message);
    return [];
  }
}

/**
 * Fetch a specific drug application by application number.
 */
export async function fetchFDAApplication(
  applicationNumber: string,
): Promise<FDAApprovalRecord | null> {
  try {
    const response = await axios.get<FDAApiResponse>(FDA_API_BASE, {
      params: { search: `application_number:"${applicationNumber}"`, limit: 1 },
      timeout: 10000,
    });

    const result = response.data?.results?.[0];
    if (!result) return null;

    const latestSub = result.submissions?.sort((a, b) =>
      (b.submission_status_date || '').localeCompare(a.submission_status_date || ''),
    )[0];

    return {
      applicationNumber: result.application_number,
      sponsorName: result.sponsor_name,
      brandName: result.openfda?.brand_name?.[0] || result.products?.[0]?.brand_name || 'Unknown',
      genericName: result.openfda?.generic_name?.[0] || result.products?.[0]?.generic_name || 'Unknown',
      approvalDate: formatFDADate(latestSub?.submission_status_date || ''),
      applicationType: result.application_number?.startsWith('BLA') ? 'BLA' : 'NDA',
      submissionType: latestSub?.submission_type || '',
      submissionStatus: latestSub?.submission_status || '',
      reviewDesignation: latestSub?.review_priority,
    };
  } catch (err: any) {
    console.error('[FDA API] Error fetching application:', err.message);
    return null;
  }
}
