'use client';

import React, { useState } from 'react';
import { X, Lock, Mail, Loader2, Bookmark, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { User } from '@/lib/types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: User) => void;
  initialMode?: 'login' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
}) => {
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isEmailMode, setIsEmailMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSentNotice, setEmailSentNotice] = useState(false);

  if (!isOpen) return null;

  const supabaseConfigured = isSupabaseConfigured();

  // Google OAuth Sign In via Supabase Auth
  const handleGoogleSignIn = async () => {
    setError(null);
    setLoadingGoogle(true);

    try {
      const supabase = createClient();
      const redirectUrl = `${window.location.origin}/auth/callback`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        setError(error.message);
        setLoadingGoogle(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initiate Google Sign-In.');
      setLoadingGoogle(false);
    }
  };

  // Optional Email Password/Magic Link fallback
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoadingGoogle(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        // Try sign up if user doesn't exist
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) {
          setError(signUpError.message);
        } else {
          setEmailSentNotice(true);
        }
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoadingGoogle(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="pt-8 px-8 pb-6 border-b border-zinc-800/80 bg-zinc-950/40 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-indigo-600/25 ring-1 ring-white/20">
            <Bookmark className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-zinc-100 tracking-tight">
            Sign In to ResoVault
          </h2>
          <p className="text-xs text-zinc-400 mt-1.5 max-w-xs mx-auto">
            Cross-device cloud bookmarking powered by Supabase with Row Level Security.
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-8 space-y-5">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!supabaseConfigured && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs">
              <p className="font-semibold mb-1">Supabase Keys Required</p>
              <p className="text-[11px] text-amber-200/80 leading-relaxed">
                Add your <code className="bg-black/30 px-1 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
                <code className="bg-black/30 px-1 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{' '}
                <code className="bg-black/30 px-1 py-0.5 rounded">.env.local</code> to enable Google sign-in.
              </p>
            </div>
          )}

          {emailSentNotice && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-medium">
              Check your email for a confirmation link to complete registration!
            </div>
          )}

          {/* Primary Action: Google Sign In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loadingGoogle}
            className="w-full py-3 px-4 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 text-sm font-semibold shadow-md flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
          >
            {loadingGoogle ? (
              <Loader2 className="w-4 h-4 animate-spin text-zinc-600" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>Continue with Google</span>
          </button>

          {/* Privacy and RLS notice */}
          <div className="pt-2 border-t border-zinc-800/80 space-y-2">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Supabase Row Level Security (RLS) guarantees your links remain 100% private.</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Includes default categories: Video Editing, Development, Content Creation, &amp; Product Management.</span>
            </div>
          </div>

          {/* Collapsible Email / Password Option */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setIsEmailMode(!isEmailMode)}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors underline"
            >
              {isEmailMode ? 'Hide email login' : 'Or sign in with email & password'}
            </button>
          </div>

          {isEmailMode && (
            <form onSubmit={handleEmailAuth} className="space-y-3 pt-2">
              <div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2.5 bg-zinc-950/80 border border-zinc-800 focus:border-indigo-500 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 outline-none"
                />
              </div>
              <div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-3.5 py-2.5 bg-zinc-950/80 border border-zinc-800 focus:border-indigo-500 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loadingGoogle}
                className="w-full py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors"
              >
                Sign In with Email
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
