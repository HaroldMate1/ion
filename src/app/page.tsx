/**
 * ION Landing Page
 * Investment Optimized Network — AI-Driven Wealth Manager
 */

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  TrendingUp, Brain, PieChart, BarChart3, Crown, Zap,
  Shield, ArrowRight, Sparkles,
} from 'lucide-react';

const portfolioHoldings = [
  { symbol: 'NVDA', name: 'NVIDIA Corp', bar: 78, value: '$28,420', change: '+4.2%', pos: true  },
  { symbol: 'AAPL', name: 'Apple Inc',   bar: 62, value: '$21,830', change: '+1.8%', pos: true  },
  { symbol: 'MSFT', name: 'Microsoft',   bar: 55, value: '$18,990', change: '+2.3%', pos: true  },
  { symbol: 'BTC',  name: 'Bitcoin',     bar: 38, value: '$12,340', change: '-0.9%', pos: false },
];

const ionParticles = [
  { top: '10%', left: '4%',  size: 3, delay: '0s',    opacity: 0.45 },
  { top: '28%', left: '10%', size: 2, delay: '1.6s',  opacity: 0.32 },
  { top: '66%', left: '3%',  size: 4, delay: '3.1s',  opacity: 0.40 },
  { top: '17%', left: '74%', size: 2, delay: '0.9s',  opacity: 0.28 },
  { top: '43%', left: '89%', size: 3, delay: '2.3s',  opacity: 0.38 },
  { top: '79%', left: '83%', size: 2, delay: '1.2s',  opacity: 0.32 },
  { top: '55%', left: '47%', size: 2, delay: '4.0s',  opacity: 0.22 },
  { top: '34%', left: '57%', size: 3, delay: '2.8s',  opacity: 0.28 },
  { top: '86%', left: '28%', size: 2, delay: '0.6s',  opacity: 0.30 },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">

      {/* ── Ambient blobs ─────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute -top-60 -left-40 w-[850px] h-[850px] rounded-full opacity-[0.07] animate-blob"
          style={{ background: 'radial-gradient(circle, #8B5CF6 0%, transparent 65%)', filter: 'blur(90px)' }}
        />
        <div
          className="absolute top-1/2 -right-32 w-[650px] h-[650px] rounded-full opacity-[0.05] animate-blob delay-400"
          style={{ background: 'radial-gradient(circle, #60A5FA 0%, transparent 65%)', filter: 'blur(100px)' }}
        />
        <div
          className="absolute -bottom-40 left-1/4 w-[700px] h-[700px] rounded-full opacity-[0.04] animate-blob delay-700"
          style={{ background: 'radial-gradient(circle, #A78BFA 0%, transparent 65%)', filter: 'blur(110px)' }}
        />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(oklch(1 0 270 / 100%) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 270 / 100%) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        {/* ── SVG light streaks ──────────────────────────────────────── */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 1400 900"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#8B5CF6" stopOpacity="0" />
              <stop offset="45%"  stopColor="#8B5CF6" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="lg2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#60A5FA" stopOpacity="0" />
              <stop offset="50%"  stopColor="#60A5FA" stopOpacity="0.40" />
              <stop offset="100%" stopColor="#60A5FA" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="lg3" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#A78BFA" stopOpacity="0" />
              <stop offset="50%"  stopColor="#A78BFA" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#A78BFA" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="lg4" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#34D399" stopOpacity="0" />
              <stop offset="50%"  stopColor="#34D399" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#34D399" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Streak 1 — main purple arc */}
          <path
            d="M -100 300 C 200 150, 500 500, 900 250 S 1200 80, 1500 350"
            stroke="url(#lg1)" strokeWidth="1.5"
            strokeDasharray="220 1200"
            className="animate-dash-flow"
          />
          {/* Streak 2 — blue lower sweep */}
          <path
            d="M -100 620 C 200 510, 500 710, 800 510 S 1100 310, 1500 560"
            stroke="url(#lg2)" strokeWidth="1"
            strokeDasharray="180 1000"
            className="animate-dash-flow-2"
          />
          {/* Streak 3 — violet upper diagonal */}
          <path
            d="M 380 -50 C 480 200, 740 90, 950 340 S 1160 500, 1420 290"
            stroke="url(#lg3)" strokeWidth="1"
            strokeDasharray="160 1000"
            className="animate-dash-flow-3"
          />
          {/* Streak 4 — emerald subtle bottom */}
          <path
            d="M -50 810 C 200 760, 500 830, 810 710 S 1110 590, 1500 730"
            stroke="url(#lg4)" strokeWidth="0.8"
            strokeDasharray="140 800"
            className="animate-dash-flow-4"
          />
          {/* Streak 5 — secondary thin purple */}
          <path
            d="M 0 110 C 300 210, 610 55, 910 210 S 1210 360, 1400 160"
            stroke="url(#lg1)" strokeWidth="0.7"
            strokeDasharray="100 900"
            style={{ animationDelay: '3s' }}
            className="animate-dash-flow"
          />
        </svg>

        {/* ── Ion particles ──────────────────────────────────────────── */}
        {ionParticles.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-ion-float"
            style={{
              top: p.top,
              left: p.left,
              width: `${p.size}px`,
              height: `${p.size}px`,
              opacity: p.opacity,
              animationDelay: p.delay,
              background: '#8B5CF6',
              boxShadow: `0 0 ${p.size * 4}px #8B5CF6`,
            }}
          />
        ))}
      </div>

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav
        className="relative z-20 border-b border-white/[0.06]"
        style={{ background: 'oklch(0.09 0.025 270 / 80%)', backdropFilter: 'blur(20px)' }}
      >
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative icon-glow-purple p-2 rounded-xl">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div className="absolute inset-0 rounded-xl bg-primary/10 animate-pulse-glow opacity-60" />
            </div>
            <div>
              <span className="text-xl font-bold gradient-text-primary tracking-tight">ION</span>
              <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">Investment Optimized Network</span>
            </div>
          </div>
          <Link href="/login">
            <Button variant="ghost" className="text-sm text-muted-foreground hover:text-foreground border border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.04] rounded-xl">
              Sign in <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative z-10 pt-16 pb-24 px-4 lg:pt-24 lg:pb-32">
        <div className="container mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left — Copy */}
            <div className="animate-fade-in-up">
              {/* AI-Driven badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8
                bg-primary/10 border border-primary/20 text-xs font-semibold text-primary/90">
                <Sparkles className="h-3.5 w-3.5 animate-ping-dot" />
                AI-Driven Wealth Manager
              </div>

              {/* Headline */}
              <h1 className="text-5xl lg:text-6xl xl:text-[4.5rem] font-bold leading-[1.04] tracking-tight mb-6">
                <span className="text-foreground">The AI That</span>
                <br />
                {/* "Manages" with orbiting electrons */}
                <span className="relative inline-block">
                  <span className="gradient-text-primary">Manages</span>
                  <svg
                    aria-hidden="true"
                    className="pointer-events-none overflow-visible absolute"
                    style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 1, height: 1 }}
                    viewBox="0 0 1 1"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <defs>
                      <filter id="eGlow1"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                      <filter id="eGlow2"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                      <path id="ePath1" d="M -155,0 A 155,42 0 1,1 155,0 A 155,42 0 1,1 -155,0" />
                      <path id="ePath2" d="M -155,0 A 155,42 0 1,1 155,0 A 155,42 0 1,1 -155,0" transform="rotate(62 0 0)" />
                    </defs>
                    {/* Orbit ring 1 */}
                    <ellipse cx="0" cy="0" rx="155" ry="42" stroke="#8B5CF6" strokeWidth="0.7" strokeOpacity="0.22" />
                    {/* Orbit ring 2 */}
                    <ellipse cx="0" cy="0" rx="155" ry="42" stroke="#60A5FA" strokeWidth="0.5" strokeOpacity="0.16" transform="rotate(62 0 0)" />
                    {/* Electron 1 — purple */}
                    <circle r="4.5" fill="#8B5CF6" filter="url(#eGlow1)">
                      <animateMotion dur="3.8s" repeatCount="indefinite"><mpath href="#ePath1"/></animateMotion>
                    </circle>
                    {/* Electron 2 — blue, offset start */}
                    <circle r="3" fill="#60A5FA" filter="url(#eGlow2)">
                      <animateMotion dur="5.5s" repeatCount="indefinite" begin="1.4s"><mpath href="#ePath2"/></animateMotion>
                    </circle>
                  </svg>
                </span>
                <br />
                <span className="text-foreground">Your Wealth.</span>
              </h1>

              {/* Sub-copy */}
              <p className="text-lg text-muted-foreground leading-relaxed mb-9 max-w-lg">
                ION unifies real-time markets, expert portfolio mirroring, and 5 competing AI
                models into one intelligent platform — optimizing your wealth around the clock.
              </p>

              {/* CTA */}
              <Link href="/login">
                <Button
                  size="lg"
                  className="btn-shimmer text-white border-0 text-base px-10 py-6 rounded-2xl font-bold group"
                >
                  Start Growing Your Wealth
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>

              {/* Trust row */}
              <div className="flex flex-wrap items-center gap-5 mt-5 text-xs text-muted-foreground/80">
                <span className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" /> Free to use
                </span>
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> AI-powered
                </span>
                <span>No credit card required</span>
              </div>
            </div>

            {/* Right — Portfolio card mockup */}
            <div className="relative flex justify-center animate-fade-in-up delay-300 lg:animate-slide-in-right">
              {/* Glow behind card */}
              <div
                className="absolute inset-8 rounded-full blur-3xl opacity-[0.18]"
                style={{ background: 'radial-gradient(circle, #8B5CF6 0%, #60A5FA 100%)' }}
              />

              {/* Card */}
              <div className="glass-card card-gradient-border rounded-3xl p-6 w-full max-w-[400px] relative z-10 animate-float">

                {/* Card header */}
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">AI-Managed Portfolio</p>
                    <p className="text-4xl font-bold text-foreground">$127,842</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-sm font-semibold text-emerald-400">+$27,842 · +27.8%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/20">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-semibold text-emerald-400">LIVE</span>
                  </div>
                </div>

                {/* Sparkline chart */}
                <div className="mb-5 rounded-xl overflow-hidden bg-white/[0.025] px-3 pt-3 pb-1">
                  <svg viewBox="0 0 220 70" className="w-full" fill="none">
                    <defs>
                      <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#8B5CF6" stopOpacity="0.30" />
                        <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {/* Area fill */}
                    <path
                      d="M 0 60 C 20 58,25 65,40 52 C 55 39,60 48,80 38 C 100 28,105 35,120 25 C 135 15,145 20,165 11 C 185 4,200 7,220 3 L 220 70 L 0 70 Z"
                      fill="url(#sparkFill)"
                    />
                    {/* Line */}
                    <path
                      d="M 0 60 C 20 58,25 65,40 52 C 55 39,60 48,80 38 C 100 28,105 35,120 25 C 135 15,145 20,165 11 C 185 4,200 7,220 3"
                      stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round"
                    />
                    {/* End dot glow */}
                    <circle cx="220" cy="3" r="5" fill="#8B5CF6" fillOpacity="0.25" />
                    <circle cx="220" cy="3" r="2.5" fill="#8B5CF6" />
                  </svg>
                </div>

                {/* Holdings */}
                <div className="space-y-2 mb-4">
                  {portfolioHoldings.map((h) => (
                    <div key={h.symbol} className="holding-row rounded-xl px-3 py-2.5 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-primary">{h.symbol}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-foreground">{h.name}</span>
                          <span className="text-xs font-semibold text-foreground">{h.value}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-0.5 rounded-full bg-white/[0.06]">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${h.bar}%`,
                                background: h.pos
                                  ? 'linear-gradient(90deg, #8B5CF6, #60A5FA)'
                                  : 'linear-gradient(90deg, #EF4444, #F97316)',
                              }}
                            />
                          </div>
                          <span className={`text-[10px] font-medium flex-shrink-0 ${h.pos ? 'text-emerald-400' : 'text-red-400'}`}>
                            {h.change}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* AI footer */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/8 border border-primary/15">
                  <Brain className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    <span className="text-primary font-semibold">AI optimized</span>
                    {' '}· Rebalanced 2h ago · 12 positions active
                  </span>
                </div>
              </div>

              {/* Floating badge — buy signal */}
              <div
                className="absolute top-8 -right-4 glass-card rounded-2xl px-3 py-2.5 animate-float delay-300 z-20 hidden lg:block"
                style={{ minWidth: '148px' }}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">Buy Signal</span>
                </div>
                <p className="text-xs font-semibold text-foreground">NVDA · Strong momentum</p>
              </div>

              {/* Floating badge — alpha */}
              <div
                className="absolute bottom-14 -left-4 glass-card rounded-2xl px-3 py-2.5 animate-float delay-500 z-20 hidden lg:block"
                style={{ minWidth: '124px' }}
              >
                <p className="text-[10px] text-muted-foreground mb-0.5">vs S&P 500</p>
                <p className="text-sm font-bold gradient-text-primary">+11.4% Alpha</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Stats bar ──────────────────────────────────────────────────── */}
      <section
        className="relative z-10 py-8 px-4 border-y border-white/[0.05]"
        style={{ background: 'oklch(0.11 0.025 270 / 60%)' }}
      >
        <div className="container mx-auto max-w-4xl">
          <div className="flex flex-wrap items-center justify-center gap-10 md:gap-20 text-center">
            {[
              { value: '$100k',  label: 'Virtual Portfolio'  },
              { value: '5 AI',   label: 'Competing Models'   },
              { value: '12',     label: 'Expert Investors'   },
              { value: '24/7',   label: 'Market Coverage'    },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-bold gradient-text-primary">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section className="relative z-10 py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-primary/40" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Platform Features</span>
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-primary/40" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold gradient-text">
              One Platform. Infinite Intelligence.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard
              icon={<Brain className="h-7 w-7" />}
              iconClass="icon-glow-purple" iconColor="text-primary"
              cardClass="ai-card-brain"
              title="AI Trading Coach"
              description="An autonomous agent that monitors markets, generates signals, and executes paper trades based on technical indicators and sentiment."
              badge="Autonomous" badgeClass="badge-glow-purple"
            />
            <FeatureCard
              icon={<TrendingUp className="h-7 w-7" />}
              iconClass="icon-glow-blue" iconColor="text-blue-300"
              cardClass="ai-card-brain"
              title="Real-Time Intelligence"
              description="Live prices for US stocks, European equities, Latin American markets, and cryptocurrencies — all in one unified interface."
              badge="Live Data" badgeClass="badge-glow-blue"
            />
            <FeatureCard
              icon={<PieChart className="h-7 w-7" />}
              iconClass="icon-glow-emerald" iconColor="text-emerald-400"
              cardClass="ai-card-bot"
              title="LLM Strategy Lab"
              description="Compare 5 leading AI models — Gemini, Claude, Perplexity, ChatGPT, and Grok — each managing a $100k portfolio over 4 years."
              badge="5 Models" badgeClass="badge-glow-emerald"
            />
            <FeatureCard
              icon={<Crown className="h-7 w-7" />}
              iconClass="icon-glow-amber" iconColor="text-amber-400"
              cardClass="ai-card-merlin"
              title="Expert Investor Mirror"
              description="Track and mirror portfolios of Buffett, Dalio, ARK, and 12 world-class investors with real-time price updates via SEC filings."
              badge="12 Investors" badgeClass="badge-glow-amber"
            />
            <FeatureCard
              icon={<Zap className="h-7 w-7" />}
              iconClass="icon-glow-violet" iconColor="text-violet-400"
              cardClass="ai-card-houdini"
              title="Quantitative Screening"
              description="Magic Formula and elite quality gates (19 institutional-grade filters) for systematic large-cap stock selection."
              badge="Quant" badgeClass="badge-glow-violet"
            />
            <FeatureCard
              icon={<BarChart3 className="h-7 w-7" />}
              iconClass="icon-glow-blue" iconColor="text-blue-300"
              cardClass="ai-card-brain"
              title="Benchmark Tracking"
              description="Measure every strategy against S&P 500 (SPY) and NASDAQ 100 (QQQ) benchmarks with live performance comparison."
              badge="SPY · QQQ" badgeClass="badge-glow-blue"
            />
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="relative z-10 py-24 px-4">
        <div className="container mx-auto max-w-2xl text-center">
          <div className="glass-card card-gradient-border rounded-3xl p-10 md:p-14">
            <div className="icon-glow-purple inline-flex p-4 rounded-2xl mb-6 animate-float">
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 gradient-text">
              Let AI Work for Your Money.
            </h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Join ION and access advanced AI strategies, expert portfolio mirroring, and
              quantitative screening — all on a risk-free $100k virtual portfolio.
            </p>
            <Link href="/login">
              <Button size="lg" className="btn-shimmer text-white border-0 text-base px-10 py-6 rounded-2xl font-bold group">
                Start Growing Your Wealth
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              No credit card required · Free to use · Your data stays private
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/[0.06] py-10 px-4">
        <div className="container mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="icon-glow-purple p-1.5 rounded-lg">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold gradient-text-primary">ION</span>
            <span className="text-xs text-muted-foreground">Investment Optimized Network</span>
          </div>
          <p className="text-muted-foreground text-sm">© 2026 ION. Built with Next.js and Supabase.</p>
          <p className="mt-1 text-xs text-muted-foreground/60">For educational and demonstration purposes only. Not financial advice.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon, iconClass, iconColor, cardClass, title, description, badge, badgeClass,
}: {
  icon: React.ReactNode;
  iconClass: string;
  iconColor: string;
  cardClass: string;
  title: string;
  description: string;
  badge: string;
  badgeClass: string;
}) {
  return (
    <div className={`${cardClass} glass-card card-gradient-border card-hover-glow rounded-2xl p-5 animate-fade-in-up`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`${iconClass} p-3 rounded-xl`}>
          <div className={iconColor}>{icon}</div>
        </div>
        <span className={`${badgeClass} text-[10px] font-semibold px-2.5 py-1 rounded-full`}>{badge}</span>
      </div>
      <h3 className="text-base font-bold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
