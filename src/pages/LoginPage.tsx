import { Zap, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const { signInWithGoogle, loading, error } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse at 30% 20%, rgba(13, 148, 136, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(16, 185, 129, 0.06) 0%, transparent 50%), var(--bg-primary)',
      }} />

      {/* Floating Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md mx-4 animate-fade-in-up">
        <div className="glass-card p-10 text-center">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-[0_0_40px_rgba(13,148,136,0.3)]">
              <Zap className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Branding */}
          <h1 className="text-3xl brand-gradient-text mb-2">SuiteUtils</h1>
          <p className="premium-label mb-1">Stillwater Operations Hub</p>
          <p className="text-white/40 text-sm mb-8">
            Deploy, monitor, and govern your entire application ecosystem.
          </p>

          {/* Sign In Button */}
          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-semibold transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:shadow-[0_0_30px_rgba(255,255,255,0.05)] disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span className="text-sm">
              {loading ? 'Signing in...' : 'Sign in with Google'}
            </span>
          </button>

          {error && (
            <p className="mt-4 text-sm text-red-400 bg-red-400/10 rounded-xl px-4 py-2">
              {error}
            </p>
          )}

          {/* Footer */}
          <div className="mt-8 flex items-center justify-center gap-2 text-white/15 text-xs">
            <Shield className="w-3.5 h-3.5" />
            <span>Secured by Firebase Authentication</span>
          </div>
        </div>
      </div>
    </div>
  );
}
