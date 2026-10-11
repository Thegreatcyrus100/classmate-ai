import React from 'react';
import {
  GraduationCap,
  LogOut,
  User,
  Menu,
  X,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  onNavigateProfile?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleSidebar,
  isSidebarOpen,
  onNavigateProfile,
}) => {
  const { studentProfile, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-[#0B132B]/95 backdrop-blur-md border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left Branding */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none cursor-pointer"
            aria-label="Toggle menu"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div
            onClick={onNavigateProfile ? () => onNavigateProfile() : undefined}
            className="flex items-center gap-2.5 cursor-pointer"
            title="ClassMate AI"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-700 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg tracking-tight text-white">
                  ClassMate<span className="text-indigo-400">AI</span>
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded">
                  Academic
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block leading-none">
                AI Study & Review Platform
              </p>
            </div>
          </div>
        </div>

        {/* Right Student Profile & Actions */}
        {studentProfile && (
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Clickable Student Badge for Edit Profile */}
            <button
              type="button"
              onClick={onNavigateProfile}
              title="Click to view & edit student profile"
              className="flex items-center gap-2.5 py-1 px-2.5 sm:px-3 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-semibold text-xs shrink-0">
                {(studentProfile.full_name || studentProfile.fullName || 'ST')
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
              <div className="text-left text-xs hidden sm:block">
                <div className="font-semibold text-slate-100 leading-tight truncate max-w-[140px]">
                  {studentProfile.full_name || studentProfile.fullName}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span>@{studentProfile.username}</span>
                  <span>•</span>
                  <span className="px-1 py-0.2 bg-slate-800 rounded font-mono text-[10px] text-indigo-300 border border-slate-700">
                    {studentProfile.course_section || studentProfile.courseSection}
                  </span>
                </div>
              </div>
            </button>

            {/* Always Visible Log Out Button */}
            <button
              type="button"
              onClick={() => logout()}
              title="Sign Out / Log Out of ClassMate AI"
              className="flex items-center gap-1.5 text-xs font-semibold text-rose-200 hover:text-white px-3 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/60 hover:border-rose-700 transition-colors cursor-pointer shrink-0 shadow-sm shadow-rose-950/30"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span className="hidden xs:inline sm:inline">Log Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
