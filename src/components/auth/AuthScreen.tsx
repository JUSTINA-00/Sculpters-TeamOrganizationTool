import React, { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface AuthScreenProps {
  mode: 'login' | 'signup';
  onLogin: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onSignup: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onToggleMode: () => void;
}

export function AuthScreen({ mode, onLogin, onSignup, onToggleMode }: AuthScreenProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') await onLogin(e);
      else await onSignup(e);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#F9FAFB] p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-8 rounded-2xl border border-[rgba(0,0,0,0.08)] shadow-sm w-full max-w-md"
      >
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 bg-[#534AB7] rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-2xl">S</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Sculptors</h1>
        </div>
        <h2 className="text-xl font-bold mb-2 text-center">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h2>
        <p className="text-gray-500 text-sm text-center mb-8">
          {mode === 'login' ? 'Sign in to your distributed office' : 'Join the future of remote collaboration'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label htmlFor="auth-name" className="block text-xs font-bold text-gray-400 uppercase mb-1">Full Name</label>
              <input id="auth-name" name="name" type="text" required placeholder="Alex Smith" autoComplete="name"
                className="w-full px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.1)] outline-none focus:border-[#534AB7]" />
            </div>
          )}
          <div>
            <label htmlFor="auth-email" className="block text-xs font-bold text-gray-400 uppercase mb-1">Email</label>
            <input id="auth-email" name="email" type="email" required placeholder="you@example.com" autoComplete="email"
              className="w-full px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.1)] outline-none focus:border-[#534AB7]" />
          </div>
          <div>
            <label htmlFor="auth-password" className="block text-xs font-bold text-gray-400 uppercase mb-1">Password</label>
            <input id="auth-password" name="password" type="password" required placeholder="••••••••" minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.1)] outline-none focus:border-[#534AB7]" />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-[#A32D2D] text-xs bg-red-50 p-3 rounded-lg">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          <button type="submit" disabled={loading}
            className="w-full bg-[#534AB7] text-white py-3 rounded-xl font-bold hover:bg-[#453d9c] disabled:opacity-60 flex items-center justify-center gap-2">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        <div className="mt-6 text-center">
          <button onClick={onToggleMode} className="text-sm text-[#534AB7] font-medium hover:underline">
            {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}