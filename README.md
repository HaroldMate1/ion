# ION — Intelligent Options Network

**ION** is a full-stack investment intelligence platform that combines autonomous AI trading agents, expert investor tracking, quantitative screening strategies, and pharmaceutical regulatory intelligence into a single unified interface.

Built on Next.js App Router + Supabase with real-time market data.

---

## Features

### AI Hub

| Module | Description |
|---|---|
| **Trading Coach** | Autonomous AI agent that monitors markets, generates trading signals, and executes paper trades based on technical indicators, price action, and news sentiment. |
| **Fine-Tune Model** | Backtesting optimizer — test weight combinations for the coach's signal engine against historical data to maximize Sharpe ratio. |
| **LLM Portfolios** | Five leading AI models (Gemini, Claude, Perplexity, ChatGPT, Grok) each managing a $100,000 virtual portfolio. Compare their strategies head-to-head. |
| **Merlin** | Joel Greenblatt's Magic Formula applied to ~120 large-cap US stocks — ranks by earnings yield + return on equity, invests equally across top 30. |
| **Houdini** | Enhanced Magic Formula with 19 institutional-grade quality gates across profitability, debt, consistency, valuation, and Altman Z-Score. |
| **Prometheus** | Pharma regulatory intelligence engine. Tracks FDA and EMA drug approval/rejection decisions in real time, with investment signals generated from regulatory outcomes, AdCom votes, and competitive landscape analysis. |

### Expert Investor Tracking

Tracks 12 world-class investors across multiple data sources:

| Investor | Source | Frequency |
|---|---|---|
| Warren Buffett | SEC 13F (Berkshire Hathaway) | Quarterly |
| Howard Marks | SEC 13F (Oaktree Capital) | Quarterly |
| Terry Smith | SEC 13F (Fundsmith) | Quarterly |
| Stanley Druckenmiller | SEC 13F (Duquesne) | Quarterly |
| Joel Greenblatt | SEC 13F (Gotham Asset Mgmt) | Quarterly |
| Ray Dalio | SEC 13F (Bridgewater) | Quarterly |
| John Hempton | SEC 13F (Bronte Capital) | Quarterly |
| Cliff Asness | SEC 13F (AQR Capital) | Quarterly |
| Michael Burry | SEC 13F (Scion Asset Mgmt) | Quarterly |
| Mohnish Pabrai | SEC 13F (Pabrai Funds) | Quarterly |
| Nancy Pelosi | House Stock Watcher + House eFD PTRs | ~Weekly |
| Cathie Wood | ARK Innovation ETF daily CSV | Daily |

13F tracking diffs **two consecutive quarterly filings** from SEC EDGAR (not a static list), catching real quarter-over-quarter position changes with no false positives.

### Wallet
Personal finance tracker with bank accounts, assets (stocks, crypto, real estate), pension planning, subscriptions, and monthly snapshots.

### Virtual Trading
Paper trading with $100,000 starting capital. Real-time quotes from Yahoo Finance. Full P&L tracking, transaction history, and watchlist.

### Benchmarks
Compare portfolio performance against SPY, QQQ, DIA, and other major indices.

---

## Prometheus — Pharma Regulatory Intelligence

Prometheus tracks regulatory decisions from the FDA and EMA for pharmaceutical and biotech companies. It surfaces investment signals based on:

- **PDUFA dates** — FDA action deadlines with countdown timers
- **Advisory Committee (AdCom) votes** — independent expert recommendations
- **EMA CHMP opinions** — European regulatory committee decisions
- **Approval/rejection outcomes** — historical stock reactions on decision day
- **Investment signals** — buy/sell/hold/watch rated by risk level

### Signal Logic

| Scenario | Signal |
|---|---|
| First-in-class drug, strong Phase 3 data, Breakthrough designation, undervalued stock | Strong Buy |
| Established mechanism, large market, moderate competition | Buy |
| Approval expected and priced in, existing competition | Hold |
| Data pending, high binary event risk | Watch |
| CRL received on manufacturing/clinical issues, recoverable | Watch |
| Multiple competitors already entrenched, limited differentiation | Sell |

**Designations tracked:** Breakthrough Therapy (BTD), Priority Review (PR), Fast Track (FT), Orphan Drug (OD)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 |
| Styling | Tailwind CSS v4, shadcn/ui components |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth (email + OAuth) |
| State | TanStack React Query v5, Zustand |
| Charts | Recharts, Lightweight Charts |
| Market Data | Yahoo Finance 2 (live quotes) |
| Regulatory | openFDA API (free, no key required) |
| Congressional | House Stock Watcher API + House eFD |
| SEC Data | SEC EDGAR public API (no key required) |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A Vercel account (optional — for deployment)

### Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CRON_SECRET=your_cron_secret
```

### Installation

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Database Migrations

Apply migrations from `supabase/migrations/` in order using the Supabase dashboard SQL editor.

---

## Architecture

```
src/
├── app/
│   ├── (auth)/                # Login page
│   ├── (dashboard)/           # Protected routes
│   │   ├── ai/                # AI Hub + sub-pages
│   │   │   ├── pharma-intel/  # Prometheus — Regulatory Intelligence
│   │   │   └── page.tsx       # AI Hub overview
│   │   ├── coach/             # Trading Coach
│   │   ├── expert-investors/  # Expert tracking
│   │   ├── llm-portfolios/    # LLM portfolio comparison
│   │   ├── wizard/            # Merlin + Houdini screening
│   │   ├── wallet/            # Personal finance
│   │   ├── benchmarks/        # Index comparison
│   │   └── trade/             # Manual trading
│   └── api/                   # Backend API routes
│       ├── coach/             # Coach analysis & signals
│       ├── expert/            # Expert portfolio & activity
│       ├── fine-tune/         # Fine-tune model
│       ├── llm/               # LLM portfolio management
│       ├── pharma/            # Regulatory intelligence
│       ├── wallet/            # Wallet management
│       ├── wizard/            # Wizard portfolios
│       └── cron/              # Scheduled jobs
├── config/
│   ├── expert-investors.ts    # 12 expert investor configs
│   ├── pharma-pipeline.ts     # FDA/EMA regulatory pipeline
│   └── wizard-strategies.ts   # Merlin + Houdini configs
├── lib/
│   ├── coach/                 # Trading coach engine
│   ├── expert-tracking/       # SEC 13F, House disclosure, ARK fetchers
│   ├── pharma/                # openFDA API integration
│   └── supabase/              # Supabase client utilities
└── types/
    ├── pharma.types.ts        # Regulatory intelligence types
    └── expert-portfolio.types.ts
```

---

## Expert Tracking — How It Works

### 13F Investors (SEC EDGAR)
Quarterly 13F-HR filings are fetched directly from `data.sec.gov`. ION diffs the **two most recent consecutive filings** to detect real changes — not a static hardcoded list. This eliminates false positives from positions outside the curated top-10 display.

### Nancy Pelosi (Congressional)
Primary: **House Stock Watcher API** — aggregates all House member Periodic Transaction Reports (PTRs) in real time.
Fallback: **House eFD XML** (`disclosures.house.gov`) — direct PTR XML parsing with multiple URL pattern fallbacks.

### Cathie Wood (ARK Invest)
Daily CSV from ARK's public holdings endpoint, diffed against the previous day's weights. Changes ≥0.5% are reported.

---

## Deployment

```bash
npx vercel --prod
```

Cron jobs (coach analysis + expert tracking) are configured in `vercel.json` and run every 15 minutes during US market hours.

---

## License

Private — all rights reserved.
