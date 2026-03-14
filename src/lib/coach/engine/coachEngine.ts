/**
 * Trading Coach Engine
 * Main orchestrator that runs analysis pipeline:
 * 1. Fetch market data
 * 2. Run all agents in parallel
 * 3. Compute consensus
 * 4. Assess risk
 * 5. Generate signal
 */

import { analyzeIndicators } from '../agents/indicatorAgent';
import { analyzePriceAction } from '../agents/priceActionAgent';
import { analyzeNews } from '../agents/newsAgent';
import { computeConsensus, isActionable } from '../consensus/nashConsensus';
import { assessRisk } from '../risk/riskEngine';
import { calculateATR } from '../utils/indicators';
import type {
  AgentInput,
  AgentProposal,
  CoachConfig,
  CoachSignal,
  ConsensusResult,
  RiskAssessment,
  OHLCData,
  Timeframe,
  RunAnalysisResult,
} from '../types';
import type { AssetType, Market } from '@/types';

interface AnalysisInput {
  symbol: string;
  assetType: AssetType;
  market: Market;
  currentPrice: number;
  ohlcData: OHLCData[];
  config: CoachConfig;
  portfolioState: {
    totalValue: number;
    availableCash: number;
    openPositions: number;
    todayPnL: number;
    todayPnLPercent: number;
    consecutiveLosses: number;
  };
}

interface AnalysisOutput {
  symbol: string;
  assetType: AssetType;
  market: Market;
  timeframe: Timeframe;
  proposals: AgentProposal[];
  consensus: ConsensusResult;
  riskAssessment: RiskAssessment;
  signal: Omit<CoachSignal, 'id' | 'userId' | 'createdAt'>;
}

/**
 * Run analysis for a single symbol
 */
export async function analyzeSymbol(input: AnalysisInput): Promise<AnalysisOutput> {
  const { symbol, assetType, market, currentPrice, ohlcData, config, portfolioState } =
    input;

  // Determine timeframe from data
  const timeframe = inferTimeframe(ohlcData);

  // Create agent input
  const agentInput: AgentInput = {
    symbol,
    assetType,
    market,
    currentPrice,
    ohlcData,
    config,
  };

  // Run all agents in parallel
  const [indicatorProposal, priceActionProposal, newsProposal] = await Promise.all([
    Promise.resolve(analyzeIndicators(agentInput)),
    Promise.resolve(analyzePriceAction(agentInput)),
    analyzeNews(agentInput),
  ]);

  const proposals: AgentProposal[] = [
    indicatorProposal,
    priceActionProposal,
    newsProposal,
  ];

  // Compute consensus
  const consensus = computeConsensus(proposals, config);

  // Calculate ATR for risk assessment
  const atr = calculateATR(ohlcData);

  // Assess risk
  const riskAssessment = assessRisk(
    consensus,
    portfolioState,
    config,
    currentPrice,
    atr,
    assetType
  );

  // Build signal
  const signal = buildSignal(
    symbol,
    assetType,
    market,
    timeframe,
    currentPrice,
    consensus,
    riskAssessment,
    proposals
  );

  return {
    symbol,
    assetType,
    market,
    timeframe,
    proposals,
    consensus,
    riskAssessment,
    signal,
  };
}

/**
 * Run analysis for multiple symbols
 */
export async function runBatchAnalysis(
  symbols: Array<{ symbol: string; assetType: AssetType; market: Market }>,
  fetchMarketData: (
    symbol: string,
    assetType: AssetType,
    market: Market
  ) => Promise<{ currentPrice: number; ohlcData: OHLCData[] } | null>,
  config: CoachConfig,
  portfolioState: {
    totalValue: number;
    availableCash: number;
    openPositions: number;
    todayPnL: number;
    todayPnLPercent: number;
    consecutiveLosses: number;
  }
): Promise<RunAnalysisResult> {
  // Check kill switch first
  if (config.killSwitch) {
    return {
      success: false,
      signalsGenerated: 0,
      signals: [],
      killSwitchActive: true,
    };
  }

  const signals: CoachSignal[] = [];
  const errors: string[] = [];

  // Process symbols (could be parallelized but we'll do sequentially to manage API limits)
  for (const { symbol, assetType, market } of symbols) {
    try {
      const marketData = await fetchMarketData(symbol, assetType, market);

      if (!marketData) {
        errors.push(`Failed to fetch market data for ${symbol}`);
        continue;
      }

      const { currentPrice, ohlcData } = marketData;

      if (ohlcData.length < 20) {
        errors.push(`Insufficient data for ${symbol} (need 20+ candles, got ${ohlcData.length})`);
        continue;
      }

      const output = await analyzeSymbol({
        symbol,
        assetType,
        market,
        currentPrice,
        ohlcData,
        config,
        portfolioState,
      });

      // Only include actionable signals or all signals based on config
      signals.push(output.signal as CoachSignal);
    } catch (error) {
      errors.push(`Error analyzing ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return {
    success: errors.length === 0,
    signalsGenerated: signals.length,
    signals,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Build signal object from analysis results
 */
function buildSignal(
  symbol: string,
  assetType: AssetType,
  market: Market,
  timeframe: Timeframe,
  currentPrice: number,
  consensus: ConsensusResult,
  riskAssessment: RiskAssessment,
  proposals: AgentProposal[]
): Omit<CoachSignal, 'id' | 'userId' | 'createdAt'> {
  // Determine if signal is stale (market closed or low confidence)
  const isStale = !riskAssessment.approved && consensus.action !== 'HOLD';

  // Build comprehensive rationale
  let rationale = consensus.rationale;
  if (riskAssessment.warnings.length > 0) {
    rationale += '\n\nRisk Warnings:\n• ' + riskAssessment.warnings.join('\n• ');
  }
  if (riskAssessment.rules.length > 0) {
    rationale += '\n\nRisk Rules Applied:\n• ' + riskAssessment.rules.join('\n• ');
  }

  return {
    symbol,
    assetType,
    market,
    timeframe,
    signalTs: new Date().toISOString(),
    consensusAction: consensus.action,
    consensusScore: consensus.consensusScore,
    entryLow: consensus.entryZone?.low,
    entryHigh: consensus.entryZone?.high,
    stopLoss: riskAssessment.stopLoss ?? consensus.stopLoss,
    takeProfitJson: riskAssessment.takeProfits ?? consensus.takeProfits,
    agentVotesJson: proposals,
    rationale,
    expectedReturnPct: riskAssessment.expectedReturn ?? consensus.expectedReturn,
    expectedRiskPct: riskAssessment.expectedRisk ?? consensus.expectedRisk,
    riskRewardRatio: riskAssessment.riskRewardRatio ?? consensus.riskRewardRatio,
    marketOpen: isMarketOpen(market, assetType),
    currentPrice,
    isStale,
    acknowledged: false,
  };
}

/**
 * Infer timeframe from OHLC data timestamps
 */
function inferTimeframe(data: OHLCData[]): Timeframe {
  if (data.length < 2) return '1D';

  const diff = data[1].timestamp - data[0].timestamp;
  const hours = diff / (1000 * 60 * 60);

  if (hours <= 1.5) return '1H';
  if (hours <= 5) return '4H';
  if (hours <= 36) return '1D';
  return '1W';
}

/**
 * Check if market is currently open
 */
function isMarketOpen(market: Market, assetType: AssetType): boolean {
  // Crypto is always open
  if (assetType === 'crypto') return true;

  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcDay = now.getUTCDay();

  // Weekend check (Saturday = 6, Sunday = 0)
  if (utcDay === 0 || utcDay === 6) return false;

  switch (market) {
    case 'us':
      // NYSE/NASDAQ: 9:30 AM - 4:00 PM ET (14:30 - 21:00 UTC)
      return utcHour >= 14 && utcHour < 21;
    case 'europe':
      // Major European exchanges: ~8:00 AM - 4:30 PM CET (7:00 - 15:30 UTC)
      return utcHour >= 7 && utcHour < 16;
    case 'latam':
      // Latin American exchanges overlap broadly:
      // BVC (Colombia): 9:30-16:00 COT = 14:30-21:00 UTC
      // B3 (Brazil): 10:00-17:00 BRT = 13:00-20:00 UTC
      // BMV (Mexico): 8:30-15:00 CST = 14:30-21:00 UTC
      // BVL (Peru/Chile): similar to US hours
      return utcHour >= 13 && utcHour < 21;
    default:
      return true;
  }
}

/**
 * Get symbol from watchlist with parsed asset type
 */
export function parseWatchSymbol(
  watchSymbol: string
): { symbol: string; assetType: AssetType; market: Market } | null {
  // Format: "SYMBOL:TYPE:MARKET" or just "SYMBOL" (defaults to stock:us)
  const parts = watchSymbol.split(':');

  if (parts.length === 1) {
    return {
      symbol: parts[0].toUpperCase(),
      assetType: 'stock',
      market: 'us',
    };
  }

  if (parts.length === 3) {
    const assetType = parts[1].toLowerCase() as AssetType;
    const market = parts[2].toLowerCase() as Market;

    if (!['stock', 'etf', 'crypto'].includes(assetType)) return null;
    if (!['us', 'europe', 'latam'].includes(market)) return null;

    return {
      symbol: parts[0].toUpperCase(),
      assetType,
      market,
    };
  }

  return null;
}

/**
 * Format watch symbol for storage
 */
export function formatWatchSymbol(
  symbol: string,
  assetType: AssetType,
  market: Market
): string {
  return `${symbol.toUpperCase()}:${assetType}:${market}`;
}
