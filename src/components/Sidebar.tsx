import React, { useState } from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  BookOpen,
  Users,
  UserCheck,
  Sparkles,
  HelpCircle,
  Bot,
  LogOut,
  Shield,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TermsModal } from './TermsModal';

export type NavTab = 'dashboard' | 'upload' | 'materials' | 'rooms' | 'chatbot' | 'profile';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpen,
  onClose,
}) => {
  const { studentProfile, logout } = useAuth();
  const [showTerms, setShowTerms] = useState(false);

  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'Study Dashboard',
      icon: LayoutDashboard,
      desc: 'Overview & recent progress',
    },
    {
      id: 'upload' as NavTab,
      label: 'Upload Academic File',
      icon: UploadCloud,
      desc: 'PDF, DOCX, PPTX, Images',
    },
    {
      id: 'materials' as NavTab,
      label: 'Reviewers & Materials',
      icon: BookOpen,
      desc: 'All analyzed documents',
    },
    {
      id: 'rooms' as NavTab,
      label: 'Classmate Rooms',
      icon: Users,
      desc: 'Collaborate & share notes',
    },
    {
      id: 'chatbot' as NavTab,
      label: 'Gemini Chatbot',
      icon: Bot,
      desc: 'Multi-turn AI tutor & solver',
    },
    {
      id: 'profile' as NavTab,
      label: 'Edit Profile',
      icon: UserCheck,
      desc: 'Full name, course & security',
    },
  ];

  const handleSelect = (tab: NavTab) => {
    onSelectTab(tab);
    onClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-xs md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed md:sticky top-16 left-0 z-20 w-64 h-[calc(100vh-4rem)] bg-[#0B132B] border-r border-slate-800 p-4 flex flex-col justify-between transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="space-y-6">
          {/* Student Status Card */}
          {studentProfile && (
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1">
                Enrolled Student
              </div>
              <div className="text-sm font-semibold text-white truncate">
                {studentProfile.fullName}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {studentProfile.courseSection}
                </span>
                <span className="text-[11px] text-slate-400">
                  @{studentProfile.username}
                </span>
              </div>
            </div>
          )}

          {/* Navigation Items */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white font-medium shadow-md shadow-indigo-600/20'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 mt-0.5 ${
                      isActive ? 'text-white' : 'text-slate-400'
                    }`}
                  />
                  <div>
                    <div className="text-xs font-semibold leading-tight">
                      {item.label}
                    </div>
                    <div
                      className={`text-[10px] mt-0.5 leading-none ${
                        isActive ? 'text-indigo-100' : 'text-slate-500'
                      }`}
                    >
                      {item.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Academic Info & Sign Out Button */}
        <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
          {/* Prominent Log Out Button */}
          <button
            type="button"
            onClick={() => {
              logout();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/60 hover:border-rose-700 transition-colors cursor-pointer shadow-sm shadow-rose-950/30"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span>Sign Out / Log Out</span>
          </button>

          {/* Terms & Conditions Link */}
          <button
            type="button"
            onClick={() => setShowTerms(true)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-medium text-slate-400 hover:text-indigo-300 hover:bg-slate-800/50 transition-colors cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span>Terms & Academic Policy</span>
          </button>

          <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-900/40 text-indigo-200">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300 mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              Gemini Flash AI Powered
            </div>
            <p className="text-[11px] text-indigo-300/80 leading-relaxed">
              Automatic academic reviewer generation, flashcards, quizzes & AI tutor for college courses.
            </p>
          </div>
        </div>
      </aside>

      <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
    </>
  );
};
