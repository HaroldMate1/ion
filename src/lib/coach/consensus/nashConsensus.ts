/**
 * Nash Consensus Engine
 * Combines proposals from multiple agents using game-theory inspired approach.
 *
 * Each agent outputs a Proposal with:
 * - action (BUY/SELL/HOLD)
 * - confidence (0..1)
 * - expectedReturn, expectedRisk
 *
 * We compute utility per agent: U = wR*expectedReturn - wK*expectedRisk - wC*(1-confidence)
 * Then choose action that maximizes product of positive gains over HOLD (Nash-bargaining style)
 * Tie-breaker prefers lower risk; if overall confidence < threshold => HOLD
 */

import type {
  AgentProposal,
  ConsensusResult,
  CoachConfig,
  TakeProfitLevel,
} from '../types';

// Utility weights
const WEIGHT_RETURN = 0.4;
const WEIGHT_RISK = 0.35;
const WEIGHT_CONFIDENCE = 0.25;

// Baseline utility for HOLD (used as disagreement point in Nash bargaining)
const HOLD_UTILITY = 0;

interface AgentUtility {
  agent: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  utility: number;
  confidence: number;
  expectedReturn: number;
  expectedRisk: number;
  proposal: AgentProposal;
}

/**
 * Calculate utility for a single proposal
 */
function calculateUtility(proposal: AgentProposal): number {
  const expectedReturn = proposal.expectedReturn ?? 0;
  const expectedRisk = proposal.expectedRisk ?? 0;
  const confidence = proposal.confidence;

  // U = wR*expectedReturn - wK*expectedRisk - wC*(1-confidence)
  const utility =
    WEIGHT_RETURN * expectedReturn -
    WEIGHT_RISK * expectedRisk -
    WEIGHT_CONFIDENCE * (1 - confidence);

  return utility;
}

/**
 * Calculate Nash product for a set of utilities
 * Product of (utility - disagreement point) for all agents with same action
 */
function calculateNashProduct(utilities: number[]): number {
  if (utilities.length === 0) return 0;

  // Nash product: Π(Ui - HOLD_UTILITY) for positive gains only
  let product = 1;
  let hasPositive = false;

  for (const u of utilities) {
    const gain = u - HOLD_UTILITY;
    if (gain > 0) {
      product *= gain;
      hasPositive = true;
    } else {
      // If any agent has negative gain, penalize heavily
      product *= 0.1;
    }
  }

  return hasPositive ? product : 0;
}

/**
 * Main consensus function
 * Takes proposals from all agents and config, returns consensus result
 */
export function computeConsensus(
  proposals: AgentProposal[],
  config: CoachConfig
): ConsensusResult {
  if (proposals.length === 0) {
    return createHoldConsensus('No agent proposals received.');
  }

  // Calculate utility for each proposal
  const utilities: AgentUtility[] = proposals.map((proposal) => ({
    agent: proposal.agent,
    action: proposal.action,
    utility: calculateUtility(proposal),
    confidence: proposal.confidence,
    expectedReturn: proposal.expectedReturn ?? 0,
    expectedRisk: proposal.expectedRisk ?? 0,
    proposal,
  }));

  // Group by action
  const buyUtilities = utilities.filter((u) => u.action === 'BUY');
  const sellUtilities = utilities.filter((u) => u.action === 'SELL');
  const holdUtilities = utilities.filter((u) => u.action === 'HOLD');

  // Calculate Nash product for each action
  const buyProduct = calculateNashProduct(buyUtilities.map((u) => u.utility));
  const sellProduct = calculateNashProduct(sellUtilities.map((u) => u.utility));

  // Calculate weighted average confidence for each action
  const calculateWeightedConfidence = (
    agentUtilities: AgentUtility[],
    weights: CoachConfig['weights']
  ): number => {
    if (agentUtilities.length === 0) return 0;

    let weightedSum = 0;
    let totalWeight = 0;

    for (const u of agentUtilities) {
      const weight = getAgentWeight(u.agent, weights);
      weightedSum += u.confidence * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  };

  // Calculate average risk for each action (for tie-breaking)
  const calculateAverageRisk = (agentUtilities: AgentUtility[]): number => {
    if (agentUtilities.length === 0) return Infinity;
    const sum = agentUtilities.reduce((acc, u) => acc + u.expectedRisk, 0);
    return sum / agentUtilities.length;
  };

  // Determine winning action using Nash bargaining
  let finalAction: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let consensusScore = 0;

  // Compare products
  if (buyProduct > 0 || sellProduct > 0) {
    if (buyProduct > sellProduct) {
      finalAction = 'BUY';
      consensusScore = buyProduct;
    } else if (sellProduct > buyProduct) {
      finalAction = 'SELL';
      consensusScore = sellProduct;
    } else {
      // Tie-breaker: prefer lower risk
      const buyRisk = calculateAverageRisk(buyUtilities);
      const sellRisk = calculateAverageRisk(sellUtilities);
      if (buyRisk <= sellRisk) {
        finalAction = 'BUY';
        consensusScore = buyProduct;
      } else {
        finalAction = 'SELL';
        consensusScore = sellProduct;
      }
    }
  }

  // Get winning utilities
  const winningUtilities =
    finalAction === 'BUY'
      ? buyUtilities
      : finalAction === 'SELL'
        ? sellUtilities
        : holdUtilities;

  // Calculate final confidence (weighted by agent weights)
  const finalConfidence = calculateWeightedConfidence(
    winningUtilities.length > 0 ? winningUtilities : utilities,
    config.weights
  );

  // Check minimum confidence threshold
  if (finalConfidence < config.minConfidence) {
    return createHoldConsensus(
      `Confidence (${(finalConfidence * 100).toFixed(1)}%) below threshold (${(config.minConfidence * 100).toFixed(1)}%).`
    );
  }

  // Normalize consensus score to 0-1 range
  const normalizedScore = Math.min(1, Math.max(0, consensusScore / 10));

  // Check minimum consensus score threshold
  if (normalizedScore < config.minConsensusScore && finalAction !== 'HOLD') {
    return createHoldConsensus(
      `Consensus score (${(normalizedScore * 100).toFixed(1)}%) below threshold (${(config.minConsensusScore * 100).toFixed(1)}%).`
    );
  }

  // Merge entry zones, stop losses, and take profits from winning proposals
  const mergedResult = mergeProposals(
    winningUtilities.length > 0 ? winningUtilities.map((u) => u.proposal) : [],
    config
  );

  // Build rationale from all agents
  const rationale = buildConsensusRationale(
    proposals,
    finalAction,
    finalConfidence,
    normalizedScore
  );

  return {
    action: finalAction,
    confidence: Math.round(finalConfidence * 100) / 100,
    consensusScore: Math.round(normalizedScore * 100) / 100,
    entryZone: mergedResult.entryZone,
    stopLoss: mergedResult.stopLoss,
    takeProfits: mergedResult.takeProfits,
    expectedReturn: mergedResult.expectedReturn,
    expectedRisk: mergedResult.expectedRisk,
    agentVotes: utilities.map((u) => ({
      agent: u.agent,
      action: u.action,
      confidence: u.confidence,
    })),
    rationale,
  };
}

/**
 * Get agent weight from config
 */
function getAgentWeight(
  agent: string,
  weights: CoachConfig['weights']
): number {
  const lowerAgent = agent.toLowerCase();
  if (lowerAgent.includes('indicator')) return weights.indicator;
  if (lowerAgent.includes('price') || lowerAgent.includes('action'))
    return weights.priceAction;
  if (lowerAgent.includes('news') || lowerAgent.includes('sentiment'))
    return weights.news;
  return 1 / 3; // Default equal weight
}

/**
 * Merge proposals from agreeing agents
 */
function mergeProposals(
  proposals: AgentProposal[],
  config: CoachConfig
): {
  entryZone?: { low: number; high: number };
  stopLoss?: number;
  takeProfits?: TakeProfitLevel[];
  expectedReturn?: number;
  expectedRisk?: number;
} {
  if (proposals.length === 0) {
    return {};
  }

  // Average entry zones
  const entryZones = proposals
    .filter((p) => p.entryZone)
    .map((p) => p.entryZone!);

  let entryZone: { low: number; high: number } | undefined;
  if (entryZones.length > 0) {
    entryZone = {
      low:
        entryZones.reduce((sum, ez) => sum + ez.low, 0) / entryZones.length,
      high:
        entryZones.reduce((sum, ez) => sum + ez.high, 0) / entryZones.length,
    };
  }

  // Most conservative stop loss (closest to entry for BUY, furthest for SELL)
  const stopLosses = proposals
    .filter((p) => p.stopLoss !== undefined)
    .map((p) => p.stopLoss!);

  let stopLoss: number | undefined;
  if (stopLosses.length > 0) {
    // For buys, take the highest stop loss (closest to entry, most conservative)
    // For sells, take the lowest stop loss (most conservative)
    const action = proposals[0]?.action;
    if (action === 'BUY') {
      stopLoss = Math.max(...stopLosses);
    } else if (action === 'SELL') {
      stopLoss = Math.min(...stopLosses);
    }
  }

  // Merge take profits (use first one that has them, typically from indicator agent)
  const takeProfits = proposals.find((p) => p.takeProfits)?.takeProfits;

  // Average expected returns and risks
  const returns = proposals
    .filter((p) => p.expectedReturn !== undefined)
    .map((p) => p.expectedReturn!);
  const risks = proposals
    .filter((p) => p.expectedRisk !== undefined)
    .map((p) => p.expectedRisk!);

  const expectedReturn =
    returns.length > 0
      ? returns.reduce((a, b) => a + b, 0) / returns.length
      : undefined;

  const expectedRisk =
    risks.length > 0
      ? risks.reduce((a, b) => a + b, 0) / risks.length
      : undefined;

  return {
    entryZone,
    stopLoss,
    takeProfits,
    expectedReturn: expectedReturn
      ? Math.round(expectedReturn * 100) / 100
      : undefined,
    expectedRisk: expectedRisk
      ? Math.round(expectedRisk * 100) / 100
      : undefined,
  };
}

/**
 * Build consensus rationale from all agent rationales
 */
function buildConsensusRationale(
  proposals: AgentProposal[],
  finalAction: 'BUY' | 'SELL' | 'HOLD',
  confidence: number,
  consensusScore: number
): string {
  const actionStr =
    finalAction === 'BUY'
      ? 'LONG'
      : finalAction === 'SELL'
        ? 'SHORT/SELL'
        : 'HOLD';

  const parts: string[] = [
    `Consensus: ${actionStr} (Confidence: ${(confidence * 100).toFixed(0)}%, Score: ${(consensusScore * 100).toFixed(0)}%)`,
    '',
    'Agent Analysis:',
  ];

  for (const proposal of proposals) {
    const vote = `${proposal.agent}: ${proposal.action} (${(proposal.confidence * 100).toFixed(0)}%)`;
    parts.push(`• ${vote}`);
    if (proposal.rationale) {
      // Indent rationale
      const shortRationale =
        proposal.rationale.length > 150
          ? proposal.rationale.substring(0, 147) + '...'
          : proposal.rationale;
      parts.push(`  ${shortRationale}`);
    }
  }

  return parts.join('\n');
}

/**
 * Create a HOLD consensus result
 */
function createHoldConsensus(reason: string): ConsensusResult {
  return {
    action: 'HOLD',
    confidence: 0.5,
    consensusScore: 0,
    agentVotes: [],
    rationale: `HOLD: ${reason}`,
  };
}

/**
 * Quick check if consensus recommends action
 */
export function isActionable(result: ConsensusResult): boolean {
  return result.action !== 'HOLD' && result.confidence >= 0.45;
}
