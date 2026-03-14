/**
 * News/Sentiment Agent
 * Uses Finnhub company news API with keyword-based sentiment scoring.
 */

import axios from 'axios';
import type { AgentInput, AgentProposal } from '../types';

const AGENT_NAME = 'News';

/**
 * News sentiment provider interface
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

// ============================================================================
// Sentiment keyword dictionaries
// ============================================================================

const BULLISH_WORDS = [
  'surge', 'surges', 'surging', 'soar', 'soars', 'soaring', 'rally', 'rallies', 'rallying',
  'jump', 'jumps', 'jumping', 'gain', 'gains', 'gaining', 'rise', 'rises', 'rising',
  'boost', 'boosts', 'boosted', 'upgrade', 'upgrades', 'upgraded', 'outperform',
  'beat', 'beats', 'beating', 'exceeded', 'exceeds', 'record', 'high', 'highs',
  'bullish', 'optimistic', 'positive', 'strong', 'strength', 'growth', 'growing',
  'profit', 'profitable', 'revenue', 'earnings', 'dividend', 'buyback',
  'buy', 'overweight', 'accumulate', 'breakout', 'momentum', 'upside',
  'innovation', 'innovative', 'partnership', 'expansion', 'launch', 'launched',
  'approval', 'approved', 'win', 'wins', 'winning', 'success', 'successful',
  'deal', 'contract', 'award', 'awarded', 'recovery', 'recovering',
  'analyst upgrade', 'price target raised', 'top pick',
];

const BEARISH_WORDS = [
  'crash', 'crashes', 'crashing', 'plunge', 'plunges', 'plunging', 'tumble', 'tumbles',
  'drop', 'drops', 'dropping', 'fall', 'falls', 'falling', 'decline', 'declines', 'declining',
  'sink', 'sinks', 'sinking', 'slump', 'slumps', 'slumping', 'slide', 'slides', 'sliding',
  'downgrade', 'downgrades', 'downgraded', 'underperform', 'underweight',
  'miss', 'misses', 'missed', 'disappoint', 'disappoints', 'disappointing',
  'bearish', 'pessimistic', 'negative', 'weak', 'weakness', 'slowdown', 'slowing',
  'loss', 'losses', 'losing', 'deficit', 'debt', 'bankruptcy', 'bankrupt',
  'sell', 'selling', 'selloff', 'sell-off', 'panic', 'fear', 'concern', 'concerns',
  'warning', 'warns', 'warned', 'risk', 'risks', 'risky', 'threat', 'threatens',
  'lawsuit', 'sued', 'investigation', 'probe', 'fraud', 'scandal', 'recall',
  'layoff', 'layoffs', 'restructuring', 'downsizing', 'cut', 'cuts', 'cutting',
  'analyst downgrade', 'price target cut', 'target lowered',
];

const STRONG_BULLISH = ['surge', 'soar', 'record high', 'blowout', 'massive beat', 'breakout'];
const STRONG_BEARISH = ['crash', 'plunge', 'bankruptcy', 'fraud', 'scandal', 'panic sell'];

// ============================================================================
// Finnhub News Provider
// ============================================================================

/**
 * Finnhub company news provider with keyword sentiment analysis.
 * Uses /company-news endpoint (free tier, 60 calls/min).
 * For crypto, uses general market news with symbol filtering.
 */
export const finnhubNewsProvider: NewsProvider = {
  name: 'Finnhub',
  async getSentiment(symbol: string): Promise<NewsSentiment> {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
      return {
        score: 0,
        confidence: 0.3,
        articles: 0,
        summary: 'Finnhub API key not configured.',
      };
    }

    try {
      // Get news from last 3 days
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 3);

      const fromStr = from.toISOString().split('T')[0];
      const toStr = to.toISOString().split('T')[0];

      // Clean symbol for API (remove :crypto:us, :etf:us suffixes)
      const cleanSymbol = symbol.split(':')[0].toUpperCase();

      // For crypto, map to common names for better news matching
      const cryptoNames: Record<string, string> = {
        BTC: 'bitcoin',
        ETH: 'ethereum',
        SOL: 'solana',
        XRP: 'ripple',
        ADA: 'cardano',
        DOGE: 'dogecoin',
        DOT: 'polkadot',
        AVAX: 'avalanche',
      };

      let articles: Array<{ headline: string; summary: string; source: string; datetime: number }> = [];

      const isCrypto = symbol.includes(':crypto') || !!cryptoNames[cleanSymbol];

      if (isCrypto) {
        // Use general news endpoint filtered by crypto name
        const searchTerm = cryptoNames[cleanSymbol] || cleanSymbol;
        const response = await axios.get('https://finnhub.io/api/v1/news', {
          params: {
            category: 'crypto',
            token: apiKey,
          },
          timeout: 5000,
        });
        // Filter articles mentioning this crypto
        const allArticles = response.data || [];
        articles = allArticles.filter((a: any) => {
          const text = `${a.headline || ''} ${a.summary || ''}`.toLowerCase();
          return text.includes(searchTerm.toLowerCase()) || text.includes(cleanSymbol.toLowerCase());
        }).slice(0, 20);
      } else {
        // Company news for stocks/ETFs
        const response = await axios.get('https://finnhub.io/api/v1/company-news', {
          params: {
            symbol: cleanSymbol,
            from: fromStr,
            to: toStr,
            token: apiKey,
          },
          timeout: 5000,
        });
        articles = (response.data || []).slice(0, 20); // Limit to 20 most recent
      }

      if (articles.length === 0) {
        return {
          score: 0,
          confidence: 0.4,
          articles: 0,
          summary: `No recent news found for ${cleanSymbol}.`,
        };
      }

      // Score each article
      let totalScore = 0;
      let strongSignalCount = 0;
      const sources = new Set<string>();

      for (const article of articles) {
        const text = `${article.headline || ''} ${article.summary || ''}`.toLowerCase();
        sources.add(article.source || 'Unknown');

        let articleScore = 0;

        // Count bullish words
        for (const word of BULLISH_WORDS) {
          if (text.includes(word)) articleScore += 1;
        }
        // Strong bullish bonus
        for (const word of STRONG_BULLISH) {
          if (text.includes(word)) articleScore += 1.5;
        }
        // Count bearish words
        for (const word of BEARISH_WORDS) {
          if (text.includes(word)) articleScore -= 1;
        }
        // Strong bearish bonus
        for (const word of STRONG_BEARISH) {
          if (text.includes(word)) articleScore -= 1.5;
        }

        // Track strong signals
        if (Math.abs(articleScore) >= 3) strongSignalCount++;

        // Normalize article score to [-1, 1]
        const normalizedScore = Math.max(-1, Math.min(1, articleScore / 5));
        totalScore += normalizedScore;
      }

      // Average score across articles
      const avgScore = totalScore / articles.length;

      // Confidence based on article count and signal agreement
      const articleCountFactor = Math.min(1, articles.length / 10); // More articles = more confidence
      const agreementFactor = Math.abs(avgScore); // Stronger consensus = more confidence
      const strongSignalFactor = Math.min(1, strongSignalCount / 3); // Strong signals boost confidence
      const confidence = Math.min(0.95, 0.5 + articleCountFactor * 0.15 + agreementFactor * 0.2 + strongSignalFactor * 0.1);

      // Generate summary
      const sentimentLabel = avgScore > 0.15 ? 'bullish' : avgScore < -0.15 ? 'bearish' : 'mixed/neutral';
      const topSources = [...sources].slice(0, 3).join(', ');
      const summary = `${articles.length} articles analyzed (${topSources}). Sentiment: ${sentimentLabel}.`;

      return {
        score: Math.round(avgScore * 100) / 100,
        confidence: Math.round(confidence * 100) / 100,
        articles: articles.length,
        summary,
        sources: [...sources],
      };
    } catch (error: any) {
      console.error(`Finnhub news error for ${symbol}:`, error.message);
      return {
        score: 0,
        confidence: 0.3,
        articles: 0,
        summary: `Error fetching news: ${error.message}`,
      };
    }
  },
};

// Active news provider — defaults to Finnhub
let activeProvider: NewsProvider = finnhubNewsProvider;

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
  if (score > 0.2) {
    const confidence = Math.min(0.9, 0.5 + score * 0.4 * sentimentConfidence);
    return { action: 'BUY', confidence };
  } else if (score < -0.2) {
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
    sentiment.score > 0.2
      ? 'bullish'
      : sentiment.score < -0.2
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
