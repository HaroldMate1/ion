/**
 * Pharmaceutical Regulatory Intelligence — Type Definitions
 * Covers FDA (US) and EMA (EU) regulatory decisions for drug approvals/rejections.
 */

export type RegulatoryBody = 'FDA' | 'EMA';

export type DecisionStatus =
  | 'approved'     // Drug approved
  | 'rejected'     // Outright rejection
  | 'crl'          // Complete Response Letter (FDA-specific, request for more data)
  | 'withdrawn'    // Company withdrew application
  | 'deferred'     // EMA deferred opinion
  | 'adcom_held'   // Advisory committee meeting completed, awaiting FDA decision
  | 'pending';     // Decision date in the future

export type InvestmentSignal =
  | 'strong_buy'
  | 'buy'
  | 'hold'
  | 'sell'
  | 'strong_sell'
  | 'watch';

export type TherapeuticArea =
  | 'oncology'
  | 'cardiology'
  | 'neurology'
  | 'immunology'
  | 'rare_disease'
  | 'infectious_disease'
  | 'metabolic'
  | 'hematology'
  | 'ophthalmology'
  | 'respiratory'
  | 'other';

export interface AdComResult {
  date: string;                          // YYYY-MM-DD
  vote: string;                          // e.g., "12-1 in favor"
  outcome: 'positive' | 'negative' | 'mixed';
  committee: string;                     // e.g., "Oncologic Drugs Advisory Committee"
}

export interface RegulatoryDecision {
  id: string;

  // Drug identity
  brandName: string;           // Approved brand name (or candidate name if pending)
  genericName: string;         // INN / generic name
  drugClass: string;           // e.g., "Bispecific T-cell engager (BiTE)"
  company: string;             // Marketing authorization holder
  ticker: string | null;       // Stock ticker (null if private/subsidiary)
  exchange?: 'NYSE' | 'NASDAQ' | 'LSE' | 'XETRA' | 'SIX' | 'EPA';

  // Indication & area
  indication: string;          // Full indication description
  therapeuticArea: TherapeuticArea;
  patientPopulation?: string;  // e.g., "~17M US patients"

  // Regulatory details
  regulatoryBody: RegulatoryBody;
  actionDate: string;          // YYYY-MM-DD (PDUFA date or decision date)
  isPending: boolean;
  status: DecisionStatus;

  // FDA designations (positive for approval probability)
  breakthroughTherapy: boolean;
  fastTrack: boolean;
  priorityReview: boolean;
  orphanDrug: boolean;

  // Advisory committee (if held)
  adcom?: AdComResult;

  // Financial context
  marketCapBillion?: number;         // Company market cap at decision time (B USD)
  stockReactionPercent?: number;     // % stock change on decision day (positive = up)
  peakSalesBillion?: number;         // Consensus analyst peak annual sales estimate (B USD)

  // Investment intelligence
  investmentSignal: InvestmentSignal;
  signalRationale: string;           // Concise explanation of the signal
  riskLevel: 'high' | 'medium' | 'low';
  keyDrivers: string[];              // Bullish catalysts
  riskFactors: string[];             // Bearish risks
  competitiveLandscape?: string;     // Key competitors and dynamics
  analystConsensus?: string;         // Sell-side consensus view
}
