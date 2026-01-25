# Investment Demo App

A full-stack web application for practicing stock, cryptocurrency, and ETF trading with virtual money. Built with Next.js, TypeScript, Supabase, and Tailwind CSS.

## Features

- **Virtual Trading**: Start with $100,000 virtual cash to trade stocks, crypto, and ETFs
- **Real-time Prices**: Live market data from Alpha Vantage and CoinGecko APIs
- **Portfolio Tracking**: Monitor your holdings with real-time profit/loss calculations
- **Historical Charts**: Track your portfolio performance over time
- **Transaction History**: Complete record of all trades
- **Watchlist**: Save favorite assets for quick access
- **Social Authentication**: Login with Google or GitHub

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **State Management**: TanStack Query (React Query), Zustand
- **Charts**: Recharts for portfolio analytics
- **Market Data**: Alpha Vantage (stocks/ETFs), CoinGecko (crypto)

## Prerequisites

- Node.js 18+ and npm
- A Supabase account (https://supabase.com)
- Alpha Vantage API key (https://www.alphavantage.co/support/#api-key)

## Setup Instructions

### 1. Install Dependencies

Dependencies are already installed! If you need to reinstall:

```bash
npm install
```

### 2. Set Up Supabase

1. **Create a new project** at https://app.supabase.com

2. **Run the database migration**:
   - Go to your Supabase project
   - Navigate to the SQL Editor
   - Copy the contents of `supabase/migrations/001_initial_schema.sql`
   - Paste and execute it in the SQL Editor

3. **Configure OAuth Providers**:
   - Go to Authentication > Providers
   - Enable **Google OAuth**:
     - Get credentials from Google Cloud Console
     - Add authorized redirect URL: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
   - Enable **GitHub OAuth**:
     - Create OAuth App in GitHub Settings
     - Add callback URL: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`

4. **Get your Supabase credentials**:
   - Go to Settings > API
   - Copy `Project URL` and `anon public` key

### 3. Set Up Alpha Vantage

1. Get a free API key at https://www.alphavantage.co/support/#api-key
2. Free tier provides 25 API requests per day

### 4. Configure Environment Variables

Edit `.env.local` and fill in your credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ALPHA_VANTAGE_API_KEY=your-alpha-vantage-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
investment-demo-app/
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── (auth)/              # Authentication pages
│   │   ├── (dashboard)/         # Protected dashboard routes
│   │   └── api/                 # API routes
│   ├── components/              # React components
│   ├── lib/                     # Utilities & API clients
│   ├── hooks/                   # Custom React hooks
│   ├── types/                   # TypeScript types
│   └── schemas/                 # Zod validation schemas
├── supabase/migrations/         # Database schema
└── public/                      # Static assets
```

## Next Steps

After setup is complete, the remaining features will be implemented:

- [ ] Authentication pages (login with Google/GitHub)
- [ ] Market data API integration
- [ ] Trading system (buy/sell)
- [ ] Portfolio dashboard
- [ ] Transaction history
- [ ] Watchlist

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## License

MIT License
