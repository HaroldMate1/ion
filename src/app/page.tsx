/**
 * Landing Page
 */

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TrendingUp, DollarSign, PieChart, History, Eye, Shield } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-white/10 p-4 rounded-full">
                <TrendingUp className="h-12 w-12" />
              </div>
            </div>
            <h1 className="text-5xl font-bold mb-6">
              Practice Trading Risk-Free
            </h1>
            <p className="text-xl mb-8 text-blue-100">
              Start with $100,000 virtual cash. Trade stocks, cryptocurrency, and ETFs with real-time market data.
            </p>
            <Link href="/login">
              <Button size="lg" variant="secondary" className="text-lg px-8 py-6">
                Get Started Free
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Everything You Need to Learn Trading</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <FeatureCard
              icon={<DollarSign className="h-8 w-8" />}
              title="$100,000 Virtual Cash"
              description="Start with a substantial virtual portfolio. Practice trading without any financial risk."
            />
            <FeatureCard
              icon={<TrendingUp className="h-8 w-8" />}
              title="Real-Time Market Data"
              description="Trade with live prices for stocks, cryptocurrencies, and ETFs from reliable market data sources."
            />
            <FeatureCard
              icon={<PieChart className="h-8 w-8" />}
              title="Portfolio Tracking"
              description="Monitor your holdings with real-time profit/loss calculations and performance analytics."
            />
            <FeatureCard
              icon={<History className="h-8 w-8" />}
              title="Transaction History"
              description="View complete records of all your trades with detailed information and filters."
            />
            <FeatureCard
              icon={<Eye className="h-8 w-8" />}
              title="Watchlists"
              description="Create watchlists to track your favorite assets and spot trading opportunities."
            />
            <FeatureCard
              icon={<Shield className="h-8 w-8" />}
              title="Secure & Private"
              description="Your data is protected with enterprise-grade security. Practice safely and privately."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-indigo-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Start Trading?</h2>
          <p className="text-xl mb-8 text-indigo-100 max-w-2xl mx-auto">
            Join now and get instant access to your virtual trading account. No credit card required.
          </p>
          <Link href="/login">
            <Button size="lg" variant="secondary" className="text-lg px-8 py-6">
              Sign Up Now
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="container mx-auto px-4 text-center">
          <p>© 2026 Investment Demo. Built with Next.js and Supabase.</p>
          <p className="mt-2 text-sm">This is a demo app for educational purposes only.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <div className="bg-indigo-100 w-16 h-16 rounded-lg flex items-center justify-center mb-4 text-indigo-600">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
