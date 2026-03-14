/**
 * Trading Coach Validation Schemas
 * Zod schemas for coach operations
 */

import { z } from 'zod';

// ============================================================================
// Base Schemas
// ============================================================================

export const tradeActionSchema = z.enum(['BUY', 'SELL', 'HOLD']);
export const tradeStatusSchema = z.enum(['open', 'closed', 'stopped', 'tp_hit']);
export const timeframeSchema = z.enum(['1H', '4H', '1D', '1W']);
export const assetTypeSchema = z.enum(['stock', 'etf', 'crypto']);
export const marketSchema = z.enum(['us', 'europe', 'latam']);

// ============================================================================
// Configuration Schemas
// ============================================================================

export const consensusWeightsSchema = z.object({
  indicator: z.number().min(0).max(1),
  priceAction: z.number().min(0).max(1),
  news: z.number().min(0).max(1),
}).refine(
  (data) => Math.abs(data.indicator + data.priceAction + data.news - 1) < 0.01,
  { message: 'Weights must sum to 1' }
);

export const riskParamsSchema = z.object({
  maxAllocationPct: z.number().min(1).max(100),
  maxOpenPositions: z.number().int().min(1).max(20),
  useLeverage: z.boolean(),
  stopLossStockPct: z.number().min(0.5).max(10),
  stopLossCryptoPct: z.number().min(1).max(20),
  stopLossAtrMultiplier: z.number().min(0.5).max(5),
  tp1Pct: z.number().min(0).max(100),
  tp2Pct: z.number().min(0).max(100),
  runnerPct: z.number().min(0).max(100),
  trailingAtrMultiplier: z.number().min(0.5).max(3),
  dailyDrawdownLimitPct: z.number().min(1).max(20),
  maxConsecutiveLosses: z.number().int().min(1).max(10),
});

export const coachConfigSchema = z.object({
  killSwitch: z.boolean(),
  weights: consensusWeightsSchema,
  minConfidence: z.number().min(0).max(1),
  minConsensusScore: z.number().min(0).max(1),
  riskParams: riskParamsSchema,
  watchSymbols: z.array(z.string()),
  runCadenceMinutes: z.number().int().min(0).max(1440),
});

export const updateConfigSchema = coachConfigSchema.partial();

// ============================================================================
// Signal Schemas
// ============================================================================

export const takeProfitLevelSchema = z.object({
  price: z.number().positive(),
  percentage: z.number().min(0).max(100),
  type: z.enum(['fixed', 'trailing']),
  trailingAtr: z.number().optional(),
});

export const agentProposalSchema = z.object({
  agent: z.string(),
  action: tradeActionSchema,
  confidence: z.number().min(0).max(1),
  entryZone: z.object({
    low: z.number(),
    high: z.number(),
  }).optional(),
  stopLoss: z.number().optional(),
  takeProfits: z.array(takeProfitLevelSchema).optional(),
  expectedReturn: z.number().optional(),
  expectedRisk: z.number().optional(),
  rationale: z.string(),
  metrics: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
});

// ============================================================================
// Paper Trade Schemas
// ============================================================================

export const createPaperTradeSchema = z.object({
  signalId: z.string().uuid().optional(),
  symbol: z.string().min(1).max(20),
  assetType: assetTypeSchema,
  market: marketSchema.default('us'),
  side: z.enum(['BUY', 'SELL']),
  entryPrice: z.number().positive(),
  sizeUsd: z.number().positive().max(100000),
  stopLoss: z.number().positive().optional(),
  takeProfitJson: z.array(takeProfitLevelSchema).optional(),
  notes: z.string().max(500).optional(),
});

export const closePaperTradeSchema = z.object({
  tradeId: z.string().uuid(),
  exitPrice: z.number().positive(),
  notes: z.string().max(500).optional(),
});

// ============================================================================
// API Request Schemas
// ============================================================================

export const runAnalysisSchema = z.object({
  symbols: z.array(z.string()).optional(),
  forceRun: z.boolean().default(false),
});

export const generateReportSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type TradeAction = z.infer<typeof tradeActionSchema>;
export type TradeStatus = z.infer<typeof tradeStatusSchema>;
export type Timeframe = z.infer<typeof timeframeSchema>;
export type ConsensusWeights = z.infer<typeof consensusWeightsSchema>;
export type RiskParams = z.infer<typeof riskParamsSchema>;
export type CoachConfigInput = z.infer<typeof coachConfigSchema>;
export type UpdateConfigInput = z.infer<typeof updateConfigSchema>;
export type TakeProfitLevel = z.infer<typeof takeProfitLevelSchema>;
export type AgentProposal = z.infer<typeof agentProposalSchema>;
export type CreatePaperTradeInput = z.infer<typeof createPaperTradeSchema>;
export type ClosePaperTradeInput = z.infer<typeof closePaperTradeSchema>;
export type RunAnalysisInput = z.infer<typeof runAnalysisSchema>;
export type GenerateReportInput = z.infer<typeof generateReportSchema>;
