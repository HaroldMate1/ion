/**
 * News/Sentiment Agent
 * Stub implementation that returns neutral HOLD signals.
 * Designed to be pluggable - can be extended with real news APIs.
 */

import type { AgentInput, AgentProposal } from '../types';

const AGENT_NAME = 'News';

/**
 * News sentiment provider interface
 * Implement this to plug in real news APIs
 */
export interface NewsProvider {
  name: string;
  getSentiment(symbol: string): Promise<NewsSentiment>;
}

export interface NewsSentiment {
  score: number; // -1 (very bearish) to 1 (very bullish)
  confidence: number; // 0 to 1
  articles: number; // Number of articles analyzed
  summary?: string;
  sources?: string[];
}

/**
 * Default (stub) news provider
 * Returns neutral sentiment
 */
export const stubNewsProvider: NewsProvider = {
  name: 'Stub',
  async getSentiment(_symbol: string): Promise<NewsSentiment> {
    return {
      score: 0,
      confidence: 0.5,
      articles: 0,
      summary: 'No news provider configured. Using neutral sentiment.',
    };
  },
};

// Active news provider (can be swapped)
let activeProvider: NewsProvider = stubNewsProvider;

/**
 * Set the active news provider
 */
export function setNewsProvider(provider: NewsProvider): void {
  activeProvider = provider;
}

/**
 * Get the active news provider
 */
export function getNewsProvider(): NewsProvider {
  return activeProvider;
}

/**
 * Analyze news sentiment and generate a proposal
 */
export async function analyzeNews(input: AgentInput): Promise<AgentProposal> {
  const { symbol, currentPrice, assetType, config } = input;

  try {
    const sentiment = await activeProvider.getSentiment(symbol);

    // Convert sentiment to action
    const { action, confidence } = sentimentToAction(sentiment);

    // Calculate basic risk management if actionable
    let stopLoss: number | undefined;
    let entryZone: { low: number; high: number } | undefined;
    let expectedReturn: number | undefined;
    let expectedRisk: number | undefined;

    if (action !== 'HOLD' && sentiment.confidence > 0.6) {
      const maxStopPct =
        assetType === 'crypto'
          ? config.riskParams.stopLossCryptoPct
          : config.riskParams.stopLossStockPct;

      const stopDistance = currentPrice * (maxStopPct / 100);

      if (action === 'BUY') {
        stopLoss = currentPrice - stopDistance;
        entryZone = { low: currentPrice * 0.995, high: currentPrice * 1.005 };
        expectedRisk = maxStopPct;
        expectedReturn = maxStopPct * 2;
      } else if (action === 'SELL') {
        stopLoss = currentPrice + stopDistance;
        entryZone = { low: currentPrice * 0.995, high: currentPrice * 1.005 };
        expectedRisk = maxStopPct;
        expectedReturn = maxStopPct * 2;
      }
    }

    const rationale = generateRationale(sentiment, activeProvider.name);

    return {
      agent: AGENT_NAME,
      action,
      confidence,
      entryZone,
      stopLoss,
      expectedReturn,
      expectedRisk,
      rationale,
      metrics: {
        sentimentScore: Math.round(sentiment.score * 100) / 100,
        sentimentConfidence: Math.round(sentiment.confidence * 100) / 100,
        articlesAnalyzed: sentiment.articles,
        provider: activeProvider.name,
      },
    };
  } catch (error) {
    console.error('News agent error:', error);
    return createHoldProposal('Error fetching news sentiment. Defaulting to HOLD.');
  }
}

/**
 * Convert sentiment score to action
 */
function sentimentToAction(sentiment: NewsSentiment): {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
} {
  const { score, confidence: sentimentConfidence, articles } = sentiment;

  // Require minimum articles for actionable signal
  if (articles < 3) {
    return { action: 'HOLD', confidence: 0.5 };
  }

  // Low confidence = HOLD
  if (sentimentConfidence < 0.6) {
    return { action: 'HOLD', confidence: 0.5 };
  }

  // Map sentiment score to action
  if (score > 0.3) {
    const confidence = Math.min(0.9, 0.5 + score * 0.4 * sentimentConfidence);
    return { action: 'BUY', confidence };
  } else if (score < -0.3) {
    const confidence = Math.min(0.9, 0.5 + Math.abs(score) * 0.4 * sentimentConfidence);
    return { action: 'SELL', confidence };
  }

  return { action: 'HOLD', confidence: 0.5 + Math.abs(score) * 0.2 };
}

/**
 * Generate rationale
 */
function generateRationale(sentiment: NewsSentiment, providerName: string): string {
  if (sentiment.articles === 0) {
    return `No news data available from ${providerName}. Neutral stance.`;
  }

  const sentimentLabel =
    sentiment.score > 0.3
      ? 'bullish'
      : sentiment.score < -0.3
        ? 'bearish'
        : 'neutral';

  const parts = [
    `Analyzed ${sentiment.articles} articles via ${providerName}.`,
    `Overall sentiment: ${sentimentLabel} (score: ${sentiment.score.toFixed(2)}).`,
  ];

  if (sentiment.summary) {
    parts.push(sentiment.summary);
  }

  return parts.join(' ');
}

/**
 * Create a HOLD proposal
 */
function createHoldProposal(rationale: string): AgentProposal {
  return {
    agent: AGENT_NAME,
    action: 'HOLD',
    confidence: 0.5,
    rationale,
    metrics: {
      sentimentScore: 0,
      sentimentConfidence: 0.5,
      articlesAnalyzed: 0,
      provider: activeProvider.name,
    },
  };
}

// ============================================================================
// Example: How to implement a real news provider
// ============================================================================

/**
 * Example NewsAPI.org provider (NOT IMPLEMENTED - just a template)
 *
 * To use:
 * 1. Get an API key from newsapi.org
 * 2. Implement sentiment analysis (could use basic keyword matching or LLM)
 * 3. Call setNewsProvider(newsApiProvider)
 */
export const exampleNewsApiProvider: NewsProvider = {
  name: 'NewsAPI',
  async getSentiment(symbol: string): Promise<NewsSentiment> {
    // This is a template - would need actual implementation
    // const response = await fetch(`https://newsapi.org/v2/everything?q=${symbol}&apiKey=YOUR_KEY`);
    // const data = await response.json();
    // ... analyze sentiment from articles ...

    // For now, return neutral
    return {
      score: 0,
      confidence: 0.5,
      articles: 0,
      summary: 'NewsAPI provider not configured.',
    };
  },
};
