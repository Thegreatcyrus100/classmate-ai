import React, { useState, useEffect } from 'react';
import {
  User,
  GraduationCap,
  Calendar,
  Save,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Shield,
  KeyRound,
  AtSign,
  Lock,
  Eye,
  EyeOff,
  BookOpen,
  Award,
  Layers,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getUserStudyMaterials,
  getUserReviewers,
  getUserQuizAttempts,
  getUserStudyRooms,
  isValidUsernameFormat,
} from '../lib/firebase';
import { TermsModal } from '../components/TermsModal';

function parseErrorMessage(err: any): string {
  if (!err) return 'An unexpected error occurred.';
  const msg = err.message || String(err);
  try {
    if (msg.trim().startsWith('{')) {
      const parsed = JSON.parse(msg);
      return parsed.error || msg;
    }
  } catch {}
  return msg;
}

export const ProfilePage: React.FC = () => {
  const {
    studentProfile,
    updateProfileDocument,
    changeUsername,
    changePassword,
    logout,
  } = useAuth();

  // Profile fields: full_name and course_section
  const [fullName, setFullName] = useState(
    studentProfile?.full_name || studentProfile?.fullName || ''
  );
  const [courseSection, setCourseSection] = useState(
    studentProfile?.course_section || studentProfile?.courseSection || ''
  );
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Username change fields
  const [newUsername, setNewUsername] = useState(studentProfile?.username || '');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [usernameSuccess, setUsernameSuccess] = useState('');
  const [usernameError, setUsernameError] = useState('');

  // Password change fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Stats
  const [stats, setStats] = useState({
    materialsCount: 0,
    reviewersCount: 0,
    quizzesCount: 0,
    roomsCount: 0,
  });

  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    if (studentProfile) {
      setFullName(studentProfile.full_name || studentProfile.fullName || '');
      setCourseSection(studentProfile.course_section || studentProfile.courseSection || '');
      setNewUsername(studentProfile.username || '');

      Promise.all([
        getUserStudyMaterials(studentProfile.uid),
        getUserReviewers(studentProfile.uid),
        getUserQuizAttempts(studentProfile.uid),
        getUserStudyRooms(studentProfile.uid),
      ]).then(([mats, revs, quizzes, rooms]) => {
        setStats({
          materialsCount: mats.length,
          reviewersCount: revs.length,
          quizzesCount: quizzes.length,
          roomsCount: rooms.length,
        });
      });
    }
  }, [studentProfile]);

  // 1. Handle Update Profile: full_name and course_section
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    const cleanFullName = fullName.trim();
    const cleanCourse = courseSection.trim().toUpperCase();

    if (!cleanFullName || cleanFullName.length < 2) {
      setProfileError('Full Name must be at least 2 characters long.');
      return;
    }
    if (!cleanCourse) {
      setProfileError('Course & Section is required (e.g. BSIT-1B, BSA-2A).');
      return;
    }

    setIsSavingProfile(true);
    try {
      await updateProfileDocument({
        full_name: cleanFullName,
        course_section: cleanCourse,
      });
      setProfileSuccess('Profile details (Full Name and Course/Section) updated securely in Firestore.');
      setTimeout(() => setProfileSuccess(''), 4000);
    } catch (err: any) {
      setProfileError(parseErrorMessage(err));
    } finally {
      setIsSavingProfile(false);
    }
  };

  // 2. Handle Username Change with server-side check
  const handleChangeUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameError('');
    setUsernameSuccess('');

    const trimmed = newUsername.trim().toLowerCase();
    if (!trimmed) {
      setUsernameError('Please enter a username.');
      return;
    }
    if (!isValidUsernameFormat(trimmed)) {
      setUsernameError('Username must be 3-30 characters with letters, numbers, and underscores only.');
      return;
    }
    if (trimmed === studentProfile?.username.toLowerCase()) {
      setUsernameError('New username is identical to your current username.');
      return;
    }

    setIsSavingUsername(true);
    try {
      const updated = await changeUsername(trimmed);
      setUsernameSuccess(`Username successfully changed to @${updated}. Uniqueness verified.`);
      setTimeout(() => setUsernameSuccess(''), 4000);
    } catch (err: any) {
      setUsernameError(parseErrorMessage(err));
    } finally {
      setIsSavingUsername(false);
    }
  };

  // 3. Handle Password Change using Firebase Authentication SDK
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!newPassword) {
      setPasswordError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match. Please verify.');
      return;
    }

    setIsSavingPassword(true);
    try {
      await changePassword(newPassword, currentPassword || undefined);
      setPasswordSuccess('Password successfully updated via Firebase Authentication.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(''), 4000);
    } catch (err: any) {
      setPasswordError(parseErrorMessage(err));
    } finally {
      setIsSavingPassword(false);
    }
  };

  if (!studentProfile) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-indigo-400" />
          Edit Student Profile & Security
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Update your Firestore profile document, change your unique username, or update your password.
        </p>
      </div>

      {/* Top Profile Summary Card */}
      <div className="p-6 rounded-2xl bg-[#0B132B] border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-700 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-indigo-600/30">
              {(studentProfile.full_name || studentProfile.fullName || 'ST')
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {studentProfile.full_name || studentProfile.fullName}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span className="font-mono text-indigo-300">@{studentProfile.username}</span>
                <span>•</span>
                <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-slate-900 text-indigo-200 border border-slate-800">
                  {studentProfile.course_section || studentProfile.courseSection}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => logout()}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-300 bg-rose-950/30 hover:bg-rose-950/60 border border-rose-900/50 flex items-center gap-1.5 self-start sm:self-auto transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Real Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] text-slate-400 font-semibold uppercase">Study Files</div>
            <div className="text-lg font-bold text-white font-mono mt-0.5">
              {stats.materialsCount}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] text-slate-400 font-semibold uppercase">Reviewers</div>
            <div className="text-lg font-bold text-white font-mono mt-0.5">
              {stats.reviewersCount}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] text-slate-400 font-semibold uppercase">Quizzes Taken</div>
            <div className="text-lg font-bold text-white font-mono mt-0.5">
              {stats.quizzesCount}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] text-slate-400 font-semibold uppercase">Rooms Enrolled</div>
            <div className="text-lg font-bold text-white font-mono mt-0.5">
              {stats.roomsCount}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: EDIT PROFILE (full_name & course_section) */}
      <div className="p-6 rounded-2xl bg-[#0B132B] border border-slate-800 space-y-4">
        <div className="flex items-center gap-2 text-white font-semibold text-sm pb-2 border-b border-slate-800">
          <User className="w-4 h-4 text-indigo-400" />
          <span>Edit Profile Information (Firestore Profile Document)</span>
        </div>

        {profileSuccess && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{profileSuccess}</span>
          </div>
        )}

        {profileError && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{profileError}</span>
          </div>
        )}

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Full Name (`full_name`) <span className="text-indigo-400">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Maria Teresa Santos"
                className="mt-1 block w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Stored in Firestore users profile (full_name) document.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Course & Section (course_section) <span className="text-indigo-400">*</span>
              </label>
              <input
                type="text"
                required
                value={courseSection}
                onChange={(e) => setCourseSection(e.target.value)}
                placeholder="e.g. BSIT-1B, BSA-2A, BSCS-3B"
                className="mt-1 block w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none uppercase font-mono"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Stored in Firestore users profile (course_section) document.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isSavingProfile}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingProfile ? 'Saving Changes...' : 'Save Profile Changes'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: USERNAME CHANGE (with server-side uniqueness check) */}
      <div className="p-6 rounded-2xl bg-[#0B132B] border border-slate-800 space-y-4">
        <div className="flex items-center gap-2 text-white font-semibold text-sm pb-2 border-b border-slate-800">
          <AtSign className="w-4 h-4 text-indigo-400" />
          <span>Change Username (Server-Side Uniqueness Check)</span>
        </div>

        {usernameSuccess && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{usernameSuccess}</span>
          </div>
        )}

        {usernameError && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{usernameError}</span>
          </div>
        )}

        <form onSubmit={handleChangeUsername} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300">
              New Academic Username
            </label>
            <div className="mt-1 relative max-w-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-mono text-sm">
                @
              </div>
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="new_username"
                className="block w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Verified against Firestore via `/api/auth/check-username` server mechanism and atomically transferred.
            </p>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isSavingUsername || newUsername.trim() === studentProfile.username}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <AtSign className="w-3.5 h-3.5" />
              <span>{isSavingUsername ? 'Verifying & Updating...' : 'Update Username'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 3: PASSWORD CHANGE (Firebase Authentication SDK) */}
      <div className="p-6 rounded-2xl bg-[#0B132B] border border-slate-800 space-y-4">
        <div className="flex items-center gap-2 text-white font-semibold text-sm pb-2 border-b border-slate-800">
          <KeyRound className="w-4 h-4 text-indigo-400" />
          <span>Change Password (Firebase Authentication SDK)</span>
        </div>

        {passwordSuccess && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{passwordSuccess}</span>
          </div>
        )}

        {passwordError && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          {/* Current Password */}
          <div>
            <div className="flex justify-between items-center">
              <label className="block text-xs font-semibold text-slate-300">
                Current Password (for re-authentication)
              </label>
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showCurrentPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              type={showCurrentPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password if required"
              className="mt-1 block w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* New Password */}
            <div>
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold text-slate-300">
                  New Password <span className="text-indigo-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showNewPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="mt-1 block w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Confirm New Password <span className="text-indigo-400">*</span>
              </label>
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="mt-1 block w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

            <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isSavingPassword || !newPassword || !confirmPassword}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isSavingPassword ? 'Updating Password...' : 'Update Password via Firebase'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 4: TERMS & ACCOUNT SESSION */}
      <div className="p-6 rounded-2xl bg-[#0B132B] border border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <Shield className="w-4 h-4 text-indigo-400" />
            <span>Academic Integrity & Account Session</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div>
            <div className="text-xs font-semibold text-white">ClassMate AI Academic Terms</div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Review our Academic Integrity, Non-Cheating, and Multimodal Document AI policy.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowTerms(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-indigo-300 bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-800/60 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span>View Terms & Conditions</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-rose-950/20 border border-rose-900/30">
          <div>
            <div className="text-xs font-semibold text-rose-200">Sign Out of Session</div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Securely end your authenticated student session on this device.
            </p>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-600/20 flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out of ClassMate AI</span>
          </button>
        </div>
      </div>

      {/* Terms & Conditions Modal */}
      <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
    </div>
  );
};
