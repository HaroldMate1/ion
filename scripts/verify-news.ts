
import dotenv from 'dotenv';
import { finnhubNewsProvider } from '../src/lib/coach/agents/newsAgent';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

async function verifyNewsProvider() {
  console.log('Verifying Finnhub News Provider...');
  
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: FINNHUB_API_KEY not found in .env.local');
    process.exit(1);
  }
  console.log('✅ API Key found');

  const symbol = 'AAPL';
  console.log(`Fetching sentiment for ${symbol}...`);

  try {
    const sentiment = await finnhubNewsProvider.getSentiment(symbol);
    console.log('✅ Sentiment received:');
    console.log(JSON.stringify(sentiment, null, 2));

    if (sentiment.articles === 0) {
      console.warn('⚠️  Warning: No articles found. Check if the API key has access to company news or if the symbol is correct.');
    } else {
      console.log(`✅ Successfully analyzed ${sentiment.articles} articles.`);
    }

  } catch (error) {
    console.error('❌ Error fetching sentiment:', error);
    process.exit(1);
  }
}

verifyNewsProvider();
