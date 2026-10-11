import React, { useState } from 'react';
import {
  GraduationCap,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  BookOpen,
  X,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { checkUsernameAvailability, isValidUsernameFormat } from '../lib/firebase';
import { TermsModal } from '../components/TermsModal';

interface RegisterPageProps {
  onGoToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onGoToLogin }) => {
  const { register, loginWithGoogle } = useAuth();

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [courseSection, setCourseSection] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameError, setUsernameError] = useState('');

  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  // Check username availability on blur
  const handleUsernameBlur = async () => {
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) {
      setUsernameStatus('idle');
      setUsernameError('');
      return;
    }

    if (!isValidUsernameFormat(trimmed)) {
      setUsernameStatus('invalid');
      setUsernameError('3-30 characters with letters, numbers, and underscores only.');
      return;
    }

    setUsernameChecking(true);
    try {
      const serverRes = await fetch('/api/auth/check-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmed }),
      });
      if (serverRes.ok) {
        const data = await serverRes.json();
        if (data.available) {
          setUsernameStatus('available');
          setUsernameError('');
        } else {
          setUsernameStatus('taken');
          setUsernameError(data.error || `Username "${username}" is already taken by another student.`);
        }
      } else {
        const isAvailable = await checkUsernameAvailability(trimmed);
        if (isAvailable) {
          setUsernameStatus('available');
          setUsernameError('');
        } else {
          setUsernameStatus('taken');
          setUsernameError(`Username "${username}" is already taken by another student.`);
        }
      }
    } catch (err: any) {
      setUsernameStatus('invalid');
      setUsernameError(err.message || 'Error checking username');
    } finally {
      setUsernameChecking(false);
    }
  };

  // Password strength calculation
  const getPasswordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const passwordStrength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanUsername = username.trim().toLowerCase();
    const cleanFullName = fullName.trim();
    const cleanCourse = courseSection.trim().toUpperCase();

    if (!cleanUsername) {
      setFormError('Please enter a username.');
      return;
    }
    if (!isValidUsernameFormat(cleanUsername)) {
      setFormError('Username must be 3-30 characters using only letters, numbers, and underscores.');
      return;
    }
    if (!cleanFullName || cleanFullName.length < 2) {
      setFormError('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!cleanCourse) {
      setFormError('Please enter your Course & Section (e.g., BSIT-1B).');
      return;
    }
    if (!password) {
      setFormError('Please create a password.');
      return;
    }
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match. Please re-enter.');
      return;
    }
    if (!agreeTerms) {
      setFormError('You must agree to the Academic Integrity Terms & Privacy Policy to register.');
      return;
    }

    setLoading(true);
    try {
      await register({
        username: cleanUsername,
        fullName: cleanFullName,
        courseSection: cleanCourse,
        password,
      });
      // Registration successful! AuthContext listener triggers dashboard navigation
    } catch (err: any) {
      console.error('Registration failed:', err);
      setFormError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070B19] text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Subtle Ambience */}
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
          Create Student Account
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          Join your college peers for AI-powered document review, quizzes, and collaboration.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-[#0B132B] py-8 px-6 sm:px-8 shadow-2xl rounded-2xl border border-slate-800">
          {formError && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Username Field */}
            <div>
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold text-slate-300">
                  Username <span className="text-indigo-400">*</span>
                </label>
                {usernameChecking && (
                  <span className="text-[11px] text-slate-400 animate-pulse">Checking availability...</span>
                )}
                {usernameStatus === 'available' && !usernameChecking && (
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Available
                  </span>
                )}
                {usernameStatus === 'taken' && !usernameChecking && (
                  <span className="text-[11px] text-rose-400 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3" /> Already taken
                  </span>
                )}
              </div>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-mono text-sm">
                  @
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setUsernameStatus('idle');
                    setUsernameError('');
                  }}
                  onBlur={handleUsernameBlur}
                  placeholder="e.g. maria_santos"
                  className={`block w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-900 border text-slate-100 placeholder-slate-500 focus:outline-none transition-colors ${
                    usernameStatus === 'taken'
                      ? 'border-rose-600 focus:border-rose-500'
                      : usernameStatus === 'available'
                      ? 'border-emerald-600 focus:border-emerald-500'
                      : 'border-slate-800 focus:border-indigo-500'
                  }`}
                />
              </div>
              {usernameError ? (
                <p className="mt-1 text-[11px] text-rose-400">{usernameError}</p>
              ) : (
                <p className="mt-1 text-[11px] text-slate-400">
                  Unique student identifier (letters, numbers, and underscores).
                </p>
              )}
            </div>

            {/* Full Name Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Full Name <span className="text-indigo-400">*</span>
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Maria Teresa Santos"
                  className="block w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none transition-colors"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Displayed on your study materials, reviewers, and room posts.
              </p>
            </div>

            {/* Course & Section Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Course & Section <span className="text-indigo-400">*</span>
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  required
                  value={courseSection}
                  onChange={(e) => setCourseSection(e.target.value)}
                  placeholder="e.g. BSIT-1B, BSA-2A, BSCS-3B"
                  className="block w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none transition-colors uppercase font-mono"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Helps classmates find and collaborate in relevant study rooms.
              </p>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold text-slate-300">
                  Password <span className="text-indigo-400">*</span>
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
                  placeholder="At least 6 characters"
                  className="block w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Password Strength Meter */}
              {password && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1 h-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`flex-1 rounded-full transition-all ${
                          passwordStrength >= level
                            ? passwordStrength <= 2
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                            : 'bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>
                      Strength:{' '}
                      {passwordStrength <= 1
                        ? 'Weak'
                        : passwordStrength <= 2
                        ? 'Fair'
                        : passwordStrength <= 3
                        ? 'Good'
                        : 'Strong'}
                    </span>
                    <span>Min 6 characters</span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold text-slate-300">
                  Confirm Password <span className="text-indigo-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="mt-1">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className={`block w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border text-slate-100 placeholder-slate-500 focus:outline-none transition-colors ${
                    confirmPassword && confirmPassword !== password
                      ? 'border-rose-600 focus:border-rose-500'
                      : confirmPassword && confirmPassword === password
                      ? 'border-emerald-600 focus:border-emerald-500'
                      : 'border-slate-800 focus:border-indigo-500'
                  }`}
                />
              </div>
              {confirmPassword && confirmPassword !== password && (
                <p className="mt-1 text-[11px] text-rose-400">Passwords do not match.</p>
              )}
            </div>

            {/* Academic Terms Checkbox */}
            <div className="pt-1 space-y-1.5">
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="agreeTermsCheckbox"
                  required
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-900 cursor-pointer"
                />
                <div className="text-[11px] text-slate-300 leading-tight">
                  <label htmlFor="agreeTermsCheckbox" className="cursor-pointer">
                    I agree to the{' '}
                  </label>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowTermsModal(true);
                    }}
                    className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2 cursor-pointer inline"
                  >
                    Terms & Conditions and Academic Integrity Policy
                  </button>{' '}
                  <span className="text-slate-400">
                    and acknowledge that uploaded documents are processed by AI for academic study purposes.
                  </span>
                </div>
              </div>
            </div>

            {/* Create Account Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || usernameChecking || usernameStatus === 'taken'}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Create Student Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              Already have an account?{' '}
              <button
                onClick={onGoToLogin}
                className="font-semibold text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
              >
                Sign in to ClassMate AI
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Reusable Terms & Conditions Dialog */}
      <TermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={() => setAgreeTerms(true)}
        showAcceptButton={true}
      />
    </div>
  );
};
