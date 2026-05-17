/**
 * Login Page
 * Social authentication with Google and GitHub
 */

'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { TrendingUp, Sparkles, Brain, Crown, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const handleSocialLogin = async (provider: 'google' | 'github') => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/api/auth/callback` },
      });
      if (error) toast.error(`Login failed: ${error.message}`);
    } catch (error) {
      toast.error('An unexpected error occurred');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">

      {/* ── Ambient blobs ────────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-[0.08] animate-blob"
          style={{ background: 'radial-gradient(circle, oklch(0.68 0.26 265) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute -bottom-20 -right-20 w-[400px] h-[400px] rounded-full opacity-[0.06] animate-blob delay-400"
          style={{ background: 'radial-gradient(circle, oklch(0.65 0.22 240) 0%, transparent 70%)', filter: 'blur(70px)' }} />
        <div className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(oklch(1 0 270 / 100%) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 270 / 100%) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }} />
      </div>

      <div className="relative z-10 w-full max-w-md animate-scale-in">

        {/* ── Glass card ───────────────────────────────────────────────── */}
        <div className="glass-card card-gradient-border rounded-3xl p-8">

          {/* Logo + name */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex flex-col items-center gap-3 group">
              <div className="relative icon-glow-purple p-4 rounded-2xl transition-transform duration-300 group-hover:scale-105">
                <TrendingUp className="h-8 w-8 text-primary" />
                <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-pulse-glow opacity-60" />
              </div>
              <div>
                <h1 className="text-3xl font-bold gradient-text-primary tracking-tight">ION</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Investment Optimized Network</p>
              </div>
            </Link>
          </div>

          {/* Headline */}
          <div className="text-center mb-7">
            <h2 className="text-lg font-bold text-foreground">Welcome back</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in to access your intelligent investment ecosystem
            </p>
          </div>

          {/* Auth buttons */}
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full rounded-xl border-white/[0.10] bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/[0.16] transition-all py-5 font-medium"
              onClick={() => handleSocialLogin('google')}
              disabled={isLoading}
            >
              <svg className="mr-2.5 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-xl border-white/[0.10] bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/[0.16] transition-all py-5 font-medium"
              onClick={() => handleSocialLogin('github')}
              disabled={isLoading}
            >
              <svg className="mr-2.5 h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
              </svg>
              Continue with GitHub
            </Button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-white/[0.06]" />
            <span className="text-xs text-muted-foreground">What you get</span>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>

          {/* Features grid */}
          <div className="grid grid-cols-3 gap-2.5 mb-6">
            {[
              { icon: TrendingUp, label: '$100k Virtual Portfolio', glowClass: 'icon-glow-purple', colorClass: 'text-primary' },
              { icon: Brain,      label: 'AI Trading Coach',         glowClass: 'icon-glow-blue',   colorClass: 'text-blue-300' },
              { icon: Crown,      label: 'Expert Investors',         glowClass: 'icon-glow-amber',  colorClass: 'text-amber-400' },
              { icon: BarChart3,  label: 'Live Benchmarks',          glowClass: 'icon-glow-emerald',colorClass: 'text-emerald-400' },
              { icon: Sparkles,   label: 'LLM Strategy Lab',         glowClass: 'icon-glow-violet', colorClass: 'text-violet-400' },
              { icon: TrendingUp, label: 'Quant Screening',          glowClass: 'icon-glow-purple', colorClass: 'text-primary' },
            ].map(({ icon: Icon, label, glowClass, colorClass }) => (
              <div key={label} className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.03] border border-white/[0.05] text-center">
                <div className={`${glowClass} p-1.5 rounded-lg`}>
                  <Icon className={`h-3.5 w-3.5 ${colorClass}`} />
                </div>
                <span className="text-[9px] leading-tight text-muted-foreground font-medium">{label}</span>
              </div>
            ))}
          </div>

          {/* Legal */}
          <p className="text-center text-xs text-muted-foreground/70">
            By signing in you agree to our terms of service.
            For educational purposes only — not financial advice.
          </p>
        </div>
      </div>
    </div>
  );
}
