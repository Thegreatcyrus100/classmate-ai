import React, { useState } from 'react';
import {
  GraduationCap,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TermsModal } from '../components/TermsModal';

interface LoginPageProps {
  onGoToRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onGoToRegister }) => {
  const { login, loginWithGoogle, needsGoogleProfileSetup, completeGoogleProfile, currentUser } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Google Profile Setup state (if logged in with Google for the first time)
  const [googleUsername, setGoogleUsername] = useState('');
  const [googleCourseSection, setGoogleCourseSection] = useState('');
  const [googleSetupError, setGoogleSetupError] = useState('');
  const [googleSetupLoading, setGoogleSetupLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      setError('Please enter your student username.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      await login(cleanUsername, password);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('Google Sign In error:', err);
      setError(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGoogleSetupError('');

    if (!googleUsername.trim()) {
      setGoogleSetupError('Please choose a username.');
      return;
    }
    if (!googleCourseSection.trim()) {
      setGoogleSetupError('Please enter your Course & Section (e.g. BSIT-1B).');
      return;
    }

    setGoogleSetupLoading(true);
    try {
      await completeGoogleProfile({
        username: googleUsername.trim().toLowerCase(),
        courseSection: googleCourseSection.trim().toUpperCase(),
      });
    } catch (err: any) {
      setGoogleSetupError(err.message || 'Failed to complete profile.');
    } finally {
      setGoogleSetupLoading(false);
    }
  };

  // If user signed in via Google but needs to complete course/username
  if (needsGoogleProfileSetup && currentUser) {
    return (
      <div className="min-h-screen bg-[#070B19] text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-[#0B132B] py-8 px-6 sm:px-8 shadow-2xl rounded-2xl border border-slate-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-300">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Complete Student Setup</h3>
                <p className="text-xs text-slate-400">Welcome, {currentUser.displayName || 'Student'}!</p>
              </div>
            </div>

            {googleSetupError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{googleSetupError}</span>
              </div>
            )}

            <form onSubmit={handleGoogleProfileSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300">Choose Username</label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-mono text-sm">
                    @
                  </div>
                  <input
                    type="text"
                    required
                    value={googleUsername}
                    onChange={(e) => setGoogleUsername(e.target.value)}
                    placeholder="e.g. j_doe"
                    className="block w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-100 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300">Course & Section</label>
                <input
                  type="text"
                  required
                  value={googleCourseSection}
                  onChange={(e) => setGoogleCourseSection(e.target.value)}
                  placeholder="e.g. BSIT-1B"
                  className="mt-1 block w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-100 focus:border-indigo-500 focus:outline-none uppercase font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={googleSetupLoading}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {googleSetupLoading ? 'Saving...' : 'Enter ClassMate AI'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070B19] text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-transparent to-transparent pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-700 flex items-center justify-center shadow-xl shadow-indigo-600/30 text-white">
            <GraduationCap className="w-7 h-7" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">
            ClassMate<span className="text-indigo-400">AI</span>
          </span>
        </div>
        <h2 className="mt-2 text-center text-xl font-bold text-white tracking-tight">
          Student Portal Sign In
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          Sign in to access your course reviewers, quizzes, and study rooms.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-[#0B132B] py-8 px-6 sm:px-8 shadow-2xl rounded-2xl border border-slate-800">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Username */}
            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Student Username
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-mono text-sm">
                  @
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. maria_santos"
                  className="block w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold text-slate-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="mt-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="block w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Sign In Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Social Sign-In option */}
          <div className="mt-5">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase">
                <span className="bg-[#0B132B] px-2 text-slate-400">Or continue with</span>
              </div>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
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
                <span>Google Account</span>
              </button>
            </div>
          </div>

          {/* Switch to Register */}
          <div className="mt-6 pt-5 border-t border-slate-800 text-center space-y-3">
            <p className="text-xs text-slate-400">
              New college student?{' '}
              <button
                onClick={onGoToRegister}
                className="font-semibold text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
              >
                Create student account
              </button>
            </p>

            <div>
              <button
                type="button"
                onClick={() => setShowTerms(true)}
                className="text-[11px] text-slate-500 hover:text-indigo-400 transition-colors underline underline-offset-2"
              >
                View Terms & Conditions and Academic Integrity Policy
              </button>
            </div>
          </div>
        </div>
      </div>

      <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
    </div>
  );
};
