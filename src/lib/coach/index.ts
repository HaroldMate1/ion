/**
 * Trading Coach Module Exports
 * Central export for all coach functionality
 */

// Types
export * from './types';

// Agents
export { analyzeIndicators } from './agents/indicatorAgent';
export { analyzePriceAction } from './agents/priceActionAgent';
export {
  analyzeNews,
  setNewsProvider,
  getNewsProvider,
  type NewsProvider,
  type NewsSentiment,
} from './agents/newsAgent';

// Consensus
export { computeConsensus, isActionable } from './consensus/nashConsensus';

// Risk
export {
  assessRisk,
  checkStopLoss,
  checkTakeProfits,
  calculateTrailingStop,
  validatePosition,
  calculatePnL,
  classifyRisk,
} from './risk/riskEngine';

// Engine
export {
  analyzeSymbol,
  runBatchAnalysis,
  parseWatchSymbol,
  formatWatchSymbol,
} from './engine/coachEngine';

// Utilities
export * from './utils/indicators';
